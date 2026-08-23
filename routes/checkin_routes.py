# Copyright (c) 2026 Doremon AI
# SPDX-License-Identifier: AGPL-3.0-or-later
import uuid
from datetime import date, timedelta
from fastapi import APIRouter, Request, HTTPException
from sqlalchemy.orm import Session as DBSession
from sqlalchemy.exc import IntegrityError
from core.database import engine, Habit, HabitLog
from src.auth_helpers import get_current_user


def setup_checkin_routes():
    router = APIRouter(prefix="/api/habits", tags=["habits"])

    def _db():
        return DBSession(engine)

    def _owner(request: Request):
        return get_current_user(request)

    def _verify_owner(habit: Habit, user):
        if user is None:
            return
        if habit.owner != user:
            raise HTTPException(404, "Habit not found")

    def _habit_dict(h: Habit, include_today: bool = False) -> dict:
        d = {
            "id": h.id,
            "owner": h.owner,
            "name": h.name,
            "color": h.color,
            "icon": h.icon,
            "sort_order": h.sort_order,
            "archived": h.archived,
            "created_at": h.created_at.isoformat() if h.created_at else None,
        }
        if include_today:
            today = date.today().isoformat()
            d["done_today"] = any(l.date == today and l.completed for l in h.logs)
        return d

    def _compute_streak(logs: list) -> dict:
        """Compute current and longest streak from log entries."""
        done_dates = sorted({l.date for l in logs if l.completed}, reverse=True)
        if not done_dates:
            return {"current": 0, "longest": 0, "total": 0}

        # Current streak
        current = 0
        check = date.today()
        for d_str in done_dates:
            d_val = date.fromisoformat(d_str)
            if d_val == check or d_val == check - timedelta(days=1 if current > 0 else 0):
                if d_val == check - timedelta(days=current):
                    current += 1
                    check = d_val
                else:
                    break
            else:
                break

        # Longest streak
        longest = 0
        streak = 1
        sorted_asc = sorted(done_dates)
        for i in range(1, len(sorted_asc)):
            a = date.fromisoformat(sorted_asc[i - 1])
            b = date.fromisoformat(sorted_asc[i])
            if (b - a).days == 1:
                streak += 1
                longest = max(longest, streak)
            else:
                streak = 1
        longest = max(longest, streak if done_dates else 0)

        return {"current": current, "longest": longest, "total": len(done_dates)}

    @router.get("")
    def list_habits(request: Request):
        user = _owner(request)
        with _db() as db:
            q = db.query(Habit).filter(Habit.archived == False)
            if user is not None:
                q = q.filter(Habit.owner == user)
            habits = q.order_by(Habit.sort_order, Habit.created_at).all()
            today = date.today().isoformat()
            result = []
            for h in habits:
                d = _habit_dict(h)
                d["done_today"] = any(l.date == today and l.completed for l in h.logs)
                result.append(d)
        return {"habits": result}

    @router.get("/summary")
    def habits_summary(request: Request):
        user = _owner(request)
        with _db() as db:
            q = db.query(Habit).filter(Habit.archived == False)
            if user is not None:
                q = q.filter(Habit.owner == user)
            habits = q.all()
            today = date.today().isoformat()
            summary = []
            for h in habits:
                streak = _compute_streak(h.logs)
                summary.append({
                    "id": h.id,
                    "name": h.name,
                    "color": h.color,
                    "icon": h.icon,
                    "done_today": any(l.date == today and l.completed for l in h.logs),
                    "current_streak": streak["current"],
                    "longest_streak": streak["longest"],
                    "total": streak["total"],
                })
        return {"summary": summary}

    @router.post("")
    def create_habit(request: Request, body: dict):
        user = _owner(request)
        with _db() as db:
            h = Habit(
                id=str(uuid.uuid4()),
                owner=user,
                name=body.get("name", "New Habit"),
                color=body.get("color", "#4CAF50"),
                icon=body.get("icon", "✓"),
                sort_order=int(body.get("sort_order", 0)),
            )
            db.add(h)
            db.commit()
            db.refresh(h)
            return _habit_dict(h)

    @router.put("/{habit_id}")
    def update_habit(request: Request, habit_id: str, body: dict):
        user = _owner(request)
        with _db() as db:
            h = db.query(Habit).filter(Habit.id == habit_id).first()
            if not h:
                raise HTTPException(404, "Habit not found")
            _verify_owner(h, user)
            for field in ("name", "color", "icon", "sort_order", "archived"):
                if field in body:
                    setattr(h, field, body[field])
            db.commit()
            db.refresh(h)
            return _habit_dict(h)

    @router.delete("/{habit_id}")
    def delete_habit(request: Request, habit_id: str):
        user = _owner(request)
        with _db() as db:
            h = db.query(Habit).filter(Habit.id == habit_id).first()
            if not h:
                raise HTTPException(404, "Habit not found")
            _verify_owner(h, user)
            db.delete(h)
            db.commit()
        return {"deleted": habit_id}

    @router.get("/{habit_id}/logs")
    def get_logs(request: Request, habit_id: str, year: int = None):
        user = _owner(request)
        with _db() as db:
            h = db.query(Habit).filter(Habit.id == habit_id).first()
            if not h:
                raise HTTPException(404, "Habit not found")
            _verify_owner(h, user)
            logs = h.logs
            if year:
                logs = [l for l in logs if l.date.startswith(str(year))]
            return {"logs": [{"date": l.date, "completed": l.completed} for l in logs]}

    @router.post("/{habit_id}/toggle")
    def toggle_day(request: Request, habit_id: str, body: dict):
        user = _owner(request)
        day = body.get("date", date.today().isoformat())
        with _db() as db:
            h = db.query(Habit).filter(Habit.id == habit_id).first()
            if not h:
                raise HTTPException(404, "Habit not found")
            _verify_owner(h, user)
            existing = db.query(HabitLog).filter(
                HabitLog.habit_id == habit_id, HabitLog.date == day
            ).first()
            if existing:
                db.delete(existing)
                db.commit()
                return {"date": day, "completed": False}
            else:
                log = HabitLog(habit_id=habit_id, date=day, completed=True)
                db.add(log)
                try:
                    db.commit()
                except IntegrityError:
                    db.rollback()
                return {"date": day, "completed": True}

    @router.get("/{habit_id}/streak")
    def get_streak(request: Request, habit_id: str):
        user = _owner(request)
        with _db() as db:
            h = db.query(Habit).filter(Habit.id == habit_id).first()
            if not h:
                raise HTTPException(404, "Habit not found")
            _verify_owner(h, user)
            return _compute_streak(h.logs)

    return router
