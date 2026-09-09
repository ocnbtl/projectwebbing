import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {BufferGeometry,BufferAttribute,Mesh,Matrix4} from 'three';
const out=path.resolve('output/releases/madagin-riparian-ecology-20260909');
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
let seed=93621;const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
const clusters=[{x:126,z:-668,r:12},{x:177,z:-669,r:11},{x:192,z:-702,r:13},{x:135,z:-728,r:12},{x:106,z:-743,r:10}];
for(const [z,side] of [[-598,-1],[-626,-1],[-649,1],[-687,1],[-754,-1],[-783,1]])clusters.push({x:runtime.v116RiverCenter(z)+side*(runtime.v116RiverHalfWidth(z)+10),z,r:11});
const layout=[];
for(const [cluster,c] of clusters.entries())for(let i=0;i<48;i++){
 const a=random()*Math.PI*2,r=Math.sqrt(random())*c.r,kind=i<16?'sapling':'fern';
 layout.push({kind,cluster,x:c.x+Math.cos(a)*r,z:c.z+Math.sin(a)*r,height:kind==='fern'?.65+random()*1.25:6+random()*5,yaw:random()*Math.PI*2,tint:.82+random()*.18,family:forms[Math.floor(random()*forms.length)].family});
}
const rocks=JSON.parse(await fs.readFile('src/components/internal/channel-rock-placements.json'));
const result={version:'riparian-ecology-1',desktop:{ferns:[],saplings:[]},compact:{ferns:[],saplings:[]}},cases=[];
for(const compact of [false,true]){
 const key=compact?'compact':'desktop',valleySource=await sourceMesh(compact,'valley');
 const ridge=compact?null:await sourceMesh(false,'ridge'),alpine=compact?null:await sourceMesh(false,'alpine');
 const valley=runtime.createIntegratedWatershedTerrainGeometry(valleySource,compact?[]:runtime.extractTerrainSeamSamples(alpine,-980),compact?[]:runtime.extractTerrainSeamSamples(ridge,-315),compact?2:1,compact?0:1,compact?[]:runtime.extractTerrainSeamSamples(ridge,-287),compact?0:2);
 const sample=sampler(valley),outflow=runtime.outflowTerrainSampler(),records=[],rejected=[];
 const dry=(x,z,y)=>{
  if(!Number.isFinite(y))return false;
  if(plungeDistance(x,z)<1.12)return false;
  if(z>-800&&z<-550&&Math.abs(x-runtime.v116RiverCenter(z))<runtime.v116RiverHalfWidth(z)+1.2)return false;
  if(lakeBoundaryDistance(x,z)<1.025&&y< -44)return false;
  const flow=outflow(x,z);if(flow&&flow.distance<flow.width+1.3)return false;
  return !rocks[key].some(r=>Math.hypot(x-r.x,z-r.z)<r.size*.51);
 };
 for(const p of layout){
  const y=sample(p.x,p.z),rootRadius=p.kind==='fern'?.25:.48;
  const rootSamples=Array.from({length:9},(_,i)=>sample(p.x+(i?Math.cos(i*Math.PI/4)*rootRadius:0),p.z+(i?Math.sin(i*Math.PI/4)*rootRadius:0)));
  if(!dry(p.x,p.z,y)||!rootSamples.every(Number.isFinite)){rejected.push({kind:p.kind,x:p.x,z:p.z,reason:'wet, rock overlap or missing support'});continue;}
  if(Math.max(...rootSamples)-Math.min(...rootSamples)>.6){rejected.push({kind:p.kind,x:p.x,z:p.z,reason:'steep root support'});continue;}
  const placedY=Math.min(...rootSamples)-.045;
  if(p.kind==='fern'){
   const geometry=forms.find(f=>f.family===p.family).geometry,pos=geometry.getAttribute('position'),cos=Math.cos(p.yaw),sin=Math.sin(p.yaw);
   let exposed=0,dryLeaves=true;
   for(let i=0;i<pos.count;i++){
    const x=p.x+(pos.getX(i)*cos+pos.getZ(i)*sin)*p.height,z=p.z+(-pos.getX(i)*sin+pos.getZ(i)*cos)*p.height;
    const ground=sample(x,z),py=placedY+pos.getY(i)*p.height;
    if(py>ground+.01)exposed++;
    if(!Number.isFinite(ground)||plungeDistance(x,z)<1.01)dryLeaves=false;
   }
   if(exposed/pos.count<.63||!dryLeaves){rejected.push({kind:p.kind,x:p.x,z:p.z,reason:'terrain swallows fronds or pool intrusion'});continue;}
   result[key].ferns.push({family:p.family,x:p.x,y:placedY,z:p.z,yaw:p.yaw,height:p.height,tint:p.tint});
   records.push({kind:p.kind,cluster:p.cluster,x:p.x,z:p.z,y:placedY,exposure:exposed/pos.count,rootGap:placedY-Math.min(...rootSamples),triangles:geometry.index.count/3});
  }else{
   // Existing layer-1 source tree chooses height 10*scale, bounded here.
   const height=p.height;
   result[key].saplings.push([0,1,p.x,placedY+.025,p.z,p.yaw,1,height/10,1,p.tint]);
   records.push({kind:p.kind,cluster:p.cluster,x:p.x,z:p.z,y:placedY,height,rootGap:placedY-Math.min(...rootSamples)});
  }
 }
 assert.ok(result[key].ferns.length>100&&result[key].saplings.length>20);
 cases.push({compact,ferns:result[key].ferns.length,saplings:result[key].saplings.length,fernTriangles:records.reduce((n,r)=>n+(r.triangles??0),0),maxRootGap:Math.max(...records.map(r=>r.rootGap)),minFernExposure:Math.min(...records.filter(r=>r.kind==='fern').map(r=>r.exposure)),rejected,records});
 valley.dispose();console.log(JSON.stringify({...cases.at(-1),records:undefined,rejected:rejected.length}));
}
await fs.writeFile('src/components/internal/riparian-placements.json',JSON.stringify(result,null,2)+'\n');
const manifest=JSON.parse(await fs.readFile('public/world/canopy-v1/manifest.json'));
await fs.writeFile(path.join(out,'plant-grounding.json'),JSON.stringify({passed:true,method:'Exact desktop/compact Valley triangles; nine embedded root samples; wet corridor, pool and rock exclusion; fern exposed-vertex threshold 63 percent. Eleven unequal dry-bank and cliff-foot groups; original source forms and assets intact.',source:manifest.assets.find(a=>a.target==='fern.glb'),cases},null,2)+'\n');
