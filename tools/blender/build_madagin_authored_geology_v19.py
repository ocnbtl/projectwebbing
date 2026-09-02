"""Build bounded authored geology for the Madagin v1.9 real-time Journey.

The source stays intentionally compact: each checkpoint exports one joined mesh
with low-poly, hand-composed silhouettes.  Dense ecology and animated water stay
in the browser where instancing and quality tiers are more efficient.

Run with:
  blender --background --python tools/blender/build_madagin_authored_geology_v19.py
"""

from __future__ import annotations

import math
import random
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
SOURCE_PATH = ROOT / "world-source" / "madagin-authored-geology-v1.9.blend"
EXPORT_DIR = ROOT / "public" / "world" / "v19"


def runtime_to_blender(x: float, y: float, z: float) -> tuple[float, float, float]:
    """Convert Three.js Y-up coordinates to Blender Z-up coordinates."""

    return (x, -z, y)


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in tuple(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)
    base = bpy.data.collections.get("Collection")
    if base is not None:
        base.name = "V19 Sources"


def material(name: str, color: tuple[float, float, float, float], roughness: float = 0.92) -> bpy.types.Material:
    result = bpy.data.materials.new(name)
    result.diffuse_color = color
    result.use_nodes = True
    shader = next(node for node in result.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = roughness
    if "Coat Weight" in shader.inputs:
        shader.inputs["Coat Weight"].default_value = 0.08
    return result


ROCK = material("Weathered basalt", (0.18, 0.23, 0.21, 1.0), 0.96)
WET_ROCK = material("Wet basalt", (0.075, 0.12, 0.115, 1.0), 0.68)
MOSS_ROCK = material("Mossed basalt", (0.19, 0.28, 0.19, 1.0), 0.99)
DISTANT_ROCK = material("Atmospheric mountain rock", (0.23, 0.31, 0.30, 1.0), 1.0)


def collection(name: str) -> bpy.types.Collection:
    result = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(result)
    return result


def move_to_collection(obj: bpy.types.Object, target: bpy.types.Collection) -> None:
    for owner in tuple(obj.users_collection):
        owner.objects.unlink(obj)
    target.objects.link(obj)


def add_rock(
    target: bpy.types.Collection,
    name: str,
    position: tuple[float, float, float],
    scale: tuple[float, float, float],
    seed: int,
    rock_material: bpy.types.Material = ROCK,
) -> bpy.types.Object:
    rng = random.Random(seed)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=runtime_to_blender(*position))
    obj = bpy.context.object
    obj.name = name
    move_to_collection(obj, target)
    obj.scale = (scale[0], scale[2], scale[1])
    obj.rotation_euler = (
        rng.uniform(-0.28, 0.28),
        rng.uniform(-0.28, 0.28),
        rng.uniform(0.0, math.tau),
    )
    for vertex in obj.data.vertices:
        direction = vertex.co.normalized()
        ridge = math.sin(direction.x * 7.1 + seed) * math.sin(direction.y * 5.7 - seed * 0.3)
        vertex.co *= 0.83 + rng.random() * 0.28 + ridge * 0.08
    obj.data.materials.append(rock_material)
    return obj


def add_basalt_column(
    target: bpy.types.Collection,
    name: str,
    position: tuple[float, float, float],
    radius: float,
    height: float,
    thickness: float,
    seed: int,
    rock_material: bpy.types.Material,
) -> bpy.types.Object:
    rng = random.Random(seed)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=6,
        radius=1.0,
        depth=2.0,
        location=runtime_to_blender(*position),
    )
    obj = bpy.context.object
    obj.name = name
    move_to_collection(obj, target)
    obj.scale = (radius, thickness, height * 0.5)
    obj.rotation_euler = (rng.uniform(-0.035, 0.035), rng.uniform(-0.035, 0.035), rng.uniform(-0.12, 0.12))
    obj.data.materials.append(rock_material)
    return obj


