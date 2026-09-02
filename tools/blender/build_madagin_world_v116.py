"""Build the compact, spatially chunked Madagin v1.16 realism foundation.

The USGS-backed v1.15 height field remains the coordinate foundation. v1.16
adds authored erosion breakup, ten independent procedural botanical forms,
strict root-contact placement, separate geography bundles, and compact zone
manifests. The procedural families are intentionally labelled as authored
forms rather than claimed botanical scans.
"""

from __future__ import annotations

import importlib.util
import json
import math
import os
import random
from dataclasses import dataclass
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
PUBLIC_ROOT = ROOT / "public" / "world" / "v116"
ARTIFACT_ROOT = ROOT / "artifacts" / "ridge-v116"
BLEND_OUTPUT = ROOT / "world-source" / "madagin-ridge-to-valley-v1.16.blend"
FOUNDATION_PATH = ROOT / "tools" / "blender" / "build_madagin_ridge_world_v113.py"
SEED = 116_210_826


def load_foundation():
    os.environ["MADAGIN_RIDGE_VERSION"] = "v115"
    spec = importlib.util.spec_from_file_location("madagin_v115_foundation", FOUNDATION_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load the v1.15 coordinate foundation")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


W = load_foundation()


@dataclass(frozen=True)
class Species:
    key: str
    role: str
    root_radius: float
    canopy_color: tuple[float, float, float, float]
    bark_color: tuple[float, float, float, float]


SPECIES = (
    Species("ohia_emergent", "authored procedural emergent, ohia-inspired branching", 0.26, (0.055, 0.19, 0.075, 1), (0.18, 0.105, 0.065, 1)),
    Species("koa_broad", "authored procedural broad umbrella crown", 0.34, (0.09, 0.27, 0.095, 1), (0.22, 0.135, 0.075, 1)),
    Species("kukui_round", "authored procedural round humid broadleaf crown", 0.25, (0.18, 0.36, 0.13, 1), (0.21, 0.145, 0.08, 1)),
    Species("pandanus_form", "authored procedural multi-stem sword-leaf form", 0.28, (0.105, 0.31, 0.105, 1), (0.24, 0.16, 0.085, 1)),
    Species("palm_form", "authored procedural palm-like emergent", 0.2, (0.07, 0.255, 0.085, 1), (0.24, 0.15, 0.075, 1)),
    Species("tree_fern_form", "authored procedural tree-fern-like midstory", 0.18, (0.06, 0.235, 0.09, 1), (0.19, 0.115, 0.06, 1)),
    Species("ridge_wind_form", "authored procedural wind-shaped ridge crown", 0.24, (0.09, 0.225, 0.095, 1), (0.2, 0.125, 0.07, 1)),
    Species("humid_sapling", "authored procedural multi-stem sapling", 0.12, (0.15, 0.34, 0.11, 1), (0.18, 0.11, 0.055, 1)),
    Species("broken_deadwood", "authored procedural broken snag and deadwood", 0.22, (0.16, 0.12, 0.07, 1), (0.2, 0.14, 0.08, 1)),
    Species("alpine_conifer", "authored procedural compact high-elevation conifer", 0.22, (0.055, 0.17, 0.095, 1), (0.19, 0.12, 0.075, 1)),
)

CAMERA_XZ = (
    (112.0, 280.0),
    (120.0, 112.0),
    (106.0, 12.0),
    (88.0, -126.0),
    (320.0, -540.0),
    (350.0, -600.0),
    (-360.0, -380.0),
    (128.0, -310.0),
)


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in tuple(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)


def make_material(name: str, color: tuple[float, float, float, float], roughness: float) -> bpy.types.Material:
    result = bpy.data.materials.new(name)
    result.diffuse_color = color
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    if shader:
        shader.inputs["Base Color"].default_value = color
        shader.inputs["Roughness"].default_value = roughness
        shader.inputs["Metallic"].default_value = 0.0
    return result


def cylinder_between(start: Vector, end: Vector, radius: float, material: bpy.types.Material, vertices: int = 7) -> bpy.types.Object:
    direction = end - start
    midpoint = (start + end) * 0.5
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=direction.length, location=midpoint)
    result = bpy.context.object
    result.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    result.data.materials.append(material)
    return result


