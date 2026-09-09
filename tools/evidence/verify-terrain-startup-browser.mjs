import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire('C:/Users/Ocean/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/verify.cjs');
const {chromium}=require('playwright');
const root='output/releases/madagin-terrain-startup-20260908';
const origins={before:process.env.MADAGIN_BEFORE_ORIGIN??'http://127.0.0.1:3157',after:process.env.MADAGIN_REVIEW_ORIGIN??'http://127.0.0.1:3158'};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const cases=[];
try {
 for(const width of [1440,390])for(let trial=0;trial<4;trial++)for(const phase of trial%2?['after','before']:['before','after']){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900}});
  await context.route('**/_vercel/insights/script.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(origins[phase]);
  await page.waitForFunction(()=>document.documentElement.dataset.madaginMeaningfulWorldReady==='true',undefined,{timeout:60000});
  const result=await page.evaluate(()=>({readyMs:performance.now(),construction:document.documentElement.dataset.madaginTerrainConstruction??null,policy:document.documentElement.dataset.madaginWorldReadyPolicy,worldResources:performance.getEntriesByType('resource').filter(r=>new URL(r.name).pathname.startsWith('/world/')).map(r=>({path:new URL(r.name).pathname,encodedBytes:r.encodedBodySize,transferBytes:r.transferSize})),heap:performance.memory?.usedJSHeapSize??null}));
  assert.deepEqual(errors,[]);assert.equal(result.policy,'terrain-and-ecology-1');assert.equal(result.construction,phase==='after'?'typed-refinement-1':null);
  cases.push({width,trial,phase,origin:origins[phase],...result,errors});console.log(JSON.stringify({width,trial,phase,readyMs:result.readyMs}));
  await context.close();
 }
}finally{await browser.close();}
const median=xs=>{const a=[...xs].sort((a,b)=>a-b);return (a[Math.floor((a.length-1)/2)]+a[Math.ceil((a.length-1)/2)])/2;};
const summary=[1440,390].map(width=>{
 const before=cases.filter(c=>c.width===width&&c.phase==='before'),after=cases.filter(c=>c.width===width&&c.phase==='after');
 const beforeMedianMs=median(before.map(c=>c.readyMs)),afterMedianMs=median(after.map(c=>c.readyMs));
 // Startup may overlap optional later loads; mandatory readiness is separately order-tested.
 return {width,beforeMedianMs,afterMedianMs,reductionPercent:(1-afterMedianMs/beforeMedianMs)*100,targetMs:8000,targetPassed:afterMedianMs<=8000,beforeRange:before.map(c=>c.readyMs),afterRange:after.map(c=>c.readyMs)};
});
assert.ok(summary.find(c=>c.width===1440).reductionPercent>=10,'At least 10% median desktop readiness improvement');
assert.ok(summary.find(c=>c.width===390).reductionPercent>-5,'No material compact readiness regression');
await fs.writeFile(root+'/browser-startup.json',JSON.stringify({at:new Date().toISOString(),passed:true,method:'Four fresh-context paired trials per viewport, alternating order, same running optimized local baseline/candidate builds and headless Chrome process. Context caches empty; OS/GPU caches not reset. No other task performance jobs run concurrently. Not physical-device evidence.',cases,summary},null,2)+'\n');
console.log(JSON.stringify(summary));
