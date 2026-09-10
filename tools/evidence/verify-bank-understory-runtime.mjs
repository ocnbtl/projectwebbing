// Observe submitted fern instance counts and live wind uniforms on both tiers.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire('C:/Users/Ocean/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/understory.cjs'),{chromium}=require('playwright');
const origin=process.env.MADAGIN_REVIEW_ORIGIN??'http://127.0.0.1:3175',phase=process.env.MADAGIN_UNDERSTORY_PHASE??'local';
const root='output/releases/madagin-bank-understory-20260909',source=process.env.MADAGIN_UNDERSTORY_SOURCE??root+'/source';
const read=async p=>JSON.parse(await fs.readFile(path.join(source,'src/components/internal',p)));
const lower=await read('bank-understory-placements.json'),old=await read('riparian-placements.json'),bank=await read('groundcover-bank-placements.json');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),cases=[];
try {for(const width of [1440,390]){
 const compact=width===390,key=compact?'compact':'desktop',context=await browser.newContext({viewport:{width,height:compact?844:900}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 if(new URL(origin).hostname==='127.0.0.1')await context.route('**/_vercel/insights/script.js',r=>r.fulfill({status:200,body:''}));
 await page.addInitScript(()=>{
  const proto=WebGL2RenderingContext.prototype,known=new WeakMap();let current=null;
  const use=proto.useProgram;proto.useProgram=function(program){
   if(program&&!known.has(program)){const vertex=this.getAttachedShaders(program).filter(s=>this.getShaderParameter(s,this.SHADER_TYPE)===this.VERTEX_SHADER).map(s=>this.getShaderSource(s)).join('\n');known.set(program,vertex.includes('uRiparianTime')?{gl:this,program,counts:new Set()}:null);}
   current=program?known.get(program):null;return use.call(this,program);
  };
  for(const name of ['drawArraysInstanced','drawElementsInstanced']){const draw=proto[name];proto[name]=function(...args){if(current){current.counts.add(args.at(-1));window.__MADAGIN_FERN_DRAW__=current;}return draw.apply(this,args);};}
 });
 await page.goto(origin);await page.waitForFunction(()=>document.documentElement.dataset.madaginMeaningfulWorldReady==='true'&&window.__MADAGIN_FERN_DRAW__,null,{timeout:60000});
 await page.locator('[data-journey-action="pause"]').click();
 const observed=await page.evaluate(()=>{const {gl,program,counts}=window.__MADAGIN_FERN_DRAW__;return {counts:[...counts],linked:gl.getProgramParameter(program,gl.LINK_STATUS),glError:gl.getError(),time:gl.getUniform(program,gl.getUniformLocation(program,'uRiparianTime')),understory:JSON.parse(document.documentElement.dataset.madaginBankUnderstory),trees:JSON.parse(document.documentElement.dataset.madaginRootedTrees),assets:performance.getEntriesByType('resource').filter(r=>new URL(r.name).pathname.startsWith('/world/')).map(r=>new URL(r.name).pathname),canvas:document.querySelectorAll('canvas').length};});
 await page.waitForTimeout(400);
 const later=await page.evaluate(()=>{const {gl,program}=window.__MADAGIN_FERN_DRAW__;return gl.getUniform(program,gl.getUniformLocation(program,'uRiparianTime'));});
 const families={};for(const p of [...old[key].ferns,...(compact?[]:bank.ferns),...lower[key].ferns])families[p.family]=(families[p.family]??0)+1;
 assert.ok(observed.linked);assert.equal(observed.glError,0);assert.ok(later>observed.time+.1);assert.equal(observed.canvas,1);
 for(const count of Object.values(families))assert.ok(observed.counts.includes(count),`GPU fern instance count ${count} missing`);
 assert.equal(observed.understory.version,'bank-understory-1');assert.equal(observed.understory.ferns,compact?440:820);assert.equal(observed.trees['bank-understory'].count,compact?80:160);
 assert.equal(observed.trees['bank-canopy'].count,260);assert.equal(observed.trees['bank-canopy'].branchCanopy,'branch-canopy-1');
 assert.equal(observed.assets.filter(p=>p==='/world/canopy-v1/fern.glb').length,1);
 for(const v of [0,1])assert.equal(observed.assets.filter(p=>p===`/world/leaf-canopy-v1/tree-${v}-far.glb`).length,1);
 assert.deepEqual(errors,[]);cases.push({width,passed:true,...observed,timeAfter:later,expectedFernBatches:families,errors});await context.close();
 }}finally{await browser.close();await fs.writeFile(root+'/runtime-'+phase+'.json',JSON.stringify({origin,phase,at:new Date().toISOString(),passed:cases.length===2&&cases.every(c=>c.passed),cases,limit:'Submitted instances, linked programs and changing wind uniforms prove integration only. Realistic motion and physical-device qualification require separate evidence.'},null,2)+'\n');}
console.log(JSON.stringify({passed:cases.length===2,cases:cases.map(c=>({width:c.width,counts:c.counts,understory:c.understory,passed:c.passed}))}));
