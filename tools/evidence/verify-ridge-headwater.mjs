import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {BufferGeometry,BufferAttribute,Mesh,Matrix4} from 'three';
const out=path.resolve('output/releases/madagin-headwater-20260908');
const require=createRequire(path.resolve('output/releases/madagin-canopy-20260906/pipeline/package.json'));
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS}=require('@gltf-transform/extensions'),{MeshoptDecoder}=require('meshoptimizer');await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const compile=async(name,source)=>{const p=path.join(out,name+'.mjs');await fs.writeFile(p,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText);return import(pathToFileURL(p).href);};
await compile('fixture-headwater',await fs.readFile('src/components/internal/ridge-headwater.ts','utf8'));
const field=JSON.parse(await fs.readFile('src/components/internal/native-cliff-field.json'));
let native=(await fs.readFile('src/components/internal/native-cliff.tsx','utf8')).replace('import field from "./native-cliff-field.json";',`const field=${JSON.stringify(field)};`).replace('from "./ridge-headwater"','from "./fixture-headwater.mjs"').replace('import {RootedTrees} from "./rooted-trees";','const RootedTrees=()=>null;');
await compile('fixture-native',native);
const source=await fs.readFile('src/components/internal/ridge-production-v116.tsx','utf8');
const parsed=ts.createSourceFile('fixture.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const fixture=parsed.statements.map(n=>{
 if(!ts.isImportDeclaration(n)||!(n.moduleSpecifier.text.startsWith('.')||n.moduleSpecifier.text.startsWith('@')))return n.getText();
 if(n.importClause?.isTypeOnly)return '';
 if(n.moduleSpecifier.text==='./ridge-headwater')return n.getText().replace('./ridge-headwater','./fixture-headwater.mjs');
 if(n.moduleSpecifier.text==='./native-cliff')return `import {applyNativeCliff,nativeCliffWeight,NativeCliffPlants} from './fixture-native.mjs';`;
 return [...(n.importClause?.namedBindings?.elements??[])].filter(e=>!e.isTypeOnly).map(e=>`const ${e.name.text}={};`).join('\n');
}).join('\n')+'\nexport {createNativeRidgeSurface,createRidgeErosionTerrainGeometry,geometrySurfaceForMerge,v116RiverCenter,ridgeChannelWidth,createRidgeHeadwaterGeometry,createIntegratedRiverGeometry,outflowTerrainSampler,createWaterfallOutflowGeometry,createIntegratedWatershedTerrainGeometry,createExactBoundaryTerrainSeamBridge,extractTerrainSeamSamples};';
const runtime=await compile('fixture-runtime',fixture);

