"""Build the Madagin v1.10 production-intent Ridge benchmark.

This generator is an assembly/export tool, not a primitive landscape maker.
The terrain is a densely sampled, smooth erosion field; the visible forest and
ground layers use linked CC0 Poly Haven source meshes and PBR materials. The
saved Blend remains the look-development source of truth while bounded terrain
LODs and deterministic placement data feed the live browser implementation.

Run:
  blender --background --python tools/blender/build_madagin_ridge_production_v110.py -- --iteration=1
"""

from __future__ import annotations

import json
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
ASSET_ROOT = ROOT / "public" / "world" / "assets" / "polyhaven"
PUBLIC_ROOT = ROOT / "public" / "world" / "v110"
SOURCE_ROOT = ROOT / "world-source"
ARTIFACT_ROOT = ROOT / "artifacts" / "ridge-v110"
BLEND_PATH = SOURCE_ROOT / "madagin-ridge-production-benchmark-v1.10.blend"
PLACEMENT_PATH = PUBLIC_ROOT / "madagin-ridge-placements-v1.10.json"

TREE_PATH = ASSET_ROOT / "pachira_aquatica_01" / "pachira_aquatica_01_1k.gltf"
FERN_PATH = ASSET_ROOT / "fern_02" / "fern_02_1k.gltf"
SHRUB_PATH = ASSET_ROOT / "shrub_04" / "shrub_04_1k.gltf"
MOSS_PATH = ASSET_ROOT / "moss_01" / "moss_01_1k.gltf"
ROCK_PATH = ASSET_ROOT / "rock_09" / "rock_09_1k.gltf"
MOSS_ROCK_PATH = ASSET_ROOT / "rock_moss_set_02" / "rock_moss_set_02_1k.gltf"
FOREST_DIR = ASSET_ROOT / "forrest_ground_03"
ROCK_DIR = ASSET_ROOT / "aerial_grass_rock"


def cli_iteration() -> int:
    for argument in sys.argv:
        if argument.startswith("--iteration="):
            return max(1, int(argument.split("=", 1)[1]))
    return 1


ITERATION = cli_iteration()


def clamp(value: float, low: float, high: float) -> float:
    return min(high, max(low, value))


def mix(a: float, b: float, amount: float) -> float:
    return a + (b - a) * amount


def smoothstep(edge0: float, edge1: float, value: float) -> float:
    amount = clamp((value - edge0) / (edge1 - edge0), 0.0, 1.0)
    return amount * amount * (3.0 - 2.0 * amount)


def fract(value: float) -> float:
    return value - math.floor(value)


def hash2(x: float, z: float) -> float:
    return fract(math.sin(x * 127.1 + z * 311.7) * 43758.5453123)


def value_noise(x: float, z: float) -> float:
    ix = math.floor(x)
    iz = math.floor(z)
    fx = x - ix
    fz = z - iz
    ux = fx * fx * (3.0 - 2.0 * fx)
    uz = fz * fz * (3.0 - 2.0 * fz)
    return mix(
        mix(hash2(ix, iz), hash2(ix + 1, iz), ux),
        mix(hash2(ix, iz + 1), hash2(ix + 1, iz + 1), ux),
        uz,
    )


def fbm(x: float, z: float, octaves: int = 5) -> float:
    amplitude = 0.5
    frequency = 1.0
    total = 0.0
    weight = 0.0
    for _ in range(octaves):
        total += value_noise(x * frequency, z * frequency) * amplitude
        weight += amplitude
        amplitude *= 0.5
        frequency *= 2.03
    return total / max(weight, 0.0001)


