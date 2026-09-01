"""
End-to-End Tests for Patient Module, Medicine CRUD, Adherence, and Support Tickets.
"""

import pytest
import uuid
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_patient_full_lifecycle():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Register Patient
        uid = uuid.uuid4().hex[:6]
        test_email = f"patient_{uid}@example.com"
        test_password = "SecurePassword123!"

        reg_res = await client.post("/api/v1/auth/register", json={
            "email": test_email,
            "password": test_password,
            "full_name": f"Test Patient {uid}",
            "role": "PATIENT"
        })
        assert reg_res.status_code == 201
        res_data = reg_res.json()
        access_token = res_data.get("access_token") or res_data.get("data", {}).get("tokens", {}).get("access_token")
        assert access_token is not None
        auth_headers = {"Authorization": f"Bearer {access_token}"}

        # 2. Add Medicine (POST /api/v1/medicines/)
        med_payload = {
            "name": "Metformin Extended Release",
            "disease_category": "Diabetes",
            "dosage": "500mg",
            "dosage_form": "Tablet",
            "initial_quantity": 60,
            "daily_frequency": 2,
            "quantity_per_dose": 1,
            "notes": "Take with meals",
        }
        create_med_res = await client.post("/api/v1/medicines/", json=med_payload, headers=auth_headers)
        assert create_med_res.status_code == 201
        med_data = create_med_res.json()
        med_id = med_data["id"]
        assert med_data["name"] == "Metformin Extended Release"
        assert med_data["current_stock"] == 60

        # 3. List Medicines (GET /api/v1/medicines/)
        list_res = await client.get("/api/v1/medicines/", headers=auth_headers)
        assert list_res.status_code == 200
        list_data = list_res.json()
        assert len(list_data["medicines"]) >= 1
        assert list_data["medicines"][0]["name"] == "Metformin Extended Release"

        # 4. Edit Medicine (PUT /api/v1/medicines/{id})
        update_payload = {
            "name": "Metformin XR 1000mg",
            "dosage": "1000mg",
            "disease_category": "Diabetes",
            "daily_frequency": 2,
            "quantity_per_dose": 1,
            "notes": "Updated instructions",
        }
        edit_res = await client.put(f"/api/v1/medicines/{med_id}", json=update_payload, headers=auth_headers)
        assert edit_res.status_code == 200
        edited_data = edit_res.json()
        assert edited_data["name"] == "Metformin XR 1000mg"
        assert edited_data["dosage"] == "1000mg"

        # 5. Quick Stock Update (PATCH /api/v1/medicines/{id}/stock)
        stock_res = await client.patch(f"/api/v1/medicines/{med_id}/stock", json={"new_stock": 55}, headers=auth_headers)
        assert stock_res.status_code == 200
        stock_data = stock_res.json()
        assert stock_data["current_stock"] == 55

        # 6. Refill Stock Update (POST /api/v1/refill/update-stock)
        refill_res = await client.post("/api/v1/refill/update-stock", json={
            "medicine_id": med_id,
            "total_pills_remaining": 50,
            "daily_dose_count": 2,
            "low_stock_threshold": 5
        }, headers=auth_headers)
        assert refill_res.status_code == 200
        refill_data = refill_res.json()
        assert refill_data["total_pills_remaining"] == 50
        assert refill_data["days_remaining"] == 25.0

        # 7. Get Medication Schedules (GET /api/v1/adherence/schedules)
        sched_res = await client.get("/api/v1/adherence/schedules", headers=auth_headers)
        assert sched_res.status_code == 200
        schedules = sched_res.json()
        assert len(schedules) >= 1
        schedule_id = schedules[0]["id"]
        assert schedules[0]["medicine_name"] is not None

        # 8. Record Dose Action (POST /api/v1/adherence/record)
        dose_res = await client.post("/api/v1/adherence/record", json={
            "schedule_id": schedule_id,
            "medicine_id": med_id,
            "action": "TAKEN"
        }, headers=auth_headers)
        assert dose_res.status_code == 201
        dose_data = dose_res.json()
        assert dose_data["action"] == "Taken"

        # 9. Support Tickets (POST /api/v1/support/tickets & GET /api/v1/support/tickets)
        ticket_res = await client.post("/api/v1/support/tickets", json={
            "subject": "Question regarding dosage timing",
            "category": "medication_issue",
            "priority": "medium",
            "description": "Should I take Metformin before or after dinner?"
        }, headers=auth_headers)
        assert ticket_res.status_code == 201
        ticket_data = ticket_res.json()
        assert ticket_data["data"]["status"] == "open"

        list_tickets_res = await client.get("/api/v1/support/tickets", headers=auth_headers)
        assert list_tickets_res.status_code == 200
        assert len(list_tickets_res.json()) >= 1
