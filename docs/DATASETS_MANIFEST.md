# PillSync - Master Datasets & APIs Registry

This document serves as the central manifest for all external, public, and custom datasets, APIs, and pre-trained AI models used in the **PillSync (Ai_intelligent-medicine-remainder-and-medication-tracking)** project.

---

## 🇮🇳 Local Project Datasets

### 1. Indian Medicine Dataset
* **Path**: `data/raw/indian_medicine_data.csv`
* **Format**: CSV (~31.8 MB)
* **Total Records**: 253,975 Medicines (~2.5 Lakh Indian Allopathy medicines)
* **Columns**: `id`, `name`, `price(₹)`, `Is_discontinued`, `manufacturer_name`, `type`, `pack_size_label`, `short_composition1`, `short_composition2`
* **Purpose**:
  * Core PostgreSQL Database Seeding for Indian Medicine Catalog.
  * Prescription OCR Text Matching & Brand Verification.
  * Cheaper Generic Alternative Suggestions based on `short_composition`.

---

## 🌐 External Datasets, APIs & AI Models (38 Master Resources)

### Category 1: Core Drug & Medicine Databases
1. **RxNorm (NIH)** (API) - Standardized medicine names, generic & brand names, RxCUI identifiers.
2. **DailyMed (FDA)** (API/Dataset) - FDA-approved drug labels, dosage instructions, warnings, side effects.
3. **DrugBank Open Data** (Dataset) - Drug identifiers, structures, drug-target interactions (CC0).
4. **NDC Directory (FDA)** (API) - National Drug Code identifiers for labelers, products, packages.
5. **Orange Book (FDA)** (API) - Therapeutic equivalence lists for generic drug substitution.
6. **RxTerms (NLM)** (Dataset) - Simplified drug names for matching OCR text.

### Category 2: Drug Safety, Interactions & Warnings
7. **OpenFDA Adverse Events (FAERS)** (API) - Drug recalls, adverse events, enforcement reports.
8. **OpenFDA Drug Label API** (API) - Interaction warnings, contraindications, side effects.
9. **DDInter 2.0** (SQLite Dataset) - Comprehensive Drug-Drug interaction database with severity rankings.
10. **NDF-RT** (API) - Drug class hierarchies, mechanisms of action, cross-allergy mapping.

### Category 3: Disease Information & Health Guidelines
11. **MedlinePlus (NIH)** (API) - Patient health, diseases, symptoms, diagnosis, and treatment.
12. **WHO Open Data** (Dataset) - Global health stats and clinical guidelines.
13. **CDC Open Data** (API) - Disease prevention and chronic care management protocols.
14. **NIH Medical Conditions API** (API) - 2,400+ medical conditions mapped to ICD-10/ICD-9 codes.
15. **NCCIH Herbs at a Glance (NIH)** (Web/Dataset) - Evidence-based botanical & supplement interactions.

### Category 4: Medical Standards & Protocols
16. **HL7 FHIR Resources** (Standard) - Global standard for electronic prescriptions & EHR exchange.

### Category 5: OCR Engines, Datasets & Vision Models
17. **Tesseract OCR** (Engine) - Open-source text extraction for printed/handwritten prescriptions.
18. **NIH RxIMAGE / Pill Image Challenge** (Dataset) - 9,000+ pill reference images for visual identification.
19. **MEDISEG** (Dataset) - 8,000+ pill images with instance segmentation masks.
20. **RxHandBD** (Dataset) - 5,578 handwritten prescription words (1,559 unique drugs).
21. **Medical Prescription OCR Dataset (HuggingFace)** (Dataset) - 1,000 synthetic annotated prescription images.
22. **Medical Prescription OCR (Donut-based)** (AI Model) - Pre-trained Transformer model for prescription parsing.

### Category 6: Medical NLP Models
23. **BioBERT** (AI Model) - Transformer model fine-tuned on biomedical literature.
24. **ClinicalBERT** (AI Model) - Transformer fine-tuned on MIMIC-III clinical notes.
25. **MedSpaCy** (NLP Library) - Clinical NLP pipeline built on spaCy for entity extraction.

### Category 7: Medical Coding & Terminology
26. **SNOMED CT (Snowstorm)** (Terminology Server) - Global clinical terminology for diagnoses and findings.
27. **ICD-10-CM** (API) - Standard diagnosis coding for clinical records.
28. **LOINC** (API) - Universal code system for lab tests and diagnostic measurements.

### Category 8: Real-World Clinical Datasets
29. **MIMIC-IV** (Dataset) - ICU/EHR dataset for vitals, medications, and clinical logs.
30. **TCIA (Cancer Imaging Archive)** (Dataset) - Medical images (CT/MRI) with clinical metadata.
31. **PTB-XL ECG Dataset** (Dataset) - 21,000+ 12-lead ECG recordings.
32. **MedDialog** (Dataset) - 300,000+ doctor-patient dialogue pairs.
33. **ClinicalTrials.gov** (API) - Structured data for global clinical trials.
34. **CMS Medicare Data** (Dataset) - Population benchmarks for medication adherence.
35. **PubMed E-Utilities** (API) - Biomedical literature citations and metadata.
36. **gnomAD** (Dataset) - Human genomic variant database.

### Category 9: Pricing & Refill Support
37. **GoodRx API** (API) - Real-time prescription pricing and discount coupons.
38. **SingleCare API** (API) - Pharmacy location and medicine pricing data.