def ridge_height(x: float, z: float) -> float:
    """Runtime coordinates: Y-up height over the X/Z ground plane."""
    warp_x = (fbm(x * 0.012 + 3.1, z * 0.012 - 7.4, 4) - 0.5) * 13.0
    warp_z = (fbm(x * 0.014 - 5.7, z * 0.014 + 2.6, 4) - 0.5) * 11.0
    wx = x + warp_x
    wz = z + warp_z

    crest_center = 7.5 + math.sin(wx * 0.073 + 0.8) * 3.6 + math.sin(wx * 0.181 - 0.5) * 1.25
    # A narrow, asymmetric knife ridge reads more like deeply eroded Hawaiian
    # volcanic terrain than the broad Gaussian hill used in the first review.
    crest_distance = abs(wz - crest_center)
    across = math.exp(-((crest_distance / 12.8) ** 1.58))
    lee_cut = smoothstep(5.0, 22.0, crest_center - wz)
    shoulder = 26.0 + math.sin(wx * 0.052 + 1.1) * 4.2 + math.sin(wx * 0.137 - 0.9) * 1.9
    saddle = -5.4 * math.exp(-((wx + 3.0) / 10.5) ** 2)
    crest = across * max(8.0, shoulder + saddle)

    approach_rise = smoothstep(94.0, 18.0, wz) * 4.8
    windward_fold_a = 8.8 * math.exp(-(((wx + 39.0) / 26.0) ** 2 + ((wz - 30.0) / 35.0) ** 2))
    windward_fold_b = 6.4 * math.exp(-(((wx - 42.0) / 31.0) ** 2 + ((wz - 20.0) / 41.0) ** 2))
    valley_drop = smoothstep(9.0, -24.0, wz) * 18.5 + lee_cut * 5.5
    far_left = 24.0 * math.exp(-(((wx + 58.0) / 31.0) ** 2 + ((wz + 76.0) / 42.0) ** 2))
    far_right = 31.0 * math.exp(-(((wx - 64.0) / 35.0) ** 2 + ((wz + 88.0) / 48.0) ** 2))
    far_spine = 17.0 * math.exp(-(((wx - 4.0) / 47.0) ** 2 + ((wz + 128.0) / 35.0) ** 2))

    drainage = 0.0
    for channel_x, strength, width in ((-29.0, 4.2, 4.2), (-11.0, 5.8, 3.4), (14.0, 5.1, 3.8), (35.0, 4.4, 4.6)):
        meander = channel_x + math.sin((wz - 6.0) * 0.055 + channel_x) * 3.1
        drainage += math.exp(-((wx - meander) / width) ** 2) * strength * smoothstep(76.0, -15.0, wz)

    large_breakup = (fbm(wx * 0.027 + 12.0, wz * 0.027 - 9.0, 5) - 0.5) * 4.7
    medium_erosion = (fbm(wx * 0.083 - 2.0, wz * 0.083 + 5.0, 4) - 0.5) * 1.45
    rock_ribs = abs(math.sin(wx * 0.102 + wz * 0.071 + large_breakup * 0.13)) ** 5 * across * 1.9

    return (
        1.7
        + approach_rise
        + windward_fold_a
        + windward_fold_b
        + crest
        - valley_drop
        + far_left
        + far_right
        + far_spine
        - drainage
        + large_breakup
        + medium_erosion
        + rock_ribs
    )


def surface_slope(x: float, z: float) -> float:
    sample = 0.65
    dx = ridge_height(x + sample, z) - ridge_height(x - sample, z)
    dz = ridge_height(x, z + sample) - ridge_height(x, z - sample)
    return math.sqrt(dx * dx + dz * dz) / (sample * 2.0)


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in tuple(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)
    base = bpy.data.collections.get("Collection")
    if base is not None:
        base.name = "RIDGE_V110_SOURCE"


def collection(name: str) -> bpy.types.Collection:
    result = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(result)
    return result


