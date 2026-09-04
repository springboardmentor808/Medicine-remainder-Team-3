"""
PillSync Track 1 Vision - OpenCV Preprocessor Module.

Provides image preprocessing utilities for prescription scans:
    - Shadow suppression using morphological dilation & background division
    - CLAHE (Contrast Limited Adaptive Histogram Equalization)
    - Otsu Binarization
    - minAreaRect-based Deskewing
    - Safe handling of invalid, empty, or unreadable images
"""

import math
from typing import Any, Optional, Tuple, Union
import numpy as np

try:
    import cv2
    HAS_CV2 = True
except ImportError:
    cv2 = None
    HAS_CV2 = False


class CV2Preprocessor:
    """OpenCV Image Preprocessor for Prescription Vision Pipeline."""

    def __init__(self, clahe_clip_limit: float = 2.0, clahe_grid_size: Tuple[int, int] = (8, 8)):
        self.clahe_clip_limit = clahe_clip_limit
        self.clahe_grid_size = clahe_grid_size

    def _validate_image(self, image: Any) -> Optional[np.ndarray]:
        """Validate input image. Returns grayscale image or None if invalid."""
        if not HAS_CV2 or cv2 is None or image is None:
            return None
        if not isinstance(image, np.ndarray):
            return None
        if image.size == 0 or image.ndim < 2:
            return None

        # Convert to 8-bit uint8 if necessary
        if image.dtype != np.uint8:
            try:
                image = cv2.normalize(image, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
            except Exception:
                return None

        return image

    def remove_shadows_and_binarize(self, image: np.ndarray) -> np.ndarray:
        """
        Suppresses shadows using background estimation, applies CLAHE,
        and performs Otsu binarization.

        Args:
            image: Input image (BGR, Grayscale, or BGRA numpy array).

        Returns:
            Binary thresholded image (255 for background/text, 0 for opposite), 8-bit single channel.
        """
        valid_img = self._validate_image(image)
        if valid_img is None:
            # Return empty 1x1 black image fallback if invalid
            return np.zeros((1, 1), dtype=np.uint8)

        # Step 1: Ensure single-channel Grayscale
        if valid_img.ndim == 3 and valid_img.shape[2] in (3, 4):
            gray = cv2.cvtColor(valid_img, cv2.COLOR_BGR2GRAY if valid_img.shape[2] == 3 else cv2.COLOR_BGRA2GRAY)
        else:
            gray = valid_img.copy()

        try:
            # Step 2: Background Estimation via Morphological Dilation + Median Blur
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
            dilated = cv2.dilate(gray, kernel)
            bg = cv2.medianBlur(dilated, 21)

            # Step 3: Shadow Suppression via Background Division
            # absdiff/divide normalizes lighting variation across uneven shadows
            diff = cv2.absdiff(gray, bg)
            normalized = cv2.normalize(255 - diff, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX, dtype=cv2.CV_8UC1)

            # Step 4: Contrast enhancement using CLAHE
            clahe = cv2.createCLAHE(clipLimit=self.clahe_clip_limit, tileGridSize=self.clahe_grid_size)
            enhanced = clahe.apply(normalized)

            # Step 5: Gaussian Blur + Otsu Binarization
            blurred = cv2.GaussianBlur(enhanced, (5, 5), 0)
            _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

            return binary

        except Exception as e:
            # Fallback on raw image threshold if complex morph step fails
            print(f"[CV2Preprocessor] Shadow suppression fallback: {e}")
            try:
                _, simple_binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                return simple_binary
            except Exception:
                return gray

    def deskew_image(self, image: np.ndarray) -> np.ndarray:
        """
        Detects document skew angle using cv2.minAreaRect and rotates the image straight.

        Args:
            image: Input grayscale or binary image array.

        Returns:
            Deskewed image array.
        """
        valid_img = self._validate_image(image)
        if valid_img is None:
            return np.zeros((1, 1), dtype=np.uint8)

        if valid_img.ndim == 3:
            gray = cv2.cvtColor(valid_img, cv2.COLOR_BGR2GRAY)
        else:
            gray = valid_img

        try:
            # Prepare foreground pixel coordinates
            # Invert image if background is light (255) so foreground text is non-zero
            mean_val = np.mean(gray)
            if mean_val > 127:
                inv = cv2.bitwise_not(gray)
            else:
                inv = gray

            coords = np.column_stack(np.where(inv > 0))
            if coords.shape[0] < 10:
                return valid_img

            # Compute minAreaRect over foreground points
            rect = cv2.minAreaRect(coords)
            angle = rect[-1]

            # cv2.minAreaRect returns angle in range [-90, 0) or [0, 90) depending on OpenCV version
            if angle < -45:
                angle = -(90 + angle)
            elif angle > 45:
                angle = 90 - angle
            else:
                angle = -angle

            # Ignore negligible skew (< 0.5 degrees or > 45 degrees anomaly)
            if abs(angle) < 0.5 or abs(angle) > 45:
                return valid_img

            # Rotate image
            (h, w) = valid_img.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            rotated = cv2.warpAffine(
                valid_img,
                M,
                (w, h),
                flags=cv2.INTER_CUBIC,
                borderMode=cv2.BORDER_REPLICATE,
            )
            return rotated

        except Exception as e:
            print(f"[CV2Preprocessor] Deskew failed, returning original image: {e}")
            return valid_img
