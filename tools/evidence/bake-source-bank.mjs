import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {BufferGeometry,BufferAttribute,Mesh,Matrix4,Vector3,CatmullRomCurve3,Group,MeshStandardMaterial} from 'three';
const sourceRoot=path.resolve(process.env.MADAGIN_SOURCE_ROOT??'.');
const out=path.resolve(process.env.MADAGIN_CASCADE_EVIDENCE??'output/releases/madagin-source-bank-20260910');
await fs.mkdir(out,{recursive:true});
const require=createRequire(path.resolve('output/releases/madagin-canopy-20260906/pipeline/package.json'));
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS}=require('@gltf-transform/extensions'),{MeshoptDecoder}=require('meshoptimizer');await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const compile=async(name,source)=>{const p=path.join(out,name+'.mjs');await fs.writeFile(p,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText);return import(pathToFileURL(p).href);};
await compile('fixture-lake-shore',await fs.readFile(sourceRoot+'/src/components/internal/lake-shore.ts','utf8'));

await compile('fixture-plunge',await fs.readFile(sourceRoot+'/src/components/internal/plunge-basin.ts','utf8'));
const cascadeData=JSON.parse(await fs.readFile(sourceRoot+'/src/components/internal/cascade-field.json'));
const cascade=await compile('fixture-cascade',(await fs.readFile(sourceRoot+'/src/components/internal/cascade-contact.ts','utf8')).replace('import field from "./cascade-field.json";',`const field=${JSON.stringify(cascadeData)};`).replace('from "./plunge-basin"','from "./fixture-plunge.mjs"'));
await compile('fixture-falling',(await fs.readFile(sourceRoot+'/src/components/internal/falling-water.tsx','utf8')).replace('from "./cascade-contact"','from "./fixture-cascade.mjs"'));
await compile('fixture-headwater',await fs.readFile(sourceRoot+'/src/components/internal/ridge-headwater.ts','utf8'));
const field=JSON.parse(await fs.readFile(sourceRoot+'/src/components/internal/native-cliff-field.json'));
let native=(await fs.readFile(sourceRoot+'/src/components/internal/native-cliff.tsx','utf8')).replace('import field from "./native-cliff-field.json";',`const field=${JSON.stringify(field)};`).replace('from "./ridge-headwater"','from "./fixture-headwater.mjs"').replace('import {RootedTrees} from "./rooted-trees";','const RootedTrees=()=>null;');
await compile('fixture-native',native);
const vf=JSON.parse(await fs.readFile(sourceRoot+'/src/components/internal/native-valley-field.json'));
let vs=(await fs.readFile(sourceRoot+'/src/components/internal/native-valley.tsx','utf8')).replace('import field from "./native-valley-field.json";',`const field=${JSON.stringify(vf)};`).replace('import {RootedTrees} from "./rooted-trees";','const RootedTrees=()=>null;').replace('from "./lake-shore"','from "./fixture-lake-shore.mjs"');
await compile('fixture-native-valley',vs);
const source=await fs.readFile(sourceRoot+'/src/components/internal/ridge-production-v116.tsx','utf8');
const parsed=ts.createSourceFile('fixture.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const fixture=parsed.statements.map(n=>{
 if(!ts.isImportDeclaration(n)||!(n.moduleSpecifier.text.startsWith('.')||n.moduleSpecifier.text.startsWith('@')))return n.getText();
 if(n.importClause?.isTypeOnly)return '';
 if(n.moduleSpecifier.text==='./cascade-contact')return n.getText().replace('./cascade-contact','./fixture-cascade.mjs');
 if(n.moduleSpecifier.text==='./falling-water')return n.getText().replace('./falling-water','./fixture-falling.mjs');
 if(n.moduleSpecifier.text==='./plunge-basin')return n.getText().replace('./plunge-basin','./fixture-plunge.mjs');
 if(n.moduleSpecifier.text==='./lake-shore')return n.getText().replace('./lake-shore','./fixture-lake-shore.mjs');
 if(n.moduleSpecifier.text==='./ridge-headwater')return n.getText().replace('./ridge-headwater','./fixture-headwater.mjs');
 if(n.moduleSpecifier.text==='./native-valley')return "import {applyNativeValley,nativeValleyWeight,NativeValleyPlants} from './fixture-native-valley.mjs';";
 if(n.moduleSpecifier.text==='./native-cliff')return `import {applyNativeCliff,nativeCliffWeight,NativeCliffPlants} from './fixture-native.mjs';`;
 return [...(n.importClause?.namedBindings?.elements??[])].filter(e=>!e.isTypeOnly).map(e=>`const ${e.name.text}={};`).join('\n');
}).join('\n')+'\nexport {waterfallSourceSurface,extendJourneyCoast,removeCoplanarBoundaryWall,createNativeRidgeSurface,createRidgeErosionTerrainGeometry,geometrySurfaceForMerge,v116RiverCenter,ridgeChannelWidth,createRidgeHeadwaterGeometry,createIntegratedRiverGeometry,outflowTerrainSampler,createWaterfallOutflowGeometry,createIntegratedWatershedTerrainGeometry,createExactBoundaryTerrainSeamBridge,extractTerrainSeamSamples,createIntegratedLakeGeometry,createWaterMaterial,createWaterfallPlungeGeometry,createCumulativeWaterfallGeometry,waterfallOutflowCenter,v116RiverHalfWidth,waterfallUpperLevel,waterfallUpperCenter,waterfallUpperHalfWidth,waterfallUpperBankWidth,createWaterfallUpperStreamGeometry,activeTerrainChunks};';
const runtime=await compile('fixture-runtime',fixture);
function sampler(g){
 const p=g.getAttribute('position'),index=g.index,bins=new Map(),cell=12,at=i=>index?index.getX(i):i;
 for(let i=0;i<(index?.count??p.count);i+=3){const ids=[at(i),at(i+1),at(i+2)],xs=ids.map(j=>p.getX(j)),zs=ids.map(j=>p.getZ(j));for(let z=Math.floor(Math.min(...zs)/cell);z<=Math.floor(Math.max(...zs)/cell);z++)for(let x=Math.floor(Math.min(...xs)/cell);x<=Math.floor(Math.max(...xs)/cell);x++){const key=`${x},${z}`,bucket=bins.get(key)??[];bucket.push(i);bins.set(key,bucket);}}
 return (x,z)=>{let y=-Infinity;for(const i of bins.get(`${Math.floor(x/cell)},${Math.floor(z/cell)}`)??[]){const a=at(i),b=at(i+1),c=at(i+2),ax=p.getX(a),az=p.getZ(a),bx=p.getX(b),bz=p.getZ(b),cx=p.getX(c),cz=p.getZ(c),d=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(d)<1e-9)continue;const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/d,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/d;if(u>=-1e-6&&v>=-1e-6&&u+v<=1.000001)y=Math.max(y,u*p.getY(a)+v*p.getY(b)+(1-u-v)*p.getY(c));}return y;};
}
async function sourceMesh(compact,zone) {
 const doc=await io.read(compact?`public/world/v116/terrain-${zone}-v1.16.glb`:'public/world/v115/madagin-ridge-to-valley-high-v1.15.glb');
 const node=doc.getRoot().listNodes().find(n=>compact?n.getMesh():n.getName()===`${zone==="valley"?"TROPICAL_VALLEY":zone==="alpine"?"ALPINE_VALLEY":"RIDGE"}_V115_HIGH`),primitive=node.getMesh().listPrimitives()[0],g=new BufferGeometry();
 for(const [semantic,name] of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']]){const a=primitive.getAttribute(semantic);if(a)g.setAttribute(name,new BufferAttribute(a.getArray(),a.getElementSize()));}
 g.setIndex(new BufferAttribute(primitive.getIndices().getArray(),1));const mesh=new Mesh(g);mesh.matrixWorld=new Matrix4().fromArray(node.getWorldMatrix());return mesh;
}



const {normalizeChannelRock}=await compile('fixture-rock-geometry',await fs.readFile('src/components/internal/channel-rock-geometry.ts','utf8'));
const {normalizeRiparianPlant}=await compile('fixture-plant-geometry',await fs.readFile('src/components/internal/riparian-plant-geometry.ts','utf8'));
async function formsFrom(file,normalize){const d=await io.read(file),forms=[];for(const n of d.getRoot().listNodes().filter(n=>n.getMesh())){const p=n.getMesh().listPrimitives()[0],g=new BufferGeometry(),a=p.getAttribute('POSITION');g.setAttribute('position',new BufferAttribute(a.getArray(),3));g.setIndex(new BufferAttribute(p.getIndices().getArray(),1));forms.push({family:n.getName(),geometry:normalize(g,new Matrix4().fromArray(n.getWorldMatrix()))});}return forms;}
const rocks=await formsFrom('public/world/canopy-v1/moss-rock.glb',normalizeChannelRock),ferns=await formsFrom('public/world/canopy-v1/fern.glb',normalizeRiparianPlant);
await compile('fixture-compact-tree-lod',await fs.readFile('src/components/internal/compact-tree-lod.ts','utf8'));
let treeSource=(await fs.readFile('src/components/internal/rooted-trees.tsx','utf8')).replace('from "./compact-tree-lod"','from "./fixture-compact-tree-lod.mjs"').replace('import branchSupport from "./branch-canopy-support.json";',`const branchSupport=${await fs.readFile('src/components/internal/branch-canopy-support.json','utf8')};`);
const {prepareTrees}=await compile('fixture-rooted',treeSource+'\nexport {prepareTrees};'),treeForms=[];
for(const variant of [0,1]){const d=await io.read(`public/world/leaf-canopy-v1/tree-${variant}-far.glb`),group=new Group();for(const n of d.getRoot().listNodes())if(n.getMesh())for(const p of n.getMesh().listPrimitives()){const g=new BufferGeometry();for(const [semantic,name]of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']]){const a=p.getAttribute(semantic);if(a)g.setAttribute(name,new BufferAttribute(a.getArray().slice(),a.getElementSize(),a.getNormalized()));}g.setIndex(new BufferAttribute(p.getIndices().getArray().slice(),1));const m=new MeshStandardMaterial();m.name=p.getMaterial().getName();const mesh=new Mesh(g,m);mesh.matrix.fromArray(n.getWorldMatrix());mesh.matrixAutoUpdate=false;group.add(mesh);}const parts=prepareTrees(group,group,true),feet=[];let radius=0,triangles=0;for(const part of parts){triangles+=part.geometry.index.count/3;const p=part.geometry.getAttribute('position');for(let i=0;i<p.count;i++){radius=Math.max(radius,Math.hypot(p.getX(i),p.getZ(i)));if(!/leaves/.test(part.material.name)&&p.getY(i)<.005)feet.push(new Vector3().fromBufferAttribute(p,i));}}assert.ok(feet.length>2);treeForms.push({feet,radius,triangles});}
const {JOURNEY_CHECKPOINTS}=await compile('fixture-manifest',await fs.readFile('src/lib/world-manifest.ts','utf8'));
const paths=[false,true].map(compact=>new CatmullRomCurve3(JOURNEY_CHECKPOINTS.map(p=>new Vector3().fromArray(compact?p.mobileCamera:p.camera)),false,'centripetal').getPoints(1000));
const existing=(await Promise.all(['ridge','valley','lake','alpine'].map(z=>fs.readFile('public/world/v116/ecology-'+z+'-v1.16.json','utf8').then(JSON.parse)))).flatMap(x=>x.instances);
const sourceFiles=['public/world/canopy-v1/moss-rock.glb','public/world/canopy-v1/fern.glb','public/world/leaf-canopy-v1/tree-0-far.glb','public/world/leaf-canopy-v1/tree-1-far.glb'];
const sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async p=>[p,createHash('sha256').update(await fs.readFile(p)).digest('hex')])));
let seed=101015;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const layout=[];
// Unequal groups collect at bends. Keep open reaches and the final lip clear.
for(const [z,side,count]of [[-842,-1,6],[-825,1,9],[-804,-1,8],[-787,1,11],[-768,-1,7]])for(let i=0;i<count+3;i++){
 const pz=z+(random()-.5)*11,size=2.3+random()*3.8,bank=runtime.waterfallUpperBankWidth(pz,side),x=runtime.waterfallUpperCenter(pz)+side*(bank+size*.3+random()*2.7);
 layout.push({kind:'rock',x,z:pz,size,yaw:random()*Math.PI*2,squash:.58+random()*.42,tint:.64+random()*.24,family:rocks[Math.floor(random()*rocks.length)].family});
}
for(let i=0;i<1800;i++){
 const z=-851+random()*88,side=random()<.55?-1:1,bank=runtime.waterfallUpperBankWidth(z,side),distance=bank+2.7+Math.pow(random(),.7)*14;
 if(Math.sin(z*.16+side*1.4)>.73&&distance>bank+7)continue;
 const kind=i%4===0?'tree':'fern';layout.push({kind,x:runtime.waterfallUpperCenter(z)+side*distance,z,yaw:random()*Math.PI*2,height:kind==='tree'?(random()<.3?7.5+random()*2.5:3.2+random()*3.4):1.05+random()*1.15,tint:.78+random()*.2,family:ferns[Math.floor(random()*ferns.length)].family,signature:random()});
}
const dry=(x,z,margin=0)=>Math.abs(x-runtime.waterfallUpperCenter(z))>runtime.waterfallUpperBankWidth(z,x<runtime.waterfallUpperCenter(z)?-1:1)+margin;
const result={version:'source-bank-1',sourceHashes,desktop:{rocks:[],ferns:[],trees:[]},compact:{rocks:[],ferns:[],trees:[]}},cases=[];
for(const compact of [false,true]){
 const key=compact?'compact':'desktop',v=await sourceMesh(compact,'valley'),r=compact?null:await sourceMesh(false,'ridge'),a=compact?null:await sourceMesh(false,'alpine');
 const g=runtime.createIntegratedWatershedTerrainGeometry(v,compact?[]:runtime.extractTerrainSeamSamples(a,-980),compact?[]:runtime.extractTerrainSeamSamples(r,-315),compact?2:1,compact?0:1,compact?[]:runtime.extractTerrainSeamSamples(r,-287),compact?0:2),sample=sampler(g),chosen=result[key],records=[],rejected={};
 const reject=k=>rejected[k]=(rejected[k]??0)+1;
 for(const [index,p]of layout.entries()){
  if(compact&&p.kind==='rock'&&index%3===0)continue;
  if(p.kind==='fern'&&chosen.ferns.length>=(compact?60:125)||p.kind==='tree'&&chosen.trees.length>=(compact?25:48))continue;
  const cos=Math.cos(p.yaw),sin=Math.sin(p.yaw);
  if(p.kind==='rock'){
   const form=rocks.find(f=>f.family===p.family),pos=form.geometry.getAttribute('position'),h=form.geometry.boundingBox.max.y,points=[];
   for(let i=0;i<pos.count;i++){const x=p.x+(pos.getX(i)*cos+pos.getZ(i)*sin)*p.size,z=p.z+(-pos.getX(i)*sin+pos.getZ(i)*cos)*p.size,y=pos.getY(i)*p.size*p.squash;points.push({x,z,y,ground:sample(x,z),base:pos.getY(i)<h*.23});}
   if(!points.every(q=>Number.isFinite(q.ground))){reject('missing rock terrain');continue;}
   const base=points.filter(q=>q.base),y=Math.min(...base.map(q=>q.ground-q.y))-.06,exposure=Math.max(...points.map(q=>q.y+y-q.ground));
   if(exposure<.45||points.some(q=>!dry(q.x,q.z,-.3)&&q.y+y>runtime.waterfallSourceSurface(q.z)-.2)){reject('buried rock or obstructed water');continue;}
   const gap=Math.max(...base.map(q=>q.y+y-q.ground)),placement={family:p.family,x:p.x,y,z:p.z,yaw:p.yaw,size:p.size,squash:p.squash,tint:p.tint};
   if(chosen.rocks.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<(q.size+p.size)*.25)){reject('rock crowding');continue;}
   const cameraClearance=Math.min(...paths[Number(compact)].map(q=>q.distanceTo(new Vector3(p.x,y+h*p.size*p.squash*.5,p.z))-p.size*1.6));if(cameraClearance<4){reject('rock camera envelope');continue;}assert.ok(gap<=-.055);chosen.rocks.push(placement);records.push({kind:'rock',...placement,cameraClearance,baseSamples:base.length,maxBaseGap:gap,exposure,triangles:form.geometry.index.count/3});continue;
  }
  const radius=p.kind==='fern'?.23:.34,roots=Array.from({length:9},(_,i)=>sample(p.x+(i?Math.cos(i*Math.PI/4)*radius:0),p.z+(i?Math.sin(i*Math.PI/4)*radius:0)));
  if(!roots.every(Number.isFinite)||Math.max(...roots)-Math.min(...roots)>.85||!dry(p.x,p.z,p.kind==='tree'?1.8:.7)||chosen.rocks.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<q.size*.55+.65)){reject('plant wet, rocky or steep support');continue;}
  if(chosen.trees.some(q=>Math.hypot(q[2]-p.x,q[4]-p.z)<(p.kind==='tree'?3.2:1))||existing.some(q=>q[1]<=1&&Math.hypot(q[2]-p.x,q[4]-p.z)<2.7)){reject('existing trunk or crown crowding');continue;}
  let y=Math.min(...roots)-.06,bound=p.height*1.5,triangles=0,exposure=1,footGap=-.06,plant;
  if(p.kind==='fern'){
   if(chosen.ferns.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<1.6)){reject('fern crowding');continue;}
   const form=ferns.find(f=>f.family===p.family),pos=form.geometry.getAttribute('position');let visible=0,wet=false;
   for(let i=0;i<pos.count;i++){const x=p.x+(pos.getX(i)*cos+pos.getZ(i)*sin)*p.height,z=p.z+(-pos.getX(i)*sin+pos.getZ(i)*cos)*p.height,ground=sample(x,z);if(y+pos.getY(i)*p.height>ground+.01)visible++;if(!Number.isFinite(ground)||!dry(x,z,.1))wet=true;}
   exposure=visible/pos.count;if(wet||exposure<.63){reject('wet or buried fern');continue;}triangles=form.geometry.index.count/3;plant={family:p.family,x:p.x,y,z:p.z,yaw:p.yaw,height:p.height,tint:p.tint};
  }else{
   const layer=p.height>7?1:2,scale=p.height/(layer===1?10:5.3),signature=Math.abs(Math.round(p.x*.73+p.z*.47+p.signature*31)),variant=signature%2,form=treeForms[variant],yaw=p.yaw+(signature%17)*.19,c=Math.cos(yaw),s=Math.sin(yaw),sx=p.height*(.9+(signature%9)*.025),sz=p.height*(.91+(signature%7)*.025);
   const feet=form.feet.map(v=>{const x=p.x+v.x*sx*c+v.z*sz*s,z=p.z-v.x*sx*s+v.z*sz*c;return{ground:sample(x,z),y:v.y*p.height};});
   if(!feet.every(q=>Number.isFinite(q.ground))){reject('missing trunk footprint');continue;}y=Math.min(y,...feet.map(q=>q.ground-q.y-.04));footGap=Math.max(...feet.map(q=>q.y+y-q.ground));if(Math.max(...roots)-y>1.1){reject('buried trunk');continue;}
   bound=Math.hypot(form.radius*p.height*1.13+.03*p.height,p.height*.5);triangles=form.triangles;plant=[0,layer,p.x,y+.025,p.z,p.yaw,1,scale,1,p.signature];assert.ok(scale>=.55&&scale<=1.45&&footGap<-.035);
  }
  const clearance=Math.min(...paths[Number(compact)].map(q=>q.distanceTo(new Vector3(p.x,y+p.height*.5,p.z))-bound));if(clearance<4){reject('camera envelope');continue;}
  if(p.kind==='fern')chosen.ferns.push(plant);else chosen.trees.push(plant);
  records.push({kind:p.kind,x:p.x,y,z:p.z,height:p.height,rootGap:y-Math.min(...roots),footGap,exposure,cameraClearance:clearance,triangles});
 }
 console.log(JSON.stringify({compact,rocks:chosen.rocks.length,ferns:chosen.ferns.length,trees:chosen.trees.length,rejected}));
 assert.ok(chosen.rocks.length>=(compact?8:14)&&chosen.ferns.length>=35&&chosen.trees.length>=16,'Meaningful grounded bank coverage');
 const record={compact,rocks:chosen.rocks.length,ferns:chosen.ferns.length,trees:chosen.trees.length,triangles:records.reduce((s,r)=>s+r.triangles,0),maxRockBaseGap:Math.max(...records.filter(r=>r.kind==='rock').map(r=>r.maxBaseGap)),maxRootGap:Math.max(...records.filter(r=>r.kind!=='rock').map(r=>r.rootGap)),maxTrunkFootGap:Math.max(...records.filter(r=>r.kind==='tree').map(r=>r.footGap)),minPlantCameraClearance:Math.min(...records.filter(r=>r.kind!=='rock').map(r=>r.cameraClearance)),rejected,records};cases.push(record);console.log(JSON.stringify({...record,records:undefined}));g.dispose();
}
await fs.writeFile('src/components/internal/source-bank-placements.json',JSON.stringify(result)+'\n');
await fs.writeFile(out+'/bank-grounding.json',JSON.stringify({at:new Date().toISOString(),passed:true,baseline:'cd5104209071e6ba8761a8a6914b282527df33e6',version:result.version,sourceHashes,method:'Seven retained normalized scanned rock forms, lower 23 percent embedded in actual terrain; nine plant support samples and full normalized trunk footprint fitting, dry source and camera exclusions. Distinct desktop and compact fits. No terrain/water/source-asset mutation; generic plants, not native-species reconstruction.',cases},null,2)+'\n');
