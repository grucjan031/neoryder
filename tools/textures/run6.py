"""Buduje zestaw targ z PNG oraz sprawdza gotowe WebP mapy run6.

python tools/textures/run6.py
"""

from io import BytesIO

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

import process
from komiks import build as comic
from run3 import read, write
from run5 import align_edge_bands, manifest_entry, optimize


RAW = process.HERE / "raw"
ARTIFACTS = process.ROOT / "artifacts/maps/run6"
BUDGET = 1_100_000
SURFACE_QUALITY = 65
DECAL_COLORS = 16
DECAL_ALPHA_STEP = 17
COLOR_RULE = (
    "S>=0.25, V>=0.12, delta>=10/255, alfa>=16; "
    "red [0,23)/[342,360), cyan/turquoise [160,204], magenta/pink [280,342)"
)
MATERIALS = read(process.ROOT / "src/data/render/arenaMaterials.json")


def prepare(source, item, comic_variant):
    category = item["category"]
    if category == "signs":
        source = process.black_key(source)
        bounds = source.getbbox()
    elif category == "decals":
        if "A" not in source.getbands():
            raise ValueError(f"{item['id']}: PNG musi mieć kanał alfa")
        alpha = source.getchannel("A")
        bounds = alpha.point(lambda value: 255 if value >= 16 else 0).getbbox()
    else:
        bounds = None
    if category != "surfaces" and bounds is None:
        raise ValueError(f"{item['id']}: puste źródło PNG")
    if bounds:
        source = source.crop(bounds)

    image = process.gallery_texture(source, item)
    if category == "surfaces":
        image = ImageOps.grayscale(image)
        if comic_variant:
            image = image.convert("RGB")
        else:
            tint = Image.new("RGB", (1, 1), MATERIALS[item["id"]]["tint"])
            levels = np.asarray(tint, dtype=np.float32)[0, 0]
            # Zachowuje luminancję wzoru i daje kodekowi jednolity kierunek chromy.
            offsets = levels - ImageOps.grayscale(tint).getpixel((0, 0))
            if item["id"] == "targ_wood_planks":
                # Przy brązie YUV przesuwa część fug w stronę czerwieni.
                offsets[1] += 3
            # W najciemniejszych fugach stratna chroma łatwo zmienia odcień.
            luma = np.maximum(np.asarray(image, dtype=np.float32), 38)[:, :, None]
            image = Image.fromarray(np.clip(luma + offsets, 0, 255).astype(np.uint8))
        return align_edge_bands(image)
    return image


def reserved_colors(image):
    hsv = np.asarray(image.convert("RGB").convert("HSV"))
    hue, saturation, value = np.moveaxis(hsv.astype(np.float32) / 255, -1, 0)
    hue *= 360
    alpha = np.asarray(image.convert("RGBA").getchannel("A"))
    visible = (
        (alpha >= 16)
        & (saturation >= 0.25)
        & (value >= 0.12)
        & (saturation * value >= 10 / 255)
    )
    return hsv, {
        "red": visible & ((hue < 23) | (hue >= 342)),
        "cyanTurquoise": visible & (hue >= 160) & (hue <= 204),
        "magentaPink": visible & (hue >= 280) & (hue < 342),
    }


def correct_decal_palette(image):
    hsv, masks = reserved_colors(image)
    corrected = hsv.copy()
    for name, shade in (("red", 41), ("cyanTurquoise", 223), ("magentaPink", 251)):
        corrected[masks[name], 0] = round(shade * 255 / 360)
    changed = np.logical_or.reduce(list(masks.values()))
    if not changed.any():
        return image
    rgb = Image.frombytes("HSV", image.size, corrected.tobytes()).convert("RGB")
    rgba = np.array(image)
    rgba[changed, :3] = np.asarray(rgb)[changed]
    return Image.fromarray(rgba)


def encode(image, category):
    output = BytesIO()
    if category == "surfaces":
        image.save(output, "WEBP", quality=SURFACE_QUALITY, method=6)
    elif category == "signs":
        optimize(image, output, surface=False)
    else:
        colors = image.convert("RGB").quantize(
            DECAL_COLORS, method=Image.Quantize.MAXCOVERAGE, dither=Image.Dither.NONE
        ).convert("RGB")
        alpha = image.getchannel("A").point(
            lambda value: round(value / DECAL_ALPHA_STEP) * DECAL_ALPHA_STEP
        )
        colors.putalpha(alpha)
        correct_decal_palette(colors).save(output, "WEBP", lossless=True, method=6)
    return output.getvalue()


