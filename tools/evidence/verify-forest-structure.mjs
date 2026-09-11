import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {BufferGeometry,Float32BufferAttribute} from 'three';
const root=process.env.MADAGIN_FOREST_EVIDENCE??'output/releases/madagin-forest-structure-20260911';
const origin=process.env.MADAGIN_REVIEW_ORIGIN??'http://127.0.0.1:3188',phase=process.env.MADAGIN_FOREST_PHASE??'local';
await fs.mkdir(root,{recursive:true});
for(const name of ['forest-cover','canopy-light'])await fs.writeFile(`${root}/${name}.mjs`,ts.transpileModule(await fs.readFile(`src/components/internal/${name}.ts`,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
const {rasterizeForestCover,FOREST_COVER}=await import(pathToFileURL(path.resolve(root,'forest-cover.mjs')).href);
const {shapeCanopyLight}=await import(pathToFileURL(path.resolve(root,'canopy-light.mjs')).href);
const pixels=new Uint8Array(512*512*4),sample=(x,z)=>((Math.floor((z+1700)/1900*512)*512)+Math.floor((x+900)/1800*512))*4;
const crown={x:200,z:-650,ground:30,radiusX:20,radiusZ:15};
rasterizeForestCover([crown],pixels);const center=sample(crown.x,crown.z),single=pixels[center];
assert.ok(single>160);assert.equal(pixels[sample(260,-650)],0);
assert.ok(Math.abs(pixels[center+1]/pixels[center]*500-150-30)<3);
rasterizeForestCover([crown,crown],pixels);assert.ok(pixels[center]>single);
rasterizeForestCover([],pixels);assert.equal(pixels[center],0);
const geometry=new BufferGeometry().setAttribute('position',new Float32BufferAttribute([-1,.5,0,1,.5,0,0,1,0,0,.5,1],3)).setAttribute('normal',new Float32BufferAttribute([0,1,0,0,-1,0,0,1,0,0,1,0],3));
const before=Array.from(geometry.getAttribute('position').array);shapeCanopyLight(geometry);assert.deepEqual(Array.from(geometry.getAttribute('position').array),before);
for(let i=0;i<4;i++){const n=geometry.getAttribute('normal');assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-6);}geometry.dispose();
const require=createRequire('C:/Users/Ocean/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/forest-check.cjs');
const {chromium}=require('playwright'),browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),cases=[];
try{for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:width===390?844:900}});
 if(new URL(origin).hostname==='127.0.0.1')await context.route('**/_vercel/insights/script.js',r=>r.fulfill({status:200,body:''}));
 await context.addInitScript(()=>{
  const proto=WebGL2RenderingContext.prototype,programs=new WeakMap(),buffers=new Set();let current=null;
  const state=window.__FOREST_GPU__={enabled:false,uploads:0,draws:0,first:null,last:null,forestDraws:0};
  const use=proto.useProgram;proto.useProgram=function(p){if(p&&!programs.has(p)){const s=this.getAttachedShaders(p).map(x=>this.getShaderSource(x)).join('\n');programs.set(p,{tree:s.includes('uTreeTime'),forest:s.includes('uForestCover'),program:p});}current=p?programs.get(p):null;return use.call(this,p);};
  const upload=proto.bufferSubData;proto.bufferSubData=function(...args){if(state.enabled&&buffers.has(this.getParameter(this.ARRAY_BUFFER_BINDING)))state.uploads++;return upload.apply(this,args);};
  for(const method of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const old=proto[method];proto[method]=function(...args){
   if(current?.tree){for(const name of ['instanceMatrix','instanceColor']){const location=this.getAttribLocation(current.program,name);if(location>=0)buffers.add(this.getVertexAttrib(location,this.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING));}
    if(state.enabled){state.draws++;const t=this.getUniform(current.program,this.getUniformLocation(current.program,'uTreeTime'));state.first??=t;state.last=t;}
   }
   if(state.enabled&&current?.forest)state.forestDraws++;
   return old.apply(this,args);
  };}
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(origin);await page.waitForFunction(()=>document.documentElement.dataset.madaginMeaningfulWorldReady==='true',null,{timeout:60000});await page.locator('[data-journey-action="pause"]').click();
 const setProgress=async p=>page.evaluate(p=>{const c=document.querySelector('canvas');let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber'))];for(let i=0;f&&i<35;i++,f=f.return){const v=f.memoizedProps?.progress;if(v?.set){v.set(p);return;}}throw Error('Public rail unavailable');},p);
 const reset=async()=>page.evaluate(()=>Object.assign(window.__FOREST_GPU__,{enabled:true,uploads:0,draws:0,first:null,last:null,forestDraws:0}));
 await setProgress(.58);await page.waitForTimeout(10000);await reset();await page.waitForTimeout(2500);
 const held=await page.evaluate(()=>({...window.__FOREST_GPU__}));assert.equal(held.uploads,0,'Stationary tree matrices/colors must not upload again');assert.ok(held.draws>10&&held.last>held.first+1);assert.ok(held.forestDraws>0);
 await reset();for(const p of [.28,.5,.75,.98,.58]){await setProgress(p);await page.waitForTimeout(900);}
 const moved=await page.evaluate(()=>({...window.__FOREST_GPU__}));assert.ok(moved.uploads>0,'Changed visibility must refresh instance buffers');assert.ok(moved.draws>0);
 await page.waitForFunction(()=>{const forest=JSON.parse(document.documentElement.dataset.madaginForestCover),trees=JSON.parse(document.documentElement.dataset.madaginRootedTrees);return forest.trees===Object.values(trees).reduce((sum,t)=>sum+t.count,0);},null,{timeout:5000});
 const runtime=await page.evaluate(()=>({forest:JSON.parse(document.documentElement.dataset.madaginForestCover),trees:JSON.parse(document.documentElement.dataset.madaginRootedTrees),canvases:document.querySelectorAll('canvas').length}));
 assert.equal(runtime.forest.version,FOREST_COVER.version);assert.equal(runtime.forest.textureBytes,1048576);assert.ok(runtime.forest.trees>100);assert.ok(Object.values(runtime.trees).every(t=>t.canopyLight==='canopy-light-1'&&t.instanceUpdates==='visibility-membership-1'));assert.equal(runtime.canvases,1);assert.deepEqual(errors,[]);
 cases.push({width,held,moved,runtime,errors});await context.close();
}}finally{await browser.close();await fs.writeFile(`${root}/forest-${phase}.json`,JSON.stringify({at:new Date().toISOString(),origin,passed:cases.length===2,cpuChecks:true,cases,limits:'Instrumented correctness checks, not performance timings or realism qualification.'},null,2));}
console.log(JSON.stringify({passed:true,cases:cases.map(c=>({width:c.width,held:c.held,movingUploads:c.moved.uploads,trees:c.runtime.forest.trees}))}));
