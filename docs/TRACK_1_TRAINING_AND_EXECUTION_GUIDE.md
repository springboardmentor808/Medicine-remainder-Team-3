# 👁️ PillSync Track 1: Vision AI, Doctor Handwriting Recognition & OCR Pipeline
## 🚀 Complete Training Blueprint, Team Division & Master Prompt

**Document:** Track 1 Technical Execution, Dataset Ingestion, Model Fine-Tuning & Production Merge Guide  
**Project:** AI Intelligent Medicine Reminder & Medication Tracking Platform (PillSync)  
**Target Roles:** **Chanchal** (Computer Vision & Pipeline Integration) & **Rohan** (Deep Learning & Vision Transformers)  
**Version:** 2.0.0 (Production Master)

---

## 1. 📌 Track 1 Context & Problem Statement

### 🚨 The Critical Real-World Challenge:
In clinical healthcare, standard OCR tools (such as plain Tesseract OCR) rely on high-contrast printed typography. When exposed to **real Indian doctor prescriptions**:
1. **Cursive Handwriting**: Doctor handwriting exhibits extreme ligatures, non-standard cursive abbreviations, and varied stroke widths, causing Tesseract accuracy to plummet below **$20\%$**.
2. **Mobile Camera Noise**: Prescriptions are captured in low-light environments, with page folds, shadows, skew, and perspective tilt.
3. **Drug Misspelling Liability**: A 1-character OCR hallucination (e.g., *Cetirizine* misread as *Cefixime*) is a severe medical safety risk.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        TRACK 1 HYBRID VISION AI PIPELINE                               │
│                                                                                        │
│   [Prescription Photo] ──► [OpenCV CLAHE & De-skew] ──► [Document Segmenter]           │
│                                                               │                        │
│            ┌──────────────────────────────────────────────────┴───────────────┐        │
│            ▼ (Printed Headers/Clinic Name)         ▼ (Handwritten Rx Body)    │        │
│     [Tesseract Engine]                   [Fine-Tuned TrOCR / Donut]           │        │
│            │                                       │                          │        │
│            └───────────────────┬───────────────────┘                          │
│                                ▼                                              │
│               [253k Indian Catalog Fuzzy Matcher]                             │
│                                │                                              │
│                                ▼                                              │
│       [Structured JSON: Medicine, Dosage, Frequency, Confidence]              │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 👥 Team Work Breakdown: Chanchal vs Rohan

To ensure parallel development without code collisions, Track 1 is divided into two distinct, high-impact modules:

```
┌─────────────────────────────────────────────────┬─────────────────────────────────────────────────┐
│        👩‍💻 CHANCHAL (Engineer 1A)                 │         👨‍💻 ROHAN (Engineer 1B)                  │
│   CV Preprocessing, Segmentation & API          │   Deep Learning, Vision Transformers & MLOps    │
├─────────────────────────────────────────────────┼─────────────────────────────────────────────────┤
│ 1. OpenCV Preprocessing Engine (CLAHE, Otsu)   │ 1. RxHandBD & IAM Dataset Ingestion & Formatting│
│ 2. Shadow Removal & Auto-Deskewing (Hough/Cont) │ 2. Synthetic Handwritten Prescription Generator │
│ 3. Line & Word Bounding Box Segmenter           │ 3. TrOCR / Donut Fine-Tuning Pipeline (PyTorch) │
│ 4. Hybrid Dispatcher (Tesseract + TrOCR Model)  │ 4. Evaluation Loop (CER ≤ 12%, WER ≤ 18%)       │
│ 5. 253k Catalog Fuzzy Matcher (RapidFuzz)       │ 5. Model Quantization (INT8 ONNX / TorchScript) │
│ 6. FastAPI Backend Integration (`/ocr/scan`)    │ 6. Latency Benchmarking (< 350ms CPU Target)    │
└─────────────────────────────────────────────────┴─────────────────────────────────────────────────┘
```

---

### 👩‍💻 Chanchal's Deliverables (Module 1A: Vision Preprocessing & API Pipeline)

1. **`cv2_preprocessor.py`**:
   - **Contrast Optimization**: CLAHE (`clipLimit=2.0`, `tileGridSize=(8,8)`).
   - **Adaptive Thresholding**: Shadow suppression via morphological background division followed by Gaussian Otsu binarization.
   - **Auto De-skewing**: Minimum Area Bounding Rectangle contour detection to rotate tilted documents back to $0^\circ$.
