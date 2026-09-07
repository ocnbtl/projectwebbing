// A material release must not silently change the accepted terrain, drainage,
// vegetation, ocean, lighting or camera implementation.
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import assert from 'node:assert/strict';
const file='src/components/internal/ridge-production-v116.tsx';
const baseline='02b8028f3385a6df91258380648c777eea75e417';
const before=execFileSync('git',['show',`${baseline}:${file}`],{encoding:'utf8'});
const after=await fs.readFile(file,'utf8');
function declarations(text) {
  const ast=ts.createSourceFile(file,text.replaceAll('\r\n','\n'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  return new Map(ast.statements.filter(ts.isFunctionDeclaration).map(node=>[node.name.text,node.getText(ast)]));
}
const a=declarations(before), b=declarations(after);
const removed=['prepareTexture','preparePbrTextureSet','createTerrainMaterial','createDetailedTerrainMaterial'];
const changed=['TerrainChunk','CompactJourneyTerrain','MobileTerminalTerrain','DetailedTerrainChunk'];
const identical=[];
for(const [name,body] of a) {
  if(removed.includes(name)){assert.ok(!b.has(name));continue;}
  if(changed.includes(name))continue;
  const expected = name === 'RidgeProductionV116'
    ? body.replaceAll('...DETAILED_GROUND_TEXTURES.forest, ...DETAILED_GROUND_TEXTURES.rock','...TERRAIN_SURFACE.sources') : body;
  assert.ok(b.get(name)===expected,`Unexpected non-material change: ${name}`);identical.push(name);
}
assert.equal(b.size,a.size-removed.length);
const report={baseline,file,identicalFunctions:identical,removed,materialConsumers:changed,passed:true,scope:'Exact function source parity after line-ending normalization and the explicit source-list replacement in RidgeProductionV116. Runtime topology and rendering are covered by the matched browser journey.'};
await fs.writeFile('output/releases/madagin-cliff-20260907/geometry-parity.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,identicalFunctions:identical.length,removed,changed}));
