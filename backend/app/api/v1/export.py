"""
PillSync Data Export API Router (Production Hardened).

Implements the "Fetch Early, Release Fast" architectural pattern to eliminate
Database Connection Pool Starvation. Eagerly loads all data into memory,
immediately releases the async database session back to the pool, and then
performs CPU-bound CSV and PDF/HTML document rendering in pure Python space.
"""

import csv
import io
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.rbac import allow_admin
from app.models.medicine import Medicine
from app.models.schedule import Schedule
from app.models.user import User


router = APIRouter(prefix="/export", tags=["Data Export"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _format_datetime(dt) -> str:
    """Format datetime for export."""
    if dt is None:
        return ""
    if isinstance(dt, str):
        return dt
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def _generate_pdf_html(title: str, headers: list[str], rows: list[list[str]], user_name: str) -> str:
    """Generate a styled HTML table for PDF conversion."""
    header_cells = "".join(f"<th>{h}</th>" for h in headers)
    body_rows = ""
    for i, row in enumerate(rows):
        bg = "#f9fafb" if i % 2 == 0 else "#ffffff"
        cells = "".join(f"<td>{c}</td>" for c in row)
        body_rows += f'<tr style="background:{bg};">{cells}</tr>'

    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ font-family:'Inter','Segoe UI',sans-serif; padding:32px; background:#fff; color:#1a1a2e; }}
  .header {{ display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; padding-bottom:16px; border-bottom:3px solid #006a4e; }}
  .header h1 {{ font-size:22px; color:#006a4e; }}
  .header .meta {{ text-align:right; font-size:12px; color:#64748b; }}
  .summary {{ background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:16px; margin-bottom:24px; font-size:13px; color:#166534; }}
  table {{ width:100%; border-collapse:collapse; font-size:13px; }}
  th {{ background:#006a4e; color:#fff; padding:10px 12px; text-align:left; font-weight:600; font-size:12px; text-transform:uppercase; letter-spacing:0.5px; }}
  td {{ padding:8px 12px; border-bottom:1px solid #e5e7eb; }}
  .footer {{ margin-top:24px; padding-top:16px; border-top:2px solid #e5e7eb; text-align:center; font-size:11px; color:#94a3b8; }}
</style></head>
<body>
  <div class="header">
    <h1>&#128138; PillSync — {title}</h1>
    <div class="meta">
      <strong>{user_name}</strong><br>
      Generated: {datetime.now().strftime("%B %d, %Y at %I:%M %p")}
    </div>
  </div>
  <div class="summary">Total Records: <strong>{len(rows)}</strong></div>
  <table>
    <thead><tr>{header_cells}</tr></thead>
    <tbody>{body_rows}</tbody>
  </table>
  <div class="footer">
    PillSync — AI Intelligent Medicine Reminder &amp; Medication Tracking<br>
    This document was auto-generated. Data is accurate as of the generation timestamp.
  </div>
</body></html>"""


# ---------------------------------------------------------------------------
# GET /export/medicines/csv
# ---------------------------------------------------------------------------
@router.get(
    "/medicines/csv",
    status_code=status.HTTP_200_OK,
    summary="Export Medicines as CSV",
    description="Download the user's complete medicine inventory as a CSV file.",
)
async def export_medicines_csv(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Export all medicines for the current user as CSV.
    Uses 'Fetch Early, Release Fast' pattern to prevent connection pool exhaustion.
    """
    # 1. Fetch Early from database
    result = await db.execute(
        select(Medicine)
        .where(Medicine.user_id == current_user.id)
        .order_by(Medicine.name)
    )
    medicines = result.scalars().all()

    # Materialize records into plain dictionaries
    records: List[Dict[str, Any]] = []
    for med in medicines:
        daily = (med.daily_frequency or 1) * (med.quantity_per_dose or 1)
        days_left = str(round(med.current_stock / daily, 1)) if daily > 0 else "N/A"
        records.append({
            "name": med.name,
            "category": med.disease_category or "General",
            "dosage": med.dosage or "Standard",
            "initial_quantity": med.initial_quantity,
            "current_stock": med.current_stock,
            "daily_frequency": med.daily_frequency or 1,
            "quantity_per_dose": med.quantity_per_dose or 1,
            "days_left": days_left,
            "notes": med.notes or "",
            "created_at": _format_datetime(med.created_at),
            "updated_at": _format_datetime(med.updated_at),
        })

    # 2. Release Fast: Close DB session immediately before CPU serialization
    await db.close()

    # 3. Pure in-memory CPU rendering
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Name", "Disease Category", "Dosage", "Initial Quantity",
        "Current Stock", "Daily Frequency", "Qty Per Dose",
        "Days Until Empty", "Notes", "Created At", "Updated At"
    ])

    for r in records:
        writer.writerow([
            r["name"], r["category"], r["dosage"], r["initial_quantity"],
            r["current_stock"], r["daily_frequency"], r["quantity_per_dose"],
            r["days_left"], r["notes"], r["created_at"], r["updated_at"]
        ])

    csv_content = output.getvalue()
    filename = f"pillsync_medicines_{datetime.now().strftime('%Y%m%d')}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


# ---------------------------------------------------------------------------
# GET /export/medicines/pdf
# ---------------------------------------------------------------------------
@router.get(
    "/medicines/pdf",
    status_code=status.HTTP_200_OK,
    summary="Export Medicines as PDF",
    description="Download the user's medicine inventory as a styled PDF document.",
)
async def export_medicines_pdf(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Export all medicines for the current user as a styled document.
    Uses 'Fetch Early, Release Fast' pattern.
    """
    # 1. Fetch Early
    result = await db.execute(
        select(Medicine)
        .where(Medicine.user_id == current_user.id)
        .order_by(Medicine.name)
    )
    medicines = result.scalars().all()

    # Extract plain values
    headers = ["#", "Medicine", "Category", "Dosage", "Stock", "Daily Freq", "Days Left", "Notes"]
    rows: List[List[str]] = []
    for i, med in enumerate(medicines, 1):
        daily = (med.daily_frequency or 1) * (med.quantity_per_dose or 1)
        days_left = str(round(med.current_stock / daily, 1)) if daily > 0 else "N/A"
        rows.append([
            str(i),
            med.name,
            med.disease_category or "General",
            med.dosage or "Standard",
            f"{med.current_stock}/{med.initial_quantity}",
            f"{med.daily_frequency or 1}x/day",
            days_left,
            (med.notes or "—")[:50],
        ])

    user_title = current_user.full_name or current_user.username

    # 2. Release Fast
    await db.close()

    # 3. CPU document rendering
    html = _generate_pdf_html("Medicine Inventory", headers, rows, user_title)
    filename = f"pillsync_medicines_{datetime.now().strftime('%Y%m%d')}.html"
    return Response(
        content=html,
        media_type="text/html",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


# ---------------------------------------------------------------------------
# GET /export/adherence/csv
# ---------------------------------------------------------------------------
@router.get(
    "/adherence/csv",
    status_code=status.HTTP_200_OK,
    summary="Export Adherence History as CSV",
    description="Download the user's medication adherence/schedule history as CSV.",
)
async def export_adherence_csv(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Export adherence/schedule data for the current user as CSV.
    Uses 'Fetch Early, Release Fast' pattern.
    """
    # 1. Fetch Early with eager joined relationships
    result = await db.execute(
        select(Schedule)
        .options(selectinload(Schedule.medicine))
        .where(Schedule.user_id == current_user.id)
        .order_by(Schedule.created_at.desc())
    )
    schedules = result.scalars().all()

    # Materialize plain records
    rows: List[List[str]] = []
    for s in schedules:
        med_name = s.medicine.name if s.medicine else "Medication"
        dosage = s.medicine.dosage if s.medicine else "Standard"
        rows.append([
            med_name,
            dosage,
            s.dose_label or "Daily Dose",
            str(s.scheduled_time) if s.scheduled_time else "08:00",
            s.day_of_week or "Everyday",
            "Active" if s.is_active else "Inactive",
            _format_datetime(s.created_at),
        ])

    # 2. Release Fast
    await db.close()

    # 3. CPU CSV Generation
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Medicine", "Dosage", "Dose Label", "Scheduled Time", "Day of Week", "Status", "Created At"
    ])
    for r in rows:
        writer.writerow(r)

    csv_content = output.getvalue()
    filename = f"pillsync_adherence_{datetime.now().strftime('%Y%m%d')}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


# ---------------------------------------------------------------------------
# GET /export/all/csv
# ---------------------------------------------------------------------------
@router.get(
    "/all/csv",
    status_code=status.HTTP_200_OK,
    summary="Export All Data as CSV",
    description="Download all user data (medicines + schedules) as a comprehensive CSV file.",
)
async def export_all_csv(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export complete patient dataset with fast connection release."""
    # 1. Fetch Early
    med_result = await db.execute(
        select(Medicine).where(Medicine.user_id == current_user.id).order_by(Medicine.name)
    )
    medicines = med_result.scalars().all()

    sch_result = await db.execute(
        select(Schedule).options(selectinload(Schedule.medicine)).where(Schedule.user_id == current_user.id).order_by(Schedule.created_at.desc())
    )
    schedules = sch_result.scalars().all()

    med_rows = [
        [m.name, m.disease_category or "General", m.dosage or "Standard", m.current_stock, m.initial_quantity, m.daily_frequency, _format_datetime(m.created_at)]
        for m in medicines
    ]
    sch_rows = [
        [s.medicine.name if s.medicine else "Unknown", s.dose_label or "Dose", str(s.scheduled_time), s.day_of_week or "Daily", "Active" if s.is_active else "Inactive"]
        for s in schedules
    ]

    # 2. Release Fast
    await db.close()

    # 3. CPU formatting
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["=== PILLSYNC USER PROFILE ==="])
    writer.writerow(["Name", "Email", "Role", "Exported At"])
    writer.writerow([current_user.full_name or current_user.username, current_user.email, current_user.role, _format_datetime(datetime.now())])
    writer.writerow([])
    writer.writerow(["=== MEDICINE INVENTORY ==="])
    writer.writerow(["Name", "Category", "Dosage", "Current Stock", "Initial Qty", "Daily Freq", "Created At"])
    for mr in med_rows:
        writer.writerow(mr)

    writer.writerow([])
    writer.writerow(["=== REMINDER SCHEDULES ==="])
    writer.writerow(["Medicine", "Dose Label", "Time", "Day", "Status"])
    for sr in sch_rows:
        writer.writerow(sr)

    csv_content = output.getvalue()
    filename = f"pillsync_complete_export_{datetime.now().strftime('%Y%m%d')}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


# ---------------------------------------------------------------------------
# GET /export/audit/csv (Admin Only)
# ---------------------------------------------------------------------------
@router.get(
    "/audit/csv",
    status_code=status.HTTP_200_OK,
    summary="Export System Audit Logs as CSV (Admin Only)",
    description="Download system user rosters and configuration audits.",
)
async def export_audit_csv(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_admin),
):
    """Admin-only audit export using fast release pattern."""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()

    user_rows = [
        [_format_datetime(u.created_at), f"USER_REGISTERED ({u.role.upper()})", u.email or u.username, "SUCCESS", str(u.id)]
        for u in users
    ]

    # Release Fast
    await db.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Timestamp", "Action", "Actor", "Status", "User ID"])
    for ur in user_rows:
        writer.writerow(ur)

    csv_content = output.getvalue()
    filename = f"pillsync_system_audit_{datetime.now().strftime('%Y%m%d')}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )
