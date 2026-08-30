"""
PillSync MongoDB Client Module.

Provides an async MongoDB connection via Motor for:
    - OCR scan results storage (raw text, parsed data, confidence).
    - Prescription document history per user.
    - External drug metadata (side effects, interactions).
"""

from typing import Optional, Any

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import settings


# ---------------------------------------------------------------------------
# In-Memory Fallback Client for Standalone / Dev Mode
# ---------------------------------------------------------------------------
class InMemoryMongoCollection:
    def __init__(self, name: str):
        self.name = name
        self._docs = []

    async def create_index(self, *args, **kwargs):
        return True

    async def insert_one(self, doc: dict):
        import uuid
        from bson import ObjectId
        doc_copy = dict(doc)
        if "_id" not in doc_copy:
            doc_copy["_id"] = ObjectId()
        self._docs.append(doc_copy)
        class InsertResult:
            inserted_id = doc_copy["_id"]
        return InsertResult()

    async def count_documents(self, query: dict):
        return len(self._match(query))

    def _match(self, query: dict):
        results = []
        for d in self._docs:
            match = True
            for k, v in query.items():
                if k == "_id":
                    if str(d.get("_id")) != str(v):
                        match = False
                        break
                elif d.get(k) != v:
                    match = False
                    break
            if match:
                results.append(d)
        return results

    def find(self, query: Optional[dict] = None, *args, **kwargs):
        q = query or {}
        matched = list(self._match(q))
        class Cursor:
            def __init__(self, data):
                self._data = data

            def sort(self, *args, **kwargs):
                return self

            def skip(self, offset: int):
                self._data = self._data[offset:]
                return self

            def limit(self, limit_num: int):
                self._data = self._data[:limit_num]
                return self

            async def to_list(self, length: Optional[int] = None):
                if length is not None:
                    return self._data[:length]
                return self._data

        return Cursor(matched)

    async def find_one(self, query: dict):
        matched = self._match(query)
        if matched:
            return dict(matched[0])
        return None

    async def update_one(self, filter_q: dict, update_q: dict, upsert: bool = False):
        from bson import ObjectId
        matched = self._match(filter_q)
        set_vals = update_q.get("$set", {})
        if matched:
            matched[0].update(set_vals)
            class UpdateResult:
                upserted_id = None
            return UpdateResult()
        elif upsert:
            new_doc = {**filter_q, **set_vals}
            if "_id" not in new_doc:
                new_doc["_id"] = ObjectId()
            self._docs.append(new_doc)
            class UpdateResult:
                upserted_id = new_doc["_id"]
            return UpdateResult()
        class UpdateResult:
            upserted_id = None
        return UpdateResult()


class InMemoryMongoDatabase:
    def __init__(self):
        self._collections = {}

    def __getitem__(self, item: str):
        if item not in self._collections:
            self._collections[item] = InMemoryMongoCollection(item)
        return self._collections[item]


_in_memory_mongo = InMemoryMongoDatabase()


# ---------------------------------------------------------------------------
# MongoDB Client Singleton
# ---------------------------------------------------------------------------
_mongo_client: Optional[AsyncIOMotorClient] = None
_mongo_db: Optional[Any] = None


async def connect_mongodb() -> Any:
    """
    Initialize the async MongoDB connection.
    Falls back to InMemoryMongoDatabase if MongoDB is offline.
    """
    global _mongo_client, _mongo_db

    try:
        _mongo_client = AsyncIOMotorClient(
            settings.MONGO_URL,
            maxPoolSize=20,
            minPoolSize=5,
            serverSelectionTimeoutMS=2000,
        )
        db_name = settings.MONGO_URL.rsplit("/", 1)[-1] or "med_db"
        _mongo_db = _mongo_client[db_name]
        await _mongo_client.admin.command("ping")
        print(f"[PillSync] MongoDB connected: {settings.MONGO_URL}")
        await _ensure_indexes()
        return _mongo_db
    except Exception as err:
        print(f"[PillSync] MongoDB not available ({err}). Using in-memory fallback.")
        _mongo_db = _in_memory_mongo
        return _mongo_db


async def disconnect_mongodb() -> None:
    """Close the MongoDB connection. Called during shutdown."""
    global _mongo_client, _mongo_db
    if _mongo_client:
        _mongo_client.close()
        _mongo_client = None
        _mongo_db = None
        print("[PillSync] MongoDB connection closed.")


def get_mongo_db() -> Any:
    """
    FastAPI dependency — returns the active MongoDB database instance or in-memory fallback.
    """
    global _mongo_db
    if _mongo_db is None:
        return _in_memory_mongo
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
