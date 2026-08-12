"""
PillSync OCR Scanner API Router.

Provides endpoints for:
    - POST /scan                — Upload prescription image & parse text via OCR + NLP. Auto-saves to MongoDB.
    - GET  /history             — Get user's past prescription scans from MongoDB.
    - GET  /history/{scan_id}   — Get details of a specific scan result from MongoDB.
"""

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from app.core.security import get_current_user
from app.models.user import User
from app.schemas.ocr_schema import (
    OCRScanResponse,
    PrescriptionDetailResponse,
    PrescriptionHistoryItem,
    PrescriptionHistoryResponse,
)
from app.services.nlp_service import parse_prescription_text
from app.services.ocr_service import extract_text_from_image
from app.services.prescription_service import (
    get_prescription_by_id,
    get_prescription_history,
    save_ocr_result,
)


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
        "The OCR engine extracts raw text, the NLP parser identifies medicine details, "
        "and the result is automatically stored in MongoDB."
    ),
)
async def scan_prescription(
    file: UploadFile = File(
        ...,
        description="Prescription image file to scan",
    ),
    current_user: User = Depends(get_current_user),
) -> OCRScanResponse:
    """
    Scan an uploaded prescription image and return structured data.

    Pipeline:
        1. Validate file type.
        2. Run OCR preprocessing + Tesseract extraction.
        3. Run NLP parsing on the raw text.
        4. Auto-save raw text + parsed data to MongoDB.
        5. Return structured result.
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
            scan_id=None,
        )

    # --- NLP Parsing ---
    parsed = parse_prescription_text(raw_text)

    # --- Save Result to MongoDB ---
    scan_id = None
    try:
        scan_id = await save_ocr_result(
            user_id=current_user.id,
            filename=file.filename or "prescription.jpg",
            raw_text=raw_text,
            confidence_score=confidence_score,
            parsed_data=parsed,
        )
    except Exception as db_err:
        print(f"[OCR Router] Failed to save result to MongoDB: {db_err}")

    return OCRScanResponse(
        medicine_name=parsed.get("medicine_name"),
        dosage=parsed.get("dosage"),
        frequency=parsed.get("frequency"),
        raw_text=raw_text,
        confidence_score=confidence_score,
        scan_id=scan_id,
    )


@router.get(
    "/history",
    response_model=PrescriptionHistoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Prescription Scan History",
    description="Retrieve a paginated list of past prescription scan results from MongoDB.",
)
async def get_history_endpoint(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_user),
) -> PrescriptionHistoryResponse:
    """Fetch paginated prescription scan history for the current user."""
    try:
        docs, total = await get_prescription_history(
            user_id=current_user.id,
            page=page,
            page_size=page_size,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch prescription history: {str(e)}",
        )

    items = [
        PrescriptionHistoryItem(
            scan_id=doc["_id"],
            filename=doc.get("filename", ""),
            raw_text=doc.get("raw_text", ""),
            confidence_score=doc.get("confidence_score", 0.0),
            parsed_data=doc.get("parsed_data", {}),
            created_at=doc.get("created_at"),
        )
        for doc in docs
    ]

    return PrescriptionHistoryResponse(
        scans=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/history/{scan_id}",
    response_model=PrescriptionDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Prescription Scan Detail",
    description="Retrieve details of a single prescription scan result by ID.",
)
async def get_scan_detail_endpoint(
    scan_id: str,
    current_user: User = Depends(get_current_user),
) -> PrescriptionDetailResponse:
    """Fetch a single scan result from MongoDB."""
    doc = await get_prescription_by_id(scan_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prescription scan with ID '{scan_id}' not found.",
        )

    if doc.get("user_id") != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this prescription scan.",
        )

    return PrescriptionDetailResponse(
        scan_id=doc["_id"],
        user_id=doc.get("user_id", ""),
        filename=doc.get("filename", ""),
        raw_text=doc.get("raw_text", ""),
        confidence_score=doc.get("confidence_score", 0.0),
        parsed_data=doc.get("parsed_data", {}),
        created_at=doc.get("created_at"),
    )
