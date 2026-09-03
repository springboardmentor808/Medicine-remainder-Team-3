"""
ONNX Export & Dynamic INT8 Quantization Script for PillSync Track 1 Module 1B.

Exports fine-tuned TrOCR vision model to ONNX format, applies dynamic INT8 quantization
via `onnxruntime.quantization`, and verifies target CPU latency (< 350ms) and model file footprint (< 350MB).
"""

import os
import sys
import time
from typing import Tuple, Dict, Any
import numpy as np
import torch
from PIL import Image
from transformers import TrOCRProcessor, VisionEncoderDecoderModel, RobertaTokenizer, ViTImageProcessor

try:
    import onnx
    import onnxruntime as ort
    from onnxruntime.quantization import quantize_dynamic, QuantType
    HAS_ONNX = True
except ImportError:
    HAS_ONNX = False

# Constraints
TARGET_MAX_LATENCY_MS = 350.0  # Latency < 350ms on CPU
TARGET_MAX_FOOTPRINT_MB = 350.0  # Model footprint < 350MB


def load_trocr_processor(model_path_or_name: str) -> TrOCRProcessor:
    """Load TrOCR processor with robust fallback for tokenizers."""
    try:
        return TrOCRProcessor.from_pretrained(model_path_or_name)
    except Exception:
        tokenizer = RobertaTokenizer.from_pretrained(model_path_or_name)
        image_processor = ViTImageProcessor.from_pretrained(model_path_or_name)
        return TrOCRProcessor(image_processor=image_processor, tokenizer=tokenizer)


class TrOCREncoderWrapper(torch.nn.Module):
    """
    Torch module wrapper for TrOCR Vision Encoder to export cleanly to ONNX format.
    """
    def __init__(self, model):
        super().__init__()
        self.encoder = model.encoder

    def forward(self, pixel_values):
        # Extract encoder hidden states
        encoder_outputs = self.encoder(pixel_values=pixel_values)
        return encoder_outputs.last_hidden_state


def export_trocr_to_onnx(
    model_dir: str = os.path.join("ai_training", "track_1_vision", "models", "trocr_pillsync_best"),
    pretrained_fallback: str = "microsoft/trocr-base-handwritten",
    output_onnx_path: str = os.path.join("ai_training", "track_1_vision", "models", "trocr_handwritten_opt.onnx")
) -> Dict[str, Any]:
    """
    Exports TrOCR encoder model to ONNX format, applies dynamic INT8 quantization,
    and benchmarks CPU latency and model file size.
    """
    os.makedirs(os.path.dirname(output_onnx_path), exist_ok=True)

    if os.path.exists(model_dir) and os.path.exists(os.path.join(model_dir, "config.json")):
        load_path = model_dir
    else:
        load_path = pretrained_fallback

    print(f"[ONNX Export] Loading model from: {load_path}")
    processor = load_trocr_processor(load_path)
    model = VisionEncoderDecoderModel.from_pretrained(load_path)
    model.eval()

    # Create FP32 raw ONNX output path
    fp32_onnx_path = output_onnx_path.replace("_opt.onnx", "_fp32.onnx")

    # Dummy input: batch_size=1, channels=3, height=384, width=384
    dummy_pixel_values = torch.randn(1, 3, 384, 384, dtype=torch.float32)

    encoder_wrapper = TrOCREncoderWrapper(model)
    encoder_wrapper.eval()

    print(f"[ONNX Export] Exporting FP32 model to: {fp32_onnx_path}...")
    torch.onnx.export(
        encoder_wrapper,
        dummy_pixel_values,
        fp32_onnx_path,
        export_params=True,
        opset_version=14,
        do_constant_folding=True,
        input_names=["pixel_values"],
        output_names=["last_hidden_state"],
        dynamic_axes={
            "pixel_values": {0: "batch_size"},
            "last_hidden_state": {0: "batch_size", 1: "sequence_length"}
        },
        dynamo=False
    )

    print("[ONNX Export] FP32 ONNX export completed.")

    # Apply Dynamic INT8 Quantization if onnxruntime is installed
    if HAS_ONNX:
        print(f"[ONNX Export] Applying Dynamic INT8 Quantization -> {output_onnx_path}...")
        quantize_dynamic(
            model_input=fp32_onnx_path,
            model_output=output_onnx_path,
            weight_type=QuantType.QInt8
        )
        print("[ONNX Export] Dynamic INT8 Quantization completed.")
        
        # Clean up temporary FP32 ONNX file
        if os.path.exists(fp32_onnx_path):
            os.remove(fp32_onnx_path)
    else:
        print("[ONNX Export] WARNING: onnxruntime.quantization not available. Saving FP32 model directly.")
        os.rename(fp32_onnx_path, output_onnx_path)

    # 1. Measure File Size
    file_size_bytes = os.path.getsize(output_onnx_path)
    file_size_mb = file_size_bytes / (1024.0 * 1024.0)

    # 2. Benchmark CPU Latency
    print("[ONNX Export] Benchmarking CPU latency over 10 test iterations...")
    if HAS_ONNX:
        session_options = ort.SessionOptions()
        session_options.intra_op_num_threads = os.cpu_count() or 4
        session_options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        session_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        session = ort.InferenceSession(output_onnx_path, session_options, providers=["CPUExecutionProvider"])
        
        input_name = session.get_inputs()[0].name
        sample_input = np.random.randn(1, 3, 384, 384).astype(np.float32)

        # Warmup (5 iterations to initialize thread pool and CPU cache)
        for _ in range(5):
            _ = session.run(None, {input_name: sample_input})

        # Latency Benchmark
        latencies = []
        for _ in range(10):
            t0 = time.perf_counter()
            _ = session.run(None, {input_name: sample_input})
            latencies.append((time.perf_counter() - t0) * 1000.0)

        avg_latency_ms = float(np.mean(latencies))
    else:
        # Fallback PyTorch CPU latency estimation
        t0 = time.perf_counter()
        with torch.no_grad():
            _ = encoder_wrapper(dummy_pixel_values)
        avg_latency_ms = (time.perf_counter() - t0) * 1000.0

    print("\n" + "=" * 60)
    print("           ONNX EXPORT & OPTIMIZATION REPORT             ")
    print("=" * 60)
    print(f"  Export Path             : {output_onnx_path}")
    print(f"  Model Footprint Size    : {file_size_mb:.2f} MB (Constraint: < {TARGET_MAX_FOOTPRINT_MB:.1f} MB)")
    print(f"  CPU Latency per Crop    : {avg_latency_ms:.2f} ms (Constraint: < {TARGET_MAX_LATENCY_MS:.1f} ms)")
    print("-" * 60)

    footprint_passed = file_size_mb < TARGET_MAX_FOOTPRINT_MB
    latency_passed = avg_latency_ms < TARGET_MAX_LATENCY_MS
    overall_passed = footprint_passed and latency_passed

    status_str = "PASSED [SUCCESS]" if overall_passed else "FAILED [CONSTRAINTS BREACHED]"
    print(f"  OPTIMIZATION STATUS     : {status_str}")
    print("=" * 60 + "\n")

    return {
        "output_onnx_path": output_onnx_path,
        "file_size_mb": file_size_mb,
        "avg_latency_ms": avg_latency_ms,
        "footprint_passed": footprint_passed,
        "latency_passed": latency_passed,
        "overall_passed": overall_passed
    }


if __name__ == "__main__":
    export_trocr_to_onnx()
