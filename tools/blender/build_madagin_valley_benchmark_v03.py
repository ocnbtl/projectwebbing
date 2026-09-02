from __future__ import annotations

import math
from pathlib import Path
import random
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_madagin_world_layout_v02 as layout


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "world-source"
RUNTIME_DIR = ROOT / "public" / "world" / "v03"
PREVIEW_DIR = ROOT / "docs" / "design" / "references"
TEXTURE_DIR = ROOT / "public" / "world" / "assets" / "polyhaven" / "aerial_grass_rock"
BLEND_PATH = SOURCE_DIR / "madagin-valley-benchmark-v0.3.blend"
GLB_PATH = RUNTIME_DIR / "madagin-valley-benchmark-v0.3.glb"
PREVIEW_PATH = PREVIEW_DIR / "madagin-valley-benchmark-v0.3.png"


MOUNTAIN_SPECS = (
    (-18, -18, 7.2, 13.5),
    (20, -13, 8.8, 20.0),
    (-18, -1, 8.2, 17.5),
    (23, 7, 11.0, 25.5),
    (-19, 18, 9.6, 20.0),
    (25, 27, 12.4, 29.5),
    (-20, 39, 13.4, 33.5),
    (27, 48, 15.0, 38.0),
)


def remove_object(name: str) -> None:
    obj = bpy.data.objects.get(name)
    if obj is not None:
        bpy.data.objects.remove(obj, do_unlink=True)


def remove_prefix(prefix: str) -> None:
    for obj in list(bpy.data.objects):
        if obj.name.startswith(prefix):
            bpy.data.objects.remove(obj, do_unlink=True)


def clear_collection(name: str) -> None:
    collection = bpy.data.collections.get(name)
    if collection is None:
        return
    for obj in list(collection.all_objects):
        bpy.data.objects.remove(obj, do_unlink=True)


def configure_pbr_material(material) -> None:
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    for node in list(nodes):
        nodes.remove(node)

    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (760, 20)
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    principled.location = (470, 20)
    principled.inputs["Roughness"].default_value = 0.82
    principled.inputs["Metallic"].default_value = 0.0
    links.new(principled.outputs["BSDF"], output.inputs["Surface"])

    diffuse_image = bpy.data.images.load(
        str(TEXTURE_DIR / "aerial_grass_rock_diff_1k.jpg"), check_existing=True
    )
    normal_image = bpy.data.images.load(
        str(TEXTURE_DIR / "aerial_grass_rock_nor_gl_1k.jpg"), check_existing=True
    )
    arm_image = bpy.data.images.load(
        str(TEXTURE_DIR / "aerial_grass_rock_arm_1k.jpg"), check_existing=True
    )
    normal_image.colorspace_settings.name = "Non-Color"
    arm_image.colorspace_settings.name = "Non-Color"

    diffuse = nodes.new("ShaderNodeTexImage")
    diffuse.name = "CC0 aerial grass rock / diffuse"
    diffuse.image = diffuse_image
    diffuse.extension = "REPEAT"
    diffuse.location = (-550, 170)
    links.new(diffuse.outputs["Color"], principled.inputs["Base Color"])

    normal_texture = nodes.new("ShaderNodeTexImage")
    normal_texture.name = "CC0 aerial grass rock / normal GL"
    normal_texture.image = normal_image
    normal_texture.extension = "REPEAT"
    normal_texture.location = (-550, -80)
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.location = (180, -110)
    normal_map.inputs["Strength"].default_value = 0.72
    links.new(normal_texture.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], principled.inputs["Normal"])

    arm = nodes.new("ShaderNodeTexImage")
    arm.name = "CC0 aerial grass rock / ARM"
    arm.image = arm_image
    arm.extension = "REPEAT"
    arm.location = (-550, -340)
    separate = nodes.new("ShaderNodeSeparateColor")
    separate.location = (-80, -300)
    links.new(arm.outputs["Color"], separate.inputs["Color"])
    links.new(separate.outputs["Green"], principled.inputs["Roughness"])
    links.new(separate.outputs["Blue"], principled.inputs["Metallic"])

    material["source_asset"] = "Poly Haven / aerial_grass_rock"
    material["source_license"] = "CC0"
    material["source_resolution"] = "1k-web-benchmark"


