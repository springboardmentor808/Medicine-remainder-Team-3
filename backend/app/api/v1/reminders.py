from fastapi import APIRouter

router = APIRouter(tags=["Reminders"])

@router.post("/send-reminder")
def send_reminder():
    return {"success": True}
