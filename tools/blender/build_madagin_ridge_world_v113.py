"""Build the bounded Madagin Ridge-to-Valley v1.13-v1.15 world.

The near Ridge keeps the documented USGS 3DEP elevation foundation. The
Valley and alpine horizon are authored as connected, asymmetric watersheds.
Far rainforest density is represented by a real terrain-following canopy
shell, while reusable textured tree clusters remain the middle-distance layer.
"""

from __future__ import annotations

import json
import math
import os
import random
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
VERSION_SLUG = os.environ.get("MADAGIN_RIDGE_VERSION", "v113").strip().lower()
if VERSION_SLUG not in {"v113", "v114", "v115"}:
    raise ValueError(f"Unsupported MADAGIN_RIDGE_VERSION={VERSION_SLUG!r}")
SEMANTIC_VERSION = {"v113": "v1.13", "v114": "v1.14", "v115": "v1.15"}[VERSION_SLUG]
VERSION_CODE = VERSION_SLUG.upper()
IS_V114 = VERSION_SLUG == "v114"
IS_V115 = VERSION_SLUG == "v115"
MODERN_WORLD = IS_V114 or IS_V115
PUBLIC_ROOT = ROOT / "public" / "world" / VERSION_SLUG
SOURCE_ROOT = ROOT / "world-source"
ARTIFACT_ROOT = ROOT / "artifacts" / f"ridge-{VERSION_SLUG}"
HEIGHTMAP = SOURCE_ROOT / "dem" / "usgs-3dep-n23w160" / "madagin-ridge-dem-source-v1.11.png"
CANOPY_BLEND = SOURCE_ROOT / "madagin-ridge-canopy-library-v1.12.blend"
BLEND_PATH = SOURCE_ROOT / f"madagin-ridge-to-valley-{SEMANTIC_VERSION}.blend"
MANIFEST_PATH = PUBLIC_ROOT / f"madagin-ridge-ecology-{SEMANTIC_VERSION}.json"
REPORT_PATH = ARTIFACT_ROOT / "world-build-report.json"

RIDGE_WIDTH = 620.0
RIDGE_NEAR_Z = 285.0
RIDGE_FAR_Z = -315.0
TROPICAL_WIDTH = 1460.0
TROPICAL_FAR_Z = -980.0
ALPINE_WIDTH = 1980.0
VALLEY_FAR_Z = -1710.0
ELEVATION_SCALE = 0.018 if MODERN_WORLD else 0.028
ELEVATION_BASE = 520.0
CELL_SIZE = 250.0
SEED = 115_200_826 if IS_V115 else 114_200_826 if IS_V114 else 113_200_826

CAMERA_KEYS = (
    (
        ("opening", (112.0, 82.0, 280.0), (10.0, 48.0, 128.0), 42.0),
        ("approach", (120.0, 106.0, 112.0), (38.0, 42.0, -132.0), 48.0),
        ("crest", (106.0, 144.0, 12.0), (8.0, 10.0, -350.0), 50.0),
        ("reveal", (88.0, 166.0, -126.0), (18.0, -43.0, -710.0), 53.0),
        ("lake", (320.0, 190.0, -540.0), (52.0, -42.0, -914.0), 55.0),
        ("clearing", (350.0, 48.0, -600.0), (315.0, 42.0, -660.0), 48.0),
        ("waterfall", (-360.0, 170.0, -380.0), (160.0, -20.0, -730.0), 51.0),
        ("summit", (128.0, 214.0, -310.0), (600.0, 90.0, -950.0), 56.0),
    ) if IS_V115 else (
        (
            ("opening", (105.0, 17.0, 250.0), (110.0, 2.0, 105.0), 42.0),
            ("approach", (120.0, 44.0, 112.0), (38.0, 38.0, -132.0), 48.0),
            ("crest", (106.0, 118.0, 12.0), (8.0, 10.0, -350.0), 50.0),
            ("reveal", (88.0, 166.0, -126.0), (18.0, -43.0, -710.0), 53.0),
            ("endpoint", (128.0, 214.0, -310.0), (34.0, -55.0, -980.0), 56.0),
        ) if IS_V114 else (
        ("opening", (118.0, 51.0, 214.0), (54.0, 51.0, -42.0), 48.0),
        ("approach", (128.0, 64.0, 126.0), (48.0, 53.0, -90.0), 50.0),
        ("crest", (108.0, 101.0, 24.0), (12.0, 21.0, -285.0), 52.0),
        ("reveal", (92.0, 146.0, -92.0), (10.0, -30.0, -660.0), 55.0),
        ("endpoint", (142.0, 194.0, -248.0), (18.0, -39.0, -860.0), 58.0),
        )
    )
)

ITERATION_PROFILES = {
    1: {"crest": 0.82, "relief": 0.86, "canopy": 0.9, "sun": 2.7, "haze": 0.68},
    2: {"crest": 0.92, "relief": 0.96, "canopy": 0.98, "sun": 3.0, "haze": 0.58},
    3: {"crest": 1.0, "relief": 1.04, "canopy": 1.04, "sun": 3.2, "haze": 0.5},
    4: {"crest": 1.06, "relief": 1.1, "canopy": 1.08, "sun": 3.35, "haze": 0.44},
    5: {"crest": 1.1, "relief": 1.14, "canopy": 1.1, "sun": 3.45, "haze": 0.4},
}


def cli_iteration() -> int:
    for argument in sys.argv:
        if argument.startswith("--iteration="):
            return max(1, min(5, int(argument.split("=", 1)[1])))
    return 5


def cli_render_review() -> bool:
    return "--render-review=1" in sys.argv


ITERATION = cli_iteration()
PROFILE = ITERATION_PROFILES[ITERATION]


def clamp(value: float, low: float, high: float) -> float:
    return min(high, max(low, value))


def smoothstep(low: float, high: float, value: float) -> float:
    amount = clamp((value - low) / max(0.0001, high - low), 0.0, 1.0)
    return amount * amount * (3.0 - 2.0 * amount)


def hash2(x: float, z: float) -> float:
    return (math.sin(x * 127.1 + z * 311.7) * 43758.5453123) % 1.0


def value_noise(x: float, z: float) -> float:
    ix = math.floor(x)
    iz = math.floor(z)
    fx = x - ix
    fz = z - iz
    ux = fx * fx * (3.0 - 2.0 * fx)
    uz = fz * fz * (3.0 - 2.0 * fz)
    a = hash2(ix, iz) * (1.0 - ux) + hash2(ix + 1, iz) * ux
    b = hash2(ix, iz + 1) * (1.0 - ux) + hash2(ix + 1, iz + 1) * ux
    return a * (1.0 - uz) + b * uz


def fractal_noise(x: float, z: float, octaves: int = 5) -> float:
    result = 0.0
    weight = 0.55
    scale = 1.0
    total = 0.0
    for octave in range(octaves):
        result += (value_noise(x * scale + octave * 7.1, z * scale - octave * 4.3) - 0.5) * weight
        total += weight
        scale *= 2.07
        weight *= 0.52
    return result / max(0.001, total)


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in tuple(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)


