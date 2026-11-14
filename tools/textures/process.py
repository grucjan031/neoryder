"""Obróbka wygenerowanych bitmap; bez proceduralnego rysowania tekstur.

python tools/textures/process.py build
python tools/textures/process.py validate
python tools/textures/process.py previews
"""

import argparse
import json
import os
from pathlib import Path
import tempfile

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
OUT = ROOT / "public/assets/textures"
CATALOG = json.loads((HERE / "catalog.json").read_text(encoding="utf-8"))
QUALITY = 85
BUDGET = 12_000_000
EDGE_LIMIT = 6.0  # Średnia różnica kanału, w skali 0–255 po kompresji.
PREVIEWS = Path(tempfile.gettempdir()) / "neoryder-textures"


def seamless(image, band=64):
    """Łagodne mieszanie przeciwnych brzegów, bez odbijania całego wzoru."""
    a = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    for axis in (1, 0):
        b = np.swapaxes(a, 0, axis)
        n = b.shape[0]
        first, last = b[0].copy(), b[-1].copy()
        target = (first + last) / 2
        for i in range(band):
            weight = (1 + np.cos(np.pi * i / band)) / 2
            b[i] += (target - first) * weight
            b[n - 1 - i] += (target - last) * weight
        a = np.swapaxes(b, 0, axis)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def black_key(image, threshold=20):
    a = np.asarray(image.convert("RGB")).copy()
    a[a.max(axis=2) < threshold] = 0
    return Image.fromarray(a)


def green_key(image):
    a = np.asarray(image.convert("RGB"), dtype=np.float32)
    dominance = a[:, :, 1] - np.maximum(a[:, :, 0], a[:, :, 2])
    alpha = np.clip((85 - dominance) / 65, 0, 1)
    # Usuń domieszkę koloru klucza z częściowo przezroczystego brzegu.
    safe = np.maximum(alpha, 0.01)
    rgb = a.copy()
    rgb[:, :, 1] = (rgb[:, :, 1] - 255 * (1 - alpha)) / safe
    rgb[:, :, 0] /= safe
    rgb[:, :, 2] /= safe
    rgb[alpha == 0] = 0
    return Image.fromarray(
        np.dstack((np.clip(rgb, 0, 255), alpha * 255)).astype(np.uint8), "RGBA"
    )


def destination(item):
    return OUT / item["category"] / (item["id"] + ".webp")


def dominant(image):
    a = np.asarray(image.convert("RGBA"))
    pixels = a[:, :, :3][(a[:, :, 3] > 127) & (a[:, :, :3].max(axis=2) > 25)]
    if not len(pixels):
        pixels = a[:, :, :3].reshape(-1, 3)
    buckets = pixels // 16
    keys, counts = np.unique(buckets, axis=0, return_counts=True)
    selected = keys[counts.argmax()]
    color = np.median(pixels[np.all(buckets == selected, axis=1)], axis=0).astype(int)
    return "#" + "".join(f"{c:02x}" for c in color)


