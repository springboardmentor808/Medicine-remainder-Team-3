"""
PillSync Notification Service.

Handles notification dispatch and logging via Redis.
Supports multiple channels (Push, Email, SMS, WhatsApp) with
a pluggable architecture — actual channel integrations (Twilio,
SendGrid) are Phase 4+ but the framework is ready.
"""

import json
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from app.core.redis import get_redis


# ---------------------------------------------------------------------------
# Notification Types
# ---------------------------------------------------------------------------

class NotificationChannel(str, Enum):
    """Supported notification delivery channels."""
    PUSH = "push"
    EMAIL = "email"
    SMS = "sms"
    WHATSAPP = "whatsapp"
    IN_APP = "in_app"


class NotificationType(str, Enum):
    """Types of notifications sent by PillSync."""
    REMINDER = "reminder"
    MISSED_DOSE = "missed_dose"
    LOW_STOCK = "low_stock"
    REFILL_ALERT = "refill_alert"
    EMERGENCY = "emergency"
    SYSTEM = "system"


# Redis keys
NOTIFICATION_LOG_PREFIX = "pillsync:notifications:log"
NOTIFICATION_SENT_PREFIX = "pillsync:notifications:sent"


# ---------------------------------------------------------------------------
# Send Notification
# ---------------------------------------------------------------------------

async def send_notification(
    user_id: uuid.UUID,
    title: str,
    message: str,
    notification_type: NotificationType = NotificationType.REMINDER,
    channel: NotificationChannel = NotificationChannel.IN_APP,
    metadata: Optional[dict] = None,
) -> dict:
    """
    Dispatch a notification to a user.

    Currently stores the notification in Redis for in-app delivery.
    Phase 4+ will add actual Push/Email/SMS/WhatsApp dispatch via
    Twilio and SendGrid.

    Args:
        user_id: Target user UUID.
        title: Notification title.
        message: Notification body text.
        notification_type: Category of notification.
        channel: Delivery channel.
        metadata: Optional extra data (medicine_id, schedule_id, etc.).

    Returns:
        Dict with notification_id and status.
    """
    notification_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    notification = {
        "notification_id": notification_id,
        "user_id": str(user_id),
        "title": title,
        "message": message,
        "type": notification_type.value,
        "channel": channel.value,
        "metadata": metadata or {},
        "created_at": now.isoformat(),
        "read": False,
    }

    # Log the notification
    await log_notification(user_id, notification)

    # Channel-specific dispatch (pluggable)
    dispatched = False
    if channel == NotificationChannel.IN_APP:
        dispatched = True  # Stored in Redis, client polls
    elif channel == NotificationChannel.PUSH:
        dispatched = await _dispatch_push(notification)
    elif channel == NotificationChannel.EMAIL:
        dispatched = await _dispatch_email(notification)
    elif channel == NotificationChannel.SMS:
        dispatched = await _dispatch_sms(notification)
    elif channel == NotificationChannel.WHATSAPP:
        dispatched = await _dispatch_whatsapp(notification)

    return {
        "notification_id": notification_id,
        "status": "sent" if dispatched else "queued",
        "channel": channel.value,
    }


# ---------------------------------------------------------------------------
# Notification Log (Redis List per User)
# ---------------------------------------------------------------------------

async def log_notification(
    user_id: uuid.UUID,
    notification: dict,
) -> None:
    """
    Store a notification in the user's Redis notification log.

    Keeps the last 100 notifications per user with a 7-day TTL.
    """
    client = get_redis()
    key = f"{NOTIFICATION_LOG_PREFIX}:{user_id}"
    serialized = json.dumps(notification, default=str)

    await client.lpush(key, serialized)
    await client.ltrim(key, 0, 99)  # Keep last 100
    await client.expire(key, 604800)  # 7 days TTL


async def get_user_notifications(
    user_id: uuid.UUID,
    limit: int = 20,
    offset: int = 0,
) -> list[dict]:
    """
    Fetch recent notifications for a user.

    Args:
        user_id: Target user UUID.
        limit: Max notifications to return.
        offset: Starting position.

    Returns:
        List of notification dicts (newest first).
    """
    client = get_redis()
    key = f"{NOTIFICATION_LOG_PREFIX}:{user_id}"
    raw_entries = await client.lrange(key, offset, offset + limit - 1)

    notifications = []
    for entry in raw_entries:
        try:
            notifications.append(json.loads(entry))
        except json.JSONDecodeError:
            continue

    return notifications


async def get_unread_count(user_id: uuid.UUID) -> int:
    """Count unread notifications for a user."""
    notifications = await get_user_notifications(user_id, limit=100)
    return sum(1 for n in notifications if not n.get("read", True))


async def mark_notification_read(
    user_id: uuid.UUID,
    notification_id: str,
) -> bool:
    """Mark a specific notification as read."""
    client = get_redis()
    key = f"{NOTIFICATION_LOG_PREFIX}:{user_id}"
    all_entries = await client.lrange(key, 0, -1)

    for i, entry in enumerate(all_entries):
        try:
            data = json.loads(entry)
            if data.get("notification_id") == notification_id:
                data["read"] = True
                await client.lset(key, i, json.dumps(data, default=str))
                return True
        except (json.JSONDecodeError, Exception):
            continue

    return False


# ---------------------------------------------------------------------------
# Deduplication — Prevent duplicate notifications
# ---------------------------------------------------------------------------

async def is_duplicate_notification(
    user_id: uuid.UUID,
    dedup_key: str,
    window_seconds: int = 300,
) -> bool:
    """
    Check if an identical notification was sent recently.

    Args:
        user_id: Target user.
        dedup_key: Unique key for the notification context
                   (e.g., f"{medicine_id}:{notification_type}").
        window_seconds: Dedup window (default: 5 minutes).

    Returns:
        True if a duplicate was sent within the window.
    """
    client = get_redis()
    key = f"{NOTIFICATION_SENT_PREFIX}:{user_id}:{dedup_key}"
    exists = await client.get(key)

    if exists:
        return True

    await client.set(key, "1", ex=window_seconds)
    return False


# ---------------------------------------------------------------------------
# Channel Dispatchers (Phase 4+ — Placeholder Hooks)
# ---------------------------------------------------------------------------

async def _dispatch_push(notification: dict) -> bool:
    """Push notification via FCM/APNs. Phase 4+ implementation."""
    # TODO: Integrate Firebase Cloud Messaging or APNs
    print(f"[Notification] PUSH queued: {notification['title']}")
    return True


async def _dispatch_email(notification: dict) -> bool:
    """Email notification via SendGrid. Phase 4+ implementation."""
    # TODO: Integrate SendGrid API
    print(f"[Notification] EMAIL queued: {notification['title']}")
    return True


async def _dispatch_sms(notification: dict) -> bool:
    """SMS notification via Twilio. Phase 4+ implementation."""
    # TODO: Integrate Twilio SMS API
    print(f"[Notification] SMS queued: {notification['title']}")
    return True


async def _dispatch_whatsapp(notification: dict) -> bool:
    """WhatsApp notification via Twilio. Phase 4+ implementation."""
    # TODO: Integrate Twilio WhatsApp API
    print(f"[Notification] WHATSAPP queued: {notification['title']}")
    return True
