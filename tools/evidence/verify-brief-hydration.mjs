import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire('C:/Users/Ocean/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/brief-check.cjs');
const {chromium}=require('playwright');
const origin=process.env.MADAGIN_PUBLIC_ORIGIN??'http://127.0.0.1:3167';
const phase=process.env.MADAGIN_BRIEF_PHASE??'local';
const baseline=phase==='baseline';
const out=path.resolve(process.env.MADAGIN_BRIEF_EVIDENCE_ROOT??'output/releases/madagin-brief-ready-20260909');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const cases=[];
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];let release;const held=[];
  const gate=new Promise(resolve=>{release=resolve});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/_next/static/**/*.js',async route=>{held.push(route.request().url());await gate;await route.continue();});
  try{
   await page.goto(origin+'/contact',{waitUntil:'commit'});
   const first=page.locator('#contact-question button').first();await first.waitFor();
   assert.ok(held.length>0,'JavaScript is actually held, not a warm hydrated page');
   const enabledBefore=await first.isEnabled();assert.equal(enabledBefore,baseline);
   await page.screenshot({path:path.join(out,`hydration-${phase}-${width}-held.png`)});
   if(baseline){
    await first.click();release();
    await page.getByRole('heading',{name:'Where are things now?'}).evaluate(h=>new Promise(resolve=>{const tick=()=>document.activeElement===h?resolve():requestAnimationFrame(tick);tick();}));
    assert.equal(await first.getAttribute('aria-pressed'),'false','Baseline early choice is lost');
    assert.equal(await page.getByRole('button',{name:'Continue',exact:true}).isEnabled(),false);
   }else{
    // The normal browser action must wait for handlers, then apply once.
    const click=first.click();release();await click;
    await page.waitForFunction(()=>document.querySelector('#contact-question button')?.getAttribute('aria-pressed')==='true');
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.getByRole('heading',{name:'What needs to change?',exact:true}).waitFor();
   }
   assert.deepEqual(errors,[]);cases.push({width,scenario:'held JavaScript',heldScripts:held.length,enabledBefore,earlyChoiceLost:baseline,passed:true});
  }finally{release();await context.close();}
 }
 if(!baseline){
  const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const page=await context.newPage();
  await page.goto(origin+'/contact');
  // Playwright text/role engines skip noscript subtrees even in no-JS contexts.
  const notice=page.locator('noscript p');await notice.waitFor();assert.match(await notice.innerText(),/Enable JavaScript to prepare a brief/);
  assert.equal(await page.locator('#contact-question button').first().isEnabled(),false);
  // Poll from the runner: page timers/actionability loops can stall with JS disabled.
  let opacity;const deadline=Date.now()+3000;
  do{opacity=await page.locator('#contact-question').evaluate(el=>getComputedStyle(el).opacity);if(opacity==='1')break;await new Promise(resolve=>setTimeout(resolve,100));}while(Date.now()<deadline);
  assert.equal(opacity,'1','Fallback must be fully visible after its entrance animation');
  await page.screenshot({path:path.join(out,`hydration-${phase}-nojs.png`),fullPage:true});
  await page.locator('noscript a[href="/projects"]').focus();await page.keyboard.press('Enter');await page.waitForURL('**/projects');
  assert.ok(new URL(page.url()).pathname==='/projects');
  cases.push({width:390,scenario:'JavaScript disabled',truthfulNotice:true,ordinaryProjectsRoute:true,passed:true});await context.close();
 }
}finally{await browser.close();await fs.writeFile(path.join(out,`hydration-${phase}.json`),JSON.stringify({at:new Date().toISOString(),origin,phase,baseline,classification:baseline?'Reproduced prior defect, not an accepted behavior':'Regression against genuinely held scripts and no-JavaScript navigation',cases,passed:cases.length===(baseline?2:3)&&cases.every(c=>c.passed)},null,2)+'\n');}
console.log(JSON.stringify({origin,phase,cases}));
