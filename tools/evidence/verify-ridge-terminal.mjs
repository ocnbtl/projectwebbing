// Exercise actual source assets and merge functions: missing terrain can log an
// error without throwing a pageerror, so a successful browser load is insufficient.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {BufferGeometry,BufferAttribute,Mesh,Matrix4} from 'three';
import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'../..');
const out=path.join(root,'output/releases/madagin-ridge-20260906');
const require=createRequire(path.join(root,'output/releases/madagin-canopy-20260906/pipeline/package.json'));
const {NodeIO}=require('@gltf-transform/core');
const {ALL_EXTENSIONS}=require('@gltf-transform/extensions');
const {MeshoptDecoder}=require('meshoptimizer');
await MeshoptDecoder.ready;
async function compile(text,name){
 text=text.replace('import { PhysicalSkyEnvironment } from "./world-atmosphere";','const PhysicalSkyEnvironment=()=>null;').replace('import {RidgeCanopy} from "./ridge-canopy";','const RidgeCanopy=()=>null;');
 text+='\nexport {extractCoastalBoundarySamples,createCoastalShoulderGeometry,createConnectedRidgeGeometry};';
 const file=path.join(out,name+'.mjs');
 await fs.writeFile(file,ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText);
 return import(pathToFileURL(file).href);
}
const file='src/components/internal/ridge-production-v116.tsx';
const current=await compile(await fs.readFile(path.join(root,file),'utf8'),'terminal-current');
const before=await compile(execFileSync('git',['show',`7536e49:${file}`],{encoding:'utf8',maxBuffer:4*1024*1024}),'terminal-before');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const cases=[];
for(const [mobile,asset,nodeName] of [[true,'v116/terrain-ridge-v1.16.glb',null],[false,'v115/madagin-ridge-to-valley-high-v1.15.glb','RIDGE_V115_HIGH']]){
 const doc=await io.read(path.join(root,'public/world',asset));
 const node=doc.getRoot().listNodes().find(n=>n.getMesh()&&(!nodeName||n.getName()===nodeName));assert.ok(node);
 const p=node.getMesh().listPrimitives()[0],g=new BufferGeometry();
 for(const [semantic,name] of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']]){const a=p.getAttribute(semantic);if(a)g.setAttribute(name,new BufferAttribute(a.getArray(),a.getElementSize()))}
 g.setIndex(new BufferAttribute(p.getIndices().getArray(),1));const mesh=new Mesh(g);mesh.matrixWorld=new Matrix4().fromArray(node.getWorldMatrix());
 const results=[];
 for(const api of [before,current]){
  const boundary=api.extractCoastalBoundarySamples(mesh,-310);assert.ok(boundary.length);
  const shoulder=api.createCoastalShoulderGeometry(mobile,'balanced',boundary);
  const merged=api.createConnectedRidgeGeometry(mesh,shoulder,!mobile);assert.ok(merged,'Terminal ridge must exist');
  assert.ok(merged.index.count>1000);assert.ok(merged.getAttribute('normal'));assert.ok(merged.getAttribute('uv'));
  results.push(merged);shoulder.dispose();
 }
 if(mobile){assert.deepEqual(results[1].getAttribute('position').array,results[0].getAttribute('position').array);assert.deepEqual(results[1].index.array,results[0].index.array)}
 cases.push({mobile,asset,vertices:results[1].getAttribute('position').count,triangles:results[1].index.count/3,compactMatchesBaseline:mobile?true:null,passed:true});
 results.forEach(g=>g.dispose());g.dispose();
}
await fs.writeFile(path.join(out,'terminal-geometry-check.json'),JSON.stringify({at:new Date().toISOString(),cases},null,2)+'\n');
console.log(JSON.stringify({cases},null,2));
