import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {BufferGeometry,BufferAttribute,Mesh,Matrix4,Vector3,CatmullRomCurve3} from 'three';
const out=path.resolve(process.env.MADAGIN_UNDERSTORY_EVIDENCE??'output/releases/madagin-bank-understory-20260909');
const outputSource=process.env.MADAGIN_UNDERSTORY_SOURCE??'output/releases/madagin-bank-understory-20260909/source';
const require=createRequire(path.resolve('output/releases/madagin-canopy-20260906/pipeline/package.json'));
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS}=require('@gltf-transform/extensions'),{MeshoptDecoder}=require('meshoptimizer');await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const compile=async(name,source)=>{const p=path.join(out,name+'.mjs');await fs.writeFile(p,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText);return import(pathToFileURL(p).href);};
await compile('fixture-lake-shore',await fs.readFile('src/components/internal/lake-shore.ts','utf8'));
await compile('fixture-falling',await fs.readFile('src/components/internal/falling-water.tsx','utf8'));
await compile('fixture-plunge',await fs.readFile('src/components/internal/plunge-basin.ts','utf8'));
await compile('fixture-headwater',await fs.readFile('src/components/internal/ridge-headwater.ts','utf8'));
const field=JSON.parse(await fs.readFile('src/components/internal/native-cliff-field.json'));
let native=(await fs.readFile('src/components/internal/native-cliff.tsx','utf8')).replace('import field from "./native-cliff-field.json";',`const field=${JSON.stringify(field)};`).replace('from "./ridge-headwater"','from "./fixture-headwater.mjs"').replace('import {RootedTrees} from "./rooted-trees";','const RootedTrees=()=>null;');
await compile('fixture-native',native);
const source=await fs.readFile('src/components/internal/ridge-production-v116.tsx','utf8');
const parsed=ts.createSourceFile('fixture.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const fixture=parsed.statements.map(n=>{
 if(!ts.isImportDeclaration(n)||!(n.moduleSpecifier.text.startsWith('.')||n.moduleSpecifier.text.startsWith('@')))return n.getText();
 if(n.importClause?.isTypeOnly)return '';
 if(n.moduleSpecifier.text==='./falling-water')return n.getText().replace('./falling-water','./fixture-falling.mjs');
 if(n.moduleSpecifier.text==='./plunge-basin')return n.getText().replace('./plunge-basin','./fixture-plunge.mjs');
 if(n.moduleSpecifier.text==='./lake-shore')return n.getText().replace('./lake-shore','./fixture-lake-shore.mjs');
 if(n.moduleSpecifier.text==='./ridge-headwater')return n.getText().replace('./ridge-headwater','./fixture-headwater.mjs');
 if(n.moduleSpecifier.text==='./native-cliff')return `import {applyNativeCliff,nativeCliffWeight,NativeCliffPlants} from './fixture-native.mjs';`;
 return [...(n.importClause?.namedBindings?.elements??[])].filter(e=>!e.isTypeOnly).map(e=>`const ${e.name.text}={};`).join('\n');
}).join('\n')+'\nexport {createNativeRidgeSurface,createRidgeErosionTerrainGeometry,geometrySurfaceForMerge,v116RiverCenter,ridgeChannelWidth,createRidgeHeadwaterGeometry,createIntegratedRiverGeometry,outflowTerrainSampler,createWaterfallOutflowGeometry,createIntegratedWatershedTerrainGeometry,createExactBoundaryTerrainSeamBridge,extractTerrainSeamSamples,createIntegratedLakeGeometry,createWaterMaterial,createWaterfallPlungeGeometry,createCumulativeWaterfallGeometry,waterfallOutflowCenter,v116RiverHalfWidth};';
const runtime=await compile('fixture-runtime',fixture);
function sampler(g){
 const p=g.getAttribute('position'),index=g.index,bins=new Map(),cell=12,at=i=>index?index.getX(i):i;
 for(let i=0;i<(index?.count??p.count);i+=3){const ids=[at(i),at(i+1),at(i+2)],xs=ids.map(j=>p.getX(j)),zs=ids.map(j=>p.getZ(j));for(let z=Math.floor(Math.min(...zs)/cell);z<=Math.floor(Math.max(...zs)/cell);z++)for(let x=Math.floor(Math.min(...xs)/cell);x<=Math.floor(Math.max(...xs)/cell);x++){const key=`${x},${z}`,bucket=bins.get(key)??[];bucket.push(i);bins.set(key,bucket);}}
 return (x,z)=>{let y=-Infinity;for(const i of bins.get(`${Math.floor(x/cell)},${Math.floor(z/cell)}`)??[]){const a=at(i),b=at(i+1),c=at(i+2),ax=p.getX(a),az=p.getZ(a),bx=p.getX(b),bz=p.getZ(b),cx=p.getX(c),cz=p.getZ(c),d=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(d)<1e-9)continue;const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/d,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/d;if(u>=-1e-6&&v>=-1e-6&&u+v<=1.000001)y=Math.max(y,u*p.getY(a)+v*p.getY(b)+(1-u-v)*p.getY(c));}return y;};
}
async function sourceMesh(compact,zone) {
 const doc=await io.read(compact?`public/world/v116/terrain-${zone}-v1.16.glb`:'public/world/v115/madagin-ridge-to-valley-high-v1.15.glb');
 const node=doc.getRoot().listNodes().find(n=>compact?n.getMesh():n.getName()===`${zone==="valley"?"TROPICAL_VALLEY":zone==="alpine"?"ALPINE_VALLEY":"RIDGE"}_V115_HIGH`),primitive=node.getMesh().listPrimitives()[0],g=new BufferGeometry();
 for(const [semantic,name] of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']]){const a=primitive.getAttribute(semantic);if(a)g.setAttribute(name,new BufferAttribute(a.getArray(),a.getElementSize()));}
 g.setIndex(new BufferAttribute(primitive.getIndices().getArray(),1));const mesh=new Mesh(g);mesh.matrixWorld=new Matrix4().fromArray(node.getWorldMatrix());return mesh;
}
const {Group,MeshStandardMaterial}=await import('three');
await compile('fixture-compact-tree-lod',await fs.readFile('src/components/internal/compact-tree-lod.ts','utf8'));
let treeSource=await fs.readFile('src/components/internal/rooted-trees.tsx','utf8');
treeSource=treeSource.replace('from "./compact-tree-lod"','from "./fixture-compact-tree-lod.mjs"').replace('import branchSupport from "./branch-canopy-support.json";',`const branchSupport=${await fs.readFile('src/components/internal/branch-canopy-support.json','utf8')};`);
const {prepareTrees}=await compile('fixture-rooted',treeSource+'\nexport {prepareTrees};');
const feet=[];
for(const variant of [0,1]){
 const d=await io.read(`public/world/leaf-canopy-v1/tree-${variant}-far.glb`),group=new Group();
 for(const n of d.getRoot().listNodes())if(n.getMesh())for(const p of n.getMesh().listPrimitives()){
  const g=new BufferGeometry();for(const [semantic,name]of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']]){const a=p.getAttribute(semantic);if(a)g.setAttribute(name,new BufferAttribute(a.getArray().slice(),a.getElementSize(),a.getNormalized()));}
  g.setIndex(new BufferAttribute(p.getIndices().getArray().slice(),1));const m=new MeshStandardMaterial();m.name=p.getMaterial().getName();const mesh=new Mesh(g,m);mesh.matrix.fromArray(n.getWorldMatrix());mesh.matrixAutoUpdate=false;group.add(mesh);
 }
 const parts=prepareTrees(group,group,true),points=[];
 for(const p of parts){if(/leaves/.test(p.material.name))continue;const a=p.geometry.getAttribute('position');for(let i=0;i<a.count;i++)if(a.getY(i)<.005)points.push(new Vector3().fromBufferAttribute(a,i));}
 assert.ok(points.length>2);feet.push(points);
}
const fit=process.argv.includes('--fit');
const placements=JSON.parse(await fs.readFile(path.join(outputSource,'src/components/internal/bank-understory-placements.json'))),cases=[];
for(const compact of [false,true]){
 const key=compact?'compact':'desktop',v=await sourceMesh(compact,'valley'),r=compact?null:await sourceMesh(false,'ridge'),a=compact?null:await sourceMesh(false,'alpine');
 const ground=runtime.createIntegratedWatershedTerrainGeometry(v,compact?[]:runtime.extractTerrainSeamSamples(a,-980),compact?[]:runtime.extractTerrainSeamSamples(r,-315),compact?2:1,compact?0:1,compact?[]:runtime.extractTerrainSeamSamples(r,-287),compact?0:2),sample=sampler(ground),records=[];
 for(const [i,p]of placements[key].saplings.entries()){
  const sig=Math.abs(Math.round(p[2]*.73+p[4]*.47+p[9]*31)),height=5.3*Math.max(.55,Math.min(1.45,p[7]));
  const matrix=new Matrix4().makeRotationY(p[5]+(sig%17)*.19).scale(new Vector3(height*(.9+(sig%9)*.025),height,height*(.91+(sig%7)*.025))).setPosition(p[2],p[3]-.025,p[4]);
  const gaps=feet[sig%2].map(v=>{const q=v.clone().applyMatrix4(matrix);return q.y-sample(q.x,q.z);});
  assert.ok(gaps.every(Number.isFinite));
  const beforeGap=Math.max(...gaps),embedding=fit?Math.ceil(Math.max(0,beforeGap+.03)*1000)/1000:0;
  p[3]-=embedding;
  records.push({i,height,beforeGap,embedding,maxGap:beforeGap-embedding,minGap:Math.min(...gaps)-embedding,feet:gaps.length});
 }
 const maxGap=Math.max(...records.map(x=>x.maxGap));assert.ok(maxGap<=-.029999,`Suspended young root: ${key} ${maxGap}`);
 cases.push({compact,saplings:records.length,maxGap,records});ground.dispose();
}
if(fit)await fs.writeFile(path.join(outputSource,'src/components/internal/bank-understory-placements.json'),JSON.stringify(placements)+'\n');
await fs.writeFile(path.join(out,fit?'understory-source-fitting.json':'understory-source-support.json'),JSON.stringify({passed:true,fit,method:'Actual rendered source base vertices below 0.005 normalized height, with the runtime variant/yaw/nonuniform scale and exact Valley triangle support. All tested points at least 0.03 metres below soil. --fit embeds new saplings using ceil(max(0,gap+0.03)*1000)/1000; a subsequent invocation without --fit independently rechecks the written placements.',cases},null,2));
console.log(JSON.stringify({passed:true,cases:cases.map(({records,...x})=>x)}));

