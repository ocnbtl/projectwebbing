"""Prepare a deterministic, inspectable terrain crop for Madagin Ridge v1.11.

The source is the public-domain USGS 3DEP one-arc-second n23w160 tile. This
utility preserves the elevation values in a 16-bit PNG (0..2048 metres) and
creates a hillshade preview used to select and audit the macro-topology before
Blender art direction begins.

Requires Pillow and NumPy. Run with the bundled Codex Python runtime:

  python tools/terrain/prepare_usgs_3dep_ridge_v111.py
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = ROOT / "world-source" / "dem" / "usgs-3dep-n23w160" / "USGS_1_n23w160.tif"
DEFAULT_OUTPUT = ROOT / "world-source" / "dem" / "usgs-3dep-n23w160" / "madagin-ridge-dem-source-v1.11.png"
DEFAULT_PREVIEW = ROOT / "artifacts" / "ridge-v111" / "dem-source-hillshade.png"
DEFAULT_METADATA = ROOT / "world-source" / "dem" / "usgs-3dep-n23w160" / "madagin-ridge-dem-source-v1.11.json"

# Northwest/central Kauai crop selected after comparing broad-island and two
# focused hillshades. It contains irregular spurs, saddles, amphitheatres, and
# nested drainages without bringing coastline imagery into the runtime.
DEFAULT_CROP = (1000, 2736, 2100, 3500)


def parse_crop(value: str) -> tuple[int, int, int, int]:
    result = tuple(int(part.strip()) for part in value.split(","))
    if len(result) != 4:
        raise argparse.ArgumentTypeError("crop must be left,top,right,bottom")
    return result


def hillshade(elevation: np.ndarray) -> np.ndarray:
    """Return a warm/cool relief preview without using imagery as a texture."""
    gy, gx = np.gradient(elevation.astype(np.float32))
    slope = np.pi / 2.0 - np.arctan(np.hypot(gx, gy) / 14.0)
    aspect = np.arctan2(-gx, gy)
    azimuth = math.radians(315.0)
    altitude = math.radians(36.0)
    light = (
        np.sin(altitude) * np.sin(slope)
        + np.cos(altitude) * np.cos(slope) * np.cos(azimuth - aspect)
    )
    light = np.clip((light + 0.15) / 1.15, 0.0, 1.0)
    height = np.clip(elevation / max(1.0, float(np.percentile(elevation, 99.8))), 0.0, 1.0)
    low = np.array([31.0, 48.0, 42.0], dtype=np.float32)
    high = np.array([173.0, 155.0, 112.0], dtype=np.float32)
    color = low[None, None, :] * (1.0 - height[..., None]) + high[None, None, :] * height[..., None]
    color *= (0.34 + light[..., None] * 0.84)
    return np.clip(color, 0.0, 255.0).astype(np.uint8)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--preview", type=Path, default=DEFAULT_PREVIEW)
    parser.add_argument("--metadata", type=Path, default=DEFAULT_METADATA)
    parser.add_argument("--crop", type=parse_crop, default=DEFAULT_CROP)
    args = parser.parse_args()

    with Image.open(args.input) as source:
        full = np.asarray(source, dtype=np.float32)
        pixel_scale = tuple(float(value) for value in source.tag_v2.get(33550, ()))
        tiepoint = tuple(float(value) for value in source.tag_v2.get(33922, ()))

    left, top, right, bottom = args.crop
    crop = full[top:bottom, left:right].copy()
    crop[crop < -1000.0] = 0.0
    crop = np.clip(crop, 0.0, 2048.0)

    encoded = np.round(crop / 2048.0 * 65535.0).astype(np.uint16)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(encoded).save(args.output, optimize=True)

    preview = Image.fromarray(hillshade(crop), mode="RGB")
    if preview.width > 1600:
        preview.thumbnail((1600, 1000), Image.Resampling.LANCZOS)
    args.preview.parent.mkdir(parents=True, exist_ok=True)
    preview.save(args.preview, optimize=True)

    metadata = {
        "source": str(args.input.relative_to(ROOT)).replace("\\", "/"),
        "cropPixels": [left, top, right, bottom],
        "dimensions": [int(crop.shape[1]), int(crop.shape[0])],
        "elevationMetres": {
            "minimum": round(float(crop.min()), 3),
            "maximum": round(float(crop.max()), 3),
            "p99": round(float(np.percentile(crop, 99.0)), 3),
        },
        "geotiffPixelScale": pixel_scale,
        "geotiffTiepoint": tiepoint,
        "encoding": "unsigned 16-bit PNG; 0..65535 maps linearly to 0..2048 metres",
        "runtimeUse": "macro-topology reference only; Blender applies crop, remapping, erosion breakup, and original valley composition",
    }
    args.metadata.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")

    print(f"HEIGHTMAP={args.output} {args.output.stat().st_size} bytes")
    print(f"PREVIEW={args.preview} {args.preview.stat().st_size} bytes")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
