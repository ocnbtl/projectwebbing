import {BufferGeometry, Float32BufferAttribute, Matrix4} from "three";

// Shared by the offline terrain fit and the renderer. Remove the source's
// contact-sheet translation, retaining each scanned shape and its proportions.
export function normalizeChannelRock(source: BufferGeometry, sourceMatrix: Matrix4) {
  const geometry = source.clone();
  for (const name of ["position", "normal", "tangent"]) {
    const attribute = geometry.getAttribute(name);
    if (!attribute) continue;
    const values = new Float32Array(attribute.count * attribute.itemSize);
    for (let i = 0; i < attribute.count; i++) {
      for (let c = 0; c < attribute.itemSize; c++) {
        values[i * attribute.itemSize + c] = c === 0 ? attribute.getX(i) : c === 1 ? attribute.getY(i) : c === 2 ? attribute.getZ(i) : attribute.getW(i);
      }
    }
    geometry.setAttribute(name, new Float32BufferAttribute(values, attribute.itemSize));
  }
  geometry.applyMatrix4(sourceMatrix.clone().setPosition(0, 0, 0));
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const diameter = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
  geometry.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  geometry.scale(1 / diameter, 1 / diameter, 1 / diameter);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
