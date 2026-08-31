"""
End-to-End Verification Test for Track 3 (Engineer 3).

Tests:
  1. RxNorm Mapper (94 offline synonyms + format)
  2. Generic Substitution Engine (INR savings calculation)
  3. Disease Taxonomy (Therapeutic area mapping)
  4. WHO Dosage Benchmarks (Safe limit validation & pregnancy safety)
  5. FHIR Schema Serialization & Export (MedicationStatement, MedicationRequest)
  6. Refill Forecast Artifact Loading & Inference
"""

import sys
from pathlib import Path
from datetime import datetime, timezone, time, date

# Add project root and backend to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from ai_training.src.rxnorm_mapper import RxNormMapper
from ai_training.src.generic_substitution_engine import GenericSubstitutionEngine
from ai_training.src.disease_taxonomy import DiseaseTaxonomy
from ai_training.src.who_dosage_benchmarks import WHODosageBenchmarks
from backend.app.utils.fhir_converter import FHIRConverter
from backend.app.schemas.fhir_schemas import (
    FHIRMedicationStatement,
    FHIRMedicationRequest,
    FHIRMedication,
)
from ai_training.train_refill import GradientBoostedRegressor


def run_all_tests():
    print("=" * 72)
    print("  PillSync Track 3 (Engineer 3) End-to-End Verification Suite")
    print("=" * 72)

    passed_count = 0
    total_tests = 6

    # --- Test 1: RxNorm Normalization ---
    print("\n[Test 1/6] Testing RxNorm Normalization Engine...")
    try:
        mapper = RxNormMapper(use_api=False)
        r1 = mapper.normalize("Paracetamol")
        assert r1["normalized_name"] == "Acetaminophen", f"Expected Acetaminophen, got {r1['normalized_name']}"
        r2 = mapper.normalize("Amoxycillin")
        assert r2["normalized_name"] == "Amoxicillin", f"Expected Amoxicillin, got {r2['normalized_name']}"
        print("  [PASS] RxNorm normalized Paracetamol -> Acetaminophen and Amoxycillin -> Amoxicillin")
        passed_count += 1
    except Exception as e:
        print(f"  [FAIL] Test 1 failed: {e}")

    # --- Test 2: Generic Substitution Engine ---
    print("\n[Test 2/6] Testing Generic Substitution Engine & INR Savings...")
    try:
        engine = GenericSubstitutionEngine()
        engine.load_catalog()
        alts = engine.find_alternatives("Augmentin 625 Duo Tablet", max_results=5)
        assert alts["total_alternatives"] > 1000, f"Expected >1000 alternatives, got {alts['total_alternatives']}"
        assert alts["max_savings_per_unit_inr"] > 10.0, "Expected >10 INR savings"
        print(f"  [PASS] Found {alts['total_alternatives']} generic alternatives for Augmentin (Max save: INR {alts['max_savings_per_unit_inr']}/unit)")
        passed_count += 1
    except Exception as e:
        print(f"  [FAIL] Test 2 failed: {e}")

    # --- Test 3: Disease Taxonomy ---
    print("\n[Test 3/6] Testing Disease Taxonomy Classification...")
    try:
        taxonomy = DiseaseTaxonomy()
        c1 = taxonomy.classify_medicine("Metformin")
        assert c1["category"] == "Diabetes", f"Expected Diabetes, got {c1['category']}"
        c2 = taxonomy.classify_medicine("Amlodipine")
        assert c2["category"] == "Blood Pressure", f"Expected Blood Pressure, got {c2['category']}"
        c3 = taxonomy.classify_medicine("Levothyroxine")
        assert c3["category"] == "Thyroid", f"Expected Thyroid, got {c3['category']}"
        print("  [PASS] Correctly classified Metformin (Diabetes), Amlodipine (BP), Levothyroxine (Thyroid)")
        passed_count += 1
    except Exception as e:
        print(f"  [FAIL] Test 3 failed: {e}")

    # --- Test 4: WHO Dosage Benchmarks ---
    print("\n[Test 4/6] Testing WHO Dosage Benchmarks & Safety Bounds...")
    try:
        who = WHODosageBenchmarks()
        v1 = who.validate_daily_dose("Paracetamol", 2000)
        assert v1["status"] == "SAFE", f"Expected SAFE, got {v1['status']}"
        v2 = who.validate_daily_dose("Paracetamol", 5000)
        assert v2["status"] == "DANGER", f"Expected DANGER, got {v2['status']}"
        preg = who.get_pregnancy_category("Atorvastatin")
        assert preg == "X", f"Expected Category X for Atorvastatin, got {preg}"
        print("  [PASS] 2000mg Paracetamol marked SAFE, 5000mg marked DANGER, Atorvastatin Pregnancy Cat X")
        passed_count += 1
    except Exception as e:
        print(f"  [FAIL] Test 4 failed: {e}")

    # --- Test 5: HL7 FHIR Conversion ---
    print("\n[Test 5/6] Testing HL7 FHIR Schema Generation & Conversion...")
    try:
        converter = FHIRConverter()

        # Mock object
        class MockMedicine:
            id = "b8d16d16-621f-4bb2-b5e5-3bb7c2d5f0e1"
            user_id = "a1c23d45-6789-40ab-bcde-0123456789ab"
            name = "Metformin 500mg"
            dosage = "500mg"
            disease_category = "Diabetes"
            daily_frequency = 2
            quantity_per_dose = 1
            notes = "Take after meals"
            created_at = datetime.now(timezone.utc)

        class MockSchedule:
            frequency_pattern = "1-0-1"
            scheduled_time = time(8, 0)
            dose_label = "Morning (After breakfast)"

        statement = converter.medicine_to_fhir_statement(MockMedicine(), [MockSchedule()])
        fhir_dict = converter.to_fhir_json(statement)
        assert fhir_dict["resourceType"] == "MedicationStatement"
        assert fhir_dict["status"] == "active"
        assert fhir_dict["medicationCodeableConcept"]["text"] == "Metformin 500mg"

        # OCR Prescription to FHIR Request
        nlp_mock = {
            "drug_name": "Augmentin 625 Duo",
            "dosage": "625mg",
            "frequency": "1-0-1",
            "duration": "5 days",
            "instruction": "after food",
        }
        request_fhir = converter.prescription_to_fhir_request(nlp_mock, patient_id="user-123")
        req_dict = converter.to_fhir_json(request_fhir)
        assert req_dict["resourceType"] == "MedicationRequest"
        assert req_dict["status"] == "active"

        print("  [PASS] Validated FHIR MedicationStatement and MedicationRequest schema output")
        passed_count += 1
    except Exception as e:
        print(f"  [FAIL] Test 5 failed: {e}")

    # --- Test 6: Refill Forecasting Artifact ---
    print("\n[Test 6/6] Testing Refill Model Artifact Loading & Inference...")
    try:
        model_path = PROJECT_ROOT / "backend" / "app" / "ml_artifacts" / "refill_forecaster_v1.json"
        assert model_path.exists(), f"Model artifact not found at {model_path}"
        model = GradientBoostedRegressor.load(model_path)
        sample_features = [30.0, 2.0, 1.0, 0.95, 0.0, 0.05, 0.0, 5.0, 7.0, 1.9, 15.0]
        pred_days = model.predict_one(sample_features)
        assert pred_days > 0, f"Expected positive prediction, got {pred_days}"
        print(f"  [PASS] Loaded model artifact from backend/app/ml_artifacts/. Predicted runout: {pred_days:.1f} days")
        passed_count += 1
    except Exception as e:
        print(f"  [FAIL] Test 6 failed: {e}")

    # --- Summary ---
    print("\n" + "=" * 72)
    print(f"  SUMMARY: {passed_count}/{total_tests} Tests Passed!")
    print("=" * 72)

    return passed_count == total_tests


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
