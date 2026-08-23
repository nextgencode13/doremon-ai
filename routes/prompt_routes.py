# Copyright (c) 2026 Doremon AI
# SPDX-License-Identifier: AGPL-3.0-or-later
import uuid
import json
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session as DBSession
from core.database import engine, Prompt
from src.auth_helpers import get_current_user


def setup_prompt_routes():
    router = APIRouter(prefix="/api/prompts", tags=["prompts"])

    def _db():
        return DBSession(engine)

    def _owner(request: Request):
        return get_current_user(request)

    def _verify_owner(prompt: Prompt, user):
        if user is None:
            return
        if prompt.owner != user:
            raise HTTPException(404, "Prompt not found")

    def _to_dict(p: Prompt) -> dict:
        return {
            "id": p.id,
            "owner": p.owner,
            "title": p.title,
            "body": p.body,
            "tags": p.tags or "",
            "pinned": p.pinned,
            "use_count": p.use_count,
            "sort_order": p.sort_order,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        }

    @router.get("")
    def list_prompts(request: Request, q: str = "", tag: str = ""):
        user = _owner(request)
        with _db() as db:
            query = db.query(Prompt)
            if user is not None:
                query = query.filter(Prompt.owner == user)
            prompts = query.order_by(Prompt.pinned.desc(), Prompt.sort_order, Prompt.created_at.desc()).all()
            result = [_to_dict(p) for p in prompts]
        if q:
            ql = q.lower()
            result = [p for p in result if ql in p["title"].lower() or ql in p["body"].lower()]
        if tag:
            result = [p for p in result if tag in (p["tags"] or "").split(",")]
        return {"prompts": result}

    @router.post("")
    def create_prompt(request: Request, body: dict):
        user = _owner(request)
        with _db() as db:
            p = Prompt(
                id=str(uuid.uuid4()),
                owner=user,
                title=body.get("title", "Untitled Prompt"),
                body=body.get("body", ""),
                tags=body.get("tags", ""),
                pinned=bool(body.get("pinned", False)),
                sort_order=int(body.get("sort_order", 0)),
            )
            db.add(p)
            db.commit()
            db.refresh(p)
            return _to_dict(p)

    @router.get("/export")
    def export_prompts(request: Request):
        user = _owner(request)
        with _db() as db:
            query = db.query(Prompt)
            if user is not None:
                query = query.filter(Prompt.owner == user)
            prompts = [_to_dict(p) for p in query.all()]
        content = json.dumps({"prompts": prompts}, indent=2)
        return JSONResponse(
            content={"export": content},
            headers={"Content-Disposition": "attachment; filename=prompts.json"},
        )

    @router.post("/import")
    async def import_prompts(request: Request):
        user = _owner(request)
        data = await request.json()
        prompts_data = data.get("prompts", [])
        if not isinstance(prompts_data, list):
            raise HTTPException(400, "Expected {prompts: [...]}")
        imported = 0
        with _db() as db:
            for item in prompts_data:
                if not item.get("body"):
                    continue
                p = Prompt(
                    id=str(uuid.uuid4()),
                    owner=user,
                    title=item.get("title", "Imported Prompt"),
                    body=item.get("body", ""),
                    tags=item.get("tags", ""),
                    pinned=False,
                )
                db.add(p)
                imported += 1
            db.commit()
        return {"imported": imported}

    @router.get("/{prompt_id}")
    def get_prompt(request: Request, prompt_id: str):
        user = _owner(request)
        with _db() as db:
            p = db.query(Prompt).filter(Prompt.id == prompt_id).first()
            if not p:
                raise HTTPException(404, "Prompt not found")
            _verify_owner(p, user)
            return _to_dict(p)

    @router.put("/{prompt_id}")
    def update_prompt(request: Request, prompt_id: str, body: dict):
        user = _owner(request)
        with _db() as db:
            p = db.query(Prompt).filter(Prompt.id == prompt_id).first()
            if not p:
                raise HTTPException(404, "Prompt not found")
            _verify_owner(p, user)
            for field in ("title", "body", "tags", "pinned", "sort_order"):
                if field in body:
                    setattr(p, field, body[field])
            db.commit()
            db.refresh(p)
            return _to_dict(p)

    @router.delete("/{prompt_id}")
    def delete_prompt(request: Request, prompt_id: str):
        user = _owner(request)
        with _db() as db:
            p = db.query(Prompt).filter(Prompt.id == prompt_id).first()
            if not p:
                raise HTTPException(404, "Prompt not found")
            _verify_owner(p, user)
            db.delete(p)
            db.commit()
        return {"deleted": prompt_id}

    @router.post("/{prompt_id}/use")
    def record_use(request: Request, prompt_id: str):
        user = _owner(request)
        with _db() as db:
            p = db.query(Prompt).filter(Prompt.id == prompt_id).first()
            if not p:
                raise HTTPException(404, "Prompt not found")
            _verify_owner(p, user)
            p.use_count = (p.use_count or 0) + 1
            db.commit()
        return {"use_count": p.use_count}

    return router
