// Exercise the production mesh builders against their decoded source geometry.
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {BufferGeometry,BufferAttribute,Mesh,Matrix4} from 'three';
const root=path.resolve('.'),out=path.resolve('output/releases/madagin-native-cliff-20260908');
const baseline='70666ce936a8adca6f58394cdea7f5a9a7370402';
const require=createRequire(path.join(root,'output/releases/madagin-canopy-20260906/pipeline/package.json'));
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS}=require('@gltf-transform/extensions'),{MeshoptDecoder}=require('meshoptimizer');
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const field=JSON.parse(await fs.readFile('src/components/internal/native-cliff-field.json','utf8'));
const current=await fs.readFile('src/components/internal/ridge-production-v116.tsx','utf8');
const previous=execFileSync('git',['show',`${baseline}:src/components/internal/ridge-production-v116.tsx`],{encoding:'utf8',maxBuffer:8*1024*1024});
const parse=s=>ts.createSourceFile('fixture.tsx',s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const funcs=s=>new Map(parse(s).statements.filter(n=>ts.isFunctionDeclaration(n)&&n.name).map(n=>[n.name.text,n.getText().replaceAll('\r\n','\n')]));
const old=funcs(previous),now=funcs(current);
const changed=['useEcologyManifest','CompactJourneyTerrain','MobileTerminalTerrain','createRidgeErosionTerrainGeometry','DetailedTerrainChunk','createConnectedRidgeGeometry'];
const identical=[];for(const [name,body] of old){if(changed.includes(name))continue;assert.equal(now.get(name),body,name);identical.push(name);}
const added=[...now.keys()].filter(n=>!old.has(n));assert.deepEqual(added,['createNativeRidgeSurface']);
const compile=async(name,source)=>{const target=path.join(out,name+'.mjs');await fs.writeFile(target,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText);return import(pathToFileURL(target).href);};
let native=await fs.readFile('src/components/internal/native-cliff.tsx','utf8');
native=native.replace('import field from "./native-cliff-field.json";',`const field=${JSON.stringify(field)};`).replace('import {RootedTrees} from "./rooted-trees";','const RootedTrees=()=>null;');
const cliff=await compile('fixture-native',native);
async function renderer(name,source,extra){
 source=parse(source).statements.map(n=>{
  if(!ts.isImportDeclaration(n)||!(n.moduleSpecifier.text.startsWith('.')||n.moduleSpecifier.text.startsWith('@')))return n.getText();
  if(n.importClause?.isTypeOnly)return '';
  if(n.moduleSpecifier.text==='./native-cliff')return `import {applyNativeCliff,nativeCliffWeight,NativeCliffPlants} from './fixture-native.mjs';`;
  return [...(n.importClause?.namedBindings?.elements??[])].filter(e=>!e.isTypeOnly).map(e=>`const ${e.name.text}={};`).join('\n');
 }).join('\n')+`\nexport {${extra}};`;
 return compile(name,source);
}
const before=await renderer('fixture-before',previous,'createRidgeErosionTerrainGeometry,geometrySurfaceForMerge');
const after=await renderer('fixture-after',current,'createRidgeErosionTerrainGeometry,createNativeRidgeSurface,geometrySurfaceForMerge,extractCoastalBoundarySamples,createCoastalShoulderGeometry,createConnectedRidgeGeometry');
const doc=await io.read('public/world/v115/madagin-ridge-to-valley-high-v1.15.glb');
const node=doc.getRoot().listNodes().find(n=>n.getName()==='RIDGE_V115_HIGH');assert.ok(node);
const primitive=node.getMesh().listPrimitives()[0],geometry=new BufferGeometry();
for(const [semantic,name] of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']]){const a=primitive.getAttribute(semantic);if(a)geometry.setAttribute(name,new BufferAttribute(a.getArray(),a.getElementSize()));}
geometry.setIndex(new BufferAttribute(primitive.getIndices().getArray(),1));
const mesh=new Mesh(geometry);mesh.matrixWorld=new Matrix4().fromArray(node.getWorldMatrix());
const base=before.createRidgeErosionTerrainGeometry(mesh),candidate=after.createRidgeErosionTerrainGeometry(mesh);
const p=base.getAttribute('position'),q=candidate.getAttribute('position');assert.equal(p.count,q.count);
let outside=0,inside=0,collar=0,maxSourceError=0;
for(let i=0;i<p.count;i++){
 const x=p.getX(i),z=p.getZ(i),w=cliff.nativeCliffWeight(x,z);assert.equal(q.getX(i),x);assert.equal(q.getZ(i),z);
 if(w===0){assert.equal(q.getY(i),p.getY(i));outside++;}
 else if(w===1){const e=Math.abs(q.getY(i)-cliff.nativeCliffElevation(x,z));assert.ok(e<.00002);maxSourceError=Math.max(e,maxSourceError);inside++;}else collar++;
}
assert.ok(inside>1000&&outside>1000&&collar>1000);
assert.deepEqual(Array.from(base.index.array),Array.from(candidate.index.array));
const compactDoc=await io.read('public/world/v116/terrain-ridge-v1.16.glb');
const compactNode=compactDoc.getRoot().listNodes().find(n=>n.getMesh());assert.ok(compactNode);
const compactPrimitive=compactNode.getMesh().listPrimitives()[0],compactSource=new BufferGeometry();
const cp=compactPrimitive.getAttribute('POSITION');compactSource.setAttribute('position',new BufferAttribute(cp.getArray(),cp.getElementSize()));
compactSource.setIndex(new BufferAttribute(compactPrimitive.getIndices().getArray(),1));
const compactMesh=new Mesh(compactSource);compactMesh.matrixWorld=new Matrix4().fromArray(compactNode.getWorldMatrix());
const compact=after.createNativeRidgeSurface(after.geometrySurfaceForMerge(compactSource,compactMesh.matrixWorld));
const results=[];for(const [tier,g] of [['desktop',candidate],['compact',compact]]){
 const placements=cliff.createNativeCliffPlants(g,tier==='compact'),sample=cliff.nativeCliffSampler(g);assert.ok(placements.length>100);
 let maxGroundError=0;for(const plant of placements){const error=Math.abs(plant[3]+.06-sample(plant[2],plant[4]));assert.ok(error<1e-9);maxGroundError=Math.max(error,maxGroundError);}
 assert.ok([...g.getAttribute('position').array].every(Number.isFinite));
 const sourceMesh=tier==='compact'?compactMesh:mesh;
 const boundary=after.extractCoastalBoundarySamples(sourceMesh,-310);assert.ok(boundary.length);
 const heightfield=tier==='desktop'?JSON.parse(await fs.readFile('public/world/v116/coast-heightfield-bw.json')):undefined;
 const shoulder=after.createCoastalShoulderGeometry(tier==='compact','balanced',boundary,[],heightfield);
 const terminal=after.createConnectedRidgeGeometry(sourceMesh,shoulder,tier==='desktop');assert.ok(terminal,'Terminal merge must exist');
 assert.ok(terminal.index.count>1000&&terminal.getAttribute('normal')&&terminal.getAttribute('uv'));
 const terminalSample=cliff.nativeCliffSampler(terminal);let maxTerminalRootDrift=0;
 for(const plant of placements){const drift=Math.abs(terminalSample(plant[2],plant[4])-sample(plant[2],plant[4]));assert.ok(drift<.001);maxTerminalRootDrift=Math.max(drift,maxTerminalRootDrift);}
 results.push({tier,asset:tier==='compact'?'v116/terrain-ridge-v1.16.glb':'v115/madagin-ridge-to-valley-high-v1.15.glb',vertices:g.getAttribute('position').count,triangles:g.index.count/3,plants:placements.length,maxGroundError,rootBurialMeters:.085,terminalMergePassed:true,maxTerminalRootDrift,source:g.userData.nativeCliff});
 terminal.dispose();shoulder.dispose();
}
const report={passed:true,baseline,identicalRendererFunctions:identical.length,changed,added,outsideVerticesExact:outside,sourceInteriorVertices:inside,authoredCollarVertices:collar,maxSourceInterpolationErrorMeters:maxSourceError,topologyRetainedDesktop:true,sourceYawDegrees:field.sceneYawDegrees,results,limits:'The interior samples a native mixed-source NOAA field. Triangulation and a 40 m collar remain authored. Root-center grounding is tested, not every lateral root. No integrated hydrology or human realism gate is established.'};
await fs.writeFile(path.join(out,'geometry-scope.json'),JSON.stringify(report,null,2)+'\n');
for(const g of [geometry,base,candidate,compact,compactSource])g.dispose();console.log(JSON.stringify(report,null,2));
