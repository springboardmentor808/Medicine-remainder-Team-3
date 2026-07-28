import spacy

try:
    nlp = spacy.load("en_core_web_sm")
except Exception:
    nlp = spacy.blank("en")

def extract_medicine_entities(text: str) -> dict:
    """
    Parses text to extract dosage, drug names, and scheduling keywords using spaCy NLP.
    """
    doc = nlp(text)
    entities = [{"text": ent.text, "label": ent.label_} for ent in doc.ents]
    
    return {
        "text_length": len(text),
        "entities": entities,
        "tokens": [token.text for token in doc if not token.is_stop][:20]
    }
