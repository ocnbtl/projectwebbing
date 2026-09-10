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
const out=path.resolve(process.env.MADAGIN_CASCADE_EVIDENCE??'output/releases/madagin-alpine-seam-20260910');
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
}).join('\n')+'\nexport {joinCompactAlpineBoundary,createTerminalChunkGeometry,createAlpineGeologyTerrainGeometry,sampleTerrainSeamHeight,extendJourneyCoast,removeCoplanarBoundaryWall,createNativeRidgeSurface,createRidgeErosionTerrainGeometry,geometrySurfaceForMerge,v116RiverCenter,ridgeChannelWidth,createRidgeHeadwaterGeometry,createIntegratedRiverGeometry,outflowTerrainSampler,createWaterfallOutflowGeometry,createIntegratedWatershedTerrainGeometry,createExactBoundaryTerrainSeamBridge,extractTerrainSeamSamples,createIntegratedLakeGeometry,createWaterMaterial,createWaterfallPlungeGeometry,createCumulativeWaterfallGeometry,waterfallOutflowCenter,v116RiverHalfWidth,waterfallUpperLevel,waterfallUpperCenter,waterfallUpperHalfWidth,waterfallUpperBankWidth,createWaterfallUpperStreamGeometry,activeTerrainChunks};';
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



const alpineSource=await sourceMesh(true,'alpine'),valleySource=await sourceMesh(true,'valley');
const alpine=runtime.createAlpineGeologyTerrainGeometry(alpineSource,'compact');
const reference=runtime.extractTerrainSeamSamples(new Mesh(alpine),-1000);
const sourceReference=runtime.extractTerrainSeamSamples(alpineSource,-1000);
let sourceToRenderedMaximum=0;
for(const p of reference)sourceToRenderedMaximum=Math.max(sourceToRenderedMaximum,Math.abs(p.height-runtime.sampleTerrainSeamHeight(sourceReference,p.x)));
assert.ok(sourceToRenderedMaximum<.00004,'Cached Alpine source must equal rendered boundary');
const valley=runtime.createIntegratedWatershedTerrainGeometry(valleySource,[],[],2,0),before=valley.clone();
const r=await sourceMesh(true,'ridge');
const ridge=runtime.extractTerrainSeamSamples(r),vb=runtime.extractTerrainSeamSamples(valleySource);
const terminalField={ridge,valley:vb,ridgeInterior:runtime.extractTerrainSeamSamples(r,ridge[0].z+28),valleyInterior:runtime.extractTerrainSeamSamples(valleySource,vb[0].z-28)};
const terminal=runtime.createTerminalChunkGeometry(valleySource,terminalField);
const cases=[];
for(const [name,g]of[['journey',valley],['summit',terminal]]){
 const control=g.clone(),p0=control.getAttribute('position');runtime.joinCompactAlpineBoundary(g,alpineSource);const p=g.getAttribute('position');
 let outsideChanged=0,changed=0,finite=true;
 for(let i=0;i<p0.count;i++){const different=[0,1,2].some(c=>p.getComponent(i,c)!==p0.getComponent(i,c));if(different){changed++;if(p0.getZ(i)>=-988||p0.getZ(i)<-1000.5)outsideChanged++;}for(let c=0;c<3;c++)finite&&=Number.isFinite(p.getComponent(i,c));}
 const edge=runtime.extractTerrainSeamSamples(new Mesh(g),-1000),union=[...reference,...edge].filter(v=>v.x>=edge[0].x&&v.x<=edge.at(-1).x);
 let gap=0;for(const v of union)gap=Math.max(gap,Math.abs(runtime.sampleTerrainSeamHeight(edge,v.x)-runtime.sampleTerrainSeamHeight(reference,v.x)));
 const allChecks=[];for(let i=0;i<edge.length-1;i++)for(let j=1;j<4;j++){const x=edge[i].x+(edge[i+1].x-edge[i].x)*j/4;allChecks.push(Math.abs(runtime.sampleTerrainSeamHeight(edge,x)-runtime.sampleTerrainSeamHeight(reference,x)));}
 const baselineEdge=[];for(let i=0;i<p0.count;i++)if(Math.abs(p0.getZ(i)+1000)<.5)baselineEdge.push({x:p0.getX(i),height:p0.getY(i),z:p0.getZ(i)});baselineEdge.sort((a,b)=>a.x-b.x);
 const beforeGap=Math.max(...union.map(v=>Math.abs(runtime.sampleTerrainSeamHeight(baselineEdge,v.x)-runtime.sampleTerrainSeamHeight(reference,v.x))));
 assert.equal(outsideChanged,0);assert.ok(finite&&changed>0);assert.ok(gap<.00005&&Math.max(...allChecks)<.00005);assert.ok(g.userData.compactAlpineBoundary.addedTriangles>0);
 cases.push({name,beforeMaximumProfileDifference:beforeGap,afterMaximumProfileDifference:gap,intermediateMaximum:Math.max(...allChecks),outsideChanged,changed,originalVertices:p0.count,vertices:p.count,originalTriangles:control.index.count/3,triangles:g.index.count/3,diagnostics:g.userData.compactAlpineBoundary});
}
const camera=new PerspectiveCamera(60,390/844,.1,5000);camera.position.set(288,204,-522);camera.lookAt(46,-38,-904);camera.updateMatrixWorld();
const ray=new Raycaster(),material=new MeshBasicMaterial({side:DoubleSide}),rays=[];
for(const [phase,g]of[['before',before],['after',valley]]){
 const coast=runtime.extendJourneyCoast(g.clone(),'conservative','valley'),meshes=[new Mesh(alpine,material),new Mesh(coast,material)];meshes.forEach(m=>m.updateMatrixWorld());
 for(const [x,y]of[[39,297],[41,297],[43,297],[44,313],[46,313],[48,313],[49,331],[51,331],[53,331],[55,340],[58,340],[61,340]]){ray.setFromCamera(new Vector2(x/390*2-1,1-y/844*2),camera);const hits=ray.intersectObjects(meshes).map(h=>({point:h.point.toArray(),face:h.faceIndex}));rays.push({phase,pixel:[x,y],hits:hits.slice(0,2)});if(phase==='after')assert.ok(hits.length,'Former slit sample must hit actual terrain');}
}
assert.equal(rays.find(r=>r.phase==='before'&&r.pixel[0]===55).hits.length,0);
const git=(...a)=>execFileSync('git',a,{encoding:'utf8',maxBuffer:32e6}).trim();const baseline='552fb24b056db577b3de7912337125fe5aaecfc2',changedFiles=[];
const blobHash=b=>createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
for(const row of git('ls-tree','-r',baseline,'--','src','public').split('\n')){const [meta,p]=row.split('\t'),oid=meta.split(' ')[2],current=await fs.readFile(sourceRoot+'/'+p);if(blobHash(current)!==oid&&blobHash(Buffer.from(current.toString().replaceAll('\r\n','\n')))!==oid)changedFiles.push(p);}
assert.deepEqual(changedFiles,['src/components/internal/ridge-production-v116.tsx']);
const detailStart=source.indexOf('function createAlpineGeologyTerrainGeometry'),detailEnd=source.indexOf('function DetailedTerrainChunk',detailStart),oldSource=execFileSync('git',['show',baseline+':src/components/internal/ridge-production-v116.tsx'],{encoding:'utf8',maxBuffer:4e6}).replaceAll('\r\n','\n');
assert.equal(source.slice(detailStart,detailEnd).replaceAll('\r\n','\n'),oldSource.slice(oldSource.indexOf('function createAlpineGeologyTerrainGeometry'),oldSource.indexOf('function DetailedTerrainChunk')),'Detailed Alpine and Valley constructors retained exactly');
const report={at:new Date().toISOString(),passed:true,baseline,sourceToRenderedMaximum,cases,rays,changedRuntimeFiles:changedFiles,preserved:'All other src/public bytes, water guide and water mesh code; detailed terrain constructors; all original compact positions outside the 12 m strip',limits:'Exact positional edge closure; does not certify material continuity, every pixel or physical-device rendering.'};
await fs.writeFile(out+'/geometry-local.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,rays:undefined},null,2));
