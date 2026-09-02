"""Build the Madagin v1.0 living valley, lake, atmosphere, and ocean source.

This extends the v0.9 geography with authored weather volumes, a more legible
Pacific swell, a reflective alpine lake, lake-edge habitat, and waterfall
geology. The browser recreates the expensive atmospheric systems with tiered
real-time shaders; this file remains the editable composition and lighting
source rather than a monolithic runtime payload.
"""

from __future__ import annotations

import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector


SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import build_madagin_atmosphere_ocean_benchmark_v09 as base  # noqa: E402


ROOT = SCRIPT_DIR.parents[1]
SOURCE_DIR = ROOT / "world-source"
EXPORT_DIR = SOURCE_DIR / "exports"
BLEND_PATH = SOURCE_DIR / "madagin-living-valley-v1.0.blend"
GLB_PATH = EXPORT_DIR / "madagin-living-valley-v1.0.glb"


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in tuple(bpy.data.collections):
        if collection.users == 0:
            bpy.data.collections.remove(collection)


def volume_material(name: str, color: tuple[float, float, float, float], density: float, scale: float) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    volume = nodes.new("ShaderNodeVolumePrincipled")
    volume.inputs["Color"].default_value = color
    volume.inputs["Anisotropy"].default_value = 0.58
    noise = nodes.new("ShaderNodeTexNoise")
    noise.noise_dimensions = "4D"
    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = 6.2
    noise.inputs["Roughness"].default_value = 0.72
    noise.inputs["W"].default_value = random.Random(name).random() * 8.0
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.39
    ramp.color_ramp.elements[1].position = 0.7
    multiply = nodes.new("ShaderNodeMath")
    multiply.operation = "MULTIPLY"
    multiply.inputs[1].default_value = density
    coordinates = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeMapping")
    links.new(coordinates.outputs["Generated"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], multiply.inputs[0])
    links.new(multiply.outputs["Value"], volume.inputs["Density"])
    links.new(volume.outputs["Volume"], output.inputs["Volume"])
    return material


def add_weather_volume(
    name: str,
    runtime_position: tuple[float, float, float],
    runtime_size: tuple[float, float, float],
    material: bpy.types.Material,
) -> bpy.types.Object:
    location = (runtime_position[0], runtime_position[2], runtime_position[1])
    scale = (runtime_size[0] * 0.5, runtime_size[2] * 0.5, runtime_size[1] * 0.5)
    bpy.ops.mesh.primitive_cube_add(size=2.0, location=location)
    volume = bpy.context.object
    volume.name = name
    volume.scale = scale
    volume.data.materials.append(material)
    volume.display_type = "WIRE"
    volume["runtime_role"] = "Browser uses animated procedural fog/cloud shader"
    return volume


def build_weather_system() -> None:
    cloud_material = volume_material("Trade-wind cloud volume", (0.84, 0.88, 0.88, 1.0), 0.072, 2.6)
    mist_material = volume_material("Valley mist volume", (0.68, 0.78, 0.77, 1.0), 0.095, 3.8)
    cloud_volumes = (
        ("Cloud mass / mountain corridor", (8.0, 88.0, -252.0), (650.0, 76.0, 174.0)),
        ("Cloud mass / near weather", (-124.0, 116.0, -172.0), (430.0, 58.0, 138.0)),
        ("Cloud mass / western ocean", (-330.0, 104.0, -52.0), (170.0, 68.0, 610.0)),
    )
    for name, position, size in cloud_volumes:
        add_weather_volume(name, position, size, cloud_material)
    mist_volumes = (
        ("Mist bank 01 / lake", (-3.0, 8.0, -63.0), (88.0, 9.0, 20.0)),
        ("Mist bank 02 / falls", (3.0, 12.0, -106.0), (142.0, 12.0, 28.0)),
        ("Mist bank 03 / valley", (-6.0, 18.0, -157.0), (208.0, 18.0, 42.0)),
        ("Mist bank 04 / distant peaks", (12.0, 26.0, -214.0), (288.0, 23.0, 56.0)),
    )
    for name, position, size in mist_volumes:
        add_weather_volume(name, position, size, mist_material)


