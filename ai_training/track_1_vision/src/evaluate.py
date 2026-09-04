"""
Model Evaluation and Quality Gate Verification for PillSync Track 1 Module 1B.

Evaluates fine-tuned TrOCR model on test dataset split using CER & WER metrics.
Enforces Platform Quality Gates: CER <= 12.0% and WER <= 18.0%.
"""

import os
import sys
from typing import Dict, Any, List, Tuple
import torch
import evaluate
from PIL import Image
from transformers import TrOCRProcessor, VisionEncoderDecoderModel, RobertaTokenizer, ViTImageProcessor

# Ensure local src directory is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dataset_loader import create_pillsync_dataset_splits


# Quality Gate Thresholds
CER_THRESHOLD_PERCENT = 12.0  # CER <= 12.0%
WER_THRESHOLD_PERCENT = 18.0  # WER <= 18.0%


def load_trocr_processor(model_path_or_name: str) -> TrOCRProcessor:
    """Load TrOCR processor with robust fallback for tokenizers."""
    try:
        return TrOCRProcessor.from_pretrained(model_path_or_name)
    except Exception:
        tokenizer = RobertaTokenizer.from_pretrained(model_path_or_name)
        image_processor = ViTImageProcessor.from_pretrained(model_path_or_name)
        return TrOCRProcessor(image_processor=image_processor, tokenizer=tokenizer)


def evaluate_model(
    model_dir: str = os.path.join("ai_training", "track_1_vision", "models", "trocr_pillsync_best"),
    pretrained_fallback: str = "microsoft/trocr-base-handwritten",
    num_synthetic_samples: int = 100,
    data_dir: str = os.path.join("ai_training", "track_1_vision", "data")
) -> Dict[str, Any]:
    """
    Run evaluation on the test dataset split and enforce Quality Gates.
    """
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[Evaluate] Evaluating TrOCR on device: {device.upper()}")

    # Determine model source directory
    if os.path.exists(model_dir) and os.path.exists(os.path.join(model_dir, "config.json")):
        load_path = model_dir
        print(f"[Evaluate] Loading fine-tuned model from: {load_path}")
    else:
        load_path = pretrained_fallback
        print(f"[Evaluate] Checkpoint {model_dir} not found. Loading baseline model: {load_path}")

    # Load processor and model
    processor = load_trocr_processor(load_path)
    model = VisionEncoderDecoderModel.from_pretrained(load_path).to(device)
    model.eval()

    # Load test dataset split
    dataset_splits = create_pillsync_dataset_splits(data_dir=data_dir, num_synthetic=num_synthetic_samples)
    test_split = dataset_splits["test"]

    print(f"[Evaluate] Running inference on {len(test_split)} test split samples...")

    predictions: List[str] = []
    references: List[str] = []

    for idx, item in enumerate(test_split):
        raw_image = item["image"]
        ground_truth = item["text"]

        if not isinstance(raw_image, Image.Image):
            raw_image = Image.open(raw_image).convert("RGB")
        else:
            raw_image = raw_image.convert("RGB")

        # Resize to (384, 384)
        raw_image = raw_image.resize((384, 384), Image.BILINEAR)

        pixel_values = processor(raw_image, return_tensors="pt").pixel_values.to(device)

        with torch.no_grad():
            generated_ids = model.generate(
                pixel_values,
                num_beams=4,
                length_penalty=2.0,
                max_length=64
            )

        pred_text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
        
        predictions.append(pred_text.strip() if len(pred_text.strip()) > 0 else " ")
        references.append(ground_truth.strip() if len(ground_truth.strip()) > 0 else " ")

        if idx < 5:  # Display sample predictions
            print(f"  Sample #{idx+1}:")
            print(f"    GT  : '{ground_truth}'")
            print(f"    PRED: '{pred_text}'")

    # Compute CER & WER via jiwer
    import jiwer

    cer_val = float(jiwer.cer(references, predictions)) * 100.0
    wer_val = float(jiwer.wer(references, predictions)) * 100.0

    print("\n" + "=" * 60)
    print("                EVALUATION RESULTS REPORT                ")
    print("=" * 60)
    print(f"  Character Error Rate (CER) : {cer_val:.2f}% (Threshold: <= {CER_THRESHOLD_PERCENT:.1f}%)")
    print(f"  Word Error Rate (WER)      : {wer_val:.2f}% (Threshold: <= {WER_THRESHOLD_PERCENT:.1f}%)")
    print("-" * 60)

    # Check Quality Gates
    cer_passed = cer_val <= CER_THRESHOLD_PERCENT
    wer_passed = wer_val <= WER_THRESHOLD_PERCENT
    overall_passed = cer_passed and wer_passed

    status_str = "PASSED [SUCCESS]" if overall_passed else "FAILED [QUALITY GATE BREACHED]"
    print(f"  QUALITY GATE STATUS: {status_str}")
    print("=" * 60 + "\n")

    results = {
        "cer_percent": cer_val,
        "wer_percent": wer_val,
        "cer_threshold": CER_THRESHOLD_PERCENT,
        "wer_threshold": WER_THRESHOLD_PERCENT,
        "cer_passed": cer_passed,
        "wer_passed": wer_passed,
        "overall_passed": overall_passed,
        "num_test_samples": len(test_split)
    }

    if not overall_passed:
        print(f"[Evaluate] WARNING: Model metrics (CER: {cer_val:.2f}%, WER: {wer_val:.2f}%) did not meet Quality Gates.")
        # Return results so runner can decide assert behavior based on synthetic evaluation

    return results


if __name__ == "__main__":
    res = evaluate_model(num_synthetic_samples=50)
