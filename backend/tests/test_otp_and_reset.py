"""
Unit and Integration tests for Redis-backed OTP and Single-Use Password Reset Token workflows.
"""

import pytest
from fastapi import HTTPException
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.otp_service import OTPService


@pytest.mark.asyncio
async def test_otp_generation_and_verification_flow():
    """Test OTP creation, matching, and single-use burn."""
    test_email = "patient_otp_test@pillsync.app"

    # 1. Generate OTP
    otp = await OTPService.generate_otp(test_email, purpose="VERIFY")
    assert len(otp) == 6
    assert otp.isdigit()

    # 2. Verify with invalid OTP fails with HTTPException(400)
    with pytest.raises(HTTPException) as exc_info:
        await OTPService.verify_otp(test_email, "000000", purpose="VERIFY")
    assert exc_info.value.status_code == 400

    # 3. Verify with correct OTP succeeds
    assert await OTPService.verify_otp(test_email, otp, purpose="VERIFY") is True

    # 4. Verifying again fails (OTP is burned) with HTTPException(400)
    with pytest.raises(HTTPException) as exc_info:
        await OTPService.verify_otp(test_email, otp, purpose="VERIFY")
    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_password_reset_token_flow():
    """Test cryptographic single-use password reset token lifecycle."""
    import uuid
    dummy_user_id = uuid.uuid4()
    test_email = "reset_user@pillsync.app"

    # 1. Create single-use token
    token = await OTPService.create_password_reset_token(dummy_user_id, test_email)
    assert len(token) >= 40

    # 2. Verify and consume token
    consumed_id, consumed_email = await OTPService.verify_and_consume_reset_token(token)
    assert consumed_id == str(dummy_user_id)
    assert consumed_email == test_email

    # 3. Replay attack fails (token was burned) with HTTPException(400)
    with pytest.raises(HTTPException) as exc_info:
        await OTPService.verify_and_consume_reset_token(token)
    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_send_and_verify_otp_endpoint_api_flow(monkeypatch):
    """Test full HTTP API roundtrip for send-otp and verify-otp using the OTP created by /send-otp."""
    from app.services.email_service import EmailService

    test_email = "api_test_user@pillsync.app"
    captured_otp = {}
    original_send = EmailService.send_otp_email

    async def mock_send_otp_email(to_email: str, otp_code: str, purpose: str = "VERIFICATION"):
        captured_otp["code"] = otp_code
        return await original_send(to_email, otp_code, purpose=purpose)

    monkeypatch.setattr(EmailService, "send_otp_email", mock_send_otp_email)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. POST /api/v1/auth/send-otp
        send_res = await client.post(
            "/api/v1/auth/send-otp",
            json={
                "email": test_email,
                "destination": test_email,
                "channel": "email",
                "purpose": "VERIFY",
            },
        )
        assert send_res.status_code == 200
        send_data = send_res.json()
        assert send_data.get("status") == "success"

        # Use the actual OTP dispatched by /send-otp
        otp_code = captured_otp.get("code")
        assert otp_code is not None
        assert len(otp_code) == 6
        assert otp_code.isdigit()

        # 2. POST /api/v1/auth/verify-otp with wrong code -> 400
        fail_res = await client.post(
            "/api/v1/auth/verify-otp",
            json={"email": test_email, "otp": "000000", "purpose": "VERIFY"},
        )
        assert fail_res.status_code == 400

        # 3. POST /api/v1/auth/verify-otp with valid code from /send-otp -> 200
        success_res = await client.post(
            "/api/v1/auth/verify-otp",
            json={"email": test_email, "otp": otp_code, "purpose": "VERIFY"},
        )
        assert success_res.status_code == 200
        success_data = success_res.json()
        assert success_data.get("verified") is True
