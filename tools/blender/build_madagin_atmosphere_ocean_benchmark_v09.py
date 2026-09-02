"""Build the Madagin v0.9 atmosphere, ocean, and geology benchmark.

The terrain function mirrors the browser prototype so the opening ridge,
western coastal break, ocean plane, and camera checkpoints can be inspected in
Blender without turning the browser build into one monolithic open-world mesh.
This pass adds a Nishita daylight world, procedural cloud decks, a displaced
Pacific surface, multi-scale ground materials, and linked CC0 flora/geology.
"""

from __future__ import annotations

import math
import random
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "world-source"
EXPORT_DIR = SOURCE_DIR / "exports"
BLEND_PATH = SOURCE_DIR / "madagin-atmosphere-ocean-benchmark-v0.9.blend"
GLB_PATH = EXPORT_DIR / "madagin-atmosphere-ocean-benchmark-v0.9.glb"
ASSET_DIR = ROOT / "public" / "world" / "assets" / "polyhaven"
FOREST_TEXTURE_DIR = ASSET_DIR / "forrest_ground_03"
ROCK_TEXTURE_DIR = ASSET_DIR / "aerial_grass_rock"
ROCK_MODEL_PATH = ASSET_DIR / "rock_09" / "rock_09_1k.gltf"
TREE_MODEL_PATH = ASSET_DIR / "pachira_aquatica_01" / "pachira_aquatica_01_1k.gltf"


def clamp(value: float, low: float, high: float) -> float:
    return min(high, max(low, value))


def mix(a: float, b: float, amount: float) -> float:
    return a + (b - a) * amount


def smoothstep(edge0: float, edge1: float, value: float) -> float:
    amount = clamp((value - edge0) / (edge1 - edge0), 0.0, 1.0)
    return amount * amount * (3.0 - 2.0 * amount)


def fract(value: float) -> float:
    return value - math.floor(value)


def hash2(x: float, y: float) -> float:
    return fract(math.sin(x * 127.1 + y * 311.7) * 43758.5453123)


def value_noise(x: float, y: float) -> float:
    ix = math.floor(x)
    iy = math.floor(y)
    fx = x - ix
    fy = y - iy
    ux = fx * fx * (3.0 - 2.0 * fx)
    uy = fy * fy * (3.0 - 2.0 * fy)
    return mix(
        mix(hash2(ix, iy), hash2(ix + 1, iy), ux),
        mix(hash2(ix, iy + 1), hash2(ix + 1, iy + 1), ux),
        uy,
    )


def ridge_lift(x: float, y: float) -> float:
    travel = -y
    ridge_center = -12.0 + 1.7 * math.sin(x * 0.14 + 0.9) + 0.72 * math.sin(x * 0.39 - 0.6)
    across = math.exp(-((travel - ridge_center) / 5.65) ** 2)
    saddle = -0.8 * math.exp(-((x + 0.6) / 5.1) ** 2)
    asymmetry = 1.45 * math.sin(x * 0.19 + 0.7) + 0.66 * math.sin(x * 0.53 - 1.2)
    side_falloff = max(0.0, 1.0 - max(0.0, abs(x) - 22.0) / 16.0)
    lift = max(0.0, across * (20.2 + saddle + asymmetry) * side_falloff)
    broken = (
        math.sin(x * 0.91 + y * 0.37) * 0.19
        + math.sin(x * 1.83 - y * 0.72) * 0.11
        + math.cos((x + y) * 3.17) * 0.055
    )
    return lift + broken * min(1.0, lift / 2.0)


def valley_axis(travel: float) -> float:
    return math.sin(travel * 0.027) * 5.2 + math.sin(travel * 0.071 + 1.4) * 1.8 - 0.8


def river_axis(travel: float) -> float:
    return valley_axis(travel) + math.sin(travel * 0.12 + 0.6) * 1.25


