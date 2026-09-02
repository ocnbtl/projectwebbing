"""Build the elevation-derived Madagin Ridge v1.11 R&D benchmark.

The macro-topology comes from a documented public-domain USGS 3DEP crop.
Madagin's scale, camera corridor, canopy habitat, river hint, materials, and
composition remain original. The script produces one source Blend, three
silhouette-consistent terrain LODs, deterministic spatial forest cells, and
four look-development renders for visual rejection/iteration.
"""

from __future__ import annotations

import json
import math
import random
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
PUBLIC_ROOT = ROOT / "public" / "world" / "v111"
SOURCE_ROOT = ROOT / "world-source"
ARTIFACT_ROOT = ROOT / "artifacts" / "ridge-v111"
HEIGHTMAP = SOURCE_ROOT / "dem" / "usgs-3dep-n23w160" / "madagin-ridge-dem-source-v1.11.png"
FOREST_BLEND = SOURCE_ROOT / "madagin-ridge-forest-kit-v1.11.blend"
BLEND_PATH = SOURCE_ROOT / "madagin-ridge-realism-benchmark-v1.11.blend"
PLACEMENT_PATH = PUBLIC_ROOT / "madagin-ridge-forest-cells-v1.11.json"

FOREST_DIR = ROOT / "public" / "world" / "assets" / "polyhaven" / "forrest_ground_03"
ROCK_DIR = ROOT / "public" / "world" / "assets" / "polyhaven" / "aerial_grass_rock"

WIDTH = 520.0
NEAR_Z = 220.0
FAR_Z = -260.0
ELEVATION_SCALE = 0.028
ELEVATION_BASE = 520.0
CELL_SIZE = 65.0
SEED = 111_190_819

CAMERA_KEYS = (
    ("opening", (150.0, 90.0, 220.0), (104.0, 10.0, -105.0), 42.0),
    ("approach", (135.0, 88.0, 135.0), (90.0, 2.0, -245.0), 44.0),
    ("crest", (120.0, 100.0, 55.0), (72.0, -15.0, -405.0), 46.0),
    ("reveal", (105.0, 110.0, -10.0), (55.0, -30.0, -610.0), 48.0),
)


def cli_iteration() -> int:
    for argument in sys.argv:
        if argument.startswith("--iteration="):
            return max(1, int(argument.split("=", 1)[1]))
    return 1


ITERATION = cli_iteration()


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


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in tuple(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)


def collection(name: str) -> bpy.types.Collection:
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


def dem_sample(x: float, z: float) -> float:
    # Runtime +Z is the opening side; source-image +Y is the selected crop's
    # southern side. A slight diagonal shear places a real drainage beside the
    # authored flight corridor rather than aiming directly into a summit.
    u = 0.5 + x / WIDTH * 0.9 + z / (NEAR_Z - FAR_Z) * 0.035
    v = 0.5 + (z - (NEAR_Z + FAR_Z) * 0.5) / (NEAR_Z - FAR_Z) * 0.9
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


def terrain_height(x: float, z: float) -> float:
    elevation = dem_sample(x, z)
    base = (elevation - ELEVATION_BASE) * ELEVATION_SCALE
    macro = (value_noise(x * 0.018 + 9.0, z * 0.018 - 4.0) - 0.5) * 1.35
    meso = (value_noise(x * 0.071 - 2.0, z * 0.071 + 6.0) - 0.5) * 0.28
    # Original art direction: deepen the revealed drainage without replacing
    # the DEM's ridge and saddle topology.
    river_center = 72.0 + math.sin((z + 80.0) * 0.018) * 21.0
    drainage = math.exp(-((x - river_center) / 31.0) ** 2) * smoothstep(-230.0, 25.0, -z) * 8.8
    return base + macro + meso - drainage


