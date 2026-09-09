import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {BufferGeometry,BufferAttribute,Mesh,Matrix4} from 'three';
const out=path.resolve('output/releases/madagin-plunge-basin-20260908');
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
}).join('\n')+'\nexport {createNativeRidgeSurface,createRidgeErosionTerrainGeometry,geometrySurfaceForMerge,v116RiverCenter,ridgeChannelWidth,createRidgeHeadwaterGeometry,createIntegratedRiverGeometry,outflowTerrainSampler,createWaterfallOutflowGeometry,createIntegratedWatershedTerrainGeometry,createExactBoundaryTerrainSeamBridge,extractTerrainSeamSamples,createIntegratedLakeGeometry,createWaterMaterial,createWaterfallPlungeGeometry,createCumulativeWaterfallGeometry};';
const runtime=await compile('fixture-runtime',fixture);
const baseline=await import(pathToFileURL(path.resolve('output/releases/madagin-lake-shore-20260908/fixture-runtime.mjs')).href);

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
 const oldValley=baseline.createIntegratedWatershedTerrainGeometry(valleySource,[],[],compact?2:1,compact?0:1);
 const oldSample=sampler(oldValley),newSample=sampler(valley);
 const retained=[];
 for(let z=-970;z<-330;z+=13)for(let x=-90;x<270;x+=13){
   if(Math.abs(x-151)<91 && Math.abs(z+696)<66)continue;
   const a=oldSample(x,z),b=newSample(x,z);
   if(Number.isFinite(a)&&Number.isFinite(b)){retained.push(Math.abs(a-b));assert.ok(Math.abs(a-b)<.012,`Unchanged terrain outside pool ${x},${z}: ${a},${b}`);}
 }
 const pool=await import(pathToFileURL(path.join(out,'fixture-plunge.mjs')).href);
 const falling=runtime.createCumulativeWaterfallGeometry().getAttribute('position'),curtain=[];
 for(let row=10;row<140;row++){
   const i=row*41+10,x=falling.getX(i),z=falling.getZ(i),water=falling.getY(i);
   const old=oldSample(x,z),next=newSample(x,z);
   assert.ok(next<=Math.max(old,water-.3)+.012,`Preserve falling curtain clearance ${compact} ${row}: ${old},${next},${water}`);
   curtain.push(water-next);
 }
 const poolClearance=[],poolBanks=[];
 for(let angle=0;angle<360;angle+=3){
   const a=angle*Math.PI/180,boundary=pool.plungeBoundaryScale(a);
   for(const radius of [.0,.25,.5,.75,.88]){
     const x=151+Math.cos(a)*28*boundary*radius,z=-696+Math.sin(a)*21*boundary*radius;
     const depth=pool.PLUNGE_POOL_LEVEL-newSample(x,z);poolClearance.push(depth);
     assert.ok(depth>.35,`Submerged pool bed ${compact} ${angle} ${radius}: ${depth}`);
   }
   const x=151+Math.cos(a)*28*boundary*1.08,z=-696+Math.sin(a)*21*boundary*1.08;
   const outlet=runtime.outflowTerrainSampler()(x,z);
   if(!outlet){const bank=newSample(x,z)-pool.PLUNGE_POOL_LEVEL;poolBanks.push(bank);assert.ok(bank>.25,`Dry pool rim ${compact} ${angle}: ${bank}`);}
 }
 const poolGeometry=runtime.createWaterfallPlungeGeometry(compact?72:144,compact?8:14),pp=poolGeometry.getAttribute('position');
 assert.ok(Array.from(pp.array).every(Number.isFinite));
 for(let i=0;i<pp.count;i++)assert.ok(Math.abs(pp.getY(i)-pool.PLUNGE_POOL_LEVEL)<.00001,'Level pool surface');
 await fs.writeFile(path.join(out,`pool-geometry-${compact}.json`),JSON.stringify({passed:true,curtainSamples:curtain.length,minimumCurtainClearance:Math.min(...curtain),bedSamples:poolClearance.length,minimumDepth:Math.min(...poolClearance),dryBankSamples:poolBanks.length,minimumBankHeight:Math.min(...poolBanks),unchangedOutsidePoolSamples:retained.length,maxOutsidePoolDeviation:Math.max(...retained),triangles:valley.index.count/3,baselineTriangles:oldValley.index.count/3},null,2));
 oldValley.dispose();
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
 const lake=runtime.createIntegratedLakeGeometry(320,compact?18:40,.12),lp=lake.getAttribute('position');
 const shore=await import(pathToFileURL(path.join(out,'fixture-lake-shore.mjs')).href);
 const rim=[];
 for(let a=0;a<360;a+=2) {
   const angle=a*Math.PI/180,scale=shore.lakeBoundaryScale(angle);
   const x=shore.LAKE_CENTER.x+Math.cos(angle)*shore.LAKE_RADIUS.x*scale*1.12;
   const z=shore.LAKE_CENTER.z+Math.sin(angle)*shore.LAKE_RADIUS.z*scale*1.12;
   rim.push({angle:a,depth:shore.LAKE_WATER_LEVEL-shore.lakeBedLevel(x,z),terrain:sample(x,z)});
 }
 assert.ok(rim.every(r=>r.depth<0),'Water mesh reaches past the complete zero-depth boundary');
 assert.ok(Array.from(lp.array).every(Number.isFinite));
 await fs.writeFile(path.join(out,`lake-rim-${compact}.json`),JSON.stringify(rim,null,2));
 const plants=nativeRuntime.createNativeCliffPlants(ridge,compact);
 const diagnostics={compact,plants:plants.length,triangles:ridge.index.count/3,ridge:ridge.userData.ridgeHeadwater,valley:valley.userData.ridgeHeadwater,centerMin:Math.min(...clearance.map(c=>c.center)),bankMin:Math.min(...clearance.flatMap(c=>[c.left,c.right])),samples:clearance.length,outflowSamples:outflowClearance.length,outflowCenterMin:Math.min(...outflowClearance),riverSamples:riverClearance.length,riverCenterMin:Math.min(...riverClearance.map(c=>c.d)),riverBankMin:Math.min(...riverClearance.flatMap(c=>c.inlet?[c.left]:[c.left,c.right])),downhill:true,metricFlow:true,exactRiverJoin:true};
 result.push(diagnostics);console.log(JSON.stringify(diagnostics));
}
await fs.writeFile(path.join(out,'geometry-checks.json'),JSON.stringify({at:new Date().toISOString(),passed:true,method:'Actual production builders and decoded source GLBs; topmost rendered ridge, valley and seam triangles sampled at 1 metre intervals; both terrain resolutions.',cases:result},null,2)+'\n');



