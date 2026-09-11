// Exercise the actual preparation function with the released packed GLB attributes.
import fs from 'node:fs/promises';import path from 'node:path';import {pathToFileURL} from 'node:url';import {createRequire} from 'node:module';import assert from 'node:assert/strict';
import ts from 'typescript';import {BufferGeometry,BufferAttribute,Mesh,MeshStandardMaterial,Group,Box3} from 'three';
const out=path.resolve(process.env.MADAGIN_CROWN_EVIDENCE ?? 'output/releases/madagin-crown-layers-20260910');
const source=path.resolve(process.env.MADAGIN_BRANCH_SOURCE ?? '.');
const require=createRequire(path.resolve('output/releases/madagin-canopy-20260906/pipeline/package.json'));
const {NodeIO}=require('@gltf-transform/core');const {ALL_EXTENSIONS}=require('@gltf-transform/extensions');const {MeshoptDecoder}=require('meshoptimizer');await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
await fs.writeFile(path.join(out,'compact-tree-lod.mjs'),ts.transpileModule(await fs.readFile(source+'/src/components/internal/compact-tree-lod.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
const code=(await fs.readFile(source+'/src/components/internal/rooted-trees.tsx','utf8')).replace('./compact-tree-lod','./compact-tree-lod.mjs').replace('./branch-sprays','./branch-sprays.mjs').replace('./crown-layers','./crown-layers.mjs').replace('import branchSupport from '+String.fromCharCode(34)+'./branch-canopy-support.json'+String.fromCharCode(34)+';', 'const branchSupport='+await fs.readFile(source+'/src/components/internal/branch-canopy-support.json','utf8')+';');
await fs.writeFile(path.join(out,'branch-sprays.mjs'),ts.transpileModule(await fs.readFile(source+'/src/components/internal/branch-sprays.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
await fs.writeFile(path.join(out,'crown-layers.mjs'),ts.transpileModule(await fs.readFile(source+'/src/components/internal/crown-layers.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
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
const {createHash}=await import('node:crypto');
const {execFileSync}=await import('node:child_process');
const {CatmullRomCurve3,Vector3}=await import('three');
const baseline='fba3790d872d1ac22e9e7daffb2f81f21cd4eddf';
const read=async p=>fs.readFile(path.join(source,p));
const file='public/world/leaf-canopy-v1/tree-1-far.glb',hash=b=>createHash('sha256').update(b).digest('hex');
const bytes=await read(file),asset={file:'tree-1-far.glb',sha256:hash(bytes)};
assert.equal(asset.sha256,hash(execFileSync('git',['show',baseline+':'+file],{maxBuffer:16e6})));
const {group,packed}=await scene(path.join(source,file));assert.equal(packed,3);
const cases=[];
for(const distant of [false,true]){
 const parts=prepareTrees(group,group,true,distant,false,true),bounds=new Box3();let radius=0,baseRadius=0,triangles=0;
 const control=prepareTrees(group,group,true,distant,false,false);
 for(const part of parts){const a=part.geometry.getAttribute('position');part.geometry.computeBoundingBox();bounds.union(part.geometry.boundingBox);triangles+=part.geometry.index.count/3;
  for(let i=0;i<a.count;i++){radius=Math.max(radius,Math.hypot(a.getX(i)*1.1,a.getY(i)-.5,a.getZ(i)*1.06));if(a.getY(i)<.015)baseRadius=Math.max(baseRadius,Math.hypot(a.getX(i)*1.1,a.getZ(i)*1.06));}
  assert.equal(part.material.emissiveIntensity,0);
  if(part.geometry.userData.crownLayers){
   const normals=part.geometry.getAttribute('normal'),color=part.geometry.getAttribute('color');let minNormalY=1,minShade=1,maxShade=0;
   for(let i=0;i<normals.count;i++){minNormalY=Math.min(minNormalY,normals.getY(i));minShade=Math.min(minShade,color.getX(i));maxShade=Math.max(maxShade,color.getX(i));}
   assert.ok(minNormalY>.2,'Leaf front faces must point above their branch surface');assert.ok(maxShade-minShade>.2,'Crown interiors must have nonuniform overhead support');
   assert.equal(part.material.vertexColors,true);assert.ok(part.sprays,'Generated foliage must use a stable distance shape');
   part.geometry.userData.crownLayers.normalAndShade={minNormalY,minShade,maxShade};
  }else{
   const original=control.find(p=>p.material.name===part.material.name);assert.ok(original);
   assert.equal(hash(Buffer.from(part.geometry.index.array.buffer)),hash(Buffer.from(original.geometry.index.array.buffer)));
   for(const name of Object.keys(original.geometry.attributes))assert.equal(hash(Buffer.from(part.geometry.getAttribute(name).array.buffer)),hash(Buffer.from(original.geometry.getAttribute(name).array.buffer)),part.material.name+'/'+name+' remains source wood');
  }
 }
 assert.equal(parts.filter(p=>p.geometry.userData.crownLayers).length,distant?0:1,'No duplicate distant foliage');
 control.forEach(p=>{p.geometry.dispose();p.material.dispose();p.depth.dispose();});
 radius+=.035;assert.ok(Math.abs(bounds.min.y)<.002);assert.ok(distant ? bounds.max.y<=1.02 && bounds.max.y>.9 : bounds.max.y>.9 && bounds.max.y<1.06);
 cases.push({sprays:parts.filter(p=>p.geometry.userData.crownLayers).map(p=>({...p.geometry.userData.crownLayers,positionHash:hash(Buffer.from(p.geometry.getAttribute('position').array.buffer))})),distant,normalizedHeight:bounds.max.y-bounds.min.y,rootY:bounds.min.y,envelopeRadius:radius,baseRadius,triangles,passed:true});
 parts.forEach(p=>{p.geometry.dispose();p.material.dispose();p.depth.dispose();});
}
const worldFile=path.join(out,'fixture-world-manifest.mjs');await fs.writeFile(worldFile,ts.transpileModule((await read('src/lib/world-manifest.ts')).toString(),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
const {JOURNEY_CHECKPOINTS}=await import(pathToFileURL(worldFile).href);
const placements=JSON.parse(await read('src/components/internal/bank-canopy-placements.json')),flightClearance=[];
const envelope=Math.max(...cases.map(c=>c.envelopeRadius));
for(const compact of [false,true]){
 const curve=new CatmullRomCurve3(JOURNEY_CHECKPOINTS.map(p=>new Vector3().fromArray(compact?p.mobileCamera:p.camera)),false,'centripetal').getPoints(1000);let minimum=Infinity,count=0,maxRootRadius=0;
 for(const [index,p] of placements[compact?'compact':'desktop'].entries()){
  const signature=Math.abs(Math.round(p[2]*.73+p[4]*.47+p[9]*31));if(signature%2===0)continue;count++;
  const height=(p[1]===0?17.5:p[1]===1?10:5.3)*Math.max(.55,Math.min(1.45,p[7]));
  const support=JSON.parse(await read('src/components/internal/branch-canopy-support.json'));const embed=0;const center=new Vector3(p[2],p[3]-.025-embed+height*.5,p[4]);for(const camera of curve)minimum=Math.min(minimum,camera.distanceTo(center)-height*envelope);
  maxRootRadius=Math.max(maxRootRadius,height*cases[0].baseRadius);
 }
 assert.ok(minimum>=4);flightClearance.push({compact,changedTrees:count,points:curve.length,minClearance:minimum,maxRootRadius,required:4,passed:true});
}
const retained=['src/lib/world-manifest.ts',...['ridge-production-v116.tsx','riparian-ecology.tsx','bank-canopy-placements.json','native-cliff.tsx','compact-tree-lod.ts','world-lab.tsx','lake-shore.ts'].map(n=>'src/components/internal/'+n)];
for(const p of retained)assert.equal((await read(p)).toString().replaceAll('\r\n','\n'),execFileSync('git',['show',baseline+':'+p],{maxBuffer:12e6}).toString().replaceAll('\r\n','\n'),p);
const report={passed:true,baseline,asset:asset.file,sha256:asset.sha256,cases,flightClearance,retained,addedBytes:0,limits:'Geometry, source provenance and sampled flight clearance only. Visual, motion, root support and cost assessments are separate.'};
await fs.writeFile(path.join(out,'crown-geometry-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
