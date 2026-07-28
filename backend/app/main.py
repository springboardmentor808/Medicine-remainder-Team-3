from fastapi import FastAPI
from app.api.v1.auth import router as auth_router
from app.api.v1.reminders import router as reminders_router
from app.api.v1.ocr import router as ocr_router

app = FastAPI(title="AI Medicine Reminder API")

# Register API v1 Routers
app.include_router(auth_router, prefix="/api/v1")
app.include_router(reminders_router, prefix="/api/v1")
app.include_router(ocr_router, prefix="/api/v1")

@app.get("/health")
def health_check():
    return {"status": "Healthy"}
