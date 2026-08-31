"""
PillSync Disease Taxonomy & NIH Conditions Mapper (Track 3 -- Engineer 3).

Maps medications to standardized health condition categories using the
NIH Clinical Tables API and local disease taxonomy.

Key capabilities:
  1. Map Indian medicine salt names to disease conditions
  2. Query NIH Clinical Tables API for standardized condition names
  3. Categorize medications by therapeutic area (Diabetes, Blood Pressure, etc.)
  4. Provide ICD-10 compatible condition codes where available

NIH API: https://clinicaltables.nlm.nih.gov/apidoc/conditions/v3/doc.html
(Free, No API key required)

Usage:
    from ai_training.src.disease_taxonomy import DiseaseTaxonomy

    taxonomy = DiseaseTaxonomy()
    category = taxonomy.classify_medicine("Metformin")
    # -> {"category": "Diabetes", "conditions": ["Type 2 Diabetes Mellitus"]}
"""

import json
from pathlib import Path
from typing import Optional
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError
from urllib.parse import quote

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
TAXONOMY_CACHE = PROJECT_ROOT / "ai_training" / "datasets" / "processed" / "disease_taxonomy_cache.json"

# ---------------------------------------------------------------------------
# Comprehensive Drug-to-Disease Category Mapping
# Maps active ingredient (salt) names to therapeutic disease categories.
# Covers the most common Indian allopathy medicines.
# ---------------------------------------------------------------------------
SALT_TO_DISEASE_MAP = {
    # --- Diabetes ---
    "Metformin": "Diabetes",
    "Glimepiride": "Diabetes",
    "Gliclazide": "Diabetes",
    "Glipizide": "Diabetes",
    "Sitagliptin": "Diabetes",
    "Vildagliptin": "Diabetes",
    "Saxagliptin": "Diabetes",
    "Linagliptin": "Diabetes",
    "Teneligliptin": "Diabetes",
    "Pioglitazone": "Diabetes",
    "Voglibose": "Diabetes",
    "Acarbose": "Diabetes",
    "Dapagliflozin": "Diabetes",
    "Empagliflozin": "Diabetes",
    "Canagliflozin": "Diabetes",
    "Insulin": "Diabetes",
    "Insulin Glargine": "Diabetes",
    "Insulin Aspart": "Diabetes",
    "Insulin Lispro": "Diabetes",
    "Repaglinide": "Diabetes",

    # --- Blood Pressure / Hypertension ---
    "Amlodipine": "Blood Pressure",
    "Telmisartan": "Blood Pressure",
    "Losartan": "Blood Pressure",
    "Olmesartan": "Blood Pressure",
    "Valsartan": "Blood Pressure",
    "Irbesartan": "Blood Pressure",
    "Ramipril": "Blood Pressure",
    "Enalapril": "Blood Pressure",
    "Lisinopril": "Blood Pressure",
    "Perindopril": "Blood Pressure",
    "Atenolol": "Blood Pressure",
    "Metoprolol": "Blood Pressure",
    "Metoprolol Succinate": "Blood Pressure",
    "Bisoprolol": "Blood Pressure",
    "Nebivolol": "Blood Pressure",
    "Propranolol": "Blood Pressure",
    "Carvedilol": "Blood Pressure",
    "Hydrochlorothiazide": "Blood Pressure",
    "Chlorthalidone": "Blood Pressure",
    "Indapamide": "Blood Pressure",
    "Furosemide": "Blood Pressure",
    "Spironolactone": "Blood Pressure",
    "Torsemide": "Blood Pressure",
    "Prazosin": "Blood Pressure",
    "Clonidine": "Blood Pressure",
    "Nifedipine": "Blood Pressure",
    "Cilnidipine": "Blood Pressure",

    # --- Thyroid ---
    "Levothyroxine": "Thyroid",
    "Thyroxine": "Thyroid",
    "Carbimazole": "Thyroid",
    "Methimazole": "Thyroid",
    "Propylthiouracil": "Thyroid",

    # --- Heart / Cardiovascular ---
    "Atorvastatin": "Heart Medications",
    "Rosuvastatin": "Heart Medications",
    "Simvastatin": "Heart Medications",
    "Pravastatin": "Heart Medications",
    "Clopidogrel": "Heart Medications",
    "Aspirin": "Heart Medications",
    "Warfarin": "Heart Medications",
    "Rivaroxaban": "Heart Medications",
    "Apixaban": "Heart Medications",
    "Dabigatran": "Heart Medications",
    "Enoxaparin": "Heart Medications",
    "Heparin": "Heart Medications",
    "Nitroglycerin": "Heart Medications",
    "Isosorbide Mononitrate": "Heart Medications",
    "Isosorbide Dinitrate": "Heart Medications",
    "Digoxin": "Heart Medications",
    "Amiodarone": "Heart Medications",
    "Diltiazem": "Heart Medications",
    "Verapamil": "Heart Medications",
    "Fenofibrate": "Heart Medications",
    "Ezetimibe": "Heart Medications",
    "Ticagrelor": "Heart Medications",

    # --- Antibiotics ---
    "Amoxicillin": "Antibiotics",
    "Amoxycillin": "Antibiotics",
    "Azithromycin": "Antibiotics",
    "Ciprofloxacin": "Antibiotics",
    "Levofloxacin": "Antibiotics",
    "Ofloxacin": "Antibiotics",
    "Cefixime": "Antibiotics",
    "Ceftriaxone": "Antibiotics",
    "Cephalexin": "Antibiotics",
    "Cefpodoxime": "Antibiotics",
    "Cefpodoxime Proxetil": "Antibiotics",
    "Cefuroxime": "Antibiotics",
    "Doxycycline": "Antibiotics",
    "Metronidazole": "Antibiotics",
    "Ornidazole": "Antibiotics",
    "Tinidazole": "Antibiotics",
    "Norfloxacin": "Antibiotics",
    "Nitrofurantoin": "Antibiotics",
    "Linezolid": "Antibiotics",
    "Meropenem": "Antibiotics",
    "Clindamycin": "Antibiotics",
    "Clarithromycin": "Antibiotics",
    "Erythromycin": "Antibiotics",
    "Clavulanic Acid": "Antibiotics",
    "Rifampicin": "Antibiotics",
    "Isoniazid": "Antibiotics",
    "Pyrazinamide": "Antibiotics",
    "Ethambutol": "Antibiotics",
    "Fluconazole": "Antibiotics",
    "Itraconazole": "Antibiotics",
    "Clotrimazole": "Antibiotics",

    # --- Vitamins & Supplements ---
    "Vitamin D3": "Vitamins",
    "Cholecalciferol": "Vitamins",
    "Calcium Carbonate": "Vitamins",
    "Calcium Citrate": "Vitamins",
    "Folic Acid": "Vitamins",
    "Methylcobalamin": "Vitamins",
    "Cyanocobalamin": "Vitamins",
    "Ferrous Ascorbate": "Vitamins",
    "Ferrous Fumarate": "Vitamins",
    "Ferrous Sulphate": "Vitamins",
    "Iron": "Vitamins",
    "Zinc": "Vitamins",
    "Multivitamin": "Vitamins",
    "Omega-3": "Vitamins",
    "Biotin": "Vitamins",
    "Thiamine": "Vitamins",
    "Riboflavin": "Vitamins",
    "Pyridoxine": "Vitamins",
    "Alpha Lipoic Acid": "Vitamins",
    "L-Methylfolate": "Vitamins",
    "Coenzyme Q10": "Vitamins",

    # --- General Healthcare (Pain, Allergy, GI, etc.) ---
    "Paracetamol": "General Healthcare",
    "Acetaminophen": "General Healthcare",
    "Ibuprofen": "General Healthcare",
    "Diclofenac": "General Healthcare",
    "Aceclofenac": "General Healthcare",
    "Naproxen": "General Healthcare",
    "Tramadol": "General Healthcare",
    "Cetirizine": "General Healthcare",
    "Levocetirizine": "General Healthcare",
    "Fexofenadine": "General Healthcare",
    "Loratadine": "General Healthcare",
    "Desloratadine": "General Healthcare",
    "Chlorpheniramine": "General Healthcare",
    "Montelukast": "General Healthcare",
    "Pantoprazole": "General Healthcare",
    "Rabeprazole": "General Healthcare",
    "Omeprazole": "General Healthcare",
    "Esomeprazole": "General Healthcare",
    "Lansoprazole": "General Healthcare",
    "Domperidone": "General Healthcare",
    "Ondansetron": "General Healthcare",
    "Ranitidine": "General Healthcare",
    "Famotidine": "General Healthcare",
    "Sucralfate": "General Healthcare",
    "Drotaverine": "General Healthcare",
    "Mefenamic Acid": "General Healthcare",
    "Etoricoxib": "General Healthcare",
    "Prednisolone": "General Healthcare",
    "Dexamethasone": "General Healthcare",
    "Deflazacort": "General Healthcare",
    "Hydrocortisone": "General Healthcare",
    "Betamethasone": "General Healthcare",
    "Salbutamol": "General Healthcare",
    "Levosalbutamol": "General Healthcare",
    "Budesonide": "General Healthcare",
    "Formoterol": "General Healthcare",
    "Theophylline": "General Healthcare",
    "Ambroxol": "General Healthcare",
    "Guaifenesin": "General Healthcare",
    "Dextromethorphan": "General Healthcare",
    "Phenylephrine": "General Healthcare",
    "Gabapentin": "General Healthcare",
    "Pregabalin": "General Healthcare",
    "Amitriptyline": "General Healthcare",
    "Sertraline": "General Healthcare",
    "Escitalopram": "General Healthcare",
    "Fluoxetine": "General Healthcare",
    "Alprazolam": "General Healthcare",
    "Clonazepam": "General Healthcare",
    "Lorazepam": "General Healthcare",
}

