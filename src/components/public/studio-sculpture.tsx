"use client";

import {useEffect,useRef} from 'react';
import {useWaterMotion} from './water-surface';
import styles from './studio-sculpture.module.css';

type Vec={x:number;y:number;z:number};
const STRANDS=16,SAMPLES=240,TAU=Math.PI*2;
const section=Array.from({length:STRANDS},(_,i)=>({cos:Math.cos(i/STRANDS*TAU),sin:Math.sin(i/STRANDS*TAU)}));
// A single closed trefoil keeps its three lobes interwoven as it breathes.
// Unequal radii and independent deformation keep the connected form flowing.
const center=(u:number,time:number):Vec=>{
 const t=u*TAU,phase=time*.24;
 const radius=105+38*Math.cos(3*t)+12*Math.sin(t+phase)+7*Math.sin(2*t-phase*.7);
 return {
  x:radius*Math.cos(2*t)*1.2,
  y:radius*Math.sin(2*t)*.96,
  z:43*Math.sin(3*t)+13*Math.sin(t-phase),
 };
};
const unit=(v:Vec)=>{const l=Math.hypot(v.x,v.y,v.z);return {x:v.x/l,y:v.y/l,z:v.z/l};};
const cross=(a:Vec,b:Vec):Vec=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});

function geometry(time:number){
 const rotation=-.3+Math.sin(time*.20)*.32,tilt=.4+Math.sin(time*.23)*.30;
 const paths=Array.from({length:STRANDS},()=>({d:''}));
 for(let j=0;j<=SAMPLES;j++){
  const u=j/SAMPLES,c=center(u,time),next=center(u+.0001,time),prev=center(u-.0001,time);
  const tangent=unit({x:next.x-prev.x,y:next.y-prev.y,z:next.z-prev.z});
  const normal=unit(cross(tangent,{x:0,y:0,z:1})),binormal=cross(tangent,normal);
  const radius=22+5*Math.sin(u*TAU*3-time*.34);
  for(let i=0;i<STRANDS;i++){
   const {cos,sin}=section[i];
   const x=c.x+radius*(normal.x*cos+binormal.x*sin);
   const y=c.y+radius*(normal.y*cos+binormal.y*sin);
   const z=c.z+radius*(normal.z*cos+binormal.z*sin);
   const rx=x*Math.cos(rotation)-y*Math.sin(rotation),ry=x*Math.sin(rotation)+y*Math.cos(rotation);
   const py=ry*Math.cos(tilt)-z*Math.sin(tilt),pz=ry*Math.sin(tilt)+z*Math.cos(tilt);
   const scale=720/(720-pz);
   paths[i].d+=`${j?'L':'M'}${(280+rx*scale).toFixed(2)},${(240+py*scale).toFixed(2)}`;
  }
 }
 return paths.map(p=>({d:p.d+'Z'}));
}
const initial=geometry(0);
export function StudioSculpture(){
 const ref=useRef<HTMLElement>(null),elapsed=useRef(0);
 const {playing}=useWaterMotion();
 useEffect(()=>{
  const host=ref.current;if(!host||!playing)return;
  const paths=Array.from(host.querySelectorAll<SVGPathElement>('[data-strand]'));
  let frame=0,last=0,visible=false;
  const tick=(now:number)=>{
   frame=0;if(!visible||document.hidden)return;
   if(now-last>=32){elapsed.current+=Math.min(64,now-last)/1000;last=now;const shape=geometry(elapsed.current);paths.forEach((p,i)=>p.setAttribute('d',shape[i].d));}
   frame=requestAnimationFrame(tick);
  };
  const resume=()=>{cancelAnimationFrame(frame);frame=0;last=performance.now();if(visible&&!document.hidden)frame=requestAnimationFrame(tick);};
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;resume();},{threshold:.05});observer.observe(host);
  document.addEventListener('visibilitychange',resume);
  return()=>{observer.disconnect();cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',resume);};
 },[playing]);
 return <figure ref={ref} className={styles.sculpture} data-sculpture="interconnected-flowing-loops" aria-label="Fine white strands form three interconnected rounded loops, flowing and reshaping as one continuous sculpture.">
  <svg viewBox="0 0 560 480" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
   {initial.map((path,i)=><path key={i} data-strand="" d={path.d} stroke="#effaff" strokeWidth={i===0?1.25:.8} opacity={i===0?.86:Number((.34+Math.sin(i/STRANDS*Math.PI)*.22).toFixed(3))}/>) }
  </svg>
 </figure>;
}
