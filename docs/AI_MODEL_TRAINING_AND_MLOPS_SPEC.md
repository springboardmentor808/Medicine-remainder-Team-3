# 🧠 PillSync AI/ML Model Training, Evaluation & Merging Blueprint (MLOps Architecture)

**Project:** AI Intelligent Medicine Reminder & Medication Tracking Platform (PillSync)  
**Document:** Isolated Machine Learning Lifecycle, 3-Engineer Work Breakdown & Seamless Production Merge Protocol  
**Author:** Senior AI/ML & Data Science Systems Architect  
**Version:** 2.0.0 (Production Master)  

---

## 1. Executive Strategy & Workflow Architecture

To preserve production backend stability, prevent dependency conflicts, and ensure model quality, all model training, hyperparameter optimization, and validation are conducted in an **Isolated ML Training Sandbox (`ai_training/`)**. Only models and data artifacts that pass stringent **Evaluation Quality Gates** are packaged and merged into the live FastAPI backend service.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                     PHASE 1: ISOLATED ML WORKSPACE (`ai_training/`)              │
│                                                                                  │
│   📁 Raw Datasets          🔬 Data Preprocessing        🧠 Model Training Loops  │
│   ├── Indian 253k CSV      ├── Salt & Strength Parser   ├── Donut Vision Xform   │
│   ├── DDInter 2.0 DB       ├── RxNorm Normalization     ├── BioBERT Clinical NER │
│   └── RxHandBD Handwriting └── Behavioral Features      └── Refill Forecasting   │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                   PHASE 2: RIGOROUS EVALUATION & QUALITY GATES                   │
│                                                                                  │
│   📊 Classification Metrics : Precision ≥ 94%, Recall ≥ 92%, F1-Score ≥ 93%     │
│   📈 Regression Metrics     : MAE ≤ 0.85 days, RMSE ≤ 1.20 days (Refill Runout)  │
│   ⚡ Inference Latency      : < 85ms per request on CPU / < 25ms on GPU          │
│   🛡️ Medical Safety Guard   : Zero Critical Contraindications Missed (Recall=1.0)│
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                           [Passed All Quality Gates]
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                     PHASE 3: ARTIFACT PACKAGING & SERIALIZATION                  │
│                                                                                  │
│   📦 Export Formats : ONNX Runtime / HuggingFace Transformers / Joblib / JSON    │
│   🏷️ Model Registry : Versioning, Metadata, Schema Signature, SHA-256 Checksum    │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 4: ZERO-DOWNTIME BACKEND INTEGRATION                    │
│                                                                                  │
│   🚀 Live Inference Services : `backend/app/services/ocr_service.py`             │
│                              `backend/app/services/nlp_service.py`             │
│                              `backend/app/services/catalog_service.py`         │
│                              `backend/app/services/refill_service.py`          │
│   🌐 Endpoints & FHIR Export : `/api/v1/catalog`, `/api/v1/ocr`, `/api/v1/refill`│
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Master Datasets & Resource Registry (15 Core Components)

### Category 1: Core Indian Medicine Databases (PillSync Backbone)
1. **`indian_medicine_data.csv` (253,973 Rows)**: Primary allopathy medicine catalog with brand names, MRP in ₹, pack size, manufacturer, and chemical compositions.
2. **`pillsync_medicine_import.csv` (Seeding File)**: 51.48 MB clean structured export with parsed salts, ₹/unit, and 10,993 generic composition groups.
3. **RxNorm & RxTerms (NIH)**: Normalization engine converting local drug names to standardized RxCUI codes (e.g., Paracetamol $\leftrightarrow$ Acetaminophen).
4. **DrugBank Open Data**: Chemical salt synonyms powering the Cheaper Generic Alternative Substitution Engine in ₹.

### Category 2: Drug Safety, Interactions & Warnings
5. **DDInter 2.0 (SQLite Database)**: Offline pairwise drug-drug interaction matrix with High/Moderate/Low severity rankings.
6. **DailyMed / OpenFDA Label API**: Black-box warnings, pregnancy safety categories (A/B/C/D/X), and contraindication rules.

### Category 3: Disease Information & Health Guidelines
7. **MedlinePlus (NIH API)**: Patient health summaries and chronic disease categorization.
8. **NIH Medical Conditions API**: 2,400+ standardized clinical conditions.
9. **WHO Open Data**: Essential Medicines maximum safe daily intake thresholds and pediatric safety limits.

### Category 4: Internal Platform Database & Schemas
10. **HL7 FHIR Standard (R4)**: Global standard JSON schemas for `MedicationRequest`, `MedicationStatement`, `Dosage`, and `Medication`.

### Category 5: OCR Engines & Prescription Vision Models
11. **Tesseract OCR (Base Engine)**: Adaptive binarization for printed prescription text extraction.
12. **Medical Prescription OCR / Donut Model (`chinmays18/medical-prescriptionocr`)**: End-to-end Vision Transformer for direct image-to-JSON parsing.
13. **RxHandBD (Zenodo Dataset)**: 5,500+ cropped doctor handwriting words for cursive recognition fine-tuning.