def terrain_metrics(x: float, z: float) -> tuple[float, float, float, float]:
    sample = 2.0
    center = terrain_height(x, z)
    dx = (terrain_height(x + sample, z) - terrain_height(x - sample, z)) / (sample * 2.0)
    dz = (terrain_height(x, z + sample) - terrain_height(x, z - sample)) / (sample * 2.0)
    slope = math.hypot(dx, dz)
    laplacian = (
        terrain_height(x + sample, z)
        + terrain_height(x - sample, z)
        + terrain_height(x, z + sample)
        + terrain_height(x, z - sample)
        - center * 4.0
    ) / (sample * sample)
    rock = clamp(smoothstep(0.44, 1.12, slope) * 0.92 + smoothstep(22.0, 31.0, center) * 0.2, 0.0, 1.0)
    moisture = clamp(smoothstep(-0.04, 0.28, -laplacian) * 0.48 + (1.0 - smoothstep(-8.0, 17.0, center)) * 0.46, 0.0, 1.0)
    habitat = clamp((1.0 - rock * 0.82) * (1.0 - smoothstep(18.0, 31.0, center)), 0.0, 1.0)
    return center, slope, rock, max(moisture, habitat * 0.16)


def terrain_material() -> bpy.types.Material:
    material = bpy.data.materials.new("Madagin v1.11 forest soil moss basalt")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    attribute = nodes.new("ShaderNodeVertexColor")
    attribute.layer_name = "terrain_masks"
    separate = nodes.new("ShaderNodeSeparateColor")
    forest = nodes.new("ShaderNodeTexImage")
    forest.image = bpy.data.images.load(str(FOREST_DIR / "forrest_ground_03_diff_1k.jpg"), check_existing=True)
    forest.image.colorspace_settings.name = "sRGB"
    rock = nodes.new("ShaderNodeTexImage")
    rock.image = bpy.data.images.load(str(ROCK_DIR / "aerial_grass_rock_diff_1k.jpg"), check_existing=True)
    rock.image.colorspace_settings.name = "sRGB"
    texture_coord = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (8.0, 8.0, 8.0)
    forest_tint = nodes.new("ShaderNodeMixRGB")
    forest_tint.blend_type = "MIX"
    forest_tint.inputs["Fac"].default_value = 0.58
    forest_tint.inputs[2].default_value = (0.035, 0.16, 0.04, 1.0)
    rock_tint = nodes.new("ShaderNodeMixRGB")
    rock_tint.blend_type = "MIX"
    rock_tint.inputs["Fac"].default_value = 0.3
    rock_tint.inputs[2].default_value = (0.18, 0.16, 0.11, 1.0)
    mix = nodes.new("ShaderNodeMixRGB")
    mix.blend_type = "MIX"
    mix.inputs["Color1"].default_value = (0.035, 0.052, 0.032, 1.0)
    shader.inputs["Roughness"].default_value = 0.92
    shader.inputs["Metallic"].default_value = 0.0
    links.new(texture_coord.outputs["UV"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], forest.inputs["Vector"])
    links.new(mapping.outputs["Vector"], rock.inputs["Vector"])
    links.new(forest.outputs["Color"], forest_tint.inputs[1])
    links.new(rock.outputs["Color"], rock_tint.inputs[1])
    links.new(attribute.outputs["Color"], separate.inputs["Color"])
    links.new(separate.outputs["Red"], mix.inputs["Fac"])
    links.new(forest_tint.outputs["Color"], mix.inputs[1])
    links.new(rock_tint.outputs["Color"], mix.inputs[2])
    links.new(mix.outputs["Color"], shader.inputs["Base Color"])
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return material


def build_terrain(name: str, columns: int, rows: int, target: bpy.types.Collection, material: bpy.types.Material) -> bpy.types.Object:
    x_min, x_max = -WIDTH * 0.5, WIDTH * 0.5
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    uvs: list[tuple[float, float]] = []
    masks: list[tuple[float, float, float, float]] = []
    for row in range(rows):
        z = NEAR_Z + (FAR_Z - NEAR_Z) * row / (rows - 1)
        for column_index in range(columns):
            x = x_min + (x_max - x_min) * column_index / (columns - 1)
            height, slope, rock, moisture = terrain_metrics(x, z)
            vertices.append((x, -z, height))
            uvs.append((x * 0.028, z * 0.028))
            habitat = clamp((1.0 - rock) * (1.0 - smoothstep(18.0, 31.0, height)), 0.0, 1.0)
            masks.append((rock, moisture, habitat, 1.0))
    for row in range(rows - 1):
        for column_index in range(columns - 1):
            a = row * columns + column_index
            b = a + 1
            c = a + columns + 1
            d = a + columns
            faces.append((a, d, c, b))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for loop in mesh.loops:
        uv_layer.data[loop.index].uv = uvs[loop.vertex_index]
    colors = mesh.color_attributes.new(name="terrain_masks", type="FLOAT_COLOR", domain="POINT")
    for index, color in enumerate(masks):
        colors.data[index].color = color
    mesh.color_attributes.active_color = colors
    mask_attribute = mesh.attributes.new(name="_terrain_masks", type="FLOAT_VECTOR", domain="POINT")
    for index, color in enumerate(masks):
        mask_attribute.data[index].vector = color[:3]
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    result = bpy.data.objects.new(name, mesh)
    target.objects.link(result)
    result.data.materials.append(material)
    result["madagin_version"] = "v1.11"
    result["source"] = "USGS 3DEP n23w160 crop plus original Madagin art direction"
    return result


