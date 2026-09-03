"""
PillSync Prescription Service.

Stores OCR scan results and prescription history in MongoDB.
Provides retrieval and search capabilities for past prescriptions.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.mongodb import (
    COLLECTION_DRUG_METADATA,
    COLLECTION_OCR_RESULTS,
    COLLECTION_PRESCRIPTIONS,
    get_mongo_db,
)


# ---------------------------------------------------------------------------
# Save OCR Scan Result
# ---------------------------------------------------------------------------

async def save_ocr_result(
    user_id: uuid.UUID,
    filename: str,
    raw_text: str,
    confidence_score: float,
    parsed_data: Optional[dict] = None,
) -> str:
    """
    Store an OCR scan result in MongoDB.

    Args:
        user_id: Patient UUID who performed the scan.
        filename: Original uploaded file name.
        raw_text: Raw text extracted by Tesseract OCR.
        confidence_score: OCR extraction confidence (0.0 to 1.0).
        parsed_data: NLP-parsed fields (medicine_name, dosage, frequency).

    Returns:
        MongoDB document ID as string.
    """
    db = get_mongo_db()
    collection = db[COLLECTION_OCR_RESULTS]

    document = {
        "user_id": str(user_id),
        "filename": filename,
        "raw_text": raw_text,
        "confidence_score": confidence_score,
        "parsed_data": parsed_data or {},
        "created_at": datetime.now(timezone.utc),
    }

    result = await collection.insert_one(document)
    return str(result.inserted_id)


# ---------------------------------------------------------------------------
# Get Prescription History
# ---------------------------------------------------------------------------

async def get_prescription_history(
    user_id: uuid.UUID,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[dict], int]:
    """
    Fetch paginated prescription scan history for a user.

    Args:
        user_id: Patient UUID.
        page: Page number (1-indexed).
        page_size: Items per page.

    Returns:
        Tuple of (list of scan documents, total count).
    """
    db = get_mongo_db()
    collection = db[COLLECTION_OCR_RESULTS]

    query = {"user_id": str(user_id)}
    total = await collection.count_documents(query)

    offset = (page - 1) * page_size
    cursor = (
        collection.find(query)
        .sort("created_at", -1)
        .skip(offset)
        .limit(page_size)
    )
    documents = await cursor.to_list(length=page_size)

    # Convert ObjectId to string for JSON serialization
    for doc in documents:
        doc["_id"] = str(doc["_id"])

    return documents, total


# ---------------------------------------------------------------------------
# Get Single Prescription
# ---------------------------------------------------------------------------

async def get_prescription_by_id(scan_id: str) -> Optional[dict]:
    """
    Fetch a single OCR scan result by its MongoDB document ID.

    Args:
        scan_id: MongoDB ObjectId as string.

    Returns:
        Scan document dict, or None if not found.
    """
    db = get_mongo_db()
    collection = db[COLLECTION_OCR_RESULTS]

    try:
        doc = await collection.find_one({"_id": ObjectId(scan_id)})
    except Exception:
        return None

    if doc:
        doc["_id"] = str(doc["_id"])

    return doc


# ---------------------------------------------------------------------------
# Save Drug Metadata
# ---------------------------------------------------------------------------

async def save_drug_metadata(
    medicine_name: str,
    generic_name: Optional[str] = None,
    category: Optional[str] = None,
    side_effects: Optional[list[str]] = None,
    interactions: Optional[list[str]] = None,
    description: Optional[str] = None,
    source: str = "manual",
) -> str:
    """
    Store external drug information in MongoDB.

    Used for enriching prescription data with side effects,
    drug interactions, and usage guidelines.

    Args:
        medicine_name: Brand or generic medicine name.
        generic_name: International generic name.
        category: Disease category (e.g., "Antibiotics").
        side_effects: List of known side effects.
        interactions: List of known drug interactions.
        description: Usage description / guidelines.
        source: Data source identifier (e.g., "openFDA", "manual").

    Returns:
        MongoDB document ID as string.
    """
    db = get_mongo_db()
    collection = db[COLLECTION_DRUG_METADATA]

    document = {
        "medicine_name": medicine_name,
        "generic_name": generic_name,
        "category": category,
        "side_effects": side_effects or [],
        "interactions": interactions or [],
        "description": description,
        "source": source,
        "updated_at": datetime.now(timezone.utc),
    }

    # Upsert — update if medicine_name exists, insert if not
    result = await collection.update_one(
        {"medicine_name": medicine_name},
        {"$set": document},
        upsert=True,
    )

    if result.upserted_id:
        return str(result.upserted_id)
    return medicine_name


# ---------------------------------------------------------------------------
# Search Drug Metadata
# ---------------------------------------------------------------------------

async def search_drug_metadata(
    query: str,
    limit: int = 10,
) -> list[dict]:
    """
    Search drug metadata by medicine name (text search).

    Args:
        query: Search term.
        limit: Max results to return.

    Returns:
        List of matching drug documents.
    """
    db = get_mongo_db()
    collection = db[COLLECTION_DRUG_METADATA]

    cursor = (
        collection.find(
            {"$text": {"$search": query}},
            {"score": {"$meta": "textScore"}},
        )
        .sort([("score", {"$meta": "textScore"})])
        .limit(limit)
    )
    documents = await cursor.to_list(length=limit)

    for doc in documents:
        doc["_id"] = str(doc["_id"])

    return documents
