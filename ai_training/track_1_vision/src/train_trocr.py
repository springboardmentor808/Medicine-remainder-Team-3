"""
TrOCR Fine-Tuning Script for PillSync Track 1 Module 1B.

Fine-tunes microsoft/trocr-base-handwritten on Indian doctor prescription dataset.
Optimized for 6GB VRAM (NVIDIA RTX 4050) with PyTorch FP16, Gradient Accumulation, and Beam Search.
"""

import os
import sys
import torch
import evaluate
from transformers import (
    TrOCRProcessor,
    VisionEncoderDecoderModel,
    Seq2SeqTrainer,
    Seq2SeqTrainingArguments,
    default_data_collator,
    RobertaTokenizer,
    ViTImageProcessor
)

# Ensure local src directory is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dataset_loader import create_pillsync_dataset_splits, transform_example_for_trocr


def load_trocr_processor(model_path_or_name: str) -> TrOCRProcessor:
    """Load TrOCR processor with robust fallback for tokenizers."""
    try:
        return TrOCRProcessor.from_pretrained(model_path_or_name)
    except Exception:
        tokenizer = RobertaTokenizer.from_pretrained(model_path_or_name)
        image_processor = ViTImageProcessor.from_pretrained(model_path_or_name)
        return TrOCRProcessor(image_processor=image_processor, tokenizer=tokenizer)


def compute_metrics_builder(processor):
    """
    Build compute_metrics function for Seq2SeqTrainer using jiwer (CER & WER).
    """
    import jiwer

    def compute_metrics(pred):
        labels_ids = pred.label_ids
        pred_ids = pred.predictions

        # Replace -100 in labels with pad_token_id
        labels_ids[labels_ids == -100] = processor.tokenizer.pad_token_id

        # Decode predictions and labels
        pred_str = processor.batch_decode(pred_ids, skip_special_tokens=True)
        label_str = processor.batch_decode(labels_ids, skip_special_tokens=True)

        # Sanitize empty strings to prevent metric error
        pred_str = [s if len(s.strip()) > 0 else " " for s in pred_str]
        label_str = [s if len(s.strip()) > 0 else " " for s in label_str]

        cer = float(jiwer.cer(label_str, pred_str))
        wer = float(jiwer.wer(label_str, pred_str))

        return {
            "cer": cer,
            "wer": wer
        }

    return compute_metrics


def train_trocr(
    model_name: str = "microsoft/trocr-base-handwritten",
    output_dir: str = os.path.join("ai_training", "track_1_vision", "models", "trocr_pillsync_best"),
    num_train_epochs: int = 3,
    num_synthetic_samples: int = 5000,
    data_dir: str = os.path.join("ai_training", "track_1_vision", "data")
):
    """
    Main training routine for TrOCR model fine-tuning.
    """
    device = "cuda" if torch.cuda.is_available() else "cpu"
    use_fp16 = torch.cuda.is_available()  # Enable fp16 if CUDA GPU is present

    print(f"[Train TrOCR] Device: {device.upper()} | PyTorch FP16: {use_fp16}")
    print(f"[Train TrOCR] Loading processor & model: {model_name}...")

    # 1. Load Processor and Model
    processor = load_trocr_processor(model_name)
    model = VisionEncoderDecoderModel.from_pretrained(model_name)

    # Configure model parameters & special tokens for generation
    model.config.decoder_start_token_id = processor.tokenizer.cls_token_id
    model.config.pad_token_id = processor.tokenizer.pad_token_id
    model.config.vocab_size = model.config.decoder.vocab_size

    # Configure Beam Search parameters
    model.config.eos_token_id = processor.tokenizer.sep_token_id
    model.config.max_length = 64
    model.config.early_stopping = True
    model.config.no_repeat_ngram_size = 3
    model.config.length_penalty = 2.0
    model.config.num_beams = 4

    # 2. Load & Prepare Dataset Splits
    dataset_splits = create_pillsync_dataset_splits(data_dir=data_dir, num_synthetic=num_synthetic_samples)

    print("[Train TrOCR] Preprocessing dataset splits for TrOCR...")
    train_dataset = dataset_splits["train"].map(
        lambda ex: transform_example_for_trocr(ex, processor),
        remove_columns=dataset_splits["train"].column_names
    )
    val_dataset = dataset_splits["validation"].map(
        lambda ex: transform_example_for_trocr(ex, processor),
        remove_columns=dataset_splits["validation"].column_names
    )

    # Format datasets to PyTorch Tensors
    train_dataset.set_format(type="torch", columns=["pixel_values", "labels"])
    val_dataset.set_format(type="torch", columns=["pixel_values", "labels"])

    # 3. Setup Seq2SeqTrainingArguments optimized for 6GB VRAM
    training_args = Seq2SeqTrainingArguments(
        output_dir=output_dir,
        per_device_train_batch_size=4,          # VRAM limit optimization for RTX 4050 (6GB)
        per_device_eval_batch_size=4,
        gradient_accumulation_steps=2,          # Effective batch size = 4 * 2 = 8
        fp16=use_fp16,                           # Mixed precision FP16 to prevent CUDA OOM
        learning_rate=4e-5,                      # AdamW learning rate
        warmup_steps=100,                        # Warmup steps
        weight_decay=0.01,                       # Weight decay regularization
        optimizer="adamw_torch",
        predict_with_generate=True,              # Required for beam search metrics in Seq2Seq
        generation_num_beams=4,                  # Beam search width
        generation_max_length=64,
        evaluation_strategy="steps",
        eval_steps=200,
        save_strategy="steps",
        save_steps=200,
        logging_steps=50,
        num_train_epochs=num_train_epochs,
        save_total_limit=2,
        load_best_model_at_end=True,
        metric_for_best_model="cer",
        greater_is_better=False,
        report_to="none",
        dataloader_num_workers=0
    )

    # 4. Instantiate Seq2SeqTrainer
    trainer = Seq2SeqTrainer(
        model=model,
        tokenizer=processor.image_processor,
        args=training_args,
        compute_metrics=compute_metrics_builder(processor),
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        data_collator=default_data_collator
    )

    # 5. Start Training
    print("[Train TrOCR] Starting training run...")
    trainer.train()

    # 6. Save Best Checkpoint & Processor
    print(f"[Train TrOCR] Saving best fine-tuned model checkpoint to {output_dir}...")
    trainer.save_model(output_dir)
    processor.save_pretrained(output_dir)
    print("[Train TrOCR] Model & Processor saved successfully.")


if __name__ == "__main__":
    train_trocr(num_train_epochs=1, num_synthetic_samples=100)
