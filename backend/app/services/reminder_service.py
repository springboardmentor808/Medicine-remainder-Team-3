"""
PillSync Reminder Service.

Uses Redis sorted sets to manage scheduled medicine reminders.
Reminders are scored by their Unix timestamp so they can be
efficiently queried for "due now" processing.
"""

import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.core.redis import get_redis


# Redis key for the global reminder queue
REMINDER_QUEUE_KEY = "pillsync:reminders:queue"


# ---------------------------------------------------------------------------
# Enqueue Reminders
# ---------------------------------------------------------------------------

async def enqueue_reminder(
    user_id: uuid.UUID,
    medicine_id: uuid.UUID,
    schedule_id: uuid.UUID,
    medicine_name: str,
    dosage: str,
    scheduled_timestamp: float,
    dose_label: str = "Dose",
) -> str:
    """
    Push a scheduled reminder into the Redis sorted set.

    The score is the Unix timestamp when the reminder should fire.

    Args:
        user_id: Patient UUID.
        medicine_id: Medicine UUID.
        schedule_id: Schedule UUID.
        medicine_name: Name of the medicine.
        dosage: Dosage string (e.g., "500mg").
        scheduled_timestamp: Unix timestamp for when the reminder is due.
        dose_label: Label like "Morning", "Evening/Night", etc.

    Returns:
        The unique reminder ID.
    """
    client = get_redis()
    reminder_id = str(uuid.uuid4())

    reminder_data = json.dumps({
        "reminder_id": reminder_id,
        "user_id": str(user_id),
        "medicine_id": str(medicine_id),
        "schedule_id": str(schedule_id),
        "medicine_name": medicine_name,
        "dosage": dosage,
        "dose_label": dose_label,
        "scheduled_at": datetime.fromtimestamp(
            scheduled_timestamp, tz=timezone.utc
        ).isoformat(),
        "status": "pending",
    })

    await client.zadd(REMINDER_QUEUE_KEY, {reminder_data: scheduled_timestamp})
    return reminder_id


# ---------------------------------------------------------------------------
# Fetch Due Reminders
# ---------------------------------------------------------------------------

async def get_pending_reminders(
    lookahead_minutes: int = 5,
) -> list[dict]:
    """
    Fetch all reminders due within the next N minutes.

    Args:
        lookahead_minutes: How far ahead to look (default: 5 minutes).

    Returns:
        List of reminder dicts sorted by scheduled time.
    """
    client = get_redis()
    now = datetime.now(timezone.utc).timestamp()
    cutoff = now + (lookahead_minutes * 60)

    # Get all reminders scored between 0 and cutoff
    raw_entries = await client.zrangebyscore(
        REMINDER_QUEUE_KEY,
        min=0,
        max=cutoff,
    )

    reminders = []
    for entry in raw_entries:
        try:
            reminders.append(json.loads(entry))
        except json.JSONDecodeError:
            continue

    return reminders


async def get_overdue_reminders() -> list[dict]:
    """Fetch all reminders that are past their scheduled time."""
    client = get_redis()
    now = datetime.now(timezone.utc).timestamp()

    raw_entries = await client.zrangebyscore(
        REMINDER_QUEUE_KEY,
        min=0,
        max=now,
    )

    reminders = []
    for entry in raw_entries:
        try:
            reminders.append(json.loads(entry))
        except json.JSONDecodeError:
            continue

    return reminders


# ---------------------------------------------------------------------------
# Mark Reminder as Processed
# ---------------------------------------------------------------------------

async def mark_reminder_sent(reminder_data: dict) -> None:
    """
    Remove a processed reminder from the queue.

    Args:
        reminder_data: The original reminder dict (used to match the
                       sorted set member).
    """
    client = get_redis()
    serialized = json.dumps(reminder_data)
    await client.zrem(REMINDER_QUEUE_KEY, serialized)


async def clear_user_reminders(user_id: uuid.UUID) -> int:
    """
    Remove all pending reminders for a specific user.

    Returns:
        Number of reminders removed.
    """
    client = get_redis()
    all_entries = await client.zrange(REMINDER_QUEUE_KEY, 0, -1)
    removed = 0

    for entry in all_entries:
        try:
            data = json.loads(entry)
            if data.get("user_id") == str(user_id):
                await client.zrem(REMINDER_QUEUE_KEY, entry)
                removed += 1
        except json.JSONDecodeError:
            continue

    return removed


# ---------------------------------------------------------------------------
# Bulk Load Today's Schedules
# ---------------------------------------------------------------------------

async def schedule_daily_reminders(
    schedules: list[dict],
) -> int:
    """
    Bulk-load today's medication schedules into the Redis reminder queue.

    Args:
        schedules: List of dicts with keys:
            user_id, medicine_id, schedule_id, medicine_name,
            dosage, dose_label, scheduled_timestamp.

    Returns:
        Number of reminders enqueued.
    """
    count = 0
    for sch in schedules:
        await enqueue_reminder(
            user_id=uuid.UUID(sch["user_id"]),
            medicine_id=uuid.UUID(sch["medicine_id"]),
            schedule_id=uuid.UUID(sch["schedule_id"]),
            medicine_name=sch["medicine_name"],
            dosage=sch["dosage"],
            scheduled_timestamp=sch["scheduled_timestamp"],
            dose_label=sch.get("dose_label", "Dose"),
        )
        count += 1

    return count


# ---------------------------------------------------------------------------
# Queue Stats
# ---------------------------------------------------------------------------

async def get_queue_stats() -> dict:
    """Get current reminder queue statistics."""
    client = get_redis()
    total = await client.zcard(REMINDER_QUEUE_KEY)
    overdue = len(await get_overdue_reminders())

    return {
        "total_pending": total,
        "overdue": overdue,
        "queue_key": REMINDER_QUEUE_KEY,
    }
