"""
Synthetic Indian Doctor Prescription Crop Generator for PillSync Track 1 Module 1B.

Generates synthetic handwritten prescription crops with realistic Indian medical terminology,
varying pen ink colors, line thicknesses, text slants, and paper backgrounds.
"""

import os
import random
import json
import math
from typing import List, Tuple, Dict, Any
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import numpy as np

try:
    import cv2
    HAS_OPENCV = True
except ImportError:
    HAS_OPENCV = False

# Realistic Indian Doctor Prescription Vocabulary & Patterns
DRUG_NAMES = [
    "Paracetamol 500mg", "Dolo 650mg", "Amoxicillin 500mg", "Augmentin 625mg",
    "Azithromycin 500mg", "Pantoprazole 40mg", "Pan-D", "Omeprazole 20mg",
    "Metformin 500mg", "Metformin SR 1000mg", "Glimepiride 2mg", "Telmisartan 40mg",
    "Amlodipine 5mg", "Atorvastatin 10mg", "Montelukast 10mg", "Levocetirizine 5mg",
    "Ibuprofen 400mg", "Aceclofenac 100mg", "Zero-P", "Ciprofloxacin 500mg",
    "Levofloxacin 500mg", "Cefixime 200mg", "Ranitidine 150mg", "Oflomac-OZ",
    "Cetirizine 10mg", "Deflazacort 6mg", "Combiflam", "Chymoral Forte",
    "Calpol 650mg", "Becosules Cap", "Limcee 500mg", "Shelcal 500mg"
]

DOSAGE_FORMS = ["Tab", "Cap", "Syr", "Inj", "Oint", "Susp", "Drops", "T."]

DOSAGE_FREQUENCIES = [
    "1-0-1", "1-0-0", "0-0-1", "1-1-1", "1-0-1/2",
    "TDS", "BD", "OD", "QID", "HS", "SOS", "STAT",
    "b.d.", "o.d.", "t.d.s.", "q.d.s."
]

TIMINGS = ["ac", "pc", "bf", "af", "at bedtime", "before food", "after food"]

DURATIONS = ["x 3 days", "x 5 days", "x 7 days", "x 10 days", "x 14 days", "x 1 month", "x 5d", "x 7d"]

PEN_COLORS = [
    (15, 35, 150),    # Royal Blue Gel/Ink
    (5, 20, 90),      # Dark Blue Ballpoint
    (20, 20, 25),     # Black Ballpoint
    (10, 10, 10),     # Deep Black Ink
    (20, 110, 40),    # Doctor Green Ink
    (170, 25, 25),    # Doctor Red Ink
    (35, 75, 140),    # Faded Blue
    (40, 50, 80),     # Blue-Gray Ballpoint
]


def generate_random_prescription_text() -> str:
    """Generate a realistic Indian prescription line string."""
    pattern_type = random.choice([1, 2, 3, 4, 5])
    form = random.choice(DOSAGE_FORMS)
    drug = random.choice(DRUG_NAMES)
    freq = random.choice(DOSAGE_FREQUENCIES)
    duration = random.choice(DURATIONS)
    timing = random.choice(TIMINGS)

    if pattern_type == 1:
        return f"{form} {drug} {freq} {duration}"
    elif pattern_type == 2:
        return f"{form}. {drug} - {freq} ({timing}) {duration}"
    elif pattern_type == 3:
        return f"{drug} {freq} x {random.randint(3, 10)} days"
    elif pattern_type == 4:
        return f"Rx: {form} {drug} {freq} {timing}"
    else:
        return f"{form} {drug} {freq}"


def create_paper_background(width: int, height: int) -> Image.Image:
    """Create a realistic prescription paper background with texture & subtle tint."""
    base_color = (
        random.randint(240, 255),
        random.randint(238, 252),
        random.randint(230, 248)
    )
    img = Image.new("RGB", (width, height), base_color)
    draw = ImageDraw.Draw(img)

    if random.random() < 0.4:
        line_color = (210, 220, 235) if random.random() < 0.7 else (225, 225, 225)
        step = random.randint(24, 40)
        for y in range(0, height, step):
            draw.line([(0, y), (width, y)], fill=line_color, width=1)

    img_np = np.array(img).astype(np.float32)
    noise = np.random.normal(0, random.uniform(2.0, 5.0), img_np.shape)
    img_np = np.clip(img_np + noise, 0, 255).astype(np.uint8)
    img = Image.fromarray(img_np)

    return img


