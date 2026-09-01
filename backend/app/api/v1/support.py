"""
PillSync Support & Helpdesk API Router.

Provides endpoints for:
    - POST /tickets — Create a support/help ticket.
    - GET  /tickets — List user's support tickets.
"""

from datetime import datetime, timezone
import uuid
from typing import List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter(prefix="/support", tags=["Support & Helpdesk"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class SupportTicketCreate(BaseModel):
    subject: str = Field(..., min_length=2, max_length=150)
    category: str = Field(...)
    priority: str = Field(default="medium")
    description: str = Field(..., min_length=5, max_length=2000)


class SupportTicketResponse(BaseModel):
    id: str
    user_id: str
    subject: str
    category: str
    priority: str
    status: str
    created: str
    updated: str
    description: str


# In-memory ticket store fallback (per session / mock support database)
_SUPPORT_TICKETS = []


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/tickets",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
    summary="Create Support Ticket",
)
async def create_support_ticket(
    payload: SupportTicketCreate,
    current_user: User = Depends(get_current_user),
):
    """Submit a new support or help ticket."""
    ticket_id = f"TKT-2026-{uuid.uuid4().hex[:6].upper()}"
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    ticket_item = {
        "id": ticket_id,
        "user_id": str(current_user.id),
        "subject": payload.subject,
        "category": payload.category,
        "priority": payload.priority,
        "status": "open",
        "created": now_str,
        "updated": now_str,
        "description": payload.description,
    }
    _SUPPORT_TICKETS.append(ticket_item)

    return {
        "message": "Ticket created successfully",
        "data": ticket_item,
    }


@router.get(
    "/tickets",
    response_model=List[dict],
    status_code=status.HTTP_200_OK,
    summary="List Support Tickets",
)
async def list_support_tickets(
    current_user: User = Depends(get_current_user),
):
    """List all support tickets submitted by current user."""
    user_tickets = [t for t in _SUPPORT_TICKETS if t["user_id"] == str(current_user.id)]
    return user_tickets
