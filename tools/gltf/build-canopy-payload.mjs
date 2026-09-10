// Same-resolution derivatives; original CC0 sources are never overwritten.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(path.resolve(process.env.MADAGIN_PIPELINE_PACKAGE??'output/releases/madagin-canopy-20260906/pipeline/package.json'));
const sharp=require('sharp');
const source=path.resolve('public/world/canopy-v1');
const out=path.resolve(process.env.MADAGIN_ASSET_OUTPUT??'public/world/canopy-payload-v1');
const sha=b=>createHash('sha256').update(b).digest('hex');
const align=n=>Math.ceil(n/4)*4;
await fs.mkdir(path.join(out,'textures'),{recursive:true});
const report={version:'canopy-payload-1',license:'CC0-1.0',sources:['https://polyhaven.com/a/island_tree_01','https://polyhaven.com/a/pachira_aquatica_01','https://polyhaven.com/a/tree_small_02'],policy:'Preserve every rendered mesh attribute and material setting. Remove only six canopy variants unused by both runtime consumers. Four 1024-square bark normal maps use JPEG quality 95, 4:4:4, retaining existing ICC profiles. This is lossy encoding, not a visual realism improvement.',textures:[],models:[]};
const mappings=new Map();
for(const file of ['island-tree.glb','vegetation-mid.glb']){
 const original=await fs.readFile(path.join(source,file));
 assert.equal(original.readUInt32LE(0),0x46546c67);
 const jsonLength=original.readUInt32LE(12),j=JSON.parse(original.subarray(20,20+jsonLength).toString());
 const sourceJson=structuredClone(j),sourceBin=original.subarray(28+jsonLength);
 let bin=sourceBin;
 for(const im of j.images){
  const oldUri=im.uri;
  if(im.mimeType==='image/jpeg'){
   assert.match(im.name,/nor_gl/);
   if(!mappings.has(oldUri)){
    const bytes=await fs.readFile(path.join(source,oldUri)),meta=await sharp(bytes).metadata();
    assert.equal(meta.width,1024);assert.equal(meta.height,1024);assert.equal(meta.hasAlpha,false);
    const encoded=await sharp(bytes,{ignoreIcc:true}).keepIccProfile().jpeg({quality:95,chromaSubsampling:'4:4:4',optimiseCoding:true}).toBuffer();
    assert.ok(encoded.length<bytes.length);
    const a=await sharp(bytes,{ignoreIcc:true}).raw().toBuffer(),b=await sharp(encoded,{ignoreIcc:true}).raw().toBuffer();
    assert.equal(a.length,b.length);let squareError=0;const angles=[];
    for(let i=0;i<a.length;i+=3){
     const u=[a[i]/127.5-1,a[i+1]/127.5-1,a[i+2]/127.5-1],v=[b[i]/127.5-1,b[i+1]/127.5-1,b[i+2]/127.5-1];
     const cosine=u.reduce((s,x,k)=>s+x*v[k],0)/(Math.hypot(...u)*Math.hypot(...v));
     angles.push(Math.acos(Math.max(-1,Math.min(1,cosine)))*180/Math.PI);
     for(let k=0;k<3;k++)squareError+=(a[i+k]-b[i+k])**2;
    }
    angles.sort((a,b)=>a-b);
    const entry={source:oldUri,sourceSha256:sha(bytes),sourceBytes:bytes.length,uri:'textures/'+sha(encoded)+'.jpeg',sha256:sha(encoded),bytes:encoded.length,width:1024,height:1024,quality:95,chroma:'4:4:4',iccRetained:!!meta.icc,psnr:10*Math.log10(255**2/(squareError/a.length)),angularP95:angles[Math.floor(angles.length*.95)],angularP99:angles[Math.floor(angles.length*.99)],angularMax:angles.at(-1)};
    await fs.writeFile(path.join(out,entry.uri),encoded);mappings.set(oldUri,entry);report.textures.push(entry);
   }
   im.uri=mappings.get(oldUri).uri;
  }else im.uri='../canopy-v1/'+oldUri;
 }
 if(file==='vegetation-mid.glb'){
  const keep=['mid_variant_04','mid_variant_06','mid_variant_14','mid_variant_15'];
  const nodes=j.nodes.filter(n=>keep.includes(n.name));assert.equal(nodes.length,4);assert.ok(nodes.every(n=>!n.children));
  const meshes=nodes.map(n=>j.meshes[n.mesh]);
  const ids=[...new Set(meshes.flatMap(m=>m.primitives.flatMap(p=>[p.indices,...Object.values(p.attributes)])))].sort((a,b)=>a-b);
  const accessorMap=new Map(ids.map((id,i)=>[id,i]));const accessors=ids.map(id=>structuredClone(j.accessors[id]));
  assert.ok(accessors.every(a=>!a.sparse));
  const viewIds=[...new Set(accessors.map(a=>a.bufferView))].sort((a,b)=>a-b),viewMap=new Map(viewIds.map((id,i)=>[id,i]));
  const pieces=[];let offset=0,fallbackOffset=0;
  const views=viewIds.map(id=>{
   const view=structuredClone(j.bufferViews[id]),ext=view.extensions.EXT_meshopt_compression;
   assert.equal(view.buffer,1);assert.equal(ext.buffer,0);
   const bytes=sourceBin.subarray(ext.byteOffset,ext.byteOffset+ext.byteLength);assert.equal(bytes.length,ext.byteLength);
   pieces.push(bytes,Buffer.alloc(align(bytes.length)-bytes.length));ext.byteOffset=offset;offset+=align(bytes.length);
   view.byteOffset=fallbackOffset;fallbackOffset+=align(view.byteLength);return view;
  });
  bin=Buffer.concat(pieces);j.buffers[0].byteLength=bin.length;j.buffers[1].byteLength=fallbackOffset;
  accessors.forEach(a=>a.bufferView=viewMap.get(a.bufferView));
  meshes.forEach(m=>m.primitives.forEach(p=>{p.indices=accessorMap.get(p.indices);for(const k of Object.keys(p.attributes))p.attributes[k]=accessorMap.get(p.attributes[k]);}));
  nodes.forEach((n,i)=>n.mesh=i);j.nodes=nodes;j.meshes=meshes;j.accessors=accessors;j.bufferViews=views;j.scenes[0].nodes=nodes.map((_,i)=>i);
  assert.equal(j.scenes.length,1);
 }
 const raw=Buffer.from(JSON.stringify(j)),json=Buffer.concat([raw,Buffer.alloc(align(raw.length)-raw.length,32)]),paddedBin=Buffer.concat([bin,Buffer.alloc(align(bin.length)-bin.length)]),header=Buffer.alloc(20),binHeader=Buffer.alloc(8);
 header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+paddedBin.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
 binHeader.writeUInt32LE(paddedBin.length,0);binHeader.writeUInt32LE(0x004e4942,4);
 const bytes=Buffer.concat([header,json,binHeader,paddedBin]);await fs.writeFile(path.join(out,file),bytes);
 report.models.push({file,sourceSha256:sha(original),sourceBytes:original.length,sha256:sha(bytes),bytes:bytes.length,retainedNodes:j.nodes.map(n=>n.name),removedNodes:sourceJson.nodes.filter(n=>!j.nodes.some(x=>x.name===n.name)).map(n=>n.name)});
}
report.sourceBytes=[...report.models,...report.textures].reduce((s,x)=>s+x.sourceBytes,0);
report.derivativeBytes=[...report.models,...report.textures].reduce((s,x)=>s+x.bytes,0);
report.savedBytes=report.sourceBytes-report.derivativeBytes;
await fs.writeFile(path.join(out,'provenance.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