def draw_handwritten_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    pos: Tuple[int, int],
    pen_color: Tuple[int, int, int],
    stroke_width: int
):
    """Draw text simulating handwritten stroke variations using default font."""
    font = ImageFont.load_default()
    x, y = pos
    draw.text((x, y), text, fill=pen_color, font=font, stroke_width=stroke_width)


def apply_handwriting_augmentations(img: Image.Image, slant_deg: float) -> Image.Image:
    """Apply slant (affine transform), ink bleeding blur, and perspective noise."""
    w, h = img.size
    
    if abs(slant_deg) > 0.1:
        img = img.rotate(slant_deg, resample=Image.BICUBIC, expand=False, fillcolor=(245, 243, 238))

    if HAS_OPENCV:
        img_np = np.array(img)
        
        if random.random() < 0.5:
            ksize = random.choice([3, 5])
            img_np = cv2.GaussianBlur(img_np, (ksize, ksize), random.uniform(0.3, 0.8))
        
        if random.random() < 0.4:
            pts1 = np.float32([[0, 0], [w, 0], [0, h], [w, h]])
            dx = random.uniform(-0.03, 0.03) * w
            dy = random.uniform(-0.03, 0.03) * h
            pts2 = np.float32([[dx, dy], [w - dx, dy], [dx, h - dy], [w - dx, h - dy]])
            M = cv2.getPerspectiveTransform(pts1, pts2)
            img_np = cv2.warpPerspective(img_np, M, (w, h), borderValue=(245, 243, 238))

        img = Image.fromarray(img_np)
    else:
        if random.random() < 0.5:
            img = img.filter(ImageFilter.GaussianBlur(radius=0.4))

    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(random.uniform(0.85, 1.15))
    
    return img


def generate_synthetic_prescription_crop(
    target_size: Tuple[int, int] = (384, 384)
) -> Tuple[Image.Image, str]:
    """
    Generate a single synthetic Indian doctor prescription image crop and ground truth transcription.
    
    Returns:
        (PIL.Image, ground_truth_text)
    """
    text = generate_random_prescription_text()
    
    canvas_w, canvas_h = target_size
    img = create_paper_background(canvas_w, canvas_h)
    draw = ImageDraw.Draw(img)

    pen_color = random.choice(PEN_COLORS)
    slant = random.uniform(-10.0, 10.0)
    stroke_width = random.choice([1, 2, 3])

    font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), text, font=font, stroke_width=stroke_width)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    margin_x = max(10, (canvas_w - text_w) // 2 + random.randint(-20, 20))
    margin_y = max(10, (canvas_h - text_h) // 2 + random.randint(-30, 30))

    draw_handwritten_text(draw, text, (margin_x, margin_y), pen_color, stroke_width)
    img = apply_handwriting_augmentations(img, slant)

    if img.size != target_size:
        img = img.resize(target_size, Image.BILINEAR)

    return img, text


def generate_synthetic_dataset(
    output_dir: str,
    num_samples: int = 5000,
    target_size: Tuple[int, int] = (384, 384)
) -> List[Dict[str, Any]]:
    """
    Generate num_samples synthetic prescription crops and save them to output_dir.
    
    Returns list of records: [{'id': ..., 'image_path': ..., 'text': ...}]
    """
    images_dir = os.path.join(output_dir, "images")
    os.makedirs(images_dir, exist_ok=True)

    records = []
    print(f"[Synthetic Generator] Generating {num_samples} synthetic Indian doctor prescription crops...")

    for idx in range(num_samples):
        img, text = generate_synthetic_prescription_crop(target_size=target_size)
        filename = f"synth_rx_{idx:05d}.jpg"
        filepath = os.path.join(images_dir, filename)
        img.save(filepath, quality=95)

        records.append({
            "id": f"synth_{idx:05d}",
            "image_path": filepath,
            "text": text
        })

        if (idx + 1) % 1000 == 0 or idx == num_samples - 1:
            print(f"  -> Generated {idx + 1}/{num_samples} crops.")

    metadata_path = os.path.join(output_dir, "metadata.json")
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2)

    print(f"[Synthetic Generator] Completed. Metadata saved to {metadata_path}")
    return records


if __name__ == "__main__":
    out_dir = os.path.join("ai_training", "track_1_vision", "data", "synthetic")
    generate_synthetic_dataset(out_dir, num_samples=100)
