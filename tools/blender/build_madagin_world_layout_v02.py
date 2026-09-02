from __future__ import annotations

import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_madagin_world_greybox as base


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "world-source"
RUNTIME_DIR = ROOT / "public" / "world" / "v0"
PREVIEW_DIR = ROOT / "docs" / "design" / "references"
BLEND_PATH = SOURCE_DIR / "madagin-world-layout-v0.2.blend"
GLB_PATH = RUNTIME_DIR / "madagin-world-layout-v0.2.glb"
PREVIEW_PATH = PREVIEW_DIR / "madagin-world-layout-v0.2.png"


CHECKPOINTS = (
    ("RIDGE", (0, -38, 10), (0, -12, 5), (-48, -10, 2)),
    ("REVEAL", (0, -20, 10), (0, -3, 4), (-52, 5, 1)),
    ("LAKE", (0, 4, 8), (0, 15, 3), (-54, 20, 1)),
    ("WATERFALL", (0, 20, 9), (3.4, 28.5, 6), (-55, 33, 1)),
    ("SUMMIT", (2, 35, 22), (0, 46, 15), (-58, 47, 0)),
)


def terrain_height(x: float, y: float) -> float:
    broad_undulation = 0.42 * math.sin(x * 0.23 + y * 0.08) + 0.24 * math.sin(y * 0.31)
    east_wall = max(0.0, (x - 7.0) / 15.0) ** 1.7 * (8.0 + 1.8 * math.sin(y * 0.12))
    west_foothill = math.exp(-((x + 11.5) / 5.4) ** 2) * (2.4 + 0.8 * math.sin(y * 0.19))
    northern_lift = max(0.0, (y - 27.0) / 23.0) ** 1.45 * 8.5
    valley_cut = math.exp(-((x - 0.5) / 6.2) ** 2) * 0.9
    river_cut = math.exp(-((x + 1.8 * math.sin(y * 0.08)) / 2.4) ** 2) * 0.38
    return max(-0.18, 0.65 + broad_undulation + east_wall + west_foothill + northern_lift - valley_cut - river_cut)


def coastline_x(y: float) -> float:
    return -23.5 + 1.35 * math.sin(y * 0.13) + 0.7 * math.sin(y * 0.37 + 0.8)


