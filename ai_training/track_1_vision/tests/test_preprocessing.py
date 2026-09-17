"""
Unit and Integration Tests for PillSync Track 1 Module 1A.

Tests:
    1. CV2Preprocessor (shadow suppression, CLAHE, Otsu, deskew, invalid inputs).
    2. DocumentSegmenter (horizontal projection profile, line bounding boxes, empty inputs).
    3. FuzzyCatalogMatcher (catalog load/generation, RapidFuzz token_sort_ratio, generic salt extraction, invalid inputs).
    4. OCR Service Integration (extract_text_from_image compatibility).
"""

import os
from pathlib import Path
import numpy as np
import pytest

# Ensure imports resolve
import sys
PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ai_training.track_1_vision.src.cv2_preprocessor import CV2Preprocessor
from ai_training.track_1_vision.src.document_segmenter import DocumentSegmenter
from ai_training.track_1_vision.src.fuzzy_catalog_matcher import FuzzyCatalogMatcher


# ===================================================================
# 1. CV2Preprocessor Tests
# ===================================================================

class TestCV2Preprocessor:
    """Test suite for CV2Preprocessor."""

    @pytest.fixture
    def preprocessor(self):
        return CV2Preprocessor()

    def test_remove_shadows_and_binarize_valid_image(self, preprocessor):
        """Should return single-channel binary uint8 array for valid color/grayscale images."""
        # Synthetic 100x100 RGB image with gradient shadow
        img = np.zeros((100, 100, 3), dtype=np.uint8)
        img[20:80, 20:80] = [200, 200, 200]  # bright central box (simulated text region)
        
        result = preprocessor.remove_shadows_and_binarize(img)
        assert isinstance(result, np.ndarray)
        assert result.ndim == 2
        assert result.shape == (100, 100)
        assert result.dtype == np.uint8
        assert set(np.unique(result)).issubset({0, 255})

    def test_remove_shadows_and_binarize_grayscale(self, preprocessor):
        """Should process single-channel grayscale images correctly."""
        gray = np.ones((50, 50), dtype=np.uint8) * 128
        result = preprocessor.remove_shadows_and_binarize(gray)
        assert result.shape == (50, 50)
        assert result.ndim == 2

    def test_deskew_image_straight(self, preprocessor):
        """Unskewed image should return with same shape."""
        img = np.zeros((100, 100), dtype=np.uint8)
        img[30:70, 30:70] = 255
        deskewed = preprocessor.deskew_image(img)
        assert deskewed.shape == (100, 100)

    def test_invalid_and_empty_inputs(self, preprocessor):
        """Should safely handle None, empty array, non-array inputs without raising exceptions."""
        assert preprocessor.remove_shadows_and_binarize(None).size <= 1
        assert preprocessor.remove_shadows_and_binarize(np.array([])).size <= 1
        assert preprocessor.remove_shadows_and_binarize("invalid_type").size <= 1

        assert preprocessor.deskew_image(None).size <= 1
        assert preprocessor.deskew_image(np.array([])).size <= 1
        assert preprocessor.deskew_image(12345).size <= 1


# ===================================================================
# 2. DocumentSegmenter Tests
# ===================================================================

