// Exercise both completion orders; ecology readiness alone cannot reveal a void.
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire('C:/Users/Ocean/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/verify.cjs');
const {chromium}=require('playwright');
const origin=process.env.MADAGIN_REVIEW_ORIGIN??'http://127.0.0.1:3165';
const out=path.resolve('output/playwright/madagin-world-progress',process.env.MADAGIN_EVIDENCE_CYCLE??'leaf-lighting-release-20260909',process.env.MADAGIN_PUBLIC_EVIDENCE_LABEL??'canopy-ordering-local');
await fs.mkdir(out,{recursive:true});
const report={origin,at:new Date().toISOString(),cases:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 for(const {width,constrained} of [{width:1440,constrained:false},{width:390,constrained:false},{width:1440,constrained:true}])for(const held of constrained?['tree-model']:['tree-model','tree-textures']){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900}});
  if(constrained)await context.addInitScript(()=>{Object.defineProperty(navigator,'deviceMemory',{value:4,configurable:true});Object.defineProperty(navigator,'hardwareConcurrency',{value:8,configurable:true});});
  await context.addInitScript(()=>{window.__MADAGIN_RIDGE_STAGES_V116__=[{at:-1,zone:'ridge',stage:2,label:'riparian-ecology-ready'},{at:-1,zone:'ridge',stage:0,label:'ridge-terrain-ready'},{at:-1,zone:'ridge',stage:2,label:'ridge-ecology-ready'}];});
  if(new URL(origin).hostname==='127.0.0.1')await context.route('**/_vercel/insights/script.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  let release;const gate=new Promise(resolve=>{release=resolve;});let pending=0;
  const asset=held==='tree-model'?'**/world/leaf-canopy-v1/*-far.glb':'**/world/rooted-trees-v1/textures/*.webp';
  await context.route(asset,async r=>{pending++;await gate;await r.continue().catch(()=>{});});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(origin,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(held=>(window.__MADAGIN_RIDGE_STAGES_V116__??[]).some(s=>s.at>0&&s.zone==='ridge'&&(held==='terrain'?s.stage===2&&s.label==='ridge-ecology-ready':s.stage===0&&s.label.includes('terrain-ready'))),held,{timeout:60000});
   await page.waitForTimeout(2200);assert.ok(pending>0);
   const waiting=await page.evaluate(()=>({status:document.querySelector('[data-public-world-loader] [role="status"]').textContent,state:document.querySelector('[data-public-world]').dataset.rendererState,opacity:getComputedStyle(document.querySelector('canvas')).opacity,ready:document.documentElement.dataset.madaginMeaningfulWorldReady??null,controls:document.querySelectorAll('[data-journey-action]').length}));
   await page.screenshot({path:path.join(out,`${width}${constrained?"-conservative":""}-${held}-held.png`)});
   assert.equal(waiting.status,'Loading the mountain view.');assert.equal(waiting.state,'loading');assert.equal(waiting.opacity,'0');assert.equal(waiting.ready,null);assert.equal(waiting.controls,0);
   release();
   await page.waitForFunction(()=>document.documentElement.dataset.madaginWorldReadyPolicy==='terrain-and-ecology-1'&&document.querySelector('[data-public-world]').dataset.rendererState==='live',null,{timeout:60000});
   await page.waitForTimeout(300);
   assert.ok(await page.evaluate(()=>JSON.parse(document.documentElement.dataset.madaginRiparianEcology).version==='riparian-ecology-1'));
   assert.equal(await page.evaluate(()=>JSON.parse(document.documentElement.dataset.madaginRiparianEcology).compact),width===390||constrained);
   const bank=await page.evaluate(()=>JSON.parse(document.documentElement.dataset.madaginGroundcoverBank));
   assert.equal(bank.version,'groundcover-bank-1');assert.equal(bank.compact,width===390||constrained);assert.equal(bank.count,width===390||constrained?0:655); const crowns=await page.evaluate(()=>JSON.parse(document.documentElement.dataset.madaginRootedTrees)["bank-canopy"]); assert.equal(crowns.leafCoverage,'leaf-coverage-1'); assert.equal(crowns.count,260); assert.equal(crowns.compact,width===390||constrained);
   if(constrained)assert.equal(await page.locator('[data-public-world]').getAttribute('data-quality-tier'),'conservative');
   assert.ok(await page.evaluate(()=>window.__MADAGIN_RIDGE_STAGES_V116__.some(s=>s.at>0&&s.label==='riparian-ecology-ready')));
   assert.equal(await page.locator('canvas').evaluate(c=>getComputedStyle(c).opacity),'1');assert.deepEqual(errors,[]);
   const ready=await page.evaluate(()=>({policy:document.documentElement.dataset.madaginWorldReadyPolicy,status:document.querySelector('[data-public-world-loader] [role="status"]').textContent,stages:window.__MADAGIN_RIDGE_STAGES_V116__.filter(s=>s.at>0&&s.zone==='ridge')}));
   await page.screenshot({path:path.join(out,`${width}${constrained?"-conservative":""}-${held}-ready.png`)});
   report.cases.push({width,constrained,held,pending,waiting,ready,errors,passed:true});
  }catch(error){report.cases.push({width,constrained,held,passed:false,error:String(error)});throw error;}
  finally{release();await context.close();}
 }
}catch(error){process.exitCode=1;report.error=String(error);}
finally{await browser.close();await fs.writeFile(path.join(out,'ordering.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({origin,cases:report.cases.map(({width,constrained,held,passed,error})=>({width,constrained,held,passed,error}))}));
