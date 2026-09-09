import {BufferGeometry, Float32BufferAttribute, Matrix4} from "three";

// A source sheet is not a planted group. Keep one original fern architecture,
// remove its sheet translation, and express its height in metres at placement.
export function normalizeRiparianPlant(source: BufferGeometry, sourceMatrix: Matrix4) {
  const geometry = source.clone();
  for (const name of ["position", "normal", "tangent"]) {
    const attribute = geometry.getAttribute(name);
    if (!attribute) continue;
    const values = new Float32Array(attribute.count * attribute.itemSize);
    for (let i = 0; i < attribute.count; i++) for (let c = 0; c < attribute.itemSize; c++) {
      values[i * attribute.itemSize + c] = c === 0 ? attribute.getX(i) : c === 1 ? attribute.getY(i) : c === 2 ? attribute.getZ(i) : attribute.getW(i);
    }
    geometry.setAttribute(name, new Float32BufferAttribute(values, attribute.itemSize));
  }
  geometry.applyMatrix4(sourceMatrix.clone().setPosition(0, 0, 0));
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!, height = box.max.y - box.min.y;
  // The original forms share a stem origin at x/z zero. Bounding-box centring
  // would move asymmetrical fronds away from that root.
  geometry.translate(0, -box.min.y, 0);
  geometry.scale(1 / height, 1 / height, 1 / height);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
