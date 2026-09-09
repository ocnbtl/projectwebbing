import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {BufferGeometry,BufferAttribute,Mesh,Matrix4,CatmullRomCurve3,Vector3} from 'three';
const out=path.resolve('output/releases/madagin-bank-canopy-20260909');
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

const {plungeDistance}=await import(pathToFileURL(path.join(out,'fixture-plunge.mjs')).href);
const {lakeBoundaryDistance}=await import(pathToFileURL(path.join(out,'fixture-lake-shore.mjs')).href);
const {JOURNEY_CHECKPOINTS}=await compile('fixture-world-manifest',await fs.readFile('src/lib/world-manifest.ts','utf8'));
const cameraPaths=[false,true].map(mobile=>new CatmullRomCurve3(JOURNEY_CHECKPOINTS.map(p=>new Vector3().fromArray(mobile?p.mobileCamera:p.camera)),false,'centripetal').getPoints(1000));
const rocks=JSON.parse(await fs.readFile('src/components/internal/channel-rock-placements.json'));
const riparian=JSON.parse(await fs.readFile('src/components/internal/riparian-placements.json'));
const legacy=JSON.parse(await fs.readFile('public/world/v116/ecology-valley-v1.16.json')).instances.filter(p=>p[1]<=2);
// Unequal overlapping lobes follow the bank, leaving the outer slope and water open.
const lobes=[{x:304,z:-636,rx:19,rz:17},{x:300,z:-660,rx:26,rz:25},{x:281,z:-685,rx:28,rz:25},{x:260,z:-708,rx:22,rz:26},{x:266,z:-736,rx:17,rz:14}];
let seed=290925;const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
const layout=[];
for(let i=0;i<2000;i++){
 const l=lobes[i%lobes.length],a=random()*Math.PI*2,r=Math.sqrt(random());
 const x=l.x+Math.cos(a)*r*l.rx,z=l.z+Math.sin(a)*r*l.rz;
 const young=random()<.3,height=young?3.8+random()*3.4:8+random()*6;
 const layer=young?2:1;
 layout.push({x,z,height,layer,yaw:random()*Math.PI*2,tint:.85+random()*.15,cluster:i%lobes.length});
}
const result={version:'bank-canopy-1',desktop:[],compact:[]},cases=[];
for(const compact of [false,true]){
 const key=compact?'compact':'desktop',valleySource=await sourceMesh(compact,'valley');
 const ridge=compact?null:await sourceMesh(false,'ridge'),alpine=compact?null:await sourceMesh(false,'alpine');
 const valley=runtime.createIntegratedWatershedTerrainGeometry(valleySource,compact?[]:runtime.extractTerrainSeamSamples(alpine,-980),compact?[]:runtime.extractTerrainSeamSamples(ridge,-315),compact?2:1,compact?0:1,compact?[]:runtime.extractTerrainSeamSamples(ridge,-287),compact?0:2);
 const sample=sampler(valley),outflow=runtime.outflowTerrainSampler(),records=[],rejected=[];
 for(const p of layout){
  if(result[key].length>=260)break;
  const rootRadius=.4,ground=Array.from({length:9},(_,i)=>sample(p.x+(i?Math.cos(i*Math.PI/4)*rootRadius:0),p.z+(i?Math.sin(i*Math.PI/4)*rootRadius:0)));
  const y=Math.min(...ground)-.055,flow=outflow(p.x,p.z);
  if(!ground.every(Number.isFinite)||Math.max(...ground)-Math.min(...ground)>.9||plungeDistance(p.x,p.z)<1.2||(Math.abs(p.x-runtime.v116RiverCenter(p.z))<runtime.v116RiverHalfWidth(p.z)+5)||(lakeBoundaryDistance(p.x,p.z)<1.08&&y< -40)||(flow&&flow.distance<flow.width+4)||rocks[key].some(r=>Math.hypot(p.x-r.x,p.z-r.z)<r.size*.55+1)) {rejected.push({x:p.x,z:p.z,reason:'support or water/rock margin'});continue;}
  const neighbours=[...legacy,...riparian[key].saplings,...result[key]];
  if(neighbours.some(q=>Math.hypot(p.x-q[2],p.z-q[4])<(p.height<8?2:3.4))){rejected.push({x:p.x,z:p.z,reason:'trunk spacing'});continue;}
  const center=new Vector3(p.x,y+p.height*.5,p.z),radius=p.height*1.12;
  const clearance=Math.min(...cameraPaths[Number(compact)].map(v=>v.distanceTo(center)-radius));
  if(clearance<4){rejected.push({x:p.x,z:p.z,reason:'flight envelope'});continue;}
  result[key].push([0,p.layer,p.x,y+.025,p.z,p.yaw,1,p.height/(p.layer===2?5.3:10),1,p.tint]);
  records.push({...p,y,rootGap:y-Math.min(...ground),rootSlope:Math.max(...ground)-Math.min(...ground),cameraClearance:clearance});
 }
 assert.ok(result[key].length>=180,'Enough connected canopy to evaluate');
 cases.push({compact,count:result[key].length,minHeight:Math.min(...records.map(p=>p.height)),maxHeight:Math.max(...records.map(p=>p.height)),maxRootGap:Math.max(...records.map(p=>p.rootGap)),minCameraClearance:Math.min(...records.map(p=>p.cameraClearance)),records,rejected});
 valley.dispose();console.log(JSON.stringify({...cases.at(-1),records:undefined,rejected:rejected.length}));
}
await fs.writeFile('src/components/internal/bank-canopy-placements.json',JSON.stringify(result,null,2)+'\n');
const provenance=JSON.parse(await fs.readFile('public/world/rooted-trees-v1/provenance.json'));
await fs.writeFile(path.join(out,'canopy-grounding.json'),JSON.stringify({passed:true,version:result.version,lobes,cases,source:provenance.assets.filter(a=>a.lod==='far').map(a=>({file:a.file,sha256:a.sha256,url:a.url,triangles:a.parts.reduce((n,p)=>n+p.triangles,0)})),method:'Five unequal overlapping lobes; actual desktop/compact Valley triangles, nine buried root supports, wet/rock/trunk exclusions, 1001 samples of the actual camera curves with a conservative crown envelope plus 4 m clearance. Existing optimized rooted tree sources and LOD; no new assets or runtime ground sampling.',limits:'Generic tree architecture, not native species reconstruction. Root and flight checks do not establish natural appearance.'},null,2)+'\n');
