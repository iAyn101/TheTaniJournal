"""The Tani Journal - FastAPI Backend.

REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import secrets
import bcrypt
import requests
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

PRESENCE_WINDOW_SECONDS = 60  # users considered online if last_seen within this window

# -----------------------------
# Models
# -----------------------------
def utc_now():
    return datetime.now(timezone.utc)

def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1, max_length=80)


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    bio: Optional[str] = ""
    auth_provider: str
    created_at: datetime
    last_seen: Optional[datetime] = None
    is_online: bool = False


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    picture: Optional[str] = None


class PostCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str  # HTML from rich text editor
    excerpt: Optional[str] = ""
    cover_image: Optional[str] = ""
    tags: List[str] = []
    is_public: bool = True


class PostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    excerpt: Optional[str] = None
    cover_image: Optional[str] = None
    tags: Optional[List[str]] = None
    is_public: Optional[bool] = None


class CommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class ReportCreate(BaseModel):
    target_type: str  # "post" or "comment"
    target_id: str
    reason: str = Field(min_length=1, max_length=500)


# -----------------------------
# Auth utilities
# -----------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


async def create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(48)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token,
        "expires_at": (utc_now() + timedelta(days=7)).isoformat(),
        "created_at": utc_now().isoformat(),
    })
    return token


async def get_current_user(request: Request) -> dict:
    # cookie first, then Authorization header
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < utc_now():
        raise HTTPException(status_code=401, detail="Session expired")

    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Update last_seen on each authenticated request (cheap presence heartbeat)
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"last_seen": utc_now().isoformat()}},
    )
    user["last_seen"] = utc_now().isoformat()
    return user


def to_user_public(doc: dict) -> dict:
    last_seen_str = doc.get("last_seen")
    is_online = False
    last_seen_dt = None
    if last_seen_str:
        try:
            last_seen_dt = datetime.fromisoformat(last_seen_str) if isinstance(last_seen_str, str) else last_seen_str
            if last_seen_dt.tzinfo is None:
                last_seen_dt = last_seen_dt.replace(tzinfo=timezone.utc)
            is_online = (utc_now() - last_seen_dt).total_seconds() < PRESENCE_WINDOW_SECONDS
        except Exception:
            is_online = False
    created_at = doc.get("created_at")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    return {
        "user_id": doc["user_id"],
        "email": doc.get("email", ""),
        "name": doc.get("name", ""),
        "picture": doc.get("picture", ""),
        "bio": doc.get("bio", ""),
        "auth_provider": doc.get("auth_provider", "email"),
        "created_at": created_at,
        "last_seen": last_seen_dt,
        "is_online": is_online,
    }


# -----------------------------
# Auth Routes
# -----------------------------
@api_router.post("/auth/register")
async def register(body: RegisterBody, response: Response):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = new_id("user")
    doc = {
        "user_id": user_id,
        "email": body.email.lower(),
        "name": body.name,
        "picture": f"https://api.dicebear.com/7.x/initials/svg?seed={body.name}",
        "bio": "",
        "password_hash": hash_password(body.password),
        "auth_provider": "email",
        "created_at": utc_now().isoformat(),
        "last_seen": utc_now().isoformat(),
    }
    await db.users.insert_one(doc)
    token = await create_session(user_id)
    response.set_cookie(
        "session_token", token, max_age=7 * 24 * 3600,
        httponly=True, secure=True, samesite="none", path="/"
    )
    user_public = to_user_public(doc)
    return {"user": user_public, "session_token": token}


@api_router.post("/auth/login")
async def login(body: LoginBody, response: Response):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = await create_session(user["user_id"])
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"last_seen": utc_now().isoformat()}},
    )
    user["last_seen"] = utc_now().isoformat()
    response.set_cookie(
        "session_token", token, max_age=7 * 24 * 3600,
        httponly=True, secure=True, samesite="none", path="/"
    )
    return {"user": to_user_public(user), "session_token": token}


@api_router.post("/auth/google/session")
async def google_session(request: Request, response: Response):
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing X-Session-ID")

    try:
        r = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        logging.exception("Emergent auth failure")
        raise HTTPException(status_code=401, detail=f"OAuth failed: {e}")

    email = data["email"].lower()
    name = data.get("name", email.split("@")[0])
    picture = data.get("picture", "")
    session_token = data["session_token"]

    existing = await db.users.find_one({"email": email})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "name": name, "picture": picture,
                "last_seen": utc_now().isoformat(),
                "auth_provider": existing.get("auth_provider", "google"),
            }},
        )
        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    else:
        user_id = new_id("user")
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "bio": "",
            "auth_provider": "google",
            "created_at": utc_now().isoformat(),
            "last_seen": utc_now().isoformat(),
        }
        await db.users.insert_one(user_doc)

    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (utc_now() + timedelta(days=7)).isoformat(),
        "created_at": utc_now().isoformat(),
    })

    response.set_cookie(
        "session_token", session_token, max_age=7 * 24 * 3600,
        httponly=True, secure=True, samesite="none", path="/"
    )
    return {"user": to_user_public(user_doc), "session_token": session_token}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return to_user_public(user)


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1].strip()
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


@api_router.post("/auth/heartbeat")
async def heartbeat(user: dict = Depends(get_current_user)):
    return {"ok": True, "last_seen": user["last_seen"]}


# -----------------------------
# Users / Profiles
# -----------------------------
@api_router.get("/users/{user_id}")
async def get_user(user_id: str):
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return to_user_public(u)


@api_router.put("/users/me")
async def update_me(body: ProfileUpdate, user: dict = Depends(get_current_user)):
    update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if update:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": update})
    u = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    return to_user_public(u)


# -----------------------------
# Posts
# -----------------------------
async def post_to_public(doc: dict) -> dict:
    author = await db.users.find_one({"user_id": doc["author_id"]}, {"_id": 0, "password_hash": 0})
    author_public = to_user_public(author) if author else None
    created_at = doc.get("created_at")
    updated_at = doc.get("updated_at")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    if isinstance(updated_at, str):
        updated_at = datetime.fromisoformat(updated_at)
    comment_count = await db.comments.count_documents({"post_id": doc["post_id"]})
    return {
        "post_id": doc["post_id"],
        "author_id": doc["author_id"],
        "author": author_public,
        "title": doc["title"],
        "content": doc["content"],
        "excerpt": doc.get("excerpt", ""),
        "cover_image": doc.get("cover_image", ""),
        "tags": doc.get("tags", []),
        "is_public": doc.get("is_public", True),
        "created_at": created_at,
        "updated_at": updated_at,
        "comment_count": comment_count,
    }


@api_router.post("/posts")
async def create_post(body: PostCreate, user: dict = Depends(get_current_user)):
    post_id = new_id("post")
    doc = {
        "post_id": post_id,
        "author_id": user["user_id"],
        "title": body.title,
        "content": body.content,
        "excerpt": body.excerpt or body.content[:200],
        "cover_image": body.cover_image or "",
        "tags": [t.strip().lower() for t in body.tags if t.strip()][:8],
        "is_public": body.is_public,
        "created_at": utc_now().isoformat(),
        "updated_at": utc_now().isoformat(),
    }
    await db.posts.insert_one(doc)
    return await post_to_public(doc)


@api_router.get("/posts")
async def list_posts(
    q: Optional[str] = None,
    tag: Optional[str] = None,
    author_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=50),
):
    filt = {"is_public": True}
    if q:
        filt["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"excerpt": {"$regex": q, "$options": "i"}},
            {"content": {"$regex": q, "$options": "i"}},
        ]
    if tag:
        filt["tags"] = tag.lower()
    if author_id:
        filt["author_id"] = author_id

    total = await db.posts.count_documents(filt)
    cursor = db.posts.find(filt, {"_id": 0}).sort("created_at", -1).skip((page - 1) * limit).limit(limit)
    docs = await cursor.to_list(length=limit)
    items = [await post_to_public(d) for d in docs]
    return {"items": items, "total": total, "page": page, "limit": limit}


@api_router.get("/posts/mine")
async def list_mine(user: dict = Depends(get_current_user)):
    cursor = db.posts.find({"author_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1)
    docs = await cursor.to_list(length=200)
    return [await post_to_public(d) for d in docs]


@api_router.get("/posts/tags/popular")
async def popular_tags():
    pipeline = [
        {"$match": {"is_public": True}},
        {"$unwind": "$tags"},
        {"$group": {"_id": "$tags", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 20},
    ]
    items = []
    async for row in db.posts.aggregate(pipeline):
        items.append({"tag": row["_id"], "count": row["count"]})
    return items


@api_router.get("/posts/{post_id}")
async def get_post(post_id: str, request: Request):
    doc = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Post not found")
    if not doc.get("is_public", True):
        # Only author can read private
        try:
            user = await get_current_user(request)
        except HTTPException:
            raise HTTPException(status_code=404, detail="Post not found")
        if user["user_id"] != doc["author_id"]:
            raise HTTPException(status_code=404, detail="Post not found")
    return await post_to_public(doc)


@api_router.put("/posts/{post_id}")
async def update_post(post_id: str, body: PostUpdate, user: dict = Depends(get_current_user)):
    doc = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Post not found")
    if doc["author_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not your post")
    update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if "tags" in update:
        update["tags"] = [t.strip().lower() for t in update["tags"] if t.strip()][:8]
    update["updated_at"] = utc_now().isoformat()
    await db.posts.update_one({"post_id": post_id}, {"$set": update})
    fresh = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    return await post_to_public(fresh)


@api_router.delete("/posts/{post_id}")
async def delete_post(post_id: str, user: dict = Depends(get_current_user)):
    doc = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Post not found")
    if doc["author_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not your post")
    await db.posts.delete_one({"post_id": post_id})
    await db.comments.delete_many({"post_id": post_id})
    return {"ok": True}


# -----------------------------
# Comments
# -----------------------------
async def comment_to_public(doc: dict) -> dict:
    author = await db.users.find_one({"user_id": doc["author_id"]}, {"_id": 0, "password_hash": 0})
    created_at = doc.get("created_at")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    return {
        "comment_id": doc["comment_id"],
        "post_id": doc["post_id"],
        "author_id": doc["author_id"],
        "author": to_user_public(author) if author else None,
        "content": doc["content"],
        "created_at": created_at,
    }


@api_router.post("/posts/{post_id}/comments")
async def create_comment(post_id: str, body: CommentCreate, user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    comment_id = new_id("cmt")
    doc = {
        "comment_id": comment_id,
        "post_id": post_id,
        "author_id": user["user_id"],
        "content": body.content,
        "created_at": utc_now().isoformat(),
    }
    await db.comments.insert_one(doc)
    return await comment_to_public(doc)


@api_router.get("/posts/{post_id}/comments")
async def list_comments(post_id: str):
    cursor = db.comments.find({"post_id": post_id}, {"_id": 0}).sort("created_at", 1)
    docs = await cursor.to_list(length=500)
    return [await comment_to_public(d) for d in docs]


@api_router.delete("/comments/{comment_id}")
async def delete_comment(comment_id: str, user: dict = Depends(get_current_user)):
    doc = await db.comments.find_one({"comment_id": comment_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Comment not found")
    if doc["author_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not your comment")
    await db.comments.delete_one({"comment_id": comment_id})
    return {"ok": True}


# -----------------------------
# Reports
# -----------------------------
@api_router.post("/reports")
async def create_report(body: ReportCreate, user: dict = Depends(get_current_user)):
    if body.target_type not in ("post", "comment"):
        raise HTTPException(status_code=400, detail="Invalid target_type")
    report_id = new_id("rep")
    await db.reports.insert_one({
        "report_id": report_id,
        "reporter_id": user["user_id"],
        "target_type": body.target_type,
        "target_id": body.target_id,
        "reason": body.reason,
        "status": "open",
        "created_at": utc_now().isoformat(),
    })
    return {"ok": True, "report_id": report_id}


# -----------------------------
# Root
# -----------------------------
@api_router.get("/")
async def root():
    return {"message": "Tani Journal API", "ok": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
