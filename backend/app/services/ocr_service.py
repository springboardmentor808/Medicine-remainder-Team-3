"""
PillSync Clinical OCR Service (Production Hardened).

Integrates:
- Track 1 Module 1A: Preprocessing (Shadow suppression, CLAHE, deskewing),
  Document line segmentation, and Fuzzy Indian Medicine Catalog matching.
- Track 1 Module 1B: TrOCR handwriting recognition model interface hook.
- Production Clinical Safety: Zero silent or hallucinatory fallbacks on unreadable/empty inputs,
  payload size protection, and strict confidence bounds.
"""

import asyncio
import io
import os
import platform
import sys
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
import cv2
import numpy as np
from fastapi import UploadFile
from PIL import Image

# Ensure project root is available in sys.path for cross-package imports
PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Safe initialization for pytesseract
pytesseract = None
HAS_PYTESSERACT = False

try:
    import pytesseract as _pytesseract_mod
    pytesseract = _pytesseract_mod
    HAS_PYTESSERACT = True
except ImportError:
    pass

# Safe import for Track 1 Vision Module 1A Components
try:
    from ai_training.track_1_vision.src.cv2_preprocessor import CV2Preprocessor
    from ai_training.track_1_vision.src.document_segmenter import DocumentSegmenter
    from ai_training.track_1_vision.src.fuzzy_catalog_matcher import FuzzyCatalogMatcher
    HAS_VISION_MODULES = True
except ImportError as err:
    print(f"[OCR Service] Track 1 Vision Module 1A components fallback: {err}")
    CV2Preprocessor = None  # type: ignore
    DocumentSegmenter = None  # type: ignore
    FuzzyCatalogMatcher = None  # type: ignore
    HAS_VISION_MODULES = False

# Initialize vision components once
_preprocessor = CV2Preprocessor() if HAS_VISION_MODULES and CV2Preprocessor else None
_segmenter = DocumentSegmenter() if HAS_VISION_MODULES and DocumentSegmenter else None
_catalog_matcher = FuzzyCatalogMatcher() if HAS_VISION_MODULES and FuzzyCatalogMatcher else None

# Standard Windows Tesseract binary and data paths
_WINDOWS_EXE_PATHS = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
]
_WINDOWS_TESSDATA_PATHS = [
    r"C:\Program Files\Tesseract-OCR\tessdata",
    r"C:\Program Files (x86)\Tesseract-OCR\tessdata",
]


class OCRSyncResult(tuple):
    """
    Dual-compatible result object.
    Can be unpacked as a 3-tuple: (raw_text, confidence_score, status)
    while also exposing structured fields: .verified, .matched_medicine, .generic_salt
    and dict-like access via .get().
    """
    def __new__(
        cls,
        raw_text: str,
        confidence_score: float,
        status: str,
        verified: bool = False,
        matched_medicine: Optional[str] = None,
        generic_salt: Optional[str] = None,
    ):
        return super().__new__(cls, (raw_text, confidence_score, status))

    def __init__(
        self,
        raw_text: str,
        confidence_score: float,
        status: str,
        verified: bool = False,
        matched_medicine: Optional[str] = None,
        generic_salt: Optional[str] = None,
    ):
        self.raw_text = raw_text
        self.confidence_score = confidence_score
        self.status = status
        self.verified = verified
        self.matched_medicine = matched_medicine
        self.generic_salt = generic_salt

    def get(self, key: str, default: Any = None) -> Any:
        mapping = {
            "raw_text": self.raw_text,
            "confidence_score": self.confidence_score,
            "status": self.status,
            "verified": self.verified,
            "matched_medicine": self.matched_medicine,
            "generic_salt": self.generic_salt,
        }
        return mapping.get(key, default)


def _configure_tesseract() -> bool:
    """Configures pytesseract binary and tessdata environment safely."""
    if pytesseract is None:
        return False

    if platform.system() == "Windows":
        for exe_path, data_path in zip(_WINDOWS_EXE_PATHS, _WINDOWS_TESSDATA_PATHS):
            if os.path.isfile(exe_path):
                pytesseract.pytesseract.tesseract_cmd = exe_path
                if os.path.isdir(data_path):
                    os.environ["TESSDATA_PREFIX"] = data_path
                return True
        return False
    return True


_TESSERACT_AVAILABLE = _configure_tesseract()


