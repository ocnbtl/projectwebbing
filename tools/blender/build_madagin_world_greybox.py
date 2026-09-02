from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "world-source"
RUNTIME_DIR = ROOT / "public" / "world" / "v0"
PREVIEW_DIR = ROOT / "docs" / "design" / "references"
BLEND_PATH = SOURCE_DIR / "madagin-world-greybox-v0.blend"
GLB_PATH = RUNTIME_DIR / "madagin-world-greybox-v0.glb"
PREVIEW_PATH = PREVIEW_DIR / "madagin-world-greybox-v0.png"


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def material(name: str, color: tuple[float, float, float, float], roughness: float = 0.7, metallic: float = 0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    node = mat.node_tree.nodes.get("Principled BSDF")
    node.inputs["Base Color"].default_value = color
    node.inputs["Roughness"].default_value = roughness
    node.inputs["Metallic"].default_value = metallic
    return mat


def collection(name: str):
    group = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(group)
    return group


def move_to_collection(obj, target) -> None:
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    target.objects.link(obj)


def add_box(name: str, location, scale, mat, target):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new("Soft geological edge", "BEVEL")
    bevel.width = min(scale) * 0.12
    bevel.segments = 2
    move_to_collection(obj, target)
    return obj


def add_mountain(name: str, location, radius: float, height: float, mat, target, vertices: int = 16):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=0.4, depth=height, location=(location[0], location[1], location[2] + height / 2))
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    move_to_collection(obj, target)
    return obj


def add_sphere(name: str, location, scale, mat, target):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    move_to_collection(obj, target)
    return obj


def add_path(name: str, points, mat, target, width: float = 0.18):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = width
    curve.bevel_resolution = 2
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate in zip(spline.bezier_points, points):
        point.co = coordinate
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    curve.materials.append(mat)
    target.objects.link(obj)
    return obj


def add_anchor(name: str, location, target, role: str, behavior: str):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "CIRCLE"
    obj.empty_display_size = 2.5
    obj.location = location
    obj["madagin_role"] = role
    obj["camera_behavior"] = behavior
    target.objects.link(obj)
    return obj


