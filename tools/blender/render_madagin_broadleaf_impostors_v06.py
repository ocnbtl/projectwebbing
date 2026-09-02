"""Build four lightweight broadleaf tree impostors from Poly Haven Shrub 04.

The shrub is used as a photogrammetric foliage cluster. Multiple linked copies
are arranged around a small procedural trunk and branch skeleton, producing
young alder-like silhouettes that break up the conifer monoculture without
shipping another heavy runtime tree model.
"""

from __future__ import annotations

import math
import random
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "public" / "world" / "assets" / "polyhaven" / "shrub_04" / "shrub_04_1k.gltf"
OUTPUT = ROOT / "public" / "world" / "v06" / "impostors"


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def cylinder_between(start: Vector, end: Vector, radius: float, material: bpy.types.Material) -> bpy.types.Object:
    midpoint = (start + end) * 0.5
    direction = end - start
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=radius, depth=direction.length, location=midpoint)
    result = bpy.context.object
    result.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    result.data.materials.append(material)
    return result


def configure_leaf_material(material: bpy.types.Material) -> None:
    material.use_nodes = True
    nodes = material.node_tree.nodes
    principled = next((node for node in nodes if node.type == "BSDF_PRINCIPLED"), None)
    if principled is None:
        return
    alpha_path = SOURCE.parent / "textures" / "shrub_04_alpha_1k.png"
    alpha_image = bpy.data.images.load(str(alpha_path), check_existing=True)
    alpha_node = nodes.new("ShaderNodeTexImage")
    alpha_node.image = alpha_image
    alpha_node.interpolation = "Linear"
    material.node_tree.links.new(alpha_node.outputs["Color"], principled.inputs["Alpha"])
    principled.inputs["Roughness"].default_value = 0.82
    material.surface_render_method = "DITHERED"


def clear_generated(source_objects: list[bpy.types.Object]) -> None:
    for obj in list(bpy.context.scene.objects):
        if obj not in source_objects and obj.type not in {"CAMERA", "LIGHT"}:
            bpy.data.objects.remove(obj, do_unlink=True)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    source_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not source_objects:
        raise RuntimeError("Shrub 04 imported without mesh objects")
    for obj in source_objects:
        obj.hide_render = True
        for material in obj.data.materials:
            if material is not None:
                configure_leaf_material(material)

    bark = bpy.data.materials.new("Madagin young bark")
    bark.diffuse_color = (0.115, 0.09, 0.06, 1)
    bark.use_nodes = True
    bark.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.115, 0.09, 0.06, 1)
    bark.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.94

    bpy.ops.object.light_add(type="AREA", location=(-5.5, -7.5, 9.5))
    key = bpy.context.object
    key.data.energy = 1100
    key.data.shape = "DISK"
    key.data.size = 5.5
    key.data.color = (1.0, 0.79, 0.58)
    look_at(key, Vector((0, 0, 3.8)))
    bpy.ops.object.light_add(type="AREA", location=(5.5, -2.5, 6.2))
    fill = bpy.context.object
    fill.data.energy = 850
    fill.data.size = 6.0
    fill.data.color = (0.55, 0.72, 0.85)
    look_at(fill, Vector((0, 0, 3.5)))

    bpy.ops.object.camera_add(location=(0, -14, 4.1))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 10.8
    look_at(camera, Vector((0, 0, 3.8)))
    bpy.context.scene.camera = camera

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 512
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.look = "AgX - Medium High Contrast"

    for variant in range(4):
        clear_generated(source_objects)
        rng = random.Random(4300 + variant * 97)
        trunk_top = 4.65 + rng.uniform(-0.25, 0.35)
        cylinder_between(Vector((0, 0, 0)), Vector((rng.uniform(-0.08, 0.08), 0, trunk_top)), 0.105, bark)
        crown_points = [
            Vector((0, 0, trunk_top)),
            Vector((-0.72, 0.05, 3.65)),
            Vector((0.7, 0.0, 3.85)),
            Vector((-0.92, 0.03, 4.25)),
            Vector((0.9, 0.03, 4.45)),
            Vector((-0.48, 0.03, 4.85)),
            Vector((0.45, 0.03, 5.05)),
            Vector((-0.2, 0.04, 5.45)),
            Vector((0.18, 0.04, 5.82)),
        ]
        if variant % 2:
            crown_points.extend([Vector((-1.05, 0.02, 4.35)), Vector((0.95, 0.03, 4.55))])
        for index, point in enumerate(crown_points):
            point.x += rng.uniform(-0.24, 0.24)
            point.y += rng.uniform(-0.18, 0.18)
            point.z += rng.uniform(-0.17, 0.17)
            if index > 0:
                anchor = Vector((0, 0, max(2.6, point.z - 0.7)))
                cylinder_between(anchor, point, 0.035 + rng.random() * 0.025, bark)
            source = source_objects[(index + variant) % len(source_objects)]
            crown = source.copy()
            crown.data = source.data
            bpy.context.collection.objects.link(crown)
            crown.hide_render = False
            crown.location = point
            crown.rotation_euler = (rng.uniform(-0.12, 0.12), rng.uniform(-0.12, 0.12), rng.random() * math.tau)
            scale = 5.2 + rng.uniform(-0.55, 0.72)
            crown.scale = (scale * rng.uniform(0.88, 1.16), scale * rng.uniform(0.88, 1.16), scale * rng.uniform(0.82, 1.12))

        scene.render.filepath = str(OUTPUT / f"broadleaf-{variant + 1}.png")
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