def add_branch(
    target: bpy.types.Collection,
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    radius: float,
) -> bpy.types.Object:
    start_vector = Vector(start)
    end_vector = Vector(end)
    direction = end_vector - start_vector
    midpoint = (start_vector + end_vector) * 0.5
    bpy.ops.mesh.primitive_cone_add(
        vertices=7,
        radius1=radius * 1.18,
        radius2=radius * 0.72,
        depth=direction.length,
        location=midpoint,
    )
    obj = bpy.context.object
    obj.name = name
    move_to_collection(obj, target)
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("Z", "Y")
    obj.data.materials.append(ROCK)
    return obj


def add_peak(
    target: bpy.types.Collection,
    name: str,
    center: tuple[float, float, float],
    radius_x: float,
    radius_z: float,
    height: float,
    seed: int,
) -> bpy.types.Object:
    rng = random.Random(seed)
    segments = 28
    rings = 7
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, ...]] = []
    for ring in range(rings):
        progress = ring / rings
        taper = (1.0 - progress) ** 0.62
        taper *= 1.0 + math.sin(progress * math.pi * 5.0 + seed * 0.13) * 0.055
        center_shift_x = math.sin(progress * 4.7 + seed) * radius_x * 0.075 * progress
        center_shift_z = math.sin(progress * 5.9 - seed * 0.17) * radius_z * 0.065 * progress
        for segment in range(segments):
            angle = (segment / segments) * math.tau
            fracture = (
                1.0
                + math.sin(angle * 3 + seed * 0.07) * 0.13
                + math.sin(angle * 7 - seed) * 0.055
                + math.sin(angle * 11 + progress * 4.0) * 0.025
            )
            x = center[0] + center_shift_x + math.cos(angle) * radius_x * taper * fracture
            z = center[2] + center_shift_z + math.sin(angle) * radius_z * taper * fracture
            shoulder = (
                math.sin(progress * math.pi)
                * math.sin(angle * 4.0 + progress * 7.0 + seed)
                * height
                * 0.055
            )
            y = center[1] + progress * height + shoulder
            vertices.append(runtime_to_blender(x, y, z))
    vertices.append(runtime_to_blender(center[0] + rng.uniform(-1.4, 1.4), center[1] + height * 1.05, center[2]))
    peak_index = len(vertices) - 1
    for ring in range(rings - 1):
        for segment in range(segments):
            nxt = (segment + 1) % segments
            a = ring * segments + segment
            b = ring * segments + nxt
            c = (ring + 1) * segments + segment
            d = (ring + 1) * segments + nxt
            faces.append((a, b, d, c))
    final_ring = (rings - 1) * segments
    for segment in range(segments):
        faces.append((final_ring + segment, final_ring + (segment + 1) % segments, peak_index))
    mesh = bpy.data.meshes.new(f"{name} mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    target.objects.link(obj)
    obj.data.materials.append(DISTANT_ROCK)
    for polygon in obj.data.polygons:
        polygon.use_smooth = False
    return obj


def join_collection(target: bpy.types.Collection, name: str) -> None:
    meshes = [obj for obj in target.objects if obj.type == "MESH"]
    if not meshes:
        return
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    meshes[0].name = name
    meshes[0]["madagin_zone"] = target.name
    meshes[0]["source_version"] = "v1.9"


def build_ridge() -> bpy.types.Collection:
    target = collection("Ridge geology")
    rng = random.Random(19001)
    for index in range(20):
        x = rng.uniform(-35, 35)
        z = rng.uniform(5.5, 18.5)
        crown = 5.7 + math.exp(-((z - 11.5) / 6.8) ** 2) * 4.8
        crown += math.sin(x * 0.22) * 0.8 - abs(x) * 0.025
        scale = rng.uniform(0.42, 1.18)
        add_rock(
            target,
            f"Ridge outcrop {index + 1:02d}",
            (x, crown + scale * 0.18, z),
            (scale * rng.uniform(1.2, 2.3), scale * rng.uniform(0.55, 1.1), scale * rng.uniform(0.7, 1.5)),
            19001 + index,
            MOSS_ROCK if index % 4 else ROCK,
        )
    join_collection(target, "Madagin ridge outcrops v1.9")
    return target


def build_valley() -> bpy.types.Collection:
    target = collection("Valley geography")
    peaks = (
        (-95, -286, 38, 40, 28),
        (-42, -320, 55, 46, 34),
        (20, -302, 44, 38, 30),
        (78, -336, 60, 50, 36),
        (132, -288, 42, 38, 28),
        (-150, -372, 62, 56, 42),
        (112, -404, 72, 60, 46),
    )
    for index, (x, z, height, radius_x, radius_z) in enumerate(peaks):
        add_peak(target, f"Valley peak {index + 1:02d}", (x, -1.0, z), radius_x, radius_z, height, 19100 + index)
        if index < 5:
            direction = -1 if index % 2 else 1
            add_peak(
                target,
                f"Valley shoulder {index + 1:02d}",
                (x + direction * radius_x * 0.48, -1.0, z + radius_z * 0.16),
                radius_x * 0.52,
                radius_z * 0.58,
                height * (0.48 + (index % 3) * 0.055),
                19150 + index,
            )
    join_collection(target, "Madagin layered valley peaks v1.9")
    return target


def build_lake() -> bpy.types.Collection:
    target = collection("Lake basin geology")
    rng = random.Random(19201)
    center_x, center_z = 2.4, -49.0
    for index in range(44):
        angle = (index / 44) * math.tau + rng.uniform(-0.08, 0.08)
        radial = 1.0 + math.sin(angle * 3 + 0.7) * 0.08 + math.sin(angle * 7 - 1.2) * 0.035
        x = center_x + math.cos(angle) * 19.3 * radial
        z = center_z + math.sin(angle) * 28.2 * radial
        scale = rng.uniform(0.38, 1.35)
        add_rock(
            target,
            f"Lake shore stone {index + 1:02d}",
            (x, rng.uniform(-0.05, 0.36), z),
            (scale * rng.uniform(1.2, 2.1), scale * rng.uniform(0.5, 1.0), scale * rng.uniform(0.9, 1.8)),
            19201 + index,
            WET_ROCK if index % 3 == 0 else MOSS_ROCK,
        )
    join_collection(target, "Madagin irregular lake basin v1.9")
    return target


def build_waterfall() -> bpy.types.Collection:
    target = collection("Waterfall cliff geology")
    rng = random.Random(19301)
    stone_index = 0
    for row in range(8):
        for side in (-1, 1):
            for column in range(4):
                stone_index += 1
                distance = 1.35 + column * 1.18 + rng.uniform(-0.18, 0.22)
                scale = rng.uniform(0.28, 0.64) * (0.86 + row * 0.035)
                add_rock(
                    target,
                    f"Waterfall interlocked basalt {stone_index:02d}",
                    (
                        4.8 + side * distance,
                        0.38 + row * 1.12 + rng.uniform(-0.22, 0.2),
                        -80.5 + rng.uniform(-0.38, 0.28),
                    ),
                    (
                        scale * rng.uniform(1.0, 1.55),
                        scale * rng.uniform(0.62, 1.08),
                        scale * rng.uniform(0.78, 1.32),
                    ),
                    19301 + stone_index,
                    WET_ROCK if column < 2 else MOSS_ROCK,
                )
    for index in range(7):
        angle = (index / 7) * math.tau + 0.2
        add_rock(
            target,
            f"Plunge pool stone {index + 1:02d}",
            (4.8 + math.cos(angle) * 4.8, 0.0, -75.9 + math.sin(angle) * 3.2),
            (0.55 + rng.random() * 0.75, 0.28 + rng.random() * 0.42, 0.48 + rng.random() * 0.62),
            19401 + index,
            WET_ROCK,
        )
    join_collection(target, "Madagin integrated waterfall cliff v1.9")
    return target


def build_summit() -> bpy.types.Collection:
    target = collection("Summit peak ring")
    peaks = (
        (-138, -430, 58, 38, 30),
        (-84, -475, 70, 42, 34),
        (-20, -442, 54, 34, 29),
        (46, -488, 68, 41, 31),
        (108, -438, 58, 37, 30),
        (164, -535, 78, 48, 38),
        (-178, -560, 82, 52, 42),
    )
    for index, (x, z, height, radius_x, radius_z) in enumerate(peaks):
        add_peak(target, f"Summit surrounding peak {index + 1:02d}", (x, -5.0, z), radius_x, radius_z, height, 19500 + index)
        if index < 6:
            direction = 1 if index % 2 else -1
            add_peak(
                target,
                f"Summit shoulder {index + 1:02d}",
                (x + direction * radius_x * 0.5, -5.0, z - radius_z * 0.14),
                radius_x * 0.48,
                radius_z * 0.54,
                height * (0.44 + (index % 3) * 0.06),
                19550 + index,
            )
    join_collection(target, "Madagin summit peak ring v1.9")
    return target


def build_tropical_tree() -> bpy.types.Collection:
    target = collection("Tropical hero tree")
    bark = material("Hero tree bark", (0.24, 0.16, 0.095, 1.0), 1.0)
    leaves = material("Hero tree foliage", (0.085, 0.28, 0.14, 1.0), 0.94)
    bpy.ops.mesh.primitive_cone_add(
        vertices=9,
        radius1=0.34,
        radius2=0.17,
        depth=5.1,
        location=(0.0, 0.0, 2.55),
    )
    trunk = bpy.context.object
    trunk.name = "Tropical hero trunk"
    move_to_collection(trunk, target)
    trunk.data.materials.append(bark)
    branch_specs = (
        ((0.0, 0.0, 2.7), (1.35, 0.28, 4.55), 0.14),
        ((0.0, 0.0, 3.0), (-1.18, -0.44, 4.75), 0.13),
        ((0.0, 0.0, 3.5), (0.56, -1.18, 5.15), 0.12),
        ((0.0, 0.0, 3.65), (-0.42, 1.03, 5.28), 0.11),
        ((0.0, 0.0, 4.0), (0.1, 0.04, 5.75), 0.12),
    )
    for index, (start, end, radius) in enumerate(branch_specs):
        branch = add_branch(target, f"Tropical hero branch {index + 1:02d}", start, end, radius)
        branch.data.materials.clear()
        branch.data.materials.append(bark)
    crowns = (
        (1.35, 0.28, 4.75, 1.5, 1.1, 0.95),
        (-1.18, -0.44, 4.95, 1.48, 1.05, 0.92),
        (0.56, -1.18, 5.3, 1.42, 1.12, 0.92),
        (-0.42, 1.03, 5.42, 1.36, 1.08, 0.9),
        (0.08, 0.0, 5.92, 1.68, 1.3, 1.08),
        (0.38, 0.44, 5.16, 1.32, 1.05, 0.92),
    )
    for index, (x, y, z, sx, sy, sz) in enumerate(crowns):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1.0, location=(x, y, z))
        crown = bpy.context.object
        crown.name = f"Tropical hero crown {index + 1:02d}"
        move_to_collection(crown, target)
        crown.scale = (sx, sy, sz)
        crown.data.materials.append(leaves)
        for polygon in crown.data.polygons:
            polygon.use_smooth = True
    join_collection(target, "Madagin tropical broadleaf tree v1.9")
    return target


def export_collection(target: bpy.types.Collection, filename: str) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in target.objects:
        obj.select_set(True)
    if target.objects:
        bpy.context.view_layer.objects.active = target.objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(EXPORT_DIR / filename),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_yup=True,
    )


def main() -> None:
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    reset_scene()
    zones = (
        (build_ridge(), "madagin-ridge-geology-v1.9.glb"),
        (build_valley(), "madagin-valley-peaks-v1.9.glb"),
        (build_lake(), "madagin-lake-basin-v1.9.glb"),
        (build_waterfall(), "madagin-waterfall-cliff-v1.9.glb"),
        (build_summit(), "madagin-summit-peaks-v1.9.glb"),
        (build_tropical_tree(), "madagin-tropical-tree-v1.9.glb"),
    )
    bpy.context.scene["madagin_version"] = "v1.9"
    bpy.context.scene["runtime_contract"] = "Bounded zone geology; browser owns ecology, atmosphere, and water"
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_PATH))
    for target, filename in zones:
        export_collection(target, filename)
    print("MADAGIN_V19_EXPORTS")
    for _, filename in zones:
        path = EXPORT_DIR / filename
        print(filename, path.stat().st_size)


if __name__ == "__main__":
    main()