def surface_height(x: float, y: float) -> float:
    travel = -y
    center = valley_axis(travel)
    distance = abs(x - center)
    range_noise = (
        math.sin(x * 0.031 + y * 0.014 + 1.1) * 2.45
        + math.sin(x * 0.067 - y * 0.026 - 0.7) * 1.35
        + math.cos((x + y) * 0.018 + 2.4) * 1.05
    )
    fine_erosion = math.sin(x * 0.19 + y * 0.073) * 0.38 + math.sin(x * 0.41 - y * 0.16) * 0.19
    western_scale = mix(0.08, 1.0, smoothstep(-76.0, -24.0, x))
    side_range = min(54.0, max(0.0, (distance - 10.0) / 30.0) ** 1.42 * 12.8) * western_scale
    undulation = 0.62 * math.sin(x * 0.12 + y * 0.035) + 0.38 * math.sin(y * 0.094 - x * 0.047)
    far_rise = smoothstep(46.0, 190.0, travel) * (7.2 + max(0.0, range_noise) * 0.9)
    mountain_a = 27.0 * math.exp(-(((x + 54.0) / 23.0) ** 2 + ((y + 118.0) / 39.0) ** 2)) * western_scale
    mountain_b = 36.0 * math.exp(-(((x - 62.0) / 27.0) ** 2 + ((y + 146.0) / 46.0) ** 2))
    mountain_c = 25.0 * math.exp(-(((x + 18.0) / 20.0) ** 2 + ((y + 202.0) / 31.0) ** 2))
    channel_center = river_axis(travel)
    river_cut = math.exp(-((x - channel_center) / 2.8) ** 2) * 0.48
    shelf_width = math.exp(-((x - 4.8) / 19.5) ** 2)
    shelf_front = smoothstep(76.0, 85.0, travel)
    shelf_back = 1.0 - smoothstep(154.0, 184.0, travel) * 0.3
    waterfall_shelf = 11.8 * shelf_width * shelf_front * shelf_back
    cliff_fracture = smoothstep(74.0, 84.0, travel) * shelf_width * (
        math.sin(x * 0.73 + y * 0.41) * 0.42 + math.sin(x * 1.67 - y * 0.83) * 0.2
    )
    floor = (
        0.72
        + undulation
        + fine_erosion
        + range_noise * smoothstep(14.0, 55.0, distance)
        + side_range
        + far_rise
        + mountain_a
        + mountain_b
        + mountain_c
        - river_cut
        - waterfall_shelf
        + cliff_fracture
        + ridge_lift(x, y)
    )
    lake_distance = math.sqrt(((x - 2.4) / 18.5) ** 2 + ((y + 49.0) / 27.5) ** 2)
    shore_noise = math.sin(x * 0.31 + y * 0.17) * 0.055 + math.sin(x * 0.73 - y * 0.23) * 0.028
    lake_mask = 1.0 - smoothstep(0.79 + shore_noise, 1.08 + shore_noise, lake_distance)
    lake_floor = -0.48 + value_noise(x * 0.11 + 3.0, y * 0.11 - 7.0) * 0.08
    floor = mix(floor, lake_floor, lake_mask)
    coast_noise = (
        math.sin(y * 0.041 + 0.8) * 5.8
        + math.sin(y * 0.097 - 1.3) * 2.4
        + (value_noise(y * 0.028 + 4.2, y * 0.011 - 8.1) - 0.5) * 5.2
    )
    coastline = -66.0 + coast_noise
    ocean_mask = 1.0 - smoothstep(coastline - 4.2, coastline + 2.0, x)
    seabed = -1.28 + value_noise(x * 0.035 - 2.0, y * 0.035 + 5.0) * 0.12
    return max(-1.42, mix(floor, seabed, ocean_mask))


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def terrain_material() -> bpy.types.Material:
    material = bpy.data.materials.new("Rainforest floor + weathered volcanic rock / Poly Haven CC0")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.inputs["Roughness"].default_value = 0.94
    shader.inputs["Base Color"].default_value = (0.16, 0.25, 0.17, 1.0)

    texture_coordinates = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (12.0, 12.0, 12.0)
    links.new(texture_coordinates.outputs["Generated"], mapping.inputs["Vector"])

    forest_diffuse = nodes.new("ShaderNodeTexImage")
    forest_diffuse.image = bpy.data.images.load(str(FOREST_TEXTURE_DIR / "forrest_ground_03_diff_1k.jpg"))
    forest_diffuse.interpolation = "Linear"
    forest_diffuse.extension = "REPEAT"
    links.new(mapping.outputs["Vector"], forest_diffuse.inputs["Vector"])

    rock_diffuse = nodes.new("ShaderNodeTexImage")
    rock_diffuse.image = bpy.data.images.load(str(ROCK_TEXTURE_DIR / "aerial_grass_rock_diff_1k.jpg"))
    rock_diffuse.interpolation = "Linear"
    rock_diffuse.extension = "REPEAT"
    links.new(mapping.outputs["Vector"], rock_diffuse.inputs["Vector"])

    geometry = nodes.new("ShaderNodeNewGeometry")
    separate_normal = nodes.new("ShaderNodeSeparateXYZ")
    invert_up = nodes.new("ShaderNodeMath")
    invert_up.operation = "SUBTRACT"
    invert_up.inputs[0].default_value = 1.0
    slope_gain = nodes.new("ShaderNodeMath")
    slope_gain.operation = "MULTIPLY"
    slope_gain.inputs[1].default_value = 2.1
    macro_noise = nodes.new("ShaderNodeTexNoise")
    macro_noise.inputs["Scale"].default_value = 3.4
    macro_noise.inputs["Detail"].default_value = 4.8
    macro_noise.inputs["Roughness"].default_value = 0.68
    noise_gain = nodes.new("ShaderNodeMath")
    noise_gain.operation = "MULTIPLY"
    noise_gain.inputs[1].default_value = 0.28
    mix_factor = nodes.new("ShaderNodeMath")
    mix_factor.operation = "ADD"
    mix_factor.use_clamp = True
    color_mix = nodes.new("ShaderNodeMixRGB")
    color_mix.blend_type = "MIX"

    links.new(geometry.outputs["Normal"], separate_normal.inputs["Vector"])
    links.new(separate_normal.outputs["Z"], invert_up.inputs[1])
    links.new(invert_up.outputs["Value"], slope_gain.inputs[0])
    links.new(mapping.outputs["Vector"], macro_noise.inputs["Vector"])
    links.new(slope_gain.outputs["Value"], mix_factor.inputs[0])
    links.new(macro_noise.outputs["Fac"], noise_gain.inputs[0])
    links.new(noise_gain.outputs["Value"], mix_factor.inputs[1])
    links.new(mix_factor.outputs["Value"], color_mix.inputs["Fac"])
    links.new(forest_diffuse.outputs["Color"], color_mix.inputs[1])
    links.new(rock_diffuse.outputs["Color"], color_mix.inputs[2])
    links.new(color_mix.outputs["Color"], shader.inputs["Base Color"])

    normal_texture = nodes.new("ShaderNodeTexImage")
    normal_texture.image = bpy.data.images.load(str(FOREST_TEXTURE_DIR / "forrest_ground_03_nor_gl_1k.jpg"))
    normal_texture.image.colorspace_settings.name = "Non-Color"
    normal_texture.extension = "REPEAT"
    links.new(mapping.outputs["Vector"], normal_texture.inputs["Vector"])
    normal = nodes.new("ShaderNodeNormalMap")
    normal.inputs["Strength"].default_value = 0.58
    links.new(normal_texture.outputs["Color"], normal.inputs["Color"])
    links.new(normal.outputs["Normal"], shader.inputs["Normal"])
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return material


