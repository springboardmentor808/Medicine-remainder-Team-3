"""
PillSync Master Medicine Catalog Model (Track 3 -- Engineer 3).

Stores the normalized Indian medicine catalog (253,973 records) as a
read-only reference table separate from user-owned Medicine records.

This table powers:
  - Auto-complete drug search (trigram similarity)
  - Generic substitution recommendations (composition fingerprint match)
  - Price comparison in INR
  - OCR text → verified drug name matching
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class MedicineCatalog(Base):
    """
    Master read-only Indian medicine catalog.

    Sourced from: data/processed/pillsync_medicine_import.csv
    Total Records: ~253,973 allopathy medicines

    This is NOT user-owned data — it's a shared reference catalog used
    for search, validation, and generic substitution recommendations.
    """

    __tablename__ = "medicine_catalog"

    # --- Primary Key ---
    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        index=True,
    )

    # --- Original CSV ID ---
    source_id: Mapped[str] = mapped_column(
        String(20), nullable=True,
        comment="Original ID from indian_medicine_data.csv",
    )

    # --- Brand & Product Details ---
    brand_name: Mapped[str] = mapped_column(
        String(300), nullable=False, index=True,
        comment="Commercial brand name (e.g., Augmentin 625 Duo Tablet)",
    )
    manufacturer: Mapped[str] = mapped_column(
        String(300), nullable=True, index=True,
        comment="Pharmaceutical manufacturer name",
    )
    medicine_type: Mapped[str] = mapped_column(
        String(50), nullable=True,
        comment="Type classification (allopathy, ayurvedic, etc.)",
    )

    # --- Pricing (INR) ---
    price_inr: Mapped[float] = mapped_column(
        Float, nullable=True,
        comment="MRP in Indian Rupees for the full pack",
    )
    price_per_unit_inr: Mapped[float] = mapped_column(
        Float, nullable=True, index=True,
        comment="Price per tablet/capsule/ml in INR",
    )

    # --- Pack Information ---
    pack_size_label: Mapped[str] = mapped_column(
        String(200), nullable=True,
        comment="Original pack size text (e.g., 'strip of 10 tablets')",
    )
    pack_quantity: Mapped[int] = mapped_column(
        Integer, nullable=True,
        comment="Number of units in the pack",
    )
    dosage_form: Mapped[str] = mapped_column(
        String(50), nullable=True, index=True,
        comment="Dosage form (Tablet, Capsule, Syrup, Injection, etc.)",
    )

    # --- Salt Composition (Parsed) ---
    salt_1_name: Mapped[str] = mapped_column(
        String(200), nullable=True, index=True,
        comment="Primary active ingredient name",
    )
    salt_1_strength: Mapped[str] = mapped_column(
        String(50), nullable=True,
        comment="Primary salt strength (e.g., '500')",
    )
    salt_1_unit: Mapped[str] = mapped_column(
        String(20), nullable=True,
        comment="Primary salt unit (e.g., 'mg', 'mcg')",
    )
    salt_2_name: Mapped[str] = mapped_column(
        String(200), nullable=True,
        comment="Secondary active ingredient name (if combination drug)",
    )
    salt_2_strength: Mapped[str] = mapped_column(
        String(50), nullable=True,
        comment="Secondary salt strength",
    )
    salt_2_unit: Mapped[str] = mapped_column(
        String(20), nullable=True,
        comment="Secondary salt unit",
    )

    # --- Composition Fingerprint (for Generic Substitution) ---
    composition_full: Mapped[str] = mapped_column(
        Text, nullable=True,
        comment="Full composition string (e.g., 'Amoxycillin (500mg) + Clavulanic Acid (125mg)')",
    )
    composition_fingerprint: Mapped[str] = mapped_column(
        String(500), nullable=True, index=True,
        comment="Normalized fingerprint for grouping generics (e.g., 'amoxycillin_500mg+clavulanic acid_125mg')",
    )
    generic_group_hash: Mapped[str] = mapped_column(
        String(20), nullable=True, index=True,
        comment="MD5 hash prefix of fingerprint for fast grouping",
    )

    # --- Status ---
    is_discontinued: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False,
        comment="Whether the medicine has been discontinued by manufacturer",
    )

    # --- Timestamps ---
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # --- Indexes for Search Performance ---
    __table_args__ = (
        # Trigram index for fuzzy brand name search (PostgreSQL pg_trgm)
        # Note: Requires CREATE EXTENSION pg_trgm; in PostgreSQL
        Index("ix_catalog_brand_trgm", "brand_name", postgresql_using="gin",
              postgresql_ops={"brand_name": "gin_trgm_ops"}),
        # Composite index for generic substitution lookups
        Index("ix_catalog_fingerprint_price", "composition_fingerprint", "price_per_unit_inr"),
        # Index for manufacturer browsing
        Index("ix_catalog_manufacturer_name", "manufacturer", "brand_name"),
    )

    def __repr__(self) -> str:
        return (
            f"<MedicineCatalog(id={self.id}, brand='{self.brand_name}', "
            f"salt='{self.salt_1_name}', price=INR{self.price_per_unit_inr})>"
        )
