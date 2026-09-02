"""Build real-mesh vegetation LODs for the Madagin Ridge v1.11 benchmark.

Unlike the v1.10 crossed-card forest, these LODs preserve the scanned or
authored branch/leaf geometry of three independently sourced CC0 tree families.
The script creates a descending decimation chain, keeps material identity and
UVs, and exports tier-bounded GLBs consumed through spatially culled instances.
"""

from __future__ import annotations

import math
from pathlib import Path

import bmesh
import bpy


ROOT = Path(__file__).resolve().parents[2]
PUBLIC_ROOT = ROOT / "public" / "world" / "v111"
SOURCE_ROOT = ROOT / "world-source"
BLEND_PATH = SOURCE_ROOT / "madagin-ridge-forest-kit-v1.11.blend"

PACHIRA = ROOT / "public" / "world" / "assets" / "polyhaven" / "pachira_aquatica_01" / "pachira_aquatica_01_1k.gltf"
ISLAND = SOURCE_ROOT / "assets" / "polyhaven" / "island_tree_03" / "island_tree_03_1k.gltf"
SMALL = SOURCE_ROOT / "assets" / "polyhaven" / "tree_small_02" / "tree_small_02_1k.gltf"

PACHIRA_TARGET_HEIGHTS = {
    "a": 10.8,
    "b": 7.4,
    "c": 10.2,
    "d": 12.4,
}


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in tuple(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)


def imported_meshes(path: Path) -> list[bpy.types.Object]:
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    result = [obj for obj in bpy.context.scene.objects if obj not in before and obj.type == "MESH"]
    for obj in result:
        obj.hide_render = False
        obj.hide_viewport = False
        obj.select_set(False)
    return result


def join_meshes(objects: list[bpy.types.Object], name: str) -> bpy.types.Object:
    if not objects:
        raise RuntimeError(f"No source meshes for {name}")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    result = bpy.context.object
    result.name = name
    return result


def normalize_height(obj: bpy.types.Object, target_height: float) -> None:
    """Normalize mixed-source scans to plausible mature tropical-tree scale."""
    current_height = max(0.001, float(obj.dimensions.z))
    factor = target_height / current_height
    obj.scale = tuple(value * factor for value in obj.scale)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.select_set(False)
    obj["normalized_height_metres"] = target_height


def remove_low_scan_slab(obj: bpy.types.Object, threshold: float) -> None:
    """Remove only the near-horizontal capture base below the root mass."""
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    slab_faces = [
        face for face in bm.faces
        if face.calc_center_median().z < threshold and abs(face.normal.z) > 0.72
    ]
    if not slab_faces:
        bm.free()
        return
    bmesh.ops.delete(bm, geom=slab_faces, context="FACES")
    loose_vertices = [vertex for vertex in bm.verts if not vertex.link_faces]
    if loose_vertices:
        bmesh.ops.delete(bm, geom=loose_vertices, context="VERTS")
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    obj["capture_slab_faces_removed"] = len(slab_faces)


def triangle_count(obj: bpy.types.Object) -> int:
    return sum(max(0, len(poly.vertices) - 2) for poly in obj.data.polygons)