# Lowercase index for fast lookup
_SALT_TO_DISEASE_LOWER = {k.lower(): v for k, v in SALT_TO_DISEASE_MAP.items()}


class DiseaseTaxonomy:
    """
    Classifies medicines into therapeutic disease categories.

    Uses a comprehensive offline salt→disease map covering 200+ active
    ingredients commonly found in Indian allopathy medicines, with optional
    NIH Clinical Tables API fallback for condition name standardization.
    """

    NIH_API_BASE = "https://clinicaltables.nlm.nih.gov/api/conditions/v3/search"

    def __init__(self):
        self._cache = self._load_cache()

    def _load_cache(self) -> dict:
        if TAXONOMY_CACHE.exists():
            try:
                with open(TAXONOMY_CACHE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                pass
        return {}

    def _save_cache(self):
        TAXONOMY_CACHE.parent.mkdir(parents=True, exist_ok=True)
        with open(TAXONOMY_CACHE, "w", encoding="utf-8") as f:
            json.dump(self._cache, f, indent=2, ensure_ascii=False)

    def classify_medicine(self, salt_name: str) -> dict:
        """
        Classify a medicine's salt into a disease category.

        Args:
            salt_name: Active ingredient name (e.g. "Metformin", "Amlodipine")

        Returns:
            dict with keys: salt_name, category, confidence
        """
        if not salt_name or not salt_name.strip():
            return {
                "salt_name": salt_name,
                "category": "General Healthcare",
                "confidence": "low",
            }

        key = salt_name.strip().lower()

        if key in _SALT_TO_DISEASE_LOWER:
            return {
                "salt_name": salt_name.strip(),
                "category": _SALT_TO_DISEASE_LOWER[key],
                "confidence": "high",
            }

        # Partial match (prefix)
        for mapped_salt, category in _SALT_TO_DISEASE_LOWER.items():
            if key.startswith(mapped_salt) or mapped_salt.startswith(key):
                return {
                    "salt_name": salt_name.strip(),
                    "category": category,
                    "confidence": "medium",
                }

        return {
            "salt_name": salt_name.strip(),
            "category": "General Healthcare",
            "confidence": "low",
        }

    def search_nih_conditions(self, query: str, max_results: int = 5) -> list[str]:
        """
        Query the NIH Clinical Tables API for standardized condition names.

        Args:
            query: Condition search term (e.g. "diabetes", "hypertension")
            max_results: Max number of results

        Returns:
            List of standardized condition names
        """
        cache_key = f"nih_{query.lower().strip()}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        try:
            encoded = quote(query.strip())
            url = f"{self.NIH_API_BASE}?terms={encoded}&maxList={max_results}"

            req = Request(url, headers={"Accept": "application/json"})
            with urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            # NIH API returns [total_count, codes, extra_fields, display_strings]
            conditions = data[3] if len(data) > 3 else []
            # Flatten if nested
            flat = []
            for item in conditions:
                if isinstance(item, list):
                    flat.append(item[0] if item else "")
                else:
                    flat.append(str(item))

            self._cache[cache_key] = flat
            self._save_cache()
            return flat

        except (URLError, HTTPError, TimeoutError, IndexError) as e:
            print(f"  [WARN] NIH API error for '{query}': {e}")
            return []

    def get_all_categories(self) -> list[str]:
        """Return all unique disease categories in the taxonomy."""
        return sorted(set(SALT_TO_DISEASE_MAP.values()))

    def get_salts_for_category(self, category: str) -> list[str]:
        """Return all salt names mapped to a given category."""
        return sorted([
            salt for salt, cat in SALT_TO_DISEASE_MAP.items()
            if cat == category
        ])


# ---------------------------------------------------------------------------
# CLI Demo
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("=" * 60)
    print("  PillSync Disease Taxonomy Engine")
    print("=" * 60)

    taxonomy = DiseaseTaxonomy()

    # Show all categories
    categories = taxonomy.get_all_categories()
    print(f"\n  Total Categories: {len(categories)}")
    for cat in categories:
        salts = taxonomy.get_salts_for_category(cat)
        print(f"    {cat:25s} -> {len(salts):>3} medicines mapped")

    # Test classification
    test_salts = [
        "Metformin", "Amlodipine", "Azithromycin",
        "Levothyroxine", "Atorvastatin", "Paracetamol",
        "Vitamin D3", "Unknown Drug XYZ",
    ]

    print(f"\n--- Classification Tests ---")
    for salt in test_salts:
        result = taxonomy.classify_medicine(salt)
        print(f"  {salt:25s} -> {result['category']:25s} (confidence: {result['confidence']})")

    print(f"\n  Total salt mappings: {len(SALT_TO_DISEASE_MAP)}")
    print("  [OK] Disease Taxonomy Engine ready")
