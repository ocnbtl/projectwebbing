import {PerspectiveCamera,Raycaster,Vector2,DoubleSide,MeshBasicMaterial} from 'three';
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
const out=path.resolve(process.env.MADAGIN_CASCADE_EVIDENCE??'output/releases/madagin-ground-substrate-20260910');
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
}).join('\n')+'\nexport {createExactDetailedRidgeValleyWeldGeometry,joinCompactAlpineBoundary,createTerminalChunkGeometry,createAlpineGeologyTerrainGeometry,sampleTerrainSeamHeight,extendJourneyCoast,removeCoplanarBoundaryWall,createNativeRidgeSurface,createRidgeErosionTerrainGeometry,geometrySurfaceForMerge,v116RiverCenter,ridgeChannelWidth,createRidgeHeadwaterGeometry,createIntegratedRiverGeometry,outflowTerrainSampler,createWaterfallOutflowGeometry,createIntegratedWatershedTerrainGeometry,createExactBoundaryTerrainSeamBridge,extractTerrainSeamSamples,createIntegratedLakeGeometry,createWaterMaterial,createWaterfallPlungeGeometry,createCumulativeWaterfallGeometry,waterfallOutflowCenter,v116RiverHalfWidth,waterfallUpperLevel,waterfallUpperCenter,waterfallUpperHalfWidth,waterfallUpperBankWidth,createWaterfallUpperStreamGeometry,activeTerrainChunks};';
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




const ridgeSource=await sourceMesh(true,'ridge'),valleySource=await sourceMesh(true,'valley');
const ridge=runtime.createNativeRidgeSurface(runtime.geometrySurfaceForMerge(ridgeSource.geometry,ridgeSource.matrixWorld));
const control=runtime.createIntegratedWatershedTerrainGeometry(valleySource,[],[],2,0);control.setAttribute('uv1',control.getAttribute('uv').clone());ridge.computeBoundingBox();const outer=runtime.extractTerrainSeamSamples(new Mesh(ridge),ridge.boundingBox.min.z);const valley=runtime.createExactDetailedRidgeValleyWeldGeometry(control,outer,runtime.extractTerrainSeamSamples(new Mesh(ridge),outer[0].z+28),true);
const rb=outer,vb=runtime.extractTerrainSeamSamples(new Mesh(valley));
const seamField={ridge:rb,valley:vb,ridgeInterior:runtime.extractTerrainSeamSamples(new Mesh(ridge),rb[0].z+28),valleyInterior:runtime.extractTerrainSeamSamples(new Mesh(valley),vb[0].z-28)};
const bridge=Math.abs(rb[0].z-vb[0].z)>.04?runtime.createExactBoundaryTerrainSeamBridge(seamField):null;
runtime.removeCoplanarBoundaryWall(ridge,'z',rb[0].z);runtime.removeCoplanarBoundaryWall(valley,'z',vb[0].z);
const coastRidge=runtime.extendJourneyCoast(ridge,'conservative','ridge'),coastValley=runtime.extendJourneyCoast(valley,'conservative','valley');
const material=new MeshBasicMaterial({side:DoubleSide}),geometries=[['ridge',coastRidge],['valley',coastValley],['bridge',bridge]].filter(([,g])=>g),meshes=geometries.map(([name,g])=>{const m=new Mesh(g,material);m.name=name;m.updateMatrixWorld();return m;});
const matching=JSON.parse(await fs.readFile('output/playwright/madagin-world-progress/ground-substrate-release-20260910/matched-views.json'));
const c=matching.cases.find(c=>c.release==='after'&&c.viewport.width===390).views.find(v=>v.id==='ridge-exit').camera;
const camera=new PerspectiveCamera(c.fov,390/844,.1,5000);camera.position.fromArray(c.position);camera.lookAt(...c.look);camera.updateMatrixWorld();
const ray=new Raycaster(),rays=[];
for(const [x,y]of[[268,640],[272,641],[277,641],[310,644],[314,644],[318,644],[385,637],[385,635],[385,640]]){ray.setFromCamera(new Vector2(x/390*2-1,1-y/844*2),camera);rays.push({pixel:[x,y],hits:ray.intersectObjects(meshes).slice(0,3).map(h=>({mesh:h.object.name,point:h.point.toArray(),face:h.faceIndex}))});}
const report={at:new Date().toISOString(),camera:c,diagnostic:valley.userData,ridgeEdge:{minX:rb[0].x,maxX:rb.at(-1).x,z:rb[0].z,count:rb.length},valleyEdge:{minX:vb[0].x,maxX:vb.at(-1).x,z:vb[0].z,count:vb.length},rays};

const sampleR=sampler(coastRidge),sampleV=sampler(coastValley),gaps=[];for(let x=-309;x<=309;x+=.5)gaps.push(Math.abs(sampleR(x,rb[0].z)-sampleV(x,rb[0].z)));report.maximumRenderedEdgeGap=Math.max(...gaps);report.probes=gaps.length;assert.ok(report.maximumRenderedEdgeGap<.0001);for(const ray of rays)assert.ok(ray.hits.length,'Former gap pixel must hit terrain');report.passed=true;
const sampleBefore=sampler(control),sampleWater=sampler(runtime.createRidgeHeadwaterGeometry()),water=[];
for(let z=-337.7;z<=-335;z+=.15)for(const across of [-.6,0,.6]){
 const x=runtime.v116RiverCenter(z)+runtime.ridgeChannelWidth(z)*across;
 const before=sampleBefore(x,z),after=sampleV(x,z),level=sampleWater(x,z);
 water.push({x,z,across,before,after,level,clearance:level-after});
 assert.ok(Number.isFinite(level)&&level-after>.08,'Weld must leave the actual stream surface above its bed');
}
const away=[];for(const z of [-338,-340,-400,-750,-990])for(let x=-300;x<=300;x+=25){const delta=Math.abs(sampleBefore(x,z)-sampleV(x,z));if(Number.isFinite(delta))away.push(delta);}
assert.ok(Math.max(...away)<.00001,'Terrain away from the strip must remain unchanged');
report.water={probes:water.length,minimumClearance:Math.min(...water.map(p=>p.clearance)),samples:water};report.maximumAwayDifference=Math.max(...away);
await fs.writeFile(out+'/foreground-seam-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,edge:report.maximumRenderedEdgeGap,probes:report.probes,rayHits:rays.every(r=>r.hits.length),minimumWaterClearance:report.water.minimumClearance,away:report.maximumAwayDifference,weld:valley.userData.detailedRidgeValleyWeld}));