def crown_blob(location: Vector, scale: tuple[float, float, float], material: bpy.types.Material) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1.0, location=location)
    result = bpy.context.object
    result.scale = scale
    result.data.materials.append(material)
    return result


def leaf_ribbon(angle: float, crown: Vector, length: float, width: float, lift: float, droop: float, material: bpy.types.Material) -> bpy.types.Object:
    segments = 6
    radial = Vector((math.cos(angle), math.sin(angle), 0))
    tangent = Vector((-math.sin(angle), math.cos(angle), 0))
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    for index in range(segments + 1):
        progress = index / segments
        center = crown + radial * length * progress
        center.z += math.sin(progress * math.pi) * lift - droop * progress * progress
        half = width * (math.sin(progress * math.pi) ** 0.55) * (1.0 - progress * 0.18)
        vertices.extend((tuple(center - tangent * half), tuple(center + tangent * half)))
        if index < segments:
            base = index * 2
            faces.append((base, base + 1, base + 3, base + 2))
    mesh = bpy.data.meshes.new("v116_leaf_ribbon")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    result = bpy.data.objects.new("v116_leaf_ribbon", mesh)
    bpy.context.collection.objects.link(result)
    result.data.materials.append(material)
    return result


def join_species(parts: list[bpy.types.Object], species: Species) -> bpy.types.Object:
    bpy.ops.object.select_all(action="DESELECT")
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    result = bpy.context.object
    result.name = f"species_{species.key}"
    result.data.name = f"species_{species.key}_mesh"
    result["madagin_family"] = species.key
    result["source_type"] = "authored procedural"
    result["role"] = species.role
    result["root_radius"] = species.root_radius
    for polygon in result.data.polygons:
        polygon.use_smooth = True
    return result


