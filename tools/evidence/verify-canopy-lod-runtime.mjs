import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire('C:/Users/Ocean/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/world-review.cjs');
const {chromium}=require('playwright');
const origin=process.env.MADAGIN_REVIEW_ORIGIN??'http://127.0.0.1:3152',phase=process.env.MADAGIN_CANOPY_PHASE??'local';
const out=path.resolve('output/releases/madagin-canopy-lod-20260908');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const baseline=phase==='baseline';
let report;
try{
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 if(origin.includes('127.0.0.1'))await page.route('**/_vercel/insights/script.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
 await page.goto(origin);await page.waitForFunction(()=>document.documentElement.dataset.madaginMeaningfulWorldReady==='true',undefined,{timeout:60000});
 await page.waitForFunction(()=>{try{return !!JSON.parse(document.documentElement.dataset.madaginEcologyDebugV116??'{}').valley}catch{return false}},undefined,{timeout:30000});
 const initial=await page.evaluate(()=>({aa:document.querySelector('canvas').getContext('webgl2').getContextAttributes().antialias,ecology:JSON.parse(document.documentElement.dataset.madaginEcologyDebugV116),rooted:JSON.parse(document.documentElement.dataset.madaginRootedTrees??'{}'),camera:JSON.parse(document.documentElement.dataset.madaginPublicCamera)}));
 assert.equal(initial.aa,true);assert.equal(initial.camera.fov,60);
 for(const zone of ['ridge','valley','lake']){
  assert.equal(initial.ecology[zone].rootedMode,'compact-branching-1');
  assert.ok(initial.ecology[zone].rootedCoreInstances>0);assert.equal(initial.rooted[zone].compact,true);
  assert.equal(initial.rooted[zone].count,initial.ecology[zone].rootedCoreInstances);
  if(!baseline)assert.equal(initial.rooted[zone].lod,'compact-crown-lod-1');
  assert.ok(initial.ecology[zone].batches.every(b=>!['ohia_emergent','koa_broad','kukui_round','ridge_wind_form','humid_sapling'].includes(b.key)));
 }
 const flight=await page.evaluate(()=>new Promise((resolve,reject)=>{
  const samples=[],started=performance.now();let previous=started,peakHeap=0,maxTriangles=0;
  const tick=now=>{
   samples.push(now-previous);previous=now;peakHeap=Math.max(peakHeap,performance.memory?.usedJSHeapSize??0);
   maxTriangles=Math.max(maxTriangles,window.__MADAGIN_RIDGE_BENCHMARK_V116__?.render?.triangles??0);
   if(document.documentElement.dataset.madaginJourneyState==='complete'){
    samples.sort((a,b)=>a-b);resolve({durationMs:now-started,frames:samples.length,p50:samples[Math.floor(samples.length*.5)],p95:samples[Math.floor(samples.length*.95)],p99:samples[Math.floor(samples.length*.99)],max:samples.at(-1),peakHeap,maxTriangles});
   }else if(now-started>75000)reject(new Error('Flight did not complete'));else requestAnimationFrame(tick);
  };requestAnimationFrame(tick);
 }));
 const resources=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>new URL(r.name).pathname.startsWith('/world/')).map(r=>new URL(r.name).pathname));
 assert.ok(!resources.some(p=>p.includes('tree-0-near')||p.includes('tree-1-near')||p.includes('Shrub')||p.includes('Fern02')),'Compact must reuse far trees without trial assets');
 assert.deepEqual(errors,[]);
 const checks={representation:initial.ecology.valley.rootedMode==='compact-branching-1',multisampleContext:initial.aa===true,existingFarSourcesOnly:true,fullFlightP95:flight.p95<=33.3,fullFlightP99:flight.p99<=50,peakHeap:flight.peakHeap>0&&flight.peakHeap<=192*1048576};
 report={origin,phase,baseline,classification:'Headless Chrome viewport emulation on this Windows host; rAF cadence and JS heap, not GPU or physical-phone qualification',initial,flight,resources,errors,checks,passed:Object.values(checks).every(Boolean)};
 assert.ok(report.passed,JSON.stringify(checks));
}finally{await browser.close();if(report)await fs.writeFile(path.join(out,`canopy-${phase}.json`),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({origin,passed:report.passed,flight:report.flight,checks:report.checks}));
