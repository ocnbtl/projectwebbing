import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root='output/releases/madagin-shadow-filter-20260909',baseline='7f17a9e28528fdfd06c8821a95264d0a0c848c3f';
const file='src/components/internal/world-lab.tsx';
const current=(await fs.readFile(file,'utf8')).replaceAll('\r\n','\n');
const previous=execFileSync('git',['show',`${baseline}:${file}`],{encoding:'utf8',maxBuffer:4e6});
assert.equal(current.split('!device.mobile ? "percentage" : false').length-1,2);
assert.equal(current.replaceAll('!device.mobile ? "percentage" : false','!device.mobile ? "soft" : false'),previous,'Only the shadow-mode selection may change in the renderer');
const retained=[];
for(const name of ['rooted-trees.tsx','compact-tree-lod.ts','journey-sun.tsx','ridge-production-v116.tsx','riparian-ecology.tsx','riparian-placements.json','bank-canopy-placements.json','groundcover-bank.ts','groundcover-bank-placements.json','native-cliff.tsx','ridge-headwater.ts','lake-shore.ts','plunge-basin.ts','channel-rocks.tsx','channel-rock-placements.json']){
 const path='src/components/internal/'+name,bytes=(await fs.readFile(path,'utf8')).replaceAll('\r\n','\n');
 assert.equal(bytes,execFileSync('git',['show',`${baseline}:${path}`],{encoding:'utf8',maxBuffer:8e6}));retained.push(path);
}
const assets=[];
for(const prefix of ['rooted-trees-v1','leaf-canopy-v1'])for(const lod of prefix==='leaf-canopy-v1'?['far']:['near','far'])for(const variant of [0,1]){
 const path=`public/world/${prefix}/tree-${variant}-${lod}.glb`,bytes=await fs.readFile(path),original=execFileSync('git',['show',`${baseline}:${path}`],{maxBuffer:8e6});assert.ok(bytes.equals(original));assets.push({path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const report={at:new Date().toISOString(),baseline,passed:true,changedRuntime:file,scope:'Two Canvas shadow selections only: deprecated soft to supported percentage/PCF. Compact and constrained desktop remain disabled. Exact original geometry, wind, materials, root transforms, sun direction/energy/2.2 radius, shadow map size/snapping/bias, content and camera.',retained,assets,limits:'Actual bound programs, visible rendering, original motion and cost checked separately. Whole-world realism and human/device proof are not established by source equality.'};
await fs.mkdir(root,{recursive:true});await fs.writeFile(root+'/retained-source.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,retainedModules:retained.length,retainedModels:assets.length}));