def build_species(species: Species, index: int) -> bpy.types.Object:
    rng = random.Random(SEED + index * 1301)
    bark = make_material(f"{species.key}_bark", species.bark_color, 0.93)
    leaf = make_material(f"{species.key}_foliage", species.canopy_color, 0.82)
    parts: list[bpy.types.Object] = []

    if species.key == "broken_deadwood":
        parts.append(cylinder_between(Vector((0, 0, 0)), Vector((0.2, 0.08, 8.6)), 0.3, bark))
        parts.append(cylinder_between(Vector((0.14, 0.05, 5.1)), Vector((-1.5, 0.4, 7.1)), 0.13, bark))
        parts.append(cylinder_between(Vector((0.18, 0.07, 6.2)), Vector((1.2, -0.25, 7.8)), 0.11, bark))
        return join_species(parts, species)

    if species.key in {"palm_form", "tree_fern_form", "pandanus_form"}:
        height = {"palm_form": 13.8, "tree_fern_form": 5.8, "pandanus_form": 7.2}[species.key]
        stems = 3 if species.key == "pandanus_form" else 1
        crowns: list[Vector] = []
        for stem in range(stems):
            offset = Vector(((stem - (stems - 1) * 0.5) * 0.38, (stem % 2) * 0.24, 0))
            crown = offset + Vector((rng.uniform(-0.35, 0.35), rng.uniform(-0.18, 0.18), height * (0.82 + stem * 0.07)))
            parts.append(cylinder_between(offset, crown, 0.19 if stems == 1 else 0.14, bark, 8))
            crowns.append(crown)
        for crown in crowns:
            count = 13 if species.key == "palm_form" else 11 if species.key == "tree_fern_form" else 16
            for leaf_index in range(count):
                angle = leaf_index / count * math.tau + rng.uniform(-0.12, 0.12)
                parts.append(leaf_ribbon(
                    angle,
                    crown,
                    3.8 if species.key == "palm_form" else 2.3 if species.key == "tree_fern_form" else 2.0,
                    0.42 if species.key == "palm_form" else 0.3 if species.key == "tree_fern_form" else 0.2,
                    0.72 if species.key != "pandanus_form" else 1.15,
                    1.35 if species.key == "palm_form" else 0.9 if species.key == "tree_fern_form" else 0.42,
                    leaf,
                ))
        return join_species(parts, species)

    height = {
        "ohia_emergent": 16.8,
        "koa_broad": 13.6,
        "kukui_round": 10.8,
        "ridge_wind_form": 9.4,
        "humid_sapling": 5.4,
        "alpine_conifer": 9.2,
    }[species.key]
    lean = Vector((1.45, 0.3, 0)) if species.key == "ridge_wind_form" else Vector((rng.uniform(-0.3, 0.3), rng.uniform(-0.2, 0.2), 0))
    trunk_top = Vector((lean.x, lean.y, height * 0.68))
    parts.append(cylinder_between(Vector((0, 0, 0)), trunk_top, 0.27 if height > 10 else 0.18, bark, 8))

    if species.key == "alpine_conifer":
        for layer in range(7):
            z = 2.0 + layer * 0.95
            radius = 2.65 * (1.0 - layer / 8.0)
            for branch in range(5):
                angle = branch / 5 * math.tau + layer * 0.37
                end = Vector((math.cos(angle) * radius, math.sin(angle) * radius, z + 0.2))
                parts.append(cylinder_between(Vector((0, 0, z)), end, 0.055, bark, 6))
                parts.append(crown_blob(end, (0.72, 0.42, 0.38), leaf))
        parts.append(crown_blob(Vector((0, 0, height * 0.9)), (0.75, 0.75, 1.45), leaf))
        return join_species(parts, species)

    branch_count = 7 if species.key == "ohia_emergent" else 6 if species.key == "koa_broad" else 5
    crown_points: list[Vector] = []
    for branch in range(branch_count):
        angle = branch / branch_count * math.tau + rng.uniform(-0.22, 0.22)
        width = 4.6 if species.key == "koa_broad" else 3.4 if species.key == "ohia_emergent" else 2.6
        if species.key == "ridge_wind_form":
            angle = rng.uniform(-0.72, 0.72)
            width = rng.uniform(2.8, 4.4)
        end = trunk_top + Vector((math.cos(angle) * width, math.sin(angle) * width * 0.72, rng.uniform(1.4, 4.2)))
        parts.append(cylinder_between(trunk_top * 0.82, end, 0.095 if height > 10 else 0.065, bark, 6))
        crown_points.append(end)
    if species.key == "humid_sapling":
        for stem in (-0.38, 0.34):
            top = Vector((stem, rng.uniform(-0.18, 0.18), height * rng.uniform(0.74, 0.95)))
            parts.append(cylinder_between(Vector((stem * 0.35, 0, 0)), top, 0.075, bark, 6))
            crown_points.append(top)
    for crown_index, point in enumerate(crown_points):
        wide = 2.0 if species.key == "koa_broad" else 1.45 if species.key == "ohia_emergent" else 1.2
        vertical = 0.8 if species.key == "koa_broad" else 1.35
        parts.append(crown_blob(point, (wide * rng.uniform(0.82, 1.18), wide * rng.uniform(0.68, 1.05), vertical * rng.uniform(0.8, 1.18)), leaf))
        if crown_index % 2 == 0 and species.key != "ridge_wind_form":
            parts.append(crown_blob(point + Vector((rng.uniform(-0.7, 0.7), rng.uniform(-0.55, 0.55), 0.7)), (wide * 0.72, wide * 0.65, vertical * 0.68), leaf))
    return join_species(parts, species)


def v116_height(x: float, z: float) -> float:
    base = W.world_height(x, z)
    metrics = W.surface_metrics(x, z)
    slope = min(2.5, metrics["slope"])
    drainage = metrics["drainage"]
    fracture = W.fractal_noise(x * 0.055 + 31.0, z * 0.052 - 19.0, 4)
    ribs = abs(math.sin(x * 0.043 + z * 0.021 + W.fractal_noise(x * 0.012, z * 0.014, 3) * 4.5))
    erosion = (fracture * 2.8 - ribs * 1.45) * min(1.0, slope * 0.72) * (1.0 - drainage * 0.78)
    if z < -980:
        erosion *= 2.15
        ledge = math.floor(base / 6.5) * 6.5
        base = base * (1.0 - min(0.16, slope * 0.045)) + ledge * min(0.16, slope * 0.045)
    return base + erosion


