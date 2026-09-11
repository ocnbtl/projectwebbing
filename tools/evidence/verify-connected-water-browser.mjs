import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire('C:/Users/Ocean/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/water-check.cjs');
const {chromium}=require('playwright');
const root=process.env.MADAGIN_WATER_EVIDENCE??'output/releases/madagin-connected-water-20260911';
const phase=process.env.MADAGIN_WATER_PHASE??'local',origin=process.env.MADAGIN_REVIEW_ORIGIN??'http://127.0.0.1:3188';
await fs.mkdir(root,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),cases=[];
try{for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:width===390?844:900}});
 if(new URL(origin).hostname==='127.0.0.1')await context.route('**/_vercel/insights/script.js',r=>r.fulfill({status:200,body:''}));
 await context.addInitScript(()=>{
  const p=WebGL2RenderingContext.prototype,programs=new WeakMap(),sizes=new WeakMap(),targets=new WeakMap(),draws=new WeakMap();let current=null;
  const state=window.__CONNECTED_GPU__={enabled:false,samples:{}};
  for(const method of ['texImage2D','texStorage2D']){const old=p[method];p[method]=function(...a){if(a[0]===this.TEXTURE_2D&&(method==='texStorage2D'||a[1]===0)){const t=this.getParameter(this.TEXTURE_BINDING_2D);if(t&&a.length>=5)sizes.set(t,[a[3],a[4]]);}return old.apply(this,a);};}
  const attach=p.framebufferTexture2D;p.framebufferTexture2D=function(...a){const fb=this.getParameter(this.FRAMEBUFFER_BINDING);if(fb&&a[1]===this.COLOR_ATTACHMENT0&&a[3])targets.set(fb,a[3]);return attach.apply(this,a);};
  const use=p.useProgram;p.useProgram=function(program){if(program&&!programs.has(program)){const s=this.getAttachedShaders(program).map(s=>this.getShaderSource(s)).join('\n');programs.set(program,s.includes('uLakeReflectionReady')?{program,kind:s.includes('vDepth')?'channel':s.includes('plungeBasin')?'pool':'lake'}:null);}current=program?programs.get(program):null;return use.call(this,program);};
  for(const method of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const old=p[method];p[method]=function(...a){
   const target=targets.get(this.getParameter(this.FRAMEBUFFER_BINDING));if(target)draws.set(target,(draws.get(target)??0)+1);
   if(state.enabled&&current){const {kind,program}=current,get=n=>this.getUniform(program,this.getUniformLocation(program,n));
    const sample=state.samples[kind]??{first:get('uTime'),draws:0};sample.last=get('uTime');sample.draws++;
    const active=this.getParameter(this.ACTIVE_TEXTURE);this.activeTexture(this.TEXTURE0+get('uLakeReflection'));const t=this.getParameter(this.TEXTURE_BINDING_2D);this.activeTexture(active);
    Object.assign(sample,{linked:this.getProgramParameter(program,this.LINK_STATUS),ready:get('uLakeReflectionReady'),size:sizes.get(t),reflectedSceneDraws:draws.get(t)??0,feedback:target===t,matrix:Array.from(get('uLakeReflectionMatrix'))});
    state.samples[kind]=sample;
   }
   return old.apply(this,a);
  };}
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||/feedback loop/i.test(m.text()))errors.push(m.text());});
 await page.goto(origin);await page.waitForFunction(()=>document.documentElement.dataset.madaginMeaningfulWorldReady==='true',null,{timeout:60000});await page.locator('[data-journey-action="pause"]').click();
 const views=[];
 for(const progress of [.5,.75]){
  await page.evaluate(p=>{const c=document.querySelector('canvas');let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber'))];for(let i=0;f&&i<35;i++,f=f.return){const v=f.memoizedProps?.progress;if(v?.set){v.set(p);return;}}throw Error('Public rail unavailable');},progress);
  await page.waitForTimeout(3000);await page.evaluate(()=>{window.__CONNECTED_GPU__.enabled=true;window.__CONNECTED_GPU__.samples={};});
  await page.waitForFunction(()=>['channel','pool'].every(k=>{const s=window.__CONNECTED_GPU__.samples[k];return s&&s.last>s.first+.2;}),null,{timeout:20000});
  const state=await page.evaluate(()=>{window.__CONNECTED_GPU__.enabled=false;return {samples:window.__CONNECTED_GPU__.samples,lake:JSON.parse(document.documentElement.dataset.madaginLakeOptics),pool:JSON.parse(document.documentElement.dataset.madaginPoolOptics),camera:JSON.parse(document.documentElement.dataset.madaginPublicCamera),canvases:document.querySelectorAll('canvas').length};});
  await page.screenshot({path:root+'/gpu-'+phase+'-'+width+'-'+progress+'.png'});
  assert.deepEqual(errors,[]);assert.equal(state.canvases,1);assert.equal(state.pool.version,'connected-water-1');
  assert.equal(state.pool.reflection,'shared-lake-scene-approximation');assert.equal(state.pool.extraReflectionPasses,0);
  for(const kind of ['channel','pool',...(progress===.5?['lake']:[])]){const sample=state.samples[kind];assert.ok(sample,kind+' draws');assert.ok(sample.linked);assert.equal(sample.ready,1);assert.ok(sample.last>sample.first+.1);assert.ok(sample.reflectedSceneDraws>10);assert.ok(!sample.feedback);assert.ok(sample.matrix.every(Number.isFinite));assert.deepEqual(sample.size,width===390?[512,512]:[1024,1024]);}
  views.push({progress,...state});
 }
 cases.push({width,views,errors});await context.close();
}}finally{await browser.close();await fs.writeFile(root+'/water-gpu-'+phase+'.json',JSON.stringify({at:new Date().toISOString(),origin,passed:cases.length===2,cases},null,2));}
console.log(JSON.stringify({passed:cases.length===2,cases:cases.map(c=>({width:c.width,views:c.views.map(v=>({progress:v.progress,kinds:Object.keys(v.samples)})),errors:c.errors}))}));