def terrain_height(x: float, y: float) -> float:
    macro = layout.terrain_height(x, y)
    geological = (
        0.18 * math.sin(x * 1.19 + y * 0.31)
        + 0.11 * math.sin(x * 2.41 - y * 0.67)
        + 0.07 * math.sin((x + y) * 4.07)
    )
    erosion = -0.24 * math.exp(-((x - 0.8 * math.sin(y * 0.12)) / 2.7) ** 2)
    lake_basin = -0.32 * math.exp(-((x + 0.3) / 6.8) ** 2 - ((y - 12.0) / 11.5) ** 2)
    return max(-0.24, macro + geological + erosion + lake_basin)


def add_high_detail_terrain(material, target, columns: int = 97, rows: int = 161):
    vertices = []
    faces = []
    for row in range(rows):
        v = row / (rows - 1)
        y = -34.0 + v * 90.0
        coast = layout.coastline_x(y)
        for column in range(columns):
            u = column / (columns - 1)
            x = coast + u * (24.0 - coast)
            vertices.append((x, y, terrain_height(x, y)))

    for row in range(rows - 1):
        for column in range(columns - 1):
            a = row * columns + column
            b = a + 1
            c = a + columns + 1
            d = a + columns
            faces.append((a, b, c, d))

    mesh = bpy.data.meshes.new("Journey terrain / benchmark mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    terrain = bpy.data.objects.new("Journey terrain / benchmark", mesh)
    target.objects.link(terrain)
    terrain.data.materials.append(material)

    uv_layer = mesh.uv_layers.new(name="UVMap")
    for loop in mesh.loops:
        coordinate = mesh.vertices[loop.vertex_index].co
        uv_layer.data[loop.index].uv = ((coordinate.x + 24.0) / 14.0, (coordinate.y + 34.0) / 14.0)

    for polygon in mesh.polygons:
        polygon.use_smooth = True
    terrain["performance_class"] = "benchmark-medium"
    terrain["final_surface_required"] = False
    terrain["surface_source"] = "Poly Haven / aerial_grass_rock / CC0"
    return terrain


def ridge_noise(index: int, t: float, angle: float) -> float:
    return (
        0.085 * math.sin(angle * 3.0 + t * 2.4 + index)
        + 0.045 * math.sin(angle * 7.0 - t * 4.1 + index * 1.9)
        + 0.022 * math.sin(angle * 13.0 + t * 7.0 + index * 2.3)
    )


def add_ridge_mass(index: int, spec, rock_material, snow_material, target):
    center_x, center_y, radius, height = spec
    base_z = terrain_height(center_x, center_y) - 0.55
    segments = 88
    rings = 23
    vertices = []
    faces = []

    for ring in range(rings):
        t = ring / (rings - 1)
        ring_radius = radius * max(0.018, (1.0 - t ** 1.22) ** 0.76)
        summit_drift_x = math.sin(index * 1.37) * radius * 0.12 * t
        summit_drift_y = math.cos(index * 0.91) * radius * 0.09 * t
        z = base_z + height * t
        for segment in range(segments):
            angle = segment / segments * math.tau
            noise = ridge_noise(index, t, angle)
            shoulder = 1.0 + noise * (1.0 - t * 0.45)
            elliptical = 0.82 + 0.18 * math.sin(angle + index)
            x = center_x + summit_drift_x + math.cos(angle) * ring_radius * shoulder
            y = center_y + summit_drift_y + math.sin(angle) * ring_radius * shoulder * elliptical
            local_z = z + noise * radius * 0.34 * (1.0 - t)
            vertices.append((x, y, local_z))

    for ring in range(rings - 1):
        for segment in range(segments):
            next_segment = (segment + 1) % segments
            a = ring * segments + segment
            b = ring * segments + next_segment
            c = (ring + 1) * segments + next_segment
            d = (ring + 1) * segments + segment
            faces.append((a, b, c, d))

    mesh = bpy.data.meshes.new(f"Journey ridge mass {index + 1:02} mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    ridge = bpy.data.objects.new(f"Journey ridge mass {index + 1:02}", mesh)
    target.objects.link(ridge)
    ridge.data.materials.append(rock_material)
    ridge.data.materials.append(snow_material)

    uv_layer = mesh.uv_layers.new(name="UVMap")
    for loop in mesh.loops:
        vertex_index = loop.vertex_index
        ring = vertex_index // segments
        segment = vertex_index % segments
        uv_layer.data[loop.index].uv = (segment / segments * 3.0, ring / (rings - 1) * height / 12.0)

    for polygon in mesh.polygons:
        polygon.use_smooth = True
        average_ring = sum(mesh.loops[loop_index].vertex_index // segments for loop_index in polygon.loop_indices) / len(polygon.loop_indices)
        polygon.material_index = 1 if average_ring / (rings - 1) > 0.73 and index >= 2 else 0

    ridge["surface_source"] = "Poly Haven / aerial_grass_rock / CC0"
    ridge["geography_role"] = "authored ridge mass"
    return ridge


def add_irregular_lake(material, target):
    center_x = -0.4
    center_y = 12.0
    segments = 72
    vertices = [(center_x, center_y, 0.46)]
    for segment in range(segments):
        angle = segment / segments * math.tau
        edge = 1.0 + 0.09 * math.sin(angle * 3 + 0.5) + 0.045 * math.sin(angle * 7 - 0.8)
        x = center_x + math.cos(angle) * 6.3 * edge
        y = center_y + math.sin(angle) * 10.2 * edge
        vertices.append((x, y, 0.46))
    faces = []
    for segment in range(segments):
        faces.append((0, segment + 1, ((segment + 1) % segments) + 1))
    mesh = bpy.data.meshes.new("Alpine lake / benchmark mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    lake = bpy.data.objects.new("Alpine lake / benchmark", mesh)
    target.objects.link(lake)
    lake.data.materials.append(material)
    lake["water_role"] = "alpine lake"
    return lake


def add_waterfall_sheet(material, target):
    columns = 7
    rows = 17
    vertices = []
    faces = []
    for row in range(rows):
        v = row / (rows - 1)
        z = 11.2 - v * 10.4
        for column in range(columns):
            u = column / (columns - 1)
            x = 3.4 + (u - 0.5) * (1.35 + v * 0.32) + 0.08 * math.sin(v * 16 + u * 3)
            y = 28.5 + 0.16 * math.sin(v * 10 + u * 5)
            vertices.append((x, y, z))
    for row in range(rows - 1):
        for column in range(columns - 1):
            a = row * columns + column
            b = a + 1
            c = a + columns + 1
            d = a + columns
            faces.append((a, b, c, d))
    mesh = bpy.data.meshes.new("Waterfall / benchmark mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    waterfall = bpy.data.objects.new("Waterfall / benchmark", mesh)
    target.objects.link(waterfall)
    waterfall.data.materials.append(material)
    waterfall["water_role"] = "waterfall veil"
    return waterfall


def add_boulder_field(material, target) -> None:
    random_source = random.Random(2308)
    boulders = []
    for index in range(28):
        side = -1 if index % 2 == 0 else 1
        y = random_source.uniform(-15.0, 31.0)
        x = random_source.uniform(5.5, 18.5) * side
        z = terrain_height(x, y) + random_source.uniform(0.0, 0.28)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=(x, y, z))
        boulder = bpy.context.object
        boulder.name = f"Journey boulder {index + 1:02}"
        scale = random_source.uniform(0.55, 1.75)
        boulder.scale = (
            scale * random_source.uniform(0.85, 1.45),
            scale * random_source.uniform(0.75, 1.25),
            scale * random_source.uniform(0.55, 0.95),
        )
        boulder.rotation_euler = (
            random_source.uniform(-0.35, 0.35),
            random_source.uniform(-0.35, 0.35),
            random_source.uniform(0.0, math.tau),
        )
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        boulder.data.materials.append(material)
        layout.base.move_to_collection(boulder, target)
        boulders.append(boulder)

    bpy.ops.object.select_all(action="DESELECT")
    for boulder in boulders:
        boulder.select_set(True)
    bpy.context.view_layer.objects.active = boulders[0]
    bpy.ops.object.join()
    boulders[0].name = "Journey boulder field / benchmark"
    for polygon in boulders[0].data.polygons:
        polygon.use_smooth = True


def configure_water_material(material, color, roughness: float) -> None:
    material.diffuse_color = (*color, 1.0)
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    if principled is None:
        return
    principled.inputs["Base Color"].default_value = (*color, 1.0)
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Metallic"].default_value = 0.12
    if "Coat Weight" in principled.inputs:
        principled.inputs["Coat Weight"].default_value = 0.55
    if "Coat Roughness" in principled.inputs:
        principled.inputs["Coat Roughness"].default_value = 0.08
    material["runtime_animation"] = "subtle-surface-drift"


def configure_scene() -> None:
    scene = bpy.context.scene
    scene["madagin_world_version"] = "0.3-valley-reveal-benchmark"
    scene["benchmark_scope"] = "valley reveal only"
    scene["public_release"] = False
    scene["texture_provenance"] = "Poly Haven / aerial_grass_rock / CC0"
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 788
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(PREVIEW_PATH)
    scene.render.film_transparent = False
    scene.world.color = (0.012, 0.032, 0.046)


def build_benchmark() -> None:
    layout.build_world()
    journey = bpy.data.collections.get("WORLD_MOUNTAIN_JOURNEY")
    if journey is None:
        raise RuntimeError("Expected v0.2 journey collection was not created")

    remove_object("Journey terrain / medium layout")
    remove_prefix("Journey mountain")
    remove_prefix("Journey snowcap")
    remove_prefix("Atmosphere cloud")
    remove_object("Alpine lake")
    remove_object("Waterfall veil")
    clear_collection("WORLD_CONTACT_ASCENT")

    terrain_material = bpy.data.materials.get("Terrain / layout")
    rock_material = bpy.data.materials.get("Rock / layout")
    snow_material = bpy.data.materials.get("Snow / layout")
    lake_material = bpy.data.materials.get("Lake / layout")
    waterfall_material = bpy.data.materials.get("Waterfall / layout")
    ocean_material = bpy.data.materials.get("Ocean / western field")
    if None in (terrain_material, rock_material, snow_material, lake_material, waterfall_material, ocean_material):
        raise RuntimeError("Expected v0.2 materials were not created")

    terrain_material.name = "Terrain / CC0 benchmark"
    rock_material.name = "Rock / CC0 benchmark"
    configure_pbr_material(terrain_material)
    configure_pbr_material(rock_material)
    configure_water_material(lake_material, (0.035, 0.23, 0.29), 0.16)
    configure_water_material(waterfall_material, (0.24, 0.58, 0.67), 0.09)
    configure_water_material(ocean_material, (0.018, 0.12, 0.18), 0.18)

    add_high_detail_terrain(terrain_material, journey)
    for index, spec in enumerate(MOUNTAIN_SPECS):
        add_ridge_mass(index, spec, rock_material, snow_material, journey)
    add_irregular_lake(lake_material, journey)
    add_waterfall_sheet(waterfall_material, journey)
    add_boulder_field(rock_material, journey)

    preview_camera = bpy.data.objects.get("CAMERA_WORLD_MAP_PREVIEW_V02")
    if preview_camera is None:
        raise RuntimeError("Expected preview camera was not created")
    preview_camera.location = (1.0, -59.0, 27.0)
    preview_camera.data.lens = 52
    layout.base.look_at(preview_camera, (0, 10, 9.0))
    bpy.context.scene.camera = preview_camera

    sun = bpy.data.objects.get("SUNSET_FROM_WESTERN_OCEAN")
    if sun is not None:
        sun.location = (-52, -32, 48)
        layout.base.look_at(sun, (0, 12, 5))
        sun.data.energy = 2.6
        sun.data.color = (1.0, 0.83, 0.64)
    fill = bpy.data.objects.get("SKY_FILL_PROXY")
    if fill is not None:
        fill.hide_set(False)
        fill.location = (22, -24, 48)
        layout.base.look_at(fill, (0, 10, 6))
        fill.data.energy = 1550
        fill.data.size = 55
        fill.data.color = (0.46, 0.67, 1.0)

    bpy.ops.object.light_add(type="AREA", location=(0, -42, 28))
    front_fill = bpy.context.object
    front_fill.name = "VALLEY_REVEAL_FRONT_FILL"
    front_fill.data.energy = 920
    front_fill.data.shape = "DISK"
    front_fill.data.size = 30
    front_fill.data.color = (0.78, 0.84, 1.0)
    layout.base.look_at(front_fill, (0, 8, 5))
    atmosphere_collection = bpy.data.collections.get("WORLD_ATMOSPHERE")
    if atmosphere_collection is not None:
        layout.base.move_to_collection(front_fill, atmosphere_collection)

    world = bpy.context.scene.world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    if background is not None:
        background.inputs["Color"].default_value = (0.018, 0.045, 0.065, 1.0)
        background.inputs["Strength"].default_value = 0.42

    configure_scene()
    bpy.ops.object.select_all(action="DESELECT")
    preview_camera.select_set(True)
    bpy.context.view_layer.objects.active = preview_camera


def save_export_render() -> None:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

    diagnostics = bpy.data.collections.get("DIAGNOSTIC_CAMERA_RAILS")
    diagnostic_objects = list(diagnostics.all_objects) if diagnostics else []
    for diagnostic in diagnostic_objects:
        if diagnostic.type not in {"LIGHT", "CAMERA"}:
            diagnostic.hide_render = True
            diagnostic.hide_set(True)

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

    bpy.context.scene.render.filepath = str(PREVIEW_PATH)
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    build_benchmark()
    save_export_render()
    print(f"BLEND={BLEND_PATH}")
    print(f"GLB={GLB_PATH}")
    print(f"PREVIEW={PREVIEW_PATH}")
