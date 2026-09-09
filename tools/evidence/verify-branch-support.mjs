import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {BufferGeometry,BufferAttribute,Mesh,Matrix4,CatmullRomCurve3,Vector3} from 'three';
const out=path.resolve(process.env.MADAGIN_BRANCH_EVIDENCE ?? 'output/releases/madagin-branch-canopy-20260909');
const branchSource=path.resolve(process.env.MADAGIN_BRANCH_SOURCE ?? '.');
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

const {prepareTrees}=await import(pathToFileURL(path.join(out,'test-preparation.mjs')).href);
const {Group,MeshStandardMaterial}=await import('three');
const doc=await io.read(path.join(branchSource,'public/world/branch-canopy-v1/island-tree-01-far.glb')),group=new Group();
for(const node of doc.getRoot().listNodes())if(node.getMesh())for(const p of node.getMesh().listPrimitives()){
 const g=new BufferGeometry();for(const [semantic,name]of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']]){const a=p.getAttribute(semantic);if(a)g.setAttribute(name,new BufferAttribute(a.getArray().slice(),a.getElementSize(),a.getNormalized()));}g.setIndex(new BufferAttribute(p.getIndices().getArray().slice(),1));const mat=new MeshStandardMaterial();mat.name=p.getMaterial().getName();const mesh=new Mesh(g,mat);mesh.matrix.fromArray(node.getWorldMatrix());mesh.matrixAutoUpdate=false;group.add(mesh);
}group.updateMatrixWorld(true);
const parts=prepareTrees(group,group,true),foot=[];for(const part of parts){if(/leaves/.test(part.material.name))continue;const a=part.geometry.getAttribute('position');for(let i=0;i<a.count;i++)if(a.getY(i)<.005)foot.push(new Vector3().fromBufferAttribute(a,i));}
const support=JSON.parse(await fs.readFile(path.join(branchSource,'src/components/internal/branch-canopy-support.json')));
const placements=JSON.parse(await fs.readFile('src/components/internal/bank-canopy-placements.json')),cases=[];
for(const compact of [false,true]){
 const valleySource=await sourceMesh(compact,'valley'),ridge=compact?null:await sourceMesh(false,'ridge'),alpine=compact?null:await sourceMesh(false,'alpine');
 const valley=runtime.createIntegratedWatershedTerrainGeometry(valleySource,compact?[]:runtime.extractTerrainSeamSamples(alpine,-980),compact?[]:runtime.extractTerrainSeamSamples(ridge,-315),compact?2:1,compact?0:1,compact?[]:runtime.extractTerrainSeamSamples(ridge,-287),compact?0:2);const sample=sampler(valley),records=[];
 for(const [i,p]of placements[compact?'compact':'desktop'].entries()){
  const signature=Math.abs(Math.round(p[2]*.73+p[4]*.47+p[9]*31));if(signature%2)continue;
  const h=(p[1]===0?17.5:p[1]===1?10:5.3)*Math.max(.55,Math.min(1.45,p[7])),yaw=p[5]+(signature%17)*.19;
  const matrix=new Matrix4().makeRotationY(yaw).scale(new Vector3(h*(.9+(signature%9)*.025),h,h*(.91+(signature%7)*.025))).setPosition(p[2],p[3]-.025,p[4]);
  const gaps=foot.map(v=>{const a=v.clone().applyMatrix4(matrix);return a.y-sample(a.x,a.z);});assert.ok(gaps.every(Number.isFinite));
  const embed=support[compact?'compact':'desktop'][i]??0; assert.equal(embed,Math.ceil(Math.max(0,Math.max(...gaps)+.03)*1000)/1000);const maxGap=Math.max(...gaps)-embed;assert.ok(maxGap<=-.03);records.push({i,embed,originalMaxGap:Math.max(...gaps),maxGap,minGap:Math.min(...gaps)-embed,rootGap:p[3]-.025-embed-sample(p[2],p[4])});
 }
 cases.push({compact,footVertices:foot.length,count:records.length,maxFootGap:Math.max(...records.map(r=>r.maxGap)),maxRootGap:Math.max(...records.map(r=>r.rootGap)),records});valley.dispose();
}
await fs.writeFile(path.join(out,'root-support-checks.json'),JSON.stringify({passed:true,cases,scope:'Actual source base vertices within 0.005 source height against actual rendered terrain triangles. Positive gap means suspended source base.'},null,2));console.log(JSON.stringify(cases.map(({records,...c})=>c)));