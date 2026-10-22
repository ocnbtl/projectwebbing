"use client";
import {useEffect,useRef} from "react";
import {useWaterMotion} from "./water-surface";
export function FooterMotion({children,className,compact}:{children:React.ReactNode;className:string;compact:boolean}){
 const host=useRef<HTMLElement>(null),{playing}=useWaterMotion();
 useEffect(()=>{
  const el=host.current;if(!el)return;let visible=false,frame=0,value=0,velocity=0,previous=0,lastPulse=0,touchY=0;
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)el.dataset.reached='true';},{threshold:.12});observer.observe(el);
  const tick=(now:number)=>{frame=0;if(document.hidden||!playing)return;const dt=Math.min(.032,(now-previous)/1000||.016);previous=now;velocity+=(-value*72-velocity*13)*dt;value+=velocity*dt;el.style.setProperty('--footer-tension',`${value.toFixed(3)}px`);if(Math.abs(value)+Math.abs(velocity)>.02)frame=requestAnimationFrame(tick);else el.style.setProperty('--footer-tension','0px');};
  const pull=(amount:number)=>{if(!playing||!visible||document.hidden||innerHeight+scrollY<document.documentElement.scrollHeight-4||amount<=0)return;velocity+=Math.min(70,amount*.45);if(!frame){previous=performance.now();frame=requestAnimationFrame(tick);}const now=performance.now();if(now-lastPulse>2600){lastPulse=now;window.dispatchEvent(new CustomEvent('madagin:surface-pulse',{detail:{x:.5,y:.94,strength:.18,duration:1.2}}));}};
  const wheel=(e:WheelEvent)=>pull(e.deltaY),start=(e:TouchEvent)=>{touchY=e.touches[0]?.clientY??0;},move=(e:TouchEvent)=>{const y=e.touches[0]?.clientY??touchY;pull((touchY-y)*2);touchY=y;};
  window.addEventListener('wheel',wheel,{passive:true});window.addEventListener('touchstart',start,{passive:true});window.addEventListener('touchmove',move,{passive:true});
  return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('wheel',wheel);window.removeEventListener('touchstart',start);window.removeEventListener('touchmove',move);el.style.setProperty('--footer-tension','0px');};
 },[playing]);
 return <footer ref={host} className={className} data-compact={compact} data-footer-motion="" data-playing={playing}>{children}</footer>;
}
