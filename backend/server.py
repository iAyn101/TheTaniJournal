"""The Tani Journal - FastAPI Backend.

REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query, UploadFile, File, WebSocket
from fastapi.responses import RedirectResponse, JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import secrets
import bcrypt
import requests
import json
import shutil
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MEDIA_DIR = ROOT_DIR / 'media'
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

BACKEND_BASE_URL = os.environ.get('BACKEND_BASE_URL')
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')
GOOGLE_REDIRECT_URI = os.environ.get('GOOGLE_REDIRECT_URI')
ADMIN_EMAILS = set(email.strip().lower() for email in os.environ.get('ADMIN_EMAILS', '').split(',') if email.strip())

app = FastAPI()
app.mount("/media", StaticFiles(directory=str(MEDIA_DIR)), name="media")
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
    is_admin: bool = False
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
    font_family: Optional[str] = None
    background_color: Optional[str] = None
    background_image: Optional[str] = None
    layout_style: Optional[str] = None
    audio_urls: List[str] = []
    video_urls: List[str] = []
    explicit_content: bool = False


class PostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    excerpt: Optional[str] = None
    cover_image: Optional[str] = None
    tags: Optional[List[str]] = None
    is_public: Optional[bool] = None
    font_family: Optional[str] = None
    background_color: Optional[str] = None
    background_image: Optional[str] = None
    layout_style: Optional[str] = None
    audio_urls: Optional[List[str]] = None
    video_urls: Optional[List[str]] = None
    explicit_content: Optional[bool] = None


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
        "is_admin": doc.get("is_admin", False),
        "drive_connected": bool(doc.get("drive_refresh_token")),
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


@api_router.get("/auth/google/url")
def google_auth_url():
    if not GOOGLE_CLIENT_ID or not GOOGLE_REDIRECT_URI:
        raise HTTPException(status_code=500, detail="Google OAuth is not configured")
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile https://www.googleapis.com/auth/drive.file",
        "access_type": "offline",
        "prompt": "consent",
    }
    url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    return {"url": url}


def exchange_google_code(code: str) -> dict:
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET or not GOOGLE_REDIRECT_URI:
        raise HTTPException(status_code=500, detail="Google OAuth is not configured")
    data = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }
    r = requests.post("https://oauth2.googleapis.com/token", data=data, timeout=10)
    r.raise_for_status()
    return r.json()


def fetch_google_userinfo(access_token: str) -> dict:
    r = requests.get(
        "https://openidconnect.googleapis.com/v1/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )
    r.raise_for_status()
    return r.json()


def save_uploaded_file(upload_file: UploadFile) -> str:
    file_name = f"{uuid.uuid4().hex}_{Path(upload_file.filename).name}"
    file_path = MEDIA_DIR / file_name
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)
    return f"/media/{file_name}"


def get_google_access_token(refresh_token: str) -> str:
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth credentials missing")
    data = {
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }
    r = requests.post("https://oauth2.googleapis.com/token", data=data, timeout=10)
    r.raise_for_status()
    token_data = r.json()
    return token_data.get("access_token")


def upload_to_drive(user: dict, name: str, mime_type: str, content: bytes) -> dict:
    refresh_token = user.get("drive_refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=400, detail="Google Drive is not connected")
    access_token = get_google_access_token(refresh_token)
    metadata = {
        "name": name,
        "mimeType": mime_type,
    }
    files = {
        "metadata": (None, json.dumps(metadata), "application/json; charset=UTF-8"),
        "file": (name, content, mime_type),
    }
    headers = {"Authorization": f"Bearer {access_token}"}
    r = requests.post("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", headers=headers, files=files, timeout=20)
    r.raise_for_status()
    return r.json()


@api_router.post("/auth/google/callback")
async def google_callback(body: dict, response: Response):
    if "code" not in body:
        raise HTTPException(status_code=400, detail="Missing authorization code")
    try:
        token_data = exchange_google_code(body["code"])
        userinfo = fetch_google_userinfo(token_data["access_token"])
    except Exception as e:
        logging.exception("Google OAuth failure")
        raise HTTPException(status_code=401, detail=f"OAuth failed: {e}")

    email = userinfo["email"].lower()
    name = userinfo.get("name", email.split("@")[0])
    picture = userinfo.get("picture", "")
    refresh_token = token_data.get("refresh_token")

    existing = await db.users.find_one({"email": email})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "name": name,
                "picture": picture,
                "last_seen": utc_now().isoformat(),
                "auth_provider": "google",
                "is_admin": email in ADMIN_EMAILS,
                **({"drive_refresh_token": refresh_token} if refresh_token else {}),
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
            "is_admin": email in ADMIN_EMAILS,
            "drive_refresh_token": refresh_token,
            "created_at": utc_now().isoformat(),
            "last_seen": utc_now().isoformat(),
        }
        await db.users.insert_one(user_doc)

    session_token = await create_session(user_id)
    response.set_cookie(
        "session_token", session_token, max_age=7 * 24 * 3600,
        httponly=True, secure=True, samesite="none", path="/"
    )
    return {"user": to_user_public(user_doc), "session_token": session_token}


@api_router.post("/auth/google/session")
async def google_session(request: Request, response: Response):
    raise HTTPException(status_code=400, detail="Use the new Google OAuth flow")


@api_router.post("/media/upload")
async def upload_media(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    url = save_uploaded_file(file)
    return {"url": url}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return to_user_public(user)


@api_router.post("/auth/google/disconnect")
async def google_disconnect(user: dict = Depends(get_current_user)):
    await db.users.update_one({"user_id": user["user_id"]}, {"$unset": {"drive_refresh_token": ""}})
    user_doc = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    return {"ok": True, "user": to_user_public(user_doc)}


@api_router.get("/auth/google/reconnect_url")
async def google_reconnect_url(user: dict = Depends(get_current_user)):
    if not GOOGLE_CLIENT_ID or not GOOGLE_REDIRECT_URI:
        raise HTTPException(status_code=500, detail="Google OAuth is not configured")
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile https://www.googleapis.com/auth/drive.file",
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "false",
        "login_hint": user.get("email", ""),
    }
    url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    return {"url": url}


def send_email_via_smtp(to_email: str, subject: str, body: str) -> None:
    import smtplib
    from email.message import EmailMessage
    smtp_host = os.environ.get("SMTP_HOST")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASS")
    mail_from = os.environ.get("MAIL_FROM", smtp_user)
    if not smtp_host or not smtp_user or not smtp_pass:
        raise RuntimeError("SMTP not configured")
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = mail_from
    msg["To"] = to_email
    msg.set_content(body)
    with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as s:
        s.starttls()
        s.login(smtp_user, smtp_pass)
        s.send_message(msg)


@api_router.post("/auth/google/request_refresh_email")
async def request_refresh_email(user: dict = Depends(get_current_user)):
    if not user.get("email"):
        raise HTTPException(status_code=400, detail="User has no email")
    try:
        # Build reconnect URL
        params = {
            "client_id": GOOGLE_CLIENT_ID,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "scope": "openid email profile https://www.googleapis.com/auth/drive.file",
            "access_type": "offline",
            "prompt": "consent",
            "include_granted_scopes": "false",
            "login_hint": user.get("email", ""),
        }
        url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
        subject = "Reconnect your Google Drive for Tani Journal"
        body = f"Hi {user.get('name','')},\n\nTo enable Google Drive backups we need you to re-authorize with Google to grant a refresh token. Please click the link below and complete the flow:\n\n{url}\n\nIf you did not request this, ignore this message.\n\n— Tani Journal"
        send_email_via_smtp(user["email"], subject, body)
        return {"ok": True}
    except RuntimeError:
        raise HTTPException(status_code=500, detail="SMTP not configured on server")
    except Exception as e:
        logging.exception("Failed to send reconnect email")
        raise HTTPException(status_code=500, detail=str(e))


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
        "font_family": doc.get("font_family"),
        "background_color": doc.get("background_color"),
        "background_image": doc.get("background_image"),
        "layout_style": doc.get("layout_style"),
        "audio_urls": doc.get("audio_urls", []),
        "video_urls": doc.get("video_urls", []),
        "explicit_content": doc.get("explicit_content", False),
        "likes": doc.get("likes", 0),
        "views": doc.get("views", 0),
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
        "font_family": body.font_family,
        "background_color": body.background_color,
        "background_image": body.background_image,
        "layout_style": body.layout_style,
        "audio_urls": [u for u in body.audio_urls if u],
        "video_urls": [u for u in body.video_urls if u],
        "explicit_content": body.explicit_content,
        "likes": 0,
        "views": 0,
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
    allow_explicit: bool = False,
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=50),
):
    filt = {"is_public": True}
    if not allow_explicit:
        filt["explicit_content"] = False
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
        try:
            user = await get_current_user(request)
        except HTTPException:
            raise HTTPException(status_code=404, detail="Post not found")
        if user["user_id"] != doc["author_id"]:
            raise HTTPException(status_code=404, detail="Post not found")
    return await post_to_public(doc)


@api_router.post("/posts/{post_id}/view")
async def increment_view(post_id: str):
    result = await db.posts.find_one_and_update(
        {"post_id": post_id},
        {"$inc": {"views": 1}},
        return_document=False,
        projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Post not found")
    fresh = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    return {"views": fresh.get("views", 0)}


@api_router.post("/posts/{post_id}/like")
async def like_post(post_id: str, user: dict = Depends(get_current_user)):
    result = await db.posts.find_one_and_update(
        {"post_id": post_id},
        {"$inc": {"likes": 1}},
        return_document=False,
        projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Post not found")
    fresh = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    return {"likes": fresh.get("likes", 0)}


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
    if "audio_urls" in update:
        update["audio_urls"] = [u for u in update["audio_urls"] if u]
    if "video_urls" in update:
        update["video_urls"] = [u for u in update["video_urls"] if u]
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


@api_router.get("/admin/reports")
async def list_reports(user: dict = Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    cursor = db.reports.find({}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(length=200)


@api_router.get("/admin/users")
async def list_users(user: dict = Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    cursor = db.users.find({}, {"_id": 0, "password_hash": 0})
    return [to_user_public(u) for u in await cursor.to_list(length=200)]


@api_router.post("/admin/reports/{report_id}/resolve")
async def resolve_report(report_id: str, user: dict = Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await db.reports.find_one_and_update(
        {"report_id": report_id},
        {"$set": {"status": "resolved"}},
        return_document=False,
        projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"ok": True, "report": result}


@api_router.post("/drive/backup")
async def drive_backup(request: Request, user: dict = Depends(get_current_user)):
    if not user.get("drive_refresh_token"):
        raise HTTPException(status_code=400, detail="Google Drive is not connected")
    posts = await db.posts.find({"author_id": user["user_id"]}, {"_id": 0}).to_list(length=500)
    payload = {
        "user": to_user_public(user),
        "posts": posts,
        "backup_at": utc_now().isoformat(),
    }
    content = json.dumps(payload, indent=2).encode("utf-8")
    result = upload_to_drive(user, f"tani_journal_backup_{user['user_id']}.json", "application/json", content)
    return {"ok": True, "file": result}


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
