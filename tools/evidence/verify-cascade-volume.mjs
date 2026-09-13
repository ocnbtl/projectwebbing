// Independent endpoint, source connection and cross-section checks against the
// accepted body. Run verify-channel-geometry first to refresh runtime fixtures.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {Vector3} from 'three';
const root=process.env.MADAGIN_STRUCTURE_EVIDENCE??'output/releases/madagin-water-landform-20260913',out=root+'/geometry';
const baseline='666e4a1c739a55f4d1cc1fd1e9fee2a60e4a59d5';
const oldSource=execFileSync('git',['show',baseline+':src/components/internal/falling-water.tsx'],{encoding:'utf8'})
 .replaceAll('./aerial-perspective','./fixture-aerial.mjs').replaceAll('./cascade-contact','./fixture-cascade.mjs');
await fs.writeFile(out+'/accepted-falling.mjs',ts.transpileModule(oldSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText);
const get=name=>import(pathToFileURL(path.resolve(out+'/'+name+'.mjs')));
const runtime=await get('fixture-runtime'),old=await get('accepted-falling');
const g=runtime.createCumulativeWaterfallGeometry(),meta=g.userData.waterfallBody;
const b=old.createFallingWaterGeometry(meta.top,meta.bottom,meta.lipHalfWidthMeters),p=g.getAttribute('position'),bp=b.getAttribute('position'),tt=g.getAttribute('travelTime'),stride=meta.columns+1;
assert.equal(meta.version,'cascade-volume-2');assert.deepEqual(g.index.array,b.index.array);
let changed=0,maxShift=0,minNormalLength=Infinity;
for(let i=0;i<p.count;i++){
 const point=new Vector3().fromBufferAttribute(p,i),previous=new Vector3().fromBufferAttribute(bp,i),shift=point.distanceTo(previous);
 assert.ok(point.toArray().every(Number.isFinite));assert.ok(Number.isFinite(tt.getX(i)));
 if(i>=stride)assert.ok(tt.getX(i)>=tt.getX(i-stride)-1e-5,'Travel remains downstream');
 if(i<stride||i>=p.count-stride)assert.deepEqual(point.toArray(),previous.toArray(),'Exact retained lip and pool rings');
 if(shift>1e-5)changed++;maxShift=Math.max(maxShift,shift);
 minNormalLength=Math.min(minNormalLength,new Vector3().fromBufferAttribute(g.getAttribute('normal'),i).length());
}
assert.ok(changed>3000);assert.ok(maxShift<5,'Authored body stays within five metres of accepted guide-following body');assert.ok(minNormalLength>.99);
// Measure actual section extent perpendicular to its centreline using the
// front/back quarter vertices, independently of the radius construction.
const sections=[];
for(const row of [32,64,96,128]){
 const at=(positions,r,c)=>new Vector3().fromBufferAttribute(positions,r*stride+c);
 const center=r=>at(bp,r,0).add(at(bp,r,20)).multiplyScalar(.5);
 const tangent=center(row+1).sub(center(row-1)).normalize();
 const depth=positions=>{const span=at(positions,row,10).sub(at(positions,row,30));return span.addScaledVector(tangent,-span.dot(tangent)).length();};
 const previousDepth=depth(bp),depthMeters=depth(p);
 assert.ok(depthMeters>1.2&&depthMeters>previousDepth*1.5,'Interior sections have substantive depth normal to flow');
 sections.push({progress:row/160,previousDepth,depthMeters});
}
const feeds=[];
for(const longitudinal of [42,68,92]){
 const feed=runtime.createWaterfallUpperStreamGeometry(longitudinal,20),fp=feed.getAttribute('position'),flow=feed.getAttribute('flow');let maxLipGap=0,maxRise=-Infinity;
 for(let c=0;c<21;c++){const i=longitudinal*21+c,j=20-c;maxLipGap=Math.max(maxLipGap,new Vector3().fromBufferAttribute(fp,i).distanceTo(new Vector3().fromBufferAttribute(p,j)));}
 for(let row=1;row<=longitudinal;row++){const i=row*21+10;maxRise=Math.max(maxRise,fp.getY(i)-fp.getY(i-21));assert.ok(flow.getY(i)>flow.getY(i-21));}
 assert.ok(maxLipGap<.00003);assert.ok(maxRise<=.00001);feeds.push({longitudinal,maxLipGap,maxRise});
}
const result={at:new Date().toISOString(),passed:true,baseline,vertices:p.count,triangles:g.index.count/3,changed,maxShift,minNormalLength,sourceAndPoolRingsExact:true,sections,feeds,limits:'Authored geometry, exact endpoints and direction checks. No fluid simulation, measured geography or every-pixel collision qualification; actual motion and ground contact remain visual gates.'};
await fs.writeFile(root+'/cascade-volume-geometry.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
