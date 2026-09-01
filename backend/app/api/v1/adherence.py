"""
PillSync Adherence & Medication Schedule Router.

Handles medication schedule creation (with frequency pattern support: 1-1-1, 1-0-1, 0-1-1, 0-0-1, custom),
daily dose status tracking, dose action recording (Taken, Missed, Snoozed),
adherence history logging, and adherence percentage calculation.
"""

from datetime import date
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Path, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.caregiver_patient import caregiver_patients
from app.schemas.pillsync_schemas import (
    ScheduleCreate,
    ScheduleResponse,
    ScheduleBatchCreateResponse,
    RecordActionRequest,
    DoseLogResponse,
    DailyDoseTrackingResponse,
    AdherenceHistoryResponse,
    AdherenceReportResponse,
    ReminderAction,
)
from app.services.adherence_service import AdherenceService


router = APIRouter(prefix="/adherence", tags=["Adherence"])


def _map_reminder_action(action_str: str) -> ReminderAction:
    """Map DB action string safely to ReminderAction enum."""
    if action_str in ReminderAction._value2member_map_:
        return ReminderAction(action_str)
    act_lower = action_str.lower()
    if act_lower in ["snooze", "snoozed"]:
        return ReminderAction.SNOOZE
    if act_lower in ["missed"]:
        return ReminderAction.MISSED
    return ReminderAction.TAKEN


@router.post(
    "/schedules",
    response_model=ScheduleBatchCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create medication schedule(s)",
    description="Supports frequency patterns: '1-1-1', '1-0-1', '0-1-1', '0-0-1', or 'custom' with scheduled_times.",
)
async def create_schedules(
    schedule_in: ScheduleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    schedules = await AdherenceService.create_schedules(db, current_user.id, schedule_in)
    resp_schedules = [
        ScheduleResponse(
            id=str(s.id),
            user_id=str(s.user_id),
            medicine_id=str(s.medicine_id),
            scheduled_time=s.scheduled_time.strftime("%H:%M"),
            day_of_week=s.day_of_week,
            frequency_pattern=s.frequency_pattern,
            dose_label=s.dose_label,
            is_active=s.is_active,
            created_at=s.created_at,
        )
        for s in schedules
    ]
    return ScheduleBatchCreateResponse(
        message=f"Successfully created {len(resp_schedules)} schedule entry/entries.",
        schedules=resp_schedules,
    )


@router.get(
    "/schedules",
    response_model=List[ScheduleResponse],
    summary="Get user medication schedules",
)
async def get_schedules(
    medicine_id: Optional[uuid.UUID] = Query(None, description="Filter by medicine ID"),
    patient_id: Optional[uuid.UUID] = Query(None, description="Filter by patient ID (Caregiver/Admin)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_user_id = current_user.id
    if patient_id:
        u_role = str(current_user.role).lower()
        if "admin" in u_role:
            target_user_id = patient_id
        elif "caregiver" in u_role:
            # Enforce RBAC/IDOR check: verify caregiver is assigned to this patient
            link_check = await db.execute(
                select(caregiver_patients).where(
                    caregiver_patients.c.caregiver_id == current_user.id,
                    caregiver_patients.c.patient_id == patient_id,
                )
            )
            if not link_check.first():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not authorized to view schedules for this patient.",
                )
            target_user_id = patient_id

    schedules = await AdherenceService.get_user_schedules(db, target_user_id, medicine_id)
    return [
        ScheduleResponse(
            id=str(s.id),
            user_id=str(s.user_id),
            medicine_id=str(s.medicine_id),
            scheduled_time=s.scheduled_time.strftime("%H:%M") if s.scheduled_time else "08:00",
            day_of_week=s.day_of_week,
            frequency_pattern=s.frequency_pattern,
            dose_label=s.dose_label,
            is_active=s.is_active,
            created_at=s.created_at,
            medicine_name=s.medicine.name if s.medicine else None,
            dosage=s.medicine.dosage if s.medicine else None,
            disease_category=s.medicine.disease_category if s.medicine else None,
            notes=s.medicine.notes if s.medicine else None,
        )
        for s in schedules
    ]


@router.delete(
    "/schedules/{schedule_id}",
    status_code=status.HTTP_200_OK,
    summary="Deactivate medication schedule",
)
async def delete_schedule(
    schedule_id: uuid.UUID = Path(..., description="UUID of schedule to deactivate"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await AdherenceService.delete_schedule(db, current_user.id, schedule_id)
    return {"message": f"Schedule {schedule_id} deactivated successfully."}


@router.post("", response_model=DoseLogResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
@router.post(
    "/record",
    response_model=DoseLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record dose action (Taken, Missed, Snoozed)",
)
async def record_action(
    req: RecordActionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dose_log = await AdherenceService.record_dose_action(db, current_user.id, req)
    return DoseLogResponse(
        id=str(dose_log.id),
        user_id=str(dose_log.user_id),
        medicine_id=str(dose_log.medicine_id),
        schedule_id=str(dose_log.schedule_id) if dose_log.schedule_id else None,
        scheduled_date=dose_log.scheduled_date.isoformat(),
        scheduled_time=dose_log.scheduled_time.strftime("%H:%M") if dose_log.scheduled_time else "08:00",
        action=_map_reminder_action(dose_log.action),
        action_time=dose_log.action_time,
        snooze_minutes=dose_log.snooze_minutes,
        notes=dose_log.notes,
        created_at=dose_log.created_at,
    )


@router.get(
    "/daily-tracking",
    response_model=DailyDoseTrackingResponse,
    summary="Get daily dose tracking for a given date",
)
async def get_daily_tracking(
    target_date: Optional[date] = Query(None, description="Date (defaults to today)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    d = target_date or date.today()
    return await AdherenceService.get_daily_dose_tracking(db, current_user.id, d)


@router.get(
    "/history",
    response_model=AdherenceHistoryResponse,
    summary="Get adherence history logs",
)
async def get_adherence_history(
    start_date: Optional[date] = Query(None, description="Start date"),
    end_date: Optional[date] = Query(None, description="End date"),
    medicine_id: Optional[uuid.UUID] = Query(None, description="Medicine ID filter"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logs = await AdherenceService.get_adherence_history(
        db, current_user.id, start_date=start_date, end_date=end_date, medicine_id=medicine_id
    )

    resp_logs = [
        DoseLogResponse(
            id=str(log.id),
            user_id=str(log.user_id),
            medicine_id=str(log.medicine_id),
            schedule_id=str(log.schedule_id) if log.schedule_id else None,
            scheduled_date=log.scheduled_date.isoformat(),
            scheduled_time=log.scheduled_time.strftime("%H:%M"),
            action=_map_reminder_action(log.action),
            action_time=log.action_time,
            snooze_minutes=log.snooze_minutes,
            notes=log.notes,
            created_at=log.created_at,
        )
        for log in logs
    ]

    return AdherenceHistoryResponse(
        patient_id=str(current_user.id),
        total_records=len(resp_logs),
        logs=resp_logs,
    )


@router.get(
    "/report",
    response_model=AdherenceReportResponse,
    summary="Get adherence percentage and summary report",
)
async def get_adherence_report(
    start_date: Optional[date] = Query(None, description="Start date"),
    end_date: Optional[date] = Query(None, description="End date"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await AdherenceService.calculate_adherence_report(
        db, current_user.id, start_date=start_date, end_date=end_date
    )
