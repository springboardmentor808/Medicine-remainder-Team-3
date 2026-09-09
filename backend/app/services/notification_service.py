"""
PillSync Notification Service — Production Hardened.

Handles multi-channel notification dispatch and logging via Redis.
Channels:
  - IN_APP:   Stored in Redis user stream & global audit stream.
  - EMAIL:    Native smtplib over Gmail App Password (Zero SaaS cost).
  - PUSH:     Firebase Cloud Messaging (FCM) via firebase-admin SDK (Free tier).
  - SMS:      Diverted to DEV_SMS_NUMBER or simulated (Cost-saving stub).
  - WHATSAPP: Diverted to DEV_WHATSAPP_NUMBER or simulated (Cost-saving stub).
"""

import os
import json
import uuid
import smtplib
import asyncio
import logging
import html
from datetime import datetime, timezone
from enum import Enum
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional, Any

from app.core.redis import get_redis

logger = logging.getLogger("pillsync.notifications")


# ---------------------------------------------------------------------------
# Firebase Cloud Messaging (FCM) Initialization
# ---------------------------------------------------------------------------
_firebase_initialized = False

def _init_firebase() -> bool:
    """Initialize Firebase Admin SDK once if credentials are provided."""
    global _firebase_initialized
    if _firebase_initialized:
        return True

    try:
        import firebase_admin  # type: ignore
        from firebase_admin import credentials  # type: ignore

        cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "backend/firebase_service_account.json")
        cred_json = os.getenv("FIREBASE_CREDENTIALS_JSON")

        if cred_json:
            cred_dict = json.loads(cred_json)
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
            _firebase_initialized = True
            logger.info("[FCM] Firebase initialized successfully via FIREBASE_CREDENTIALS_JSON.")
            return True
        elif os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            _firebase_initialized = True
            logger.info(f"[FCM] Firebase initialized successfully via {cred_path}.")
            return True
        else:
            logger.warning(
                f"[FCM] Firebase credentials not found at '{cred_path}'. "
                "Push notifications will be simulated until credentials are configured."
            )
            return False
    except Exception as e:
        logger.error(f"[FCM] Failed to initialize Firebase Admin SDK: {e}")
        return False


# ---------------------------------------------------------------------------
# Notification Types & Constants
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
    SYSTEM_ALERT = "system_alert"
    BROADCAST = "broadcast"
    ADVISORY = "advisory"


NOTIFICATION_LOG_PREFIX = "pillsync:notifications:log"
NOTIFICATION_GLOBAL_KEY = "pillsync:notifications:global"
NOTIFICATION_SENT_PREFIX = "pillsync:notifications:sent"
FCM_TOKEN_PREFIX = "pillsync:fcm:token"


# ---------------------------------------------------------------------------
# Device Token Management (FCM — Multi-Device Support)
# ---------------------------------------------------------------------------
async def register_device_token(user_id: uuid.UUID, device_token: str) -> bool:
    """Store or update FCM device registration tokens for a user across multiple devices."""
    client = get_redis()
    token_clean = device_token.strip()
    key_single = f"{FCM_TOKEN_PREFIX}:{user_id}"
    key_set = f"{FCM_TOKEN_PREFIX}s:{user_id}"

    # Maintain single key for backwards compatibility
    await client.set(key_single, token_clean, ex=2592000)  # 30-day TTL

    # Store in Redis set to support multiple devices (e.g. phone, tablet)
    if hasattr(client, "sadd"):
        try:
            await client.sadd(key_set, token_clean)
            await client.expire(key_set, 2592000)
        except Exception as e:
            logger.warning(f"[FCM] Failed to update Redis device token set: {e}")

    logger.info(f"[FCM] Registered device token for user {user_id}")
    return True