def new_collection(name: str) -> bpy.types.Collection:
    result = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(result)
    return result


def load_heightmap() -> tuple[np.ndarray, int, int]:
    image = bpy.data.images.load(str(HEIGHTMAP), check_existing=False)
    image.colorspace_settings.name = "Non-Color"
    width, height = image.size
    rgba = np.empty(width * height * 4, dtype=np.float32)
    image.pixels.foreach_get(rgba)
    elevation = rgba.reshape((height, width, 4))[:, :, 0] * 2048.0
    bpy.data.images.remove(image)
    return elevation, width, height


DEM, DEM_WIDTH, DEM_HEIGHT = load_heightmap()


def dem_uv(u: float, v: float) -> float:
    px = clamp(u, 0.0, 1.0) * (DEM_WIDTH - 1)
    py = clamp(v, 0.0, 1.0) * (DEM_HEIGHT - 1)
    x0 = int(math.floor(px))
    y0 = int(math.floor(py))
    x1 = min(DEM_WIDTH - 1, x0 + 1)
    y1 = min(DEM_HEIGHT - 1, y0 + 1)
    tx = px - x0
    ty = py - y0
    top = float(DEM[y0, x0]) * (1.0 - tx) + float(DEM[y0, x1]) * tx
    bottom = float(DEM[y1, x0]) * (1.0 - tx) + float(DEM[y1, x1]) * tx
    return top * (1.0 - ty) + bottom * ty


def dem_sample(x: float, z: float) -> float:
    u = 0.5 + x / RIDGE_WIDTH * 0.9 + z / (RIDGE_NEAR_Z - RIDGE_FAR_Z) * 0.035
    v = 0.5 + (z - (RIDGE_NEAR_Z + RIDGE_FAR_Z) * 0.5) / (RIDGE_NEAR_Z - RIDGE_FAR_Z) * 0.9
    return dem_uv(u, v)


def river_center(z: float) -> float:
    progress = clamp((RIDGE_FAR_Z - z) / (RIDGE_FAR_Z - VALLEY_FAR_Z), 0.0, 1.0)
    return 34.0 + math.sin((z + 85.0) * 0.0085) * (34.0 + progress * 108.0) + math.sin(z * 0.021) * 16.0


def ridge_height(x: float, z: float) -> float:
    base = (dem_sample(x, z) - ELEVATION_BASE) * ELEVATION_SCALE
    macro = fractal_noise(x * 0.015 + 8.0, z * 0.016 - 3.0, 5) * (2.35 if MODERN_WORLD else 3.3)
    meso = fractal_noise(x * 0.063 - 2.0, z * 0.068 + 6.0, 4) * 1.15
    crest_band = math.exp(-((z + 68.0) / 76.0) ** 2)
    crest_shape = 55.0 + fractal_noise(x * 0.012 - 7.0, z * 0.021 + 18.0, 4) * 21.0
    left_shoulder = math.exp(-((x + 145.0) / 105.0) ** 2) * 14.0
    right_shoulder = math.exp(-((x - 118.0) / 82.0) ** 2) * 18.0
    saddle = math.exp(-((x - 8.0) / 44.0) ** 2 - ((z + 70.0) / 48.0) ** 2) * 11.0
    threshold = crest_band * (crest_shape + left_shoulder + right_shoulder) * PROFILE["crest"] * (0.72 if MODERN_WORLD else 1.0) - saddle
    gully_center = -82.0 + math.sin((z - 20.0) * 0.025) * 15.0
    gully = math.exp(-((x - gully_center) / 10.0) ** 2) * smoothstep(-176.0, 110.0, -z) * 8.2
    approach_fold = math.exp(-((x - 118.0) / 54.0) ** 2 - ((z - 42.0) / 92.0) ** 2) * 9.0
    erosion = (fractal_noise(x * 0.061 - 19.0, z * 0.058 + 23.0, 3) - 0.5) * (0.82 if IS_V115 else 0.0)
    return base + macro + meso + erosion + threshold + approach_fold * (0.62 if MODERN_WORLD else 1.0) - gully


def tropical_height(x: float, z: float) -> float:
    progress = clamp((RIDGE_FAR_Z - z) / (RIDGE_FAR_Z - TROPICAL_FAR_Z), 0.0, 1.0)
    center = river_center(z)
    distance = abs(x - center)
    floor = -34.0 - progress * 18.0 + (distance / 92.0) ** 1.38 * (3.8 + progress * 0.8)
    left_axis = -350.0 + math.sin(z * 0.0058 + 0.5) * 128.0
    right_axis = 405.0 + math.sin(z * 0.0067 - 0.8) * 115.0
    left_wall = math.exp(-((x - left_axis) / (132.0 + progress * 48.0)) ** 2) * (86.0 + progress * 66.0)
    right_wall = math.exp(-((x - right_axis) / (148.0 + progress * 46.0)) ** 2) * (98.0 + progress * 54.0)
    spur_a = math.exp(-((z + 515.0) / 118.0) ** 2) * math.exp(-((x + 122.0) / 86.0) ** 2) * 48.0
    spur_b = math.exp(-((z + 710.0) / 136.0) ** 2) * math.exp(-((x - 235.0) / 105.0) ** 2) * 61.0
    spur_c = math.exp(-((z + 850.0) / 142.0) ** 2) * math.exp(-((x + 310.0) / 138.0) ** 2) * 54.0
    geology = fractal_noise(x * 0.011 + 31.0, z * 0.012 - 17.0, 5) * (16.0 + progress * 22.0)
    ravines = abs(fractal_noise(x * 0.027 - 11.0, z * 0.023 + 24.0, 4)) * (12.0 + progress * 15.0)
    channel = math.exp(-((x - center) / (15.0 + progress * 13.0)) ** 2) * (8.0 + progress * 5.0)
    # A broad, terrain-level drainage corridor lets the river read from the
    # aerial reveal instead of disappearing beneath the canopy/valley floor.
    corridor_width = 92.0 + progress * 58.0
    corridor = (
        math.exp(-((x - center) / corridor_width) ** 2)
        * (15.0 + progress * 23.0)
        * smoothstep(0.08, 0.72, progress)
    )
    authored = floor + (left_wall + right_wall + spur_a + spur_b + spur_c + geology + ravines) * PROFILE["relief"] - channel - corridor
    grade_blend = smoothstep(0.0, 0.2, progress)
    river_grade = 7.95 * (1.0 - grade_blend) + (-34.0 - progress * 18.0) * grade_blend
    lake = math.exp(-((z + 890.0) / 172.0) ** 2)
    cut_width = 42.0 + progress * 17.0 + lake * 106.0
    river_cut = 1.0 - smoothstep(cut_width * 0.72, cut_width, abs(x - center))
    authored = authored * (1.0 - river_cut) + (river_grade - 2.0) * river_cut
    edge_x = clamp(x, -RIDGE_WIDTH * 0.5, RIDGE_WIDTH * 0.5)
    edge = ridge_height(edge_x, RIDGE_FAR_Z)
    blend = smoothstep(0.0, 0.18, progress)
    result = edge * (1.0 - blend) + authored * blend
    # Reapply the grade after the boundary blend so no transition shoulder can
    # rise through the river surface.
    river_cut = 1.0 - smoothstep(cut_width * 0.72, cut_width, abs(x - center))
    return result * (1.0 - river_cut) + (river_grade - (6.0 if MODERN_WORLD else 2.0)) * river_cut