def terrain_material() -> bpy.types.Material:
    material = bpy.data.materials.new("Ridge layered forest soil + wet basalt / Poly Haven CC0")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.inputs["Roughness"].default_value = 0.9

    coordinates = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (0.115, 0.115, 0.115)
    links.new(coordinates.outputs["Object"], mapping.inputs["Vector"])

    forest_color = nodes.new("ShaderNodeTexImage")
    forest_color.image = bpy.data.images.load(str(ROCK_DIR / "aerial_grass_rock_diff_1k.jpg"))
    forest_color.extension = "REPEAT"
    rock_color = nodes.new("ShaderNodeTexImage")
    rock_color.image = bpy.data.images.load(str(ROCK_DIR / "aerial_grass_rock_diff_1k.jpg"))
    rock_color.extension = "REPEAT"
    forest_normal_texture = nodes.new("ShaderNodeTexImage")
    forest_normal_texture.image = bpy.data.images.load(str(ROCK_DIR / "aerial_grass_rock_nor_gl_1k.jpg"))
    forest_normal_texture.image.colorspace_settings.name = "Non-Color"
    forest_normal_texture.extension = "REPEAT"
    rock_normal_texture = nodes.new("ShaderNodeTexImage")
    rock_normal_texture.image = bpy.data.images.load(str(ROCK_DIR / "aerial_grass_rock_nor_gl_1k.jpg"))
    rock_normal_texture.image.colorspace_settings.name = "Non-Color"
    rock_normal_texture.extension = "REPEAT"
    forest_arm = nodes.new("ShaderNodeTexImage")
    forest_arm.image = bpy.data.images.load(str(ROCK_DIR / "aerial_grass_rock_arm_1k.jpg"))
    forest_arm.image.colorspace_settings.name = "Non-Color"
    forest_arm.extension = "REPEAT"
    rock_arm = nodes.new("ShaderNodeTexImage")
    rock_arm.image = bpy.data.images.load(str(ROCK_DIR / "aerial_grass_rock_arm_1k.jpg"))
    rock_arm.image.colorspace_settings.name = "Non-Color"
    rock_arm.extension = "REPEAT"
    for texture in (forest_color, rock_color, forest_normal_texture, rock_normal_texture, forest_arm, rock_arm):
        links.new(mapping.outputs["Vector"], texture.inputs["Vector"])

    geometry = nodes.new("ShaderNodeNewGeometry")
    normal_xyz = nodes.new("ShaderNodeSeparateXYZ")
    invert_up = nodes.new("ShaderNodeMath")
    invert_up.operation = "SUBTRACT"
    invert_up.inputs[0].default_value = 1.0
    slope_gain = nodes.new("ShaderNodeMath")
    slope_gain.operation = "MULTIPLY"
    slope_gain.inputs[1].default_value = 2.35
    macro = nodes.new("ShaderNodeTexNoise")
    macro.noise_dimensions = "3D"
    macro.inputs["Scale"].default_value = 0.065
    macro.inputs["Detail"].default_value = 6.0
    macro.inputs["Roughness"].default_value = 0.72
    macro_gain = nodes.new("ShaderNodeMath")
    macro_gain.operation = "MULTIPLY"
    macro_gain.inputs[1].default_value = 0.31
    rock_factor = nodes.new("ShaderNodeMath")
    rock_factor.operation = "ADD"
    rock_factor.use_clamp = True
    links.new(geometry.outputs["Normal"], normal_xyz.inputs["Vector"])
    links.new(normal_xyz.outputs["Z"], invert_up.inputs[1])
    links.new(invert_up.outputs["Value"], slope_gain.inputs[0])
    links.new(coordinates.outputs["Object"], macro.inputs["Vector"])
    links.new(macro.outputs["Fac"], macro_gain.inputs[0])
    links.new(slope_gain.outputs["Value"], rock_factor.inputs[0])
    links.new(macro_gain.outputs["Value"], rock_factor.inputs[1])

    color_mix = nodes.new("ShaderNodeMixRGB")
    color_mix.blend_type = "MIX"
    links.new(rock_factor.outputs["Value"], color_mix.inputs["Fac"])
    links.new(forest_color.outputs["Color"], color_mix.inputs[1])
    links.new(rock_color.outputs["Color"], color_mix.inputs[2])
    tint = nodes.new("ShaderNodeMixRGB")
    tint.blend_type = "MULTIPLY"
    tint.inputs["Fac"].default_value = 0.44
    tint.inputs[2].default_value = (0.58, 0.72, 0.52, 1.0)
    links.new(color_mix.outputs["Color"], tint.inputs[1])
    links.new(tint.outputs["Color"], shader.inputs["Base Color"])

    forest_normal = nodes.new("ShaderNodeNormalMap")
    forest_normal.inputs["Strength"].default_value = 0.68
    rock_normal = nodes.new("ShaderNodeNormalMap")
    rock_normal.inputs["Strength"].default_value = 0.86
    normal_mix = nodes.new("ShaderNodeMixRGB")
    links.new(forest_normal_texture.outputs["Color"], forest_normal.inputs["Color"])
    links.new(rock_normal_texture.outputs["Color"], rock_normal.inputs["Color"])
    links.new(rock_factor.outputs["Value"], normal_mix.inputs["Fac"])
    links.new(forest_normal.outputs["Normal"], normal_mix.inputs[1])
    links.new(rock_normal.outputs["Normal"], normal_mix.inputs[2])
    links.new(normal_mix.outputs["Color"], shader.inputs["Normal"])

    forest_channels = nodes.new("ShaderNodeSeparateColor")
    rock_channels = nodes.new("ShaderNodeSeparateColor")
    rough_mix = nodes.new("ShaderNodeMix")
    rough_mix.data_type = "FLOAT"
    links.new(forest_arm.outputs["Color"], forest_channels.inputs["Color"])
    links.new(rock_arm.outputs["Color"], rock_channels.inputs["Color"])
    links.new(rock_factor.outputs["Value"], rough_mix.inputs["Factor"])
    links.new(forest_channels.outputs["Green"], rough_mix.inputs[2])
    links.new(rock_channels.outputs["Green"], rough_mix.inputs[3])
    links.new(rough_mix.outputs["Result"], shader.inputs["Roughness"])
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return material


