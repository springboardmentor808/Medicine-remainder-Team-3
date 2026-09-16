"""
PillSync Drug-Drug Interaction (DDI) & Clinical Contraindication Service.

Provides comprehensive cross-prescription safety checks across active pharmaceutical
ingredients (salts), therapeutic classes, and critical contraindications.
Based on standard pharmacological databases (FDA, DrugBank, BNF).
"""

from typing import List, Dict, Any, Optional, Set
import re

# ---------------------------------------------------------------------------
# Pharmacological DDI Interaction Matrix
# ---------------------------------------------------------------------------
# Severity Levels:
#   - CRITICAL / CONTRAINDICATED: Combination causes fatal or life-threatening adverse events.
#   - MAJOR: Substantial clinical risk; requires urgent dosage adjustment or alternative drug.
#   - MODERATE: Interaction may reduce efficacy or increase side effects; monitor closely.
# ---------------------------------------------------------------------------

DDI_RULES: List[Dict[str, Any]] = [
    # 1. Anticoagulants + NSAIDs (Severe Hemorrhage / Bleeding)
    {
        "drug_a": "warfarin",
        "drug_b_classes": ["nsaid", "aspirin", "ibuprofen", "diclofenac", "aceclofenac"],
        "severity": "CRITICAL",
        "title": "Severe Hemorrhage Risk (Warfarin + NSAID)",
        "description": "NSAIDs inhibit platelet aggregation and cause gastric mucosal erosion, dramatically increasing fatal gastrointestinal and intracranial bleeding risk with Warfarin.",
        "action": "Avoid concurrent use. Use Paracetamol for analgesia or consult prescribing physician.",
    },
    {
        "drug_a": "clopidogrel",
        "drug_b_classes": ["omeprazole", "esomeprazole"],
        "severity": "MAJOR",
        "title": "Reduced Antiplatelet Efficacy (Clopidogrel + Omeprazole)",
        "description": "Omeprazole competitively inhibits CYP2C19, preventing conversion of Clopidogrel into its active antiplatelet metabolite. Increases stent thrombosis and re-infarction risk.",
        "action": "Switch PPI to Pantoprazole or Rabeprazole (minimal CYP2C19 inhibition).",
    },

    # 2. Cardiovascular & Vasodilators
    {
        "drug_a": "sildenafil",
        "drug_b_classes": ["nitrates", "nitroglycerin", "isosorbide dinitrate", "isosorbide mononitrate"],
        "severity": "CRITICAL",
        "title": "Potentially Fatal Hypotension (PDE5i + Nitrates)",
        "description": "Potentiation of nitric oxide / cGMP pathway causes severe, refractory, life-threatening hypotension and cardiovascular collapse.",
        "action": "STRICT ABSOLUTE CONTRAINDICATION. Do not co-administer.",
    },
    {
        "drug_a": "telmisartan",
        "drug_b_classes": ["spironolactone", "potassium chloride", "losartan", "enalapril", "ramipril"],
        "severity": "MAJOR",
        "title": "Severe Hyperkalemia / Dual RAAS Blockade",
        "description": "Combining ARBs with ACE inhibitors or potassium-sparing diuretics markedly increases life-threatening hyperkalemia, acute kidney injury, and hypotension.",
        "action": "Monitor serum potassium and creatinine. Avoid dual RAAS blockade.",
    },

    # 3. Diabetes & Renal Risk
    {
        "drug_a": "metformin",
        "drug_b_classes": ["iodinated contrast", "contrast media"],
        "severity": "MAJOR",
        "title": "Lactic Acidosis Risk (Metformin + Contrast)",
        "description": "Intravascular iodinated radiocontrast agents can lead to acute renal failure and massive accumulation of metformin, triggering fatal lactic acidosis.",
        "action": "Withhold metformin 48 hours prior to and post-contrast imaging.",
    },

    # 4. Antibiotics & Cardiovascular QT Prolongation
    {
        "drug_a": "azithromycin",
        "drug_b_classes": ["ciprofloxacin", "levofloxacin", "amiodarone", "domperidone"],
        "severity": "MAJOR",
        "title": "Additive QT Prolongation / Torsades de Pointes",
        "description": "Co-administration of multiple QT-prolonging agents exponentially increases the risk of ventricular arrhythmias and sudden cardiac death.",
        "action": "Avoid combination in patients with underlying cardiac conditions or baseline long QT.",
    },

    # 5. Central Nervous System & Serotonin Syndrome
    {
        "drug_a": "tramadol",
        "drug_b_classes": ["fluoxetine", "sertraline", "escitalopram", "paroxetine", "duloxetine", "ssri", "snri"],
        "severity": "MAJOR",
        "title": "Serotonin Syndrome & Seizure Threshold Lowering",
        "description": "Tramadol inhibits serotonin and norepinephrine reuptake. Concomitant use with SSRIs/SNRIs precipitates potentially fatal Serotonin Syndrome and lowers seizure threshold.",
        "action": "Initiate seizure and serotonin-syndrome monitoring (observe for tremors, hyperreflexia, clonus, agitation, and hyperthermia). Reduce tramadol dose.",
    },

    # 6a. Simvastatin & Potent CYP3A4 Inhibitors (Absolute Contraindication / Critical)
    # Clinical Rationale: Simvastatin is nearly 100% dependent on CYP3A4. Strong inhibitors cause a 10-20x
    # AUC surge, precipitating acute rhabdomyolysis and myoglobinuric acute renal failure (FDA Contraindication).
    {
        "drug_a": "simvastatin",
        "drug_b_classes": ["clarithromycin", "erythromycin", "itraconazole", "ketoconazole", "posaconazole", "noxafil", "posatral"],
        "severity": "CRITICAL",
        "title": "Fatal Rhabdomyolysis & Acute Renal Failure (Simvastatin + Strong CYP3A4 Inhibitor)",
        "description": "Simvastatin relies almost entirely on CYP3A4 for clearance. Potent CYP3A4 inhibition elevates simvastatin exposure by up to 10-20 fold, precipitating massive acute rhabdomyolysis, myoglobinuria, and fatal acute renal failure.",
        "action": "ABSOLUTE CONTRAINDICATION. Avoid combination. For macrolide bacterial therapy, substitute with Azithromycin. For azole antifungal therapy, suspend Simvastatin for the duration of therapy or switch to a non-CYP3A4 statin (Rosuvastatin, Pravastatin).",
    },

    # 6b. Lovastatin & Potent CYP3A4 Inhibitors (Absolute Contraindication / Critical)
    # Clinical Rationale: Lovastatin is a lactone prodrug extensively bioactivated and cleared via
    # CYP3A4. Strong CYP3A4 inhibition elevates active lovastatin acid exposure up to 15-20 fold, precipitating
    # acute skeletal rhabdomyolysis and myoglobinuric acute renal failure (FDA Contraindication).
    {
        "drug_a": "lovastatin",
        "drug_b_classes": ["clarithromycin", "erythromycin", "itraconazole", "ketoconazole", "posaconazole", "noxafil", "posatral"],
        "severity": "CRITICAL",
        "title": "Fatal Rhabdomyolysis & Acute Renal Failure (Lovastatin + Strong CYP3A4 Inhibitor)",
        "description": "Lovastatin relies heavily on CYP3A4 for clearance. Strong CYP3A4 inhibition escalates lovastatin exposure by up to 20-fold, precipitating acute skeletal muscle lysis, severe myalgia, and acute renal tubular necrosis.",
        "action": "ABSOLUTE CONTRAINDICATION. Avoid combination. For macrolide bacterial therapy, substitute with Azithromycin. For azole antifungal therapy, suspend Lovastatin or switch to a non-CYP3A4 statin (Rosuvastatin, Pravastatin).",
    },

    # 6c. Atorvastatin & Other CYP3A4 Inhibitors (Major Clinical Risk - Dose-Cap Interaction)
    # Clinical Rationale: Atorvastatin undergoes significant CYP3A4 metabolism (4-5x AUC rise).
    # Co-administration with macrolides or other CYP3A4 inhibitors requires dose capping (max 20mg daily) or temporary withholding.
    {
        "drug_a": "atorvastatin",
        "drug_b_classes": ["clarithromycin", "erythromycin", "itraconazole", "ketoconazole"],
        "severity": "MAJOR",
        "title": "Elevated Statin Exposure & Myopathy Risk (Atorvastatin + CYP3A4 Inhibitor)",
        "description": "Potent CYP3A4 inhibition elevates atorvastatin serum concentrations by up to 400%, markedly elevating the incidence of severe myopathy, CPK elevation, and acute rhabdomyolysis.",
        "action": "Avoid combination where possible. Temporarily suspend Atorvastatin during antimicrobial therapy, or cap dosage at a maximum of 20mg daily under close supervision. If treating bacterial infection, consider Azithromycin.",
    },

    # 6d. Atorvastatin & Posaconazole / Noxafil / Posatral (Critical Interaction - Not a Dose-Cap Interaction)
    # Clinical Rationale: Posaconazole (Noxafil, Posatral) markedly increases atorvastatin exposure.
    # Co-administration is contraindicated / critical; do NOT classify or manage as a dose-cap interaction.
    {
        "drug_a": "atorvastatin",
        "drug_b_classes": ["posaconazole", "noxafil", "posatral"],
        "severity": "CRITICAL",
        "title": "Severe Statin Toxicity & Rhabdomyolysis Risk (Atorvastatin + Posaconazole / Noxafil / Posatral)",
        "description": "Concomitant use of posaconazole (Noxafil, Posatral) significantly increases atorvastatin exposure, markedly elevating the risk of severe myopathy and acute rhabdomyolysis. This is a critical interaction and must not be classified or managed as a dose-cap interaction.",
        "action": "CRITICAL INTERACTION. Avoid combination. Suspend Atorvastatin for the duration of Posaconazole (Noxafil / Posatral) therapy, or switch to a non-CYP3A4 statin (e.g., Pravastatin, Rosuvastatin). Do not classify or manage as a dose-cap interaction.",
    },

    # 7. Nitrates + ACE Inhibitors (Additive Hypotensive Effect)
    # Clinical Rationale: Concurrent administration of nitrates and ACE inhibitors can produce
    # additive systemic vasodilation, resulting in postural hypotension or dizziness, particularly
    # when initiating therapy or titrating doses. While frequently co-prescribed in coronary artery
    # disease and heart failure, routine blood pressure monitoring is recommended.
    {
        "drug_a": "nitroglycerin",
        "drug_b_classes": ["lisinopril", "enalapril", "ramipril", "ace_inhibitor"],
        "severity": "MODERATE",
        "title": "Additive Hypotension Risk (Nitrates + ACE Inhibitors)",
        "description": "Additive vasodilatory effect. Concomitant use may lower systemic vascular resistance and cause orthostatic dizziness or hypotension, especially upon initial titration.",
        "action": "Monitor resting and standing blood pressure during dose adjustments. Counsel patient on gradual position changes.",
    },

    # 8. Potent CYP3A4 Inhibitors + Opioids (CYP3A4 Inhibition & Respiratory Depression)
    # Clinical Rationale: Tramadol is metabolized via CYP2D6 (to active O-desmethyltramadol) and CYP3A4 (to N-desmethyltramadol).
    # Potent CYP3A4 blockade impairs systemic clearance pathways, increasing circulating concentrations of active opioid compounds.
    {
        "drug_a": "tramadol",
        "drug_b_classes": ["clarithromycin", "erythromycin", "itraconazole", "ketoconazole", "posaconazole", "noxafil", "posatral"],
        "severity": "CRITICAL",
        "title": "Severe Tramadol Toxicity & Respiratory Depression (CYP3A4 Inhibitor + Tramadol)",
        "description": "Potent CYP3A4 inhibition impairs Tramadol hepatic clearance pathways, causing systemic accumulation of active opioid compounds, profound central nervous system depression, and risk of life-threatening respiratory depression.",
        "action": "Monitor patients closely at frequent intervals for signs of respiratory depression, sedation, seizure activity, and serotonin syndrome (e.g., hyperreflexia, clonus, tremors, agitation). Consider dose reduction of tramadol and ensure emergency opioid reversal (naloxone) is accessible if concomitant use is necessary.",
    },
]

