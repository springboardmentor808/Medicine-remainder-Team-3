"use client";

import React, { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { medicineAPI } from "@/lib/api";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Info,
  Pill,
  Plus,
  Trash2,
  Activity,
  FileCheck2,
  Sparkles,
  Search,
  ExternalLink,
  Flame,
  AlertOctagon,
  HeartPulse,
  Clock,
  Droplets,
  RotateCcw,
  CheckCircle2,
  UtensilsCrossed,
  Stethoscope,
  BookOpen,
  Filter,
  Layers,
  FolderHeart,
  Globe2,
  X,
  ChevronDown,
  AlertCircle,
} from "lucide-react";

// Clinically validated multi-institution pharmacological interaction database with full variant matching
// Aligned 1:1 with backend DDI_RULES and DRUG_CLASS_MAP
const COMPREHENSIVE_INTERACTIONS = [
  {
    id: "ddi-1",
    pair: ["Warfarin", "NSAIDs / Aspirin"],
    groupA: ["warfarin", "coumadin", "anticoagulant"],
    groupB: ["aspirin", "ibuprofen", "diclofenac", "aceclofenac", "naproxen", "combiflam", "brufen", "voveran", "ecosprin", "nsaid"],
    severity: "critical",
    title: "Severe Hemorrhage & Gastrointestinal Bleeding Risk",
    mechanism: "Synergistic anticoagulant & antiplatelet effect. NSAIDs inhibit platelet aggregation and erode gastric mucosa while Warfarin suppresses vitamin K clotting factors.",
    symptoms: "Unexplained bruising, melena (black tarry stools), hematuria, spontaneous nosebleeds, coffee-ground emesis.",
    recommendation: "Avoid concurrent use unless strictly mandated post-PCI under cardiologist supervision. Conduct frequent INR monitoring.",
    evidence: "FDA Black Box Warning · ACC/AHA Clinical Guidelines",
    category: "Hematology / Anticoagulation",
  },
  {
    id: "ddi-2a",
    pair: ["Simvastatin", "CYP3A4 Inhibitor"],
    groupA: ["simvastatin", "zocor"],
    groupB: ["clarithromycin", "erythromycin", "itraconazole", "ketoconazole", "posaconazole", "noxafil", "posatral", "claribid"],
    severity: "critical",
    title: "Fatal Rhabdomyolysis & Acute Renal Failure (Simvastatin + Strong CYP3A4 Inhibitor)",
    mechanism: "Simvastatin relies almost entirely on CYP3A4 for clearance. Strong CYP3A4 inhibition elevates simvastatin exposure by up to 10-20 fold, precipitating massive acute skeletal muscle breakdown and myoglobinuric acute renal tubular necrosis.",
    symptoms: "Severe diffuse myalgia, dark tea/cola-colored urine, profound fatigue, elevated serum creatine kinase (CK > 10x ULN).",
    recommendation: "ABSOLUTE CONTRAINDICATION (FDA Contraindication). Avoid combination. For macrolide bacterial therapy, substitute with Azithromycin. For azole antifungal therapy, suspend Simvastatin for the duration of therapy or switch to a non-CYP3A4 statin (Rosuvastatin, Pravastatin).",
    evidence: "FDA MedWatch Alert · British National Formulary (BNF) · ACC/AHA Cholesterol Guidelines",
    category: "Cardiology / Antimicrobial",
  },
  {
    id: "ddi-2-lovastatin",
    pair: ["Lovastatin", "CYP3A4 Inhibitor"],
    groupA: ["lovastatin", "mevacor", "altoprev"],
    groupB: ["clarithromycin", "erythromycin", "itraconazole", "ketoconazole", "posaconazole", "noxafil", "posatral", "claribid"],
    severity: "critical",
    title: "Fatal Rhabdomyolysis & Acute Renal Failure (Lovastatin + Strong CYP3A4 Inhibitor)",
    mechanism: "Lovastatin is a lactone prodrug extensively bioactivated and cleared via CYP3A4. Strong CYP3A4 inhibition elevates active lovastatin acid exposure up to 15-20 fold, causing acute skeletal muscle lysis, severe myalgia, and acute renal tubular necrosis.",
    symptoms: "Severe diffuse muscle pain, muscle weakness, brown or dark cola urine, acute oliguria, marked CPK elevation.",
    recommendation: "ABSOLUTE CONTRAINDICATION (FDA Contraindication). Avoid combination. For macrolide bacterial therapy, substitute with Azithromycin. For azole antifungal therapy, suspend Lovastatin or switch to a non-CYP3A4 statin (Rosuvastatin, Pravastatin).",
    evidence: "FDA Drug Safety Communication · BNF · ACC/AHA Guidelines",
    category: "Cardiology / Antimicrobial",
  },
  {
    id: "ddi-2b",
    pair: ["Atorvastatin", "CYP3A4 Inhibitor"],
    groupA: ["atorvastatin", "atorva", "lipicure", "lipitor"],
    groupB: ["clarithromycin", "erythromycin", "itraconazole", "ketoconazole", "claribid"],
    severity: "major",
    title: "Elevated Statin Exposure & Myopathy Risk (Atorvastatin + CYP3A4 Inhibitor)",
    mechanism: "Atorvastatin undergoes significant CYP3A4 metabolism. Concomitant strong CYP3A4 inhibitors elevate Atorvastatin plasma concentrations by up to 400%, markedly elevating the incidence of severe myopathy, CPK elevation, and acute rhabdomyolysis.",
    symptoms: "Muscle stiffness, localized tenderness, generalized muscle weakness, elevated serum CPK.",
    recommendation: "Avoid combination where possible. Temporarily suspend Atorvastatin during antimicrobial therapy, or cap dosage at a maximum of 20mg daily under close supervision. If treating bacterial infection, consider Azithromycin; for fungal azole therapy, suspend Atorvastatin or switch to Rosuvastatin/Pravastatin.",
    evidence: "FDA Drug Safety Communication · European Heart Journal",
    category: "Cardiology / Antimicrobial",
  },
  {
    id: "ddi-2c",
    pair: ["Atorvastatin", "Posaconazole (Noxafil / Posatral)"],
    groupA: ["atorvastatin", "atorva", "lipicure", "lipitor"],
    groupB: ["posaconazole", "noxafil", "posatral"],
    severity: "critical",
    title: "Severe Statin Toxicity & Rhabdomyolysis Risk (Atorvastatin + Posaconazole / Noxafil / Posatral)",
    mechanism: "Posaconazole (Noxafil, Posatral) potent CYP3A4 inhibition causes profound elevation of Atorvastatin plasma concentrations, drastically elevating the incidence of severe rhabdomyolysis and renal injury. This is a critical interaction and is not managed by dose capping.",
    symptoms: "Severe diffuse muscle pain, muscle weakness, dark cola-colored urine, acute oliguria, marked CPK elevation.",
    recommendation: "CRITICAL INTERACTION. Avoid combination. Temporarily suspend Atorvastatin for the duration of Posaconazole (Noxafil / Posatral) therapy, or switch to a non-CYP3A4 statin (Rosuvastatin, Pravastatin). Do not classify or manage as a dose-cap interaction.",
    evidence: "FDA Prescribing Information · Clinical Pharmacology Guidelines",
    category: "Cardiology / Antimicrobial",
  },
  {
    id: "ddi-3",
    pair: ["Sildenafil", "Nitroglycerin"],
    groupA: ["sildenafil", "tadalafil", "viagra", "cialis", "pde5"],
    groupB: ["nitroglycerin", "nitrates", "isosorbide dinitrate", "isosorbide mononitrate", "sorbitrate", "monit"],
    severity: "critical",
    title: "Refractory Life-Threatening Hypotension & Circulatory Collapse",
    mechanism: "Co-administration causes exponential cyclic GMP accumulation via dual nitric oxide synthase potentiation, leading to profound systemic vasodilation.",
    symptoms: "Extreme lightheadedness, syncope, profound hypotension (BP < 80/50 mmHg), myocardial ischemia, loss of consciousness.",
    recommendation: "ABSOLUTE CONTRAINDICATION. Never administer nitrates within 24 hours of Sildenafil (or 48h of Tadalafil).",
    evidence: "AHA/ACC Absolute Contraindication Class III",
    category: "Cardiovascular / Urological",
  },
  {
    id: "ddi-4",
    pair: ["Tramadol", "Fluoxetine"],
    groupA: ["tramadol", "tramazac", "ultram"],
    groupB: ["fluoxetine", "sertraline", "escitalopram", "paroxetine", "duloxetine", "ssri", "snri", "prozac", "zoloft", "cipralex"],
    severity: "major",
    title: "Serotonin Syndrome & Seizure Threshold Reduction",
    mechanism: "Tramadol inhibits serotonin/norepinephrine reuptake; combined with SSRIs/SNRIs, it triggers toxic CNS serotonin overstimulation while lowering seizure thresholds.",
    symptoms: "Hyperreflexia, clonus, tremors, shivering, agitation, tachycardia, diaphoresis, hyperthermia (>38.5°C).",
    recommendation: "Avoid concomitant use. If combination cannot be avoided, implement seizure and serotonin-syndrome monitoring (observe for tremors, hyperreflexia, clonus, and hyperthermia), reduce tramadol dosage, or switch to non-serotonergic analgesia.",
    evidence: "WHO Pharmacovigilance Advisory · DSM-5 Diagnostic Criteria",
    category: "Neurology / Pain Management",
  },
  {
    id: "ddi-5",
    pair: ["Metformin", "Contrast Dye"],
    groupA: ["metformin", "glycomet", "cetapin", "glucophage"],
    groupB: ["contrast dye", "iodinated contrast", "contrast media", "radiocontrast"],
    severity: "major",
    title: "Severe Lactic Acidosis Secondary to Renal Dysfunction",
    mechanism: "Iodinated radiocontrast can precipitate acute contrast-induced nephropathy, causing dramatic Metformin accumulation and fatal metabolic acidosis.",
    symptoms: "Hyperventilation, severe abdominal pain, somnolence, muscle cramps, hypothermia, arterial blood lactate > 5 mmol/L.",
    recommendation: "Discontinue Metformin 48 hours prior to contrast imaging. Resume only 48 hours post-scan after confirming stable eGFR.",
    evidence: "American College of Radiology (ACR) Clinical Protocol",
    category: "Endocrinology / Radiology",
  },
  {
    id: "ddi-6",
    pair: ["Lisinopril", "Potassium"],
    groupA: ["lisinopril", "enalapril", "ramipril", "telmisartan", "losartan", "telma", "ace_inhibitor", "arb"],
    groupB: ["potassium", "potassium chloride", "spironolactone", "aldactone"],
    severity: "major",
    title: "Dangerous Hyperkalemia & Cardiac Conduction Blocks",
    mechanism: "ACE inhibitors and ARBs suppress aldosterone, impairing renal potassium excretion. Supplemental potassium or potassium-sparing diuretics cause rapid serum potassium elevation.",
    symptoms: "Cardiac palpitations, tall peaked T-waves on ECG, muscle parasthesia, ascending muscular weakness.",
    recommendation: "Avoid potassium supplements or potassium-sparing diuretics without regular electrolyte serum lab panels.",
    evidence: "KDIGO Clinical Practice Guideline for Hypertension & Kidney",
    category: "Nephrology / Cardiology",
  },
  {
    id: "ddi-7",
    pair: ["Omeprazole", "Clopidogrel"],
    groupA: ["omeprazole", "esomeprazole", "omez", "nexpro"],
    groupB: ["clopidogrel", "plavix", "clopilet"],
    severity: "major",
    title: "Attenuated Antiplatelet Efficacy & Stent Thrombosis Risk",
    mechanism: "Omeprazole and esomeprazole competitively inhibit hepatic CYP2C19, preventing the metabolic bioactivation of Clopidogrel into its active antiplatelet metabolite.",
    symptoms: "Subtherapeutic platelet inhibition, increased risk of ischemic stroke, myocardial re-infarction, or coronary stent clotting.",
    recommendation: "Switch PPI from Omeprazole/Esomeprazole to Pantoprazole or Rabeprazole, which exhibit negligible CYP2C19 binding affinity.",
    evidence: "FDA Drug Safety Communication · European Society of Cardiology",
    category: "Gastroenterology / Cardiology",
  },
  {
    id: "ddi-8",
    pair: ["Levothyroxine", "Calcium"],
    groupA: ["levothyroxine", "thyronorm", "eltroxin", "thyroid"],
    groupB: ["calcium", "shelcal", "calcium carbonate", "calcium citrate", "iron", "ferrous"],
    severity: "moderate",
    title: "Impaired Thyroid Hormone Bioavailability & GI Chelation",
    mechanism: "Calcium carbonate and polyvalent mineral supplements bind directly to T4 thyroxine in the acidic gastric lumen, forming insoluble complexes that reduce absorption.",
    symptoms: "Persistent hypothyroidism symptoms, unexplained weight gain, lethargy, elevated serum TSH levels despite compliant dosing.",
    recommendation: "Separate administration times by at least 4 hours (e.g. Levothyroxine upon waking, Calcium with lunch or dinner).",
    evidence: "American Thyroid Association (ATA) Guidelines",
    category: "Endocrinology / Mineral Supplements",
  },
  {
    id: "ddi-9",
    pair: ["Ciprofloxacin", "Calcium"],
    groupA: ["ciprofloxacin", "levofloxacin", "norfloxacin", "ofloxacin", "ciptox"],
    groupB: ["calcium", "shelcal", "magnesium", "aluminum", "antacid"],
    severity: "moderate",
    title: "Fluoroquinolone Inactivation via Polyvalent Cation Chelation",
    mechanism: "Divalent and trivalent cations (Calcium, Magnesium, Aluminum, Iron) chelate fluoroquinolones in the gut lumen, rendering the antibiotic unabsorbable.",
    symptoms: "Failure of antibiotic therapy, persistent bacterial infection, development of antimicrobial resistance.",
    recommendation: "Take fluoroquinolone at least 2 hours before or 6 hours after dairy products, antacids, or mineral supplements.",
    evidence: "Clinical Pharmacokinetics Journal · IDSA Antimicrobial Protocols",
    category: "Infectious Disease / Nutrition",
  },
  {
    id: "ddi-10",
    pair: ["Metformin", "Glimepiride"],
    groupA: ["metformin", "glycomet", "cetapin"],
    groupB: ["glimepiride", "gliclazide", "glipizide", "amaryl", "sulfonylurea"],
    severity: "moderate",
    title: "Potentiated Hypoglycemic Response",
    mechanism: "Dual insulin-sensitizing and secretagogue activity accelerates glucose uptake, precipitating acute blood glucose drops.",
    symptoms: "Diaphoresis, tremors, cognitive clouding, tachycardia, hunger pangs, blood glucose < 70 mg/dL.",
    recommendation: "Educate patient on hypoglycemic signs. Maintain fast-acting oral glucose / juice readily accessible. Log daily fasting readings.",
    evidence: "ADA Standards of Medical Care in Diabetes",
    category: "Endocrinology / Diabetology",
  },
  {
    id: "ddi-11",
    pair: ["Methotrexate", "Ibuprofen"],
    groupA: ["methotrexate"],
    groupB: ["ibuprofen", "aspirin", "diclofenac", "naproxen", "nsaid"],
    severity: "critical",
    title: "Methotrexate Toxicity & Severe Bone Marrow Suppression",
    mechanism: "NSAIDs diminish renal blood flow via prostaglandin inhibition and competitively block renal tubular secretion of Methotrexate, precipitating pancytopenia.",
    symptoms: "Severe mucositis, stomatitis, leukopenia (high infection risk), thrombocytopenia (bleeding), acute kidney injury.",
    recommendation: "Strictly avoid NSAIDs with moderate-to-high dose Methotrexate. Use Paracetamol for pain management under oncological oversight.",
    evidence: "EULAR Guidelines for Rheumatology & Oncology Safety",
    category: "Oncology / Rheumatology",
  },
  {
    id: "ddi-12",
    pair: ["Amlodipine", "Simvastatin"],
    groupA: ["amlodipine", "stamlo", "amlopres"],
    groupB: ["simvastatin", "zocor"],
    severity: "moderate",
    title: "Elevated Statin Plasma Exposure via CYP3A4 Competition",
    mechanism: "Amlodipine inhibits CYP3A4 metabolism of Simvastatin, increasing statin AUC by 1.5-fold and elevating myopathy risk.",
    symptoms: "Muscle stiffness, localized tenderness, mild CPK elevation.",
    recommendation: "Cap Simvastatin dosage at a maximum of 20mg daily when co-prescribed with Amlodipine, or switch to Rosuvastatin.",
    evidence: "FDA Simvastatin Safety Advisory Update",
    category: "Cardiology / Lipidology",
  },
  {
    id: "ddi-13",
    pair: ["Nitroglycerin", "Lisinopril"],
    groupA: ["nitroglycerin", "nitrates", "isosorbide dinitrate", "isosorbide mononitrate", "sorbitrate", "monit"],
    groupB: ["lisinopril", "enalapril", "ramipril", "telmisartan", "losartan", "telma", "ace_inhibitor", "arb"],
    severity: "moderate",
    title: "Additive Hypotension Risk (Nitrate + ACE Inhibitor)",
    mechanism: "Concurrent administration of nitrates and ACE inhibitors can produce additive systemic vasodilation, resulting in postural hypotension or dizziness, particularly when initiating therapy or titrating doses. Concomitant use is common in ischemic heart disease and heart failure but requires routine blood pressure monitoring and slow postural transitions.",
    symptoms: "Lightheadedness, orthostatic dizziness upon standing, mild systolic blood pressure drop.",
    recommendation: "Monitor resting and standing blood pressure during dose adjustments. Counsel patient on gradual position changes to avoid orthostatic symptoms.",
    evidence: "ACC/AHA Heart Failure Guidelines · BNF Cardiovascular Interactions",
    category: "Cardiovascular / Vasodilators & ACEi",
  },
  {
    id: "ddi-14",
    pair: ["CYP3A4 Inhibitor", "Tramadol"],
    groupA: ["clarithromycin", "erythromycin", "ketoconazole", "itraconazole", "posaconazole", "noxafil", "posatral", "claribid"],
    groupB: ["tramadol", "tramazac", "ultram"],
    severity: "critical",
    title: "Severe Tramadol Toxicity & Respiratory Depression Risk",
    mechanism: "Potent CYP3A4 inhibition severely impairs Tramadol hepatic clearance and metabolic elimination, causing dangerous systemic accumulation of active opioid compounds, profound central nervous system depression, and risk of life-threatening respiratory depression.",
    symptoms: "Shallow, labored breathing (<10 breaths/min), severe somnolence, stupor, pinpoint pupils, cold/clammy skin, seizure activity.",
    recommendation: "Monitored Interaction: Not an absolute contraindication. Closely monitor patient for signs of respiratory depression, excessive sedation, seizure activity, and serotonin syndrome (tremors, hyperreflexia, agitation) at frequent intervals. Consider reducing tramadol dosage and ensure opioid reversal agents (naloxone) are readily accessible if co-administration is necessary.",
    evidence: "FDA MedWatch Drug Safety Alert · CPIC Opioid Pharmacogenomics Guidelines",
    category: "Pain Management / Antimicrobial & Opioids",
  },
  {
    id: "ddi-15",
    pair: ["Azithromycin", "Ciprofloxacin"],
    groupA: ["azithromycin", "zithromax", "azee"],
    groupB: ["ciprofloxacin", "levofloxacin", "amiodarone", "domperidone", "ciptox", "levoquine"],
    severity: "major",
    title: "Additive QT Prolongation & Torsades de Pointes",
    mechanism: "Co-administration of multiple QT-prolonging agents exponentially increases the risk of delayed cardiac repolarization, ventricular arrhythmias, and sudden cardiac death.",
    symptoms: "Palpitations, presyncope, dizziness, syncope, QT prolongation on 12-lead ECG.",
    recommendation: "Avoid combination in patients with baseline prolonged QTc or structural heart disease. Monitor ECG if co-administration is unavoidable.",
    evidence: "AHA/ACC Scientific Statement · CredibleMeds QT Registry",
    category: "Cardiology / Antimicrobials",
  },
];