def verify(image, item, encoded_bytes):
    texture_id = item["id"]
    category = item["category"]
    expected_mode = "RGBA" if category == "decals" else "RGB"
    size = (item["width"], item["height"])
    if image.format != "WEBP" or image.size != size or image.mode != expected_mode:
        raise ValueError(f"{texture_id}: nieprawidłowy format, rozmiar lub tryb")

    _, masks = reserved_colors(image)
    forbidden = {key: int(mask.sum()) for key, mask in masks.items()}
    if any(forbidden.values()):
        raise ValueError(f"{texture_id}: zabronione piksele HSV {forbidden}")
    result = {
        "id": texture_id,
        "size": list(size),
        "bytes": encoded_bytes,
        "forbiddenPixels": forbidden,
    }

    pixels = np.asarray(image, dtype=np.float32)
    if category == "surfaces":
        edges = [
            np.abs(pixels[:, 0] - pixels[:, -1]).mean(),
            np.abs(pixels[0] - pixels[-1]).mean(),
        ]
        if max(edges) > process.EDGE_LIMIT:
            raise ValueError(f"{texture_id}: widoczny szew {edges}")
        result["edgeDifference255"] = [round(float(value), 4) for value in edges]
    elif category == "decals":
        if process.corners(pixels)[:, 3].max() != 0 or pixels[:, :, 3].max() < 200:
            raise ValueError(f"{texture_id}: nieprawidłowa przezroczystość")
    elif process.corners(pixels).max() != 0:
        raise ValueError(f"{texture_id}: narożniki maski nie są czarne")
    return result


def build():
    standard = [item for item in process.CATALOG if item.get("set") == "targ"]
    variants = [item for item in comic.CATALOG if item.get("set") == "targ"]
    entries = [(item, False) for item in standard] + [(item, True) for item in variants]
    if (len(standard), len(variants)) != (30, 3):
        raise ValueError("Pakiet targ wymaga 30 tekstur podstawowych i 3 komiksowych")
    missing = [item["id"] for item, _ in entries if not (RAW / f"{item['id']}.png").is_file()]
    if missing:
        raise FileNotFoundError("Brak źródeł PNG: " + ", ".join(missing))

    sheet = Image.new("RGB", (5 * 384, ((len(entries) + 4) // 5) * 360), "#151b29")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=18)
    encoded = []
    report = []
    for index, (item, comic_variant) in enumerate(entries):
        with Image.open(RAW / f"{item['id']}.png") as source:
            prepared = prepare(source, item, comic_variant)
        data = encode(prepared, item["category"])
        encoded.append(data)
        with Image.open(BytesIO(data)) as decoded:
            report.append(verify(decoded, item, len(data)))
            thumb = ImageOps.contain(decoded.convert("RGBA"), (360, 314))
        x, y = (index % 5) * 384, (index // 5) * 360
        sheet.paste(thumb, (x + (384 - thumb.width) // 2, y + (314 - thumb.height) // 2), thumb)
        draw.text((x + 8, y + 326), item["id"], fill="white", font=font)

    total = sum(len(data) for data in encoded)
    if total > BUDGET:
        raise ValueError(f"Pakiet targ przekracza budżet: {total} > {BUDGET} B")

    updated = {process.OUT / "manifest.json": {}, comic.OUT / "manifest.json": {}}
    for (item, comic_variant), data in zip(entries, encoded):
        pipeline = comic if comic_variant else process
        path = pipeline.destination(item)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        with Image.open(BytesIO(data)) as decoded:
            entry = (
                comic.entry(item, decoded)
                if comic_variant
                else manifest_entry(item, path, decoded)
            )
        updated[pipeline.OUT / "manifest.json"][item["id"]] = entry
    for path, current in updated.items():
        previous = [entry for entry in read(path) if entry["id"] not in current]
        write(path, previous + list(current.values()))

    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    sheet.save(ARTIFACTS / "textures_sheet.png")
    write(
        ARTIFACTS / "textures_palette.json",
        {
            "totalBytes": total,
            "budgetBytes": BUDGET,
            "surfaceQuality": SURFACE_QUALITY,
            "paletteRule": COLOR_RULE,
            "files": report,
        },
    )
    print(f"run6: {len(entries)} tekstury, {total} / {BUDGET} B, 0 zabronionych pikseli HSV")


if __name__ == "__main__":
    build()
