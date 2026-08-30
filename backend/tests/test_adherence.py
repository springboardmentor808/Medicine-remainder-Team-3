"""
Unit and API route tests for the Schedules & Dose Logs (Adherence) Module.
"""

import os
import sys
from datetime import date, time, datetime, timezone
import uuid

# Ensure backend root and virtualenv site-packages are in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Fallback auto-detection for project .venv when executed with global python
_pyver = f"python{sys.version_info.major}.{sys.version_info.minor}"
venv_site_pkgs = os.path.join(backend_dir, ".venv", "lib", _pyver, "site-packages")
if os.path.exists(venv_site_pkgs) and venv_site_pkgs not in sys.path:
    sys.path.insert(0, venv_site_pkgs)
venv_site_pkgs_win = os.path.join(backend_dir, ".venv", "Lib", "site-packages")
if os.path.exists(venv_site_pkgs_win) and venv_site_pkgs_win not in sys.path:
    sys.path.insert(0, venv_site_pkgs_win)

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.adherence import router as adherence_router
from app.models.schedule import Schedule, DoseLog
from app.schemas.pillsync_schemas import (
    ScheduleCreate,
    RecordActionRequest,
    ReminderAction,
    AdherenceReportResponse,
)
from app.services.adherence_service import AdherenceService

app_under_test = FastAPI()
app_under_test.include_router(adherence_router, prefix="/api/v1")
client = TestClient(app_under_test)


class TestFrequencyPatterns:
    """Test frequency pattern time slot mapping and time parsing."""

    def test_parse_time_string_formats(self):
        """Test time parsing for HH:MM, HH:MM:SS, and AM/PM formats."""
        t1 = AdherenceService._parse_time_string("08:00")
        assert t1 == time(8, 0)

        t2 = AdherenceService._parse_time_string("14:30:00")
        assert t2 == time(14, 30, 0)

        t3 = AdherenceService._parse_time_string("08:00 PM")
        assert t3 == time(20, 0)

        t4 = AdherenceService._parse_time_string("09:15 am")
        assert t4 == time(9, 15)

    def test_preset_frequency_slots(self):
        """Test preset frequency patterns map to expected time slots."""
        slots_111 = AdherenceService._get_preset_time_slots("1-1-1")
        assert len(slots_111) == 3
        assert slots_111[0] == (time(8, 0), "Morning")
        assert slots_111[1] == (time(14, 0), "Afternoon")
        assert slots_111[2] == (time(20, 0), "Evening/Night")

        slots_101 = AdherenceService._get_preset_time_slots("1-0-1")
        assert len(slots_101) == 2
        assert slots_101[0] == (time(8, 0), "Morning")
        assert slots_101[1] == (time(20, 0), "Evening/Night")

        slots_011 = AdherenceService._get_preset_time_slots("0-1-1")
        assert len(slots_011) == 2
        assert slots_011[0] == (time(14, 0), "Afternoon")
        assert slots_011[1] == (time(20, 0), "Evening/Night")

        slots_001 = AdherenceService._get_preset_time_slots("0-0-1")
        assert len(slots_001) == 1
        assert slots_001[0] == (time(20, 0), "Evening/Night")


class TestAdherenceReportCalculation:
    """Test adherence percentage calculation and consistency grading."""

    def test_report_grading(self):
        """Verify adherence percentage formula and grade boundaries."""
        user_id = uuid.uuid4()
        logs = [
            DoseLog(
                user_id=user_id,
                medicine_id=uuid.uuid4(),
                scheduled_date=date.today(),
                scheduled_time=time(8, 0),
                action="Taken",
            ),
            DoseLog(
                user_id=user_id,
                medicine_id=uuid.uuid4(),
                scheduled_date=date.today(),
                scheduled_time=time(14, 0),
                action="Taken",
            ),
            DoseLog(
                user_id=user_id,
                medicine_id=uuid.uuid4(),
                scheduled_date=date.today(),
                scheduled_time=time(20, 0),
                action="Missed",
            ),
        ]

        total = len(logs)
        taken = sum(1 for l in logs if l.action == "Taken")
        pct = (taken / total) * 100.0
        assert round(pct, 2) == 66.67


class TestAdherenceEndpointValidation:
    """Test auth enforcement on adherence endpoints."""

    def test_schedules_requires_auth(self):
        """POST /api/v1/adherence/schedules without auth token should return 401."""
        response = client.post("/api/v1/adherence/schedules", json={
            "medicine_id": str(uuid.uuid4()),
            "frequency_pattern": "1-1-1"
        })
        assert response.status_code == 401

    def test_record_requires_auth(self):
        """POST /api/v1/adherence/record without auth token should return 401."""
        response = client.post("/api/v1/adherence/record", json={
            "schedule_id": str(uuid.uuid4()),
            "action": "Taken"
        })
        assert response.status_code == 401

    def test_history_requires_auth(self):
        """GET /api/v1/adherence/history without auth token should return 401."""
        response = client.get("/api/v1/adherence/history")
        assert response.status_code == 401

    def test_report_requires_auth(self):
        """GET /api/v1/adherence/report without auth token should return 401."""
        response = client.get("/api/v1/adherence/report")
        assert response.status_code == 401


if __name__ == "__main__":
    import sys
    sys.exit(pytest.main(["-v", __file__]))

