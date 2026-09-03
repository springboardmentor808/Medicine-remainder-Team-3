"""
RxHandBD & Synthetic Prescription Dataset Loader for PillSync Track 1 Module 1B.

Handles:
1. Loading / downloading RxHandBD prescription dataset.
2. Integrating 5,000 synthetic Indian doctor prescription crops.
3. Forming 80/10/10 Train/Validation/Test splits.
4. Resizing images to (384, 384) and formatting into HuggingFace `DatasetDict`.
"""

import os
import sys
import json
from typing import Dict, Tuple, Optional
from PIL import Image
import torch
from datasets import Dataset, DatasetDict, Features, Image as HFImage, Value

# Ensure local src directory is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synthetic_generator import generate_synthetic_dataset, generate_synthetic_prescription_crop


def load_rxhandbd_dataset(data_dir: str) -> Optional[Dataset]:
    """
    Attempt to load RxHandBD prescription dataset from HuggingFace Hub or local cache.
    Falls back gracefully if not available.
    """
    print("[Dataset Loader] Attempting to load RxHandBD dataset...")
    try:
        from datasets import load_dataset
        # Try loading RxHandBD dataset from HF hub if present
        dataset = load_dataset("RxHandBD", split="train")
        print(f"[Dataset Loader] Loaded RxHandBD with {len(dataset)} samples from HF Hub.")
        return dataset
    except Exception as e:
        print(f"[Dataset Loader] RxHandBD dataset not found on HF Hub or offline ({e}). Utilizing fallback seed generator.")
        return None


def prepare_synthetic_data(
    data_dir: str,
    num_synthetic: int = 5000,
    target_size: Tuple[int, int] = (384, 384)
) -> Dataset:
    """
    Generate or load 5,000 synthetic Indian doctor prescription crops.
    """
    synth_dir = os.path.join(data_dir, "synthetic")
    metadata_path = os.path.join(synth_dir, "metadata.json")

    if not os.path.exists(metadata_path):
        records = generate_synthetic_dataset(synth_dir, num_samples=num_synthetic, target_size=target_size)
    else:
        print(f"[Dataset Loader] Loading existing synthetic dataset metadata from {metadata_path}...")
        with open(metadata_path, "r", encoding="utf-8") as f:
            records = json.load(f)

    # Convert records into Hugging Face Dataset format
    data_dict = {
        "image": [r["image_path"] for r in records],
        "text": [r["text"] for r in records]
    }
    
    ds = Dataset.from_dict(data_dict)
    ds = ds.cast_column("image", HFImage())
    return ds


def create_pillsync_dataset_splits(
    data_dir: str = os.path.join("ai_training", "track_1_vision", "data"),
    num_synthetic: int = 5000,
    target_size: Tuple[int, int] = (384, 384),
    seed: int = 42
) -> DatasetDict:
    """
    Combines RxHandBD dataset with 5,000 synthetic Indian doctor crops and creates 80/10/10 splits.
    
    Returns:
        DatasetDict containing 'train', 'validation', and 'test' splits.
    """
    os.makedirs(data_dir, exist_ok=True)

    # 1. Load RxHandBD dataset (if available)
    rx_dataset = load_rxhandbd_dataset(data_dir)

    # 2. Generate/load 5,000 synthetic samples
    synth_dataset = prepare_synthetic_data(data_dir, num_synthetic=num_synthetic, target_size=target_size)

    # 3. Combine datasets
    if rx_dataset is not None:
        # Standardize column names
        if "text" not in rx_dataset.column_names and "transcription" in rx_dataset.column_names:
            rx_dataset = rx_dataset.rename_column("transcription", "text")
        
        # Select common columns
        rx_dataset = rx_dataset.select_columns(["image", "text"])
        synth_dataset = synth_dataset.select_columns(["image", "text"])
        
        from datasets import concatenate_datasets
        full_dataset = concatenate_datasets([rx_dataset, synth_dataset])
        print(f"[Dataset Loader] Combined total samples: {len(full_dataset)} (RxHandBD: {len(rx_dataset)}, Synthetic: {len(synth_dataset)})")
    else:
        full_dataset = synth_dataset
        print(f"[Dataset Loader] Using synthetic prescription dataset: {len(full_dataset)} samples.")

    # 4. Form 80/10/10 Train / Validation / Test splits
    # First split: 80% train, 20% temp (validation + test)
    train_temp_split = full_dataset.train_test_split(test_size=0.20, seed=seed)
    train_dataset = train_temp_split["train"]
    temp_dataset = train_temp_split["test"]

    # Second split: Split temp 50/50 -> 10% validation, 10% test
    val_test_split = temp_dataset.train_test_split(test_size=0.50, seed=seed)
    val_dataset = val_test_split["train"]
    test_dataset = val_test_split["test"]

    dataset_splits = DatasetDict({
        "train": train_dataset,
        "validation": val_dataset,
        "test": test_dataset
    })

    print(f"[Dataset Loader] Splits created successfully:")
    print(f"  - Train: {len(train_dataset)} ({len(train_dataset)/len(full_dataset):.1%})")
    print(f"  - Validation: {len(val_dataset)} ({len(val_dataset)/len(full_dataset):.1%})")
    print(f"  - Test: {len(test_dataset)} ({len(test_dataset)/len(full_dataset):.1%})")

    return dataset_splits


def transform_example_for_trocr(example, processor, max_target_length: int = 64):
    """
    Transforms a single dataset example for TrOCR.
    Resizes image to (384, 384), extracts pixel_values, and tokenizes text into labels.
    """
    image = example["image"]
    if not isinstance(image, Image.Image):
        image = Image.open(image).convert("RGB")
    else:
        image = image.convert("RGB")

    # Resize image to (384, 384)
    image = image.resize((384, 384), Image.BILINEAR)

    # Process pixel values
    pixel_values = processor(image, return_tensors="pt").pixel_values.squeeze(0)

    # Tokenize target transcription text
    labels = processor.tokenizer(
        example["text"],
        padding="max_length",
        max_length=max_target_length,
        truncation=True
    ).input_ids

    # Replace padding token id's of the label by -100 so they are ignored by PyTorch loss function
    labels = [label if label != processor.tokenizer.pad_token_id else -100 for label in labels]

    return {
        "pixel_values": pixel_values,
        "labels": torch.tensor(labels, dtype=torch.long)
    }


if __name__ == "__main__":
    splits = create_pillsync_dataset_splits(num_synthetic=100)
    print("Dataset loading test completed successfully.")
