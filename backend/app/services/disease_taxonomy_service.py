"""
PillSync Disease Taxonomy & NIH Conditions Service (Track 3 — Engineer 3).

Maps medications to standardized health condition categories using the
local disease taxonomy with 176+ active ingredient mappings.
"""

import json
from pathlib import Path
from typing import Optional
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError
from urllib.parse import quote

SALT_TO_DISEASE_MAP: dict[str, str] = {
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

_SALT_TO_DISEASE_LOWER = {k.lower(): v for k, v in SALT_TO_DISEASE_MAP.items()}


class DiseaseTaxonomy:
    """
    Classifies medicines into therapeutic disease categories.
    """

    def classify_medicine(self, salt_name: str) -> dict:
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

    def get_all_categories(self) -> list[str]:
        return sorted(set(SALT_TO_DISEASE_MAP.values()))

    def get_salts_for_category(self, category: str) -> list[str]:
        return sorted([
            salt for salt, cat in SALT_TO_DISEASE_MAP.items()
            if cat == category
        ])