def build_terrain(name: str, columns: int, rows: int, target: bpy.types.Collection) -> bpy.types.Object:
    x_min, x_max = -118.0, 118.0
    z_near, z_far = 96.0, -154.0
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    uvs: list[tuple[float, float]] = []
    for row in range(rows):
        v = row / (rows - 1)
        z = mix(z_near, z_far, v)
        for column_index in range(columns):
            u = column_index / (columns - 1)
            x = mix(x_min, x_max, u)
            vertices.append((x, z, ridge_height(x, z)))
            uvs.append((x * 0.115, z * 0.115))
    for row in range(rows - 1):
        for column_index in range(columns - 1):
            a = row * columns + column_index
            b = a + 1
            c = a + columns + 1
            d = a + columns
            # Rows advance from +Y toward -Y, so the original a/b/c/d order
            # produced downward-facing normals. Reverse the winding for an
            # upward terrain surface in both Blender and exported glTF.
            faces.append((a, d, c, b))
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
    result["madagin_version"] = "v1.10"
    result["terrain_role"] = name
    return result


def import_meshes(path: Path) -> list[bpy.types.Object]:
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    return [obj for obj in bpy.context.scene.objects if obj not in before and obj.type == "MESH"]


def linked_copy(
    source: bpy.types.Object,
    target: bpy.types.Collection,
    name: str,
    location: tuple[float, float, float],
    scale_xyz: tuple[float, float, float],
    rotation: float,
) -> bpy.types.Object:
    duplicate = source.copy()
    duplicate.data = source.data
    duplicate.animation_data_clear()
    duplicate.name = name
    duplicate.location = location
    duplicate.rotation_euler = source.rotation_euler.copy()
    duplicate.rotation_euler.z += rotation
    duplicate.scale = tuple(source.scale[index] * scale_xyz[index] for index in range(3))
    target.objects.link(duplicate)
    return duplicate


def placement_record(x: float, z: float, scale: tuple[float, float, float], rotation: float, variant: int) -> dict[str, object]:
    return {
        "x": round(x, 4),
        "y": round(ridge_height(x, z), 4),
        # Blender's +Y ground axis exports as Three.js -Z.
        "z": round(-z, 4),
        "scale": [round(scale[0], 4), round(scale[2], 4), round(scale[1], 4)],
        "rotation": round(-rotation, 5),
        "variant": variant,
    }


