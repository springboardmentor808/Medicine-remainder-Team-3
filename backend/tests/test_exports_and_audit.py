"""
Unit and Integration tests for Role-Scoped Exports and Live Admin Audit Logs.
"""

import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.models.user import UserRole


@pytest.mark.asyncio
async def test_role_scoped_exports_and_audit_logs():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Register a Patient
        p_res = await client.post(
            "/api/v1/auth/register",
            json={
                "username": "export_patient",
                "email": "export_patient@example.com",
                "password": "Password123!",
                "full_name": "Export Patient",
                "role": "PATIENT",
            },
        )
        assert p_res.status_code == 201
        p_data = p_res.json()
        p_token = p_data.get("access_token") or p_data.get("tokens", {}).get("access_token")
        p_id = p_data.get("id") or p_data.get("user", {}).get("id")

        # Patient adds a medication
        med_res = await client.post(
            "/api/v1/medicines/",
            headers={"Authorization": f"Bearer {p_token}"},
            json={
                "name": "Dolo 650",
                "dosage": "650mg",
                "dosage_form": "Tablet",
                "initial_quantity": 30,
                "daily_frequency": 2,
                "disease_category": "Pain Management",
            },
        )
        assert med_res.status_code == 201

        # 2. Register a Caregiver
        cg_res = await client.post(
            "/api/v1/auth/register",
            json={
                "username": "export_caregiver",
                "email": "export_caregiver@example.com",
                "password": "Password123!",
                "full_name": "Export Caregiver",
                "role": "CAREGIVER",
            },
        )
        assert cg_res.status_code == 201
        cg_data = cg_res.json()
        cg_token = cg_data.get("access_token") or cg_data.get("tokens", {}).get("access_token")

        # Caregiver links the patient
        link_res = await client.post(
            "/api/v1/users/link-patient",
            headers={"Authorization": f"Bearer {cg_token}"},
            json={
                "email": "export_patient@example.com",
                "age": 62,
                "relationship": "Parent",
            },
        )
        assert link_res.status_code == 200

        # 3. Test Caregiver Scoped Exports
        # 3a. Caregiver patients CSV
        cg_csv = await client.get(
            "/api/v1/export/caregiver/patients/csv",
            headers={"Authorization": f"Bearer {cg_token}"},
        )
        assert cg_csv.status_code == 200
        assert "text/csv" in cg_csv.headers["content-type"]
        assert "ASSIGNED PATIENTS MEDICATION ROSTER" in cg_csv.text
        assert "Export Patient,export_patient@example.com,Dolo 650" in cg_csv.text

        # 3b. Caregiver single patient CSV filter
        cg_single_csv = await client.get(
            f"/api/v1/export/caregiver/patients/csv?patient_id={p_id}",
            headers={"Authorization": f"Bearer {cg_token}"},
        )
        assert cg_single_csv.status_code == 200
        assert "Export Patient" in cg_single_csv.text

        # 3c. Caregiver patients PDF
        cg_pdf = await client.get(
            "/api/v1/export/caregiver/patients/pdf",
            headers={"Authorization": f"Bearer {cg_token}"},
        )
        assert cg_pdf.status_code == 200
        assert cg_pdf.headers["content-type"] == "application/pdf"
        assert len(cg_pdf.content) > 500

        # 3d. Caregiver combined CSV
        cg_comb_csv = await client.get(
            "/api/v1/export/caregiver/combined/csv",
            headers={"Authorization": f"Bearer {cg_token}"},
        )
        assert cg_comb_csv.status_code == 200

        # 3e. Caregiver combined PDF
        cg_comb_pdf = await client.get(
            "/api/v1/export/caregiver/combined/pdf",
            headers={"Authorization": f"Bearer {cg_token}"},
        )
        assert cg_comb_pdf.status_code == 200
        assert cg_comb_pdf.headers["content-type"] == "application/pdf"

        # 4. Register an Admin
        adm_res = await client.post(
            "/api/v1/auth/register",
            json={
                "username": "export_admin",
                "email": "export_admin@example.com",
                "password": "Password123!",
                "full_name": "Export Admin",
                "role": "ADMIN",
            },
        )
        assert adm_res.status_code == 201
        adm_data = adm_res.json()
        adm_token = adm_data.get("access_token") or adm_data.get("tokens", {}).get("access_token")

        # 4a. Admin master CSV
        adm_csv = await client.get(
            "/api/v1/export/admin/all/csv",
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert adm_csv.status_code == 200
        assert "text/csv" in adm_csv.headers["content-type"]
        assert "MASTER USER REGISTRY" in adm_csv.text
        assert "User ID,Username,Email" in adm_csv.text

        # 5. Live Admin Audit Logs
        audit_res = await client.get(
            "/api/v1/analytics/audit-logs",
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert audit_res.status_code == 200
        audit_data = audit_res.json()
        assert isinstance(audit_data, list)
        assert len(audit_data) >= 3
        actions = [log["action"] for log in audit_data]
        assert any("User Registered" in act for act in actions)
        assert any("Prescription Added" in act for act in actions)
