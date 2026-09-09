import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import ts from 'typescript';

const root='output/releases/madagin-channel-rocks-20260908';
const baseline='4c65df94dd10ae8a0f29cc9680bfe94bbd202aaf';
const read=p=>fs.readFile(p,'utf8');
const fromGit=p=>execFileSync('git',['show',`${baseline}:${p}`],{encoding:'utf8',maxBuffer:16*1024*1024});
const sourcePath='src/components/internal/ridge-production-v116.tsx';
const before=fromGit(sourcePath).replaceAll('\r\n','\n'),after=(await read(sourcePath)).replaceAll('\r\n','\n');
const functions=source=>new Map(ts.createSourceFile('fixture.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX).statements.filter(ts.isFunctionDeclaration).map(n=>[n.name.text,n.getText()]));
const oldFunctions=functions(before),newFunctions=functions(after),retained=[];
for(const [name,source] of oldFunctions){
  if(name==='WaterNetwork')continue;
  assert.equal(newFunctions.get(name),source,`Retain exact builder/component ${name}`);
  retained.push(name);
}
const expected=before
  .replace('import {RidgeCanopy}', 'import {ChannelRocks} from "./channel-rocks";\nimport {RidgeCanopy}')
  .replace('  const activeWaterMaterial = useRef<ShaderMaterial | null>(null);','  const handleChannelRocksReady = useCallback(() => dispatchStage(2, "channel-rocks-ready", "ridge"), []);\n  const activeWaterMaterial = useRef<ShaderMaterial | null>(null);')
  .replace('      {littoralGeologyPlacements.length ? (','      <Suspense fallback={null}><ChannelRocks compact={mobile || tier === "conservative"} shadows={shadows} onReady={handleChannelRocksReady} /></Suspense>\n      {littoralGeologyPlacements.length ? (');
assert.equal(after.replaceAll('\r\n','\n'),expected.replaceAll('\r\n','\n'),'Only source import, callback and separate rock mount changed');
for(const name of ['native-cliff.tsx','lake-shore.ts','plunge-basin.ts','ridge-headwater.ts','falling-water.tsx','terrain-surface.ts','rooted-trees.tsx']){
  const p=`src/components/internal/${name}`;
  assert.equal((await read(p)).replaceAll('\r\n','\n'),fromGit(p).replaceAll('\r\n','\n'));
}
const placement=JSON.parse(await read('src/components/internal/channel-rock-placements.json'));
assert.equal(placement.sourceSha256,createHash('sha256').update(await fs.readFile('public/world/canopy-v1/moss-rock.glb')).digest('hex'));
const grounding=JSON.parse(await read(`${root}/rock-grounding.json`));
assert.equal(grounding.passed,true);
for(const c of grounding.cases){
  const records=c.records.filter(r=>!r.rejected),selected=placement[c.compact?'compact':'desktop'];
  assert.equal(selected.length,38);assert.equal(records.length,38);
  assert.equal(new Set(selected.map(p=>p.family)).size,7);
  for(let i=0;i<selected.length;i++){
    for(const [key,value] of Object.entries(selected[i]))assert.equal(value,records[i][key]);
    assert.ok(Object.entries(selected[i]).filter(([key])=>key!=='family').every(([,v])=>Number.isFinite(v)));
    assert.ok(records[i].upperBaseGap<=-.05);assert.ok(records[i].exposure>=.5);
    if(records[i].kind==='outflow')assert.ok(records[i].minimumFlowFraction>.4);
  }
}
const report={passed:true,at:new Date().toISOString(),baseline,method:'Exact retained top-level functions and full terrain runtime text with only the new component mount allowed; unchanged shared terrain/water/tree modules. Original rock SHA, seven runtime families and both baked placement sets matched to actual-source triangle grounding results.',retainedFunctions:retained,placementCounts:[38,38],sourceSha256:placement.sourceSha256};
await fs.writeFile(`${root}/retained-source.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,retainedFunctions:retained.length,placementCounts:report.placementCounts}));
