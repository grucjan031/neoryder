"""Niezależny pomiar zdekodowanych WebP i ochrona zakresu rundy 2."""

import colorsys
import hashlib
import json
import subprocess
import sys
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = ROOT / "public/assets/textures/komiks"
BASELINE = HERE / "versions/round2-before.json"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def measurements():
    result = {}
    for path in sorted((OUT / "surfaces").glob("*.webp")):
        rgb = np.asarray(Image.open(path).convert("RGB"), dtype=float) / 255
        high, low = rgb.max(axis=2), rgb.min(axis=2)
        saturation = (high - low) / np.maximum(high, 1e-6)
        # Baza: bez prawie czarnego tuszu i bursztynowych akcentów.
        warm = (rgb[:, :, 0] > rgb[:, :, 1] * 1.15) & (rgb[:, :, 1] > rgb[:, :, 2] * 1.5)
        base = high >= 0.12
        if path.stem != "komiks_wood_planks":
            base &= ~warm
        average = rgb[base].mean(axis=0)
        hue = colorsys.rgb_to_hsv(*average)[0] * 360
        result[path.stem] = {
            "baseHueDegrees": round(hue, 2),
            "baseMeanSaturation": round(float(saturation[base].mean()), 4),
            "allMeanSaturation": round(float(saturation.mean()), 4),
            "baseSaturationP95": round(float(np.percentile(saturation[base], 95)), 4),
            "maxValue": round(float(high.max()), 4),
            "sha256": digest(path),
        }
    return result


def protected():
    tracked = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().split("\0")
    paths = {ROOT / name for name in tracked if name and not (
        name.startswith("tools/textures/komiks/") or
        name.startswith("public/assets/textures/komiks/") or
        name == "docs/textures-komiks.md"
    )}
    paths.update((ROOT / "public/assets/textures/surfaces").rglob("*"))
    paths.update((HERE / "raw").glob("*.png"))
    return {path.relative_to(ROOT).as_posix(): digest(path)
            for path in sorted(paths) if path.is_file()}


def baseline():
    if BASELINE.exists():
        raise RuntimeError("Kopia rundy 2 już istnieje; nie nadpisuj stanu początkowego")
    BASELINE.parent.mkdir(exist_ok=True)
    files = list(OUT.rglob("*")) + list(HERE.glob("*.json")) + [HERE / "build.py", HERE / "podglad.png"]
    with zipfile.ZipFile(BASELINE.with_suffix(".zip"), "w", zipfile.ZIP_DEFLATED) as archive:
        for path in files:
            if path.is_file():
                archive.write(path, path.relative_to(ROOT))
    BASELINE.write_text(json.dumps({"materials": measurements(), "protected": protected()}, indent=2) + "\n")
    print("BASELINE_SAVED=" + str(BASELINE.relative_to(ROOT)))


def review():
    before = json.loads(BASELINE.read_text())
    current = protected()
    changed = [path for path, sha in before["protected"].items() if current.get(path) != sha]
    after = measurements()
    errors = []
    for name, stats in after.items():
        key = name.removeprefix("komiks_")
        sat = stats["baseMeanSaturation"]
        if key in ("asphalt", "roof_tar") and sat > 0.15:
            errors.append(name + ": S > 0.15")
        if key in ("concrete", "plaster", "tiles_wall", "paving") and sat > 0.22:
            errors.append(name + ": S > 0.22")
        if key in ("metal_panel", "tread_plate", "corrugated") and not (
            205 <= stats["baseHueDegrees"] <= 225 and 0.15 <= sat <= 0.35
        ):
            errors.append(name + ": stal poza paleta")
        if key == "wood_planks" and not (
            25 <= stats["baseHueDegrees"] <= 45 and 0.25 <= sat <= 0.45 and stats["maxValue"] <= 0.45
        ):
            errors.append(name + ": drewno poza paleta")
        old = before["materials"][name]
        print(f"{key}: H {old['baseHueDegrees']} -> {stats['baseHueDegrees']}; "
              f"S {old['baseMeanSaturation']} -> {sat}; S(all)={stats['allMeanSaturation']}")
    errors.extend("Zmieniono chroniony plik: " + path for path in changed)
    report = {"before": before["materials"], "after": after,
              "protectedFilesChecked": len(before["protected"]), "changedProtectedFiles": changed, "errors": errors}
    (HERE / "round2-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(f"PROTECTED_FILES={len(before['protected'])} CHANGED={len(changed)} ERRORS={len(errors)}")
    for error in errors:
        print("ERROR: " + error)
    if errors:
        raise SystemExit(1)


def cleanup():
    generator = (HERE / "build.py").read_text(encoding="utf-8")
    targets = [HERE / "codec_experiment.py", HERE / "palette_experiment.py"]
    for pattern in ("experiment-*", "axis-*", "trial-*"):
        targets.extend((HERE / "previews").glob(pattern))
    cache = HERE / "__pycache__"
    targets.extend(cache.glob("*.pyc"))
    removed = []
    for path in targets:
        resolved = path.resolve()
        assert resolved.is_relative_to(HERE), path
        assert path.is_file(), path
        assert path.name not in generator, path
        path.unlink()
        removed.append(path.relative_to(HERE).as_posix())
    if cache.exists():
        cache.rmdir()  # Tylko pusty katalog; nigdy rekurencyjnie.
        removed.append("__pycache__/")
    (HERE / "round2-cleanup.json").write_text(json.dumps(removed, indent=2) + "\n")
    print(f"REMOVED_ENTRIES={len(removed)}")


if __name__ == "__main__":
    {"baseline": baseline, "review": review, "cleanup": cleanup}[sys.argv[1]]()