def look_at(obj, target) -> None:
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def build_world() -> None:
    reset_scene()

    mats = {
        "forest": material("Forest / proxy", (0.035, 0.19, 0.15, 1.0), 0.95),
        "ridge": material("Mountain / proxy", (0.16, 0.24, 0.25, 1.0), 0.88),
        "snow": material("Snow / proxy", (0.82, 0.89, 0.91, 1.0), 0.7),
        "water": material("Water / proxy", (0.035, 0.27, 0.42, 1.0), 0.2, 0.15),
        "coast": material("Coast / proxy", (0.53, 0.50, 0.35, 1.0), 0.95),
        "cloud": material("Cloud / proxy", (0.76, 0.84, 0.87, 1.0), 1.0),
        "path": material("Camera rail", (0.03, 0.27, 1.0, 1.0), 0.45, 0.1),
        "contact": material("Contact ascent", (0.48, 0.18, 0.42, 1.0), 0.75),
    }

    landing = collection("ZONE_LANDING_VALLEY")
    about = collection("ZONE_ABOUT_COAST")
    projects = collection("ZONE_PROJECTS_SKY")
    contact = collection("ZONE_CONTACT_MOUNTAIN")
    rails = collection("CAMERA_RAILS_AND_ANCHORS")

    add_box("Valley floor", (0, 4, -1.2), (18, 21, 1.2), mats["forest"], landing)
    add_box("Alpine lake", (-3, 5, 0.08), (8.5, 10.5, 0.12), mats["water"], landing)
    for index, spec in enumerate((
        (-18, 6, 8, 18), (-11, 19, 7, 15), (8, 22, 9, 23), (18, 12, 7, 17),
        (12, -5, 6, 14), (-14, -6, 6, 13),
    )):
        x, y, radius, height = spec
        peak = add_mountain(f"Valley ridge {index + 1:02}", (x, y, 0), radius, height, mats["ridge"], landing)
        if index in (0, 2):
            add_mountain(f"Valley snowcap {index + 1:02}", (x, y, height * 0.68), radius * 0.42, height * 0.32, mats["snow"], landing)
    add_box("Waterfall veil", (8, 10, 4.2), (0.35, 2.5, 4.1), mats["water"], landing)

    add_box("Coastal shelf", (-52, 14, -0.8), (14, 16, 0.8), mats["coast"], about)
    add_box("Open ocean", (-70, 14, -0.45), (12, 28, 0.35), mats["water"], about)
    add_mountain("Coastal headland", (-47, 23, 0), 9, 12, mats["forest"], about)
    add_mountain("Coastal headland shadow", (-55, 31, 0), 12, 17, mats["ridge"], about)

    cloud_specs = (
        (-12, 1, 36, 6, 3, 1.7), (-4, 4, 39, 7, 3.2, 2.2), (7, 0, 37, 8, 3.6, 2.0),
        (16, 5, 41, 6, 2.7, 1.6), (1, 14, 43, 9, 4.0, 2.4),
    )
    for index, (x, y, z, sx, sy, sz) in enumerate(cloud_specs):
        add_sphere(f"Cloud bank {index + 1:02}", (x, y, z), (sx, sy, sz), mats["cloud"], projects)

    add_box("Contact foothill", (48, 18, -1), (14, 15, 1), mats["forest"], contact)
    add_mountain("Contact summit", (51, 22, 0), 13, 29, mats["contact"], contact, vertices=20)
    add_mountain("Contact summit cap", (51, 22, 21), 5.2, 8, mats["snow"], contact, vertices=20)
    ascent_points = []
    for index in range(7):
        progress = index / 6
        x = 42 + math.sin(progress * math.pi * 1.75) * 4.2
        y = 8 + progress * 14
        z = 0.8 + progress * 24
        ascent_points.append((x, y, z))
        step = add_sphere(f"Contact step {index + 1:02}", (x, y, z), (1.1, 1.1, 0.45), mats["path"], contact)
        step["form_step"] = index + 1
    add_path("Contact ascent rail", ascent_points, mats["path"], rails, 0.22)

    add_path("Landing to coast transition", [(0, 1, 6), (-16, 8, 10), (-34, 12, 7), (-49, 14, 5)], mats["path"], rails)
    add_path("Landing to sky transition", [(5, 0, 7), (12, 3, 18), (8, 3, 30), (0, 2, 38)], mats["path"], rails)
    add_path("Landing to contact transition", [(6, 5, 5), (18, 8, 8), (32, 12, 6), (42, 9, 3)], mats["path"], rails)

    add_anchor("ANCHOR_LANDING", (0, 0, 0), rails, "Landing + values", "guided continuous flight")
    add_anchor("ANCHOR_ABOUT", (-52, 14, 0), rails, "About", "living background; quiet camera")
    add_anchor("ANCHOR_PROJECTS", (0, 0, 36), rails, "Selected projects", "living atmosphere; locked reading plane")
    add_anchor("ANCHOR_CONTACT", (48, 18, 0), rails, "Let's Talk", "one form step per rise")

    bpy.ops.object.camera_add(location=(82, -96, 76))
    camera = bpy.context.object
    camera.name = "CAMERA_WORLD_MAP_PREVIEW"
    camera.data.lens = 52
    look_at(camera, (-3, 8, 12))
    bpy.context.scene.camera = camera
    move_to_collection(camera, rails)

    bpy.ops.object.light_add(type="SUN", location=(-30, -40, 70))
    sun = bpy.context.object
    sun.name = "SUN_GOLDEN_HOUR_PROXY"
    sun.rotation_euler = (math.radians(28), math.radians(-18), math.radians(-34))
    sun.data.energy = 2.2
    sun.data.color = (1.0, 0.73, 0.43)
    move_to_collection(sun, rails)

    bpy.ops.object.light_add(type="AREA", location=(-15, -15, 55))
    fill = bpy.context.object
    fill.name = "SKY_FILL_PROXY"
    fill.data.energy = 850
    fill.data.shape = "DISK"
    fill.data.size = 38
    fill.data.color = (0.58, 0.72, 1.0)
    look_at(fill, (0, 8, 0))
    move_to_collection(fill, rails)
    fill.hide_set(True)

    scene = bpy.context.scene
    scene["madagin_world_version"] = "0.1-greybox"
    scene["coordinate_unit"] = "meters"
    scene["public_release"] = False
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 675
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(PREVIEW_PATH)
    scene.render.film_transparent = False
    scene.world.color = (0.025, 0.055, 0.075)
    bpy.ops.object.select_all(action="DESELECT")
    camera.select_set(True)
    bpy.context.view_layer.objects.active = camera


def save_and_export() -> None:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        export_format="GLB",
        export_extras=True,
        export_cameras=False,
        export_lights=False,
        export_apply=True,
    )
    bpy.context.scene.render.filepath = str(PREVIEW_PATH)
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    build_world()
    save_and_export()
    print(f"BLEND={BLEND_PATH}")
    print(f"GLB={GLB_PATH}")
    print(f"PREVIEW={PREVIEW_PATH}")