async def get_device_tokens(user_id: uuid.UUID) -> list[str]:
    """Retrieve all stored FCM device tokens for a user across multiple devices."""
    client = get_redis()
    tokens = set()
    key_single = f"{FCM_TOKEN_PREFIX}:{user_id}"
    key_set = f"{FCM_TOKEN_PREFIX}s:{user_id}"

    if hasattr(client, "smembers"):
        try:
            raw_set = await client.smembers(key_set)
            for t in raw_set or []:
                tokens.add(t.decode("utf-8") if isinstance(t, bytes) else str(t))
        except Exception as e:
            logger.warning(f"[FCM] Failed to retrieve device tokens from Redis set: {e}")

    try:
        single = await client.get(key_single)
        if single:
            tokens.add(single.decode("utf-8") if isinstance(single, bytes) else str(single))
    except Exception as e:
        logger.warning(f"[FCM] Failed to retrieve primary device token from Redis: {e}")

    return sorted(t for t in tokens if t)


async def get_device_token(user_id: uuid.UUID) -> Optional[str]:
    """Retrieve a primary FCM device token deterministically (most recent first)."""
    client = get_redis()
    key_single = f"{FCM_TOKEN_PREFIX}:{user_id}"
    try:
        single = await client.get(key_single)
        if single:
            return single.decode("utf-8") if isinstance(single, bytes) else str(single)
    except Exception as e:
        logger.warning(f"[FCM] Failed reading compatibility key from Redis: {e}")
    tokens = await get_device_tokens(user_id)
    return tokens[0] if tokens else None


async def prune_device_token(user_id: uuid.UUID, device_token: str) -> None:
    """Remove an invalid or rejected FCM device registration token from Redis."""
    client = get_redis()
    key_single = f"{FCM_TOKEN_PREFIX}:{user_id}"
    key_set = f"{FCM_TOKEN_PREFIX}s:{user_id}"
    try:
        if hasattr(client, "srem"):
            await client.srem(key_set, device_token)
        single = await client.get(key_single)
        single_str = single.decode("utf-8") if isinstance(single, bytes) else str(single) if single else None
        if single_str == device_token:
            remaining = await get_device_tokens(user_id)
            if remaining:
                await client.set(key_single, remaining[0], ex=2592000)
            else:
                await client.delete(key_single)
        logger.info(f"[FCM] Pruned invalid device token for user {user_id}")
    except Exception as e:
        logger.warning(f"[FCM] Failed pruning token from Redis for user {user_id}: {e}")


# ---------------------------------------------------------------------------
# Main Send Notification Entrypoint
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
    Dispatch a notification to a user across the requested channel.
    Always logs to user Redis stream.
    """
    now = datetime.now(timezone.utc)
    notification_id = str(uuid.uuid4())

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

    # 1. Always record in-app notification log in Redis
    await log_notification(user_id, notification)

    # 2. Dispatch across selected channel
    dispatched = False
    if channel == NotificationChannel.IN_APP:
        dispatched = True
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
# Notification Log Storage (Redis Streams)
# ---------------------------------------------------------------------------
async def log_notification(user_id: uuid.UUID, notification: dict) -> None:
    """Store notification in user stream (last 100) and global stream (last 200)."""
    client = get_redis()
    key = f"{NOTIFICATION_LOG_PREFIX}:{user_id}"
    serialized = json.dumps(notification, default=str)

    await client.lpush(key, serialized)
    await client.ltrim(key, 0, 99)
    await client.expire(key, 604800)  # 7 days

    try:
        await client.lpush(NOTIFICATION_GLOBAL_KEY, serialized)
        await client.ltrim(NOTIFICATION_GLOBAL_KEY, 0, 199)
        await client.expire(NOTIFICATION_GLOBAL_KEY, 604800)
    except Exception as e:
        logger.warning(f"[Notification] Failed to record in global Redis stream: {e}")


async def get_user_notifications(user_id: uuid.UUID, limit: int = 20, offset: int = 0) -> list[dict]:
    """Fetch user's recent notifications."""
    client = get_redis()
    key = f"{NOTIFICATION_LOG_PREFIX}:{user_id}"
    raw_entries = await client.lrange(key, offset, offset + limit - 1)
    notifications = []
    for entry in raw_entries:
        try:
            notifications.append(json.loads(entry))
        except (json.JSONDecodeError, TypeError):
            continue
    return notifications