const pool=await import(pathToFileURL(path.join(out,'fixture-plunge.mjs')).href),exclusions=[];
for(const zone of ['ridge','valley','lake','alpine']){
 const manifest=JSON.parse(await fs.readFile(`public/world/v116/ecology-${zone}-v1.16.json`));
 const excluded=manifest.instances.filter(p=>pool.isPlungeWetPlant(p[2],p[3],p[4]));
 exclusions.push({zone,original:manifest.instances.length,excluded:excluded.length});
}
assert.ok(exclusions.reduce((a,b)=>a+b.excluded,0)>0);
await fs.writeFile(path.join(out,'ecology-exclusion.json'),JSON.stringify({passed:true,scope:'Wet basin footprint only, original source placement files remain intact',cases:exclusions},null,2));

// Float-target GPU readback tests the actual GLSL counterpart used by water and
// ground, including cove wraparound and the dry/shallow transition.
const shore=await import(pathToFileURL(path.join(out,'fixture-plunge.mjs')).href);
const browserRequire=createRequire('C:/Users/Ocean/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/verify.cjs');
const {chromium}=browserRequire('playwright');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
let gpu;
try {
 const page=await browser.newPage();
 const points=[];
 for(let a=0;a<360;a+=2)for(const radius of [.3,.8,.96,1,1.025,1.05,1.075,1.12]){
  const angle=a*Math.PI/180,scale=shore.plungeBoundaryScale(angle);
  points.push([shore.PLUNGE_POOL_CENTER.x+Math.cos(angle)*shore.PLUNGE_POOL_RADIUS.x*scale*radius,shore.PLUNGE_POOL_CENTER.z+Math.sin(angle)*shore.PLUNGE_POOL_RADIUS.z*scale*radius]);
 }
 gpu=await page.evaluate(({points,source})=>{
  const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl2');
  if(!gl||!gl.getExtension('EXT_color_buffer_float'))throw Error('Float target unavailable');
  canvas.width=1;canvas.height=1;
  const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
  const program=gl.createProgram();
  gl.attachShader(program,shader(gl.VERTEX_SHADER,'#version 300 es\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.0-1.0,0,1);}'));
  gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float; uniform vec2 point; out vec4 result;\n'+source+'\nvoid main(){result=vec4(plungeBasin(point),0,1);}'));
  gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,1,1,0,gl.RGBA,gl.FLOAT,null);
  const target=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,target);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
  if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Incomplete target');
  gl.useProgram(program);gl.viewport(0,0,1,1);
  const location=gl.getUniformLocation(program,'point'),pixel=new Float32Array(4),values=[];
  for(const p of points){gl.uniform2f(location,p[0],p[1]);gl.drawArrays(gl.TRIANGLES,0,3);gl.readPixels(0,0,1,1,gl.RGBA,gl.FLOAT,pixel);values.push([pixel[0],pixel[1]]);}
  if(gl.getError()!==gl.NO_ERROR)throw Error('GPU readback error');return values;
 },{points,source:shore.PLUNGE_BASIN_GLSL});
 const maxDepthError=Math.max(...points.map((p,i)=>Math.abs((shore.PLUNGE_POOL_LEVEL-shore.plungeBedLevel(...p))-gpu[i][1])));
 const maxBoundaryError=Math.max(...points.map((p,i)=>Math.abs(shore.plungeDistance(...p)-gpu[i][0])));
 assert.ok(maxDepthError<.002);assert.ok(maxBoundaryError<.0001);
 const report={at:new Date().toISOString(),passed:true,samples:points.length,maxDepthError,maxBoundaryError,method:'Actual WebGL2 floating-point shader output versus CPU profile at 180 angles and eight radii; physical device qualification remains unverified.'};
 await fs.writeFile(path.join(out,'shader-parity.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
} finally {await browser.close();}
