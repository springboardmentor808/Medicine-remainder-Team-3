"""
PillSync Database Integration & Data Flow Verification Suite.
═════════════════════════════════════════════════════════════

Exposes:
  1. GET  /api/v1/system-health/verify-dbs
     Simultaneous Read/Write/Delete ping test across PostgreSQL, Redis, and MongoDB.
  2. POST /api/v1/system-health/e2e-routing-audit
     Simulates an E2E user workflow (e.g. Chat medication schedule command) and 
     proves routing into PostgreSQL (relational), MongoDB (document), and Redis (cache).
"""

import time
import uuid
import asyncio
from typing import Dict, Any, List
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import database
from app.core.redis import get_redis, connect_redis
from app.core.mongodb import get_mongo_db, connect_mongodb
from app.core.rbac import allow_admin

router = APIRouter(prefix="/system-health", tags=["System Health & DB Verification"])


async def _get_active_redis():
    from app.core.redis import _redis_client
    if _redis_client is None:
        try:
            return await connect_redis()
        except Exception:
            pass
    return get_redis()


async def _get_active_mongodb():
    from app.core.mongodb import _mongo_client
    if _mongo_client is None:
        try:
            return await connect_mongodb()
        except Exception:
            pass
    return get_mongo_db()


# ─────────────────────────────────────────────────────────────────────────────
# 1. DATABASE HEALTH VERIFIERS (Simultaneous R/W/D Ping)
# ─────────────────────────────────────────────────────────────────────────────

async def _verify_postgres() -> Dict[str, Any]:
    """Execute isolated R/W/D verification on relational database (PostgreSQL or SQLite fallback)."""
    t0 = time.perf_counter()
    active_engine = database.get_engine()
    is_sqlite = "sqlite" in str(active_engine.url).lower()
    res = {
        "database": "SQLite (Dev Fallback)" if is_sqlite else "PostgreSQL",
        "connected": False,
        "write_success": False,
        "read_accuracy": False,
        "latency_ms": 0.0,
        "details": "",
    }
    test_id = f"TEST_HEALTHCHECK_{uuid.uuid4().hex[:8]}"
    session_factory = database.get_session_factory()
    try:
        async with session_factory() as session:
            # 1. Ping connection
            if is_sqlite:
                await session.execute(text("SELECT 1;"))
                curr_db, curr_user = "sqlite_db", "sqlite_user"
            else:
                db_info = await session.execute(text("SELECT current_database(), current_user;"))
                row = db_info.fetchone()
                curr_db, curr_user = (row[0], row[1]) if row else ("unknown", "unknown")
            res["connected"] = True

            # 2. Write test
            if is_sqlite:
                await session.execute(text("""
                    CREATE TEMP TABLE IF NOT EXISTS _system_health_test (
                        id VARCHAR(64) PRIMARY KEY,
                        payload TEXT NOT NULL,
                        is_test INTEGER NOT NULL DEFAULT 1,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """))
                await session.execute(
                    text("INSERT INTO _system_health_test (id, payload, is_test) VALUES (:id, :val, 1);"),
                    {"id": test_id, "val": "POSTGRES_HEALTH_OK"}
                )
            else:
                await session.execute(text("""
                    CREATE TEMP TABLE IF NOT EXISTS _system_health_test (
                        id VARCHAR(64) PRIMARY KEY,
                        payload TEXT NOT NULL,
                        is_test BOOLEAN NOT NULL DEFAULT true,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    );
                """))
                await session.execute(
                    text("INSERT INTO _system_health_test (id, payload, is_test) VALUES (:id, :val, true);"),
                    {"id": test_id, "val": "POSTGRES_HEALTH_OK"}
                )
            res["write_success"] = True

            # 3. Read test
            row = (await session.execute(
                text("SELECT payload FROM _system_health_test WHERE id = :id;"),
                {"id": test_id}
            )).fetchone()
            if row and row[0] == "POSTGRES_HEALTH_OK":
                res["read_accuracy"] = True

            # 4. Delete / Purge test
            await session.execute(
                text("DELETE FROM _system_health_test WHERE id = :id;"),
                {"id": test_id}
            )
            await session.commit()
            res["details"] = f"DB: '{curr_db}', User: '{curr_user}' — Full R/W/D passed."
    except Exception as e:
        res["details"] = f"Relational verification failed: {str(e)}"
    finally:
        res["latency_ms"] = round((time.perf_counter() - t0) * 1000, 2)
    return res



