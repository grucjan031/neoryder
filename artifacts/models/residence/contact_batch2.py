"""Arkusze podglądów drugiej partii: python artifacts/models/residence/contact_batch2.py."""

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


DIRECTORY = Path(__file__).resolve().parent
SPECS = json.loads((DIRECTORY / "batch2-specs.json").read_text(encoding="utf8"))
FONT = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 16)

for offset in range(0, len(SPECS), 8):
    sheet = Image.new("RGB", (1280, 744), "#101723")
    draw = ImageDraw.Draw(sheet)
    for index, spec in enumerate(SPECS[offset:offset + 8]):
        x, y = index % 4 * 320, index // 4 * 372
        preview = Image.open(DIRECTORY / (spec["model"] + ".png")).convert("RGB")
        preview.thumbnail((320, 320), Image.Resampling.LANCZOS)
        sheet.paste(preview, (x, y))
        draw.text((x + 8, y + 324), spec["model"].removeprefix("res_"), font=FONT, fill="#fff1d6")
        draw.text((x + 8, y + 346), " x ".join(str(n) for n in spec["size"]) + " m", font=FONT, fill="#aeb7c4")
    sheet.save(DIRECTORY / f"contact-batch2-{offset // 8 + 1}.jpg", quality=94)
