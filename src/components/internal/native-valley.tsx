"use client";

import {Suspense, useEffect, useMemo} from "react";
import type {BufferGeometry} from "three";
import field from "./native-valley-field.json";
import {RootedTrees} from "./rooted-trees";

export const NATIVE_VALLEY = {version:field.version, sourceGridMeters:field.sourceGridMeters, width:field.width, depth:field.depth, collarMeters:field.collarMeters, verticalTranslation:field.verticalTranslation};
const smooth=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};

export function nativeValleyWeight(x:number,z:number) {
  return smooth((x-field.x0)/field.collarMeters)*smooth((field.x0+field.width-x)/field.collarMeters)
    *smooth((z-field.z0)/field.collarMeters)*smooth((field.z0+field.depth-z)/field.collarMeters);
}

export function nativeValleyElevation(x:number,z:number) {
  const u=Math.max(0,Math.min(field.columns-1.000001,(x-field.x0)/field.sourceGridMeters[0]));
  const v=Math.max(0,Math.min(field.rows-1.000001,(z-field.z0)/field.sourceGridMeters[1]));
  const ix=Math.floor(u),iz=Math.floor(v),fx=u-ix,fz=v-iz,i=iz*field.columns+ix;
  const h=field.elevations;
  return (h[i]*(1-fx)+h[i+1]*fx)*(1-fz)+(h[i+field.columns]*(1-fx)+h[i+field.columns+1]*fx)*fz+field.verticalTranslation;
}

// This replaces the full height inside a bounded geographic window. It never
// adds a residual relief field, scales elevation, or introduces a second shell.
export function applyNativeValley(geometry:BufferGeometry) {
  if(geometry.userData.nativeValley)return geometry;
  const p=geometry.getAttribute("position");let changed=0,maxDelta=0;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),weight=nativeValleyWeight(x,z);if(weight===0)continue;
    const y=p.getY(i),next=y+(nativeValleyElevation(x,z)-y)*weight;
    p.setY(i,next);changed++;maxDelta=Math.max(maxDelta,Math.abs(next-y));
  }
  p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData.nativeValley={...NATIVE_VALLEY,changedVertices:changed,maxDelta,sourceInteriorPreserved:true,authoredBoundaryCollar:true};
  return geometry;
}

// Index actual rendered triangles in small horizontal bins. Root and slope
// sampling therefore share the mesh's diagonal and LOD, not a nearby DEM cell.
export function nativeValleySampler(geometry:BufferGeometry) {
  const p=geometry.getAttribute("position"),index=geometry.getIndex(),bins=new Map<string,number[]>(),cell=12;
  const idx=(i:number)=>index?index.getX(i):i;
  for(let offset=0;offset<(index?.count??p.count);offset+=3){
    const ids=[idx(offset),idx(offset+1),idx(offset+2)];
    const xs=ids.map(i=>p.getX(i)),zs=ids.map(i=>p.getZ(i));
    const x0=Math.max(field.x0,Math.min(...xs)),x1=Math.min(field.x0+field.width,Math.max(...xs));
    const z0=Math.max(field.z0,Math.min(...zs)),z1=Math.min(field.z0+field.depth,Math.max(...zs));
    if(x0>x1||z0>z1)continue;
    for(let z=Math.floor(z0/cell);z<=Math.floor(z1/cell);z++)for(let x=Math.floor(x0/cell);x<=Math.floor(x1/cell);x++){
      const key=`${x},${z}`,bucket=bins.get(key)??[];bucket.push(offset);bins.set(key,bucket);
    }
  }
  return (x:number,z:number)=>{
    let height=-Infinity;
    for(const offset of bins.get(`${Math.floor(x/cell)},${Math.floor(z/cell)}`)??[]){
      const a=idx(offset),b=idx(offset+1),c=idx(offset+2);
      const ax=p.getX(a),az=p.getZ(a),bx=p.getX(b),bz=p.getZ(b),cx=p.getX(c),cz=p.getZ(c);
      const d=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(d)<1e-9)continue;
      const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/d,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/d;
      if(u>=-1e-6&&v>=-1e-6&&u+v<=1.000001)height=Math.max(height,u*p.getY(a)+v*p.getY(b)+(1-u-v)*p.getY(c));
    }
    return height;
  };
}

export function createNativeValleyPlants(geometry:BufferGeometry,compact:boolean) {
  const sample=nativeValleySampler(geometry),plants:number[][]=[];
  let seed=910012;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const step=compact?18:12;
  for(let z=field.z0+6;z<field.z0+field.depth-6;z+=step)for(let x=field.x0+6;x<field.x0+field.width-6;x+=step){
    const px=x+(random()-.5)*step*.86,pz=z+(random()-.5)*step*.86,y=sample(px,pz);
    if(!Number.isFinite(y)||y<-1||nativeValleyWeight(px,pz)<.01)continue;
    const gx=(sample(px+1,pz)-sample(px-1,pz))/2,gz=(sample(px,pz+1)-sample(px,pz-1))/2;
    const slope=Math.hypot(gx,gz);if(!Number.isFinite(slope)||slope>1.1)continue;
    const cover=.6+.28*Math.sin(px*.027+Math.sin(pz*.019)*2)*Math.sin(pz*.022);
    if(random()>cover*(1-smooth((slope-.55)/.65)))continue;
    const layer=random()<.27?0:1,scale=(.68+random()*.35)*(1-slope*.12);
    // Ground the trunk footprint against this profile's rendered triangles.
    const roots=Array.from({length:9},(_,i)=>sample(px+(i?Math.cos(i*Math.PI/4)*.32:0),pz+(i?Math.sin(i*Math.PI/4)*.32:0)));
    if(!roots.every(Number.isFinite)||Math.max(...roots)-Math.min(...roots)>.48)continue;
    plants.push([0,layer,px,Math.min(...roots)-.06,pz,random()*Math.PI*2,1,scale,1,random(),0,0]);
  }
  return plants;
}

export function NativeValleyPlants({geometry,compact=false,shadows}:{geometry:BufferGeometry|null;compact?:boolean;shadows:boolean}) {
  const plants=useMemo(()=>geometry?createNativeValleyPlants(geometry,compact):[],[compact,geometry]);
  useEffect(()=>{
    if(!geometry)return;
    document.documentElement.dataset.madaginNativeValley=JSON.stringify({...geometry.userData.nativeValley,...NATIVE_VALLEY,compact,plants:plants.length,triangleGrounded:true});
    return ()=>{delete document.documentElement.dataset.madaginNativeValley;};
  },[compact,geometry,plants.length]);
  // Tree assets can arrive after the source terrain. Keep their suspension local
  // so streaming foliage never hides the already-visible ground or coast.
  return plants.length?<Suspense fallback={null}><RootedTrees placements={plants} zone="native-valley" shadows={shadows} compact={compact}/></Suspense>:null;
}
