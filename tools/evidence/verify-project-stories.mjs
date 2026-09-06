import {createRequire} from 'node:module';
import {promises as fs} from 'node:fs';
import path from 'node:path';
const require=createRequire('C:/Users/Ocean/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/story-check.cjs');
const {chromium}=require('playwright');
const dev=process.env.MADAGIN_REVIEW_ORIGIN??'http://localhost:3110';
const production=process.env.MADAGIN_PUBLIC_ORIGIN;
const out=path.resolve('output/playwright/madagin-world-progress',process.env.MADAGIN_PUBLIC_EVIDENCE_LABEL??'astra-project-publication-20260905');
await fs.mkdir(out,{recursive:true});
const database=JSON.parse(await fs.readFile('src/content/madagin-content.json','utf8'));
const projects=database.items.filter(x=>x.kind==='project'&&['sage-burress','masonry-color-corrections'].includes(x.slug));
const drafts=database.items.filter(x=>x.status==='draft');
if(projects.length!==2)throw Error('Expected the two owner-confirmed projects');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={capturedAt:new Date().toISOString(),dev,production,cases:[],boundaries:[]};
try{
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  const page=await browser.newPage({viewport,reducedMotion:'reduce'});
  for(const item of projects){
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const response=await page.goto(dev+(item.status==='published'?'/projects/':'/project-stories-review?project=')+item.slug,{waitUntil:'networkidle'});
   await page.getByRole('heading',{name:item.title,exact:true}).waitFor();
   await page.evaluate(()=>document.fonts.ready);
   const fonts=await page.evaluate(()=>[...document.fonts].filter(f=>f.status==='loaded'&&!f.family.toLowerCase().includes('fallback')).map(f=>f.family.toLowerCase().replace(/[^a-z]/g,'')));
   if(!['instrumentsans','instrumentserif','plaster'].every(name=>fonts.some(family=>family.includes(name))))throw Error('Branded fonts unavailable: '+fonts.join(','));
   const cover=page.locator(`img[src="${item.coverImageUrl}"]`);
   const loaded=await cover.evaluate(img=>img.complete&&img.naturalWidth===1440&&img.getBoundingClientRect().height>0);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   const robots=await page.locator('meta[name="robots"]').evaluateAll(nodes=>nodes[0]?.getAttribute('content')??null);
   const canonical=await page.locator('link[rel="canonical"]').evaluateAll(nodes=>nodes[0]?.getAttribute('href')??null);
   const image=await page.locator('meta[property="og:image"]').first().getAttribute('content');
   if(item.status==='published'&&(!canonical?.endsWith('/projects/'+item.slug)||!image?.includes(item.coverImageUrl)))throw Error('Incorrect project metadata');
   if(response.status()!==200||!loaded||overflow||errors.length||(item.status==='draft'&&!robots?.includes('noindex')))throw Error(JSON.stringify({item:item.slug,loaded,overflow,errors,robots}));
   await page.screenshot({path:path.join(out,item.slug+'-'+viewport.width+'-heading.png')});
   await cover.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,item.slug+'-'+viewport.width+'-cover.png')});
   await page.getByText(item.body.split('\n\n')[0],{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,item.slug+'-'+viewport.width+'-story.png')});
   await page.locator('#'+item.slug+'-detail').scrollIntoViewIfNeeded();
   await page.screenshot({path:path.join(out,item.slug+'-'+viewport.width+'-proof.png')});
   await page.locator('#'+item.slug+'-mobile').scrollIntoViewIfNeeded();
   await page.screenshot({path:path.join(out,item.slug+'-'+viewport.width+'-mobile-proof.png')});
   const proofImages=await page.locator('img[src*="proof-20260905"]').evaluateAll(images=>images.map(img=>({src:img.getAttribute('src'),loaded:img.complete&&img.naturalWidth>0,alt:img.alt})));
   if(proofImages.length!==2||proofImages.some(img=>!img.loaded||!img.alt))throw Error('Project proof images missing');
   await page.getByRole('link',{name:'Start a project brief'}).click();
   await page.getByRole('heading',{name:'Where are things now?',exact:true}).waitFor();
   report.cases.push({slug:item.slug,status:item.status,viewport,passed:true,loaded,proofImages,overflow,errors,robots,canonical,image,fonts,inquiryLinkWorks:true});
  }
  await page.close();
 }
 if(production){
  const context=await browser.newContext();
  const routes=['/','/projects','/sitemap.xml','/project-stories-review','/world-foundation-review',...projects.map(x=>'/projects/'+x.slug)];
  for(const route of routes){
   const response=await context.request.get(production+route),body=await response.text();
   const leaked=drafts.some(item=>body.includes(item.summary));
   const item=projects.find(item=>route==='/projects/'+item.slug);
   const expected=route.endsWith('-review')||(item&&item.status==='draft')?404:200;
   if(response.status()!==expected||leaked)throw Error(JSON.stringify({route,status:response.status(),expected,leaked}));
   report.boundaries.push({route,status:response.status(),draftTextExposed:leaked,passed:true});
  }
  await context.close();
 }
}finally{await browser.close();await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));