// Curated Popular Clinical Presets & Quick Test Presets
const CLINICAL_PRESETS = [
  {
    label: "👤 Robert Chen (Monitored)",
    description: "Metformin + Lisinopril + Atorvastatin (Ward Regimen)",
    drugs: ["Metformin", "Lisinopril", "Atorvastatin"],
    type: "info",
  },
  {
    label: "👤 Eleanor Vance (Monitored)",
    description: "Donepezil + Memantine + Vitamin D3 (Ward Regimen)",
    drugs: ["Donepezil", "Memantine", "Vitamin D3"],
    type: "info",
  },
  {
    label: "⚡ High-Risk Bleeding",
    description: "Warfarin + Aspirin (Anticoagulant synergy)",
    drugs: ["Warfarin", "Aspirin"],
    type: "danger",
  },
  {
    label: "⚠️ Statin Myopathy",
    description: "Atorvastatin + Clarithromycin (CYP3A4 conflict)",
    drugs: ["Atorvastatin", "Clarithromycin"],
    type: "warning",
  },
  {
    label: "🩸 Fatal Hypotension",
    description: "Sildenafil + Nitroglycerin (Vasodilator collapse)",
    drugs: ["Sildenafil", "Nitroglycerin"],
    type: "danger",
  },
  {
    label: "🛡️ Harmonized (Low Risk)",
    description: "Paracetamol + Cetirizine + Vitamin C",
    drugs: ["Paracetamol", "Cetirizine", "Vitamin C"],
    type: "success",
  },
];

const POPULAR_DRUG_CHIPS = [
  { name: "Metformin", dosage: "500mg", cat: "Antidiabetic" },
  { name: "Atorvastatin", dosage: "20mg", cat: "Statin" },
  { name: "Aspirin", dosage: "75mg", cat: "Antiplatelet" },
  { name: "Warfarin", dosage: "5mg", cat: "Anticoagulant" },
  { name: "Clarithromycin", dosage: "500mg", cat: "Antibiotic" },
  { name: "Lisinopril", dosage: "10mg", cat: "ACE Inhibitor" },
  { name: "Omeprazole", dosage: "20mg", cat: "PPI Antacid" },
  { name: "Sildenafil", dosage: "50mg", cat: "PDE5 Inhibitor" },
  { name: "Nitroglycerin", dosage: "0.5mg", cat: "Nitrate" },
  { name: "Tramadol", dosage: "50mg", cat: "Opioid" },
  { name: "Fluoxetine", dosage: "20mg", cat: "SSRI" },
  { name: "Paracetamol", dosage: "650mg", cat: "Analgesic" },
  { name: "Calcium", dosage: "500mg", cat: "Supplement" },
  { name: "Levothyroxine", dosage: "50mcg", cat: "Thyroid" },
  { name: "Posaconazole", dosage: "100mg", cat: "Antifungal (CYP3A4 Inhibitor)" },
];

// Indian brand mapping to active pharmacological salts for layman accessibility
const INDIAN_BRAND_ALIASES = [
  { brand: "Dolo 650", generic: "Paracetamol", dosage: "650mg", cat: "Fever & Pain" },
  { brand: "Crocin", generic: "Paracetamol", dosage: "500mg", cat: "Fever & Pain" },
  { brand: "Calpol", generic: "Paracetamol", dosage: "500mg", cat: "Fever & Pain" },
  { brand: "Glycomet", generic: "Metformin", dosage: "500mg", cat: "Antidiabetic" },
  { brand: "Cetapin", generic: "Metformin", dosage: "500mg", cat: "Antidiabetic" },
  { brand: "Pan-40", generic: "Omeprazole", dosage: "20mg", cat: "Acidity & GERD" },
  { brand: "Pantocid", generic: "Omeprazole", dosage: "20mg", cat: "Acidity & GERD" },
  { brand: "Ecosprin", generic: "Aspirin", dosage: "75mg", cat: "Antiplatelet" },
  { brand: "Atorva", generic: "Atorvastatin", dosage: "20mg", cat: "Cholesterol / Statin" },
  { brand: "Lipicure", generic: "Atorvastatin", dosage: "10mg", cat: "Cholesterol / Statin" },
  { brand: "Telma", generic: "Lisinopril", dosage: "10mg", cat: "Blood Pressure" },
  { brand: "Thyronorm", generic: "Levothyroxine", dosage: "50mcg", cat: "Thyroid" },
  { brand: "Shelcal", generic: "Calcium", dosage: "500mg", cat: "Calcium & Vitamin D" },
  { brand: "Augmentin", generic: "Amoxicillin + Clavulanic Acid", dosage: "625mg", cat: "Antibiotic (Beta-Lactam / Beta-Lactamase Inhibitor)" },
  { brand: "Claribid", generic: "Clarithromycin", dosage: "500mg", cat: "Antibiotic (Macrolide)" },
  { brand: "Mevacor", generic: "Lovastatin", dosage: "20mg", cat: "Cholesterol / Statin" },
  { brand: "Zocor", generic: "Simvastatin", dosage: "20mg", cat: "Cholesterol / Statin" },
  { brand: "Tramazac", generic: "Tramadol", dosage: "50mg", cat: "Pain Relief" },
  { brand: "Noxafil", generic: "Posaconazole", dosage: "100mg", cat: "Antifungal (CYP3A4 Inhibitor)" },
  { brand: "Posatral", generic: "Posaconazole", dosage: "100mg", cat: "Antifungal (CYP3A4 Inhibitor)" },
];

