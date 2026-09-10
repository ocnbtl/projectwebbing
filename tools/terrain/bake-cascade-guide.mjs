import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {BufferGeometry,BufferAttribute,Mesh,Matrix4} from 'three';
const out=path.resolve(process.env.MADAGIN_CASCADE_BAKE_EVIDENCE??'output/releases/madagin-water-contact-20260910/bake');
const readBaseline=p=>execFileSync('git',['show','9da720d67dd30dda4c6a38c8c8a1d9c9a6cc2308:'+p],{encoding:'utf8',maxBuffer:16e6});
await fs.mkdir(out,{recursive:true});
const require=createRequire(path.resolve('output/releases/madagin-canopy-20260906/pipeline/package.json'));
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS}=require('@gltf-transform/extensions'),{MeshoptDecoder}=require('meshoptimizer');await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const compile=async(name,source)=>{const p=path.join(out,name+'.mjs');await fs.writeFile(p,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText);return import(pathToFileURL(p).href);};
await compile('fixture-lake-shore',readBaseline('src/components/internal/lake-shore.ts'));
await compile('fixture-falling',readBaseline('src/components/internal/falling-water.tsx'));
await compile('fixture-plunge',readBaseline('src/components/internal/plunge-basin.ts'));
await compile('fixture-headwater',readBaseline('src/components/internal/ridge-headwater.ts'));
const field=JSON.parse(readBaseline('src/components/internal/native-cliff-field.json'));
let native=(readBaseline('src/components/internal/native-cliff.tsx')).replace('import field from "./native-cliff-field.json";',`const field=${JSON.stringify(field)};`).replace('from "./ridge-headwater"','from "./fixture-headwater.mjs"').replace('import {RootedTrees} from "./rooted-trees";','const RootedTrees=()=>null;');
await compile('fixture-native',native);
const vf=JSON.parse(readBaseline('src/components/internal/native-valley-field.json'));
let vs=(readBaseline('src/components/internal/native-valley.tsx')).replace('import field from "./native-valley-field.json";',`const field=${JSON.stringify(vf)};`).replace('import {RootedTrees} from "./rooted-trees";','const RootedTrees=()=>null;').replace('from "./lake-shore"','from "./fixture-lake-shore.mjs"');
await compile('fixture-native-valley',vs);
const source=readBaseline('src/components/internal/ridge-production-v116.tsx');
const parsed=ts.createSourceFile('fixture.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const fixture=parsed.statements.map(n=>{
 if(!ts.isImportDeclaration(n)||!(n.moduleSpecifier.text.startsWith('.')||n.moduleSpecifier.text.startsWith('@')))return n.getText();
 if(n.importClause?.isTypeOnly)return '';
 if(n.moduleSpecifier.text==='./falling-water')return n.getText().replace('./falling-water','./fixture-falling.mjs');
 if(n.moduleSpecifier.text==='./plunge-basin')return n.getText().replace('./plunge-basin','./fixture-plunge.mjs');
 if(n.moduleSpecifier.text==='./lake-shore')return n.getText().replace('./lake-shore','./fixture-lake-shore.mjs');
 if(n.moduleSpecifier.text==='./ridge-headwater')return n.getText().replace('./ridge-headwater','./fixture-headwater.mjs');
 if(n.moduleSpecifier.text==='./native-valley')return "import {applyNativeValley,nativeValleyWeight,NativeValleyPlants} from './fixture-native-valley.mjs';";
 if(n.moduleSpecifier.text==='./native-cliff')return `import {applyNativeCliff,nativeCliffWeight,NativeCliffPlants} from './fixture-native.mjs';`;
 return [...(n.importClause?.namedBindings?.elements??[])].filter(e=>!e.isTypeOnly).map(e=>`const ${e.name.text}={};`).join('\n');
}).join('\n')+'\nexport {extendJourneyCoast,removeCoplanarBoundaryWall,createNativeRidgeSurface,createRidgeErosionTerrainGeometry,geometrySurfaceForMerge,v116RiverCenter,ridgeChannelWidth,createRidgeHeadwaterGeometry,createIntegratedRiverGeometry,outflowTerrainSampler,createWaterfallOutflowGeometry,createIntegratedWatershedTerrainGeometry,createExactBoundaryTerrainSeamBridge,extractTerrainSeamSamples,createIntegratedLakeGeometry,createWaterMaterial,createWaterfallPlungeGeometry,createCumulativeWaterfallGeometry,waterfallOutflowCenter,v116RiverHalfWidth,waterfallUpperLevel,waterfallUpperCenter,waterfallUpperHalfWidth,waterfallUpperBankWidth};';
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



