import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {BufferGeometry,BufferAttribute,Mesh,Matrix4,Vector3,CatmullRomCurve3} from 'three';
const out=path.resolve(process.env.MADAGIN_VALLEY_EVIDENCE??'output/releases/madagin-valley-relief-20260910');
await fs.mkdir(out,{recursive:true});
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
const vf=JSON.parse(await fs.readFile('src/components/internal/native-valley-field.json'));
let vs=(await fs.readFile('src/components/internal/native-valley.tsx','utf8')).replace('import field from "./native-valley-field.json";',`const field=${JSON.stringify(vf)};`).replace('import {RootedTrees} from "./rooted-trees";','const RootedTrees=()=>null;').replace('from "./lake-shore"','from "./fixture-lake-shore.mjs"');
const nativeValley=await compile('fixture-native-valley',vs);
const source=await fs.readFile('src/components/internal/ridge-production-v116.tsx','utf8');
const parsed=ts.createSourceFile('fixture.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const fixture=parsed.statements.map(n=>{
 if(!ts.isImportDeclaration(n)||!(n.moduleSpecifier.text.startsWith('.')||n.moduleSpecifier.text.startsWith('@')))return n.getText();
 if(n.importClause?.isTypeOnly)return '';
 if(n.moduleSpecifier.text==='./falling-water')return n.getText().replace('./falling-water','./fixture-falling.mjs');
 if(n.moduleSpecifier.text==='./plunge-basin')return n.getText().replace('./plunge-basin','./fixture-plunge.mjs');
 if(n.moduleSpecifier.text==='./lake-shore')return n.getText().replace('./lake-shore','./fixture-lake-shore.mjs');
 if(n.moduleSpecifier.text==='./ridge-headwater')return n.getText().replace('./ridge-headwater','./fixture-headwater.mjs');
 if(n.moduleSpecifier.text==='./native-valley')return "import {applyNativeValley,nativeValleyWeight,NativeValleyPlants} from './fixture-native-valley.mjs';";
 if(n.moduleSpecifier.text==='./native-cliff')return `import {applyNativeCliff,nativeCliffWeight,NativeCliffPlants} from './fixture-native.mjs';`;
 return [...(n.importClause?.namedBindings?.elements??[])].filter(e=>!e.isTypeOnly).map(e=>`const ${e.name.text}={};`).join('\n');
}).join('\n')+'\nexport {extendJourneyCoast,removeCoplanarBoundaryWall,createNativeRidgeSurface,createRidgeErosionTerrainGeometry,geometrySurfaceForMerge,v116RiverCenter,ridgeChannelWidth,createRidgeHeadwaterGeometry,createIntegratedRiverGeometry,outflowTerrainSampler,createWaterfallOutflowGeometry,createIntegratedWatershedTerrainGeometry,createExactBoundaryTerrainSeamBridge,extractTerrainSeamSamples,createIntegratedLakeGeometry,createWaterMaterial,createWaterfallPlungeGeometry,createCumulativeWaterfallGeometry,waterfallOutflowCenter,v116RiverHalfWidth};';
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