def build_terrain() -> bpy.types.Object:
    columns = 181
    rows = 207
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    for row in range(rows):
        v = row / (rows - 1)
        y = 73.0 - v * 310.0
        for column in range(columns):
            u = column / (columns - 1)
            x = -135.0 + u * 270.0
            vertices.append((x, y, surface_height(x, y)))
    for row in range(rows - 1):
        for column in range(columns - 1):
            a = row * columns + column
            b = a + 1
            c = a + columns + 1
            d = a + columns
            faces.append((a, b, c, d))
    mesh = bpy.data.meshes.new("Madagin v0.9 connected ridge, coast, and biome terrain")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    terrain = bpy.data.objects.new("Connected Hawaiian ridge + west coast", mesh)
    bpy.context.collection.objects.link(terrain)
    terrain.data.materials.append(terrain_material())
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for loop in mesh.loops:
        coordinate = mesh.vertices[loop.vertex_index].co
        uv_layer.data[loop.index].uv = ((coordinate.x + 135.0) / 8.0, (73.0 - coordinate.y) / 8.0)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    terrain["geography_contract"] = "Matches browser v0.9 surface function"
    terrain["performance_role"] = "Blender source benchmark; browser uses tiered procedural grid"
    return terrain


def build_ocean() -> bpy.types.Object:
    bpy.ops.mesh.primitive_grid_add(
        x_subdivisions=145,
        y_subdivisions=145,
        size=900.0,
        location=(-480.0, -83.0, -0.52),
    )
    ocean = bpy.context.object
    ocean.name = "Displaced western Pacific / About world sightline"
    material = bpy.data.materials.new("Golden-hour Pacific surface")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.inputs["Base Color"].default_value = (0.012, 0.11, 0.15, 1.0)
    shader.inputs["Metallic"].default_value = 0.02
    shader.inputs["Roughness"].default_value = 0.14
    shader.inputs["IOR"].default_value = 1.333
    if "Transmission Weight" in shader.inputs:
        shader.inputs["Transmission Weight"].default_value = 0.08

    coordinates = nodes.new("ShaderNodeTexCoord")
    broad_noise = nodes.new("ShaderNodeTexNoise")
    broad_noise.inputs["Scale"].default_value = 0.42
    broad_noise.inputs["Detail"].default_value = 5.0
    broad_noise.inputs["Roughness"].default_value = 0.58
    capillary_noise = nodes.new("ShaderNodeTexNoise")
    capillary_noise.inputs["Scale"].default_value = 3.2
    capillary_noise.inputs["Detail"].default_value = 7.0
    capillary_noise.inputs["Roughness"].default_value = 0.72
    mix_noise = nodes.new("ShaderNodeMixRGB")
    mix_noise.blend_type = "MULTIPLY"
    mix_noise.inputs["Fac"].default_value = 0.72
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.28
    bump.inputs["Distance"].default_value = 0.32
    links.new(coordinates.outputs["Generated"], broad_noise.inputs["Vector"])
    links.new(coordinates.outputs["Generated"], capillary_noise.inputs["Vector"])
    links.new(broad_noise.outputs["Fac"], mix_noise.inputs[1])
    links.new(capillary_noise.outputs["Fac"], mix_noise.inputs[2])
    links.new(mix_noise.outputs["Color"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    ocean.data.materials.append(material)

    swell_texture = bpy.data.textures.new("Layered Pacific swell", type="CLOUDS")
    swell_texture.noise_scale = 17.0
    swell_texture.noise_depth = 3
    displacement = ocean.modifiers.new("Broad irregular swell", "DISPLACE")
    displacement.texture = swell_texture
    displacement.strength = 0.46
    displacement.mid_level = 0.5
    ocean["browser_equivalent"] = "Analytical four-wave Fresnel shader; no reflection render target"
    return ocean


def surface_slope(x: float, y: float) -> float:
    sample = 0.8
    dx = surface_height(x + sample, y) - surface_height(x - sample, y)
    dy = surface_height(x, y + sample) - surface_height(x, y - sample)
    return math.sqrt(dx * dx + dy * dy) / (sample * 2.0)


def in_lake(x: float, y: float) -> bool:
    return ((x - 2.4) / 20.5) ** 2 + ((y + 49.0) / 29.5) ** 2 < 1.03


def import_meshes(path: Path) -> list[bpy.types.Object]:
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    return [obj for obj in bpy.context.scene.objects if obj not in before and obj.type == "MESH"]


def linked_copy(
    source: bpy.types.Object,
    collection: bpy.types.Collection,
    name: str,
    location: tuple[float, float, float],
    scale: float,
    rotation: float,
) -> bpy.types.Object:
    duplicate = source.copy()
    duplicate.data = source.data
    duplicate.animation_data_clear()
    duplicate.name = name
    duplicate.location = location
    duplicate.rotation_euler = source.rotation_euler.copy()
    duplicate.rotation_euler.z += rotation
    duplicate.scale = tuple(component * scale for component in source.scale)
    collection.objects.link(duplicate)
    return duplicate


def scatter_cc0_geology_and_canopy() -> None:
    rock_sources = import_meshes(ROCK_MODEL_PATH)
    rock_source = next(obj for obj in rock_sources if obj.name.startswith("rock_09_LOD0"))
    rock_collection = bpy.data.collections.new("CC0 weathered volcanic outcrops")
    bpy.context.scene.collection.children.link(rock_collection)
    rng = random.Random(991703)
    made = 0
    attempts = 0
    while made < 108 and attempts < 3600:
        attempts += 1
        zone = rng.random()
        if zone < 0.4:
            y = 31.0 - rng.random() * 86.0
            x = (rng.random() * 2.0 - 1.0) * (15.0 + rng.random() * 35.0)
        elif zone < 0.75:
            y = -31.0 - rng.random() * 177.0
            center = valley_axis(-y)
            x = center + (-1.0 if rng.random() < 0.5 else 1.0) * (22.0 + rng.random() * 72.0)
        else:
            y = 43.0 - rng.random() * 246.0
            coast = -66.0 + math.sin(y * 0.041 + 0.8) * 5.8 + math.sin(y * 0.097 - 1.3) * 2.4
            x = coast + 1.0 + rng.random() * 15.0
        height = surface_height(x, y)
        slope = surface_slope(x, y)
        if height < -0.04 or in_lake(x, y) or slope > 3.4 or (slope < 0.25 and rng.random() > 0.25):
            continue
        scale = 0.62 + rng.random() ** 1.55 * 2.8 + min(1.5, slope * 0.36)
        linked_copy(
            rock_source,
            rock_collection,
            f"Weathered outcrop {made + 1:03d}",
            (x, y, height - 0.11 * scale),
            scale,
            rng.random() * math.tau,
        )
        made += 1
    for source in rock_sources:
        bpy.data.objects.remove(source, do_unlink=True)

    tree_sources = import_meshes(TREE_MODEL_PATH)
    variants: dict[str, tuple[bpy.types.Object, bpy.types.Object]] = {}
    for suffix in ("a", "b", "c", "d"):
        bark = next(obj for obj in tree_sources if obj.name.startswith(f"pachira_aquatica_01_bark_{suffix}"))
        leaves = next(obj for obj in tree_sources if obj.name.startswith(f"pachira_aquatica_01_leaves_{suffix}"))
        variants[suffix] = (bark, leaves)
    tree_collection = bpy.data.collections.new("CC0 linked tropical canopy specimens")
    bpy.context.scene.collection.children.link(tree_collection)
    rng = random.Random(733119)
    made = 0
    attempts = 0
    suffixes = tuple(variants)
    while made < 236 and attempts < 7600:
        attempts += 1
        y = 39.0 - rng.random() ** 0.82 * 222.0
        travel = -y
        center = valley_axis(travel)
        width = 29.0 + rng.random() * 66.0
        x = (0.0 if y > -48.0 else center) + (rng.random() * 2.0 - 1.0) * width
        height = surface_height(x, y)
        slope = surface_slope(x, y)
        if height < -0.02 or height > 43.0 or slope > 1.62 or in_lake(x, y):
            continue
        if y < -70.0 and abs(x - river_axis(travel)) < 2.6:
            continue
        suffix = suffixes[int(rng.random() * len(suffixes))]
        scale = 0.68 + rng.random() * 0.94
        angle = rng.random() * math.tau
        location = (x, y, height - 0.03)
        bark, leaves = variants[suffix]
        linked_copy(bark, tree_collection, f"Pachira {made + 1:03d} bark", location, scale, angle)
        linked_copy(leaves, tree_collection, f"Pachira {made + 1:03d} leaves", location, scale, angle)
        made += 1
    for source in tree_sources:
        bpy.data.objects.remove(source, do_unlink=True)


def cloud_material(name: str, density: float, warmth: float) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    transparent = nodes.new("ShaderNodeBsdfTransparent")
    cloud = nodes.new("ShaderNodeBsdfPrincipled")
    cloud.inputs["Base Color"].default_value = (0.62 + warmth, 0.68 + warmth * 0.55, 0.7 + warmth * 0.35, 1.0)
    cloud.inputs["Roughness"].default_value = 1.0
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 4.4
    noise.inputs["Detail"].default_value = 7.2
    noise.inputs["Roughness"].default_value = 0.72
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = density
    ramp.color_ramp.elements[1].position = min(0.95, density + 0.19)
    mix_shader = nodes.new("ShaderNodeMixShader")
    coordinates = nodes.new("ShaderNodeTexCoord")
    links.new(coordinates.outputs["Generated"], noise.inputs["Vector"])
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], mix_shader.inputs["Fac"])
    links.new(transparent.outputs["BSDF"], mix_shader.inputs[1])
    links.new(cloud.outputs["BSDF"], mix_shader.inputs[2])
    links.new(mix_shader.outputs["Shader"], output.inputs["Surface"])
    if hasattr(material, "surface_render_method"):
        material.surface_render_method = "DITHERED"
    return material