def far_valley_material() -> bpy.types.Material:
    material = bpy.data.materials.new("Madagin v1.11 humid far-valley proxy")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    shader = nodes.get("Principled BSDF")
    output = nodes.get("Material Output")
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 3.8
    noise.inputs["Detail"].default_value = 2.2
    noise.inputs["Roughness"].default_value = 0.68
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.22
    ramp.color_ramp.elements[0].color = (0.012, 0.052, 0.025, 1.0)
    ramp.color_ramp.elements[1].position = 0.82
    ramp.color_ramp.elements[1].color = (0.08, 0.19, 0.105, 1.0)
    if shader and output:
        shader.inputs["Roughness"].default_value = 0.97
        links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
        links.new(ramp.outputs["Color"], shader.inputs["Base Color"])
        links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return material


def build_far_valley(
    name: str,
    columns: int,
    rows: int,
    target: bpy.types.Collection,
    material: bpy.types.Material,
) -> bpy.types.Object:
    """Continue the selected DEM edge into a cheap, art-directed distant basin."""
    x_min, x_max = -430.0, 430.0
    far_proxy_z = -760.0
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    for row in range(rows):
        progress = row / (rows - 1)
        z = FAR_Z + (far_proxy_z - FAR_Z) * progress
        for column_index in range(columns):
            x = x_min + (x_max - x_min) * column_index / (columns - 1)
            edge_x = clamp(x, -WIDTH * 0.5, WIDTH * 0.5)
            edge_height = terrain_height(edge_x, FAR_Z)
            valley_center = 55.0 + math.sin((z + 410.0) * 0.011) * 48.0
            valley_distance = abs(x - valley_center)
            side_rise = smoothstep(58.0, 420.0, valley_distance) * (10.0 + progress * 34.0)
            basin = -23.0 - progress * 10.0 + side_rise
            broad_noise = (value_noise(x * 0.018 + 3.0, z * 0.018 - 8.0) - 0.5) * (10.0 + progress * 19.0)
            spur_noise = math.sin(x * 0.031 + z * 0.008) * smoothstep(52.0, 290.0, valley_distance) * (4.0 + progress * 10.0)
            irregularity = broad_noise + spur_noise
            height = edge_height * (1.0 - smoothstep(0.0, 0.32, progress)) + (basin + irregularity) * smoothstep(0.0, 0.32, progress)
            vertices.append((x, -z, height))
    for row in range(rows - 1):
        for column_index in range(columns - 1):
            a = row * columns + column_index
            b = a + 1
            c = a + columns + 1
            d = a + columns
            faces.append((a, d, c, b))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    result = bpy.data.objects.new(name, mesh)
    target.objects.link(result)
    result.data.materials.append(material)
    result["source"] = "continuous extension of the USGS 3DEP far edge; original low-detail valley art direction"
    return result


def build_river(target: bpy.types.Collection) -> bpy.types.Object:
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    samples = 54
    previous_x = 96.0
    for index in range(samples):
        z = -38.0 + (-214.0 + 38.0) * index / (samples - 1)
        # Track one continuous drainage rather than jumping to an unrelated
        # global low point on the opposite side of a spur.
        x_low = max(-42.0, previous_x - 25.0)
        x_high = min(166.0, previous_x + 25.0)
        candidates = [(terrain_height(x, z), x) for x in np.linspace(x_low, x_high, 54)]
        height, x = min(candidates)
        previous_x = x
        width = 2.2 + smoothstep(35.0, 205.0, -z) * 2.6
        vertices.extend(((x - width, -z, height + 0.46), (x + width, -z, height + 0.46)))
        if index > 0:
            a = (index - 1) * 2
            faces.append((a, a + 2, a + 3, a + 1))
    mesh = bpy.data.meshes.new("RIDGE_VALLEY_WATER_PROXY")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    result = bpy.data.objects.new("RIDGE_VALLEY_WATER_PROXY", mesh)
    target.objects.link(result)
    material = bpy.data.materials.new("Distant humid valley water")
    material.diffuse_color = (0.018, 0.105, 0.125, 1.0)
    material.metallic = 0.08
    material.roughness = 0.18
    result.data.materials.append(material)
    return result