class TestDocumentSegmenter:
    """Test suite for DocumentSegmenter."""

    @pytest.fixture
    def segmenter(self):
        return DocumentSegmenter(min_line_height=5)

    def test_horizontal_projection_profile(self, segmenter):
        """Should compute non-empty projection profile vector."""
        binary = np.zeros((60, 100), dtype=np.uint8)
        binary[10:20, :] = 255  # Line 1 (10px height)
        binary[40:50, :] = 255  # Line 2 (10px height)

        proj = segmenter.compute_horizontal_projection(binary)
        assert isinstance(proj, np.ndarray)
        assert proj.shape == (60,)
        assert np.sum(proj) > 0

    def test_segment_lines_detection(self, segmenter):
        """Should detect and crop horizontal text lines with bounding box tuples."""
        image = np.zeros((100, 100, 3), dtype=np.uint8)
        # Create two distinct horizontal white bands (text lines)
        image[15:30, 10:90] = 255
        image[60:75, 10:90] = 255

        crops = segmenter.segment_lines(image, min_pixels_per_line=5)
        assert isinstance(crops, list)
        assert len(crops) >= 1
        crop_img, bbox = crops[0]
        assert isinstance(crop_img, np.ndarray)
        assert len(bbox) == 4  # (x, y, w, h)

    def test_empty_and_invalid_inputs(self, segmenter):
        """Should return empty list or original fallback for invalid or line-less images."""
        assert segmenter.segment_lines(None) == []
        assert segmenter.segment_lines(np.array([])) == []
        
        # Solid black image (no lines)
        black_img = np.zeros((50, 50), dtype=np.uint8)
        fallback_crops = segmenter.segment_lines(black_img)
        assert isinstance(fallback_crops, list)


# ===================================================================
# 3. FuzzyCatalogMatcher Tests
# ===================================================================

class TestFuzzyCatalogMatcher:
    """Test suite for FuzzyCatalogMatcher."""

    @pytest.fixture
    def matcher(self, tmp_path):
        """Initialize FuzzyCatalogMatcher with synthetic catalog for isolated testing."""
        catalog_file = tmp_path / "test_catalog.json"
        sample_catalog = [
            {
                "name": "Augmentin 625 Duo Tablet",
                "manufacturer": "GlaxoSmithKline",
                "generic_salt": "Amoxycillin (500mg), Clavulanic Acid (125mg)",
            },
            {
                "name": "Azithral 500 Tablet",
                "manufacturer": "Alembic",
                "generic_salt": "Azithromycin (500mg)",
            },
            {
                "name": "Paracetamol 500mg Tablet",
                "manufacturer": "Generic",
                "generic_salt": "Paracetamol (500mg)",
            },
        ]
        import json
        with open(catalog_file, "w") as f:
            json.dump(sample_catalog, f)

        return FuzzyCatalogMatcher(catalog_path=catalog_file, auto_build=False)

    def test_exact_and_fuzzy_match(self, matcher):
        """Should match noisy OCR text to exact medicine name and return generic salt."""
        # Slight OCR noise: 'Augmentin 625 Duo Tab'
        res = matcher.match_medicine("Augmentin 625 Duo Tab", score_cutoff=50.0)
        assert res["verified"] is True
        assert res["matched_medicine"] == "Augmentin 625 Duo Tablet"
        assert res["generic_salt"] == "Amoxycillin (500mg), Clavulanic Acid (125mg)"
        assert res["confidence"] > 0.60

    def test_unmatched_garbage_text(self, matcher):
        """Should return verified=False for completely unrelated text."""
        res = matcher.match_medicine("XYZ123 Completely Unrelated Text", score_cutoff=85.0)
        assert res["verified"] is False
        assert res["matched_medicine"] is None

    def test_empty_and_none_inputs(self, matcher):
        """Should handle empty/None text safely."""
        res_none = matcher.match_medicine(None)
        assert res_none["verified"] is False
        assert res_none["confidence"] == 0.0

        res_empty = matcher.match_medicine("")
        assert res_empty["verified"] is False
        assert res_empty["confidence"] == 0.0


# ===================================================================
# 4. OCR Service Integration Tests
# ===================================================================

class TestOCRServiceIntegration:
    """Integration test for ocr_service.py with Track 1 Module 1A vision pipeline."""

    @pytest.mark.asyncio
    async def test_extract_text_from_image_fallback(self):
        """Empty upload should return backward-compatible dictionary with verified fields."""
        from backend.app.services.ocr_service import extract_text_from_image

        class DummyFile:
            async def read(self):
                return b""

        result = await extract_text_from_image(DummyFile())  # type: ignore
        assert "raw_text" in result
        assert "confidence_score" in result
        assert "verified" in result
        assert result["confidence_score"] >= 0.0

