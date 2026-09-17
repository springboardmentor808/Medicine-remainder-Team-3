"""
Automated Test Suite for Database Integration, RBAC Security & Data Flow Verification.
══════════════════════════════════════════════════════════════════════════════════════
Tests:
  1. RBAC Protection: Anonymous access blocked (401), non-admin blocked (403).
  2. Admin Access: Simultaneous R/W/D Ping across PostgreSQL, Redis, and MongoDB (/verify-dbs).
  3. E2E Data Routing Audit: Full routing across 3 stores and safe data purge (/e2e-routing-audit).
"""

import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_database_verification_rbac_and_e2e_routing():
    """Verify RBAC protection, health check, and E2E routing audit across all 3 databases."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. RBAC Test: Anonymous request (clean client, zero cookies) MUST be 401
        res_anon = await client.get("/api/v1/system-health/verify-dbs")
        assert res_anon.status_code == 401, f"Expected 401 for anonymous, got {res_anon.status_code}"


        # 2. Register a Patient
        p_uid = uuid.uuid4().hex[:6]
        patient_res = await client.post(
            "/api/v1/auth/register",
            json={
                "username": f"patient_{p_uid}",
                "email": f"patient_{p_uid}@testdomain.com",
                "password": "Password123!",
                "full_name": "Test Patient",
                "role": "patient",
            },
        )
        assert patient_res.status_code == 201, patient_res.text
        p_data = patient_res.json()
        patient_token = p_data.get("access_token") or p_data.get("tokens", {}).get("access_token")

        # 3. RBAC Test: Patient request should be forbidden (403)
        res_patient = await client.get(
            "/api/v1/system-health/verify-dbs",
            headers={"Authorization": f"Bearer {patient_token}"}
        )
        assert res_patient.status_code == 403, f"Expected 403 for patient, got {res_patient.status_code}"

        # Clear client session cookies before registering admin
        client.cookies.clear()

        # 4. Register an Admin
        a_uid = uuid.uuid4().hex[:6]
        admin_res = await client.post(
            "/api/v1/auth/register",
            json={
                "username": f"admin_{a_uid}",
                "email": f"admin_{a_uid}@testdomain.com",
                "password": "Password123!",
                "full_name": "Test Admin",
                "role": "admin",
            },
        )
        assert admin_res.status_code == 201, admin_res.text
        a_data = admin_res.json()
        admin_token = a_data.get("access_token") or a_data.get("tokens", {}).get("access_token")
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # 5. Admin Health check verification
        res_ping = await client.get("/api/v1/system-health/verify-dbs", headers=admin_headers)

        assert res_ping.status_code in [200, 207], res_ping.text
        ping_data = res_ping.json()

        assert ping_data["status"] in ["HEALTHY", "DEGRADED"]
        dbs = ping_data["databases"]
        assert dbs["postgresql"]["connected"] is True
        assert dbs["postgresql"]["write_success"] is True
        assert dbs["postgresql"]["read_accuracy"] is True

        assert dbs["redis"]["connected"] is True
        assert dbs["redis"]["write_success"] is True
        assert dbs["redis"]["read_accuracy"] is True

        assert dbs["mongodb"]["connected"] is True
        assert dbs["mongodb"]["write_success"] is True
        assert dbs["mongodb"]["read_accuracy"] is True

        # 6. Admin E2E routing audit
        res_e2e = await client.post("/api/v1/system-health/e2e-routing-audit", headers=admin_headers)
        assert res_e2e.status_code == 200, res_e2e.text
        audit = res_e2e.json()

        assert audit["all_databases_verified"] is True
        assert audit["audit_id"].startswith("TEST_AUDIT_")

        # Verify Postgres routing
        pg = audit["routing_results"]["postgresql"]
        assert pg["success"] is True
        assert "schedules" in pg["table"]
        assert pg["verified_fields"]["dosage"] == "500mg"

        # Verify MongoDB routing
        mongo = audit["routing_results"]["mongodb"]
        assert mongo["success"] is True
        assert mongo["verified_fields"]["intent"] == "SCHEDULE_CREATE"
        assert mongo["verified_fields"]["is_test"] is True

        # Verify Redis routing
        redis_res = audit["routing_results"]["redis"]
        assert redis_res["success"] is True
        assert redis_res["verified_ttl_active"] is True
        assert redis_res["ttl_seconds"] > 0

        # Verify Safe Purge
        cleanup = audit["safety_cleanup"]
        assert "PURGED" in cleanup["postgresql"]
        assert "PURGED" in cleanup["mongodb"]
        assert "PURGED" in cleanup["redis"]


@pytest.mark.asyncio
async def test_audit_fails_on_cleanup_failure(monkeypatch):
    """Verify that a database safety cleanup failure causes e2e-routing-audit to fail."""
    import app.api.v1.system_health as sh

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Register an Admin
        a_uid = uuid.uuid4().hex[:6]
        admin_res = await client.post(
            "/api/v1/auth/register",
            json={
                "username": f"audit_admin_{a_uid}",
                "email": f"audit_admin_{a_uid}@testdomain.com",
                "password": "Password123!",
                "full_name": "Audit Admin",
                "role": "admin",
            },
        )
        assert admin_res.status_code == 201, admin_res.text
        a_data = admin_res.json()
        admin_token = a_data.get("access_token") or a_data.get("tokens", {}).get("access_token")
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # Mock Redis client so that delete fails during cleanup
        real_get_redis = sh._get_active_redis

        class FailingDeleteRedisWrapper:
            def __init__(self, real_client):
                self._real = real_client

            def __getattr__(self, name):
                return getattr(self._real, name)

            async def delete(self, *keys):
                raise RuntimeError("Simulated Redis cleanup purge failure")

        async def mock_get_redis():
            real_client = await real_get_redis()
            return FailingDeleteRedisWrapper(real_client)

        monkeypatch.setattr(sh, "_get_active_redis", mock_get_redis)

        res_e2e = await client.post("/api/v1/system-health/e2e-routing-audit", headers=admin_headers)
        assert res_e2e.status_code == 207, f"Expected 207 on cleanup failure, got {res_e2e.status_code}"
        audit = res_e2e.json()
        assert audit["all_databases_verified"] is False
        assert "CLEANUP_FAILED" in audit["safety_cleanup"]["redis"]