2. **`document_segmenter.py`**:
   - Detects horizontal text baselines and extracts individual prescription lines/word crops for handwriting inference.
3. **`fuzzy_catalog_matcher.py`**:
   - Takes raw model output strings and matches them against PillSync's **253,973 Indian Medicine Catalog** using token sort ratio and Levenshtein distance ($>85\%$ confidence).
4. **`ocr_service.py` (FastAPI Service Layer)**:
   - Orchestrates the full pipeline and exposes the clean JSON contract to the frontend.

---

### 👨‍💻 Rohan's Deliverables (Module 1B: Deep Learning & Vision Transformers)

1. **`dataset_loader.py`**:
   - Ingests the **RxHandBD Dataset** (5,500+ doctor handwriting words/prescriptions) + **IAM Handwriting Database**.
   - Generates 10,000 synthetic Indian doctor handwriting crops with variations in ink color, slant, and cursive fonts.
2. **`train_trocr.py` / `train_donut.py`**:
   - Fine-tunes **`microsoft/trocr-base-handwritten`** or **`naver-clova-ix/donut-base`** using PyTorch + Hugging Face `Seq2SeqTrainer`.
   - Loss Function: Cross-Entropy with label smoothing.
   - Mixed precision `fp16` training on GPU (or Google Colab / Kaggle T4).
3. **`evaluate_vision_model.py`**:
   - Measures **CER** (Character Error Rate) and **WER** (Word Error Rate) on a 20% held-out test split.
4. **`export_quantized_model.py`**:
   - Converts the PyTorch model to **INT8 Dynamic ONNX / TorchScript** for blazing fast $<350\text{ms}$ CPU inference on standard laptops.

---

## 3. 📂 Track 1 Folder Structure

Create this isolated workspace structure inside the repository:

```text
Ai_intelligent-medicine-remainder-and-medication-tracking-/
└── ai_training/
    └── track_1_vision/
        ├── datasets/
        │   ├── raw_rxhandbd/               # Downloaded RxHandBD images & labels
        │   ├── synthetic_data/             # Generated cursive Indian Rx crops
        │   └── manifest.json               # Processed train/val/test metadata
        ├── src/
        │   ├── __init__.py
        │   ├── cv2_preprocessor.py         # [Chanchal] Image enhancement & de-skew
        │   ├── document_segmenter.py       # [Chanchal] Line/word bounding box extractor
        │   ├── fuzzy_catalog_matcher.py    # [Chanchal] 253k Catalog Levenshtein resolver
        │   ├── dataset_loader.py           # [Rohan] HuggingFace Dataset formatter
        │   ├── synthetic_generator.py      # [Rohan] Cursive handwriting augmentor
        │   ├── train_trocr.py              # [Rohan] PyTorch Seq2Seq fine-tuning script
        │   ├── evaluate.py                 # [Rohan] CER & WER metrics computation
        │   └── export_onnx.py              # [Rohan] INT8 ONNX optimizer
        ├── models/
        │   ├── trocr_pillsync_best/        # PyTorch model weights & tokenizer
        │   └── trocr_handwritten_opt.onnx  # Exported lightweight production binary
        ├── tests/
        │   ├── test_preprocessing.py       # Unit tests for image filtering
        │   ├── test_inference.py           # E2E test on sample prescription images
        │   └── sample_prescriptions/       # 5 real prescription test images
        ├── requirements.txt                # Track 1 pinned dependencies
        └── README.md
```

---

## 4. 📦 Dependencies & Environment Setup

Create `ai_training/track_1_vision/requirements.txt`:

```ini
# --- Deep Learning & Vision Transformers ---
torch>=2.2.0
torchvision>=0.17.0
transformers>=4.38.0
datasets>=2.18.0
accelerate>=0.28.0
evaluate>=0.4.1
jiwer>=3.0.3

# --- Computer Vision & Preprocessing ---
opencv-python-headless>=4.9.0
Pillow>=10.2.0
numpy>=1.26.0

# --- OCR & Fuzzy Matching ---
pytesseract>=0.3.10
rapidfuzz>=3.6.0
onnxruntime>=1.17.0

# --- Testing & Utilities ---
pytest>=8.0.0
tqdm>=4.66.0
python-dotenv>=1.0.0
```

### Installation Command:
```bash
cd ai_training/track_1_vision
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/Mac:
# source venv/bin/activate

pip install -r requirements.txt
```

