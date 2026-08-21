"""
PillSync Medication Service.

Async database operations for Medicine CRUD, stock management,
and disease-based grouping. Used by the /api/v1/medicines router.
"""

import uuid
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.medicine import Medicine
from app.schemas.medicine_schema import MedicineCreate, MedicineUpdate


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

async def create_medicine(
    db: AsyncSession,
    user_id: uuid.UUID,
    data: MedicineCreate,
) -> Medicine:
    """
    Insert a new medicine record for the given user.

    Sets current_stock equal to initial_quantity on creation.
    """
    cat_val = data.disease_category.value if hasattr(data.disease_category, "value") else str(data.disease_category)
    medicine = Medicine(
        user_id=user_id,
        name=data.name,
        disease_category=cat_val,
        dosage=data.dosage,
        initial_quantity=data.initial_quantity,
        current_stock=data.initial_quantity,  # full stock on creation
        daily_frequency=data.daily_frequency,
        quantity_per_dose=data.quantity_per_dose,
        notes=data.notes,
    )
    db.add(medicine)
    await db.flush()
    await db.commit()
    await db.refresh(medicine)
    return medicine


# ---------------------------------------------------------------------------
# Read — Single
# ---------------------------------------------------------------------------

async def get_medicine_by_id(
    db: AsyncSession,
    medicine_id: uuid.UUID | str,
) -> Medicine | None:
    """Fetch a medicine record by primary key."""
    if isinstance(medicine_id, str):
        try:
            medicine_id = uuid.UUID(medicine_id)
        except ValueError:
            return None

    # Try direct UUID comparison first (works for both Postgres and SQLite)
    result = await db.execute(
        select(Medicine).where(Medicine.id == medicine_id)
    )
    med = result.scalar_one_or_none()

    # Fallback: try string comparison for SQLite which stores UUIDs as hex
    if med is None:
        from sqlalchemy import or_, cast, String
        med_str = str(medicine_id)
        med_hex = medicine_id.hex
        result = await db.execute(
            select(Medicine).where(
                or_(
                    cast(Medicine.id, String) == med_str,
                    cast(Medicine.id, String) == med_hex,
                )
            )
        )
        med = result.scalar_one_or_none()

    return med


# ---------------------------------------------------------------------------
# Read — Paginated List with Filters
# ---------------------------------------------------------------------------

async def get_medicines_by_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    page: int = 1,
    page_size: int = 20,
    disease_category: Optional[str] = None,
    search: Optional[str] = None,
) -> tuple[list[Medicine], int]:
    """
    Fetch medicines for a user with optional filtering.

    Args:
        disease_category: Filter by exact disease category.
        search: Case-insensitive substring match on medicine name.

    Returns:
        Tuple of (medicines_list, total_count).
    """
    base_query = select(Medicine).where(Medicine.user_id == user_id)
    count_query = select(func.count(Medicine.id)).where(Medicine.user_id == user_id)

    if disease_category:
        base_query = base_query.where(Medicine.disease_category == disease_category)
        count_query = count_query.where(Medicine.disease_category == disease_category)

    if search:
        pattern = f"%{search}%"
        base_query = base_query.where(Medicine.name.ilike(pattern))
        count_query = count_query.where(Medicine.name.ilike(pattern))

    # Total count (before pagination)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginated results
    offset = (page - 1) * page_size
    paginated_query = (
        base_query
        .order_by(Medicine.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(paginated_query)
    medicines = list(result.scalars().all())

    return medicines, total


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------

async def update_medicine(
    db: AsyncSession,
    medicine: Medicine,
    data: MedicineUpdate,
) -> Medicine:
    """
    Apply partial updates to a medicine record.

    Only non-None fields from `data` are written.
    """
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        # Convert enum values to their string representation
        if hasattr(value, "value"):
            value = value.value
        setattr(medicine, field, value)

    await db.flush()
    await db.commit()
    await db.refresh(medicine)
    return medicine


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

async def delete_medicine(
    db: AsyncSession,
    medicine: Medicine,
) -> None:
    """Hard delete a medicine record and its cascaded children."""
    await db.delete(medicine)
    await db.flush()
    await db.commit()


# ---------------------------------------------------------------------------
# Stock Management
# ---------------------------------------------------------------------------

async def update_stock(
    db: AsyncSession,
    medicine: Medicine,
    adjustment: Optional[int] = None,
    new_stock: Optional[int] = None,
) -> tuple[int, int]:
    """
    Adjust medicine stock level.

    Args:
        adjustment: Relative change (+N or -N). Clamped to >= 0.
        new_stock: Absolute value to set. Takes precedence over adjustment.

    Returns:
        Tuple of (previous_stock, new_stock_value).
    """
    previous_stock = medicine.current_stock

    if new_stock is not None:
        medicine.current_stock = max(0, new_stock)
    elif adjustment is not None:
        medicine.current_stock = max(0, previous_stock + adjustment)

    await db.flush()
    await db.commit()
    await db.refresh(medicine)
    return previous_stock, medicine.current_stock


# ---------------------------------------------------------------------------
# Disease-Based Grouping
# ---------------------------------------------------------------------------

async def get_medicines_grouped_by_disease(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> dict[str, list[Medicine]]:
    """
    Fetch all medicines for a user, grouped by disease_category.

    Returns:
        Dict mapping category name -> list of Medicine objects.
    """
    result = await db.execute(
        select(Medicine)
        .where(Medicine.user_id == user_id)
        .order_by(Medicine.disease_category, Medicine.name)
    )
    medicines = result.scalars().all()

    groups: dict[str, list[Medicine]] = {}
    for med in medicines:
        category = med.disease_category
        if category not in groups:
            groups[category] = []
        groups[category].append(med)

    return groups
