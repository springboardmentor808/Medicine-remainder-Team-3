"""
PillSync Adherence & Medication Schedule Router.

Handles medication schedule creation (with frequency pattern support: 1-1-1, 1-0-1, 0-1-1, 0-0-1, custom),
daily dose status tracking, dose action recording (Taken, Missed, Snoozed),
adherence history logging, and adherence percentage calculation.
"""

from datetime import date, datetime, timezone
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Path, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.rbac import allow_caregiver
from app.models.user import User, UserRole
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
    CaregiverQueueItem,
    CaregiverQueueResponse,
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


def _get_demo_schedules(patient_id_filter: Optional[str] = None) -> List[ScheduleResponse]:
    now = datetime.now(timezone.utc)
    all_demo = [
        ScheduleResponse(
            id="00000000-0000-4000-8000-000000000301",
            user_id="00000000-0000-4000-8000-000000000001",
            medicine_id="11111111-0000-4000-8000-000000000001",
            scheduled_time="08:00",
            day_of_week=None,
            frequency_pattern="daily",
            dose_label="Morning",
            is_active=True,
            created_at=now,
            medicine_name="Metformin 500mg",
            dosage="500mg",
            disease_category="Diabetes",
            notes="Take with breakfast to minimize GI upset",
        ),
        ScheduleResponse(
            id="00000000-0000-4000-8000-000000000302",
            user_id="00000000-0000-4000-8000-000000000001",
            medicine_id="11111111-0000-4000-8000-000000000002",
            scheduled_time="14:00",
            day_of_week=None,
            frequency_pattern="daily",
            dose_label="Afternoon",
            is_active=True,
            created_at=now,
            medicine_name="Lisinopril 10mg",
            dosage="10mg",
            disease_category="Blood Pressure",
            notes="Monitor blood pressure sitting",
        ),
        ScheduleResponse(
            id="00000000-0000-4000-8000-000000000303",
            user_id="00000000-0000-4000-8000-000000000001",
            medicine_id="11111111-0000-4000-8000-000000000001",
            scheduled_time="20:00",
            day_of_week=None,
            frequency_pattern="daily",
            dose_label="Night",
            is_active=True,
            created_at=now,
            medicine_name="Metformin 500mg",
            dosage="500mg",
            disease_category="Diabetes",
            notes="Take with evening meal",
        ),
        ScheduleResponse(
            id="00000000-0000-4000-8000-000000000304",
            user_id="00000000-0000-4000-8000-000000000002",
            medicine_id="22222222-0000-4000-8000-000000000001",
            scheduled_time="09:00",
            day_of_week=None,
            frequency_pattern="daily",
            dose_label="Morning",
            is_active=True,
            created_at=now,
            medicine_name="Donepezil 10mg",
            dosage="10mg",
            disease_category="General Healthcare",
            notes="Take before bedtime with water",
        ),
        ScheduleResponse(
            id="00000000-0000-4000-8000-000000000305",
            user_id="00000000-0000-4000-8000-000000000002",
            medicine_id="22222222-0000-4000-8000-000000000002",
            scheduled_time="21:00",
            day_of_week=None,
            frequency_pattern="daily",
            dose_label="Night",
            is_active=True,
            created_at=now,
            medicine_name="Memantine 10mg",
            dosage="10mg",
            disease_category="General Healthcare",
            notes="Take twice daily with meals",
        ),
    ]
    if patient_id_filter == "00000000-0000-4000-8000-000000000001":
        return [s for s in all_demo if s.user_id == "00000000-0000-4000-8000-000000000001"]
    if patient_id_filter == "00000000-0000-4000-8000-000000000002":
        return [s for s in all_demo if s.user_id == "00000000-0000-4000-8000-000000000002"]
    return all_demo


@router.get(
    "/schedules",
    response_model=List[ScheduleResponse],
    summary="Get user or patient medication schedules",
)
async def get_schedules(
    medicine_id: Optional[uuid.UUID] = Query(None, description="Filter by medicine ID"),
    patient_id: Optional[uuid.UUID] = Query(None, description="Filter by patient ID (Caregiver/Admin)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_user_id = current_user.id
    if patient_id:
        s_patient_id = str(patient_id)
        u_role = current_user.role.lower()
        if "admin" not in u_role and "caregiver" not in u_role and patient_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to view schedules for other patients.",
            )

        if s_patient_id in ("00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"):
            if "admin" not in u_role and "caregiver" not in u_role:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not authorized to view schedules for this patient.",
                )
            return _get_demo_schedules(s_patient_id)

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
    if not schedules and current_user.role.lower() == "caregiver" and not patient_id:
        return _get_demo_schedules(None)

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