---

## 5. 💻 Core Implementation Code Templates

### 👩‍💻 Component A: Chanchal's OpenCV Preprocessing Engine (`src/cv2_preprocessor.py`)

```python
"""
PillSync Vision AI — Image Preprocessing Engine
Author: Chanchal (Engineer 1A)
Enhances low-quality, skewed, and shadowed prescription photos.
"""

import cv2
import numpy as np
from PIL import Image

class PrescriptionPreprocessor:
    @staticmethod
    def remove_shadows_and_binarize(image_np: np.ndarray) -> np.ndarray:
        """Removes uneven shadows and performs adaptive binarization."""
        if len(image_np.shape) == 3:
            gray = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY)
        else:
            gray = image_np

        # 1. Dilate background to estimate shadow field
        dilated = cv2.dilate(gray, np.ones((7, 7), np.uint8))
        bg_blur = cv2.medianBlur(dilated, 21)

        # 2. Difference image to cancel background gradient
        diff = 255 - cv2.absdiff(gray, bg_blur)

        # 3. Normalize image contrast
        norm = cv2.normalize(diff, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX, dtype=cv2.CV_8UC1)

        # 4. CLAHE Contrast enhancement
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(norm)

        # 5. Otsu thresholding
        _, binary = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        return binary

    @staticmethod
    def deskew_image(image_np: np.ndarray) -> np.ndarray:
        """Detects angle and corrects document skew."""
        gray = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY) if len(image_np.shape) == 3 else image_np
        inv_binary = cv2.bitwise_not(gray)
        coords = np.column_stack(np.where(inv_binary > 0))
        
        if len(coords) == 0:
            return image_np

        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        elif angle > 45:
            angle = 90 - angle
        else:
            angle = -angle

        # If angle is negligible, skip rotation
        if abs(angle) < 0.5:
            return image_np

        (h, w) = image_np.shape[:2]
        center = (w // 2, h // 2)
        rot_matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(image_np, rot_matrix, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        return rotated

    @classmethod
    def preprocess_pipeline(cls, pil_image: Image.Image) -> Image.Image:
        """Full end-to-end preprocessing pipeline."""
        img_np = np.array(pil_image)
        deskewed = cls.deskew_image(img_np)
        cleaned = cls.remove_shadows_and_binarize(deskewed)
        return Image.fromarray(cleaned)
```

---

### 👨‍💻 Component B: Rohan's TrOCR Fine-Tuning Script (`src/train_trocr.py`)

```python
"""
PillSync Vision AI — TrOCR Fine-Tuning Pipeline
Author: Rohan (Engineer 1B)
Fine-tunes microsoft/trocr-base-handwritten on prescription text.
"""

import os
import torch
from transformers import (
    TrOCRProcessor,
    VisionEncoderDecoderModel,
    Seq2SeqTrainer,
    Seq2SeqTrainingArguments,
    default_data_collator
)
from datasets import load_dataset
import evaluate

# 1. Device Setup
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"🚀 Training TrOCR on Device: {device}")

# 2. Model & Processor Init
MODEL_NAME = "microsoft/trocr-base-handwritten"
processor = TrOCRProcessor.from_pretrained(MODEL_NAME)
model = VisionEncoderDecoderModel.from_pretrained(MODEL_NAME).to(device)

# Configure vocabulary and tokens
model.config.decoder_start_token_id = processor.tokenizer.cls_token_id
model.config.pad_token_id = processor.tokenizer.pad_token_id
model.config.vocab_size = model.config.decoder.vocab_size
model.config.max_length = 64
model.config.early_stopping = True
model.config.no_repeat_ngram_size = 3
model.config.length_penalty = 2.0
model.config.num_beams = 4

# 3. Metric Setup (Character Error Rate)
cer_metric = evaluate.load("cer")

def compute_metrics(pred):
    labels_ids = pred.label_ids
    pred_ids = pred.predictions

    pred_str = processor.batch_decode(pred_ids, skip_special_tokens=True)
    labels_ids[labels_ids == -100] = processor.tokenizer.pad_token_id
    label_str = processor.batch_decode(labels_ids, skip_special_tokens=True)

    cer = cer_metric.compute(predictions=pred_str, references=label_str)
    return {"cer": cer}

# 4. Training Arguments
training_args = Seq2SeqTrainingArguments(
    predict_with_generate=True,
    evaluation_strategy="steps",
    per_device_train_batch_size=8,
    per_device_eval_batch_size=8,
    fp16=torch.cuda.is_available(),
    output_dir="./models/trocr_checkpoints",
    logging_steps=50,
    save_steps=200,
    eval_steps=200,
    save_total_limit=2,
    num_train_epochs=5,
    learning_rate=4e-5,
    warmup_steps=100,
    weight_decay=0.01,
    report_to="none",
)

def run_training(train_dataset, eval_dataset):
    trainer = Seq2SeqTrainer(
        model=model,
        tokenizer=processor.feature_extractor,
        args=training_args,
        compute_metrics=compute_metrics,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        data_collator=default_data_collator,
    )
    trainer.train()
    model.save_pretrained("./models/trocr_pillsync_best")
    processor.save_pretrained("./models/trocr_pillsync_best")
    print("✅ Model successfully trained and saved!")

if __name__ == "__main__":
    print("TrOCR Training Module initialized.")
```

