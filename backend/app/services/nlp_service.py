"""
PillSync NLP Service.

Parses raw OCR text to extract structured prescription data:
    - Medicine name
    - Dosage  (e.g. 500mg, 250 mg)
    - Frequency  (e.g. 1-0-1, twice daily, three times a day)

Uses a layered approach:
    1. Regex patterns for deterministic extraction of dosage & frequency.
    2. spaCy (en_core_web_sm) for named entity / noun-chunk based
       medicine name extraction as a fallback.
"""

import re
from typing import List, Optional, Pattern, Tuple

import spacy

# ---------------------------------------------------------------------------
# spaCy Model — Lazy Singleton Load
# ---------------------------------------------------------------------------
_nlp_model: Optional[spacy.language.Language] = None


def _get_nlp_model() -> spacy.language.Language:
    """Load the spaCy model once and cache it."""
    global _nlp_model
    if _nlp_model is None:
        try:
            _nlp_model = spacy.load("en_core_web_sm")
        except OSError:
            # Fallback: create a blank English model if the trained
            # pipeline is not installed in the environment.
            _nlp_model = spacy.blank("en")
    return _nlp_model


# ---------------------------------------------------------------------------
# Regex Patterns
# ---------------------------------------------------------------------------

# Dosage patterns: captures values like "500mg", "250 mg", "10 ml", "0.5mg"
_DOSAGE_PATTERN = re.compile(
    r"(\d+(?:\.\d+)?)\s*(mg|g|ml|mcg|iu|units?|tablets?|capsules?|caps?)",
    re.IGNORECASE,
)

# Frequency patterns (priority order):
#   - Numeric shorthand: "1-0-1", "1-1-1", "0-0-1"
#   - Text phrases:      "twice daily", "three times a day", "once daily"
#   - Abbreviations:     "BD", "TDS", "OD", "QID"
_FREQUENCY_PATTERNS: List[Tuple[Pattern, Optional[str]]] = [
    (re.compile(r"\b([012])\s*[-–]\s*([012])\s*[-–]\s*([012])\b"), None),  # raw match
    (re.compile(r"\bonce\s+(?:a\s+)?dai?ly\b", re.I), "1-0-0"),
    (re.compile(r"\btwice\s+(?:a\s+)?dai?ly\b", re.I), "1-0-1"),
    (re.compile(r"\bthrice\s+(?:a\s+)?dai?ly\b", re.I), "1-1-1"),
    (re.compile(r"\bthree\s+times?\s+(?:a\s+)?day\b", re.I), "1-1-1"),
    (re.compile(r"\btwo\s+times?\s+(?:a\s+)?day\b", re.I), "1-0-1"),
    (re.compile(r"\bfour\s+times?\s+(?:a\s+)?day\b", re.I), "1-1-1-1"),
    (re.compile(r"\b(?:BD|BID|b\.?i\.?d\.?)\b", re.I), "1-0-1"),
    (re.compile(r"\b(?:TDS|TID|t\.?i\.?d\.?)\b", re.I), "1-1-1"),
    (re.compile(r"\b(?:OD|o\.?d\.?)\b", re.I), "1-0-0"),
    (re.compile(r"\b(?:QID|q\.?i\.?d\.?)\b", re.I), "1-1-1-1"),
]

# Common medicine name pattern — capitalised word(s) often preceding dosage
_MEDICINE_NAME_PATTERN = re.compile(
    r"\b([A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z]{2,})*)\b"
)

# Words to exclude from medicine name candidates
_EXCLUDE_WORDS = {
    "Take", "Tablet", "Tablets", "Capsule", "Capsules", "Daily",
    "Morning", "Evening", "Night", "After", "Before", "With",
    "Food", "Meals", "Water", "Doctor", "Patient", "Name",
    "Date", "Prescription", "Pharmacy", "Hospital", "Clinic",
    "Dose", "Dosage", "Frequency", "Duration", "Quantity",
    "The", "For", "And", "Per", "Day", "Times", "Once",
    "Twice", "Thrice", "Three", "Four", "One", "Two",
    "Tab", "Cap", "Syrup", "Injection", "Oral",
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def parse_prescription_text(raw_text: str) -> dict:
    """
    Parse raw OCR text and extract structured prescription data.

    Args:
        raw_text: Unstructured text extracted by the OCR engine.

    Returns:
        dict with keys:
            - medicine_name (str | None)
            - dosage (str | None)
            - frequency (str | None)
    """
    if not raw_text or not raw_text.strip():
        return {
            "medicine_name": None,
            "dosage": None,
            "frequency": None,
        }

    dosage = _extract_dosage(raw_text)
    frequency = _extract_frequency(raw_text)
    medicine_name = _extract_medicine_name(raw_text)

    return {
        "medicine_name": medicine_name,
        "dosage": dosage,
        "frequency": frequency,
    }


# ---------------------------------------------------------------------------
# Private Helpers
# ---------------------------------------------------------------------------

def _extract_dosage(text: str) -> Optional[str]:
    """Extract the first dosage match from text."""
    match = _DOSAGE_PATTERN.search(text)
    if match:
        value, unit = match.group(1), match.group(2).lower()
        return f"{value}{unit}"
    return None


def _extract_frequency(text: str) -> Optional[str]:
    """Extract frequency from text using ordered regex patterns."""
    for pattern, replacement in _FREQUENCY_PATTERNS:
        match = pattern.search(text)
        if match:
            if replacement is None:
                # Numeric shorthand — return the raw match
                return match.group(0).replace("–", "-")
            return replacement
    return None


def _extract_medicine_name(text: str) -> Optional[str]:
    """
    Extract the most likely medicine name using:
        1. Regex for capitalised words (excluding common stop words).
        2. spaCy noun chunks as a fallback.
    """
    # Strategy 1: Regex-based capitalised word extraction
    candidates = _MEDICINE_NAME_PATTERN.findall(text)
    for candidate in candidates:
        words = candidate.split()
        if not any(w in _EXCLUDE_WORDS for w in words):
            return candidate.strip()

    # Strategy 2: spaCy noun chunk extraction
    nlp = _get_nlp_model()
    doc = nlp(text)

    for chunk in doc.noun_chunks:
        chunk_text = chunk.text.strip()
        if (
            len(chunk_text) > 2
            and chunk_text not in _EXCLUDE_WORDS
            and not _DOSAGE_PATTERN.search(chunk_text)
        ):
            return chunk_text

    return None
