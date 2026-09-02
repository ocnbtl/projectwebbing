from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "artifacts" / "ridge-v113"
REF = OUT / "reference"
V112 = ROOT / "artifacts" / "ridge-v112"
V113 = OUT
FONT_REGULAR = Path("C:/Windows/Fonts/arial.ttf")
FONT_BOLD = Path("C:/Windows/Fonts/arialbd.ttf")


def font(size: int, bold: bool = False):
    return ImageFont.truetype(str(FONT_BOLD if bold else FONT_REGULAR), size)


def tile(source: Path, size: tuple[int, int], label: str, sublabel: str = "") -> Image.Image:
    image = Image.open(source).convert("RGB")
    fitted = ImageOps.fit(image, size, method=Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(fitted, "RGBA")
    panel_height = 96 if sublabel else 66
    draw.rectangle((0, size[1] - panel_height, size[0], size[1]), fill=(2, 12, 15, 205))
    draw.text((22, size[1] - panel_height + 14), label, fill="white", font=font(24, True))
    if sublabel:
        draw.text((22, size[1] - 42), sublabel, fill=(224, 234, 232), font=font(16))
    return fitted


def board(filename: str, title: str, items: list[tuple[Path, str, str]]) -> None:
    width, height = 1800, 1240
    canvas = Image.new("RGB", (width, height), "#0b1718")
    draw = ImageDraw.Draw(canvas)
    draw.text((42, 30), title, fill="white", font=font(42, True))
    draw.text((44, 84), "Photographic targets above · live local WebGL evidence below", fill="#b8cbc8", font=font(20))
    tile_width, tile_height = 560, 520
    for index, (source, label, sublabel) in enumerate(items):
        x = 40 + (index % 3) * 580
        y = 130 + (index // 3) * 540
        canvas.paste(tile(source, (tile_width, tile_height), label, sublabel), (x, y))
    canvas.save(OUT / filename, optimize=True)


def contact_board(filename: str, title: str, items: list[tuple[Path, str, str]]) -> None:
    width, height = 1800, 1260
    canvas = Image.new("RGB", (width, height), "#0b1718")
    draw = ImageDraw.Draw(canvas)
    draw.text((42, 30), title, fill="white", font=font(42, True))
    draw.text((44, 84), "Isolated runtime layers plus final integrated composition", fill="#b8cbc8", font=font(20))
    for index, (source, label, sublabel) in enumerate(items):
        x = 40 + (index % 2) * 880
        y = 130 + (index // 2) * 550
        canvas.paste(tile(source, (840, 520), label, sublabel), (x, y))
    canvas.save(OUT / filename, optimize=True)


def crop_evidence(source: Path, filename: str, crop: tuple[float, float, float, float], title: str) -> None:
    image = Image.open(source).convert("RGB")
    left, top, right, bottom = crop
    pixels = (
        int(image.width * left),
        int(image.height * top),
        int(image.width * right),
        int(image.height * bottom),
    )
    result = ImageOps.fit(image.crop(pixels), (1200, 720), method=Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(result, "RGBA")
    draw.rectangle((0, 0, result.width, 58), fill=(2, 12, 15, 196))
    draw.text((20, 15), title, fill="white", font=font(24, True))
    result.save(OUT / filename, optimize=True)


board(
    "reference-board.png",
    "Madagin Ridge v1.13 · photographic reference board",
    [
        (REF / "usgs-oahu-rainforest-valley.jpg", "USGS · Oʻahu rainforest valley", "Closed canopy, deep overlap, humid scale"),
        (REF / "usgs-wailua-iki-falls.jpg", "USGS · Wailua Iki Falls", "Integrated water, wet rock, dense vegetation"),
        (REF / "nps-haleakala-ridge.jpg", "NPS · Haleakalā ridge", "Erosional threshold, geological silhouette"),
        (V113 / "browser-balanced-opening.png", "v1.13 · opening", "Valley withheld behind a dark ridge"),
        (V113 / "browser-balanced-crest.png", "v1.13 · crest", "First geographical drop and partial glimpse"),
        (V113 / "browser-balanced-reveal.png", "v1.13 · reveal", "Connected watershed and alpine depth"),
    ],
)

contact_board(
    "canopy-lod-contact-sheet.png",
    "Madagin Ridge v1.13 · canopy architecture diagnostic",
    [
        (V113 / "browser-diagnostic-forest-near.png", "Near forest", "Optimized hero families, PBR leaf/bark, understory"),
        (V113 / "browser-diagnostic-forest-mid.png", "Middle forest", "Texture-backed instanced clusters, closed crown mass"),
        (V113 / "browser-diagnostic-forest-far.png", "Far forest", "Terrain-following canopy shell plus emergents"),
        (V113 / "browser-balanced-crest.png", "Integrated crest frame", "Near/middle/far layers under production lighting"),
    ],
)

board(
    "v112-v113-comparison.png",
    "Madagin Ridge · v1.12 versus v1.13",
    [
        (REF / "usgs-oahu-rainforest-valley.jpg", "Reference · rainforest valley", "Public-domain USGS photograph"),
        (V112 / "browser-balanced-opening.png", "v1.12 · opening", "Valley visible immediately"),
        (V113 / "browser-balanced-opening.png", "v1.13 · opening", "Ridge now blocks the watershed"),
        (REF / "usgs-wailua-iki-falls.jpg", "Reference · water integration", "Public-domain USGS photograph"),
        (V112 / "browser-balanced-reveal.png", "v1.12 · reveal", "Sparse proxy geography"),
        (V113 / "browser-balanced-reveal.png", "v1.13 · reveal", "Authored Valley, lake, river, peaks"),
    ],
)

crop_evidence(V113 / "browser-high-approach.png", "diagnostic-terrain-close.png", (0.34, 0.35, 0.88, 0.95), "Terrain close-up · layered PBR ridge surface")
crop_evidence(V113 / "browser-high-opening.png", "diagnostic-near-canopy.png", (0.0, 0.28, 0.55, 0.98), "Near canopy · hero geometry and understory")
crop_evidence(V113 / "browser-balanced-crest.png", "diagnostic-middle-canopy.png", (0.0, 0.15, 0.68, 0.9), "Middle canopy · instanced textured crown mass")
crop_evidence(V113 / "browser-balanced-reveal.png", "diagnostic-far-canopy.png", (0.43, 0.12, 1.0, 0.82), "Far canopy · terrain-following textured shell")
crop_evidence(V113 / "browser-balanced-reveal.png", "diagnostic-river-shoreline.png", (0.32, 0.28, 0.78, 0.94), "Watershed · carved channel, river, and partial lake")
crop_evidence(V113 / "browser-balanced-opening.png", "diagnostic-sky-cloud.png", (0.0, 0.0, 1.0, 0.42), "Sky · golden-hour horizon and procedural cloud bank")
crop_evidence(V113 / "browser-high-reveal.png", "diagnostic-mist.png", (0.18, 0.2, 0.8, 0.78), "Atmosphere · bounded gully mist and distance haze")

print("Built reference, comparison, and diagnostic boards in", OUT)
