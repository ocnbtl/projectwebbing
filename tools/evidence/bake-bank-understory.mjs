import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
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

const {normalizeRiparianPlant}=await compile('fixture-plant-geometry',await fs.readFile('src/components/internal/riparian-plant-geometry.ts','utf8'));
const {plungeDistance}=await import(pathToFileURL(path.join(out,'fixture-plunge.mjs')).href);
const {lakeBoundaryDistance}=await import(pathToFileURL(path.join(out,'fixture-lake-shore.mjs')).href);
const doc=await io.read('public/world/canopy-v1/fern.glb'),forms=[];
for(const node of doc.getRoot().listNodes().filter(n=>n.getMesh())){
 const primitive=node.getMesh().listPrimitives()[0],g=new BufferGeometry(),a=primitive.getAttribute('POSITION');
 g.setAttribute('position',new BufferAttribute(a.getArray(),3));g.setIndex(new BufferAttribute(primitive.getIndices().getArray(),1));
 forms.push({family:node.getName(),geometry:normalizeRiparianPlant(g,new Matrix4().fromArray(node.getWorldMatrix()))});
}
const {JOURNEY_CHECKPOINTS}=await compile('fixture-world-manifest',await fs.readFile('src/lib/world-manifest.ts','utf8'));
const paths=[false,true].map(compact=>new CatmullRomCurve3(JOURNEY_CHECKPOINTS.map(p=>new Vector3().fromArray(compact?p.mobileCamera:p.camera)),false,'centripetal').getPoints(1000));
const canopy=JSON.parse(await fs.readFile('src/components/internal/bank-canopy-placements.json'));
const existing=JSON.parse(await fs.readFile('src/components/internal/riparian-placements.json'));
const oldBank=JSON.parse(await fs.readFile('src/components/internal/groundcover-bank-placements.json'));
const rocks=JSON.parse(await fs.readFile('src/components/internal/channel-rock-placements.json'));
const result={version:'bank-understory-1',desktop:{ferns:[],saplings:[]},compact:{ferns:[],saplings:[]}},cases=[];
for(const compact of [false,true]){
 const key=compact?'compact':'desktop',valleySource=await sourceMesh(compact,'valley'),ridge=compact?null:await sourceMesh(false,'ridge'),alpine=compact?null:await sourceMesh(false,'alpine');
 const valley=runtime.createIntegratedWatershedTerrainGeometry(valleySource,compact?[]:runtime.extractTerrainSeamSamples(alpine,-980),compact?[]:runtime.extractTerrainSeamSamples(ridge,-315),compact?2:1,compact?0:1,compact?[]:runtime.extractTerrainSeamSamples(ridge,-287),compact?0:2);
 const sample=sampler(valley),outflow=runtime.outflowTerrainSampler(),records=[],rejected={};
 let seed=291031;const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
 const layout=[];
 for(const [cluster,parent]of canopy[key].entries())for(let i=0;i<18;i++){
  const angle=random()*Math.PI*2,radius=1.4+Math.sqrt(random())*5.3,kind=i<3?'sapling':'fern';
  layout.push({cluster,kind,x:parent[2]+Math.cos(angle)*radius,z:parent[4]+Math.sin(angle)*radius,yaw:random()*Math.PI*2,height:kind==='fern'?.85+random()*.95:2.95+random()*1.25,tint:.83+random()*.14,family:forms[Math.floor(random()*forms.length)].family,order:random()});
 }
 layout.sort((a,b)=>a.order-b.order);
 const chosen=result[key],fernBudget=compact?440:820,treeBudget=compact?80:160;
 const reject=reason=>rejected[reason]=(rejected[reason]??0)+1;
 for(const p of layout){
  if(p.kind==='fern'?chosen.ferns.length>=fernBudget:chosen.saplings.length>=treeBudget)continue;
  const radius=p.kind==='fern'?.2:.28,roots=Array.from({length:9},(_,i)=>sample(p.x+(i?Math.cos(i*Math.PI/4)*radius:0),p.z+(i?Math.sin(i*Math.PI/4)*radius:0)));
  const y=Math.min(...roots)-.055,flow=outflow(p.x,p.z);
  if(!roots.every(Number.isFinite)||Math.max(...roots)-Math.min(...roots)>.7||plungeDistance(p.x,p.z)<1.15||Math.abs(p.x-runtime.v116RiverCenter(p.z))<runtime.v116RiverHalfWidth(p.z)+4||(lakeBoundaryDistance(p.x,p.z)<1.08&&y< -40)||(flow&&flow.distance<flow.width+3)||rocks[key].some(r=>Math.hypot(p.x-r.x,p.z-r.z)<r.size*.55+1)){reject('wet, rock or steep support');continue;}
  if([...canopy[key],...existing[key].saplings,...chosen.saplings].some(q=>Math.hypot(p.x-q[2],p.z-q[4])<(p.kind==='fern'?.8:1.6))){reject('stem separation');continue;}
  if([...chosen.ferns,...existing[key].ferns,...(compact?[]:oldBank.ferns)].some(q=>Math.hypot(p.x-q.x,p.z-q.z)<1.05)){reject('fern separation');continue;}
  const bound=p.height*(p.kind==='fern'?1.5:1.12),center=new Vector3(p.x,y+p.height*.5,p.z),clearance=Math.min(...paths[Number(compact)].map(v=>v.distanceTo(center)-bound));
  if(clearance<4){reject('camera envelope');continue;}
  if(p.kind==='fern'){
   const form=forms.find(f=>f.family===p.family),pos=form.geometry.getAttribute('position'),cos=Math.cos(p.yaw),sin=Math.sin(p.yaw);let exposed=0,wet=false;
   for(let i=0;i<pos.count;i++){
    const x=p.x+(pos.getX(i)*cos+pos.getZ(i)*sin)*p.height,z=p.z+(-pos.getX(i)*sin+pos.getZ(i)*cos)*p.height,ground=sample(x,z);
    if(y+pos.getY(i)*p.height>ground+.01)exposed++;
    if(!Number.isFinite(ground)||plungeDistance(x,z)<1.02||Math.abs(x-runtime.v116RiverCenter(z))<runtime.v116RiverHalfWidth(z)+.3)wet=true;
   }
   if(wet||exposed/pos.count<.65){reject('wet or buried fronds');continue;}
   chosen.ferns.push({family:p.family,x:p.x,y,z:p.z,yaw:p.yaw,height:p.height,tint:p.tint});
   records.push({kind:p.kind,cluster:p.cluster,x:p.x,y,z:p.z,height:p.height,exposure:exposed/pos.count,rootGap:y-Math.min(...roots),cameraClearance:clearance,triangles:form.geometry.index.count/3});
  }else{
   chosen.saplings.push([0,2,p.x,y+.025,p.z,p.yaw,1,p.height/5.3,1,p.tint]);
   records.push({kind:p.kind,cluster:p.cluster,x:p.x,y,z:p.z,height:p.height,rootGap:y-Math.min(...roots),cameraClearance:clearance});
  }
 }
 assert.equal(chosen.ferns.length,fernBudget);assert.equal(chosen.saplings.length,treeBudget);
 cases.push({compact,ferns:chosen.ferns.length,saplings:chosen.saplings.length,fernTriangles:records.reduce((s,x)=>s+(x.triangles??0),0),maxRootGap:Math.max(...records.map(x=>x.rootGap)),minFernExposure:Math.min(...records.filter(x=>x.kind==='fern').map(x=>x.exposure)),minCameraClearance:Math.min(...records.map(x=>x.cameraClearance)),records,rejected});
 valley.dispose();console.log(JSON.stringify({...cases.at(-1),records:undefined}));
}
await fs.writeFile(path.join(outputSource,'src/components/internal/bank-understory-placements.json'),JSON.stringify(result)+'\n');
await fs.writeFile(path.join(out,'understory-grounding.json'),JSON.stringify({passed:true,version:result.version,method:'Deterministic groups tied to actual canopy anchors; exact desktop/compact Valley triangles, nine buried root supports, wet/collision exclusions, minimum 65 percent exposed fern vertices, 1001 public camera-curve samples with four-metre clearance. Existing source geometry and wind retained; no native-species claim.',sourceFiles:['public/world/canopy-v1/fern.glb','public/world/leaf-canopy-v1/tree-0-far.glb','public/world/leaf-canopy-v1/tree-1-far.glb'],cases},null,2)+'\n');

// Fit the full rendered trunk footprint after the conservative placement grid.
execFileSync(process.execPath,[fileURLToPath(new URL('./verify-bank-understory.mjs',import.meta.url)),'--fit'],{stdio:'inherit'});
