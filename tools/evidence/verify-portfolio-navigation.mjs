import {createRequire} from 'node:module';
import {promises as fs} from 'node:fs';
import path from 'node:path';
const require=createRequire('C:/Users/Ocean/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/portfolio-check.cjs');
const {chromium}=require('playwright');
const base=process.env.MADAGIN_PUBLIC_ORIGIN??'http://127.0.0.1:3114';
const out=path.resolve('output/playwright/madagin-world-progress',process.env.MADAGIN_PUBLIC_EVIDENCE_LABEL??'astra-portfolio-navigation-20260905');
await fs.mkdir(out,{recursive:true});
const database=JSON.parse(await fs.readFile('src/content/madagin-content.json','utf8'));
const projects=database.items.filter(item=>item.kind==='project'&&item.status==='published');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={capturedAt:new Date().toISOString(),base,cases:[]};
try{
 for(const viewport of [{width:1440,height:900},{width:768,height:1024},{width:390,height:844}]){
  const page=await browser.newPage({viewport,reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base,{waitUntil:'networkidle'});
  const section=page.getByRole('region',{name:'Selected projects',exact:true});
  await section.scrollIntoViewIfNeeded();
  await section.locator('img').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
  const homeImages=await section.locator('img').evaluateAll(images=>images.map(img=>({loaded:img.complete&&img.naturalWidth>0,fit:getComputedStyle(img).objectFit})));
  if(homeImages.length!==projects.length||homeImages.some(img=>!img.loaded||img.fit!=='contain'))throw Error('Homepage portfolio evidence is missing or cropped');
  await page.screenshot({path:path.join(out,'home-projects-'+viewport.width+'.png')});
  await section.getByRole('link',{name:'Read the story'}).first().click();
  await page.getByRole('heading',{name:projects[0].title,exact:true}).waitFor();
  await page.getByRole('link',{name:'Back to projects',exact:true}).click();
  await page.getByRole('heading',{name:'Sites people remember.',exact:true}).waitFor();
  for(const item of projects){
   const imageLink=page.getByRole('link',{name:'View '+item.title,exact:true});
   await imageLink.scrollIntoViewIfNeeded();
   await imageLink.locator('img').evaluate(img=>img.decode());
   await page.screenshot({path:path.join(out,'index-'+item.slug+'-'+viewport.width+'.png')});
  }
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  await page.getByRole('link',{name:'View Masonry Color Corrections',exact:true}).click();
  await page.getByRole('heading',{name:'Masonry Color Corrections',exact:true}).waitFor();
  await page.getByRole('link',{name:/Another project Sage Burress/}).click();
  await page.getByRole('heading',{name:'Sage Burress',exact:true}).waitFor();
  await page.getByRole('link',{name:'Start a project brief'}).click();
  await page.getByRole('heading',{name:'Where are things now?',exact:true}).waitFor();
  if(errors.length||overflow)throw Error(JSON.stringify({errors,overflow}));
  report.cases.push({viewport,passed:true,homeImages,overflow,errors,journey:'Homepage project → story → index image → second story → next project → brief'});
  await page.close();
 }
 const context=await browser.newContext();
 const sitemap=await (await context.request.get(base+'/sitemap.xml')).text();
 const sitemapIncludesProjects=projects.every(item=>sitemap.includes('/projects/'+item.slug));
 if(!sitemapIncludesProjects)throw Error('Published projects missing from sitemap');
 report.sitemapIncludesProjects=sitemapIncludesProjects;
 await context.close();
}finally{await browser.close();await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));