def distance_to_camera_path(x: float, z: float) -> float:
    return min(math.hypot(x - position[0], z - position[2]) for _, position, _, _ in CAMERA_KEYS)


def create_forest_manifest() -> dict:
    rng = random.Random(SEED)
    placements = []
    spacing = 6.0
    index = 0
    z = FAR_Z + 12.0
    while z <= NEAR_Z - 8.0:
        x = -WIDTH * 0.5 + 12.0
        while x <= WIDTH * 0.5 - 12.0:
            px = x + rng.uniform(-spacing * 0.49, spacing * 0.49)
            pz = z + rng.uniform(-spacing * 0.49, spacing * 0.49)
            height, slope, rock, moisture = terrain_metrics(px, pz)
            source_elevation = dem_sample(px, pz)
            habitat = clamp((1.0 - rock * 0.68) * smoothstep(180.0, 470.0, source_elevation), 0.0, 1.0)
            clearing = math.exp(-((px - (70.0 + math.sin((pz + 60.0) * 0.018) * 19.0)) / 13.0) ** 2)
            grove = 0.82 + value_noise(px * 0.026 + 13.0, pz * 0.026 - 7.0) * 0.31
            retention = clamp((0.38 + 0.6 * habitat) * grove, 0.0, 0.985) * (1.0 - clearing * 0.62)
            if slope < 3.2 and rng.random() < retention:
                exposed = rock > 0.42 or height > 21.0 or slope > 0.68
                family_roll = rng.random()
                family_patch = value_noise(px * 0.021 - 4.0, pz * 0.021 + 11.0)
                family = "island" if exposed and family_roll < 0.44 else "small" if family_roll + family_patch * 0.17 > 0.88 else "pachira"
                base = 1.25 if family == "pachira" else 1.32 if family == "island" else 1.42
                age = 0.72 + rng.random() * 0.72
                wind = clamp(smoothstep(12.0, 29.0, height) + slope * 0.16, 0.0, 1.0)
                scale_x = base * age * (1.0 + wind * (0.2 if family == "island" else -0.06))
                scale_y = base * age * (1.0 - wind * (0.14 if family == "island" else 0.04))
                cell_x = math.floor((px + WIDTH * 0.5) / CELL_SIZE)
                cell_z = math.floor((pz - FAR_Z) / CELL_SIZE)
                path_distance = distance_to_camera_path(px, pz)
                detail = "near" if path_distance < 48.0 and pz > -50.0 and rng.random() < 0.24 else "mid" if path_distance < 150.0 or pz > -110.0 else "far"
                root_sink = 0.18 if family == "pachira" else 0.34 if family == "island" else 0.28
                placements.append({
                    "id": index,
                    "family": family,
                    "variant": rng.randrange(4) if family == "pachira" else rng.randrange(3),
                    "detail": detail,
                    "cell": f"{cell_x}:{cell_z}",
                    "x": round(px, 3),
                    "y": round(height - root_sink, 3),
                    "z": round(pz, 3),
                    "rotation": round(rng.random() * math.pi * 2.0, 5),
                    "scale": [round(scale_x, 3), round(scale_y, 3), round(scale_x * (0.92 + rng.random() * 0.16), 3)],
                    "hue": round(rng.uniform(-0.055, 0.045) + moisture * 0.018, 4),
                    "wind": round(wind, 4),
                })
                index += 1
            x += spacing
        z += spacing

    cells: dict[str, list[int]] = {}
    for placement in placements:
        cells.setdefault(placement["cell"], []).append(placement["id"])
    cell_records = []
    for cell_id, ids in cells.items():
        cx, cz = (int(value) for value in cell_id.split(":"))
        center_x = -WIDTH * 0.5 + (cx + 0.5) * CELL_SIZE
        center_z = FAR_Z + (cz + 0.5) * CELL_SIZE
        cell_records.append({
            "id": cell_id,
            "center": [round(center_x, 2), round(terrain_height(center_x, center_z), 2), round(center_z, 2)],
            "radius": round(CELL_SIZE * 0.82, 2),
            "placements": ids,
        })
    family_counts = {family: sum(1 for placement in placements if placement["family"] == family) for family in ("pachira", "island", "small")}
    detail_counts = {detail: sum(1 for placement in placements if placement["detail"] == detail) for detail in ("near", "mid", "far")}
    forest_area = WIDTH * (NEAR_Z - FAR_Z) * 0.54
    crown_area = sum(math.pi * (4.4 * placement["scale"][0]) ** 2 for placement in placements)
    return {
        "version": "v1.11-ridge-r-and-d-benchmark",
        "seed": SEED,
        "terrain": {
            "source": "USGS 3DEP n23w160 public-domain DEM crop",
            "width": WIDTH,
            "nearZ": NEAR_Z,
            "farZ": FAR_Z,
        },
        "camera": [
            {"name": name, "position": position, "lookAt": look_at, "lensMm": lens}
            for name, position, look_at, lens in CAMERA_KEYS
        ],
        "coverage": {
            "placementCount": len(placements),
            "familyCounts": family_counts,
            "detailCounts": detail_counts,
            "analyticCrownAreaRatio": round(crown_area / forest_area, 3),
            "note": "ratio is an overlap-aware density proxy, not a claim of measured visible coverage",
        },
        "cells": sorted(cell_records, key=lambda cell: cell["id"]),
        "placements": placements,
    }


