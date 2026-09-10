// Observe the linked, submitted terrain program and its actual bound textures.
// This diagnostic forwards every GL call and never replaces geometry or shaders.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire('C:/Users/Ocean/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/terrain-check.cjs');
const {chromium}=require('playwright');
const origin=process.env.MADAGIN_REVIEW_ORIGIN??'http://127.0.0.1:3177';
const phase=process.env.MADAGIN_TERRAIN_PHASE??'local';
const out=path.resolve(process.env.MADAGIN_TERRAIN_EVIDENCE_ROOT??'output/releases/madagin-valley-relief-20260910');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const cases=[];
try {
  for(const width of [1440,390]) {
    const context=await browser.newContext({viewport:{width,height:width===390?844:900}});
    if(new URL(origin).hostname==='127.0.0.1')await context.route('**/_vercel/insights/script.js',r=>r.fulfill({status:200,body:''}));
    await context.addInitScript(()=>{
      const p=WebGL2RenderingContext.prototype,programs=new WeakMap(),sizes=new WeakMap();
      let current=null;
      for(const method of ['texImage2D','texStorage2D']) {
        const original=p[method];
        p[method]=function(...args) {
          if(args[0]===this.TEXTURE_2D) {
            const texture=this.getParameter(this.TEXTURE_BINDING_2D);
            const level=method==='texStorage2D'?0:args[1];
            if(texture&&level===0) {
              const source=args.length===6?args[5]:null;
              const width=source?(source.naturalWidth||source.width):args[3];
              const height=source?(source.naturalHeight||source.height):args[4];
              if(Number.isFinite(width)&&Number.isFinite(height))sizes.set(texture,{width,height});
            }
          }
          return original.apply(this,args);
        };
      }
      const use=p.useProgram;
      p.useProgram=function(program) {
        if(program&&!programs.has(program)) {
          const fragment=this.getAttachedShaders(program).filter(s=>this.getShaderParameter(s,this.SHADER_TYPE)===this.FRAGMENT_SHADER).map(s=>this.getShaderSource(s)).join('\n');
          programs.set(program,fragment.includes('vec3 supportNormal')&&fragment.includes('uCliffColor')?{program,fragment,draws:0,submittedIndices:0}:null);
        }
        current=program?programs.get(program):null;
        return use.call(this,program);
      };
      for(const method of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']) {
        const draw=p[method];
        p[method]=function(...args) {
          if(current) {
            current.draws++;
            current.submittedIndices+=method.startsWith('drawArrays')?args[2]:args[1];
            current.gl=this;
            if(!current.textures) {
              const active=this.getParameter(this.ACTIVE_TEXTURE);
              current.textures=[];
              try {
                for(const name of ['uCliffColor','uCliffNormal','uCliffResponse','uGroundColor']) {
                  const unit=this.getUniform(current.program,this.getUniformLocation(current.program,name));
                  this.activeTexture(this.TEXTURE0+unit);
                  const texture=this.getParameter(this.TEXTURE_BINDING_2D);
                  current.textures.push({name,unit,bound:!!texture,size:texture?sizes.get(texture):null,min:this.getTexParameter(this.TEXTURE_2D,this.TEXTURE_MIN_FILTER),mag:this.getTexParameter(this.TEXTURE_2D,this.TEXTURE_MAG_FILTER),wrapS:this.getTexParameter(this.TEXTURE_2D,this.TEXTURE_WRAP_S),wrapT:this.getTexParameter(this.TEXTURE_2D,this.TEXTURE_WRAP_T)});
                }
              }finally{this.activeTexture(active);}
            }
            window.__MADAGIN_TERRAIN_CHECK__=current;
          }
          return draw.apply(this,args);
        };
      }
    });
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
    await page.goto(origin);
    await page.waitForFunction(()=>document.documentElement.dataset.madaginMeaningfulWorldReady==='true'&&window.__MADAGIN_TERRAIN_CHECK__?.draws>0,null,{timeout:60000});
    await page.locator('[data-journey-action="pause"]').click();
    await page.evaluate(()=>{const canvas=document.querySelector('canvas');let f=canvas[Object.keys(canvas).find(k=>k.startsWith('__reactFiber'))];for(let i=0;f&&i<35;i++,f=f.return){const p=f.memoizedProps?.progress;if(p?.set){p.set(.34);return;}}throw new Error('Rail unavailable');});
    await page.waitForFunction(()=>!!document.documentElement.dataset.madaginNativeValley,null,{timeout:60000});
    await page.waitForTimeout(1600);
    const observed=await page.evaluate(()=>{
      const {gl,program,fragment,draws,submittedIndices,textures}=window.__MADAGIN_TERRAIN_CHECK__;
      return {nativeValley:JSON.parse(document.documentElement.dataset.madaginNativeValley),surface:JSON.parse(document.documentElement.dataset.madaginTerrainSurface),fragment,linked:gl.getProgramParameter(program,gl.LINK_STATUS),draws,submittedIndices,textures,glError:gl.getError(),camera:JSON.parse(document.documentElement.dataset.madaginPublicCamera),canvasCount:document.querySelectorAll('canvas').length};
    });
    await fs.writeFile(path.join(out,'terrain-'+phase+'-'+width+'-observed.json'),JSON.stringify(observed,null,2)+'\n');
    assert.equal(observed.nativeValley.version,'native-valley-2');
    assert.equal(observed.nativeValley.compact,width===390);
    assert.ok(observed.nativeValley.changedVertices>8000&&observed.nativeValley.plants===(width===390?52:130)&&observed.nativeValley.triangleGrounded&&observed.nativeValley.sourceInteriorPreserved);
    assert.equal(observed.nativeValley.collarMeters,55);
    assert.equal(observed.nativeValley.sharedLakeBoundaryProtected,true);
    assert.equal(observed.camera.progress,.34);
    assert.equal(observed.surface.version,'scanned-cover-2');
    assert.equal(observed.surface.rockTileMeters,80);
    assert.equal(observed.surface.geometryChanged,false);
    assert.ok(observed.linked&&observed.draws>0&&observed.submittedIndices>0);
    assert.match(observed.fragment,/plane \/ 80\.0/);
    assert.match(observed.fragment,/mat3\(viewMatrix\) \* surfaceGradient/);
    assert.match(observed.fragment,/supportSlope \+ \(\.7 - response\.r\) \* \.12/);
    assert.ok(observed.textures.every(t=>t.bound&&t.size?.width===observed.surface.textureResolution&&t.min===9987&&t.mag===9729&&t.wrapS===10497&&t.wrapT===10497));
    assert.equal(new Set(observed.textures.map(t=>t.unit)).size,4);
    assert.equal(observed.glError,0);assert.equal(observed.canvasCount,1);
    assert.equal(observed.camera.fov,width===390?60:42);assert.deepEqual(errors,[]);
    const {fragment,...record}=observed;
    cases.push({width,...record,fragmentSha256:createHash('sha256').update(fragment).digest('hex'),errors,passed:true});
    await context.close();
  }
}finally {
  await browser.close();
  await fs.writeFile(path.join(out,'terrain-'+phase+'.json'),JSON.stringify({at:new Date().toISOString(),origin,cases,passed:cases.length===2&&cases.every(c=>c.passed),limits:'Submitted GPU program and bound texture evidence; visual quality and motion are separately inspected. Not physical-device qualification.'},null,2)+'\n');
}
console.log(JSON.stringify({origin,phase,cases:cases.map(c=>({width:c.width,draws:c.draws,textures:c.textures,passed:c.passed}))}));
