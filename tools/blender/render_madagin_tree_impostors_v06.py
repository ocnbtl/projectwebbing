from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "public" / "world" / "v06" / "impostors"
TEXTURE_ROOT = ROOT / "public" / "world" / "assets" / "polyhaven" / "fir_tree_01"
TREE_NAMES = (
    "Madagin_Fir_A_LOD2",
    "Madagin_Fir_B_LOD2",
    "Madagin_Fir_C_LOD2",
)
ROTATIONS = (0.0, math.radians(137.5))


def clear_render_scene() -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 512
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 25
    scene.render.resolution_percentage = 100
    scene.render.image_settings.color_management = "FOLLOW_SCENE"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 1.35

    for object_ in list(bpy.data.objects):
        if object_.name not in TREE_NAMES:
            bpy.data.objects.remove(object_, do_unlink=True)

    world = scene.world or bpy.data.worlds.new("MADAGIN_IMPOSTOR_WORLD")
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    if background is not None:
        background.inputs["Color"].default_value = (0.18, 0.24, 0.20, 1.0)
        background.inputs["Strength"].default_value = 0.95


def image_node(nodes, path: Path, *, non_color: bool = False):
    image = bpy.data.images.load(str(path), check_existing=True)
    if non_color:
        image.colorspace_settings.name = "Non-Color"
    node = nodes.new("ShaderNodeTexImage")
    node.image = image
    return node


def build_material(
    name: str,
    diffuse: Path,
    normal: Path,
    roughness: float,
    alpha: Path | None = None,
):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Specular IOR Level"].default_value = 0.28
    links.new(principled.outputs["BSDF"], output.inputs["Surface"])

    diffuse_node = image_node(nodes, diffuse)
    links.new(diffuse_node.outputs["Color"], principled.inputs["Base Color"])

    normal_node = image_node(nodes, normal, non_color=True)
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.inputs["Strength"].default_value = 0.72
    links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], principled.inputs["Normal"])

    if alpha is not None:
        alpha_node = image_node(nodes, alpha, non_color=True)
        links.new(alpha_node.outputs["Color"], principled.inputs["Alpha"])
        if hasattr(material, "surface_render_method"):
            material.surface_render_method = "DITHERED"
        material.use_transparency_overlap = False

    return material


def assign_textured_materials() -> None:
    materials = {
        "bark": build_material(
            "MADAGIN_IMPOSTOR_BARK",
            TEXTURE_ROOT / "fir_tree_01_bark_diff_1k.jpg",
            TEXTURE_ROOT / "fir_tree_01_bark_nor_gl_1k.jpg",
            0.96,
        ),
        "trunk": build_material(
            "MADAGIN_IMPOSTOR_TRUNK",
            TEXTURE_ROOT / "fir_tree_01_trunk_a_diff_1k.jpg",
            TEXTURE_ROOT / "fir_tree_01_trunk_a_nor_gl_1k.jpg",
            0.96,
        ),
        "twig": build_material(
            "MADAGIN_IMPOSTOR_TWIG",
            TEXTURE_ROOT / "fir_tree_01_twig_diff_1k.jpg",
            TEXTURE_ROOT / "fir_tree_01_twig_nor_gl_1k.jpg",
            0.9,
            TEXTURE_ROOT / "fir_tree_01_twig_alpha_1k.png",
        ),
        "deadwood": build_material(
            "MADAGIN_IMPOSTOR_DEADWOOD",
            TEXTURE_ROOT / "fir_tree_01_bark_diff_1k.jpg",
            TEXTURE_ROOT / "fir_tree_01_bark_nor_gl_1k.jpg",
            1.0,
        ),
    }

    for tree_name in TREE_NAMES:
        tree = bpy.data.objects.get(tree_name)
        if tree is None:
            raise RuntimeError(f"Missing authored tree {tree_name}")
        for slot in tree.material_slots:
            slot_name = slot.material.name.lower() if slot.material else ""
            if "twig" in slot_name:
                slot.material = materials["twig"]
            elif "dead" in slot_name:
                slot.material = materials["deadwood"]
            elif "trunk" in slot_name:
                slot.material = materials["trunk"]
            else:
                slot.material = materials["bark"]


def add_light(name: str, light_type: str, energy: float, color, location):
    data = bpy.data.lights.new(name, type=light_type)
    data.energy = energy
    data.color = color
    if light_type == "AREA":
        data.shape = "DISK"
        data.size = 8.0
    object_ = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(object_)
    object_.location = location
    return object_


def add_camera():
    data = bpy.data.cameras.new("MADAGIN_IMPOSTOR_CAMERA")
    data.type = "ORTHO"
    data.lens = 70
    camera = bpy.data.objects.new("MADAGIN_IMPOSTOR_CAMERA", data)
    bpy.context.scene.collection.objects.link(camera)
    bpy.context.scene.camera = camera
    return camera


def bounds(object_: bpy.types.Object):
    corners = [object_.matrix_world @ Vector(corner) for corner in object_.bound_box]
    minimum = Vector((
        min(corner.x for corner in corners),
        min(corner.y for corner in corners),
        min(corner.z for corner in corners),
    ))
    maximum = Vector((
        max(corner.x for corner in corners),
        max(corner.y for corner in corners),
        max(corner.z for corner in corners),
    ))
    return minimum, maximum


def aim(camera: bpy.types.Object, target: Vector) -> None:
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()


def render() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    clear_render_scene()
    assign_textured_materials()

    camera = add_camera()
    add_light("MADAGIN_KEY", "AREA", 1100, (1.0, 0.72, 0.46), (-11, -10, 18))
    add_light("MADAGIN_FILL", "AREA", 760, (0.42, 0.62, 0.82), (10, -6, 12))
    add_light("MADAGIN_RIM", "AREA", 920, (0.72, 0.86, 0.77), (8, 8, 16))

    for tree in (bpy.data.objects.get(name) for name in TREE_NAMES):
        if tree is None:
            raise RuntimeError("A required tree disappeared during render setup")
        tree.hide_render = True
        tree.hide_set(True)

    variant_index = 0
    for tree_index, tree_name in enumerate(TREE_NAMES):
        tree = bpy.data.objects.get(tree_name)
        if tree is None:
            raise RuntimeError(f"Missing authored tree {tree_name}")
        tree.hide_render = False
        tree.hide_set(False)

        for rotation_index, rotation in enumerate(ROTATIONS):
            tree.rotation_euler[2] = rotation
            bpy.context.view_layer.update()
            minimum, maximum = bounds(tree)
            center = (minimum + maximum) * 0.5
            height = maximum.z - minimum.z
            width = max(maximum.x - minimum.x, maximum.y - minimum.y)
            camera.location = (center.x, center.y - max(24.0, width * 2.8), center.z)
            camera.data.ortho_scale = max(height * 1.06, width * 2.02)
            aim(camera, center + Vector((0, 0, height * 0.015)))

            variant_index += 1
            output = OUTPUT_DIR / f"fir-{tree_index + 1}-{rotation_index + 1}.png"
            bpy.context.scene.render.filepath = str(output)
            bpy.ops.render.render(write_still=True)
            print(f"IMPOSTOR_{variant_index}={output}")
            print(f"IMPOSTOR_{variant_index}_BYTES={output.stat().st_size}")

        tree.hide_render = True
        tree.hide_set(True)


if __name__ == "__main__":
    render()
