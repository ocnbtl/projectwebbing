import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const root=process.env.MADAGIN_STRUCTURE_EVIDENCE??'output/releases/madagin-upland-structure-20260913',out=root+'/geometry';
const require=createRequire(path.resolve('output/releases/madagin-canopy-20260906/pipeline/package.json'));
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS}=require('@gltf-transform/extensions'),{MeshoptDecoder}=require('meshoptimizer');await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const {sampler,sourceMesh,setIO}=await import(pathToFileURL(path.resolve(out+'/mesh-helpers.mjs')));setIO(io);
const code=await fs.readFile(out+'/fixture-runtime.mjs','utf8');
const call='applyUplandLandform(geometry, detail === "compact");';assert.ok(code.includes(call));
await fs.writeFile(out+'/upland-control.mjs',code.replace(call,''));
const runtime=await import(pathToFileURL(path.resolve(out+'/fixture-runtime.mjs'))),control=await import(pathToFileURL(path.resolve(out+'/upland-control.mjs')));
const {publishUplandGrounding,uplandGroundHeight}=await import(pathToFileURL(path.resolve(out+'/fixture-upland-landform.mjs')));
const ecology=JSON.parse(await fs.readFile('public/world/v116/ecology-alpine-v1.16.json')).instances;
const report={at:new Date().toISOString(),passed:false,cases:[]};
for(const compact of [false,true]){
 const source=await sourceMesh(compact,'alpine'),detail=compact?'compact':'detailed';
 const g=runtime.createAlpineGeologyTerrainGeometry(source,detail),b=control.createAlpineGeologyTerrainGeometry(source,detail),p=g.getAttribute('position'),q=b.getAttribute('position');
 assert.deepEqual(g.index.array,b.index.array);let changed=0,protectedVertices=0,maxIncision=0;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),z=p.getZ(i),delta=p.getY(i)-q.getY(i);assert.equal(x,q.getX(i));assert.equal(z,q.getZ(i));assert.ok(Number.isFinite(delta)&&delta<=.00002&&delta>=-82.0001);
  if(x<=300||x>=900||z<=-1610||z>=-1008){assert.equal(delta,0);protectedVertices++;}
  if(delta<-.001){changed++;maxIncision=Math.max(maxIncision,-delta);}
 }
 assert.ok(changed>100&&maxIncision>50);assert.ok(Array.from(g.getAttribute('normal').array).every(Number.isFinite));
 publishUplandGrounding(compact);const sample=sampler(g);let tested=0,maximumRootError=0;
 // Independent full triangle intersection at retained source ecology positions.
 for(const v of ecology.filter(v=>v[2]>300&&v[2]<900&&v[4]>-1610&&v[4]<-1008)){
  const actual=sample(v[2],v[4]),height=uplandGroundHeight(v[2],v[4],compact);if(!Number.isFinite(actual))continue;
  assert.notEqual(height,null);maximumRootError=Math.max(maximumRootError,Math.abs(actual-height));tested++;
 }
 assert.ok(tested>20&&maximumRootError<.001);
 report.cases.push({compact,changed,protectedVertices,maxIncision,triangles:g.index.count/3,ecologyPositionsTested:tested,maximumRootError,topologyUnchanged:true});g.dispose();b.dispose();
}
report.passed=true;await fs.writeFile(root+'/upland-geometry.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
