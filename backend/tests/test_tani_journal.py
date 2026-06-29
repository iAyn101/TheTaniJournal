"""End-to-end backend tests for The Tani Journal."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://journal-app-29.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SUFFIX = uuid.uuid4().hex[:8]
USER_A = {
    "email": f"writer.a.{SUFFIX}@tanijournal.dev",
    "password": "tanidemo123",
    "name": f"Writer A {SUFFIX}",
}
USER_B = {
    "email": f"writer.b.{SUFFIX}@tanijournal.dev",
    "password": "tanidemo123",
    "name": f"Writer B {SUFFIX}",
}


# ---- Shared state across tests ----
state = {}


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ---- Health ----
def test_root():
    r = requests.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("ok") is True


# ---- Auth: register ----
def test_register_user_a():
    r = requests.post(f"{API}/auth/register", json=USER_A)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "session_token" in data and data["session_token"]
    assert data["user"]["email"] == USER_A["email"].lower()
    assert data["user"]["name"] == USER_A["name"]
    assert data["user"]["auth_provider"] == "email"
    assert "user_id" in data["user"]
    state["a_token"] = data["session_token"]
    state["a_user"] = data["user"]


def test_register_user_b():
    r = requests.post(f"{API}/auth/register", json=USER_B)
    assert r.status_code == 200, r.text
    data = r.json()
    state["b_token"] = data["session_token"]
    state["b_user"] = data["user"]


def test_register_duplicate_email():
    r = requests.post(f"{API}/auth/register", json=USER_A)
    assert r.status_code == 400


# ---- Auth: login ----
def test_login_valid():
    r = requests.post(f"{API}/auth/login", json={"email": USER_A["email"], "password": USER_A["password"]})
    assert r.status_code == 200
    data = r.json()
    assert data["session_token"]
    assert data["user"]["user_id"] == state["a_user"]["user_id"]


def test_login_invalid_password():
    r = requests.post(f"{API}/auth/login", json={"email": USER_A["email"], "password": "wrongpass"})
    assert r.status_code == 401


def test_login_unknown_email():
    r = requests.post(f"{API}/auth/login", json={"email": f"unknown.{SUFFIX}@tanijournal.dev", "password": "x123456"})
    assert r.status_code == 401


# ---- Auth: me, heartbeat ----
def test_me_requires_auth():
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401


def test_me_with_token():
    r = requests.get(f"{API}/auth/me", headers=auth_headers(state["a_token"]))
    assert r.status_code == 200
    assert r.json()["user_id"] == state["a_user"]["user_id"]


def test_heartbeat_updates_last_seen():
    r = requests.post(f"{API}/auth/heartbeat", headers=auth_headers(state["a_token"]))
    assert r.status_code == 200
    assert r.json()["ok"] is True
    # Verify user is online via public profile
    r2 = requests.get(f"{API}/users/{state['a_user']['user_id']}")
    assert r2.status_code == 200
    assert r2.json()["is_online"] is True


# ---- Google OAuth: missing X-Session-ID ----
def test_google_missing_session_id():
    r = requests.post(f"{API}/auth/google/session")
    assert r.status_code == 400


# ---- Users ----
def test_get_user_profile():
    r = requests.get(f"{API}/users/{state['a_user']['user_id']}")
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == USER_A["email"].lower()
    assert "password_hash" not in body


def test_get_user_unknown():
    r = requests.get(f"{API}/users/user_does_not_exist")
    assert r.status_code == 404


def test_update_me():
    r = requests.put(f"{API}/users/me", json={"bio": "Hello from tests", "name": USER_A["name"] + " Updated"}, headers=auth_headers(state["a_token"]))
    assert r.status_code == 200
    data = r.json()
    assert data["bio"] == "Hello from tests"
    assert data["name"].endswith("Updated")
    # Verify persisted
    r2 = requests.get(f"{API}/users/{state['a_user']['user_id']}")
    assert r2.json()["bio"] == "Hello from tests"


# ---- Posts: public ----
def test_create_public_post():
    body = {
        "title": "TEST_Public Post " + SUFFIX,
        "content": "<p>Hello <strong>world</strong></p>",
        "tags": ["Travel", "Life", " "],
        "is_public": True,
        "cover_image": "https://example.com/cover.jpg",
    }
    r = requests.post(f"{API}/posts", json=body, headers=auth_headers(state["a_token"]))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["title"] == body["title"]
    assert data["is_public"] is True
    assert data["tags"] == ["travel", "life"]
    assert data["author"]["user_id"] == state["a_user"]["user_id"]
    state["public_post_id"] = data["post_id"]


def test_create_post_requires_auth():
    r = requests.post(f"{API}/posts", json={"title": "x", "content": "y"})
    assert r.status_code == 401


def test_list_posts_public_only():
    r = requests.get(f"{API}/posts")
    assert r.status_code == 200
    data = r.json()
    assert "items" in data and isinstance(data["items"], list)
    ids = [p["post_id"] for p in data["items"]]
    assert state["public_post_id"] in ids


def test_list_posts_search():
    r = requests.get(f"{API}/posts", params={"q": SUFFIX})
    assert r.status_code == 200
    items = r.json()["items"]
    assert any(p["post_id"] == state["public_post_id"] for p in items)


def test_list_posts_tag_filter():
    r = requests.get(f"{API}/posts", params={"tag": "travel"})
    assert r.status_code == 200
    items = r.json()["items"]
    assert any(p["post_id"] == state["public_post_id"] for p in items)


def test_list_posts_author_filter():
    r = requests.get(f"{API}/posts", params={"author_id": state["a_user"]["user_id"]})
    assert r.status_code == 200
    items = r.json()["items"]
    assert all(p["author_id"] == state["a_user"]["user_id"] for p in items)


def test_popular_tags():
    r = requests.get(f"{API}/posts/tags/popular")
    assert r.status_code == 200
    tags = r.json()
    assert isinstance(tags, list)
    assert any(t["tag"] == "travel" for t in tags)


def test_get_public_post_anonymously():
    r = requests.get(f"{API}/posts/{state['public_post_id']}")
    assert r.status_code == 200
    assert r.json()["post_id"] == state["public_post_id"]


# ---- Posts: private ----
def test_create_private_post():
    body = {
        "title": "TEST_Private Post " + SUFFIX,
        "content": "<p>secret</p>",
        "tags": ["secret"],
        "is_public": False,
    }
    r = requests.post(f"{API}/posts", json=body, headers=auth_headers(state["a_token"]))
    assert r.status_code == 200
    state["private_post_id"] = r.json()["post_id"]


def test_private_post_hidden_from_anonymous():
    r = requests.get(f"{API}/posts/{state['private_post_id']}")
    assert r.status_code == 404


def test_private_post_hidden_from_other_user():
    r = requests.get(f"{API}/posts/{state['private_post_id']}", headers=auth_headers(state["b_token"]))
    assert r.status_code == 404


def test_private_post_visible_to_author():
    r = requests.get(f"{API}/posts/{state['private_post_id']}", headers=auth_headers(state["a_token"]))
    assert r.status_code == 200


def test_private_post_not_in_public_list():
    r = requests.get(f"{API}/posts", params={"limit": 50})
    items = r.json()["items"]
    assert all(p["post_id"] != state["private_post_id"] for p in items)


# ---- Posts: mine ----
def test_list_mine_includes_private():
    r = requests.get(f"{API}/posts/mine", headers=auth_headers(state["a_token"]))
    assert r.status_code == 200
    ids = [p["post_id"] for p in r.json()]
    assert state["public_post_id"] in ids
    assert state["private_post_id"] in ids


def test_list_mine_requires_auth():
    r = requests.get(f"{API}/posts/mine")
    assert r.status_code == 401


# ---- Posts: update / delete ----
def test_update_own_post():
    r = requests.put(
        f"{API}/posts/{state['public_post_id']}",
        json={"title": "TEST_Updated " + SUFFIX, "tags": ["Updated", "Travel"]},
        headers=auth_headers(state["a_token"]),
    )
    assert r.status_code == 200
    data = r.json()
    assert data["title"] == "TEST_Updated " + SUFFIX
    assert "updated" in data["tags"]


def test_update_others_post_forbidden():
    r = requests.put(
        f"{API}/posts/{state['public_post_id']}",
        json={"title": "hijacked"},
        headers=auth_headers(state["b_token"]),
    )
    assert r.status_code == 403


# ---- Comments ----
def test_create_comment():
    r = requests.post(
        f"{API}/posts/{state['public_post_id']}/comments",
        json={"content": "Nice post! " + SUFFIX},
        headers=auth_headers(state["b_token"]),
    )
    assert r.status_code == 200
    data = r.json()
    assert data["content"].startswith("Nice post!")
    state["comment_id"] = data["comment_id"]


def test_list_comments():
    r = requests.get(f"{API}/posts/{state['public_post_id']}/comments")
    assert r.status_code == 200
    items = r.json()
    assert any(c["comment_id"] == state["comment_id"] for c in items)


def test_delete_others_comment_forbidden():
    r = requests.delete(f"{API}/comments/{state['comment_id']}", headers=auth_headers(state["a_token"]))
    assert r.status_code == 403


def test_delete_own_comment():
    r = requests.delete(f"{API}/comments/{state['comment_id']}", headers=auth_headers(state["b_token"]))
    assert r.status_code == 200


# ---- Reports ----
def test_create_report():
    r = requests.post(
        f"{API}/reports",
        json={"target_type": "post", "target_id": state["public_post_id"], "reason": "spam test"},
        headers=auth_headers(state["b_token"]),
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_create_report_invalid_target_type():
    r = requests.post(
        f"{API}/reports",
        json={"target_type": "invalid", "target_id": "x", "reason": "x"},
        headers=auth_headers(state["b_token"]),
    )
    assert r.status_code == 400


# ---- Cleanup: delete posts (cascade comments) ----
def test_delete_others_post_forbidden():
    r = requests.delete(f"{API}/posts/{state['public_post_id']}", headers=auth_headers(state["b_token"]))
    assert r.status_code == 403


def test_delete_own_posts():
    for key in ("public_post_id", "private_post_id"):
        r = requests.delete(f"{API}/posts/{state[key]}", headers=auth_headers(state["a_token"]))
        assert r.status_code == 200
    # Verify gone
    r = requests.get(f"{API}/posts/{state['public_post_id']}")
    assert r.status_code == 404
