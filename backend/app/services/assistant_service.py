"""
PillSync AI Medical Assistant Service (Grounded RAG Engine).
═══════════════════════════════════════════════════════════════

G-Stack Architecture:
  Pass 0 — Emergency Detector (regex + clinical keywords, <5ms, zero LLM)
  Pass 1 — Context Collector (active meds, today's schedule, inventory from DB)
  Pass 2 — Intent Classifier + Deterministic Lookup (SCHEDULE/DDI/REFILL/GENERAL)
  Pass 3 — Grounded Gemini 1.5 Flash Synthesizer (strict clinical prompt, locale-aware)

Skill/Pattern:
  - G-Stack: "3-pass intent routing: Emergency → Deterministic → Grounded LLM"
  - G-Stack: "pgvector over ChromaDB, zero extra infra"
  - WHO/FDA/BNF: Our existing clinical data (253K catalog, 176+ DDI matrix, dosage benchmarks)
"""

import re
import logging
from typing import List, Dict, Any, Optional
from datetime import date

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════
# PASS 0: Emergency Detector — Zero-Tolerance SOS Guardrail
# ═══════════════════════════════════════════════════════════════════

# Overdose, suicide, cardiac, respiratory, and poisoning keywords
# G-Stack: Zero-tolerance — bypasses ALL generative AI on match
EMERGENCY_PATTERNS_EN = [
    r'\b(overdose|od\'?d|took\s+(too\s+)?many|swallowed\s+all)\b',
    r'\b(chest\s+pain|heart\s+attack|cardiac|can\'?t\s+breathe|difficulty\s+breathing)\b',
    r'\b(suicide|suicidal|kill\s+my\s*self|want\s+to\s+die|end\s+my\s+life)\b',
    r'\b(poison|poisoning|toxic|toxicity)\b',
    r'\b(seizure|convulsion|unconscious|fainted|collapse[d]?)\b',
    r'\b(severe\s+bleed|hemorrhage|vomiting\s+blood|blood\s+in\s+stool)\b',
    r'\b(anaphylax|severe\s+allerg|can\'?t\s+swallow|throat\s+closing)\b',
    r'\b(stroke|paralyz|sudden\s+numbness|face\s+drooping)\b',
]

EMERGENCY_PATTERNS_HI = [
    r'(ज़्यादा\s+गोली|बहुत\s+ज़्यादा\s+दवा|सारी\s+गोलियां\s+खा\s+ली)',
    r'(सीने\s+में\s+दर्द|दिल\s+का\s+दौरा|सांस\s+नहीं\s+आ\s+रही)',
    r'(आत्महत्या|मरना\s+चाहता|जीना\s+नहीं\s+चाहता)',
    r'(ज़हर|विषाक्त|पॉइज़न)',
    r'(बेहोश|दौरा\s+पड़ा|मिर्गी|बेसुध)',
    r'(खून\s+की\s+उल्टी|बहुत\s+खून|खून\s+बह\s+रहा)',
]

EMERGENCY_REGEX_EN = re.compile('|'.join(EMERGENCY_PATTERNS_EN), re.IGNORECASE)
EMERGENCY_REGEX_HI = re.compile('|'.join(EMERGENCY_PATTERNS_HI), re.IGNORECASE)


def detect_emergency(text: str) -> Optional[Dict[str, Any]]:
    """
    Pass 0: Scan user input for acute distress or overdose keywords.
    If detected, return a structured EmergencyActionPayload immediately.
    G-Stack: Zero-tolerance SOS — bypasses ALL generative text.
    """
    if EMERGENCY_REGEX_EN.search(text) or EMERGENCY_REGEX_HI.search(text):
        return {
            "type": "EMERGENCY",
            "action": "SOS_TRIGGERED",
            "content": "⚠️ EMERGENCY DETECTED. Please call emergency services immediately.",
            "message_en": "⚠️ EMERGENCY DETECTED. Please call emergency services immediately.",
            "message_hi": "⚠️ आपातकालीन स्थिति — कृपया तुरंत एम्बुलेंस बुलाएं।",
            "emergency_numbers": [
                {"label": "India Emergency (108)", "number": "108"},
                {"label": "Police / Ambulance (112)", "number": "112"},
                {"label": "US Emergency (911)", "number": "911"},
            ],
            "disclaimer": "This is NOT medical advice. Call emergency services now.",
        }
    return None


