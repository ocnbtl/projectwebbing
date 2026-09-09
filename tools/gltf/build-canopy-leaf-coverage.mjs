// Offline derivatives of the preserved CC0 sources; no source file is modified.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const require=createRequire(path.resolve('output/releases/madagin-canopy-20260906/pipeline/package.json'));
const {NodeIO}=require('@gltf-transform/core');
const {ALL_EXTENSIONS,EXTMeshoptCompression,EXTTextureWebP}=require('@gltf-transform/extensions');
const {weld,prune,simplifyPrimitive,quantize,reorder}=require('@gltf-transform/functions');
const {MeshoptEncoder,MeshoptDecoder,MeshoptSimplifier}=require('meshoptimizer');
const sharp=require('sharp');
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready,MeshoptSimplifier.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
const out=path.resolve('public/world/leaf-canopy-v1');await fs.mkdir(path.join(out,'textures'),{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
function topology(doc) {
 return doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives().map(p=>{
  const semantics=p.listSemantics().sort(),vertices=Array.from({length:p.getAttribute('POSITION').getCount()},(_,i)=>semantics.flatMap(s=>{const a=p.getAttribute(s),n=a.getElementSize();return Array.from(a.getArray().slice(i*n,i*n+n));}).join(','));
  const index=p.getIndices().getArray(),faces=[];
  for(let i=0;i<index.length;i+=3){const v=[vertices[index[i]],vertices[index[i+1]],vertices[index[i+2]]];let first=0;for(let j=1;j<3;j++)if(v[j]<v[first])first=j;faces.push(sha(v.slice(first).concat(v.slice(0,first)).join('|')));}
  return sha(faces.sort().join(''));
 }));
}
function reduceLeaves(p,lod) {
 const positions=p.getAttribute('POSITION').getArray(),indices=p.getIndices().getArray();
 const parent=Uint32Array.from({length:positions.length/3},(_,i)=>i);
 const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 for(let i=0;i<indices.length;i+=3){parent[root(indices[i+1])]=root(indices[i]);parent[root(indices[i+2])]=root(indices[i]);}
 const groups=new Map();for(let i=0;i<indices.length;i+=3){const key=root(indices[i]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(indices[i],indices[i+1],indices[i+2]);}
 const selected=[],attributes=Object.fromEntries(p.listSemantics().map(s=>[s,[]]));let leafIndex=0,offset=0,maxLeafError=0;
 for(const group of groups.values()){
  const keep=lod==='near'||leafIndex%3===0;leafIndex++;if(!keep)continue;
  const unique=[...new Set(group)],map=new Map(unique.map((v,i)=>[v,i]));
  const local=Float32Array.from(unique.flatMap(i=>Array.from(positions.slice(i*3,i*3+3))));
  const [reduced,error]=MeshoptSimplifier.simplify(Uint32Array.from(group.map(i=>map.get(i))),local,3,6,.35);
  const retained=reduced.length>=6?reduced:Uint32Array.from(group.map(i=>map.get(i)));
  maxLeafError=Math.max(maxLeafError,error);const used=[...new Set(retained)],remap=new Map(used.map((v,i)=>[v,offset+i]));
  const center=[0,1,2].map(c=>unique.reduce((sum,i)=>sum+positions[i*3+c],0)/unique.length);
  for(const semantic of p.listSemantics()){
   const accessor=p.getAttribute(semantic),array=accessor.getArray(),size=accessor.getElementSize();
   for(const i of used)for(let c=0;c<size;c++){
    let value=array[unique[i]*size+c];
    // Distant leaf sampling preserves the whole 3D crown distribution. Modest
    // leaf expansion maintains projected cover; never a whole-tree billboard.
    if(semantic==='POSITION'&&lod==='far')value=center[c]+(value-center[c])*2.05;
    attributes[semantic].push(value);
   }
  }
  selected.push(...Array.from(retained,i=>remap.get(i)));offset+=used.length;
 }
 for(const semantic of p.listSemantics()){const accessor=p.getAttribute(semantic);accessor.setArray(new (accessor.getArray().constructor)(attributes[semantic]));}
 p.getIndices().setArray(new Uint32Array(selected));
 return {sourceLeaves:groups.size,retainedLeaves:lod==='near'?groups.size:Math.ceil(groups.size/3),farLeafExpansion:lod==='near'?1:2.05,maxLeafRelativeError:maxLeafError};
}
const report={version:"leaf-coverage-1",license:'CC0-1.0',classification:'Generic licensed tree architecture, not a survey of Hawaiian species.',policy:"Sources remain untouched. Existing near derivatives remain unchanged; these efficient derivatives retain one in three leaves across the whole 3D crown and expand those leaves 2.05x locally. Bark/branches use Meshopt relative error .006 near/.012 far. Position/normal/UV quantization is 14/10/12 bits. World transforms are decoded before rooting and normalization. Shared 512px WebP maps retain data at quality95/color90; black leaf-atlas margins acquire alpha and transparent RGB is filled from the opaque source mean to avoid dark mips. Runtime alpha cutoff .12 with MSAA coverage. Artistic height/width variation is shared by all parts. These are generic trees, not native species measurements.",assets:[]};
for(const [variant,name] of ['island_tree_02','tree_small_02'].entries()) {
 const source=`public/world/assets/polyhaven/${name}/${name}_1k.gltf`;
 const descriptor=JSON.parse(await fs.readFile(source));
 const dependencies=[source,...[...descriptor.buffers,...descriptor.images].map(x=>path.posix.join(path.posix.dirname(source),x.uri))];
 const inputs=await Promise.all(dependencies.map(async p=>({path:p,sha256:sha(await fs.readFile(p))})));
 for(const lod of ['far']) {
  const doc=await io.read(source);await doc.transform(weld());
  const parts=[];
  for(const mesh of doc.getRoot().listMeshes())for(const p of mesh.listPrimitives()) {
   const unusedSecondUV=!!p.getAttribute('TEXCOORD_1')&&!JSON.stringify(descriptor.materials).includes('"texCoord":1');
   if(unusedSecondUV)p.setAttribute('TEXCOORD_1',null);
   const material=p.getMaterial(),label=material.getName();
   const count=p.getIndices().getCount()/3;
   const target=/leaves/.test(label)?(lod==='near'?18000:5000):/branch/.test(label)?(lod==='near'?4000:900):(lod==='near'?2000:600);
   const error=lod==='near'?.006:.012;
   const leafPolicy=/leaves/.test(label)?reduceLeaves(p,lod):null;
   if(!leafPolicy)simplifyPrimitive(p,{simplifier:MeshoptSimplifier,ratio:Math.min(1,target/count),error,lockBorder:false});
   const a=p.getAttribute('POSITION').getArray();assert.ok(Array.from(a).every(Number.isFinite));
   parts.push({material:label,sourceTriangles:count,triangles:p.getIndices().getCount()/3,errorFraction:leafPolicy?null:error,leafPolicy,unusedSecondUVRemoved:unusedSecondUV});
  }
  for(const tex of doc.getRoot().listTextures()) {
   let source=tex.getImage();
   if(/leaves.*diff/.test(tex.getName())){
    const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    for(let i=0;i<data.length;i+=4)data[i+3]=Math.round(Math.max(0,Math.min(1,(Math.max(data[i],data[i+1],data[i+2])-8)/12))*255);
    const sum=[0,0,0];let opaque=0;
    for(let i=0;i<data.length;i+=4)if(data[i+3]>240){for(let c=0;c<3;c++)sum[c]+=data[i+c];opaque++;}
    // Black atlas gutters otherwise darken every subpixel leaf in mip levels.
    // Fill transparent RGB with the measured atlas mean, retaining its alpha.
    for(let i=0;i<data.length;i+=4)if(data[i+3]<32)for(let c=0;c<3;c++)data[i+c]=Math.round(sum[c]/opaque);
    source=await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
   }
   const bytes=await sharp(source).resize({width:512,height:512,fit:'inside',withoutEnlargement:true}).webp({quality:/nor|arm/.test(tex.getName())?95:90,alphaQuality:100,effort:5}).toBuffer();
   tex.setImage(bytes).setMimeType('image/webp').setURI(`../rooted-trees-v1/textures/${sha(bytes)}.webp`);
  }
  await doc.transform(prune({keepAttributes:true}),quantize({quantizePosition:14,quantizeNormal:10,quantizeTexcoord:12}));
  const geometryBeforeOrder=topology(doc);await doc.transform(reorder({encoder:MeshoptEncoder,target:'size'}));assert.deepEqual(topology(doc),geometryBeforeOrder,'Vertex reorder changed a triangle or its used attributes');
  doc.createExtension(EXTTextureWebP).setRequired(true);
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
  const pack=await io.writeJSON(doc),bin=Buffer.from(pack.resources[pack.json.buffers[0].uri]);delete pack.json.buffers[0].uri;
  const textures=[];
  for(const image of pack.json.images){const b=Buffer.from(pack.resources[image.uri]);assert.ok(b.equals(await fs.readFile(path.join(out,image.uri))),'Shared texture changed');textures.push({path:image.uri,bytes:b.length,sha256:sha(b)});}
  const json=Buffer.from(JSON.stringify(pack.json)),j=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),b=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]);
  const h=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);h.write('glTF');h.writeUInt32LE(2,4);h.writeUInt32LE(28+j.length+b.length,8);jh.writeUInt32LE(j.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(b.length);bh.writeUInt32LE(0x004e4942,4);
  const bytes=Buffer.concat([h,jh,j,bh,b]),file=`tree-${variant}-${lod}.glb`;await fs.writeFile(path.join(out,file),bytes);
  const decoded=await io.read(path.join(out,file));assert.equal(decoded.getRoot().listMeshes().reduce((n,m)=>n+m.listPrimitives().reduce((s,p)=>s+p.getIndices().getCount()/3,0),0),parts.reduce((s,p)=>s+p.triangles,0));
  report.assets.push({file,source,url:`https://polyhaven.com/a/${name}`,inputs,lod,parts,bytes:bytes.length,sha256:sha(bytes),textures,triangleAttributesPreservedByReorder:true});
  console.log(JSON.stringify({file,bytes:bytes.length,parts}));
 }
}
await fs.writeFile(path.join(out,'provenance.json'),JSON.stringify(report,null,2)+'\n');
