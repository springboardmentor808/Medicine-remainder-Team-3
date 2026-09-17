"""
PillSync AI Medical Assistant API Router.
═══════════════════════════════════════════

G-Stack: Vercel AI SDK useChat protocol for streaming + memory.
Endpoints:
  POST /api/v1/assistant/chat     — Main chat (messages array + locale)
  GET  /api/v1/assistant/suggestions — Contextual quick-prompt chips
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.services.assistant_service import (
    handle_assistant_query,
    get_suggestions,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/assistant", tags=["AI Medical Assistant"])


# ── Request / Response Schemas ────────────────────────────────────

class ChatMessage(BaseModel):
    """Single chat message — mirrors Vercel AI SDK useChat protocol."""
    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., description="Message text content")


class ChatRequest(BaseModel):
    """
    Chat request body — compatible with Vercel AI SDK useChat hook.
    G-Stack: messages array maintains conversational memory (pronoun resolution).
    """
    messages: List[ChatMessage] = Field(
        ...,
        description="Conversation history array [{role, content}]",
        min_length=1,
    )
    locale: str = Field(
        default="en",
        description="Response language: 'en' (English) or 'hi' (Hindi)",
        pattern="^(en|hi)$",
    )


class SuggestionItem(BaseModel):
    label: str
    query: str


class AssistantResponse(BaseModel):
    """Structured response from the assistant."""
    type: str = Field(..., description="EMERGENCY | DDI_ALERT | SCHEDULE | REFILL_ALERT | TEXT")
    content: Optional[str] = Field(default="", description="Response text content")
    intent: Optional[str] = None
    grounded: Optional[bool] = None
    fallback: Optional[bool] = None
    # Optional action payloads
    warnings: Optional[list] = None
    next_dose: Optional[dict] = None
    low_stock_items: Optional[list] = None
    emergency_numbers: Optional[list] = None
    message_en: Optional[str] = None
    message_hi: Optional[str] = None
    action: Optional[str] = None
    disclaimer: Optional[str] = None


# ── POST /assistant/chat ──────────────────────────────────────────

@router.post(
    "/chat",
    response_model=AssistantResponse,
    summary="AI Medical Assistant Chat",
    description=(
        "Send a conversation history and receive a grounded, "
        "context-aware medical assistant response. "
        "Supports emergency detection, DDI alerts, schedule queries, "
        "refill alerts, and general medical Q&A — all powered by the "
        "patient's live dashboard data."
    ),
)
async def assistant_chat(
    request: ChatRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    G-Stack 3-Pass Pipeline:
      Pass 0 — Emergency SOS (regex, <5ms, zero LLM)
      Pass 1 — Context Collector (active meds, schedule, inventory)
      Pass 2 — Intent Router (SCHEDULE/DDI/REFILL/DOSAGE/GENERAL)
      Pass 3 — Grounded Gemini 1.5 Flash Synthesizer
    """
    try:
        user_id = current_user.id
        messages = [{"role": m.role, "content": m.content} for m in request.messages]

        result = await handle_assistant_query(
            user_id=user_id,
            messages=messages,
            locale=request.locale,
            db_session=db,
        )

        return AssistantResponse(**result)

    except Exception as e:
        logger.error(f"[Assistant] Chat error for user {getattr(current_user, 'id', '?')}: {e}")
        # G-Stack: Graceful degradation — never crash the endpoint
        return AssistantResponse(
            type="TEXT",
            content=(
                "I'm having trouble connecting right now. Your medications and alarms are still working perfectly. Please try again in a moment."
                if request.locale == "en"
                else "अभी कनेक्ट करने में समस्या हो रही है। आपकी दवाइयां और अलार्म पूरी तरह काम कर रहे हैं। कृपया कुछ देर बाद पुनः प्रयास करें।"
            ),
            fallback=True,
        )


# ── GET /assistant/suggestions ────────────────────────────────────

@router.get(
    "/suggestions",
    response_model=List[SuggestionItem],
    summary="Contextual Quick-Prompt Suggestions",
    description="Returns smart suggestion chips based on pending doses and low stock.",
)
async def assistant_suggestions(
    locale: str = "en",
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    G-Stack: Proactive UX — suggest queries before the user asks.
    Returns max 4 contextual chip suggestions.
    """
    try:
        user_id = current_user.id
        suggestions = await get_suggestions(user_id, locale, db)
        return [SuggestionItem(**s) for s in suggestions]
    except Exception as e:
        logger.warning(f"[Assistant] Suggestions error: {e}")
        return []
