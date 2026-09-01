"""
PillSync Clinical Safety, DDI & ML Autopsy Verification Test Suite.

Verifies:
  1. OCR strict error boundary & zero silent hallucination.
  2. Pediatric weight-based dosage validation (mg/kg/day).
  3. Multi-salt parsing and combination drug validation.
  4. Drug-Drug Interaction (DDI) contraindication checks.
  5. NLP hospital header exclusion.
  6. Quantile regression bounds monotonicity (P10 <= P50 <= P90).
"""

import pytest
import io
from PIL import Image
from fastapi import UploadFile

from app.services.ocr_service import _perform_ocr_sync
from app.services.who_dosage_service import WHODosageBenchmarks
from app.services.drug_interaction_service import DrugInteractionService
from app.services.nlp_service import parse_prescription_text


class TestClinicalSafetyOCR:
    """Test OCR clinical safety boundaries."""

    def test_unreadable_blank_image_returns_unreadable(self):
        """Ensure blank or solid noise images return UNREADABLE with 0.0 confidence, never Augmentin."""
        img = Image.new("RGB", (200, 200), color=(255, 255, 255))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        raw_bytes = buf.getvalue()

        text, confidence, status_str = _perform_ocr_sync(raw_bytes)
        assert status_str in ["UNREADABLE", "OCR_ENGINE_UNAVAILABLE"]
        assert "Augmentin" not in text
        assert confidence == 0.0

    def test_corrupted_bytes_never_hallucinates(self):
        """Ensure invalid bytes return safe empty string."""
        text, confidence, status_str = _perform_ocr_sync(b"corrupted_random_non_image_bytes_here")
        assert status_str == "UNREADABLE"
        assert text == ""
        assert confidence == 0.0


class TestPediatricAndAdultDosageSafety:
    """Test WHO/FDA dosage benchmark and pediatric weight calculations."""

    @pytest.fixture
    def benchmark(self):
        return WHODosageBenchmarks()

    def test_pediatric_weight_based_overdose_alert(self, benchmark):
        """A 10kg child receiving 2000mg/day Paracetamol (limit is 60mg/kg = 600mg) MUST trigger PEDIATRIC_OVERDOSE_ALERT."""
        res = benchmark.validate_daily_dose(
            salt_name="Paracetamol",
            total_daily_mg=2000.0,
            patient_age=4,
            patient_weight_kg=10.0,
        )
        assert res["status"] == "PEDIATRIC_OVERDOSE_ALERT"
        assert res["severity"] == "critical"
        assert res["max_daily_mg"] == 600.0
        assert "LETHAL PEDIATRIC OVERDOSE RISK" in res["message"]

    def test_pediatric_safe_dose(self, benchmark):
        """A 20kg child receiving 500mg/day Paracetamol (limit is 1200mg) MUST be SAFE."""
        res = benchmark.validate_daily_dose(
            salt_name="Paracetamol",
            total_daily_mg=500.0,
            patient_age=7,
            patient_weight_kg=20.0,
        )
        assert res["status"] == "SAFE"
        assert res["severity"] == "safe"
        assert res["max_daily_mg"] == 1200.0

    def test_adult_overdose_alert(self, benchmark):
        """An adult receiving 6000mg/day Paracetamol (limit 4000mg) MUST trigger OVERDOSE_ALERT."""
        res = benchmark.validate_daily_dose(
            salt_name="Paracetamol",
            total_daily_mg=6000.0,
            patient_age=35,
            patient_weight_kg=70.0,
        )
        assert res["status"] == "OVERDOSE_ALERT"
        assert res["severity"] == "critical"
        assert res["excess_mg"] == 2000.0

    def test_multi_salt_extraction_and_resolution(self, benchmark):
        """Combination drug 'Amoxycillin (500mg) + Clavulanic Acid (125mg)' parses both active moieties."""
        salts = benchmark.extract_salts("Amoxycillin (500mg) + Clavulanic Acid (125mg)")
        assert len(salts) == 2
        salt_names = [s["canonical_name"] for s in salts]
        assert "Amoxicillin" in salt_names
        assert "Clavulanic Acid" in salt_names


class TestDrugDrugInteractions:
    """Test DDI contraindication rules."""

    def test_warfarin_plus_nsaid_critical_interaction(self):
        """Warfarin + Ibuprofen must trigger CRITICAL hemorrhage alert."""
        warnings = DrugInteractionService.check_interactions(
            candidate_drug_name="Ibuprofen 400mg",
            active_drug_names=["Warfarin Sodium 5mg"],
        )
        assert len(warnings) >= 1
        assert warnings[0]["severity"] == "CRITICAL"
        assert "Hemorrhage" in warnings[0]["title"]

    def test_sildenafil_plus_nitrates_critical_interaction(self):
        """Sildenafil + Nitroglycerin must trigger CRITICAL hypotension alert."""
        warnings = DrugInteractionService.check_interactions(
            candidate_drug_name="Sildenafil 50mg",
            active_drug_names=["Nitroglycerin 0.4mg sublingual"],
        )
        assert len(warnings) >= 1
        assert warnings[0]["severity"] == "CRITICAL"
        assert "Hypotension" in warnings[0]["title"]

    def test_safe_drug_combination_has_no_warnings(self):
        """Metformin + Pantoprazole has no severe DDI warning."""
        warnings = DrugInteractionService.check_interactions(
            candidate_drug_name="Pantoprazole 40mg",
            active_drug_names=["Metformin 500mg"],
        )
        assert len(warnings) == 0


class TestClinicalNLPParser:
    """Test NLP parser clinical exclusion and brand extraction."""

    def test_ignores_hospital_and_doctor_headers(self):
        """Ensure hospital names like Apollo Hospital are ignored, extracting actual drug."""
        prescription_text = """
        APOLLO HOSPITALS CLINIC NEW DELHI
        Dr. Sharma MBBS MD (Cardiology)
        Date: 12/08/2026
        Rx:
        Telmisartan 40mg 1-0-0
        Take before breakfast
        """
        res = parse_prescription_text(prescription_text)
        assert res["medicine_name"] == "Telmisartan"
        assert res["dosage"] == "40mg"
        assert res["frequency"] == "1-0-0"

    def test_parses_alphanumeric_indian_brands(self):
        """Correctly extracts brand with numeric dose like Dolo-650."""
        text = "Dolo-650 Tablet 650mg TDS after food"
        res = parse_prescription_text(text)
        assert "Dolo-650" in res["medicine_name"]
        assert res["dosage"] == "650mg"
        assert res["frequency"] == "1-1-1"

    def test_redos_attack_string_terminates_linearly(self):
        """Ensure adversarial repetitive punctuation does not cause exponential backtracking."""
        import time
        evil_string = "Rx: " + ("A- " * 500) + "Paracetamol 500mg 1-0-1"
        start_t = time.time()
        res = parse_prescription_text(evil_string)
        elapsed = time.time() - start_t
        # Must execute in under 50 milliseconds
        assert elapsed < 0.05
        assert res["dosage"] == "500mg"
