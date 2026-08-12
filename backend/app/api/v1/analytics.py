"""
PillSync Analytics API Router.

Provides endpoints for:
    - GET /summary          — Overall adherence summary and compliance grade.
    - GET /trends           — Daily dose taken vs. missed trends for charting.
    - GET /stock-health     — Stock level risk breakdown for user medicines.
    - GET /caregiver-report — Adherence & stock metrics for all assigned patients (Caregiver/Admin).
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rbac import allow_caregiver
from app.core.security import get_current_user
from app.models.user import User
from app.services.analytics_service import (
    get_adherence_summary,
    get_caregiver_patient_analytics,
    get_dose_trends,
    get_stock_health,
)


router = APIRouter(prefix="/analytics", tags=["Analytics"])


# ---------------------------------------------------------------------------
# GET /summary — Adherence Summary
# ---------------------------------------------------------------------------
@router.get(
    "/summary",
    status_code=status.HTTP_200_OK,
    summary="Get Adherence Summary",
    description="Retrieve overall adherence percentage and dose action breakdown.",
)
async def get_summary_endpoint(
    days: int = Query(30, ge=1, le=365, description="Period in days"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Get adherence summary metrics for current user."""
    return await get_adherence_summary(db, current_user.id, days=days)


# ---------------------------------------------------------------------------
# GET /trends — Daily Dose Trends
# ---------------------------------------------------------------------------
@router.get(
    "/trends",
    status_code=status.HTTP_200_OK,
    summary="Get Dose Trends",
    description="Retrieve daily dose status breakdown (taken, missed, snoozed) for charting.",
)
async def get_trends_endpoint(
    days: int = Query(7, ge=1, le=90, description="Number of days to trend"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Get daily dose trend data for charting."""
    return await get_dose_trends(db, current_user.id, days=days)


# ---------------------------------------------------------------------------
# GET /stock-health — Stock Health Analytics
# ---------------------------------------------------------------------------
@router.get(
    "/stock-health",
    status_code=status.HTTP_200_OK,
    summary="Get Medicine Stock Health",
    description="Retrieve medicine stock status, low-stock alerts, and depletion risk levels.",
)
async def get_stock_health_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Get medicine stock health summary."""
    return await get_stock_health(db, current_user.id)


# ---------------------------------------------------------------------------
# GET /caregiver-report — Caregiver Patient Adherence Report
# ---------------------------------------------------------------------------
@router.get(
    "/caregiver-report",
    status_code=status.HTTP_200_OK,
    summary="Get Caregiver Patient Report",
    description="Retrieve adherence & stock health analytics for all assigned patients. Caregiver/Admin only.",
)
async def get_caregiver_report_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_caregiver),
) -> list[dict]:
    """Get adherence & stock metrics for all patients assigned to current caregiver."""
    return await get_caregiver_patient_analytics(db, current_user)
