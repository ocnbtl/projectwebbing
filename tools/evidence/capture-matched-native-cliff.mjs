// Uses the application's existing MotionValue to hold identical public-rail samples.
// No alternate scene, material, camera path, or visitor-facing review control is added.
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire('C:/Users/Ocean/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/verify.cjs');
const {chromium}=require('playwright');
const root=path.resolve('output/playwright/madagin-world-progress/native-cliff-release-20260908');
await fs.mkdir(root,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={at:new Date().toISOString(),method:'Optimized public renderer. Pause UI, set existing React MotionValue to fixed public-rail progress. Sun and shadow settings unchanged; native cliff geometry and ecology intentionally change. Animation phases not synchronized; still differences are qualitative.',cases:[]};
if(process.env.MADAGIN_CAPTURE_PHASE === "after") report.cases=JSON.parse(await fs.readFile(path.join(root,"matched-views.json"))).cases.filter(c=>c.release==="before");
try {
 for(const [release,origin] of [['before',process.env.MADAGIN_BEFORE_ORIGIN??'http://127.0.0.1:3135'],['after',process.env.MADAGIN_REVIEW_ORIGIN??'http://127.0.0.1:3136']]) {
  if(process.env.MADAGIN_CAPTURE_PHASE && process.env.MADAGIN_CAPTURE_PHASE !== release) continue;
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]) {
   const out=path.join(root,release,String(viewport.width));await fs.mkdir(out,{recursive:true});
   const context=await browser.newContext({viewport,recordVideo:{dir:path.join(out,'video'),size:viewport}});
   if(['127.0.0.1','localhost'].includes(new URL(origin).hostname))await context.route('**/_vercel/insights/script.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   await page.goto(origin);await page.waitForFunction(()=>document.documentElement.dataset.madaginMeaningfulWorldReady==='true',{},{timeout:60000});
   if(release==='after'&&viewport.width>700)await page.waitForFunction(()=>!!document.documentElement.dataset.madaginRidgeCanopy);
   await page.locator('[data-journey-action="pause"]').click();
   const views=[];
   for(const [id,progress] of [['opening',.03],['ridge-held',.17],['ridge-exit',.28],['valley',.34],['lake',.5],['near-canopy',.58],['waterfall',.75],['summit',.98]]) {
    await page.evaluate(progress=>{
     const canvas=document.querySelector('canvas');let fiber=canvas[Object.keys(canvas).find(k=>k.startsWith('__reactFiber'))];
     for(let i=0;fiber&&i<35;i++,fiber=fiber.return){const value=fiber.memoizedProps?.progress;if(value?.set&&value?.get){value.set(progress);return;}}
     throw new Error('Public progress MotionValue not found');
    },progress);
    await page.waitForTimeout(id==='ridge-held'||id==='waterfall'||id==='near-canopy'?12000:1600);
    await page.screenshot({path:path.join(out,`${id}.png`)});
    const data=await page.evaluate(()=>({camera:JSON.parse(document.documentElement.dataset.madaginPublicCamera),nativeCliff:document.documentElement.dataset.madaginNativeCliff?JSON.parse(document.documentElement.dataset.madaginNativeCliff):null,rootedTrees:document.documentElement.dataset.madaginRootedTrees??null,surface:document.documentElement.dataset.madaginTerrainSurface?JSON.parse(document.documentElement.dataset.madaginTerrainSurface):null,canopy:document.documentElement.dataset.madaginRidgeCanopy??null,canvasCount:document.querySelectorAll('canvas').length,render:window.__MADAGIN_RIDGE_BENCHMARK_V116__?.render??null}));
    assert.equal(data.camera.progress,progress);assert.equal(data.canvasCount,1);views.push({id,...data});
   }
   for(const [action,id] of [['ocean','about'],['sky','projects'],['blog','blog']]) {
    await page.locator(`[data-journey-action="${action}"]`).click();await page.waitForTimeout(2400);
    await page.screenshot({path:path.join(out,`${id}.png`)});
    views.push({id,camera:await page.evaluate(()=>JSON.parse(document.documentElement.dataset.madaginPublicCamera))});
   }
   assert.deepEqual(errors,[]);const video=page.video();await context.close();
   report.cases.push({release,origin,viewport,views,errors,recording:path.relative(root,await video.path()).replaceAll('\\','/')});
  }
 }
 const distances=[];
 for(const after of report.cases.filter(c=>c.release==='after')) {
  const before=report.cases.find(c=>c.release==='before'&&c.viewport.width===after.viewport.width);
  for(const a of after.views) {const b=before.views.find(v=>v.id===a.id);
   const position=Math.hypot(...a.camera.position.map((v,i)=>v-b.camera.position[i]));
   const look=Math.hypot(...a.camera.look.map((v,i)=>v-b.camera.look[i]));
   assert.ok(position<1e-8);assert.ok(look<.1);distances.push({width:after.viewport.width,id:a.id,position,look});
  }
 }
 report.cameraParity=distances;
} finally {await browser.close();await fs.writeFile(path.join(root,'matched-views.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({cases:report.cases.length,views:report.cameraParity?.length,errors:report.cases.flatMap(c=>c.errors)}));
