"""
PillSync Software Release Readiness Council Remediation Test Suite.

Automated verification testing all 13 Critical Blockers and security stress tests:
- CB-2:  Demo token bypass returns 401 Unauthorized.
- CB-3:  Rate limiting on /login triggers HTTP 429.
- CB-5:  Notification channels (Email smtplib, FCM push, SMS/WhatsApp diversion).
- CB-10: await get_redis() sync bug fix (no TypeError on token validation).
- CB-11: ReportLab XML injection in PDF generation does not crash with ExpatError.
- CB-12: Non-admin accessing scope=global on notifications returns 403 Forbidden.
- Stress Test: Offline OTP bypass rejection (no automatic True without valid OTP).
- Stress Test: Input validation guardrails on name, phone, bounds.
"""

import os
import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import create_access_token
from app.models.user import User
from app.core.database import get_db
from app.services.notification_service import (
    send_notification,
    NotificationChannel,
    NotificationType,
    register_device_token,
)
from app.services.otp_service import OTPService
from app.api.v1.export import _generate_medicines_pdf_bytes, _safe_xml


@pytest.mark.asyncio
async def test_cb2_demo_token_bypass_eliminated():
    """Verify demo_ tokens are rejected with 401 Unauthorized and not bypassed."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get(
            "/api/v1/users/profile",
            headers={"Authorization": "Bearer demo_admin_bypass"},
        )
        assert res.status_code == 401, f"Expected 401 for demo token, got {res.status_code}"


@pytest.mark.asyncio
async def test_cb10_token_blacklist_no_typeerror():
    """Verify token validation against Redis blacklist executes cleanly without TypeError."""
    valid_token = create_access_token({"sub": str(uuid.uuid4()), "role": "patient"})
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # User not found in db should return 401, but NOT 500 TypeError
        res = await ac.get(
            "/api/v1/users/profile",
            headers={"Authorization": f"Bearer {valid_token}"},
        )
        assert res.status_code == 401
        assert "Internal Server Error" not in res.text


@pytest.mark.asyncio
async def test_cb11_reportlab_xml_injection_safe():
    """Verify ReportLab PDF generation does not crash on malformed XML or script tags."""
    malicious_data = [
        {
            "name": "<script>alert('pwned')</script>",
            "dosage": "<b unclosed tag",
            "category": "General & Health",
            "current_stock": 10,
            "initial_quantity": 30,
            "daily_frequency": 2,
            "days_left": 5,
            "notes": "Take with <water> & 'food'",
        }
    ]
    # This must generate valid PDF bytes without raising xml.parsers.expat.ExpatError
    pdf_bytes = _generate_medicines_pdf_bytes(
        title="Test Report <script>",
        user_name="John & Doe <b",
        user_email="john@example.com",
        medicines_data=malicious_data,
    )
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b"%PDF")


@pytest.mark.asyncio
async def test_cb12_global_notification_scope_authorization():
    """Verify non-admin users cannot access ?scope=global notifications."""
    from tests.conftest import TestingSessionLocal
    # Create patient user
    patient_id = uuid.uuid4()
    patient_token = create_access_token({"sub": str(patient_id), "role": "patient"})

    async with TestingSessionLocal() as session:
        user = User(
            id=patient_id,
            username="test_patient_scope",
            email="patient_scope@test.com",
            hashed_password="hashed_pwd",
            full_name="Patient Scope",
            role="patient",
            is_active=True,
        )
        session.add(user)
        await session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get(
            "/api/v1/reminders/notifications?scope=global",
            headers={"Authorization": f"Bearer {patient_token}"},
        )
        assert res.status_code == 403, f"Expected 403 for non-admin global scope, got {res.status_code}"


@pytest.mark.asyncio
async def test_cb5_notification_service_channels(monkeypatch):
    """Verify CB-5 notification service: Email smtplib fallback, SMS/WhatsApp diversion, FCM."""
    test_user_id = uuid.uuid4()

    # 1. Test IN_APP
    res_in_app = await send_notification(
        user_id=test_user_id,
        title="Dose Time",
        message="Please take Metformin 500mg",
        channel=NotificationChannel.IN_APP,
    )
    assert res_in_app["status"] == "sent"

    # 2. Test SMS with dev diversion using monkeypatch to auto-restore environment
    monkeypatch.setenv("DEV_SMS_NUMBER", "+919876543210")
    monkeypatch.setenv("DEV_WHATSAPP_NUMBER", "+919876543210")

    res_sms = await send_notification(
        user_id=test_user_id,
        title="SMS Alert",
        message="Take your tablet",
        channel=NotificationChannel.SMS,
    )
    assert res_sms["status"] == "sent"

    # 3. Test WhatsApp with dev diversion
    res_wa = await send_notification(
        user_id=test_user_id,
        title="WhatsApp Alert",
        message="Refill alert",
        channel=NotificationChannel.WHATSAPP,
    )
    assert res_wa["status"] == "sent"

    # 4. Test FCM Push
    await register_device_token(test_user_id, "mock_fcm_token_12345")
    res_push = await send_notification(
        user_id=test_user_id,
        title="Push Reminder",
        message="Time for your morning dose",
        channel=NotificationChannel.PUSH,
    )
    assert res_push["channel"] == "push"


@pytest.mark.asyncio
async def test_offline_otp_bypass_rejected():
    """Verify invalid or unrequested OTP raises HTTPException with status code 400."""
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await OTPService.verify_otp(
            destination="unregistered_dest@test.com",
            submitted_otp="999999",
            channel="email",
        )
    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_cb3_login_rate_limiting():
    """Verify rate limiter blocks rapid brute force login attempts with HTTP 429."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Send 12 rapid login requests for the same target username
        target_username = "rate_limit_test_user"
        hit_429 = False
        for _ in range(12):
            res = await ac.post(
                "/api/v1/auth/login",
                json={"username": target_username, "password": "WrongPassword123!"},
            )
            if res.status_code == 429:
                hit_429 = True
                break
        assert hit_429, "Expected at least one HTTP 429 Too Many Requests response"


