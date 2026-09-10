import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {BufferGeometry,BufferAttribute,Mesh,Matrix4} from 'three';
const sourceRoot=path.resolve(process.env.MADAGIN_SOURCE_ROOT??'.');
const out=path.resolve(process.env.MADAGIN_CASCADE_EVIDENCE??'output/releases/madagin-cascade-shape-20260910');
await fs.mkdir(out,{recursive:true});
const require=createRequire(path.resolve('output/releases/madagin-canopy-20260906/pipeline/package.json'));
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS}=require('@gltf-transform/extensions'),{MeshoptDecoder}=require('meshoptimizer');await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const compile=async(name,source)=>{const p=path.join(out,name+'.mjs');await fs.writeFile(p,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText);return import(pathToFileURL(p).href);};
await compile('fixture-lake-shore',await fs.readFile(sourceRoot+'/src/components/internal/lake-shore.ts','utf8'));

await compile('fixture-plunge',await fs.readFile(sourceRoot+'/src/components/internal/plunge-basin.ts','utf8'));
const cascadeData=JSON.parse(await fs.readFile(sourceRoot+'/src/components/internal/cascade-field.json'));
const cascade=await compile('fixture-cascade',(await fs.readFile(sourceRoot+'/src/components/internal/cascade-contact.ts','utf8')).replace('import field from "./cascade-field.json";',`const field=${JSON.stringify(cascadeData)};`).replace('from "./plunge-basin"','from "./fixture-plunge.mjs"'));
await compile('fixture-falling',(await fs.readFile(sourceRoot+'/src/components/internal/falling-water.tsx','utf8')).replace('from "./cascade-contact"','from "./fixture-cascade.mjs"'));
await compile('fixture-headwater',await fs.readFile(sourceRoot+'/src/components/internal/ridge-headwater.ts','utf8'));
const field=JSON.parse(await fs.readFile(sourceRoot+'/src/components/internal/native-cliff-field.json'));
let native=(await fs.readFile(sourceRoot+'/src/components/internal/native-cliff.tsx','utf8')).replace('import field from "./native-cliff-field.json";',`const field=${JSON.stringify(field)};`).replace('from "./ridge-headwater"','from "./fixture-headwater.mjs"').replace('import {RootedTrees} from "./rooted-trees";','const RootedTrees=()=>null;');
await compile('fixture-native',native);
const vf=JSON.parse(await fs.readFile(sourceRoot+'/src/components/internal/native-valley-field.json'));
let vs=(await fs.readFile(sourceRoot+'/src/components/internal/native-valley.tsx','utf8')).replace('import field from "./native-valley-field.json";',`const field=${JSON.stringify(vf)};`).replace('import {RootedTrees} from "./rooted-trees";','const RootedTrees=()=>null;').replace('from "./lake-shore"','from "./fixture-lake-shore.mjs"');
await compile('fixture-native-valley',vs);
const source=await fs.readFile(sourceRoot+'/src/components/internal/ridge-production-v116.tsx','utf8');
const parsed=ts.createSourceFile('fixture.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const fixture=parsed.statements.map(n=>{
 if(!ts.isImportDeclaration(n)||!(n.moduleSpecifier.text.startsWith('.')||n.moduleSpecifier.text.startsWith('@')))return n.getText();
 if(n.importClause?.isTypeOnly)return '';
 if(n.moduleSpecifier.text==='./cascade-contact')return n.getText().replace('./cascade-contact','./fixture-cascade.mjs');
 if(n.moduleSpecifier.text==='./falling-water')return n.getText().replace('./falling-water','./fixture-falling.mjs');
 if(n.moduleSpecifier.text==='./plunge-basin')return n.getText().replace('./plunge-basin','./fixture-plunge.mjs');
 if(n.moduleSpecifier.text==='./lake-shore')return n.getText().replace('./lake-shore','./fixture-lake-shore.mjs');
 if(n.moduleSpecifier.text==='./ridge-headwater')return n.getText().replace('./ridge-headwater','./fixture-headwater.mjs');
 if(n.moduleSpecifier.text==='./native-valley')return "import {applyNativeValley,nativeValleyWeight,NativeValleyPlants} from './fixture-native-valley.mjs';";
 if(n.moduleSpecifier.text==='./native-cliff')return `import {applyNativeCliff,nativeCliffWeight,NativeCliffPlants} from './fixture-native.mjs';`;
 return [...(n.importClause?.namedBindings?.elements??[])].filter(e=>!e.isTypeOnly).map(e=>`const ${e.name.text}={};`).join('\n');
}).join('\n')+'\nexport {waterfallSourceSurface,extendJourneyCoast,removeCoplanarBoundaryWall,createNativeRidgeSurface,createRidgeErosionTerrainGeometry,geometrySurfaceForMerge,v116RiverCenter,ridgeChannelWidth,createRidgeHeadwaterGeometry,createIntegratedRiverGeometry,outflowTerrainSampler,createWaterfallOutflowGeometry,createIntegratedWatershedTerrainGeometry,createExactBoundaryTerrainSeamBridge,extractTerrainSeamSamples,createIntegratedLakeGeometry,createWaterMaterial,createWaterfallPlungeGeometry,createCumulativeWaterfallGeometry,waterfallOutflowCenter,v116RiverHalfWidth,waterfallUpperLevel,waterfallUpperCenter,waterfallUpperHalfWidth,waterfallUpperBankWidth,createWaterfallUpperStreamGeometry,activeTerrainChunks};';
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



