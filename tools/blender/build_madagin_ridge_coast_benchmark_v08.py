"""Build the Madagin v0.8 ridge-and-coast geography benchmark.

The terrain function mirrors the browser prototype so the opening ridge,
western coastal break, ocean plane, and camera checkpoints can be inspected in
Blender without turning the browser build into one monolithic open-world mesh.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "world-source"
RUNTIME_DIR = ROOT / "public" / "world" / "v08"
BLEND_PATH = SOURCE_DIR / "madagin-ridge-coast-benchmark-v0.8.blend"
GLB_PATH = RUNTIME_DIR / "madagin-ridge-coast-benchmark-v0.8.glb"
TEXTURE_DIR = ROOT / "public" / "world" / "assets" / "polyhaven" / "forrest_ground_03"


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
    ocean_mask = 1.0 - smoothstep(coastline - 8.5, coastline + 4.5, x)
    seabed = -1.28 + value_noise(x * 0.035 - 2.0, y * 0.035 + 5.0) * 0.12
    return max(-1.42, mix(floor, seabed, ocean_mask))


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def terrain_material() -> bpy.types.Material:
    material = bpy.data.materials.new("Rainforest floor / Poly Haven CC0")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.inputs["Roughness"].default_value = 0.92
    shader.inputs["Base Color"].default_value = (0.16, 0.25, 0.17, 1.0)
    diffuse = nodes.new("ShaderNodeTexImage")
    diffuse.image = bpy.data.images.load(str(TEXTURE_DIR / "forrest_ground_03_diff_1k.jpg"))
    diffuse.interpolation = "Linear"
    normal_texture = nodes.new("ShaderNodeTexImage")
    normal_texture.image = bpy.data.images.load(str(TEXTURE_DIR / "forrest_ground_03_nor_gl_1k.jpg"))
    normal_texture.image.colorspace_settings.name = "Non-Color"
    normal = nodes.new("ShaderNodeNormalMap")
    normal.inputs["Strength"].default_value = 0.65
    links.new(diffuse.outputs["Color"], shader.inputs["Base Color"])
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
    mesh = bpy.data.meshes.new("Madagin v0.8 connected ridge and coast")
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
    terrain["geography_contract"] = "Matches browser v0.8 surface function"
    terrain["performance_role"] = "Blender source benchmark; browser uses tiered procedural grid"
    return terrain


def build_ocean() -> bpy.types.Object:
    bpy.ops.mesh.primitive_plane_add(size=2.0, location=(-180.0, -83.0, -0.52))
    ocean = bpy.context.object
    ocean.name = "Western ocean / About world sightline"
    ocean.scale = (130.0, 215.0, 1.0)
    material = bpy.data.materials.new("Western ocean")
    material.diffuse_color = (0.025, 0.17, 0.22, 1.0)
    material.use_nodes = True
    shader = next(node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    shader.inputs["Base Color"].default_value = (0.025, 0.17, 0.22, 1.0)
    shader.inputs["Metallic"].default_value = 0.08
    shader.inputs["Roughness"].default_value = 0.22
    ocean.data.materials.append(material)
    return ocean


def add_camera(name: str, runtime_position: tuple[float, float, float], runtime_target: tuple[float, float, float]) -> None:
    position = Vector((runtime_position[0], runtime_position[2], runtime_position[1]))
    target = Vector((runtime_target[0], runtime_target[2], runtime_target[1]))
    bpy.ops.object.camera_add(location=position)
    camera = bpy.context.object
    camera.name = name
    camera.data.lens = 46
    camera.data.clip_end = 760
    look_at(camera, target)


def configure_scene() -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 50
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world.color = (0.025, 0.055, 0.075)
    scene["madagin_world_version"] = "0.8-ridge-coast-topography-understory"
    scene["public_release"] = False
    scene["terrain_source"] = "Poly Haven forrest_ground_03 / CC0"
    scene["browser_strategy"] = "Instancing + quality tiers + separate compact worlds"
    bpy.ops.object.light_add(type="SUN", location=(-42.0, 24.0, 38.0))
    sun = bpy.context.object
    sun.name = "Golden-hour west light"
    sun.data.energy = 3.2
    sun.data.color = (1.0, 0.69, 0.43)
    sun.rotation_euler = (math.radians(38.0), math.radians(-22.0), math.radians(-58.0))
    add_camera("01 Ridge approach", (0.0, 29.5, 82.0), (0.0, 19.5, 10.5))
    add_camera("02 Valley reveal", (3.5, 43.0, 1.5), (2.4, 4.8, -104.0))
    add_camera("About / west ocean", (0.0, 29.5, 82.0), (-172.0, -0.8, 37.0))
    scene.camera = bpy.data.objects.get("01 Ridge approach")


def main() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    build_terrain()
    build_ocean()
    configure_scene()
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
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
