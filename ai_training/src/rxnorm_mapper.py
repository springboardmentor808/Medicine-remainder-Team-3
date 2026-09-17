"""
PillSync RxNorm Normalization Mapper (Track 3 — Engineer 3).

Maps Indian medicine brand names and salt compositions to standardized
RxNorm RxCUI identifiers using the NIH NLM RxNorm REST API.

Key capabilities:
  1. Normalize Indian salt names to international equivalents
     (e.g., Paracetamol ↔ Acetaminophen)
  2. Resolve RxCUI codes for standardized drug identification
  3. Provide approximate matching for misspelled OCR outputs
  4. Cache results locally to minimize API calls

RxNorm API: https://rxnav.nlm.nih.gov/RxNormAPIs.html
(Free, No API key required, Rate limit: 20 requests/second)

Usage:
    from ai_training.src.rxnorm_mapper import RxNormMapper

    mapper = RxNormMapper()
    result = mapper.normalize("Paracetamol")
    # → {"rxcui": "161", "name": "Acetaminophen", "term_type": "IN"}
"""

import json
import os
import time
from pathlib import Path
from typing import Optional
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError
from urllib.parse import quote

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
CACHE_DIR = PROJECT_ROOT / "ai_training" / "datasets" / "processed"
CACHE_FILE = CACHE_DIR / "rxnorm_cache.json"

# ---------------------------------------------------------------------------
# Common Indian-to-International Synonym Map (Offline Fallback)
# ---------------------------------------------------------------------------
INDIAN_SYNONYM_MAP = {
    "paracetamol": "Acetaminophen",
    "diclofenac sodium": "Diclofenac",
    "crocin": "Acetaminophen",
    "dolo": "Acetaminophen",
    "metacin": "Acetaminophen",
    "amoxycillin": "Amoxicillin",
    "clavulanic acid": "Clavulanate",
    "ofloxacin": "Ofloxacin",
    "ciprofloxacin": "Ciprofloxacin",
    "azithromycin": "Azithromycin",
    "cetirizine": "Cetirizine",
    "levocetirizine": "Levocetirizine",
    "montelukast": "Montelukast",
    "pantoprazole": "Pantoprazole",
    "rabeprazole": "Rabeprazole",
    "omeprazole": "Omeprazole",
    "esomeprazole": "Esomeprazole",
    "domperidone": "Domperidone",
    "ondansetron": "Ondansetron",
    "metformin": "Metformin",
    "glimepiride": "Glimepiride",
    "gliclazide": "Gliclazide",
    "sitagliptin": "Sitagliptin",
    "voglibose": "Voglibose",
    "pioglitazone": "Pioglitazone",
    "amlodipine": "Amlodipine",
    "telmisartan": "Telmisartan",
    "losartan": "Losartan",
    "olmesartan": "Olmesartan",
    "ramipril": "Ramipril",
    "enalapril": "Enalapril",
    "atenolol": "Atenolol",
    "metoprolol": "Metoprolol Succinate",
    "propranolol": "Propranolol",
    "atorvastatin": "Atorvastatin",
    "rosuvastatin": "Rosuvastatin",
    "clopidogrel": "Clopidogrel",
    "aspirin": "Aspirin",
    "warfarin": "Warfarin",
    "levothyroxine": "Levothyroxine",
    "prednisolone": "Prednisolone",
    "dexamethasone": "Dexamethasone",
    "deflazacort": "Deflazacort",
    "hydrocortisone": "Hydrocortisone",
    "betamethasone": "Betamethasone",
    "fluconazole": "Fluconazole",
    "itraconazole": "Itraconazole",
    "clotrimazole": "Clotrimazole",
    "aceclofenac": "Aceclofenac",
    "ibuprofen": "Ibuprofen",
    "naproxen": "Naproxen",
    "tramadol": "Tramadol",
    "gabapentin": "Gabapentin",
    "pregabalin": "Pregabalin",
    "amitriptyline": "Amitriptyline",
    "sertraline": "Sertraline",
    "escitalopram": "Escitalopram",
    "fluoxetine": "Fluoxetine",
    "alprazolam": "Alprazolam",
    "clonazepam": "Clonazepam",
    "lorazepam": "Lorazepam",
    "cefixime": "Cefixime",
    "cefpodoxime proxetil": "Cefpodoxime",
    "ceftriaxone": "Ceftriaxone",
    "cephalexin": "Cephalexin",
    "doxycycline": "Doxycycline",
    "levofloxacin": "Levofloxacin",
    "metronidazole": "Metronidazole",
    "ornidazole": "Ornidazole",
    "tinidazole": "Tinidazole",
    "nitrofurantoin": "Nitrofurantoin",
    "norfloxacin": "Norfloxacin",
    "salbutamol": "Albuterol",
    "levosalbutamol": "Levalbuterol",
    "budesonide": "Budesonide",
    "formoterol": "Formoterol",
    "montelukast sodium": "Montelukast",
    "theophylline": "Theophylline",
    "ambroxol": "Ambroxol",
    "guaifenesin": "Guaifenesin",
    "dextromethorphan": "Dextromethorphan",
    "phenylephrine": "Phenylephrine",
    "chlorpheniramine": "Chlorpheniramine",
    "fexofenadine": "Fexofenadine",
    "vitamin d3": "Cholecalciferol",
    "cholecalciferol": "Cholecalciferol",
    "calcium carbonate": "Calcium Carbonate",
    "ferrous ascorbate": "Ferrous Ascorbate",
    "folic acid": "Folic Acid",
    "methylcobalamin": "Methylcobalamin",
    "thiamine": "Thiamine",
    "pyridoxine": "Pyridoxine",
    "riboflavin": "Riboflavin",
    "multivitamin": "Multivitamin",
}


