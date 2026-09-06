import {createRequire} from 'node:module';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire('C:/Users/Ocean/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/world-history.cjs');
const {chromium}=require('playwright');
const origin=process.env.MADAGIN_REVIEW_ORIGIN??'http://localhost:3131';
const out=path.resolve('output/playwright/madagin-world-progress',process.env.MADAGIN_PUBLIC_EVIDENCE_LABEL??'spatial-release-20260906/history');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={origin,at:new Date().toISOString(),cases:[]};
let activePage;
try {
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]) {
  const context=await browser.newContext({viewport});
  const page=activePage=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${origin}/#blog/before-a-website-rebuild`);
  await page.locator('[data-renderer-state="live"]').waitFor({timeout:60000});
  const panel=page.locator('[data-world-content]');const region=panel.getByRole('region');
  await panel.getByRole('heading',{name:'Before a website rebuild, gather the right things.',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.madaginJourneyState),'paused');
  const canvas=page.locator('canvas');await canvas.evaluate(el=>{el.dataset.historyIdentity='persistent';});
  await region.hover();await page.mouse.wheel(0,430);await page.waitForTimeout(150);
  const savedScroll=await region.evaluate(el=>el.scrollTop);assert.ok(savedScroll>0);
  const savedCamera=await page.evaluate(()=>JSON.parse(document.documentElement.dataset.madaginPublicCamera).position);
  // Arrow keys inside reading move content, not the camera destination.
  await region.focus();await page.keyboard.press('ArrowRight');assert.ok(page.url().endsWith('#blog/before-a-website-rebuild'));
  await page.locator('[data-journey-action="sky"]').click();
  await panel.getByRole('heading',{name:'Selected projects.',exact:true}).waitFor();
  await page.goBack();await panel.getByRole('heading',{name:/Before a website rebuild/}).waitFor();
  const restoredScroll=await region.evaluate(el=>el.scrollTop);
  assert.ok(Math.abs(restoredScroll-savedScroll)<2,`Back lost the reading position: ${savedScroll} -> ${restoredScroll}`);
  await page.goForward();await panel.getByRole('heading',{name:'Selected projects.',exact:true}).waitFor();
  assert.equal(await panel.getByRole('link').filter({hasText:'Sage Burress'}).getAttribute('href'),'/projects/sage-burress');
  await page.keyboard.press('Escape');await panel.waitFor({state:'detached'});
  const world=page.getByRole('group',{name:/Explore the world/});
  await world.focus();await page.keyboard.press('ArrowLeft');await page.locator('[data-world-content="about"]').waitFor();
  assert.deepEqual(await page.evaluate(()=>JSON.parse(document.documentElement.dataset.madaginPublicCamera).position),savedCamera);
  await page.keyboard.press('Escape');await world.focus();await page.keyboard.press('ArrowUp');await page.locator('[data-world-content="projects"]').waitFor();
  await page.keyboard.press('Escape');await world.focus();await page.keyboard.press('ArrowRight');await page.locator('[data-world-content="blog"]').waitFor();
  await page.keyboard.press('Escape');assert.equal(await canvas.getAttribute('data-history-identity'),'persistent');
  // A vertical wheel outside the panel retains ordinary page scrolling.
  await world.hover({position:{x:viewport.width-15,y:viewport.height/2}});await page.mouse.wheel(0,550);await page.waitForTimeout(250);
  assert.ok(await page.evaluate(()=>scrollY>0));assert.equal(new URL(page.url()).hash,'');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
  report.cases.push({viewport,passed:true,deepLink:true,backForward:true,readingScrollRestored:true,keyboardDirections:3,ordinaryWheel:true,persistentCanvas:true,errors});
  await context.close();
 }
 for(const mode of ['reduced-motion','no-webgl','no-javascript']) {
  const context=await browser.newContext({reducedMotion:mode==='reduced-motion'?'reduce':'no-preference',javaScriptEnabled:mode!=='no-javascript'});
  if(mode==='no-webgl') await context.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...rest){return type==='webgl2'||type==='webgl'?null:original.call(this,type,...rest);};});
  const page=activePage=await context.newPage();let requests=0;page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/world/'))requests++;});
  await page.goto(`${origin}/#blog/before-a-website-rebuild`);
  if(mode!=='no-javascript') await page.getByRole('link',{name:'Open this story',exact:false}).click();
  else await page.getByRole('link',{name:'Before a website rebuild, gather the right things.',exact:true}).click();
  await page.getByRole('heading',{name:'Before a website rebuild, gather the right things.',exact:true}).waitFor();
  assert.equal(await page.locator('canvas').count(),0);assert.equal(requests,0);
  await page.getByRole('link',{name:'Prepare your project brief',exact:false}).click();
  await page.waitForURL('**/contact');
  assert.ok(new URL(page.url()).pathname==='/contact');
  report.cases.push({mode,passed:true,articleAndInquiryRoute:true,worldRequests:requests});await context.close();
 }
} catch(error) {report.error=String(error);if(activePage&&!activePage.isClosed())await activePage.screenshot({path:path.join(out,'failure.png')});throw error;}
finally {await browser.close();await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report,null,2));
