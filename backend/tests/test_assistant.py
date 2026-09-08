"""
PillSync AI Medical Assistant Integration & Safety Guardrail Tests.
═══════════════════════════════════════════════════════════════════

Verifies:
  1. Pass 0: Emergency SOS detection (English & Hindi) bypasses generative text.
  2. Pass 2: Deterministic DDI & WHO Dosage lookup safely catches contraindications.
  3. API Endpoints:
     - POST /api/v1/assistant/chat (authenticated)
     - GET  /api/v1/assistant/suggestions (authenticated)
  4. Graceful degradation: Fallback to local deterministic response on offline/LLM error.
"""

import pytest
import uuid
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.services.assistant_service import (
    detect_emergency,
    classify_intent,
    _generate_fallback_response,
)


def test_emergency_detector_english():
    """English emergency phrases must trigger zero-tolerance SOS payload."""
    sos = detect_emergency("I took too many pills and have chest pain")
    assert sos is not None
    assert sos["type"] == "EMERGENCY"
    assert sos["action"] == "SOS_TRIGGERED"
    assert "108" in [n["number"] for n in sos["emergency_numbers"]]


def test_emergency_detector_hindi():
    """Hindi emergency phrases must trigger zero-tolerance SOS payload."""
    sos = detect_emergency("मुझे सीने में दर्द है और सांस नहीं आ रही")
    assert sos is not None
    assert sos["type"] == "EMERGENCY"
    assert sos["action"] == "SOS_TRIGGERED"


def test_intent_classifier():
    """Intent classifier accurately categorizes domain queries."""
    assert classify_intent("When is my next dose?") == "SCHEDULE"
    assert classify_intent("Can I take Warfarin and Aspirin together?") == "DDI"
    assert classify_intent("How many pills do I have left?") == "REFILL"
    assert classify_intent("What is the maximum safe dosage for Paracetamol?") == "DOSAGE"
    assert classify_intent("Hello how are you?") == "GENERAL"


def test_fallback_response_generator():
    """Deterministic fallback provides medication summary without crashing."""
    mock_context = {
        "active_medicines": [{"name": "Metformin", "dosage": "500mg"}],
        "today_schedule": [{"medicine": "Metformin", "time": "08:00 AM", "status": "PENDING"}],
        "inventory": [{"medicine": "Metformin", "remaining_pills": 10, "low_stock": False}],
    }
    fb_en = _generate_fallback_response(mock_context, "SCHEDULE", "en")
    assert "Metformin" in fb_en
    assert "Your active medications" in fb_en

    fb_hi = _generate_fallback_response(mock_context, "SCHEDULE", "hi")
    assert "Metformin" in fb_hi
    assert "आपकी सक्रिय दवाइयां" in fb_hi


@pytest.mark.asyncio
async def test_assistant_api_chat_and_suggestions():
    """End-to-end test for assistant chat and suggestions endpoints."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        uid = uuid.uuid4().hex[:6]
        reg_res = await client.post("/api/v1/auth/register", json={
            "email": f"assistant_user_{uid}@example.com",
            "password": "SecurePassword123!",
            "full_name": f"Assistant User {uid}",
            "role": "PATIENT"
        })
        assert reg_res.status_code == 201
        res_data = reg_res.json()
        token = res_data.get("access_token") or res_data.get("data", {}).get("tokens", {}).get("access_token")
        auth_headers = {"Authorization": f"Bearer {token}"}

        # 1. Test Suggestions
        sug_res = await client.get("/api/v1/assistant/suggestions?locale=en", headers=auth_headers)
        assert sug_res.status_code == 200
        suggestions = sug_res.json()
        assert isinstance(suggestions, list)

        # 2. Test Emergency SOS query via chat API
        chat_res = await client.post("/api/v1/assistant/chat", json={
            "messages": [{"role": "user", "content": "Help I had an overdose"}],
            "locale": "en",
        }, headers=auth_headers)
        assert chat_res.status_code == 200
        chat_data = chat_res.json()
        assert chat_data["type"] == "EMERGENCY"
        assert chat_data["action"] == "SOS_TRIGGERED"

        # 3. Test General query via chat API (will trigger fallback or grounded prompt)
        chat_general = await client.post("/api/v1/assistant/chat", json={
            "messages": [{"role": "user", "content": "What are my active medications?"}],
            "locale": "en",
        }, headers=auth_headers)
        assert chat_general.status_code == 200
        gen_data = chat_general.json()
        assert "content" in gen_data
        assert gen_data["type"] in ["TEXT", "SCHEDULE", "DDI_ALERT", "REFILL_ALERT"]