def manifest():
    entries = []
    for item in CATALOG:
        path = destination(item)
        if not path.exists():
            continue
        with Image.open(path) as image:
            entries.append({
                "id": item["id"], "category": item["category"],
                "path": str(path.relative_to(OUT)).replace(os.sep, "/"),
                "width": image.width, "height": image.height,
                "dominantColor": dominant(image), "description": item["description"],
                "bytes": path.stat().st_size,
            })
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "manifest.json").write_text(
        json.dumps(entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def build(ids):
    for item in CATALOG:
        if ids and item["id"] not in ids:
            continue
        raw = HERE / "raw" / (item["id"] + ".png")
        if not raw.exists():
            raise FileNotFoundError(raw)
        with Image.open(raw) as source:
            image = source.convert("RGB")
        if item["category"] == "decals":
            image = green_key(image)
        image = ImageOps.fit(image, (item["width"], item["height"]), Image.Resampling.LANCZOS)
        if item["category"] == "surfaces":
            if item["id"] in ("asphalt_puddles", "grime"):
                image = image.convert("L").convert("RGB")
            image = seamless(image)
        elif item["category"] in ("signs", "holo"):
            image = black_key(image)
        path = destination(item)
        path.parent.mkdir(parents=True, exist_ok=True)
        image.save(path, "WEBP", quality=QUALITY, method=6, exact=True)
        print(f"{path.relative_to(ROOT)}: {path.stat().st_size} bytes")
    manifest()


def corners(a, size=24):
    return np.concatenate([
        a[:size, :size].reshape(-1, a.shape[2]),
        a[:size, -size:].reshape(-1, a.shape[2]),
        a[-size:, :size].reshape(-1, a.shape[2]),
        a[-size:, -size:].reshape(-1, a.shape[2]),
    ])


def validate():
    errors, results = [], []
    expected = {destination(item) for item in CATALOG}
    actual = set(OUT.glob("*/*.webp"))
    if expected != actual:
        errors.append(f"File set mismatch: missing={expected - actual}, extra={actual - expected}")
    entries = json.loads((OUT / "manifest.json").read_text(encoding="utf-8"))
    if {x["id"] for x in entries} != {x["id"] for x in CATALOG} or len(entries) != len(CATALOG):
        errors.append("Manifest incomplete or duplicate ids")
    indexed = {x["id"]: x for x in entries}
    for item in CATALOG:
        path = destination(item)
        if not path.exists():
            continue
        with Image.open(path) as image:
            result = {"id": item["id"], "size": list(image.size), "mode": image.mode,
                      "bytes": path.stat().st_size}
            required_mode = "RGBA" if item["category"] == "decals" else "RGB"
            if image.format != "WEBP" or image.size != (item["width"], item["height"]) or image.mode != required_mode:
                errors.append(f"{item['id']}: wrong format, size or mode")
            a = np.asarray(image).astype(np.float32)
            if item["category"] in ("signs", "holo"):
                values = corners(a)
                mean = float(values.mean())
                result["cornerBrightness255"] = round(mean, 4)
                if mean >= 3:
                    errors.append(f"{item['id']}: corners not black: {mean}")
            elif item["category"] == "decals":
                maximum = float(corners(a)[:, 3].max())
                result["cornerAlphaMax255"] = maximum
                if maximum != 0 or a[:, :, 3].max() < 200:
                    errors.append(f"{item['id']}: invalid transparency")
            else:
                dx = float(np.abs(a[:, 0] - a[:, -1]).mean())
                dy = float(np.abs(a[0] - a[-1]).mean())
                result["edgeDifference255"] = [round(dx, 4), round(dy, 4)]
                if max(dx, dy) > EDGE_LIMIT:
                    errors.append(f"{item['id']}: edge difference too high: {dx}, {dy}")
                if item["id"] in ("asphalt_puddles", "grime"):
                    if np.abs(a.max(axis=2) - a.min(axis=2)).max() > 3:
                        errors.append(f"{item['id']}: mask not grayscale")
                if item["id"] == "asphalt_puddles":
                    coverage = float((a.mean(axis=2) > 127).mean())
                    result["puddleCoverage"] = round(coverage, 4)
                    if not 0.20 <= coverage <= 0.30:
                        errors.append(f"Puddle coverage outside 20-30%: {coverage}")
            entry = indexed.get(item["id"], {})
            if any(entry.get(k) != v for k, v in {
                "width": image.width, "height": image.height, "category": item["category"],
                "bytes": path.stat().st_size, "dominantColor": dominant(image),
                "description": item["description"], "path": f"{item['category']}/{item['id']}.webp",
            }.items()):
                errors.append(f"{item['id']}: stale manifest")
            results.append(result)
    total = sum(p.stat().st_size for p in OUT.rglob("*") if p.is_file())
    if total > BUDGET:
        errors.append(f"Budget exceeded: {total} > {BUDGET}")
    report = {"totalBytes": total, "budgetBytes": BUDGET, "files": results, "errors": errors}
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    report_path = PREVIEWS / "validation.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    print(f"Validation report: {report_path}")
    if errors:
        raise SystemExit(1)


def previews():
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 16)
    sheet = Image.new("RGB", (6 * 256, 6 * 300), "#151b29")
    draw = ImageDraw.Draw(sheet)
    for i, item in enumerate(CATALOG):
        if not destination(item).exists():
            continue
        with Image.open(destination(item)) as source:
            image = source.convert("RGBA")
        image.thumbnail((240, 260), Image.Resampling.LANCZOS)
        x, y = (i % 6) * 256, (i // 6) * 300
        # Szachownica tylko w podglądzie, nigdy w teksturze.
        if item["category"] == "decals":
            for cy in range(y, y + 260, 16):
                for cx in range(x, x + 256, 16):
                    color = "#4c5260" if ((cx - x) // 16 + (cy - y) // 16) % 2 else "#303642"
                    draw.rectangle((cx, cy, cx + 15, cy + 15), fill=color)
        sheet.paste(image, (x + (256 - image.width) // 2, y + (260 - image.height) // 2), image)
        draw.text((x + 6, y + 267), item["id"], fill="white", font=font)
        if item["category"] == "surfaces":
            with Image.open(destination(item)) as tile:
                tile = tile.convert("RGB")
                preview = Image.new("RGB", (2048, 2048))
                for tx in (0, 1024):
                    for ty in (0, 1024):
                        preview.paste(tile, (tx, ty))
                preview.save(PREVIEWS / (item["id"] + "-2x2.png"))
    path = PREVIEWS / "contact-sheet.png"
    sheet.save(path)
    print(path)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("build", "validate", "previews"))
    parser.add_argument("--ids", nargs="*")
    args = parser.parse_args()
    if args.command == "build":
        build(args.ids)
    elif args.command == "validate":
        validate()
    else:
        previews()
