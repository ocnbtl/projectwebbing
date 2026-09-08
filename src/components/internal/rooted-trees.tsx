"use client";

import {useFrame, useLoader} from "@react-three/fiber";
import {useEffect, useMemo, useRef} from "react";
import {Box3, Color, DoubleSide, Float32BufferAttribute, FrontSide, Frustum, InstancedMesh, Matrix4, Mesh, MeshDepthMaterial, MeshStandardMaterial, Object3D, RGBADepthPacking, Sphere, Vector3} from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";

// Species labels are deliberately absent: these licensed trees provide generic
// branching architecture, not a measured reconstruction of Hawaiian ecology.
export const ROOTED_TREES = {version:"rooted-trees-1",sources:[0,1].flatMap(i=>["near","far"].map(lod=>`/world/rooted-trees-v1/tree-${i}-${lod}.glb`))};
type Placement = number[];
type Tree = {matrix:Matrix4;root:Vector3;color:Color;height:number};
type Part = {geometry:Mesh["geometry"];material:MeshStandardMaterial;depth:MeshDepthMaterial;update:(time:number)=>void;far:boolean};

function prepareTrees(near:Object3D,far:Object3D,compact=false):Part[] {
  near.updateMatrixWorld(true);far.updateMatrixWorld(true);
  const box=new Box3().setFromObject(near),height=box.max.y-box.min.y;
  const root=new Vector3();let count=0;
  near.traverse(child=>{
    if(!(child instanceof Mesh))return;
    const p=child.geometry.getAttribute("position"),v=new Vector3();
    for(let i=0;i<p.count;i++){
      v.fromBufferAttribute(p,i).applyMatrix4(child.matrixWorld);
      if(v.y<box.min.y+.025){root.add(v);count++;}
    }
  });
  root.divideScalar(Math.max(count,1));root.y=box.min.y;
  return [near,far].flatMap((scene,lod)=>{
    if(compact&&lod===0)return [];
    const parts:Part[]=[];
    scene.traverse(child=>{
      if(!(child instanceof Mesh))return;
      const materials=Array.isArray(child.material)?child.material:[child.material];
      // GLTFLoader separates material primitives into individual child meshes.
      if(materials.length!==1)throw new Error("Rooted tree primitive must have one material");
      const material=(materials[0] as MeshStandardMaterial).clone();
      const leaf=/leaves/.test(material.name),time={value:0};
      const geometry=child.geometry.clone();
      // glTF quantization uses normalized integer attributes. Transforming them
      // in place clamps world coordinates to [-1,1]; decode before baking.
      for(const name of ["position","normal","tangent"]){
        const source=geometry.getAttribute(name);if(!source)continue;
        const values=new Float32Array(source.count*source.itemSize);
        for(let i=0;i<source.count;i++)for(let c=0;c<source.itemSize;c++)values[i*source.itemSize+c]=c===0?source.getX(i):c===1?source.getY(i):c===2?source.getZ(i):source.getW(i);
        geometry.setAttribute(name,new Float32BufferAttribute(values,source.itemSize));
      }
      geometry.applyMatrix4(child.matrixWorld);
      geometry.translate(-root.x,-root.y,-root.z);geometry.scale(1/height,1/height,1/height);
      material.color.set("#ffffff");material.emissive.set("#000000");material.emissiveIntensity=0;
      material.metalness=0;material.roughness=Math.max(.84,material.roughness);
      material.envMapIntensity=.7;material.aoMapIntensity=.65;
      material.side=leaf?DoubleSide:FrontSide;material.alphaTest=leaf?.12:0;material.alphaToCoverage=leaf;
      material.transparent=false;material.depthWrite=true;
      material.onBeforeCompile=shader=>{
        shader.uniforms.uTreeTime=time;
        shader.vertexShader=`uniform float uTreeTime; varying float vTreeDistance;\n${shader.vertexShader}`
          .replace("#include <begin_vertex>",`#include <begin_vertex>
            vec3 treeRoot=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
            float gust=sin(uTreeTime*.66+treeRoot.x*.021+treeRoot.z*.014)
              +.35*sin(uTreeTime*.29-treeRoot.x*.008+treeRoot.z*.019);
            float flex=pow(clamp(position.y,0.,1.),2.);
            transformed.x+=gust*flex*.014;
            transformed.z+=gust*flex*.0048;
            ${leaf?"transformed+=normal*sin(uTreeTime*2.8+position.x*91.+position.z*67.)*flex*.0015;":""}
            vTreeDistance=distance(cameraPosition,treeRoot);
          `);
        shader.fragmentShader=`varying float vTreeDistance;\n${shader.fragmentShader}`
          .replace("#include <alphatest_fragment>",`#include <alphatest_fragment>
            float transition=smoothstep(145.,205.,vTreeDistance);
            float threshold=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
            ${compact?"":"if("+(lod===1?"threshold >= transition":"threshold < transition")+")discard;"}
          `);
      };
      material.customProgramCacheKey=()=>`rooted-tree-${lod}-${leaf}`;
      const depth=new MeshDepthMaterial({depthPacking:RGBADepthPacking,map:material.map,alphaTest:material.alphaTest,side:material.side});
      depth.onBeforeCompile=(shader,renderer)=>{
        material.onBeforeCompile(shader,renderer);
        // The shadow camera must use the same moving geometry, without the
        // viewer-distance LOD mask (cameraPosition here belongs to the light).
        shader.fragmentShader=shader.fragmentShader.replace(/float transition=smoothstep[\s\S]*?discard;/,"");
      };
      depth.customProgramCacheKey=()=>`rooted-tree-depth-${leaf}`;
      parts.push({geometry,material,depth,update:value=>{time.value=value;},far:lod===1});
    });
    const rootedBounds=new Box3();
    parts.forEach(p=>{p.geometry.computeBoundingBox();rootedBounds.union(p.geometry.boundingBox!);});
    if(lod===0&&Math.abs(rootedBounds.max.y-rootedBounds.min.y-1)>.002)throw new Error("Rooted tree lost its source height during coordinate conversion");
    return parts;
  });
}

