import {BufferGeometry} from "three";
import field from "./cascade-field.json";
import {plungeDistance} from "./plunge-basin";

export const CASCADE_VERSION = "contact-cascade-1";
export const CASCADE_START_Z = field.startZ;
const clamp = (t:number) => Math.max(0,Math.min(1,t));
const smooth = (t:number) => {t=clamp(t);return t*t*(3-2*t);};
export function cascadeSection(z:number) {
  const r=clamp((z-field.startZ)/(field.endZ-field.startZ))*field.rows;
  const a=Math.min(field.rows-1,Math.floor(r)),t=r-a;
  const p=field.points[a],q=field.points[a+1];
  return {x:p[0]+(q[0]-p[0])*t,left:p[2]+(q[2]-p[2])*t,right:p[3]+(q[3]-p[3])*t,row:r};
}
export function cascadeCoordinates(x:number,z:number) {
  const s=cascadeSection(z),dx=x-s.x;
  return {...s,across:dx/(dx<0?s.left:s.right)};
}
export function cascadeLevel(x:number,z:number) {
  const s=cascadeCoordinates(x,z),u=clamp((s.across/field.across+1)*.5)*field.columns;
  const r=Math.min(field.rows-1,Math.floor(s.row)),c=Math.min(field.columns-1,Math.floor(u));
  const a=s.row-r,b=u-c,stride=field.columns+1;
  const v=field.height[r*stride+c]*(1-b)+field.height[r*stride+c+1]*b;
  const w=field.height[(r+1)*stride+c]*(1-b)+field.height[(r+1)*stride+c+1]*b;
  return v+(w-v)*a;
}
export function cascadeWetWeight(x:number,z:number) {
  if(z<field.startZ||z>field.endZ||x<140||x>212)return 0;
  return (1-smooth((Math.abs(cascadeCoordinates(x,z).across)-.88)/.57))*smooth((z-field.startZ)/2)*smooth((field.endZ-z)/2);
}
// A bounded bed correction joins the actual source surface to its baked water
// guide. The existing pool and all vertices outside the chute remain intact.
export function applyCascadeBed(geometry:BufferGeometry) {
  const p=geometry.getAttribute("position");let count=0,maxCut=0,maxFill=0;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),w=cascadeWetWeight(x,z);
    if(!w||plungeDistance(x,z)<=1.08)continue;
    const y=p.getY(i),target=cascadeLevel(x,z)-.65;
    if(Math.abs(y-target)>6)continue;
    const delta=Math.max(-3,Math.min(3,target-y))*w;
    p.setY(i,y+delta);count++;maxCut=Math.max(maxCut,-delta);maxFill=Math.max(maxFill,delta);
  }
  p.needsUpdate=true;geometry.computeVertexNormals();
  geometry.userData.cascadeContact={version:CASCADE_VERSION,count,maxCut,maxFill,poolPreserved:true};
}
// The same center/width guide controls the wet rock corridor in the material.
const guide=field.points.filter((_,i)=>i%10===0);
export const CASCADE_GLSL=`
float cascadeWet(vec2 p){
 if(p.x<140.||p.x>212.||p.y<${field.startZ.toFixed(1)}||p.y>${field.endZ.toFixed(1)})return 0.;
 float x=0.,left=1.,right=1.;
 ${guide.slice(0,-1).map((a,i)=>{const b=guide[i+1];return `if(p.y>=${a[1].toFixed(5)}&&p.y<=${b[1].toFixed(5)}){float t=(p.y-(${a[1].toFixed(5)}))/${(b[1]-a[1]).toFixed(5)};x=mix(${a[0].toFixed(5)},${b[0].toFixed(5)},t);left=mix(${a[2].toFixed(5)},${b[2].toFixed(5)},t);right=mix(${a[3].toFixed(5)},${b[3].toFixed(5)},t);}`;}).join("\n")}
 float d=abs(p.x-x)/(p.x<x?left:right);
 return (1.-smoothstep(.88,1.45,d))*smoothstep(${field.startZ.toFixed(1)},${(field.startZ+2).toFixed(1)},p.y)*(1.-smoothstep(${(field.endZ-2).toFixed(1)},${field.endZ.toFixed(1)},p.y));
}`;
