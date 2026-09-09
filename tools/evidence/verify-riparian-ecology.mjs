import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import ts from 'typescript';
const out='output/releases/madagin-riparian-ecology-20260909',baseline='3b033cef3c3a42661637133aeda9ae57d271af32';
const text=async p=>(await fs.readFile(p,'utf8')).replaceAll('\r\n','\n');
const original=p=>execFileSync('git',['show',`${baseline}:${p}`],{encoding:'utf8',maxBuffer:16e6}).replaceAll('\r\n','\n');
const terrain='src/components/internal/ridge-production-v116.tsx',source=await text(terrain);
assert.equal(source.replace('import {RiparianEcology} from "./riparian-ecology";\n','').replace('  const handleRiparianReady = useCallback(() => dispatchStage(2, "riparian-ecology-ready", "ridge"), []);\n','').replace('      <Suspense fallback={null}><RiparianEcology compact={mobile || tier === "conservative"} shadows={shadows} onReady={handleRiparianReady} /></Suspense>\n',''),original(terrain));
const functions=ts.createSourceFile('world.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX).statements.filter(ts.isFunctionDeclaration).length;
const retained=['channel-rocks.tsx','channel-rock-geometry.ts','channel-rock-placements.json','rooted-trees.tsx','compact-tree-lod.ts','native-cliff.tsx','ridge-headwater.ts','lake-shore.ts','plunge-basin.ts','falling-water.tsx','terrain-surface.ts'];
for(const name of retained){const p='src/components/internal/'+name;assert.equal(await text(p),original(p));}
const lab='src/components/internal/world-lab.tsx';
assert.equal((await text(lab)).replace('    let riparianReady = false;\n','').replace(' || !riparianReady','').replace('      if (detail.stage === 2 && detail.label === "riparian-ecology-ready") riparianReady = true;\n',''),original(lab));
const plants=JSON.parse(await text('src/components/internal/riparian-placements.json')),grounding=JSON.parse(await text(out+'/plant-grounding.json'));
assert.equal(grounding.passed,true);
for(const c of grounding.cases){
 const group=plants[c.compact?'compact':'desktop'];
 assert.equal(group.ferns.length,c.ferns);assert.equal(group.saplings.length,c.saplings);
 assert.ok(c.maxRootGap<=-.044&&c.minFernExposure>=.63);
 for(const [i,p] of group.ferns.entries()){
  assert.ok(['fern_02_a','fern_02_b','fern_02_c','fern_02_d'].includes(p.family));
  assert.ok(p.height>=.65&&p.height<=1.9);
  const record=c.records.filter(r=>r.kind==='fern')[i];
  assert.deepEqual([p.x,p.y,p.z],[record.x,record.y,record.z]);
 }
 for(const [i,p] of group.saplings.entries()){
  const record=c.records.filter(r=>r.kind==='sapling')[i];
  assert.deepEqual([p[2],p[3]-.025,p[4]],[record.x,record.y,record.z]);
  assert.ok(Math.abs(p[7]*10-record.height)<1e-8);
 }
}
const assets=['public/world/canopy-v1/fern.glb',...grounding.source.referencedImages.map(i=>'public/world/canopy-v1/'+i.path)];
const hashes=[];
for(const p of assets){const bytes=await fs.readFile(p),before=execFileSync('git',['show',`${baseline}:${p}`],{maxBuffer:8e6});assert.ok(bytes.equals(before));hashes.push({path:p,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
assert.equal(hashes[0].sha256,grounding.source.outputSha256);
const report={passed:true,baseline,topLevelFunctions:functions,allowedRuntimeEdits:'New component import, stable readiness callback and Suspense mount; readiness requires current-mount plants. All retained terrain/water/camera/light functions and shared modules exact.',retained,assets:hashes,placementCases:grounding.cases.map(({compact,ferns,saplings,maxRootGap,minFernExposure})=>({compact,ferns,saplings,maxRootGap,minFernExposure})),extraCompactSourceBytes:hashes.reduce((n,r)=>n+r.bytes,0)};
await fs.writeFile(out+'/retained-source.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