def scatter_assets() -> dict[str, list[dict[str, object]]]:
    placements: dict[str, list[dict[str, object]]] = {
        "trees": [], "ferns": [], "shrubs": [], "moss": [], "rocks": [], "mossRocks": []
    }
    tree_sources = import_meshes(TREE_PATH)
    tree_variants: list[tuple[bpy.types.Object, bpy.types.Object]] = []
    for suffix in ("a", "b", "c", "d"):
        bark = next(obj for obj in tree_sources if obj.name.startswith(f"pachira_aquatica_01_bark_{suffix}"))
        leaves = next(obj for obj in tree_sources if obj.name.startswith(f"pachira_aquatica_01_leaves_{suffix}"))
        tree_variants.append((bark, leaves))
    fern_sources = import_meshes(FERN_PATH)
    shrub_sources = import_meshes(SHRUB_PATH)
    moss_sources = import_meshes(MOSS_PATH)
    rock_sources = import_meshes(ROCK_PATH)
    moss_rock_sources = import_meshes(MOSS_ROCK_PATH)

    trees = collection("RIDGE_VEGETATION_HIGH_LINKED_CC0")
    ground = collection("RIDGE_GROUND_DETAIL_HIGH_LINKED_CC0")
    geology = collection("RIDGE_GEOLOGY_HIGH_LINKED_CC0")
    rng = random.Random(110031)

    made = 0
    while made < 720:
        z = 76.0 - rng.random() ** 0.9 * 132.0
        x = (rng.random() * 2.0 - 1.0) * (34.0 + rng.random() * 62.0)
        height = ridge_height(x, z)
        slope = surface_slope(x, z)
        corridor = z > 24.0 and abs(x - math.sin(z * 0.045) * 2.2) < 5.5
        crest_exposure = abs(z - 8.0) < 13.0
        moisture = fbm(x * 0.035 + 8.0, z * 0.035 - 2.0, 4)
        if slope > 3.6 or corridor or height < -7.0 or rng.random() > 0.78 + moisture * 0.16:
            continue
        variant = int(rng.random() * len(tree_variants))
        # Poly Haven's Pachira is a small houseplant-scale scan. It is used as
        # a linked broadleaf canopy module here, so correct it to mature canopy
        # mass instead of scattering miniature specimens across a 250 m ridge.
        base_scale = 3.0 + rng.random() * 2.2
        if crest_exposure:
            scale = (base_scale * (1.28 + rng.random() * 0.3), base_scale * (1.28 + rng.random() * 0.26), base_scale * 0.56)
        elif moisture > 0.62 and rng.random() < 0.23:
            scale = (base_scale * 1.08, base_scale * 1.08, base_scale * 1.04)
        else:
            scale = (base_scale * (1.18 + rng.random() * 0.28), base_scale * (1.18 + rng.random() * 0.28), base_scale * 0.76)
        rotation = rng.random() * math.tau
        bark, leaves = tree_variants[variant]
        location = (x, z, height - 0.06)
        linked_copy(bark, trees, f"Canopy {made + 1:03d} bark", location, scale, rotation)
        linked_copy(leaves, trees, f"Canopy {made + 1:03d} leaves", location, scale, rotation)
        placements["trees"].append(placement_record(x, z, scale, rotation, variant))
        made += 1

    scatter_specs = (
        ("ferns", fern_sources, 340, (0.45, 1.22), 1.5),
        ("shrubs", shrub_sources, 92, (0.38, 0.88), 1.45),
        ("moss", moss_sources, 210, (0.55, 1.6), 1.75),
        ("rocks", rock_sources, 58, (0.55, 1.9), 2.8),
        ("mossRocks", moss_rock_sources, 82, (0.42, 1.35), 2.1),
    )
    for key, sources, count, scale_range, max_slope in scatter_specs:
        render_collection = geology if "rock" in key.lower() else ground
        made = 0
        attempts = 0
        while made < count and attempts < count * 70:
            attempts += 1
            near = rng.random() < 0.76
            z = (75.0 - rng.random() * 98.0) if near else (18.0 - rng.random() * 76.0)
            x = (rng.random() * 2.0 - 1.0) * (22.0 + rng.random() * 69.0)
            height = ridge_height(x, z)
            slope = surface_slope(x, z)
            moisture = fbm(x * 0.052 - 3.0, z * 0.052 + 9.0, 4)
            central_track = z > 22.0 and abs(x) < 3.4
            rock_rule = "rock" in key.lower() and (slope > 0.42 or moisture < 0.47)
            plant_rule = "rock" not in key.lower() and moisture > 0.36
            if slope > max_slope or central_track or height < -4.0 or not (rock_rule or plant_rule):
                continue
            variant = int(rng.random() * len(sources))
            base = mix(scale_range[0], scale_range[1], rng.random())
            scale = (base * (0.82 + rng.random() * 0.34), base * (0.82 + rng.random() * 0.34), base)
            rotation = rng.random() * math.tau
            linked_copy(sources[variant], render_collection, f"{key} {made + 1:03d}", (x, z, height - 0.025), scale, rotation)
            placements[key].append(placement_record(x, z, scale, rotation, variant))
            made += 1

    for source in (*tree_sources, *fern_sources, *shrub_sources, *moss_sources, *rock_sources, *moss_rock_sources):
        bpy.data.objects.remove(source, do_unlink=True)
    return placements