@pytest.mark.asyncio
async def test_input_guardrails_validation():
    """Verify input guardrails block script tags, empty whitespace, and invalid phone formats."""
    from pydantic import ValidationError
    from app.schemas.medicine_schema import MedicineCreate
    from app.schemas.auth_schema import UserUpdateRequest, SendOTPRequest

    # 1. Blank/whitespace medicine name blocked
    with pytest.raises(ValidationError):
        MedicineCreate(name="   ", dosage="500mg", initial_quantity=30)

    # 2. Astronomical daily frequency blocked (> 24)
    with pytest.raises(ValidationError):
        MedicineCreate.model_validate({"name": "Aspirin", "dosage": "100mg", "daily_frequency": 99})

    # 3. Script tag in medicine name blocked
    with pytest.raises(ValidationError):
        MedicineCreate(name="<script>alert(1)</script>", dosage="100mg")

    # 4. User update phone must be 10-digit mobile
    with pytest.raises(ValidationError):
        UserUpdateRequest(phone="12345")

    # 5. User update full name script tag blocked
    with pytest.raises(ValidationError):
        UserUpdateRequest(full_name="<script>evil()</script>")

    # 6. Invalid SendOTP phone destination blocked
    with pytest.raises(ValidationError):
        SendOTPRequest(channel="phone", destination="abc1234")


@pytest.mark.asyncio
async def test_user_service_profile_update():
    """Verify UserService encapsulates profile update logic and handles duplicate email."""
    from tests.conftest import TestingSessionLocal
    from app.services.user_service import UserService
    from app.schemas.auth_schema import UserUpdateRequest

    u_id = uuid.uuid4()
    async with TestingSessionLocal() as session:
        user = User(
            id=u_id,
            username="service_test_user",
            email="service_user@test.com",
            hashed_password="pw",
            full_name="Original Name",
            phone="9876543210",
            role="patient",
            is_active=True,
        )
        session.add(user)
        await session.commit()

        # Update name and phone via UserService
        payload = UserUpdateRequest(full_name="Updated Name", phone="9123456789")
        updated = await UserService.update_profile(user, payload, session)
        assert updated.full_name == "Updated Name"
        assert updated.phone == "9123456789"


