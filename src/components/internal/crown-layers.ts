import {BufferGeometry, Float32BufferAttribute, Vector3} from "three";

// Flattened radial branch-end clusters distinguish the second bank-tree family.
// Occupied cells come from the retained crown; this is authored generic foliage,
// not a surveyed species. All wood and planted transforms remain source geometry.
export function createCrownLayers(source: BufferGeometry) {
  const position = source.getAttribute("position"), index = source.getIndex();
  if (!index) throw new Error("Crown layers require connected source foliage");
  const parent = Uint32Array.from({length: position.count}, (_, i) => i);
  const root = (i: number): number => {while (parent[i] !== i) {parent[i] = parent[parent[i]]; i = parent[i];} return i;};
  for (let i = 0; i < index.count; i += 3) {parent[root(index.getX(i + 1))] = root(index.getX(i)); parent[root(index.getX(i + 2))] = root(index.getX(i));}
  const groups = new Map<number, number[]>();
  for (let i = 0; i < position.count; i++) {const key = root(i), group = groups.get(key) ?? []; group.push(i); groups.set(key, group);}
  const cells = new Map<string, {center: Vector3; count: number}>(), cellSize = .062;
  for (const group of groups.values()) {
    const center = new Vector3(); for (const i of group) center.add(new Vector3().fromBufferAttribute(position, i)); center.divideScalar(group.length);
    const key = [center.x, center.y, center.z].map(v => Math.floor(v / cellSize)).join(",");
    const cell = cells.get(key) ?? {center: new Vector3(), count: 0}; cell.center.add(center); cell.count++; cells.set(key, cell);
  }
  const clusters = [...cells.values()]; clusters.forEach(c => c.center.divideScalar(c.count));
  const positions: number[] = [], colors: number[] = [], uvs: number[] = [], faces: number[] = [];
  let seed = 2971; const random = () => {seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296;};
  for (const cell of clusters) {
    // Nearby overlying foliage gives coherent shaded interiors, instead of a
    // uniform height tint. This fixed canopy support is not baked ray-traced AO.
    let over = 0;
    for (const other of clusters) {const dy = other.center.y - cell.center.y; if (dy > .015 && dy < .28) {const r = Math.hypot(other.center.x-cell.center.x, other.center.z-cell.center.z); if (r < .16) over += (1-r/.16)*(1-dy/.28);}}
    const shade = .65 + .35 * Math.exp(-over * .22), yaw = random() * Math.PI * 2;
    const length = .044 + .012 * Math.min(1, cell.count / 12);
    for (let leaf = 0; leaf < 4; leaf++) {
      const angle = yaw + leaf * Math.PI * 2 / 4 + (random()-.5)*.5;
      const direction = new Vector3(Math.cos(angle), .2 + random()*.7, Math.sin(angle)).normalize();
      const side = new Vector3(-direction.z, 0, direction.x), up = new Vector3().crossVectors(side, direction).normalize(); if (up.y < 0) up.negate();
      const base = cell.center.clone().addScaledVector(direction, -.01), size = length * (.82 + random()*.32), width = size*.39;
      const middle = base.clone().addScaledVector(direction, size*.52).addScaledVector(up, size*.08);
      const left = middle.clone().addScaledVector(side, width).addScaledVector(up, -size*.06);
      const right = middle.clone().addScaledVector(side, -width).addScaledVector(up, -size*.06);
      const tip = base.clone().addScaledVector(direction, size).addScaledVector(up, -size*.2);
      const offset = positions.length/3;
      for (const p of [base,left,middle,right,tip]) {positions.push(p.x,p.y,p.z);colors.push(shade,shade,shade);}
      // One intact blade in the retained tree_small_02 atlas; no new texture.
      uvs.push(.69,.47,.63,.431,.624,.47,.63,.513,.565,.47);
      faces.push(offset,offset+1,offset+2,offset,offset+2,offset+3,offset+1,offset+4,offset+2,offset+2,offset+4,offset+3);
    }
  }
  const geometry = new BufferGeometry(); geometry.setAttribute("position",new Float32BufferAttribute(positions,3)); geometry.setAttribute("color",new Float32BufferAttribute(colors,3)); geometry.setAttribute("uv",new Float32BufferAttribute(uvs,2)); geometry.setIndex(faces);
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.userData.crownLayers = {version:"crown-layers-1",sourceLeaves:groups.size,clusters:clusters.length,blades:clusters.length*4,triangles:faces.length/3,cellSize,bounds:[geometry.boundingBox!.min.toArray(),geometry.boundingBox!.max.toArray()]};
  return geometry;
}
