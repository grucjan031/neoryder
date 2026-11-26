"""Konwersja źródeł imagegen i kontrola odizolowanego pakietu komiks.

python tools/textures/komiks/build.py build
python tools/textures/komiks/build.py validate
python tools/textures/komiks/build.py previews
Wymaga Pillow i numpy; nie generuje treści tekstur ani nie używa sieci.
"""

import argparse
import colorsys
import hashlib
import io
import json
import platform
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps, __version__ as PIL_VERSION


HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from process import gallery_texture

ROOT = HERE.parents[2]
OUT = ROOT / "public/assets/textures/komiks"
CATALOG = json.loads((HERE / "catalog.json").read_text(encoding="utf-8"))
BUDGET = 6_000_000
EDGE_LIMIT = 6.0
MANIFEST_KEYS = {
    "id", "category", "path", "width", "height", "dominantColor", "description", "bytes"
}

# H, S oraz docelowe V dla tuszu, ciemnego tonu, półtonu i świateł.
SURFACE_PALETTES = {
    "komiks_concrete": (218, 0.10, [0, 0.06, 0.27, 0.32, 0.38, 0.44]),
    "komiks_asphalt": (215, 0.06, [0, 0.04, 0.14, 0.22, 0.31, 0.41]),
    "komiks_brick": (72, 0.18, [0, 0.04, 0.20, 0.27, 0.35, 0.43]),
    "komiks_metal_panel": (216, 0.21, [0, 0.05, 0.22, 0.31, 0.44, 0.53]),
    "komiks_rust_metal": (218, 0.09, [0, 0.04, 0.20, 0.29, 0.40, 0.49]),
    "komiks_corrugated": (219, 0.20, [0, 0.05, 0.23, 0.33, 0.46, 0.55]),
    "komiks_plaster": (210, 0.055, [0, 0.08, 0.40, 0.39, 0.35, 0.38]),
    "komiks_tiles_wall": (212, 0.14, [0, 0.05, 0.25, 0.36, 0.48, 0.56]),
    "komiks_wood_planks": (40, 0.34, [0, 0.05, 0.23, 0.28, 0.37, 0.43]),
    "komiks_tread_plate": (222, 0.23, [0, 0.05, 0.19, 0.29, 0.42, 0.51]),
    "komiks_roof_tar": (220, 0.035, [0, 0.04, 0.12, 0.18, 0.26, 0.34]),
    "komiks_paving": (225, 0.075, [0, 0.06, 0.24, 0.33, 0.43, 0.51]),
}


def material_fragments(source, sample_size=480, block=320, overlap=64, grid=5, seed=4217):
    """Mniejsze fragmenty istniejącego rysunku zszyte bez regularnego powielania.

    Stały seed wybiera wyłącznie wycinki źródła; nie dodaje nowych znaków.
    Cięcia po najmniejszym błędzie w nakładkach zachowują ostrość tuszu.
    """
    sample = np.asarray(source.convert("RGB").resize((sample_size, sample_size), Image.Resampling.LANCZOS))
    size = block + (grid - 1) * (block - overlap)
    canvas = np.zeros((size, size, 3), dtype=np.uint8)
    rng = np.random.default_rng(seed)
    for y in range(0, size - block + 1, block - overlap):
        for x in range(0, size - block + 1, block - overlap):
            candidates = []
            for _ in range(24):
                sy, sx = rng.integers(0, sample_size - block + 1, size=2)
                patch = sample[sy:sy + block, sx:sx + block].copy()
                score = 0
                if x:
                    score += np.square(canvas[y:y + block, x:x + overlap].astype(float) - patch[:, :overlap]).mean()
                if y:
                    score += np.square(canvas[y:y + overlap, x:x + block].astype(float) - patch[:overlap]).mean()
                candidates.append((score, patch))
            patch = min(candidates, key=lambda candidate: candidate[0])[1]
            target = canvas[y:y + block, x:x + block]
            keep = np.zeros((block, block), dtype=bool)
            if x:
                cost = np.square(target[:, :overlap].astype(float) - patch[:, :overlap]).mean(axis=2)
                keep[:, :overlap] |= np.arange(overlap)[None, :] < minimum_cut(cost)[:, None]
            if y:
                cost = np.square(target[:overlap].astype(float) - patch[:overlap]).mean(axis=2)
                keep[:overlap] |= np.arange(overlap)[:, None] < minimum_cut(cost.T)[None, :]
            target[:] = np.where(keep[:, :, None], target, patch)
    return Image.fromarray(canvas)


