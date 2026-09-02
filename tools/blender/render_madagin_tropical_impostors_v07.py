"""Render eight lightweight tropical tree impostors for Madagin v0.7.

The source is Poly Haven's CC0 Pachira Aquatica 01 set. Four scanned forms
are rendered from two intentionally offset angles. The browser receives only
the resulting transparent PNGs; the denser source geometry stays in the local
asset library as provenance and as a future close-range LOD source.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
SOURCE = (
    ROOT
    / "public"
    / "world"
    / "assets"
    / "polyhaven"
    / "pachira_aquatica_01"
    / "pachira_aquatica_01_1k.gltf"
)
OUTPUT = ROOT / "public" / "world" / "v07" / "impostors"


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def configure_materials() -> None:
    for material in bpy.data.materials:
        if material is None or not material.use_nodes:
            continue
        principled = next(
            (node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"),
            None,
        )
        if principled is None:
            continue
        principled.inputs["Roughness"].default_value = 0.88


def add_lighting() -> None:
    bpy.ops.object.light_add(type="AREA", location=(-6.5, -7.5, 11.0))
    key = bpy.context.object
    key.data.energy = 1050
    key.data.shape = "DISK"
    key.data.size = 7.5
    key.data.color = (1.0, 0.78, 0.56)
    look_at(key, Vector((0, 0, 4.2)))

    bpy.ops.object.light_add(type="AREA", location=(7.5, -1.5, 8.0))
    fill = bpy.context.object
    fill.data.energy = 720
    fill.data.size = 8.0
    fill.data.color = (0.54, 0.72, 0.84)
    look_at(fill, Vector((0, 0, 4.0)))

    bpy.ops.object.light_add(type="AREA", location=(0, 5.0, 7.0))
    rim = bpy.context.object
    rim.data.energy = 520
    rim.data.size = 6.0
    rim.data.color = (0.72, 0.86, 0.78)
    look_at(rim, Vector((0, 0, 4.5)))


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    configure_materials()

    forms: list[tuple[bpy.types.Object, bpy.types.Object]] = []
    for suffix in ("a", "b", "c", "d"):
        bark = bpy.data.objects.get(f"pachira_aquatica_01_bark_{suffix}")
        leaves = bpy.data.objects.get(f"pachira_aquatica_01_leaves_{suffix}")
        if bark is None or leaves is None:
            raise RuntimeError(f"Pachira form {suffix} is incomplete")
        forms.append((bark, leaves))
        bark.hide_render = True
        leaves.hide_render = True

    add_lighting()
    bpy.ops.object.camera_add(location=(0, -15.5, 5.0))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 11.8
    look_at(camera, Vector((0, 0, 4.35)))
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

    for form_index, (bark, leaves) in enumerate(forms):
        original_locations = (bark.location.copy(), leaves.location.copy())
        original_rotations = (bark.rotation_euler.copy(), leaves.rotation_euler.copy())
        original_scales = (bark.scale.copy(), leaves.scale.copy())
        for view_index, angle_degrees in enumerate((12, 67)):
            angle = math.radians(angle_degrees + form_index * 9)
            for obj in (bark, leaves):
                obj.hide_render = False
                obj.location = (0, 0, 0)
                obj.rotation_euler = (0, 0, angle)
                # The scanned forms range from compact to tall. Normalize them
                # only loosely so natural silhouette differences remain.
                base_scale = (5.0, 5.0, 5.0)
                obj.scale = base_scale

            output_index = form_index * 2 + view_index + 1
            scene.render.filepath = str(OUTPUT / f"tropical-{output_index}.png")
            bpy.ops.render.render(write_still=True)

            bark.hide_render = True
            leaves.hide_render = True

        bark.location, leaves.location = original_locations
        bark.rotation_euler, leaves.rotation_euler = original_rotations
        bark.scale, leaves.scale = original_scales

    # The opening camera is intentionally aerial. A second set of square crown
    # cards supplies real scanned leaf structure when the camera looks down,
    # while the tall cards above continue to describe the canopy from the side.
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    camera.location = (0, -0.35, 16.0)
    camera.data.ortho_scale = 10.2
    look_at(camera, Vector((0, 0, 3.2)))
    for form_index, (bark, leaves) in enumerate(forms):
        original_locations = (bark.location.copy(), leaves.location.copy())
        original_rotations = (bark.rotation_euler.copy(), leaves.rotation_euler.copy())
        original_scales = (bark.scale.copy(), leaves.scale.copy())
        angle = math.radians(21 + form_index * 23)
        for obj in (bark, leaves):
            obj.hide_render = False
            obj.location = (0, 0, 0)
            obj.rotation_euler = (0, 0, angle)
            obj.scale = (5.0, 5.0, 5.0)
        scene.render.filepath = str(OUTPUT / f"tropical-top-{form_index + 1}.png")
        bpy.ops.render.render(write_still=True)
        bark.hide_render = True
        leaves.hide_render = True
        bark.location, leaves.location = original_locations
        bark.rotation_euler, leaves.rotation_euler = original_rotations
        bark.scale, leaves.scale = original_scales


if __name__ == "__main__":
    main()
