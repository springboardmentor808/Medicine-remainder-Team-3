import cv2
import numpy as np
import pytesseract
from PIL import Image
import io

def process_prescription_ocr(image_bytes: bytes) -> dict:
    """
    Processes prescription image using OpenCV preprocessing and Tesseract OCR.
    """
    try:
        # Load image into numpy array for OpenCV
        image = Image.open(io.BytesIO(image_bytes))
        img_np = np.array(image)

        # Convert to Grayscale
        if len(img_np.shape) == 3:
            gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
        else:
            gray = img_np

        # OpenCV Image Preprocessing: Thresholding & Denoising
        processed_img = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]

        # Extract text via Tesseract OCR
        raw_text = pytesseract.image_to_string(processed_img)

        return {
            "success": True,
            "raw_text": raw_text.strip(),
            "lines_extracted": len(raw_text.splitlines())
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "note": "Install Tesseract-OCR binary on system path for full OCR capabilities."
        }
