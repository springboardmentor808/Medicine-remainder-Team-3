"""
PillSync Track 1 Vision - Document Segmenter Module.

Segments prescription document images into individual text line crops using
horizontal projection profiling and bounding-box detection.
"""

from typing import Any, List, Optional, Tuple
import numpy as np

try:
    import cv2
    HAS_CV2 = True
except ImportError:
    cv2 = None
    HAS_CV2 = False


class DocumentSegmenter:
    """Document Segmenter based on Horizontal Projection Profiling."""

    def __init__(self, min_line_height: int = 10, padding: int = 4):
        self.min_line_height = min_line_height
        self.padding = padding

    def compute_horizontal_projection(self, binary_image: np.ndarray) -> np.ndarray:
        """
        Computes the horizontal projection profile of a binary image.

        Args:
            binary_image: 2D numpy array (grayscale/binary image).

        Returns:
            1D numpy array containing row pixel intensity sums.
        """
        if binary_image is None or not isinstance(binary_image, np.ndarray) or binary_image.ndim != 2:
            return np.array([], dtype=np.int64)

        # Invert if image background is bright (white) so text pixels are 255
        if np.mean(binary_image) > 127:
            text_pixels = (255 - binary_image) // 255
        else:
            text_pixels = binary_image // 255

        # Horizontal projection is sum of foreground text pixels per row
        projection = np.sum(text_pixels, axis=1)
        return projection

    def segment_lines(
        self,
        image: np.ndarray,
        binary_image: Optional[np.ndarray] = None,
        min_pixels_per_line: int = 5,
    ) -> List[Tuple[np.ndarray, Tuple[int, int, int, int]]]:
        """
        Segments prescription image into line crops using horizontal projection profile.

        Args:
            image: Original or preprocessed input image.
            binary_image: Optional pre-thresholded binary image for projection calculation.
            min_pixels_per_line: Minimum foreground pixels in a row to consider part of a text line.

        Returns:
            List of tuples: (cropped_line_img, (x, y, w, h))
        """
        if image is None or not isinstance(image, np.ndarray) or image.size == 0:
            return []

        (h, w) = image.shape[:2]
        if h < 5 or w < 5:
            return []

        # Prepare binary image if not provided
        if binary_image is None or binary_image.shape[:2] != (h, w):
            if HAS_CV2 and cv2 is not None:
                if image.ndim == 3:
                    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
                else:
                    gray = image
                _, binary_image = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            else:
                binary_image = image if image.ndim == 2 else image[:, :, 0]

        # Step 1: Compute projection profile
        projection = self.compute_horizontal_projection(binary_image)
        if projection.size == 0:
            return []

        # Step 2: Identify line boundaries (start_y, end_y)
        in_line = False
        start_y = 0
        line_spans: List[Tuple[int, int]] = []

        for y, val in enumerate(projection):
            if val >= min_pixels_per_line and not in_line:
                in_line = True
                start_y = y
            elif val < min_pixels_per_line and in_line:
                in_line = False
                end_y = y
                if (end_y - start_y) >= self.min_line_height:
                    line_spans.append((start_y, end_y))

        if in_line and (h - start_y) >= self.min_line_height:
            line_spans.append((start_y, h))

        # Fallback if no specific lines detected: treat whole image as single crop
        if not line_spans:
            return [(image, (0, 0, w, h))]

        # Step 3: Crop line regions with padding
        results: List[Tuple[np.ndarray, Tuple[int, int, int, int]]] = []

        for y1, y2 in line_spans:
            padded_y1 = max(0, y1 - self.padding)
            padded_y2 = min(h, y2 + self.padding)
            crop_h = padded_y2 - padded_y1

            crop = image[padded_y1:padded_y2, 0:w]
            bbox = (0, padded_y1, w, crop_h)
            results.append((crop, bbox))

        return results
