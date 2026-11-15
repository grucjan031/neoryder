"""Build, validate and preview the generated NEORYDER HUD image pack."""
import json
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "tools/hud/raw"
OUT = ROOT / "public/assets/ui/hud"
CATALOG = json.loads((Path(__file__).with_name("catalog.json")).read_text(encoding="utf-8"))
PREVIEW = Path(tempfile.gettempdir()) / "neoryder-hud"
BUDGET = 3_000_000


def green_key(image):
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
    dominance = rgb[:, :, 1] - np.maximum(rgb[:, :, 0], rgb[:, :, 2])
    alpha = np.clip((100 - dominance) / 90, 0, 1)
    safe = np.maximum(alpha, 0.01)
    clean = rgb.copy()
    clean[:, :, 1] = (rgb[:, :, 1] - 255 * (1 - alpha)) / safe
    clean[:, :, 0] /= safe
    clean[:, :, 2] /= safe
    clean[alpha == 0] = 0
    return Image.fromarray(np.dstack((np.clip(clean, 0, 255), alpha * 255)).astype(np.uint8), "RGBA")


def build():
    OUT.mkdir(parents=True, exist_ok=True)
    entries = []
    for item in CATALOG:
        src = RAW / f"{item['id']}.png"
        if not src.exists():
            raise FileNotFoundError(src)
        with Image.open(src) as im:
            result = green_key(im)
            result = result.resize((item["width"], item["height"]), Image.Resampling.LANCZOS)
            result.save(OUT / f"{item['id']}.webp", "WEBP", quality=88, method=6, exact=True)
        entries.append({**item, "file": f"{item['id']}.webp", "bytes": (OUT / f"{item['id']}.webp").stat().st_size})
    (OUT / "manifest.json").write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def validate():
    errors, results = [], []
    for item in CATALOG:
        path = OUT / f"{item['id']}.webp"
        if not path.exists():
            errors.append(f"missing {path.name}")
            continue
        with Image.open(path) as im:
            a = np.asarray(im.convert("RGBA"))
            corner_alpha = int(max(a[0, 0, 3], a[0, -1, 3], a[-1, 0, 3], a[-1, -1, 3]))
            green_pixels = (a[:, :, 3] > 32) & (a[:, :, 1].astype(np.int16) > a[:, :, 0].astype(np.int16) + 55) & (a[:, :, 1].astype(np.int16) > a[:, :, 2].astype(np.int16) + 55) & (a[:, :, 1] > 90)
            green = int(green_pixels.sum())
            if im.format != "WEBP" or im.size != (item["width"], item["height"]):
                errors.append(f"{item['id']}: invalid format/dimensions {im.format} {im.size}")
            if corner_alpha != 0:
                errors.append(f"{item['id']}: nontransparent corner alpha {corner_alpha}")
            if green > max(12, int(item["width"] * item["height"] * 0.0001)):
                errors.append(f"{item['id']}: green key residue pixels {green}")
            results.append({"id": item["id"], "width": im.width, "height": im.height, "bytes": path.stat().st_size, "cornerAlpha": corner_alpha, "greenDominance": green})
    manifest = json.loads((OUT / "manifest.json").read_text(encoding="utf-8")) if (OUT / "manifest.json").exists() else []
    if {x.get("id") for x in manifest} != {x["id"] for x in CATALOG}:
        errors.append("manifest incomplete")
    total = sum(p.stat().st_size for p in OUT.glob("*.webp"))
    if total > BUDGET:
        errors.append(f"budget exceeded: {total}")
    report = {"totalBytes": total, "budgetBytes": BUDGET, "files": results, "errors": errors}
    PREVIEW.mkdir(parents=True, exist_ok=True)
    (PREVIEW / "validation.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    if errors:
        raise SystemExit(1)


def previews():
    cell = (256, 150)
    sheet = Image.new("RGB", (4 * cell[0], ((len(CATALOG) + 3) // 4) * (cell[1] + 24)), "#111722")
    draw = ImageDraw.Draw(sheet)
    for i, item in enumerate(CATALOG):
        path = OUT / f"{item['id']}.webp"
        if not path.exists():
            continue
        with Image.open(path) as im:
            im.thumbnail(cell, Image.Resampling.LANCZOS)
            x, y = (i % 4) * cell[0], (i // 4) * (cell[1] + 24)
            sheet.alpha_composite(im.convert("RGBA"), (x + (cell[0] - im.width) // 2, y + (cell[1] - im.height) // 2)) if sheet.mode == "RGBA" else sheet.paste(im.convert("RGBA"), (x + (cell[0] - im.width) // 2, y + (cell[1] - im.height) // 2), im.convert("RGBA"))
            draw.text((x + 5, y + cell[1] + 3), item["id"], fill="white")
    PREVIEW.mkdir(parents=True, exist_ok=True)
    sheet.save(PREVIEW / "contact-sheet.png")
    print(PREVIEW / "contact-sheet.png")


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in {"build", "validate", "previews"}:
        raise SystemExit("usage: process.py build|validate|previews")
    globals()[sys.argv[1]]()