class RxNormMapper:
    """
    Maps drug names to RxNorm standardized terms using:
      1. Local Indian synonym dictionary (instant, offline)
      2. RxNorm REST API approximate matching (online, cached)
    """

    RXNORM_API_BASE = "https://rxnav.nlm.nih.gov/REST"
    RATE_LIMIT_DELAY = 0.06  # ~16 requests/sec (under 20/sec limit)

    def __init__(self, use_api: bool = True):
        self.use_api = use_api
        self._cache = self._load_cache()

    def _load_cache(self) -> dict:
        """Load cached RxNorm mappings from disk."""
        if CACHE_FILE.exists():
            try:
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                pass
        return {}

    def _save_cache(self):
        """Persist cache to disk."""
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(self._cache, f, indent=2, ensure_ascii=False)

    def normalize_offline(self, drug_name: str) -> Optional[dict]:
        """
        Fast offline normalization using the Indian synonym map.
        Returns standardized name if found, else None.
        """
        key = drug_name.strip().lower()

        if key in INDIAN_SYNONYM_MAP:
            return {
                "input": drug_name,
                "normalized_name": INDIAN_SYNONYM_MAP[key],
                "source": "indian_synonym_map",
                "rxcui": None,
            }

        return None

    def normalize_api(self, drug_name: str) -> Optional[dict]:
        """
        Query RxNorm REST API for approximate match.
        Uses /approximateTerm.json endpoint for fuzzy matching.
        """
        if not self.use_api:
            return None

        key = drug_name.strip().lower()

        # Check cache first
        if key in self._cache:
            return self._cache[key]

        try:
            encoded_name = quote(drug_name.strip())
            url = f"{self.RXNORM_API_BASE}/approximateTerm.json?term={encoded_name}&maxEntries=1"

            req = Request(url, headers={"Accept": "application/json"})
            with urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            candidates = data.get("approximateGroup", {}).get("candidate", [])
            if candidates:
                best = candidates[0]
                result = {
                    "input": drug_name,
                    "normalized_name": best.get("name", drug_name),
                    "rxcui": best.get("rxcui"),
                    "score": best.get("score"),
                    "source": "rxnorm_api",
                }
            else:
                result = {
                    "input": drug_name,
                    "normalized_name": drug_name,
                    "rxcui": None,
                    "source": "rxnorm_api_no_match",
                }

            # Cache the result
            self._cache[key] = result
            self._save_cache()

            time.sleep(self.RATE_LIMIT_DELAY)
            return result

        except (URLError, HTTPError, TimeoutError) as e:
            print(f"  [WARN] RxNorm API error for '{drug_name}': {e}")
            return None

    def normalize(self, drug_name: str) -> dict:
        """
        Normalize a drug name using offline map first, then API fallback.

        Returns:
            dict with keys: input, normalized_name, rxcui, source
        """
        if not drug_name or not drug_name.strip():
            return {
                "input": drug_name,
                "normalized_name": "",
                "rxcui": None,
                "source": "empty_input",
            }

        # Step 1: Try offline synonym map
        offline_result = self.normalize_offline(drug_name)
        if offline_result:
            return offline_result

        # Step 2: Try RxNorm API
        api_result = self.normalize_api(drug_name)
        if api_result:
            return api_result

        # Step 3: Return as-is
        return {
            "input": drug_name,
            "normalized_name": drug_name.strip().title(),
            "rxcui": None,
            "source": "passthrough",
        }

    def batch_normalize(self, drug_names: list[str], verbose: bool = True) -> list[dict]:
        """Normalize a batch of drug names with progress logging."""
        results = []
        total = len(drug_names)

        for i, name in enumerate(drug_names, 1):
            result = self.normalize(name)
            results.append(result)

            if verbose and i % 100 == 0:
                print(f"  ... normalized {i:,}/{total:,} drugs")

        return results


# ---------------------------------------------------------------------------
# CLI Entry Point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("=" * 60)
    print("  RxNorm Drug Name Normalization Engine")
    print("=" * 60)

    mapper = RxNormMapper(use_api=False)

    test_drugs = [
        "Paracetamol", "Amoxycillin", "Salbutamol",
        "Crocin", "Metformin", "Atorvastatin",
        "Levothyroxine", "Vitamin D3", "Cefpodoxime Proxetil",
    ]

    print("\n--- Offline Normalization Tests ---")
    for drug in test_drugs:
        result = mapper.normalize(drug)
        print(f"  {drug:30s} -> {result['normalized_name']:30s} (source: {result['source']})")

    print(f"\n  Total synonyms in offline map: {len(INDIAN_SYNONYM_MAP)}")
    print("  [OK] RxNorm Mapper initialized successfully")