# Drug class mapping for active ingredients — Used for deterministic normalization and matching
DRUG_CLASS_MAP: Dict[str, List[str]] = {
    "warfarin": ["anticoagulant", "vitamin_k_antagonist"],
    "aspirin": ["nsaid", "antiplatelet", "salicylate"],
    "ibuprofen": ["nsaid", "analgesic"],
    "diclofenac": ["nsaid", "analgesic"],
    "aceclofenac": ["nsaid", "analgesic"],
    "clopidogrel": ["antiplatelet", "p2y12_inhibitor"],
    "omeprazole": ["ppi", "cyp2c19_inhibitor"],
    "pantoprazole": ["ppi"],
    "rabeprazole": ["ppi"],
    "sildenafil": ["pde5_inhibitor", "vasodilator"],
    "tadalafil": ["pde5_inhibitor", "vasodilator"],
    "nitroglycerin": ["nitrates", "vasodilator"],
    "isosorbide dinitrate": ["nitrates", "vasodilator"],
    "isosorbide mononitrate": ["nitrates", "vasodilator"],
    "telmisartan": ["arb", "raas_blocker"],
    "losartan": ["arb", "raas_blocker"],
    "enalapril": ["ace_inhibitor", "raas_blocker"],
    "ramipril": ["ace_inhibitor", "raas_blocker"],
    "lisinopril": ["ace_inhibitor", "raas_blocker"],  # ACE inhibitor mapping for cardiovascular contraindications
    "spironolactone": ["aldosterone_antagonist", "potassium_sparing_diuretic"],
    "metformin": ["biguanide", "antidiabetic"],
    "azithromycin": ["macrolide", "qt_prolonging"],
    "ciprofloxacin": ["fluoroquinolone", "qt_prolonging"],
    "domperidone": ["dopamine_antagonist", "qt_prolonging"],
    "tramadol": ["opioid", "serotonergic"],
    "fluoxetine": ["ssri", "serotonergic"],
    "sertraline": ["ssri", "serotonergic"],
    "escitalopram": ["ssri", "serotonergic"],
    "simvastatin": ["statin", "cyp3a4_substrate"],  # Potent CYP3A4 substrate (contraindicated with macrolides)
    "zocor": ["simvastatin", "statin", "cyp3a4_substrate"],
    "lovastatin": ["statin", "cyp3a4_substrate"],   # Potent CYP3A4 substrate (contraindicated with macrolides)
    "atorvastatin": ["statin", "cyp3a4_substrate"], # CYP3A4 substrate (major interaction with macrolides)
    "atorva": ["atorvastatin", "statin", "cyp3a4_substrate"],
    "lipicure": ["atorvastatin", "statin", "cyp3a4_substrate"],
    "lipitor": ["atorvastatin", "statin", "cyp3a4_substrate"],
    "rosuvastatin": ["statin"],                     # Non-CYP3A4 statin (minimal CYP2C9 metabolism; safe alternative)
    "crestor": ["rosuvastatin", "statin"],
    "pravastatin": ["statin"],                      # Non-CYP3A4 statin (sulfation clearance; safe alternative)
    "clarithromycin": ["macrolide", "cyp3a4_inhibitor"],
    "claribid": ["clarithromycin", "macrolide", "cyp3a4_inhibitor"],
    "posaconazole": ["azole_antifungal", "cyp3a4_inhibitor"],
    "noxafil": ["posaconazole", "azole_antifungal", "cyp3a4_inhibitor"],
    "posatral": ["posaconazole", "azole_antifungal", "cyp3a4_inhibitor"],
    "itraconazole": ["azole_antifungal", "cyp3a4_inhibitor"],
    "ketoconazole": ["azole_antifungal", "cyp3a4_inhibitor"],
    "calcium": ["mineral_supplement", "divalent_cation"],  # Polyvalent cation for chelation matching
    "paracetamol": ["analgesic", "antipyretic", "acetaminophen"],  # Safe analgesic profile mapping
}