def build_cloud_decks() -> None:
    layers = (
        ("Trade-wind cloud layer 01", (-42.0, -118.0, 132.0), 760.0, 0.49, 0.1),
        ("Trade-wind cloud layer 02", (126.0, -102.0, 178.0), 820.0, 0.56, 0.04),
        ("High cloud veil", (-176.0, -168.0, 224.0), 900.0, 0.63, 0.0),
    )
    for index, (name, location, size, density, warmth) in enumerate(layers):
        bpy.ops.mesh.primitive_plane_add(size=size, location=location, rotation=(0.0, 0.0, index * 0.19 - 0.16))
        cloud = bpy.context.object
        cloud.name = name
        cloud.data.materials.append(cloud_material(f"{name} procedural volume impression", density, warmth))
        cloud["runtime_role"] = "Browser uses animated five-octave alpha cloud shader"


def configure_world_atmosphere() -> None:
    world = bpy.data.worlds.new("Madagin Nishita golden-hour atmosphere")
    bpy.context.scene.world = world
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputWorld")
    background = nodes.new("ShaderNodeBackground")
    background.inputs["Strength"].default_value = 0.56
    sky = nodes.new("ShaderNodeTexSky")
    sky.sky_type = "MULTIPLE_SCATTERING"
    sky.sun_elevation = math.radians(17.5)
    sky.sun_rotation = math.radians(238.0)
    sky.altitude = 0.2
    sky.air_density = 1.05
    sky.aerosol_density = 2.6
    sky.ozone_density = 1.0
    volume = nodes.new("ShaderNodeVolumeScatter")
    volume.inputs["Color"].default_value = (0.57, 0.68, 0.69, 1.0)
    volume.inputs["Density"].default_value = 0.0017
    volume.inputs["Anisotropy"].default_value = 0.48
    links.new(sky.outputs["Color"], background.inputs["Color"])
    links.new(background.outputs["Background"], output.inputs["Surface"])
    links.new(volume.outputs["Volume"], output.inputs["Volume"])


