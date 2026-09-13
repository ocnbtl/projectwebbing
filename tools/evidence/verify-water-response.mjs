import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {Vector3,BackSide} from 'three';
const root=process.env.MADAGIN_WATER_EVIDENCE??'output/releases/madagin-water-response-20260913';
const baseline='75b553ae148ce14c43567fcfc11dc5d5c85ac9c6';
const old=p=>execFileSync('git',['show',baseline+':'+p],{encoding:'utf8',maxBuffer:12e6}).replaceAll('\r\n','\n');
const read=async p=>(await fs.readFile(p,'utf8')).replaceAll('\r\n','\n');
const functions=s=>new Map(ts.createSourceFile('source.tsx',s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX).statements.filter(n=>ts.isFunctionDeclaration(n)&&n.name).map(n=>[n.name.text,n.getText()]));
const scope=[];
for(const [file,allowed] of [['ridge-production-v116.tsx',['createWaterMaterial','createOceanMaterial','Ocean']]]){
 const p='src/components/internal/'+file,a=functions(old(p)),b=functions(await read(p)),changed=[];
 for(const [name,body] of a)if(b.get(name)!==body)changed.push(name);
 assert.deepEqual(changed.sort(),allowed.sort());scope.push({file,unchangedFunctions:a.size-changed.length,changed});
}
const protectedFiles=['cascade-contact.ts','cascade-field.json','lake-shore.ts','channel-profile.ts','channel-water.ts','plunge-basin.ts','aerial-perspective.ts','coastal-landform.ts','valley-hollows.ts','falling-water.tsx'];
for(const file of protectedFiles){const p='src/components/internal/'+file;assert.equal(await read(p),old(p),file+' authority unchanged');}
const oceanOld=old('src/components/internal/ocean-wave-field.ts'),ocean=await read('src/components/internal/ocean-wave-field.ts');
const coast=s=>s.match(/float oceanCoast\(vec2 p\) \{[\s\S]*?\n  \}/)[0];assert.equal(coast(ocean),coast(oceanOld));
const result={at:new Date().toISOString(),passed:true,baseline,scope,protectedFiles,waterGeometry:'Exact baseline source; rejected cascade trials preserved outside release',coastAuthorityExact:true,limits:'Fresh exact protected-source and function-scope checks against immutable 75b553a; reuse its structural geometry evidence. Shader execution, visual quality and costs are separate browser gates.'};
await fs.writeFile(root+'/geometry-preservation.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