def alpine_height(x: float, z: float) -> float:
    progress = clamp((TROPICAL_FAR_Z - z) / (TROPICAL_FAR_Z - VALLEY_FAR_Z), 0.0, 1.0)
    center = river_center(z)
    floor = -48.0 - progress * 4.0 + (abs(x - center) / 118.0) ** 1.34 * 4.1
    peak_specs = (
        (-610.0, -1370.0, 282.0, 318.0, 178.0),
        (-292.0, -1515.0, 238.0, 286.0, 204.0),
        (165.0, -1480.0, 268.0, 308.0, 190.0),
        (598.0, -1360.0, 302.0, 334.0, 174.0),
        (38.0, -1195.0, 246.0, 214.0, 106.0),
    )
    peaks = 0.0
    for peak_index, (px, pz, sx, sz, height) in enumerate(peak_specs):
        distance = ((x - px) / sx) ** 2 + ((z - pz) / sz) ** 2
        core = max(0.0, 1.0 - distance ** 0.68) ** 1.42
        terrace = math.floor(core * 18.0) / 18.0
        core = core * 0.9 + terrace * 0.1
        erosion = 1.0 + fractal_noise(x * 0.022 + peak_index * 7.0, z * 0.019 - peak_index * 5.0, 5) * 0.46
        peaks += core * height * erosion
    left_wall = math.exp(-((x + 560.0 + math.sin(z * 0.006) * 105.0) / 190.0) ** 2) * 114.0
    right_wall = math.exp(-((x - 610.0 + math.sin(z * 0.005 + 1.2) * 92.0) / 205.0) ** 2) * 127.0
    strata = abs(fractal_noise(x * 0.018 + 4.0, z * 0.016 - 22.0, 5)) * (34.0 + progress * 34.0)
    scree = fractal_noise(x * 0.048 - 17.0, z * 0.039 + 6.0, 4) * 12.0
    channel = math.exp(-((x - center) / 24.0) ** 2) * 8.0
    authored = floor + (peaks + left_wall + right_wall + strata + scree) * PROFILE["relief"] - channel
    river_grade = -52.0 - progress * 4.0
    river_cut = math.exp(-((x - center) / (30.0 + progress * 8.0)) ** 2)
    authored = authored * (1.0 - river_cut) + (river_grade - 2.0) * river_cut
    tropical_edge = tropical_height(clamp(x, -TROPICAL_WIDTH * 0.5, TROPICAL_WIDTH * 0.5), TROPICAL_FAR_Z)
    blend = smoothstep(0.0, 0.22, progress)
    result = tropical_edge * (1.0 - blend) + authored * blend
    river_cut = math.exp(-((x - center) / (30.0 + progress * 8.0)) ** 2)
    return result * (1.0 - river_cut) + (river_grade - 2.0) * river_cut


def world_height(x: float, z: float) -> float:
    if z >= RIDGE_FAR_Z:
        return ridge_height(x, z)
    if z >= TROPICAL_FAR_Z:
        return tropical_height(x, z)
    return alpine_height(x, z)


def surface_metrics(x: float, z: float) -> dict[str, float]:
    step = 2.5 if z >= RIDGE_FAR_Z else 5.5
    center = world_height(x, z)
    dx = (world_height(x + step, z) - world_height(x - step, z)) / (step * 2.0)
    dz = (world_height(x, z + step) - world_height(x, z - step)) / (step * 2.0)
    slope = math.hypot(dx, dz)
    curvature = (world_height(x + step, z) + world_height(x - step, z) + world_height(x, z + step) + world_height(x, z - step) - center * 4.0) / (step * step)
    drainage = math.exp(-(abs(x - river_center(z)) / (18.0 if z >= RIDGE_FAR_Z else 31.0)) ** 2)
    exposure = clamp(smoothstep(0.38, 1.5, slope) + smoothstep(45.0, 108.0, center) * 0.28, 0.0, 1.0)
    moisture = clamp(drainage * 0.74 + smoothstep(-0.02, 0.2, -curvature) * 0.34, 0.0, 1.0)
    return {"height": center, "slope": slope, "curvature": curvature, "drainage": drainage, "exposure": exposure, "moisture": moisture}


def material(name: str, color: tuple[float, float, float, float], roughness: float, metallic: float = 0.0) -> bpy.types.Material:
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    if shader:
        shader.inputs["Base Color"].default_value = color
        shader.inputs["Roughness"].default_value = roughness
        shader.inputs["Metallic"].default_value = metallic
    result.diffuse_color = color
    return result