assert.equal((fixture.match(/applyCascadeBed\(/g)??[]).length,1,'Exactly one bed mutation, after final assembly');
const control=await compile('fixture-no-cascade',fixture.replace('applyCascadeBed(finalGeometry);',''));
const {plungeDistance}=await import(pathToFileURL(path.join(out,'fixture-plunge.mjs')).href);
const cases=[];
for(const compact of [false,true]){
 const v=await sourceMesh(compact,'valley'),r=compact?null:await sourceMesh(false,'ridge'),a=compact?null:await sourceMesh(false,'alpine');const args=[v,compact?[]:runtime.extractTerrainSeamSamples(a,-980),compact?[]:runtime.extractTerrainSeamSamples(r,-315),compact?2:1,compact?0:1,compact?[]:runtime.extractTerrainSeamSamples(r,-287),compact?0:2];
 const g=runtime.createIntegratedWatershedTerrainGeometry(...args),b=control.createIntegratedWatershedTerrainGeometry(...args),gp=g.getAttribute('position'),bp=b.getAttribute('position');assert.equal(gp.count,bp.count);assert.deepEqual(g.index.array,b.index.array);
 let changed=0,maxDelta=0,outside=0,pool=0;for(let i=0;i<gp.count;i++){assert.equal(gp.getX(i),bp.getX(i));assert.equal(gp.getZ(i),bp.getZ(i));const d=Math.abs(gp.getY(i)-bp.getY(i));if(d>1e-5){changed++;maxDelta=Math.max(maxDelta,d);if(!cascade.cascadeWetWeight(gp.getX(i),gp.getZ(i)))outside++;if(plungeDistance(gp.getX(i),gp.getZ(i))<=1.08)pool++;}}
 const sample=sampler(g),fall=runtime.createCumulativeWaterfallGeometry(),p=fall.getAttribute('position'),uv=fall.getAttribute('uv'),tt=fall.getAttribute('travelTime'),stride=fall.userData.waterfallBody.columns+1,profile=[],clearances=[];
 for(let i=0;i<p.count;i++){assert.ok([p.getX(i),p.getY(i),p.getZ(i),tt.getX(i)].every(Number.isFinite));if(i>=stride)assert.ok(tt.getX(i)>=tt.getX(i-stride)-.00001,'Guide travel reversed');if(Math.abs(uv.getX(i)-.5)<.21&&plungeDistance(p.getX(i),p.getZ(i))>1.08){const clearance=p.getY(i)-sample(p.getX(i),p.getZ(i));clearances.push(clearance);}}
 for(let row=0;row<=160;row+=16){const z=p.getZ(row*stride),s=cascade.cascadeSection(z),y=cascade.cascadeLevel(s.x,z);profile.push({z,x:s.x,y,clearance:y-sample(s.x,z),pool:plungeDistance(s.x,z)<=1.08});}
 const feed=runtime.createWaterfallUpperStreamGeometry(compact?42:68,compact?6:10),fp=feed.getAttribute('position'),last=fp.count-1;assert.ok(Math.abs(fp.getZ(last)-fall.userData.waterfallBody.top.z)<.5);assert.ok(Math.abs(p.getY(p.count-1)+44.05)<.01);assert.ok(runtime.activeTerrainChunks('ridge').includes('alpine'));
 const nearby=[];for(const zone of ['ridge','valley','lake','alpine']){const m=JSON.parse(await fs.readFile('public/world/v116/ecology-'+zone+'-v1.16.json'));for(const q of m.instances)if(cascade.cascadeWetWeight(q[2],q[4])>.001)nearby.push({zone,x:q[2],y:q[3],z:q[4]});}
 clearances.sort((a,b)=>a-b);assert.ok(changed>0&&outside===0&&pool===0&&maxDelta<3.001);assert.ok(profile.filter(p=>!p.pool).slice(1).every(p=>p.clearance>0&&p.clearance<1.6),'Centreline lost terrain contact');assert.ok(clearances[Math.floor(clearances.length*.05)]>0&&clearances[Math.floor(clearances.length*.95)]<2,'Most core samples no longer follow the headwall');assert.equal(nearby.length,0,'Existing source tree anchor overlaps changed chute');cases.push({compact,changed,maxDelta,outside,pool,body:fall.userData.waterfallBody,profile,coreClearance:{min:clearances[0],p05:clearances[Math.floor(clearances.length*.05)],median:clearances[Math.floor(clearances.length*.5)],p95:clearances[Math.floor(clearances.length*.95)],max:clearances.at(-1)},nearbyPlants:nearby,triangles:g.index.count/3,waterTriangles:fall.index.count/3});
}
await fs.writeFile(path.join(out,'contact-local.json'),JSON.stringify({passed:true,at:new Date().toISOString(),cases,limits:"Actual centreline and core sample checks are distinct. Edge lift-off/intersection remains documented; no every-pixel collision, fluid or photographic-equivalence claim."},null,2));console.log(JSON.stringify(cases.map(({compact,changed,maxDelta,outside,pool,coreClearance,nearbyPlants,profile})=>({compact,changed,maxDelta,outside,pool,coreClearance,nearbyPlants,profile})),null,2));
const baseline='bb3da483052830b7197ce1eddd456bb5179fca49',git=(...a)=>execFileSync('git',a,{encoding:'utf8',maxBuffer:32e6}).trim();
const oldFalling=execFileSync('git',['show',baseline+':src/components/internal/falling-water.tsx'],{encoding:'utf8'});
const old=await compile('fixture-old-falling',oldFalling.replace('from "./cascade-contact"','from "./fixture-cascade.mjs"'));
const current=await import(pathToFileURL(path.join(out,'fixture-falling.mjs')).href);
const fall=runtime.createCumulativeWaterfallGeometry(),meta=fall.userData.waterfallBody,controlFall=old.createFallingWaterGeometry(meta.top,meta.bottom,meta.lipHalfWidthMeters),p=fall.getAttribute('position'),bp=controlFall.getAttribute('position');
assert.deepEqual(fall.index.array,controlFall.index.array);let changed=0,maxShift=0;
for(let i=0;i<p.count;i++){for(let c=0;c<3;c++)assert.ok(Number.isFinite(p.getComponent(i,c)));const shift=Math.hypot(...[0,1,2].map(c=>p.getComponent(i,c)-bp.getComponent(i,c)));if(shift>1e-5)changed++;maxShift=Math.max(maxShift,shift);if(i<41||i>=p.count-41)assert.deepEqual([p.getX(i),p.getY(i),p.getZ(i)],[bp.getX(i),bp.getY(i),bp.getZ(i)],'Retain exact source and pool cross-sections');}
assert.ok(changed>3000&&maxShift<2);assert.equal(meta.version,'cascade-shape-1');
const feeds=[];
for(const longitudinal of [42,68,92]){
 const feed=runtime.createWaterfallUpperStreamGeometry(longitudinal,20),fp=feed.getAttribute('position'),riffle=feed.getAttribute('riffle'),flow=feed.getAttribute('flow'),stride=21;let maxLipGap=0,maxRise=-Infinity,maxRiffle=0;
 for(let c=0;c<stride;c++){const i=longitudinal*stride+c,j=20-c;maxLipGap=Math.max(maxLipGap,Math.hypot(fp.getX(i)-p.getX(j),fp.getY(i)-p.getY(j),fp.getZ(i)-p.getZ(j)));}
 for(let row=1;row<=longitudinal;row++){const i=row*stride+10,previous=i-stride;maxRise=Math.max(maxRise,fp.getY(i)-fp.getY(previous));assert.ok(flow.getY(i)>flow.getY(previous));}
 for(let i=0;i<fp.count;i++){maxRiffle=Math.max(maxRiffle,riffle.getX(i));assert.ok(Number.isFinite(fp.getY(i))&&riffle.getX(i)>=0&&riffle.getX(i)<=1);}
 assert.ok(maxLipGap<.00003,'Exact common lip');assert.ok(maxRise<=.00001,'Source centreline must remain downhill');assert.ok(maxRiffle>.4,'Riffles carry geometry-derived aeration');
 feeds.push({longitudinal,triangles:feed.index.count/3,maxLipGap,maxRise,maxRiffle,metadata:feed.userData.headwaterChannel});
}
let maxAnalyticRise=-Infinity;for(let z=-857.95;z<=-750;z+=.05)maxAnalyticRise=Math.max(maxAnalyticRise,runtime.waterfallSourceSurface(z)-runtime.waterfallSourceSurface(z-.05));assert.ok(maxAnalyticRise<0);
const blobHash=b=>createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex'),changedFiles=[];
for(const row of git('ls-tree','-r',baseline,'--','src','public').split('\n')){const [record,file]=row.split('\t'),oid=record.split(' ')[2],b=await fs.readFile(sourceRoot+'/'+file);if(blobHash(b)!==oid&&blobHash(Buffer.from(b.toString().replaceAll('\r\n','\n')))!==oid)changedFiles.push(file);}
assert.deepEqual(changedFiles,['src/components/internal/falling-water.tsx','src/components/internal/ridge-production-v116.tsx']);
const previousSource=execFileSync('git',['show',baseline+':src/components/internal/ridge-production-v116.tsx'],{encoding:'utf8',maxBuffer:4e6}).replaceAll('\r\n','\n'),normalized=source.replaceAll('\r\n','\n');
for(const [start,end]of[['function waterfallUpperProgress','function waterfallOutflowCenter'],['function createAlpineGeologyTerrainGeometry','function DetailedTerrainChunk'],['function joinCompactAlpineBoundary','function createExactDetailedRidgeValleyWeldGeometry']])assert.equal(normalized.slice(normalized.indexOf(start),normalized.indexOf(end)),previousSource.slice(previousSource.indexOf(start),previousSource.indexOf(end)),'Retained terrain and boundary functions');
const report={at:new Date().toISOString(),passed:true,baseline,changedRuntimeFiles:changedFiles,curtain:{triangles:fall.index.count/3,changedVertices:changed,maximumPositionShift:maxShift,sourceAndPoolCrossSectionsExact:true},feeds,maxAnalyticRise,terrainContact:cases,scope:'Only water geometry and its dedicated source material change; terrain constructors, exact compact seam, guide, pool, planting and all other src/public bytes are retained.',limits:'Authored geometry and sampled contact checks, not measured geography, fluid simulation or every-pixel contact.'};
await fs.writeFile(out+'/geometry-local.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,curtain:report.curtain,feeds,maxAnalyticRise}));
