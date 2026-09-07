import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';import ts from 'typescript';import assert from 'node:assert/strict';
const file='src/components/internal/ridge-production-v116.tsx',baseline='71fd8221a5c666ce5e30abd3287ed6ee410d07f8';
const before=execFileSync('git',['show',`${baseline}:${file}`],{encoding:'utf8'}),after=await fs.readFile(file,'utf8');
const functions=text=>{const ast=ts.createSourceFile(file,text.replaceAll('\r\n','\n'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);return new Map(ast.statements.filter(ts.isFunctionDeclaration).map(n=>[n.name.text,n.getText(ast)]));};
const a=functions(before),b=functions(after);
const removed=['DetailedVegetationLod','InstancedDetailedVegetation','InstancedIslandTreeImpostorBatch','InstancedSourceQualityPachira','SourceQualityIslandTreeCanopy','SourceQualityPachiraAnchors','canopyArchitecture','canopyArchitectureScale','detailedPlacementSource','detailedSourceKey','detailedVegetationTint','prepareDetailedVegetation','prepareSourceQualityPachira','sourceQualityPachiraKey'];
const changed=['EcologyChunk','CoastalEcology','MobileTerminalTerrain','V116Atmosphere'];const identical=[];
for(const [name,body] of a){
 if(removed.includes(name)){assert.ok(!b.has(name));continue;}
 if(changed.includes(name))continue;
 const expected=name==='RidgeProductionV116'?body.replaceAll('SOURCE_QUALITY_PACHIRA_URL, ','...ROOTED_TREES.sources, ').replaceAll('...SOURCE_QUALITY_ISLAND_TREE_IMPOSTOR_URLS, ',''):body;
 assert.equal(b.get(name),expected,`Unexpected change outside tree/shadow scope: ${name}`);identical.push(name);
}
assert.equal(b.size,a.size-removed.length);
const lab='src/components/internal/world-lab.tsx';const labBefore=execFileSync('git',['show',`${baseline}:${lab}`],{encoding:'utf8'}).replaceAll('\r\n','\n');
assert.equal((await fs.readFile(lab,'utf8')).replaceAll('\r\n','\n'),labBefore.replaceAll('shadows={device.tier !== "conservative" && !device.mobile ? "basic" : false}','shadows={device.tier !== "conservative" && !device.mobile ? "soft" : false}'));
await fs.writeFile('output/releases/madagin-ecology-20260907/scope-checks.json',JSON.stringify({baseline,passed:true,identicalFunctions:identical,removed,changed,canvasChange:'Basic to soft shadow filtering only',scope:'Retained terrain/water/camera function bodies are exact after LF normalization. This is source-scope evidence; rendered checks establish appearance.'},null,2));console.log(JSON.stringify({passed:true,identicalFunctions:identical.length}));
