"""Build close-review v1.14 hero trees from native textured Pachira variants.

The prior v1.13 hero library remapped every scanned tree onto one shared leaf
material and decimated leaf cards. That is acceptable at aerial distance but
exposes opaque triangular foliage close to the opening camera. This pass keeps
the source glTF materials and UVs intact, recenters roots, and exports the four
native Pachira architectures as reusable Meshopt-compressed hero families.
"""

from __future__ import annotations

import json
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "public" / "world" / "assets" / "polyhaven" / "pachira_aquatica_01" / "pachira_aquatica_01_1k.gltf"
OUTPUT = ROOT / "public" / "world" / "v114" / "madagin-ridge-hero-families-v1.14.glb"
BLEND = ROOT / "world-source" / "madagin-ridge-hero-families-v1.14.blend"
REPORT = ROOT / "artifacts" / "ridge-v114" / "hero-source-build.json"
TARGET_HEIGHTS = {"a": 12.5, "b": 9.4, "c": 14.2, "d": 17.8}


def triangle_count(obj: bpy.types.Object) -> int:
    return sum(max(0, len(polygon.vertices) - 2) for polygon in obj.data.polygons)


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def join_meshes(objects: list[bpy.types.Object], name: str) -> bpy.types.Object:
    if not objects:
        raise RuntimeError(f"No native Pachira meshes found for {name}")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_render = False
        obj.hide_viewport = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    result = bpy.context.object
    result.name = name
    return result


def normalize_tree(obj: bpy.types.Object, target_height: float) -> None:
    factor = target_height / max(0.001, float(obj.dimensions.z))
    obj.scale = (factor, factor, factor)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.select_set(False)
    xs = [vertex.co.x for vertex in obj.data.vertices]
    ys = [vertex.co.y for vertex in obj.data.vertices]
    zs = [vertex.co.z for vertex in obj.data.vertices]
    center_x = (min(xs) + max(xs)) * 0.5
    center_y = (min(ys) + max(ys)) * 0.5
    root_z = min(zs)
    for vertex in obj.data.vertices:
        vertex.co.x -= center_x
        vertex.co.y -= center_y
        vertex.co.z -= root_z
    obj.data.update()


def prepare_materials(obj: bpy.types.Object) -> None:
    for material in obj.data.materials:
        if material is None:
            continue
        name = material.name.lower()
        leaf = "lea" in name or "twig" in name
        if hasattr(material, "surface_render_method"):
            material.surface_render_method = "DITHERED" if leaf else "DITHERED"
        material.use_transparency_overlap = False
        material.diffuse_color = (0.42, 0.58, 0.34, 1.0) if leaf else (0.22, 0.14, 0.075, 1.0)
        if not material.use_nodes or material.node_tree is None:
            continue
        shader = material.node_tree.nodes.get("Principled BSDF")
        if shader:
            shader.inputs["Roughness"].default_value = 0.82 if leaf else 0.92
            shader.inputs["Metallic"].default_value = 0.0
        for node in material.node_tree.nodes:
            if node.type != "TEX_IMAGE" or node.image is None:
                continue
            node.image.pack()


def main() -> None:
    reset_scene()
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    source_meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    source_groups = {
        letter: [obj for obj in source_meshes if obj.name.lower().endswith(f"_{letter}")]
        for letter in TARGET_HEIGHTS
    }
    exported: list[bpy.types.Object] = []
    report_families = []
    for letter, target_height in TARGET_HEIGHTS.items():
        matching = source_groups[letter]
        tree = join_meshes(matching, f"hero_family_pachira_{letter}")
        normalize_tree(tree, target_height)
        prepare_materials(tree)
        tree["madagin_family"] = f"pachira_{letter}"
        tree["source_provenance"] = "Poly Haven CC0 pachira_aquatica_01 1k glTF"
        exported.append(tree)
        report_families.append({"family": letter, "height": target_height, "triangles": triangle_count(tree), "materials": len(tree.data.materials)})
    bpy.ops.object.select_all(action="DESELECT")
    for obj in exported:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = exported[0]
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT),
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
        export_tangents=True,
        export_yup=True,
    )
    bpy.context.scene["madagin_version"] = "v1.14-native-textured-hero-families"
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    report = {
        "version": "v1.14",
        "source": str(SOURCE.relative_to(ROOT)),
        "strategy": "native source materials and UVs preserved; no leaf-card decimation or cross-species remap",
        "families": report_families,
        "bytes": OUTPUT.stat().st_size,
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    print(f"GLB={OUTPUT}")


if __name__ == "__main__":
    main()
