"use client";

import {useEffect,useLayoutEffect,useMemo,useRef} from "react";
import {BufferGeometry,IcosahedronGeometry,InstancedMesh,Object3D} from "three";
import {lakeBoundaryDistance,LAKE_WATER_LEVEL} from "./lake-shore";
import {useTerrainSurface} from "./terrain-surface";

export const SHORE_RUBBLE_VERSION="shore-rubble-1";
const hash=(x:number,z:number,s=0)=>{const n=Math.sin(x*127.1+z*311.7+s*61.3)*43758.5453;return n-Math.floor(n);};

// A narrow dry littoral collar: independently rooted stones, with gaps between
// groups. Never changes the basin outline, water level, or connected outlet.
export function createShoreRubble(terrain:BufferGeometry,compact:boolean) {
  const p=terrain.getAttribute("position"),index=terrain.index,at=(i:number)=>index?index.getX(i):i,step=2.8;
  const rocks=new Map<string,{x:number;y:number;z:number;size:number;yaw:number;squash:number;ground:number}>(),top=new Map<string,number>();
  for(let i=0;i<(index?.count??p.count);i+=3){
    const a=at(i),b=at(i+1),c=at(i+2),ax=p.getX(a),az=p.getZ(a),bx=p.getX(b),bz=p.getZ(b),cx=p.getX(c),cz=p.getZ(c);
    const x0=Math.max(-190,Math.min(ax,bx,cx)),x1=Math.min(175,Math.max(ax,bx,cx));
    const z0=Math.max(-1010,Math.min(az,bz,cz)),z1=Math.min(-779,Math.max(az,bz,cz));
    if(x0>x1||z0>z1)continue;
    const d=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(d)<.001)continue;
    for(let iz=Math.floor(z0/step);iz<=Math.floor(z1/step);iz++)for(let ix=Math.floor(x0/step);ix<=Math.floor(x1/step);ix++){
      if(hash(ix,iz,1)>(compact?.46:.67))continue;
      const x=(ix+.1+hash(ix,iz,2)*.8)*step,z=(iz+.1+hash(ix,iz,3)*.8)*step,edge=lakeBoundaryDistance(x,z);
      if(edge<1.012||edge>1.22)continue;
      const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/d,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/d;
      if(u<0||v<0||u+v>1)continue;
      const ground=u*p.getY(a)+v*p.getY(b)+(1-u-v)*p.getY(c);
      const key=`${ix},${iz}`;if((top.get(key)??-Infinity)>=ground)continue;top.set(key,ground);rocks.delete(key);
      if(ground<LAKE_WATER_LEVEL+.05||ground>LAKE_WATER_LEVEL+3.2)continue;
      const group=.5+.5*Math.sin(x*.081+Math.sin(z*.073));if(hash(ix,iz,4)>group*.8)continue;
      const size=.42+hash(ix,iz,5)**2*2.15,squash=.48+hash(ix,iz,6)*.28;
      rocks.set(key,{x,z,ground,y:ground-size*squash*.35,size,squash,yaw:hash(ix,iz,7)*Math.PI*2});
    }
  }
  return [...rocks.values()];
}

export function ShoreRubble({terrain,compact=false,shadows}:{terrain:BufferGeometry|null;compact?:boolean;shadows:boolean}) {
  const material=useTerrainSurface(compact),ref=useRef<InstancedMesh>(null);
  const rocks=useMemo(()=>terrain?createShoreRubble(terrain,compact):[],[terrain,compact]);
  const geometry=useMemo(()=>{
    const g=new IcosahedronGeometry(1,1),p=g.getAttribute("position");
    for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=.8+hash(x,z,y)*.28;p.setXYZ(i,x*r,y*r,z*r);}
    g.computeVertexNormals();g.computeBoundingSphere();return g;
  },[]);
  useLayoutEffect(()=>{
    if(!ref.current)return;const object=new Object3D();
    rocks.forEach((rock,i)=>{object.position.set(rock.x,rock.y,rock.z);object.rotation.set(.12,rock.yaw,-.1);object.scale.set(rock.size,rock.size*rock.squash,rock.size*.84);object.updateMatrix();ref.current!.setMatrixAt(i,object.matrix);});
    ref.current.instanceMatrix.needsUpdate=true;ref.current.computeBoundingSphere();
  },[rocks]);
  useEffect(()=>{document.documentElement.dataset.madaginShoreRubble=JSON.stringify({version:SHORE_RUBBLE_VERSION,compact,count:rocks.length,rootAuthority:"rendered-littoral-triangles",basinUnchanged:true});return()=>{geometry.dispose();delete document.documentElement.dataset.madaginShoreRubble;};},[compact,geometry,rocks.length]);
  return rocks.length?<instancedMesh ref={ref} args={[geometry,material,rocks.length]} castShadow={shadows} receiveShadow name="Grounded shoreline rubble groups"/>:null;
}