---

## 6. 🏆 Master Prompt for Autonomous Track 1 Execution

When Chanchal, Rohan, or any AI Agent is ready to execute Track 1, copy and paste this **Master Prompt**:

````markdown
### 🎯 Master Prompt: Track 1 (Vision AI & Doctor Handwriting OCR) Execution

**System Context:**
You are the Lead Vision AI Engineer on the **PillSync Healthcare Platform**. 
You have been assigned **Track 1: Vision AI, Doctor Handwriting Recognition & Prescription Extraction Pipeline**.

**Primary Goal:**
Build, fine-tune, evaluate, and export a high-accuracy, production-ready Vision AI engine that can take doctor prescription photos, enhance them via OpenCV, extract handwritten medicines via Microsoft TrOCR/Donut, resolve misspellings against PillSync's 253,973 Indian Medicine Catalog, and return structured JSON.

**Roles & Tasks:**
1. **Chanchal's Domain (Module 1A)**:
   - Implement `cv2_preprocessor.py` with shadow removal, CLAHE contrast enhancement, and minAreaRect de-skewing.
   - Implement `document_segmenter.py` for bounding box line/word extraction.
   - Implement `fuzzy_catalog_matcher.py` using RapidFuzz against `d:\Ai_intelligent-medicine-remainder-and-medication-tracking-\backend\app\catalogs\indian_medicines_catalog.json`.
   - Update `backend/app/services/ocr_service.py` to route images through the new hybrid engine.

2. **Rohan's Domain (Module 1B)**:
   - Implement `dataset_loader.py` to prepare RxHandBD and synthetic Indian cursive samples into HuggingFace format.
   - Implement `train_trocr.py` to fine-tune `microsoft/trocr-base-handwritten` with mixed precision.
   - Implement `evaluate.py` to compute CER and WER.
   - Implement `export_onnx.py` to quantize the model to dynamic INT8 ONNX for sub-350ms CPU execution.

**Quality Gates:**
- Character Error Rate (CER) ≤ 12%
- Word Error Rate (WER) ≤ 18%
- 253k Catalog Matching Top-1 Accuracy ≥ 95%
- Pure CPU Inference Latency ≤ 350ms per prescription

**Execution Steps:**
1. Setup virtual environment in `ai_training/track_1_vision/`.
2. Generate synthetic data and download RxHandBD samples.
3. Run training loop for 5 epochs.
4. Export quantized ONNX model to `ai_training/track_1_vision/models/`.
5. Run unit and integration tests with `pytest tests/`.
6. Merge clean inference service into `backend/app/services/ocr_service.py`.

Proceed autonomously and generate production-grade code.
````

---

## 7. 🎯 Quality Evaluation Gates & Criteria

Before merging into production backend, the model must pass these strict tests:

| Metric | Target Threshold | Method of Verification |
| :--- | :---: | :--- |
| **Character Error Rate (CER)** | $\le 12.0\%$ | Evaluated on 500 doctor handwriting test words (`evaluate.py`) |
| **Word Error Rate (WER)** | $\le 18.0\%$ | Evaluated on full prescription line crops |
| **Catalog Match Precision** | $\ge 95.0\%$ | RapidFuzz match against 253k Indian Catalog |
| **Inference Latency** | $< 350\text{ ms}$ | Average of 50 runs on single CPU core (INT8 ONNX) |
| **Memory Footprint** | $< 400\text{ MB}$ | RAM usage during active model inference |

---

*Certified & Signed by Senior AI/ML & System Architect.*
