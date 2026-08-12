"""
PillSync MongoDB Client Module.

Provides an async MongoDB connection via Motor for:
    - OCR scan results storage (raw text, parsed data, confidence).
    - Prescription document history per user.
    - External drug metadata (side effects, interactions).
"""

from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import settings


# ---------------------------------------------------------------------------
# MongoDB Client Singleton
# ---------------------------------------------------------------------------
_mongo_client: Optional[AsyncIOMotorClient] = None
_mongo_db: Optional[AsyncIOMotorDatabase] = None


async def connect_mongodb() -> AsyncIOMotorDatabase:
    """
    Initialize the async MongoDB connection.

    Called once during application startup via the FastAPI lifespan.
    """
    global _mongo_client, _mongo_db

    _mongo_client = AsyncIOMotorClient(
        settings.MONGO_URL,
        maxPoolSize=20,
        minPoolSize=5,
        serverSelectionTimeoutMS=5000,
    )

    # Extract DB name from the connection URL or use default
    db_name = settings.MONGO_URL.rsplit("/", 1)[-1] or "med_db"
    _mongo_db = _mongo_client[db_name]

    # Verify connectivity
    await _mongo_client.admin.command("ping")
    print(f"[PillSync] MongoDB connected: {settings.MONGO_URL}")

    # Ensure indexes for performance
    await _ensure_indexes()

    return _mongo_db


async def disconnect_mongodb() -> None:
    """Close the MongoDB connection. Called during shutdown."""
    global _mongo_client, _mongo_db
    if _mongo_client:
        _mongo_client.close()
        _mongo_client = None
        _mongo_db = None
        print("[PillSync] MongoDB connection closed.")


def get_mongo_db() -> AsyncIOMotorDatabase:
    """
    FastAPI dependency — returns the active MongoDB database instance.

    Usage:
        @router.get("/example")
        async def example(mongo: AsyncIOMotorDatabase = Depends(get_mongo_db)):
            collection = mongo["prescriptions"]
            ...
    """
    if _mongo_db is None:
        raise RuntimeError(
            "MongoDB client not initialized. "
            "Ensure connect_mongodb() is called during app startup."
        )
    return _mongo_db


# ---------------------------------------------------------------------------
# Collections — Centralized names to avoid typos
# ---------------------------------------------------------------------------

COLLECTION_OCR_RESULTS = "ocr_results"
COLLECTION_PRESCRIPTIONS = "prescriptions"
COLLECTION_DRUG_METADATA = "drug_metadata"


# ---------------------------------------------------------------------------
# Index Setup
# ---------------------------------------------------------------------------

async def _ensure_indexes() -> None:
    """Create MongoDB indexes for optimal query performance."""
    db = get_mongo_db()

    # OCR Results — query by user_id and created_at
    ocr_col = db[COLLECTION_OCR_RESULTS]
    await ocr_col.create_index("user_id")
    await ocr_col.create_index([("user_id", 1), ("created_at", -1)])

    # Prescriptions — query by user_id
    rx_col = db[COLLECTION_PRESCRIPTIONS]
    await rx_col.create_index("user_id")
    await rx_col.create_index([("user_id", 1), ("scanned_at", -1)])

    # Drug Metadata — query by medicine name
    drug_col = db[COLLECTION_DRUG_METADATA]
    await drug_col.create_index("medicine_name")
    await drug_col.create_index(
        [("medicine_name", "text")],
        name="drug_text_search",
    )

    print("[PillSync] MongoDB indexes ensured.")