async def get_global_notifications(limit: int = 50, offset: int = 0) -> list[dict]:
    """Fetch global notifications (Admin only)."""
    client = get_redis()
    raw_entries = await client.lrange(NOTIFICATION_GLOBAL_KEY, offset, offset + limit - 1)
    notifications = []
    for entry in raw_entries:
        try:
            notifications.append(json.loads(entry))
        except (json.JSONDecodeError, TypeError):
            continue
    return notifications


async def get_unread_count(user_id: uuid.UUID) -> int:
    """Count unread notifications for a user."""
    notifications = await get_user_notifications(user_id, limit=100)
    return sum(1 for n in notifications if not n.get("read", True))


async def mark_notification_read(user_id: uuid.UUID, notification_id: str) -> bool:
    """Mark a notification as read."""
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
        except Exception:
            continue
    return False


async def is_duplicate_notification(user_id: uuid.UUID, dedup_key: str, window_seconds: int = 300) -> bool:
    """Deduplicate notifications within a sliding window."""
    client = get_redis()
    key = f"{NOTIFICATION_SENT_PREFIX}:{user_id}:{dedup_key}"
    exists = await client.get(key)
    if exists:
        return True
    await client.set(key, "1", ex=window_seconds)
    return False


# ---------------------------------------------------------------------------
# Channel Dispatchers: Built-in smtplib, Firebase FCM, Dev WhatsApp/SMS
# ---------------------------------------------------------------------------