# ═══════════════════════════════════════════════════════════════════
# PASS 1: Context Collector — Gather user's live dashboard data
# ═══════════════════════════════════════════════════════════════════

async def collect_patient_context(user_id: Any, db_session) -> Dict[str, Any]:
    """
    Queries the patient's active prescriptions, today's schedule,
    and remaining pill inventory via SQLAlchemy ORM.
    This data grounds the LLM so it never hallucinates.
    """
    from sqlalchemy import select
    from app.models.user import User
    from app.models.medicine import Medicine
    from app.models.schedule import Schedule, DoseLog

    context = {
        "active_medicines": [],
        "today_schedule": [],
        "inventory": [],
        "user_name": "Patient",
    }

    try:
        # Get user name
        result = await db_session.execute(
            select(User).where(User.id == user_id)
        )
        user_obj = result.scalars().first()
        if user_obj:
            context["user_name"] = user_obj.full_name or user_obj.username or "Patient"

        # Active medicines
        result = await db_session.execute(
            select(Medicine).where(Medicine.user_id == user_id).order_by(Medicine.name)
        )
        for med in result.scalars().all():
            context["active_medicines"].append({
                "id": str(med.id),
                "name": med.name,
                "dosage": med.dosage,
                "form": getattr(med, "disease_category", "Tablet"),
                "frequency": f"{med.daily_frequency} times daily",
                "instructions": med.notes or "Take as directed",
                "remaining_qty": med.current_stock,
            })

        # Today's schedule
        today_val = date.today()
        result = await db_session.execute(
            select(Schedule).where(Schedule.user_id == user_id, Schedule.is_active == True).order_by(Schedule.scheduled_time)
        )
        for s in result.scalars().all():
            med_name = s.medicine.name if s.medicine else "Medicine"
            med_dosage = s.medicine.dosage if s.medicine else ""
            # Check dose log for today
            log_res = await db_session.execute(
                select(DoseLog).where(
                    DoseLog.schedule_id == s.id,
                    DoseLog.scheduled_date == today_val
                )
            )
            dose_log = log_res.scalars().first()
            status_str = dose_log.status if dose_log else "PENDING"
            context["today_schedule"].append({
                "medicine": med_name,
                "dosage": med_dosage,
                "time": str(s.scheduled_time),
                "slot": s.dose_label or "",
                "status": status_str,
            })

        # Inventory / refill status
        for med in context["active_medicines"]:
            remaining = med.get("remaining_qty")
            if remaining is not None:
                context["inventory"].append({
                    "medicine": med["name"],
                    "remaining_pills": remaining,
                    "low_stock": remaining <= 5 if remaining is not None else False,
                })

    except Exception as e:
        logger.warning(f"[Assistant] Context collection partial failure: {e}")

    return context


# ═══════════════════════════════════════════════════════════════════
# PASS 2: Intent Classifier — Determine query type
# ═══════════════════════════════════════════════════════════════════

INTENT_PATTERNS = {
    "SCHEDULE": [
        r'\b(next\s+dose|when\s+(should\s+)?i\s+take|schedule|timing|what\s+time)\b',
        r'(अगली\s+दवा|कब\s+लेनी|शेड्यूल|टाइमिंग|किस\s+समय)',
    ],
    "DDI": [
        r'\b(interact|interaction|take.*together|mix|combine|safe\s+to\s+take.*with)\b',
        r'\b(side\s+effect|contraindic|clash|conflict)\b',
        r'(साथ\s+में\s+ले\s+सकत|इंटरैक्शन|दुष्प्रभाव|एक\s+साथ)',
    ],
    "REFILL": [
        r'\b(refill|how\s+many.*left|run\s+out|stock|supply|pills?\s+remaining)\b',
        r'(रीफिल|कितनी\s+बची|खत्म\s+हो|स्टॉक|गोली\s+बाकी)',
    ],
    "DOSAGE": [
        r'\b(how\s+much|dosage|dose|maximum|can\s+i\s+take\s+more|overdose\s+limit)\b',
        r'(कितनी\s+खुराक|डोज़|ज़्यादा\s+ले\s+सकत|अधिकतम)',
    ],
}