def create_terrain(name: str, columns: int, rows: int, x_min: float, x_max: float, z_near: float, z_far: float, material: bpy.types.Material) -> bpy.types.Object:
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int]] = []
    colors: list[tuple[float, float, float, float]] = []
    for row in range(rows):
        z = z_near + (z_far - z_near) * row / (rows - 1)
        for column in range(columns):
            x = x_min + (x_max - x_min) * column / (columns - 1)
            height = v116_height(x, z)
            metrics = W.surface_metrics(x, z)
            vertices.append((x, -z, height))
            colors.append((metrics["moisture"], min(1.0, metrics["slope"] / 1.8), max(0.0, min(1.0, (height + 70.0) / 300.0)), 1.0))
    for row in range(rows - 1):
        for column in range(columns - 1):
            a = row * columns + column
            b = a + 1
            c = a + columns + 1
            d = a + columns
            faces.extend(((a, b, c), (a, c, d)) if (row + column) % 2 == 0 else ((a, b, d), (b, c, d)))
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    color_layer = mesh.color_attributes.new(name="biome", type="FLOAT_COLOR", domain="POINT")
    for index, color in enumerate(colors):
        color_layer.data[index].color = color
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    result = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(result)
    result.data.materials.append(material)
    result["madagin_version"] = "v1.16"
    result["source"] = "v1.15 USGS 3DEP coordinate foundation plus authored v1.16 erosion"
    return result


def create_ribbon(name: str, samples: list[tuple[float, float, float, float]], material: bpy.types.Material, cross_segments: int = 5) -> bpy.types.Object:
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int]] = []
    for row, (center, z, height, width) in enumerate(samples):
        for cross in range(cross_segments + 1):
            amount = cross / cross_segments * 2.0 - 1.0
            edge = 1.0 + math.sin(z * 0.035 + cross * 2.3) * 0.07
            vertices.append((center + width * amount * edge, -z, height))
        if row:
            current = row * (cross_segments + 1)
            previous = current - (cross_segments + 1)
            for cross in range(cross_segments):
                a, b = previous + cross, previous + cross + 1
                c, d = current + cross + 1, current + cross
                faces.extend(((a, b, c), (a, c, d)))
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    result = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(result)
    result.data.materials.append(material)
    return result


