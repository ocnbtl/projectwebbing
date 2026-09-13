import fs from 'node:fs/promises';import path from 'node:path';import {pathToFileURL} from 'node:url';import {createRequire} from 'node:module';import assert from 'node:assert/strict';import ts from 'typescript';import {Mesh} from 'three';
const root=process.env.MADAGIN_STRUCTURE_EVIDENCE??'output/releases/madagin-forest-depth-20260912',out=root+'/geometry';
const require=createRequire(path.resolve('output/releases/madagin-canopy-20260906/pipeline/package.json'));
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS}=require('@gltf-transform/extensions'),{MeshoptDecoder}=require('meshoptimizer');await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const {sampler,sourceMesh,setIO}=await import(pathToFileURL(path.resolve(out+'/mesh-helpers.mjs')));setIO(io);
const runtime=await import(pathToFileURL(path.resolve(out+'/fixture-runtime.mjs')));
const {createNativeValleyPlants}=await import(pathToFileURL(path.resolve(out+'/fixture-native-valley.mjs')));
for(const name of ['forest-stands','shore-rubble']){
 let source=await fs.readFile(`src/components/internal/${name}.tsx`,'utf8');
 for(const [a,b]of [['lake-shore','fixture-lake-shore'],['channel-profile','fixture-channel-profile'],['ridge-headwater','fixture-headwater'],['cascade-contact','fixture-cascade'],['plunge-basin','fixture-plunge']])source=source.replaceAll(`"./${a}"`,`"./${b}.mjs"`);
 source=source.replace('import {RootedTrees} from "./rooted-trees";','const RootedTrees=()=>null;').replace('import {useTerrainSurface} from "./terrain-surface";','const useTerrainSurface=()=>null;');
 await fs.writeFile(out+'/'+name+'.mjs',ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText);
}
const {createForestStandPlacements}=await import(pathToFileURL(path.resolve(out+'/forest-stands.mjs'))),{createShoreRubble}=await import(pathToFileURL(path.resolve(out+'/shore-rubble.mjs')));
const report={at:new Date().toISOString(),passed:false,cases:[]};
for(const compact of [false,true]){
 const rs=await sourceMesh(compact,'ridge'),vs=await sourceMesh(compact,'valley'),as=await sourceMesh(compact,'alpine');
 const ridge=compact?runtime.createNativeRidgeSurface(runtime.geometrySurfaceForMerge(rs.geometry,rs.matrixWorld)):runtime.createRidgeErosionTerrainGeometry(rs);
 let valley=runtime.createIntegratedWatershedTerrainGeometry(vs,compact?[]:runtime.extractTerrainSeamSamples(as,-980),compact?[]:runtime.extractTerrainSeamSamples(rs,-315),compact?2:1,compact?0:1,compact?[]:runtime.extractTerrainSeamSamples(rs,-287),compact?0:2,compact?'compact':'desktop');
 if(compact){valley.setAttribute("uv1",valley.getAttribute("uv").clone());ridge.computeBoundingBox();const rm=new Mesh(ridge),edge=runtime.extractTerrainSeamSamples(rm,ridge.boundingBox.min.z),interior=runtime.extractTerrainSeamSamples(rm,edge[0].z+28);valley=runtime.createExactDetailedRidgeValleyWeldGeometry(valley,edge,interior,true);runtime.joinCompactAlpineBoundary(valley,as);}
 const waters=[runtime.createIntegratedLakeGeometry(128,32,0),runtime.createIntegratedRiverGeometry(compact?74:118,8),runtime.createWaterfallOutflowGeometry(compact?36:62,8),runtime.createWaterfallPlungeGeometry(64,12)].map(sampler);
 for(const [zone,g]of [['ridge',ridge],['valley',valley]]){
  const ground=sampler(g),original=g.getAttribute('position').array.slice(),start=performance.now(),{placements}=createForestStandPlacements(g,compact,zone),generationMs=performance.now()-start;
  assert.ok(placements.length>50,zone+' must contain substantial stands');assert.deepEqual(g.getAttribute('position').array,original,'Planting never modifies the ground');
  let maximumRootError=0,wetRoots=0;
  for(const p of placements){maximumRootError=Math.max(maximumRootError,Math.abs(ground(p[2],p[4])-(p[3]+.12)));if(zone==='valley'&&waters.some(w=>w(p[2],p[4])>p[3]-.1))wetRoots++;}
  assert.ok(maximumRootError<.001,`${zone} roots differ from independent triangle sampler: ${maximumRootError}`);assert.equal(wetRoots,0,'No added tree roots under actual lake, river, outflow or pool water');
  const rubble=zone==='valley'?createShoreRubble(g,compact):[];let maximumRubbleGroundError=0;
  for(const rock of rubble){maximumRubbleGroundError=Math.max(maximumRubbleGroundError,Math.abs(ground(rock.x,rock.z)-rock.ground));assert.ok(rock.y<rock.ground);assert.ok(waters.every(w=>w(rock.x,rock.z)<=rock.ground),'Rubble root stays on dry rendered bank');}
  console.log(JSON.stringify({compact,zone,trees:placements.length,maximumRootError,rubble:rubble.length,maximumRubbleGroundError}));
  if(zone==='valley')assert.ok(rubble.length>10,'Rubble must exist on the rendered collar');assert.ok(maximumRubbleGroundError<.001);
  let nativePlants=null;
  if(zone==='valley'){
   const natives=createNativeValleyPlants(g,compact);let maximumFootprintError=0,wet=0;
   for(const p of natives){
    const footprint=Array.from({length:9},(_,i)=>ground(p[2]+(i?Math.cos(i*Math.PI/4)*.32:0),p[4]+(i?Math.sin(i*Math.PI/4)*.32:0)));
    maximumFootprintError=Math.max(maximumFootprintError,Math.abs(Math.min(...footprint)-(p[3]+.06)));
    if(waters.some(w=>w(p[2],p[4])>p[3]-.1))wet++;
   }
   assert.ok(natives.length>40);assert.ok(maximumFootprintError<.001);assert.equal(wet,0);
   nativePlants={count:natives.length,maximumFootprintError,wetRoots:wet};
  }
  report.cases.push({compact,zone,trees:placements.length,maximumRootError,wetRoots,rubble:rubble.length,maximumRubbleGroundError,nativePlants,generationMs});g.dispose();
 }
}
report.passed=true;await fs.writeFile(root+'/forest-stand-geometry.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