def surface_palette(image, material_id):
    rgb = np.asarray(image.convert("RGB"), dtype=float) / 255
    brightness = rgb.max(axis=2)
    hue, saturation, ramp = SURFACE_PALETTES[material_id]
    value = np.interp(brightness, [0, 0.08, 0.22, 0.32, 0.48, 1], ramp)
    rgb_out = value[:, :, None] * np.array(colorsys.hsv_to_rgb(hue / 360, saturation, 1))
    if material_id == "komiks_rust_metal" or material_id == "komiks_metal_panel":
        warm = (rgb[:, :, 0] > rgb[:, :, 1] * 1.15) & (rgb[:, :, 1] > rgb[:, :, 2] * 1.5)
        amber = brightness[:, :, None] * np.array(colorsys.hsv_to_rgb(40 / 360, 0.67, 1))
        rgb_out = np.where(warm[:, :, None], amber, rgb_out)
    return Image.fromarray(np.rint(np.clip(rgb_out, 0, 1) * 255).astype(np.uint8))


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def destination(item):
    return OUT / item["category"] / (item["id"] + ".webp")


def minimum_cut(cost):
    """Ciągła ścieżka w pasie nakładania; żadnego odbijania wzoru."""
    height, width = cost.shape
    previous = cost[0].copy()
    parents = np.zeros((height, width), dtype=np.int16)
    columns = np.arange(width)
    for row in range(1, height):
        candidates = np.stack((
            np.r_[np.inf, previous[:-1]], previous, np.r_[previous[1:], np.inf]
        ))
        choices = candidates.argmin(axis=0)
        parents[row] = columns + choices - 1
        previous = cost[row] + candidates[choices, columns]
    path = np.empty(height, dtype=np.int16)
    path[-1] = previous.argmin()
    for row in range(height - 1, 0, -1):
        path[row - 1] = parents[row, path[row]]
    return path


