"use client";

import {useFrame, useLoader} from "@react-three/fiber";
import {useEffect, useLayoutEffect, useMemo, useRef} from "react";
import {Box3, Color, DoubleSide, FileLoader, InstancedMesh, Material, Mesh, MeshStandardMaterial, MeshBasicMaterial, Object3D, PlaneGeometry, TextureLoader, SRGBColorSpace} from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";

type Crown = [x:number,y:number,z:number,rotation:number,height:number,width:number,compactY:number];
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

export function CatchmentNearCanopy() {
  const gltf=useLoader(GLTFLoader,"/world/canopy-v1/vegetation-mid.glb",loader=>loader.setMeshoptDecoder(MeshoptDecoder));
  const raw=useLoader(FileLoader,"/world/napali-catchment-v1/canopy-near.json") as unknown as string;
  const placements=useMemo(()=>{
    const all=JSON.parse(typeof raw==="string"?raw:new TextDecoder().decode(raw as unknown as ArrayBuffer)) as Crown[];
    return all;
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
    document.documentElement.dataset.madaginCatchmentCanopy=JSON.stringify({id:"napali-catchment-v1",count:placements.length,parts:parts.length,source:"canopy-v1",terrain:"NOAA-CUDEM"});
    return ()=>{delete document.documentElement.dataset.madaginCatchmentCanopy;};
  },[parts,placements]);
  const groups=useMemo(()=>parts.map(part=>placements.filter((_,i)=>i%4===part.variant)),[parts,placements]);
  return <group name="Source-grounded ridge secondary canopy">{parts.map((part,i)=><CrownBatch key={i} part={part} placements={groups[i]} />)}</group>;
}

function DistantCanopy({compact}:{compact:boolean}) {
  const far=useLoader(FileLoader,"/world/napali-catchment-v1/canopy-far.json") as unknown as string;
  const near=useLoader(FileLoader,"/world/napali-catchment-v1/canopy-near.json") as unknown as string;
  const sourceMap=useLoader(TextureLoader,"/world/napali-catchment-v1/canopy-far.webp");
  const ref=useRef<InstancedMesh>(null);
  const time=useMemo(()=>({value:0}),[]);
  const placements=useMemo(()=>{
    const decode=(raw:string)=>JSON.parse(typeof raw==='string'?raw:new TextDecoder().decode(raw as unknown as ArrayBuffer)) as Crown[];
    return compact?[...decode(far),...decode(near)]:decode(far);
  },[compact,far,near]);
  const resources=useMemo(()=>{
    const geometry=new PlaneGeometry(1.05,1).translate(0,.5,0);
    const map=sourceMap.clone();map.colorSpace=SRGBColorSpace;
    const material=new MeshBasicMaterial({map,alphaTest:.36,side:DoubleSide});
    material.color.setRGB(1.4,1.4,1.4);
    material.onBeforeCompile=shader=>{
      shader.uniforms.uCrownTime=time;
      shader.vertexShader=`uniform float uCrownTime;\n${shader.vertexShader}`.replace('#include <begin_vertex>',`#include <begin_vertex>
        vec3 origin=vec3(instanceMatrix[3]);
        transformed.x+=sin(uCrownTime*.65+origin.x*.01+origin.z*.014)*position.y*position.y*.004;
      `).replace('#include <project_vertex>',`
        vec3 root=vec3(instanceMatrix[3]);
        vec3 direction=normalize(vec3(cameraPosition.x-root.x,0.0,cameraPosition.z-root.z));
        vec3 right=vec3(direction.z,0.0,-direction.x);
        vec3 world=root+right*transformed.x*length(instanceMatrix[0].xyz)+vec3(0.0,transformed.y*length(instanceMatrix[1].xyz),0.0);
        vec4 mvPosition=viewMatrix*vec4(world,1.0);
        gl_Position=projectionMatrix*mvPosition;
      `);
    };
    return {geometry,map,material};
  },[sourceMap,time]);
  useLayoutEffect(()=>{
    if(!ref.current)return;const o=new Object3D(),color=new Color();
    placements.forEach((p,i)=>{
      o.position.set(p[0],compact?p[6]:p[1],p[2]);o.rotation.y=p[3];o.scale.set(p[4]*p[5],p[4],p[4]*p[5]);o.updateMatrix();
      ref.current!.setMatrixAt(i,o.matrix);color.setHSL(.24+(i%8)*.007,.08+(i%3)*.025,.77+(i%11)*.015);ref.current!.setColorAt(i,color);
    });
    ref.current.instanceMatrix.needsUpdate=true;if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;ref.current.computeBoundingSphere();
  },[compact,placements]);
  useFrame(({clock})=>{time.value=clock.elapsedTime});
  useEffect(()=>()=>{resources.geometry.dispose();resources.material.dispose();resources.map.dispose()},[resources]);
  return <instancedMesh ref={ref} args={[resources.geometry,resources.material,placements.length]} name="Terrain-grounded distant canopy" />;
}

export function CatchmentCanopy({compact}:{compact:boolean}) {
  return <group><DistantCanopy compact={compact} />{!compact?<CatchmentNearCanopy />:null}</group>;
}
