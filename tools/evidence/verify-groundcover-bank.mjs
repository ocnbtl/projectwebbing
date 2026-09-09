import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import ts from 'typescript';

const root='output/releases/madagin-groundcover-bank-20260909';
const baseline='a3048fabcc53c84d74be942e4dcc406393a04688';
const text=async p=>(await fs.readFile(p,'utf8')).replaceAll('\r\n','\n');
const original=p=>execFileSync('git',['show',`${baseline}:${p}`],{encoding:'utf8',maxBuffer:16e6}).replaceAll('\r\n','\n');
const file='src/components/internal/ridge-production-v116.tsx',source=await text(file);
const parsed=s=>ts.createSourceFile(file,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const functions=s=>new Map(parsed(s).statements.filter(ts.isFunctionDeclaration).map(n=>[n.name.text,n.getText()]));
const before=functions(original(file)),after=functions(source);
assert.equal(before.size,after.size);
for(const [name,body] of before)if(name!=='InstancedWatershedGroundcover')assert.equal(after.get(name),body,name);
const changed=after.get('InstancedWatershedGroundcover');
assert.match(changed,/part.sourceKey === "rock" \? originalPlacements/);
assert.match(changed,/originalPlacements.filter\(p => !inGroundcoverBank\(p\[2\], p\[4\]\)\)/);
// The remaining transform/color loop must be exact after restoring its original source index.
const loop=s=>s.slice(s.indexOf('      const signature ='),s.indexOf('    mesh.instanceMatrix.needsUpdate'));
assert.equal(loop(changed).replace('sourceIndices.get(placement)! * 17','index * 17'),loop(before.get('InstancedWatershedGroundcover')));
const retained=['riparian-plant-geometry.ts','riparian-placements.json','rooted-trees.tsx','channel-rocks.tsx','channel-rock-placements.json','native-cliff.tsx','ridge-headwater.ts','lake-shore.ts','plunge-basin.ts','world-lab.tsx'];
for(const name of retained)assert.equal(await text(`src/components/internal/${name}`),original(`src/components/internal/${name}`));
const fernBefore=original('src/components/internal/riparian-ecology.tsx'),fernAfter=await text('src/components/internal/riparian-ecology.tsx');
const shader=s=>s.slice(s.indexOf('      material.onBeforeCompile'),s.indexOf('  const selected = data'));
assert.equal(shader(fernBefore),shader(fernAfter));
const grounding=JSON.parse(await text(`${root}/bank-grounding.json`)),data=JSON.parse(await text('src/components/internal/groundcover-bank-placements.json'));
assert.equal(grounding.passed,true);assert.equal(data.ferns.length,655);assert.equal(grounding.records.length,data.ferns.length);
for(const [i,p] of data.ferns.entries()){
 const fit=grounding.records[i];assert.deepEqual([p.x,p.y,p.z,p.height],[fit.x,fit.y,fit.z,fit.height]);assert.ok(fit.rootGap<=-.044);assert.ok(fit.exposure>=.63);assert.ok(p.height>=.8&&p.height<=1.9);
 assert.ok(p.x>=data.bounds.minX&&p.x<=data.bounds.maxX&&p.z>=data.bounds.minZ&&p.z<=data.bounds.maxZ);
}
const assets=[];
for(const relative of ['fern.glb',...grounding.source.referencedImages.map(i=>i.path)]){
 const p=`public/world/canopy-v1/${relative}`,bytes=await fs.readFile(p);assert.ok(bytes.equals(execFileSync('git',['show',`${baseline}:${p}`],{maxBuffer:8e6})));assets.push({path:p,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const record={passed:true,baseline,retainedWorldFunctions:before.size-1,changedWorldFunction:'InstancedWatershedGroundcover filters only bounded legacy foliage; rocks retained.',retained,assets,originalAssetsChanged:false,addedAssetRequests:0,bankFerns:data.ferns.length,bankTriangles:grounding.triangles,maxRootGap:grounding.maxRootGap,minExposedCrown:grounding.minExposure,windAndDepthSourceExact:true,maximumFernHeight:1.9,compact:'No added plants, sources, textures or altered tree placements.',limitation:'Root-fit and scope checks supplement required rendered/motion evaluation.'};
await fs.writeFile(`${root}/retained-source.json`,JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record));
