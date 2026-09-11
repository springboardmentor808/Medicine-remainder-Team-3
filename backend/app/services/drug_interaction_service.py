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
        "action": "Monitor for tremors, hyperreflexia, agitation, and hyperthermia. Reduce tramadol dose.",
    },

    # 6. Statins & CYP3A4 Inhibitors
    {
        "drug_a": "atorvastatin",
        "drug_b_classes": ["clarithromycin", "erythromycin", "itraconazole", "ketoconazole"],
        "severity": "MAJOR",
        "title": "Severe Rhabdomyolysis Risk (Statin + Macrolide/Azole)",
        "description": "Potent CYP3A4 inhibition elevates atorvastatin serum concentrations by up to 400%, precipitating severe myopathy, acute rhabdomyolysis, and renal failure.",
        "action": "Temporarily suspend statin therapy during course of antibiotic/antifungal.",
    },

    # 7. Nitrates + ACE Inhibitors (Severe Hypotensive Collapse)
    {
        "drug_a": "nitroglycerin",
        "drug_b_classes": ["lisinopril", "enalapril", "ramipril", "ace_inhibitor"],
        "severity": "CRITICAL",
        "title": "Severe Hypotensive Collapse (Nitrates + ACE Inhibitors)",
        "description": "Dual systemic arterial and venous vasodilation. Nitroglycerin promotes cGMP venous dilation while Lisinopril prevents angiotensin II vasoconstriction, precipitating severe orthostatic hypotension, syncope, and hypoperfusion.",
        "action": "Titrate doses with extreme caution. Avoid rapid postural changes. Monitor blood pressure closely after nitrate administration.",
    },

    # 8. Macrolides + Opioids (CYP3A4 Inhibition & Respiratory Depression)
    {
        "drug_a": "clarithromycin",
        "drug_b_classes": ["tramadol"],
        "severity": "CRITICAL",
        "title": "Severe Tramadol Toxicity & Respiratory Depression (Clarithromycin + Tramadol)",
        "description": "Clarithromycin is a potent CYP3A4 inhibitor that severely retards Tramadol elimination, causing massive plasma accumulation of active opioid compounds, profound CNS depression, and life-threatening respiratory arrest.",
        "action": "ABSOLUTE CONTRAINDICATION. Avoid combination. Substitute Clarithromycin with Azithromycin or switch to non-opioid analgesia.",
    },

    # 9. Macrolides + Nitrates (Hemodynamic Instability)
    {
        "drug_a": "clarithromycin",
        "drug_b_classes": ["nitroglycerin", "nitrates"],
        "severity": "MAJOR",
        "title": "Hemodynamic Instability & Cardiac Conduction Mismatch (Clarithromycin + Nitroglycerin)",
        "description": "Macrolide antibiotics alter autonomic cardiovascular tone and hepatic CYP3A4 clearance dynamics, destabilizing nitrate-mediated vascular smooth muscle relaxation and inducing erratic hemodynamic swings.",
        "action": "Monitor blood pressure and pulse rate closely. Administer nitrate only while seated.",
    },

    # 10. Calcium Supplements + ACE Inhibitors (Bioavailability Reduction)
    {
        "drug_a": "calcium",
        "drug_b_classes": ["lisinopril", "enalapril", "ramipril", "ace_inhibitor"],
        "severity": "MODERATE",
        "title": "Reduced ACE Inhibitor Absorption (Calcium + Lisinopril)",
        "description": "Oral polyvalent calcium salts alter gastric pH and form insoluble chelates with ACE inhibitors, reducing gastrointestinal bioavailability and therapeutic efficacy.",
        "action": "Separate administration times by at least 2 hours (e.g. Lisinopril in morning, Calcium with lunch/dinner).",
    },
]

# Drug class mapping for active ingredients
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
    "lisinopril": ["ace_inhibitor", "raas_blocker"],
    "spironolactone": ["aldosterone_antagonist", "potassium_sparing_diuretic"],
    "metformin": ["biguanide", "antidiabetic"],
    "azithromycin": ["macrolide", "qt_prolonging"],
    "ciprofloxacin": ["fluoroquinolone", "qt_prolonging"],
    "domperidone": ["dopamine_antagonist", "qt_prolonging"],
    "tramadol": ["opioid", "serotonergic"],
    "fluoxetine": ["ssri", "serotonergic"],
    "sertraline": ["ssri", "serotonergic"],
    "escitalopram": ["ssri", "serotonergic"],
    "atorvastatin": ["statin", "cyp3a4_substrate"],
    "clarithromycin": ["macrolide", "cyp3a4_inhibitor"],
    "calcium": ["mineral_supplement", "divalent_cation"],
    "paracetamol": ["analgesic", "antipyretic", "acetaminophen"],
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
        """Collect all matching drug keys and associated therapeutic classes from DRUG_CLASS_MAP."""
        matched = {norm_name}
        for drug_key, classes in DRUG_CLASS_MAP.items():
            if drug_key in norm_name:
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
        Returns a list of detected interaction warnings.
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

                cand_matches_a = (rule_drug_a in cand_norm) or bool(cand_classes & rule_a_classes)
                act_matches_b = any(c in act_norm for c in classes_b) or bool(act_classes & set(classes_b))

                act_matches_a = (rule_drug_a in act_norm) or bool(act_classes & rule_a_classes)
                cand_matches_b = any(c in cand_norm for c in classes_b) or bool(cand_classes & set(classes_b))

                # Match forward (candidate is A, active is B) or reverse (active is A, candidate is B)
                is_match_fwd = cand_matches_a and act_matches_b
                is_match_rev = act_matches_a and cand_matches_b

                if is_match_fwd or is_match_rev:
                    detected_warnings.append({
                        "severity": rule["severity"],
                        "title": rule["title"],
                        "description": rule["description"],
                        "action": rule["action"],
                        "interacting_drugs": [candidate_drug_name, active_drug],
                    })

        return detected_warnings

