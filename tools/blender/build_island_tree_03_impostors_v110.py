"""Render bounded web impostors from Poly Haven Island Tree 03 (CC0).

The high-resolution scan remains an editable source asset. This script derives
four side and four crown views for the Ridge middle/far canopy so the browser
gets a second real tree structure without transferring the 79 MB source mesh.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "world-source" / "assets" / "polyhaven" / "island_tree_03" / "island_tree_03_1k.gltf"
OUTPUT = ROOT / "public" / "world" / "v110" / "island-tree-03-impostors"


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def configure_scene() -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0.18

    world = bpy.data.worlds.new("Island tree neutral humid fill")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.22, 0.31, 0.36, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.62
    scene.world = world

    bpy.ops.object.light_add(type="AREA", location=(-3.4, -4.8, 6.0))
    key = bpy.context.object
    key.data.energy = 620.0
    key.data.shape = "DISK"
    key.data.size = 5.0
    key.data.color = (1.0, 0.77, 0.56)
    look_at(key, Vector((0.0, 0.0, 1.3)))

    bpy.ops.object.light_add(type="AREA", location=(4.0, 3.0, 4.5))
    fill = bpy.context.object
    fill.data.energy = 380.0
    fill.data.size = 5.5
    fill.data.color = (0.46, 0.68, 0.75)
    look_at(fill, Vector((0.0, 0.0, 1.2)))


def import_and_center_tree() -> bpy.types.Object:
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(meshes) != 1:
        raise RuntimeError(f"Expected one Island Tree mesh, found {len(meshes)}")
    tree = meshes[0]
    # Material slot zero is the scanned sand/stone island beneath the roots.
    # Remove only those source faces so the derivative can contact arbitrary
    # forest terrain without carrying a visible square ground patch.
    bpy.context.view_layer.objects.active = tree
    tree.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.object.mode_set(mode="OBJECT")
    for polygon in tree.data.polygons:
        polygon.select = polygon.material_index == 0 and polygon.center.z < 0.09
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.delete(type="FACE")
    bpy.ops.object.mode_set(mode="OBJECT")
    corners = [tree.matrix_world @ Vector(corner) for corner in tree.bound_box]
    minimum = Vector((min(point.x for point in corners), min(point.y for point in corners), min(point.z for point in corners)))
    maximum = Vector((max(point.x for point in corners), max(point.y for point in corners), max(point.z for point in corners)))
    tree.location += Vector((-(minimum.x + maximum.x) * 0.5, -(minimum.y + maximum.y) * 0.5, -minimum.z))
    tree["source"] = "https://polyhaven.com/a/island_tree_03"
    tree["license"] = "CC0 1.0"
    return tree


def add_camera() -> bpy.types.Object:
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.lens = 52
    camera.data.dof.use_dof = False
    bpy.context.scene.camera = camera
    return camera


def render_views(tree: bpy.types.Object, camera: bpy.types.Object) -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for index, degrees in enumerate((0, 90, 180, 270), start=1):
        tree.rotation_euler.z = math.radians(degrees)
        camera.location = (6.5, 0.0, 1.42)
        camera.data.ortho_scale = 3.65
        look_at(camera, Vector((0.0, 0.0, 1.38)))
        bpy.context.scene.render.filepath = str(OUTPUT / f"island-tree-03-side-{index}.png")
        bpy.ops.render.render(write_still=True)

    for index, degrees in enumerate((0, 90, 180, 270), start=1):
        tree.rotation_euler.z = math.radians(degrees + 22.5)
        camera.location = (0.0, 0.0, 7.0)
        camera.data.ortho_scale = 3.75
        look_at(camera, Vector((0.0, 0.0, 0.95)))
        bpy.context.scene.render.filepath = str(OUTPUT / f"island-tree-03-crown-{index}.png")
        bpy.ops.render.render(write_still=True)


def main() -> None:
    reset_scene()
    configure_scene()
    tree = import_and_center_tree()
    camera = add_camera()
    render_views(tree, camera)
    print(f"Rendered Island Tree 03 CC0 impostors to {OUTPUT}")


if __name__ == "__main__":
    main()
