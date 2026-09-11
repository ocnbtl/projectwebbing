// Verify the submitted generated foliage buffer and advancing wind, not labels.
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const require=createRequire('C:/Users/Ocean/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sprays.cjs'),{chromium}=require('playwright');
const root=process.env.MADAGIN_SPRAY_EVIDENCE_ROOT??'output/releases/madagin-branch-sprays-20260910',phase=process.env.MADAGIN_SPRAY_PHASE??'local',origin=process.env.MADAGIN_REVIEW_ORIGIN??'http://127.0.0.1:3184';
const expected=JSON.parse(await fs.readFile(root+'/branch-geometry-checks.json')).cases[0].sprays[0];
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),cases=[];
try {for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:width===390?844:900}});
 if(new URL(origin).hostname==='127.0.0.1')await context.route('**/_vercel/insights/script.js',r=>r.fulfill({status:200,body:''}));
 await context.addInitScript(()=>{
  const p=WebGL2RenderingContext.prototype,programs=new WeakMap();let current=null;
  const state=window.__SPRAY_GPU__={enabled:false,draws:[],first:null,last:null,positions:null};
  const use=p.useProgram;p.useProgram=function(program){if(program&&!programs.has(program)){const vertex=this.getAttachedShaders(program).filter(s=>this.getShaderParameter(s,this.SHADER_TYPE)===this.VERTEX_SHADER).map(s=>this.getShaderSource(s)).join('\n');programs.set(program,vertex.includes('#define MADAGIN_BRANCH_SPRAYS')?{program,location:this.getAttribLocation(program,'position')}:null);}current=program?programs.get(program):null;return use.call(this,program);};
  const draw=p.drawElementsInstanced;p.drawElementsInstanced=function(...args){if(state.enabled&&current){const {program,location}=current;const time=this.getUniform(program,this.getUniformLocation(program,'uTreeTime'));state.first??=time;state.last=time;
   if(!state.positions&&location>=0){const buffer=this.getVertexAttrib(location,this.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING),old=this.getParameter(this.ARRAY_BUFFER_BINDING);this.bindBuffer(this.ARRAY_BUFFER,buffer);const bytes=this.getBufferParameter(this.ARRAY_BUFFER,this.BUFFER_SIZE);const values=new Float32Array(bytes/4);this.getBufferSubData(this.ARRAY_BUFFER,0,values);this.bindBuffer(this.ARRAY_BUFFER,old);state.positions=Array.from(values);state.draws.push({indices:args[1],instances:args[4],linked:this.getProgramParameter(program,this.LINK_STATUS),bytes});}state.error=this.getError();}return draw.apply(this,args);};
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin);await page.waitForFunction(()=>document.documentElement.dataset.madaginMeaningfulWorldReady==='true',null,{timeout:60000});await page.locator('[data-journey-action="pause"]').click();
 await page.evaluate(()=>{const c=document.querySelector('canvas');let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber'))];for(let i=0;f&&i<35;i++,f=f.return){const v=f.memoizedProps?.progress;if(v?.set&&v?.get){v.set(.58);return;}}throw Error('Missing public rail');});
 await page.waitForTimeout(5000);await page.evaluate(()=>{window.__SPRAY_GPU__.enabled=true;});await page.waitForTimeout(800);
 const actual=await page.evaluate(()=>{const s=window.__SPRAY_GPU__;s.enabled=false;return{...s,trees:JSON.parse(document.documentElement.dataset.madaginRootedTrees),canvas:document.querySelectorAll('canvas').length,assets:performance.getEntriesByType('resource').filter(r=>new URL(r.name).pathname.startsWith('/world/')).map(r=>new URL(r.name).pathname)};});
 assert.equal(actual.canvas,1);assert.equal(actual.trees['bank-canopy'].branchSprays,'branch-sprays-1');assert.equal(actual.trees['bank-canopy'].count,260);assert.equal(actual.error,0);assert.ok(actual.last>actual.first+.1);assert.ok(actual.draws.some(d=>d.linked&&d.indices===expected.triangles*3&&d.instances>0));
 const positionHash=createHash('sha256').update(Buffer.from(new Float32Array(actual.positions).buffer)).digest('hex');assert.equal(positionHash,expected.positionHash);assert.deepEqual(errors,[]);
 assert.equal(actual.assets.filter(p=>p==='/world/branch-canopy-v1/island-tree-01-far.glb').length,1);
 cases.push({width,passed:true,positionHash,draws:actual.draws,wind:{first:actual.first,last:actual.last},errors});await context.close();
 }}finally{await browser.close();await fs.writeFile(root+'/sprays-gpu-'+phase+'.json',JSON.stringify({at:new Date().toISOString(),origin,passed:cases.length===2,cases},null,2)+'\n');}
console.log(JSON.stringify({passed:cases.length===2,cases}));
