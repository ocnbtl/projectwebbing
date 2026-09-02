"""Build the multi-source Madagin vegetation library for World Lab v1.15.

The v1.14 near library contained four Pachira forms from one source package.
This deterministic rebuild keeps those four native architectures and adds four
independent scanned-tree forms. It exports bounded hero geometry, eighteen
deformed middle-distance variants, matched far LODs, and geometry-derived root
profiles used by the terrain placement generator.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path

import bpy
import bmesh


ROOT = Path(__file__).resolve().parents[2]
ASSET_ROOT = ROOT / "public" / "world" / "assets" / "polyhaven"
OUTPUT_ROOT = ROOT / "public" / "world" / "v115"
SOURCE_ROOT = ROOT / "world-source"
ARTIFACT_ROOT = ROOT / "artifacts" / "ridge-v115"
HERO_OUTPUT = OUTPUT_ROOT / "madagin-ridge-vegetation-hero-v1.15.glb"
MID_OUTPUT = OUTPUT_ROOT / "madagin-ridge-vegetation-mid-v1.15.glb"
FAR_OUTPUT = OUTPUT_ROOT / "madagin-ridge-vegetation-far-v1.15.glb"
BLEND_OUTPUT = SOURCE_ROOT / "madagin-ridge-vegetation-library-v1.15.blend"
PROFILE_OUTPUT = OUTPUT_ROOT / "madagin-ridge-vegetation-profiles-v1.15.json"
REPORT_OUTPUT = ARTIFACT_ROOT / "vegetation-build-report.json"


@dataclass(frozen=True)
class FamilySpec:
    key: str
    asset: str
    source_file: str
    target_height: float
    source_suffix: str | None = None
    hero_triangles: int = 18_000


FAMILIES = (
    FamilySpec("pachira_a", "pachira_aquatica_01", "pachira_aquatica_01_1k.gltf", 12.5, "_a", 23_500),
    FamilySpec("pachira_b", "pachira_aquatica_01", "pachira_aquatica_01_1k.gltf", 9.4, "_b", 5_200),
    FamilySpec("pachira_c", "pachira_aquatica_01", "pachira_aquatica_01_1k.gltf", 14.2, "_c", 20_800),
    FamilySpec("pachira_d", "pachira_aquatica_01", "pachira_aquatica_01_1k.gltf", 17.8, "_d", 28_400),
    FamilySpec("island_01", "island_tree_01", "island_tree_01_1k.gltf", 18.6, hero_triangles=18_000),
    FamilySpec("island_02", "island_tree_02", "island_tree_02_1k.gltf", 15.8, hero_triangles=18_000),
    FamilySpec("island_03", "island_tree_03", "island_tree_03_1k.gltf", 13.2, hero_triangles=17_000),
    FamilySpec("small_02", "tree_small_02", "tree_small_02_1k.gltf", 10.8, hero_triangles=15_000),
)

# Eighteen independently deformed runtime silhouettes across five source
# packages. The deformation is baked before LOD generation, so it changes the
# geometry rather than merely renaming or scaling one repeated mesh.
MID_VARIANTS = (
    ("pachira_a", -0.12, 0.05, 1.13, 0.92),
    ("pachira_a", 0.15, -0.04, 0.91, 1.08),
    ("pachira_b", -0.18, -0.07, 1.16, 0.86),
    ("pachira_b", 0.09, 0.06, 0.88, 1.14),
    ("pachira_c", -0.08, 0.03, 1.06, 0.96),
    ("pachira_c", 0.17, -0.06, 0.9, 1.12),
    ("pachira_d", -0.14, 0.07, 1.12, 0.91),
    ("pachira_d", 0.11, -0.04, 0.94, 1.07),
    ("island_01", -0.1, 0.04, 1.12, 0.94),
    ("island_01", 0.16, -0.08, 0.9, 1.13),
    ("island_02", -0.16, 0.06, 1.14, 0.9),
    ("island_02", 0.08, -0.05, 0.93, 1.09),
    ("island_03", -0.19, -0.07, 1.16, 0.87),
    ("island_03", 0.13, 0.05, 0.9, 1.12),
    ("small_02", -0.2, 0.08, 1.11, 0.89),
    ("small_02", 0.18, -0.06, 0.88, 1.15),
    ("island_01", 0.05, 0.1, 1.2, 0.84),
    ("island_02", -0.06, -0.09, 0.86, 1.18),
)


def triangle_count(obj: bpy.types.Object) -> int:
    return sum(max(0, len(polygon.vertices) - 2) for polygon in obj.data.polygons)


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.users == 0:
            bpy.data.collections.remove(collection)


def selected_only(objects: list[bpy.types.Object]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_render = False
        obj.hide_viewport = False
        obj.select_set(True)
    if objects:
        bpy.context.view_layer.objects.active = objects[0]


def join_meshes(objects: list[bpy.types.Object], name: str) -> bpy.types.Object:
    if not objects:
        raise RuntimeError(f"No source meshes found for {name}")
    selected_only(objects)
    bpy.ops.object.join()
    result = bpy.context.object
    result.name = name
    return result


def import_family(spec: FamilySpec) -> bpy.types.Object:
    source = ASSET_ROOT / spec.asset / spec.source_file
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(source))
    imported = [obj for obj in bpy.context.scene.objects if obj not in before and obj.type == "MESH"]
    if spec.source_suffix:
        matching = [obj for obj in imported if obj.name.lower().split(".", 1)[0].endswith(spec.source_suffix)]
        for obj in imported:
            if obj not in matching:
                bpy.data.objects.remove(obj, do_unlink=True)
        imported = matching
    result = join_meshes(imported, f"hero_{spec.key}")
    result["madagin_family"] = spec.key
    result["source_asset"] = spec.asset
    result["source_provenance"] = f"Poly Haven CC0 {spec.asset} 1k glTF"
    return result


def normalize_tree(obj: bpy.types.Object, target_height: float) -> None:
    factor = target_height / max(0.001, float(obj.dimensions.z))
    obj.scale = (factor, factor, factor)
    selected_only([obj])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
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


def decimate_to(obj: bpy.types.Object, target_triangles: int) -> None:
    current = triangle_count(obj)
    if current <= target_triangles:
        return
    modifier = obj.modifiers.new(name="Madagin bounded LOD", type="DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = max(0.002, target_triangles / current)
    modifier.use_collapse_triangulate = True
    selected_only([obj])
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def thin_disconnected_foliage(obj: bpy.types.Object, target_triangles: int) -> None:
    """Thin disconnected scan cards spatially when collapse decimation stalls.

    Scanned vegetation often contains one quad per leaf. A collapse modifier
    cannot cross those disconnected islands, so a nominal far LOD can retain
    thousands of cards. Keep the trunk and a deterministic spatial sample of
    leaf/branch faces while preserving the surviving UV and material layers.
    """
    if triangle_count(obj) <= target_triangles:
        return
    mesh = obj.data
    detail_materials = {
        index for index, material in enumerate(mesh.materials)
        if material is not None and any(token in material.name.lower() for token in ("lea", "branch", "twig"))
    }
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.faces.ensure_lookup_table()
    fixed = [face for face in bm.faces if face.material_index not in detail_materials]
    detail = [face for face in bm.faces if face.material_index in detail_materials]
    fixed_triangles = sum(max(1, len(face.verts) - 2) for face in fixed)
    budget = max(24, target_triangles - fixed_triangles)
    ranked = sorted(
        detail,
        key=lambda face: math.sin(face.calc_center_median().x * 12.9898 + face.calc_center_median().y * 78.233 + face.calc_center_median().z * 37.719) * 43758.5453 % 1.0,
    )
    keep = set()
    used = 0
    for face in ranked:
        triangles = max(1, len(face.verts) - 2)
        if used + triangles > budget:
            continue
        keep.add(face)
        used += triangles
    remove = [face for face in detail if face not in keep]
    bmesh.ops.delete(bm, geom=remove, context="FACES")
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()


def prepare_materials(obj: bpy.types.Object) -> None:
    for material in obj.data.materials:
        if material is None:
            continue
        leaf = any(token in material.name.lower() for token in ("lea", "twig", "branch", "plant"))
        if hasattr(material, "surface_render_method"):
            material.surface_render_method = "DITHERED"
        material.use_transparency_overlap = False
        if material.use_nodes and material.node_tree is not None:
            shader = material.node_tree.nodes.get("Principled BSDF")
            if shader:
                shader.inputs["Roughness"].default_value = 0.76 if leaf else 0.92
                shader.inputs["Metallic"].default_value = 0.0
            for node in material.node_tree.nodes:
                if node.type == "TEX_IMAGE" and node.image is not None:
                    node.image.pack()


def root_profile(obj: bpy.types.Object) -> dict:
    vertices = list(obj.data.vertices)
    min_z = min(vertex.co.z for vertex in vertices)
    band = max(0.035, float(obj.dimensions.z) * 0.008)
    roots = [vertex.co for vertex in vertices if vertex.co.z <= min_z + band]
    root_x = sum(point.x for point in roots) / max(1, len(roots))
    root_y = sum(point.y for point in roots) / max(1, len(roots))
    radius = max(math.hypot(point.x - root_x, point.y - root_y) for point in roots)
    angular_samples: list = []
    for bucket in range(16):
        low = -math.pi + bucket * math.tau / 16
        high = low + math.tau / 16
        candidates = [
            point for point in roots
            if low <= math.atan2(point.y - root_y, point.x - root_x) < high
        ]
        if candidates:
            angular_samples.append(max(candidates, key=lambda point: math.hypot(point.x - root_x, point.y - root_y)))
    if roots:
        angular_samples.append(min(roots, key=lambda point: math.hypot(point.x - root_x, point.y - root_y)))
    return {
        "localPoint": [round(root_x, 5), round(min_z, 5), round(-root_y, 5)],
        "footprintRadius": round(max(0.22, min(radius, float(obj.dimensions.x) * 0.28)), 5),
        "sampleVertices": len(roots),
        "contactPoints": [
            [round(point.x, 5), round(point.z, 5), round(-point.y, 5)]
            for point in angular_samples
        ],
    }


def rebase_tree_to_root(obj: bpy.types.Object) -> None:
    """Move the baked mesh origin to the measured low-vertex root centroid."""
    profile = root_profile(obj)
    root_x, root_z, neg_root_y = profile["localPoint"]
    root_y = -neg_root_y
    for vertex in obj.data.vertices:
        vertex.co.x -= root_x
        vertex.co.y -= root_y
        vertex.co.z -= root_z
    obj.data.update()


def deform_variant(obj: bpy.types.Object, twist: float, lean: float, spread_x: float, spread_y: float) -> None:
    height = max(0.001, float(obj.dimensions.z))
    for vertex in obj.data.vertices:
        amount = max(0.0, min(1.0, vertex.co.z / height))
        crown = amount * amount * (3.0 - 2.0 * amount)
        angle = twist * crown
        x = vertex.co.x * (1.0 + (spread_x - 1.0) * crown)
        y = vertex.co.y * (1.0 + (spread_y - 1.0) * crown)
        vertex.co.x = x * math.cos(angle) - y * math.sin(angle) + lean * height * crown * crown
        vertex.co.y = x * math.sin(angle) + y * math.cos(angle)
    obj.data.update()


def copy_variant(source: bpy.types.Object, name: str, deformation: tuple[float, float, float, float], target_triangles: int) -> bpy.types.Object:
    result = source.copy()
    result.data = source.data.copy()
    bpy.context.scene.collection.objects.link(result)
    result.name = name
    deform_variant(result, *deformation)
    decimate_to(result, target_triangles)
    thin_disconnected_foliage(result, target_triangles)
    decimate_to(result, target_triangles)
    result["madagin_variant"] = name
    result["base_family"] = source["madagin_family"]
    return result


def export_glb(path: Path, objects: list[bpy.types.Object]) -> None:
    selected_only(objects)
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
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


def main() -> None:
    reset_scene()
    hero: dict[str, bpy.types.Object] = {}
    profiles = {}
    source_assets = []
    for spec in FAMILIES:
        tree = import_family(spec)
        normalize_tree(tree, spec.target_height)
        decimate_to(tree, spec.hero_triangles)
        rebase_tree_to_root(tree)
        prepare_materials(tree)
        hero[spec.key] = tree
        profiles[spec.key] = root_profile(tree)
        source_assets.append({
            "family": spec.key,
            "asset": spec.asset,
            "source": str((ASSET_ROOT / spec.asset / spec.source_file).relative_to(ROOT)),
            "provider": "Poly Haven",
            "license": "CC0 1.0",
            "provenance": f"Poly Haven CC0 {spec.asset} 1k glTF",
            "height": spec.target_height,
            "triangles": triangle_count(tree),
            "root": profiles[spec.key],
        })

    mid = []
    far = []
    variants = []
    for index, (family, twist, lean, spread_x, spread_y) in enumerate(MID_VARIANTS):
        deformation = (twist, lean, spread_x, spread_y)
        mid_tree = copy_variant(hero[family], f"mid_variant_{index:02d}", deformation, 1800)
        far_tree = copy_variant(hero[family], f"far_variant_{index:02d}", deformation, 180) if family.startswith("pachira_") else None
        mid.append(mid_tree)
        if far_tree is not None:
            far.append(far_tree)
        variants.append({
            "id": f"variant_{index:02d}",
            "family": family,
            "deformation": {"twist": twist, "lean": lean, "spread": [spread_x, spread_y]},
            "midTriangles": triangle_count(mid_tree),
            "farTriangles": triangle_count(far_tree) if far_tree is not None else None,
        })

    export_glb(HERO_OUTPUT, list(hero.values()))
    export_glb(MID_OUTPUT, mid)
    export_glb(FAR_OUTPUT, far)
    PROFILE_OUTPUT.write_text(json.dumps({
        "version": "v1.15",
        "sourcePackages": sorted({spec.asset for spec in FAMILIES}),
        "heroFamilies": list(hero),
        "rootProfiles": profiles,
        "variants": variants,
    }, indent=2) + "\n", encoding="utf-8")
    bpy.context.scene["madagin_version"] = "v1.15-multi-source-grounded-vegetation"
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_OUTPUT))
    report = {
        "version": "v1.15",
        "strategy": "five independent CC0 tree packages, eight hero architectures, eighteen baked silhouette variants, geometry-derived roots",
        "license": "CC0 1.0",
        "provider": "Poly Haven",
        "sourcePackageCount": len({spec.asset for spec in FAMILIES}),
        "heroFamilyCount": len(hero),
        "midVariantCount": len(mid),
        "farVariantCount": len(far),
        "sources": source_assets,
        "variants": variants,
        "outputs": {path.name: path.stat().st_size for path in (HERO_OUTPUT, MID_OUTPUT, FAR_OUTPUT, PROFILE_OUTPUT)},
    }
    ARTIFACT_ROOT.mkdir(parents=True, exist_ok=True)
    REPORT_OUTPUT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
