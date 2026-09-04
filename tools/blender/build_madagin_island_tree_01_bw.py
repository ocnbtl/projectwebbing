"""Build the bounded Madagin Candidate BW Island Tree 01 runtime source.

The input is Poly Haven's unmodified 1K glTF package.  The output keeps the
three material authorities and the original transforms, but separates them by
material and applies role-specific planar-preserving decimation so the tree can
be instanced in the real-time public journey.

Usage:
  blender --background --python tools/blender/build_madagin_island_tree_01_bw.py -- INPUT_GLTF OUTPUT_GLB
"""

from __future__ import annotations

import json
from pathlib import Path
import sys

import bpy


def script_arguments() -> tuple[Path, Path]:
    if "--" not in sys.argv:
        raise SystemExit("Expected INPUT_GLTF and OUTPUT_GLB after --")
    arguments = sys.argv[sys.argv.index("--") + 1 :]
    if len(arguments) != 2:
        raise SystemExit("Expected exactly INPUT_GLTF and OUTPUT_GLB")
    return Path(arguments[0]).resolve(), Path(arguments[1]).resolve()


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def role_for_object(obj: bpy.types.Object) -> str:
    names = " ".join([obj.name, *(slot.material.name if slot.material else "" for slot in obj.material_slots)]).lower()
    if "leav" in names:
        return "leaves"
    if "branch" in names:
        return "branches"
    return "trunk"


def separate_material_parts(source: bpy.types.Object) -> list[bpy.types.Object]:
    bpy.ops.object.select_all(action="DESELECT")
    source.select_set(True)
    bpy.context.view_layer.objects.active = source
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="MATERIAL")
    bpy.ops.object.mode_set(mode="OBJECT")
    return [obj for obj in bpy.context.selected_objects if obj.type == "MESH"]


def decimate_part(obj: bpy.types.Object, target_triangles: int) -> dict[str, int | float | str]:
    source_triangles = len(obj.data.loop_triangles)
    ratio = min(1.0, target_triangles / max(1, source_triangles))
    if ratio < 0.999:
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        modifier = obj.modifiers.new(name="Madagin BW bounded source decimation", type="DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = ratio
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    obj.data.update()
    role = role_for_object(obj)
    obj.name = f"island_tree_01_bw_{role}"
    return {
        "role": role,
        "sourceTriangles": source_triangles,
        "runtimeTriangles": len(obj.data.loop_triangles),
        "ratio": ratio,
    }


def main() -> None:
    input_path, output_path = script_arguments()
    if not input_path.is_file():
        raise SystemExit(f"Input glTF does not exist: {input_path}")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(input_path))
    imported = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(imported) != 1:
        raise SystemExit(f"Expected one imported source mesh, found {len(imported)}")
    parts = separate_material_parts(imported[0])
    targets = {"trunk": 30_000, "branches": 32_000, "leaves": 48_000}
    report = [decimate_part(part, targets[role_for_object(part)]) for part in parts]
    bpy.ops.object.select_all(action="DESELECT")
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_cameras=False,
        export_lights=False,
    )
    print(json.dumps({
        "input": str(input_path),
        "output": str(output_path),
        "outputBytes": output_path.stat().st_size,
        "parts": report,
        "runtimeTriangles": sum(int(item["runtimeTriangles"]) for item in report),
    }, indent=2))


if __name__ == "__main__":
    main()
