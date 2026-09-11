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
const out=path.resolve(process.env.MADAGIN_CASCADE_EVIDENCE??'output/releases/madagin-connected-water-20260911/geometry');
await fs.mkdir(out,{recursive:true});
const require=createRequire(path.resolve('output/releases/madagin-canopy-20260906/pipeline/package.json'));
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS}=require('@gltf-transform/extensions'),{MeshoptDecoder}=require('meshoptimizer');await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const compile=async(name,source)=>{const p=path.join(out,name+'.mjs');await fs.writeFile(p,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText);return import(pathToFileURL(p).href);};
await compile('fixture-headwater',await fs.readFile(sourceRoot+'/src/components/internal/ridge-headwater.ts','utf8'));
await compile('fixture-channel-profile',(await fs.readFile(sourceRoot+'/src/components/internal/channel-profile.ts','utf8')).replace('"./ridge-headwater"','"./fixture-headwater.mjs"'));
await compile('fixture-lake-shore',(await fs.readFile(sourceRoot+'/src/components/internal/lake-shore.ts','utf8')).replace('"./channel-profile"','"./fixture-channel-profile.mjs"'));
await compile('fixture-channel-water',(await fs.readFile(sourceRoot+'/src/components/internal/channel-water.ts','utf8')).replace('"./lake-shore"','"./fixture-lake-shore.mjs"'));

await compile('fixture-plunge',(await fs.readFile(sourceRoot+'/src/components/internal/plunge-basin.ts','utf8')).replace('"./channel-water"','"./fixture-channel-water.mjs"'));
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
 if(n.moduleSpecifier.text==='./channel-profile')return n.getText().replace('./channel-profile','./fixture-channel-profile.mjs');
 if(n.moduleSpecifier.text==='./channel-water')return n.getText().replace('./channel-water','./fixture-channel-water.mjs');
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




const results=[];
for(const compact of [true,false]) {
 const source=await sourceMesh(compact,'valley');
 const valley=runtime.createIntegratedWatershedTerrainGeometry(source,[],[],compact?2:1,compact?0:1);
 const at=sampler(valley),checks=[];
 for(const [kind,g,columns] of [['river',runtime.createIntegratedRiverGeometry(compact?74:118,8),8],['outflow',runtime.createWaterfallOutflowGeometry(compact?36:62,8),8]]) {
  const p=g.getAttribute('position'),depth=g.getAttribute('waterDepth'),rows=p.count/(columns+1),samples=[];
  assert.equal(depth.count,p.count);assert.ok(Array.from(depth.array).every(d=>d>0));
  for(let row=1;row<rows-1;row++)for(const col of [2,4,6]) {
   const i=row*(columns+1)+col,x=p.getX(i),z=p.getZ(i),water=p.getY(i),bed=at(x,z);
   const clearance=water-bed;samples.push({row,col,x,z,water,bed,clearance,opticalDepth:depth.getX(i),depthError:Math.abs(clearance-depth.getX(i))});
  }
  const finite=samples.filter(s=>Number.isFinite(s.bed));
  assert.equal(finite.length,samples.length,'All sampled water has terrain beneath it');assert.ok(finite.every(s=>s.clearance>.12),'The actual rendered bed stays submerged');
  assert.ok(finite.every(s=>s.depthError<(kind==='river'?.06:.2)),'Optical depth agrees with actual rendered terrain within the section mesh tolerance');
  const flow=g.getAttribute('flow');
  for(let row=1;row<rows;row++){
    const i=row*(columns+1)+4,previous=i-columns-1;
    assert.ok(flow.getY(i)>flow.getY(previous),'Metric flow advances downstream');
    assert.ok(p.getY(i)<=p.getY(previous)+.025,'Water has no upstream step beyond surface ripple tolerance');
  }
  checks.push({kind,maximumDepthError:Math.max(...finite.map(s=>s.depthError)),minimum:Math.min(...finite.map(s=>s.clearance)),probes:samples.length,missing:samples.length-finite.length,samples});
 }
 results.push({compact,checks});
}
await fs.writeFile(out+'/channel-geometry.json',JSON.stringify({at:new Date().toISOString(),passed:true,results},null,2));
console.log(JSON.stringify(results.map(c=>({compact:c.compact,checks:c.checks.map(({samples,...rest})=>rest)}))));
