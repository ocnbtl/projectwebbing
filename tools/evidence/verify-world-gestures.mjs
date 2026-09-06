import {createRequire} from 'node:module';
import {promises as fs} from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
const require=createRequire('C:/Users/Ocean/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/gestures.cjs');
const {chromium}=require('playwright');
const origin=process.env.MADAGIN_REVIEW_ORIGIN??'http://localhost:3118';
const out=path.resolve('output/playwright/madagin-world-progress',process.env.MADAGIN_PUBLIC_EVIDENCE_LABEL??'astra-world-reading-20260906/gestures');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const results=[];
try {
 for(const width of [320,390]) {
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await page.locator('[data-renderer-state="live"]').waitFor({timeout:60000});
  await page.locator('[data-journey-action="pause"]').click();
  const cdp=await context.newCDPSession(page);
  const swipe=async(x,y,dx,dy)=>{
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
   for(let i=1;i<=8;i++) {await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/8,y:y+dy*i/8}]});await page.waitForTimeout(25);}
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  for(const [destination,x,y,dx,dy] of [['about',width*.75,420,-90,0],['projects',width*.5,480,0,-100],['blog',width*.25,420,90,0]]) {
   await swipe(x,y,dx,dy);
   const panel=page.locator(`[data-world-content="${destination}"]`);await panel.waitFor();
   assert.equal(await page.evaluate(()=>scrollY),0,'World swipe scrolled the page');
   if(destination==='about') {
    const region=panel.getByRole('region');const bounds=await region.boundingBox();
    await swipe(bounds.x+bounds.width*.5,bounds.y+bounds.height*.8,0,-100);await page.waitForTimeout(200);
    assert.ok(await region.evaluate(el=>el.scrollTop>0),'Native touch failed to scroll the reading panel');
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:path.join(out,`${width}-${destination}.png`)});
   await panel.getByRole('button',{name:'Return to journey'}).click();await panel.waitFor({state:'detached'});
  }
  assert.deepEqual(errors,[]);results.push({width,passed:true,touchDirections:3,independentTouchScroll:true,errors});await context.close();
 }
 const context=await browser.newContext({javaScriptEnabled:false});const page=await context.newPage();
 await page.goto(origin);assert.equal(await page.locator('canvas').count(),0);
 for(const [route,heading] of [['/about','A fresh perspective for what comes next.'],['/projects','Selected projects.'],['/blog','From the desk.']]) {
  const response=await page.goto(origin+route);assert.equal(response.status(),200);assert.ok(await page.locator('h1').innerText());
 }
 results.push({noJavaScriptOrdinaryRoutes:true,passed:true});await context.close();
} finally {await browser.close();await fs.writeFile(path.join(out,'verification.json'),JSON.stringify({at:new Date().toISOString(),origin,results},null,2)+'\n');}
console.log(JSON.stringify(results,null,2));