def _send_sync_smtp(recipient: str, subject: str, body_html: str, body_text: str) -> bool:
    """Synchronous SMTP dispatcher executed in worker thread via asyncio.to_thread."""
    gmail_user = os.getenv("GMAIL_USER") or os.getenv("SMTP_USER")
    gmail_pwd = os.getenv("GMAIL_APP_PASSWORD") or os.getenv("SMTP_PASSWORD")
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))

    if not gmail_user or not gmail_pwd:
        logger.warning(
            f"[Notification:EMAIL] GMAIL_USER or GMAIL_APP_PASSWORD not set. "
            f"Email to {recipient} skipped."
        )
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"PillSync Healthcare <{gmail_user}>"
    msg["To"] = recipient

    msg.attach(MIMEText(body_text, "plain", "utf-8"))
    msg.attach(MIMEText(body_html, "html", "utf-8"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(gmail_user, gmail_pwd)
            server.sendmail(gmail_user, [recipient], msg.as_string())
        logger.info(f"[Notification:EMAIL] Dispatched via smtplib to {recipient}")
        return True
    except Exception as exc:
        logger.error(f"[Notification:EMAIL] Failed dispatching via smtplib to {recipient}: {exc}")
        return False


async def _dispatch_email(notification: dict) -> bool:
    """Email notification dispatcher using Python's built-in smtplib."""
    metadata = notification.get("metadata") or {}
    recipient = metadata.get("email") or metadata.get("destination")
    
    if not recipient:
        logger.warning(f"[Notification:EMAIL] No recipient email in metadata for user {notification['user_id']}")
        return False

    title = notification.get("title", "Medication Reminder")
    message = notification.get("message", "")

    # HTML escape user-controlled text to prevent email HTML injection / XSS
    safe_title = html.escape(title)
    safe_message = html.escape(message)

    body_text = f"PillSync Alert: {title}\n\n{message}\n\nPlease take your medication as scheduled."
    body_html = f"""<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 20px;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
    <div style="background: #00685f; padding: 20px; text-align: center; color: #ffffff;">
      <h2 style="margin: 0; font-size: 20px;">💊 PillSync Healthcare</h2>
    </div>
    <div style="padding: 24px;">
      <h3 style="color: #0f172a; margin-top: 0;">{safe_title}</h3>
      <p style="color: #334155; font-size: 15px; line-height: 1.6;">{safe_message}</p>
      <div style="margin-top: 20px; padding: 12px 16px; background: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 4px;">
        <p style="margin: 0; color: #166534; font-size: 13px;">Logged securely in your PillSync patient portal.</p>
      </div>
    </div>
  </div>
 </body>
</html>"""

    return await asyncio.to_thread(_send_sync_smtp, recipient, title, body_html, body_text)


def _send_sync_fcm(token: str, title: str, body: str, data: dict) -> tuple[bool, bool]:
    """Synchronous FCM push dispatcher executed in worker thread."""
    try:
        from firebase_admin import messaging  # type: ignore

        str_data = {k: str(v) for k, v in data.items()}
        msg = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            data=str_data,
            token=token,
        )
        response = messaging.send(msg)
        logger.info(f"[Notification:PUSH] FCM dispatched successfully. ID: {response}")
        return True, False
    except Exception as exc:
        is_rejected = False
        try:
            from firebase_admin import messaging  # type: ignore
            if isinstance(exc, (messaging.UnregisteredError, messaging.SenderIdMismatchError)):
                is_rejected = True
        except Exception:
            pass

        if not is_rejected:
            err_msg = str(exc).lower()
            # Prune only if the error specifically targets the device token registration,
            # avoiding pruning for generic payload or argument errors.
            is_rejected = any(term in err_msg for term in (
                "unregistered",
                "invalid registration token",
                "registration-token-not-registered",
                "not registered",
            ))

        logger.error(f"[Notification:PUSH] FCM dispatch failed (rejected={is_rejected}): {exc}")
        return False, is_rejected


async def _dispatch_push(notification: dict) -> bool:
    """Push notification dispatcher via Firebase Cloud Messaging (FCM) supporting multi-device delivery."""
    if not _init_firebase():
        logger.info(f"[Notification:PUSH] Firebase not configured. Push skipped for: '{notification.get('title')}'")
        return False

    user_id_str = str(notification["user_id"])
    metadata = notification.get("metadata") or {}

    device_tokens: list[str] = []
    if metadata.get("device_token"):
        device_tokens = [str(metadata.get("device_token"))]
    else:
        try:
            device_tokens = await get_device_tokens(uuid.UUID(user_id_str))
        except Exception:
            device_tokens = []

    if not device_tokens:
        logger.info(f"[Notification:PUSH] No FCM device token registered for user {user_id_str}. Push skipped.")
        return False

    title = notification.get("title", "PillSync Alert")
    body = notification.get("message", "")
    data = {
        "notification_id": str(notification.get("notification_id", "")),
        "type": str(notification.get("type", "")),
        "user_id": user_id_str,
    }

    dispatched_any = False
    for dt in device_tokens:
        ok, is_rejected = await asyncio.to_thread(_send_sync_fcm, dt, title, body, data)
        if ok:
            dispatched_any = True
        elif is_rejected:
            try:
                await prune_device_token(uuid.UUID(user_id_str), dt)
            except Exception as pe:
                logger.warning(f"[Notification:PUSH] Token pruning failed: {pe}")

    return dispatched_any


async def _dispatch_sms(notification: dict) -> bool:
    """SMS dispatcher — Cost-saving stub with developer diversion logging."""
    dev_number = os.getenv("DEV_SMS_NUMBER") or os.getenv("DEV_WHATSAPP_NUMBER")
    title = notification.get("title", "")
    message = notification.get("message", "")
    user_id = notification.get("user_id", "")

    if dev_number:
        print(
            f"\n[Notification Diverted] SMS for user {user_id} was diverted to developer number {dev_number}:\n"
            f"   Title  : {title}\n"
            f"   Message: {message}\n",
            flush=True,
        )
        return True

    logger.info(f"[Notification:SMS] No SMS provider or dev number configured. Skipped SMS for user {user_id}.")
    return False


async def _dispatch_whatsapp(notification: dict) -> bool:
    """WhatsApp dispatcher — Cost-saving stub with developer diversion logging."""
    dev_number = os.getenv("DEV_WHATSAPP_NUMBER")
    title = notification.get("title", "")
    message = notification.get("message", "")
    user_id = notification.get("user_id", "")

    if dev_number:
        print(
            f"\n[Notification Diverted] WHATSAPP for user {user_id} was diverted to developer number {dev_number}:\n"
            f"   Title  : {title}\n"
            f"   Message: {message}\n",
            flush=True,
        )
        return True

    logger.info(f"[Notification:WHATSAPP] No WhatsApp provider or dev number configured. Skipped WhatsApp for user {user_id}.")
    return False