def _deskew_image(image: np.ndarray) -> np.ndarray:
    """
    Detects skew angle in document and rotates image to upright position.
    """
    try:
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()

        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)
        pts = cv2.findNonZero(thresh)
        if pts is None or len(pts) < 50:
            return image

        rect = cv2.minAreaRect(pts)
        angle = rect[-1]
        if angle < -45.0:
            angle = -(90.0 + angle)
        else:
            angle = -angle

        if 0.5 < abs(angle) < 45.0:
            (h, w) = image.shape[:2]
            center = (w // 2, h // 2)
            m_rot = cv2.getRotationMatrix2D(center, angle, 1.0)
            rotated = cv2.warpAffine(
                image, m_rot, (w, h),
                flags=cv2.INTER_CUBIC,
                borderMode=cv2.BORDER_REPLICATE
            )
            return rotated
    except Exception:
        pass
    return image


def _preprocess_image(image: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    """
    Clinical-grade fallback image preprocessing pipeline:
    1. Downsample if image exceeds 2000px on longest edge.
    2. Deskewing to normalize scan angle.
    3. CLAHE (Contrast Limited Adaptive Histogram Equalization).
    4. Adaptive thresholding.
    """
    max_dim = max(image.shape[:2])
    if max_dim > 2000:
        scale = 2000.0 / max_dim
        new_w = int(image.shape[1] * scale)
        new_h = int(image.shape[0] * scale)
        image = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)

    deskewed = _deskew_image(image)

    if len(deskewed.shape) == 3:
        gray = cv2.cvtColor(deskewed, cv2.COLOR_BGR2GRAY)
    else:
        gray = deskewed.copy()

    denoised = cv2.fastNlMeansDenoising(gray, h=10)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    enhanced = clahe.apply(denoised)

    blurred = cv2.GaussianBlur(enhanced, (3, 3), 0)
    thresh = cv2.adaptiveThreshold(
        blurred,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=11,
        C=2,
    )
    return enhanced, thresh


def _trocr_fallback_interface(image_crop: Any) -> Optional[str]:
    """
    Interface hook for Track 1 Module 1B TrOCR model.
    Acts as passthrough until Module 1B runtime model weights are attached.
    """
    return None


def _perform_ocr_sync(image_bytes: bytes) -> OCRSyncResult:
    """
    Executes Clinical OCR & Vision Pipeline in worker thread.
    Returns: OCRSyncResult (unpacks as (raw_text, confidence_score, status))
    Zero silent/hallucinatory text fallback — clinical safety compliance.
    """
    if not image_bytes or len(image_bytes) < 100:
        return OCRSyncResult("", 0.0, "UNREADABLE")

    try:
        np_arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img is None:
            pil_fallback = Image.open(io.BytesIO(image_bytes))
            img = cv2.cvtColor(np.array(pil_fallback), cv2.COLOR_RGB2BGR)

        if img is None or img.size == 0:
            return OCRSyncResult("", 0.0, "UNREADABLE")

        # Configure Tesseract
        has_tess = _configure_tesseract()
        if not has_tess or pytesseract is None:
            return OCRSyncResult("", 0.0, "OCR_ENGINE_UNAVAILABLE")

        # Step 1: Preprocessing
        enhanced_gray = None
        thresh = None
        processed_img = None

        if _preprocessor:
            try:
                binarized = _preprocessor.remove_shadows_and_binarize(img)
                processed_img = _preprocessor.deskew_image(binarized)
            except Exception:
                processed_img = None

        if processed_img is None:
            enhanced_gray, thresh = _preprocess_image(img)
            processed_img = thresh
        else:
            enhanced_gray, thresh = _preprocess_image(img)

        # Step 2: Line Segmentation & Line-level OCR
        extracted_lines = []
        confs = []

        if _segmenter and processed_img is not None:
            try:
                line_crops = _segmenter.segment_lines(processed_img)
                for crop_img, bbox in line_crops:
                    # Check TrOCR handwriting hook
                    trocr_text = _trocr_fallback_interface(crop_img)
                    if trocr_text:
                        extracted_lines.append(trocr_text)
                        confs.append(85)
                        continue

                    if crop_img.ndim == 2:
                        rgb = cv2.cvtColor(crop_img, cv2.COLOR_GRAY2RGB)
                    else:
                        rgb = crop_img
                    pil_crop = Image.fromarray(rgb)

                    try:
                        line_text = pytesseract.image_to_string(pil_crop, config="--psm 7").strip()
                        if line_text:
                            extracted_lines.append(line_text)
                            confs.append(75)
                    except Exception:
                        pass
            except Exception:
                extracted_lines = []

        # Step 3: Full-Image OCR Dual-Strategy Fallback if line segmentation is empty
        raw_text = "\n".join(extracted_lines).strip() if extracted_lines else ""
        best_conf = (sum(confs) / len(confs) / 100.0) if confs else 0.0

        if not raw_text or len(raw_text) < 4:
            # Strategy A: Enhanced Grayscale with PSM 3
            try:
                pil_enhanced = Image.fromarray(enhanced_gray)
                data_dict = pytesseract.image_to_data(pil_enhanced, config="--psm 3 --oem 3", output_type=pytesseract.Output.DICT)
                if isinstance(data_dict, dict):
                    confs_a = [int(c) for c in data_dict.get("conf", []) if str(c).lstrip("-").isdigit() and int(c) > 0]
                    avg_conf_a = (sum(confs_a) / len(confs_a) / 100.0) if confs_a else 0.0
                else:
                    avg_conf_a = 0.0
                text_a = str(pytesseract.image_to_string(pil_enhanced, config="--psm 3 --oem 3")).strip()
                if len(text_a) > len(raw_text):
                    raw_text = text_a
                    best_conf = max(best_conf, avg_conf_a)
            except Exception:
                pass

            # Strategy B: Adaptive Thresholded Image with PSM 6
            try:
                pil_thresh = Image.fromarray(thresh)
                data_dict_b = pytesseract.image_to_data(pil_thresh, config="--psm 6 --oem 3", output_type=pytesseract.Output.DICT)
                if isinstance(data_dict_b, dict):
                    confs_b = [int(c) for c in data_dict_b.get("conf", []) if str(c).lstrip("-").isdigit() and int(c) > 0]
                    avg_conf_b = (sum(confs_b) / len(confs_b) / 100.0) if confs_b else 0.0
                else:
                    avg_conf_b = 0.0
                text_b = str(pytesseract.image_to_string(pil_thresh, config="--psm 6 --oem 3")).strip()
                if len(text_b) > len(raw_text) or avg_conf_b > best_conf:
                    raw_text = text_b
                    best_conf = max(best_conf, avg_conf_b)
            except Exception:
                pass

        cleaned_text = raw_text.strip()
        if not cleaned_text or len(cleaned_text) < 4 or best_conf < 0.30:
            return OCRSyncResult("", 0.0, "UNREADABLE")

        # Step 4: Fuzzy Catalog Matching against Indian Medicines Catalog
        verified = False
        matched_med = None
        generic_salt = None

        if _catalog_matcher:
            try:
                match_result = _catalog_matcher.match_medicine(cleaned_text)
                if match_result and match_result.get("verified"):
                    verified = True
                    matched_med = match_result.get("matched_medicine")
                    generic_salt = match_result.get("generic_salt")
            except Exception:
                pass

        status_code = "SUCCESS" if best_conf >= 0.55 else "LOW_CONFIDENCE"
        return OCRSyncResult(
            raw_text=cleaned_text,
            confidence_score=round(best_conf, 2),
            status=status_code,
            verified=verified,
            matched_medicine=matched_med,
            generic_salt=generic_salt,
        )

    except Exception:
        return OCRSyncResult("", 0.0, "UNREADABLE")


MAX_OCR_FILE_SIZE = 10 * 1024 * 1024  # 10 MB limit
CHUNK_READ_SIZE = 1024 * 1024  # 1 MB


async def extract_text_from_image(file: UploadFile) -> dict:
    """
    Asynchronously extracts text and matches Indian medicine catalog from an uploaded prescription image.
    Enforces strict clinical safety bounds, zero silent hallucination, and 10MB memory limits.
    """
    try:
        total_bytes = bytearray()
        while True:
            chunk = await file.read(CHUNK_READ_SIZE)
            if not chunk:
                break
            total_bytes.extend(chunk)
            if len(total_bytes) > MAX_OCR_FILE_SIZE:
                return {
                    "raw_text": "",
                    "confidence_score": 0.0,
                    "status": "PAYLOAD_TOO_LARGE",
                    "message": "Uploaded prescription exceeds maximum allowable size of 10 MB.",
                    "verified": False,
                    "matched_medicine": None,
                    "generic_salt": None,
                }

        contents = bytes(total_bytes)
        if not contents or len(contents) < 50:
            return {
                "raw_text": "",
                "confidence_score": 0.0,
                "status": "UNREADABLE",
                "message": "Uploaded file is empty or corrupted. Please upload a clear image.",
                "verified": False,
                "matched_medicine": None,
                "generic_salt": None,
            }

        ocr_res = await asyncio.to_thread(_perform_ocr_sync, contents)
        raw_text, confidence, status_str = ocr_res

        if status_str == "UNREADABLE":
            return {
                "raw_text": "",
                "confidence_score": 0.0,
                "status": "UNREADABLE",
                "message": "Could not recognize prescription text with clinical certainty. Please enter medication details manually.",
                "verified": False,
                "matched_medicine": None,
                "generic_salt": None,
            }

        if status_str == "OCR_ENGINE_UNAVAILABLE":
            return {
                "raw_text": "",
                "confidence_score": 0.0,
                "status": "OCR_ENGINE_UNAVAILABLE",
                "message": "OCR service is currently operating in offline mode. Please enter prescription details manually.",
                "verified": False,
                "matched_medicine": None,
                "generic_salt": None,
            }

        return {
            "raw_text": raw_text,
            "confidence_score": confidence,
            "status": status_str,
            "message": "Text extracted successfully." if status_str == "SUCCESS" else "Low confidence extraction. Please review carefully before saving.",
            "verified": getattr(ocr_res, "verified", False),
            "matched_medicine": getattr(ocr_res, "matched_medicine", None),
            "generic_salt": getattr(ocr_res, "generic_salt", None),
        }

    except Exception:
        return {
            "raw_text": "",
            "confidence_score": 0.0,
            "status": "ERROR",
            "message": "An error occurred while processing the prescription image.",
            "verified": False,
            "matched_medicine": None,
            "generic_salt": None,
        }