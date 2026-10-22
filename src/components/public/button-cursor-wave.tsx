"use client";

import { useEffect, useId, useRef, type RefObject } from "react";
import { useWaterMotion } from "./water-surface";
import styles from "./button-cursor-wave.module.css";

// The same path draws the border and clips the color, at every rendered width.
export const WIDE_CONTROL_PATH="M180 7 H324 A29 29 0 0 1 324 65 H36 A29 29 0 0 1 36 7 Z";
export function wideControlPath(width:number,height:number){const x=7*360/width,y=7*72/height,rx=(height/2-7)*360/width,ry=36-y;return `M180 ${y} H${360-x-rx} A${rx} ${ry} 0 0 1 ${360-x-rx} ${72-y} H${x+rx} A${rx} ${ry} 0 0 1 ${x+rx} ${y} Z`;}
const COUNT=8;

export function ButtonCursorWave({host,active,className,path=WIDE_CONTROL_PATH}:{path?:string;host:RefObject<HTMLAnchorElement|null>;active:boolean;className?:string}) {
  const id=useId().replaceAll(":","");
  const root=useRef<SVGSVGElement>(null),light=useRef<SVGGElement>(null),rings=useRef<(SVGGElement|null)[]>([]);
  const {playing}=useWaterMotion();
  useEffect(()=>{
    const link=host.current,svg=root.current,spot=light.current;
    if(!link||!svg||!spot||!active)return;
    let frame=0,hovered=false,focused=false,inView=false,last=0,lastEmission=0,index=0;
    const target={x:180,y:36},current={...target};
    const waves:{x:number;y:number;born:number;angle:number}[]=[];
    const hideRings=()=>rings.current.forEach(ring=>ring?.setAttribute("opacity","0"));
    const position=()=>spot.setAttribute("transform",`translate(${current.x} ${current.y})`);
    const emit=(now:number)=>{
      waves[index]={x:current.x,y:current.y,born:now,angle:(index%3-1)*14};index=(index+1)%COUNT;lastEmission=now;
    };
    const draw=(now:number)=>{
      frame=0;
      if(document.hidden||!inView||(!hovered&&!focused))return;
      const dt=Math.min(64,now-last||16);last=now;
      const ease=playing?1-Math.exp(-dt/65):1;
      current.x+=(target.x-current.x)*ease;current.y+=(target.y-current.y)*ease;position();
      if(playing){
        if(now-lastEmission>460)emit(now);
        for(let i=0;i<COUNT;i++){
          const wave=waves[i],ring=rings.current[i];if(!ring)continue;
          const age=wave?(now-wave.born)/1700:1;
          if(!wave||age>=1){ring.setAttribute("opacity","0");continue;}
          const radius=6+age*190;
          ring.setAttribute("transform",`translate(${wave.x} ${wave.y}) rotate(${wave.angle}) scale(${radius} ${radius*.62})`);
          ring.setAttribute("opacity",String(Math.sin(Math.PI*age)**1.25));
        }
        frame=requestAnimationFrame(draw);
      }else hideRings();
      svg.dataset.frame=String(Number(svg.dataset.frame||0)+1);
      svg.dataset.origin=`${current.x.toFixed(1)},${current.y.toFixed(1)}`;
    };
    const wake=()=>{
      cancelAnimationFrame(frame);frame=0;
      const engaged=(hovered||focused)&&inView&&!document.hidden;
      svg.dataset.engaged=String(engaged);last=performance.now();
      if(engaged)frame=requestAnimationFrame(draw);
    };
    const move=(event:PointerEvent)=>{
      if(event.pointerType!=="mouse"&&event.pointerType!=="pen")return;
      const box=link.getBoundingClientRect();
      const x=Math.max(0,Math.min(360,(event.clientX-box.left)/box.width*360));
      const y=Math.max(0,Math.min(72,(event.clientY-box.top)/box.height*72));
      if(!hovered){current.x=x;current.y=y;}
      const distance=Math.hypot(x-target.x,y-target.y);target.x=x;target.y=y;hovered=true;
      const now=performance.now();if(playing&&distance>5&&now-lastEmission>95)emit(now);
      if(!frame)wake();
    };
    const leave=()=>{hovered=false;wake();};
    const focus=()=>{
      if(!link.matches(":focus-visible"))return;
      focused=true;target.x=180;target.y=36;current.x=180;current.y=36;wake();
    };
    const blur=()=>{focused=false;wake();};
    const observer=new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;wake();});
    observer.observe(link);
    link.addEventListener("pointerenter",move);link.addEventListener("pointermove",move);link.addEventListener("pointerleave",leave);
    link.addEventListener("focus",focus);link.addEventListener("blur",blur);document.addEventListener("visibilitychange",wake);
    hideRings();
    if(link.matches(":focus-visible"))focus();
    return()=>{
      cancelAnimationFrame(frame);observer.disconnect();svg.dataset.engaged="false";
      link.removeEventListener("pointerenter",move);link.removeEventListener("pointermove",move);link.removeEventListener("pointerleave",leave);
      link.removeEventListener("focus",focus);link.removeEventListener("blur",blur);document.removeEventListener("visibilitychange",wake);
    };
  },[active,host,playing]);
  return <svg ref={root} className={`${styles.field} ${className??""}`} viewBox="0 0 360 72" preserveAspectRatio="none" aria-hidden="true" data-cursor-wave="" data-engaged="false" data-playing={playing}>
    <defs>
      <clipPath id={`${id}-clip`}><path d={path}/></clipPath>
      <radialGradient id={`${id}-rose`}><stop stopColor="#e1ecff" stopOpacity=".2"/><stop offset=".3" stopColor="#d8a0e5" stopOpacity=".46"/><stop offset=".6" stopColor="#e783b5" stopOpacity=".3"/><stop offset="1" stopColor="#e783b5" stopOpacity="0"/></radialGradient>
      <radialGradient id={`${id}-blue`}><stop stopColor="#a7eaf4" stopOpacity=".42"/><stop offset="1" stopColor="#97cfea" stopOpacity="0"/></radialGradient>
      <linearGradient id={`${id}-prism`}><stop stopColor="#eeb8d8"/><stop offset=".48" stopColor="#ded7ff"/><stop offset="1" stopColor="#b5efff"/></linearGradient>
    </defs>
    <g clipPath={`url(#${id}-clip)`}>
      <g ref={light} transform="translate(180 36)"><ellipse rx="140" ry="86" fill={`url(#${id}-rose)`}/><ellipse cx="-40" cy="16" rx="82" ry="55" fill={`url(#${id}-blue)`}/></g>
      {Array.from({length:COUNT},(_,i)=><g ref={node=>{rings.current[i]=node;}} key={i} opacity="0" fill="none" stroke={`url(#${id}-prism)`}><circle r="1" strokeWidth="8" strokeOpacity=".07" vectorEffect="non-scaling-stroke"/><circle r="1" strokeWidth="1.25" strokeOpacity=".48" vectorEffect="non-scaling-stroke"/></g>)}
    </g>
  </svg>;
}