def add_deadwood_and_roots() -> None:
    target = collection("RIDGE_AUTHORED_ROOTS_AND_DEADWOOD")
    material = bpy.data.materials.new("Damp root and deadwood")
    material.diffuse_color = (0.055, 0.025, 0.012, 1.0)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (0.055, 0.025, 0.012, 1.0)
    shader.inputs["Roughness"].default_value = 1.0
    rng = random.Random(110077)
    for index in range(28):
        x = (rng.random() * 2.0 - 1.0) * 38.0
        z = 67.0 - rng.random() * 73.0
        height = ridge_height(x, z)
        curve_data = bpy.data.curves.new(f"Root curve {index + 1:02d}", type="CURVE")
        curve_data.dimensions = "3D"
        curve_data.bevel_depth = 0.045 + rng.random() * 0.055
        curve_data.bevel_resolution = 2
        curve_data.resolution_u = 3
        spline = curve_data.splines.new("POLY")
        spline.points.add(7)
        length = 1.4 + rng.random() * 3.8
        angle = rng.random() * math.tau
        for point_index, point in enumerate(spline.points):
            amount = point_index / 7.0
            px = x + math.cos(angle) * length * amount + math.sin(amount * math.pi * 2 + index) * 0.14
            pz = z + math.sin(angle) * length * amount
            point.co = (px, pz, ridge_height(px, pz) - 0.018 + math.sin(amount * math.pi) * 0.018, 1.0)
        curve = bpy.data.objects.new(f"Exposed root {index + 1:02d}", curve_data)
        target.objects.link(curve)
        curve.data.materials.append(material)


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


CAMERA_KEYS = (
    (1, (0.0, 111.0, 55.0), (0.0, 7.0, 16.0), 47.0),
    (112, (-4.0, 70.0, 44.0), (0.0, 5.0, 18.0), 50.0),
    (224, (1.5, 38.0, 40.0), (2.0, -12.0, 14.5), 53.0),
    (336, (7.0, 15.0, 46.0), (4.0, -82.0, 5.0), 56.0),
)


def configure_camera() -> bpy.types.Object:
    bpy.ops.object.camera_add(location=CAMERA_KEYS[0][1])
    camera = bpy.context.object
    camera.name = "CAM_RIDGE_DRONE_SHOT_V110"
    camera.data.clip_start = 0.1
    camera.data.clip_end = 850.0
    for frame, location, target, lens in CAMERA_KEYS:
        camera.location = location
        camera.data.lens = lens
        look_at(camera, Vector(target))
        camera.keyframe_insert(data_path="location", frame=frame)
        camera.keyframe_insert(data_path="rotation_euler", frame=frame)
        camera.data.keyframe_insert(data_path="lens", frame=frame)
    camera["shot_duration_seconds"] = 14.0
    camera["shot_intent"] = "High drone approach, crest rise, partial valley glimpse"
    bpy.context.scene.camera = camera
    return camera


def configure_scene() -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.fps = 24
    scene.frame_start = 1
    scene.frame_end = 336
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -0.08

    world = bpy.data.worlds.new("Ridge warm physical sky")
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputWorld")
    background = nodes.new("ShaderNodeBackground")
    background.inputs["Strength"].default_value = 0.34
    sky = nodes.new("ShaderNodeTexSky")
    sky.sky_type = "MULTIPLE_SCATTERING"
    sky.sun_elevation = math.radians(14.5)
    sky.sun_rotation = math.radians(242.0)
    sky.air_density = 1.05
    sky.aerosol_density = 1.8
    sky.ozone_density = 1.0
    links.new(sky.outputs["Color"], background.inputs["Color"])
    links.new(background.outputs["Background"], output.inputs["Surface"])
    scene.world = world

    bpy.ops.object.light_add(type="SUN", location=(-80.0, 45.0, 70.0))
    sun = bpy.context.object
    sun.name = "Ridge golden-hour west key"
    sun.data.energy = 1.65
    sun.data.color = (1.0, 0.69, 0.45)
    sun.data.angle = math.radians(2.6)
    sun.rotation_euler = (math.radians(48.0), math.radians(-22.0), math.radians(-62.0))

    bpy.ops.object.light_add(type="AREA", location=(28.0, 42.0, 62.0))
    fill = bpy.context.object
    fill.name = "Cool humid sky fill"
    fill.data.energy = 1100.0
    fill.data.shape = "DISK"
    fill.data.size = 48.0
    fill.data.color = (0.42, 0.62, 0.72)
    look_at(fill, Vector((0.0, 10.0, 12.0)))

    scene["madagin_version"] = "v1.10-ridge-production-benchmark"
    scene["reference_board"] = "docs/design/2026-08-19-madagin-ridge-production-benchmark-v1.10.md"
    scene["asset_license"] = "Poly Haven CC0; see adjacent provenance files"
    scene["public_release"] = False


