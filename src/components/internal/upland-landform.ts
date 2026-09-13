import {useSyncExternalStore} from "react";
import type {BufferGeometry} from "three";

export const UPLAND_LANDFORM_VERSION="upland-catchments-1";
const smooth=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
export const uplandWeight=(x:number,z:number)=>smooth((x-300)/70)*smooth((900-x)/90)*smooth((z+1610)/90)*smooth((-1008-z)/72);

// Unequal drainage heads converge downslope, retaining long shoulders between
// them. The scale comes from Nāpali landform references, not surveyed geometry.
export function uplandOffset(x:number,z:number) {
  const weight=uplandWeight(x,z);if(!weight)return 0;
  const t=Math.max(0,Math.min(1,(z+1520)/470));
  const trough=(axis:number,width:number,depth:number)=>{
    const q=Math.abs(x-axis)/width;return q<1?depth*(1-q*q)**2:0;
  };
  const west=466-92*t+24*t*t,east=676-57*t-29*t*t;
  const spread=78*(1-smooth(t/.82));
  const drain=Math.max(trough(west,24+39*t,61),trough(west+spread,18+22*t,48),trough(east,31+33*t,74),trough(east+spread*.7,19+19*t,46));
  const saddle=Math.max(0,1-((x-576)/75)**2-((z+1420)/107)**2)**2*32;
  return -Math.min(82,drain+saddle)*weight;
}

type Ground=(x:number,z:number)=>number|null;
const prepared=new Map<boolean,Ground>(),committed=new Map<boolean,Ground>(),listeners=new Set<()=>void>();let revision=0;
const subscribe=(f:()=>void)=>{listeners.add(f);return ()=>{listeners.delete(f);};};
export const useUplandGrounding=()=>useSyncExternalStore(subscribe,()=>revision,()=>0);
export const uplandGroundHeight=(x:number,z:number,compact:boolean)=>committed.get(compact)?.(x,z)??null;
export function publishUplandGrounding(compact:boolean) {
  const ground=prepared.get(compact);if(!ground||committed.get(compact)===ground)return;
  committed.set(compact,ground);revision++;listeners.forEach(f=>f());
}

export function applyUplandLandform(geometry:BufferGeometry,compact:boolean) {
  if(geometry.userData.uplandLandform)return geometry;
  const p=geometry.getAttribute("position"),index=geometry.index,at=(i:number)=>index?index.getX(i):i;
  let changed=0,maxIncision=0;
  for(let i=0;i<p.count;i++){
    const delta=uplandOffset(p.getX(i),p.getZ(i));if(!delta)continue;
    p.setY(i,p.getY(i)+delta);changed++;maxIncision=Math.max(maxIncision,-delta);
  }
  p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  // Ground retained ecology against the uppermost final triangle, including
  // each profile's actual diagonal. Publish only after the terrain commits.
  const bins=new Map<string,number[]>(),cell=24;
  for(let i=0;i<(index?.count??p.count);i+=3){
    const ids=[at(i),at(i+1),at(i+2)],xs=ids.map(j=>p.getX(j)),zs=ids.map(j=>p.getZ(j));
    for(let z=Math.floor(Math.min(...zs)/cell);z<=Math.floor(Math.max(...zs)/cell);z++)for(let x=Math.floor(Math.min(...xs)/cell);x<=Math.floor(Math.max(...xs)/cell);x++){
      const key=`${x},${z}`,bucket=bins.get(key)??[];bucket.push(i);bins.set(key,bucket);
    }
  }
  prepared.set(compact,(x,z)=>{
    let height=-Infinity;
    for(const i of bins.get(`${Math.floor(x/cell)},${Math.floor(z/cell)}`)??[]){
      const a=at(i),b=at(i+1),c=at(i+2),ax=p.getX(a),az=p.getZ(a),bx=p.getX(b),bz=p.getZ(b),cx=p.getX(c),cz=p.getZ(c);
      const d=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(d)<1e-9)continue;
      const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/d,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/d;
      if(u>=-1e-6&&v>=-1e-6&&u+v<=1.000001)height=Math.max(height,u*p.getY(a)+v*p.getY(b)+(1-u-v)*p.getY(c));
    }
    return Number.isFinite(height)?height:null;
  });
  geometry.userData.uplandLandform={version:UPLAND_LANDFORM_VERSION,compact,changed,maxIncision,addedTriangles:0,grounding:"uppermost-final-triangle",boundaryProtected:true};
  return geometry;
}