def upgrade_ocean() -> None:
    ocean = bpy.data.objects.get("Displaced western Pacific / About world sightline")
    if ocean is None:
        raise RuntimeError("v0.9 Pacific source was not created")
    ocean.location.z = -0.68
    broad = ocean.modifiers.get("Broad irregular swell")
    if broad is not None:
        broad.strength = 1.18
        broad.texture.noise_scale = 24.0
        broad.texture.noise_depth = 4
    crossing_texture = bpy.data.textures.new("Crossing Pacific swell", type="CLOUDS")
    crossing_texture.noise_scale = 7.5
    crossing_texture.noise_depth = 2
    crossing = ocean.modifiers.new("Crossing wind swell", "DISPLACE")
    crossing.texture = crossing_texture
    crossing.strength = 0.24
    crossing.mid_level = 0.5
    material = ocean.data.materials[0]
    shader = next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if shader is not None:
        shader.inputs["Base Color"].default_value = (0.005, 0.075, 0.12, 1.0)
        shader.inputs["Roughness"].default_value = 0.08
        if "Coat Weight" in shader.inputs:
            shader.inputs["Coat Weight"].default_value = 0.38
            shader.inputs["Coat Roughness"].default_value = 0.09
    ocean["v1.0_upgrade"] = "Two-scale displaced swell + low-roughness golden-hour reflection"


