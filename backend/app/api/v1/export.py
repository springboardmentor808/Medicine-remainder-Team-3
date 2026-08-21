"""
PillSync Data Export API Router.

Provides endpoints for downloading user data as CSV and PDF:
    - GET /export/medicines/csv   — Download medicines list as CSV
    - GET /export/medicines/pdf   — Download medicines list as PDF
    - GET /export/adherence/csv   — Download adherence history as CSV
    - GET /export/all/csv         — Download all data as CSV
"""

import csv
import io
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
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
    """Export all medicines for the current user as CSV."""
    result = await db.execute(
        select(Medicine)
        .where(Medicine.user_id == current_user.id)
        .order_by(Medicine.name)
    )
    medicines = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Name", "Disease Category", "Dosage", "Initial Quantity",
        "Current Stock", "Daily Frequency", "Qty Per Dose",
        "Days Until Empty", "Notes", "Created At", "Updated At"
    ])

    for med in medicines:
        daily = med.daily_frequency * med.quantity_per_dose
        days_left = round(med.current_stock / daily, 1) if daily > 0 else "N/A"
        writer.writerow([
            med.name,
            med.disease_category,
            med.dosage,
            med.initial_quantity,
            med.current_stock,
            med.daily_frequency,
            med.quantity_per_dose,
            days_left,
            med.notes or "",
            _format_datetime(med.created_at),
            _format_datetime(med.updated_at),
        ])

    output.seek(0)
    filename = f"pillsync_medicines_{datetime.now().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
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
    """Export all medicines for the current user as a styled HTML/PDF."""
    result = await db.execute(
        select(Medicine)
        .where(Medicine.user_id == current_user.id)
        .order_by(Medicine.name)
    )
    medicines = result.scalars().all()

    headers = ["#", "Medicine", "Category", "Dosage", "Stock", "Daily Freq", "Days Left", "Notes"]
    rows = []
    for i, med in enumerate(medicines, 1):
        daily = med.daily_frequency * med.quantity_per_dose
        days_left = str(round(med.current_stock / daily, 1)) if daily > 0 else "N/A"
        rows.append([
            str(i),
            med.name,
            med.disease_category,
            med.dosage,
            f"{med.current_stock}/{med.initial_quantity}",
            f"{med.daily_frequency}x/day",
            days_left,
            (med.notes or "—")[:50],
        ])

    html = _generate_pdf_html("Medicine Inventory", headers, rows, current_user.full_name)

    filename = f"pillsync_medicines_{datetime.now().strftime('%Y%m%d')}.html"
    return StreamingResponse(
        io.BytesIO(html.encode("utf-8")),
        media_type="text/html",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
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
    """Export adherence/schedule data for the current user as CSV."""
    result = await db.execute(
        select(Schedule)
        .where(Schedule.user_id == current_user.id)
        .order_by(Schedule.created_at.desc())
    )
    schedules = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Medicine", "Dose Label", "Scheduled Time", "Status",
        "Taken At", "Notes", "Created At"
    ])

    for s in schedules:
        med_name = s.medicine.name if s.medicine else "Unknown"
        writer.writerow([
            med_name,
            s.dose_label or "",
            str(s.scheduled_time) if s.scheduled_time else "",
            s.status or "",
            _format_datetime(s.taken_at) if hasattr(s, "taken_at") and s.taken_at else "",
            s.notes or "",
            _format_datetime(s.created_at),
        ])

    output.seek(0)
    filename = f"pillsync_adherence_{datetime.now().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
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
    """Export all data for the current user as a comprehensive CSV."""
    # Medicines
    med_result = await db.execute(
        select(Medicine)
        .where(Medicine.user_id == current_user.id)
        .order_by(Medicine.name)
    )
    medicines = med_result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)

    # Section: User Info
    writer.writerow(["=== USER INFO ==="])
    writer.writerow(["Name", "Email", "Role", "Member Since"])
    writer.writerow([
        current_user.full_name,
        current_user.email,
        current_user.role,
        _format_datetime(current_user.created_at),
    ])
    writer.writerow([])

    # Section: Medicines
    writer.writerow(["=== MEDICINES ==="])
    writer.writerow(["Name", "Category", "Dosage", "Stock", "Daily Frequency", "Notes"])
    for med in medicines:
        writer.writerow([
            med.name,
            med.disease_category,
            med.dosage,
            f"{med.current_stock}/{med.initial_quantity}",
            med.daily_frequency,
            med.notes or "",
        ])
    writer.writerow([])

    # Section: Schedules
    writer.writerow(["=== SCHEDULE HISTORY ==="])
    sched_result = await db.execute(
        select(Schedule)
        .where(Schedule.user_id == current_user.id)
        .order_by(Schedule.created_at.desc())
    )
    schedules = sched_result.scalars().all()
    writer.writerow(["Medicine", "Dose Label", "Scheduled Time", "Status", "Created At"])
    for s in schedules:
        med_name = s.medicine.name if s.medicine else "Unknown"
        writer.writerow([
            med_name,
            s.dose_label or "",
            str(s.scheduled_time) if s.scheduled_time else "",
            s.status or "",
            _format_datetime(s.created_at),
        ])

    output.seek(0)
    filename = f"pillsync_full_export_{datetime.now().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
