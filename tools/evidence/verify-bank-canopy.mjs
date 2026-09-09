import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root='output/releases/madagin-bank-canopy-20260909',baseline='2971f473aea8048e5f9be5c9ab30acee86ffd221';
const read=async p=>(await fs.readFile(p,'utf8')).replaceAll('\r\n','\n');
const original=p=>execFileSync('git',['show',`${baseline}:${p}`],{encoding:'utf8',maxBuffer:16e6}).replaceAll('\r\n','\n');
const retained=['ridge-production-v116.tsx','riparian-placements.json','groundcover-bank.ts','groundcover-bank-placements.json','riparian-plant-geometry.ts','compact-tree-lod.ts','native-cliff.tsx','ridge-headwater.ts','lake-shore.ts','plunge-basin.ts','channel-rocks.tsx','channel-rock-placements.json','world-lab.tsx'];
for(const p of retained)assert.equal(await read('src/components/internal/'+p),original('src/components/internal/'+p),p);
const treeFile='src/components/internal/rooted-trees.tsx',tree=await read(treeFile);
// Remove only the new opt-in shadow policy; all existing source transforms,
// wind, depth, LOD, culling, readiness and disposal must be the original code.
const restored=tree.replace('  // Keep the same loader key as the rest of this device tier. Smaller desktop\n  // crowns reuse the far scenes from that cache instead of downloading a pair again.\n','').replace('compact||efficient?(compact?scenes:[scenes[1],scenes[3]])','compact?scenes').replaceAll('compact||efficient','compact').replaceAll(',efficient','').replace(';efficient?:boolean','').replace('compact=false=false','compact=false').replace('compact,castFarShadows}:{','compact}:{').replace(';castFarShadows:boolean','').replace('shadows&&(castFarShadows?!part.distant:!part.far)','shadows&&!part.far').replace('compact=false,castFarShadows=false,onReady','compact=false,onReady').replace(';castFarShadows?:boolean','').replace(' castFarShadows={castFarShadows}','');
assert.equal(restored,original(treeFile));
const plantFile='src/components/internal/riparian-ecology.tsx',plants=await read(plantFile);
assert.equal(plants.replace('import canopy from "./bank-canopy-placements.json";\n','').replace('    {/* Small crowns share the accepted efficient branching LOD on both tiers. */}\n','').replace('    <RootedTrees placements={canopy[compact ? "compact" : "desktop"]} zone="bank-canopy" compact={compact} efficient shadows={shadows} castFarShadows={!compact} />\n',''),original(plantFile));
const data=JSON.parse(await read('src/components/internal/bank-canopy-placements.json')),ground=JSON.parse(await read(root+'/canopy-grounding.json'));
assert.equal(ground.passed,true);assert.equal(data.version,'bank-canopy-1');
for(const c of ground.cases){
 const positions=data[c.compact?'compact':'desktop'];assert.equal(positions.length,260);assert.equal(c.records.length,260);
 for(const [i,p] of positions.entries()){
  const r=c.records[i];assert.deepEqual([p[2],p[3]-.025,p[4]],[r.x,r.y,r.z]);
  assert.ok(Math.abs((p[1]===2?5.3:10)*Math.max(.55,Math.min(1.45,p[7]))-r.height)<1e-9);
  assert.ok(r.rootGap<=-.054&&r.rootSlope<=.9&&r.cameraClearance>=4);
 }
}
const geometry=JSON.parse(await read(root+'/tree-geometry-checks.json'));assert.ok(geometry.cases.every(c=>c.passed&&c.envelopeRadius<=1.12));
const assets=[];for(const f of ground.source){const p='public/world/rooted-trees-v1/'+f.file,bytes=await fs.readFile(p);assert.ok(bytes.equals(execFileSync('git',['show',`${baseline}:${p}`],{maxBuffer:8e6})));assets.push({path:p,sha256:createHash('sha256').update(bytes).digest('hex')});}
const report={passed:true,baseline,retained,treePolicy:'Opt-in efficient geometry shares the device-tier loader key, with nearby desktop shadows; existing callers keep both defaults false. Exact other source, wind, depth, culling, LOD, transforms, readiness and disposal.',plantsPerTier:260,sourceEnvelopeRadius:1.12,sourceGeometryCases:geometry.cases.length,assets,additionalUniqueAssetRequests:0,originalAssetsChanged:false,limitations:'Generic tree sources. Root and sampled flight clearance supplement rendered/motion acceptance.'};
await fs.writeFile(root+'/retained-source.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