def lake_material() -> bpy.types.Material:
    material = bpy.data.materials.new("Alpine lake / reflected weather")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.inputs["Base Color"].default_value = (0.02, 0.15, 0.17, 1.0)
    shader.inputs["Metallic"].default_value = 0.0
    shader.inputs["Roughness"].default_value = 0.1
    shader.inputs["IOR"].default_value = 1.333
    if "Coat Weight" in shader.inputs:
        shader.inputs["Coat Weight"].default_value = 0.46
        shader.inputs["Coat Roughness"].default_value = 0.08
    coordinates = nodes.new("ShaderNodeTexCoord")
    wave_a = nodes.new("ShaderNodeTexWave")
    wave_a.wave_type = "BANDS"
    wave_a.bands_direction = "X"
    wave_a.inputs["Scale"].default_value = 1.7
    wave_a.inputs["Distortion"].default_value = 4.4
    wave_a.inputs["Detail"].default_value = 5.0
    wave_b = nodes.new("ShaderNodeTexWave")
    wave_b.wave_type = "BANDS"
    wave_b.bands_direction = "Y"
    wave_b.inputs["Scale"].default_value = 3.1
    wave_b.inputs["Distortion"].default_value = 6.0
    wave_b.inputs["Detail"].default_value = 4.0
    mix_node = nodes.new("ShaderNodeMixRGB")
    mix_node.blend_type = "MULTIPLY"
    mix_node.inputs["Fac"].default_value = 0.68
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.24
    bump.inputs["Distance"].default_value = 0.09
    links.new(coordinates.outputs["Generated"], wave_a.inputs["Vector"])
    links.new(coordinates.outputs["Generated"], wave_b.inputs["Vector"])
    links.new(wave_a.outputs["Color"], mix_node.inputs[1])
    links.new(wave_b.outputs["Color"], mix_node.inputs[2])
    links.new(mix_node.outputs["Color"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return material


def build_alpine_lake() -> bpy.types.Object:
    rng = random.Random(77219)
    count = 72
    vertices = [(2.4, -49.0, 0.02)]
    for index in range(count):
        angle = index / count * math.tau
        irregularity = 0.89 + rng.random() * 0.16 + math.sin(angle * 3.1 + 0.7) * 0.055
        vertices.append((
            2.4 + math.cos(angle) * 17.2 * irregularity,
            -49.0 + math.sin(angle) * 25.8 * irregularity,
            0.02,
        ))
    faces = [(0, index + 1, ((index + 1) % count) + 1) for index in range(count)]
    mesh = bpy.data.meshes.new("Irregular alpine lake surface")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    lake = bpy.data.objects.new("Alpine lake / Resonant chapter", mesh)
    bpy.context.collection.objects.link(lake)
    lake.data.materials.append(lake_material())
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    lake["runtime_role"] = "Browser uses analytical ripple, Fresnel, glint, and cloud-reflection shader"
    return lake


def simple_material(name: str, color: tuple[float, float, float, float], roughness: float = 0.94) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    if shader is not None:
        shader.inputs["Base Color"].default_value = color
        shader.inputs["Roughness"].default_value = roughness
    return material


def build_lake_edge_and_waterfall_geology() -> None:
    rng = random.Random(520331)
    collection = bpy.data.collections.new("Lake edge habitat + waterfall geology")
    bpy.context.scene.collection.children.link(collection)
    rock_sources = base.import_meshes(base.ROCK_MODEL_PATH)
    stone_source = next(obj for obj in rock_sources if obj.name.startswith("rock_09_LOD0"))
    for index in range(92):
        angle = index / 92 * math.tau + (rng.random() - 0.5) * 0.16
        radius = 1.01 + rng.random() * 0.11
        x = 2.4 + math.cos(angle) * 18.1 * radius
        y = -49.0 + math.sin(angle) * 27.1 * radius
        z = base.surface_height(x, y) - 0.08
        scale = 0.28 + rng.random() ** 1.7 * 0.92
        base.linked_copy(stone_source, collection, f"Lake talus {index + 1:03d}", (x, y, z), scale, rng.random() * math.tau)
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.035, radius2=0.012, depth=1.0)
    reed_source = bpy.context.object
    reed_source.name = "Lake rush source"
    reed_source.data.materials.append(simple_material("Lake rush", (0.2, 0.34, 0.16, 1.0)))
    for index in range(320):
        angle = index / 320 * math.tau + math.sin((index % 11) * 2.7) * 0.075
        radius = 0.94 + rng.random() * 0.14
        x = 2.4 + math.cos(angle) * 17.8 * radius
        y = -49.0 + math.sin(angle) * 26.7 * radius
        z = max(0.02, base.surface_height(x, y)) + 0.34
        rush = base.linked_copy(reed_source, collection, f"Lake rush {index + 1:03d}", (x, y, z), 0.55 + rng.random(), rng.random() * math.tau)
        rush.scale.x *= 0.75
        rush.scale.y *= 0.75
        rush.scale.z *= 0.7 + rng.random() * 0.8
    bottom = base.surface_height(4.8, -76.2) - 0.55
    top = max(base.surface_height(4.8, -84.2), bottom + 7.5)
    for index in range(76):
        side = -1.0 if index % 2 == 0 else 1.0
        near_pool = index < 20
        x = 4.8 + ((rng.random() * 2.0 - 1.0) * 6.8 if near_pool else side * (2.7 + rng.random() * 5.8))
        y = -76.7 + (rng.random() * 2.0 - 1.0) * 3.7 if near_pool else -80.6 + (rng.random() - 0.5) * 2.8
        z = bottom + rng.random() * 1.15 if near_pool else bottom + rng.random() * (top - bottom + 1.4)
        scale = 0.35 + rng.random() * 1.15 if near_pool else 0.65 + rng.random() * 2.2
        cliff = base.linked_copy(stone_source, collection, f"Waterfall basalt {index + 1:03d}", (x, y, z), scale, rng.random() * math.tau)
        cliff.scale.x *= 1.2
        cliff.scale.z *= 0.72
    for source in rock_sources:
        bpy.data.objects.remove(source, do_unlink=True)
    reed_source.hide_render = True
    reed_source.hide_viewport = True


def configure_v10_scene() -> None:
    base.configure_scene()
    scene = bpy.context.scene
    scene["madagin_world_version"] = "1.0-living-weather-ocean-valley-lake"
    scene["public_release"] = False
    scene["runtime_shader_strategy"] = "PMREM sky + multi-axis cloud cards + valley fog + Gerstner ocean + ripple lake"
    world = scene.world
    if world is not None and world.use_nodes:
        background = next((node for node in world.node_tree.nodes if node.type == "BACKGROUND"), None)
        volume = next((node for node in world.node_tree.nodes if node.type == "VOLUME_SCATTER"), None)
        if background is not None:
            background.inputs["Strength"].default_value = 0.72
        if volume is not None:
            volume.inputs["Density"].default_value = 0.00115
            volume.inputs["Anisotropy"].default_value = 0.56
    sun = bpy.data.objects.get("Golden-hour west light")
    if sun is not None:
        sun.data.energy = 3.35
        sun.data.color = (1.0, 0.72, 0.49)
        sun.data.angle = math.radians(1.35)
    base.add_camera("03 Alpine lake", (-8.0, 27.0, -10.0), (3.2, 2.8, -80.0))
    base.add_camera("About / lake ocean panorama", (-8.0, 44.0, -10.0), (-220.0, 5.0, -56.0))


def main() -> None:
    reset_scene()
    base.build_terrain()
    base.build_ocean()
    base.scatter_cc0_geology_and_canopy()
    base.build_cloud_decks()
    build_alpine_lake()
    build_lake_edge_and_waterfall_geology()
    build_weather_system()
    upgrade_ocean()
    configure_v10_scene()
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