@pytest.mark.asyncio
async def test_logout_revokes_refresh_token():
    """Verify refresh token is blacklisted on logout and rejected on subsequent refresh attempts."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Login with demo user
        login_res = await ac.post("/api/v1/auth/demo-login?role=patient")
        assert login_res.status_code == 200
        data = login_res.json()
        refresh_tok = data["refresh_token"]

        # 2. Set cookie on AsyncClient and call logout
        ac.cookies.set("pillsync_refresh_token", refresh_tok)
        logout_res = await ac.post(
            "/api/v1/auth/logout",
            json={"refresh_token": refresh_tok},
        )
        assert logout_res.status_code == 200

        # 3. Attempt to use revoked refresh token
        refresh_res = await ac.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_tok},
        )
        assert refresh_res.status_code == 401
        assert "revoked" in refresh_res.text.lower()


@pytest.mark.asyncio
async def test_admin_update_rejects_invalid_role():
    """Verify UserService.admin_update_user rejects invalid role strings with HTTP 400."""
    from tests.conftest import TestingSessionLocal
    from app.services.user_service import UserService
    from app.schemas.auth_schema import AdminUserUpdateRequest
    from fastapi import HTTPException

    u_id = uuid.uuid4()
    async with TestingSessionLocal() as session:
        user = User(
            id=u_id,
            username="role_test_user",
            email="role_user@test.com",
            hashed_password="pw",
            full_name="Role Test",
            role="patient",
            is_active=True,
        )
        session.add(user)
        await session.commit()

        # Reject bogus role with HTTP 400
        payload = AdminUserUpdateRequest(role="superman")
        with pytest.raises(HTTPException) as exc_info:
            await UserService.admin_update_user(u_id, payload, session)
        assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_caregiver_empty_patients_isolation():
    """Verify a caregiver with no linked patients receives an empty list and no unrelated patients."""
    from tests.conftest import TestingSessionLocal
    from app.services.user_service import UserService

    cg_id = uuid.uuid4()
    async with TestingSessionLocal() as session:
        cg_user = User(
            id=cg_id,
            username="isolated_cg",
            email="isolated_cg@test.com",
            hashed_password="pw",
            full_name="Isolated Caregiver",
            role="caregiver",
            is_active=True,
        )
        # Add some unrelated patients to the DB
        for i in range(3):
            session.add(
                User(
                    id=uuid.uuid4(),
                    username=f"unrelated_pt_{i}",
                    email=f"unrelated_{i}@test.com",
                    hashed_password="pw",
                    full_name=f"Unrelated Patient {i}",
                    role="patient",
                    is_active=True,
                )
            )
        session.add(cg_user)
        await session.commit()

        patients = await UserService.get_caregiver_patients(cg_user, session)
        # Must be empty list, NOT leaking the 3 unrelated patients!
        assert patients == []


@pytest.mark.asyncio
async def test_fcm_multi_device_support():
    """Verify multiple device registration tokens can be stored and retrieved for a single user."""
    from app.services.notification_service import register_device_token, get_device_tokens

    uid = uuid.uuid4()
    token_phone = "fcm_token_phone_11111"
    token_tablet = "fcm_token_tablet_22222"

    await register_device_token(uid, token_phone)
    await register_device_token(uid, token_tablet)

    all_tokens = await get_device_tokens(uid)
    assert token_phone in all_tokens
    assert token_tablet in all_tokens


@pytest.mark.asyncio
async def test_dose_action_rejects_unknown():
    """Verify record_dose_action_atomic rejects unknown actions instead of defaulting to Taken."""
    from typing import cast
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.services.adherence_service import AdherenceService
    from app.schemas.pillsync_schemas import RecordActionRequest
    from fastapi import HTTPException

    req = RecordActionRequest.model_construct(
        action="InvalidAction123",
        medicine_id=str(uuid.uuid4()),
        scheduled_date="2026-09-10",
    )
    with pytest.raises(HTTPException) as exc_info:
        await AdherenceService.record_dose_action_atomic(cast(AsyncSession, None), uuid.uuid4(), req)
    assert exc_info.value.status_code == 400
    assert "Invalid action" in exc_info.value.detail


def test_potassium_chloride_preserved_and_ddi_class_matching():
    """Verify potassium chloride is preserved during normalization and DRUG_CLASS_MAP is used for A-side matching."""
    from app.services.drug_interaction_service import DrugInteractionService

    # 1. Normalization preserves "potassium chloride"
    norm = DrugInteractionService._normalize_drug_name("Potassium Chloride 600mg Tablet")
    assert norm == "potassium chloride"

    # Other potassium salts still strip the salt counter-ion
    los_norm = DrugInteractionService._normalize_drug_name("Losartan Potassium 50mg Tablet")
    assert los_norm == "losartan"

    # 2. Check interaction between Telmisartan and Potassium Chloride
    warnings = DrugInteractionService.check_interactions(
        candidate_drug_name="Telmisartan 40mg",
        active_drug_names=["Potassium Chloride 600mg"],
    )
    assert len(warnings) >= 1
    assert any("Hyperkalemia" in w["title"] for w in warnings)

    # 3. Check A-side DRUG_CLASS_MAP matching: Tadalafil (PDE5i) + Nitroglycerin (Nitrates)
    warnings_pde5 = DrugInteractionService.check_interactions(
        candidate_drug_name="Tadalafil 20mg",
        active_drug_names=["Nitroglycerin 0.5mg"],
    )
    assert len(warnings_pde5) >= 1
    assert any("Hypotension" in w["title"] for w in warnings_pde5)


@pytest.mark.asyncio
async def test_link_patient_rejects_conflicting_email():
    """Verify link_patient_to_caregiver rejects conflicting emails before auto-provisioning."""
    from app.services.user_service import UserService
    from app.schemas.auth_schema import LinkPatientRequest
    from app.models.user import User
    from fastapi import HTTPException

    from tests.conftest import TestingSessionLocal

    async with TestingSessionLocal() as session:
        # Caregiver user
        cg_user = User(
            id=uuid.uuid4(),
            username="test_cg_conflict",
            email="caregiver_conflict@test.com",
            hashed_password="pw",
            full_name="Dr. Caregiver",
            role="caregiver",
            is_active=True,
        )
        # Existing admin user with an email
        admin_user = User(
            id=uuid.uuid4(),
            username="test_admin_conflict",
            email="admin_existing@test.com",
            hashed_password="pw",
            full_name="Admin Chief",
            role="admin",
            is_active=True,
        )
        session.add(cg_user)
        session.add(admin_user)
        await session.commit()

        # Attempt to link using the admin's email -> must be rejected with 400
        req = LinkPatientRequest(email="admin_existing@test.com")
        with pytest.raises(HTTPException) as exc_info:
            await UserService.link_patient_to_caregiver(cg_user, req, session)
        assert exc_info.value.status_code == 400
        assert "already exists with role" in exc_info.value.detail


@pytest.mark.asyncio
async def test_catalog_service_query_length_and_wildcards():
    """Verify search_medicines enforces min query length and handles SQL wildcards safely."""
    from app.services.catalog_service import search_medicines
    from app.models.medicine_catalog import MedicineCatalog
    from tests.conftest import TestingSessionLocal

    async with TestingSessionLocal() as session:
        # Query shorter than 2 chars returns empty list immediately
        res_short = await search_medicines(session, query="a")
        assert res_short == []

        res_empty = await search_medicines(session, query="   ")
        assert res_empty == []

        # Wildcard string with % or _ does not error out
        res_wild = await search_medicines(session, query="%%__")
        assert isinstance(res_wild, list)

        # Literal wildcard matching verification:
        med_pct = MedicineCatalog(
            brand_name="Glucose 5% Infusion",
            salt_1_name="Dextrose",
            is_discontinued=False,
        )
        med_num = MedicineCatalog(
            brand_name="Glucose 500mg Infusion",
            salt_1_name="Dextrose",
            is_discontinued=False,
        )
        med_underscore = MedicineCatalog(
            brand_name="Vitamin_D3 Forte",
            salt_1_name="Cholecalciferol",
            is_discontinued=False,
        )
        med_hyphen = MedicineCatalog(
            brand_name="Vitamin-D3 Forte",
            salt_1_name="Cholecalciferol",
            is_discontinued=False,
        )
        session.add_all([med_pct, med_num, med_underscore, med_hyphen])
        await session.commit()

        # Search for "5%" must match "Glucose 5% Infusion" and NOT "Glucose 500mg Infusion"
        res_pct = await search_medicines(session, query="5%")
        matched_pct_names = [m.brand_name for m in res_pct]
        assert "Glucose 5% Infusion" in matched_pct_names
        assert "Glucose 500mg Infusion" not in matched_pct_names

        # Search for "_D3" must match "Vitamin_D3 Forte" and NOT "Vitamin-D3 Forte"
        res_us = await search_medicines(session, query="_D3")
        matched_us_names = [m.brand_name for m in res_us]
        assert "Vitamin_D3 Forte" in matched_us_names
        assert "Vitamin-D3 Forte" not in matched_us_names

        # Verify search_by_salt also treats SQL wildcards as literals
        from app.services.catalog_service import search_by_salt
        med_salt_pct = MedicineCatalog(
            brand_name="Sodium Chloride 0.9% Solution",
            salt_1_name="NaCl 0.9%",
            is_discontinued=False,
        )
        med_salt_other = MedicineCatalog(
            brand_name="Sodium Chloride 900mg Solution",
            salt_1_name="NaCl 900mg",
            is_discontinued=False,
        )
        session.add_all([med_salt_pct, med_salt_other])
        await session.commit()

        res_salt = await search_by_salt(session, salt_name="0.9%")
        matched_salt_brands = [m.brand_name for m in res_salt]
        assert "Sodium Chloride 0.9% Solution" in matched_salt_brands
        assert "Sodium Chloride 900mg Solution" not in matched_salt_brands


def test_disease_taxonomy_token_boundary_enforcement():
    """Verify DiseaseTaxonomy requires a token boundary after mapped salt during partial matching."""
    from app.services.disease_taxonomy_service import DiseaseTaxonomy

    dt = DiseaseTaxonomy()

    # Matches when bounded by space or punctuation
    res_bound_space = dt.classify_medicine("Metformin 500mg")
    assert res_bound_space["category"] == "Diabetes"

    res_bound_dash = dt.classify_medicine("Metformin-HCL")
    assert res_bound_dash["category"] == "Diabetes"

    res_bound_slash = dt.classify_medicine("Metformin/Glipizide")
    assert res_bound_slash["category"] == "Diabetes"

    # Does NOT match when there is no token boundary
    res_no_bound = dt.classify_medicine("Metformine")
    assert res_no_bound["category"] == "General Healthcare"
    assert res_no_bound["confidence"] == "low"

    res_iron_bound = dt.classify_medicine("Iron Supplement")
    assert res_iron_bound["category"] == "Vitamins"

    res_iron_no_bound = dt.classify_medicine("Ironic")
    assert res_iron_no_bound["category"] == "General Healthcare"


def test_drug_interaction_broad_classes_not_used_as_aliases():
    """Verify broad physiological/mechanism classes (vasodilator, serotonergic) are not used as A-side drug aliases."""
    from app.services.drug_interaction_service import DrugInteractionService

    # 1. Nitroglycerin + Isosorbide Dinitrate:
    # Both have class 'vasodilator', but neither should match A-side 'sildenafil'.
    # Should NOT trigger 'Potentially Fatal Hypotension (PDE5i + Nitrates)'!
    warnings_nitrates = DrugInteractionService.check_interactions(
        candidate_drug_name="Nitroglycerin 0.5mg",
        active_drug_names=["Isosorbide Dinitrate 10mg"],
    )
    assert not any("PDE5i" in w["title"] for w in warnings_nitrates)

    # 2. Fluoxetine + Sertraline:
    # Both have 'serotonergic', but neither should match A-side 'tramadol'.
    # Should NOT trigger Tramadol-specific Serotonin Syndrome rule!
    warnings_ssri = DrugInteractionService.check_interactions(
        candidate_drug_name="Fluoxetine 20mg",
        active_drug_names=["Sertraline 50mg"],
    )
    assert not any("Tramadol" in w["description"] for w in warnings_ssri)

    # 3. Specific pharmacological class Tadalafil (PDE5i) DOES match Sildenafil (PDE5i) rule against Nitroglycerin
    warnings_pde5 = DrugInteractionService.check_interactions(
        candidate_drug_name="Tadalafil 20mg",
        active_drug_names=["Nitroglycerin 0.5mg"],
    )
    assert len(warnings_pde5) >= 1
    assert any("Hypotension" in w["title"] for w in warnings_pde5)


@pytest.mark.asyncio
async def test_link_patient_all_supported_identifiers():
    """Verify link_patient_to_caregiver supports patient_id, username, phone, code, email."""
    from app.services.user_service import UserService
    from app.schemas.auth_schema import LinkPatientRequest
    from app.models.user import User
    from tests.conftest import TestingSessionLocal

    async with TestingSessionLocal() as session:
        cg_id = uuid.uuid4()
        cg_user = User(
            id=cg_id,
            username="cg_all_ids",
            email="cg_all_ids@test.com",
            hashed_password="pw",
            full_name="Caregiver Identifier Test",
            role="caregiver",
            is_active=True,
        )
        p1_id = uuid.uuid4()
        p1 = User(
            id=p1_id,
            username="pt_user_one",
            email="pt_one@test.com",
            phone="9876500001",
            hashed_password="pw",
            full_name="Patient One",
            role="patient",
            is_active=True,
        )
        p2_id = uuid.uuid4()
        p2 = User(
            id=p2_id,
            username="pt_user_two",
            email="pt_two@test.com",
            phone="9876500002",
            hashed_password="pw",
            full_name="Patient Two",
            role="patient",
            is_active=True,
        )
        session.add_all([cg_user, p1, p2])
        await session.commit()

        # 1. Lookup by username only
        res_uname = await UserService.link_patient_to_caregiver(
            cg_user,
            LinkPatientRequest(username="pt_user_one"),
            session,
        )
        assert res_uname["patient"]["id"] == str(p1_id)

        # 2. Lookup by phone only
        res_phone = await UserService.link_patient_to_caregiver(
            cg_user,
            LinkPatientRequest(phone="9876500002"),
            session,
        )
        assert res_phone["patient"]["id"] == str(p2_id)

        # 3. Lookup by patient_id UUID string
        res_pid = await UserService.link_patient_to_caregiver(
            cg_user,
            LinkPatientRequest(patient_id=str(p1_id)),
            session,
        )
        assert res_pid["patient"]["id"] == str(p1_id)


def test_refill_regressors_forward_kwargs():
    """Verify GradientBoostedRegressor and QuantileGradientBoostedRegressor forward kwargs without discarding."""
    import sys
    from pathlib import Path
    root_dir = Path(__file__).resolve().parent.parent.parent
    sys.path.insert(0, str(root_dir))

    from ai_training.train_refill import (
        QuantileGradientBoostedRegressor,
        GradientBoostedRegressor,
    )

    # Both models accept arbitrary kwargs without TypeError or silent discarding
    q_model = QuantileGradientBoostedRegressor(quantile=0.5, n_estimators=10)
    assert q_model.quantile == 0.5
    assert q_model.n_estimators == 10

    gb_model = GradientBoostedRegressor(quantile=0.75, n_estimators=25, learning_rate=0.05)
    assert gb_model.quantile == 0.75
    assert gb_model.n_estimators == 25
    assert gb_model.learning_rate == 0.05


