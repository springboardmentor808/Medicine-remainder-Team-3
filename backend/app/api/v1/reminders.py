"""
PillSync Reminders & Notifications API Router.

Provides endpoints for:
    - GET   /pending          — Get pending due reminders from Redis queue.
    - GET   /overdue          — Get past-due reminders from Redis queue.
    - POST  /schedule-today   — Bulk-load today's schedules into Redis reminder queue.
    - POST  /notify           — Send test or broadcast notification.
    - POST  /notify-patient   — Send direct medication reminder to a specific patient.
    - GET   /notifications    — Get user's in-app notification list.
    - PATCH /notifications/{id}/read — Mark a notification as read.
    - GET   /stats            — Get reminder queue statistics.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.adherence_service import AdherenceService
from app.services.notification_service import (
    NotificationChannel,
    NotificationType,
    get_unread_count,
    get_user_notifications,
    mark_notification_read,
    send_notification,
)
from app.services.reminder_service import (
    get_overdue_reminders,
    get_pending_reminders,
    get_queue_stats,
    schedule_daily_reminders,
)


router = APIRouter(prefix="/reminders", tags=["Reminders & Notifications"])


class NotificationBroadcastRequest(BaseModel):
    channel: Optional[str] = "all"
    title: str = Field(..., json_schema_extra={"example": "Medication Reminder"})
    message: str = Field(..., json_schema_extra={"example": "Please take your scheduled dose."})
    patient_id: Optional[str] = None


class PatientReminderRequest(BaseModel):
    patient_id: uuid.UUID = Field(..., description="Target patient UUID")
    message: Optional[str] = "Please take your scheduled medication."
    title: Optional[str] = "Caregiver Dose Reminder"


# ---------------------------------------------------------------------------
# GET /pending — Pending Reminders
# ---------------------------------------------------------------------------
@router.get(
    "/pending",
    status_code=status.HTTP_200_OK,
    summary="Get Pending Reminders",
    description="Fetch reminders due within the next N minutes from the Redis queue.",
)
async def get_pending_reminders_endpoint(
    lookahead_minutes: int = Query(15, ge=1, le=1440, description="Lookahead window in minutes"),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Fetch pending reminders from Redis queue filtered for the current user."""
    all_pending = await get_pending_reminders(lookahead_minutes=lookahead_minutes)
    user_reminders = [
        r for r in all_pending
        if r.get("user_id") == str(current_user.id)
    ]
    return user_reminders


