import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import ts from 'typescript';
const out=path.resolve(process.env.MADAGIN_LAKE_EVIDENCE??'output/releases/madagin-water-light-20260911');
await fs.mkdir(out,{recursive:true});
async function compile(name,s){const p=path.join(out,name+'.mjs');await fs.writeFile(p,ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);return import(pathToFileURL(p).href);}
await compile('lake-depth-headwater',await fs.readFile('src/components/internal/ridge-headwater.ts','utf8'));
const profile=await compile('lake-depth-profile',(await fs.readFile('src/components/internal/channel-profile.ts','utf8')).replace('"./ridge-headwater"','"./lake-depth-headwater.mjs"'));
const source=(await fs.readFile('src/components/internal/lake-shore.ts','utf8')).replace('"./channel-profile"','"./lake-depth-profile.mjs"');
const lake=await compile('lake-depth-current',source);
const old=await compile('lake-depth-baseline',execFileSync('git',['show','2869bb41a993ae141446bee5796b76013946b6e4:src/components/internal/lake-shore.ts'],{encoding:'utf8'}));
// Run the authored GLSL counterpart as scalar JS over world coordinates. This
// catches CPU/GPU formula drift separately from the geometric mesh checks.
let glsl=lake.LAKE_SHORE_GLSL.replace(/vec2 lakeShore\(vec2 p\)/,'function gpuLakeShore(p)').replace(/float lakeCove\(float angle,float center,float width\)/,'function lakeCove(angle,center,width)');
glsl=glsl.replace(/float (\w+)\(([^)]*)\)/g,(_,name,args)=>'function '+name+'('+args.replaceAll('float ','')+')');
glsl=glsl.replace(/vec2 coordinate=.*?;/,'const coordinate={x:(p.x+2.04)/132.4,y:(p.y+884.765)/94.6};').replace(/\bfloat /g,'let ').replaceAll('length(coordinate)','Math.hypot(coordinate.x,coordinate.y)').replace('return vec2(d,inletBedDepth(p.x,p.y,depth));','return [d,inletBedDepth(p.x,p.y,depth)];');
glsl='const {sin,cos,exp,pow,min,max,abs}=Math;const atan=Math.atan2;const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));const mix=(a,b,t)=>a+(b-a)*t;\n'+glsl+'\nexport {gpuLakeShore};';
const gpu=await compile('lake-depth-glsl',glsl);
const runtime=await fs.readFile('src/components/internal/ridge-production-v116.tsx','utf8');
const parsed=ts.createSourceFile('lake.ts',runtime,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const names=['createIntegratedLakeBedGeometry','createIntegratedLakeGeometry'];
const bodies=parsed.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.includes(n.name?.text)).map(n=>n.getText());
assert.equal(bodies.length,2);
const mesh=await compile('lake-depth-mesh','import {BufferGeometry,Float32BufferAttribute} from "three";\nimport {LAKE_CENTER,LAKE_RADIUS,LAKE_WATER_LEVEL,lakeBoundaryScale,lakeBedLevel} from "./lake-depth-current.mjs";\n'+bodies.join('\n')+'\nexport {'+names.join(',')+'};');
let probes=0,maximumParityError=0;
for(let a=0;a<360;a+=2){let previous=-Infinity;for(let step=0;step<=140;step++){
 const d=step/100,angle=a*Math.PI/180,edge=lake.lakeBoundaryScale(angle);
 const x=lake.LAKE_CENTER.x+Math.cos(angle)*lake.LAKE_RADIUS.x*edge*d,z=lake.LAKE_CENTER.z+Math.sin(angle)*lake.LAKE_RADIUS.z*edge*d;
 const bed=lake.lakeBedLevel(x,z),depth=lake.LAKE_WATER_LEVEL-bed;
 maximumParityError=Math.max(maximumParityError,Math.abs(gpu.gpuLakeShore({x,y:z})[1]-depth));
 const inlet=z>-835&&z<-764&&profile.lakeInletCut(x,z).weight>0;
 if(d<=1&&!inlet)assert.ok(bed>=previous-1e-8,'Submerged basin rises continuously toward each shore outside the inlet');previous=bed;
 if(d>=.82&&!inlet)assert.ok(Math.abs(bed-old.lakeBedLevel(x,z))<1e-8,'Shore and dry-bank authority retained outside the bounded inlet');
 if(inlet)assert.ok(bed<=old.lakeBedLevel(x,z)+1e-8,'Inlet remains an incision');
 if(d<1)assert.ok(depth>=.42-1e-8,'Entire basin remains submerged');
 probes++;
}}
assert.ok(maximumParityError<1e-10);assert.ok(Math.abs(lake.LAKE_WATER_LEVEL-lake.lakeBedLevel(lake.LAKE_CENTER.x,lake.LAKE_CENTER.z)-7.37)<1e-8);
const meshes=[];
for(const [segments,rings] of [[320,18],[320,40],[384,48]]){
 const g=mesh.createIntegratedLakeBedGeometry(segments,rings,.12),p=g.getAttribute('position');let maxError=0;
 for(let i=0;i<p.count;i++)maxError=Math.max(maxError,Math.abs(p.getY(i)-lake.lakeBedLevel(p.getX(i),p.getZ(i))-.025));
 assert.ok(maxError<.0001);assert.ok(Array.from(p.array).every(Number.isFinite));
 meshes.push({segments,rings,vertices:p.count,maximumBedError:maxError});g.dispose();
}
const result={at:new Date().toISOString(),passed:true,probes,maximumParityError,centerDepth:7.37,unchangedShoreFromNormalizedRadius:.82,shoreException:'Shared inlet incision only: z -835 to -764, within 1.25 channel half-widths',meshes,limits:'Authored basin, not surveyed geography. Checks concern shared depth and mesh construction; actual assembled terrain and visual reflections require browser review.'};
await fs.writeFile(path.join(out,'lake-depth-checks.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
