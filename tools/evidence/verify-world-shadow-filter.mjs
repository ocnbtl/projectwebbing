// Inspect programs actually bound by the public WebGL renderer. Merely setting
// a renderer constant is insufficient: unsupported constants can compile Basic.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire('C:/Users/Ocean/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/world-review.cjs');
const {chromium}=require('playwright');
const origin=process.env.MADAGIN_REVIEW_ORIGIN??'http://127.0.0.1:3166';
const phase=process.env.MADAGIN_SHADOW_PHASE??'local';
const out=path.resolve('output/releases/madagin-shadow-filter-20260909');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const cases=[];
try {
 for(const width of [1440,390]) {
  const context=await browser.newContext({viewport:{width,height:width===390?844:900}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.__MADAGIN_SHADOW_AUDIT__=[];
   const prototype=WebGL2RenderingContext.prototype,original=prototype.useProgram,seen=new WeakSet();
   prototype.useProgram=function(program){
    original.call(this,program);
    if(!program||seen.has(program))return;
    seen.add(program);
    const shaders=this.getAttachedShaders(program)??[];
    for(const shader of shaders){
     if(this.getShaderParameter(shader,this.SHADER_TYPE)!==this.FRAGMENT_SHADER)continue;
     const source=this.getShaderSource(shader)??'';
     if(!/^#define USE_SHADOWMAP\b/m.test(source))continue;
     const kind=source.match(/^#define SHADOWMAP_TYPE_(\w+)/m)?.[1]??'MISSING';
     window.__MADAGIN_SHADOW_AUDIT__.push({kind,name:source.match(/^#define SHADER_NAME (.+)/m)?.[1],receiver:source.includes('float getShadow('),linked:this.getProgramParameter(program,this.LINK_STATUS),filteredSampler:source.includes('sampler2DShadow shadowMap'),radiusAware:source.includes('shadowRadius * texelSize.x')});
    }
   };
  });
  if(origin.includes('127.0.0.1'))await page.route('**/_vercel/insights/script.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.goto(origin);await page.waitForFunction(()=>document.documentElement.dataset.madaginMeaningfulWorldReady==='true',undefined,{timeout:60000});
  const observed=await page.evaluate(()=>({programs:window.__MADAGIN_SHADOW_AUDIT__,canvases:document.querySelectorAll('canvas').length,fov:JSON.parse(document.documentElement.dataset.madaginPublicCamera).fov,rooted:JSON.parse(document.documentElement.dataset.madaginRootedTrees)}));
  await fs.writeFile(path.join(out,`shadow-${phase}-${width}-observed.json`),JSON.stringify(observed,null,2)+'\n');
  assert.equal(observed.canvases,1);assert.equal(observed.fov,width===390?60:42);assert.deepEqual(errors,[]);
  const expected=phase==='baseline'?'BASIC':'PCF';
  if(width===1440){assert.ok(observed.programs.length>0);assert.ok(observed.programs.every(p=>p.kind===expected&&p.linked));const receivers=observed.programs.filter(p=>p.receiver);assert.ok(receivers.length>0);if(phase!=='baseline')assert.ok(receivers.every(p=>p.filteredSampler&&p.radiusAware));}
  else assert.deepEqual(observed.programs,[],'Compact retains disabled real-time shadows');
  assert.ok(Object.values(observed.rooted).every(t=>t.leafCoverage==='leaf-coverage-1'));
  cases.push({width,expected:width===390?'DISABLED':expected,...observed,errors,passed:true});await context.close();
 }
}finally{await browser.close();}
const report={at:new Date().toISOString(),origin,phase,cases,passed:cases.length===2&&cases.every(c=>c.passed),method:'Observe linked fragment programs actually bound by WebGL2 useProgram; preserve original calls and shader source. Source architecture/visual quality, motion and performance are separate checks.'};
await fs.writeFile(path.join(out,`shadow-${phase}.json`),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({origin,phase,cases:cases.map(c=>({width:c.width,expected:c.expected,programs:c.programs.length,receivers:c.programs.filter(p=>p.receiver).length,passed:c.passed})),passed:report.passed}));