const terrain=[];
for(const compact of [false,true]){const v=await sourceMesh(compact,'valley'),r=compact?null:await sourceMesh(false,'ridge'),a=compact?null:await sourceMesh(false,'alpine');const g=runtime.createIntegratedWatershedTerrainGeometry(v,compact?[]:runtime.extractTerrainSeamSamples(a,-980),compact?[]:runtime.extractTerrainSeamSamples(r,-315),compact?2:1,compact?0:1,compact?[]:runtime.extractTerrainSeamSamples(r,-287),compact?0:2);terrain.push({g,sample:sampler(g)});}
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);},startZ=-750,endZ=-704,rows=160,columns=16,points=[],height=[],body=runtime.createCumulativeWaterfallGeometry().userData.waterfallBody;
function center(z){if(z<=-730)return {x:runtime.waterfallUpperCenter(z),left:runtime.waterfallUpperBankWidth(z,-1),right:runtime.waterfallUpperBankWidth(z,1)};let lo=0,hi=1;for(let i=0;i<25;i++){const p=(lo+hi)/2,zz=-730+26*Math.pow(p,1.42)+Math.sin(p*6.1)*Math.sin(Math.PI*p)*.3;if(zz<z)lo=p;else hi=p;}const p=(lo+hi)/2,x=body.top.x+(154-body.top.x)*Math.pow(p,1.18)+Math.sin(p*7.2)*Math.sin(Math.PI*p)*.42,width=body.lipHalfWidthMeters*(1-.24*Math.sin(Math.PI*p*.8))+p*p*2.3;return {x,left:width,right:width};}
for(let row=0;row<=rows;row++){const z=startZ+(endZ-startZ)*row/rows,c=center(z);points.push([c.x,z,c.left,c.right].map(v=>+v.toFixed(5)));for(let column=0;column<=columns;column++){const across=(column/columns*2-1)*1.5,x=c.x+across*(across<0?c.left:c.right),base=Math.max(...terrain.map(t=>t.sample(x,z)));assert.ok(Number.isFinite(base));const source=runtime.waterfallUpperLevel(startZ)+.145;let y=base+.52;y=source+(y-source)*smooth((z-startZ)/5);const pool=-44.05+(endZ-z)*.012;y=Math.max(pool,y);if(row)y=Math.min(height[(row-1)*(columns+1)+column]-.002,y);if(row===rows)y=-44.05;height.push(+y.toFixed(4));}}
const cascadeField={version:'contact-cascade-1',baseline:'9da720d67dd30dda4c6a38c8c8a1d9c9a6cc2308',source:'Actual assembled desktop and compact headwall triangles, maximum surface envelope; authored monotonic water guide',startZ,endZ,rows,columns,across:1.5,points,height,limit:'Authored contact cascade, not surveyed hydraulics or a fluid simulation. Original feed and pool datums retained.'};
await fs.writeFile(path.resolve(process.env.MADAGIN_CASCADE_FIELD_OUT??'output/releases/madagin-water-contact-20260910/cascade-field-reproduced.json'),JSON.stringify(cascadeField)+'\n');await fs.writeFile(path.join(out,'baked-guide.json'),JSON.stringify({at:new Date().toISOString(),version:cascadeField.version,rows,columns,bytes:JSON.stringify(cascadeField).length,start:points[0],end:points.at(-1),heightRange:[Math.min(...height),Math.max(...height)]},null,2));console.log(JSON.stringify({rows,columns,bytes:JSON.stringify(cascadeField).length,heightRange:[Math.min(...height),Math.max(...height)]}));