def add_camera(name: str, runtime_position: tuple[float, float, float], runtime_target: tuple[float, float, float]) -> None:
    position = Vector((runtime_position[0], runtime_position[2], runtime_position[1]))
    target = Vector((runtime_target[0], runtime_target[2], runtime_target[1]))
    bpy.ops.object.camera_add(location=position)
    camera = bpy.context.object
    camera.name = name
    camera.data.lens = 46
    camera.data.clip_end = 1100
    look_at(camera, target)


def configure_scene() -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 50
    scene.view_settings.look = "AgX - Medium High Contrast"
    configure_world_atmosphere()
    scene["madagin_world_version"] = "0.9-atmosphere-ocean-geology-canopy"
    scene["public_release"] = False
    scene["terrain_source"] = "Poly Haven forrest_ground_03 + aerial_grass_rock / CC0"
    scene["model_source"] = "Poly Haven rock_09 + pachira_aquatica_01 / CC0 linked instances"
    scene["browser_strategy"] = "Instancing + quality tiers + separate compact worlds"
    scene["runtime_shader_strategy"] = "Preetham sky + alpha clouds + analytical Fresnel/Gerstner ocean"
    bpy.ops.object.light_add(type="SUN", location=(-148.0, 86.0, 54.0))
    sun = bpy.context.object
    sun.name = "Golden-hour west light"
    sun.data.energy = 4.1
    sun.data.color = (1.0, 0.7, 0.48)
    sun.data.angle = math.radians(2.2)
    sun.rotation_euler = (math.radians(42.0), math.radians(-18.0), math.radians(-58.0))
    bpy.ops.object.light_add(type="AREA", location=(42.0, 8.0, 64.0))
    fill = bpy.context.object
    fill.name = "Cool open-sky fill"
    fill.data.energy = 850.0
    fill.data.shape = "DISK"
    fill.data.size = 42.0
    fill.data.color = (0.48, 0.7, 0.74)
    look_at(fill, Vector((0.0, -55.0, 8.0)))
    add_camera("01 Ridge approach", (0.0, 29.5, 82.0), (0.0, 19.5, 10.5))
    add_camera("02 Valley reveal", (3.5, 43.0, 1.5), (2.4, 4.8, -104.0))
    add_camera("About / west ocean", (0.0, 29.5, 82.0), (-220.0, 5.0, 15.0))
    scene.camera = bpy.data.objects.get("01 Ridge approach")


def main() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    build_terrain()
    build_ocean()
    scatter_cc0_geology_and_canopy()
    build_cloud_decks()
    configure_scene()
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH), check_existing=False)
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        export_format="GLB",
        export_extras=True,
        export_cameras=False,
        export_lights=False,
        export_apply=True,
        use_renderable=True,
        use_visible=True,
    )
    print(f"BLEND={BLEND_PATH}")
    print(f"GLB={GLB_PATH}")
    print(f"GLB_BYTES={GLB_PATH.stat().st_size}")


if __name__ == "__main__":
    main()
