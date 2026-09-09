import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {BufferGeometry,BufferAttribute,Mesh,Matrix4,InterleavedBuffer,InterleavedBufferAttribute} from 'three';
const out=path.resolve('output/releases/madagin-terrain-startup-20260908');
const require=createRequire(path.resolve('output/releases/madagin-canopy-20260906/pipeline/package.json'));
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS}=require('@gltf-transform/extensions'),{MeshoptDecoder}=require('meshoptimizer');await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});

async function compileTree(root,label){
const readSource=async relative=>label==='baseline'?execFileSync('git',['show','f89eaf74c6ba7aea0ba8daf1e3250c04f6247cce:'+relative],{encoding:'utf8',maxBuffer:16*1024*1024}):fs.readFile(path.join(root,relative),'utf8');
const compile=async(name,source)=>{const p=path.join(out,label+'-'+name+'.mjs');await fs.writeFile(p,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText);return import(pathToFileURL(p).href);};
await compile('fixture-lake-shore',await readSource('src/components/internal/lake-shore.ts'));
await compile('fixture-falling',await readSource('src/components/internal/falling-water.tsx'));
await compile('fixture-plunge',await readSource('src/components/internal/plunge-basin.ts'));
await compile('fixture-headwater',await readSource('src/components/internal/ridge-headwater.ts'));
const field=JSON.parse(await readSource('src/components/internal/native-cliff-field.json'));
let native=(await readSource('src/components/internal/native-cliff.tsx')).replace('import field from "./native-cliff-field.json";',`const field=${JSON.stringify(field)};`).replace('from "./ridge-headwater"','from "./fixture-headwater.mjs"').replace('import {RootedTrees} from "./rooted-trees";','const RootedTrees=()=>null;');
await compile('fixture-native',native.replaceAll('./fixture-', './'+label+'-fixture-'));
const source=await readSource('src/components/internal/ridge-production-v116.tsx');
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
}).join('\n')+'\nexport {createNativeRidgeSurface,createRidgeErosionTerrainGeometry,geometrySurfaceForMerge,v116RiverCenter,ridgeChannelWidth,createRidgeHeadwaterGeometry,createIntegratedRiverGeometry,outflowTerrainSampler,createWaterfallOutflowGeometry,createIntegratedWatershedTerrainGeometry,createExactBoundaryTerrainSeamBridge,extractTerrainSeamSamples,createIntegratedLakeGeometry,createWaterMaterial,createWaterfallPlungeGeometry,createCumulativeWaterfallGeometry,createAlpineGeologyTerrainGeometry,subdivideSelectedTerrainGeometry};';
return compile('fixture-runtime',fixture.replaceAll('./fixture-', './'+label+'-fixture-'));
}

