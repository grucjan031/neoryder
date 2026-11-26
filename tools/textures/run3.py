"""Buduje wyłącznie pakiet run3 i zbiorczy arkusz, zachowując starsze manifesty.

python tools/textures/run3.py
"""

import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

import process


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
ARTIFACTS = ROOT / "artifacts/maps/run3"


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def optimize(image, path, surface):
    if surface:
        image.save(path, "WEBP", quality=70, method=6)
        return
    result = image.convert("RGB").quantize(32, dither=Image.Dither.NONE).convert("RGB")
    if image.mode == "RGBA":
        result.putalpha(image.getchannel("A"))
    result.save(path, "WEBP", lossless=True, method=6)


def build():
    items = [item for item in process.CATALOG if item.get("set") == "lab"]
    manifest_path = process.OUT / "manifest.json"
    previous = read(manifest_path)
    for item in items:
        path = process.destination(item)
        with Image.open(HERE / "raw" / (item["id"] + ".png")) as source:
            prepared = process.gallery_texture(source, item)
        optimize(prepared, path, item["category"] == "surfaces")
    process.manifest()
    current = read(manifest_path)
    old = {item["id"]: item for item in previous}
    write(manifest_path, [item if item["id"] in {x["id"] for x in items}
                          else old[item["id"]] for item in current])

    spec = importlib.util.spec_from_file_location("comic_build", HERE / "komiks/build.py")
    comic = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(comic)
    comic_items = [item for item in comic.CATALOG if item.get("set") == "lab"]
    comic_manifest = read(comic.OUT / "manifest.json")
    for item in comic_items:
        with Image.open(comic.HERE / "raw" / (item["id"] + ".png")) as source:
            image = process.gallery_texture(source, item)
        image = process.seamless(ImageOps.grayscale(image).convert("RGB"), band=128)
        path = comic.destination(item)
        optimize(image, path, True)
        with Image.open(path) as decoded:
            entry = comic.entry(item, decoded)
        comic_manifest = [x for x in comic_manifest if x["id"] != item["id"]]
        comic_manifest.append(entry)
    write(comic.OUT / "manifest.json", comic_manifest)

    entries = [(item, process.destination(item)) for item in items]
    entries += [(item, comic.destination(item)) for item in comic_items]
    font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 18)
    sheet = Image.new("RGB", (5 * 384, ((len(entries) + 4) // 5) * 360), "#151b29")
    draw = ImageDraw.Draw(sheet)
    palette = []
    for i, (item, path) in enumerate(entries):
        with Image.open(path) as source:
            rgba = source.convert("RGBA")
            hsv = np.asarray(rgba.convert("RGB").convert("HSV"))
            hue = hsv[:, :, 0].astype(float) * 360 / 255
            visible = (np.asarray(rgba)[:, :, 3] > 0) & (hsv[:, :, 1] >= 141) & (hsv[:, :, 2] >= 128)
            forbidden = np.zeros(hue.shape, dtype=bool)
            for center in (358.4, 186.1, 311.6):
                forbidden |= np.abs((hue - center + 180) % 360 - 180) <= 13
            count = int((visible & forbidden).sum())
            palette.append({"id": item["id"], "forbiddenPixels": count})
            if count:
                raise ValueError(f"{item['id']}: {count} zabronionych pikseli HSV")
            thumb = ImageOps.contain(rgba, (360, 314), Image.Resampling.LANCZOS)
        x, y = (i % 5) * 384, (i // 5) * 360
        sheet.paste(thumb, (x + (384 - thumb.width) // 2, y + (314 - thumb.height) // 2), thumb)
        draw.text((x + 8, y + 326), item["id"], fill="white", font=font)
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    sheet.save(ARTIFACTS / "textures_sheet.png")
    write(ARTIFACTS / "textures_palette.json", palette)
    print(f"run3: {len(entries)} tekstur, 0 zabronionych pikseli HSV")


if __name__ == "__main__":
    build()