@router.get(
    "/caregiver/queue",
    response_model=CaregiverQueueResponse,
    summary="Get multi-patient scheduled dose queue for caregiver",
    description="Returns all scheduled doses and statuses for today across patients linked to the authenticated caregiver.",
)
async def get_caregiver_queue(
    target_date: Optional[date] = Query(None, description="Date for queue (defaults to today)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_caregiver),
):
    """Aggregate scheduled doses for all patients monitored by this caregiver."""
    d = target_date or date.today()
    is_caregiver = current_user.role == UserRole.CAREGIVER or current_user.role.lower() in ["caregiver", "userrole.caregiver"]

    # 1. Fetch linked patients
    if is_caregiver:
        linked_subquery = select(caregiver_patients.c.patient_id).where(
            caregiver_patients.c.caregiver_id == current_user.id
        )
        res_patients = await db.execute(
            select(User).where(User.id.in_(linked_subquery), User.is_active == True)
        )
        patients = list(res_patients.scalars().all())
    else:
        # Admin: fetch active patients (limit 20)
        res_patients = await db.execute(
            select(User).where(User.role == UserRole.PATIENT, User.is_active == True).limit(20)
        )
        patients = list(res_patients.scalars().all())

    # 2. If no patients linked, provide curated demo queue as requested by user
    if not patients:
        demo_items = [
            CaregiverQueueItem(
                schedule_id="00000000-0000-4000-8000-000000000101",
                patient_id="00000000-0000-4000-8000-000000000001",
                patient_name="Robert Chen (Sample Patient)",
                patient_phone="+1 (555) 019-2834",
                medicine_id="00000000-0000-4000-8000-000000000201",
                medicine_name="Metformin",
                dosage="500mg",
                scheduled_time="08:00",
                dose_label="Morning",
                status="Taken",
                action_time=None,
                is_demo=True,
            ),
            CaregiverQueueItem(
                schedule_id="00000000-0000-4000-8000-000000000102",
                patient_id="00000000-0000-4000-8000-000000000002",
                patient_name="Eleanor Vance (Sample Patient)",
                patient_phone="+1 (555) 014-9821",
                medicine_id="00000000-0000-4000-8000-000000000202",
                medicine_name="Atorvastatin",
                dosage="20mg",
                scheduled_time="09:00",
                dose_label="Morning",
                status="Pending",
                action_time=None,
                is_demo=True,
            ),
            CaregiverQueueItem(
                schedule_id="00000000-0000-4000-8000-000000000103",
                patient_id="00000000-0000-4000-8000-000000000001",
                patient_name="Robert Chen (Sample Patient)",
                patient_phone="+1 (555) 019-2834",
                medicine_id="00000000-0000-4000-8000-000000000203",
                medicine_name="Lisinopril",
                dosage="10mg",
                scheduled_time="14:00",
                dose_label="Afternoon",
                status="Pending",
                action_time=None,
                is_demo=True,
            ),
            CaregiverQueueItem(
                schedule_id="00000000-0000-4000-8000-000000000104",
                patient_id="00000000-0000-4000-8000-000000000001",
                patient_name="Robert Chen (Sample Patient)",
                patient_phone="+1 (555) 019-2834",
                medicine_id="00000000-0000-4000-8000-000000000201",
                medicine_name="Metformin",
                dosage="500mg",
                scheduled_time="20:00",
                dose_label="Night",
                status="Pending",
                action_time=None,
                is_demo=True,
            ),
        ]
        return CaregiverQueueResponse(
            date=d.isoformat(),
            total_doses=len(demo_items),
            pending_count=sum(1 for i in demo_items if i.status == "Pending"),
            taken_count=sum(1 for i in demo_items if i.status == "Taken"),
            missed_count=sum(1 for i in demo_items if i.status == "Missed"),
            is_demo=True,
            items=demo_items,
        )

    # 3. For live assigned patients: retrieve daily dose tracking
    all_queue_items = []
    for p in patients:
        tracking = await AdherenceService.get_daily_dose_tracking(db, p.id, d)
        for dose in tracking.doses:
            all_queue_items.append(
                CaregiverQueueItem(
                    schedule_id=dose.schedule_id,
                    patient_id=str(p.id),
                    patient_name=p.full_name or p.username,
                    patient_phone=p.phone,
                    medicine_id=dose.medicine_id,
                    medicine_name=dose.medicine_name,
                    dosage=dose.dosage,
                    scheduled_time=dose.scheduled_time,
                    dose_label=None,
                    status=dose.status,
                    action_time=dose.action_time,
                    is_demo=False,
                )
            )

    all_queue_items.sort(key=lambda x: x.scheduled_time)

    return CaregiverQueueResponse(
        date=d.isoformat(),
        total_doses=len(all_queue_items),
        pending_count=sum(1 for i in all_queue_items if i.status == "Pending"),
        taken_count=sum(1 for i in all_queue_items if i.status == "Taken"),
        missed_count=sum(1 for i in all_queue_items if i.status == "Missed"),
        is_demo=False,
        items=all_queue_items,
    )
