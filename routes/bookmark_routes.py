# Copyright (c) 2026 Doremon AI
# SPDX-License-Identifier: AGPL-3.0-or-later
import uuid
from fastapi import APIRouter, Request, HTTPException
from sqlalchemy.orm import Session as DBSession
from core.database import engine, Bookmark
from src.auth_helpers import get_current_user


def setup_bookmark_routes():
    router = APIRouter(prefix="/api/bookmarks", tags=["bookmarks"])

    def _db():
        return DBSession(engine)

    def _owner(request: Request):
        return get_current_user(request)

    def _verify_owner(b: Bookmark, user):
        if user is None:
            return
        if b.owner != user:
            raise HTTPException(404, "Bookmark not found")

    def _to_dict(b: Bookmark) -> dict:
        return {
            "id": b.id,
            "owner": b.owner,
            "url": b.url,
            "title": b.title or "",
            "description": b.description or "",
            "favicon_url": b.favicon_url,
            "tags": b.tags or "",
            "is_read": b.is_read,
            "pinned": b.pinned,
            "created_at": b.created_at.isoformat() if b.created_at else None,
        }

    @router.get("")
    def list_bookmarks(request: Request, q: str = "", tag: str = "", unread: bool = False, pinned: bool = False):
        user = _owner(request)
        with _db() as db:
            query = db.query(Bookmark)
            if user is not None:
                query = query.filter(Bookmark.owner == user)
            if unread:
                query = query.filter(Bookmark.is_read == False)
            if pinned:
                query = query.filter(Bookmark.pinned == True)
            bookmarks = query.order_by(Bookmark.pinned.desc(), Bookmark.created_at.desc()).all()
            result = [_to_dict(b) for b in bookmarks]
        if q:
            ql = q.lower()
            result = [b for b in result if ql in (b["title"] or "").lower() or ql in (b["description"] or "").lower() or ql in b["url"].lower() or ql in (b["tags"] or "").lower()]
        if tag:
            result = [b for b in result if tag in (b["tags"] or "").split(",")]
        return {"bookmarks": result}

    @router.post("")
    async def create_bookmark(request: Request, body: dict):
        user = _owner(request)
        url = body.get("url", "").strip()
        if not url:
            raise HTTPException(400, "url is required")
        with _db() as db:
            b = Bookmark(
                id=str(uuid.uuid4()),
                owner=user,
                url=url,
                title=body.get("title", ""),
                description=body.get("description", ""),
                favicon_url=body.get("favicon_url"),
                tags=body.get("tags", ""),
                is_read=bool(body.get("is_read", False)),
                pinned=bool(body.get("pinned", False)),
            )
            db.add(b)
            db.commit()
            db.refresh(b)
            return _to_dict(b)

    @router.post("/fetch-meta")
    async def fetch_meta(request: Request, body: dict):
        """Server-side fetch of URL title + description to avoid CORS."""
        url = body.get("url", "").strip()
        if not url:
            raise HTTPException(400, "url is required")
        try:
            import httpx
            from html.parser import HTMLParser

            class _MetaParser(HTMLParser):
                def __init__(self):
                    super().__init__()
                    self.title = ""
                    self.description = ""
                    self._in_title = False
                def handle_starttag(self, tag, attrs):
                    attrs_dict = dict(attrs)
                    if tag == "title":
                        self._in_title = True
                    if tag == "meta":
                        name = attrs_dict.get("name", "").lower()
                        prop = attrs_dict.get("property", "").lower()
                        content = attrs_dict.get("content", "")
                        if name in ("description", "og:description") or prop in ("og:description",):
                            if not self.description:
                                self.description = content
                def handle_data(self, data):
                    if self._in_title:
                        self.title += data
                def handle_endtag(self, tag):
                    if tag == "title":
                        self._in_title = False

            async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
                resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            parser = _MetaParser()
            parser.feed(resp.text[:30000])

            from urllib.parse import urlparse
            domain = urlparse(url).netloc
            favicon = f"https://www.google.com/s2/favicons?domain={domain}&sz=32"

            return {
                "title": parser.title.strip(),
                "description": parser.description.strip(),
                "favicon_url": favicon,
            }
        except Exception as e:
            return {"title": "", "description": "", "favicon_url": None}

    @router.get("/{bookmark_id}")
    def get_bookmark(request: Request, bookmark_id: str):
        user = _owner(request)
        with _db() as db:
            b = db.query(Bookmark).filter(Bookmark.id == bookmark_id).first()
            if not b:
                raise HTTPException(404, "Bookmark not found")
            _verify_owner(b, user)
            return _to_dict(b)

    @router.put("/{bookmark_id}")
    def update_bookmark(request: Request, bookmark_id: str, body: dict):
        user = _owner(request)
        with _db() as db:
            b = db.query(Bookmark).filter(Bookmark.id == bookmark_id).first()
            if not b:
                raise HTTPException(404, "Bookmark not found")
            _verify_owner(b, user)
            for field in ("title", "description", "tags", "is_read", "pinned", "favicon_url"):
                if field in body:
                    setattr(b, field, body[field])
            db.commit()
            db.refresh(b)
            return _to_dict(b)

    @router.delete("/{bookmark_id}")
    def delete_bookmark(request: Request, bookmark_id: str):
        user = _owner(request)
        with _db() as db:
            b = db.query(Bookmark).filter(Bookmark.id == bookmark_id).first()
            if not b:
                raise HTTPException(404, "Bookmark not found")
            _verify_owner(b, user)
            db.delete(b)
            db.commit()
        return {"deleted": bookmark_id}

    @router.post("/{bookmark_id}/autotag")
    async def autotag(request: Request, bookmark_id: str):
        """Use LLM to auto-tag a bookmark based on its title + description."""
        user = _owner(request)
        with _db() as db:
            b = db.query(Bookmark).filter(Bookmark.id == bookmark_id).first()
            if not b:
                raise HTTPException(404, "Bookmark not found")
            _verify_owner(b, user)
            text = f"URL: {b.url}\nTitle: {b.title}\nDescription: {b.description}"
        try:
            from core.constants import internal_api_base
            import httpx
            prompt = f"Given this URL info, suggest 2-4 short, lowercase tags (comma-separated). Only return the tags, nothing else.\n\n{text}"
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.post(
                    f"{internal_api_base}/api/chat/complete",
                    json={"messages": [{"role": "user", "content": prompt}]},
                )
            tags = ""
            if resp.status_code == 200:
                data = resp.json()
                tags = (data.get("content") or data.get("message") or "").strip()
        except Exception:
            tags = ""

        with _db() as db:
            b = db.query(Bookmark).filter(Bookmark.id == bookmark_id).first()
            if b:
                b.tags = tags
                db.commit()
        return {"tags": tags}

    return router