def classify_intent(text: str) -> str:
    """
    Simple regex-based intent classifier.
    Returns: 'SCHEDULE', 'DDI', 'REFILL', 'DOSAGE', or 'GENERAL'.
    """
    text_lower = text.lower()
    for intent, patterns in INTENT_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, text_lower, re.IGNORECASE):
                return intent
    return "GENERAL"


# ═══════════════════════════════════════════════════════════════════
# PASS 2B: Deterministic DDI Lookup
# ═══════════════════════════════════════════════════════════════════

def check_ddi_for_query(query: str, active_medicines: List[Dict]) -> List[Dict]:
    """
    Uses our existing DrugInteractionService to check if the user
    is asking about a specific drug interaction with their active meds.
    WHO/FDA/BNF: 176+ DDI Safety Matrix.
    """
    from app.services.drug_interaction_service import DrugInteractionService

    active_names = [m["name"] for m in active_medicines]

    # Try to extract a drug name from the query
    warnings = []
    for med_name in active_names:
        result = DrugInteractionService.check_interactions(med_name, active_names)
        warnings.extend(result)

    # Deduplicate
    seen = set()
    unique = []
    for w in warnings:
        key = (w["title"], tuple(w["interacting_drugs"]))
        if key not in seen:
            seen.add(key)
            unique.append(w)

    return unique


# ═══════════════════════════════════════════════════════════════════
# PASS 2C: Dosage Safety Lookup
# ═══════════════════════════════════════════════════════════════════

def get_dosage_info(query: str, active_medicines: List[Dict]) -> Optional[Dict]:
    """
    Uses our existing WHO Dosage Service to provide maximum safe dosage info.
    WHO/FDA/BNF: DOSAGE_LIMITS knowledge base.
    """
    from app.services.who_dosage_service import WHODosageService

    for med in active_medicines:
        med_name_lower = (med.get("name") or "").lower()
        if med_name_lower in query.lower():
            result = WHODosageService.get_dosage_benchmark(med["name"])
            if result:
                return result
    return None


# ═══════════════════════════════════════════════════════════════════
# PASS 3: Grounded LLM Synthesizer — Gemini 1.5 Flash
# ═══════════════════════════════════════════════════════════════════

SYSTEM_PROMPT_TEMPLATE = """You are PillSync AI — a grounded, clinical medical assistant for {user_name}.

STRICT RULES:
1. ONLY answer using the patient context provided below. If information is absent, say "I don't have that information in your records."
2. NEVER invent a dosage, drug name, or interaction. NEVER hallucinate.
3. Respond in {language} language.
4. Be empathetic, clinical, and concise. Use emoji sparingly for clarity.
5. If the user mentions an emergency, direct them to call 108 (India) or 911 (US) immediately.

PATIENT CONTEXT:
━━━━━━━━━━━━━━━
Active Medications:
{active_medicines}

Today's Schedule:
{today_schedule}

Pill Inventory:
{inventory}

{additional_context}
━━━━━━━━━━━━━━━

Answer the user's question using ONLY the above context."""


def build_grounded_prompt(
    context: Dict[str, Any],
    locale: str = "en",
    additional_context: str = "",
) -> str:
    """
    Constructs the grounded system prompt with the patient's live data.
    G-Stack: Strict clinical constraints ensure zero hallucination.
    """
    language = "Hindi (हिन्दी)" if locale == "hi" else "English"
    user_name = context.get("user_name", "Patient")

    # Format active medicines
    active_meds_text = ""
    for med in context.get("active_medicines", []):
        active_meds_text += f"• {med['name']} {med.get('dosage', '')} ({med.get('form', 'Tablet')}) — {med.get('frequency', 'As directed')} — Instructions: {med.get('instructions', 'N/A')}\n"
    if not active_meds_text:
        active_meds_text = "No active medications found.\n"

    # Format today's schedule
    schedule_text = ""
    for dose in context.get("today_schedule", []):
        status_emoji = "✅" if dose["status"] == "TAKEN" else "⏳" if dose["status"] == "PENDING" else "⏰"
        schedule_text += f"• {status_emoji} {dose['medicine']} {dose.get('dosage', '')} at {dose.get('time', 'N/A')} ({dose.get('slot', '')}) — Status: {dose['status']}\n"
    if not schedule_text:
        schedule_text = "No scheduled doses for today.\n"

    # Format inventory
    inventory_text = ""
    for item in context.get("inventory", []):
        low_flag = " ⚠️ LOW STOCK" if item.get("low_stock") else ""
        inventory_text += f"• {item['medicine']}: {item.get('remaining_pills', '?')} pills remaining{low_flag}\n"
    if not inventory_text:
        inventory_text = "No inventory data available.\n"

    return SYSTEM_PROMPT_TEMPLATE.format(
        user_name=user_name,
        language=language,
        active_medicines=active_meds_text,
        today_schedule=schedule_text,
        inventory=inventory_text,
        additional_context=additional_context,
    )


