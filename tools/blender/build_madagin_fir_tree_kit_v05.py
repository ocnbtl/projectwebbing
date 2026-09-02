from __future__ import annotations

import hashlib
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[2]
SOURCE_BLEND = (
    ROOT
    / "output"
    / "vendor-cache"
    / "polyhaven"
    / "fir_tree_01"
    / "fir_tree_01_1k.blend"
)
SOURCE_MD5 = "a08031ea8ffb49711b294e1c8213a909"
SOURCE_OBJECTS = (
    "fir_tree_01_a_LOD2",
    "fir_tree_01_b_LOD2",
    "fir_tree_01_c_LOD2",
)
BLEND_PATH = ROOT / "world-source" / "madagin-fir-tree-kit-v0.5.blend"
GLB_PATH = ROOT / "public" / "world" / "v05" / "madagin-fir-tree-kit-v0.5.glb"


def file_md5(path: Path) -> str:
    digest = hashlib.md5(usedforsecurity=False)
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def validate_source() -> None:
    if not SOURCE_BLEND.exists():
        raise FileNotFoundError(
            "Missing the ignored Poly Haven source blend. See the Fir Tree 01 "
            "PROVENANCE.md for the exact CC0 source URL and expected MD5."
        )
    actual_md5 = file_md5(SOURCE_BLEND)
    if actual_md5 != SOURCE_MD5:
        raise RuntimeError(
            f"Poly Haven source hash mismatch: expected {SOURCE_MD5}, got {actual_md5}"
        )


def make_placeholder_material(name: str, color: tuple[float, float, float, float]):
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    if principled is not None:
        principled.inputs["Base Color"].default_value = color
        principled.inputs["Roughness"].default_value = 0.9
    return material


def append_lod_objects() -> list[bpy.types.Object]:
    with bpy.data.libraries.load(str(SOURCE_BLEND), link=False) as (data_from, data_to):
        missing = [name for name in SOURCE_OBJECTS if name not in data_from.objects]
        if missing:
            raise RuntimeError(f"Expected authored LOD objects are missing: {missing}")
        data_to.objects = list(SOURCE_OBJECTS)

    kit_collection = bpy.data.collections.new("MADAGIN_FIR_TREE_KIT_V05")
    bpy.context.scene.collection.children.link(kit_collection)

    objects: list[bpy.types.Object] = []
    for index, source_object in enumerate(data_to.objects):
        if source_object is None or source_object.type != "MESH":
            raise RuntimeError(f"Expected mesh object at source index {index}")
        kit_collection.objects.link(source_object)
        source_object.location = (0.0, 0.0, 0.0)
        source_object.rotation_euler = (0.0, 0.0, 0.0)
        source_object.scale = (1.0, 1.0, 1.0)
        source_object.name = f"Madagin_Fir_{chr(ord('A') + index)}_LOD2"
        source_object.data.name = f"Madagin_Fir_{chr(ord('A') + index)}_LOD2_Mesh"
        source_object["source_asset"] = "Poly Haven / fir_tree_01 / CC0"
        source_object["source_lod"] = "LOD2"
        source_object["runtime_role"] = "opening-ridge-authored-tree"
        objects.append(source_object)

    return objects


def remap_materials(objects: list[bpy.types.Object]) -> None:
    bark = make_placeholder_material("MADAGIN_FIR_BARK", (0.24, 0.17, 0.10, 1.0))
    trunk = make_placeholder_material("MADAGIN_FIR_TRUNK", (0.29, 0.20, 0.12, 1.0))
    twig = make_placeholder_material("MADAGIN_FIR_TWIG", (0.14, 0.27, 0.12, 1.0))
    deadwood = make_placeholder_material("MADAGIN_FIR_DEADWOOD", (0.18, 0.13, 0.08, 1.0))

    for tree in objects:
        for slot in tree.material_slots:
            original_name = slot.material.name.lower() if slot.material else ""
            if "twig" in original_name:
                slot.material = twig
            elif "dead" in original_name:
                slot.material = deadwood
            elif "trunk" in original_name:
                slot.material = trunk
            else:
                slot.material = bark

        for polygon in tree.data.polygons:
            polygon.use_smooth = True


def configure_scene(objects: list[bpy.types.Object]) -> None:
    scene = bpy.context.scene
    scene["madagin_asset_version"] = "0.5-opening-ridge-tree-kit"
    scene["public_release"] = False
    scene["source_asset"] = "Poly Haven / fir_tree_01 / CC0"
    scene["source_resolution"] = "authored LOD2 geometry"
    scene["source_md5"] = SOURCE_MD5
    scene["runtime_textures"] = "external verified 1K subset"
    scene.render.engine = "BLENDER_EEVEE"

    bpy.context.view_layer.objects.active = objects[0]
    for tree in objects:
        tree.select_set(True)


def save_and_export(objects: list[bpy.types.Object]) -> None:
    BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
    GLB_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH), check_existing=False)

    bpy.ops.object.select_all(action="DESELECT")
    for tree in objects:
        tree.hide_render = False
        tree.hide_set(False)
        tree.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]

    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        export_format="GLB",
        export_extras=True,
        export_cameras=False,
        export_lights=False,
        export_apply=True,
        export_yup=True,
        use_selection=True,
    )


def build() -> None:
    validate_source()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    trees = append_lod_objects()
    remap_materials(trees)
    configure_scene(trees)
    save_and_export(trees)

    polygon_count = sum(len(tree.data.polygons) for tree in trees)
    vertex_count = sum(len(tree.data.vertices) for tree in trees)
    print(f"SOURCE_MD5={SOURCE_MD5}")
    print(f"TREES={len(trees)}")
    print(f"VERTICES={vertex_count}")
    print(f"POLYGONS={polygon_count}")
    print(f"BLEND={BLEND_PATH}")
    print(f"GLB={GLB_PATH}")
    print(f"GLB_BYTES={GLB_PATH.stat().st_size}")
    print(f"GLB_MD5={file_md5(GLB_PATH)}")


if __name__ == "__main__":
    build()
