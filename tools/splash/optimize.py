"""Optymalizacja splasharty Gracjana do ekranów ładowania.

Źródło: docs/fabula/splash/*.webp (zostaje nietknięte).
Wynik: public/assets/splash/<ta sama nazwa>.webp — max 1600 px szerokości,
jakość startowa 78, w razie przekroczenia budżetu jakość spada krokami do 55.

Uruchomienie: python tools/splash/optimize.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "docs" / "fabula" / "splash"
DST = ROOT / "public" / "assets" / "splash"
MAX_WIDTH = 1600
START_QUALITY = 78
MIN_QUALITY = 55
BUDGET_BYTES = 180 * 1024


def optimize(source: Path) -> tuple[int, int, int]:
    image = Image.open(source).convert("RGB")
    if image.width > MAX_WIDTH:
        height = round(image.height * MAX_WIDTH / image.width)
        image = image.resize((MAX_WIDTH, height), Image.LANCZOS)
    target = DST / source.name
    quality = START_QUALITY
    while True:
        image.save(target, "WEBP", quality=quality, method=6)
        size = target.stat().st_size
        if size <= BUDGET_BYTES or quality <= MIN_QUALITY:
            return source.stat().st_size, size, quality
        quality -= 3


def main() -> None:
    DST.mkdir(parents=True, exist_ok=True)
    total_before = total_after = 0
    for source in sorted(SRC.glob("*.webp")):
        before, after, quality = optimize(source)
        total_before += before
        total_after += after
        print(f"{source.name}: {before // 1024} KB -> {after // 1024} KB (q{quality})")
    print(f"Razem: {total_before // 1024} KB -> {total_after // 1024} KB")


if __name__ == "__main__":
    main()
