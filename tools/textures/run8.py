"""Eksportuje 22 tekstury Helios-IV i cztery powierzchnie komiksowe z raw/<id>.png."""

from io import BytesIO

from PIL import Image, ImageDraw, ImageFont, ImageOps

import process
import run6
from komiks import build as comic
from run3 import read, write
from run5 import forbidden_pixels, manifest_entry


ARTIFACTS = process.ROOT / "artifacts/maps/run8"


def export(item, comic_variant):
    # Ekrany mają czarny margines jak szyldy, etykiety mają alfę jak dekale.
    category = {"screens": "signs", "labels": "decals"}.get(item["category"], item["category"])
    settings = dict(item, category=category)
    with Image.open(run6.RAW / (item["id"] + ".png")) as source:
        image = run6.prepare(source, settings, comic_variant)
    data = run6.encode(run6.correct_decal_palette(image), category)
    with Image.open(BytesIO(data)) as decoded:
        report = run6.verify(decoded, settings, len(data))
        if forbidden_pixels(decoded):
            raise ValueError(f"{item['id']}: barwa zarezerwowana według §6.2")
        preview = ImageOps.contain(decoded.convert("RGBA"), (360, 310))
    return data, report, preview


def update_index(path, rows):
    existing = read(path)
    updates = {row["id"]: row for row in rows}
    result = [updates.pop(row["id"], row) for row in existing]
    result.extend(updates.values())
    if result != existing:
        write(path, result)


def build():
    items = read(process.HERE / "run8-prompts.json")["textures"]
    sheet = Image.new("RGB", (5 * 384, 6 * 350), "#151b29")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=16)
    outputs = []
    for index, item in enumerate(items):
        variant = item["id"].startswith("komiks_")
        data, report, preview = export(item, variant)
        outputs.append((comic if variant else process, item, data, report))
        x, y = index % 5 * 384, index // 5 * 350
        sheet.paste(preview, (x + (384 - preview.width) // 2, y + (310 - preview.height) // 2), preview)
        draw.text((x + 8, y + 320), item["id"], fill="white", font=font)

    total = sum(len(data) for _, _, data, _ in outputs)
    if total > run6.BUDGET:
        raise ValueError(f"Pakiet run8: {total} > {run6.BUDGET} B")

    for pipeline in (process, comic):
        catalog, manifest = [], []
        for owner, item, data, _ in outputs:
            if owner != pipeline:
                continue
            path = pipeline.destination(item)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            catalog.append(dict(item, set="run8", lossless=item["category"] != "surfaces"))
            with Image.open(BytesIO(data)) as decoded:
                manifest.append(comic.entry(item, decoded) if owner == comic else manifest_entry(item, path, decoded))
        update_index(pipeline.HERE / "catalog.json", catalog)
        update_index(pipeline.OUT / "manifest.json", manifest)

    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    sheet.save(ARTIFACTS / "textures_sheet.png")
    write(ARTIFACTS / "textures_palette.json", {
        "totalBytes": total, "budgetBytes": run6.BUDGET,
        "paletteRule": run6.COLOR_RULE, "files": [row[3] for row in outputs],
    })
    print(f"run8: {len(outputs)} WebP, {total} / {run6.BUDGET} B, 0 zabronionych pikseli")


if __name__ == "__main__":
    build()
