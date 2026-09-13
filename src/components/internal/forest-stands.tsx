"use client";

import {useEffect,useMemo} from "react";
import type {BufferGeometry} from "three";
import {RootedTrees} from "./rooted-trees";
import {lakeBoundaryDistance,LAKE_WATER_LEVEL} from "./lake-shore";
import {riverCenter,riverHalfWidth,outflowCenter,outflowHalfWidth} from "./channel-profile";
import {ridgeHeadwaterPlantExclusion} from "./ridge-headwater";
import {cascadeWetWeight} from "./cascade-contact";
import {plungeDistance,PLUNGE_POOL_CENTER} from "./plunge-basin";

export const FOREST_STANDS_VERSION="forest-stands-2";
type ForestZone="ridge"|"valley"|"alpine";
const hash=(x:number,z:number,salt=0)=>{const n=Math.sin(x*127.1+z*311.7+salt*73.13)*43758.5453;return n-Math.floor(n);};
const smooth=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
const outflow=Array.from({length:33},(_,i)=>outflowCenter(i/32,PLUNGE_POOL_CENTER));

function inOutflow(x:number,y:number,z:number) {
  if(y>-35||x<20||x>180||z<-775||z>-682)return false;
  return outflow.slice(1).some((b,i)=>{
    const a=outflow[i],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));
    return Math.hypot(x-a.x-dx*t,z-a.z-dz*t)<outflowHalfWidth((i+t)/32)+3;
  });
}

export function forestWetExclusion(x:number,y:number,z:number) {
  return y<LAKE_WATER_LEVEL+.8||lakeBoundaryDistance(x,z)<1.055
    ||(z>-830&&z<-310&&Math.abs(x-riverCenter(z))<riverHalfWidth(z)+3.5)
    ||(plungeDistance(x,z)<1.2&&y<-37)
    ||inOutflow(x,y,z)||cascadeWetWeight(x,z)>.015||ridgeHeadwaterPlantExclusion(x,z);
}

