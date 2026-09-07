import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire('C:/Users/Ocean/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/verify.cjs');
const {chromium}=require('playwright');
const root=path.resolve('output/playwright/madagin-world-progress/ocean-release-20260906');
const label=process.env.MADAGIN_CAPTURE_PHASE??'trial';
const origin=process.env.MADAGIN_REVIEW_ORIGIN??'http://localhost:3110';
await fs.mkdir(root,{recursive:true});
const report={at:new Date().toISOString(),origin,label,method:'Actual public renderer and camera, fixed public rail with UI pause. Ocean clock set to 40 seconds for matched stills only; released to normal elapsed time before uninterrupted held-motion recordings. No alternate scene or shading.',cases:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {for(const viewport of [{width:1440,height:900},{width:390,height:844}]) {
 const out=path.join(root,label,String(viewport.width));await fs.mkdir(out,{recursive:true});
 const context=await browser.newContext({viewport,recordVideo:{dir:path.join(out,'video'),size:viewport}});
 // The local Next server does not host Vercel's analytics endpoint.
 if(new URL(origin).hostname==='127.0.0.1')await context.route('**/_vercel/insights/script.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
 await context.addInitScript(()=>{
  const names=new WeakMap();const proto=WebGL2RenderingContext.prototype;
  const locate=proto.getUniformLocation;const write=proto.uniform1f;
  proto.getUniformLocation=function(program,name){const location=locate.call(this,program,name);
   if(location&&['uTime','uWaveTime'].includes(name)&&this.getAttachedShaders(program).some(s=>this.getShaderSource(s).includes('float oceanHash')))names.set(location,name);
   return location;
  };
  proto.uniform1f=function(location,value){const name=names.get(location);
   if(name&&globalThis.__holdOceanClock){globalThis.__heldOceanUniformWrites=(globalThis.__heldOceanUniformWrites??0)+1;value=name==='uTime'?22:40}
   return write.call(this,location,value);
  };
 });
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto(origin);await page.waitForFunction(()=>document.documentElement.dataset.madaginMeaningfulWorldReady==='true',null,{timeout:60000});
 await page.locator('[data-journey-action="pause"]').click();
 const views=[];
 for(const [id,progress] of [['ridge-coast',.17],['terminal-coast',.98]]) {
  await page.evaluate(progress=>{
   const c=document.querySelector('canvas');let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber'))];
   for(let i=0;f&&i<35;i++,f=f.return){const p=f.memoizedProps?.progress;if(p?.set){p.set(progress);return}}
   throw Error('Public progress absent');
  },progress);
  await page.waitForTimeout(6500);
  if(id==='ridge-coast') {await page.locator('[data-journey-action="ocean"]').click();await page.waitForTimeout(2800)}
  await page.evaluate(()=>{globalThis.__holdOceanClock=true;globalThis.__heldOceanUniformWrites=0});
  await page.waitForTimeout(250);
  const surface=await page.evaluate(()=>({clockHeld:globalThis.__heldOceanUniformWrites>0}));
  assert.ok(surface.clockHeld,'Ocean uniforms held at the declared time');
  await page.screenshot({path:path.join(out,`${id}.png`)});
  const camera=await page.evaluate(()=>JSON.parse(document.documentElement.dataset.madaginPublicCamera));
  views.push({id,camera,...surface});assert.equal(camera.progress,progress);
  await page.evaluate(()=>{globalThis.__holdOceanClock=false});
  await page.waitForTimeout(12000);
 }
 const metadata=await page.evaluate(()=>({waveField:document.documentElement.dataset.madaginOceanWaveField??null,status:document.querySelector('[data-public-world-loader] [role="status"]')?.textContent}));
 const video=page.video();await context.close();
 report.cases.push({viewport,views,errors,metadata,recording:path.relative(root,await video.path()).replaceAll('\\','/')});
 }}finally{await browser.close();await fs.writeFile(path.join(root,`${label}.json`),JSON.stringify(report,null,2)+'\n')}
 console.log(JSON.stringify(report));
 if(report.cases.some(c=>c.errors.length))process.exitCode=1;