function TreeBatch({part,trees,shadows,compact}:{part:Part;trees:Tree[];shadows:boolean;compact:boolean}) {
  const ref=useRef<InstancedMesh>(null);
  const culling=useMemo(()=>{
    if(!compact)return null;
    part.geometry.computeBoundingSphere();
    const bounds=part.geometry.boundingSphere!.clone();
    // Bound the complete moving part, not just its root. The normalized wind
    // displacement is below .03; retain crowns crossing the viewport edge.
    bounds.radius+=.03;
    return {frustum:new Frustum(),projection:new Matrix4(),bounds:trees.map(tree=>new Sphere().copy(bounds).applyMatrix4(tree.matrix))};
  },[compact,part.geometry,trees]);
  useFrame(({clock,camera})=>{
    part.update(clock.elapsedTime);
    const mesh=ref.current;if(!mesh)return;
    if(culling)culling.frustum.setFromProjectionMatrix(culling.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    let count=0;
    for(let index=0;index<trees.length;index++){
      const tree=trees[index];
      if(culling&&!culling.frustum.intersectsSphere(culling.bounds[index]))continue;
      const distance=camera.position.distanceTo(tree.root);
      if(!compact&&(part.far?distance<145:distance>205))continue;
      mesh.setMatrixAt(count,tree.matrix);mesh.setColorAt(count,tree.color);count++;
    }
    mesh.count=count;mesh.instanceMatrix.needsUpdate=true;
    if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  });
  return <instancedMesh ref={ref} args={[part.geometry,part.material,trees.length]} customDepthMaterial={part.depth} frustumCulled={false} castShadow={shadows&&!part.far} receiveShadow />;
}

export function RootedTrees({placements,zone,shadows,compact=false,onReady}:{placements:Placement[];zone:string;shadows:boolean;compact?:boolean;onReady?:()=>void}) {
  const scenes=useLoader(GLTFLoader,compact?ROOTED_TREES.sources.filter(url=>url.includes("far")):ROOTED_TREES.sources,loader=>loader.setMeshoptDecoder(MeshoptDecoder));
  const parts=useMemo(()=>compact?[prepareTrees(scenes[0].scene,scenes[0].scene,true),prepareTrees(scenes[1].scene,scenes[1].scene,true)]:[prepareTrees(scenes[0].scene,scenes[1].scene),prepareTrees(scenes[2].scene,scenes[3].scene)],[compact,scenes]);
  const groups=useMemo(()=>{
    const result:Tree[][]=[[],[]];
    placements.forEach(p=>{
      const signature=Math.abs(Math.round(p[2]*.73+p[4]*.47+p[9]*31));
      const variant=signature%2;
      const scale=Math.max(.55,Math.min(1.45,p[7]));
      const height=(zone.startsWith("coastal")?(p[1]===0?8.2:5.8):(p[1]===0?17.5:p[1]===1?10:5.3))*scale*(zone==="alpine"?.7:1);
      const object=new Object3D();object.position.set(p[2],p[3]-.025,p[4]);
      object.rotation.set(0,p[5]+(signature%17)*.19,0);
      const width=.9+(signature%9)*.025;
      object.scale.set(height*width,height,height*(.91+(signature%7)*.025));object.updateMatrix();
      const color=new Color().setHSL(.22+(signature%7)*.005,.06+(signature%5)*.016,.78+(signature%11)*.016);
      result[variant].push({matrix:object.matrix.clone(),root:object.position.clone(),color,height});
    });
    return result;
  },[placements,zone]);
  useEffect(()=>{
    const element=document.documentElement;
    const previous=JSON.parse(element.dataset.madaginRootedTrees??"{}");
    element.dataset.madaginRootedTrees=JSON.stringify({...previous,[zone]:{version:ROOTED_TREES.version,compact,count:placements.length,minHeight:Math.min(...groups.flat().map(t=>t.height)),maxHeight:Math.max(...groups.flat().map(t=>t.height)),sharedRootAndTransform:true}});
    onReady?.();
    return ()=>{const current=JSON.parse(element.dataset.madaginRootedTrees??"{}");delete current[zone];element.dataset.madaginRootedTrees=JSON.stringify(current);};
  },[compact,groups,placements.length,zone,onReady]);
  useEffect(()=>()=>parts.flat().forEach(p=>{p.geometry.dispose();p.material.dispose();p.depth.dispose();}),[parts]);
  return <group name={`Rooted trees ${zone}`}>{parts.flatMap((variant,i)=>variant.map((part,j)=><TreeBatch key={`${i}-${j}`} part={part} trees={groups[i]} shadows={shadows} compact={compact}/>))}</group>;
}
