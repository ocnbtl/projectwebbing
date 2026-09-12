import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire('C:/Users/Ocean/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/verify.cjs');
const {chromium}=require('playwright');
const origin=process.env.MADAGIN_REVIEW_ORIGIN??'http://127.0.0.1:3142';
const label=process.env.MADAGIN_PUBLIC_EVIDENCE_LABEL??'local';
const out=path.resolve('output/playwright/madagin-world-progress',process.env.MADAGIN_EVIDENCE_CYCLE??'ocean-release-20260906',label);
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={at:new Date().toISOString(),origin,cases:[]};
try {
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 if(new URL(origin).hostname==='127.0.0.1')await context.route('**/_vercel/insights/script.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
 let release;const held=new Promise(resolve=>{release=resolve});let pending=0;
 await context.route('**/world/**',async route=>{pending++;await held;await route.continue()});
 const page=await context.newPage();await page.goto(origin,{waitUntil:'domcontentloaded'});
 await page.locator('[data-public-world-loader="supported"]').waitFor();
 await page.waitForTimeout(1800);
 const status=()=>page.locator('[data-public-world-loader] [role="status"]').textContent();
 assert.ok(pending>0);assert.equal(await status(),'Loading the mountain view.');
 await page.screenshot({path:path.join(out,'loading.png')});report.cases.push({id:'held-assets-loading',pending,status:await status(),pass:true});
 release();
 await page.waitForFunction(()=>document.querySelector('[data-public-world-loader] [role="status"]')?.textContent==='The mountain view is ready.',null,{timeout:60000});
 report.cases.push({id:'visible-world-ready',status:await status(),pass:true});
 await page.evaluate(()=>document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
 await page.waitForFunction(()=>document.querySelector('[data-public-world-loader] [role="status"]')?.textContent==='A still mountain view is displayed.',null,{timeout:10000});
 await page.screenshot({path:path.join(out,'renderer-fallback.png')});
 assert.ok(await page.getByRole('link',{name:"Let's Talk",exact:true}).count()>0);
 report.cases.push({id:'actual-context-loss-fallback',status:await status(),pass:true});
 await context.close();
 // Repeat compact loads after desktop construction in the same browser.
 // A terrain publication during render previously restarted Suspense work
 // indefinitely, leaving a supported device behind its loading poster.
 const compact=await browser.newContext({viewport:{width:390,height:844}});
 if(new URL(origin).hostname==='127.0.0.1')await compact.route('**/_vercel/insights/script.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
 const compactPage=await compact.newPage(),errors=[];
 compactPage.on('pageerror',error=>errors.push(error.message));
 for(let attempt=0;attempt<3;attempt++){
  if(attempt)await compactPage.reload();else await compactPage.goto(origin);
  await compactPage.waitForFunction(()=>document.documentElement.dataset.madaginMeaningfulWorldReady==='true',null,{timeout:60000});
  const result=await compactPage.evaluate(()=>({readyMs:performance.now(),canvases:document.querySelectorAll('canvas').length,trees:JSON.parse(document.documentElement.dataset.madaginRootedTrees??'{}'),renderer:document.querySelector('[data-renderer-state]')?.getAttribute('data-renderer-state')}));
  assert.equal(result.canvases,1);assert.equal(result.renderer,'live');assert.ok(result.trees.valley?.count>0);assert.deepEqual(errors,[]);
  report.cases.push({id:`compact-repeat-load-${attempt+1}`,readyMs:result.readyMs,canvases:result.canvases,renderer:result.renderer,pass:true});
 }
 await compact.close();
} finally {await browser.close();await fs.writeFile(path.join(out,'loading-checks.json'),JSON.stringify(report,null,2)+'\n')}
console.log(JSON.stringify(report));
