// Observe the linked, submitted terrain program and its actual bound textures.
// This diagnostic forwards every GL call and never replaces geometry or shaders.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire('C:/Users/Ocean/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/terrain-check.cjs');
const {chromium}=require('playwright');
const origin=process.env.MADAGIN_REVIEW_ORIGIN??'http://127.0.0.1:3181';
const phase=process.env.MADAGIN_TERRAIN_PHASE??'local';
const out=path.resolve(process.env.MADAGIN_TERRAIN_EVIDENCE_ROOT??'output/releases/madagin-cascade-shape-20260910');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const cases=[];
try {
  for(const width of [1440,390]) {
    const context=await browser.newContext({viewport:{width,height:width===390?844:900}});
    if(new URL(origin).hostname==='127.0.0.1')await context.route('**/_vercel/insights/script.js',r=>r.fulfill({status:200,body:''}));
    await context.addInitScript(()=>{
      const p=WebGL2RenderingContext.prototype,programs=new WeakMap(),sizes=new WeakMap();
      let current=null,waterCurrent=null,sourceCurrent=null;const waters=new WeakMap(),sources=new WeakMap();
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
          waters.set(program,fragment.includes('float clock=vTravel-uTime')&&fragment.includes('vAir')?{program,fragment,draws:0}:null);
          sources.set(program,fragment.includes('float riffleFoam')?{program,fragment,draws:0}:null);
          programs.set(program,fragment.includes('vec3 supportNormal')&&fragment.includes('uCliffColor')?{program,fragment,draws:0,submittedIndices:0}:null);
        }
        current=program?programs.get(program):null;waterCurrent=program?waters.get(program):null;
        sourceCurrent=program?sources.get(program):null;
        return use.call(this,program);
      };
      for(const method of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']) {
        const draw=p[method];
        p[method]=function(...args) {
          if(waterCurrent){waterCurrent.draws++;waterCurrent.gl=this;waterCurrent.time=this.getUniform(waterCurrent.program,this.getUniformLocation(waterCurrent.program,'uTime'));const loc=this.getAttribLocation(waterCurrent.program,'aeration');waterCurrent.aerationBound=loc>=0&&!!this.getVertexAttrib(loc,this.VERTEX_ATTRIB_ARRAY_ENABLED)&&!!this.getVertexAttrib(loc,this.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING);window.__MADAGIN_CASCADE_CHECK__=waterCurrent;}
          if(sourceCurrent){sourceCurrent.draws++;sourceCurrent.gl=this;sourceCurrent.time=this.getUniform(sourceCurrent.program,this.getUniformLocation(sourceCurrent.program,'uTime'));const loc=this.getAttribLocation(sourceCurrent.program,'riffle');sourceCurrent.riffleBound=loc>=0&&!!this.getVertexAttrib(loc,this.VERTEX_ATTRIB_ARRAY_ENABLED)&&!!this.getVertexAttrib(loc,this.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING);window.__MADAGIN_SOURCE_CHECK__=sourceCurrent;}
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
    await page.waitForFunction(()=>window.__MADAGIN_SOURCE_CHECK__?.draws>0,null,{timeout:30000});
    const sourceWater=await page.evaluate(()=>{const s=window.__MADAGIN_SOURCE_CHECK__;return{metadata:JSON.parse(document.documentElement.dataset.madaginCascadeSource),linked:s.gl.getProgramParameter(s.program,s.gl.LINK_STATUS),draws:s.draws,time:s.time,riffleBound:s.riffleBound,fragment:s.fragment};});
    assert.equal(sourceWater.metadata.version,'cascade-source-1');assert.deepEqual(sourceWater.metadata.zRange,[-858,-750]);assert.ok(sourceWater.linked&&sourceWater.draws>0&&sourceWater.riffleBound);assert.match(sourceWater.fragment,/vFlow.y\*\.84-uTime\*1.55/);
    await page.waitForTimeout(700);sourceWater.laterTime=await page.evaluate(()=>window.__MADAGIN_SOURCE_CHECK__.time);assert.ok(sourceWater.laterTime>sourceWater.time);
    const observed=await page.evaluate(()=>{
      const {gl,program,fragment,draws,submittedIndices,textures}=window.__MADAGIN_TERRAIN_CHECK__;
      const water=window.__MADAGIN_CASCADE_CHECK__;return {fallingWater:JSON.parse(document.documentElement.dataset.madaginFallingWater),water:{linked:water.gl.getProgramParameter(water.program,water.gl.LINK_STATUS),draws:water.draws,time:water.time,aerationBound:water.aerationBound,fragment:water.fragment},alpine:!!document.documentElement.dataset.madaginAlpineGeologyV116,nativeValley:JSON.parse(document.documentElement.dataset.madaginNativeValley),surface:JSON.parse(document.documentElement.dataset.madaginTerrainSurface),fragment,linked:gl.getProgramParameter(program,gl.LINK_STATUS),draws,submittedIndices,textures,glError:gl.getError(),camera:JSON.parse(document.documentElement.dataset.madaginPublicCamera),canvasCount:document.querySelectorAll('canvas').length};
    });
    await fs.writeFile(path.join(out,'terrain-'+phase+'-'+width+'-observed.json'),JSON.stringify(observed,null,2)+'\n');
    assert.equal(observed.fallingWater.version,'cascade-shape-1');assert.equal(observed.fallingWater.guideVersion,'contact-cascade-1');assert.match(observed.water.fragment,/fwidth\(bubbleUv\)/);assert.doesNotMatch(observed.water.fragment,/float channels=/);assert.equal(observed.fallingWater.terrainGuide,true);assert.ok(observed.water.linked&&observed.water.draws>0&&observed.water.aerationBound&&observed.alpine);assert.match(observed.fragment,/float cascadeWet/);const initialTime=observed.water.time;await page.waitForTimeout(700);const laterTime=await page.evaluate(()=>window.__MADAGIN_CASCADE_CHECK__.time);assert.ok(laterTime>initialTime);observed.water.laterTime=laterTime;assert.equal(observed.nativeValley.version,'native-valley-2');
    assert.equal(observed.nativeValley.compact,width===390);
    assert.ok(observed.nativeValley.changedVertices>8000&&observed.nativeValley.plants===(width===390?52:130)&&observed.nativeValley.triangleGrounded&&observed.nativeValley.sourceInteriorPreserved);
    assert.equal(observed.nativeValley.collarMeters,55);
    assert.equal(observed.nativeValley.sharedLakeBoundaryProtected,true);
    assert.equal(observed.camera.progress,.34);
    assert.equal(observed.surface.version,'scanned-cover-2');
    assert.equal(observed.surface.rockTileMeters,80);
    assert.equal(observed.surface.geometryChanged,false);
    if(width===390){
      const journey=await page.evaluate(()=>JSON.parse(document.documentElement.dataset.madaginCompactJourneySeamV116).alpineBoundary);
      assert.equal(journey.version,'compact-alpine-join-1');assert.equal(journey.boundaryZ,-1000);assert.equal(journey.stripWidth,12);assert.equal(journey.addedTriangles,114);
      await page.evaluate(()=>{const canvas=document.querySelector('canvas');let f=canvas[Object.keys(canvas).find(k=>k.startsWith('__reactFiber'))];for(let i=0;f&&i<35;i++,f=f.return){const p=f.memoizedProps?.progress;if(p?.set){p.set(.98);return;}}throw new Error('Rail unavailable');});
      await page.waitForFunction(()=>!!document.documentElement.dataset.madaginCompactTerminalWeldV116,null,{timeout:30000});
      const summit=await page.evaluate(()=>JSON.parse(document.documentElement.dataset.madaginCompactTerminalWeldV116).alpineBoundary);
      assert.equal(summit.version,'compact-alpine-join-1');assert.equal(summit.boundaryZ,-1000);assert.equal(summit.addedTriangles,118);
      const alpineRequests=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>new URL(r.name).pathname==='/world/v116/terrain-alpine-v1.16.glb').length);
      assert.equal(alpineRequests,1,'Reuse the existing decoded Alpine source');
      observed.compactAlpineBoundary={journey,summit,alpineRequests};
    }
    assert.ok(observed.linked&&observed.draws>0&&observed.submittedIndices>0);
    assert.match(observed.fragment,/plane \/ 80\.0/);
    assert.match(observed.fragment,/mat3\(viewMatrix\) \* surfaceGradient/);
    assert.match(observed.fragment,/supportSlope \+ \(\.7 - response\.r\) \* \.12/);
    assert.ok(observed.textures.every(t=>t.bound&&t.size?.width===observed.surface.textureResolution&&t.min===9987&&t.mag===9729&&t.wrapS===10497&&t.wrapT===10497));
    assert.equal(new Set(observed.textures.map(t=>t.unit)).size,4);
    assert.equal(observed.glError,0);assert.equal(observed.canvasCount,1);
    assert.equal(observed.camera.fov,width===390?60:42);assert.deepEqual(errors,[]);
    const {fragment,...record}=observed;
    cases.push({width,...record,sourceWater,fragmentSha256:createHash('sha256').update(fragment).digest('hex'),errors,passed:true});
    await context.close();
  }
}finally {
  await browser.close();
  await fs.writeFile(path.join(out,'terrain-'+phase+'.json'),JSON.stringify({at:new Date().toISOString(),origin,cases,passed:cases.length===2&&cases.every(c=>c.passed),limits:'Submitted GPU program and bound texture evidence; visual quality and motion are separately inspected. Not physical-device qualification.'},null,2)+'\n');
}
console.log(JSON.stringify({origin,phase,cases:cases.map(c=>({width:c.width,draws:c.draws,textures:c.textures,passed:c.passed}))}));
