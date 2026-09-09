import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {BufferGeometry,BufferAttribute,Mesh,Matrix4} from 'three';
const out=path.resolve('output/releases/madagin-groundcover-bank-20260909');
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
}).join('\n')+'\nexport {createNativeRidgeSurface,createRidgeErosionTerrainGeometry,geometrySurfaceForMerge,v116RiverCenter,ridgeChannelWidth,createRidgeHeadwaterGeometry,createIntegratedRiverGeometry,outflowTerrainSampler,createWaterfallOutflowGeometry,createIntegratedWatershedTerrainGeometry,createExactBoundaryTerrainSeamBridge,extractTerrainSeamSamples,createIntegratedLakeGeometry,createWaterMaterial,createWaterfallPlungeGeometry,createCumulativeWaterfallGeometry,waterfallOutflowCenter,v116RiverHalfWidth,selectContactTrailheadGroundcover,selectRegionalHabitatGroundcover,selectWatershedGroundcover,selectRiparianGroundcover,selectLakeBankSuccession,selectDetailedPlacements,riparianGroundcoverSource,regionalGroundcoverSource,watershedGroundcoverSource,contactTrailheadPlacementRelief};';
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

const {inGroundcoverBank,GROUNDCOVER_BANK}=await compile('fixture-bank',await fs.readFile('src/components/internal/groundcover-bank.ts','utf8'));
const {isPlungeWetPlant}=await import(pathToFileURL(path.join(out,'fixture-plunge.mjs')).href);
const groups=[];
for(const zone of ['valley','lake']){
 const raw=JSON.parse(await fs.readFile(`public/world/v116/ecology-${zone}-v1.16.json`));
 const instances=raw.instances.filter(p=>!isPlungeWetPlant(p[2],p[3],p[4]));
 const detailed=new Set(runtime.selectDetailedPlacements(instances,false,'balanced',zone));
 if(zone==='valley'){
  const contact=runtime.selectContactTrailheadGroundcover(instances,false,'balanced').filter(p=>!detailed.has(p));
  const occupied=new Set([...detailed,...contact]);
  groups.push({id:'contact',placements:contact,source:(p,i)=>runtime.riparianGroundcoverSource(p,i)});
  groups.push({id:'regional',placements:runtime.selectRegionalHabitatGroundcover(instances,false,'balanced',zone).filter(p=>!occupied.has(p)),source:(p,i)=>runtime.regionalGroundcoverSource(p,i,zone)});
 }else{
  const watershed=runtime.selectWatershedGroundcover(instances,false,'balanced').filter(p=>!detailed.has(p));
  const riparian=runtime.selectRiparianGroundcover(instances,false,'balanced').filter(p=>!detailed.has(p));
  const occupied=new Set([...detailed,...watershed,...riparian]);
  groups.push({id:'watershed',placements:watershed,source:runtime.watershedGroundcoverSource});
  groups.push({id:'riparian',placements:[...riparian,...runtime.selectLakeBankSuccession(instances,false,'balanced').filter(p=>!occupied.has(p))],source:runtime.riparianGroundcoverSource});
 }
}
const anchors=new Map(),legacy=[];
for(const group of groups)group.placements.forEach((p,i)=>{
 if(!inGroundcoverBank(p[2],p[4]))return;
 const family=group.source(p,i);legacy.push({group:group.id,family,x:p[2],z:p[4],sourceY:p[3]});
 if(family!=='rock')anchors.set(`${p[2]},${p[4]}`,p);
});
const valleySource=await sourceMesh(false,'valley'),ridge=await sourceMesh(false,'ridge'),alpine=await sourceMesh(false,'alpine');
const valley=runtime.createIntegratedWatershedTerrainGeometry(valleySource,runtime.extractTerrainSeamSamples(alpine,-980),runtime.extractTerrainSeamSamples(ridge,-315),1,1,runtime.extractTerrainSeamSamples(ridge,-287),2);
const sample=sampler(valley),outflow=runtime.outflowTerrainSampler(),rocks=JSON.parse(await fs.readFile('src/components/internal/channel-rock-placements.json')).desktop;
let seed=290917;const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
const ferns=[],records=[],rejected=[];
for(const [cluster,p] of [...anchors.values()].entries())for(let i=0;i<18;i++){
 const angle=random()*Math.PI*2,radius=Math.sqrt(random())*(4+random()*3);
 const x=p[2]+Math.cos(angle)*radius,z=p[4]+Math.sin(angle)*radius,height=.8+random()*1.1,yaw=random()*Math.PI*2,tint=.8+random()*.18;
 const form=forms[Math.floor(random()*forms.length)],pos=form.geometry.getAttribute('position');
 const rootSamples=Array.from({length:9},(_,j)=>sample(x+(j?Math.cos(j*Math.PI/4)*.2:0),z+(j?Math.sin(j*Math.PI/4)*.2:0)));
 const flow=outflow(x,z),y=Math.min(...rootSamples)-.045;
 if(!inGroundcoverBank(x,z)||!rootSamples.every(Number.isFinite)||Math.max(...rootSamples)-Math.min(...rootSamples)>.7||plungeDistance(x,z)<1.12||(z>-800&&z<-550&&Math.abs(x-runtime.v116RiverCenter(z))<runtime.v116RiverHalfWidth(z)+1.2)||(flow&&flow.distance<flow.width+1.3)||rocks.some(r=>Math.hypot(x-r.x,z-r.z)<r.size*.55)||ferns.some(p=>Math.hypot(x-p.x,z-p.z)<1.1)) {rejected.push({x,z,reason:'support, water, overlap or boundary'});continue;}
 let exposed=0;const cos=Math.cos(yaw),sin=Math.sin(yaw);
 for(let j=0;j<pos.count;j++){
  const px=x+(pos.getX(j)*cos+pos.getZ(j)*sin)*height,pz=z+(-pos.getX(j)*sin+pos.getZ(j)*cos)*height;
  if(y+pos.getY(j)*height>sample(px,pz)+.01)exposed++;
 }
 if(exposed/pos.count<.63){rejected.push({x,z,reason:'buried crown'});continue;}
 ferns.push({family:form.family,x,y,z,yaw,height,tint});records.push({cluster,x,y,z,height,rootGap:y-Math.min(...rootSamples),exposure:exposed/pos.count,triangles:form.geometry.index.count/3});
}
assert.ok(ferns.length>50);
const result={version:'groundcover-bank-1',bounds:GROUNDCOVER_BANK,ferns};
await fs.writeFile('src/components/internal/groundcover-bank-placements.json',JSON.stringify(result,null,2)+'\n');
const sourceManifest=JSON.parse(await fs.readFile('public/world/canopy-v1/manifest.json'));
const report={passed:true,version:result.version,bounds:GROUNDCOVER_BANK,anchors:anchors.size,legacy,ferns:ferns.length,triangles:records.reduce((n,r)=>n+r.triangles,0),maxRootGap:Math.max(...records.map(r=>r.rootGap)),minExposure:Math.min(...records.map(r=>r.exposure)),heightRange:[Math.min(...ferns.map(p=>p.height)),Math.max(...ferns.map(p=>p.height))],records,rejected,source:sourceManifest.assets.find(a=>a.target==='fern.glb'),method:'Existing selected desktop low-layer habitat anchors; individual normalized fern forms, nine actual Valley triangle root samples, embedded root and exposed crown checks. Wet, overlapping and out-of-bounds candidates excluded. Rocks and all sources retained; no runtime terrain sampling.'};
await fs.writeFile(path.join(out,'bank-grounding.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,records:undefined,rejected:rejected.length,legacy:legacy.reduce((r,p)=>(r[p.family]=(r[p.family]??0)+1,r),{}),source:undefined}));
