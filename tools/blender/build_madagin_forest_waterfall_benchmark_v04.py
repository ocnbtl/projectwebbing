from __future__ import annotations

import math
from pathlib import Path
import random
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_madagin_valley_benchmark_v03 as valley


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "world-source"
RUNTIME_DIR = ROOT / "public" / "world" / "v04"
PREVIEW_DIR = ROOT / "docs" / "design" / "references"
BLEND_PATH = SOURCE_DIR / "madagin-forest-waterfall-benchmark-v0.4.blend"
GLB_PATH = RUNTIME_DIR / "madagin-forest-waterfall-benchmark-v0.4.glb"
PREVIEW_PATH = PREVIEW_DIR / "madagin-forest-waterfall-benchmark-v0.4.png"


def remove_object(name: str) -> None:
    obj = bpy.data.objects.get(name)
    if obj is not None:
        bpy.data.objects.remove(obj, do_unlink=True)


def distort_rock(mesh, seed: float) -> None:
    for vertex in mesh.vertices:
        direction = vertex.co.normalized()
        perturbation = (
            1.0
            + 0.11 * math.sin(direction.x * 7.1 + seed)
            + 0.075 * math.sin(direction.y * 10.7 - seed * 0.63)
            + 0.045 * math.sin((direction.x + direction.z) * 17.3 + seed * 1.7)
        )
        vertex.co *= perturbation


def add_rock(
    index: int,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    rotation: tuple[float, float, float],
    material,
    target,
):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.0, location=location)
    rock = bpy.context.object
    rock.name = f"Journey detailed rock {index + 1:02}"
    distort_rock(rock.data, 2.7 + index * 1.19)
    rock.scale = scale
    rock.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    rock.data.materials.append(material)
    valley.layout.base.move_to_collection(rock, target)
    return rock


def add_detailed_rock_field(material, target) -> None:
    random_source = random.Random(40823)
    rocks = []

    for index in range(34):
        side = -1 if index % 2 == 0 else 1
        y = random_source.uniform(-12.0, 34.0)
        x = random_source.uniform(7.2, 19.4) * side
        z = valley.terrain_height(x, y) + random_source.uniform(0.05, 0.32)
        base_scale = random_source.uniform(0.48, 1.72)
        rocks.append(
            add_rock(
                index,
                (x, y, z),
                (
                    base_scale * random_source.uniform(0.9, 1.55),
                    base_scale * random_source.uniform(0.72, 1.28),
                    base_scale * random_source.uniform(0.48, 0.92),
                ),
                (
                    random_source.uniform(-0.42, 0.42),
                    random_source.uniform(-0.42, 0.42),
                    random_source.uniform(0.0, math.tau),
                ),
                material,
                target,
            )
        )

    for offset in range(12):
        angle = offset / 12 * math.tau + random_source.uniform(-0.14, 0.14)
        radius = random_source.uniform(1.6, 4.3)
        x = 3.4 + math.cos(angle) * radius
        y = 28.5 + math.sin(angle) * radius * 0.62
        z = valley.terrain_height(x, y) + random_source.uniform(0.05, 0.22)
        base_scale = random_source.uniform(0.42, 1.08)
        rocks.append(
            add_rock(
                34 + offset,
                (x, y, z),
                (
                    base_scale * random_source.uniform(0.88, 1.42),
                    base_scale * random_source.uniform(0.72, 1.18),
                    base_scale * random_source.uniform(0.54, 0.94),
                ),
                (
                    random_source.uniform(-0.28, 0.28),
                    random_source.uniform(-0.28, 0.28),
                    random_source.uniform(0.0, math.tau),
                ),
                material,
                target,
            )
        )

    bpy.ops.object.select_all(action="DESELECT")
    for rock in rocks:
        rock.select_set(True)
    bpy.context.view_layer.objects.active = rocks[0]
    bpy.ops.object.join()
    rock_field = rocks[0]
    rock_field.name = "Journey detailed rock field / v0.4"
    for polygon in rock_field.data.polygons:
        polygon.use_smooth = True

    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.012)
    bpy.ops.object.mode_set(mode="OBJECT")
    rock_field["performance_class"] = "mid-detail-single-draw-field"
    rock_field["surface_source"] = "Poly Haven / aerial_grass_rock / CC0"


def configure_v04_scene() -> None:
    scene = bpy.context.scene
    scene["madagin_world_version"] = "0.4-forest-waterfall-benchmark"
    scene["benchmark_scope"] = "mid-distance vegetation, detailed rocks, waterfall atmosphere"
    scene["public_release"] = False
    scene["tree_source"] = "Poly Haven / fir_tree_01 textures / CC0 / runtime geometry"
    scene.render.filepath = str(PREVIEW_PATH)


def build_benchmark() -> None:
    valley.build_benchmark()
    journey = bpy.data.collections.get("WORLD_MOUNTAIN_JOURNEY")
    if journey is None:
        raise RuntimeError("Expected v0.3 journey collection was not created")
    rock_material = bpy.data.materials.get("Rock / CC0 benchmark")
    if rock_material is None:
        raise RuntimeError("Expected v0.3 rock material was not created")

    remove_object("Journey boulder field / benchmark")
    add_detailed_rock_field(rock_material, journey)
    configure_v04_scene()


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
