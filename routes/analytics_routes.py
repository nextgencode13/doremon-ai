# Copyright (c) 2026 Doremon AI
# SPDX-License-Identifier: AGPL-3.0-or-later
import csv
import io
from datetime import datetime, timedelta
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import func, text
from core.database import engine, Session as ChatSession, ChatMessage, ScheduledTask, Note
from src.auth_helpers import get_current_user


def setup_analytics_routes():
    router = APIRouter(prefix="/api/analytics", tags=["analytics"])

    def _db():
        return DBSession(engine)

    def _owner(request: Request):
        return get_current_user(request)

    @router.get("/summary")
    def get_summary(request: Request):
        user = _owner(request)
        with _db() as db:
            session_q = db.query(ChatSession)
            if user is not None:
                session_q = session_q.filter(ChatSession.owner == user)
            sessions = session_q.all()
            total_sessions = len(sessions)

            msg_q = db.query(ChatMessage)
            if user is not None:
                session_ids = [s.id for s in sessions]
                msg_q = msg_q.filter(ChatMessage.session_id.in_(session_ids)) if session_ids else msg_q.filter(False)
            total_messages = msg_q.count()

            # Count unique active days from sessions
            dates = set()
            for s in sessions:
                if s.created_at:
                    dates.add(s.created_at.date().isoformat())
            active_days = len(dates)

            # Model usage counts from messages
            models: dict = {}
            for msg in msg_q.filter(ChatMessage.role == "assistant").all():
                model_id = getattr(msg, "model", None) or "unknown"
                models[model_id] = models.get(model_id, 0) + 1
            top_models = sorted(models.items(), key=lambda x: x[1], reverse=True)[:5]

            # Task completion
            task_q = db.query(ScheduledTask)
            if user is not None:
                task_q = task_q.filter(ScheduledTask.owner == user)
            total_tasks = task_q.count()
            completed_tasks = task_q.filter(ScheduledTask.status == "completed").count()
            completion_rate = round((completed_tasks / total_tasks * 100) if total_tasks else 0, 1)

        return {
            "total_sessions": total_sessions,
            "total_messages": total_messages,
            "active_days": active_days,
            "top_models": [{"model": m, "count": c} for m, c in top_models],
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "task_completion_rate": completion_rate,
        }

    @router.get("/activity")
    def get_activity(request: Request, days: int = 90):
        user = _owner(request)
        cutoff = datetime.utcnow() - timedelta(days=days)
        with _db() as db:
            session_q = db.query(ChatSession).filter(ChatSession.created_at >= cutoff)
            if user is not None:
                session_q = session_q.filter(ChatSession.owner == user)
            sessions = session_q.all()
            session_ids = [s.id for s in sessions]

            # Count messages per day
            activity: dict = {}
            if session_ids:
                msg_q = db.query(ChatMessage).filter(
                    ChatMessage.session_id.in_(session_ids),
                    ChatMessage.role == "user",
                )
                for msg in msg_q.all():
                    if msg.created_at:
                        day = msg.created_at.date().isoformat()
                        activity[day] = activity.get(day, 0) + 1

        return {"activity": activity}

    @router.get("/models")
    def get_model_usage(request: Request):
        user = _owner(request)
        with _db() as db:
            session_q = db.query(ChatSession)
            if user is not None:
                session_q = session_q.filter(ChatSession.owner == user)
            session_ids = [s.id for s in session_q.all()]

            models: dict = {}
            if session_ids:
                msg_q = db.query(ChatMessage).filter(
                    ChatMessage.session_id.in_(session_ids),
                    ChatMessage.role == "assistant",
                )
                for msg in msg_q.all():
                    model_id = getattr(msg, "model", None) or "unknown"
                    models[model_id] = models.get(model_id, 0) + 1

        sorted_models = sorted(models.items(), key=lambda x: x[1], reverse=True)
        return {"models": [{"model": m, "count": c} for m, c in sorted_models]}

    @router.get("/export")
    def export_csv(request: Request):
        user = _owner(request)
        with _db() as db:
            session_q = db.query(ChatSession)
            if user is not None:
                session_q = session_q.filter(ChatSession.owner == user)
            sessions = session_q.order_by(ChatSession.created_at.desc()).all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["session_id", "title", "created_at", "last_accessed"])
        for s in sessions:
            writer.writerow([
                s.id,
                (s.title or "").replace(",", ";"),
                s.created_at.isoformat() if s.created_at else "",
                s.last_accessed.isoformat() if hasattr(s, "last_accessed") and s.last_accessed else "",
            ])

        output.seek(0)
        return StreamingResponse(
            iter([output.read()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=analytics.csv"},
        )

    return router
