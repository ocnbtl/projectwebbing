import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire('C:/Users/Ocean/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/lake-check.cjs'),{chromium}=require('playwright');
const root=process.env.MADAGIN_LAKE_EVIDENCE??'output/releases/madagin-water-light-20260911',phase=process.env.MADAGIN_LAKE_PHASE??'local',origin=process.env.MADAGIN_REVIEW_ORIGIN??'http://127.0.0.1:3188';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),cases=[];
try{for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:width===390?844:900}});
 if(new URL(origin).hostname==='127.0.0.1')await context.route('**/_vercel/insights/script.js',r=>r.fulfill({status:200,body:''}));
 await context.addInitScript(()=>{
  const p=WebGL2RenderingContext.prototype,programs=new WeakMap(),sizes=new WeakMap(),targets=new WeakMap(),rendered=new WeakMap();let current=null;
  const state=window.__LAKE_GPU__={enabled:false,samples:[],first:null,last:null};
  for(const method of ['texImage2D','texStorage2D']){const original=p[method];p[method]=function(...a){if(a[0]===this.TEXTURE_2D&&(method==='texStorage2D'||a[1]===0)){const tex=this.getParameter(this.TEXTURE_BINDING_2D);if(tex&&a.length>=5)sizes.set(tex,[a[3],a[4]]);}return original.apply(this,a);};}
  const attach=p.framebufferTexture2D;p.framebufferTexture2D=function(...a){const fb=this.getParameter(this.FRAMEBUFFER_BINDING);if(fb&&a[1]===this.COLOR_ATTACHMENT0&&a[3])targets.set(fb,a[3]);return attach.apply(this,a);};
  const use=p.useProgram;p.useProgram=function(program){if(program&&!programs.has(program)){const source=this.getAttachedShaders(program).map(s=>this.getShaderSource(s)).join('\n');programs.set(program,source.includes('uLakeReflectionReady')?program:null);}current=program?programs.get(program):null;return use.call(this,program);};
  for(const method of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const original=p[method];p[method]=function(...a){if(state.enabled){const target=targets.get(this.getParameter(this.FRAMEBUFFER_BINDING));if(target)rendered.set(target,(rendered.get(target)??0)+1);
    if(current){const time=this.getUniform(current,this.getUniformLocation(current,'uTime'));state.first??=time;state.last=time;
     if(state.samples.length<1){const old=this.getParameter(this.ACTIVE_TEXTURE),unit=this.getUniform(current,this.getUniformLocation(current,'uLakeReflection'));this.activeTexture(this.TEXTURE0+unit);const texture=this.getParameter(this.TEXTURE_BINDING_2D);this.activeTexture(old);
      state.samples.push({linked:this.getProgramParameter(current,this.LINK_STATUS),ready:this.getUniform(current,this.getUniformLocation(current,'uLakeReflectionReady')),size:sizes.get(texture),reflectedSceneDraws:rendered.get(texture)??0,matrix:Array.from(this.getUniform(current,this.getUniformLocation(current,'uLakeReflectionMatrix')))});
     }
    }
   }return original.apply(this,a);};}
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(origin);await page.waitForFunction(()=>document.documentElement.dataset.madaginMeaningfulWorldReady==='true',null,{timeout:60000});await page.locator('[data-journey-action="pause"]').click();
 await page.evaluate(()=>{const c=document.querySelector('canvas');let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber'))];for(let i=0;f&&i<35;i++,f=f.return){const v=f.memoizedProps?.progress;if(v?.set){v.set(.5);return;}}throw Error('No public rail');});
 await page.waitForTimeout(4000);await page.evaluate(()=>{window.__LAKE_GPU__.enabled=true;});await page.waitForTimeout(800);
 const actual=await page.evaluate(()=>{window.__LAKE_GPU__.enabled=false;return {...window.__LAKE_GPU__,optics:JSON.parse(document.documentElement.dataset.madaginLakeOptics),canvas:document.querySelectorAll('canvas').length};});
 assert.equal(actual.canvas,1);assert.equal(actual.optics.version,'water-light-1');assert.ok(actual.last>actual.first+.1);assert.equal(actual.samples.length,1);
 const sample=actual.samples[0];assert.ok(sample.linked);assert.equal(sample.ready,1);assert.deepEqual(sample.size,width===390?[512,512]:[1024,1024]);assert.ok(sample.reflectedSceneDraws>10);assert.ok(sample.matrix.every(Number.isFinite));assert.deepEqual(errors,[]);
 cases.push({width,...actual,errors});await context.close();
}}finally{await browser.close();await fs.writeFile(root+'/reflection-gpu-'+phase+'.json',JSON.stringify({at:new Date().toISOString(),origin,passed:cases.length===2,cases},null,2));}
console.log(JSON.stringify({passed:cases.length===2,cases}));
