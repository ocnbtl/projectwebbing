import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {Mesh} from 'three';
import assert from 'node:assert/strict';
const root=process.env.MADAGIN_STRUCTURE_EVIDENCE??'output/releases/madagin-coast-relief-20260913',out=root+'/geometry';
const require=createRequire(path.resolve('output/releases/madagin-canopy-20260906/pipeline/package.json'));
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS}=require('@gltf-transform/extensions'),{MeshoptDecoder}=require('meshoptimizer');await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const helperCode=await fs.readFile('tools/evidence/verify-channel-geometry.mjs','utf8');
await fs.writeFile(out+'/mesh-helpers.mjs',"import {BufferGeometry,BufferAttribute,Mesh,Matrix4} from 'three';let io;export const setIO=value=>io=value;\n"+helperCode.slice(helperCode.indexOf('function sampler(g)'),helperCode.indexOf('const results=[];'))+'\nexport {sampler,sourceMesh};');
const {sampler,sourceMesh,setIO}=await import(pathToFileURL(path.resolve(out+'/mesh-helpers.mjs')));setIO(io);
const runtime=await import(pathToFileURL(path.resolve(out+'/fixture-runtime.mjs')));
const report={at:new Date().toISOString(),passed:false,cases:[]};
for(const compact of [false,true]){
 const ridgeSource=await sourceMesh(compact,'ridge'),valleySource=await sourceMesh(compact,'valley'),alpine=await sourceMesh(compact,'alpine');
 const ridge=compact?runtime.createNativeRidgeSurface(runtime.geometrySurfaceForMerge(ridgeSource.geometry,ridgeSource.matrixWorld)):runtime.createRidgeErosionTerrainGeometry(ridgeSource);
 ridge.computeBoundingBox();
 const rb=runtime.extractTerrainSeamSamples(new Mesh(ridge),ridge.boundingBox.min.z);
 const valleySourceGeometry=runtime.createIntegratedWatershedTerrainGeometry(valleySource,compact?[]:runtime.extractTerrainSeamSamples(alpine,-980),compact?[]:runtime.extractTerrainSeamSamples(ridgeSource,-315),compact?2:1,compact?0:1,compact?[]:runtime.extractTerrainSeamSamples(ridgeSource,-287),compact?0:2,compact?'compact':'desktop');
 if(compact)valleySourceGeometry.setAttribute('uv1',valleySourceGeometry.getAttribute('uv').clone());
 let valley=compact?runtime.createExactDetailedRidgeValleyWeldGeometry(valleySourceGeometry,rb,runtime.extractTerrainSeamSamples(new Mesh(ridge),rb[0].z+28),true):valleySourceGeometry;
 const alpineEdge=runtime.extractTerrainSeamSamples(alpine,compact?-1000:-980);
 if(compact){runtime.joinCompactAlpineBoundary(valley,alpine);valley=runtime.extendValleyAlpineFlank(valley,alpineEdge);}
 const flank=valley.userData.alpineFlank,flankGround=sampler(valley);
 assert.ok(flank?.addedTriangles>0,'Fill the wider Alpine front with connected ground');
 let maximumAlpineFlankEdgeError=0;
 for(const p of alpineEdge.filter(p=>p.x>flank.innerX&&p.x<flank.outerX)){
   const error=Math.abs(flankGround(p.x,flank.boundaryZ)-p.height);
   assert.ok(Number.isFinite(error)&&error<.001,'Eastern Alpine shared edge must meet actual source vertices');
   maximumAlpineFlankEdgeError=Math.max(maximumAlpineFlankEdgeError,error);
 }
 for(const t of [.1,.3,.6,.9])assert.ok(Number.isFinite(flankGround(flank.innerX+(flank.outerX-flank.innerX)*t*.9,flank.boundaryZ+10)),'No sky opening under the wider Alpine front');
 const ridgeBoundary=runtime.extractCoastalBoundarySamples(new Mesh(ridge),-310),valleyBoundary=runtime.extractCoastalBoundarySamples(new Mesh(valley),-310);
 valley.computeBoundingBox();
 const westXs=[...new Set(Array.from({length:valley.getAttribute('position').count},(_,i)=>valley.getAttribute('position').getX(i)))].sort((a,b)=>a-b).slice(0,12);
 const tier=compact?'conservative':'high';
 const shoulders=[runtime.createCoastalShoulderGeometry(compact,tier,ridgeBoundary,[],undefined,'ridge'),runtime.createCoastalShoulderGeometry(compact,tier,valleyBoundary,[],undefined,'valley')];
 const originalValleyIndices=valley.index.array.slice(),originalValleyPositions=valley.getAttribute('position').array.slice();
 const coastalValley=runtime.extendJourneyCoast(valley,tier,'valley');
 assert.deepEqual(coastalValley.index.array,originalValleyIndices,'Reshape existing valley; no overlapping added shoulder');
 const vp=coastalValley.getAttribute('position');
 for(let i=0;i<vp.count;i++)if(vp.getX(i)>=-310)assert.equal(vp.getY(i),originalValleyPositions[i*3+1],'Inland water and forest terrain preserved by coast bundle');
 const triangles=shoulders.map(g=>g.index.count/3),heights=[sampler(shoulders[0]),sampler(coastalValley)];
 let maximumRootError=0,roots=0;
 for(const g of shoulders){
   assert.ok(Array.from(g.getAttribute('position').array).every(Number.isFinite));
   assert.ok(Array.from(g.getAttribute('normal').array).every(Number.isFinite));
   assert.ok(Array.from(g.index.array).every(i=>i<g.getAttribute('position').count));
   const sample=sampler(g);
   for(const p of runtime.createCoastalPlacements(g,compact,tier)){
     const error=Math.abs(p[3]-.035-sample(p[2],p[4]));assert.ok(Number.isFinite(error));maximumRootError=Math.max(maximumRootError,error);roots++;
   }
 }
 assert.ok(roots>30&&maximumRootError<.001,'Coastal roots must meet final triangles');
 const actualGround=sampler(coastalValley);
 for(const p of coastalValley.userData.coastalPlacements)assert.ok(Math.abs(p[3]-.035-actualGround(p[2],p[4]))<.001);
 const ridgeZ=ridgeBoundary[0].z,valleyZ=valleyBoundary.at(-1).z,joins=[];
 for(let x=-670;x<=-320;x+=5){const north=heights[0](x,ridgeZ),south=heights[1](x,valleyZ);if(Number.isFinite(north)&&Number.isFinite(south))joins.push({x,north,south,delta:Math.abs(north-south)});}
 const maximumJoinHeightDelta=Math.max(...joins.map(j=>j.delta));
 report.cases.push({compact,triangles,roots,maximumRootError,ridgeZ,valleyZ,maximumJoinHeightDelta,joins,flank,maximumAlpineFlankEdgeError,valleyBounds:{min:valley.boundingBox.min.toArray(),max:valley.boundingBox.max.toArray()},westXs,coastalValleyZ:[valleyBoundary[0].z,valleyBoundary.at(-1).z],coastPreservesValleyTopology:true,actualValleyRoots:coastalValley.userData.coastalPlacements.length});
 await fs.writeFile(root+'/coastal-geometry.json',JSON.stringify(report,null,2));
 assert.ok(Math.abs(ridgeZ-valleyZ)<.001,'Coastal span endpoints must coincide');
 assert.ok(valleyBoundary.at(-1).z-valleyBoundary[0].z>600,'Cross-section must cover the full valley');
 assert.ok(maximumJoinHeightDelta<.06,`Coastal join gap ${maximumJoinHeightDelta}`);
 shoulders.forEach(g=>g.dispose());ridge.dispose();valley.dispose();
}
report.passed=true;await fs.writeFile(root+'/coastal-geometry.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,cases:report.cases.map(({joins,...r})=>r)}));
