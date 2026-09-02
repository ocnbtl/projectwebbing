"""Extract five deduplicated hero-tree families for Ridge v1.13."""

from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[2]
SOURCE_BLEND = ROOT / "world-source" / "madagin-ridge-canopy-library-v1.12.blend"
OUTPUT = ROOT / "public" / "world" / "v113" / "madagin-ridge-hero-families-v1.13.glb"
REPORT = ROOT / "artifacts" / "ridge-v113" / "hero-source-build.txt"

FAMILIES = {
    "pachira": "canopy_pachira_broad_near",
    "island01": "canopy_island01_sheltered_near",
    "island02": "canopy_island02_multitrunk_near",
    "island03": "canopy_island03_crest_near",
    "small02": "canopy_small02_upright_near",
}


def main() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    with bpy.data.libraries.load(str(SOURCE_BLEND), link=False) as (available, selected):
        selected.objects = [source for source in FAMILIES.values() if source in available.objects]
    exported = []
    for family, source_name in FAMILIES.items():
        obj = next((candidate for candidate in selected.objects if candidate and candidate.name == source_name), None)
        if obj is None:
            raise RuntimeError(f"Missing source object: {source_name}")
        bpy.context.scene.collection.objects.link(obj)
        obj.name = f"hero_family_{family}"
        obj.hide_render = False
        obj.hide_set(False)
        obj.hide_viewport = False
        obj["madagin_family"] = family
        exported.append(obj)
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
        export_tangents=False,
        export_yup=True,
    )
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        "version=v1.13\n"
        f"source={SOURCE_BLEND.relative_to(ROOT)}\n"
        f"families={','.join(FAMILIES)}\n"
        f"bytes={OUTPUT.stat().st_size}\n"
        "strategy=one optimized representative mesh per source family; runtime nonuniform shaping\n",
        encoding="utf-8",
    )
    print(REPORT.read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
