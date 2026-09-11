import {BufferGeometry, Float32BufferAttribute, Vector3} from "three";

// Branch-scale growth derived from the licensed crown's occupied volume. Each
// spray has paired, creased blades along a short axis, not camera-facing cards.
// Trunks/branches and the root transform remain the accepted source geometry.
export function createBranchSprays(source: BufferGeometry) {
  const position = source.getAttribute("position"), index = source.getIndex();
  if (!index) throw new Error("Branch sprays require connected source leaves");
  const parent = Uint32Array.from({length: position.count}, (_, i) => i);
  const root = (i: number): number => {while (parent[i] !== i) {parent[i] = parent[parent[i]]; i = parent[i];} return i;};
  for (let i = 0; i < index.count; i += 3) {parent[root(index.getX(i + 1))] = root(index.getX(i)); parent[root(index.getX(i + 2))] = root(index.getX(i));}
  const components = new Map<number, Set<number>>();
  for (let i = 0; i < position.count; i++) {const k = root(i), group = components.get(k) ?? new Set<number>(); group.add(i); components.set(k, group);}
  const cells = new Map<string, {center: Vector3; count: number}>(), cellSize = .065;
  for (const vertices of components.values()) {
    const center = new Vector3(); for (const i of vertices) center.add(new Vector3().fromBufferAttribute(position, i)); center.divideScalar(vertices.size);
    const key = [center.x, center.y, center.z].map(v => Math.floor(v / cellSize)).join(",");
    const cell = cells.get(key) ?? {center: new Vector3(), count: 0}; cell.center.add(center); cell.count++; cells.set(key, cell);
  }
  for (const cell of cells.values()) cell.center.divideScalar(cell.count);
  const positions: number[] = [], uvs: number[] = [], colors: number[] = [], faces: number[] = [];
  const crown = source.boundingBox?.clone(); if (!crown) source.computeBoundingBox();
  const bounds = crown ?? source.boundingBox!;
  let seed = 713; const random = () => {seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296;};
  for (const cell of cells.values()) {
    const center = cell.center, yaw = random() * Math.PI * 2;
    const axis = new Vector3(Math.cos(yaw), .18 + random() * .2, Math.sin(yaw)).normalize();
    const side = new Vector3(-axis.z, 0, axis.x), up = new Vector3().crossVectors(side, axis).normalize();
    if (up.y < 0) up.negate();
    const density = Math.min(1, cell.count / 10), length = .041 + .013 * density;
    const height = (center.y - bounds.min.y) / Math.max(.001, bounds.max.y - bounds.min.y);
    const shade = .64 + .36 * Math.sqrt(Math.max(0, height));
    for (let pair = 0; pair < 3; pair++) for (const sign of [-1, 1]) {
      const base = center.clone().addScaledVector(axis, (pair - 1) * length * .6);
      const direction = side.clone().multiplyScalar(sign).addScaledVector(axis, .25 + pair * .18).normalize();
      const cross = new Vector3().crossVectors(up, direction).normalize();
      const bladeLength = length * (.85 + random() * .3), width = bladeLength * .4;
      // A shallow fold preserves a coherent top surface and a softer edge.
      const middle = base.clone().addScaledVector(direction, bladeLength * .52).addScaledVector(up, bladeLength * .1);
      const tip = base.clone().addScaledVector(direction, bladeLength).addScaledVector(up, -bladeLength * .14);
      const left = middle.clone().addScaledVector(cross, width).addScaledVector(up, -width * .14);
      const right = middle.clone().addScaledVector(cross, -width).addScaledVector(up, -width * .14);
      const offset = positions.length / 3;
      for (const p of [base, left, middle, right, tip]) {positions.push(p.x, p.y, p.z); colors.push(shade, shade, shade);}
      // Atlas leaf 1: preserve the existing source map and its alpha silhouette.
      uvs.push(.11, .49, .015, .77, .1, .77, .2, .77, .1, .98);
      faces.push(offset, offset + 2, offset + 1, offset, offset + 3, offset + 2, offset + 1, offset + 2, offset + 4, offset + 2, offset + 3, offset + 4);
    }
  }
  const result = new BufferGeometry();
  result.setAttribute("position", new Float32BufferAttribute(positions, 3));
  result.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  result.setAttribute("color", new Float32BufferAttribute(colors, 3));
  result.setIndex(faces); result.computeVertexNormals(); result.computeBoundingBox(); result.computeBoundingSphere();
  result.userData.branchSprays = {version: "branch-sprays-1", sourceLeaves: components.size, sprays: cells.size, blades: cells.size * 6, triangles: faces.length / 3, cellSize, sourceBounds: [bounds.min.toArray(), bounds.max.toArray()], bounds: [result.boundingBox!.min.toArray(), result.boundingBox!.max.toArray()]};
  return result;
}
