import bpy
import sys


def linked_image_names(socket):
    if socket is None:
        return []
    names = []
    for link in socket.links:
        node = link.from_node
        if node.type == "TEX_IMAGE" and node.image:
            names.append(node.image.name)
    return names


source = sys.argv[-1]
bpy.ops.import_scene.gltf(filepath=source)

for material in sorted(bpy.data.materials, key=lambda item: item.name.lower()):
    principled = next(
        (node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"),
        None,
    ) if material.use_nodes and material.node_tree else None
    base_color = linked_image_names(principled.inputs.get("Base Color") if principled else None)
    alpha = linked_image_names(principled.inputs.get("Alpha") if principled else None)
    normal = linked_image_names(principled.inputs.get("Normal") if principled else None)
    print(
        "MATERIAL",
        material.name,
        f"surface={material.surface_render_method}",
        f"base={base_color}",
        f"alpha={alpha}",
        f"normal={normal}",
    )

for obj in sorted((item for item in bpy.data.objects if item.type == "MESH"), key=lambda item: item.name):
    slots = [slot.material.name if slot.material else "<none>" for slot in obj.material_slots]
    attributes = [(attribute.name, attribute.data_type, attribute.domain) for attribute in obj.data.attributes]
    counts = {index: 0 for index in range(len(slots))}
    for polygon in obj.data.polygons:
        counts[polygon.material_index] = counts.get(polygon.material_index, 0) + 1
    largest = sorted(
        ((polygon.area, polygon.material_index, polygon.index) for polygon in obj.data.polygons),
        reverse=True,
    )[:3]
    coordinates = [vertex.co for vertex in obj.data.vertices]
    bounds = tuple((round(min(coordinate[axis] for coordinate in coordinates), 3), round(max(coordinate[axis] for coordinate in coordinates), 3)) for axis in range(3)) if coordinates else ()
    print("MESH", obj.name, f"location={tuple(round(value, 3) for value in obj.location)}", f"bounds={bounds}", f"verts={len(obj.data.vertices)}", f"polys={len(obj.data.polygons)}", f"dimensions={tuple(round(value, 3) for value in obj.dimensions)}", f"slots={slots}", f"slot_polys={counts}", f"largest_faces={[(round(area, 3), slot, index) for area, slot, index in largest]}", f"attributes={attributes}")