# Broad mechanism / physiological classes that must NOT be used as drug aliases for drug A
BROAD_MECHANISM_CLASSES = {
    "vasodilator",
    "analgesic",
    "antiplatelet",
    "serotonergic",
    "raas_blocker",
    "qt_prolonging",
    "cyp3a4_substrate",
    "cyp3a4_inhibitor",
    "cyp2c19_inhibitor",
    "antidiabetic",
    "salicylate",
    "statin",
}


class DrugInteractionService:
    """
    Evaluates new medication additions against an active patient medication roster
    to detect critical and major drug-drug interactions.
    """

    @staticmethod
    def _normalize_drug_name(name: str) -> str:
        if not name:
            return ""
        cleaned = name.lower().strip()
        # Preserve "potassium chloride" by only stripping potassium when NOT followed by chloride
        cleaned = re.sub(
            r"\b(tablet|capsule|syrup|injection|mg|g|mcg|ip|bp|usp|hcl|sodium)\b|\bpotassium\b(?!\s*chloride\b)",
            "",
            cleaned,
        )
        cleaned = re.sub(r"\b\d+\s*(mg|g|mcg|iu|ml)?\b", "", cleaned)
        cleaned = re.sub(r"[^a-z0-9\s]", " ", cleaned)
        return " ".join(cleaned.split())

    @classmethod
    def _get_drug_classes_and_names(cls, norm_name: str) -> set:
        """Collect all matching drug keys and associated therapeutic classes from DRUG_CLASS_MAP using word boundaries."""
        matched = {norm_name}
        for drug_key, classes in DRUG_CLASS_MAP.items():
            # Medication-boundary matching: ensure drug_key is a distinct word/token
            if re.search(r"\b" + re.escape(drug_key) + r"\b", norm_name):
                matched.add(drug_key)
                matched.update(c.lower() for c in classes)
        return matched

    @classmethod
    def check_interactions(
        cls,
        candidate_drug_name: str,
        active_drug_names: List[str],
    ) -> List[Dict[str, Any]]:
        """
        Cross-checks a candidate drug against a list of already active medications.
        Returns a list of detected interaction warnings with boundary-enforced matching.
        """
        detected_warnings = []
        cand_norm = cls._normalize_drug_name(candidate_drug_name)
        cand_classes = cls._get_drug_classes_and_names(cand_norm)

        for active_drug in active_drug_names:
            act_norm = cls._normalize_drug_name(active_drug)
            if not act_norm or act_norm == cand_norm:
                continue

            act_classes = cls._get_drug_classes_and_names(act_norm)

            # Evaluate against DDI Rules
            for rule in DDI_RULES:
                rule_drug_a = rule["drug_a"].lower()
                classes_b = [b.lower() for b in rule["drug_b_classes"]]

                # Use specific pharmacological classes for A-side interaction matching (excluding broad physiological mechanisms)
                rule_a_classes = {
                    c.lower() for c in DRUG_CLASS_MAP.get(rule_drug_a, [])
                    if c.lower() not in BROAD_MECHANISM_CLASSES
                }
                rule_a_classes.add(rule_drug_a)

                # Word boundary matching against normalized names
                cand_matches_a = bool(re.search(r"\b" + re.escape(rule_drug_a) + r"\b", cand_norm)) or bool(cand_classes & rule_a_classes)
                act_matches_b = any(re.search(r"\b" + re.escape(c) + r"\b", act_norm) for c in classes_b) or bool(act_classes & set(classes_b))

                act_matches_a = bool(re.search(r"\b" + re.escape(rule_drug_a) + r"\b", act_norm)) or bool(act_classes & rule_a_classes)
                cand_matches_b = any(re.search(r"\b" + re.escape(c) + r"\b", cand_norm) for c in classes_b) or bool(cand_classes & set(classes_b))

                # Match forward (candidate is A, active is B) or reverse (active is A, candidate is B)
                is_match_fwd = cand_matches_a and act_matches_b
                is_match_rev = act_matches_a and cand_matches_b

                if is_match_fwd or is_match_rev:
                    # Preserve exact statin-inhibitor and drug pair identity in the title
                    base_title = rule["title"].split(" (")[0]
                    tailored_action = rule["action"]

                    # Tailor CYP3A4 statin actions according to inhibitor category (azole antifungal vs macrolide antibiotic)
                    if rule_drug_a in ("simvastatin", "lovastatin", "atorvastatin"):
                        inhibitor_str = (act_norm if cand_matches_a else cand_norm).lower()
                        is_azole = any(az in inhibitor_str for az in ("itraconazole", "ketoconazole", "fluconazole", "voriconazole", "posaconazole", "noxafil", "posatral", "azole"))
                        is_macrolide = any(mac in inhibitor_str for mac in ("clarithromycin", "erythromycin", "macrolide", "claribid"))

                        if is_azole:
                            if rule_drug_a == "simvastatin":
                                tailored_action = "ABSOLUTE CONTRAINDICATION. Avoid combination. For azole antifungal therapy, suspend Simvastatin for the duration of therapy or switch to a non-CYP3A4 statin (Rosuvastatin, Pravastatin)."
                            elif rule_drug_a == "lovastatin":
                                tailored_action = "ABSOLUTE CONTRAINDICATION. Avoid combination. For azole antifungal therapy, suspend Lovastatin or switch to a non-CYP3A4 statin (Rosuvastatin, Pravastatin)."
                            elif rule_drug_a == "atorvastatin":
                                if rule["severity"] == "CRITICAL":
                                    tailored_action = "CRITICAL INTERACTION. Avoid combination. Suspend Atorvastatin for the duration of Posaconazole (Noxafil / Posatral) therapy, or switch to a non-CYP3A4 statin (Rosuvastatin, Pravastatin). Do not classify or manage as a dose-cap interaction."
                                else:
                                    tailored_action = "Avoid combination where possible. For fungal azole therapy, suspend Atorvastatin or switch to a non-CYP3A4 statin (Rosuvastatin, Pravastatin)."
                        elif is_macrolide:
                            if rule_drug_a == "simvastatin":
                                tailored_action = "ABSOLUTE CONTRAINDICATION. Avoid combination. For macrolide bacterial therapy, substitute with Azithromycin."
                            elif rule_drug_a == "lovastatin":
                                tailored_action = "ABSOLUTE CONTRAINDICATION. Avoid combination. For macrolide bacterial therapy, substitute with Azithromycin."
                            elif rule_drug_a == "atorvastatin":
                                tailored_action = "Avoid combination where possible. Temporarily suspend Atorvastatin during antimicrobial therapy, or cap dosage at a maximum of 20mg daily under close supervision. If treating bacterial infection, consider Azithromycin."
                    elif rule_drug_a == "tramadol":
                        tailored_action = (
                            "Monitor closely for signs of respiratory depression, excessive sedation, seizure activity, and serotonin syndrome at frequent intervals. "
                            "Consider tramadol dosage reduction and ensure opioid reversal (naloxone) is accessible if co-administration is necessary."
                        )

                    detected_warnings.append({
                        "severity": rule["severity"],
                        "title": f"{base_title} ({candidate_drug_name} + {active_drug})",
                        "description": rule["description"],
                        "action": tailored_action,
                        "interacting_drugs": [candidate_drug_name, active_drug],
                    })

        return detected_warnings