const baseline=await compileTree(path.join(out,'source'),'baseline');
const candidate=await compileTree(process.cwd(),'candidate');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function signature(g) {
 const attr=a=>({type:a.array.constructor.name,itemSize:a.itemSize,normalized:a.normalized,count:a.count,sha256:hash(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength))});
 return {attributes:Object.fromEntries(Object.keys(g.attributes).sort().map(k=>[k,attr(g.attributes[k])])),index:g.index?attr(g.index):null,userData:g.userData};
}
const cases=[];
function equivalent(id,old,next){const a=signature(old),b=signature(next);assert.deepEqual(b,a,id);cases.push({id,passed:true,...b});old.dispose();next.dispose();}
// A central face has all eight neighbor-induced split masks across this suite.
const topology=new BufferGeometry();
topology.setAttribute('position',new BufferAttribute(new Float32Array([0,0,0,2,.1,0,0,.2,2,1,-.1,-2,3,.3,3,-2,.2,1]),3));
topology.setAttribute('uv',new BufferAttribute(new Float32Array([0,0,1,0,0,1,.5,-1,1.5,1.5,-1,.5]),2));
topology.setIndex([0,1,2,1,0,3,2,1,4,0,2,5]);
for(let mask=0;mask<8;mask++)for(const normals of [false,true]){
 const select=(_p,a,b,c)=>c===3?!!(mask&1):c===4?!!(mask&2):c===5?!!(mask&4):false;
 equivalent(`neighbor-mask-${mask}-normals-${normals}`,baseline.subdivideSelectedTerrainGeometry(topology,'test',select,normals),candidate.subdivideSelectedTerrainGeometry(topology,'test',select,normals));
}
for(const [id,g] of [['unindexed',topology.toNonIndexed()],['no-uv',topology.clone().deleteAttribute('uv')],['empty',new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array(),3))]])for(const selected of [false,true])equivalent(`${id}-${selected}`,baseline.subdivideSelectedTerrainGeometry(g,'test',()=>selected),candidate.subdivideSelectedTerrainGeometry(g,'test',()=>selected));
const interleaved=topology.clone(),raw=new Float32Array(6*5);for(let i=0;i<6;i++){raw.set(Array.from(topology.attributes.position.array.slice(i*3,i*3+3)),i*5);raw.set(Array.from(topology.attributes.uv.array.slice(i*2,i*2+2)),i*5+3);}const buffer=new InterleavedBuffer(raw,5);interleaved.setAttribute('position',new InterleavedBufferAttribute(buffer,3,0));interleaved.setAttribute('uv',new InterleavedBufferAttribute(buffer,2,3));equivalent('interleaved',baseline.subdivideSelectedTerrainGeometry(interleaved,'test',()=>true),candidate.subdivideSelectedTerrainGeometry(interleaved,'test',()=>true));
const normalized=topology.clone().setAttribute('uv',new BufferAttribute(new Uint16Array([0,0,65535,0,0,65535,32767,0,65535,65535,0,32767]),2,true));equivalent('normalized-uv',baseline.subdivideSelectedTerrainGeometry(normalized,'test',()=>true),candidate.subdivideSelectedTerrainGeometry(normalized,'test',()=>true));
for(const max of [65534,65535])for(const selected of [false,true]){const g=new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array((max+4)*3),3));g.setIndex([0,max-1,max]);equivalent(`index-boundary-${max}-${selected}`,baseline.subdivideSelectedTerrainGeometry(g,'test',()=>selected),candidate.subdivideSelectedTerrainGeometry(g,'test',()=>selected));}
async function sourceMesh(compact,zone){
 const doc=await io.read(compact?`public/world/v116/terrain-${zone}-v1.16.glb`:'public/world/v115/madagin-ridge-to-valley-high-v1.15.glb');
 const name={ridge:'RIDGE',valley:'TROPICAL_VALLEY',alpine:'ALPINE_VALLEY'}[zone];
 const node=doc.getRoot().listNodes().find(n=>compact?n.getMesh():n.getName()===`${name}_V115_HIGH`),primitive=node.getMesh().listPrimitives()[0],g=new BufferGeometry();
 for(const [semantic,name] of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']]){const a=primitive.getAttribute(semantic);if(a)g.setAttribute(name,new BufferAttribute(a.getArray(),a.getElementSize()));}
 g.setIndex(new BufferAttribute(primitive.getIndices().getArray(),1));const mesh=new Mesh(g);mesh.matrixWorld=new Matrix4().fromArray(node.getWorldMatrix());return mesh;
}
const jobs=[];
for(const compact of [false,true]){
 const sources=Object.fromEntries(await Promise.all(['ridge','valley','alpine'].map(async z=>[z,await sourceMesh(compact,z)])));
 const ridgeBoundary=baseline.extractTerrainSeamSamples(sources.ridge,-315),ridgeInterior=baseline.extractTerrainSeamSamples(sources.ridge,-287),alpineBoundary=baseline.extractTerrainSeamSamples(sources.alpine,-980);
 jobs.push({id:`${compact?'compact':'desktop'}-ridge`,run:r=>compact?r.createNativeRidgeSurface(r.geometrySurfaceForMerge(sources.ridge.geometry,sources.ridge.matrixWorld)):r.createRidgeErosionTerrainGeometry(sources.ridge)});
 jobs.push({id:`${compact?'compact':'desktop'}-alpine`,run:r=>r.createAlpineGeologyTerrainGeometry(sources.alpine,compact?'compact':'detailed')});
 jobs.push({id:`${compact?'compact':'desktop'}-valley`,run:r=>r.createIntegratedWatershedTerrainGeometry(sources.valley,compact?[]:alpineBoundary,compact?[]:ridgeBoundary,compact?2:1,compact?0:1,compact?[]:ridgeInterior,compact?0:2)});
 if(compact)jobs.push({id:'compact-lake-patch',run:r=>r.createIntegratedWatershedTerrainGeometry(sources.valley,[],[],0,0)});
}
for(const j of jobs){console.log('Exact geometry: '+j.id);equivalent(j.id,j.run(baseline),j.run(candidate));}
for(const [id,fn,args] of [['lake','createIntegratedLakeGeometry',[320,40,.12]],['pool','createWaterfallPlungeGeometry',[144,14]],['curtain','createCumulativeWaterfallGeometry',[]],['headwater','createRidgeHeadwaterGeometry',[]],['river','createIntegratedRiverGeometry',[118,8]],['outflow','createWaterfallOutflowGeometry',[84,8]]])equivalent(id,baseline[fn](...args),candidate[fn](...args));
for(const kind of ['watershed','river','headwater','pool']){const a=baseline.createWaterMaterial(kind),b=candidate.createWaterMaterial(kind);for(const key of ['vertexShader','fragmentShader','transparent','depthWrite','side','blending'])assert.deepEqual(a[key],b[key],`${kind} ${key}`);assert.deepEqual(a.uniforms,b.uniforms,`${kind} uniforms`);a.dispose();b.dispose();}
await fs.writeFile(path.join(out,'geometry-equivalence.json'),JSON.stringify({at:new Date().toISOString(),passed:true,baseline:'f89eaf74c6ba7aea0ba8daf1e3250c04f6247cce',method:'Byte hashes of every generated attribute and index, exact metadata, actual source GLBs and production refinement counts/boundaries; water shader source/uniform equality. No geometry simplification.',cases,waterMaterials:4},null,2)+'\n');
if(process.env.MADAGIN_SKIP_BENCHMARK==='1')process.exit(0);
const measurements=[];
for(const j of jobs){const values={baseline:[],candidate:[]};for(let trial=0;trial<6;trial++)for(const label of trial%2?['candidate','baseline']:['baseline','candidate']){global.gc?.();const start=performance.now(),g=j.run(label==='baseline'?baseline:candidate),ms=performance.now()-start;g.dispose();if(trial>0)values[label].push(ms);}
 const median=xs=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)];const before=median(values.baseline),after=median(values.candidate);measurements.push({id:j.id,values,beforeMedianMs:before,afterMedianMs:after,reductionPercent:(1-after/before)*100});console.log(JSON.stringify(measurements.at(-1)));}
const valley=measurements.find(c=>c.id==='desktop-valley');assert.ok(valley.afterMedianMs<valley.beforeMedianMs*.8,'Meaningful desktop construction reduction of at least 20%');
await fs.writeFile(path.join(out,'construction-benchmark.json'),JSON.stringify({at:new Date().toISOString(),passed:true,method:'Same Node process and decoded immutable GLBs, one warm-up pair then five paired runs, alternating order, explicit GC outside timing; CPU construction only, not browser readiness or GPU.',cases:measurements},null,2)+'\n');