def periodic_cut(image, size=1024, overlap=128):
    """Zszycie przeciwległych pasów po najmniejszej różnicy kolorów.

    Wybiera istniejące fragmenty wygenerowanego obrazu; nie rysuje nowej treści.
    Przesunięcie umieszcza nieregularne połączenie z dala od prostego brzegu UV.
    """
    image = ImageOps.fit(image.convert("RGB"), (size + overlap, size + overlap),
                         Image.Resampling.LANCZOS)
    pixels = np.asarray(image).copy()
    for axis in (1, 0):
        array = np.moveaxis(pixels, axis, 1)
        left = array[:, :overlap].astype(np.float32)
        right = array[:, size:size + overlap].astype(np.float32)
        cost = np.square(left - right).mean(axis=2)
        # Nie prowadź cięcia tuż przy granicy pasa nakładania.
        cost[:, :8] += 1_000_000
        cost[:, -8:] += 1_000_000
        path = minimum_cut(cost)
        use_right = np.arange(overlap)[None, :] < path[:, None]
        result = array[:, :size].copy()
        result[:, :overlap] = np.where(use_right[:, :, None], right, left).astype(np.uint8)
        pixels = np.moveaxis(result, 1, axis)
    pixels = np.roll(pixels, (-overlap // 2, -overlap // 2), axis=(0, 1))
    # Lokalna korekta 16 px jak w process.py; bez szerokiego rozmywania tuszu.
    pixels = pixels.astype(np.float32)
    for axis in (1, 0):
        array = np.moveaxis(pixels, axis, 0)
        first, last = array[0].copy(), array[-1].copy()
        target = (first + last) / 2
        for offset in range(16):
            weight = (1 + np.cos(np.pi * offset / 16)) / 2
            array[offset] += (target - first) * weight
            array[-1 - offset] += (target - last) * weight
        pixels = np.moveaxis(array, 0, axis)
    return Image.fromarray(np.clip(pixels, 0, 255).astype(np.uint8))


def green_key(image):
    """Klucz jak w process.py, z kolorem brzegu z najbliższego pełnego tuszu."""
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32).copy()
    dominance = rgb[:, :, 1] - np.maximum(rgb[:, :, 0], rgb[:, :, 2])
    alpha = np.clip((85 - dominance) / 65, 0, 1)
    known = alpha == 1
    # Wąskie wygładzone brzegi dziedziczą kolor nieprzezroczystego sąsiada.
    # Zapobiega zielonej obwódce oraz fioletowemu zafarbieniu po despillu.
    for _ in range(12):
        pending = (alpha > 0) & ~known
        if not pending.any():
            break
        next_known = known.copy()
        next_rgb = rgb.copy()
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            neighbor_known = np.roll(known, (dy, dx), axis=(0, 1))
            neighbor_rgb = np.roll(rgb, (dy, dx), axis=(0, 1))
            selected = pending & neighbor_known & ~next_known
            next_rgb[selected] = neighbor_rgb[selected]
            next_known[selected] = True
        rgb, known = next_rgb, next_known
    rgb[(alpha > 0) & ~known] = (8, 13, 22)
    rgb[alpha == 0] = 0
    return Image.fromarray(np.dstack((rgb, alpha * 255)).astype(np.uint8))


def dominant(image):
    a = np.asarray(image.convert("RGBA"))
    pixels = a[:, :, :3][(a[:, :, 3] > 127) & (a[:, :, :3].max(axis=2) > 25)]
    if not len(pixels):
        pixels = a[:, :, :3][a[:, :, 3] > 127]
    if not len(pixels):
        raise ValueError("Obraz całkowicie przezroczysty")
    buckets = pixels // 16
    keys, counts = np.unique(buckets, axis=0, return_counts=True)
    color = np.median(pixels[np.all(buckets == keys[counts.argmax()], axis=1)], axis=0)
    return "#" + "".join(f"{int(channel):02x}" for channel in color)


def entry(item, image):
    path = destination(item)
    return {
        "id": item["id"], "category": item["category"],
        "path": path.relative_to(OUT).as_posix(),
        "width": image.width, "height": image.height,
        "dominantColor": dominant(image), "description": item["description"],
        "bytes": path.stat().st_size,
    }


def build():
    entries = []
    sources = []
    corrections = []
    for item in CATALOG:
        raw = HERE / "raw" / (item["id"] + ".png")
        with Image.open(raw) as source:
            source.load()
            if source.width < item["width"] or source.height < item["height"]:
                raise ValueError(f"Za małe źródło: {raw}")
            sources.append({"id": item["id"], "size": list(source.size),
                            "sha256": hashlib.sha256(raw.read_bytes()).hexdigest()})
            if item.get("set") == "mall":
                image = gallery_texture(source, item)
            elif item["category"] == "surfaces":
                if item["id"] == "komiks_plaster":
                    prepared = material_fragments(source)
                elif item["id"] == "komiks_concrete":
                    prepared = material_fragments(source, sample_size=800, block=448,
                                                  overlap=96, grid=3, seed=4218)
                else:
                    prepared = source
                image = surface_palette(periodic_cut(prepared), item["id"])
            else:
                image = ImageOps.fit(green_key(source), (512, 512), Image.Resampling.LANCZOS)
        path = destination(item)
        path.parent.mkdir(parents=True, exist_ok=True)
        if item.get("set") == "mall":
            corrections.append(dict(id=item["id"], **save_verified(image, path)))
        else:
            corrections.append(dict(id=item["id"], **save_verified(
                image, path, legacy_tint=item["category"] == "decals"
            )))
        with Image.open(path) as decoded:
            entries.append(entry(item, decoded))
        print(f"{path.relative_to(ROOT).as_posix()}: {path.stat().st_size} B")
    write_json(OUT / "manifest.json", entries)
    write_json(HERE / "sources.json", {"tool": "built-in imagegen", "calls": len(sources),
               "regenerations": 0, "python": platform.python_version(),
               "pillow": PIL_VERSION, "numpy": np.__version__, "files": sources})
    write_json(HERE / "palette-corrections.json", corrections)


def color_masks(image):
    rgba = np.asarray(image.convert("RGBA"))
    rgb = rgba[:, :, :3].astype(np.float32) / 255
    high, low = rgb.max(axis=2), rgb.min(axis=2)
    delta = high - low
    safe = np.maximum(delta, 1e-6)
    r, g, b = np.moveaxis(rgb, 2, 0)
    hue = np.where(high == r, ((g - b) / safe) % 6,
                   np.where(high == g, (b - r) / safe + 2, (r - g) / safe + 4)) * 60
    saturation = delta / np.maximum(high, 1e-6)
    # Pomiar uwzględnia tusz i brzegi z alfą >= 16; pomija prawie szare piksele.
    visible = rgba[:, :, 3] >= 16
    colored = visible & (high >= 0.12) & (saturation >= 0.25) & (delta >= 10 / 255)
    masks = {"red": (hue < 20) | (hue >= 345), "cyan": (hue >= 165) & (hue <= 200),
             "magenta": (hue >= 290) & (hue < 345)}
    masks = {name: mask & colored for name, mask in masks.items()}
    masks["keyGreen"] = (visible & (rgba[:, :, 1] > 120) &
                         (rgba[:, :, 1].astype(float) -
                          rgba[:, :, (0, 2)].max(axis=2) > 85))
    return visible, masks


def palette(image):
    visible, masks = color_masks(image)
    return {"visiblePixels": int(visible.sum()),
            "forbiddenPixels": {name: int(mask.sum()) for name, mask in masks.items()}}


def save_verified(image, path, legacy_tint=False):
    """Lokalny despill, także odcieni powstałych w stratnym kodeku YUV.

    Sprawdza faktycznie zdekodowany WebP; nie obniża progów walidatora.
    Minimalne sąsiedztwo błędnego piksela zastępuje neutralnym grafitem.
    """
    pixels = np.asarray(image).copy()
    if legacy_tint:
        # Nakładki zachowują dotychczasowy sposób barwienia.
        rgb = pixels[:, :, :3].astype(float)
        brightness = rgb.max(axis=2)
        warm = (rgb[:, :, 0] > rgb[:, :, 1] * 1.15) & (rgb[:, :, 1] > rgb[:, :, 2] * 1.5)
        cool_rgb = brightness[:, :, None] * np.array([0.2, 0.333, 1.0])
        amber_rgb = brightness[:, :, None] * np.array([1.0, 0.867, 0.2])
        pixels[:, :, :3] = np.rint(np.where(warm[:, :, None], amber_rgb, cool_rgb)).astype(np.uint8)
    corrected = np.zeros(pixels.shape[:2], dtype=bool)
    initial = None
    for attempt in range(16):
        encoded = io.BytesIO()
        Image.fromarray(pixels).save(encoded, "WEBP", quality=85, method=6, exact=True)
        with Image.open(io.BytesIO(encoded.getvalue())) as decoded:
            _, masks = color_masks(decoded)
        invalid = np.logical_or.reduce(list(masks.values()))
        if invalid.any():
            print(f"{path.stem}: palette pass {attempt + 1}, "
                  f"forbidden={ {key: int(mask.sum()) for key, mask in masks.items()} }")
        if initial is None:
            initial = int(invalid.sum())
        if not invalid.any():
            path.write_bytes(encoded.getvalue())
            return {"initialForbiddenPixels": initial, "correctedPixels": int(corrected.sum()),
                    "encodingPasses": attempt + 1, "finalForbiddenPixels": 0}
        grown = invalid.copy()
        radius = 2 + attempt // 4 if legacy_tint else 6 + attempt // 2
        for dy in range(-radius, radius + 1):
            for dx in range(-radius, radius + 1):
                shifted = np.roll(invalid, (dy, dx), axis=(0, 1))
                if dy > 0:
                    shifted[:dy] = False
                elif dy < 0:
                    shifted[dy:] = False
                if dx > 0:
                    shifted[:, :dx] = False
                elif dx < 0:
                    shifted[:, dx:] = False
                grown |= shifted
        luminance = np.rint(pixels[:, :, :3].astype(float) @ np.array([0.2126, 0.7152, 0.0722]))
        pixels[:, :, :3][grown] = np.repeat(luminance[grown, None], 3, axis=1).astype(np.uint8)
        corrected |= grown
    raise ValueError(f"Paleta nie spełnia kryteriów po 16 próbach: {path.name}")


def validate():
    errors, results = [], []
    manifest = json.loads((OUT / "manifest.json").read_text(encoding="utf-8"))
    expected = {destination(item) for item in CATALOG}
    if set(OUT.rglob("*.webp")) != expected:
        errors.append("Nieprawidłowy zestaw WebP")
    ids = [item["id"] for item in CATALOG]
    if len(set(ids)) != len(ids) or [item["id"] for item in manifest] != ids:
        errors.append("Nieprawidłowy zestaw identyfikatorów manifestu")
    indexed = {item["id"]: item for item in manifest}
    for item in CATALOG:
        path = destination(item)
        if not path.is_file():
            errors.append(f"Brak {item['id']}")
            continue
        with Image.open(path) as image:
            mode = "RGB" if item["category"] == "surfaces" else "RGBA"
            if image.format != "WEBP" or image.mode != mode or image.size != (item["width"], item["height"]):
                errors.append(f"{item['id']}: format, tryb lub wymiary")
            current = entry(item, image)
            declared = indexed.get(item["id"], {})
            if set(declared) != MANIFEST_KEYS or declared != current:
                errors.append(f"{item['id']}: niezgodny manifest")
            result = dict(current, **palette(image))
            if any(result["forbiddenPixels"].values()):
                errors.append(f"{item['id']}: kolory zarezerwowane lub pozostałości green_key")
            a = np.asarray(image).astype(np.float32)
            if mode == "RGB":
                edges = [float(np.abs(a[:, 0] - a[:, -1]).mean()),
                         float(np.abs(a[0] - a[-1]).mean())]
                result["edgeDifference255"] = [round(value, 4) for value in edges]
                if max(edges) > EDGE_LIMIT:
                    errors.append(f"{item['id']}: różnica przeciwległych krawędzi > {EDGE_LIMIT}")
            else:
                alpha = a[:, :, 3]
                border = np.r_[alpha[:16].ravel(), alpha[-16:].ravel(),
                               alpha[:, :16].ravel(), alpha[:, -16:].ravel()]
                result["borderAlphaMax255"] = int(border.max())
                result["alphaMax255"] = int(alpha.max())
                result["coverage"] = round(float((alpha >= 16).mean()), 4)
                if border.max() != 0 or alpha.max() < 200:
                    errors.append(f"{item['id']}: nieprawidłowa alfa")
            results.append(result)
    total = sum(path.stat().st_size for path in OUT.rglob("*") if path.is_file())
    if total > BUDGET:
        errors.append(f"Budżet przekroczony: {total} > {BUDGET}")
    report = {"totalBytes": total, "budgetBytes": BUDGET, "fileCount": len(results),
              "edgeLimit255": EDGE_LIMIT,
              "paletteRule": "HSV: S>=0.25, V>=0.12, delta>=10/255, alpha>=16; red [0,20)/[345,360), cyan [165,200], magenta [290,345)",
              "files": results, "errors": errors}
    write_json(HERE / "validation.json", report)
    for result in results:
        print(f"{result['id']}: {result['width']}x{result['height']}, {result['bytes']} B, "
              f"palette={result['forbiddenPixels']}, edges={result.get('edgeDifference255', 'RGBA')}")
    print(f"FILES={len(results)} TOTAL_BYTES={total} BUDGET_BYTES={BUDGET} ERRORS={len(errors)}")
    for error in errors:
        print("ERROR: " + error)
    if errors:
        raise SystemExit(1)


def checker(size):
    y, x = np.indices((size, size))
    values = np.where(((x // 16 + y // 16) % 2)[:, :, None],
                      np.array([78, 86, 102]), np.array([48, 56, 72])).astype(np.uint8)
    return Image.fromarray(values).convert("RGBA")


def previews():
    directory = HERE / "previews"
    directory.mkdir(exist_ok=True)
    font = ImageFont.load_default(size=19)
    surface_rows = (sum(item["category"] == "surfaces" for item in CATALOG) + 3) // 4
    sheet = Image.new("RGB", (2048, surface_rows * 552 + 432), "#111725")
    details = Image.new("RGB", sheet.size, "#111725")
    draw = ImageDraw.Draw(sheet)
    detail_draw = ImageDraw.Draw(details)
    surface_index, decal_index = 0, 0
    for item in CATALOG:
        with Image.open(destination(item)) as decoded:
            image = decoded.copy()
        if item["category"] == "surfaces":
            tiled = Image.new("RGB", (2048, 2048))
            for x in (0, 1024):
                for y in (0, 1024):
                    tiled.paste(image, (x, y))
            tiled.save(directory / (item["id"] + "-2x2.png"))
            x, y = (surface_index % 4) * 512, (surface_index // 4) * 552
            sheet.paste(tiled.resize((512, 512), Image.Resampling.LANCZOS), (x, y))
            draw.text((x + 8, y + 519), item["id"], font=font, fill="#fff1d6")
            details.paste(tiled.crop((768, 768, 1280, 1280)), (x, y))
            detail_draw.text((x + 8, y + 519), item["id"], font=font, fill="#fff1d6")
            surface_index += 1
        else:
            board = checker(512)
            board.alpha_composite(image.convert("RGBA"))
            board.convert("RGB").save(directory / (item["id"] + "-checker.png"))
            dark = Image.new("RGBA", (512, 512), "#1b2436")
            dark.alpha_composite(image.convert("RGBA"))
            dark.convert("RGB").save(directory / (item["id"] + "-dark.png"))
            x, y = decal_index * 400 + 16, surface_rows * 552
            sheet.paste(board.convert("RGB").resize((384, 384), Image.Resampling.LANCZOS), (x, y))
            draw.text((x, y + 390), item["id"], font=font, fill="#fff1d6")
            details.paste(dark.convert("RGB").resize((384, 384), Image.Resampling.LANCZOS), (x, y))
            detail_draw.text((x, y + 390), item["id"], font=font, fill="#fff1d6")
            decal_index += 1
    sheet.save(HERE / "podglad.png")
    details.save(directory / "detale-laczen.png")
    print((HERE / "podglad.png").relative_to(ROOT).as_posix())


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("build", "validate", "previews"))
    args = parser.parse_args()
    {"build": build, "validate": validate, "previews": previews}[args.command]()
