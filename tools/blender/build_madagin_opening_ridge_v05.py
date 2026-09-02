from __future__ import annotations

import math
from pathlib import Path
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_madagin_forest_waterfall_benchmark_v04 as forest


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "world-source"
RUNTIME_DIR = ROOT / "public" / "world" / "v05"
BLEND_PATH = SOURCE_DIR / "madagin-opening-ridge-benchmark-v0.5.blend"
GLB_PATH = RUNTIME_DIR / "madagin-opening-ridge-benchmark-v0.5.glb"


def opening_ridge_lift(x: float, y: float) -> float:
    ridge_center_y = -12.0 + 1.35 * math.sin(x * 0.16 + 0.9) + 0.55 * math.sin(x * 0.43 - 0.6)
    along_path = math.exp(-((y - ridge_center_y) / 7.4) ** 2)
    central_saddle = -1.45 * math.exp(-((x + 1.2) / 5.3) ** 2)
    asymmetry = 0.72 * math.sin(x * 0.24 + 0.7) + 0.34 * math.sin(x * 0.61 - 1.2)
    broad_crown = 8.35 + central_saddle + asymmetry
    side_falloff = max(0.0, 1.0 - max(0.0, abs(x) - 17.0) / 5.0)
    return max(0.0, along_path * broad_crown * side_falloff)


def add_opening_ridge(material, target) -> None:
    columns = 89
    rows = 69
    vertices = []
    faces = []

    for row in range(rows):
        v = row / (rows - 1)
        y = -27.0 + v * 31.0
        for column in range(columns):
            u = column / (columns - 1)
            x = -22.0 + u * 44.0
            micro = (
                0.14 * math.sin(x * 1.19 + y * 0.41)
                + 0.08 * math.sin(x * 2.73 - y * 0.83)
                + 0.04 * math.sin((x - y) * 5.11)
            )
            lift = opening_ridge_lift(x, y)
            micro_weight = min(1.0, lift / 2.0)
            z = forest.valley.terrain_height(x, y) + lift + micro * micro_weight + 0.025
            vertices.append((x, y, z))

    for row in range(rows - 1):
        for column in range(columns - 1):
            a = row * columns + column
            b = a + 1
            c = a + columns + 1
            d = a + columns
            faces.append((a, b, c, d))

    mesh = bpy.data.meshes.new("Opening ridge / approval mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    ridge = bpy.data.objects.new("Opening ridge / approval slice", mesh)
    target.objects.link(ridge)
    ridge.data.materials.append(material)

    uv_layer = mesh.uv_layers.new(name="UVMap")
    for loop in mesh.loops:
        coordinate = mesh.vertices[loop.vertex_index].co
        uv_layer.data[loop.index].uv = ((coordinate.x + 22.0) / 10.5, (coordinate.y + 27.0) / 10.5)

    for polygon in mesh.polygons:
        polygon.use_smooth = True

    ridge["geography_role"] = "opening ridge occlusion and crest"
    ridge["performance_class"] = "approval-slice-medium"
    ridge["surface_source"] = "Poly Haven / aerial_grass_rock / CC0"


def configure_scene() -> None:
    scene = bpy.context.scene
    scene["madagin_world_version"] = "0.5-opening-ridge-approval-slice"
    scene["benchmark_scope"] = "opening ridge framing plus prior valley checkpoints"
    scene["public_release"] = False
    scene["tree_source"] = "Poly Haven / fir_tree_01 authored LOD2 / CC0"
    scene["terrain_source"] = "Poly Haven / aerial_grass_rock / CC0"


def build_benchmark() -> None:
    forest.build_benchmark()
    journey = bpy.data.collections.get("WORLD_MOUNTAIN_JOURNEY")
    if journey is None:
        raise RuntimeError("Expected journey collection was not created")
    terrain_material = bpy.data.materials.get("Terrain / CC0 benchmark")
    if terrain_material is None:
        raise RuntimeError("Expected CC0 terrain material was not created")

    forest.remove_object("Journey ridge mass 01")
    forest.remove_object("Journey ridge mass 02")
    add_opening_ridge(terrain_material, journey)
    configure_scene()


def save_and_export() -> None:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH), check_existing=False)

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


if __name__ == "__main__":
    build_benchmark()
    save_and_export()
    print(f"BLEND={BLEND_PATH}")
    print(f"GLB={GLB_PATH}")
    print(f"GLB_BYTES={GLB_PATH.stat().st_size}")
