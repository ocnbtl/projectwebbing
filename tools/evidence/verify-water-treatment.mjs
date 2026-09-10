// Compare the actual constructor with an immutable accepted release. Material
// changes must not silently move the retained source, bed, camera or planting.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import ts from 'typescript';
const baseline=process.env.MADAGIN_WATER_BASELINE??'c56769c2f19ee8e9548bd07369194c729d93622f';
const out=path.resolve(process.env.MADAGIN_WATER_EVIDENCE??'output/releases/madagin-water-breakup-20260910');
const source=path.resolve(process.env.MADAGIN_SOURCE_ROOT??'.');
await fs.mkdir(out,{recursive:true});
const old=p=>execFileSync('git',['show',baseline+':'+p],{maxBuffer:32e6});
const hash=b=>createHash('sha256').update(b).digest('hex');
const entries=execFileSync('git',['ls-tree','-r',baseline,'--','src','public'],{encoding:'utf8'}).trim().split('\n').map(row=>{const [meta,file]=row.split('\t');return {file,oid:meta.split(' ')[2]};});
const paths=entries.map(e=>e.file);
const blobHash=b=>createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
const changed=[];
for(const {file:p,oid} of entries){const current=await fs.readFile(path.join(source,p));if(blobHash(current)!==oid&&blobHash(Buffer.from(current.toString().replace(/\r\n/g,'\n')))!==oid)changed.push(p);}
assert.deepEqual(changed,['src/components/internal/falling-water.tsx']);
const compile=async(name,text)=>{const file=path.join(out,name+'.mjs');await fs.writeFile(file,ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText);return import(pathToFileURL(file).href);};
await compile('water-check-plunge',old('src/components/internal/plunge-basin.ts').toString());
await compile('water-check-guide',old('src/components/internal/cascade-contact.ts').toString().replace('import field from "./cascade-field.json";',`const field=${old('src/components/internal/cascade-field.json')};`).replace('"./plunge-basin"','"./water-check-plunge.mjs"'));
const modules=[];
for(const [name,text] of [['before',old('src/components/internal/falling-water.tsx').toString()],['after',await fs.readFile(path.join(source,'src/components/internal/falling-water.tsx'),'utf8')]])modules.push(await compile('water-check-'+name,text.replace('"./cascade-contact"','"./water-check-guide.mjs"')));
const geometries=modules.map(m=>m.createFallingWaterGeometry({x:195.10012,y:20.1653,z:-750},{x:154,y:-44.05,z:-704},8));
const hashes={};
for(const key of Object.keys(geometries[0].attributes)){
 const a=geometries[0].attributes[key].array,b=geometries[1].attributes[key].array;
 assert.deepEqual(b,a,`Retained ${key} changed`);hashes[key]=hash(Buffer.from(b.buffer,b.byteOffset,b.byteLength));
}
assert.deepEqual(geometries[1].index.array,geometries[0].index.array);
assert.equal(geometries[1].userData.waterfallBody.guideVersion,'contact-cascade-1');
assert.equal(geometries[1].userData.waterfallBody.version,'cascade-breakup-1');
const result={at:new Date().toISOString(),passed:true,baseline,trackedRuntimeAndPublicFiles:paths.length,changed,geometryAttributes:hashes,indices:geometries[1].index.count,triangles:geometries[1].index.count/3,limits:'Exact geometry and retained source identity. Actual shader execution, visual effect and costs require separate browser evidence.'};
await fs.writeFile(path.join(out,'water-preservation.json'),JSON.stringify(result,null,2)+'\n');
geometries.forEach(g=>g.dispose());console.log(JSON.stringify(result));
