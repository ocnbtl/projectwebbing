import type {BufferGeometry} from "three";
import {useSyncExternalStore} from "react";

export const VALLEY_HOLLOWS_VERSION="valley-hollows-1";
const smooth=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
type Profile="desktop"|"compact";
const samplers=new Map<Profile,(x:number,z:number)=>number>();
const preparedSamplers=new Map<Profile,(x:number,z:number)=>number>();
const listeners=new Set<()=>void>();let revision=0;
const subscribe=(listener:()=>void)=>{listeners.add(listener);return ()=>{listeners.delete(listener);};};
const snapshot=()=>revision;
export const useValleyGrounding=()=>useSyncExternalStore(subscribe,snapshot,()=>0);

// Publish only from a committed terrain's layout effect. Notifying subscribers
// while a Suspense render is constructing terrain can restart that render in a
// loop, especially when cached compact assets resolve together.
export function publishValleyGrounding(profile:Profile) {
  const prepared=preparedSamplers.get(profile);
  if(!prepared||prepared===samplers.get(profile))return;
  samplers.set(profile,prepared);revision++;listeners.forEach(listener=>listener());
}

export function valleyGroundOffset(x:number,z:number,compact=false) {
  return samplers.get(compact?"compact":"desktop")?.(x,z)??valleyHollowOffset(x,z);
}

function registerGrounding(geometry:BufferGeometry,offsets:Float32Array,profile:Profile) {
  const p=geometry.getAttribute("position"),index=geometry.index,cell=16,bins=new Map<string,number[]>(),triangles:number[]=[];
  const at=(i:number)=>index?index.getX(i):i;
  for(let i=0;i<(index?.count??p.count);i+=3){
    const ids=[at(i),at(i+1),at(i+2)];if(ids.every(j=>offsets[j]===0))continue;
    const start=triangles.length,xs=ids.map(j=>p.getX(j)),zs=ids.map(j=>p.getZ(j));
    ids.forEach(j=>triangles.push(p.getX(j),p.getZ(j),offsets[j]));
    for(let z=Math.floor(Math.min(...zs)/cell);z<=Math.floor(Math.max(...zs)/cell);z++)for(let x=Math.floor(Math.min(...xs)/cell);x<=Math.floor(Math.max(...xs)/cell);x++){
      const key=`${x},${z}`,bucket=bins.get(key)??[];bucket.push(start);bins.set(key,bucket);
    }
  }
  const data=new Float32Array(triangles);
  preparedSamplers.set(profile,(x,z)=>{
    for(const i of bins.get(`${Math.floor(x/cell)},${Math.floor(z/cell)}`)??[]){
      const ax=data[i],az=data[i+1],bx=data[i+3],bz=data[i+4],cx=data[i+6],cz=data[i+7];
      const d=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(d)<1e-9)continue;
      const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/d,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/d;
      if(u>=-1e-6&&v>=-1e-6&&u+v<=1.000001)return u*data[i+2]+v*data[i+5]+(1-u-v)*data[i+8];
    }
    return 0;
  });
  geometry.userData.valleyHollows.groundingTriangles=data.length/9;
  geometry.userData.valleyHollows.groundingBytes=data.byteLength;
}

// Authored drainage architecture on the eastern shoulder. Three unequal heads
// converge into two broad hollows, leaving connected retaining spurs between
// them. This changes the active surface, not its texture or a cover mesh.
export function valleyHollowOffset(x:number,z:number) {
  if(x<=290||x>=770||z<=-930||z>=-365)return 0;
  const boundary=smooth((x-290)/75)*smooth((770-x)/90)
    *smooth((z+930)/65)*smooth((-365-z)/65);
  // The whole waterfall/source bank and its plunge-pool collar stay outside
  // the incision, as do the lake and main river (both west of this window).
  const wetProtection=smooth((Math.hypot((x-170)/150,(z+714)/145)-1.05)/.55);
  const t=(x-290)/480;
  const hollow=(axis:number,width:number,depth:number)=>{
    const cross=Math.abs(z-axis)/width;
    return cross<1?depth*(1-cross*cross)**2:0;
  };
  const main=-555-155*t+35*t*t;
  const second=-760-47*t-24*t*t;
  const branch=main-110*smooth((t-.26)/.65);
  // Broad concave profiles express landform scale; no periodic ridge noise.
  const incision=Math.max(hollow(main,49+24*t,38),hollow(branch,31+16*t,29),hollow(second,42+19*t,32));
  return -incision*boundary*wetProtection;
}

export function applyValleyHollows(geometry:BufferGeometry,profile?:Profile) {
  if(geometry.userData.valleyHollows)return geometry;
  const p=geometry.getAttribute("position"),offsets=new Float32Array(p.count);let changed=0,maxIncision=0;
  for(let i=0;i<p.count;i++){
    const offset=valleyHollowOffset(p.getX(i),p.getZ(i));
    if(offset===0)continue;
    const previous=p.getY(i);p.setY(i,previous+offset);offsets[i]=p.getY(i)-previous;changed++;maxIncision=Math.max(maxIncision,-offset);
  }
  p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData.valleyHollows={version:VALLEY_HOLLOWS_VERSION,changed,maxIncision,addedTriangles:0,waterAndSeamsProtected:true};
  if(profile)registerGrounding(geometry,offsets,profile);
  return geometry;
}