const nativeRuntime=await import(pathToFileURL(path.join(out,"fixture-native.mjs")).href);
function sampler(g){
 const p=g.getAttribute('position'),index=g.index,bins=new Map(),cell=12,at=i=>index?index.getX(i):i;
 for(let i=0;i<(index?.count??p.count);i+=3){const ids=[at(i),at(i+1),at(i+2)],xs=ids.map(j=>p.getX(j)),zs=ids.map(j=>p.getZ(j));for(let z=Math.floor(Math.min(...zs)/cell);z<=Math.floor(Math.max(...zs)/cell);z++)for(let x=Math.floor(Math.min(...xs)/cell);x<=Math.floor(Math.max(...xs)/cell);x++){const key=`${x},${z}`,bucket=bins.get(key)??[];bucket.push(i);bins.set(key,bucket);}}
 return (x,z)=>{let y=-Infinity;for(const i of bins.get(`${Math.floor(x/cell)},${Math.floor(z/cell)}`)??[]){const a=at(i),b=at(i+1),c=at(i+2),ax=p.getX(a),az=p.getZ(a),bx=p.getX(b),bz=p.getZ(b),cx=p.getX(c),cz=p.getZ(c),d=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(d)<1e-9)continue;const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/d,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/d;if(u>=-1e-6&&v>=-1e-6&&u+v<=1.000001)y=Math.max(y,u*p.getY(a)+v*p.getY(b)+(1-u-v)*p.getY(c));}return y;};
}
const result=[];
async function sourceMesh(compact,zone) {
 const doc=await io.read(compact?`public/world/v116/terrain-${zone}-v1.16.glb`:'public/world/v115/madagin-ridge-to-valley-high-v1.15.glb');
 const node=doc.getRoot().listNodes().find(n=>compact?n.getMesh():n.getName()===`${zone==="valley"?"TROPICAL_VALLEY":"RIDGE"}_V115_HIGH`),primitive=node.getMesh().listPrimitives()[0],g=new BufferGeometry();
 for(const [semantic,name] of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']]){const a=primitive.getAttribute(semantic);if(a)g.setAttribute(name,new BufferAttribute(a.getArray(),a.getElementSize()));}
 g.setIndex(new BufferAttribute(primitive.getIndices().getArray(),1));const mesh=new Mesh(g);mesh.matrixWorld=new Matrix4().fromArray(node.getWorldMatrix());return mesh;
}
for(const compact of [false,true]){
 const ridgeSource=await sourceMesh(compact,'ridge'),valleySource=await sourceMesh(compact,'valley');
 const ridge=compact?runtime.createNativeRidgeSurface(runtime.geometrySurfaceForMerge(ridgeSource.geometry,ridgeSource.matrixWorld)):runtime.createRidgeErosionTerrainGeometry(ridgeSource);
 const valley=runtime.createIntegratedWatershedTerrainGeometry(valleySource,[],[],compact?2:1,compact?0:1);
 const rb=runtime.extractTerrainSeamSamples(new Mesh(ridge)),vb=runtime.extractTerrainSeamSamples(new Mesh(valley));
 const bridge=runtime.createExactBoundaryTerrainSeamBridge({ridge:rb,valley:vb,ridgeInterior:runtime.extractTerrainSeamSamples(new Mesh(ridge),rb[0].z+28),valleyInterior:runtime.extractTerrainSeamSamples(new Mesh(valley),vb[0].z-28)});
 const samples=[ridge,valley,...(bridge?[bridge]:[])].map(sampler),sample=(x,z)=>Math.max(...samples.map(f=>f(x,z)));
 const channel=runtime.createRidgeHeadwaterGeometry(),cp=channel.getAttribute('position'),flow=channel.getAttribute('flow'),clearance=[];
 for(let row=15;row<244;row++){
  const i=row*9+4,x=cp.getX(i),z=cp.getZ(i),water=cp.getY(i),width=runtime.ridgeChannelWidth(z);
  const center=water-sample(x,z),left=sample(x-width*2,z)-water,right=sample(x+width*2,z)-water;
  clearance.push({z,center,left,right});
  assert.ok(Number.isFinite(center)&&center>.15,`Submerged bed ${compact} ${z}: ${center}`);
  assert.ok(Math.min(left,right)>0,`Continuous bank ${compact} ${z}: ${left},${right}`);
  for(const col of [2,6]){const j=row*9+col;assert.ok(cp.getY(j)-sample(cp.getX(j),cp.getZ(j))>.1,`Submerged across-channel bed ${compact} ${z}`);}
 }
 for(let row=1;row<244;row++) {assert.ok(cp.getY(row*9+4)<cp.getY((row-1)*9+4),'Downhill water grade');assert.ok(flow.getY(row*9)>flow.getY((row-1)*9),'Downstream metric flow');}
 const river=runtime.createIntegratedRiverGeometry(118,8),rp=river.getAttribute('position');
 for(let col=0;col<=8;col++)for(const axis of ['getX','getY','getZ'])assert.ok(Math.abs(cp[axis](243*9+col)-rp[axis](col))<1e-5,`Shared river join ${axis} ${col}`);
 const riverClearance=[],outflowAt=runtime.outflowTerrainSampler();
 for(let row=0;row<100;row++) {const i=row*9+4,x=rp.getX(i),z=rp.getZ(i),water=rp.getY(i),width=runtime.ridgeChannelWidth(z);const d=water-sample(x,z),left=sample(x-width*2,z)-water,right=sample(x+width*2,z)-water;const inlet=!!outflowAt(x+width*2,z);riverClearance.push({z,d,left,right,inlet});assert.ok(Number.isFinite(d)&&d>.1,`River bed ${compact} ${z}: ${d}`);assert.ok(left>0&&(inlet||right>0),`River banks ${compact} ${z}: ${left}, ${right}`);if(row)assert.ok(water<rp.getY((row-1)*9+4),'Downhill valley river');}
 const outflow=runtime.createWaterfallOutflowGeometry(84,8).getAttribute('position'),outflowClearance=[];
 for(let row=1;row<=84;row++){const i=row*9+4,d=outflow.getY(i)-sample(outflow.getX(i),outflow.getZ(i));outflowClearance.push(d);assert.ok(Number.isFinite(d)&&d>.2,`Open waterfall outflow ${compact} ${row}: ${d}`);}
 const plants=nativeRuntime.createNativeCliffPlants(ridge,compact);
 const diagnostics={compact,plants:plants.length,triangles:ridge.index.count/3,ridge:ridge.userData.ridgeHeadwater,valley:valley.userData.ridgeHeadwater,centerMin:Math.min(...clearance.map(c=>c.center)),bankMin:Math.min(...clearance.flatMap(c=>[c.left,c.right])),samples:clearance.length,outflowSamples:outflowClearance.length,outflowCenterMin:Math.min(...outflowClearance),riverSamples:riverClearance.length,riverCenterMin:Math.min(...riverClearance.map(c=>c.d)),riverBankMin:Math.min(...riverClearance.flatMap(c=>c.inlet?[c.left]:[c.left,c.right])),downhill:true,metricFlow:true,exactRiverJoin:true};
 result.push(diagnostics);console.log(JSON.stringify(diagnostics));
}
await fs.writeFile(path.join(out,'geometry-checks.json'),JSON.stringify({at:new Date().toISOString(),passed:true,method:'Actual production builders and decoded source GLBs; topmost rendered ridge, valley and seam triangles sampled at 1 metre intervals; both terrain resolutions.',cases:result},null,2)+'\n');


