from fastapi import APIRouter

router = APIRouter(prefix="/ocr", tags=["OCR"])

@router.post("/process")
def process_ocr():
    return {"success": True}
