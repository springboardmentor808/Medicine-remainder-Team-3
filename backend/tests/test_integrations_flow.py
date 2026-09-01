"""
Integration tests for Data Exports, Pharmacy Overpass Coordinates, and Reminder Notifications.
"""

import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_exports_reminders_and_pharmacies_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Register Patient
        p_uid = uuid.uuid4().hex[:6]
        p_email = f"patient_{p_uid}@example.com"
        reg_res = await ac.post("/api/v1/auth/register", json={
            "email": p_email,
            "password": "Password123!",
            "full_name": f"Export Patient {p_uid}",
            "role": "PATIENT",
        })
        assert reg_res.status_code == 201, reg_res.text
        p_token = reg_res.json()["access_token"]
        p_headers = {"Authorization": f"Bearer {p_token}"}

        # 2. Add a Medicine
        med_res = await ac.post("/api/v1/medicines/", json={
            "name": "Metformin 500mg",
            "dosage": "500mg",
            "disease_category": "Diabetes",
            "daily_frequency": 2,
            "initial_quantity": 60,
            "current_stock": 45,
            "instructions": "Take with meals",
        }, headers=p_headers)
        assert med_res.status_code == 201, med_res.text
        med_id = med_res.json()["id"]

        # 3. Test Medicines CSV Export
        exp_med_res = await ac.get("/api/v1/export/medicines/csv", headers=p_headers)
        assert exp_med_res.status_code == 200
        assert "Metformin 500mg" in exp_med_res.text
        assert "attachment; filename=" in exp_med_res.headers.get("Content-Disposition", "")

        # 4. Test Adherence CSV Export
        exp_adh_res = await ac.get("/api/v1/export/adherence/csv", headers=p_headers)
        assert exp_adh_res.status_code == 200
        assert "Medicine,Dosage" in exp_adh_res.text

        # 5. Test Full All-Data CSV Export
        exp_all_res = await ac.get("/api/v1/export/all/csv", headers=p_headers)
        assert exp_all_res.status_code == 200
        assert "=== PILLSYNC USER PROFILE ===" in exp_all_res.text
        assert p_email in exp_all_res.text

        # 6. Test Reminder Schedule Today
        sched_today_res = await ac.post("/api/v1/reminders/schedule-today", headers=p_headers)
        assert sched_today_res.status_code == 200
        assert "Enqueued" in sched_today_res.json().get("message", "")

        # 7. Test Reminder Notification Dispatch
        notify_res = await ac.post("/api/v1/reminders/notify", json={
            "title": "Evening Dose Reminder",
            "message": "Time for Metformin 500mg",
            "channel": "push",
        }, headers=p_headers)
        assert notify_res.status_code == 200
        assert "dispatched" in notify_res.json().get("message", "")

        # 8. Test Nearby Pharmacies Endpoint (with lat & lng)
        pharm_res = await ac.get("/api/v1/refill/nearby-pharmacies", params={
            "lat": 28.6139,
            "lng": 77.2090,
            "radius_km": 5,
        }, headers=p_headers)
        assert pharm_res.status_code == 200
        pharm_data = pharm_res.json()
        assert "pharmacies" in pharm_data
        assert pharm_data["user_latitude"] == 28.6139

        # 9. Register Admin & Test Audit Log Export
        adm_uid = uuid.uuid4().hex[:6]
        adm_email = f"admin_{adm_uid}@example.com"
        adm_reg = await ac.post("/api/v1/auth/register", json={
            "email": adm_email,
            "password": "AdminPassword123!",
            "full_name": "System Administrator",
            "role": "ADMIN",
        })
        assert adm_reg.status_code == 201
        adm_token = adm_reg.json()["access_token"]
        adm_headers = {"Authorization": f"Bearer {adm_token}"}

        audit_res = await ac.get("/api/v1/export/audit/csv", headers=adm_headers)
        assert audit_res.status_code == 200
        assert "Timestamp,Action,Actor" in audit_res.text
