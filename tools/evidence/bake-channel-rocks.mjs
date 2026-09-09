import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {BufferGeometry,BufferAttribute,Mesh,Matrix4} from 'three';
const out=path.resolve('output/releases/madagin-channel-rocks-20260908');
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
const {normalizeChannelRock}=await compile('fixture-rock-geometry',await fs.readFile('src/components/internal/channel-rock-geometry.ts','utf8'));
const rockDoc=await io.read('public/world/canopy-v1/moss-rock.glb'),forms=[];
for(const node of rockDoc.getRoot().listNodes().filter(n=>n.getMesh())){
 const primitive=node.getMesh().listPrimitives()[0],g=new BufferGeometry(),a=primitive.getAttribute('POSITION');
 g.setAttribute('position',new BufferAttribute(a.getArray(),3));g.setIndex(new BufferAttribute(primitive.getIndices().getArray(),1));
 const normalized=normalizeChannelRock(g,new Matrix4().fromArray(node.getWorldMatrix()));
 forms.push({family:node.getName(),geometry:normalized});
}
const rockHash=createHash('sha256').update(await fs.readFile('public/world/canopy-v1/moss-rock.glb')).digest('hex');
let seed=43159;const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
const layout=[],water=runtime.createWaterfallOutflowGeometry(84,8).getAttribute('position');
// Deposits collect at a few shoulders. Gaps and unequal groups keep the banks
// legible; no complete pool ring or curtain-edge frame is generated.
for(const [progress,side,count] of [[.15,1,5],[.34,-1,7],[.62,1,6],[.83,-1,4]]){
 for(let j=0;j<count;j++){
  const t=Math.max(.02,Math.min(.96,progress+(random()-.5)*.13));
  const c=runtime.waterfallOutflowCenter(t),a=runtime.waterfallOutflowCenter(t-.001),b=runtime.waterfallOutflowCenter(t+.001);
  const tx=b.x-a.x,tz=b.z-a.z,len=Math.hypot(tx,tz),nx=-tz/len,nz=tx/len;
  const width=(8.8+Math.sin(t*10.4+.5)*.75+t*1.9)*(1-Math.pow(Math.max(0,Math.min(1,(t-.72)/.28)),2)*(3-2*Math.max(0,Math.min(1,(t-.72)/.28)))*.86);
  const size=3.8+random()*4.7,d=width+size*(.02+random()*.42);
  layout.push({kind:'outflow',x:c.x+nx*d*side,z:c.z+nz*d*side,water:water.getY(Math.round(t*84)*9+4),size});
 }
}
for(const [z,side,count] of [[-633,-1,5],[-692,1,6],[-777,-1,5]]){
 for(let j=0;j<count;j++){
  const pz=z+(random()-.5)*17,width=runtime.v116RiverHalfWidth(pz),size=3.8+random()*4.2;
  layout.push({kind:'river',x:runtime.v116RiverCenter(pz)+side*(width+size*(.04+random()*.4)),z:pz,size,water:-999});
 }
}
layout.forEach((p,i)=>Object.assign(p,{family:forms[i%forms.length].family,yaw:random()*Math.PI*2,squash:.76+random()*.32,tint:.74+random()*.25}));
const placement={version:'channel-rocks-1',sourceSha256:rockHash,desktop:[],compact:[]},report=[];
for(const compact of [false,true]){
 const valleySource=await sourceMesh(compact,'valley');
 const ridgeSource=compact?null:await sourceMesh(false,'ridge'),alpineSource=compact?null:await sourceMesh(false,'alpine');
 const valley=runtime.createIntegratedWatershedTerrainGeometry(valleySource,compact?[]:runtime.extractTerrainSeamSamples(alpineSource,-980),compact?[]:runtime.extractTerrainSeamSamples(ridgeSource,-315),compact?2:1,compact?0:1,compact?[]:runtime.extractTerrainSeamSamples(ridgeSource,-287),compact?0:2);
 const sample=sampler(valley),records=[];
 for(const p of layout){
  const form=forms.find(f=>f.family===p.family),pos=form.geometry.getAttribute('position'),h=form.geometry.boundingBox.max.y,cos=Math.cos(p.yaw),sin=Math.sin(p.yaw),points=[];
  for(let i=0;i<pos.count;i++){
   const x=p.x+(pos.getX(i)*cos+pos.getZ(i)*sin)*p.size,z=p.z+(-pos.getX(i)*sin+pos.getZ(i)*cos)*p.size,y=pos.getY(i)*p.size*p.squash;
   points.push({x,y,z,ground:sample(x,z),base:pos.getY(i)<h*.23});
  }
  assert.ok(points.every(q=>Number.isFinite(q.ground)),'Complete terrain support');
  const base=points.filter(q=>q.base),y=Math.min(...base.map(q=>q.ground-q.y))-.055;
  const exposure=Math.max(...points.map(q=>q.y+y-q.ground));
  // A steep shoulder can swallow a scan. Do not raise it into a floating prop.
  if(exposure<.5){records.push({kind:p.kind,family:p.family,x:p.x,z:p.z,rejected:'less than 0.5m exposed after grounding',exposure});continue;}
  const result={family:p.family,x:p.x,y,z:p.z,yaw:p.yaw,size:p.size,squash:p.squash,tint:p.tint};
  placement[compact?'compact':'desktop'].push(result);
  const upperBaseGap=Math.max(...base.map(q=>q.y+y-q.ground));
  assert.ok(upperBaseGap<-.05,'Embedded lower surface');
  // Preserve the central 40% of the rendered flow footprint.
  let minOpen=Infinity;
  for(const q of points){
   const flow=runtime.outflowTerrainSampler()(q.x,q.z);
   if(flow)minOpen=Math.min(minOpen,flow.distance/flow.width);
  }
  if(p.kind==='outflow')assert.ok(minOpen>.4,`Unobstructed core: ${minOpen}`);
  records.push({...result,kind:p.kind,exposure,baseSamples:base.length,upperBaseGap,minimumFlowFraction:Number.isFinite(minOpen)?minOpen:null,triangles:form.geometry.index.count/3});
 }
 const accepted=records.filter(r=>!r.rejected);
 report.push({compact,accepted:accepted.length,rejected:records.filter(r=>r.rejected),maxBaseGap:Math.max(...accepted.map(r=>r.upperBaseGap)),minimumExposure:Math.min(...accepted.map(r=>r.exposure)),triangles:accepted.reduce((n,r)=>n+r.triangles,0),records});
 valley.dispose();console.log(JSON.stringify({compact,accepted:accepted.length,triangles:report.at(-1).triangles}));
}
await fs.writeFile('src/components/internal/channel-rock-placements.json',JSON.stringify(placement,null,2)+'\n');
await fs.writeFile(path.join(out,'rock-grounding.json'),JSON.stringify({passed:true,sourceSha256:rockHash,method:'Original seven source forms, normalized identically in bake and renderer; each lower 23 percent of vertex height embedded at least 0.05m in actual valley triangles. Separate desktop and compact fits; dry gaps between deposits; middle 40 percent of outflow reserved.',cases:report},null,2)+'\n');
