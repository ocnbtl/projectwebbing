"use client";
import {useEffect,useRef} from "react";
import {useInquirySpectrum} from "./use-inquiry-spectrum";
import styles from "./contact-journey.module.css";
/** One mask reveals fill and border together from the actual hit point. */
export function ChoiceEdge({id,active,playing}:{id:string;active:boolean;playing:boolean}){
 const spectrum=useRef<SVGLinearGradientElement>(null);
 useInquirySpectrum(spectrum,active,playing,id.split('').reduce((hash,c)=>Math.imul(hash^c.charCodeAt(0),16777619)>>>0,2166136261)%360);
 const root=useRef<SVGSVGElement>(null),wipe=useRef<SVGCircleElement>(null),group=useRef<SVGGElement>(null),progress=useRef(active?1:0),origin=useRef({x:.5,y:.5});
 useEffect(()=>{
  const svg=root.current,host=svg?.parentElement;if(!svg||!host)return;
  const point=(e:PointerEvent)=>{if(host.dataset.choiceAnimating==='true')return;const b=host.getBoundingClientRect();origin.current={x:(e.clientX-b.left)/b.width,y:(e.clientY-b.top)/b.height};};
  const key=()=>{if(host.dataset.choiceAnimating!=='true')origin.current={x:.5,y:.5};};
  host.addEventListener('pointerdown',point);host.addEventListener('keydown',key);
  return()=>{host.removeEventListener('pointerdown',point);host.removeEventListener('keydown',key);};
 },[]);
 useEffect(()=>{
  let frame=0;const from=progress.current,to=active?1:0,start=performance.now(),host=root.current?.parentElement;
  const finish=()=>{if(host){host.setAttribute('data-choice-animating','false');host.dispatchEvent(new Event('madagin:choice-settled',{bubbles:true}));}};
  const paint=(p:number)=>{
   const b=root.current?.getBoundingClientRect();if(!b)return;
   spectrum.current?.setAttribute("data-width",String(b.width));spectrum.current?.setAttribute("data-height",String(b.height));
   const x=origin.current.x*b.width,y=origin.current.y*b.height;
   const reach=Math.hypot(Math.max(x,b.width-x),Math.max(y,b.height-y))/.55;
   progress.current=p;wipe.current?.setAttribute('cx',String(x));wipe.current?.setAttribute('cy',String(y));wipe.current?.setAttribute('r',String(reach*p));group.current?.setAttribute('opacity',p>0?'1':'0');
  };
  const observer=new ResizeObserver(()=>paint(progress.current));if(root.current)observer.observe(root.current);
  if(!playing||Math.abs(to-from)<.001){paint(to);finish();}else {if(host)host.setAttribute('data-choice-animating','true');const tick=(now:number)=>{const t=Math.max(0,Math.min(1,(now-start)/(active?1550:1200))),ease=t*t*(3-2*t);paint(from+(to-from)*ease);if(t<1)frame=requestAnimationFrame(tick);else finish();};frame=requestAnimationFrame(tick);}
  return()=>{cancelAnimationFrame(frame);observer.disconnect();if(host)host.setAttribute('data-choice-animating','false');};
 },[active,playing]);
 return <svg ref={root} className={styles.choiceEdge} aria-hidden="true"><defs>
  <linearGradient ref={spectrum} id={`${id}-color`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="300" y2="100"><stop stopColor="#ff75bc"/><stop offset=".2" stopColor="#ffb56b"/><stop offset=".4" stopColor="#f6e78d"/><stop offset=".6" stopColor="#80e8c3"/><stop offset=".8" stopColor="#79bdff"/><stop offset="1" stopColor="#db97ff"/></linearGradient>
  <radialGradient id={`${id}-feather`}><stop offset=".55" stopColor="white"/><stop offset=".8" stopColor="#999"/><stop offset="1" stopColor="black"/></radialGradient>
  <linearGradient id={`${id}-glass`} x2=".2" y2="1"><stop stopColor="#d9f3ff22"/><stop offset=".45" stopColor="#cce9ff02"/><stop offset="1" stopColor="#060e271c"/></linearGradient>
  <mask id={`${id}-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%" style={{maskType:'luminance'}}><circle ref={wipe} data-choice-wipe="" r="0" fill={`url(#${id}-feather)`}/></mask>
 </defs><rect className={styles.choiceBase} fill="none" strokeWidth="1.6"/><g ref={group} opacity="0" mask={`url(#${id}-mask)`}><rect fill="#071c3478"/><rect fill={`url(#${id}-glass)`}/><rect fill="none" stroke={`url(#${id}-color)`} strokeWidth="1.6" vectorEffect="non-scaling-stroke"/></g></svg>;
}
