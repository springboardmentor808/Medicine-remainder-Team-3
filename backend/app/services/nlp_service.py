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

# Comprehensive stop-word list to eliminate hospital/doctor header and document metadata false positives
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
    "templatenet", "template", "company", "prescriber", "information", "info",
    "details", "license", "licence", "number", "birth", "january", "february",
    "march", "april", "may", "june", "july", "august", "september", "october",
    "november", "december", "record", "records", "profile", "form", "specimen",
    "sample", "draft", "copyright", "trademark",
}

# Regex patterns matching section headings, patient demographics, and prescription metadata
_HEADER_EXCLUDE_PATTERNS = [
    r'\b(?:prescriber|prescription|medication|medicine|patient|doctor|physician|clinic|hospital)\s+(?:info|information|details|record|profile|data|history)\b',
    r'\b(?:license|licence|reg|registration|dea|npi)\s*(?:no|number|num|#)?\b',
    r'\b(?:date\s+of\s+birth|dob|birth\s+date|of\s+birth)\b',
    r'\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b',
    r'\b(?:october|november|december|january|february|march|april|may|june|july|august|september)\b',
    r'\b(?:templatenet|template\.net|company|clinic|hospital|healthcare|pharmacy|center|centre|opd|emergency)\b',
    r'\b(?:vital\s+signs|physical\s+exam|lab\s+test|diagnosis|chief\s+complaint|allergies|clinical\s+notes)\b',
    r'\b(?:signature|valid\s+until|refill\s+count|page\s+\d+\s+of\s+\d+)\b',
]
_HEADER_EXCLUDE_REGEX = re.compile('|'.join(_HEADER_EXCLUDE_PATTERNS), re.IGNORECASE)


def _is_excluded(word_or_phrase: str) -> bool:
    """Check if a word, phrase, or line is an excluded stop-word or non-medicine header."""
    if not word_or_phrase:
        return True
    clean = word_or_phrase.strip().lower()
    if clean in _EXCLUDE_WORDS:
        return True
    if _HEADER_EXCLUDE_REGEX.search(clean):
        return True
    # If all constituent tokens are in stop-words or numbers
    tokens = [t for t in re.split(r'[\s\-_\.,/]+', clean) if t]
    if tokens and all(t in _EXCLUDE_WORDS or t.isdigit() for t in tokens):
        return True
    return False