def build_heightfield(name: str, columns: int, rows: int, x_min: float, x_max: float, z_near: float, z_far: float, height_function, target: bpy.types.Collection, surface_material: bpy.types.Material, offset_function=None) -> bpy.types.Object:
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int]] = []
    uvs: list[tuple[float, float]] = []
    colors: list[tuple[float, float, float, float]] = []
    for row in range(rows):
        z = z_near + (z_far - z_near) * row / (rows - 1)
        for column in range(columns):
            x = x_min + (x_max - x_min) * column / (columns - 1)
            y = height_function(x, z)
            if offset_function:
                y += offset_function(x, z)
            vertices.append((x, -z, y))
            uvs.append((column / (columns - 1), row / (rows - 1)))
            metrics = surface_metrics(x, z)
            colors.append((metrics["moisture"], metrics["exposure"], clamp((y + 60.0) / 260.0, 0.0, 1.0), 1.0))
    for row in range(rows - 1):
        for column in range(columns - 1):
            a = row * columns + column
            b = a + 1
            c = a + columns + 1
            d = a + columns
            faces.extend(((a, b, c), (a, c, d)) if (row + column) % 2 == 0 else ((a, b, d), (b, c, d)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    color_layer = mesh.color_attributes.new(name="ecology", type="FLOAT_COLOR", domain="POINT")
    for loop in mesh.loops:
        uv_layer.data[loop.index].uv = uvs[loop.vertex_index]
    for index, color in enumerate(colors):
        color_layer.data[index].color = color
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    result = bpy.data.objects.new(name, mesh)
    target.objects.link(result)
    result.data.materials.append(surface_material)
    result["madagin_version"] = SEMANTIC_VERSION
    return result


def canopy_offset(x: float, z: float) -> float:
    metrics = surface_metrics(x, z)
    density = 1.0 - smoothstep(0.28, 1.55, metrics["slope"])
    crowns = fractal_noise(x * 0.09 + 17.0, z * 0.085 - 8.0, 4) * 2.8
    canopy = (5.2 + crowns) * density + 0.55
    if z < -150.0:
        progress = clamp((RIDGE_FAR_Z - z) / (RIDGE_FAR_Z - VALLEY_FAR_Z), 0.0, 1.0)
        lake = math.exp(-((z + 890.0) / 172.0) ** 2)
        water_width = 22.0 + progress * 11.0 + lake * 88.0
        water_mask = math.exp(-((x - river_center(z)) / water_width) ** 2)
        canopy -= water_mask * (20.0 + lake * 36.0)
    return canopy


def watershed_height(z: float) -> float:
    """A continuous downhill datum independent of alpine peak intrusions."""
    if z >= RIDGE_FAR_Z:
        return world_height(river_center(z), z) + 0.62
    tropical_progress = clamp((RIDGE_FAR_Z - z) / (RIDGE_FAR_Z - TROPICAL_FAR_Z), 0.0, 1.0)
    grade_blend = smoothstep(0.0, 0.2, tropical_progress)
    tropical_level = 7.95 * (1.0 - grade_blend) + (-34.0 - tropical_progress * 18.0) * grade_blend + 0.9
    if z >= TROPICAL_FAR_Z:
        return tropical_level
    alpine_progress = clamp((TROPICAL_FAR_Z - z) / (TROPICAL_FAR_Z - VALLEY_FAR_Z), 0.0, 1.0)
    return -51.1 - alpine_progress * 4.0


def build_ribbon(name: str, samples: list[tuple[float, float, float, float]], target: bpy.types.Collection, surface_material: bpy.types.Material, cross_segments: int = 4) -> bpy.types.Object:
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int]] = []
    uvs: list[tuple[float, float]] = []
    for index, (center, z, height, width) in enumerate(samples):
        for cross in range(cross_segments + 1):
            amount = cross / cross_segments * 2.0 - 1.0
            irregular = 1.0 + math.sin(z * 0.019 + cross * 1.7) * 0.045
            # Keep every cross-section on its sampled z row. The earlier
            # tangent-normal offset could make adjacent broad lake rows cross,
            # leaving long triangular holes where terrain showed through.
            vertices.append((center + width * amount * irregular, -z, height))
            uvs.append((cross / cross_segments, index / max(1, len(samples) - 1)))
        if index:
            current = index * (cross_segments + 1)
            previous = current - (cross_segments + 1)
            for cross in range(cross_segments):
                a = previous + cross
                b = a + 1
                c = current + cross + 1
                d = current + cross
                faces.extend(((a, b, c), (a, c, d)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for loop in mesh.loops:
        uv_layer.data[loop.index].uv = uvs[loop.vertex_index]
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    result = bpy.data.objects.new(name, mesh)
    target.objects.link(result)
    result.data.materials.append(surface_material)
    return result


def build_water(target: bpy.types.Collection, water_material: bpy.types.Material, bank_material: bpy.types.Material) -> tuple[bpy.types.Object, bpy.types.Object]:
    water_samples = []
    bank_samples = []
    count = 196
    for index in range(count):
        z = -168.0 + (-1435.0 + 168.0) * index / (count - 1)
        progress = clamp((RIDGE_FAR_Z - z) / (RIDGE_FAR_Z - VALLEY_FAR_Z), 0.0, 1.0)
        lake = math.exp(-((z + 890.0) / 172.0) ** 2)
        width = 5.4 + progress * 6.8 + lake * 72.0 + math.sin(z * 0.031) * 0.85
        center = river_center(z)
        height = watershed_height(z)
        water_samples.append((center, z, height, width))
        bank_samples.append((center, z, height - 0.28, width + 6.5 + lake * 3.5))
    banks = build_ribbon(f"RIDGE_{VERSION_CODE}_WET_RIVER_BANKS", bank_samples, target, bank_material, 4)
    water = build_ribbon(
        f"RIDGE_{VERSION_CODE}_CONTINUOUS_RIVER_AND_LAKE",
        water_samples,
        target,
        water_material,
        20 if MODERN_WORLD else 6,
    )
    return water, banks


def build_waterfall(target: bpy.types.Collection, water_material: bpy.types.Material) -> list[bpy.types.Object]:
    x = 170.0 if IS_V115 else 116.0 if MODERN_WORLD else 245.0
    z = -730.0 if IS_V115 else -692.0 if MODERN_WORLD else -1105.0
    top = world_height(x, z) + 0.7 if IS_V115 else 92.0 if MODERN_WORLD else 108.0
    bottom = watershed_height(z) + 0.45
    vertices = []
    faces = []
    uvs = []
    segments = 28
    for index in range(segments):
        amount = index / (segments - 1)
        y = top * (1.0 - amount) + bottom * amount
        fall_x = x - amount * (18.0 if IS_V115 else 0.0) + math.sin(amount * 10.0) * 3.2
        fall_z = z + amount * 7.0
        width = (6.0 + amount * 4.2) if IS_V115 else (1.35 + amount * 1.15) if MODERN_WORLD else (3.0 + amount * 3.0)
        vertices.extend(((fall_x - width, -fall_z, y), (fall_x + width, -fall_z, y)))
        uvs.extend(((0.0, amount), (1.0, amount)))
        if index:
            a = (index - 1) * 2
            faces.extend(((a, a + 1, a + 3), (a, a + 3, a + 2)))
    mesh = bpy.data.meshes.new(f"RIDGE_{VERSION_CODE}_CONNECTED_WATERFALL")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for loop in mesh.loops:
        uv_layer.data[loop.index].uv = uvs[loop.vertex_index]
    result = bpy.data.objects.new(f"RIDGE_{VERSION_CODE}_CONNECTED_WATERFALL", mesh)
    target.objects.link(result)
    result.data.materials.append(water_material)
    source_samples = []
    for index in range(32):
        amount = index / 31.0
        source_start_z = z - (54.0 if IS_V115 else 92.0 if MODERN_WORLD else 47.0)
        source_start_x = x + (88.0 if IS_V115 else 142.0 if MODERN_WORLD else 87.0)
        sample_z = source_start_z + (z - source_start_z) * amount
        sample_x = source_start_x + (x - source_start_x) * amount + math.sin(amount * math.pi * 2.0) * 3.0
        sample_y = world_height(sample_x, sample_z) + 0.42 if IS_V115 else top + 1.4 + (1.0 - amount) * 2.0
        source_samples.append((sample_x, sample_z, sample_y, 1.15 + amount * 0.7))
    source = build_ribbon(f"RIDGE_{VERSION_CODE}_WATERFALL_SOURCE", source_samples, target, water_material, 2)
    if not IS_V115:
        return [result, source]
    outflow_samples = []
    outflow_start_x = x - 18.0
    outflow_start_z = z + 7.0
    outflow_end_z = z + 52.0
    outflow_end_x = river_center(outflow_end_z)
    for index in range(28):
        amount = index / 27.0
        sample_z = outflow_start_z + (outflow_end_z - outflow_start_z) * amount
        sample_x = outflow_start_x + (outflow_end_x - outflow_start_x) * amount + math.sin(amount * math.pi) * 4.0
        sample_y = world_height(sample_x, sample_z) + 0.38
        outflow_samples.append((sample_x, sample_z, sample_y, 1.7 + amount * 1.4))
    outflow = build_ribbon(f"RIDGE_{VERSION_CODE}_WATERFALL_OUTFLOW", outflow_samples, target, water_material, 3)
    return [result, source, outflow]


def distance_to_camera_path(x: float, z: float) -> float:
    return min(math.hypot(x - position[0], z - position[2]) for _, position, _, _ in CAMERA_KEYS)


def community_for(x: float, z: float, metrics: dict[str, float]) -> str:
    if z < -780.0 or metrics["height"] > 125.0:
        return "high-elevation-transition"
    if abs(x - river_center(z)) < 34.0:
        return "water-edge-vegetation"
    if metrics["slope"] > 1.6:
        return "rock-exposure"
    if metrics["drainage"] > 0.36:
        return "drainage-gully"
    if z < RIDGE_FAR_Z:
        return "lower-valley-rainforest"
    if metrics["exposure"] > 0.56 or metrics["height"] > 66.0:
        return "wind-exposed-crest"
    return "sheltered-humid-slope"


COMMUNITY_SOURCES = ({
    "sheltered-humid-slope": (0, 4, 8, 1, 10, 5, 16),
    "wind-exposed-crest": (2, 6, 12, 3, 13, 15),
    "drainage-gully": (4, 8, 10, 0, 11, 14),
    "lower-valley-rainforest": (8, 10, 16, 4, 12, 6, 17),
    "rock-exposure": (2, 12, 15, 3),
    "high-elevation-transition": (6, 13, 14, 15),
    "water-edge-vegetation": (0, 8, 10, 4, 16),
} if IS_V115 else {
    "sheltered-humid-slope": (0, 4, 5, 2, 0, 1),
    "wind-exposed-crest": (3, 6, 7, 3, 1),
    "drainage-gully": (2, 4, 0, 5, 2),
    "lower-valley-rainforest": (4, 2, 5, 0, 7, 1),
    "rock-exposure": (3, 6, 1),
    "high-elevation-transition": (6, 7, 3),
    "water-edge-vegetation": (2, 4, 5, 0),
})

NEAR_SOURCES = ({
    "sheltered-humid-slope": ("island_01", "pachira_d", "island_02", "pachira_c"),
    "wind-exposed-crest": ("island_03", "small_02", "pachira_b"),
    "drainage-gully": ("island_01", "pachira_a", "island_02", "pachira_c"),
    "lower-valley-rainforest": ("island_01", "island_02", "pachira_d", "island_03"),
    "rock-exposure": ("island_03", "pachira_b", "small_02"),
    "high-elevation-transition": ("island_03", "small_02", "pachira_b"),
    "water-edge-vegetation": ("island_01", "pachira_a", "small_02", "island_02"),
} if IS_V115 else {
    "sheltered-humid-slope": ("island01_sheltered", "pachira_emergent", "island02_multitrunk"),
    "wind-exposed-crest": ("island02_wind", "island03_crest", "island03_low"),
    "drainage-gully": ("island01_spreader", "pachira_broad", "island02_multitrunk"),
    "lower-valley-rainforest": ("island01_sheltered", "pachira_broad", "island02_multitrunk"),
    "rock-exposure": ("island03_low", "island02_wind"),
    "high-elevation-transition": ("island03_crest", "small02_upright"),
    "water-edge-vegetation": ("island01_spreader", "pachira_broad", "small02_upright"),
})

VEGETATION_PROFILE_PATH = PUBLIC_ROOT / "madagin-ridge-vegetation-profiles-v1.15.json"


def load_vegetation_profiles() -> dict:
    if not IS_V115:
        return {"rootProfiles": {}, "variants": []}
    if not VEGETATION_PROFILE_PATH.exists():
        raise FileNotFoundError(f"Build the v1.15 vegetation library first: {VEGETATION_PROFILE_PATH}")
    return json.loads(VEGETATION_PROFILE_PATH.read_text(encoding="utf-8"))


def family_for_source(source: str, profiles: dict) -> str:
    if source.startswith("variant_"):
        variant_index = int(source.rsplit("_", 1)[1])
        return profiles["variants"][variant_index]["family"]
    return source


def transform_root_point(
    point: tuple[float, float, float] | list[float],
    scale: tuple[float, float, float] | list[float],
    lean: tuple[float, float] | list[float],
    rotation: float,
) -> tuple[float, float, float]:
    """Match Three.js Object3D's default XYZ Euler transform for a root vertex."""
    px, py, pz = (point[index] * scale[index] for index in range(3))
    x_angle, z_angle = lean
    a, b = math.cos(x_angle), math.sin(x_angle)
    c, d = math.cos(rotation), math.sin(rotation)
    e, f = math.cos(z_angle), math.sin(z_angle)
    return (
        c * e * px - c * f * py + d * pz,
        (a * f + b * e * d) * px + (a * e - b * f * d) * py - b * c * pz,
        (b * f - a * e * d) * px + (b * e + a * f * d) * py + a * c * pz,
    )


def geometry_grounding(
    source: str,
    x: float,
    z: float,
    rotation: float,
    scale: tuple[float, float, float] | list[float],
    profiles: dict,
    lean: tuple[float, float] | list[float] = (0.0, 0.0),
) -> dict:
    family = family_for_source(source, profiles)
    profile = profiles.get("rootProfiles", {}).get(family, {"localPoint": [0.0, 0.0, 0.0], "footprintRadius": 0.25, "contactPoints": [[0.0, 0.0, 0.0]]})
    local_x, local_y, local_z = profile["localPoint"]
    local_contacts = profile.get("contactPoints") or [[local_x, local_y, local_z]]
    transformed = [transform_root_point(point, scale, lean, rotation) for point in local_contacts]
    required_origins = [world_height(x + point[0], z + point[2]) - point[1] for point in transformed]
    low_origin = min(required_origins)
    high_origin = max(required_origins)
    origin_y = (low_origin + high_origin) * 0.5 - 0.045
    samples = []
    for local_point, transformed_point, required_origin in zip(local_contacts, transformed, required_origins):
        world_x = x + transformed_point[0]
        world_z = z + transformed_point[2]
        terrain_y = world_height(world_x, world_z)
        world_y = origin_y + transformed_point[1]
        samples.append({
            "local": [round(value, 4) for value in local_point],
            "world": [round(world_x, 3), round(world_y, 3), round(world_z, 3)],
            "terrainY": round(terrain_y, 3),
            "error": round(world_y - terrain_y, 4),
        })
    errors = [sample["error"] for sample in samples]
    max_gap = max(0.0, max(errors, default=0.0))
    max_burial = max(0.0, -min(errors, default=0.0))
    root_delta = transform_root_point([local_x, local_y, local_z], scale, lean, rotation)
    world_x = x + root_delta[0]
    world_y = origin_y + root_delta[1]
    world_z = z + root_delta[2]
    ground_y = world_height(world_x, world_z)
    radius = profile.get("footprintRadius", 0.25) * max(scale[0], scale[2])
    return {
        "y": round(origin_y, 3),
        "groundY": round(ground_y, 3),
        "rootLocal": [round(local_x, 4), round(local_y, 4), round(local_z, 4)],
        "rootWorld": [round(world_x, 3), round(world_y, 3), round(world_z, 3)],
        "rootFootprintRadius": round(radius, 3),
        "rootContactSamples": samples,
        "footprintRelief": round(high_origin - low_origin, 4),
        "maxRootGap": round(max_gap, 4),
        "maxRootBurial": round(max_burial, 4),
        "rootError": round(max(max_gap, max_burial), 4),
    }


def create_ecology_manifest() -> dict:
    rng = random.Random(SEED)
    profiles = load_vegetation_profiles()
    clusters = []
    near = []
    understory = []
    index = 0
    regions = (
        ("ridge", RIDGE_NEAR_Z - 6.0, RIDGE_FAR_Z + 6.0, RIDGE_WIDTH - 18.0, 10.4 if IS_V115 else 14.4),
        ("middle-valley", RIDGE_FAR_Z - 8.0, -735.0, 1160.0, 11.2 if IS_V115 else 14.8 if IS_V114 else 21.5),
        ("far-emergents", -735.0, TROPICAL_FAR_Z + 30.0, 1360.0, 26.0 if IS_V115 else 32.0 if IS_V114 else 48.0),
    )
    for region, z_near, z_far, width, spacing in regions:
        z = z_near
        while z >= z_far:
            x = -width * 0.5
            while x <= width * 0.5:
                px = x + rng.uniform(-spacing * 0.44, spacing * 0.44)
                pz = z + rng.uniform(-spacing * 0.44, spacing * 0.44)
                metrics = surface_metrics(px, pz)
                community = community_for(px, pz, metrics)
                patch = value_noise(px * 0.017 + 16.0, pz * 0.017 - 9.0)
                retention = 0.34 if region == "far-emergents" else 0.92 - metrics["exposure"] * 0.12
                if community == "rock-exposure":
                    retention *= 0.34
                if rng.random() < retention and metrics["slope"] < 2.75:
                    options = COMMUNITY_SOURCES[community]
                    if IS_V115 and region == "far-emergents":
                        options = tuple(option for option in options if option < 8)
                    key = options[(index + int(patch * 9.0)) % len(options)]
                    base_scale = (0.9 + rng.random() * 0.44) * PROFILE["canopy"] * (1.3 if IS_V115 and region == "far-emergents" else 1.22 if IS_V115 else 1.0)
                    cell_x = math.floor((px + ALPINE_WIDTH * 0.5) / CELL_SIZE)
                    cell_z = math.floor((pz - VALLEY_FAR_Z) / CELL_SIZE)
                    rotation = round(rng.random() * math.tau, 5)
                    scale = [round(base_scale * (0.92 + rng.random() * 0.16), 3), round(base_scale * (0.88 + rng.random() * 0.24), 3), round(base_scale * (0.92 + rng.random() * 0.16), 3)]
                    source = f"variant_{key:02d}" if IS_V115 else f"cluster_{key:02d}"
                    lean = [round(rng.uniform(-0.035, 0.035) * min(1.0, metrics["slope"]), 4), round(rng.uniform(-0.035, 0.035) * min(1.0, metrics["slope"]), 4)]
                    grounding = geometry_grounding(source, px, pz, rotation, scale, profiles, lean) if IS_V115 else {"groundY": round(metrics["height"], 3), "rootOffset": -0.38 if IS_V114 else -1.1, "rootError": 0.0, "y": round(metrics["height"] + (-0.38 if IS_V114 else -1.1), 3)}
                    if IS_V115 and grounding["rootError"] > (0.72 if region == "ridge" else 1.2):
                        x += spacing
                        continue
                    clusters.append({"id": index, "source": source, "community": community, "region": region, "cell": f"{cell_x}:{cell_z}", "x": round(px, 3), **grounding, "slope": round(metrics["slope"], 4), "lean": lean, "z": round(pz, 3), "rotation": rotation, "scale": scale, "hue": round(rng.uniform(-0.125, 0.105) + metrics["moisture"] * 0.04, 4), "occlusion": round(0.68 + rng.random() * 0.24, 3)})
                    index += 1
                x += spacing
            z -= spacing
    if IS_V115:
        clusters = [
            placement
            for placement in clusters
            if all(
                math.hypot(placement["x"] - camera_position[0], placement["z"] - camera_position[2]) > (30.0 if camera_name == "clearing" else 42.0)
                for camera_name, camera_position, _, _ in CAMERA_KEYS
            )
        ]
        candidates = []
        seen_candidates = set()
        for _, camera_position, _, _ in CAMERA_KEYS:
            chapter = sorted(
                (
                    placement for placement in clusters
                    if placement["z"] > -1000.0
                    and 34.0 < math.hypot(placement["x"] - camera_position[0], placement["z"] - camera_position[2]) < 190.0
                ),
                key=lambda placement: (math.hypot(placement["x"] - camera_position[0], placement["z"] - camera_position[2]), placement["id"]),
            )
            for placement in chapter[:24]:
                if placement["id"] not in seen_candidates:
                    candidates.append(placement)
                    seen_candidates.add(placement["id"])
        near_limit = 168
    else:
        candidates = [placement for placement in clusters if placement["z"] > -315.0 and distance_to_camera_path(placement["x"], placement["z"]) < (210.0 if IS_V114 else 150.0)]
        candidates.sort(key=lambda placement: (distance_to_camera_path(placement["x"], placement["z"]), placement["id"]))
        near_limit = 128 if IS_V114 else 92
    for placement in candidates:
        if len(near) >= near_limit:
            break
        near_index = len(near)
        options = NEAR_SOURCES[placement["community"]]
        near_x = placement["x"] + rng.uniform(-3.0, 3.0)
        near_z = placement["z"] + rng.uniform(-3.0, 3.0)
        near_scale = [round(value * (0.7 + rng.random() * 0.22), 3) for value in placement["scale"]]
        source = options[(near_index + placement["id"]) % len(options)]
        grounding = None
        if IS_V115:
            for offset in range(len(options)):
                candidate_source = options[(near_index + placement["id"] + offset) % len(options)]
                candidate_grounding = geometry_grounding(candidate_source, near_x, near_z, placement["rotation"], near_scale, profiles, placement["lean"])
                if candidate_grounding["maxRootGap"] <= 0.24 and candidate_grounding["maxRootBurial"] <= 0.34:
                    source = candidate_source
                    grounding = candidate_grounding
                    break
            if grounding is None:
                continue
        else:
            grounding = {"groundY": round(world_height(near_x, near_z), 3), "rootOffset": -0.18 if IS_V114 else -0.55, "rootError": 0.0, "y": round(world_height(near_x, near_z) + (-0.18 if IS_V114 else -0.55), 3)}
        near.append({**placement, "id": near_index, "clusterId": placement["id"], "source": source, "x": round(near_x, 3), **grounding, "z": round(near_z, 3), "scale": near_scale})
    if IS_V115:
        for placement in near:
            for layer in range(8):
                seed = placement["id"] * 17 + layer
                radius = 2.0 + (seed % 9) * 1.15
                angle = (seed * 2.399963) % math.tau
                x = placement["rootWorld"][0] + math.cos(angle) * radius
                z = placement["rootWorld"][2] + math.sin(angle) * radius
                source = ("fern", "fern", "shrub", "moss")[(seed + layer) % 4]
                understory.append({
                    "id": len(understory), "source": source, "community": placement["community"],
                    "x": round(x, 3), "y": round(world_height(x, z) - (0.05 if source == "moss" else 0.02), 3), "z": round(z, 3),
                    "rotation": round(angle + rng.uniform(-0.7, 0.7), 5),
                    "scale": [round(0.7 + rng.random() * 0.65, 3), round(0.68 + rng.random() * 0.82, 3), round(0.7 + rng.random() * 0.65, 3)],
                })
    source_counts: dict[str, int] = {}
    community_counts: dict[str, int] = {}
    region_counts: dict[str, int] = {}
    for placement in clusters:
        source_counts[placement["source"]] = source_counts.get(placement["source"], 0) + 1
        community_counts[placement["community"]] = community_counts.get(placement["community"], 0) + 1
        region_counts[placement["region"]] = region_counts.get(placement["region"], 0) + 1
    near_counts: dict[str, int] = {}
    for placement in near:
        near_counts[placement["source"]] = near_counts.get(placement["source"], 0) + 1
    return {
        "version": f"{SEMANTIC_VERSION}-ridge-to-valley-ecology", "seed": SEED,
        "terrain": {"nearSource": "USGS 3DEP n23w160 public-domain DEM crop plus bounded authored Ridge threshold", "valleySource": "asymmetric authored tropical watershed blended continuously from the DEM edge", "alpineSource": "authored bounded peak field and erosion structure; no satellite imagery", "bounds": {"ridge": [RIDGE_WIDTH, RIDGE_NEAR_Z, RIDGE_FAR_Z], "tropical": [TROPICAL_WIDTH, RIDGE_FAR_Z, TROPICAL_FAR_Z], "alpine": [ALPINE_WIDTH, TROPICAL_FAR_Z, VALLEY_FAR_Z]}},
        "cellSize": CELL_SIZE,
        "camera": [{"name": name, "position": position, "lookAt": look_at, "lensMm": lens} for name, position, look_at, lens in CAMERA_KEYS],
        "coverage": {"clusterCount": len(clusters), "nearEnhancementCount": len(near), "understoryCount": len(understory), "sourceCounts": source_counts, "nearSourceCounts": near_counts, "communityCounts": community_counts, "regionCounts": region_counts, "grounding": {"sampleCount": len(near) if IS_V115 else len(clusters) + len(near), "clusterSampleCount": len(clusters) if IS_V115 else 0, "floatingCount": sum(1 for placement in near if placement.get("maxRootGap", 0.0) > 0.24) if IS_V115 else 0, "buriedCount": sum(1 for placement in near if placement.get("maxRootBurial", 0.0) > 0.34) if IS_V115 else 0, "maxRootError": max((placement.get("rootError", 0.0) for placement in near), default=0.0), "maxRootGap": max((placement.get("maxRootGap", 0.0) for placement in near), default=0.0), "maxRootBurial": max((placement.get("maxRootBurial", 0.0) for placement in near), default=0.0), "maxFootprintRelief": max((placement.get("footprintRelief", 0.0) for placement in near), default=0.0), "terrainSampledAfterJitter": True, "geometryRootProfilesApplied": IS_V115, "transformedRootVerticesMeasured": IS_V115}, "farForestRepresentation": "terrain-following matched low-poly vegetation variants with sparse emergents; canopy shell remains a conservative fallback", "note": "Reusable transforms are representation counts, not individual-tree claims."},
        "communities": {"sheltered-humid-slope": {"density": "closed", "height": "tall", "understory": "dense"}, "wind-exposed-crest": {"density": "closed below crest", "height": "short shaped", "understory": "moderate"}, "drainage-gully": {"density": "closed", "height": "varied", "understory": "very dense"}, "lower-valley-rainforest": {"density": "closed", "height": "tall", "understory": "dense"}, "rock-exposure": {"density": "broken", "height": "low", "understory": "moss and fern"}, "high-elevation-transition": {"density": "tapering", "height": "low", "understory": "sparse"}, "water-edge-vegetation": {"density": "closed", "height": "mixed", "understory": "lush"}},
        "water": {"river": "single connected downhill 196-sample ribbon", "lakeCenterZ": -890, "waterfall": {"x": 170 if IS_V115 else 116 if MODERN_WORLD else 245, "z": -730 if IS_V115 else -692 if MODERN_WORLD else -1105, "source": "terrain-sampled high shelf tributary", "destination": "terrain-sampled outflow to the lower-valley river corridor", "persistentWorldFeature": IS_V115, "selectableChapter": True if MODERN_WORLD else False}},
        "clusters": clusters, "near": near, "understory": understory,
    }


def simple_scene_materials() -> dict[str, bpy.types.Material]:
    label = VERSION_SLUG
    return {"ridge": material(f"{label} wet ridge soil moss basalt", (0.035, 0.075, 0.032, 1.0), 0.92), "tropical": material(f"{label} tropical valley substrate", (0.027, 0.066, 0.031, 1.0), 0.94), "alpine": material(f"{label} alpine rock talus", (0.15, 0.14, 0.125, 1.0), 0.82), "canopy": material(f"{label} fallback closed canopy", (0.025, 0.105, 0.038, 1.0), 0.88), "bank": material(f"{label} saturated river bank", (0.025, 0.033, 0.026, 1.0), 0.98), "water": material(f"{label} continuous watershed", (0.005, 0.04, 0.052, 1.0), 0.2, 0.03)}


def append_canopy_sources() -> dict[str, bpy.types.Object]:
    with bpy.data.libraries.load(str(CANOPY_BLEND), link=False) as (available, selected):
        selected.objects = [name for name in available.objects if name.startswith("cluster_")]
    result = {}
    for obj in selected.objects:
        if obj is None:
            continue
        bpy.context.scene.collection.objects.link(obj)
        obj.hide_render = True
        obj.hide_viewport = True
        result[obj.name] = obj
    return result


def populate_lookdev(manifest: dict, sources: dict[str, bpy.types.Object], target: bpy.types.Collection) -> None:
    for placement in manifest["clusters"]:
        source = sources.get(placement["source"])
        if source is None:
            continue
        copy = source.copy()
        copy.data = source.data
        target.objects.link(copy)
        copy.hide_render = False
        copy.hide_viewport = False
        copy.location = (placement["x"], -placement["z"], placement["y"])
        copy.rotation_euler[2] = placement["rotation"]
        copy.scale = placement["scale"]


def look_at(camera: bpy.types.Object, runtime_target: tuple[float, float, float]) -> None:
    target = Vector((runtime_target[0], -runtime_target[2], runtime_target[1]))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()


def configure_scene() -> bpy.types.Object:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0.55
    scene.world.color = (0.025, 0.07, 0.11)
    bpy.ops.object.light_add(type="SUN", location=(-220.0, -130.0, 260.0))
    sun = bpy.context.object
    sun.name = f"{VERSION_CODE} directional golden-hour sun"
    sun.data.energy = PROFILE["sun"]
    sun.data.color = (1.0, 0.58, 0.31)
    sun.data.angle = math.radians(4.2)
    sun.rotation_euler = (math.radians(58.0), math.radians(-18.0), math.radians(-128.0))
    bpy.ops.object.light_add(type="AREA", location=(10.0, -30.0, 260.0))
    fill = bpy.context.object
    fill.data.energy = 620.0
    fill.data.color = (0.19, 0.32, 0.46)
    fill.data.size = 260.0
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.name = f"CAM_RIDGE_TO_VALLEY_{VERSION_CODE}"
    camera.data.sensor_width = 36.0
    camera.data.clip_start = 0.25
    camera.data.clip_end = 2400.0
    scene.camera = camera
    return camera


def export_world(objects: list[bpy.types.Object], filename: str) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_viewport = False
        obj.hide_render = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(filepath=str(PUBLIC_ROOT / filename), export_format="GLB", use_selection=True, export_apply=True, export_attributes=True, export_cameras=False, export_lights=False, export_materials="EXPORT", export_meshopt_compression_enable=True, export_meshopt_extension="EXT_meshopt_compression", export_texcoords=True, export_normals=True, export_tangents=False, export_yup=True)
    for obj in objects:
        obj.select_set(False)
        obj.hide_viewport = True
        obj.hide_render = True
    print(f"GLB={filename} BYTES={(PUBLIC_ROOT / filename).stat().st_size}")


def render_review(camera: bpy.types.Object) -> None:
    scene = bpy.context.scene
    for name, runtime_position, runtime_look, lens in CAMERA_KEYS:
        camera.location = (runtime_position[0], -runtime_position[2], runtime_position[1])
        camera.data.lens = lens
        look_at(camera, runtime_look)
        output = ARTIFACT_ROOT / f"blender-iteration-{ITERATION:02d}-{name}.png"
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)


def main() -> None:
    PUBLIC_ROOT.mkdir(parents=True, exist_ok=True)
    ARTIFACT_ROOT.mkdir(parents=True, exist_ok=True)
    reset_scene()
    terrain_collection = new_collection(f"RIDGE_TO_VALLEY_{VERSION_CODE}_TERRAIN")
    lookdev_collection = new_collection(f"RIDGE_TO_VALLEY_{VERSION_CODE}_LOOKDEV")
    materials = simple_scene_materials()
    levels = {"critical": ((101, 95), (111, 71), (115, 67), (109, 69)), "balanced": ((153, 143), (159, 103), (165, 97), (153, 99)), "high": ((193, 179), (205, 131), (213, 125), (197, 127))}
    terrain_levels: dict[str, list[bpy.types.Object]] = {}
    for level, ((ridge_columns, ridge_rows), (tropical_columns, tropical_rows), (alpine_columns, alpine_rows), (shell_columns, shell_rows)) in levels.items():
        ridge = build_heightfield(f"RIDGE_{VERSION_CODE}_{level.upper()}", ridge_columns, ridge_rows, -RIDGE_WIDTH * 0.5, RIDGE_WIDTH * 0.5, RIDGE_NEAR_Z, RIDGE_FAR_Z, ridge_height, terrain_collection, materials["ridge"])
        tropical = build_heightfield(f"TROPICAL_VALLEY_{VERSION_CODE}_{level.upper()}", tropical_columns, tropical_rows, -TROPICAL_WIDTH * 0.5, TROPICAL_WIDTH * 0.5, RIDGE_FAR_Z, TROPICAL_FAR_Z, tropical_height, terrain_collection, materials["tropical"])
        alpine = build_heightfield(f"ALPINE_VALLEY_{VERSION_CODE}_{level.upper()}", alpine_columns, alpine_rows, -ALPINE_WIDTH * 0.5, ALPINE_WIDTH * 0.5, TROPICAL_FAR_Z, VALLEY_FAR_Z, alpine_height, terrain_collection, materials["alpine"])
        shell = build_heightfield(f"FALLBACK_CANOPY_SHELL_{VERSION_CODE}_{level.upper()}", shell_columns, shell_rows, -TROPICAL_WIDTH * 0.5, TROPICAL_WIDTH * 0.5, RIDGE_FAR_Z - 22.0, TROPICAL_FAR_Z + 18.0, tropical_height, terrain_collection, materials["canopy"], canopy_offset)
        terrain_levels[level] = [ridge, tropical, alpine, shell]
        for obj in terrain_levels[level]:
            obj.hide_render = level != "high"
            obj.hide_viewport = level != "high"
    water, banks = build_water(terrain_collection, materials["water"], materials["bank"])
    waterfall = build_waterfall(terrain_collection, materials["water"])
    manifest = create_ecology_manifest()
    MANIFEST_PATH.write_text(json.dumps(manifest, separators=(",", ":")) + "\n", encoding="utf-8")
    if cli_render_review():
        sources = append_canopy_sources()
        populate_lookdev(manifest, sources, lookdev_collection)
    camera = configure_scene()
    shared = [banks, water] + waterfall
    for level, objects in terrain_levels.items():
        export_world(objects + shared, f"madagin-ridge-to-valley-{level}-{SEMANTIC_VERSION}.glb")
    for obj in terrain_levels["high"] + shared:
        obj.hide_render = False
        obj.hide_viewport = False
    if cli_render_review():
        render_review(camera)
    bpy.context.scene["madagin_version"] = f"{SEMANTIC_VERSION}-ridge-to-valley"
    bpy.context.scene["near_terrain_source"] = "USGS 3DEP n23w160 public-domain DEM crop; no imagery"
    bpy.context.scene["valley_source"] = "bounded authored asymmetric tropical-to-alpine watershed"
    bpy.context.scene["iteration"] = ITERATION
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    report = {"version": SEMANTIC_VERSION, "iteration": ITERATION, "source": {"near": str(HEIGHTMAP.relative_to(ROOT)), "valley": "authored procedural heightfields", "imagery": "none"}, "geometry": {"ridgeBounds": [RIDGE_WIDTH, RIDGE_NEAR_Z, RIDGE_FAR_Z], "tropicalBounds": [TROPICAL_WIDTH, RIDGE_FAR_Z, TROPICAL_FAR_Z], "alpineBounds": [ALPINE_WIDTH, TROPICAL_FAR_Z, VALLEY_FAR_Z]}, "ecology": manifest["coverage"], "water": manifest["water"], "outputs": {path.name: path.stat().st_size for path in sorted(PUBLIC_ROOT.glob("*")) if path.is_file()}}
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    print(f"BLEND={BLEND_PATH}")


if __name__ == "__main__":
    main()
