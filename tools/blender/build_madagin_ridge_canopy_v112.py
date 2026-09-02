"""Build the reusable Madagin Ridge v1.12 tropical-canopy source library.

The v1.11 forest packed every LOD and its textures into tier-specific GLBs.
This pass stores sparse near trees and eight actual-tree canopy LODs
independently. Runtime placement stays in JSON and reuses these source
buffers through InstancedMesh batches.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
PUBLIC_ROOT = ROOT / "public" / "world" / "v112"
SOURCE_ROOT = ROOT / "world-source"
ARTIFACT_ROOT = ROOT / "artifacts" / "ridge-v112"
BLEND_PATH = SOURCE_ROOT / "madagin-ridge-canopy-library-v1.12.blend"
REPORT_PATH = ARTIFACT_ROOT / "canopy-build-report.json"

SOURCES = {
    "pachira": ROOT / "public" / "world" / "assets" / "polyhaven" / "pachira_aquatica_01" / "pachira_aquatica_01_1k.gltf",
    "island01": SOURCE_ROOT / "assets" / "polyhaven" / "island_tree_01" / "island_tree_01_1k.gltf",
    "island02": SOURCE_ROOT / "assets" / "polyhaven" / "island_tree_02" / "island_tree_02_1k.gltf",
    "island03": SOURCE_ROOT / "assets" / "polyhaven" / "island_tree_03" / "island_tree_03_1k.gltf",
    "small02": SOURCE_ROOT / "assets" / "polyhaven" / "tree_small_02" / "tree_small_02_1k.gltf",
}

VARIANTS = (
    {"key": "pachira_broad", "source": "pachira_a", "height": 10.8, "triangles": 22000, "spread": 1.32, "crown_height": 0.94, "bend": -0.4, "role": "broad spreading canopy"},
    {"key": "pachira_emergent", "source": "pachira_d", "height": 17.5, "triangles": 24000, "spread": 0.72, "crown_height": 1.18, "bend": 0.7, "role": "tall emergent"},
    {"key": "pachira_secondary", "source": "pachira_b", "height": 8.2, "triangles": 16000, "spread": 1.08, "crown_height": 0.82, "bend": 0.25, "role": "younger secondary growth"},
    {"key": "island01_spreader", "source": "island01", "height": 12.6, "triangles": 26000, "spread": 1.38, "crown_height": 0.9, "bend": -1.6, "role": "rooted spreading canopy"},
    {"key": "island01_sheltered", "source": "island01", "height": 15.2, "triangles": 24000, "spread": 1.02, "crown_height": 1.08, "bend": 0.3, "role": "sheltered valley tree"},
    {"key": "island02_multitrunk", "source": "island02", "height": 10.4, "triangles": 22000, "spread": 1.22, "crown_height": 0.92, "bend": 0.85, "role": "irregular multi-trunk form"},
    {"key": "island02_wind", "source": "island02", "height": 8.8, "triangles": 18000, "spread": 1.48, "crown_height": 0.72, "bend": -2.5, "role": "wind-shaped crest tree"},
    {"key": "island03_crest", "source": "island03", "height": 11.4, "triangles": 22000, "spread": 1.44, "crown_height": 0.78, "bend": 2.2, "role": "exposed crest canopy"},
    {"key": "island03_low", "source": "island03", "height": 7.6, "triangles": 15000, "spread": 1.56, "crown_height": 0.64, "bend": -0.9, "role": "dense low crown"},
    {"key": "small02_upright", "source": "small02", "height": 10.2, "triangles": 18000, "spread": 0.76, "crown_height": 1.22, "bend": 0.45, "role": "narrow upright mid-canopy"},
)


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in tuple(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)


def new_collection(name: str) -> bpy.types.Collection:
    result = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(result)
    return result


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
        raise RuntimeError(f"No source meshes found for {name}")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_viewport = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    result = bpy.context.object
    result.name = name
    return result


def triangle_count(obj: bpy.types.Object) -> int:
    return sum(max(0, len(poly.vertices) - 2) for poly in obj.data.polygons)


def normalize_height(obj: bpy.types.Object, target_height: float) -> None:
    factor = target_height / max(0.001, float(obj.dimensions.z))
    obj.scale = tuple(value * factor for value in obj.scale)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.select_set(False)


def remove_scan_slab(obj: bpy.types.Object) -> None:
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    minimum = min(vertex.co.z for vertex in bm.verts)
    threshold = minimum + max(0.08, obj.dimensions.z * 0.018)
    slab_faces = [
        face for face in bm.faces
        if face.calc_center_median().z < threshold and abs(face.normal.z) > 0.76
    ]
    if slab_faces:
        bmesh.ops.delete(bm, geom=slab_faces, context="FACES")
        loose = [vertex for vertex in bm.verts if not vertex.link_faces]
        if loose:
            bmesh.ops.delete(bm, geom=loose, context="VERTS")
        bm.to_mesh(mesh)
        mesh.update()
    bm.free()
    obj["capture_slab_faces_removed"] = len(slab_faces)


def decimate_to(obj: bpy.types.Object, target: int) -> None:
    current = triangle_count(obj)
    if current <= target:
        return
    modifier = obj.modifiers.new(name="v112 branch-preserving web collapse", type="DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = max(0.00008, target / current)
    modifier.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)


def configure_image(image: bpy.types.Image, color: bool) -> bpy.types.Image:
    image.colorspace_settings.name = "sRGB" if color else "Non-Color"
    if max(image.size) > 512:
        aspect = image.size[0] / max(1, image.size[1])
        width = 512 if aspect >= 1 else max(64, round(512 * aspect))
        height = 512 if aspect <= 1 else max(64, round(512 / aspect))
        image.scale(width, height)
    image.pack()
    return image


def shared_material(name: str, diffuse: Path, normal: Path, arm: Path, leaf: bool) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.surface_render_method = "DITHERED" if leaf else "DITHERED"
    material.use_transparency_overlap = False
    material.diffuse_color = (0.34, 0.55, 0.29, 1.0) if leaf else (0.19, 0.13, 0.075, 1.0)
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.inputs["Roughness"].default_value = 0.74 if leaf else 0.9
    shader.inputs["Metallic"].default_value = 0.0
    color_tex = nodes.new("ShaderNodeTexImage")
    color_tex.image = configure_image(bpy.data.images.load(str(diffuse), check_existing=True), True)
    normal_tex = nodes.new("ShaderNodeTexImage")
    normal_tex.image = configure_image(bpy.data.images.load(str(normal), check_existing=True), False)
    normal_node = nodes.new("ShaderNodeNormalMap")
    normal_node.inputs["Strength"].default_value = 0.42 if leaf else 0.68
    arm_tex = nodes.new("ShaderNodeTexImage")
    arm_tex.image = configure_image(bpy.data.images.load(str(arm), check_existing=True), False)
    separate = nodes.new("ShaderNodeSeparateColor")
    grade = nodes.new("ShaderNodeHueSaturation")
    grade.inputs["Saturation"].default_value = 0.88 if leaf else 0.82
    grade.inputs["Value"].default_value = 1.42 if leaf else 1.16
    links.new(color_tex.outputs["Color"], grade.inputs["Color"])
    links.new(grade.outputs["Color"], shader.inputs["Base Color"])
    links.new(normal_tex.outputs["Color"], normal_node.inputs["Color"])
    links.new(normal_node.outputs["Normal"], shader.inputs["Normal"])
    links.new(arm_tex.outputs["Color"], separate.inputs["Color"])
    links.new(separate.outputs["Green"], shader.inputs["Roughness"])
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return material


def solid_material(name: str, color: tuple[float, float, float, float], roughness: float) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    if shader:
        shader.inputs["Base Color"].default_value = color
        shader.inputs["Roughness"].default_value = roughness
        shader.inputs["Metallic"].default_value = 0.0
    material.diffuse_color = color
    return material


def canopy_mass_material(
    name: str,
    dark: tuple[float, float, float, float],
    light: tuple[float, float, float, float],
    seed: float,
) -> bpy.types.Material:
    """Transfer-free crown lookdev; runtime adds instance variation."""
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    nodes = result.node_tree.nodes
    links = result.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    coordinate = nodes.new("ShaderNodeTexCoord")
    noise = nodes.new("ShaderNodeTexNoise")
    noise.noise_dimensions = "4D"
    noise.inputs["Scale"].default_value = 5.8
    noise.inputs["Detail"].default_value = 5.4
    noise.inputs["Roughness"].default_value = 0.72
    noise.inputs["W"].default_value = seed
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.27
    ramp.color_ramp.elements[0].color = dark
    ramp.color_ramp.elements[1].position = 0.78
    ramp.color_ramp.elements[1].color = light
    bump_noise = nodes.new("ShaderNodeTexNoise")
    bump_noise.inputs["Scale"].default_value = 31.0
    bump_noise.inputs["Detail"].default_value = 3.2
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.16
    bump.inputs["Distance"].default_value = 0.22
    shader.inputs["Roughness"].default_value = 0.9
    links.new(coordinate.outputs["Generated"], noise.inputs["Vector"])
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], shader.inputs["Base Color"])
    links.new(coordinate.outputs["Generated"], bump_noise.inputs["Vector"])
    links.new(bump_noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    result.diffuse_color = dark
    return result


def build_shared_materials() -> dict[str, bpy.types.Material]:
    root = ROOT / "public" / "world" / "assets" / "polyhaven" / "pachira_aquatica_01" / "textures"
    leaf = shared_material(
        "v112 shared wet tropical leaves",
        root / "pachira_aquatica_01_leaves_diff_1k.jpg",
        root / "pachira_aquatica_01_leaves_nor_gl_1k.jpg",
        root / "pachira_aquatica_01_leaves_arm_1k.jpg",
        True,
    )
    bark = shared_material(
        "v112 shared damp tropical bark",
        root / "pachira_aquatica_01_bark_diff_1k.jpg",
        root / "pachira_aquatica_01_bark_nor_gl_1k.jpg",
        root / "pachira_aquatica_01_bark_arm_1k.jpg",
        False,
    )
    leaf.diffuse_color = (0.31, 0.5, 0.25, 1.0)
    bark.diffuse_color = (0.2, 0.14, 0.08, 1.0)
    cluster_dark = canopy_mass_material(
        "v112 canopy recess", (0.004, 0.02, 0.004, 1.0), (0.02, 0.075, 0.012, 1.0), 2.1,
    )
    cluster_mid = canopy_mass_material(
        "v112 canopy middle", (0.01, 0.046, 0.008, 1.0), (0.045, 0.16, 0.024, 1.0), 4.7,
    )
    cluster_light = canopy_mass_material(
        "v112 canopy crown light", (0.021, 0.082, 0.013, 1.0), (0.095, 0.265, 0.04, 1.0), 8.3,
    )
    cluster_bark = solid_material("v112 cluster bark", (0.075, 0.052, 0.032, 1.0), 0.94)
    return {
        "leaf": leaf,
        "bark": bark,
        "cluster_bark": cluster_bark,
        "dark": cluster_dark,
        "mid": cluster_mid,
        "light": cluster_light,
    }


def remap_materials(obj: bpy.types.Object, materials: dict[str, bpy.types.Material]) -> None:
    for index, material in enumerate(tuple(obj.data.materials)):
        name = material.name.lower() if material else ""
        obj.data.materials[index] = materials["leaf"] if any(token in name for token in ("leaf", "leaves", "twig")) else materials["bark"]


def deform_crown(obj: bpy.types.Object, spread: float, crown_height: float, bend: float) -> None:
    vertices = obj.data.vertices
    minimum = min(vertex.co.z for vertex in vertices)
    maximum = max(vertex.co.z for vertex in vertices)
    height = max(0.001, maximum - minimum)
    for vertex in vertices:
        normalized = (vertex.co.z - minimum) / height
        crown = max(0.0, min(1.0, (normalized - 0.24) / 0.76))
        crown = crown * crown * (3.0 - 2.0 * crown)
        vertex.co.x *= 1.0 + (spread - 1.0) * crown
        vertex.co.y *= 1.0 + (spread - 1.0) * crown * 0.76
        vertex.co.x += bend * crown ** 1.55
        vertex.co.z = minimum + (vertex.co.z - minimum) * (1.0 + (crown_height - 1.0) * crown)
    obj.data.update()


def source_objects(materials: dict[str, bpy.types.Material]) -> dict[str, bpy.types.Object]:
    result: dict[str, bpy.types.Object] = {}
    imported_meshes(SOURCES["pachira"])
    for letter in "abcd":
        matching = [
            obj for obj in bpy.context.scene.objects
            if obj.type == "MESH" and obj.name.lower().endswith(f"_{letter}")
        ]
        base = join_meshes(matching, f"source_pachira_{letter}")
        normalize_height(base, 12.0 if letter == "d" else 10.0)
        remap_materials(base, materials)
        decimate_to(base, 32000)
        result[f"pachira_{letter}"] = base
    for key in ("island01", "island02", "island03", "small02"):
        base = join_meshes(imported_meshes(SOURCES[key]), f"source_{key}")
        remove_scan_slab(base)
        normalize_height(base, 12.5 if key == "island01" else 10.0)
        remap_materials(base, materials)
        decimate_to(base, 34000)
        result[key] = base
    for source in result.values():
        source.hide_render = True
        source.hide_viewport = True
    return result


def make_variant(source: bpy.types.Object, spec: dict, target: bpy.types.Collection) -> tuple[bpy.types.Object, bpy.types.Object]:
    near = source.copy()
    near.data = source.data.copy()
    target.objects.link(near)
    near.name = f"canopy_{spec['key']}_near"
    near.hide_viewport = False
    near.hide_render = False
    normalize_height(near, spec["height"])
    deform_crown(near, spec["spread"], spec["crown_height"], spec["bend"])
    decimate_to(near, spec["triangles"])
    near["structural_role"] = spec["role"]
    near["source_family"] = spec["source"].split("_")[0]
    near["lod"] = "near"

    mid = near.copy()
    mid.data = near.data.copy()
    target.objects.link(mid)
    mid.name = f"canopy_{spec['key']}_mid"
    decimate_to(mid, max(1800, round(spec["triangles"] * 0.18)))
    mid["structural_role"] = spec["role"]
    mid["source_family"] = spec["source"].split("_")[0]
    mid["lod"] = "mid"
    return near, mid


def join_objects(objects: list[bpy.types.Object], name: str, target: bpy.types.Collection) -> bpy.types.Object:
    result = join_meshes(objects, name)
    for owner in list(result.users_collection):
        owner.objects.unlink(result)
    target.objects.link(result)
    return result


def create_cluster(
    index: int,
    source: bpy.types.Object,
    target: bpy.types.Collection,
    materials: dict[str, bpy.types.Material],
) -> bpy.types.Object:
    """Build an actual tropical-tree LOD, deformed into a distinct structure."""
    spread_profiles = (1.28, 0.78, 1.02, 1.44, 1.08, 1.22, 1.52, 0.86)
    height_profiles = (10.4, 14.6, 9.2, 8.6, 12.7, 10.9, 8.1, 15.4)
    lean_profiles = (-0.32, 0.16, 0.08, -0.62, 0.24, 0.38, -0.78, 0.12)
    crown_height_profiles = (0.88, 1.22, 0.76, 0.68, 1.04, 0.9, 0.64, 1.3)
    target_triangles = (4300, 4900, 3900, 3600, 4700, 4200, 3500, 5000)
    cluster = source.copy()
    cluster.data = source.data.copy()
    target.objects.link(cluster)
    cluster.name = f"cluster_{index:02d}"
    cluster.hide_viewport = False
    cluster.hide_render = False
    normalize_height(cluster, height_profiles[index])
    deform_crown(cluster, spread_profiles[index], crown_height_profiles[index], lean_profiles[index])
    decimate_to(cluster, target_triangles[index])
    for material_index, material in enumerate(tuple(cluster.data.materials)):
        name = material.name.lower() if material else ""
        cluster.data.materials[material_index] = (
            materials[("dark", "mid", "light")[index % 3]]
            if any(token in name for token in ("leaf", "leaves", "twig"))
            else materials["cluster_bark"]
        )
    cluster["lod"] = "cluster"
    cluster["structural_role"] = (
        "broad slope mass", "emergent pocket", "gully pocket", "windward crest",
        "sheltered crown group", "secondary growth", "low dense crown", "tall mixed mass",
    )[index]
    return cluster


def create_cluster_low(source: bpy.types.Object, target: bpy.types.Collection) -> bpy.types.Object:
    result = source.copy()
    result.data = source.data.copy()
    result.name = f"{source.name}_low"
    target.objects.link(result)
    bpy.context.view_layer.objects.active = result
    result.select_set(True)
    modifier = result.modifiers.new("balanced closed-volume reduction", "DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = 0.48
    modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    result.select_set(False)
    result["lod"] = "balanced-cluster"
    result["structural_role"] = source["structural_role"]
    return result


def export_objects(objects: list[bpy.types.Object], filename: str) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_viewport = False
        obj.hide_render = False
        obj.select_set(True)
    if objects:
        bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(PUBLIC_ROOT / filename),
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
    for obj in objects:
        obj.select_set(False)
        obj.hide_render = True
        obj.hide_viewport = True
    print(f"GLB={filename} BYTES={(PUBLIC_ROOT / filename).stat().st_size}")


def look_at(camera: bpy.types.Object, target: Vector) -> None:
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()


def render_contact_sheet(near: list[bpy.types.Object], clusters: list[bpy.types.Object]) -> None:
    preview = new_collection("V112_CANOPY_CONTACT_SHEET")
    rows = (near, clusters, clusters)
    for row_index, row in enumerate(rows):
        for column_index, source in enumerate(row):
            copy = source.copy()
            copy.data = source.data
            preview.objects.link(copy)
            copy.hide_render = False
            copy.hide_viewport = False
            row_center = (len(row) - 1) * 0.5
            copy.location = ((column_index - row_center) * 17.0, (1 - row_index) * 24.0, 0.0)
            copy.rotation_euler[2] = 0.35 + column_index * 0.23
            scale = 0.86 if row_index == 0 else 0.78 if row_index == 1 else 0.6
            copy.scale = (scale, scale, scale)

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0.85
    scene.world.color = (0.025, 0.045, 0.04)
    bpy.ops.object.light_add(type="SUN", location=(-30.0, -40.0, 80.0))
    sun = bpy.context.object
    sun.data.energy = 2.4
    sun.data.color = (1.0, 0.72, 0.48)
    sun.rotation_euler = (math.radians(48.0), math.radians(-18.0), math.radians(-128.0))
    bpy.ops.object.light_add(type="AREA", location=(0.0, -10.0, 80.0))
    fill = bpy.context.object
    fill.data.energy = 2400
    fill.data.color = (0.37, 0.58, 0.67)
    fill.data.size = 120
    bpy.ops.object.camera_add(location=(0.0, -165.0, 74.0))
    camera = bpy.context.object
    camera.data.lens = 54
    look_at(camera, Vector((0.0, 0.0, 7.5)))
    scene.camera = camera
    scene.render.filepath = str(ARTIFACT_ROOT / "forest-source-family-lod-contact-sheet.png")
    bpy.ops.render.render(write_still=True)


def main() -> None:
    PUBLIC_ROOT.mkdir(parents=True, exist_ok=True)
    ARTIFACT_ROOT.mkdir(parents=True, exist_ok=True)
    reset_scene()
    materials = build_shared_materials()
    library = new_collection("RIDGE_V112_CANOPY_LIBRARY")
    sources = source_objects(materials)
    near: list[bpy.types.Object] = []
    mid: list[bpy.types.Object] = []
    for spec in VARIANTS:
        near_object, mid_object = make_variant(sources[spec["source"]], spec, library)
        near.append(near_object)
        # Collapse produced disconnected leaf and branch shards in visual
        # iteration 1. Middle distance now uses the closed volumetric cluster
        # library; every real source tree remains a sparse near enhancement.
        bpy.data.objects.remove(mid_object, do_unlink=True)
    cluster_source_keys = (
        "pachira_a", "pachira_d", "pachira_b", "pachira_c",
        "pachira_a", "pachira_b", "pachira_c", "pachira_d",
    )
    clusters = [
        create_cluster(index, sources[cluster_source_keys[index]], library, materials)
        for index in range(8)
    ]
    low_clusters = [create_cluster_low(source, library) for source in clusters]

    report = {
        "version": "v1.12",
        "sourceFamilies": sorted({spec["source"].split("_")[0] for spec in VARIANTS}),
        "variants": [
            {
                "key": spec["key"],
                "source": spec["source"],
                "role": spec["role"],
                "nearTriangles": triangle_count(near[index]),
                "midTriangles": next((triangle_count(obj) for obj in mid if obj.name == f"canopy_{spec['key']}_mid"), None),
            }
            for index, spec in enumerate(VARIANTS)
        ],
        "clusters": [
            {
                "key": obj.name,
                "role": obj["structural_role"],
                "highTriangles": triangle_count(obj),
                "balancedTriangles": triangle_count(low_clusters[index]),
            }
            for index, obj in enumerate(clusters)
        ],
        "architecture": "near source buffers and actual tropical-tree middle/far LOD buffers exported independently and instanced from separate placement JSON",
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    for row in report["variants"]:
        print(json.dumps(row))
    for row in report["clusters"]:
        print(json.dumps(row))

    export_objects(clusters, "madagin-ridge-canopy-clusters-v1.12.glb")
    export_objects(low_clusters, "madagin-ridge-canopy-clusters-low-v1.12.glb")
    export_objects(near, "madagin-ridge-canopy-near-v1.12.glb")
    render_contact_sheet(near, clusters)
    bpy.context.scene["madagin_version"] = "v1.12-ridge-canopy-system"
    bpy.context.scene["source_families"] = "Poly Haven Pachira Aquatica 01, Island Tree 01, 02, 03, Tree Small 02; CC0"
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    print(f"BLEND={BLEND_PATH}")


if __name__ == "__main__":
    main()