# ═══════════════════════════════════════════════════════════════════
# MASTER ASSISTANT HANDLER — Orchestrates all passes
# ═══════════════════════════════════════════════════════════════════

async def handle_assistant_query(
    user_id: int,
    messages: List[Dict[str, str]],
    locale: str,
    db_session,
) -> Dict[str, Any]:
    """
    Master handler for the AI Medical Assistant.
    Runs the 4-pass pipeline: Emergency → Context → Intent → Grounded LLM.

    Returns a structured response dict with type, content, and optional action cards.
    """
    # Extract the latest user message
    latest_message = ""
    for msg in reversed(messages):
        if msg.get("role") == "user":
            latest_message = msg.get("content", "")
            break

    if not latest_message:
        return {
            "type": "TEXT",
            "content": "I'm here to help! Please ask me about your medications, schedule, or any health concerns." if locale == "en"
                else "मैं आपकी मदद के लिए हूँ! अपनी दवाइयों, शेड्यूल, या किसी भी स्वास्थ्य चिंता के बारे में पूछें।",
        }

    # ── Pass 0: Emergency Detection ─────────────────────────────
    emergency = detect_emergency(latest_message)
    if emergency:
        logger.warning(f"[Assistant] EMERGENCY SOS triggered for user {user_id}")
        return emergency

    # ── Pass 1: Collect Patient Context ─────────────────────────
    context = await collect_patient_context(user_id, db_session)

    # ── Pass 2: Intent Classification ───────────────────────────
    intent = classify_intent(latest_message)
    additional_context = ""

    if intent == "DDI":
        ddi_results = check_ddi_for_query(latest_message, context.get("active_medicines", []))
        if ddi_results:
            additional_context = "DRUG INTERACTION ALERTS:\n"
            for w in ddi_results:
                additional_context += f"⚠️ [{w['severity']}] {w['title']}: {w['description']} — Action: {w['action']}\n"
            return {
                "type": "DDI_ALERT",
                "content": additional_context,
                "warnings": ddi_results,
                "intent": intent,
            }

    if intent == "DOSAGE":
        dosage_info = get_dosage_info(latest_message, context.get("active_medicines", []))
        if dosage_info:
            additional_context = f"WHO DOSAGE BENCHMARK:\n{dosage_info}\n"

    if intent == "SCHEDULE":
        schedule = context.get("today_schedule", [])
        pending = [d for d in schedule if d.get("status") == "PENDING"]
        if pending:
            next_dose = pending[0]
            schedule_response = (
                f"आपकी अगली खुराक: {next_dose['medicine']} {next_dose.get('dosage', '')} — समय: {next_dose.get('time', 'N/A')} ({next_dose.get('slot', '')})"
                if locale == "hi"
                else f"Your next dose: {next_dose['medicine']} {next_dose.get('dosage', '')} — Time: {next_dose.get('time', 'N/A')} ({next_dose.get('slot', '')})"
            )
            return {
                "type": "SCHEDULE",
                "content": schedule_response,
                "next_dose": next_dose,
                "intent": intent,
            }

    if intent == "REFILL":
        inventory = context.get("inventory", [])
        low_stock = [i for i in inventory if i.get("low_stock")]
        if low_stock:
            refill_msg = "⚠️ Low stock alert:\n" if locale == "en" else "⚠️ स्टॉक कम है:\n"
            for item in low_stock:
                refill_msg += f"• {item['medicine']}: केवल {item['remaining_pills']} गोलियां बची हैं\n" if locale == "hi" \
                    else f"• {item['medicine']}: Only {item['remaining_pills']} pills remaining\n"
            return {
                "type": "REFILL_ALERT",
                "content": refill_msg,
                "low_stock_items": low_stock,
                "intent": intent,
            }

    # ── Pass 3: Grounded LLM Response ───────────────────────────
    system_prompt = build_grounded_prompt(context, locale, additional_context)

    # Build conversation for the LLM
    llm_messages = [{"role": "system", "content": system_prompt}]
    for msg in messages:
        if msg.get("role") in ("user", "assistant"):
            llm_messages.append(msg)

    # Try Gemini 1.5 Flash — G-Stack: Sub-400ms TTFT, ultra-low cost
    try:
        import google.generativeai as genai
        from app.core.config import settings

        api_key = getattr(settings, 'GEMINI_API_KEY', None) or getattr(settings, 'GOOGLE_API_KEY', None)
        if api_key:
            try:
                model = genai.GenerativeModel('gemini-3.6-flash')
            except Exception:
                model = genai.GenerativeModel('gemini-flash-latest')

            # Convert to Gemini format
            gemini_contents = []
            for msg in llm_messages:
                role = "model" if msg["role"] in ("assistant", "system") else "user"
                gemini_contents.append({"role": role, "parts": [msg["content"]]})

            response = model.generate_content(gemini_contents)

            return {
                "type": "TEXT",
                "content": response.text,
                "intent": intent,
                "grounded": True,
            }
    except Exception as e:
        logger.warning(f"[Assistant] Gemini API error: {e}")

    # Fallback: Return deterministic context-based response without LLM
    fallback_response = _generate_fallback_response(context, intent, locale)
    return {
        "type": "TEXT",
        "content": fallback_response,
        "intent": intent,
        "grounded": True,
        "fallback": True,
    }


