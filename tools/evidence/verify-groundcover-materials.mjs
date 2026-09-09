import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as THREE from 'three';

const out='output/releases/madagin-groundcover-lighting-20260909';
const baseline='229f770f61d3f1dd38ef05b7cf02b40219f7af9f';
const file='src/components/internal/ridge-production-v116.tsx';
const source=(await fs.readFile(file,'utf8')).replaceAll('\r\n','\n');
const original=execFileSync('git',['show',`${baseline}:${file}`],{encoding:'utf8',maxBuffer:16e6}).replaceAll('\r\n','\n');
assert.equal(source.replace('      // Instance tints are separate; only multiply source colors when they exist.\n      material.vertexColors = child.geometry.hasAttribute("color");','      material.vertexColors = true;'),original);
const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const declaration=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name.text==='prepareWatershedGroundcover');
const compiled=ts.transpileModule(declaration.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const wind=[];
const prepare=Function('Mesh','Color','DoubleSide','FrontSide','enableLivingWind',compiled+'; return prepareWatershedGroundcover;')(THREE.Mesh,THREE.Color,THREE.DoubleSide,THREE.FrontSide,(material,strength)=>wind.push({material,strength}));
const require=createRequire(path.resolve('output/releases/madagin-canopy-20260906/pipeline/package.json'));
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS}=require('@gltf-transform/extensions'),{MeshoptDecoder}=require('meshoptimizer');
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const cases=[];
for(const family of ['fern','shrub','rock']){
 const asset=`public/world/canopy-v1/${family}.glb`,bytes=await fs.readFile(asset);
 assert.ok(bytes.equals(execFileSync('git',['show',`${baseline}:${asset}`],{maxBuffer:8e6})));
 const document=await io.read(asset);
 for(const node of document.getRoot().listNodes().filter(n=>n.getMesh()))for(const primitive of node.getMesh().listPrimitives()){
  const attributes=primitive.listSemantics();assert.equal(attributes.includes('COLOR_0'),false);
  const geometry=new THREE.BufferGeometry();
  for(const [semantic,name] of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']]){const accessor=primitive.getAttribute(semantic);if(accessor)geometry.setAttribute(name,new THREE.BufferAttribute(accessor.getArray(),accessor.getElementSize(),accessor.getNormalized()));}
  const scene=new THREE.Group(),originalMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',alphaTest:.5});
  const mesh=new THREE.Mesh(geometry,originalMaterial);mesh.matrixAutoUpdate=false;mesh.matrix.fromArray(node.getWorldMatrix());scene.add(mesh);
  const parts=prepare(scene,family),part=parts[0];assert.equal(parts.length,1);assert.equal(part.geometry,geometry);assert.notEqual(part.material,originalMaterial);assert.equal(part.material.vertexColors,false);assert.equal(originalMaterial.vertexColors,false);assert.equal(originalMaterial.color.getHex(),0xffffff);assert.deepEqual(part.matrixWorld.elements,mesh.matrixWorld.elements);
  // Exercise the retained colored-source branch with the very same material path.
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count*3).fill(1),3));
  const colored=prepare(scene,family)[0];assert.equal(colored.material.vertexColors,true);assert.notEqual(colored.material,part.material);assert.equal(part.material.vertexColors,false);
  cases.push({family,name:node.getName(),attributes,sourceSha256:createHash('sha256').update(bytes).digest('hex'),uncoloredEnabled:part.material.vertexColors,coloredEnabled:colored.material.vertexColors,transformsRetained:true,sharedSourceUnmodified:true});
 }
}
const binding=await fs.readFile('node_modules/three/src/renderers/webgl/WebGLPrograms.js','utf8');
assert.match(binding,/vertexColors: material.vertexColors/);assert.match(binding,/instancingColor: IS_INSTANCEDMESH && object.instanceColor !== null/);
const report={passed:true,baseline,cases,allowedRuntimeEdits:'Only source color attribute eligibility. All other world code, transforms, palette, instance colors, light, wind, terrain, camera, water and placements exact.',topLevelFunctions:ast.statements.filter(ts.isFunctionDeclaration).length,windCalls:wind.length,extraAssetBytes:0,materialScope:'Scanned watershed groundcover fern/shrub/rock only. Vertex colors remain on geometry that supplies them; Three instance tints are independent.',limitation:'Function and decoded-asset regression verifies the mechanism; actual visual acceptance requires matched rendered stills and original motion.'};
await fs.writeFile(`${out}/retained-source.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
