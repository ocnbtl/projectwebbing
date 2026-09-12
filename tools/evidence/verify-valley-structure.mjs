import fs from 'node:fs/promises';import path from 'node:path';import {pathToFileURL} from 'node:url';import {createRequire} from 'node:module';import assert from 'node:assert/strict';import ts from 'typescript';
import {BufferGeometry,BufferAttribute,Mesh,Matrix4,Box3,Vector3} from 'three';
// Run verify-channel-geometry.mjs first with MADAGIN_CASCADE_EVIDENCE=<root>/geometry.
const root=process.env.MADAGIN_STRUCTURE_EVIDENCE??'output/releases/madagin-valley-structure-20260912',out=root+'/geometry';
const require=createRequire(path.resolve('output/releases/madagin-canopy-20260906/pipeline/package.json'));
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS}=require('@gltf-transform/extensions'),{MeshoptDecoder}=require('meshoptimizer');await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const script=await fs.readFile('tools/evidence/verify-channel-geometry.mjs','utf8');
const helper=script.slice(script.indexOf('function sampler(g)'),script.indexOf('const results=[];'));
await fs.writeFile(out+'/mesh-helpers.mjs',`import {BufferGeometry,BufferAttribute,Mesh,Matrix4} from 'three';\nlet io;export const setIO=value=>io=value;\n${helper}\nexport {sampler,sourceMesh};`);
const {sampler,sourceMesh,setIO}=await import(pathToFileURL(path.resolve(out+'/mesh-helpers.mjs')));setIO(io);
const runtime=await import(pathToFileURL(path.resolve(out+'/fixture-runtime.mjs')));
const code=await fs.readFile(out+'/fixture-runtime.mjs','utf8');assert.ok(code.includes('applyValleyHollows(geometry, groundingProfile);'));
await fs.writeFile(out+'/baseline-runtime.mjs',code.replace('applyValleyHollows(geometry, groundingProfile);',''));
const control=await import(pathToFileURL(path.resolve(out+'/baseline-runtime.mjs')));
const {valleyHollowOffset,valleyGroundOffset,publishValleyGrounding}=await import(pathToFileURL(path.resolve(out+'/fixture-valley-hollows.mjs')));
const report={passed:true,at:new Date().toISOString(),cases:[],crowns:[]};
for(const compact of [false,true]){
 const src=await sourceMesh(compact,'valley'),a=compact?null:await sourceMesh(false,'alpine'),r=compact?null:await sourceMesh(false,'ridge');
 const args=[src,compact?[]:runtime.extractTerrainSeamSamples(a,-980),compact?[]:runtime.extractTerrainSeamSamples(r,-315),compact?2:1,compact?0:1,compact?[]:runtime.extractTerrainSeamSamples(r,-287),compact?0:2,compact?"compact":"desktop"];
 const current=runtime.createIntegratedWatershedTerrainGeometry(...args),base=control.createIntegratedWatershedTerrainGeometry(...args),p=current.getAttribute('position'),b=base.getAttribute('position');
 publishValleyGrounding(compact?'compact':'desktop');
 assert.deepEqual(current.index.array,base.index.array);let changed=0,protectedVertices=0,maxIncision=0;
 for(let i=0;i<p.count;i++){
  assert.equal(p.getX(i),b.getX(i));assert.equal(p.getZ(i),b.getZ(i));const delta=p.getY(i)-b.getY(i);assert.ok(Number.isFinite(delta)&&delta<=.00002);
  const dry=valleyHollowOffset(p.getX(i),p.getZ(i));if(dry===0){assert.equal(delta,0);protectedVertices++;}else if(delta<-.001){changed++;maxIncision=Math.max(maxIncision,-delta);}
 }
 assert.ok(changed>100&&maxIncision>20);
 const sample=sampler(current),before=sampler(base),key=compact?'compact':'desktop',placements=[];
 const core=JSON.parse(await fs.readFile('public/world/v116/ecology-valley-v1.16.json'));placements.push(...core.instances.map(p=>({x:p[2],z:p[4],kind:'core'})));
 for(const file of ['bank-canopy-placements','bank-understory-placements','source-bank-placements','riparian-placements']){
  const data=JSON.parse(await fs.readFile(`src/components/internal/${file}.json`)),group=data[key];
  for(const p of Array.isArray(group)?group:[...(group.saplings??group.trees??[]),...(group.ferns??[]),...(group.rocks??[])])placements.push(Array.isArray(p)?{x:p[2],z:p[4],kind:file}:{...p,kind:file});
 }
 const errors=placements.filter(p=>p.x>275&&p.x<785&&p.z> -945&&p.z< -350).map(p=>({x:p.x,z:p.z,kind:p.kind,error:sample(p.x,p.z)-before(p.x,p.z)-valleyGroundOffset(p.x,p.z,compact)}));
 assert.ok(errors.every(p=>Number.isFinite(p.error)));
 const maximumGroundingDeltaError=Math.max(0,...errors.map(p=>Math.abs(p.error)));
 assert.ok(maximumGroundingDeltaError<.001, `Grounding delta ${maximumGroundingDeltaError}`);
 report.cases.push({compact,changed,protectedVertices,maxIncision,triangles:current.index.count/3,affectedPlacements:errors.length,maximumGroundingDeltaError,errors});
 current.dispose();base.dispose();
}
await fs.writeFile(out+'/branch-crowns.mjs',ts.transpileModule(await fs.readFile('src/components/internal/branch-crowns.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
const {createBranchCrown,selectBranchGrovePlacements}=await import(pathToFileURL(path.resolve(out+'/branch-crowns.mjs')));
for(const variant of [0,1]){
 const crown=createBranchCrown(variant),box=new Box3().setFromObject(crown);let triangles=0;
 crown.traverse(c=>{if(!(c instanceof Mesh))return;const g=c.geometry;triangles+=g.index.count/3;assert.ok(Array.from(g.getAttribute('position').array).every(Number.isFinite));assert.ok(Array.from(g.index.array).every(i=>i<g.getAttribute('position').count));assert.ok(g.userData.branchCrowns.shoots>100);});
 const wood=crown.children.find(c=>c.material.name==='authored-wood').geometry.getAttribute('position'),leaves=crown.children.find(c=>c.material.name==='authored-leaves').geometry.getAttribute('position');
 const centers=[];for(let i=0;i<wood.count;i+=6){const c=new Vector3();for(let j=0;j<6;j++)c.add(new Vector3().fromBufferAttribute(wood,i+j));centers.push(c.multiplyScalar(1/6));}
 let maximumLeafAttachmentError=0;for(let i=1;i<leaves.count;i+=7){const p=new Vector3().fromBufferAttribute(leaves,i);let nearest=Infinity;for(let j=1;j<centers.length;j++){const a=centers[j-1],d=centers[j].clone().sub(a),t=Math.max(0,Math.min(1,p.clone().sub(a).dot(d)/Math.max(1e-12,d.lengthSq())));nearest=Math.min(nearest,p.distanceTo(a.clone().addScaledVector(d,t)));}maximumLeafAttachmentError=Math.max(maximumLeafAttachmentError,nearest);}
 assert.ok(maximumLeafAttachmentError<.00001,'Leaf bases must meet the branch centerline');
 assert.ok(triangles<24000);report.crowns.push({variant,size:box.getSize(new Vector3()).toArray(),triangles,maximumLeafAttachmentError,source:'authored continuous branch and blade geometry'});
}
const input=JSON.parse(await fs.readFile('public/world/v116/ecology-valley-v1.16.json')).instances;
const original=JSON.stringify(input),selected=selectBranchGrovePlacements(input),reverse=selectBranchGrovePlacements([...input].reverse());
assert.equal(JSON.stringify(input),original,'Placement authority must not be mutated');assert.ok(selected.length<input.length&&selected.length>input.length*.15);assert.ok(selected.every(p=>input.includes(p)),'No invented roots');assert.deepEqual(selected,reverse,'Layout must not depend on manifest order');
report.grove={source:input.length,selected:selected.length,originalRootsPreserved:true,manifestOrderIndependent:true};
await fs.writeFile(root+'/structure-geometry.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,cases:report.cases.map(({errors,...r})=>r)}));
