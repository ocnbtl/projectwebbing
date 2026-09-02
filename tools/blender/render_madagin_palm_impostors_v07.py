"""Render four authored palm silhouettes for the Madagin Hawaiian canopy."""

from __future__ import annotations

import math
import random
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "public" / "world" / "v07" / "impostors"


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def cylinder_between(start: Vector, end: Vector, radius: float, material: bpy.types.Material) -> bpy.types.Object:
    midpoint = (start + end) * 0.5
    direction = end - start
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=radius, depth=direction.length, location=midpoint)
    result = bpy.context.object
    result.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    result.data.materials.append(material)
    return result


def create_frond(
    angle: float,
    length: float,
    width: float,
    crown: Vector,
    lift: float,
    droop: float,
    material: bpy.types.Material,
) -> bpy.types.Object:
    segments = 10
    radial = Vector((math.cos(angle), math.sin(angle), 0))
    tangent = Vector((-math.sin(angle), math.cos(angle), 0))
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    for index in range(segments + 1):
        progress = index / segments
        center = crown + radial * (length * progress)
        center.z += math.sin(progress * math.pi) * lift - droop * progress * progress
        half_width = width * (math.sin(progress * math.pi) ** 0.58) * (1 - progress * 0.22)
        ripple = math.sin(progress * math.pi * 5 + angle) * width * 0.055
        center += tangent * ripple
        left = center - tangent * half_width
        right = center + tangent * half_width
        vertices.extend((tuple(left), tuple(right)))
        if index < segments:
            base = index * 2
            faces.append((base, base + 1, base + 3, base + 2))
    mesh = bpy.data.meshes.new("Madagin_Palm_Frond")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    result = bpy.data.objects.new("Madagin_Palm_Frond", mesh)
    bpy.context.collection.objects.link(result)
    result.data.materials.append(material)
    return result


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    bark = bpy.data.materials.new("Madagin palm bark")
    bark.diffuse_color = (0.19, 0.125, 0.075, 1)
    bark.use_nodes = True
    bark.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.19, 0.125, 0.075, 1)
    bark.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.96

    leaf = bpy.data.materials.new("Madagin palm leaf")
    leaf.diffuse_color = (0.075, 0.26, 0.095, 1)
    leaf.use_nodes = True
    leaf.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.075, 0.26, 0.095, 1)
    leaf.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.86

    bpy.ops.object.light_add(type="AREA", location=(-7, -8, 12))
    key = bpy.context.object
    key.data.energy = 1150
    key.data.size = 7
    key.data.color = (1.0, 0.78, 0.55)
    look_at(key, Vector((0, 0, 5)))
    bpy.ops.object.light_add(type="AREA", location=(7, -1, 8))
    fill = bpy.context.object
    fill.data.energy = 700
    fill.data.size = 8
    fill.data.color = (0.54, 0.75, 0.86)
    look_at(fill, Vector((0, 0, 5)))

    bpy.ops.object.camera_add(location=(0, -18, 6.6))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 13.0
    look_at(camera, Vector((0, 0, 5.4)))
    bpy.context.scene.camera = camera

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 512
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = True
    scene.view_settings.look = "AgX - Medium High Contrast"

    permanent = {camera, key, fill}
    for variant in range(4):
        for obj in list(scene.objects):
            if obj not in permanent:
                bpy.data.objects.remove(obj, do_unlink=True)
        randomizer = random.Random(9913 + variant * 193)
        height = 7.3 + randomizer.uniform(-0.7, 1.25)
        lean_x = randomizer.uniform(-0.42, 0.42)
        lean_y = randomizer.uniform(-0.18, 0.18)
        trunk_points = [Vector((0, 0, 0))]
        for segment in range(1, 7):
            progress = segment / 6
            trunk_points.append(Vector((lean_x * progress * progress, lean_y * progress, height * progress)))
        for segment in range(6):
            cylinder_between(
                trunk_points[segment],
                trunk_points[segment + 1],
                0.18 - segment * 0.012,
                bark,
            )
        crown = trunk_points[-1]
        frond_count = 12 + variant
        for index in range(frond_count):
            angle = (index / frond_count) * math.tau + randomizer.uniform(-0.14, 0.14)
            create_frond(
                angle,
                2.6 + randomizer.uniform(-0.35, 0.72),
                0.42 + randomizer.uniform(-0.07, 0.12),
                crown,
                0.55 + randomizer.uniform(-0.08, 0.38),
                1.15 + randomizer.uniform(-0.15, 0.58),
                leaf,
            )
        scene.render.filepath = str(OUTPUT / f"palm-{variant + 1}.png")
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
