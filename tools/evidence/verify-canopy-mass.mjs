import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {Box3,Vector3} from 'three';
const root=process.env.MADAGIN_CROWN_EVIDENCE??'output/releases/madagin-crown-architecture-20260913';
await fs.mkdir(root+'/geometry',{recursive:true});
const baselinePath=root+'/baseline-source/branch-crowns.ts';
if(!await fs.stat(baselinePath).catch(()=>null)){
 await fs.mkdir(root+'/baseline-source',{recursive:true});
 await fs.writeFile(baselinePath,execFileSync('git',['show','93cf044824a3bf74ac2761f88ed8c51d4cfb5cb0:src/components/internal/branch-crowns.ts']));
}
async function compile(source,name){const target=root+'/geometry/'+name+'.mjs';await fs.writeFile(target,ts.transpileModule(await fs.readFile(source,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);return import(pathToFileURL(path.resolve(target)).href);}
const current=await compile('src/components/internal/branch-crowns.ts','crown-current'),baseline=await compile(baselinePath,'crown-before');
const lighting=await compile('src/components/internal/canopy-light.ts','crown-light');
function describe(crown){
 const box=new Box3().setFromObject(crown),wood=crown.children.find(c=>c.material.name==='authored-wood').geometry,leaves=crown.children.find(c=>c.material.name==='authored-leaves').geometry,p=leaves.getAttribute('position');
 let leafArea=0;const a=new Vector3(),b=new Vector3(),c=new Vector3();
 for(let i=0;i<leaves.index.count;i+=3){a.fromBufferAttribute(p,leaves.index.getX(i));b.fromBufferAttribute(p,leaves.index.getX(i+1));c.fromBufferAttribute(p,leaves.index.getX(i+2));leafArea+=b.sub(a).cross(c.sub(a)).length()/2;}
 for(const mesh of crown.children){for(const name of ['position','normal','color'])assert.ok([...mesh.geometry.getAttribute(name).array].every(Number.isFinite));assert.ok([...mesh.geometry.index.array].every(i=>i<mesh.geometry.getAttribute('position').count));}
 return {size:box.getSize(new Vector3()).toArray(),rootY:box.min.y,triangles:(wood.index.count+leaves.index.count)/3,leafArea,hash:createHash('sha256').update(Buffer.from(p.array.buffer)).digest('hex')};
}
const rows=[];
for(const variant of [0,1,2,3])for(const stand of [false,true]){
 const before=baseline.createBranchCrown(variant,stand),after=current.createBranchCrown(variant,stand),a=describe(after),b=describe(before);
 assert.deepEqual(a,describe(current.createBranchCrown(variant,stand)),'Crown must rebuild deterministically');
 assert.ok(a.leafArea>b.leafArea*.75&&a.leafArea<b.leafArea*1.25,'Retain modeled foliage area while redistributing into smaller blades');
 assert.equal(a.rootY,b.rootY);assert.ok(a.triangles<b.triangles*1.65,'Bound per-model geometry cost');
 assert.ok(a.size.every((s,i)=>s/b.size[i]>.75&&s/b.size[i]<1.3),'No hidden whole-tree enlargement');
 const w=after.children.find(c=>c.material.name==='authored-wood').geometry.getAttribute('position'),l=after.children.find(c=>c.material.name==='authored-leaves').geometry,lp=l.getAttribute('position'),centers=[];
 for(let i=0;i<w.count;i+=4){const v=new Vector3();for(let j=0;j<4;j++)v.add(new Vector3().fromBufferAttribute(w,i+j));centers.push(v.multiplyScalar(.25));}
 let maximumAttachmentError=0;
 for(let i=l.userData.branchCrowns.leafRootIndex;i<lp.count;i+=l.userData.branchCrowns.leafStride){const p=new Vector3().fromBufferAttribute(lp,i);let nearest=Infinity;for(let j=1;j<centers.length;j++){const start=centers[j-1],d=centers[j].clone().sub(start),t=Math.max(0,Math.min(1,p.clone().sub(start).dot(d)/Math.max(1e-12,d.lengthSq())));nearest=Math.min(nearest,p.distanceTo(start.clone().addScaledVector(d,t)));}maximumAttachmentError=Math.max(maximumAttachmentError,nearest);}
 assert.ok(maximumAttachmentError<1e-5,'Every leaf base must contact a wood segment');
 const beforeColors=after.children.map(mesh=>mesh.geometry.getAttribute('color').array.slice());
 lighting.bakeCrownShelter(after);assert.deepEqual(describe(after),a,'Shelter must not change geometry, root, area or shape');
 const shelter=after.children.map((mesh,j)=>{const g=mesh.geometry,colors=g.getAttribute('color').array;assert.ok(colors.every((v,i)=>v>0&&v<=beforeColors[j][i]*1.00001&&v>=beforeColors[j][i]*.4999));assert.ok(g.userData.crownShelter.maximum-g.userData.crownShelter.minimum>.12,'Crown must retain lit exterior and sheltered interior');return {part:mesh.material.name,...g.userData.crownShelter};});
 const shaded=after.children.map(mesh=>mesh.geometry.getAttribute('color').array.slice());lighting.bakeCrownShelter(after);after.children.forEach((mesh,j)=>assert.deepEqual(mesh.geometry.getAttribute('color').array,shaded[j],'Shelter bake must be idempotent'));
 const lit=l.clone(),rawNormals=lit.getAttribute('normal').array.slice();
 lighting.shapeCanopyLight(lit);
 assert.equal(lit.getAttribute('clusterNormal'),undefined,'Construction normals should not consume a runtime buffer');
 assert.deepEqual(lit.getAttribute('position').array,l.getAttribute('position').array,'Lighting must preserve geometry');
 const n=lit.getAttribute('normal');let normalChanges=0;
 for(let i=0;i<n.count;i++){const length=Math.hypot(n.getX(i),n.getY(i),n.getZ(i));assert.ok(Math.abs(length-1)<1e-5);if(Math.abs(n.getX(i)-rawNormals[i*3])>.01)normalChanges++;}
 assert.ok(normalChanges>n.count*.5,'Local lighting should describe cluster form');
 assert.equal(lit.userData.canopyLight.clusterNormalWeight,.4);lit.dispose();
 rows.push({variant,stand,before:b,after:a,maximumAttachmentError,shelter,normalChanges});
}
await fs.writeFile(root+'/crown-geometry.json',JSON.stringify({at:new Date().toISOString(),passed:true,rows,qualification:'Source geometry, bounds, connected attachment and deterministic construction. Leaf area does not prove visual canopy coverage, and model cost is not a frame-time result.'},null,2));console.log(JSON.stringify(rows.map(r=>({variant:r.variant,stand:r.stand,areaRatio:r.after.leafArea/r.before.leafArea,triangles:r.after.triangles,attachment:r.maximumAttachmentError}))));