def create_lake(material: bpy.types.Material) -> bpy.types.Object:
    center_x = W.river_center(-890.0)
    level = W.watershed_height(-890.0) + 0.72
    rings, segments = 8, 64
    vertices = [(center_x, 890.0, level)]
    faces: list[tuple[int, int, int]] = []
    for ring in range(1, rings + 1):
        radius = ring / rings
        for segment in range(segments):
            angle = segment / segments * math.tau
            irregular = 1.0 + math.sin(angle * 3.0 + 0.4) * 0.08 + math.sin(angle * 7.0 - 0.7) * 0.035
            x = center_x + math.cos(angle) * 146.0 * radius * irregular
            z = -890.0 + math.sin(angle) * 118.0 * radius * (1.0 + math.sin(angle * 5.0) * 0.045)
            vertices.append((x, -z, level))
    for segment in range(segments):
        faces.append((0, 1 + segment, 1 + (segment + 1) % segments))
    for ring in range(1, rings):
        inner = 1 + (ring - 1) * segments
        outer = 1 + ring * segments
        for segment in range(segments):
            a = inner + segment
            b = inner + (segment + 1) % segments
            c = outer + (segment + 1) % segments
            d = outer + segment
            faces.extend(((a, b, c), (a, c, d)))
    mesh = bpy.data.meshes.new("lake_basin_surface_v116_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    result = bpy.data.objects.new("lake_basin_surface_v116", mesh)
    bpy.context.collection.objects.link(result)
    result.data.materials.append(material)
    return result


def create_waterfall(material: bpy.types.Material) -> tuple[list[bpy.types.Object], dict[str, float]]:
    x_center, z_center = 170.0, -730.0
    bottom = W.watershed_height(-710.0) + 0.7
    sampled_top = v116_height(x_center, z_center) + 0.9
    top = max(sampled_top, bottom + 62.0)
    objects: list[bpy.types.Object] = []
    for sheet_index, (offset, width, depth, strand_count) in enumerate(
        ((-5.5, 21.0, 0.0, 7), (9.0, 15.0, -0.8, 5), (-18.0, 8.0, 0.7, 3))
    ):
        rows = 26
        vertices: list[tuple[float, float, float]] = []
        faces: list[tuple[int, int, int]] = []
        spacing = width / strand_count
        for strand in range(strand_count):
            center_across = (strand + 0.5) / strand_count - 0.5
            strand_width = spacing * (0.46 + 0.18 * math.sin(strand * 2.31 + sheet_index))
            strand_start = len(vertices)
            for row in range(rows):
                progress = row / (rows - 1)
                y = top + (bottom - top) * progress
                sideways = math.sin(progress * 12.0 + strand * 1.71 + sheet_index) * (0.24 + progress * 0.42)
                breathing = 0.78 + math.sin(progress * 7.0 + strand * 0.93) * 0.18
                center_x = x_center + offset + center_across * width + sideways
                center_z = z_center + depth + math.sin(progress * 10.0 + strand * 0.67) * 0.5
                half_width = strand_width * breathing * 0.5
                vertices.extend(
                    (
                        (center_x - half_width, -center_z, y),
                        (center_x + half_width, -center_z, y),
                    )
                )
            for row in range(rows - 1):
                a = strand_start + row * 2
                b = a + 1
                c = a + 3
                d = a + 2
                faces.extend(((a, b, c), (a, c, d)))
        mesh = bpy.data.meshes.new(f"waterfall_sheet_{sheet_index}_mesh")
        mesh.from_pydata(vertices, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(f"waterfall_sheet_{sheet_index}_v116", mesh)
        bpy.context.collection.objects.link(obj)
        obj.data.materials.append(material)
        objects.append(obj)
    return objects, {"x": x_center, "z": z_center, "top": top, "bottom": bottom, "primaryWidth": 21.0, "totalWidth": 44.0}


def create_cliff(material: bpy.types.Material, waterfall: dict[str, float]) -> bpy.types.Object:
    columns, rows = 28, 18
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int]] = []
    for row in range(rows):
        progress_y = row / (rows - 1)
        height = waterfall["bottom"] - 10.0 + (waterfall["top"] - waterfall["bottom"] + 30.0) * progress_y
        for column in range(columns):
            across = column / (columns - 1) * 2.0 - 1.0
            x = waterfall["x"] + across * 86.0
            recess = math.exp(-((x - waterfall["x"]) / 28.0) ** 2) * 6.0
            z = waterfall["z"] + 4.0 + recess + W.fractal_noise(x * 0.08, height * 0.065, 4) * 2.3
            vertices.append((x, -z, height))
    for row in range(rows - 1):
        for column in range(columns - 1):
            a = row * columns + column
            b = a + 1
            c = a + columns + 1
            d = a + columns
            faces.extend(((a, b, c), (a, c, d)))
    mesh = bpy.data.meshes.new("waterfall_cliff_v116_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    result = bpy.data.objects.new("waterfall_wet_cliff_v116", mesh)
    bpy.context.collection.objects.link(result)
    result.data.materials.append(material)
    return result


def export_objects(path: Path, objects: list[bpy.types.Object]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_set(False)
        obj.hide_render = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_attributes=True,
        export_cameras=False,
        export_lights=False,
        export_materials="EXPORT",
        export_meshopt_compression_enable=True,
        export_meshopt_extension="EXT_meshopt_compression",
        export_texcoords=True,
        export_normals=True,
        export_yup=True,
    )


def camera_clear(x: float, z: float, radius: float = 25.0) -> bool:
    return all(math.hypot(x - cx, z - cz) >= radius for cx, cz in CAMERA_XZ)


def root_contact(species: Species, x: float, z: float, footprint_scale: float, rotation: float, layer: int) -> tuple[float, float, float] | None:
    # Check the entire non-uniformly scaled footprint, not only the nominal
    # instance scale. This keeps wide crowns/trunks from passing a grounding
    # test that a narrower proxy would have hidden.
    radius = species.root_radius * footprint_scale * (0.72 if layer > 0 else 1.0)
    samples = [(x, z)]
    for index in range(8):
        angle = rotation + index / 8 * math.tau
        samples.append((x + math.cos(angle) * radius, z + math.sin(angle) * radius))
    heights = [v116_height(px, pz) for px, pz in samples]
    relief = max(heights) - min(heights)
    tolerance = 0.04 if layer == 0 else 0.07 if layer == 1 else 0.09
    if relief > tolerance:
        return None
    # Seat the lowest sampled root point just into the ground. This keeps the
    # maximum visible air gap below 2 cm while the accepted relief ceiling
    # keeps the opposite side well inside the 10 cm burial gate.
    root_y = min(heights) + 0.018
    max_gap = max(max(0.0, root_y - height) for height in heights)
    max_burial = max(max(0.0, height - root_y) for height in heights)
    return root_y, max_gap, max_burial


def select_species(zone: str, layer: int, rng: random.Random) -> int:
    if zone == "alpine":
        choices = (9, 6, 8, 7)
        weights = (0.54, 0.2, 0.08, 0.18)
    elif layer == 2:
        choices = (5, 7, 3, 6, 8)
        weights = (0.34, 0.3, 0.18, 0.12, 0.06)
    else:
        choices = (0, 1, 2, 3, 4, 5, 6, 7, 8)
        weights = (0.13, 0.14, 0.14, 0.08, 0.08, 0.1, 0.12, 0.16, 0.05)
    return rng.choices(choices, weights=weights, k=1)[0]


def make_placements(
    zone: str,
    layer: int,
    count: int,
    bounds: tuple[float, float, float, float],
    seed: int,
    minimum_moisture: float = 0.0,
) -> list[list[float | int]]:
    rng = random.Random(seed)
    x_min, x_max, z_far, z_near = bounds
    placements: list[list[float | int]] = []
    attempts = 0
    attempt_multiplier = 320 if zone == "alpine" and layer == 0 else 90
    while len(placements) < count and attempts < count * attempt_multiplier:
        attempts += 1
        x = rng.uniform(x_min, x_max)
        z = rng.uniform(z_far, z_near)
        metrics = W.surface_metrics(x, z)
        max_slope = 1.62 if layer == 0 else 1.18 if layer == 1 else 0.82
        if metrics["slope"] > max_slope:
            continue
        if metrics["moisture"] < minimum_moisture:
            continue
        if not camera_clear(x, z, 33.0 if layer == 0 else 24.0):
            continue
        if z < -330:
            distance_to_water = abs(x - W.river_center(z))
            lake = math.exp(-((z + 890.0) / 170.0) ** 2)
            water_width = 16.0 + lake * 145.0
            if distance_to_water < water_width + (5.0 if layer < 2 else -2.0):
                continue
        species_index = select_species(zone, layer, rng)
        species = SPECIES[species_index]
        scale = rng.uniform(0.82, 1.28) if layer == 0 else rng.uniform(0.42, 0.76) if layer == 1 else rng.uniform(0.18, 0.46)
        if species.key in {"palm_form", "ohia_emergent"} and layer == 0:
            scale *= rng.uniform(1.02, 1.32)
        rotation = rng.random() * math.tau
        scale_x = scale * rng.uniform(0.88, 1.14)
        scale_y = scale * rng.uniform(0.9, 1.16)
        scale_z = scale * rng.uniform(0.88, 1.12)
        contact = root_contact(species, x, z, max(scale_x, scale_z), rotation, layer)
        if contact is None:
            continue
        y, gap, burial = contact
        hue_bucket = rng.choices((0, 1, 2), weights=(0.25, 0.55, 0.2), k=1)[0]
        placements.append([
            species_index,
            layer,
            round(x, 3),
            round(y, 3),
            round(z, 3),
            round(rotation, 5),
            round(scale_x, 4),
            round(scale_y, 4),
            round(scale_z, 4),
            hue_bucket,
            round(gap, 4),
            round(burial, 4),
        ])
    if len(placements) != count:
        raise RuntimeError(f"Unable to place requested {zone} layer {layer}: {len(placements)}/{count}")
    return placements


PlacementGroup = tuple[int, int, tuple[float, float, float, float], float]


def write_zone(name: str, groups: list[PlacementGroup], seed: int) -> dict[str, object]:
    path = PUBLIC_ROOT / f"ecology-{name}-v1.16.json"
    rebuild_zone = os.environ.get("MADAGIN_V116_REBUILD_ZONE")
    if (
        os.environ.get("MADAGIN_V116_REUSE_VALID_ZONES") == "1"
        and rebuild_zone != name
        and path.exists()
    ):
        cached = json.loads(path.read_text(encoding="utf-8"))
        grounding = cached.get("coverage", {}).get("grounding", {})
        if cached.get("version") == "v1.16" and grounding.get("floatingCount") == 0 and grounding.get("buriedCount") == 0:
            return {
                "file": path.name,
                "bytes": path.stat().st_size,
                "count": cached.get("coverage", {}).get("count", len(cached.get("instances", []))),
                "grounding": grounding,
            }
    instances: list[list[float | int]] = []
    for offset, (layer, count, bounds, minimum_moisture) in enumerate(groups):
        instances.extend(make_placements(
            name,
            layer,
            count,
            bounds,
            seed + offset * 997,
            minimum_moisture,
        ))
    gaps = [float(item[10]) for item in instances]
    burials = [float(item[11]) for item in instances]
    payload = {
        "version": "v1.16",
        "zone": name,
        "fields": ["family", "layer", "x", "y", "z", "rotation", "scaleX", "scaleY", "scaleZ", "hueBucket", "maxRootGap", "maxRootBurial"],
        "families": [species.key for species in SPECIES],
        "instances": instances,
        "coverage": {
            "count": len(instances),
            "byLayer": {str(layer): sum(1 for item in instances if item[1] == layer) for layer in (0, 1, 2)},
            "grounding": {
                "sampleCount": len(instances),
                "floatingCount": sum(1 for gap in gaps if gap > 0.02),
                "buriedCount": sum(1 for burial in burials if burial > 0.1),
                "maxRootGap": max(gaps, default=0.0),
                "maxRootBurial": max(burials, default=0.0),
                "nearGapGate": 0.02,
                "nearBurialGate": 0.1,
                "method": "authored root footprint sampled against final v1.16 height after rotation and nonuniform scale; high-relief candidates rejected",
            },
        },
    }
    path.write_text(json.dumps(payload, separators=(",", ":")) + "\n", encoding="utf-8")
    return {"file": path.name, "bytes": path.stat().st_size, "count": len(instances), "grounding": payload["coverage"]["grounding"]}


def write_ecology_zones() -> dict[str, dict[str, object]]:
    return {
        "ridge": write_zone("ridge", [(0, 2400, (-300.0, 300.0, -310.0, 270.0), 0.0), (1, 850, (-300.0, 300.0, -310.0, 270.0), 0.0), (2, 1500, (-300.0, 300.0, -310.0, 270.0), 0.0)], SEED + 100),
        "valley": write_zone("valley", [(0, 1750, (-690.0, 690.0, -970.0, -330.0), 0.0), (1, 620, (-690.0, 690.0, -970.0, -330.0), 0.0), (2, 900, (-690.0, 690.0, -970.0, -330.0), 0.0)], SEED + 200),
        "lake": write_zone("lake", [
            (1, 260, (-260.0, 360.0, -980.0, -650.0), 0.0),
            (2, 540, (-270.0, 380.0, -980.0, -650.0), 0.0),
            # Low succession inside the former near-bank inventory void. The
            # moisture gate clusters anchors, while the shared camera-clearance
            # and root-footprint tests keep the authored rail unobstructed.
            (2, 64, (180.0, 430.0, -649.5, -540.0), 0.18),
        ], SEED + 300),
        "alpine": write_zone("alpine", [(0, 100, (-780.0, 780.0, -1600.0, -980.0), 0.0), (2, 260, (-780.0, 780.0, -1600.0, -980.0), 0.0)], SEED + 400),
    }


def main() -> None:
    PUBLIC_ROOT.mkdir(parents=True, exist_ok=True)
    ARTIFACT_ROOT.mkdir(parents=True, exist_ok=True)
    BLEND_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    if os.environ.get("MADAGIN_V116_MANIFEST_ONLY") == "1":
        print(json.dumps({"zones": write_ecology_zones()}, indent=2))
        return
    reset_scene()

    species_objects = [build_species(species, index) for index, species in enumerate(SPECIES)]

    terrain_material = make_material("v116_terrain_placeholder", (0.22, 0.28, 0.21, 1), 0.96)
    water_material = make_material("v116_water_placeholder", (0.025, 0.16, 0.18, 1), 0.22)
    cliff_material = make_material("v116_wet_basalt_placeholder", (0.07, 0.085, 0.075, 1), 0.76)

    ridge = create_terrain("terrain_ridge_v116", 129, 137, -310.0, 310.0, 285.0, -335.0, terrain_material)
    valley = create_terrain("terrain_valley_v116", 161, 121, -730.0, 730.0, -335.0, -1000.0, terrain_material)
    alpine = create_terrain("terrain_alpine_v116", 169, 105, -990.0, 990.0, -1000.0, -1710.0, terrain_material)

    river_samples = []
    for index in range(112):
        z = -330.0 + (-780.0 + 330.0) * index / 111
        progress = index / 111
        river_samples.append((W.river_center(z), z, W.watershed_height(z) + 0.58, 5.5 + progress * 8.2))
    river = create_ribbon("river_channel_v116", river_samples, water_material, 6)
    lake = create_lake(water_material)
    waterfall_sheets, waterfall_report = create_waterfall(water_material)
    cliff = create_cliff(cliff_material, waterfall_report)
    upper_samples = []
    for index in range(38):
        z = -820.0 + 90.0 * index / 37
        center = 170.0 + math.sin(index * 0.37) * 5.0
        height = waterfall_report["top"] + 0.22 + (1.0 - index / 37) * 2.1
        upper_samples.append((center, z, height, 5.8 + math.sin(index * 0.51) * 0.8))
    upper_stream = create_ribbon("waterfall_upper_stream_v116", upper_samples, water_material, 5)
    plunge = create_ribbon("waterfall_plunge_pool_v116", [
        (170.0, -704.0 + row * 1.35, waterfall_report["bottom"] - 0.15, 31.0 + math.sin(row * 0.45) * 3.2)
        for row in range(18)
    ], water_material, 8)

    export_objects(PUBLIC_ROOT / "species-core-v1.16.glb", species_objects)
    export_objects(PUBLIC_ROOT / "terrain-ridge-v1.16.glb", [ridge])
    export_objects(PUBLIC_ROOT / "terrain-valley-v1.16.glb", [valley])
    export_objects(PUBLIC_ROOT / "terrain-alpine-v1.16.glb", [alpine])
    export_objects(PUBLIC_ROOT / "water-lake-waterfall-v1.16.glb", [river, lake, upper_stream, plunge, cliff, *waterfall_sheets])

    zones = write_ecology_zones()

    bpy.context.scene["madagin_version"] = "v1.16-spatial-realism-foundation"
    bpy.context.scene["source_height"] = "USGS 3DEP v1.11 coordinate foundation plus authored v1.16 erosion"
    bpy.context.scene["species_source"] = "ten authored procedural forms"
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_OUTPUT))

    output_files = sorted(PUBLIC_ROOT.glob("*"))
    report = {
        "version": "v1.16",
        "generator": str(Path(__file__).relative_to(ROOT)),
        "seed": SEED,
        "terrain": {
            "foundation": "USGS 3DEP n23w160 public-domain DEM crop retained from v1.15",
            "authored": "erosion ribs, drainage breakup, high-slope ledges, separate spatial terrain bundles",
        },
        "vegetation": {
            "independentFamilyCount": len(SPECIES),
            "families": [{"key": species.key, "sourceType": "authored procedural", "role": species.role} for species in SPECIES],
            "globalGreenOverride": False,
            "globalEmissiveOverride": False,
        },
        "waterfall": waterfall_report,
        "zones": zones,
        "outputs": {path.name: path.stat().st_size for path in output_files if path.is_file()},
    }
    (ARTIFACT_ROOT / "world-build-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    (ARTIFACT_ROOT / "provenance-license-manifest.json").write_text(json.dumps({
        "version": "v1.16",
        "runtimeAssets": [
            {"name": "terrain coordinate foundation", "source": "USGS 3DEP n23w160 crop already preserved locally", "license": "United States public domain", "use": "height coordinate foundation"},
            {"name": "ten v1.16 botanical silhouette families", "source": "tools/blender/build_madagin_world_v116.py", "license": "project-authored procedural geometry", "use": "runtime vegetation"},
            {"name": "terrain PBR textures", "source": "locally vendored Poly Haven 1K texture sets", "license": "CC0 1.0", "use": "runtime triplanar terrain shading"},
        ],
        "referenceBoard": "artifacts/ridge-v116/reference-board.md",
    }, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
