// Offline only. Install pinned tools with the command in the generated provenance.
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const toolRoot=path.resolve(process.env.MADAGIN_ASSET_TOOLS??'output/releases/madagin-canopy-20260906/pipeline');
const require=createRequire(path.join(toolRoot,'package.json'));
const {NodeIO}=await import(pathToFileURL(require.resolve('@gltf-transform/core')));
const {ALL_EXTENSIONS,EXTMeshoptCompression,EXTTextureWebP}=await import(pathToFileURL(require.resolve('@gltf-transform/extensions')));
const {prune}=await import(pathToFileURL(require.resolve('@gltf-transform/functions')));
const {MeshoptEncoder,MeshoptDecoder}=await import(pathToFileURL(require.resolve('meshoptimizer')));
const sharp=require('sharp');
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
const out=path.resolve('public/world/canopy-v1');
await fs.mkdir(out,{recursive:true});
await fs.mkdir(path.join(out,'textures'),{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const report={version:1,tools:{gltfTransform:'4.3.0',meshoptimizer:'0.25.0',sharp:sharp.versions.sharp},policy:'No simplification or resize. Topology and node transforms retained. Raw Island Tree attributes rounded in place (position <=0.0001221 source metres/component, normal <=0.0002442/component, UV <=0.00000763/component); decoded output checked exactly against that bounded input. Mid vegetation attributes unchanged. Color WebP 95 with exact alpha; data WebP 100 accepted only below RGB RMSE 3 and mean normal angle 0.75 degrees, otherwise original retained. Licensed source packages untouched.',assets:[]};
function triangles(accessor){
 if(!accessor)return null;
 const a=accessor.getArray(),canonical=[];
 for(let i=0;i<a.length;i+=3){const face=Array.from(a.slice(i,i+3)),first=face.indexOf(Math.min(...face));canonical.push(...face.slice(first),...face.slice(0,first));}
 return sha(JSON.stringify(canonical));
}
function geometry(doc){return doc.getRoot().listNodes().filter(n=>n.getMesh()).map(n=>({name:n.getName(),matrix:n.getMatrix(),primitives:n.getMesh().listPrimitives().map(p=>({mode:p.getMode(),indices:triangles(p.getIndices()),attributes:Object.fromEntries(p.listSemantics().sort().map(s=>[s,sha(p.getAttribute(s).getArray())]))}))}));}
async function writeSharedGlb(filename,doc){
 for(const texture of doc.getRoot().listTextures()){
  const ext=texture.getMimeType().split('/')[1];
  texture.setURI(`textures/${sha(texture.getImage())}.${ext}`);
 }
 const pack=await io.writeJSON(doc);
 assert.ok(pack.json.buffers[0].uri);
 const bin=Buffer.from(pack.resources[pack.json.buffers[0].uri]);
 delete pack.json.buffers[0].uri;
 const references=[];
 for(const image of pack.json.images??[]){
  assert.ok(image.uri.startsWith('textures/'));
  const data=Buffer.from(pack.resources[image.uri]);
  await fs.writeFile(path.join(out,image.uri),data);references.push({path:image.uri,bytes:data.length,sha256:sha(data)});
 }
 const json=Buffer.from(JSON.stringify(pack.json));
 const j=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),b=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]);
 const header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);
 header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+j.length+b.length,8);
 jh.writeUInt32LE(j.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(b.length);bh.writeUInt32LE(0x004e4942,4);
 await fs.writeFile(filename,Buffer.concat([header,jh,j,bh,b]));return references;
}
async function encodeImage(input,name){
 const dataMap=/nor|normal|arm|rough/i.test(name);
 const candidate=await sharp(input).webp(dataMap?{quality:100,effort:6,smartSubsample:true}:{quality:95,alphaQuality:100,effort:6}).toBuffer();
 const original=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const decoded=await sharp(candidate).ensureAlpha().raw().toBuffer();
 let square=0,max=0,alphaMax=0,angular=0;
 for(let i=0;i<decoded.length;i+=4){for(let c=0;c<3;c++){const d=Math.abs(original.data[i+c]-decoded[i+c]);square+=d*d;max=Math.max(max,d);}alphaMax=Math.max(alphaMax,Math.abs(original.data[i+3]-decoded[i+3]));
  if(/nor|normal/i.test(name)){const a=[0,1,2].map(c=>original.data[i+c]/127.5-1),b=[0,1,2].map(c=>decoded[i+c]/127.5-1);angular+=Math.acos(Math.max(-1,Math.min(1,a.reduce((s,v,c)=>s+v*b[c],0)/(Math.hypot(...a)*Math.hypot(...b)||1))))*180/Math.PI;}
 }
 assert.equal(alphaMax,0,`Alpha changed: ${name}`);
 const rmse=Math.sqrt(square/(decoded.length/4*3)),meanAngle=angular/(decoded.length/4);
 const accepted=candidate.length<input.length && (!dataMap || (rmse<3 && meanAngle<0.75));
 return {bytes:accepted?candidate:input,webp:accepted,evidence:{name,inputBytes:input.length,outputBytes:accepted?candidate.length:input.length,size:[original.info.width,original.info.height],codec:accepted?(dataMap?'WebP 100, error-gated':'WebP 95'):'retained source',alphaMaxError:0,rgbRMSE:accepted?rmse:0,rgbMaxError:accepted?max:0,normalMeanAngleDegrees:accepted?meanAngle:0}};
}
for(const [source,target,select] of [
 ['public/world/v115/madagin-ridge-vegetation-mid-v1.15.glb','vegetation-mid.glb',new Set([0,1,2,3,4,5,6,7,14,15].map(i=>`mid_variant_${String(i).padStart(2,'0')}`))],
 ['public/world/assets/polyhaven/island_tree_01_bw/island_tree_01_bw.glb','island-tree.glb',null],
 ['public/world/assets/polyhaven/pachira_aquatica_01/pachira_aquatica_01_1k.gltf','pachira.glb',null],
 ['public/world/assets/polyhaven/rock_09/rock_09_1k.gltf','rock.glb',null],
 ['public/world/assets/polyhaven/fern_02/fern_02_1k.gltf','fern.glb',null],
 ['public/world/assets/polyhaven/shrub_04/shrub_04_1k.gltf','shrub.glb',null],
 ['public/world/assets/polyhaven/rock_moss_set_02/rock_moss_set_02_1k.gltf','moss-rock.glb',null],
]){
 const input=await fs.readFile(source),doc=await io.read(source),removed=[];
 if(select)for(const node of doc.getRoot().listNodes())if(!select.has(node.getName())){removed.push(node.getName());node.dispose();}
 await doc.transform(prune({keepAttributes:true,keepSolidTextures:true}));
 const rounding=[];
 if(target==='island-tree.glb'){
  for(const mesh of doc.getRoot().listMeshes())for(const p of mesh.listPrimitives())for(const semantic of p.listSemantics()){
   const accessor=p.getAttribute(semantic),a=accessor.getArray();
   if(!(a instanceof Float32Array))continue;
   const steps=semantic==='POSITION'?4096:/NORMAL|TANGENT/.test(semantic)?2048:65536;
   let maxError=0;const result=a.slice();
   for(let i=0;i<a.length;i++){result[i]=Math.round(a[i]*steps)/steps;maxError=Math.max(maxError,Math.abs(result[i]-a[i]));}
   assert.ok(maxError<=1/steps/2+0.000001);accessor.setArray(result);rounding.push({mesh:mesh.getName(),semantic,maxError});
  }
 }
 const before=geometry(doc),textures=[];
 for(const texture of doc.getRoot().listTextures()){
  const r=await encodeImage(Buffer.from(texture.getImage()),texture.getName());textures.push(r.evidence);
  if(r.webp){texture.setImage(r.bytes).setMimeType('image/webp').setURI('');doc.createExtension(EXTTextureWebP).setRequired(true);}
 }
 doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
 const referencedImages=await writeSharedGlb(path.join(out,target),doc);
 assert.deepEqual(geometry(await io.read(path.join(out,target))),before,`Geometry changed: ${target}`);
 const result=await fs.readFile(path.join(out,target));
 report.assets.push({source,target,inputBytes:input.length,outputBytes:result.length,inputBytesScope:source.endsWith('.gltf')?'descriptor only; dependencies recorded in original source provenance':'embedded source package',inputSha256:sha(input),outputSha256:sha(result),referencedImages,removedNodes:removed,topologyAndTransformsRetained:true,decodedAttributesMatchPreparedInput:true,rounding,textures});
 console.log(`${target}: ${input.length} -> ${result.length} bytes; verified geometry bounds and decoded attributes`);
}
// The two ground color maps are shared by both quality policies.
for(const [source,target] of [['forrest_ground_03/forrest_ground_03_diff_1k.jpg','forest-color.webp'],['aerial_grass_rock/aerial_grass_rock_diff_1k.jpg','rock-color.webp']]){
 const full=`public/world/assets/polyhaven/${source}`,input=await fs.readFile(full),r=await encodeImage(input,source);
 assert.ok(r.webp);await fs.writeFile(path.join(out,target),r.bytes);
 report.assets.push({source:full,target,inputSha256:sha(input),outputSha256:sha(r.bytes),...r.evidence});
}
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(report,null,2)+'\n');