# ---------------------------------------------------------------------------
# GET /overdue — Overdue Reminders
# ---------------------------------------------------------------------------
@router.get(
    "/overdue",
    status_code=status.HTTP_200_OK,
    summary="Get Overdue Reminders",
    description="Fetch reminders that are past their scheduled time.",
)
async def get_overdue_reminders_endpoint(
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Fetch overdue reminders from Redis queue filtered for the current user."""
    all_overdue = await get_overdue_reminders()
    return [r for r in all_overdue if r.get("user_id") == str(current_user.id)]


# ---------------------------------------------------------------------------
# POST /schedule-today — Schedule Today's Reminders
# ---------------------------------------------------------------------------
@router.post(
    "/schedule-today",
    status_code=status.HTTP_200_OK,
    summary="Schedule Today's Reminders",
    description="Populate the Redis reminder queue with all active schedules for today.",
)
async def schedule_today_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Fetch active schedules from DB and bulk-load into Redis queue for today."""
    schedules = await AdherenceService.get_user_schedules(db, current_user.id)

    today = datetime.now(timezone.utc)
    reminder_items = []
    for s in schedules:
        if not s.medicine:
            continue

        # Determine scheduled hour and minute
        hour, minute = 8, 0
        if hasattr(s.scheduled_time, "hour"):
            hour = s.scheduled_time.hour
            minute = s.scheduled_time.minute
        elif isinstance(s.scheduled_time, str) and ":" in s.scheduled_time:
            parts = s.scheduled_time.split(":")
            try:
                hour = int(parts[0])
                minute = int(parts[1][:2])
            except ValueError:
                pass

        scheduled_dt = today.replace(
            hour=hour,
            minute=minute,
            second=0,
            microsecond=0,
        )

        reminder_items.append({
            "user_id": str(current_user.id),
            "medicine_id": str(s.medicine_id),
            "schedule_id": str(s.id),
            "medicine_name": s.medicine.name,
            "dosage": s.medicine.dosage,
            "dose_label": s.dose_label or "Dose",
            "scheduled_timestamp": scheduled_dt.timestamp(),
        })

    count = await schedule_daily_reminders(reminder_items)

    return {
        "message": f"Enqueued {count} reminder(s) for today.",
        "enqueued_count": count,
    }


# ---------------------------------------------------------------------------
# POST /notify — Broadcast / Test Notification
# ---------------------------------------------------------------------------
@router.post(
    "/notify",
    status_code=status.HTTP_200_OK,
    summary="Send Broadcast Notification",
    description="Dispatch an in-app and channel notification to user or broadcast.",
)
async def send_broadcast_notification(
    payload: NotificationBroadcastRequest,
    current_user: User = Depends(get_current_user),
) -> dict:
    target_uid = current_user.id
    if payload.patient_id:
        try:
            target_uid = uuid.UUID(payload.patient_id)
        except ValueError:
            pass

    result = await send_notification(
        user_id=target_uid,
        title=payload.title,
        message=payload.message,
        notification_type=NotificationType.REMINDER,
        channel=NotificationChannel.IN_APP,
        metadata={"sender": str(current_user.id), "channel": payload.channel},
    )
    return {"message": "Notification dispatched successfully.", "data": result}


# ---------------------------------------------------------------------------
@router.post(
    "/notify-patient",
    status_code=status.HTTP_200_OK,
    summary="Notify Patient Directly",
    description="Caregiver or Admin dispatches an immediate dose reminder alert to a patient.",
)
async def notify_patient_endpoint(
    payload: PatientReminderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Caregiver or Admin dispatches an immediate dose reminder alert with RBAC verification."""
    if current_user.role != "admin" and current_user.id != payload.patient_id:
        assigned_ids = [p.id for p in getattr(current_user, "assigned_patients", [])]
        if payload.patient_id not in assigned_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not an assigned caregiver for this patient.",
            )

    result = await send_notification(
        user_id=payload.patient_id,
        title=payload.title or "Caregiver Medication Reminder",
        message=payload.message or "Please take your scheduled medication now.",
        notification_type=NotificationType.REMINDER,
        channel=NotificationChannel.IN_APP,
        metadata={"caregiver_id": str(current_user.id), "sender_name": current_user.full_name or current_user.username},
    )
    return {"message": "Dose reminder dispatched to patient.", "notification": result}


# ---------------------------------------------------------------------------
# GET /notifications — User Notifications
# ---------------------------------------------------------------------------
@router.get(
    "/notifications",
    status_code=status.HTTP_200_OK,
    summary="Get User Notifications",
    description="Fetch recent in-app notifications logged in Redis.",
)
async def get_notifications_endpoint(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Fetch recent notifications and unread count."""
    notifications = await get_user_notifications(
        user_id=current_user.id,
        limit=limit,
        offset=offset,
    )
    unread_count = await get_unread_count(current_user.id)

    return {
        "unread_count": unread_count,
        "total": len(notifications),
        "notifications": notifications,
    }


# ---------------------------------------------------------------------------
# PATCH /notifications/{notification_id}/read — Mark Notification Read
# ---------------------------------------------------------------------------
@router.patch(
    "/notifications/{notification_id}/read",
    status_code=status.HTTP_200_OK,
    summary="Mark Notification Read",
    description="Mark a specific notification as read in Redis.",
)
async def mark_notification_read_endpoint(
    notification_id: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Mark a notification as read."""
    success = await mark_notification_read(current_user.id, notification_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification '{notification_id}' not found.",
        )
    return {"message": "Notification marked as read.", "notification_id": notification_id}


# ---------------------------------------------------------------------------
# GET /stats — Queue Stats
# ---------------------------------------------------------------------------
@router.get(
    "/stats",
    status_code=status.HTTP_200_OK,
    summary="Get Reminder Queue Stats",
    description="Retrieve global Redis reminder queue metrics.",
)
async def get_stats_endpoint(
    current_user: User = Depends(get_current_user),
) -> dict:
    """Get Redis queue statistics."""
    return await get_queue_stats()
