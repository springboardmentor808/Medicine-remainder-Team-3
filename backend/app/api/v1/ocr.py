"""
PillSync OCR Scanner API Router.

Provides the POST /scan endpoint for uploading prescription images
and receiving structured medicine data extracted via OCR + NLP.
"""

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.schemas.ocr_schema import OCRScanResponse
from app.services.ocr_service import extract_text_from_image
from app.services.nlp_service import parse_prescription_text


router = APIRouter(prefix="/ocr", tags=["OCR Scanner"])

# Allowed image MIME types
_ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/bmp",
    "image/tiff",
    "image/webp",
}


@router.post(
    "/scan",
    response_model=OCRScanResponse,
    status_code=status.HTTP_200_OK,
    summary="Scan Prescription Image",
    description=(
        "Upload a prescription image (JPEG, PNG, BMP, TIFF, or WebP). "
        "The OCR engine extracts raw text, then the NLP parser identifies "
        "the medicine name, dosage, and frequency."
    ),
)
async def scan_prescription(
    file: UploadFile = File(
        ...,
        description="Prescription image file to scan",
    ),
) -> OCRScanResponse:
    """
    Scan an uploaded prescription image and return structured data.

    Pipeline:
        1. Validate the uploaded file type.
        2. Run OCR preprocessing + Tesseract extraction.
        3. Run NLP parsing on the raw text.
        4. Return the combined result.
    """
    # --- Validate file type ---
    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Unsupported file type: '{file.content_type}'. "
                f"Allowed types: {', '.join(sorted(_ALLOWED_CONTENT_TYPES))}"
            ),
        )

    # --- OCR Extraction ---
    try:
        ocr_result = await extract_text_from_image(file)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR processing failed: {str(e)}",
        )

    raw_text: str = ocr_result.get("raw_text", "")
    confidence_score: float = ocr_result.get("confidence_score", 0.0)

    if not raw_text:
        return OCRScanResponse(
            medicine_name=None,
            dosage=None,
            frequency=None,
            raw_text="",
            confidence_score=0.0,
        )

    # --- NLP Parsing ---
    parsed = parse_prescription_text(raw_text)

    return OCRScanResponse(
        medicine_name=parsed.get("medicine_name"),
        dosage=parsed.get("dosage"),
        frequency=parsed.get("frequency"),
        raw_text=raw_text,
        confidence_score=confidence_score,
    )
