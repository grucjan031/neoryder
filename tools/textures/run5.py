"""Buduje tekstury przychodni Helixy, manifesty pakietu i arkusz kontrolny.

python tools/textures/run5.py
"""

from io import BytesIO

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

import process
from komiks import build as comic
from run3 import optimize as optimize_run3
from run3 import read, write


RAW = process.HERE / "raw"
ARTIFACTS = process.ROOT / "artifacts/maps/run5"
# src/world/mapAudit.ts: środek każdego zarezerwowanego pasma HSV.
RESERVED_HUES = (358.4, 186.1, 311.6)
HUE_DISTANCE = 13
MIN_SATURATION = 0.55
MIN_VALUE = 0.5


def forbidden_pixels(image):
    rgba = np.asarray(image.convert("RGBA"), dtype=np.float64)
    red, green, blue, alpha = np.moveaxis(rgba, -1, 0)
    value = np.maximum(np.maximum(red, green), blue)
    chroma = value - np.minimum(np.minimum(red, green), blue)
    visible = (alpha > 0) & (value >= 255 * MIN_VALUE) & (chroma >= value * MIN_SATURATION)
    if not visible.any():
        return 0

    r, g, b = red[visible], green[visible], blue[visible]
    v, delta = value[visible], chroma[visible]
    hue = (60 * np.select(
        [v == r, v == g],
        [(g - b) / delta, 2 + (b - r) / delta],
        default=4 + (r - g) / delta,
    )) % 360
    forbidden = np.zeros(hue.shape, dtype=bool)
    for center in RESERVED_HUES:
        forbidden |= np.abs((hue - center + 180) % 360 - 180) <= HUE_DISTANCE
    return int(forbidden.sum())


def align_edge_bands(image, band=16):
    """Zbliża bloki przy szwie, żeby stratny WebP zachował zgodność krawędzi."""
    pixels = np.asarray(image, dtype=np.float32).copy()
    ramp = np.cos(np.linspace(0, np.pi / 2, band)) ** 2
    ramp[:4] = 1
    weight = ramp[:, None, None]
    for axis in (0, 1):
        rows = np.swapaxes(pixels, axis, 0)
        first = rows[:band]
        last = rows[:-band - 1:-1]
        shared = (first + last) / 2
        first += (shared - first) * weight
        last += (shared - last) * weight
    return Image.fromarray(np.round(pixels).astype(np.uint8))


def prepare(source, item, comic_variant):
    if item["category"] == "decals" and item["height"] == 128:
        alpha = source.convert("RGBA").getchannel("A")
        # Półprzezroczyste drobiny tła nie wyznaczają rozmiaru taśmy.
        bounds = alpha.point([0] * 128 + [255] * 128).getbbox()
        if bounds:
            left, top, right, bottom = bounds
            padding = 4
            source = source.crop((
                max(0, left - padding), max(0, top - padding),
                min(source.width, right + padding), min(source.height, bottom + padding),
            ))
    image = process.gallery_texture(source, item)
    if comic_variant:
        return process.seamless(ImageOps.grayscale(image), band=128)
    if item["category"] == "surfaces":
        return align_edge_bands(image)
    return image


def optimize(image, output, surface):
    if surface:
        optimize_run3(image, output, True)
        return
    # Zachowaj nasycone akcenty, np. cienkie przebiegi na monitorze.
    colors = image.convert("RGB").quantize(
        32, method=Image.Quantize.MAXCOVERAGE, dither=Image.Dither.NONE
    ).convert("RGB")
    if image.mode == "RGBA":
        colors.putalpha(image.getchannel("A"))
    colors.save(output, "WEBP", lossless=True, method=6)


def manifest_entry(item, path, image):
    return {
        "id": item["id"],
        "category": item["category"],
        "path": path.relative_to(process.OUT).as_posix(),
        "width": image.width,
        "height": image.height,
        "dominantColor": process.dominant(image),
        "description": item["description"],
        "bytes": path.stat().st_size,
    }


def build():
    standard = [item for item in process.CATALOG if item.get("set") == "med"]
    variants = [item for item in comic.CATALOG if item.get("set") == "med"]
    entries = [(item, False) for item in standard] + [(item, True) for item in variants]
    if (len(standard), len(variants)) != (31, 3):
        raise ValueError("Pakiet med wymaga 31 tekstur podstawowych i 3 komiksowych")
    missing = [item["id"] for item, _ in entries if not (RAW / (item["id"] + ".png")).is_file()]
    if missing:
        raise FileNotFoundError("Brak źródeł PNG: " + ", ".join(missing))

    sheet = Image.new("RGB", (5 * 384, ((len(entries) + 4) // 5) * 360), "#151b29")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=18)
    palette = []
    encoded = []
    for i, (item, comic_variant) in enumerate(entries):
        with Image.open(RAW / (item["id"] + ".png")) as source:
            prepared = prepare(source, item, comic_variant)
        buffer = BytesIO()
        optimize(prepared, buffer, item["category"] == "surfaces")
        with Image.open(buffer) as decoded:
            count = forbidden_pixels(decoded)
            palette.append({"id": item["id"], "forbiddenPixels": count})
            thumb = ImageOps.contain(decoded.convert("RGBA"), (360, 314), Image.Resampling.LANCZOS)
        x, y = (i % 5) * 384, (i // 5) * 360
        sheet.paste(thumb, (x + (384 - thumb.width) // 2, y + (314 - thumb.height) // 2), thumb)
        draw.text((x + 8, y + 326), item["id"], fill="white", font=font)
        encoded.append(buffer.getvalue())

    violations = [f"{entry['id']} ({entry['forbiddenPixels']})" for entry in palette if entry["forbiddenPixels"]]
    if violations:
        raise ValueError("Zabronione piksele HSV: " + ", ".join(violations))

    standard_manifest = process.OUT / "manifest.json"
    comic_manifest = comic.OUT / "manifest.json"
    updated = {standard_manifest: {}, comic_manifest: {}}
    for (item, comic_variant), data in zip(entries, encoded):
        path = comic.destination(item) if comic_variant else process.destination(item)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        with Image.open(BytesIO(data)) as decoded:
            if comic_variant:
                updated[comic_manifest][item["id"]] = comic.entry(item, decoded)
            else:
                updated[standard_manifest][item["id"]] = manifest_entry(item, path, decoded)
    for path, current in updated.items():
        previous = [entry for entry in read(path) if entry["id"] not in current]
        write(path, previous + list(current.values()))

    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    sheet.save(ARTIFACTS / "textures_sheet.png")
    write(ARTIFACTS / "textures_palette.json", palette)
    print(f"run5: {len(entries)} tekstur, 0 zabronionych pikseli HSV")


if __name__ == "__main__":
    build()
