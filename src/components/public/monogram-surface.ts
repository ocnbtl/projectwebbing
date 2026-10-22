/** Signed distance to the original filled glyph, never to individual strokes.
 * Winding-rule filling keeps overlapping script strokes joined and counters open.
 * Source curves are rasterized at 384px, independent of the small navigation M.
 */
export const MONOGRAM_SIZE=384;
export const MONOGRAM_SPREAD=32;
export type MonogramField={distance:Float32Array;ink:Uint8Array};
function distanceTo(ink:Uint8ClampedArray,inside:boolean,size:number){
 const result=new Float32Array(size*size),f=new Float64Array(size),d=new Float64Array(size),v=new Int32Array(size),z=new Float64Array(size+1);
 const pass=()=>{
  let k=0;v[0]=0;z[0]=-Infinity;z[1]=Infinity;
  for(let q=1;q<size;q++){let s=((f[q]+q*q)-(f[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);while(s<=z[k]){k--;s=((f[q]+q*q)-(f[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);}k++;v[k]=q;z[k]=s;z[k+1]=Infinity;}
  k=0;for(let q=0;q<size;q++){while(z[k+1]<q)k++;d[q]=(q-v[k])**2+f[v[k]];}
 };
 for(let y=0;y<size;y++){for(let x=0;x<size;x++)f[x]=(ink[(y*size+x)*4+3]>=128)===inside?0:1e12;pass();for(let x=0;x<size;x++)result[y*size+x]=d[x];}
 for(let x=0;x<size;x++){for(let y=0;y<size;y++)f[y]=result[y*size+x];pass();for(let y=0;y<size;y++)result[y*size+x]=d[y];}
 return result;
}
export function createMonogramField(path:string|Path2D,size=MONOGRAM_SIZE,holes?:Path2D):MonogramField{
 const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(size,size):document.createElement('canvas');canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Monogram surface unavailable');
 ctx.scale(size/256,size/256);ctx.fillStyle='#fff';ctx.fill(typeof path==='string'?new Path2D(path):path,'nonzero');
 if(holes){ctx.globalCompositeOperation='destination-out';ctx.fill(holes,'nonzero');ctx.globalCompositeOperation='source-over';}
 const pixels=ctx.getImageData(0,0,size,size).data,inside=distanceTo(pixels,true,size),outside=distanceTo(pixels,false,size),ink=new Uint8Array(size*size);
 for(let i=0;i<inside.length;i++){ink[i]=pixels[i*4+3];outside[i]=(ink[i]>0&&ink[i]<255?ink[i]/255-.5:Math.sqrt(outside[i])-Math.sqrt(inside[i]))*MONOGRAM_SIZE/size;}
 return {distance:outside,ink};
}
export const easeMonogram=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
export function blendMonogramField(a:MonogramField,b:MonogramField,t:number):MonogramField{
 const distance=new Float32Array(a.distance.length),ink=new Uint8Array(distance.length);
 const union=Math.sin(Math.PI*t)*.5,clamp=(d:number)=>Math.max(-MONOGRAM_SPREAD,Math.min(MONOGRAM_SPREAD,d));
 for(let i=0;i<distance.length;i++){
  const x=clamp(a.distance[i]),y=clamp(b.distance[i]);distance[i]=x*(1-t)+y*t+union*Math.hypot(x-y,4);
  const coverage=Math.max(0,Math.min(1,(distance[i]+.55)/1.1));ink[i]=t===0?a.ink[i]:t===1?b.ink[i]:Math.round(coverage*coverage*(3-2*coverage)*255);
 }
 return {distance,ink};
}
export function packMonogramField(field:MonogramField){
 const n=Math.sqrt(field.ink.length),{distance,ink}=field,data=new Uint8Array(n*n*4),encode=(d:number)=>Math.round(Math.max(0,Math.min(255,(d/MONOGRAM_SPREAD*.5+.5)*255)));
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const i=y*n+x;let smooth=distance[i];
  if(x>0&&x<n-1&&y>0&&y<n-1)smooth=(distance[i]*4+(distance[i-1]+distance[i+1]+distance[i-n]+distance[i+n])*2+distance[i-n-1]+distance[i-n+1]+distance[i+n-1]+distance[i+n+1])/16;
  data[i*4]=encode(distance[i]);data[i*4+1]=encode(smooth);data[i*4+2]=ink[i];data[i*4+3]=255;
 }
 return data;
}
