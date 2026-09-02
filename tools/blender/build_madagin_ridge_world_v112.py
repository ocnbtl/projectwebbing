"""Build the Madagin Ridge v1.12 elevation, Valley, water, and placement system.

The near Ridge retains the documented USGS 3DEP height foundation. The far
Valley is a single authored heightfield with converging ridges and drainage,
not scaled/extruded copies of the Ridge boundary. All triangle winding is
generated counter-clockwise for a single-sided web renderer.
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
PUBLIC_ROOT = ROOT / "public" / "world" / "v112"
SOURCE_ROOT = ROOT / "world-source"
ARTIFACT_ROOT = ROOT / "artifacts" / "ridge-v112"
HEIGHTMAP = SOURCE_ROOT / "dem" / "usgs-3dep-n23w160" / "madagin-ridge-dem-source-v1.11.png"
CANOPY_BLEND = SOURCE_ROOT / "madagin-ridge-canopy-library-v1.12.blend"
BLEND_PATH = SOURCE_ROOT / "madagin-ridge-world-v1.12.blend"
MANIFEST_PATH = PUBLIC_ROOT / "madagin-ridge-canopy-placement-v1.12.json"

RIDGE_WIDTH = 520.0
RIDGE_NEAR_Z = 235.0
RIDGE_FAR_Z = -275.0
VALLEY_WIDTH = 1320.0
VALLEY_FAR_Z = -1180.0
ELEVATION_SCALE = 0.028
ELEVATION_BASE = 520.0
CELL_SIZE = 320.0
SEED = 112_190_819

CAMERA_KEYS = (
    ("opening", (176.0, 112.0, 250.0), (90.0, 17.0, -135.0), 46.0),
    ("approach", (151.0, 105.0, 146.0), (73.0, 1.0, -305.0), 49.0),
    ("crest", (119.0, 118.0, 48.0), (32.0, -31.0, -570.0), 52.0),
    ("reveal", (92.0, 126.0, -24.0), (8.0, -42.0, -825.0), 55.0),
)

ITERATION_PROFILES = {
    1: {"erosion": 0.74, "valley_relief": 0.82, "canopy": 0.86, "sun": 2.1, "haze": 0.68},
    2: {"erosion": 0.9, "valley_relief": 0.94, "canopy": 0.96, "sun": 2.35, "haze": 0.58},
    3: {"erosion": 1.04, "valley_relief": 1.05, "canopy": 1.08, "sun": 2.6, "haze": 0.49},
    4: {"erosion": 1.13, "valley_relief": 1.12, "canopy": 1.12, "sun": 2.75, "haze": 0.43},
    5: {"erosion": 1.18, "valley_relief": 1.18, "canopy": 1.14, "sun": 2.9, "haze": 0.39},
}


def cli_iteration() -> int:
    for argument in sys.argv:
        if argument.startswith("--iteration="):
            return max(1, min(5, int(argument.split("=", 1)[1])))
    return 5


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


def fractal_noise(x: float, z: float, octaves: int = 4) -> float:
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
    progress = clamp(
        (RIDGE_FAR_Z - z) / (RIDGE_FAR_Z - VALLEY_FAR_Z),
        0.0,
        1.0,
    )
    return 42.0 + math.sin((z + 90.0) * 0.011) * (28.0 + progress * 72.0) + math.sin(z * 0.027) * 9.0


def ridge_height(x: float, z: float) -> float:
    elevation = dem_sample(x, z)
    base = (elevation - ELEVATION_BASE) * ELEVATION_SCALE
    macro = fractal_noise(x * 0.018 + 8.0, z * 0.018 - 3.0, 4) * 2.1
    meso = fractal_noise(x * 0.074 - 2.0, z * 0.074 + 6.0, 3) * 0.72 * PROFILE["erosion"]
    center = 72.0 + math.sin((z + 80.0) * 0.018) * 21.0
    drainage = math.exp(-((x - center) / 25.0) ** 2) * smoothstep(-248.0, 42.0, -z) * 10.8
    gully_center = -72.0 + math.sin((z - 30.0) * 0.024) * 13.0
    gully = math.exp(-((x - gully_center) / 8.5) ** 2) * smoothstep(-150.0, 90.0, -z) * 4.6 * PROFILE["erosion"]
    saddle = math.exp(-((x - 16.0) / 54.0) ** 2 - ((z + 95.0) / 42.0) ** 2) * 5.4
    wet_face = math.exp(-((x - 126.0) / 38.0) ** 2 - ((z + 18.0) / 56.0) ** 2) * 3.6
    return base + macro + meso - drainage - gully - saddle - wet_face


def valley_height(x: float, z: float) -> float:
    progress = clamp((RIDGE_FAR_Z - z) / (RIDGE_FAR_Z - VALLEY_FAR_Z), 0.0, 1.0)
    center = river_center(z)
    distance = abs(x - center)
    floor = -42.0 - progress * 10.0
    basin = floor + (distance / 72.0) ** 1.32 * (4.7 + progress * 0.9)

    left_axis = -330.0 + math.sin(z * 0.006 + 0.4) * 115.0
    right_axis = 360.0 + math.sin(z * 0.007 - 0.8) * 105.0
    left_mass = math.exp(-((x - left_axis) / (145.0 + progress * 52.0)) ** 2) * (62.0 + progress * 44.0)
    right_mass = math.exp(-((x - right_axis) / (155.0 + progress * 46.0)) ** 2) * (74.0 + progress * 38.0)
    spur_a = math.exp(-((x + 115.0 + math.sin(z * 0.015) * 42.0) / 74.0) ** 2) * smoothstep(0.18, 0.82, progress) * 34.0
    spur_b = math.exp(-((x - 185.0 + math.sin(z * 0.012 + 1.4) * 56.0) / 84.0) ** 2) * smoothstep(0.28, 0.94, progress) * 29.0
    far_massif = smoothstep(0.62, 1.0, progress) * (
        math.exp(-((x + 440.0) / 185.0) ** 2) * 58.0
        + math.exp(-((x - 480.0) / 210.0) ** 2) * 72.0
        + math.exp(-((x - 35.0) / 260.0) ** 2) * 24.0
    )
    # Offset, depth-localized shoulders create nested watersheds instead of
    # two continuous valley walls or repeated horizontal ribbon bands.
    near_fold = math.exp(-((z + 505.0) / 125.0) ** 2) * (
        math.exp(-((x + 225.0) / 128.0) ** 2) * 42.0
        + math.exp(-((x - 310.0) / 154.0) ** 2) * 31.0
    )
    middle_fold = math.exp(-((z + 735.0) / 145.0) ** 2) * (
        math.exp(-((x - 165.0) / 142.0) ** 2) * 48.0
        + math.exp(-((x + 370.0) / 175.0) ** 2) * 36.0
    )
    distant_fold = math.exp(-((z + 995.0) / 165.0) ** 2) * (
        math.exp(-((x + 90.0) / 182.0) ** 2) * 53.0
        + math.exp(-((x - 455.0) / 198.0) ** 2) * 41.0
    )
    geology = fractal_noise(x * 0.012 + 31.0, z * 0.012 - 17.0, 5) * (13.0 + progress * 18.0)
    ridged = abs(fractal_noise(x * 0.024 - 11.0, z * 0.019 + 24.0, 4)) * (9.0 + progress * 11.0)
    drainage = math.exp(-((x - center) / (10.0 + progress * 7.0)) ** 2) * 5.4
    authored = basin + (
        left_mass + right_mass + spur_a + spur_b + far_massif
        + near_fold + middle_fold + distant_fold + geology + ridged
    ) * PROFILE["valley_relief"] - drainage

    edge_x = clamp(x, -RIDGE_WIDTH * 0.5, RIDGE_WIDTH * 0.5)
    edge = ridge_height(edge_x, RIDGE_FAR_Z)
    blend = smoothstep(0.0, 0.14, progress)
    return edge * (1.0 - blend) + authored * blend


def world_height(x: float, z: float) -> float:
    return ridge_height(x, z) if z >= RIDGE_FAR_Z else valley_height(x, z)


def surface_metrics(x: float, z: float) -> dict[str, float]:
    step = 2.2 if z >= RIDGE_FAR_Z else 5.0
    center = world_height(x, z)
    dx = (world_height(x + step, z) - world_height(x - step, z)) / (step * 2.0)
    dz = (world_height(x, z + step) - world_height(x, z - step)) / (step * 2.0)
    slope = math.hypot(dx, dz)
    curvature = (
        world_height(x + step, z) + world_height(x - step, z)
        + world_height(x, z + step) + world_height(x, z - step) - center * 4.0
    ) / (step * step)
    drainage = math.exp(-((x - river_center(z)) / (15.0 if z >= RIDGE_FAR_Z else 24.0)) ** 2)
    exposure = clamp(smoothstep(0.34, 1.25, slope) + smoothstep(25.0, 63.0, center) * 0.28, 0.0, 1.0)
    moisture = clamp(drainage * 0.72 + smoothstep(-0.02, 0.22, -curvature) * 0.38, 0.0, 1.0)
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


def terrain_material(name: str, valley: bool = False) -> bpy.types.Material:
    """Procedural macro/micro breakup used only for Blender look development.

    The web renderer rebuilds the same slope/soil/moss idea in GLSL, avoiding
    a multi-megabyte terrain texture transfer and visible image tiling.
    """
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    nodes = result.node_tree.nodes
    links = result.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    coordinate = nodes.new("ShaderNodeTexCoord")
    macro = nodes.new("ShaderNodeTexNoise")
    macro.inputs["Scale"].default_value = 7.5 if valley else 10.5
    macro.inputs["Detail"].default_value = 7.0
    macro.inputs["Roughness"].default_value = 0.7
    macro.inputs["Distortion"].default_value = 0.28
    ramp = nodes.new("ShaderNodeValToRGB")
    colors = (
        (
            (0.01, 0.022, 0.007, 1.0),
            (0.035, 0.071, 0.019, 1.0),
            (0.082, 0.145, 0.034, 1.0),
            (0.16, 0.092, 0.026, 1.0),
        )
        if not valley
        else (
            (0.007, 0.017, 0.01, 1.0),
            (0.022, 0.052, 0.022, 1.0),
            (0.052, 0.11, 0.041, 1.0),
            (0.11, 0.12, 0.039, 1.0),
        )
    )
    ramp.color_ramp.elements[0].position = 0.18
    ramp.color_ramp.elements[0].color = colors[0]
    middle_a = ramp.color_ramp.elements.new(0.43)
    middle_a.color = colors[1]
    middle_b = ramp.color_ramp.elements.new(0.68)
    middle_b.color = colors[2]
    ramp.color_ramp.elements[-1].position = 0.88
    ramp.color_ramp.elements[-1].color = colors[3]
    geometry = nodes.new("ShaderNodeNewGeometry")
    dot = nodes.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    dot.inputs[1].default_value = (0.0, 0.0, 1.0)
    slope = nodes.new("ShaderNodeMapRange")
    slope.clamp = True
    slope.inputs["From Min"].default_value = 0.34
    slope.inputs["From Max"].default_value = 0.82
    slope.inputs["To Min"].default_value = 1.0
    slope.inputs["To Max"].default_value = 0.0
    mix = nodes.new("ShaderNodeMixRGB")
    mix.blend_type = "MIX"
    mix.inputs[2].default_value = (0.024, 0.029, 0.022, 1.0) if not valley else (0.018, 0.025, 0.022, 1.0)
    micro = nodes.new("ShaderNodeTexNoise")
    micro.inputs["Scale"].default_value = 52.0
    micro.inputs["Detail"].default_value = 5.0
    micro.inputs["Roughness"].default_value = 0.76
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.22 if not valley else 0.12
    bump.inputs["Distance"].default_value = 0.34
    shader.inputs["Roughness"].default_value = 0.93
    links.new(coordinate.outputs["Generated"], macro.inputs["Vector"])
    links.new(macro.outputs["Fac"], ramp.inputs["Fac"])
    links.new(geometry.outputs["Normal"], dot.inputs[0])
    links.new(dot.outputs["Value"], slope.inputs["Value"])
    links.new(slope.outputs["Result"], mix.inputs[0])
    links.new(ramp.outputs["Color"], mix.inputs[1])
    links.new(mix.outputs["Color"], shader.inputs["Base Color"])
    links.new(coordinate.outputs["Generated"], micro.inputs["Vector"])
    links.new(micro.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    result.diffuse_color = colors[1]
    return result


def deep_water_material() -> bpy.types.Material:
    result = material("v112 deep humid river water", (0.002, 0.012, 0.011, 1.0), 0.31, 0.04)
    nodes = result.node_tree.nodes
    links = result.node_tree.links
    shader = nodes.get("Principled BSDF")
    coordinate = nodes.new("ShaderNodeTexCoord")
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 18.0
    noise.inputs["Detail"].default_value = 4.2
    noise.inputs["Roughness"].default_value = 0.62
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.16
    bump.inputs["Distance"].default_value = 0.2
    if shader:
        links.new(coordinate.outputs["Generated"], noise.inputs["Vector"])
        links.new(noise.outputs["Fac"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    return result


def build_heightfield(
    name: str,
    columns: int,
    rows: int,
    x_min: float,
    x_max: float,
    z_near: float,
    z_far: float,
    height_function,
    target: bpy.types.Collection,
    surface_material: bpy.types.Material,
) -> bpy.types.Object:
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int]] = []
    uvs: list[tuple[float, float]] = []
    for row in range(rows):
        z = z_near + (z_far - z_near) * row / (rows - 1)
        for column in range(columns):
            x = x_min + (x_max - x_min) * column / (columns - 1)
            vertices.append((x, -z, height_function(x, z)))
            uvs.append((column / (columns - 1), row / (rows - 1)))
    for row in range(rows - 1):
        for column in range(columns - 1):
            a = row * columns + column
            b = a + 1
            c = a + columns + 1
            d = a + columns
            # Explicit counter-clockwise triangles eliminate glTF/browser
            # disagreements over highly non-planar quad diagonals. V1.11 used
            # inverse winding and therefore required DoubleSide in browsers.
            if (row + column) % 2 == 0:
                faces.extend(((a, b, c), (a, c, d)))
            else:
                faces.extend(((a, b, d), (b, c, d)))
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
    result["madagin_version"] = "v1.12"
    return result


def build_water(target: bpy.types.Collection, water_material: bpy.types.Material) -> bpy.types.Object:
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int]] = []
    samples = 112
    for index in range(samples):
        z = -112.0 + (VALLEY_FAR_Z + 112.0) * index / (samples - 1)
        center = river_center(z)
        progress = clamp((RIDGE_FAR_Z - z) / (RIDGE_FAR_Z - VALLEY_FAR_Z), 0.0, 1.0)
        lake = math.exp(-((z + 805.0) / 118.0) ** 2)
        width = 1.35 + progress * 2.25 + lake * 8.0 + math.sin(z * 0.034) * 0.42
        height = world_height(center, z) + 0.7
        tangent = river_center(z - 2.0) - river_center(z + 2.0)
        normal = Vector((1.0, tangent * 0.25)).normalized()
        vertices.extend((
            (center - normal.x * width, -z + normal.y * width, height),
            (center + normal.x * width, -z - normal.y * width, height),
        ))
        if index > 0:
            a = (index - 1) * 2
            faces.extend(((a, a + 1, a + 3), (a, a + 3, a + 2)))
    mesh = bpy.data.meshes.new("RIDGE_V112_RIVER_AND_LAKE")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    result = bpy.data.objects.new("RIDGE_V112_RIVER_AND_LAKE", mesh)
    target.objects.link(result)
    result.data.materials.append(water_material)
    return result


def build_hero_geology(target: bpy.types.Collection, rock_material: bpy.types.Material) -> list[bpy.types.Object]:
    formations = (
        ("BASALT_OUTCROP", (114.0, 45.0), (18.0, 8.0, 7.0), 0.35),
        ("MOSSY_ROCK_SHELF", (-58.0, -18.0), (16.0, 11.0, 4.2), -0.22),
        ("WET_EXPOSED_FACE", (136.0, -42.0), (13.0, 8.0, 9.0), 0.72),
        ("SADDLE_STONE", (18.0, -104.0), (11.0, 6.0, 5.2), -0.48),
        ("GULLY_ROOT_ROCK", (-73.0, -86.0), (9.0, 7.0, 4.8), 0.18),
    )
    result = []
    for name, (x, z), scale, rotation in formations:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0)
        obj = bpy.context.object
        obj.name = f"RIDGE_V112_{name}"
        obj.location = (x, -z, world_height(x, z) + scale[2] * 0.18)
        obj.scale = scale
        obj.rotation_euler = (0.18 + rotation * 0.21, rotation * 0.14, rotation)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        for vertex in obj.data.vertices:
            factor = 0.86 + value_noise(vertex.co.x * 0.41 + len(name), vertex.co.y * 0.37) * 0.28
            vertex.co *= factor
        for owner in list(obj.users_collection):
            owner.objects.unlink(obj)
        target.objects.link(obj)
        obj.data.materials.append(rock_material)
        result.append(obj)
    return result


def distance_to_camera_path(x: float, z: float) -> float:
    return min(math.hypot(x - position[0], z - position[2]) for _, position, _, _ in CAMERA_KEYS)


def community_for(x: float, z: float, metrics: dict[str, float]) -> str:
    if z < RIDGE_FAR_Z:
        return "valley-ridge" if metrics["exposure"] > 0.58 else "valley-sheltered"
    if metrics["drainage"] > 0.42:
        return "gully"
    if metrics["exposure"] > 0.58 or metrics["height"] > 23.0:
        return "crest"
    if z > 60.0:
        return "lower-slope"
    return "sheltered-slope"


def cluster_choice(community: str, patch: float, index: int) -> int:
    options = {
        "crest": (3, 6, 1, 3, 7),
        "gully": (2, 4, 0, 2, 5),
        "lower-slope": (0, 4, 5, 0, 1),
        "sheltered-slope": (4, 0, 1, 5, 2),
        "valley-ridge": (3, 6, 7, 1, 3),
        "valley-sheltered": (4, 2, 5, 0, 7),
    }[community]
    return options[(index + int(patch * 7.0)) % len(options)]


def near_choice(community: str, index: int) -> str:
    options = {
        "crest": ("island02_wind", "island03_crest", "island03_low"),
        "gully": ("island01_spreader", "pachira_broad", "island02_multitrunk"),
        "lower-slope": ("pachira_broad", "pachira_secondary", "small02_upright"),
        "sheltered-slope": ("island01_sheltered", "pachira_emergent", "island02_multitrunk"),
        "valley-ridge": ("island03_crest", "pachira_emergent", "island02_wind"),
        "valley-sheltered": ("island01_sheltered", "pachira_broad", "island02_multitrunk"),
    }[community]
    return options[index % len(options)]


def create_canopy_manifest() -> dict:
    rng = random.Random(SEED)
    clusters = []
    near = []
    index = 0
    for region in ("ridge", "valley"):
        spacing = 16.8 if region == "ridge" else 31.0
        z_near = RIDGE_NEAR_Z - 8.0 if region == "ridge" else RIDGE_FAR_Z - 18.0
        z_far = RIDGE_FAR_Z + 8.0 if region == "ridge" else VALLEY_FAR_Z + 54.0
        width = RIDGE_WIDTH - 18.0 if region == "ridge" else VALLEY_WIDTH - 70.0
        z = z_near
        while z >= z_far:
            x = -width * 0.5
            while x <= width * 0.5:
                px = x + rng.uniform(-spacing * 0.43, spacing * 0.43)
                pz = z + rng.uniform(-spacing * 0.43, spacing * 0.43)
                metrics = surface_metrics(px, pz)
                community = community_for(px, pz, metrics)
                patch = value_noise(px * 0.018 + 16.0, pz * 0.018 - 9.0)
                disturbance = metrics["exposure"] * 0.42 + metrics["drainage"] * 0.24
                retention = (0.82 + patch * 0.2) * (1.0 - disturbance * 0.54)
                if region == "valley":
                    retention *= 0.58 + smoothstep(25.0, 90.0, metrics["height"]) * 0.32
                if rng.random() < retention and metrics["slope"] < 2.7:
                    key = cluster_choice(community, patch, index)
                    local_scale = (0.84 + rng.random() * 0.46) * PROFILE["canopy"]
                    wind = clamp(metrics["exposure"] + smoothstep(16.0, 40.0, metrics["height"]) * 0.28, 0.0, 1.0)
                    cell_x = math.floor((px + VALLEY_WIDTH * 0.5) / CELL_SIZE)
                    cell_z = math.floor((pz - VALLEY_FAR_Z) / CELL_SIZE)
                    clusters.append({
                        "id": index,
                        "source": f"cluster_{key:02d}",
                        "community": community,
                        "cell": f"{cell_x}:{cell_z}",
                        "x": round(px, 3),
                        "y": round(metrics["height"] - 1.5, 3),
                        "z": round(pz, 3),
                        "rotation": round(rng.random() * math.tau, 5),
                        "scale": [
                            round(local_scale * (1.0 + wind * 0.18), 3),
                            round(local_scale * (0.88 + rng.random() * 0.28), 3),
                            round(local_scale * (0.92 - wind * 0.12), 3),
                        ],
                        "hue": round(rng.uniform(-0.085, 0.065) + metrics["moisture"] * 0.035, 4),
                        "occlusion": round(0.64 + rng.random() * 0.28, 3),
                    })
                    index += 1
                x += spacing
            z -= spacing

    candidates = [placement for placement in clusters if placement["z"] > -215.0 and distance_to_camera_path(placement["x"], placement["z"]) < 145.0]
    candidates.sort(key=lambda placement: (distance_to_camera_path(placement["x"], placement["z"]), placement["id"]))
    for near_index, placement in enumerate(candidates[:64]):
        community = placement["community"]
        key = near_choice(community, near_index)
        near.append({
            **placement,
            "id": near_index,
            "clusterId": placement["id"],
            "source": key,
            "x": round(placement["x"] + rng.uniform(-3.2, 3.2), 3),
            "z": round(placement["z"] + rng.uniform(-3.2, 3.2), 3),
            "y": round(world_height(placement["x"], placement["z"]) - 0.72, 3),
            "scale": [round(value * (0.72 + rng.random() * 0.3), 3) for value in placement["scale"]],
        })

    source_counts: dict[str, int] = {}
    community_counts: dict[str, int] = {}
    for placement in clusters:
        source_counts[placement["source"]] = source_counts.get(placement["source"], 0) + 1
        community_counts[placement["community"]] = community_counts.get(placement["community"], 0) + 1
    near_counts: dict[str, int] = {}
    for placement in near:
        near_counts[placement["source"]] = near_counts.get(placement["source"], 0) + 1
    return {
        "version": "v1.12-ridge-canopy-system",
        "seed": SEED,
        "terrain": {
            "nearSource": "USGS 3DEP n23w160 DEM crop plus bounded Ridge art direction",
            "farSource": "single continuous authored heightfield blended from the DEM edge",
            "ridgeBounds": {"width": RIDGE_WIDTH, "nearZ": RIDGE_NEAR_Z, "farZ": RIDGE_FAR_Z},
            "valleyBounds": {"width": VALLEY_WIDTH, "nearZ": RIDGE_FAR_Z, "farZ": VALLEY_FAR_Z},
        },
        "cellSize": CELL_SIZE,
        "camera": [
            {"name": name, "position": position, "lookAt": look_at, "lensMm": lens}
            for name, position, look_at, lens in CAMERA_KEYS
        ],
        "coverage": {
            "clusterCount": len(clusters),
            "nearEnhancementCount": len(near),
            "sourceCounts": source_counts,
            "nearSourceCounts": near_counts,
            "communityCounts": community_counts,
            "note": "Clusters contain several overlapping crown volumes; counts are reusable cluster transforms, not individual-tree claims.",
        },
        "clusters": clusters,
        "near": near,
    }


def append_canopy_sources() -> dict[str, bpy.types.Object]:
    with bpy.data.libraries.load(str(CANOPY_BLEND), link=False) as (available, selected):
        selected.objects = [
            name for name in available.objects
            if name.startswith("cluster_") or (name.startswith("canopy_") and name.endswith("_near"))
        ]
    result = {}
    for obj in selected.objects:
        if obj is None:
            continue
        bpy.context.scene.collection.objects.link(obj)
        obj.hide_render = True
        obj.hide_viewport = True
        result[obj.name.replace("canopy_", "").replace("_near", "")] = obj
    return result


def populate_lookdev(manifest: dict, sources: dict[str, bpy.types.Object], target: bpy.types.Collection) -> None:
    for placement in manifest["clusters"]:
        # The Ridge requires overlapping crowns; sparse samples made every
        # reusable cluster read as a separate topiary ball in iteration 01.
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
        mass = 1.34 if placement["z"] < RIDGE_FAR_Z else 1.1
        copy.scale = (
            placement["scale"][0] * mass,
            placement["scale"][1] * mass,
            placement["scale"][2],
        )
    for placement in manifest["near"]:
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
    scene.view_settings.exposure = 0.82
    scene.world.use_nodes = True
    world_nodes = scene.world.node_tree.nodes
    world_links = scene.world.node_tree.links
    world_nodes.clear()
    output = world_nodes.new("ShaderNodeOutputWorld")
    background = world_nodes.new("ShaderNodeBackground")
    # Blender 5.2 Eevee currently renders procedural world-coordinate and
    # volume combinations black in background mode. Keep this review sky
    # bounded and deterministic; the browser owns the actual sky shader.
    background.inputs["Color"].default_value = (0.055, 0.13, 0.24, 1.0)
    background.inputs["Strength"].default_value = 0.88
    world_links.new(background.outputs["Background"], output.inputs["Surface"])

    bpy.ops.object.light_add(type="SUN", location=(-180.0, -120.0, 210.0))
    sun = bpy.context.object
    sun.name = "V112 directional golden-hour sun"
    sun.data.energy = PROFILE["sun"]
    sun.data.color = (1.0, 0.67, 0.39)
    sun.data.angle = math.radians(5.8)
    sun.rotation_euler = (math.radians(54.0), math.radians(-14.0), math.radians(-122.0))
    bpy.ops.object.light_add(type="AREA", location=(10.0, -30.0, 250.0))
    fill = bpy.context.object
    fill.data.energy = 760.0
    fill.data.color = (0.26, 0.38, 0.5)
    fill.data.size = 220.0
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.name = "CAM_RIDGE_V112"
    camera.data.sensor_width = 36.0
    camera.data.clip_start = 0.25
    camera.data.clip_end = 1800.0
    scene.camera = camera
    return camera


def export_world(objects: list[bpy.types.Object], filename: str) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_viewport = False
        obj.hide_render = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(PUBLIC_ROOT / filename),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_attributes=False,
        export_cameras=False,
        export_lights=False,
        export_materials="EXPORT",
        export_meshopt_compression_enable=True,
        export_meshopt_extension="EXT_meshopt_compression",
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_yup=True,
    )
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
        output = ARTIFACT_ROOT / f"iteration-{ITERATION:02d}-{name}.png"
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
        print(f"RENDER={output} BYTES={output.stat().st_size}")

    lookdev = bpy.data.collections.get("RIDGE_V112_LOOKDEV_CANOPY")
    if lookdev:
        for obj in lookdev.objects:
            obj.hide_render = True
    close_x = 143.0
    close_z = 28.0
    camera.location = (close_x, -close_z, world_height(close_x, close_z) + 60.0)
    camera.data.lens = 52
    target_x = 116.0
    target_z = 2.0
    look_at(camera, (target_x, world_height(target_x, target_z) - 0.8, target_z))
    scene.render.filepath = str(ARTIFACT_ROOT / f"iteration-{ITERATION:02d}-terrain-material-closeup.png")
    bpy.ops.render.render(write_still=True)
    if lookdev:
        for obj in lookdev.objects:
            obj.hide_render = False


def main() -> None:
    PUBLIC_ROOT.mkdir(parents=True, exist_ok=True)
    ARTIFACT_ROOT.mkdir(parents=True, exist_ok=True)
    reset_scene()
    terrain_collection = new_collection("RIDGE_V112_TERRAIN")
    lookdev_collection = new_collection("RIDGE_V112_LOOKDEV_CANOPY")
    cloud_collection = new_collection("RIDGE_V112_CLOUDS")
    ridge_material = terrain_material("v112 damp soil moss leaf litter basalt")
    valley_material = terrain_material("v112 distant volcanic valley", valley=True)
    rock_material = material("v112 wet weathered basalt", (0.055, 0.062, 0.057, 1.0), 0.68)
    water_material = deep_water_material()

    levels = {
        "critical": ((97, 89), (73, 61)),
        "balanced": ((145, 133), (113, 93)),
        "high": ((181, 165), (137, 113)),
    }
    terrain_levels: dict[str, list[bpy.types.Object]] = {}
    for level, ((ridge_columns, ridge_rows), (valley_columns, valley_rows)) in levels.items():
        ridge = build_heightfield(
            f"RIDGE_V112_{level.upper()}", ridge_columns, ridge_rows,
            -RIDGE_WIDTH * 0.5, RIDGE_WIDTH * 0.5, RIDGE_NEAR_Z, RIDGE_FAR_Z,
            ridge_height, terrain_collection, ridge_material,
        )
        valley = build_heightfield(
            f"VALLEY_V112_{level.upper()}", valley_columns, valley_rows,
            -VALLEY_WIDTH * 0.5, VALLEY_WIDTH * 0.5, RIDGE_FAR_Z, VALLEY_FAR_Z,
            valley_height, terrain_collection, valley_material,
        )
        terrain_levels[level] = [ridge, valley]
        ridge.hide_render = level != "high"
        ridge.hide_viewport = level != "high"
        valley.hide_render = level != "high"
        valley.hide_viewport = level != "high"

    water = build_water(terrain_collection, water_material)
    rocks = build_hero_geology(terrain_collection, rock_material)
    manifest = create_canopy_manifest()
    MANIFEST_PATH.write_text(json.dumps(manifest, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps(manifest["coverage"], indent=2))
    sources = append_canopy_sources()
    populate_lookdev(manifest, sources, lookdev_collection)
    camera = configure_scene()

    for level, objects in terrain_levels.items():
        export_world(objects + [water] + rocks, f"madagin-ridge-world-{level}-v1.12.glb")

    for obj in terrain_levels["high"] + [water] + rocks:
        obj.hide_render = False
        obj.hide_viewport = False
    render_review(camera)
    bpy.context.scene["madagin_version"] = "v1.12-ridge-world"
    bpy.context.scene["near_terrain_source"] = "USGS 3DEP n23w160 public-domain DEM crop; no imagery"
    bpy.context.scene["far_valley_source"] = "single authored heightfield blended continuously from the DEM edge"
    bpy.context.scene["iteration"] = ITERATION
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    print(f"BLEND={BLEND_PATH}")
    print(f"MANIFEST={MANIFEST_PATH} BYTES={MANIFEST_PATH.stat().st_size}")


if __name__ == "__main__":
    main()