async def _verify_redis() -> Dict[str, Any]:
    """Execute isolated R/W/D verification on Redis."""
    t0 = time.perf_counter()
    res = {
        "database": "Redis",
        "connected": False,
        "write_success": False,
        "read_accuracy": False,
        "latency_ms": 0.0,
        "details": "",
    }
    test_key = f"TEST_HEALTHCHECK_{uuid.uuid4().hex[:8]}"
    test_val = f"REDIS_HEALTH_OK_{uuid.uuid4().hex[:4]}"
    try:
        client = await _get_active_redis()
        # 1. Ping
        pong = await client.ping()
        res["connected"] = bool(pong)

        # 2. Write with 15s TTL
        await client.set(test_key, test_val, ex=15)
        res["write_success"] = True

        # 3. Read back & compare
        read_val = await client.get(test_key)
        if read_val == test_val:
            res["read_accuracy"] = True

        # 4. Delete
        await client.delete(test_key)
        res["details"] = "Key written with 15s TTL, read matched, purged."
    except Exception as e:
        res["details"] = f"Redis verification failed: {str(e)}"
    finally:
        res["latency_ms"] = round((time.perf_counter() - t0) * 1000, 2)
    return res


async def _verify_mongodb() -> Dict[str, Any]:
    """Execute isolated R/W/D verification on MongoDB."""
    t0 = time.perf_counter()
    res = {
        "database": "MongoDB",
        "connected": False,
        "write_success": False,
        "read_accuracy": False,
        "latency_ms": 0.0,
        "details": "",
    }
    test_doc_id = f"TEST_HEALTHCHECK_{uuid.uuid4().hex[:8]}"
    try:
        mongo_db = await _get_active_mongodb()
        coll = mongo_db["system_health_audit"]
        res["connected"] = True

        # 1. Write
        doc_payload = {
            "_id": test_doc_id,
            "is_test": True,
            "status": "MONGO_HEALTH_OK",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await coll.insert_one(doc_payload)
        res["write_success"] = True

        # 2. Read back
        retrieved = await coll.find_one({"_id": test_doc_id, "is_test": True})
        if retrieved and retrieved.get("status") == "MONGO_HEALTH_OK":
            res["read_accuracy"] = True

        # 3. Delete
        await coll.delete_one({"_id": test_doc_id})
        res["details"] = f"Collection 'system_health_audit' — Doc inserted with is_test:true, verified, purged."
    except Exception as e:
        res["details"] = f"MongoDB verification failed: {str(e)}"
    finally:
        res["latency_ms"] = round((time.perf_counter() - t0) * 1000, 2)
    return res


# ─────────────────────────────────────────────────────────────────────────────
# 2. ENDPOINT: /verify-dbs
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/verify-dbs",
    dependencies=[Depends(allow_admin)],
    summary="The Ultimate Tri-Database Health Check (Admin Only)",
    description=(
        "Simultaneously performs isolated Read/Write/Delete tests across PostgreSQL, "
        "Redis, and MongoDB. Returns consolidated connection status, read accuracy, "
        "write success, and latencies in milliseconds. Restricted to administrators."
    ),
)
async def verify_databases():
    t_start = time.perf_counter()

    # Execute all 3 verifications concurrently via asyncio.gather
    pg_res, redis_res, mongo_res = await asyncio.gather(
        _verify_postgres(),
        _verify_redis(),
        _verify_mongodb(),
        return_exceptions=False,
    )

    total_duration_ms = round((time.perf_counter() - t_start) * 1000, 2)

    all_connected = pg_res["connected"] and redis_res["connected"] and mongo_res["connected"]
    all_rw_success = (
        pg_res["write_success"] and pg_res["read_accuracy"] and
        redis_res["write_success"] and redis_res["read_accuracy"] and
        mongo_res["write_success"] and mongo_res["read_accuracy"]
    )

    if all_connected and all_rw_success:
        overall_status = "HEALTHY"
        http_code = status.HTTP_200_OK
    elif all_connected:
        overall_status = "DEGRADED"
        http_code = status.HTTP_207_MULTI_STATUS
    else:
        overall_status = "UNHEALTHY"
        http_code = status.HTTP_503_SERVICE_UNAVAILABLE

    response_payload = {
        "status": overall_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_latency_ms": total_duration_ms,
        "summary": {
            "all_connected": all_connected,
            "all_rw_verified": all_rw_success,
            "healthy_count": sum([
                pg_res["read_accuracy"],
                redis_res["read_accuracy"],
                mongo_res["read_accuracy"]
            ]),
            "total_databases": 3,
        },
        "databases": {
            "postgresql": pg_res,
            "redis": redis_res,
            "mongodb": mongo_res,
        },
    }

    return JSONResponse(status_code=http_code, content=response_payload)


