import {createRequire} from 'node:module';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire('C:/Users/Ocean/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/world-review.cjs');
const {chromium}=require('playwright');
const origin=process.env.MADAGIN_REVIEW_ORIGIN??'http://localhost:3131';
const out=path.resolve('output/playwright/madagin-world-progress',process.env.MADAGIN_PUBLIC_EVIDENCE_LABEL??'spatial-release-20260906/motion');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={origin,at:new Date().toISOString(),classification:'Headless Chrome on this Windows host; viewport emulation, not physical-device or thermal evidence.',budgets:{desktop:{worldBytes:24*1024*1024,heapBytes:384*1024*1024},compact:{worldBytes:8*1024*1024,heapBytes:192*1024*1024},steadyFrameP95Ms:33.3,steadyFrameP99Ms:50,meaningfulWorldMs:8000},cases:[]};
try {
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]) {
  const context=await browser.newContext({viewport,recordVideo:{dir:path.join(out,'video'),size:viewport}});
  if(['127.0.0.1','localhost'].includes(new URL(origin).hostname))await context.route('**/_vercel/insights/script.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(origin);await page.locator('[data-renderer-state="live"]').waitFor({timeout:60000});
  const rendererReadyMarkerMs=await page.evaluate(()=>performance.now());
  await page.waitForFunction(()=>document.documentElement.dataset.madaginMeaningfulWorldReady==='true',undefined,{timeout:60000});
  const meaningfulWorldMs=await page.evaluate(()=>performance.now());
  await page.waitForFunction(()=>document.documentElement.dataset.madaginJourneyState==='complete',undefined,{timeout:90000});
  const views=[];
  for(const [action,id] of [['ocean','ocean-held'],['sky','sky-held'],['blog','blog-held']]) {
   await page.locator(`[data-journey-action="${action}"]`).click();await page.waitForTimeout(2400);
   const samples=await page.evaluate(()=>new Promise(resolve=>{
    const frames=[];const began=performance.now();let previous=began;
    const tick=now=>{frames.push(now-previous);previous=now;if(now-began<12000)requestAnimationFrame(tick);else{frames.sort((a,b)=>a-b);resolve({frames:frames.length,p50:frames[Math.floor(frames.length*.5)],p95:frames[Math.floor(frames.length*.95)],p99:frames[Math.floor(frames.length*.99)]});}};requestAnimationFrame(tick);
   }));
   await page.screenshot({path:path.join(out,`${viewport.width}-${id}.png`)});
   views.push({id,samples,camera:await page.evaluate(()=>JSON.parse(document.documentElement.dataset.madaginPublicCamera))});
  }
  const metrics=await page.evaluate(()=>({
   cloudVolume:document.documentElement.dataset.madaginCloudVolume?JSON.parse(document.documentElement.dataset.madaginCloudVolume):null,readinessPolicy:document.documentElement.dataset.madaginWorldReadyPolicy??null,
   nativeCliff:document.documentElement.dataset.madaginNativeCliff?JSON.parse(document.documentElement.dataset.madaginNativeCliff):null,
   scriptBytes:performance.getEntriesByType('resource').filter(r=>r.initiatorType==='script').reduce((sum,r)=>sum+r.encodedBodySize,0),
   fallingWater:document.documentElement.dataset.madaginFallingWater?JSON.parse(document.documentElement.dataset.madaginFallingWater):null,
   rootedTrees:document.documentElement.dataset.madaginRootedTrees?JSON.parse(document.documentElement.dataset.madaginRootedTrees):null,
   terrainSurface:document.documentElement.dataset.madaginTerrainSurface ? JSON.parse(document.documentElement.dataset.madaginTerrainSurface) : null,
   worldResources:performance.getEntriesByType('resource').filter(r=>new URL(r.name).pathname.startsWith('/world/')).map(r=>({path:new URL(r.name).pathname,bytes:r.encodedBodySize,transfer:r.transferSize,durationMs:r.duration})),
   heapBytes:performance.memory?.usedJSHeapSize??null,
   renderer:window.__MADAGIN_RIDGE_BENCHMARK_V116__?.render??null,
   gpu:window.__MADAGIN_RIDGE_BENCHMARK_V116__?.state?.renderer??null,
  }));
  const worldBytes=metrics.worldResources.reduce((sum,r)=>sum+r.bytes,0);
  const budget=viewport.width<700?report.budgets.compact:report.budgets.desktop;
  if(process.env.MADAGIN_EXPECTED_TERRAIN_SURFACE)assert.equal(metrics.terrainSurface?.version,process.env.MADAGIN_EXPECTED_TERRAIN_SURFACE);
  if(process.env.MADAGIN_EXPECTED_FALLING_WATER)assert.equal(metrics.fallingWater?.version,process.env.MADAGIN_EXPECTED_FALLING_WATER);
  if(process.env.MADAGIN_EXPECTED_NATIVE_CLIFF)assert.equal(metrics.nativeCliff?.version,process.env.MADAGIN_EXPECTED_NATIVE_CLIFF);
  if(process.env.MADAGIN_EXPECTED_READINESS_POLICY)assert.equal(metrics.readinessPolicy,process.env.MADAGIN_EXPECTED_READINESS_POLICY);
  if(process.env.MADAGIN_EXPECTED_ROOTED_TREES){
   const trees=Object.values(metrics.rootedTrees??{});assert.ok(trees.length>0);
   assert.ok(trees.every(tree=>tree.version===process.env.MADAGIN_EXPECTED_ROOTED_TREES));
   assert.ok(trees.every(tree=>tree.compact===(viewport.width<700)));
  }
  assert.deepEqual(errors,[]);
  const video=page.video();await context.close();
  report.cases.push({viewport,rendererReadyMarkerMs,meaningfulWorldMs,worldBytes,...metrics,views,errors,recording:path.relative(out,await video.path()).replaceAll('\\','/'),budgetChecks:{worldBytes:worldBytes<=budget.worldBytes,heap:metrics.heapBytes===null?'UNVERIFIED':metrics.heapBytes<=budget.heapBytes,steadyFrames:views.every(v=>v.samples.p95<=report.budgets.steadyFrameP95Ms&&v.samples.p99<=report.budgets.steadyFrameP99Ms),meaningfulWorld:meaningfulWorldMs<=report.budgets.meaningfulWorldMs}});
 }
} finally {await browser.close();await fs.writeFile(path.join(out,'review.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({cases:report.cases.map(({viewport,budgetChecks,worldBytes,meaningfulWorldMs,errors})=>({viewport,budgetChecks,worldBytes,meaningfulWorldMs,errors}))},null,2));
