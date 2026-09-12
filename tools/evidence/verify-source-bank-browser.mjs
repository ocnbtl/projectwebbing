// Read submitted instance matrices, not just authored placement metadata.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire('C:/Users/Ocean/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/source-bank.cjs'),{chromium}=require('playwright');
const root=process.env.MADAGIN_BANK_EVIDENCE_ROOT??'output/releases/madagin-source-bank-20260910',source=process.env.MADAGIN_BANK_SOURCE??'.',phase=process.env.MADAGIN_BANK_PHASE??'local',origin=process.env.MADAGIN_REVIEW_ORIGIN??'http://127.0.0.1:3182';
const data=JSON.parse(await fs.readFile(source+'/src/components/internal/source-bank-placements.json'));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),cases=[];
try{for(const width of [1440,390]){
 const compact=width===390,key=compact?'compact':'desktop',expected=data[key],context=await browser.newContext({viewport:{width,height:compact?844:900}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 if(new URL(origin).hostname==='127.0.0.1')await context.route('**/_vercel/insights/script.js',r=>r.fulfill({status:200,body:''}));
 await page.addInitScript(()=>{
  const proto=WebGL2RenderingContext.prototype,programs=new WeakMap();let current=null;
  const state=window.__MADAGIN_BANK_GPU__={capture:false,roots:{fern:[],tree:[],other:[]},times:{},buffers:new Map(),programs:[]};
  const use=proto.useProgram;proto.useProgram=function(program){
   if(program&&!programs.has(program)){const vertex=this.getAttachedShaders(program).filter(s=>this.getShaderParameter(s,this.SHADER_TYPE)===this.VERTEX_SHADER).map(s=>this.getShaderSource(s)).join('\n'),kind=vertex.includes('uRiparianTime')?'fern':vertex.includes('uTreeTime')?'tree':'other';programs.set(program,{program,kind,location:this.getAttribLocation(program,'instanceMatrix'),gl:this});}
   current=program?programs.get(program):null;return use.call(this,program);
  };
  for(const name of ['drawElementsInstanced','drawArraysInstanced']){const draw=proto[name];proto[name]=function(...args){
   if(state.capture&&current?.location>=0){
    const {location,kind,program}=current,count=args.at(-1),buffer=this.getVertexAttrib(location,this.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING),stride=this.getVertexAttrib(location,this.VERTEX_ATTRIB_ARRAY_STRIDE),offset=this.getVertexAttribOffset(location,this.VERTEX_ATTRIB_ARRAY_POINTER);
    // Tree buffers are rewritten for visibility each frame. Read each submitted
    // buffer once during this short, stationary observation; do not mutate it.
    if(buffer&&stride===64&&offset===0&&count>0&&!state.buffers.has(buffer)){
     const old=this.getParameter(this.ARRAY_BUFFER_BINDING),values=new Float32Array(count*16);this.bindBuffer(this.ARRAY_BUFFER,buffer);this.getBufferSubData(this.ARRAY_BUFFER,0,values);this.bindBuffer(this.ARRAY_BUFFER,old);state.buffers.set(buffer,true);
     for(let i=0;i<count;i++)state.roots[kind].push([values[i*16+12],values[i*16+13],values[i*16+14]]);
     state.programs.push({kind,linked:this.getProgramParameter(program,this.LINK_STATUS),count,stride});
    }
    if(kind!=='other'){const uniform=kind==='fern'?'uRiparianTime':'uTreeTime',time=this.getUniform(program,this.getUniformLocation(program,uniform));(state.times[kind]??=[]).push(time);}
    state.error=this.getError();
   }
   return draw.apply(this,args);
  };}
 });
 await page.goto(origin);await page.waitForFunction(()=>document.documentElement.dataset.madaginMeaningfulWorldReady==='true'&&document.documentElement.dataset.madaginSourceBank,null,{timeout:60000});
 await page.locator('[data-journey-action="pause"]').click();
 await page.evaluate(()=>{const c=document.querySelector('canvas');let fiber=c[Object.keys(c).find(k=>k.startsWith('__reactFiber'))];for(let i=0;fiber&&i<35;i++,fiber=fiber.return){const v=fiber.memoizedProps?.progress;if(v?.set&&v?.get){v.set(.75);return;}}throw Error('Public progress missing');});
 await page.waitForTimeout(4500);await page.evaluate(()=>{window.__MADAGIN_BANK_GPU__.capture=true;});await page.waitForTimeout(600);
 const actual=await page.evaluate(()=>{const s=window.__MADAGIN_BANK_GPU__;s.capture=false;return{roots:s.roots,programs:s.programs,error:s.error,times:Object.fromEntries(Object.entries(s.times).map(([k,v])=>[k,{first:v[0],last:v.at(-1)}])),bank:JSON.parse(document.documentElement.dataset.madaginSourceBank),rocks:JSON.parse(document.documentElement.dataset.madaginChannelRocks),trees:JSON.parse(document.documentElement.dataset.madaginRootedTrees),assets:performance.getEntriesByType('resource').filter(r=>new URL(r.name).pathname.startsWith('/world/')).map(r=>new URL(r.name).pathname),canvas:document.querySelectorAll('canvas').length};});
 const match=(points,root)=>points.some(p=>Math.hypot(...p.map((v,i)=>v-root[i]))<.001);
 const matched={rocks:expected.rocks.filter(p=>match(actual.roots.other,[p.x,p.y,p.z])).length,ferns:expected.ferns.filter(p=>match(actual.roots.fern,[p.x,p.y,p.z])).length,trees:expected.trees.filter(p=>match(actual.roots.tree,[p[2],p[3]-.025,p[4]])).length};
 assert.equal(actual.bank.version,'source-bank-1');assert.equal(actual.bank.compact,compact);assert.equal(actual.rocks.sourceBankRocks,expected.rocks.length);assert.equal(actual.trees['source-bank'].count,expected.trees.length);assert.equal(actual.trees['source-bank'].lod,'branch-crown-continuous-1');assert.equal(actual.trees['source-bank'].branchCrowns,'branch-crowns-1');
 assert.equal(matched.rocks,expected.rocks.length,'Every added rock root is submitted');assert.equal(matched.ferns,expected.ferns.length,'Every added fern root is submitted');assert.ok(matched.trees>=Math.ceil(expected.trees.length*.8),'At least 80 percent of added trees submitted in source-bank view');
 assert.ok(actual.programs.every(p=>p.linked));assert.equal(actual.error,0);assert.equal(actual.canvas,1);for(const kind of ['fern','tree'])assert.ok(actual.times[kind].last>actual.times[kind].first+.1,kind+' wind advances');
 assert.equal(actual.trees['bank-understory'].count,compact?80:160);assert.equal(actual.trees['bank-canopy'].count,260);
 for(const asset of ['/world/canopy-v1/moss-rock.glb','/world/canopy-v1/fern.glb','/world/leaf-canopy-v1/tree-0-far.glb','/world/leaf-canopy-v1/tree-1-far.glb'])assert.equal(actual.assets.filter(p=>p===asset).length,1,asset+' single cached request');
 assert.deepEqual(errors,[]);cases.push({width,passed:true,matched,...actual,roots:undefined,errors});await context.close();
 }}finally{await browser.close();await fs.writeFile(root+'/bank-gpu-'+phase+'.json',JSON.stringify({at:new Date().toISOString(),origin,phase,passed:cases.length===2,cases,limit:'Read-only submitted instance roots and advancing GPU wind uniforms prove integration; actual visual review, performance and device qualification are separate.'},null,2)+'\n');}
console.log(JSON.stringify({passed:cases.length===2,cases:cases.map(c=>({width:c.width,matched:c.matched,bank:c.bank}))}));
