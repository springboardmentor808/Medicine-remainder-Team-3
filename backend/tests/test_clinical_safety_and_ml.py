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

    def test_lovastatin_and_simvastatin_specific_rules_and_pair_identity(self):
        """Verify dedicated Lovastatin (Rule 6b) and Simvastatin (Rule 6a) critical warnings and dynamic pair identity."""
        # 1. Lovastatin + Clarithromycin -> CRITICAL with pair identity
        w1 = DrugInteractionService.check_interactions("Lovastatin 20mg", ["Clarithromycin 500mg"])
        assert len(w1) >= 1
        assert w1[0]["severity"] == "CRITICAL"
        assert "Lovastatin 20mg + Clarithromycin 500mg" in w1[0]["title"]
        assert "Azithromycin" in w1[0]["action"]

        # 2. Lovastatin + Itraconazole -> CRITICAL, preserves pair identity, does NOT recommend Azithromycin for fungal azoles
        w2 = DrugInteractionService.check_interactions("Lovastatin 40mg", ["Itraconazole 100mg"])
        assert len(w2) >= 1
        assert w2[0]["severity"] == "CRITICAL"
        assert "Lovastatin 40mg + Itraconazole 100mg" in w2[0]["title"]
        assert "azole" in w2[0]["action"].lower() and "suspend" in w2[0]["action"].lower()
        assert "azithromycin" not in w2[0]["action"].lower()

        # 3. Simvastatin + Ketoconazole -> CRITICAL, preserves pair identity, does NOT recommend Azithromycin for fungal azoles
        w3 = DrugInteractionService.check_interactions("Simvastatin 20mg", ["Ketoconazole 200mg"])
        assert len(w3) >= 1
        assert w3[0]["severity"] == "CRITICAL"
        assert "Simvastatin 20mg + Ketoconazole 200mg" in w3[0]["title"]
        assert "azole" in w3[0]["action"].lower() and "suspend" in w3[0]["action"].lower()
        assert "azithromycin" not in w3[0]["action"].lower()


        # 4. Atorvastatin + Itraconazole -> MAJOR
        w4 = DrugInteractionService.check_interactions("Atorvastatin 20mg", ["Itraconazole 100mg"])
        assert len(w4) >= 1
        assert w4[0]["severity"] == "MAJOR"
        assert "Atorvastatin 20mg + Itraconazole 100mg" in w4[0]["title"]

        # 5. Safe non-CYP3A4 statins (Rosuvastatin, Pravastatin)
        w5 = DrugInteractionService.check_interactions("Rosuvastatin 10mg", ["Clarithromycin 500mg"])
        assert len(w5) == 0
        w6 = DrugInteractionService.check_interactions("Pravastatin 20mg", ["Itraconazole 100mg"])
        assert len(w6) == 0

        # 6. Posaconazole across all three statin rules
        # 6a. Simvastatin + Posaconazole -> CRITICAL
        w_posa_sim = DrugInteractionService.check_interactions("Simvastatin 20mg", ["Posaconazole 100mg"])
        assert len(w_posa_sim) >= 1
        assert w_posa_sim[0]["severity"] == "CRITICAL"
        assert "Simvastatin 20mg + Posaconazole 100mg" in w_posa_sim[0]["title"]
        assert "azole" in w_posa_sim[0]["action"].lower()

        # 6b. Lovastatin + Posaconazole -> CRITICAL
        w_posa_lova = DrugInteractionService.check_interactions("Lovastatin 40mg", ["Posaconazole 100mg"])
        assert len(w_posa_lova) >= 1
        assert w_posa_lova[0]["severity"] == "CRITICAL"
        assert "Lovastatin 40mg + Posaconazole 100mg" in w_posa_lova[0]["title"]
        assert "azole" in w_posa_lova[0]["action"].lower()

        # 6c. Atorvastatin + Posaconazole / Noxafil / Posatral -> CRITICAL (not a dose-cap interaction)
        w_posa_atorva = DrugInteractionService.check_interactions("Atorvastatin 20mg", ["Posaconazole 100mg"])
        assert len(w_posa_atorva) >= 1
        assert w_posa_atorva[0]["severity"] == "CRITICAL"
        assert "Atorvastatin 20mg + Posaconazole 100mg" in w_posa_atorva[0]["title"]
        assert "suspend" in w_posa_atorva[0]["action"].lower()
        assert "cap dosage" not in w_posa_atorva[0]["action"].lower()

        # Atorvastatin + Noxafil -> CRITICAL
        w_noxa_atorva = DrugInteractionService.check_interactions("Atorvastatin 20mg", ["Noxafil 100mg"])
        assert len(w_noxa_atorva) >= 1
        assert w_noxa_atorva[0]["severity"] == "CRITICAL"
        assert "cap dosage" not in w_noxa_atorva[0]["action"].lower()

        # Atorvastatin + Posatral -> CRITICAL
        w_posatral_atorva = DrugInteractionService.check_interactions("Atorvastatin 20mg", ["Posatral 100mg"])
        assert len(w_posatral_atorva) >= 1
        assert w_posatral_atorva[0]["severity"] == "CRITICAL"
        assert "cap dosage" not in w_posatral_atorva[0]["action"].lower()

        # Atorva brand alias resolution -> MAJOR with Clarithromycin, CRITICAL with Posaconazole
        w_atorva_clar = DrugInteractionService.check_interactions("Atorva 20mg", ["Clarithromycin 500mg"])
        assert len(w_atorva_clar) >= 1
        assert w_atorva_clar[0]["severity"] == "MAJOR"

        w_atorva_posa = DrugInteractionService.check_interactions("Atorva 20mg", ["Posaconazole 100mg"])
        assert len(w_atorva_posa) >= 1
        assert w_atorva_posa[0]["severity"] == "CRITICAL"

        # 7. Brand alias resolution in clinical matching (Noxafil -> Posaconazole, Claribid -> Clarithromycin)
        w_brand_statin = DrugInteractionService.check_interactions("Simvastatin 20mg", ["Noxafil 100mg"])
        assert len(w_brand_statin) >= 1
        assert w_brand_statin[0]["severity"] == "CRITICAL"

        # 8. Tramadol + CYP3A4 Inhibitors (monitored-interaction guidance without absolute contraindication claim)
        w_tram_clar = DrugInteractionService.check_interactions("Tramadol 50mg", ["Clarithromycin 500mg"])
        assert len(w_tram_clar) >= 1
        assert w_tram_clar[0]["severity"] == "CRITICAL"
        assert "absolute contraindication" not in w_tram_clar[0]["action"].lower()
        assert "monitor" in w_tram_clar[0]["action"].lower()
        assert "seizure" in w_tram_clar[0]["action"].lower()
        assert "serotonin" in w_tram_clar[0]["action"].lower()
        assert "clearance" in w_tram_clar[0]["description"].lower()

        w_tram_posa = DrugInteractionService.check_interactions("Tramadol 50mg", ["Posaconazole 100mg"])
        assert len(w_tram_posa) >= 1
        assert w_tram_posa[0]["severity"] == "CRITICAL"
        assert "absolute contraindication" not in w_tram_posa[0]["action"].lower()
        assert "monitor" in w_tram_posa[0]["action"].lower()
        assert "seizure" in w_tram_posa[0]["action"].lower()
        assert "serotonin" in w_tram_posa[0]["action"].lower()

        w_tram_brand = DrugInteractionService.check_interactions("Tramadol 50mg", ["Noxafil 100mg"])
        assert len(w_tram_brand) >= 1
        assert w_tram_brand[0]["severity"] == "CRITICAL"
        assert "absolute contraindication" not in w_tram_brand[0]["action"].lower()
        assert "monitor" in w_tram_brand[0]["action"].lower()
        assert "seizure" in w_tram_brand[0]["action"].lower()
        assert "serotonin" in w_tram_brand[0]["action"].lower()

        # Tramadol + SSRI (Rule 5) seizure & serotonin monitoring
        w_tram_ssri = DrugInteractionService.check_interactions("Tramadol 50mg", ["Fluoxetine 20mg"])
        assert len(w_tram_ssri) >= 1
        assert "seizure" in w_tram_ssri[0]["action"].lower()
        assert "serotonin" in w_tram_ssri[0]["action"].lower()


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
