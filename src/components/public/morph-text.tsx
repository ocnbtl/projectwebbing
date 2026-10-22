"use client";
import {useEffect,useRef} from "react";
import glyphs from "./morph-glyphs.json";
import {useWaterMotion} from "./water-surface";
import styles from "./morph-text.module.css";

type Word=keyof typeof glyphs;
type Contours=number[][][];
const outline=(contours:Contours)=>contours.map(contour=>contour.map(([x,y],j)=>`${j?"L":"M"}${x.toFixed(2)},${y.toFixed(2)}`).join("")+"Z").join("");
const mix=(from:Contours,to:Contours,t:number)=>from.map((contour,i)=>contour.map((p,j)=>[p[0]+(to[i][j][0]-p[0])*t,p[1]+(to[i][j][1]-p[1])*t]));

export function MorphText({word}:{word:Word}) {
 const root=useRef<HTMLSpanElement>(null),path=useRef<SVGPathElement>(null),strokePath=useRef<SVGPathElement>(null);
 const {playing}=useWaterMotion(),data=glyphs[word],cycle=word==="madagin";
 useEffect(()=>{
  const el=root.current,link=el?.closest<HTMLElement>("a,button");if(!el||!link)return;
  let frame=0,timer:ReturnType<typeof setTimeout>|undefined;
  let current:Contours=data.versions[0].contours,from=current,target=0,start=0,stroke=0,fromStroke=0;
  let hovered=false,focused=false,visible=true;
  const active=()=>hovered||focused;
  const paint=()=>{const d=outline(current);path.current?.setAttribute("d",d);strokePath.current?.setAttribute("d",d);path.current?.setAttribute("stroke-width",String(stroke));};
  const stop=()=>{cancelAnimationFrame(frame);frame=0;clearTimeout(timer);};
  const finish=()=>{
   el.dataset.font=data.versions[target].family;el.dataset.morph=String(target);
   if(cycle&&active()&&playing&&visible&&!document.hidden)timer=setTimeout(()=>change((target+1)%data.versions.length),620);
  };
  const tick=(now:number)=>{
   frame=0;if(document.hidden||!visible)return;
   const duration=target===0&&!active()?420:cycle?780:620;
   const progress=Math.min(1,(now-start)/duration),eased=1-(1-progress)**3;
   current=mix(from,data.versions[target].contours,eased);
   const nextStroke=!cycle&&target===1?.7:0;
   stroke=fromStroke+(nextStroke-fromStroke)*eased;paint();
   el.dataset.progress=progress.toFixed(3);
   if(progress<1)frame=requestAnimationFrame(tick);else finish();
  };
  const change=(next:number)=>{
   stop();target=next;from=current;fromStroke=stroke;start=performance.now();
   if(!playing){current=data.versions[target].contours;stroke=!cycle&&target===1?.7:0;paint();el.dataset.font=data.versions[target].family;return;}
   frame=requestAnimationFrame(tick);
  };
  const hoverCapable=matchMedia('(any-hover: hover)');
  const enter=(event:PointerEvent)=>{if(event.pointerType==='touch'||!hoverCapable.matches)return;hovered=true;if(!focused)change(1);};
  const leave=()=>{hovered=false;if(!focused)change(0);};
  const focus=()=>{if(!link.matches(':focus-visible'))return;focused=true;if(!hovered)change(1);};
  const blur=()=>{focused=false;if(!hovered)change(0);};
  const visibility=()=>{stop();if(!document.hidden&&visible)change(active()?Math.max(1,target):0);};
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(!visible)stop();else if(active())change(Math.max(1,target));else change(0);});
  observer.observe(link);
  link.addEventListener("pointerenter",enter);link.addEventListener("pointerleave",leave);
  link.addEventListener("focusin",focus);link.addEventListener("focusout",blur);
  document.addEventListener("visibilitychange",visibility);
  hovered=hoverCapable.matches&&link.matches(":hover");focused=link.matches(':focus-visible');
  change(active()?1:0);
  return()=>{stop();observer.disconnect();link.removeEventListener("pointerenter",enter);link.removeEventListener("pointerleave",leave);link.removeEventListener("focusin",focus);link.removeEventListener("focusout",blur);document.removeEventListener("visibilitychange",visibility);};
 },[data,playing,cycle]);
 return <span className={styles.morph} ref={root} data-nav-ink="" data-word={word} data-font-count={data.versions.length}><span className={styles.label}>{word}</span><span className={styles.contrast} aria-hidden="true"><svg viewBox={`0 0 ${data.width} ${data.height}`} style={{width:`${data.width/data.height}em`}}><path ref={strokePath} d={outline(data.versions[0].contours)}/></svg></span><svg className={styles.face} aria-hidden="true" viewBox={`0 0 ${data.width} ${data.height}`} style={{width:`${data.width/data.height}em`}}><path ref={path} strokeWidth={0} d={outline(data.versions[0].contours)}/></svg></span>;
}