def parse_prescription_text(raw_text: str) -> dict:
    """
    Parse raw OCR text and extract structured prescription data with ReDoS armor.
    """
    if not raw_text or not raw_text.strip():
        return {
            "medicine_name": None,
            "dosage": None,
            "frequency": None,
            "daily_frequency": 1,
            "dosage_form": "Tablet",
            "disease_category": "General Healthcare",
            "initial_quantity": 30,
            "quantity_per_dose": 1,
            "instructions": None,
        }

    # 1. Truncate input to 2048 chars and normalize excessive whitespace
    sanitized_text = raw_text[:MAX_NLP_INPUT_CHARS]
    sanitized_text = re.sub(r"[ \t]+", " ", sanitized_text)
    sanitized_text = re.sub(r"\n{3,}", "\n\n", sanitized_text)

    dosage = _extract_dosage(sanitized_text)
    frequency = _extract_frequency(sanitized_text)
    medicine_name = _extract_medicine_name(sanitized_text)
    daily_frequency = _extract_daily_frequency(frequency)
    dosage_form = _extract_dosage_form(sanitized_text, medicine_name)
    quantity_per_dose = _extract_quantity_per_dose(sanitized_text)
    initial_quantity = _extract_initial_quantity(sanitized_text, daily_frequency)
    disease_category = _infer_disease_category(medicine_name)
    instructions = _extract_instructions(sanitized_text)

    return {
        "medicine_name": medicine_name,
        "dosage": dosage,
        "frequency": frequency,
        "daily_frequency": daily_frequency,
        "dosage_form": dosage_form,
        "disease_category": disease_category,
        "initial_quantity": initial_quantity,
        "quantity_per_dose": quantity_per_dose,
        "instructions": instructions,
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


def _extract_dosage_form(text: str, med_name: Optional[str] = None) -> str:
    """Detects dosage form (Tablet, Capsule, Syrup, Lotion, Gel, Cream, etc.)."""
    combined = f"{med_name or ''} {text}".lower()
    if re.search(r"\b(lotion)\b", combined):
        return "Lotion"
    if re.search(r"\b(gel)\b", combined):
        return "Gel"
    if re.search(r"\b(cream)\b", combined):
        return "Cream"
    if re.search(r"\b(syrup|syr|suspension|liquid|solution)\b", combined):
        return "Syrup"
    if re.search(r"\b(capsule|cap|caps)\b", combined):
        return "Capsule"
    if re.search(r"\b(injection|inj|ampoule|vial)\b", combined):
        return "Injection"
    if re.search(r"\b(drops?|eye\s+drops?|ear\s+drops?)\b", combined):
        return "Drops"
    if re.search(r"\b(inhaler|rotahaler|respules?)\b", combined):
        return "Inhaler"
    if re.search(r"\b(ointment)\b", combined):
        return "Ointment"
    return "Tablet"


def _extract_daily_frequency(freq_str: Optional[str]) -> int:
    """Calculates integer daily frequency from frequency pattern string."""
    if not freq_str:
        return 1
    f = freq_str.lower()
    if any(x in f for x in ["1-1-1", "thrice", "3 times", "3x", "tid", "tds"]):
        return 3
    if any(x in f for x in ["1-0-1", "0-1-1", "twice", "2 times", "2x", "bid", "bd"]):
        return 2
    if any(x in f for x in ["1-1-1-1", "4 times", "4x", "qid"]):
        return 4
    return 1


def _extract_quantity_per_dose(text: str) -> int:
    """Extracts quantity taken per dose (e.g. 1 or 2 tablets)."""
    match = re.search(r"\b([1-3])\s*(?:tab|tablet|cap|capsule|pill|puff|tsp|spoon)s?\b", text, re.I)
    if match:
        try:
            return int(match.group(1))
        except ValueError:
            pass
    return 1


def _extract_initial_quantity(text: str, daily_freq: int = 1) -> int:
    """Extracts prescription quantity or calculates from course duration."""
    qty_match = re.search(r"\b(?:qty|quantity|x|total)\s*[:=]?\s*(\d{1,3})\b", text, re.I)
    if qty_match:
        try:
            val = int(qty_match.group(1))
            if 1 <= val <= 500:
                return val
        except ValueError:
            pass
    days_match = re.search(r"\bfor\s+(\d{1,2})\s+days?\b", text, re.I)
    if days_match:
        try:
            days = int(days_match.group(1))
            if 1 <= days <= 90:
                return max(1, days * daily_freq)
        except ValueError:
            pass
    return 30


def _infer_disease_category(med_name: Optional[str], generic_salt: Optional[str] = None) -> str:
    """Infers disease/therapeutic category from medicine or generic name matching DB/UI enums."""
    combined = f"{med_name or ''} {generic_salt or ''}".lower()
    if re.search(r"\b(amox|cipro|azith|doxy|cefix|augmin|augmentin|ceft|levoflox|antibiotic)\b", combined):
        return "Antibiotics"
    if re.search(r"\b(metformin|glim|insulin|glicl|vilda|dapa|diab|sugar|glycomet|januvia)\b", combined):
        return "Diabetes"
    if re.search(r"\b(amlod|telmi|losar|olmesartan|ramipril|atenolol|bp|hypertens)\b", combined):
        return "Blood Pressure"
    if re.search(r"\b(ator|rosu|metopr|furo|clopid|warfarin|cardio|digoxin|aspirin|statin|nitroglycerin)\b", combined):
        return "Heart Medications"
    if re.search(r"\b(thyro|thyroxine|levothyroxine|eltroxin|hypothyroid)\b", combined):
        return "Thyroid"
    if re.search(r"\b(vitamin|calcium|d3|b12|folic|iron|zinc|multivitamin|becosules|shelcal)\b", combined):
        return "Vitamins"
    return "General Healthcare"


def _extract_instructions(text: str) -> Optional[str]:
    """Extracts dietary, timing, and administrative instructions."""
    notes_parts = []
    lower_t = text.lower()
    if "after food" in lower_t or "after meals" in lower_t or "post meal" in lower_t or "pc" in lower_t.split():
        notes_parts.append("Take after meals")
    elif "before food" in lower_t or "before meals" in lower_t or "empty stomach" in lower_t or "ac" in lower_t.split():
        notes_parts.append("Take on an empty stomach / before food")

    if "bedtime" in lower_t or "at night" in lower_t or "hs" in lower_t.split():
        notes_parts.append("Take at bedtime")
    elif "morning" in lower_t or "bbf" in lower_t.split():
        notes_parts.append("Take in the morning")

    if "water" in lower_t and "warm" in lower_t:
        notes_parts.append("With warm water")

    return "; ".join(notes_parts) if notes_parts else None


def parse_multiple_medicines(raw_text: str) -> List[dict]:
    """
    Parses multi-item prescription text line-by-line to extract all prescribed medicines.
    Enforces clinical evidence validation (dosage, dosage form, frequency, or verified catalog match).
    Strictly filters out non-medicine headings, hospital/prescriber metadata, dates, and watermarks.
    Returns a list of structured medicine dictionaries.
    """
    if not raw_text or not raw_text.strip():
        return []

    lines = [ln.strip() for ln in raw_text.split("\n") if ln.strip()]
    medicines = []
    seen_names = set()

    # Try importing FuzzyCatalogMatcher
    matcher = None
    try:
        from ai_training.track_1_vision.src.fuzzy_catalog_matcher import FuzzyCatalogMatcher
        matcher = FuzzyCatalogMatcher()
    except Exception:
        matcher = None

    DOSAGE_FORM_KEYWORDS = re.compile(
        r"\b(tablet|tablets|tab|tabs|capsule|capsules|cap|caps|syrup|syr|liquid|solution|suspension|injection|inj|ampoule|vial|lotion|gel|cream|ointment|drops?|inhaler|powder|spray|patch|mouthwash)\b",
        re.IGNORECASE,
    )

    for line in lines:
        # Discard lines matching header patterns or demographic metadata
        if _is_excluded(line):
            continue

        clean_line = re.sub(r"^\d+[\.\)\-]\s*", "", line).strip()
        clean_line = re.sub(r"^(?:rx:?|tab\.?|cap\.?|syr\.?|inj\.?)\s*", "", clean_line, flags=re.IGNORECASE).strip()
        if len(clean_line) < 3 or _is_excluded(clean_line):
            continue

        # Extract clinical evidence signals from this line
        line_dosage = _extract_dosage(clean_line)
        line_freq = _extract_frequency(clean_line)
        line_med_name = _extract_medicine_name(clean_line)
        has_form_keyword = bool(DOSAGE_FORM_KEYWORDS.search(line)) or bool(DOSAGE_FORM_KEYWORDS.search(clean_line))
        matched_catalog_name = None
        generic_salt = None
        catalog_verified = False

        if matcher and clean_line:
            # Require high confidence (75%+) for catalog matching to prevent false positive header matches
            m_res = matcher.match_medicine(line_med_name or clean_line, score_cutoff=75.0)
            if m_res and m_res.get("verified"):
                cat_name = m_res.get("matched_medicine")
                if cat_name and not _is_excluded(cat_name):
                    matched_catalog_name = cat_name
                    generic_salt = m_res.get("generic_salt")
                    catalog_verified = True

        # Clinical validation: A line is ONLY a medicine if it possesses clinical evidence:
        # 1. Dosage strength (e.g. 500mg, 10ml, 20mg)
        # 2. Dosage form keyword (e.g. Liquid, Lotion, Gel, Injection, Tablet, Capsule)
        # 3. Frequency regimen (e.g. 1-0-1, OD, BD, SOS, daily)
        # 4. High-confidence verified catalog match
        has_clinical_evidence = bool(line_dosage or has_form_keyword or line_freq or catalog_verified)
        if not has_clinical_evidence:
            # Pure text with no dosage, no dosage form, and no frequency is a heading, date, or watermark
            continue

        final_name = matched_catalog_name or line_med_name
        if not final_name and line_dosage:
            # If dosage was found, try words before dosage
            words_before = clean_line.split(line_dosage)[0].strip()
            if words_before and len(words_before) >= 3 and not _is_excluded(words_before):
                final_name = words_before

        if not final_name or len(final_name) < 3 or _is_excluded(final_name):
            continue

        norm_key = re.sub(r"[^a-z0-9]", "", final_name.lower())
        if norm_key not in seen_names:
            seen_names.add(norm_key)
            df = _extract_daily_frequency(line_freq)
            med_obj = {
                "medicine_name": final_name,
                "generic_salt": generic_salt or "",
                "dosage": line_dosage or "As prescribed",
                "frequency": line_freq or (
                    "1-1-1" if df == 3 else "1-0-1" if df == 2 else "1-0-0"
                ),
                "daily_frequency": df,
                "dosage_form": _extract_dosage_form(clean_line, final_name),
                "disease_category": _infer_disease_category(final_name, generic_salt),
                "initial_quantity": _extract_initial_quantity(clean_line, df),
                "quantity_per_dose": _extract_quantity_per_dose(clean_line),
                "instructions": _extract_instructions(clean_line) or "Take as directed",
            }
            medicines.append(med_obj)

    # Fallback to single parse if no individual lines matched, with strict exclusion
    if not medicines:
        single = parse_prescription_text(raw_text)
        if single and single.get("medicine_name") and not _is_excluded(single.get("medicine_name")):
            medicines.append(single)

    return medicines