def append_forest_sources() -> dict[str, bpy.types.Object]:
    wanted = {
        "pachira_a_near", "pachira_b_near", "pachira_c_near", "pachira_d_near",
        "pachira_a_mid", "pachira_b_mid", "pachira_c_mid", "pachira_d_mid",
        "pachira_a_far", "pachira_b_far", "pachira_c_far", "pachira_d_far",
        "island_near", "island_mid", "island_far",
        "small_near", "small_mid", "small_far",
    }
    with bpy.data.libraries.load(str(FOREST_BLEND), link=False) as (available, selected):
        selected.objects = [name for name in available.objects if name in wanted]
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
    for placement in manifest["placements"]:
        # Keep the full deterministic density but bound Blender review cost.
        if placement["id"] % 2 != 0 and placement["detail"] == "far":
            continue
        family = placement["family"]
        detail = placement["detail"]
        variant = placement["variant"]
        name = f"pachira_{'abcd'[variant]}_{detail}" if family == "pachira" else f"{family}_{detail}"
        source = sources.get(name) or sources.get(f"{family}_mid") or sources.get(f"{family}_far")
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


def configure_scene() -> tuple[bpy.types.Object, bpy.types.Object]:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_percentage = 100
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0.32
    scene.world.color = (0.035, 0.085, 0.12)
    if scene.world.use_nodes:
        world_nodes = scene.world.node_tree.nodes
        background = world_nodes.get("Background")
        if background:
            background.inputs["Color"].default_value = (0.035, 0.105, 0.165, 1.0)
            background.inputs["Strength"].default_value = 0.68


    bpy.ops.object.light_add(type="SUN", location=(-110.0, -80.0, 180.0))
    sun = bpy.context.object
    sun.name = "Golden hour west sun"
    sun.data.energy = 2.15
    sun.data.color = (1.0, 0.72, 0.48)
    sun.data.angle = math.radians(12.0)
    sun.rotation_euler = (math.radians(55.0), math.radians(-18.0), math.radians(-112.0))

    bpy.ops.object.light_add(type="AREA", location=(20.0, 30.0, 210.0))
    fill = bpy.context.object
    fill.name = "Cool humid sky fill"
    fill.data.energy = 1850.0
    fill.data.color = (0.36, 0.61, 0.76)
    fill.data.shape = "DISK"
    fill.data.size = 180.0

    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.name = "CAM_RIDGE_V111"
    camera.data.sensor_width = 36.0
    camera.data.clip_start = 0.25
    camera.data.clip_end = 1300.0
    scene.camera = camera
    return camera, sun