def apply_decimate(obj: bpy.types.Object, target_ratio: float) -> None:
    if target_ratio >= 0.999:
        return
    modifier = obj.modifiers.new(name="Web branch-preserving collapse", type="DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = max(0.0001, target_ratio)
    modifier.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def duplicate_lod(source: bpy.types.Object, name: str, ratio: float) -> bpy.types.Object:
    result = source.copy()
    result.data = source.data.copy()
    bpy.context.scene.collection.objects.link(result)
    result.name = name
    apply_decimate(result, ratio)
    result["madagin_lod"] = name.rsplit("_", 1)[-1]
    result["source_family"] = name.split("_", 1)[0]
    result["triangles"] = triangle_count(result)
    return result


def build_chain(source: bpy.types.Object, family: str, near_ratio: float, mid_from_near: float, far_from_mid: float) -> list[bpy.types.Object]:
    near = duplicate_lod(source, f"{family}_near", near_ratio)
    mid = duplicate_lod(near, f"{family}_mid", mid_from_near)
    far = duplicate_lod(mid, f"{family}_far", far_from_mid)
    return [near, mid, far]


def build_pachira() -> list[bpy.types.Object]:
    imported_meshes(PACHIRA)
    result: list[bpy.types.Object] = []
    for letter in "abcd":
        matching = [
            obj for obj in bpy.context.scene.objects
            if obj.type == "MESH" and obj.name.lower().endswith(f"_{letter}")
        ]
        source = join_meshes(matching, f"pachira_{letter}_source")
        normalize_height(source, PACHIRA_TARGET_HEIGHTS[letter])
        result.extend(build_chain(source, f"pachira_{letter}", 1.0, 0.38, 0.22))
        bpy.data.objects.remove(source, do_unlink=True)
    return result


def build_single_family(
    path: Path,
    family: str,
    near_ratio: float,
    target_height: float,
    slab_threshold: float,
) -> list[bpy.types.Object]:
    source = join_meshes(imported_meshes(path), f"{family}_source")
    remove_low_scan_slab(source, slab_threshold)
    normalize_height(source, target_height)
    result = build_chain(source, family, near_ratio, 0.28, 0.24)
    bpy.data.objects.remove(source, do_unlink=True)
    return result


def set_export_visibility(
    objects: list[bpy.types.Object],
    allowed_suffixes: tuple[str, ...],
    excluded_names: frozenset[str],
) -> list[bpy.types.Object]:
    selected = [
        obj for obj in objects
        if obj.name.endswith(allowed_suffixes) and obj.name not in excluded_names
    ]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in selected:
        obj.hide_viewport = False
        obj.hide_render = False
        obj.select_set(True)
    if selected:
        bpy.context.view_layer.objects.active = selected[0]
    return selected


def export_kit(
    objects: list[bpy.types.Object],
    filename: str,
    suffixes: tuple[str, ...],
    excluded_names: frozenset[str] = frozenset(),
) -> None:
    selected = set_export_visibility(objects, suffixes, excluded_names)
    bpy.ops.export_scene.gltf(
        filepath=str(PUBLIC_ROOT / filename),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_materials="EXPORT",
        export_texcoords=True,
        export_normals=True,
        export_yup=True,
    )
    print(f"EXPORTED={filename} OBJECTS={len(selected)} BYTES={(PUBLIC_ROOT / filename).stat().st_size}")


def configure_preview(objects: list[bpy.types.Object]) -> None:
    for index, obj in enumerate(objects):
        family_index = 0 if obj.name.startswith("pachira") else 1 if obj.name.startswith("island") else 2
        lod_index = 0 if obj.name.endswith("near") else 1 if obj.name.endswith("mid") else 2
        variant = index % 4 if obj.name.startswith("pachira") else 0
        obj.location = ((family_index - 1) * 15.0 + variant * 3.0, (lod_index - 1) * 18.0, 0.0)
        obj.rotation_euler[2] = (variant * 0.47 + lod_index * 0.21) % (math.pi * 2.0)
        obj.hide_render = False
        obj.hide_viewport = False


def main() -> None:
    PUBLIC_ROOT.mkdir(parents=True, exist_ok=True)
    reset_scene()
    pachira = build_pachira()
    island = build_single_family(ISLAND, "island", 0.015, 10.5, 0.18)
    small = build_single_family(SMALL, "small", 0.014, 7.6, 0.16)
    objects = pachira + island + small

    for obj in objects:
        print(f"LOD={obj.name} TRIS={triangle_count(obj)} MATERIALS={len(obj.data.materials)}")

    export_kit(objects, "madagin-ridge-forest-high-v1.11.glb", ("near", "mid", "far"))
    export_kit(objects, "madagin-ridge-forest-balanced-v1.11.glb", ("mid", "far"))
    # Tree Small 02 resists meaningful collapse at this source topology. Keep it
    # as sparse high/balanced structure and omit it from the mobile kit.
    export_kit(
        objects,
        "madagin-ridge-forest-mobile-v1.11.glb",
        ("far",),
        frozenset({"small_far"}),
    )

    configure_preview(objects)
    bpy.context.scene["madagin_version"] = "v1.11-ridge-r-and-d-benchmark"
    bpy.context.scene["source_families"] = "Poly Haven Pachira Aquatica 01, Island Tree 03, Tree Small 02; all CC0"
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    print(f"BLEND={BLEND_PATH}")


if __name__ == "__main__":
    main()