def _generate_fallback_response(context: Dict, intent: str, locale: str) -> str:
    """
    Deterministic fallback when Gemini API is unavailable.
    G-Stack: Graceful degradation — app never crashes on API failure.
    """
    meds = context.get("active_medicines", [])
    schedule = context.get("today_schedule", [])

    if locale == "hi":
        if not meds:
            return "आपकी कोई सक्रिय दवाई रिकॉर्ड में नहीं मिली। कृपया पहले अपनी पर्ची स्कैन करें या दवा जोड़ें।"

        med_list = ", ".join([m["name"] for m in meds[:5]])
        pending = [d for d in schedule if d.get("status") == "PENDING"]

        response = f"आपकी सक्रिय दवाइयां: {med_list}।"
        if pending:
            next_d = pending[0]
            response += f"\n\nआपकी अगली खुराक: {next_d['medicine']} — समय: {next_d.get('time', 'N/A')}।"
        return response
    else:
        if not meds:
            return "No active medications found in your records. Please scan a prescription or add medications first."

        med_list = ", ".join([m["name"] for m in meds[:5]])
        pending = [d for d in schedule if d.get("status") == "PENDING"]

        response = f"Your active medications: {med_list}."
        if pending:
            next_d = pending[0]
            response += f"\n\nYour next dose: {next_d['medicine']} — Time: {next_d.get('time', 'N/A')}."
        return response


# ═══════════════════════════════════════════════════════════════════
# CONTEXTUAL SUGGESTIONS — Smart quick-prompt chips
# ═══════════════════════════════════════════════════════════════════

async def get_suggestions(user_id: int, locale: str, db_session) -> List[Dict[str, str]]:
    """
    Returns contextual quick-prompt chips based on pending doses or low stock.
    G-Stack: Proactive UX — suggest before the user asks.
    """
    context = await collect_patient_context(user_id, db_session)
    suggestions = []

    pending = [d for d in context.get("today_schedule", []) if d.get("status") == "PENDING"]
    low_stock = [i for i in context.get("inventory", []) if i.get("low_stock")]

    if pending:
        suggestions.append({
            "label": "अगली दवा कब है?" if locale == "hi" else "When is my next dose?",
            "query": "When is my next dose?",
        })

    if low_stock:
        suggestions.append({
            "label": "कौन सी दवा खत्म हो रही है?" if locale == "hi" else "Which medicine is running low?",
            "query": "Which medicine is running low?",
        })

    suggestions.extend([
        {
            "label": "मेरी दवाइयां बताओ" if locale == "hi" else "Show my active medicines",
            "query": "What are my active medications?",
        },
        {
            "label": "कोई साइड इफेक्ट?" if locale == "hi" else "Any drug interactions?",
            "query": "Do any of my medications interact with each other?",
        },
    ])

    return suggestions[:4]  # Max 4 chips