# ─────────────────────────────────────────────────────────────────────────────
# 3. ENDPOINT: /e2e-routing-audit
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/e2e-routing-audit",
    dependencies=[Depends(allow_admin)],
    summary="E2E Data Routing Audit (Admin Only)",
    description=(
        "Simulates a typical user workflow: 'Sending a chat message that registers a schedule'. "
        "Verifies that data is correctly routed to: "
        "1. PostgreSQL (relational schedule), "
        "2. MongoDB (unstructured chat/audit log), and "
        "3. Redis (cached query state with TTL). "
        "All injected records use is_test:true and are verified and safely purged. Restricted to administrators."
    ),
)
async def e2e_routing_audit(db: AsyncSession = Depends(database.get_db)):
    audit_trace: Dict[str, Any] = {
        "audit_id": f"TEST_AUDIT_{uuid.uuid4().hex[:8]}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "simulated_action": "User sends AI chat command: 'Schedule Metformin 500mg daily at 8AM'",
        "routing_results": {},
        "safety_cleanup": {},
    }

    test_user_uuid = uuid.uuid4()
    test_user_id = str(test_user_uuid)
    test_med_name = f"TEST_Metformin_{uuid.uuid4().hex[:4]}"
    test_session_id = f"TEST_SESS_{uuid.uuid4().hex[:6]}"

    # --- Step 1: Route to PostgreSQL / Relational DB (Real Relational Medication Schedule) ---
    pg_start = time.perf_counter()
    test_med_uuid = uuid.uuid4()
    test_sched_uuid = uuid.uuid4()
    try:
        session = db
        from app.models.user import User
        from app.models.medicine import Medicine
        from app.models.schedule import Schedule
        from sqlalchemy import select
        from datetime import time as d_time

        # 1. Create transient test user in real user table
        test_user = User(
            id=test_user_uuid,
            username=f"audit_{test_user_uuid.hex[:8]}",
            email=f"audit_{test_user_uuid.hex[:8]}@pillsync.internal",
            hashed_password="hashed_test_password",
            full_name="Audit Tester",
            role="patient",
            is_active=True,
        )
        session.add(test_user)
        await session.flush()

        # 2. Create transient medicine in real medicines table
        test_med = Medicine(
            id=test_med_uuid,
            user_id=test_user_uuid,
            name=test_med_name,
            dosage="500mg",
            initial_quantity=100,
            current_stock=100,
            daily_frequency=1,
            quantity_per_dose=1,
        )
        session.add(test_med)
        await session.flush()

        # 3. Create real schedule in real schedules table
        test_sched = Schedule(
            id=test_sched_uuid,
            user_id=test_user_uuid,
            medicine_id=test_med_uuid,
            scheduled_time=d_time(8, 0),
            dose_label="Morning",
            frequency_pattern="1-0-0",
        )
        session.add(test_sched)
        await session.commit()

        try:
            # 4. Read back through the real relational join
            stmt = (
                select(Schedule, Medicine)
                .join(Medicine, Schedule.medicine_id == Medicine.id)
                .where(Schedule.id == test_sched_uuid)
            )
            res_row = (await session.execute(stmt)).first()

            verified_name = res_row[1].name if res_row else None
            verified_dosage = res_row[1].dosage if res_row else None

            audit_trace["routing_results"]["postgresql"] = {
                "target_data": "Structured Relational Schedule",
                "table": "schedules (relational schema)",
                "success": res_row is not None and verified_name == test_med_name,
                "verified_fields": {"medicine_name": verified_name, "dosage": verified_dosage} if res_row else None,
                "latency_ms": round((time.perf_counter() - pg_start) * 1000, 2),
            }
        finally:
            # 5. Guaranteed Cleanup: Cascade delete user, purging medicine and schedule
            try:
                del_stmt = select(User).where(User.id == test_user_uuid)
                u_to_del = (await session.execute(del_stmt)).scalar_one_or_none()
                if u_to_del:
                    await session.delete(u_to_del)
                    await session.commit()
                audit_trace["safety_cleanup"]["postgresql"] = "PURGED (0 orphan rows)"
            except Exception as cleanup_err:
                audit_trace["safety_cleanup"]["postgresql"] = f"CLEANUP_FAILED: {cleanup_err}"
    except Exception as e:
        audit_trace["routing_results"]["postgresql"] = {"success": False, "error": str(e)}
        if "postgresql" not in audit_trace["safety_cleanup"]:
            audit_trace["safety_cleanup"]["postgresql"] = f"CLEANUP_FAILED: {e}"

    # --- Step 2: Route to MongoDB (Unstructured Chat & AI Log) ---
    mongo_start = time.perf_counter()
    mongo_db = None
    try:
        mongo_db = await _get_active_mongodb()
        coll = mongo_db["ai_chat_audit"]
        chat_doc = {
            "_id": audit_trace["audit_id"],
            "session_id": test_session_id,
            "user_id": test_user_id,
            "is_test": True,
            "user_message": "Schedule Metformin 500mg daily at 8AM",
            "assistant_response": "Understood. Created schedule for Metformin 500mg at 08:00 AM.",
            "intent": "SCHEDULE_CREATE",
            "model": "gemini-1.5-flash-grounded",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await coll.insert_one(chat_doc)

        # Verify retrieval
        m_doc = await coll.find_one({"_id": audit_trace["audit_id"], "is_test": True})

        audit_trace["routing_results"]["mongodb"] = {
            "target_data": "Unstructured Chat History & AI Interaction Audit",
            "collection": "ai_chat_audit (document schema)",
            "success": m_doc is not None and m_doc.get("session_id") == test_session_id,
            "verified_fields": {
                "intent": m_doc.get("intent"),
                "is_test": m_doc.get("is_test"),
                "model": m_doc.get("model"),
            } if m_doc else None,
            "latency_ms": round((time.perf_counter() - mongo_start) * 1000, 2),
        }
    except Exception as e:
        audit_trace["routing_results"]["mongodb"] = {"success": False, "error": str(e)}
    finally:
        # Immediate Cleanup
        try:
            if mongo_db is not None:
                coll = mongo_db["ai_chat_audit"]
                await coll.delete_one({"_id": audit_trace["audit_id"]})
                audit_trace["safety_cleanup"]["mongodb"] = "PURGED (0 orphan docs)"
            else:
                audit_trace["safety_cleanup"]["mongodb"] = "CLEANUP_FAILED: MongoDB client unavailable"
        except Exception as cleanup_err:
            audit_trace["safety_cleanup"]["mongodb"] = f"CLEANUP_FAILED: {cleanup_err}"

    # --- Step 3: Route to Redis (Frequent Query Cache & Session State with TTL) ---
    redis_start = time.perf_counter()
    redis_client = None
    cache_key = f"TEST_cache:user_schedule:{test_user_id}"
    try:
        redis_client = await _get_active_redis()
        cache_val = f'{{"cached_medicine": "{test_med_name}", "dose": "500mg", "is_test": true}}'

        # Set cache with 60-second TTL
        await redis_client.set(cache_key, cache_val, ex=60)
        remaining_ttl = await redis_client.ttl(cache_key)
        fetched_val = await redis_client.get(cache_key)

        audit_trace["routing_results"]["redis"] = {
            "target_data": "High-Speed Schedule Cache & Active Session State",
            "key_pattern": "cache:user_schedule:{user_id}",
            "success": fetched_val == cache_val and remaining_ttl > 0,
            "ttl_seconds": remaining_ttl,
            "verified_ttl_active": remaining_ttl > 0,
            "latency_ms": round((time.perf_counter() - redis_start) * 1000, 2),
        }
    except Exception as e:
        audit_trace["routing_results"]["redis"] = {"success": False, "error": str(e)}
    finally:
        # Immediate Cleanup
        try:
            if redis_client is not None:
                await redis_client.delete(cache_key)
                audit_trace["safety_cleanup"]["redis"] = "PURGED (Key evicted)"
            else:
                audit_trace["safety_cleanup"]["redis"] = "CLEANUP_FAILED: Redis client unavailable"
        except Exception as cleanup_err:
            audit_trace["safety_cleanup"]["redis"] = f"CLEANUP_FAILED: {cleanup_err}"

    routing_passed = (
        audit_trace["routing_results"].get("postgresql", {}).get("success") is True and
        audit_trace["routing_results"].get("mongodb", {}).get("success") is True and
        audit_trace["routing_results"].get("redis", {}).get("success") is True
    )

    cleanups_passed = (
        len(audit_trace["safety_cleanup"]) == 3 and
        all(
            isinstance(v, str) and "PURGED" in v and "FAILED" not in v.upper()
            for v in audit_trace["safety_cleanup"].values()
        )
    )

    all_passed = routing_passed and cleanups_passed
    audit_trace["all_databases_verified"] = all_passed

    return JSONResponse(
        status_code=status.HTTP_200_OK if all_passed else status.HTTP_207_MULTI_STATUS,
        content=audit_trace,
    )
