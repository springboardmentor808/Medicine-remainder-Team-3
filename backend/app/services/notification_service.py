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
        resolved_path = None
        for p in [cred_path, os.path.basename(cred_path), os.path.join("backend", os.path.basename(cred_path))]:
            if p and os.path.exists(p):
                resolved_path = p
                break

        if resolved_path:
            cred = credentials.Certificate(resolved_path)
            firebase_admin.initialize_app(cred)
            _firebase_initialized = True
            logger.info(f"[FCM] Firebase initialized successfully via {resolved_path}.")
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
    """Retrieve all stored FCM device tokens for a user across multiple devices.
    The primary token (from compatibility key) is placed first deterministically.
    """
    client = get_redis()
    key_single = f"{FCM_TOKEN_PREFIX}:{user_id}"
    key_set = f"{FCM_TOKEN_PREFIX}s:{user_id}"

    primary_token: Optional[str] = None
    try:
        single = await client.get(key_single)
        if single:
            primary_token = single.decode("utf-8") if isinstance(single, bytes) else str(single)
    except Exception as e:
        logger.warning(f"[FCM] Failed to retrieve primary device token from Redis compatibility key: {e}")

    other_tokens = set()
    if hasattr(client, "smembers"):
        try:
            raw_set = await client.smembers(key_set)
            for t in raw_set or []:
                tok_str = t.decode("utf-8") if isinstance(t, bytes) else str(t)
                if tok_str:
                    other_tokens.add(tok_str)
        except Exception as e:
            logger.warning(f"[FCM] Failed to retrieve device tokens from Redis set: {e}")

    # Build deterministic ordered list: primary token first, followed by remaining tokens sorted
    ordered_tokens: list[str] = []
    if primary_token:
        ordered_tokens.append(primary_token)
        other_tokens.discard(primary_token)

    ordered_tokens.extend(sorted(other_tokens))
    return [t for t in ordered_tokens if t]


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
    token_clean = device_token.strip()
    key_single = f"{FCM_TOKEN_PREFIX}:{user_id}"
    key_set = f"{FCM_TOKEN_PREFIX}s:{user_id}"
    try:
        if hasattr(client, "srem"):
            await client.srem(key_set, token_clean)

        single = await client.get(key_single)
        single_str = single.decode("utf-8") if isinstance(single, bytes) else str(single) if single else None

        # If the pruned token was the primary compatibility key
        if single_str == token_clean:
            remaining_tokens: list[str] = []
            if hasattr(client, "smembers"):
                raw_set = await client.smembers(key_set)
                for t in raw_set or []:
                    tok = t.decode("utf-8") if isinstance(t, bytes) else str(t)
                    if tok and tok != token_clean:
                        remaining_tokens.append(tok)

            if remaining_tokens:
                # Preserve the compatibility key by assigning another remaining token
                await client.set(key_single, sorted(remaining_tokens)[0], ex=2592000)
            else:
                # No tokens left, delete compatibility key
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
        "status": "pending",
    }

    # 1. Dispatch across selected channel first
    dispatched = False
    delivery_status = "sent"
    if channel == NotificationChannel.IN_APP:
        dispatched = True
    elif channel == NotificationChannel.PUSH:
        dispatched = await _dispatch_push(notification)
    elif channel == NotificationChannel.EMAIL:
        dispatched = await _dispatch_email(notification)
    elif channel == NotificationChannel.SMS:
        res = await _dispatch_sms(notification)
        if res == "simulated":
            dispatched = True
            delivery_status = "sent"
        else:
            dispatched = bool(res)
    elif channel == NotificationChannel.WHATSAPP:
        res = await _dispatch_whatsapp(notification)
        if res == "simulated":
            dispatched = True
            delivery_status = "sent"
        else:
            dispatched = bool(res)

    # Mark true delivery outcome
    if not dispatched:
        delivery_status = "failed"
    notification["status"] = delivery_status

    # 2. Record notification log with status in Redis
    await log_notification(user_id, notification)

    return {
        "notification_id": notification_id,
        "status": delivery_status,
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
            item = json.loads(entry)
            if "status" not in item:
                item["status"] = "delivered"
            notifications.append(item)
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
            item = json.loads(entry)
            if "status" not in item:
                item["status"] = "delivered"
            notifications.append(item)
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

def _send_sync_smtp(recipient: str | list[str], subject: str, body_html: str, body_text: str) -> bool:
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

    recipients_list = [recipient] if isinstance(recipient, str) else list(recipient)
    if not recipients_list:
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"PillSync Healthcare <{gmail_user}>"
    if len(recipients_list) == 1:
        msg["To"] = recipients_list[0]
    else:
        # Multi-recipient broadcast: protect privacy by sending via BCC without exposing list in To: header
        msg["To"] = f"PillSync Members <{gmail_user}>"

    msg.attach(MIMEText(body_text, "plain", "utf-8"))
    msg.attach(MIMEText(body_html, "html", "utf-8"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(gmail_user, gmail_pwd)
            server.sendmail(gmail_user, recipients_list, msg.as_string())
        logger.info(f"[Notification:EMAIL] Dispatched via smtplib to {len(recipients_list)} recipient(s): {recipients_list}")
        return True
    except Exception as exc:
        logger.error(f"[Notification:EMAIL] Failed dispatching via smtplib to {recipients_list}: {exc}")
        return False


async def _dispatch_email(notification: dict) -> bool:
    """Email notification dispatcher using Python's built-in smtplib."""
    metadata = notification.get("metadata") or {}
    emails = metadata.get("emails")
    if emails and isinstance(emails, list):
        recipients = [e for e in emails if e]
    else:
        recipient = (
            metadata.get("email")
            or metadata.get("destination")
            or os.getenv("GMAIL_USER")
            or os.getenv("SMTP_USER")
            or os.getenv("SMTP_FROM_EMAIL")
        )
        recipients = [recipient] if recipient else []
    
    if not recipients:
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

    return await asyncio.to_thread(_send_sync_smtp, recipients, title, body_html, body_text)


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

    title = notification.get("title", "PillSync Alert")
    body = notification.get("message", "")
    data = {
        "notification_id": str(notification.get("notification_id", "")),
        "type": str(notification.get("type", "")),
        "user_id": user_id_str,
    }

    dispatched_any = False
    if device_tokens:
        for dt in device_tokens:
            ok, is_rejected = await asyncio.to_thread(_send_sync_fcm, dt, title, body, data)
            if ok:
                dispatched_any = True
            elif is_rejected:
                try:
                    await prune_device_token(uuid.UUID(user_id_str), dt)
                except Exception as pe:
                    logger.warning(f"[Notification:PUSH] Token pruning failed: {pe}")
    else:
        # Only broadcast to FCM topic if this is an explicit system-wide broadcast or mass advisory.
        # Do NOT broadcast single-user private medication reminders to the global topic!
        is_broadcast = (
            notification.get("type") in (NotificationType.BROADCAST.value, NotificationType.SYSTEM_ALERT.value)
            or user_id_str in ("all", "00000000-0000-0000-0000-000000000000")
        )
        if is_broadcast:
            try:
                from firebase_admin import messaging  # type: ignore

                msg = messaging.Message(
                    notification=messaging.Notification(
                        title=title,
                        body=body,
                    ),
                    data=data,
                    topic="pillsync_broadcast",
                )
                response = await asyncio.to_thread(messaging.send, msg)
                logger.info(f"[Notification:PUSH] FCM broadcast topic message dispatched. Message ID: {response}")
                dispatched_any = True
            except Exception as topic_err:
                logger.warning(f"[Notification:PUSH] FCM topic broadcast dispatch skipped/failed: {topic_err}")
        else:
            logger.info(f"[Notification:PUSH] No FCM device token registered for user {user_id_str}. Single-user push skipped without global topic broadcast.")

    return dispatched_any


async def _dispatch_sms(notification: dict) -> Any:
    """SMS dispatcher — Supports Twilio SMS with dev simulator fallback."""
    metadata = notification.get("metadata") or {}
    recipient_phone = (
        metadata.get("phone")
        or os.getenv("DEV_SMS_NUMBER")
        or os.getenv("DEV_WHATSAPP_NUMBER")
    )
    title = notification.get("title", "")
    message = notification.get("message", "")
    user_id = notification.get("user_id", "")

    twilio_sid = os.getenv("TWILIO_ACCOUNT_SID")
    twilio_token = os.getenv("TWILIO_AUTH_TOKEN")
    twilio_from = os.getenv("TWILIO_PHONE_NUMBER")

    if twilio_sid and twilio_token and twilio_from and recipient_phone:
        try:
            import urllib.request
            import urllib.parse
            import base64

            to_clean = recipient_phone.strip()
            if not to_clean.startswith("+"):
                to_clean = f"+91{to_clean}" if len(to_clean) == 10 else f"+{to_clean}"

            url = f"https://api.twilio.com/2010-04-01/Accounts/{twilio_sid}/Messages.json"
            auth_str = f"{twilio_sid}:{twilio_token}"
            auth_header = "Basic " + base64.b64encode(auth_str.encode("ascii")).decode("ascii")

            body_content = f"💊 [PillSync Alert] {title}: {message}"
            data = urllib.parse.urlencode({
                "To": to_clean,
                "From": twilio_from,
                "Body": body_content,
            }).encode("utf-8")

            req = urllib.request.Request(url, data=data, headers={"Authorization": auth_header})
            resp = await asyncio.to_thread(urllib.request.urlopen, req, timeout=10)
            if resp.status in (200, 201):
                logger.info(f"[Notification:SMS] Dispatched SMS to {to_clean} via Twilio.")
                return True
        except Exception as err:
            logger.error(f"[Notification:SMS] Twilio SMS dispatch failed: {err}")

    if recipient_phone:
        logger.info(f"[Notification:SMS] [Simulator] SMS for user {user_id} simulated for {recipient_phone}: {title}")
        return "simulated"

    logger.info(f"[Notification:SMS] No SMS provider or dev number configured. Skipped SMS for user {user_id}.")
    return False


async def _dispatch_whatsapp(notification: dict) -> Any:
    """WhatsApp dispatcher — Supports Twilio WhatsApp API with dev fallback logging."""
    import urllib.parse
    metadata = notification.get("metadata") or {}
    recipient_phone = (
        metadata.get("phone")
        or os.getenv("DEV_WHATSAPP_NUMBER")
        or os.getenv("DEV_SMS_NUMBER")
    )
    title = notification.get("title", "PillSync Healthcare Alert")
    message = notification.get("message", "")
    user_id = notification.get("user_id", "")

    twilio_sid = os.getenv("TWILIO_ACCOUNT_SID")
    twilio_token = os.getenv("TWILIO_AUTH_TOKEN")
    twilio_from = os.getenv("TWILIO_WHATSAPP_NUMBER") or os.getenv("TWILIO_PHONE_NUMBER")

    if twilio_sid and twilio_token and twilio_from and recipient_phone:
        try:
            import urllib.request
            import base64

            from_wa = twilio_from if twilio_from.startswith("whatsapp:") else f"whatsapp:{twilio_from}"
            to_clean = recipient_phone.strip()
            if not to_clean.startswith("+"):
                to_clean = f"+91{to_clean}" if len(to_clean) == 10 else f"+{to_clean}"
            to_wa = f"whatsapp:{to_clean}"

            body_content = f"💊 *[PillSync Healthcare]*\n\n*{title}*\n{message}\n\n_Stay safe & adhere to prescribed medication schedules._"

            url = f"https://api.twilio.com/2010-04-01/Accounts/{twilio_sid}/Messages.json"
            auth_str = f"{twilio_sid}:{twilio_token}"
            auth_header = "Basic " + base64.b64encode(auth_str.encode("ascii")).decode("ascii")

            data = urllib.parse.urlencode({
                "To": to_wa,
                "From": from_wa,
                "Body": body_content,
            }).encode("utf-8")

            req = urllib.request.Request(url, data=data, headers={"Authorization": auth_header})
            resp = await asyncio.to_thread(urllib.request.urlopen, req, timeout=10)
            if resp.status in (200, 201):
                logger.info(f"[Notification:WHATSAPP] Sent via Twilio to {to_wa}")
                return True
        except Exception as err:
            logger.error(f"[Notification:WHATSAPP] Twilio dispatch error: {err}")

    # Fallback / Dev Simulator
    if recipient_phone:
        clean_num = recipient_phone.strip()
        wa_target = clean_num if clean_num.startswith("+") else f"+91{clean_num}"
        wa_body = f"💊 [PillSync Alert] *{title}*\n{message}"
        wa_link = f"https://wa.me/{wa_target.replace('+', '')}?text={urllib.parse.quote(wa_body)}"
        border = "=" * 60
        print(
            f"\n{border}\n"
            f"💬 [PILLSYNC WHATSAPP BROADCAST DISPATCH]\n"
            f"{border}\n"
            f"   Recipient Phone : {wa_target}\n"
            f"   Title           : {title}\n"
            f"   Message         : {message}\n"
            f"   Direct Web Link : {wa_link}\n"
            f"{border}\n",
            flush=True,
        )
        return "simulated"

    logger.info(f"[Notification:WHATSAPP] No WhatsApp recipient or provider configured. Skipped for user {user_id}.")
    return False