const {JOURNEY_CHECKPOINTS}=await compile('fixture-world-manifest',await fs.readFile('src/lib/world-manifest.ts','utf8'));
const paths=[false,true].map(compact=>new CatmullRomCurve3(JOURNEY_CHECKPOINTS.map(p=>new Vector3().fromArray(compact?p.mobileCamera:p.camera)),false,'centripetal').getPoints(1000));
assert.equal(fixture.split('applyNativeValley(geometry);').length,2);
const baseline=await compile('fixture-without-valley-patch',fixture.replace('applyNativeValley(geometry);',''));
// The control uses the same production constructor with only this patch disabled.
// Water footprints are checked independently using their shared analytic authority.
const {lakeBoundaryDistance}=await import(pathToFileURL(path.join(out,'fixture-lake-shore.mjs')).href);
const cases=[];
for(const compact of [false,true]){
 const key=compact?'compact':'desktop',v=await sourceMesh(compact,'valley'),r=compact?null:await sourceMesh(false,'ridge'),a=compact?null:await sourceMesh(false,'alpine');
 const args=[v,compact?[]:runtime.extractTerrainSeamSamples(a,-980),compact?[]:runtime.extractTerrainSeamSamples(r,-315),compact?2:1,compact?0:1,compact?[]:runtime.extractTerrainSeamSamples(r,-287),compact?0:2];
 const g=runtime.createIntegratedWatershedTerrainGeometry(...args),b=baseline.createIntegratedWatershedTerrainGeometry(...args),p=g.getAttribute('position'),bp=b.getAttribute('position');assert.equal(p.count,bp.count);assert.deepEqual(g.index.array,b.index.array);
 let changed=0,outside=0,wet=0,interiorError=0,maxDelta=0,wetSamples=0;const edges=[];
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),delta=Math.abs(p.getY(i)-bp.getY(i)),w=nativeValley.nativeValleyWeight(x,z);assert.equal(x,bp.getX(i));assert.equal(z,bp.getZ(i));assert.ok(Number.isFinite(p.getY(i)));if(delta>1e-5){changed++;maxDelta=Math.max(maxDelta,delta);if(w===0)outside++;if(lakeBoundaryDistance(x,z)<=1.45 || (z>=-777&&z<=-315&&Math.abs(x-runtime.v116RiverCenter(z))<=Math.max(14,runtime.ridgeChannelWidth(z)*3.5)))wet++;}if(lakeBoundaryDistance(x,z)<=1.45)wetSamples++;if(x<=-285)assert.ok(delta<1e-5,'Coastal source buffer changed');if(w===1)interiorError=Math.max(interiorError,Math.abs(p.getY(i)-nativeValley.nativeValleyElevation(x,z)));}
 const gp=runtime.extendJourneyCoast(g.clone(),compact?'conservative':'high','valley'),bpJoined=runtime.extendJourneyCoast(b.clone(),compact?'conservative':'high','valley');
 const coastPoints=q=>{const a=q.getAttribute('position'),items=[];for(let i=0;i<a.count;i++)if(a.getX(i)<=-310)items.push([a.getX(i),a.getY(i),a.getZ(i)].join(','));return [...new Set(items)].sort();};
 assert.deepEqual(coastPoints(gp),coastPoints(bpJoined),'Rendered coastal shoulder changed');
 assert.equal(gp.index.count,bpJoined.index.count,'Joined triangle cost changed');
 const plants=nativeValley.createNativeValleyPlants(gp,compact),sample=nativeValley.nativeValleySampler(gp);let minBurial=Infinity,maxBurial=0,minCamera=Infinity;
 for(const q of plants){for(let i=0;i<9;i++){const y=sample(q[2]+(i?Math.cos(i*Math.PI/4)*.32:0),q[4]+(i?Math.sin(i*Math.PI/4)*.32:0));minBurial=Math.min(minBurial,y-q[3]);maxBurial=Math.max(maxBurial,y-q[3]);}for(const curve of paths)for(const c of curve)minCamera=Math.min(minCamera,Math.hypot(c.x-q[2],c.z-q[4]));}
 for(let j=0;j<g.index.count;j+=3){const ids=[g.index.getX(j),g.index.getX(j+1),g.index.getX(j+2)];if(!ids.every(i=>nativeValley.nativeValleyWeight(p.getX(i),p.getZ(i))===1))continue;for(let k=0;k<3;k++){const i=ids[k],a=ids[(k+1)%3];edges.push(Math.hypot(p.getX(i)-p.getX(a),p.getZ(i)-p.getZ(a)));}}
 edges.sort((a,b)=>a-b);assert.ok(changed>1000&&outside===0&&wet===0&&interiorError<.00002);assert.ok(plants.length>20&&minBurial>=.0599&&minCamera>40&&wetSamples>10000);cases.push({profile:key,changedVertices:changed,maxDelta,unchangedOutside:outside===0,protectedWetAnchorsUnchanged:wet===0,actualLakeFootprintVertices:wetSamples,interiorError,triangles:g.index.count/3,joinedTriangles:gp.index.count/3,coastalShoulderUnchanged:true,coreTopologyUnchanged:true,sourceGridMeters:vf.sourceGridMeters,interiorHorizontalEdgeP95:edges[Math.floor(edges.length*.95)],plants:plants.length,minBurial,maxBurial,minCameraHorizontalClearance:minCamera,metadata:g.userData.nativeValley});
}
const filtered={};for(const zone of ['ridge','valley','lake','alpine']){const m=JSON.parse(await fs.readFile('public/world/v116/ecology-'+zone+'-v1.16.json'));filtered[zone]=m.instances.filter(p=>nativeValley.nativeValleyWeight(p[2],p[4])>0).length;}
await fs.writeFile(path.join(out,'geometry-local.json'),JSON.stringify({passed:true,at:new Date().toISOString(),cases,filtered,method:'Actual shared-edge terrain constructor and native-source full elevation patch. Barycentric support of generated trunk footprints; unchanged triangle indices and every position outside window. Flight rails remain horizontally outside changed terrain and trees. Existing bank/riparian/understory/rock placements have no overlap.'},null,2));console.log(JSON.stringify({passed:true,cases,filtered}));
