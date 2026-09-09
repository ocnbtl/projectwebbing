// Exercise the actual preparation function with the released packed GLB attributes.
import fs from 'node:fs/promises';import path from 'node:path';import {pathToFileURL} from 'node:url';import {createRequire} from 'node:module';import assert from 'node:assert/strict';
import ts from 'typescript';import {BufferGeometry,BufferAttribute,Mesh,MeshStandardMaterial,Group,Box3} from 'three';
const out=path.resolve('output/releases/madagin-leaf-lighting-20260909');
const require=createRequire(path.resolve('output/releases/madagin-canopy-20260906/pipeline/package.json'));
const {NodeIO}=require('@gltf-transform/core');const {ALL_EXTENSIONS}=require('@gltf-transform/extensions');const {MeshoptDecoder}=require('meshoptimizer');await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
await fs.writeFile(path.join(out,'compact-tree-lod.mjs'),ts.transpileModule(await fs.readFile('src/components/internal/compact-tree-lod.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
const code=(await fs.readFile('src/components/internal/rooted-trees.tsx','utf8')).replace('./compact-tree-lod','./compact-tree-lod.mjs');
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
 const near=await scene(`public/world/rooted-trees-v1/tree-${variant}-near.glb`),far=await scene(`public/world/leaf-canopy-v1/tree-${variant}-far.glb`);
 assert.equal(near.packed,3);const source=new Box3().setFromObject(near.group);
 for(const compact of [false,true]){
  const parts=prepareTrees(compact?far.group:near.group,far.group,compact),bounds=new Box3();
  parts.filter(p=>compact||!p.far).forEach(p=>{assert.ok(p.geometry.getAttribute('position').array instanceof Float32Array);p.geometry.computeBoundingBox();bounds.union(p.geometry.boundingBox);assert.equal(p.material.emissiveIntensity,0);});
  let radius=0; for(const part of parts.filter(p=>compact||!p.far)){const a=part.geometry.getAttribute('position');for(let i=0;i<a.count;i++)radius=Math.max(radius,Math.hypot(a.getX(i)*1.1,a.getY(i)-.5,a.getZ(i)*1.06));} radius+=.035;
  const height=bounds.max.y-bounds.min.y;assert.ok(Math.abs(height-1)<.002);assert.ok(Math.abs(bounds.min.y)<.002);
  cases.push({variant,compact,sourceWorldHeight:source.max.y-source.min.y,normalizedHeight:height,rootY:bounds.min.y,envelopeRadius:radius,decodedBeforeTransformation:true,passed:true});
  parts.forEach(p=>{p.geometry.dispose();p.material.dispose();p.depth.dispose();});
 }
}
const provenance=JSON.parse(await fs.readFile('public/world/rooted-trees-v1/provenance.json'));
for(const asset of provenance.assets){const leaves=asset.parts.find(p=>p.leafPolicy);if(asset.lod==='near')assert.equal(leaves.leafPolicy.retainedLeaves,leaves.leafPolicy.sourceLeaves);}
await fs.writeFile(path.join(out,'tree-geometry-checks.json'),JSON.stringify({cases,nearLeavesRetained:true,scope:'Coordinate conversion and geometry invariants; not a visual realism assertion.'},null,2));

const {execFileSync}=await import('node:child_process');
const {createHash}=await import('node:crypto');
const baseline='1601a7a09b3bc7ecf57a53ee3a92915ac25f2a6d';
const read=async p=>(await fs.readFile(p,'utf8')).replaceAll('\r\n','\n');
const git=p=>execFileSync('git',['show',`${baseline}:${p}`],{maxBuffer:12e6});
const tree=await read('src/components/internal/rooted-trees.tsx');
const restored=tree.replace('`/world/${lod==="far"?"leaf-canopy-v1":"rooted-trees-v1"}/tree-${i}-${lod}.glb`','`/world/rooted-trees-v1/tree-${i}-${lod}.glb`').replace('leafCoverage:"leaf-coverage-1",','');
assert.equal(restored,git('src/components/internal/rooted-trees.tsx').toString().replaceAll('\r\n','\n'));
const retained=['ridge-production-v116.tsx','riparian-ecology.tsx','riparian-placements.json','bank-canopy-placements.json','groundcover-bank.ts','groundcover-bank-placements.json','riparian-plant-geometry.ts','compact-tree-lod.ts','native-cliff.tsx','ridge-headwater.ts','lake-shore.ts','plunge-basin.ts','channel-rocks.tsx','channel-rock-placements.json','world-lab.tsx'];
for(const name of retained){const p='src/components/internal/'+name;assert.equal(await read(p),git(p).toString().replaceAll('\r\n','\n'),name);}
const current=JSON.parse(await read('public/world/leaf-canopy-v1/provenance.json'));
const assets=[];
for(const asset of current.assets){
 const file='public/world/leaf-canopy-v1/'+asset.file,bytes=await fs.readFile(file),doc=await io.read(file);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
 const previous=provenance.assets.find(a=>a.file===asset.file);
 let triangles=0,leaves=0;
 for(const mesh of doc.getRoot().listMeshes())for(const primitive of mesh.listPrimitives()){
  const material=primitive.getMaterial().getName(),part=asset.parts.find(p=>p.material===material);
  assert.equal(primitive.getIndices().getCount()/3,part.triangles);triangles+=part.triangles;
  if(part.leafPolicy){
   assert.equal(part.leafPolicy.retainedLeaves,Math.ceil(part.leafPolicy.sourceLeaves/3));
   const index=primitive.getIndices().getArray(),count=primitive.getAttribute('POSITION').getCount();
   const parent=Uint32Array.from({length:count},(_,i)=>i);
   const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
   for(let i=0;i<index.length;i+=3){parent[root(index[i+1])]=root(index[i]);parent[root(index[i+2])]=root(index[i]);}
   leaves=new Set(Array.from(index,root)).size;
   assert.equal(leaves,part.leafPolicy.retainedLeaves);
  }else assert.equal(part.triangles,previous.parts.find(p=>p.material===material).triangles);
 }
 for(const input of asset.inputs)assert.equal(createHash('sha256').update(await fs.readFile(input.path)).digest('hex'),input.sha256);
 for(const texture of asset.textures){const p=path.posix.normalize('public/world/leaf-canopy-v1/'+texture.path);assert.equal(createHash('sha256').update(await fs.readFile(p)).digest('hex'),texture.sha256);assert.ok((await fs.readFile(p)).equals(git(p)));}
 assets.push({path:file,sha256:asset.sha256,bytes:bytes.length,previousBytes:previous.bytes,triangles,leaves,sourceLeaves:asset.parts.find(p=>p.leafPolicy).leafPolicy.sourceLeaves,passed:true});
}
for(const asset of provenance.assets){const p='public/world/rooted-trees-v1/'+asset.file;assert.ok((await fs.readFile(p)).equals(git(p)));}
const maxEnvelope=Math.max(...cases.map(c=>c.envelopeRadius));
const envelope=1.13;assert.ok(maxEnvelope<=envelope);
const {CatmullRomCurve3,Vector3}=await import('three');
const worldFile=path.join(out,'fixture-world-manifest.mjs');
await fs.writeFile(worldFile,ts.transpileModule(await read('src/lib/world-manifest.ts'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
const {JOURNEY_CHECKPOINTS}=await import(pathToFileURL(worldFile).href);
const placements=JSON.parse(await read('src/components/internal/bank-canopy-placements.json'));
const flightClearance=[];
for(const compact of [false,true]){
 const curve=new CatmullRomCurve3(JOURNEY_CHECKPOINTS.map(p=>new Vector3().fromArray(compact?p.mobileCamera:p.camera)),false,'centripetal').getPoints(1000);
 let minimum=Infinity;
 for(const p of placements[compact?'compact':'desktop']){
  const height=(p[1]===0?17.5:p[1]===1?10:5.3)*Math.max(.55,Math.min(1.45,p[7]));
  const center=new Vector3(p[2],p[3]-.025+height*.5,p[4]);
  for(const camera of curve)minimum=Math.min(minimum,camera.distanceTo(center)-height*envelope);
 }
 assert.ok(minimum>=4);flightClearance.push({compact,points:curve.length,minClearance:minimum,required:4,passed:true});
}
const report={at:new Date().toISOString(),passed:true,baseline,version:current.version,cases,retained,assets,maxEnvelope,verifiedEnvelope:envelope,flightClearance,rawGlbByteDelta:assets.reduce((sum,a)=>sum+a.bytes-a.previousBytes,0),geometryScope:'Fuller efficient leaves only. Bark triangle count, source transforms/root conversion, placement, cutouts, original lighting, wind/depth, height LOD and source cache policy retained. Root support positions remain exact. Actual fuller-source bounds require a 1.13-height envelope, freshly checked against 1001 camera samples per tier.',originalSourcesAndMapsUntouched:true,limits:'Generic source architecture; no native species or whole-world realism claim. Frame/heap/readiness costs and normal-size visual/motion acceptance are separate.'};
await fs.writeFile(path.join(out,'leaf-lighting-checks.json'),JSON.stringify(report,null,2)+'\n');
await fs.writeFile(path.join(out,'retained-source.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,sourceGeometryCases:cases.length,assets,maxEnvelope,rawGlbByteDelta:report.rawGlbByteDelta}));