def export_terrain_lod(obj: bpy.types.Object, filename: str) -> None:
    was_hidden_viewport = obj.hide_viewport
    was_hidden_render = obj.hide_render
    obj.hide_viewport = False
    obj.hide_render = False
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    materials = list(obj.data.materials)
    obj.data.materials.clear()
    bpy.ops.export_scene.gltf(
        filepath=str(PUBLIC_ROOT / filename),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_extras=True,
        export_cameras=False,
        export_lights=False,
        export_materials="NONE",
    )
    for material in materials:
        obj.data.materials.append(material)
    obj.hide_viewport = was_hidden_viewport
    obj.hide_render = was_hidden_render


def render_review(camera: bpy.types.Object) -> None:
    frames = (1, 168, 336) if ITERATION >= 3 else (1,)
    labels = {1: "opening", 168: "approach", 336: "crest-glimpse"}
    bpy.context.scene.camera = camera
    for frame in frames:
        bpy.context.scene.frame_set(frame)
        bpy.context.scene.render.filepath = str(
            ARTIFACT_ROOT / f"lookdev-iteration-{ITERATION:02d}-{labels[frame]}.png"
        )
        bpy.ops.render.render(write_still=True)


def main() -> None:
    PUBLIC_ROOT.mkdir(parents=True, exist_ok=True)
    SOURCE_ROOT.mkdir(parents=True, exist_ok=True)
    ARTIFACT_ROOT.mkdir(parents=True, exist_ok=True)
    reset_scene()
    terrain_collection = collection("RIDGE_TERRAIN_LODS")
    terrain_high = build_terrain("RIDGE_TERRAIN_LOD0_HIGH", 241, 255, terrain_collection)
    terrain_balanced = build_terrain("RIDGE_TERRAIN_LOD1_BALANCED", 169, 179, terrain_collection)
    terrain_mobile = build_terrain("RIDGE_TERRAIN_LOD2_MOBILE", 113, 119, terrain_collection)
    terrain_high.data.materials.append(terrain_material())
    terrain_balanced.hide_render = True
    terrain_balanced.hide_viewport = True
    terrain_mobile.hide_render = True
    terrain_mobile.hide_viewport = True
    placements = scatter_assets()
    add_deadwood_and_roots()
    configure_scene()
    camera = configure_camera()
    PLACEMENT_PATH.write_text(json.dumps({
        "version": "1.10",
        "coordinateSystem": "three-y-up",
        "cameraKeys": [
            {"frame": frame, "position": [location[0], location[2], -location[1]], "lookAt": [target[0], target[2], -target[1]], "lens": lens}
            for frame, location, target, lens in CAMERA_KEYS
        ],
        "layers": placements,
    }, indent=2), encoding="utf-8")
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH), check_existing=False)
    export_terrain_lod(terrain_high, "madagin-ridge-terrain-high-v1.10.glb")
    export_terrain_lod(terrain_balanced, "madagin-ridge-terrain-balanced-v1.10.glb")
    export_terrain_lod(terrain_mobile, "madagin-ridge-terrain-mobile-v1.10.glb")
    render_review(camera)
    print(f"BLEND={BLEND_PATH}")
    print(f"PLACEMENTS={PLACEMENT_PATH}")
    for filename in (
        "madagin-ridge-terrain-high-v1.10.glb",
        "madagin-ridge-terrain-balanced-v1.10.glb",
        "madagin-ridge-terrain-mobile-v1.10.glb",
    ):
        path = PUBLIC_ROOT / filename
        print(f"GLB={path} BYTES={path.stat().st_size}")


if __name__ == "__main__":
    main()