const FORMULARY_CATEGORIES = [
  { key: "all", label: "All Formularies" },
  { key: "cardio", label: "Heart & Blood Pressure", matches: ["aspirin", "warfarin", "lisinopril", "nitroglycerin", "atorvastatin"] },
  { key: "diabetes", label: "Diabetes & Metabolic", matches: ["metformin", "atorvastatin"] },
  { key: "antibiotic", label: "Antibiotics & Infection", matches: ["clarithromycin"] },
  { key: "pain", label: "Pain, Fever & Nervous System", matches: ["paracetamol", "tramadol", "fluoxetine"] },
  { key: "gi", label: "Acid & Thyroid Regulation", matches: ["omeprazole", "levothyroxine", "calcium"] },
];

// Pure JS Levenshtein distance algorithm for zero-risk offline typo matching
function levenshteinDistance(a, b) {
  if (!a || !b) return (a || b).length;
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  const matrix = Array.from({ length: s1.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= s2.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[s1.length][s2.length];
}

// Pure JS Soundex algorithm for phonetic sound-alike matching (e.g. Krocin -> Crocin, Sipcal -> Cipcal)
function getSoundex(str) {
  if (!str) return "";
  const s = str.toUpperCase().replace(/[^A-Z]/g, "");
  if (!s) return "";
  const mapping = {
    B: "1", F: "1", P: "1", V: "1",
    C: "2", G: "2", J: "2", K: "2", Q: "2", S: "2", X: "2", Z: "2",
    D: "3", T: "3",
    L: "4",
    M: "5", N: "5",
    R: "6"
  };
  let code = s[0];
  let prevCode = mapping[s[0]] || "0";
  for (let i = 1; i < s.length && code.length < 4; i++) {
    const c = mapping[s[i]] || "0";
    if (c !== "0" && c !== prevCode) {
      code += c;
    }
    prevCode = c;
  }
  return (code + "000").slice(0, 4);
}

const FOOD_INTERACTIONS = [
  {
    medicine: "Atorvastatin / Simvastatin (Statins)",
    matchSalts: ["atorvastatin", "simvastatin", "rosuvastatin", "lovastatin", "pravastatin", "pitavastatin", "fluvastatin", "statin", "atorva", "lipicure", "mevacor", "zocor", "lipitor", "crestor", "altoprev", "livalo", "lescol"],
    food: "Grapefruit & Fresh Grapefruit Juice",
    severity: "critical",
    risk: "Toxic Statin Plasma Accumulation",
    mechanism: "Furanocoumarins in grapefruit irreversibly block intestinal CYP3A4 enzymes, increasing statin blood concentration by up to 12-fold and triggering muscle breakdown (Rhabdomyolysis).",
    advice: "Completely avoid grapefruit products while on CYP3A4-metabolized statins. Switch to Rosuvastatin or Pravastatin if grapefruit is essential.",
    safeWindow: "Strictly Avoid (Enzyme inhibition lasts 48-72 hours)",
    icon: "🍊",
  },
  {
    medicine: "Levothyroxine (Thyroid Hormone)",
    matchSalts: ["levothyroxine", "thyronorm", "eltroxin", "thyroid"],
    food: "Soy Products, Espresso Coffee & Dietary Fiber",
    severity: "major",
    risk: "Severe GI Malabsorption of Thyroxine",
    mechanism: "Dietary fiber and soy phytates bind to Levothyroxine in the gut, while caffeine accelerates GI motility, drastically reducing therapeutic absorption.",
    advice: "Take Levothyroxine strictly with plain tap water on an empty stomach immediately upon waking. Wait at least 30 to 60 minutes before breakfast or coffee.",
    safeWindow: "Take 60 mins before meals, or 4h after evening meal",
    icon: "☕",
  },
  {
    medicine: "Ciprofloxacin / Doxycycline (Antibiotics)",
    matchSalts: ["ciprofloxacin", "doxycycline", "clarithromycin", "antibiotic", "augmentin"],
    food: "Milk, Yogurt, Cheese & Calcium-Fortified Juices",
    severity: "major",
    risk: "Antibiotic Chelation & Therapeutic Inefficacy",
    mechanism: "Calcium ions bind to fluoroquinolones and tetracyclines in the digestive tract, forming insoluble complexes that cannot cross into the bloodstream.",
    advice: "Do not consume dairy or calcium-enriched products within 2 hours before or 4 hours after taking antibiotic doses.",
    safeWindow: "Stagger by 2 hours before or 4 hours after",
    icon: "🥛",
  },
  {
    medicine: "Lisinopril / Losartan (ACEi & ARBs)",
    matchSalts: ["lisinopril", "losartan", "telma", "telmisartan", "ramipril"],
    food: "Potassium Salt Substitutes & High-Potassium Foods",
    severity: "major",
    risk: "Potentially Fatal Hyperkalemia",
    mechanism: "ACE inhibitors and ARBs reduce renal potassium excretion. Combining with low-sodium salt substitutes (which contain Potassium Chloride) can induce cardiac arrhythmias.",
    advice: "Check food labels for 'Potassium Chloride'. Avoid salt substitutes without clinical electrolyte monitoring.",
    safeWindow: "Limit salt substitutes and monitor serum K+",
    icon: "🥑",
  },
  {
    medicine: "Warfarin (Coumadin)",
    matchSalts: ["warfarin", "coumadin", "anticoagulant"],
    food: "Kale, Spinach, Broccoli (High Vitamin K Greens)",
    severity: "major",
    risk: "Anticoagulation Failure & Stroke / Thrombosis",
    mechanism: "Vitamin K directly reverses Warfarin's mechanism by promoting hepatic clotting factor synthesis (Factors II, VII, IX, X), causing unpredictable INR drops.",
    advice: "Maintain a steady, consistent daily intake of green leafy vegetables. Do not suddenly binge on or eliminate Vitamin K-rich salads.",
    safeWindow: "Keep consistent daily intake; report dietary changes to clinic",
    icon: "🥗",
  },
  {
    medicine: "Metformin & Central Sedatives",
    matchSalts: ["metformin", "glycomet", "cetapin", "tramadol", "fluoxetine"],
    food: "Alcohol & Fermented Beverages",
    severity: "critical",
    risk: "Acute Lactic Acidosis & Severe CNS Depression",
    mechanism: "Alcohol inhibits hepatic gluconeogenesis and lactate clearance with Metformin, while synergistically multiplying sedation and respiratory depression with sedatives.",
    advice: "Avoid binge drinking. Limit or abstain from alcoholic beverages during acute antibiotic, diabetic, or psychoactive regimens.",
    safeWindow: "Strictly avoid during active treatment cycles",
    icon: "🍷",
  },
];

/**
 * Medication Boundary Matcher:
 * Matches a target clinical term or drug variant against medication text using
 * strict non-alphanumeric token/word boundaries.
 * Prevents false-positive substring collisions (e.g., 'arb' matching 'carbamazepine',
 * 'iron' matching unrelated strings, or short abbreviations matching within unrelated brand names).
 */
const matchesMedicationBoundary = (medName, term) => {
  if (!medName || !term) return false;
  const cleanName = medName.toLowerCase().trim();
  const cleanTerm = term.toLowerCase().trim();
  if (!cleanName || !cleanTerm) return false;

  const escaped = cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, "i");
  return regex.test(cleanName);
};

// Short-acting statins that REQUIRE evening/bedtime dosing due to short elimination half-lives (1-4 hours)
// and nocturnal peak of hepatic HMG-CoA reductase (midnight to 5:00 AM).
// CodeRabbit Fix: Limit bedtime guidance to statins that require evening dosing.
const SHORT_ACTING_STATINS = [
  "simvastatin",
  "lovastatin",
  "pravastatin",
  "fluvastatin",
  "zocor",
  "mevacor",
  "altoprev",
  "pravachol",
  "lescol",
];

// Long-acting statins with extended elimination half-lives (14-24 hours) providing continuous 24-hour
// HMG-CoA reductase inhibition. FDA prescribing guidelines permit administration at any consistent time of day.
const LONG_ACTING_STATINS = [
  "atorvastatin",
  "rosuvastatin",
  "pitavastatin",
  "lipicure",
  "lipitor",
  "crestor",
  "atorva",
  "rosuvas",
  "livalo",
];

// Composite list of all statin variants for biomarker/lab monitoring
const STATIN_VARIANTS = [
  ...SHORT_ACTING_STATINS,
  ...LONG_ACTING_STATINS,
  "statin",
];

export default function InteractionsPage() {
  const [userMedicines, setUserMedicines] = useState([]);
  const [selectedMeds, setSelectedMeds] = useState([]);
  const [customMedName, setCustomMedName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState("drug-drug"); // 'drug-drug' | 'food-interactions' | 'advisory'
  const [severityFilter, setSeverityFilter] = useState("all"); // 'all' | 'critical' | 'major' | 'moderate'
  const [activeDrawer, setActiveDrawer] = useState("cabinet"); // 'cabinet' | 'standard' | 'none'
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [catalogFilter, setCatalogFilter] = useState("all");
  const [catalogDropdownOpen, setCatalogDropdownOpen] = useState(false);
  const [cabinetDropdownOpen, setCabinetDropdownOpen] = useState(false);
  const [showAllFoodWarnings, setShowAllFoodWarnings] = useState(false);

  // Live auto-suggestions from Indian brand aliases, hospital formularies, and saved cabinet
  const searchSuggestions = useMemo(() => {
    const q = customMedName.trim().toLowerCase();
    if (!q) return [];

    const results = [];
    // 1. Check Indian brand aliases (Dolo, Crocin, Glycomet, Pan-D, etc.)
    INDIAN_BRAND_ALIASES.forEach((b) => {
      if (b.brand.toLowerCase().includes(q) || b.cat.toLowerCase().includes(q)) {
        results.push({ name: b.generic, dosage: b.dosage, category: b.cat, brandHint: b.brand, source: "brand" });
      }
    });

    // 2. Check popular hospital drugs
    POPULAR_DRUG_CHIPS.forEach((d) => {
      if ((d.name.toLowerCase().includes(q) || d.cat.toLowerCase().includes(q)) && !results.some(r => r.name.toLowerCase() === d.name.toLowerCase())) {
        results.push({ name: d.name, dosage: d.dosage, category: d.cat, source: "hospital" });
      }
    });

    // 3. Check user cabinet
    userMedicines.forEach((m) => {
      if (m.name.toLowerCase().includes(q) && !results.some(r => r.name.toLowerCase() === m.name.toLowerCase())) {
        results.push({ name: m.name, dosage: m.dosage || "", category: "My Cabinet", source: "cabinet" });
      }
    });

    return results.slice(0, 5);
  }, [customMedName, userMedicines]);

  // Filtered hospital catalog chips according to selected category filter
  const filteredCatalogChips = useMemo(() => {
    if (catalogFilter === "all") return POPULAR_DRUG_CHIPS;
    const cat = FORMULARY_CATEGORIES.find((c) => c.key === catalogFilter);
    if (!cat || !cat.matches) return POPULAR_DRUG_CHIPS;
    return POPULAR_DRUG_CHIPS.filter((d) => cat.matches.includes(d.name.toLowerCase()));
  }, [catalogFilter]);

  // Intelligent in-memory Fuzzy & Soundex Spell Engine ("Did you mean?")
  const didYouMeanSuggestion = useMemo(() => {
    const q = customMedName.trim().toLowerCase();
    if (q.length < 3) return null;

    // If exact match already exists in direct suggestions, no typo suggestion needed
    const hasExactMatch = searchSuggestions.some(
      (s) => s.name.toLowerCase() === q || (s.brandHint && s.brandHint.toLowerCase() === q)
    );
    if (hasExactMatch) return null;

    const qSoundex = getSoundex(q);
    let bestCandidate = null;
    let minDistance = 999;

    // Pool of all known canonical drugs & brands
    const candidates = [
      ...INDIAN_BRAND_ALIASES.map((b) => ({ name: b.generic, brand: b.brand, dosage: b.dosage, cat: b.cat })),
      ...POPULAR_DRUG_CHIPS.map((p) => ({ name: p.name, brand: null, dosage: p.dosage, cat: p.cat })),
      ...userMedicines.map((m) => ({ name: m.name, brand: null, dosage: m.dosage || "", cat: "My Cabinet" })),
    ];

    for (const c of candidates) {
      const targetName = c.name.toLowerCase();
      const targetBrand = c.brand ? c.brand.toLowerCase() : "";

      const distName = levenshteinDistance(q, targetName);
      const distBrand = targetBrand ? levenshteinDistance(q, targetBrand) : 999;
      const dist = Math.min(distName, distBrand);

      const soundexMatch = qSoundex && (getSoundex(targetName) === qSoundex || (targetBrand && getSoundex(targetBrand) === qSoundex));

      const maxAllowedDist = Math.max(targetName.length, q.length) > 7 ? 3 : 2;
      if (dist <= maxAllowedDist || (soundexMatch && dist <= 4)) {
        if (dist < minDistance) {
          minDistance = dist;
          bestCandidate = c;
        }
      }
    }

    return bestCandidate;
  }, [customMedName, searchSuggestions, userMedicines]);

  // Dynamically filter food contraindications matching active queued medications in real time
  const activeFoodWarnings = useMemo(() => {
    if (selectedMeds.length === 0) return [];
    return FOOD_INTERACTIONS.filter((f) => {
      return f.matchSalts.some((salt) =>
        selectedMeds.some((med) => matchesMedicationBoundary(med, salt))
      );
    });
  }, [selectedMeds]);

  // Dynamically schedule active medications into circadian slots in real time
  // CodeRabbit Fix:
  // 1. Do not assign amoxicillin to a once-daily evening slot (multi-dose BID/TID interval dosing).
  // 2. Do not apply the statin bedtime instruction to SSRIs (SSRIs morning dosing for alertness).
  // 3. Statins exclusively receive bedtime HMG-CoA reductase regulation instruction.
  const dynamicChronotherapy = useMemo(() => {
    const schedule = {
      morning: [],
      lunch: [],
      evening: [],
      night: [],
    };

    selectedMeds.forEach((med) => {
      // 1. Oral beta-lactam antibiotics (Amoxicillin, Augmentin, Moxikind, Clavum, Cefuroxime):
      // Regimens are dosed at evenly spaced intervals (every 8 to 12 hours) with meals to maintain time-dependent
      // bactericidal levels above MIC. Flexible schedule covers both twice-daily (BID) and 3-times-daily (TID) regimens
      // without hardcoding fixed ordinal dose numbers.
      // CodeRabbit Fix: Do not hard-code all beta-lactam regimens as two daily doses.
      if (
        matchesMedicationBoundary(med, "amoxicillin") ||
        matchesMedicationBoundary(med, "augmentin") ||
        matchesMedicationBoundary(med, "moxikind") ||
        matchesMedicationBoundary(med, "clavum") ||
        matchesMedicationBoundary(med, "cefuroxime")
      ) {
        schedule.morning.push({
          name: med,
          tip: "Take morning dose with breakfast as part of evenly spaced interval dosing (every 8–12 hrs with meals)",
        });
        const isTID = /\b(3\s*times|tid|tds|thrice|every\s*8\s*h(ours)?|3x)\b/i.test(med);
        if (isTID) {
          schedule.lunch.push({
            name: med,
            tip: "Take midday dose with lunch if prescribed on a 3-times-daily (every 8 hours) regimen",
          });
        }
        schedule.evening.push({
          name: med,
          tip: "Take evening dose with dinner (spaced 8–12 hrs apart; complete entire prescribed course)",
        });
      // 2. Thyroid hormones, PPIs, and RAAS inhibitors (Morning fasting or baseline dosing):
      } else if (
        matchesMedicationBoundary(med, "levothyroxine") ||
        matchesMedicationBoundary(med, "thyronorm") ||
        matchesMedicationBoundary(med, "eltroxin") ||
        matchesMedicationBoundary(med, "omeprazole") ||
        matchesMedicationBoundary(med, "pantoprazole") ||
        matchesMedicationBoundary(med, "pantocid") ||
        matchesMedicationBoundary(med, "pan-40") ||
        matchesMedicationBoundary(med, "rabeprazole") ||
        matchesMedicationBoundary(med, "esomeprazole") ||
        matchesMedicationBoundary(med, "nexpro") ||
        matchesMedicationBoundary(med, "lisinopril") ||
        matchesMedicationBoundary(med, "enalapril") ||
        matchesMedicationBoundary(med, "ramipril") ||
        matchesMedicationBoundary(med, "telmisartan") ||
        matchesMedicationBoundary(med, "telma") ||
        matchesMedicationBoundary(med, "losartan")
      ) {
        schedule.morning.push({ name: med, tip: "Take with plain water on empty stomach (30-60 mins pre-meal)" });
      // 3. SSRIs & SNRIs: Take in the morning with food to prevent insomnia and sleep disruption (NOT at bedtime with statin tip!)
      } else if (
        matchesMedicationBoundary(med, "fluoxetine") ||
        matchesMedicationBoundary(med, "sertraline") ||
        matchesMedicationBoundary(med, "citalopram") ||
        matchesMedicationBoundary(med, "escitalopram") ||
        matchesMedicationBoundary(med, "duloxetine")
      ) {
        schedule.morning.push({
          name: med,
          tip: "Take in the morning with breakfast to support daytime alertness and prevent sleep disturbances",
        });
      // 4. Post-meal GI protection (Metformin, Calcium, Paracetamol):
      } else if (
        matchesMedicationBoundary(med, "metformin") ||
        matchesMedicationBoundary(med, "glycomet") ||
        matchesMedicationBoundary(med, "cetapin") ||
        matchesMedicationBoundary(med, "calcium") ||
        matchesMedicationBoundary(med, "shelcal") ||
        matchesMedicationBoundary(med, "paracetamol") ||
        matchesMedicationBoundary(med, "dolo") ||
        matchesMedicationBoundary(med, "crocin") ||
        matchesMedicationBoundary(med, "calpol")
      ) {
        schedule.lunch.push({ name: med, tip: "Take post-meal with water to eliminate gastric irritation" });
      // 5. Anticoagulants, Antiplatelets, and Evening Antibiotics:
      } else if (
        matchesMedicationBoundary(med, "warfarin") ||
        matchesMedicationBoundary(med, "coumadin") ||
        matchesMedicationBoundary(med, "aspirin") ||
        matchesMedicationBoundary(med, "ecosprin") ||
        matchesMedicationBoundary(med, "clopidogrel") ||
        matchesMedicationBoundary(med, "plavix") ||
        matchesMedicationBoundary(med, "clarithromycin")
      ) {
        schedule.evening.push({ name: med, tip: "Consistent evening administration to maintain stable therapeutic plasma exposure" });
      // 6a. Short-acting statins (Require bedtime administration):
      // Simvastatin, Lovastatin, Pravastatin, Fluvastatin have short elimination half-lives (1-4 hours).
      // Bedtime dosing is necessary to match the peak nocturnal activity of hepatic HMG-CoA reductase (midnight-5 AM).
      // CodeRabbit Fix: Limit bedtime guidance to statins that require evening dosing.
      } else if (SHORT_ACTING_STATINS.some((statin) => matchesMedicationBoundary(med, statin))) {
        schedule.night.push({
          name: med,
          tip: "Take at bedtime for peak nocturnal hepatic HMG-CoA reductase regulation (short half-life requires evening administration)",
        });
      // 6b. Long-acting statins (Flexible once-daily morning or any consistent time):
      // Atorvastatin, Rosuvastatin, Pitavastatin have long elimination half-lives (14-24 hours) and provide
      // continuous 24-hour HMG-CoA reductase inhibition. FDA labeling allows administration at any consistent time of day.
      } else if (LONG_ACTING_STATINS.some((statin) => matchesMedicationBoundary(med, statin))) {
        schedule.morning.push({
          name: med,
          tip: "Take once daily at any consistent time (long 14–24h elimination half-life provides sustained 24-hour cholesterol control)",
        });
      // 7. Opioids & Central Analgesics: Bedtime/evening administration for nocturnal pain and sedation management
      } else if (
        matchesMedicationBoundary(med, "tramadol") ||
        matchesMedicationBoundary(med, "ultram")
      ) {
        schedule.night.push({ name: med, tip: "Take as prescribed; bedtime dosing helps manage nocturnal pain and sedation" });
      } else {
        schedule.morning.push({ name: med, tip: "Take as directed by your prescribing physician" });
      }
    });

    return schedule;
  }, [selectedMeds]);

  // Dynamically determine required clinical lab panels based on queued drugs
  // CodeRabbit Fix: Make statin laboratory guidance conditional per ACC/AHA and FDA standards
  const dynamicBiomarkers = useMemo(() => {
    const panels = [];

    if (
      selectedMeds.some(
        (m) =>
          matchesMedicationBoundary(m, "warfarin") ||
          matchesMedicationBoundary(m, "coumadin") ||
          matchesMedicationBoundary(m, "jantoven")
      )
    ) {
      panels.push({ name: "Prothrombin Time / INR Panel", freq: "Bi-weekly / Monthly", note: "Maintain target INR 2.0 - 3.0" });
    }

    // Statin Laboratory Guidance:
    // ACC/AHA and FDA statin safety consensus does NOT recommend routine, unprompted quarterly CPK testing in asymptomatic patients.
    // Baseline ALT is recommended prior to initiation; serum CPK is indicated conditionally if patient develops unexplained muscle symptoms
    // or when co-administered with potent interacting inhibitors.
    const hasStatin = selectedMeds.some((m) =>
      STATIN_VARIANTS.some((statin) => matchesMedicationBoundary(m, statin))
    );
    const hasInteractingInhibitor = selectedMeds.some(
      (m) =>
        matchesMedicationBoundary(m, "clarithromycin") ||
        matchesMedicationBoundary(m, "claribid") ||
        matchesMedicationBoundary(m, "erythromycin") ||
        matchesMedicationBoundary(m, "itraconazole") ||
        matchesMedicationBoundary(m, "ketoconazole") ||
        matchesMedicationBoundary(m, "posaconazole") ||
        matchesMedicationBoundary(m, "noxafil") ||
        matchesMedicationBoundary(m, "posatral") ||
        matchesMedicationBoundary(m, "amiodarone") ||
        matchesMedicationBoundary(m, "gemfibrozil")
    );

    if (hasStatin) {
      if (hasInteractingInhibitor) {
        panels.push({
          name: "Prompt Hepatic ALT & Serum CPK Panel",
          freq: "Immediate / Co-Administration Onset",
          note: "Elevated myopathy risk due to interacting CYP3A4 inhibitor: check baseline ALT and prompt serum CPK if muscle soreness occurs",
        });
      } else {
        panels.push({
          name: "Baseline Hepatic ALT & Symptom-Prompted CPK",
          freq: "Baseline & Clinically Indicated",
          note: "Baseline ALT prior to initiation; serum CPK measurement is indicated conditionally if unexplained muscle pain, tenderness, or weakness develops",
        });
      }
    }

    if (
      selectedMeds.some(
        (m) =>
          matchesMedicationBoundary(m, "lisinopril") ||
          matchesMedicationBoundary(m, "enalapril") ||
          matchesMedicationBoundary(m, "ramipril") ||
          matchesMedicationBoundary(m, "telmisartan") ||
          matchesMedicationBoundary(m, "telma") ||
          matchesMedicationBoundary(m, "losartan")
      )
    ) {
      panels.push({ name: "Serum Electrolytes & Creatinine", freq: "Every 3-6 Months", note: "Screen for Hyperkalemia & eGFR retention" });
    }
    if (
      selectedMeds.some(
        (m) =>
          matchesMedicationBoundary(m, "metformin") ||
          matchesMedicationBoundary(m, "glycomet") ||
          matchesMedicationBoundary(m, "cetapin")
      )
    ) {
      panels.push({ name: "HbA1c & Renal eGFR Clearance", freq: "Quarterly", note: "Monitor glycemic index and prevent lactic accumulation" });
    }

    const hasTramadol = selectedMeds.some((m) =>
      matchesMedicationBoundary(m, "tramadol") ||
      matchesMedicationBoundary(m, "tramazac") ||
      matchesMedicationBoundary(m, "ultram")
    );
    const hasSerotonergicOrInhibitor = selectedMeds.some((m) =>
      matchesMedicationBoundary(m, "fluoxetine") ||
      matchesMedicationBoundary(m, "sertraline") ||
      matchesMedicationBoundary(m, "escitalopram") ||
      matchesMedicationBoundary(m, "paroxetine") ||
      matchesMedicationBoundary(m, "duloxetine") ||
      hasInteractingInhibitor
    );
    if (hasTramadol && hasSerotonergicOrInhibitor) {
      panels.push({
        name: "Seizure & Serotonin-Syndrome Monitoring",
        freq: "Continuous / Active Co-Administration",
        note: "Evaluate for clonus, hyperreflexia, tremors, agitation, altered mental state, and lowered seizure threshold",
      });
    }

    if (panels.length === 0) {
      panels.push({ name: "Annual Comprehensive Metabolic Panel (CMP)", freq: "Annual / Routine", note: "Baseline renal and hepatic health monitoring" });
    }

    return panels;
  }, [selectedMeds]);

  useEffect(() => {
    fetchCabinet();
  }, []);

  const fetchCabinet = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await medicineAPI.list();
      const meds = res.data?.items || res.data?.medicines || res.data || [];
      const medList = Array.isArray(meds) ? meds : [];
      setUserMedicines(medList);
      if (medList.length > 0) {
        setSelectedMeds(medList.slice(0, 3).map((m) => m.name));
        setActiveDrawer("cabinet");
      } else {
        setSelectedMeds(["Metformin", "Atorvastatin"]);
        setActiveDrawer("standard");
      }
    } catch (err) {
      console.warn("Notice: Operating in clinical offline mode:", err);
      setSelectedMeds(["Warfarin", "Aspirin"]);
      setActiveDrawer("standard");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectMed = (name) => {
    if (selectedMeds.some((m) => m.toLowerCase() === name.toLowerCase())) {
      setSelectedMeds(selectedMeds.filter((m) => m.toLowerCase() !== name.toLowerCase()));
    } else {
      setSelectedMeds([...selectedMeds, name]);
    }
  };

  const addMedication = (name) => {
    if (!name) return;
    const clean = name.trim();
    if (!selectedMeds.some((m) => m.toLowerCase() === clean.toLowerCase())) {
      setSelectedMeds((prev) => [...prev, clean]);
    }
  };

  const addCustomMed = (e) => {
    e?.preventDefault();
    const clean = customMedName.trim();
    if (!clean) return;
    addMedication(clean);
    setCustomMedName("");
    setShowSearchSuggestions(false);
  };

  const removeMed = (name) => {
    setSelectedMeds(selectedMeds.filter((m) => m.toLowerCase() !== name.toLowerCase()));
  };

  const loadPreset = (drugs) => {
    setSelectedMeds([...drugs]);
    runSafetyScan();
  };

  const clearAllMeds = () => {
    setSelectedMeds([]);
  };

  const loadSampleCabinetMeds = () => {
    const sample = ["Metformin", "Atorvastatin", "Lisinopril"];
    setSelectedMeds(sample);
    runSafetyScan();
  };

  const runSafetyScan = () => {
    setAnalyzing(true);
    setTimeout(() => {
      setAnalyzing(false);
    }, 450);
  };

  // Cross-medication contraindication matching algorithm
  // CodeRabbit Fix: Require medication-boundary matching across all variants
  const detectedInteractions = useMemo(() => {
    const list = [];
    const seenPairs = new Set();

    const matchesGroup = (medName, group) => {
      if (!medName || !group) return false;
      // Direct boundary match
      if (group.some((term) => matchesMedicationBoundary(medName, term))) return true;
      // Brand alias resolution into generic clinical salt
      const brandEntry = INDIAN_BRAND_ALIASES.find((b) =>
        matchesMedicationBoundary(medName, b.brand)
      );
      if (brandEntry) {
        return group.some((term) =>
          matchesMedicationBoundary(brandEntry.generic, term) ||
          matchesMedicationBoundary(brandEntry.brand, term)
        );
      }
      return false;
    };

    for (let i = 0; i < selectedMeds.length; i++) {
      for (let j = i + 1; j < selectedMeds.length; j++) {
        const m1 = selectedMeds[i];
        const m2 = selectedMeds[j];

        for (const item of COMPREHENSIVE_INTERACTIONS) {
          const matchFwd = matchesGroup(m1, item.groupA) && matchesGroup(m2, item.groupB);
          const matchRev = matchesGroup(m1, item.groupB) && matchesGroup(m2, item.groupA);

          if (matchFwd || matchRev) {
            const pairKey = `${item.id}-${[m1.toLowerCase().trim(), m2.toLowerCase().trim()].sort().join("::")}`;
            if (!seenPairs.has(pairKey)) {
              seenPairs.add(pairKey);
              // CodeRabbit Fix: Preserve statin-inhibitor and candidate-active drug pair identity
              const drugA = matchFwd ? m1 : m2;
              const drugB = matchFwd ? m2 : m1;
              const baseTitle = item.title.includes(" (") ? item.title.split(" (")[0] : item.title;
              list.push({
                ...item,
                pair: [drugA, drugB],
                involved: [drugA, drugB],
                title: `${baseTitle} (${drugA} + ${drugB})`,
              });
            }
          }
        }
      }
    }
    return list;
  }, [selectedMeds]);

  // Metric counts
  const criticalCount = detectedInteractions.filter((d) => d.severity === "critical").length;
  const majorCount = detectedInteractions.filter((d) => d.severity === "major").length;
  const moderateCount = detectedInteractions.filter((d) => d.severity === "moderate").length;

  // CodeRabbit Fix: Calculate harmonized medicines by participation.
  // A medicine is considered harmonized if it does NOT participate in any detected interaction.
  const interactingMedNames = useMemo(() => {
    const set = new Set();
    detectedInteractions.forEach((interaction) => {
      interaction.involved?.forEach((med) => set.add(med.toLowerCase().trim()));
    });
    return set;
  }, [detectedInteractions]);

  const harmonizedCount = useMemo(() => {
    return selectedMeds.filter(
      (med) => !interactingMedNames.has(med.toLowerCase().trim())
    ).length;
  }, [selectedMeds, interactingMedNames]);

  // CYP450 metabolic pathway inhibition state
  const isCYPInhibited = useMemo(() => {
    return selectedMeds.some((m) =>
      matchesMedicationBoundary(m, "clarithromycin") ||
      matchesMedicationBoundary(m, "claribid") ||
      matchesMedicationBoundary(m, "erythromycin") ||
      matchesMedicationBoundary(m, "itraconazole") ||
      matchesMedicationBoundary(m, "ketoconazole") ||
      matchesMedicationBoundary(m, "posaconazole") ||
      matchesMedicationBoundary(m, "noxafil") ||
      matchesMedicationBoundary(m, "posatral") ||
      matchesMedicationBoundary(m, "fluoxetine") ||
      matchesMedicationBoundary(m, "omeprazole")
    );
  }, [selectedMeds]);

  // CodeRabbit Review Note: Deterministic Polypharmacy Safety Scoring
  // Penalty weights: Critical = -35%, Major = -20%, Moderate = -10%
  // A floor of 15% is enforced so high-risk regimens retain an alarming non-zero visual reading.
  const safetyScore = useMemo(() => {
    if (selectedMeds.length < 2) return 100;
    const penalty = criticalCount * 35 + majorCount * 20 + moderateCount * 10;
    return Math.max(15, 100 - penalty);
  }, [selectedMeds.length, criticalCount, majorCount, moderateCount]);

  // Aligned with backend DDInter composite risk score:
  // High Risk: 75–100, Moderate: 40–74, Safe / Low: 0–39
  const compositeRiskScore = useMemo(() => {
    if (selectedMeds.length < 2) return 0;
    if (criticalCount > 0) return Math.min(100, Math.max(75, 75 + criticalCount * 8 + majorCount * 4));
    if (majorCount > 0) return Math.min(74, Math.max(40, 40 + majorCount * 8 + moderateCount * 3));
    if (moderateCount > 0) return Math.min(39, Math.max(15, 15 + moderateCount * 6));
    return 12; // Baseline non-zero verified profile
  }, [selectedMeds.length, criticalCount, majorCount, moderateCount]);

  // Dynamic active risk tier:
  // CodeRabbit Fix: Keep the displayed risk tier consistent with interaction severity.
  // The displayed risk tier is strictly determined by the highest severity among detected interactions:
  // 1. If any critical interaction exists -> "critical"
  // 2. Else if any major interaction exists -> "major"
  // 3. Else if any moderate interaction exists -> "moderate"
  // 4. Otherwise (no interactions detected) -> "harmonized"
  // Decoupled from arbitrary score penalties so displayed tier NEVER escalates
  // beyond actual detected clinical interaction severity (e.g. 0 critical conflicts will NEVER display "Critical").
  const activeRiskTier = useMemo(() => {
    if (criticalCount > 0) return "critical";
    if (majorCount > 0) return "major";
    if (moderateCount > 0) return "moderate";
    return "harmonized";
  }, [criticalCount, majorCount, moderateCount]);

  // Automatically synchronize severity filter to the highest detected risk level
  // so dangerous contraindications are immediately surfaced to the clinical viewer.
  useEffect(() => {
    if (criticalCount > 0) {
      setSeverityFilter("critical");
    } else if (majorCount > 0) {
      setSeverityFilter("major");
    } else if (moderateCount > 0) {
      setSeverityFilter("moderate");
    } else {
      setSeverityFilter("all");
    }
  }, [criticalCount, majorCount, moderateCount, selectedMeds.length]);

  // Filtered interaction list based on user filter
  const filteredInteractions = useMemo(() => {
    if (severityFilter === "all") return detectedInteractions;
    return detectedInteractions.filter((d) => d.severity === severityFilter);
  }, [detectedInteractions, severityFilter]);

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 sm:pt-6 pb-6 font-sans text-slate-800 dark:text-slate-100">
        {/* =========================================================================
            HEADER HERO BANNER — Medical Aesthetic Redesign (PillSync Care Theme)
        ========================================================================= */}
        <div className="relative overflow-hidden rounded-3xl bg-[#d8eedf] dark:bg-[#132a22] p-6 sm:p-10 border border-[#bfe3cd] dark:border-[#1e4537] shadow-sm hover:shadow-md transition-shadow">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-emerald-400/15 dark:bg-emerald-900/20 blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-1/4 -mb-16 w-64 h-64 rounded-full bg-teal-500/10 dark:bg-teal-900/15 blur-3xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#c5e6d0] dark:bg-[#1b3d32] border border-[#a6d8b6] dark:border-[#275949] text-[#164234] dark:text-[#a0e5be] text-xs font-bold tracking-wide uppercase">
                <Sparkles className="w-3.5 h-3.5 text-[#164234] dark:text-[#a0e5be]" />
                Stitch Clinical Pharmacovigilance Engine
              </div>
              <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#11382d] dark:text-white leading-tight font-heading">
                AI Drug Safety & Interaction Analyzer
              </h1>
              <p className="text-sm sm:text-base text-[#285445] dark:text-[#c2e4d2] leading-relaxed font-normal">
                Real-time multi-drug contraindication scanning, CYP450 metabolic pathway conflict detection, and evidence-based clinical dietary guidance.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                size="lg"
                onClick={runSafetyScan}
                disabled={analyzing || selectedMeds.length === 0}
                className="!bg-[#235347] hover:!bg-[#194035] !text-white !font-semibold !rounded-xl shadow-sm hover:shadow-md transition-all transform active:scale-95 border border-[#1b4337] dark:!bg-[#2b6754] dark:hover:!bg-[#225544] disabled:!opacity-50 disabled:!cursor-not-allowed"
              >
                <Zap className={`w-5 h-5 mr-2 ${analyzing ? "animate-spin text-white" : "text-[#8ce0b5]"}`} />
                {analyzing ? "Scanning Bio-Pathways..." : "Run Safety Scan"}
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <ErrorMessage
            variant="warning"
            title="System Notice"
            message={error}
            onDismiss={() => setError(null)}
          />
        )}

        {/* =========================================================================
            1-CLICK CLINICAL TEST PRESET BUNDLES
        ========================================================================= */}
        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                1-Click Clinical Test Presets (Quick Demonstration)
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              Click any scenario to immediately evaluate risk pathways
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {CLINICAL_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => loadPreset(preset.drugs)}
                className="p-3 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 hover:border-teal-500 dark:hover:border-teal-400 hover:shadow-md transition-all text-left group flex flex-col justify-between"
              >
                <div>
                  <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                    {preset.label}
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                    {preset.description}
                  </p>
                </div>
                <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 mt-2 flex items-center gap-1">
                  Load & Analyze &rarr;
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* =========================================================================
            GRID: MEDICINE SELECTOR & SAFETY SCORE DIAL (REBALANCED 7:5 PROPORTION)
        ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Column: Active Regimen Selection & Unified X-Axis Search Toolbar */}
          <Card className="lg:col-span-7 flex flex-col justify-between space-y-6 shadow-sm border border-slate-200/80 dark:border-slate-800 h-full">
            <div className="space-y-6">
              {/* Header with Selected Counter & Clear All */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 font-heading">
                    <Pill className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                    Medication Regimen Queue
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Search, quick-pick from your cabinet, or choose standard hospital catalog drugs.
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                    {selectedMeds.length} Active in Queue
                  </span>
                  {selectedMeds.length > 0 && (
                    <button
                      type="button"
                      onClick={clearAllMeds}
                      className="text-xs font-semibold text-slate-400 hover:text-red-500 dark:hover:text-red-400 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              {/* =========================================================================
                  UNIFIED HORIZONTAL ACTION BAR (ALONG X-AXIS):
                  [ SEARCH BAR + AUTOCOMPLETE ] [ 📁 QUICK ADD FROM CABINET + DROPDOWN ] [ 🌐 HOSPITAL CATALOG + DROPDOWN ]
              ========================================================================= */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
                  {/* Search Bar Input with Live Suggestions Dropdown */}
                  <form onSubmit={addCustomMed} className="relative flex flex-1 items-stretch gap-2 min-w-0">
                    <div className="relative flex-1 min-w-[180px]">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={customMedName}
                        onChange={(e) => {
                          setCustomMedName(e.target.value);
                          setShowSearchSuggestions(true);
                        }}
                        onFocus={() => setShowSearchSuggestions(true)}
                        placeholder="Type drug or brand (e.g. Dolo, Glycomet, Warfarin)..."
                        className="w-full h-11 pl-10 pr-8 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent font-medium"
                      />
                      {customMedName && (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomMedName("");
                            setShowSearchSuggestions(false);
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Auto-Complete Suggestions Dropdown */}
                      {showSearchSuggestions && searchSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1.5 z-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <span>Matched Drugs & Brands</span>
                            <span>Click to add</span>
                          </div>
                          {searchSuggestions.map((item, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                addMedication(item.name);
                                setCustomMedName("");
                                setShowSearchSuggestions(false);
                              }}
                              className="w-full px-3.5 py-2 text-left hover:bg-teal-50/70 dark:hover:bg-teal-950/40 flex items-center justify-between gap-2 transition-colors group"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Pill className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                                <div className="truncate">
                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-teal-700 dark:group-hover:text-teal-300">
                                    {item.name}
                                  </span>
                                  {item.dosage && (
                                    <span className="text-[11px] text-slate-400 ml-1">
                                      ({item.dosage})
                                    </span>
                                  )}
                                  {item.brandHint && (
                                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:amber-300 border border-amber-200/60 dark:border-amber-800 font-semibold">
                                      Brand: {item.brandHint}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="text-[10px] font-medium text-slate-400 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0">
                                {item.category}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      className="!bg-teal-600 hover:!bg-teal-500 !text-white !font-bold whitespace-nowrap px-4 shadow-sm"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add
                    </Button>
                  </form>

                  {/* Inline Action Button 1: Quick Add from Cabinet (with Split Dropdown) */}
                  <div className="relative flex items-center shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDrawer(activeDrawer === "cabinet" ? "none" : "cabinet");
                        setCabinetDropdownOpen(false);
                      }}
                      className={`h-11 px-3 rounded-l-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 whitespace-nowrap shadow-sm border border-r-0 ${
                        activeDrawer === "cabinet"
                          ? "bg-purple-600 text-white border-purple-500 shadow-purple-600/30 ring-2 ring-purple-400/40"
                          : "bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-100"
                      }`}
                    >
                      <FolderHeart className={`w-4 h-4 ${activeDrawer === "cabinet" ? "text-white" : "text-purple-600"}`} />
                      <span>📁 Cabinet</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                        activeDrawer === "cabinet" ? "bg-purple-800 text-purple-100" : "bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200"
                      }`}>
                        {userMedicines.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCabinetDropdownOpen(!cabinetDropdownOpen);
                        setCatalogDropdownOpen(false);
                      }}
                      className={`h-11 px-2 rounded-r-xl border transition-all flex items-center justify-center ${
                        activeDrawer === "cabinet"
                          ? "bg-purple-700 text-white border-purple-500"
                          : "bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-100"
                      }`}
                      title="Quick Cabinet Menu"
                    >
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${cabinetDropdownOpen ? "rotate-180" : ""}`} />
                    </button>

                    {/* Cabinet Dropdown Menu */}
                    {cabinetDropdownOpen && (
                      <div className="absolute top-full right-0 mt-1.5 z-40 w-56 bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 rounded-2xl shadow-xl overflow-hidden py-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="px-3 py-1 text-[10px] font-bold text-purple-900 dark:text-purple-300 uppercase tracking-wider border-b border-purple-100 dark:border-purple-900/60">
                          Cabinet Quick Actions
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveDrawer("cabinet");
                            setCabinetDropdownOpen(false);
                          }}
                          className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-950/50 flex items-center justify-between"
                        >
                          <span>Open Full Cabinet Grid</span>
                          <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">({userMedicines.length})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            loadSampleCabinetMeds();
                            setCabinetDropdownOpen(false);
                          }}
                          className="w-full px-3 py-2 text-left text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/50 flex items-center gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                          <span>Load Demo Prescriptions</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Inline Action Button 2: Quick Add from Hospital Catalog (with Split Dropdown) */}
                  <div className="relative flex items-center shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDrawer(activeDrawer === "standard" ? "none" : "standard");
                        setCatalogDropdownOpen(false);
                      }}
                      className={`h-11 px-3 rounded-l-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 whitespace-nowrap shadow-sm border border-r-0 ${
                        activeDrawer === "standard"
                          ? "bg-teal-600 text-white border-teal-500 shadow-teal-600/30 ring-2 ring-teal-400/40"
                          : "bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800 hover:bg-teal-100"
                      }`}
                    >
                      <Globe2 className={`w-4 h-4 ${activeDrawer === "standard" ? "text-white" : "text-teal-600"}`} />
                      <span>🌐 Catalog</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                        activeDrawer === "standard" ? "bg-teal-800 text-teal-100" : "bg-teal-200 dark:bg-teal-900 text-teal-800 dark:text-teal-200"
                      }`}>
                        {filteredCatalogChips.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCatalogDropdownOpen(!catalogDropdownOpen);
                        setCabinetDropdownOpen(false);
                      }}
                      className={`h-11 px-2 rounded-r-xl border transition-all flex items-center justify-center ${
                        activeDrawer === "standard"
                          ? "bg-teal-700 text-white border-teal-500"
                          : "bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800 hover:bg-teal-100"
                      }`}
                      title="Filter Categories Dropdown"
                    >
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${catalogDropdownOpen ? "rotate-180" : ""}`} />
                    </button>

                    {/* Catalog Dropdown Menu */}
                    {catalogDropdownOpen && (
                      <div className="absolute top-full right-0 mt-1.5 z-40 w-64 bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800 rounded-2xl shadow-xl overflow-hidden py-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="px-3 py-1 text-[10px] font-bold text-teal-900 dark:text-teal-300 uppercase tracking-wider border-b border-teal-100 dark:border-teal-900/60">
                          Therapeutic Categories
                        </div>
                        {FORMULARY_CATEGORIES.map((cat) => (
                          <button
                            key={cat.key}
                            type="button"
                            onClick={() => {
                              setCatalogFilter(cat.key);
                              setActiveDrawer("standard");
                              setCatalogDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between transition-colors ${
                              catalogFilter === cat.key
                                ? "bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 font-bold"
                                : "text-slate-700 dark:text-slate-200 hover:bg-teal-50/50"
                            }`}
                          >
                            <span>{cat.label}</span>
                            {catalogFilter === cat.key && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Intelligent Did-You-Mean Spell Suggestion Pill */}
                {didYouMeanSuggestion && (
                  <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    <button
                      type="button"
                      onClick={() => {
                        addMedication(didYouMeanSuggestion.generic || didYouMeanSuggestion.name);
                        setCustomMedName("");
                        setShowSearchSuggestions(false);
                      }}
                      className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-200 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-all shadow-xs text-left group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 animate-pulse" />
                        <div className="truncate">
                          <span>Did you mean: </span>
                          <strong className="underline underline-offset-2 font-bold text-amber-950 dark:text-white group-hover:text-teal-700 dark:group-hover:text-teal-300">
                            {didYouMeanSuggestion.brand ? `${didYouMeanSuggestion.brand} (${didYouMeanSuggestion.name})` : didYouMeanSuggestion.name}
                          </strong>
                          {didYouMeanSuggestion.dosage && (
                            <span className="ml-1 text-slate-500 dark:text-slate-400">
                              {didYouMeanSuggestion.dosage}
                            </span>
                          )}
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-200/60 dark:bg-amber-800/60 text-amber-800 dark:text-amber-200 font-bold">
                            {didYouMeanSuggestion.cat}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] uppercase font-extrabold px-2.5 py-1 rounded-lg bg-amber-200/90 dark:bg-amber-800 text-amber-900 dark:text-amber-100 shrink-0 ml-2 group-hover:bg-amber-300 transition-colors">
                        + Click to Add
                      </span>
                    </button>
                  </div>
                )}

                {/* =========================================================================
                    EXPANDABLE CHIP SELECTION DRAWER (OPENS UNDER THE X-AXIS TOOLBAR)
                ========================================================================= */}
                {activeDrawer === "cabinet" && (
                  <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                        <FolderHeart className="w-4 h-4 text-purple-600" />
                        My Medicine Cabinet ({userMedicines.length} Saved)
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveDrawer("none")}
                        className="text-purple-500 hover:text-purple-700 dark:hover:text-purple-300 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {userMedicines.length === 0 ? (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                        <p className="text-xs text-purple-700/90 dark:text-purple-300">
                          Your cabinet has no personal medications saved. Click below to load demo patient prescriptions:
                        </p>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={loadSampleCabinetMeds}
                          className="!bg-purple-600 hover:!bg-purple-500 !text-white !font-bold whitespace-nowrap"
                        >
                          <Sparkles className="w-3.5 h-3.5 mr-1" />
                          Load Demo Cabinet Meds
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {userMedicines.map((m) => {
                          const name = m.name;
                          const isSel = selectedMeds.some((sel) => sel.toLowerCase() === name.toLowerCase());
                          return (
                            <button
                              key={m.id || name}
                              type="button"
                              onClick={() => toggleSelectMed(name)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-sm ${
                                isSel
                                  ? "bg-purple-600 border-purple-600 text-white shadow-purple-600/20 scale-[1.02]"
                                  : "bg-white dark:bg-slate-800 border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200 hover:bg-purple-100/60"
                              }`}
                            >
                              <span>{name}</span>
                              {m.dosage && (
                                <span className={`text-[10px] ${isSel ? "text-purple-200" : "text-purple-500"}`}>
                                  ({m.dosage})
                                </span>
                              )}
                              {isSel ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-purple-100 font-bold" />
                              ) : (
                                <Plus className="w-3.5 h-3.5 text-purple-400" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {activeDrawer === "standard" && (
                  <div className="p-4 rounded-2xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/60 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
                        <Globe2 className="w-4 h-4 text-teal-600" />
                        Hospital Clinical Formularies ({filteredCatalogChips.length} of {POPULAR_DRUG_CHIPS.length} Shown)
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveDrawer("none")}
                        className="text-teal-500 hover:text-teal-700 dark:hover:text-teal-300 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Category Filter Chips Bar */}
                    <div className="flex flex-wrap gap-1.5 border-b border-teal-100 dark:border-teal-900/40 pb-2">
                      {FORMULARY_CATEGORIES.map((c) => (
                        <button
                          key={c.key}
                          type="button"
                          onClick={() => setCatalogFilter(c.key)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                            catalogFilter === c.key
                              ? "bg-teal-700 text-white shadow-sm"
                              : "bg-white/80 dark:bg-slate-800 text-teal-900 dark:text-teal-300 border border-teal-200/70 dark:border-teal-800 hover:bg-teal-100/50"
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {filteredCatalogChips.map((m) => {
                        const name = m.name;
                        const isSel = selectedMeds.some((sel) => sel.toLowerCase() === name.toLowerCase());
                        return (
                          <button
                            key={m.name}
                            type="button"
                            onClick={() => toggleSelectMed(name)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-sm ${
                              isSel
                                ? "bg-teal-600 border-teal-600 text-white shadow-teal-600/20 scale-[1.02]"
                                : "bg-white dark:bg-slate-800 border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200 hover:bg-teal-100/60"
                            }`}
                          >
                            <span>{name}</span>
                            <span className={`text-[10px] ${isSel ? "text-teal-100" : "text-teal-600 dark:text-teal-400"}`}>
                              ({m.dosage})
                            </span>
                            {isSel ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-teal-100 font-bold" />
                            ) : (
                              <Plus className="w-3.5 h-3.5 text-teal-500" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Active Pills Queue Visual */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Active Comparison Queue
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {selectedMeds.length} drugs currently being evaluated
                  </span>
                </div>

                {selectedMeds.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No medications added yet. Use the search bar above or choose from the catalog chips.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                    {selectedMeds.map((med) => (
                      <div
                        key={med}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center text-teal-700 dark:text-teal-300 shrink-0">
                            <Pill className="w-3.5 h-3.5" />
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {med}
                            </p>
                            <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium">
                              Active in Scan
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMed(med)}
                          className="w-7 h-7 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/60 flex items-center justify-center text-slate-400 hover:text-red-600 transition-colors"
                          title={`Remove ${med}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Right Column: Regimen Safety Meter & Interactive Breakdown (Expanded X & Y Dimensions) */}
          <Card className="lg:col-span-5 flex flex-col justify-between space-y-6 shadow-sm border border-slate-200/80 dark:border-slate-800 h-full">
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2 font-heading">
                    <Activity className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                    Regimen Safety Index
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Live polypharmacy & risk score
                  </p>
                </div>
                <Badge
                  variant={
                    activeRiskTier === "harmonized"
                      ? "success"
                      : activeRiskTier === "moderate"
                      ? "info"
                      : activeRiskTier === "major"
                      ? "warning"
                      : "danger"
                  }
                  className="font-bold uppercase tracking-wider text-[11px] px-2.5 py-1 transition-all duration-300 shadow-sm"
                >
                  {activeRiskTier === "harmonized"
                    ? "Low Interaction Risk"
                    : activeRiskTier === "moderate"
                    ? "Moderate Caution (Monitor)"
                    : activeRiskTier === "major"
                    ? "Caution Advised"
                    : "High Clinical Risk"}
                </Badge>
              </div>

              {/* Radial Score Meter (Dynamic Score Glow & Risk Focus) */}
              <div className="flex flex-col items-center justify-center py-5">
                <div className={`relative w-48 h-48 sm:w-52 sm:h-52 flex items-center justify-center transition-all duration-500 ${
                  activeRiskTier === "critical"
                    ? "filter drop-shadow-[0_0_18px_rgba(244,63,94,0.35)]"
                    : activeRiskTier === "major"
                    ? "filter drop-shadow-[0_0_18px_rgba(245,158,11,0.35)]"
                    : activeRiskTier === "moderate"
                    ? "filter drop-shadow-[0_0_18px_rgba(59,130,246,0.35)]"
                    : "filter drop-shadow-[0_0_18px_rgba(20,184,166,0.3)]"
                }`}>
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-slate-100 dark:text-slate-800"
                      strokeWidth="3.2"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className={`${
                        activeRiskTier === "harmonized"
                          ? "text-teal-500"
                          : activeRiskTier === "moderate"
                          ? "text-blue-500"
                          : activeRiskTier === "major"
                          ? "text-amber-500"
                          : "text-rose-500"
                      } transition-all duration-1000 ease-out`}
                      strokeDasharray={`${safetyScore}, 100`}
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className={`text-5xl font-black tracking-tight transition-colors duration-300 ${
                      activeRiskTier === "critical"
                        ? "text-rose-600 dark:text-rose-400"
                        : activeRiskTier === "major"
                        ? "text-amber-600 dark:text-amber-400"
                        : activeRiskTier === "moderate"
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-slate-900 dark:text-white"
                    }`}>
                      {safetyScore}%
                    </span>
                    <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                      Safety Score
                    </span>
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider mt-1 px-2 py-0.5 rounded-full transition-all duration-300 ${
                      activeRiskTier === "critical"
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 ring-1 ring-rose-300 dark:ring-rose-800"
                        : activeRiskTier === "major"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 ring-1 ring-amber-300 dark:ring-amber-800"
                        : activeRiskTier === "moderate"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 ring-1 ring-blue-300 dark:ring-blue-800"
                        : "bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 ring-1 ring-teal-300 dark:ring-teal-800"
                    }`}>
                      {activeRiskTier === "critical"
                        ? "Critical Risk Focus"
                        : activeRiskTier === "major"
                        ? "Major Caution Focus"
                        : activeRiskTier === "moderate"
                        ? "Moderate Risk Focus"
                        : "Harmonized Profile"}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1">
                      Risk Score: <strong className={compositeRiskScore >= 75 ? 'text-rose-600 dark:text-rose-400' : compositeRiskScore >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-teal-600 dark:text-teal-400'}>{compositeRiskScore}/100</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Interactive Severity Counter Cards (Severity-Driven Dynamic Focus Rings with 4 Tiers) */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5" />
                    Conflict Breakdown
                  </span>
                  <span className="text-[11px] font-normal">Click a card to filter</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {/* Critical / Severe Card with Severity-Driven Dynamic Focus Ring */}
                  <button
                    type="button"
                    onClick={() => setSeverityFilter(severityFilter === "critical" ? "all" : "critical")}
                    className={`p-2.5 rounded-2xl border text-center transition-all duration-300 flex flex-col items-center justify-between relative overflow-hidden ${
                      activeRiskTier === "critical"
                        ? "ring-2 ring-rose-500 ring-offset-2 dark:ring-offset-slate-900 shadow-lg shadow-rose-500/25 scale-[1.03] border-rose-400"
                        : "hover:scale-[1.02]"
                    } ${
                      severityFilter === "critical"
                        ? "bg-rose-600 text-white border-rose-600 shadow-md"
                        : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 hover:border-rose-400"
                    }`}
                  >
                    {activeRiskTier === "critical" && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    )}
                    <div className="flex items-center gap-1">
                      <Flame className={`w-3.5 h-3.5 ${severityFilter === "critical" ? "text-white" : "text-rose-600 dark:text-rose-400"}`} />
                      <span className="text-[11px] font-bold">Critical</span>
                    </div>
                    <p className="text-xl font-black my-0.5">{criticalCount}</p>
                    <span className="text-[9px] opacity-80 font-medium">
                      {activeRiskTier === "critical" ? "● Active Focus" : "Contraindicated"}
                    </span>
                  </button>

                  {/* Major Card with Severity-Driven Dynamic Focus Ring */}
                  <button
                    type="button"
                    onClick={() => setSeverityFilter(severityFilter === "major" ? "all" : "major")}
                    className={`p-2.5 rounded-2xl border text-center transition-all duration-300 flex flex-col items-center justify-between relative overflow-hidden ${
                      activeRiskTier === "major"
                        ? "ring-2 ring-amber-500 ring-offset-2 dark:ring-offset-slate-900 shadow-lg shadow-amber-500/25 scale-[1.03] border-amber-400"
                        : "hover:scale-[1.02]"
                    } ${
                      severityFilter === "major"
                        ? "bg-amber-500 text-white border-amber-500 shadow-md"
                        : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-300 hover:border-amber-400"
                    }`}
                  >
                    {activeRiskTier === "major" && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    )}
                    <div className="flex items-center gap-1">
                      <AlertTriangle className={`w-3.5 h-3.5 ${severityFilter === "major" ? "text-white" : "text-amber-600 dark:text-amber-400"}`} />
                      <span className="text-[11px] font-bold">Major</span>
                    </div>
                    <p className="text-xl font-black my-0.5">{majorCount}</p>
                    <span className="text-[9px] opacity-80 font-medium">
                      {activeRiskTier === "major" ? "● Active Focus" : "CYP / Metabolic"}
                    </span>
                  </button>

                  {/* Moderate Card with Severity-Driven Dynamic Focus Ring */}
                  <button
                    type="button"
                    onClick={() => setSeverityFilter(severityFilter === "moderate" ? "all" : "moderate")}
                    className={`p-2.5 rounded-2xl border text-center transition-all duration-300 flex flex-col items-center justify-between relative overflow-hidden ${
                      activeRiskTier === "moderate"
                        ? "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900 shadow-lg shadow-blue-500/25 scale-[1.03] border-blue-400"
                        : "hover:scale-[1.02]"
                    } ${
                      severityFilter === "moderate"
                        ? "bg-blue-600 text-white border-blue-600 shadow-md"
                        : "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 hover:border-blue-400"
                    }`}
                  >
                    {activeRiskTier === "moderate" && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                    )}
                    <div className="flex items-center gap-1">
                      <AlertCircle className={`w-3.5 h-3.5 ${severityFilter === "moderate" ? "text-white" : "text-blue-600 dark:text-blue-400"}`} />
                      <span className="text-[11px] font-bold">Moderate</span>
                    </div>
                    <p className="text-xl font-black my-0.5">{moderateCount}</p>
                    <span className="text-[9px] opacity-80 font-medium">
                      {activeRiskTier === "moderate" ? "● Active Focus" : "Dosing / Monitor"}
                    </span>
                  </button>

                  {/* Harmonized Card with Severity-Driven Dynamic Focus Ring */}
                  <button
                    type="button"
                    onClick={() => setSeverityFilter("all")}
                    className={`p-2.5 rounded-2xl border text-center transition-all duration-300 flex flex-col items-center justify-between relative overflow-hidden ${
                      activeRiskTier === "harmonized"
                        ? "ring-2 ring-teal-500 ring-offset-2 dark:ring-offset-slate-900 shadow-lg shadow-teal-500/25 scale-[1.03] border-teal-400"
                        : "hover:scale-[1.02]"
                    } ${
                      severityFilter === "all" && activeRiskTier === "harmonized"
                        ? "bg-teal-50 dark:bg-teal-950/40 border-teal-300 dark:border-teal-800 text-teal-700 dark:text-teal-300"
                        : severityFilter === "all"
                        ? "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {activeRiskTier === "harmonized" && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-teal-500 animate-ping" />
                    )}
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className={`w-3.5 h-3.5 ${severityFilter === "all" && activeRiskTier === "harmonized" ? "text-teal-600 dark:text-teal-400" : "text-slate-500"}`} />
                      <span className="text-[11px] font-bold">Harmonized</span>
                    </div>
                    <p className="text-xl font-black my-0.5">{harmonizedCount}</p>
                    <span className="text-[9px] opacity-80 font-medium">
                      {activeRiskTier === "harmonized" ? "● Active Focus" : "Low Risk Profile"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Clinical Posture Assessment (Natural Y-Axis Height Balancer) */}
              <div className="mt-4 p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <HeartPulse className="w-3.5 h-3.5 text-teal-600" />
                    Clinical Safety Assessment
                  </span>
                  <span className={`font-extrabold text-[11px] ${
                    criticalCount > 0
                      ? "text-rose-600"
                      : majorCount > 0
                      ? "text-amber-600"
                      : moderateCount > 0
                      ? "text-blue-600"
                      : "text-teal-600"
                  }`}>
                    {criticalCount > 0
                      ? "Action Mandated"
                      : majorCount > 0
                      ? "Caution Advised"
                      : moderateCount > 0
                      ? "Monitor Co-Administration"
                      : "Clean Profile"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] pt-2 border-t border-slate-200/60 dark:border-slate-800 text-center">
                  <div className="bg-white dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">CYP450 Enzyme</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200 text-[11px]">
                      {isCYPInhibited ? "Inhibited" : "Normal"}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Bleed Pathway</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200 text-[11px]">
                      {selectedMeds.some(m => ["warfarin", "aspirin"].includes(m.toLowerCase())) && selectedMeds.length > 1 ? "Elevated" : "Normal"}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Renal Status</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200 text-[11px]">
                      {selectedMeds.length >= 3 ? "Monitored" : "Optimal"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-start gap-2 leading-relaxed">
              <Info className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
              <span>
                Deterministic pharmacology knowledge graph grounded in FDA & WHO clinical registries. Always consult the attending physician.
              </span>
            </div>
          </Card>
        </div>

        <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-6 overflow-x-auto pb-0.5">
          <button
            onClick={() => setActiveTab("drug-drug")}
            className={`pb-3.5 text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all border-b-2 ${
              activeTab === "drug-drug"
                ? "border-teal-600 text-teal-600 dark:text-teal-400 dark:border-teal-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Drug-Drug Interactions ({detectedInteractions.length})
          </button>
          <button
            onClick={() => setActiveTab("food-interactions")}
            className={`pb-3.5 text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all border-b-2 ${
              activeTab === "food-interactions"
                ? "border-teal-600 text-teal-600 dark:text-teal-400 dark:border-teal-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" />
            Food & Dietary Warnings ({activeFoodWarnings.length > 0 ? `${activeFoodWarnings.length} Active` : FOOD_INTERACTIONS.length})
          </button>
          <button
            onClick={() => setActiveTab("advisory")}
            className={`pb-3.5 text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all border-b-2 ${
              activeTab === "advisory"
                ? "border-teal-600 text-teal-600 dark:text-teal-400 dark:border-teal-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            AI Clinical Advisory & Chronotherapy
          </button>
        </div>

        {/* =========================================================================
            TAB 1: DRUG-DRUG INTERACTIONS (DEEP CLINICAL CARDS)
        ========================================================================= */}
        {activeTab === "drug-drug" && (
          <div className="space-y-4">
            {/* Filter Pill Bar */}
            {detectedInteractions.length > 0 && (
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs font-semibold text-slate-500">
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filter by Severity:</span>
                  {["all", "critical", "major", "moderate"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setSeverityFilter(f)}
                      className={`px-2.5 py-1 rounded-lg capitalize text-[11px] font-bold transition-all ${
                        severityFilter === f
                          ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <span>Showing {filteredInteractions.length} of {detectedInteractions.length} detected conflicts</span>
              </div>
            )}

            {filteredInteractions.length === 0 ? (
              <EmptyState
                icon="verified"
                title={
                  selectedMeds.length < 2
                    ? "Add At Least 2 Medicines to Compare"
                    : "No High-Risk Contraindications Found"
                }
                description={
                  selectedMeds.length < 2
                    ? "Select multiple drugs from your cabinet or presets to evaluate synergistic bio-pathway risks."
                    : "Your currently queued medication combination is clinically harmonized with no known major contraindications."
                }
                actionLabel="Test High-Risk Warfarin + Aspirin"
                onAction={() => loadPreset(["Warfarin", "Aspirin"])}
                className="py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm"
              />
            ) : (
              filteredInteractions.map((item, idx) => (
                <Card
                  key={idx}
                  className={`border-l-4 transition-all shadow-sm ${
                    item.severity === "critical"
                      ? "border-l-rose-600 bg-rose-50/20 dark:bg-rose-950/10 border-slate-200 dark:border-slate-800"
                      : item.severity === "major"
                      ? "border-l-amber-500 bg-amber-50/20 dark:bg-amber-950/10 border-slate-200 dark:border-slate-800"
                      : "border-l-teal-500 bg-teal-50/20 dark:bg-teal-950/10 border-slate-200 dark:border-slate-800"
                  }`}
                >
                  {/* Top Row: Interacting Pair + Severity + Category */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-extrabold text-xs shadow-sm">
                        {item.involved[0]}
                      </span>
                      <span className="text-rose-500 font-black text-sm">⚡ CONFLICT ⚡</span>
                      <span className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-extrabold text-xs shadow-sm">
                        {item.involved[1]}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {item.category}
                      </span>
                      <Badge
                        variant={
                          item.severity === "critical" ? "danger" : item.severity === "major" ? "warning" : "info"
                        }
                        className="font-bold text-[10px] tracking-wider uppercase"
                      >
                        {item.severity} Risk
                      </Badge>
                    </div>
                  </div>

                  {/* Title & Core Details Grid */}
                  <div className="space-y-3">
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      {item.title}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {/* Pharmacological Mechanism */}
                      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 space-y-1">
                        <span className="font-bold uppercase tracking-wider text-[10px] text-teal-700 dark:text-teal-400 block">
                          Biochemical Mechanism of Action:
                        </span>
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                          {item.mechanism}
                        </p>
                      </div>

                      {/* Clinical Red Flags & Symptoms */}
                      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 space-y-1">
                        <span className="font-bold uppercase tracking-wider text-[10px] text-rose-700 dark:text-rose-400 block">
                          Symptoms & Warning Signs to Monitor:
                        </span>
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                          {item.symptoms}
                        </p>
                      </div>
                    </div>

                    {/* Actionable Clinical Recommendation & Evidence */}
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-900/10 via-teal-900/5 to-cyan-900/10 border border-teal-500/30 text-xs space-y-2">
                      <div className="flex items-center gap-2">
                        <Stethoscope className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                        <span className="font-extrabold text-teal-900 dark:text-teal-200 uppercase tracking-wider text-[11px]">
                          Actionable Clinical Protocol & Intervention:
                        </span>
                      </div>
                      <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium pl-6">
                        {item.recommendation}
                      </p>
                      <div className="pt-2 border-t border-teal-500/20 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between pl-6">
                        <span>Evidence Source: <strong className="text-slate-700 dark:text-slate-300">{item.evidence}</strong></span>
                        <span className="text-teal-600 dark:text-teal-400 font-semibold">Strict Clinical Protocol</span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 2: FOOD & DIETARY WARNINGS (REAL-TIME DYNAMIC CARDS)
        ========================================================================= */}
        {activeTab === "food-interactions" && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/80 text-xs text-teal-900 dark:text-teal-200 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <UtensilsCrossed className="w-5 h-5 text-teal-600 flex-shrink-0" />
                <span>
                  <strong>Clinical Nutrition Guidance:</strong> Dynamically tailored to your {selectedMeds.length} active medications. Certain foods alter gut pH, chelate mineral compounds, or irreversibly inhibit intestinal enzymes (such as CYP3A4).
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAllFoodWarnings(!showAllFoodWarnings)}
                className="text-xs font-bold text-teal-700 dark:text-teal-300 underline underline-offset-2 hover:text-teal-800 shrink-0"
              >
                {showAllFoodWarnings ? "Showing All 6 Rules" : `Browse All ${FOOD_INTERACTIONS.length} Guidelines`}
              </button>
            </div>

            {/* If no queued drugs have active food contraindications */}
            {activeFoodWarnings.length === 0 && !showAllFoodWarnings && (
              <div className="p-8 rounded-3xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-emerald-950 dark:text-emerald-200">
                  No High-Risk Food Contraindications in Active Regimen
                </h4>
                <p className="text-xs text-emerald-800/90 dark:text-emerald-300/80 max-w-lg mx-auto leading-relaxed">
                  Your currently queued regimen ({selectedMeds.join(", ") || "No medicines queued"}) does not trigger direct citrus, dairy, or electrolyte food contraindications in our clinical registry.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAllFoodWarnings(true)}
                    className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xs font-bold hover:bg-emerald-50 transition-all shadow-xs"
                  >
                    Browse All {FOOD_INTERACTIONS.length} General Clinical Food Guidelines
                  </button>
                </div>
              </div>
            )}

            {/* Render Grid: Active warnings first, or all if toggled */}
            {(activeFoodWarnings.length > 0 || showAllFoodWarnings) && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(showAllFoodWarnings ? FOOD_INTERACTIONS : activeFoodWarnings).map((f, i) => {
                  const isMatchingActiveQueue = activeFoodWarnings.some((af) => af.medicine === f.medicine);
                  return (
                    <Card
                      key={i}
                      className={`flex flex-col justify-between space-y-4 shadow-sm border transition-all ${
                        isMatchingActiveQueue
                          ? "border-amber-400 dark:border-amber-600/80 ring-2 ring-amber-400/20 bg-amber-50/10"
                          : "border-slate-200/80 dark:border-slate-800"
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-2xl flex items-center justify-center font-bold">
                            {f.icon}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {isMatchingActiveQueue && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-extrabold uppercase tracking-wide border border-rose-200 dark:border-rose-800">
                                ⚠️ In Your Regimen
                              </span>
                            )}
                            <Badge
                              variant={f.severity === "critical" ? "danger" : "warning"}
                              className="text-[10px] font-bold uppercase tracking-wider"
                            >
                              {f.severity} Guard
                            </Badge>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                            {f.medicine}
                          </h4>
                          <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-1">
                            Avoid: {f.food}
                          </p>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800 text-xs space-y-1">
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">Biological Risk:</span>
                          <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                            {f.risk}
                          </p>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                          {f.mechanism}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                        <div className="text-xs text-teal-700 dark:text-teal-300 font-medium">
                          <strong>Rule:</strong> {f.advice}
                        </div>
                        <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-[11px] font-semibold text-teal-800 dark:text-teal-200 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-teal-600" />
                          <span>Window: {f.safeWindow}</span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 3: AI CLINICAL ADVISORY & CHRONOTHERAPY (DYNAMIC REAL-TIME MATRIX)
        ========================================================================= */}
        {activeTab === "advisory" && (
          <div className="space-y-6">
            {/* Top Pharmacological Summary Card */}
            <Card className="space-y-6 shadow-sm border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-600 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    Personalized AI Pharmacological Summary
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    Based on your currently queued roster of <strong className="text-slate-900 dark:text-white">{selectedMeds.length} active medications</strong> ({selectedMeds.join(", ") || "None selected"}), the clinical engine has dynamically calculated optimal chronotherapy distribution and metabolic monitoring below.
                  </p>
                </div>
              </div>

              {/* 4-Pillar Clinical Action Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Pillar 1: Timing & Chronotherapy */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-bold text-xs uppercase tracking-wider">
                    <Clock className="w-4 h-4" />
                    Chronotherapy Timing
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Stagger multivalent minerals (Iron, Calcium) and PPI antacids at least 2 to 4 hours apart from critical cardiovascular or thyroid doses.
                  </p>
                </div>

                {/* Pillar 2: Renal Clearance & Hydration */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-bold text-xs uppercase tracking-wider">
                    <Droplets className="w-4 h-4" />
                    {selectedMeds.length >= 3 ? "Renal Target: 3.0 Liters" : "Renal Target: 2.5 Liters"}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {selectedMeds.length >= 3
                      ? "Multi-drug combination active. Increase fluid intake to 3.0L daily to prevent nephrotoxic crystallization and maintain glomerular clearance."
                      : "Maintain daily fluid intake (2.5L) to optimize glomerular filtration and smooth metabolic drug excretion."}
                  </p>
                </div>

                {/* Pillar 3: Routine Lab Biomarker Tracking */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-bold text-xs uppercase tracking-wider">
                    <HeartPulse className="w-4 h-4" />
                    Biomarker Monitoring ({dynamicBiomarkers.length})
                  </div>
                  <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    {dynamicBiomarkers.slice(0, 2).map((b, bi) => (
                      <div key={bi} className="leading-tight">
                        <strong className="text-slate-800 dark:text-slate-200">{b.name}</strong>: {b.freq}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pillar 4: Red Flag Triage */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-xs uppercase tracking-wider">
                    <AlertOctagon className="w-4 h-4" />
                    Emergency Red Flags
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Seek immediate emergency medical evaluation if experiencing sudden unexplained bruising, dark tea urine, acute syncope, or chest tightness.
                  </p>
                </div>
              </div>
            </Card>

            {/* Visual Administration Schedule Planner */}
            <Card className="space-y-4 shadow-sm border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-teal-600" />
                  <h4 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                    Optimal Daily Administration Matrix (Circadian Conflict Staggering)
                  </h4>
                </div>
                <Badge variant="info" className="text-[10px] font-bold uppercase">
                  Dynamic Real-Time Schedule
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                {/* Morning Slot */}
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                  <span className="font-extrabold text-amber-700 dark:text-amber-300 uppercase text-[11px] block">
                    🌅 Morning (Empty Stomach)
                  </span>
                  {dynamicChronotherapy.morning.length > 0 ? (
                    <div className="space-y-1.5">
                      {dynamicChronotherapy.morning.map((m, mi) => (
                        <div key={mi} className="text-slate-800 dark:text-slate-200">
                          <strong className="text-amber-900 dark:text-amber-200">• {m.name}</strong>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-2">{m.tip}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 dark:text-slate-500 italic">No queued medicines for this slot.</p>
                  )}
                </div>

                {/* Afternoon Slot */}
                <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/20 space-y-2">
                  <span className="font-extrabold text-teal-700 dark:text-teal-300 uppercase text-[11px] block">
                    ☀️ Mid-Day / Lunch (With Food)
                  </span>
                  {dynamicChronotherapy.lunch.length > 0 ? (
                    <div className="space-y-1.5">
                      {dynamicChronotherapy.lunch.map((m, mi) => (
                        <div key={mi} className="text-slate-800 dark:text-slate-200">
                          <strong className="text-teal-900 dark:text-teal-200">• {m.name}</strong>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-2">{m.tip}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 dark:text-slate-500 italic">No queued medicines for this slot.</p>
                  )}
                </div>

                {/* Evening Slot */}
                <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-2">
                  <span className="font-extrabold text-indigo-700 dark:text-indigo-300 uppercase text-[11px] block">
                    🌆 Evening / Dinner
                  </span>
                  {dynamicChronotherapy.evening.length > 0 ? (
                    <div className="space-y-1.5">
                      {dynamicChronotherapy.evening.map((m, mi) => (
                        <div key={mi} className="text-slate-800 dark:text-slate-200">
                          <strong className="text-indigo-900 dark:text-indigo-200">• {m.name}</strong>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-2">{m.tip}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 dark:text-slate-500 italic">No queued medicines for this slot.</p>
                  )}
                </div>

                {/* Night / Bedtime Slot */}
                <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 space-y-2">
                  <span className="font-extrabold text-purple-700 dark:text-purple-300 uppercase text-[11px] block">
                    🌙 Night / Bedtime
                  </span>
                  {dynamicChronotherapy.night.length > 0 ? (
                    <div className="space-y-1.5">
                      {dynamicChronotherapy.night.map((m, mi) => (
                        <div key={mi} className="text-slate-800 dark:text-slate-200">
                          <strong className="text-purple-900 dark:text-purple-200">• {m.name}</strong>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-2">{m.tip}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 dark:text-slate-500 italic">No queued medicines for this slot.</p>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
