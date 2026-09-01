"""
PillSync Clinical NLP Service (Production Hardened).

Parses raw OCR text to extract structured prescription data:
    - Medicine name (with alphanumeric brand support e.g. Dolo-650, Augmentin-625 Duo)
    - Dosage (e.g. 500mg, 250 mg, 0.5mg, 10ml)
    - Frequency (e.g. 1-0-1, twice daily, BD, TDS, SOS)

Enforces strict clinical exclusion boundaries to eliminate hospital/doctor header false positives.
"""

import re
from typing import List, Optional, Pattern, Tuple, Set

spacy = None
HAS_SPACY = False

try:
    import spacy as _spacy_mod  # type: ignore[import-not-found]
    spacy = _spacy_mod
    HAS_SPACY = True
except Exception:
    HAS_SPACY = False

_nlp_model = None


def _get_nlp_model():
    """Load the spaCy model once and cache it, if available."""
    global _nlp_model
    if not HAS_SPACY or spacy is None:
        return None
    if _nlp_model is None:
        try:
            _nlp_model = spacy.load("en_core_web_sm")
        except Exception:
            try:
                _nlp_model = spacy.blank("en")
            except Exception:
                _nlp_model = None
    return _nlp_model


# ---------------------------------------------------------------------------
# Dosage and Frequency Regex Patterns
# ---------------------------------------------------------------------------

_DOSAGE_PATTERN = re.compile(
    r"(?<!-)\b(\d+(?:\.\d+)?)\s*(mg|g|ml|mcg|iu)\b",
    re.IGNORECASE,
)

_FREQUENCY_PATTERNS: List[Tuple[Pattern, Optional[str]]] = [
    (re.compile(r"\b([012])\s*[-–]\s*([012])\s*[-–]\s*([012])\b"), None),
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
    (re.compile(r"\b(?:SOS|s\.?o\.?s\.?|as needed|prn)\b", re.I), "SOS"),
]

MAX_NLP_INPUT_CHARS = 2048

# Linear, non-backtracking medicine name pattern with bounded word length and max 4 tokens
_MEDICINE_NAME_PATTERN = re.compile(
    r"\b([A-Z][A-Za-z0-9\-\/]{1,30}(?:\s+[A-Za-z0-9\-\/]{1,30}){0,3})\b"
)

# Comprehensive stop-word list to eliminate hospital/doctor header false positives
_EXCLUDE_WORDS: Set[str] = {
    "take", "tablet", "tablets", "capsule", "capsules", "daily",
    "morning", "evening", "night", "after", "before", "with",
    "food", "meals", "water", "doctor", "dr", "patient", "name",
    "date", "prescription", "pharmacy", "hospital", "hospitals",
    "clinic", "clinics", "healthcare", "medical", "centre", "center",
    "apollo", "fortis", "max", "aiims", "manipal", "medanta",
    "mbbs", "md", "ms", "dm", "mch", "dnb", "reg", "rx", "address",
    "tel", "phone", "mobile", "signature", "department", "opd",
    "age", "sex", "gender", "male", "female", "years", "yrs", "yr",
    "weight", "kg", "bp", "pulse", "temp", "diagnosis", "advice",
    "dose", "dosage", "frequency", "duration", "quantity", "qty",
    "the", "for", "and", "per", "day", "times", "once",
    "twice", "thrice", "three", "four", "one", "two",
    "tab", "cap", "syrup", "injection", "inj", "oral", "drops",
    "instructions", "review", "follow", "up", "days", "weeks", "months",
}


def _is_excluded(word: str) -> bool:
    return word.strip().lower() in _EXCLUDE_WORDS


def parse_prescription_text(raw_text: str) -> dict:
    """
    Parse raw OCR text and extract structured prescription data with ReDoS armor.
    """
    if not raw_text or not raw_text.strip():
        return {
            "medicine_name": None,
            "dosage": None,
            "frequency": None,
        }

    # 1. Truncate input to 2048 chars and normalize excessive whitespace
    sanitized_text = raw_text[:MAX_NLP_INPUT_CHARS]
    sanitized_text = re.sub(r"[ \t]+", " ", sanitized_text)
    sanitized_text = re.sub(r"\n{3,}", "\n\n", sanitized_text)

    dosage = _extract_dosage(sanitized_text)
    frequency = _extract_frequency(sanitized_text)
    medicine_name = _extract_medicine_name(sanitized_text)

    return {
        "medicine_name": medicine_name,
        "dosage": dosage,
        "frequency": frequency,
    }


def _extract_dosage(text: str) -> Optional[str]:
    """Extract the first valid dosage match from text."""
    match = _DOSAGE_PATTERN.search(text)
    if match:
        value, unit = match.group(1), match.group(2).lower()
        return f"{value}{unit}"
    return None


def _extract_frequency(text: str) -> Optional[str]:
    """Extract frequency from text using prioritized regex patterns."""
    for pattern, replacement in _FREQUENCY_PATTERNS:
        match = pattern.search(text)
        if match:
            if replacement is None:
                return match.group(0).replace("–", "-")
            return replacement
    return None


def _extract_medicine_name(text: str) -> Optional[str]:
    """
    Extracts the most clinically probable medicine name.
    Ignores clinical headers and hospital metadata.
    """
    lines = text.split("\n")
    cleaned_lines = []
    for line in lines:
        line_clean = line.strip()
        lower_line = line_clean.lower()
        if any(h in lower_line for h in ["hospital", "clinic", "dr.", "mbbs", "opd", "patient", "date:", "tel:", "phone:"]):
            continue
        line_clean = re.sub(r"^(?:rx:?|tab\.?|cap\.?|syr\.?)\s*", "", line_clean, flags=re.IGNORECASE).strip()
        if line_clean:
            cleaned_lines.append(line_clean)

    target_text = "\n".join(cleaned_lines) if cleaned_lines else text

    # Priority 1: Line-by-line boundary extraction before dosage/frequency
    for line in cleaned_lines:
        words = line.split()
        valid_words = []
        for w in words:
            w_clean = re.sub(r"[,\.;:]", "", w).strip()
            if not w_clean:
                continue
            if _is_excluded(w_clean) or _DOSAGE_PATTERN.fullmatch(w_clean) or w_clean.isdigit():
                if valid_words:
                    break
                continue
            if re.match(r"^[A-Za-z0-9\-\/]{2,}$", w_clean):
                valid_words.append(w_clean)

        if valid_words:
            candidate_name = " ".join(valid_words)
            if len(candidate_name) >= 3:
                return candidate_name

    # Priority 2: Regex word patterns
    candidates = _MEDICINE_NAME_PATTERN.findall(target_text)
    for candidate in candidates:
        words = [w for w in candidate.split() if not _is_excluded(w) and not _DOSAGE_PATTERN.match(w)]
        if words:
            cand = " ".join(words)
            if len(cand) >= 3 and not cand.isdigit():
                return cand

    # Priority 3: spaCy noun chunk extraction
    nlp = _get_nlp_model()
    if nlp is not None:
        try:
            doc = nlp(target_text)
            for chunk in doc.noun_chunks:
                chunk_text = chunk.text.strip()
                words = [w for w in chunk_text.split() if not _is_excluded(w) and not _DOSAGE_PATTERN.search(w)]
                if words:
                    cand = " ".join(words)
                    if len(cand) >= 3:
                        return cand
        except Exception:
            pass

    return None