def add_terrain_strip(name: str, mat, target, columns: int = 49, rows: int = 81):
    vertices = []
    faces = []
    for row in range(rows):
        v = row / (rows - 1)
        y = -34.0 + v * 90.0
        coast = coastline_x(y)
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

    mesh = bpy.data.meshes.new(f"{name} mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    terrain = bpy.data.objects.new(name, mesh)
    target.objects.link(terrain)
    terrain.data.materials.append(mat)
    terrain["performance_class"] = "layout-medium"
    terrain["final_surface_required"] = True
    return terrain


def add_shoreline(mat, target):
    points = []
    for index in range(25):
        y = -34.0 + index / 24 * 90.0
        points.append((coastline_x(y) - 0.15, y, 0.06))
    return base.add_path("Western shoreline", points, mat, target, width=0.48)


def add_checkpoint_anchor(name: str, camera, forward, ocean, target):
    anchor = base.add_anchor(
        f"CHECKPOINT_{name}",
        camera,
        target,
        "mountain journey checkpoint",
        "forward journey; contextual pan west; contextual tilt sky",
    )
    anchor["forward_look_at"] = forward
    anchor["ocean_look_at"] = ocean
    anchor["about_translation"] = "none"
    anchor["projects_translation"] = "none"
    return anchor


def build_world() -> None:
    base.reset_scene()

    mats = {
        "terrain": base.material("Terrain / layout", (0.035, 0.18, 0.12, 1.0), 0.98),
        "ridge": base.material("Rock / layout", (0.19, 0.25, 0.24, 1.0), 0.91),
        "snow": base.material("Snow / layout", (0.84, 0.89, 0.89, 1.0), 0.76),
        "ocean": base.material("Ocean / western field", (0.025, 0.18, 0.29, 1.0), 0.18, 0.12),
        "lake": base.material("Lake / layout", (0.035, 0.30, 0.39, 1.0), 0.2, 0.1),
        "shore": base.material("Shore / layout", (0.48, 0.43, 0.30, 1.0), 0.96),
        "cloud": base.material("Cloud / layout", (0.76, 0.84, 0.86, 1.0), 1.0),
        "rail": base.material("Camera rail / diagnostic", (0.03, 0.27, 1.0, 1.0), 0.42, 0.1),
        "contact": base.material("Contact ascent / diagnostic", (0.47, 0.17, 0.41, 1.0), 0.78),
        "waterfall": base.material("Waterfall / layout", (0.34, 0.68, 0.80, 1.0), 0.14, 0.08),
    }

    journey = base.collection("WORLD_MOUNTAIN_JOURNEY")
    ocean = base.collection("WORLD_WESTERN_OCEAN")
    atmosphere = base.collection("WORLD_ATMOSPHERE")
    contact = base.collection("WORLD_CONTACT_ASCENT")
    rails = base.collection("DIAGNOSTIC_CAMERA_RAILS")

    add_terrain_strip("Journey terrain / medium layout", mats["terrain"], journey)
    base.add_box("Western ocean field", (-51, 11, -0.55), (29, 51, 0.3), mats["ocean"], ocean)
    add_shoreline(mats["shore"], ocean)

    mountain_specs = (
        (-11, -18, 6.5, 12), (13, -13, 8.5, 18), (-10, -1, 7.5, 15),
        (15, 7, 10.5, 23), (-9, 18, 8.0, 18), (15, 27, 10.5, 27),
        (-7, 39, 11.5, 31), (12, 48, 13.5, 35),
    )
    for index, (x, y, radius, height) in enumerate(mountain_specs):
        base.add_mountain(f"Journey mountain {index + 1:02}", (x, y, terrain_height(x, y) - 0.4), radius, height, mats["ridge"], journey, vertices=24)
        if index in (3, 5, 6, 7):
            base.add_mountain(
                f"Journey snowcap {index + 1:02}",
                (x, y, terrain_height(x, y) + height * 0.70),
                radius * 0.38,
                height * 0.30,
                mats["snow"],
                journey,
                vertices=24,
            )

    base.add_box("Alpine lake", (-0.5, 12, 0.32), (7.5, 8.8, 0.18), mats["lake"], journey)
    base.add_box("Waterfall veil", (3.4, 28.5, 5.6), (0.3, 2.2, 5.5), mats["waterfall"], journey)
    base.add_path(
        "Mountain story rail",
        [camera for _, camera, _, _ in CHECKPOINTS],
        mats["rail"],
        rails,
        width=0.16,
    )

    for name, camera, forward, ocean_target in CHECKPOINTS:
        add_checkpoint_anchor(name, camera, forward, ocean_target, rails)

    cloud_specs = (
        (-13, -10, 34, 7, 3.1, 1.8), (-3, 4, 38, 8, 3.3, 2.0),
        (9, 17, 41, 7, 3.1, 1.8), (-1, 31, 45, 10, 4.2, 2.4),
        (14, 46, 48, 9, 3.8, 2.1),
    )
    for index, (x, y, z, sx, sy, sz) in enumerate(cloud_specs):
        base.add_sphere(f"Atmosphere cloud {index + 1:02}", (x, y, z), (sx, sy, sz), mats["cloud"], atmosphere)

    base.add_box("Contact foothill", (45, 20, -0.6), (13, 17, 0.8), mats["terrain"], contact)
    base.add_mountain("Contact summit", (46, 26, 0), 13, 30, mats["contact"], contact, vertices=24)
    base.add_mountain("Contact summit cap", (46, 26, 21), 5.0, 9, mats["snow"], contact, vertices=24)
    ascent_points = []
    for index in range(7):
        progress = index / 6
        x = 38 + math.sin(progress * math.pi * 1.8) * 4.0
        y = 9 + progress * 17
        z = 0.8 + progress * 24
        ascent_points.append((x, y, z))
        step = base.add_sphere(
            f"Contact step {index + 1:02}",
            (x, y, z),
            (1.05, 1.05, 0.42),
            mats["rail"],
            contact,
        )
        step["form_step"] = index + 1
    base.add_path("Contact ascent rail", ascent_points, mats["rail"], rails, 0.2)
    base.add_path(
        "Journey to contact acceleration",
        [(8, 6, 8), (18, 10, 9), (28, 12, 7), (38, 9, 3)],
        mats["rail"],
        rails,
        0.16,
    )

    base.add_anchor("ANCHOR_CONTACT", (38, 9, 1), rails, "Let's Talk", "accelerate from saved journey checkpoint")
    base.add_anchor("ANCHOR_OCEAN_WEST", (-52, 12, 0), rails, "About contextual view", "pan only from journey checkpoint")
    base.add_anchor("ANCHOR_SKY", (0, 20, 42), rails, "Projects contextual view", "tilt only from journey checkpoint")

    bpy.ops.object.camera_add(location=(92, -118, 92))
    camera = bpy.context.object
    camera.name = "CAMERA_WORLD_MAP_PREVIEW_V02"
    camera.data.lens = 55
    base.look_at(camera, (-7, 10, 10))
    bpy.context.scene.camera = camera
    base.move_to_collection(camera, rails)

    bpy.ops.object.light_add(type="SUN", location=(-48, -36, 72))
    sun = bpy.context.object
    sun.name = "SUNSET_FROM_WESTERN_OCEAN"
    sun.rotation_euler = (math.radians(34), math.radians(-21), math.radians(-58))
    sun.data.energy = 2.4
    sun.data.color = (1.0, 0.71, 0.42)
    base.move_to_collection(sun, rails)

    bpy.ops.object.light_add(type="AREA", location=(-22, -8, 60))
    fill = bpy.context.object
    fill.name = "SKY_FILL_PROXY"
    fill.data.energy = 900
    fill.data.shape = "DISK"
    fill.data.size = 42
    fill.data.color = (0.55, 0.70, 1.0)
    base.look_at(fill, (0, 12, 4))
    base.move_to_collection(fill, rails)
    fill.hide_set(True)

    scene = bpy.context.scene
    scene["madagin_world_version"] = "0.2-contextual-ocean-layout"
    scene["ocean_side"] = "west-left"
    scene["about_behavior"] = "pan-only-from-current-checkpoint"
    scene["projects_behavior"] = "tilt-only-from-current-checkpoint"
    scene["public_release"] = False
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 788
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(PREVIEW_PATH)
    scene.render.film_transparent = False
    scene.world.color = (0.018, 0.045, 0.065)
    bpy.ops.object.select_all(action="DESELECT")
    camera.select_set(True)
    bpy.context.view_layer.objects.active = camera


def save_and_export() -> None:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

    # Rails and anchors are authoring diagnostics. The journey camera sits on
    # the rail by definition, so exporting the rail would put the WebGL camera
    # inside a blue tube and occlude the world. Keep diagnostics in the .blend
    # and map render, but remove them from the runtime payload.
    diagnostic_collection = bpy.data.collections.get("DIAGNOSTIC_CAMERA_RAILS")
    diagnostic_objects = list(diagnostic_collection.all_objects) if diagnostic_collection else []
    for diagnostic in diagnostic_objects:
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

    for diagnostic in diagnostic_objects:
        diagnostic.hide_render = False
        diagnostic.hide_set(False)

    bpy.context.scene.render.filepath = str(PREVIEW_PATH)
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    build_world()
    save_and_export()
    print(f"BLEND={BLEND_PATH}")
    print(f"GLB={GLB_PATH}")
    print(f"PREVIEW={PREVIEW_PATH}")