// Deterministic stand cells are intersected with the final rendered triangles.
// No DEM interpolation, second terrain shell, or camera-dependent population.
// Compact keeps the same cell positions and selects fewer of them.
export function createForestStandPlacements(geometry:BufferGeometry,compact:boolean,zone:ForestZone) {
  const p=geometry.getAttribute("position"),index=geometry.index,at=(i:number)=>index?index.getX(i):i;
  const cells=new Map<string,{p:number[];triangle:number[]}>(),top=new Map<string,number>(),step=12;
  for(let i=0;i<(index?.count??p.count);i+=3){
    const a=at(i),b=at(i+1),c=at(i+2);
    const ax=p.getX(a),az=p.getZ(a),ay=p.getY(a),bx=p.getX(b),bz=p.getZ(b),by=p.getY(b),cx=p.getX(c),cz=p.getZ(c),cy=p.getY(c);
    const determinant=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(determinant)<.01)continue;
    const nx=(by-ay)*(cz-az)-(bz-az)*(cy-ay),ny=(bz-az)*(cx-ax)-(bx-ax)*(cz-az),nz=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
    const support=Math.abs(ny)/Math.hypot(nx,ny,nz);
    const x0=Math.max(zone==="alpine"?300:-270,Math.min(ax,bx,cx)),x1=Math.min(zone==="alpine"?900:zone==="valley"?785:630,Math.max(ax,bx,cx));
    const z0=Math.max(zone==="alpine"?-1610:zone==="ridge"?-308:-1020,Math.min(az,bz,cz)),z1=Math.min(zone==="alpine"?-1008:zone==="ridge"?275:-316,Math.max(az,bz,cz));
    if(x0>x1||z0>z1)continue;
    for(let iz=Math.floor(z0/step);iz<=Math.floor(z1/step);iz++)for(let ix=Math.floor(x0/step);ix<=Math.floor(x1/step);ix++){
      const x=(ix+.12+hash(ix,iz,1)*.76)*step,z=(iz+.12+hash(ix,iz,2)*.76)*step;
      const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/determinant,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/determinant;
      if(u<0||v<0||u+v>1)continue;
      const y=u*ay+v*by+(1-u-v)*cy,key=`${ix},${iz}`;
      if((top.get(key)??-Infinity)>=y)continue;
      top.set(key,y);cells.delete(key);
      // A steep or wet upper face must also reject a plantable triangle below
      // it; otherwise layered source faces can bury a root inside the hillside.
      const upland=zone==="alpine"||(zone==="valley"&&x>300);
      if(support<.64||y>(upland?345:190)||forestWetExclusion(x,y,z))continue;
      // Broad irregular groves, with openings on exposed shoulders. This is an
      // authored humid-valley composition, not a Hawaiian species distribution.
      const grove=.62+.22*Math.sin(x*.013+Math.sin(z*.011)*1.8)*Math.sin(z*.016+.7);
      // Uphill groves occupy supported shoulders and drain toes, while steep
      // ribs stay open. Both density and height diminish into the exposed rock.
      const exposure=smooth((y-170)/175);
      const edge=zone==="alpine"?smooth((x-300)/45)*smooth((900-x)/55)*smooth((z+1610)/55)*smooth((-1008-z)/45):1;
      const density=grove*smooth((support-.64)/.22)*(upland?(1-exposure)*edge:(1-smooth((y-100)/110)));
      const rank=hash(ix,iz,3);if(rank>density||(compact&&hash(ix,iz,7)>.66))continue;
      const young=hash(ix,iz,4)<(upland?.44:.26),scale=((young?.55:.8)+hash(ix,iz,5)*.38)*(upland?.85-exposure*.3:1);
      cells.set(key,{p:[0,young?1:0,x,y-.12,z,hash(ix,iz,6)*Math.PI*2,1,scale,1,rank,0,0],triangle:[ax,ay,az,bx,by,bz,cx,cy,cz]});
    }
  }
  const witnesses=[...cells.values()].filter(({p})=>{
    if(zone!=="alpine"&&!(zone==="valley"&&p[2]>300))return true;
    // A flat ledge on a convex rib can pass the triangle slope test. Compare
    // the surrounding 24 m terrain to preserve the exposed crest silhouette.
    const ix=Math.floor(p[2]/step),iz=Math.floor(p[4]/step);
    const neighbors=[[-2,0],[2,0],[0,-2],[0,2],[-2,-2],[2,2],[-2,2],[2,-2]].map(([dx,dz])=>top.get(`${ix+dx},${iz+dz}`)).filter((y):y is number=>y!==undefined);
    if(neighbors.length<4)return false;
    return p[3]+.12-neighbors.reduce((a,b)=>a+b,0)/neighbors.length<3.5;
  });
  return {placements:witnesses.map(v=>v.p),witnesses};
}

export function ForestStands({geometry,compact=false,shadows,zone}:{geometry:BufferGeometry|null;compact?:boolean;shadows:boolean;zone:ForestZone}) {
  const stand=useMemo(()=>geometry?createForestStandPlacements(geometry,compact,zone):null,[compact,geometry,zone]);
  useEffect(()=>{
    if(!stand)return;
    const element=document.documentElement,current=JSON.parse(element.dataset.madaginForestStands??"{}");
    element.dataset.madaginForestStands=JSON.stringify({...current,[zone]:{version:FOREST_STANDS_VERSION,compact,count:stand.placements.length,rootAuthority:"final-rendered-triangles",wetExclusions:true,placementChangedWithCamera:false}});
    return ()=>{const value=JSON.parse(element.dataset.madaginForestStands??"{}");delete value[zone];element.dataset.madaginForestStands=JSON.stringify(value);};
  },[compact,stand,zone]);
  return stand?.placements.length?<RootedTrees placements={stand.placements} zone={`forest-${zone}`} shadows={shadows} compact={compact} grounded/>:null;
}
