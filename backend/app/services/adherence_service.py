"""
PillSync Adherence Service.

Implements business logic for:
- Schedule creation supporting frequency patterns (1-1-1, 1-0-1, 0-1-1, 0-0-1, custom)
- Dose action recording (Taken, Missed, Snoozed)
- Stock depletion on dose taken
- Daily dose tracking and status evaluation
- Adherence history storage and percentage reporting
"""

from datetime import date, datetime, time, timedelta, timezone
from typing import List, Optional
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.schedule import Schedule, DoseLog
from app.models.medicine import Medicine
from app.schemas.pillsync_schemas import (
    ScheduleCreate,
    ScheduleResponse,
    RecordActionRequest,
    ReminderAction,
    DailyDoseItem,
    DailyDoseTrackingResponse,
    AdherenceReportResponse,
    DoseLogResponse,
)


class AdherenceService:
    """Service handling medication schedules and dose adherence tracking."""

    @staticmethod
    def _parse_time_string(time_str: str) -> time:
        """Parse time string in HH:MM or HH:MM:SS or HH:MM AM/PM format."""
        cleaned = time_str.strip()
        if "AM" in cleaned.upper() or "PM" in cleaned.upper():
            dt = datetime.strptime(cleaned.upper(), "%I:%M %p")
            return dt.time()
        parts = cleaned.split(":")
        if len(parts) == 2:
            return time(hour=int(parts[0]), minute=int(parts[1]))
        elif len(parts) == 3:
            return time(hour=int(parts[0]), minute=int(parts[1]), second=int(parts[2]))
        raise ValueError(f"Invalid time format: {time_str}")

    @staticmethod
    def _get_preset_time_slots(pattern: str) -> List[tuple[time, str]]:
        """
        Map preset frequency patterns to default daily dose times and labels.
        - 1-1-1: Morning (08:00), Afternoon (14:00), Night (20:00)
        - 1-0-1: Morning (08:00), Night (20:00)
        - 0-1-1: Afternoon (14:00), Night (20:00)
        - 0-0-1: Night (20:00)
        """
        morn = time(hour=8, minute=0)
        aft = time(hour=14, minute=0)
        night = time(hour=20, minute=0)

        pattern = pattern.strip().lower()
        if pattern == "1-1-1":
            return [(morn, "Morning"), (aft, "Afternoon"), (night, "Evening/Night")]
        elif pattern == "1-0-1":
            return [(morn, "Morning"), (night, "Evening/Night")]
        elif pattern == "0-1-1":
            return [(aft, "Afternoon"), (night, "Evening/Night")]
        elif pattern == "0-0-1":
            return [(night, "Evening/Night")]
        else:
            return []

    @classmethod
    async def create_schedules(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
        schedule_in: ScheduleCreate,
    ) -> List[Schedule]:
        """
        Create medication schedule entry/entries based on frequency pattern or custom times.
        Uses db.flush() so single transaction boundary is managed at request completion.
        """
        try:
            med_uuid = uuid.UUID(schedule_in.medicine_id) if isinstance(schedule_in.medicine_id, str) else schedule_in.medicine_id
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid medicine_id format. Expected valid UUID.",
            )

        med_result = await db.execute(
            select(Medicine).where(
                Medicine.id == med_uuid,
                Medicine.user_id == user_id,
            )
        )
        medicine = med_result.scalar_one_or_none()
        if not medicine:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Medicine not found for current user.",
            )

        pattern = (schedule_in.frequency_pattern or "custom").lower()
        time_slots: List[tuple[time, str]] = []

        if pattern in ["1-1-1", "1-0-1", "0-1-1", "0-0-1"]:
            time_slots = cls._get_preset_time_slots(pattern)
        else:
            pattern = "custom"
            if not schedule_in.scheduled_times:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="scheduled_times list is required when frequency_pattern is 'custom'.",
                )
            for t_str in schedule_in.scheduled_times:
                try:
                    parsed_t = cls._parse_time_string(t_str)
                    time_slots.append((parsed_t, "Custom"))
                except ValueError:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid time format '{t_str}'. Expected HH:MM or HH:MM AM/PM.",
                    )

        created_schedules: List[Schedule] = []
        for scheduled_t, label in time_slots:
            new_schedule = Schedule(
                user_id=user_id,
                medicine_id=med_uuid,
                scheduled_time=scheduled_t,
                day_of_week=schedule_in.day_of_week,
                frequency_pattern=pattern,
                dose_label=label,
                is_active=schedule_in.is_active,
            )
            db.add(new_schedule)
            created_schedules.append(new_schedule)

        await db.flush()

        for sch in created_schedules:
            await db.refresh(sch)

        return created_schedules

    @classmethod
    async def get_user_schedules(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
        medicine_id: Optional[uuid.UUID] = None,
    ) -> List[Schedule]:
        """Fetch active schedules for a user with medicine eager loaded."""
        query = (
            select(Schedule)
            .options(joinedload(Schedule.medicine))
            .where(
                Schedule.user_id == user_id,
                Schedule.is_active == True,
            )
        )
        if medicine_id:
            query = query.where(Schedule.medicine_id == medicine_id)
        
        result = await db.execute(query)
        return list(result.scalars().all())

    @classmethod
    async def delete_schedule(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
        schedule_id: uuid.UUID,
    ) -> bool:
        """Deactivate (soft delete) a medication schedule."""
        result = await db.execute(
            select(Schedule).where(
                Schedule.id == schedule_id,
                Schedule.user_id == user_id,
            )
        )
        schedule = result.scalar_one_or_none()
        if not schedule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Schedule not found.",
            )
        
        schedule.is_active = False
        await db.flush()
        return True

    @classmethod
    async def record_dose_action(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
        req: RecordActionRequest,
    ) -> DoseLog:
        """
        Record a dose log action (Taken, Missed, Snooze).
        Decrements current medicine stock when action is Taken.
        """
        try:
            sch_uuid = uuid.UUID(req.schedule_id) if isinstance(req.schedule_id, str) else req.schedule_id
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid schedule_id format. Expected valid UUID.",
            )

        sch_result = await db.execute(
            select(Schedule).where(
                Schedule.id == sch_uuid,
                Schedule.user_id == user_id,
            )
        )
        schedule = sch_result.scalar_one_or_none()
        if not schedule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Schedule not found for current user.",
            )

        # Determine scheduled_date
        if req.scheduled_date:
            try:
                scheduled_d = date.fromisoformat(req.scheduled_date)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid scheduled_date format. Expected YYYY-MM-DD.",
                )
        else:
            scheduled_d = datetime.now(timezone.utc).date()

        # Parse action_time
        action_dt = datetime.now(timezone.utc)
        if req.action_time:
            try:
                action_dt = datetime.fromisoformat(req.action_time)
            except ValueError:
                pass

        action_str = req.action.value if hasattr(req.action, "value") else str(req.action)

        dose_log = DoseLog(
            user_id=user_id,
            medicine_id=schedule.medicine_id,
            schedule_id=schedule.id,
            scheduled_date=scheduled_d,
            scheduled_time=schedule.scheduled_time,
            action=action_str,
            action_time=action_dt,
            snooze_minutes=req.snooze_minutes if action_str in ["Snooze", "Snoozed"] else None,
            notes=req.notes,
        )
        db.add(dose_log)

        # Stock depletion logic if Taken
        if action_str == "Taken":
            med_result = await db.execute(
                select(Medicine).where(Medicine.id == schedule.medicine_id)
            )
            medicine = med_result.scalar_one_or_none()
            if medicine and medicine.current_stock > 0:
                qty_deduct = getattr(medicine, "quantity_per_dose", 1) or 1
                medicine.current_stock = max(0, medicine.current_stock - qty_deduct)

        await db.flush()
        await db.refresh(dose_log)
        return dose_log

    @classmethod
    async def get_daily_dose_tracking(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
        target_date: date,
    ) -> DailyDoseTrackingResponse:
        """
        Retrieve daily dose tracking for target date with dose status evaluation.
        Prevents N+1 database queries by utilizing eager loaded medicine relationship.
        Filters schedules by day_of_week when specified.
        Uses UTC date comparison for consistent server environment evaluation.
        """
        schedules = await cls.get_user_schedules(db, user_id)

        target_day_name = target_date.strftime("%A").lower()
        applicable_schedules = [
            s for s in schedules
            if not s.day_of_week or s.day_of_week.strip().lower() == target_day_name
        ]

        logs_result = await db.execute(
            select(DoseLog).where(
                DoseLog.user_id == user_id,
                DoseLog.scheduled_date == target_date,
            )
        )
        dose_logs = list(logs_result.scalars().all())
        log_map = {dl.schedule_id: dl for dl in dose_logs if dl.schedule_id}

        dose_items: List[DailyDoseItem] = []
        now_utc = datetime.now(timezone.utc)
        today_date = now_utc.date()
        current_t = now_utc.time()

        taken_count = 0
        missed_count = 0
        snoozed_count = 0
        pending_count = 0

        for sch in applicable_schedules:
            med_name = sch.medicine.name if sch.medicine else "Unknown Medicine"
            dosage = sch.medicine.dosage if sch.medicine else "1 dose"

            logged = log_map.get(sch.id)
            if logged:
                act_str = logged.action
                if act_str == "Taken":
                    status_val = "Taken"
                    taken_count += 1
                elif act_str in ["Snooze", "Snoozed"]:
                    status_val = "Snoozed"
                    snoozed_count += 1
                else:
                    status_val = "Missed"
                    missed_count += 1

                dose_items.append(
                    DailyDoseItem(
                        schedule_id=str(sch.id),
                        medicine_id=str(sch.medicine_id),
                        medicine_name=med_name,
                        dosage=dosage,
                        scheduled_time=sch.scheduled_time.strftime("%H:%M"),
                        status=status_val,
                        action_time=logged.action_time,
                        snooze_minutes=logged.snooze_minutes,
                    )
                )
            else:
                if target_date < today_date or (target_date == today_date and sch.scheduled_time < current_t):
                    status_val = "Missed"
                    missed_count += 1
                else:
                    status_val = "Pending"
                    pending_count += 1

                dose_items.append(
                    DailyDoseItem(
                        schedule_id=str(sch.id),
                        medicine_id=str(sch.medicine_id),
                        medicine_name=med_name,
                        dosage=dosage,
                        scheduled_time=sch.scheduled_time.strftime("%H:%M"),
                        status=status_val,
                        action_time=None,
                        snooze_minutes=None,
                    )
                )

        total_doses = len(dose_items)
        return DailyDoseTrackingResponse(
            date=target_date.isoformat(),
            total_doses=total_doses,
            taken_count=taken_count,
            missed_count=missed_count,
            snoozed_count=snoozed_count,
            pending_count=pending_count,
            doses=dose_items,
        )

    @classmethod
    async def get_adherence_history(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        medicine_id: Optional[uuid.UUID] = None,
    ) -> List[DoseLog]:
        """Query dose adherence history logs."""
        query = select(DoseLog).where(DoseLog.user_id == user_id)
        if start_date:
            query = query.where(DoseLog.scheduled_date >= start_date)
        if end_date:
            query = query.where(DoseLog.scheduled_date <= end_date)
        if medicine_id:
            query = query.where(DoseLog.medicine_id == medicine_id)

        query = query.order_by(DoseLog.scheduled_date.desc(), DoseLog.action_time.desc())
        result = await db.execute(query)
        return list(result.scalars().all())

    @classmethod
    async def calculate_adherence_report(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> AdherenceReportResponse:
        """
        Calculate overall medication adherence statistics & percentage.
        """
        query = select(DoseLog).where(DoseLog.user_id == user_id)
        if start_date:
            query = query.where(DoseLog.scheduled_date >= start_date)
        if end_date:
            query = query.where(DoseLog.scheduled_date <= end_date)

        result = await db.execute(query)
        logs = list(result.scalars().all())

        total_scheduled = len(logs)
        taken_count = sum(1 for log in logs if log.action == "Taken")
        missed_count = sum(1 for log in logs if log.action == "Missed")
        snoozed_count = sum(1 for log in logs if log.action in ["Snooze", "Snoozed"])

        if total_scheduled == 0:
            percentage = 100.0
        else:
            percentage = round((taken_count / total_scheduled) * 100.0, 2)

        if percentage >= 90.0:
            grade = "Excellent"
        elif percentage >= 75.0:
            grade = "Good"
        elif percentage >= 60.0:
            grade = "Fair"
        else:
            grade = "Poor"

        return AdherenceReportResponse(
            patient_id=str(user_id),
            total_scheduled_doses=total_scheduled,
            taken_doses=taken_count,
            missed_doses=missed_count,
            snoozed_doses=snoozed_count,
            adherence_percentage=percentage,
            consistency_grade=grade,
        )
