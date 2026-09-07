// Exercise the actual preparation function with the released packed GLB attributes.
import fs from 'node:fs/promises';import path from 'node:path';import {pathToFileURL} from 'node:url';import {createRequire} from 'node:module';import assert from 'node:assert/strict';
import ts from 'typescript';import {BufferGeometry,BufferAttribute,Mesh,MeshStandardMaterial,Group,Box3} from 'three';
const out=path.resolve('output/releases/madagin-ecology-20260907');
const require=createRequire(path.resolve('output/releases/madagin-canopy-20260906/pipeline/package.json'));
const {NodeIO}=require('@gltf-transform/core');const {ALL_EXTENSIONS}=require('@gltf-transform/extensions');const {MeshoptDecoder}=require('meshoptimizer');await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const code=await fs.readFile('src/components/internal/rooted-trees.tsx','utf8');
const target=path.join(out,'test-preparation.mjs');await fs.writeFile(target,ts.transpileModule(code+'\nexport {prepareTrees};',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText);
const {prepareTrees}=await import(pathToFileURL(target).href);
async function scene(file){
 const doc=await io.read(file),group=new Group();let packed=0;
 for(const node of doc.getRoot().listNodes())if(node.getMesh())for(const p of node.getMesh().listPrimitives()){
  const geometry=new BufferGeometry();
  for(const [semantic,name] of [['POSITION','position'],['NORMAL','normal'],['TANGENT','tangent'],['TEXCOORD_0','uv']]){
   const a=p.getAttribute(semantic);if(!a)continue;
   geometry.setAttribute(name,new BufferAttribute(a.getArray().slice(),a.getElementSize(),a.getNormalized()));
   if(name==='position'&&!(a.getArray() instanceof Float32Array))packed++;
  }
  geometry.setIndex(new BufferAttribute(p.getIndices().getArray().slice(),1));
  const material=new MeshStandardMaterial();material.name=p.getMaterial().getName();
  const mesh=new Mesh(geometry,material);mesh.matrix.fromArray(node.getWorldMatrix());mesh.matrixAutoUpdate=false;group.add(mesh);
 }
 group.updateMatrixWorld(true);return {group,packed};
}
const cases=[];
for(const variant of [0,1]){
 const near=await scene(`public/world/rooted-trees-v1/tree-${variant}-near.glb`),far=await scene(`public/world/rooted-trees-v1/tree-${variant}-far.glb`);
 assert.equal(near.packed,3);const source=new Box3().setFromObject(near.group);
 for(const compact of [false,true]){
  const parts=prepareTrees(compact?far.group:near.group,far.group,compact),bounds=new Box3();
  parts.filter(p=>compact||!p.far).forEach(p=>{assert.ok(p.geometry.getAttribute('position').array instanceof Float32Array);p.geometry.computeBoundingBox();bounds.union(p.geometry.boundingBox);assert.equal(p.material.emissiveIntensity,0);});
  const height=bounds.max.y-bounds.min.y;assert.ok(Math.abs(height-1)<.002);assert.ok(Math.abs(bounds.min.y)<.002);
  cases.push({variant,compact,sourceWorldHeight:source.max.y-source.min.y,normalizedHeight:height,rootY:bounds.min.y,decodedBeforeTransformation:true,passed:true});
  parts.forEach(p=>{p.geometry.dispose();p.material.dispose();p.depth.dispose();});
 }
}
const provenance=JSON.parse(await fs.readFile('public/world/rooted-trees-v1/provenance.json'));
for(const asset of provenance.assets){const leaves=asset.parts.find(p=>p.leafPolicy);if(asset.lod==='near')assert.equal(leaves.leafPolicy.retainedLeaves,leaves.leafPolicy.sourceLeaves);}
await fs.writeFile(path.join(out,'tree-geometry-checks.json'),JSON.stringify({cases,nearLeavesRetained:true,scope:'Coordinate conversion and geometry invariants; not a visual realism assertion.'},null,2));console.log(JSON.stringify({cases:cases.length,passed:true}));
