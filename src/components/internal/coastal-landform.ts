import type {BufferAttribute, BufferGeometry, InterleavedBufferAttribute} from "three";

export const COASTAL_LANDFORM_VERSION = "coastal-drainage-1";
const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

export function coastalShoulderHeight(x:number,z:number,outerX:number,ridgeHeight:number,ridgeCrossSlope:number,joinZ:number) {
  const t=Math.max(0,Math.min(1,(x-outerX)/(-310-outerX)));
  const coast=-15.7+Math.sin(z*.029+.4)*2.7+Math.sin(z*.083-.9)*1.15;
  if(x<outerX)return Math.max(-18.5,coast)-smooth((outerX-x)/35)*12;
  const blend=smooth((t-.18)/.82),broad=coast*(1-blend)+ridgeHeight*blend;
  const seam=smooth((x+323)/13);
  const formed=broad*(1-seam)+(ridgeHeight+ridgeCrossSlope*(x+310))*seam;
  const floor=-18.5*(1-smooth(t/.08))-16.35*smooth(t/.08);
  const relief=Math.max(floor,formed+coastalDrainageRelief(x,z,t));
  // The low valley mouth has one shared linear cross-section. Both meshes
  // resolve it exactly despite different cross-shore tessellation. Its fan
  // widens toward the sea instead of leaving a parallel, flat seam collar.
  const mouth=1-smooth(Math.abs(z-joinZ)/(16+48*(1-t)));
  const fan=Math.max(-18.5,coast)*(1-t)+ridgeHeight*t;
  return relief*(1-mouth)+fan*mouth;
}

export function coastalGroundSampler(geometry:BufferGeometry) {
  const p=geometry.getAttribute('position'),index=geometry.index,at=(i:number)=>index?index.getX(i):i;
  const bins=new Map<string,number[]>(),cell=24;
  for(let i=0;i<(index?.count??p.count);i+=3){
    const ids=[at(i),at(i+1),at(i+2)],xs=ids.map(j=>p.getX(j)),zs=ids.map(j=>p.getZ(j));
    if(Math.min(...xs)>-300)continue;
    for(let z=Math.floor(Math.min(...zs)/cell);z<=Math.floor(Math.max(...zs)/cell);z++)for(let x=Math.floor(Math.min(...xs)/cell);x<=Math.floor(Math.max(...xs)/cell);x++){
      const key=`${x},${z}`,bucket=bins.get(key)??[];bucket.push(i);bins.set(key,bucket);
    }
  }
  return (x:number,z:number)=>{
    let y=-Infinity;
    for(const i of bins.get(`${Math.floor(x/cell)},${Math.floor(z/cell)}`)??[]){
      const a=at(i),b=at(i+1),c=at(i+2),ax=p.getX(a),az=p.getZ(a),bx=p.getX(b),bz=p.getZ(b),cx=p.getX(c),cz=p.getZ(c);
      const d=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(d)<1e-9)continue;
      const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/d,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/d;
      if(u>=-1e-6&&v>=-1e-6&&u+v<=1.000001)y=Math.max(y,u*p.getY(a)+v*p.getY(b)+(1-u-v)*p.getY(c));
    }
    return Number.isFinite(y)?y:null;
  };
}

// One world-space drainage field crosses the Ridge/Valley boundary. A span's
// row number must never reset the relief or pull an edge down to a flat profile.
// Unequal tributaries converge toward the sea, leaving connected dividing spurs.
export function coastalDrainageRelief(x: number, z: number, across: number) {
  const t = Math.max(0, Math.min(1, across));
  const envelope = smooth(t / .14) * smooth((1 - t) / .16);
  let incision = 0;
  const hollow = (axis: number, width: number, depth: number) => {
    const q = Math.abs(z - axis) / width;
    return q < 1 ? depth * (1 - q * q) ** 2 : 0;
  };
  for (const [mouth, bend, width, depth] of [
    [-866, 36, 38, 49], [-642, -47, 52, 67], [-431, 28, 39, 54],
    [-188, -35, 49, 76], [25, 43, 35, 58], [213, -24, 42, 46],
  ]) {
    const axis = mouth + bend * t * t;
    const branch = 66 * smooth((t - .28) / .62);
    incision = Math.max(incision, hollow(axis, width * (.7 + .3 * t), depth),
      hollow(axis + branch, width * .58, depth * .72));
  }
  // Smaller oblique ribs sit within the larger drainage structure. They fade
  // at both the wet margin and source-mesh join, preserving those authorities.
  const ribs = Math.sin(z * .021 + x * .014) * 4.2
    + Math.sin(z * .047 - x * .009) * 2.1;
  return (ribs - incision) * envelope;
}

// Jittered roots use the actual grid triangle, not a tangent-plane estimate.
export function coastalRootHeight(p: BufferAttribute | InterleavedBufferAttribute,
  columns: number, row: number, column: number, x: number, z: number) {
  const rows = p.count / (columns + 1) - 1;
  for (let r = Math.max(0, row - 1); r <= Math.min(rows - 1, row + 1); r++) {
    for (let c = Math.max(0, column - 1); c <= Math.min(columns - 1, column + 1); c++) {
      const a = r * (columns + 1) + c, b = a + columns + 1;
      for (const [i, j, k] of [[a, b, a + 1], [a + 1, b, b + 1]]) {
        const ax = p.getX(i), az = p.getZ(i), bx = p.getX(j), bz = p.getZ(j), cx = p.getX(k), cz = p.getZ(k);
        const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        if (Math.abs(d) < 1e-9) continue;
        const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d;
        const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
        if (u >= -1e-6 && v >= -1e-6 && u + v <= 1.000001)
          return u * p.getY(i) + v * p.getY(j) + (1 - u - v) * p.getY(k);
      }
    }
  }
  return null;
}
