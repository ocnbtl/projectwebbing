import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
const out='output/releases/madagin-falls-20260907';
const current=await fs.readFile('src/components/internal/ridge-production-v116.tsx','utf8');
const previous=execFileSync('git',['show','741b96d:src/components/internal/ridge-production-v116.tsx'],{encoding:'utf8',maxBuffer:8*1024*1024});
const funcs=source=>new Map(ts.createSourceFile('renderer.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX).statements.filter(n=>ts.isFunctionDeclaration(n)&&n.name).map(n=>[n.name.text,n.getText().replaceAll('\r\n','\n')]));
const old=funcs(previous),now=funcs(current),changed=['createWaterfallMaterial','createCumulativeWaterfallGeometry','WaterfallMist','createImpactFoamMaterial','WaterNetwork'];
const removed=['seededRandom','waterfallCurtainWindow','waterfallCurtainState','waterfallCascadeState','createSecondaryWaterfallGeometry'];
const identical=[];for(const [name,body] of old){if(removed.includes(name)){assert.ok(!now.has(name));continue;}if(changed.includes(name))continue;assert.equal(now.get(name),body,`Unrelated renderer function changed: ${name}`);identical.push(name);}
const modulePath=path.resolve(out,'test-falling-water.mjs');
await fs.writeFile(modulePath,ts.transpileModule(await fs.readFile('src/components/internal/falling-water.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText);
const {createFallingWaterGeometry,fallingTravelTime,FALLING_WATER}=await import(pathToFileURL(modulePath).href);
// Evaluate the actual retained feed authority and wrapper, without mounting React.
const names=['saturate','smoothRange','waterfallUpperProgress','waterfallUpperCenter','waterfallUpperLevel','waterfallUpperHalfWidth','createCumulativeWaterfallGeometry'];
const constants=current.match(/const WATERFALL_TOP =[^\n]+/)[0]+current.match(/const WATERFALL_BOTTOM =[^\n]+/)[0]+current.match(/const WATERFALL_HEADWATER_START_Z =[^\n]+/)[0];
const fixture=ts.transpileModule(constants+`function smoothCoastalStep(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);}`+names.map(n=>now.get(n)).join('\n')+'\nreturn {geometry:createCumulativeWaterfallGeometry(),feed:waterfallUpperHalfWidth(-730),center:waterfallUpperCenter(-730)};',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const {geometry,feed,center}=new Function('createFallingWaterGeometry',fixture)(createFallingWaterGeometry);
const position=geometry.getAttribute('position'),time=geometry.getAttribute('travelTime'),rows=geometry.userData.waterfallBody.rows,stride=geometry.userData.waterfallBody.columns+1;
assert.ok([...position.array,...time.array].every(Number.isFinite));
const lipX=Array.from({length:stride},(_,i)=>position.getX(i));
assert.ok(Math.abs((Math.max(...lipX)-Math.min(...lipX))/2-feed)<.0001);
assert.ok(Math.abs((Math.max(...lipX)+Math.min(...lipX))/2-center)<.0001);
const lipZ=Array.from({length:stride},(_,i)=>position.getZ(i));assert.ok(Math.max(...lipZ)-Math.min(...lipZ)>.9);
for(let r=1;r<=rows;r++){assert.ok(position.getY(r*stride)<position.getY((r-1)*stride));assert.ok(time.getX(r*stride)>time.getX((r-1)*stride));}
const times=[0,10,30,60].map(drop=>({drop,seconds:fallingTravelTime(drop),speed:Math.sqrt(FALLING_WATER.entrySpeed**2+2*FALLING_WATER.gravity*drop)}));
assert.ok(times.every((v,i)=>i===0||v.speed>times[i-1].speed));
const report={passed:true,identicalFunctions:identical.length,changed,removed,lipHalfWidth:feed,topCenter:center,body:geometry.userData.waterfallBody,gravityTiming:times,vertices:position.count,triangles:geometry.index.count/3,limits:'Checks actual geometry and retained function scope. No fluid simulation, terrain collision clearance, visual realism or physical-device performance is proved by these invariants.'};
await fs.writeFile(`${out}/geometry-scope.json`,JSON.stringify(report,null,2)+'\n');geometry.dispose();console.log(JSON.stringify(report,null,2));
