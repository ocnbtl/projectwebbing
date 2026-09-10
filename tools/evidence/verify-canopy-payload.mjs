import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(path.resolve(process.env.MADAGIN_PIPELINE_PACKAGE??'output/releases/madagin-canopy-20260906/pipeline/package.json'));
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS}=require('@gltf-transform/extensions'),{MeshoptDecoder}=require('meshoptimizer');
const sharp=require('sharp');await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const derivative=process.env.MADAGIN_ASSET_OUTPUT??'public/world/canopy-payload-v1',original='public/world/canopy-v1';
const hash=b=>createHash('sha256').update(b).digest('hex');
const report={passed:false,models:[],textures:[]};
const provenance=JSON.parse(await fs.readFile(path.join(derivative,'provenance.json')));
for(const model of provenance.models){
 const a=await io.read(path.join(original,model.file)),b=await io.read(path.join(derivative,model.file));
 const records=[];
 for(const n of b.getRoot().listNodes()){
  const old=a.getRoot().listNodes().find(x=>x.getName()===n.getName());assert.ok(old);assert.deepEqual(n.getMatrix(),old.getMatrix());
  const x=old.getMesh().listPrimitives(),y=n.getMesh().listPrimitives();assert.equal(x.length,y.length);
  for(let i=0;i<x.length;i++){
   assert.deepEqual(x[i].listSemantics(),y[i].listSemantics());
   const attrs=['indices',...x[i].listSemantics()];
   for(const attr of attrs){const p=attr==='indices'?x[i].getIndices():x[i].getAttribute(attr),q=attr==='indices'?y[i].getIndices():y[i].getAttribute(attr);assert.equal(p.getComponentType(),q.getComponentType());assert.equal(p.getNormalized(),q.getNormalized());assert.deepEqual(p.getArray(),q.getArray());}
  }
  records.push({node:n.getName(),primitives:y.length,allAttributesAndIndicesExact:true,transformExact:true});
 }
 const json=async p=>{const raw=await fs.readFile(p);return JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)).toString());};
 const aj=await json(path.join(original,model.file)),bj=await json(path.join(derivative,model.file));
 for(const key of ['materials','textures','samplers'])assert.deepEqual(aj[key],bj[key]);
 assert.deepEqual(aj.images.map(({uri,...x})=>x),bj.images.map(({uri,...x})=>x));
 assert.equal(hash(await fs.readFile(path.join(original,model.file))),model.sourceSha256);
 report.models.push({file:model.file,records,materialParametersExact:true,samplersExact:true,removedNodes:model.removedNodes});
}
for(const t of provenance.textures){
 const a=await fs.readFile(path.join(original,t.source)),b=await fs.readFile(path.join(derivative,t.uri));
 assert.equal(hash(a),t.sourceSha256);assert.equal(hash(b),t.sha256);
 const am=await sharp(a).metadata(),bm=await sharp(b).metadata();
 assert.equal(am.width,bm.width);assert.equal(am.height,bm.height);assert.deepEqual(am.icc,bm.icc);assert.equal(bm.chromaSubsampling,'4:4:4');
 assert.ok(t.angularP99<5);assert.ok(t.psnr>39);assert.ok(b.length<a.length);
 report.textures.push({...t,dimensionsAndProfilePreserved:true});
}
assert.equal(report.models.find(x=>x.file==='vegetation-mid.glb').records.length,4);
report.passed=true;report.savedBytes=provenance.savedBytes;
await fs.writeFile(process.env.MADAGIN_PAYLOAD_REPORT??'output/releases/madagin-leaf-material-20260909/payload-checks.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,models:report.models.length,renderedNodes:report.models.reduce((s,x)=>s+x.records.length,0),normalMaps:report.textures.length,savedBytes:report.savedBytes}));
