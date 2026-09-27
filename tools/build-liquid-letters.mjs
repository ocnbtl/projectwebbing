// Offline rounded letter meshes. The browser does no voxel generation.
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { MeshBasicMaterial } from 'three';
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('next/package.json'))('sharp');
const font = new FontLoader().parse(JSON.parse(await fs.readFile('public/media/liquid/helvetiker-bold.json', 'utf8')));
const resolution = 64, raster = 384, scale = 3.5;
const chunks = [], glyphs = {};
let offset = 0;
for (const letter of [...new Set('MADAGIN')]) {
  const shapes = font.generateShapes(letter, 2.5);
  const points = shapes.flatMap(shape => shape.extractPoints(24).shape);
  const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const path = shapes.map(shape => {
    const { shape: outline, holes } = shape.extractPoints(24);
    return [outline, ...holes].map(loop => loop.map((p,i) => `${i ? 'L' : 'M'}${((p.x-cx)/scale+.5)*raster},${(.5-(p.y-cy)/scale)*raster}`).join(' ')+'Z').join(' ');
  }).join(' ');
  const mask = await sharp(Buffer.from(`<svg width="${raster}" height="${raster}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="black"/><path fill="white" fill-rule="evenodd" d="${path}"/></svg>`)).blur(1.2).greyscale().raw().toBuffer();
  const segments = shapes.flatMap(shape => { const {shape:outline, holes}=shape.extractPoints(32); return [outline,...holes].flatMap(loop => loop.map((p,i)=>[p,loop[(i+1)%loop.length]])); });
  const distances = new Float32Array(resolution*resolution);
  for(let y=0;y<resolution;y++) for(let x=0;x<resolution;x++) {
    const px=x/resolution*raster, py=(1-y/resolution)*raster;
    let d=1e9;
    const wx=(x/resolution-.5)*scale+cx,wy=(y/resolution-.5)*scale+cy;
    for(const [a,b] of segments) {
      const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
      const t=length?Math.max(0,Math.min(1,((wx-a.x)*dx+(wy-a.y)*dy)/length)):0;
      d=Math.min(d,(wx-a.x-t*dx)**2+(wy-a.y-t*dy)**2);
    }
    const inside=mask[Math.min(raster-1,Math.round(py))*raster+Math.min(raster-1,Math.round(px))]>127;
    distances[y*resolution+x]=Math.sqrt(d)*(inside?1:-1)+.14;
  }
  const mc = new MarchingCubes(resolution, new MeshBasicMaterial(),false,false,60000);
  mc.isolation=0;
  for(let z=0;z<resolution;z++) for(let y=0;y<resolution;y++) for(let x=0;x<resolution;x++) {
    const depth=distances[y*resolution+x];
    const zz=(z/resolution-.5)*scale;
    // Rounded volume: curved faces continue smoothly into the silhouette.
    mc.field[z*resolution*resolution+y*resolution+x]=1-(zz/.52)**2-Math.exp(-depth/.28);
  }
  mc.update();
  const count=mc.count;
  const packed=new Int16Array(count*6);
  for(let i=0;i<count;i++) {
    for(let c=0;c<3;c++) packed[i*6+c]=Math.round(mc.positionArray[i*3+c]*32767);
    const nx=mc.normalArray[i*3],ny=mc.normalArray[i*3+1],nz=mc.normalArray[i*3+2];
    const length=Math.hypot(nx,ny,nz)||1;
    packed[i*6+3]=Math.round(nx/length*32767);packed[i*6+4]=Math.round(ny/length*32767);packed[i*6+5]=Math.round(nz/length*32767);
  }
  const unique=[],indices=new Uint16Array(count),seen=new Map();
  for(let i=0;i<count;i++) {
    const vertex=Array.from(packed.subarray(i*6,i*6+6));
    const key=vertex.join(',');
    let index=seen.get(key);
    if(index===undefined){index=unique.length/6;seen.set(key,index);unique.push(...vertex);}
    indices[i]=index;
  }
  const bytes=Buffer.from(new Int16Array(unique).buffer),indexBytes=Buffer.from(indices.buffer);
  glyphs[letter]={offset,vertices:unique.length/6,indicesOffset:offset+bytes.length,count,width:maxX-minX,scale:scale/2};
  chunks.push(bytes,indexBytes);offset+=bytes.length+indexBytes.length;
  mc.geometry.dispose();mc.material.dispose();
  console.log(`${letter}: ${count/3} triangles`);
}
await fs.writeFile('public/media/liquid/letters.bin',Buffer.concat(chunks));
await fs.writeFile('public/media/liquid/letters.json',JSON.stringify({glyphs,format:'interleaved int16 xyz normal; position normalized * scale; normals normalized'},null,2)+'\n');
console.log(`Packed ${offset} bytes`);
