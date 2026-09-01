import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models.user import UserRole


@pytest.mark.asyncio
async def test_caregiver_and_admin_full_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Register a Patient
        patient_res = await ac.post(
            "/api/v1/auth/register",
            json={
                "username": "patient_bob",
                "email": "bob@example.com",
                "password": "Password123!",
                "full_name": "Bob Smith",
                "role": "PATIENT",
            },
        )
        assert patient_res.status_code == 201, patient_res.text
        p_data = patient_res.json()
        patient_token = p_data.get("access_token") or p_data.get("tokens", {}).get("access_token")
        patient_id = p_data.get("id") or p_data.get("user", {}).get("id")
        assert patient_token is not None
        assert patient_id is not None

        # Patient creates a medicine & schedule
        med_res = await ac.post(
            "/api/v1/medicines/",
            headers={"Authorization": f"Bearer {patient_token}"},
            json={
                "name": "Metformin",
                "dosage": "500mg",
                "dosage_form": "Tablet",
                "initial_quantity": 60,
                "daily_frequency": 2,
                "disease_category": "Diabetes",
            },
        )
        assert med_res.status_code == 201, med_res.text

        # 2. Register a Caregiver
        cg_res = await ac.post(
            "/api/v1/auth/register",
            json={
                "username": "caregiver_sarah",
                "email": "sarah@example.com",
                "password": "Password123!",
                "full_name": "Dr. Sarah Chen",
                "role": "CAREGIVER",
            },
        )
        assert cg_res.status_code == 201, cg_res.text
        cg_data = cg_res.json()
        cg_token = cg_data.get("access_token") or cg_data.get("tokens", {}).get("access_token")
        cg_id = cg_data.get("id") or cg_data.get("user", {}).get("id")
        assert cg_token is not None
        assert cg_id is not None

        # 3. Caregiver links patient via email with dynamic age & relationship
        link_res = await ac.post(
            "/api/v1/users/link-patient",
            headers={"Authorization": f"Bearer {cg_token}"},
            json={
                "email": "bob@example.com",
                "age": 68,
                "relationship": "Father",
                "notes": "Take after meals",
                "assigned_medicines": ["Metformin 500mg"],
            },
        )
        assert link_res.status_code == 200, link_res.text
        assert "successfully linked" in link_res.json()["message"]
        assert link_res.json()["patient"]["relationship"] == "Father"

        # 4. Caregiver fetches linked patients
        patients_list_res = await ac.get(
            "/api/v1/users/patients",
            headers={"Authorization": f"Bearer {cg_token}"},
        )
        assert patients_list_res.status_code == 200, patients_list_res.text
        pts = patients_list_res.json()
        assert len(pts) >= 1
        assert any(p["email"] == "bob@example.com" for p in pts)

        # 5. Caregiver views patient's medication schedule
        cg_sched_res = await ac.get(
            f"/api/v1/adherence/schedules?patient_id={patient_id}",
            headers={"Authorization": f"Bearer {cg_token}"},
        )
        assert cg_sched_res.status_code == 200, cg_sched_res.text
        scheds = cg_sched_res.json()
        assert len(scheds) >= 1
        assert scheds[0]["medicine_name"] == "Metformin"

        # 6. Register an Admin
        admin_res = await ac.post(
            "/api/v1/auth/register",
            json={
                "username": "admin_super",
                "email": "admin@example.com",
                "password": "Password123!",
                "full_name": "Super Admin",
                "role": "ADMIN",
            },
        )
        assert admin_res.status_code == 201, admin_res.text
        a_data = admin_res.json()
        admin_token = a_data.get("access_token") or a_data.get("tokens", {}).get("access_token")
        assert admin_token is not None

        # 7. Admin lists all registered users
        admin_users_res = await ac.get(
            "/api/v1/users/",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert admin_users_res.status_code == 200, admin_users_res.text
        all_users = admin_users_res.json()
        assert len(all_users) >= 3

        # 8. Admin updates user role (e.g. promotes bob to caregiver)
        role_patch_res = await ac.patch(
            f"/api/v1/users/{patient_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"role": "caregiver"},
        )
        assert role_patch_res.status_code == 200, role_patch_res.text
        assert role_patch_res.json()["role"] == "caregiver"

        # 9. Admin suspends account and then reactivates
        status_patch_res = await ac.patch(
            f"/api/v1/users/{patient_id}/status",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"is_active": False},
        )
        assert status_patch_res.status_code == 200, status_patch_res.text
        assert status_patch_res.json()["is_active"] is False

        reactivate_res = await ac.patch(
            f"/api/v1/users/{patient_id}/status",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"is_active": True},
        )
        assert reactivate_res.status_code == 200, reactivate_res.text
        assert reactivate_res.json()["is_active"] is True

        # 10. Admin assigns patient to caregiver directly
        assign_res = await ac.post(
            "/api/v1/users/assign-patient",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "caregiver_id": cg_id,
                "patient_id": patient_id,
            },
        )
        assert assign_res.status_code in [201, 400, 409]