def export_terrain(
    terrain: bpy.types.Object,
    far_valley: bpy.types.Object,
    water: bpy.types.Object,
    filename: str,
) -> None:
    previous_visibility = (
        terrain.hide_viewport,
        terrain.hide_render,
        far_valley.hide_viewport,
        far_valley.hide_render,
        water.hide_viewport,
        water.hide_render,
    )
    terrain.hide_viewport = False
    terrain.hide_render = False
    far_valley.hide_viewport = False
    far_valley.hide_render = False
    water.hide_viewport = False
    water.hide_render = False
    bpy.ops.object.select_all(action="DESELECT")
    terrain.select_set(True)
    far_valley.select_set(True)
    water.select_set(True)
    bpy.context.view_layer.objects.active = terrain
    bpy.ops.export_scene.gltf(
        filepath=str(PUBLIC_ROOT / filename),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_attributes=True,
        export_cameras=False,
        export_lights=False,
        export_materials="EXPORT",
        export_texcoords=True,
        export_normals=True,
        export_yup=True,
    )
    (
        terrain.hide_viewport,
        terrain.hide_render,
        far_valley.hide_viewport,
        far_valley.hide_render,
        water.hide_viewport,
        water.hide_render,
    ) = previous_visibility
    print(f"GLB={filename} BYTES={(PUBLIC_ROOT / filename).stat().st_size}")


def render_review(camera: bpy.types.Object) -> None:
    scene = bpy.context.scene
    for name, runtime_position, runtime_look, lens in CAMERA_KEYS:
        camera.location = (runtime_position[0], -runtime_position[2], runtime_position[1])
        camera.data.lens = lens
        look_at(camera, runtime_look)
        output = ARTIFACT_ROOT / f"lookdev-cycle-{ITERATION:02d}-{name}.png"
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
        print(f"RENDER={output} BYTES={output.stat().st_size}")


def main() -> None:
    PUBLIC_ROOT.mkdir(parents=True, exist_ok=True)
    ARTIFACT_ROOT.mkdir(parents=True, exist_ok=True)
    reset_scene()
    terrain_collection = collection("RIDGE_V111_TERRAIN_LODS")
    forest_collection = collection("RIDGE_V111_LOOKDEV_FOREST")
    material = terrain_material()
    distant_material = far_valley_material()
    high = build_terrain("RIDGE_TERRAIN_V111_HIGH", 257, 237, terrain_collection, material)
    balanced = build_terrain("RIDGE_TERRAIN_V111_BALANCED", 181, 167, terrain_collection, material)
    mobile = build_terrain("RIDGE_TERRAIN_V111_MOBILE", 129, 119, terrain_collection, material)
    far_high = build_far_valley("RIDGE_FAR_VALLEY_V111_HIGH", 97, 65, terrain_collection, distant_material)
    far_balanced = build_far_valley("RIDGE_FAR_VALLEY_V111_BALANCED", 65, 45, terrain_collection, distant_material)
    far_mobile = build_far_valley("RIDGE_FAR_VALLEY_V111_MOBILE", 49, 35, terrain_collection, distant_material)
    balanced.hide_render = True
    balanced.hide_viewport = True
    mobile.hide_render = True
    mobile.hide_viewport = True
    far_balanced.hide_render = True
    far_balanced.hide_viewport = True
    far_mobile.hide_render = True
    far_mobile.hide_viewport = True
    water = build_river(terrain_collection)

    manifest = create_forest_manifest()
    PLACEMENT_PATH.write_text(json.dumps(manifest, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps(manifest["coverage"], indent=2))
    sources = append_forest_sources()
    populate_lookdev(manifest, sources, forest_collection)
    camera, _ = configure_scene()

    export_terrain(high, far_high, water, "madagin-ridge-terrain-high-v1.11.glb")
    export_terrain(balanced, far_balanced, water, "madagin-ridge-terrain-balanced-v1.11.glb")
    export_terrain(mobile, far_mobile, water, "madagin-ridge-terrain-mobile-v1.11.glb")

    high.hide_render = False
    high.hide_viewport = False
    far_high.hide_render = False
    far_high.hide_viewport = False
    render_review(camera)
    bpy.context.scene["madagin_version"] = "v1.11-ridge-r-and-d-benchmark"
    bpy.context.scene["terrain_source"] = "USGS 3DEP n23w160 public-domain DEM crop; no imagery"
    bpy.context.scene["forest_placement_seed"] = SEED
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    print(f"BLEND={BLEND_PATH}")
    print(f"PLACEMENTS={PLACEMENT_PATH} BYTES={PLACEMENT_PATH.stat().st_size}")


if __name__ == "__main__":
    main()
