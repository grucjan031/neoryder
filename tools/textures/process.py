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
from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
OUT = ROOT / "public/assets/textures"
CATALOG = json.loads((HERE / "catalog.json").read_text(encoding="utf-8"))
QUALITY = 85
BUDGET = 20_000_000
CORNER_ALPHA_MAX = 8  # ślad po kompresji stratnej, niewidoczny (3% krycia)
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


def gallery_texture(source, item):
    """Zachowuje alfę, proporcje napisów i rytm fug w obu wersjach galerii."""
    size = item["width"], item["height"]
    category = item["category"]
    if category == "surfaces":
        image = seamless(ImageOps.fit(source.convert("RGB"), size, Image.Resampling.LANCZOS))
    else:
        decal = category in ("decals", "labels")
        mode = "RGBA" if decal else "RGB"
        image = Image.new(mode, size)
        inner = ImageOps.contain(source.convert(mode), (size[0]-48, size[1]-48), Image.Resampling.LANCZOS)
        image.paste(inner, ((size[0]-inner.width)//2, (size[1]-inner.height)//2))
        if not decal:
            image = black_key(image)
    # Kwantyzacja przed korektą zachowuje drobne detale. Napisy i decale
    # zapisujemy bezstratnie, by nie zmieniać barw na krawędziach liter.
    rgb = image.convert("RGB").quantize(128, dither=Image.Dither.NONE).convert("RGB")
    hsv = np.asarray(rgb.convert("HSV")).copy()
    hue = hsv[:, :, 0].astype(float) * 360 / 255
    chromatic = (hsv[:, :, 1] >= 36) & (hsv[:, :, 2] >= 16)
    for mask, degrees in (
        ((hue < 23) | (hue >= 342), 41),
        ((hue >= 163) & (hue <= 204), 223),
        ((hue >= 280) & (hue < 342), 251),
    ):
        hsv[:, :, 0][mask & chromatic] = round(degrees * 255 / 360)
    result = Image.frombytes("HSV", rgb.size, hsv.tobytes()).convert("RGB")
    if image.mode == "RGBA":
        result.putalpha(image.getchannel("A"))
    return result


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
            if destination(item).exists():
                continue
            raise FileNotFoundError(raw)
        with Image.open(raw) as source:
            if item.get("set") in ("mall", "lab"):
                image = gallery_texture(source, item)
                if item["category"] == "surfaces" and not item.get("lossless"):
                    image.save(destination(item), "WEBP", quality=QUALITY, method=6)
                else:
                    image.save(destination(item), "WEBP", lossless=True, method=6)
                continue
            image = source.convert("RGB")
        if item["category"] in ("decals", "labels"):
            image = green_key(image)
        elif item["category"] == "posters" and item.get("keyBackground"):
            keyed = green_key(image)
            background = Image.new("RGBA", keyed.size, item["keyBackground"])
            image = Image.alpha_composite(background, keyed).convert("RGB")
        image = ImageOps.fit(image, (item["width"], item["height"]), Image.Resampling.LANCZOS)
        if item["category"] == "surfaces":
            if item["id"] in ("asphalt_puddles", "grime"):
                image = image.convert("L").convert("RGB")
            # Opcjonalna korekta tonów po kontroli palety; domyślnie neutralna.
            if item.get("saturation") is not None:
                image = ImageEnhance.Color(image).enhance(item["saturation"])
            if item.get("brightness") is not None:
                image = ImageEnhance.Brightness(image).enhance(item["brightness"])
            image = seamless(image)
        elif item["category"] in ("signs", "holo", "screens"):
            if item.get("blackMargin"):
                margin = item["blackMargin"]
                inner = ImageOps.contain(
                    image, (image.width - 2 * margin, image.height - 2 * margin),
                    Image.Resampling.LANCZOS,
                )
                image = Image.new("RGB", image.size, "#000000")
                image.paste(inner, ((image.width - inner.width) // 2,
                                    (image.height - inner.height) // 2))
            image = black_key(image)
            if item.get("hueShift"):
                # Korekta barwy po kontroli palety (np. fiolet dryfujący ku zarezerwowanej magencie).
                h, sat, val = image.convert("HSV").split()
                shift = round(item["hueShift"] / 360 * 256)
                h = h.point(lambda x: (x + shift) % 256)
                image = Image.merge("HSV", (h, sat, val)).convert("RGB")
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
            required_mode = "RGBA" if item["category"] in ("decals", "labels") else "RGB"
            valid_mode = image.mode == required_mode or (
                item["category"] == "posters" and image.mode == "RGBA"
            )
            if image.format != "WEBP" or image.size != (item["width"], item["height"]) or not valid_mode:
                errors.append(f"{item['id']}: wrong format, size or mode")
            a = np.asarray(image).astype(np.float32)
            if item["category"] in ("signs", "holo", "screens"):
                values = corners(a)
                mean = float(values.mean())
                result["cornerBrightness255"] = round(mean, 4)
                if mean >= 3:
                    errors.append(f"{item['id']}: corners not black: {mean}")
            elif item["category"] in ("decals", "labels"):
                maximum = float(corners(a)[:, 3].max())
                result["cornerAlphaMax255"] = maximum
                if maximum > CORNER_ALPHA_MAX or a[:, :, 3].max() < 200:
                    errors.append(f"{item['id']}: invalid transparency")
            elif item["category"] == "posters":
                if image.mode == "RGBA" and a[:, :, 3].min() != 255:
                    errors.append(f"{item['id']}: poster not fully opaque")
                key_pixels = (a[:, :, 1] > 120) & (
                    a[:, :, 1] - np.maximum(a[:, :, 0], a[:, :, 2]) > 85
                )
                result["keyGreenPixels"] = int(key_pixels.sum())
                if key_pixels.any():
                    errors.append(f"{item['id']}: green key residue")
            elif item["category"] == "atlas":
                result["grid"] = [4, 4]
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
    rows = (len(CATALOG) + 5) // 6
    sheet = Image.new("RGB", (6 * 256, rows * 300), "#151b29")
    draw = ImageDraw.Draw(sheet)
    for i, item in enumerate(CATALOG):
        if not destination(item).exists():
            continue
        with Image.open(destination(item)) as source:
            image = source.convert("RGBA")
        image.thumbnail((240, 260), Image.Resampling.LANCZOS)
        x, y = (i % 6) * 256, (i // 6) * 300
        # Szachownica tylko w podglądzie, nigdy w teksturze.
        if item["category"] in ("decals", "labels"):
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
