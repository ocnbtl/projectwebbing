import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {BufferGeometry, Float32BufferAttribute} from 'three';
import {createDistantLeaves} from '../../src/components/internal/compact-tree-lod.ts';
const require=createRequire(path.resolve('output/releases/madagin-canopy-20260906/pipeline/package.json'));
const {NodeIO}=require('@gltf-transform/core');
const {ALL_EXTENSIONS}=require('@gltf-transform/extensions');
const {dequantize}=require('@gltf-transform/functions');
const {MeshoptDecoder}=require('meshoptimizer');
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const cases=[];
for(const variant of [0,1]){
 const file=`public/world/rooted-trees-v1/tree-${variant}-far.glb`,before=hash(await fs.readFile(file));
 const doc=await io.read(file);await doc.transform(dequantize());
 for(const primitive of doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).filter(p=>/leaves/.test(p.getMaterial().getName()))){
  const source=new BufferGeometry();
  for(const [semantic,name] of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']]){
   const a=primitive.getAttribute(semantic);if(a)source.setAttribute(name,new Float32BufferAttribute(a.getArray(),a.getElementSize()));
  }
  source.setIndex(Array.from(primitive.getIndices().getArray()));
  const snapshot=hash(Buffer.from(source.getAttribute('position').array.buffer));
  const reduced=createDistantLeaves(source),p=reduced.getAttribute('position'),index=reduced.getIndex();
  assert.equal(hash(Buffer.from(source.getAttribute('position').array.buffer)),snapshot,'Source positions mutated');
  assert.ok(index.count<=source.getIndex().count*.3,'Distant leaf budget exceeded');
  assert.ok(index.count>0&&index.count%3===0);
  for(const attribute of Object.values(reduced.attributes)){
   assert.equal(attribute.count,p.count);assert.ok(Array.from(attribute.array).every(Number.isFinite));
  }
  assert.ok(Array.from(index.array).every(i=>Number.isInteger(i)&&i>=0&&i<p.count));
  // The area of retained triangles must remain nonzero after the derivative.
  let degenerates=0;
  for(let i=0;i<index.count;i+=3){
   const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];
   const v=ids.map(id=>[p.getX(id),p.getY(id),p.getZ(id)]);
   const a=v[1].map((x,c)=>x-v[0][c]),b=v[2].map((x,c)=>x-v[0][c]);
   if(Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])<1e-12)degenerates++;
  }
  assert.equal(degenerates,0,'Degenerate leaf triangle');
  cases.push({file,...reduced.userData.distantLeaves,vertices:p.count,finite:true,validIndices:true,degenerates,sourceUnchanged:true});
  source.dispose();reduced.dispose();
 }
 assert.equal(hash(await fs.readFile(file)),before,'Preserved source file changed');
}
assert.equal(cases.length,2);
const out=path.resolve('output/releases/madagin-canopy-lod-20260908');
await fs.writeFile(path.join(out,'leaf-geometry.json'),JSON.stringify({passed:true,cases},null,2)+'\n');
console.log(JSON.stringify({passed:true,cases}));
