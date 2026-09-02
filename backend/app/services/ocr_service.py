"""
PillSync Clinical OCR Service (Production Hardened).

Handles image preprocessing using OpenCV (Grayscale, CLAHE contrast enhancement,
deskewing, and adaptive binarization) and text extraction via Tesseract OCR.
Enforces strict clinical safety error boundaries — ZERO silent/hallucinatory fallbacks.
"""

import asyncio
import io
import os
import platform
import cv2
import numpy as np
from fastapi import UploadFile, HTTPException, status
from PIL import Image

# -- pytesseract import with safe initialization --
pytesseract = None
HAS_PYTESSERACT = False

try:
    import pytesseract as _pytesseract_mod
    pytesseract = _pytesseract_mod
    HAS_PYTESSERACT = True
except ImportError:
    pass

# Standard Windows Tesseract binary paths
_WINDOWS_EXE_PATHS = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
]
_WINDOWS_TESSDATA_PATHS = [
    r"C:\Program Files\Tesseract-OCR\tessdata",
    r"C:\Program Files (x86)\Tesseract-OCR\tessdata",
]


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

        # Invert colors: text as foreground
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
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            rotated = cv2.warpAffine(
                image, M, (w, h),
                flags=cv2.INTER_CUBIC,
                borderMode=cv2.BORDER_REPLICATE
            )
            return rotated
    except Exception:
        pass
    return image


def _preprocess_image(image: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """
    Clinical-grade image preprocessing pipeline:
    1. Downsample if image exceeds 2000px on longest edge (prevents heap memory explosion).
    2. Deskewing to normalize scan angle.
    3. Grayscale conversion.
    4. CLAHE (Contrast Limited Adaptive Histogram Equalization).
    5. Adaptive thresholding with Gaussian blur.
    Returns: (enhanced_gray, binary_threshold)
    """
    # Protect against multi-megapixel decompression bombs
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

    # Denoise
    denoised = cv2.fastNlMeansDenoising(gray, h=10)

    # CLAHE contrast enhancement
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    enhanced = clahe.apply(denoised)

    # Adaptive thresholding
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


def _perform_ocr_sync(image_bytes: bytes) -> tuple[str, float, str]:
    """
    Executes OCR in a worker thread.
    Returns: (raw_text, confidence_score, status)
    Zero hallucinatory text fallback — clinical safety compliance.
    """
    if not image_bytes or len(image_bytes) < 100:
        return "", 0.0, "UNREADABLE"

    try:
        # Decode raw image bytes
        np_arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img is None:
            pil_fallback = Image.open(io.BytesIO(image_bytes))
            img = cv2.cvtColor(np.array(pil_fallback), cv2.COLOR_RGB2BGR)

        if img is None:
            return "", 0.0, "UNREADABLE"

        # Preprocessing
        enhanced_gray, thresh = _preprocess_image(img)

        # Configure Tesseract binary
        has_tess = _configure_tesseract()
        if not has_tess or pytesseract is None:
            return "", 0.0, "OCR_ENGINE_UNAVAILABLE"

        raw_text = ""
        best_conf = 0.0

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
        if cleaned_text and len(cleaned_text) >= 4 and best_conf >= 0.30:
            status_code = "SUCCESS" if best_conf >= 0.55 else "LOW_CONFIDENCE"
            return cleaned_text, round(best_conf, 2), status_code

        return "", 0.0, "UNREADABLE"

    except Exception:
        return "", 0.0, "UNREADABLE"


MAX_OCR_FILE_SIZE = 10 * 1024 * 1024  # 10 MB limit
CHUNK_READ_SIZE = 1024 * 1024  # 1 MB


async def extract_text_from_image(file: UploadFile) -> dict:
    """
    Asynchronously extracts text from an uploaded prescription image.
    Enforces strict clinical safety bounds and 10MB memory limits.
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
                }

        contents = bytes(total_bytes)
        if not contents or len(contents) < 50:
            return {
                "raw_text": "",
                "confidence_score": 0.0,
                "status": "UNREADABLE",
                "message": "Uploaded file is empty or corrupted. Please upload a clear image.",
            }

        raw_text, confidence, status_str = await asyncio.to_thread(_perform_ocr_sync, contents)

        if status_str == "UNREADABLE":
            return {
                "raw_text": "",
                "confidence_score": 0.0,
                "status": "UNREADABLE",
                "message": "Could not recognize prescription text with clinical certainty. Please enter medication details manually.",
            }

        if status_str == "OCR_ENGINE_UNAVAILABLE":
            return {
                "raw_text": "",
                "confidence_score": 0.0,
                "status": "OCR_ENGINE_UNAVAILABLE",
                "message": "OCR service is currently operating in offline mode. Please enter prescription details manually.",
            }

        return {
            "raw_text": raw_text,
            "confidence_score": confidence,
            "status": status_str,
            "message": "Text extracted successfully." if status_str == "SUCCESS" else "Low confidence extraction. Please review carefully before saving.",
        }

    except Exception:
        return {
            "raw_text": "",
            "confidence_score": 0.0,
            "status": "ERROR",
            "message": "An error occurred while processing the prescription image.",
        }