### Category 6: Medical NLP & Entity Extraction
14. **MedSpaCy Pipeline**: Rule-based clinical entity matcher for dosage (`500mg`), frequency (`1-0-1`, `BD`, `TDS`), and meal instructions.
15. **BioBERT (`dmis-lab/biobert-base-cased-v1.1`)**: Fine-tuned Transformer for complex biomedical token classification.

---

## 3. 👥 3-Engineer Work Breakdown & Status

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       PILLSYNC AI/ML CORE ENGINEERING TEAM                                       │
├──────────────────────────────────────┬─────────────────────────────────────┬─────────────────────────────────────┤
│   👨‍💻 ENGINEER 1: VISION AI & OCR    │   👨‍💻 ENGINEER 2: CLINICAL NLP      │   👨‍💻 ENGINEER 3: DATA & PLATFORM    │
│   (Prescription Perception Lead)     │   & DRUG SAFETY LEAD                │   (Catalog, FHIR & Refill Lead)     │
├──────────────────────────────────────┼─────────────────────────────────────┼─────────────────────────────────────┤
│ • Category 5: OCR & Vision Models    │ • Category 6: Medical NLP & NER     │ • Category 1: Core Medicine Data    │
│   - #11 Tesseract OCR                │   - #14 MedSpaCy Rule Pipeline      │   - #1 indian_medicine_data.csv [✓] │
│   - #12 Donut Vision Transformer     │   - #15 BioBERT Clinical NER        │   - #2 pillsync_medicine_import [✓] │
│   - #13 RxHandBD Handwriting Dataset │ • Category 2: Drug Safety           │   - #3 RxNorm & RxTerms (NIH)   [✓] │
│ • OpenCV Preprocessing Pipeline      │   - #5 DDInter 2.0 (SQLite DDI)     │   - #4 DrugBank Open Data       [✓] │
│ • Synthetic Prescription Generator   │   - #6 DailyMed / OpenFDA Label API │ • Category 3: Health Guidelines     │
│ • TorchScript/ONNX Vision Export     │ • Multi-Severity Interaction Engine │   - #7 MedlinePlus (NIH API)    [✓] │
│ • `backend/app/services/ocr_service` │ • `backend/app/services/nlp_service`│   - #8 NIH Medical Conditions   [✓] │
│                                      │ • `medication_service.py` (Safety)  │   - #9 WHO Essential Meds       [✓] │
│                                      │                                     │ • Category 4: Platform Schemas      │
│                                      │                                     │   - #10 HL7 FHIR Standard       [✓] │
│                                      │                                     │ • Refill Forecasting (XGBoost)  [✓] │
│                                      │                                     │ • `/api/v1/catalog` Router      [✓] │
├──────────────────────────────────────┼─────────────────────────────────────┼─────────────────────────────────────┤
│ Status: ⏳ Ready for Sprint 2        │ Status: ⏳ Ready for Sprint 2       │ Status: ✅ COMPLETED & VERIFIED     │
└──────────────────────────────────────┴─────────────────────────────────────┴─────────────────────────────────────┘
```

---

## 4. Track 3 (Engineer 3) Delivered Artifacts

| Component | File Path | Status | Verification Result |
| :--- | :--- | :---: | :--- |
| **ETL Pipeline** | `ai_training/src/clean_indian_data.py` | ✅ | 253,973 / 253,973 rows parsed (0 skipped) |
| **Clean Import CSV** | `data/processed/pillsync_medicine_import.csv` | ✅ | 51.48 MB, 10,993 generic groups |
| **RxNorm Mapper** | `ai_training/src/rxnorm_mapper.py` | ✅ | 94 offline synonyms (Paracetamol $\rightarrow$ Acetaminophen) |
| **Generic Substitution Engine** | `ai_training/src/generic_substitution_engine.py` | ✅ | Up to 96.9% ₹ savings on Augmentin 625 |
| **Disease Taxonomy** | `ai_training/src/disease_taxonomy.py` | ✅ | 176 salts across 7 therapeutic categories |
| **WHO Dosage Benchmarks** | `ai_training/src/who_dosage_benchmarks.py` | ✅ | 30 drugs, max dose validation & pregnancy categories |
| **HL7 FHIR Schemas** | `backend/app/schemas/fhir_schemas.py` | ✅ | MedicationRequest & MedicationStatement compliant |
| **FHIR Converter** | `backend/app/utils/fhir_converter.py` | ✅ | Bidirectional Internal $\leftrightarrow$ FHIR R4 JSON |
| **Refill Model Trainer** | `ai_training/train_refill.py` | ✅ | $R^2 = 0.9851$, artifact exported to `ml_artifacts/` |
| **Catalog SQLAlchemy Model** | `backend/app/models/medicine_catalog.py` | ✅ | Trigram GIN & fingerprint indexes added |
| **Bulk Catalog Seeder** | `backend/seed_indian_catalog.py` | ✅ | High-speed batch insert (1,000 rows/commit) |
| **Catalog API Router** | `backend/app/api/v1/catalog.py` | ✅ | `/search`, `/generic-alternatives`, `/validate-dosage` |
| **Verification Suite** | `ai_training/verify_track3.py` | ✅ | **6/6 Automated Tests Passed** |

---

*Document certified by Senior AI/ML & Data Science Systems Architect.*
