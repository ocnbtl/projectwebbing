import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
const require=createRequire('C:/Users/Ocean/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/brief-check.cjs');
const {chromium}=require('playwright');
const out=path.resolve('output/playwright/madagin-world-progress',process.env.MADAGIN_PUBLIC_EVIDENCE_LABEL??'astra-product-verification');
await fs.mkdir(out,{recursive:true});
const base=process.env.MADAGIN_PUBLIC_ORIGIN ?? 'http://localhost:3110';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={capturedAt:new Date().toISOString(),base,cases:[]};
try {
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]) {
  const context=await browser.newContext({viewport,reducedMotion:'reduce',acceptDownloads:true});
  await context.addInitScript(() => {
    // An isolated clipboard fixture avoids changing the user's system clipboard.
    Object.defineProperty(navigator, 'clipboard', {configurable:true,value:{writeText:async text=>{
      if(window.__qaDenyClipboard)throw new DOMException('Clipboard denied','NotAllowedError');
      window.__qaBriefClipboard=text;
    }}});
  });
  const page=await context.newPage();
  const requests=[],errors=[];
  page.on('request',r=>requests.push({url:r.url(),method:r.method(),body:r.postData()}));
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/contact',{waitUntil:'domcontentloaded'});
  await page.getByText("Direct inquiries aren't open yet.",{exact:false}).waitFor();
  await page.screenshot({path:path.join(out,`contact-${viewport.width}-start.png`)});
  const selected=[];
  for(let step=0;step<4;step++){
   if(await page.getByRole('button',{name:'Continue',exact:true}).isEnabled())throw Error('Continue should require an answer');
   const choice=page.locator('#contact-question button').first();
   selected.push((await choice.innerText()).trim()); await choice.click();
   await page.getByRole('button',{name:'Continue',exact:true}).click();
  }
  await page.getByLabel('Project context').fill('MADAGIN_QA_FIXTURE: We need a clearer website for our established studio. This is a local browser test.');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('textbox',{name:'Name',exact:true}).fill('QA Fixture');
  await page.getByRole('textbox',{name:'Email',exact:true}).fill('not-an-email');
  if(await page.getByRole('button',{name:'Continue',exact:true}).isEnabled())throw Error('Invalid email accepted');
  await page.getByRole('textbox',{name:'Email',exact:true}).fill('madagin-qa@example.test');
  await page.getByRole('textbox',{name:'Company optional'}).fill('Local fixture only');
  await page.getByRole('textbox',{name:'Name',exact:true}).press('Enter');
  if(!await page.getByRole('textbox',{name:'Email',exact:true}).isVisible())throw Error('Implicit submit changed the page');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('heading',{name:'Your project, in focus.'}).waitFor();
  const edit=page.getByRole('button',{name:'Edit',exact:true}).nth(4); await edit.click();
  const revised='MADAGIN_QA_FIXTURE: Revised context retained after review. A clearer site, better navigation, and a usable next step.';
  await page.getByLabel('Project context').fill(revised);
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  const pending=page.waitForEvent('download');
  await page.getByRole('button',{name:'Save your brief',exact:true}).click();
  const download=await pending;
  const file=path.join(out,`brief-${viewport.width}.txt`); await download.saveAs(file);
  const text=await fs.readFile(file,'utf8');
  for(const expected of [...selected,revised,'QA Fixture','madagin-qa@example.test','Local fixture only','has not been sent'])if(!text.includes(expected))throw Error('Brief missing '+expected);
  await page.getByRole('status').filter({hasText:'Download started.'}).waitFor();
  await page.getByRole('button',{name:'Copy brief text',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Brief copied.'}).waitFor();
  if(await page.evaluate(()=>window.__qaBriefClipboard)!==text)throw Error('Copy and download disagree');
  await page.evaluate(()=>{window.__qaDenyClipboard=true;});
  await page.getByRole('button',{name:'Copy brief text',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Copy is unavailable'}).waitFor();
  if(!await page.getByRole('button',{name:'Save your brief',exact:true}).isEnabled())throw Error('Copy denial blocked download');
  await page.evaluate(()=>window.scrollTo({top:0,behavior:"instant"}));
  await page.screenshot({path:path.join(out,`contact-${viewport.width}-review.png`),fullPage:false});
  await page.getByRole("button",{name:"Save your brief",exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(out,`contact-${viewport.width}-saved.png`),fullPage:false});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
  const leaked=requests.filter(r=>(r.url+(r.body??'')).includes('MADAGIN_QA_FIXTURE')||(r.url+(r.body??'')).includes('madagin-qa@example.test'));
  if(errors.length||overflow||leaked.length)throw Error(JSON.stringify({errors,overflow,leaked}));
  report.cases.push({viewport,passed:true,errors,overflow,inquiryTransmissions:leaked.length,copyMatchesDownload:true,clipboardDenialRecovered:true,filename:download.suggestedFilename(),briefSha256:createHash('sha256').update(text).digest('hex'),interaction:'All six steps, validation, Enter prevention, edit, save, copy, and clipboard-denial recovery; all revised answers retained'});
  await context.close();
 }
} finally {await browser.close(); await fs.writeFile(path.join(out,'contact-checks.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));

