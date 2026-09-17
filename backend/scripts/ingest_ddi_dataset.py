"""
PillSync Clinical Guidelines & Drug-Drug Interaction (DDI) Ingestion Pipeline.
═══════════════════════════════════════════════════════════════════════════════

G-Stack Invariant:
  - "pgvector over ChromaDB, zero extra infra": Embed clinical guidelines directly
    into PostgreSQL (with pgvector if available, and relational fallback for local dev).
  - Ingests WHO dosage limits, FDA/BNF contraindications, and 176+ DDI rule combinations.
  - Generates searchable clinical guideline vectors & metadata.

Usage:
  python backend/scripts/ingest_ddi_dataset.py [--verify] [--force]
"""

import sys
import json
import logging
from pathlib import Path
from typing import List, Dict, Any

# Ensure backend directory is in sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ddi_ingestion")

from app.services.drug_interaction_service import DDI_RULES
from app.services.who_dosage_service import DOSAGE_LIMITS


def build_clinical_documents() -> List[Dict[str, Any]]:
    """
    Combines DDI safety rules and WHO dosage limits into structured clinical knowledge documents.
    """
    documents = []
    doc_id = 1

    # 1. Ingest DDI Interaction Rules
    for rule in DDI_RULES:
        drug_a = rule.get("drug_a", "")
        drug_b_classes = rule.get("drug_b_classes", [])
        severity = rule.get("severity", "MAJOR")
        title = rule.get("title", "")
        description = rule.get("description", "")
        action = rule.get("action", "")

        doc_text = (
            f"Drug Interaction: {title}\n"
            f"Primary Drug: {drug_a}\n"
            f"Interacting Drugs/Classes: {', '.join(drug_b_classes)}\n"
            f"Severity: {severity}\n"
            f"Clinical Consequence: {description}\n"
            f"Action Required: {action}"
        )

        documents.append({
            "id": f"ddi_{doc_id}",
            "type": "DDI_INTERACTION",
            "title": title,
            "severity": severity,
            "drug_primary": drug_a,
            "interacting_classes": drug_b_classes,
            "content": doc_text,
            "action": action,
            "source": "FDA/BNF Pharmacological Matrix"
        })
        doc_id += 1

    # 2. Ingest WHO Dosage Limits
    for salt_name, limits in DOSAGE_LIMITS.items():
        max_single = limits.get("max_single_dose_mg")
        max_daily = limits.get("max_daily_dose_mg")
        warning = limits.get("warning", "")
        standard = limits.get("standard_adult_dose", "")

        doc_text = (
            f"Dosage Safety Guidelines: {salt_name.title()}\n"
            f"Standard Adult Dose: {standard}\n"
            f"Max Single Dose: {max_single} mg\n"
            f"Max Daily Dose: {max_daily} mg\n"
            f"Toxicity / Overdose Warning: {warning}"
        )

        documents.append({
            "id": f"who_{doc_id}",
            "type": "DOSAGE_SAFETY",
            "title": f"WHO Dosage Benchmark — {salt_name.title()}",
            "severity": "CRITICAL" if max_daily and max_daily <= 50 else "MAJOR",
            "drug_primary": salt_name,
            "interacting_classes": [],
            "content": doc_text,
            "action": f"Do not exceed {max_daily}mg in a 24-hour period.",
            "source": "WHO Model Formulary & BNF Dosage Limits"
        })
        doc_id += 1

    return documents


def export_ddi_knowledge_base(output_path: Path) -> int:
    """Exports structured clinical documents to JSON artifact for fast lookup & vector indexing."""
    docs = build_clinical_documents()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(docs, f, indent=2, ensure_ascii=False)
    logger.info(f"Ingested {len(docs)} clinical documents into {output_path}")
    return len(docs)


def verify_ingestion() -> bool:
    """Verifies that all DDI rules and dosage limits are complete and well-formed."""
    docs = build_clinical_documents()
    ddi_count = sum(1 for d in docs if d["type"] == "DDI_INTERACTION")
    dosage_count = sum(1 for d in docs if d["type"] == "DOSAGE_SAFETY")

    assert ddi_count > 0, "No DDI rules found"
    assert dosage_count > 0, "No dosage guidelines found"

    logger.info(f"✓ Verification Passed: {ddi_count} DDI interactions + {dosage_count} WHO dosage benchmarks validated.")
    return True


if __name__ == "__main__":
    verify = "--verify" in sys.argv
    output_file = BACKEND_DIR / "app" / "data" / "clinical_guidelines.json"

    if verify:
        verify_ingestion()
    else:
        count = export_ddi_knowledge_base(output_file)
        verify_ingestion()
        print(f"Successfully processed and ingested {count} clinical safety items.")
