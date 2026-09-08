"use client";

import {useFrame, useLoader} from "@react-three/fiber";
import {useEffect, useLayoutEffect, useMemo, useRef} from "react";
import {Box3, Color, DoubleSide, FileLoader, InstancedMesh, Material, Mesh, MeshStandardMaterial, Object3D} from "three";
import {nativeCliffWeight} from "./native-cliff";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";

type Crown = [x:number,y:number,z:number,rotation:number,height:number,width:number];
type Part = {variant:number;geometry:Mesh["geometry"];materials:Material[];height:number;update:(time:number)=>void};

function CrownBatch({part,placements}:{part:Part;placements:Crown[]}) {
  const ref=useRef<InstancedMesh>(null);
  useFrame(({clock})=>part.update(clock.elapsedTime));
  useLayoutEffect(()=>{
    const mesh=ref.current;if(!mesh)return;
    const object=new Object3D(), color=new Color();
    placements.forEach((c,i)=>{
      const scale=c[4]/part.height;
      object.position.set(c[0],c[1],c[2]);object.rotation.set(0,c[3],0);
      object.scale.set(scale*c[5],scale,scale*(.9+c[5]*.1));object.updateMatrix();
      mesh.setMatrixAt(i,object.matrix);
      color.setHSL(.25+(i%7)*.006,.10+(i%5)*.015,.74+(i%9)*.012);
      mesh.setColorAt(i,color);
    });
    mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    mesh.computeBoundingSphere();
  },[part,placements]);
  return <instancedMesh ref={ref} args={[part.geometry,part.materials.length === 1 ? part.materials[0] : part.materials,placements.length]} receiveShadow={false} castShadow={false} />;
}

export function RidgeCanopy() {
  const gltf=useLoader(GLTFLoader,"/world/canopy-v1/vegetation-mid.glb",loader=>loader.setMeshoptDecoder(MeshoptDecoder));
  const raw=useLoader(FileLoader,"/world/ridge-canopy-v1/canopy.json") as unknown as string;
  const placements=useMemo(()=>{
    const all=JSON.parse(typeof raw==="string"?raw:new TextDecoder().decode(raw as unknown as ArrayBuffer)) as Crown[];
    return all.filter(p=>nativeCliffWeight(p[0],p[2])===0);
  },[raw]);
  const parts=useMemo(()=>[14,15,4,6].flatMap((index,variant)=>{
    const group=gltf.scene.getObjectByName(`mid_variant_${String(index).padStart(2,"0")}`);
    if(!group)throw new Error("Licensed canopy variant missing");
    group.updateWorldMatrix(true,true);
    const box=new Box3().setFromObject(group), height=box.max.y-box.min.y;
    const meshes:Mesh[]=[];group.traverse(child=>{if(child instanceof Mesh)meshes.push(child);});
    let rootX=0,rootZ=0,roots=0;
    const geometries=meshes.map(mesh=>mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
    geometries.forEach(geometry=>{const position=geometry.getAttribute("position");
      for(let i=0;i<position.count;i++)if(position.getY(i)<box.min.y+.15){rootX+=position.getX(i);rootZ+=position.getZ(i);roots++;}
    });
    return meshes.map((mesh,meshIndex)=>{
    const geometry=geometries[meshIndex];
    geometry.translate(-rootX/Math.max(roots,1),-box.min.y,-rootZ/Math.max(roots,1));
    const time={value:0};
    const materials=(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(source=>{
      const material=(source as MeshStandardMaterial).clone();
      material.color.set("#ffffff");material.roughness=.88;material.metalness=0;
      material.side=DoubleSide;material.alphaTest=.42;material.transparent=false;material.depthWrite=true;
      material.envMapIntensity=.5;
      material.onBeforeCompile=shader=>{
        shader.uniforms.uCanopyTime=time;
        shader.vertexShader=`uniform float uCanopyTime;\n${shader.vertexShader}`
          .replace("#include <begin_vertex>",`#include <begin_vertex>
            vec3 crownRoot=vec3(instanceMatrix[3]);
            float crownFlex=smoothstep(1.5,${height.toFixed(3)},position.y);
            transformed.x+=sin(uCanopyTime*.72+crownRoot.x*.019+crownRoot.z*.023)*crownFlex*.085;
            transformed.z+=sin(uCanopyTime*.51+crownRoot.z*.031)*crownFlex*.045;
          `);
      };
      material.customProgramCacheKey=()=>`source-ridge-canopy-${index}`;
      return material;
    });
    return {variant,geometry,materials,height,update:(value:number)=>{time.value=value;}};
    });
  }),[gltf.scene]);
  useEffect(()=>()=>parts.forEach(p=>{p.geometry.dispose();p.materials.forEach(m=>m.dispose());}),[parts]);
  useEffect(()=>{
    document.documentElement.dataset.madaginRidgeCanopy=JSON.stringify({id:"madagin-ridge-canopy-v1",count:placements.length,parts:parts.length,source:"canopy-v1",terrain:"retained-eroded-ridge"});
    return ()=>{delete document.documentElement.dataset.madaginRidgeCanopy;};
  },[parts,placements]);
  const groups=useMemo(()=>parts.map(part=>placements.filter((_,i)=>i%4===part.variant)),[parts,placements]);
  return <group name="Source-grounded ridge secondary canopy">{parts.map((part,i)=><CrownBatch key={i} part={part} placements={groups[i]} />)}</group>;
}
