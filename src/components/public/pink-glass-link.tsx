"use client";
import { useEffect, useRef, useState } from "react";
import { TablerIcon } from "@/components/ui/tabler-icon";
import { useWaterMotion } from "./water-surface";
import {BalsaButtonFill} from "./balsa-button-fill";
import styles from "./pink-glass-link.module.css";

export function PinkGlassLink({ href, children, visible=true, onAction, className="",variant="pink",descriptionId }: {
 href:string; children:React.ReactNode; visible?:boolean; onAction?:(keyboard:boolean)=>void; className?:string;variant?:"pink"|"rainbow"|"dark";descriptionId?:string;
}) {
 const link=useRef<HTMLAnchorElement>(null),{playing}=useWaterMotion();
 const [hovered,setHovered]=useState(false),[busy,setBusy]=useState(false);
 const managedExit=href==="#inquiry"&&!!onAction;

 const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 useEffect(()=>{const element=link.current;if(!element)return;const observer=new MutationObserver(()=>setHovered(element.matches(':hover,:focus-visible')||element.dataset.magnetized==='true'));observer.observe(element,{attributes:true,attributeFilter:['data-magnetized']});return()=>observer.disconnect();},[]);
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 useEffect(()=>{
  if(!visible||!playing||!link.current)return;
  const b=link.current.getBoundingClientRect();
  window.dispatchEvent(new CustomEvent("madagin:surface-pulse",{detail:{x:(b.left+b.width/2)/innerWidth,y:(b.top+b.height/2)/innerHeight,strength:.7,duration:2.5}}));
 },[visible,playing]);
 return <a ref={link} href={href} className={`${styles.glass} ${className}`} aria-describedby={descriptionId} data-inquiry-control="" data-managed-exit={managedExit} data-cursor-magnet="" data-cursor-orbit="true" data-magnet-release="30" data-visible={visible} data-playing={playing} data-busy={busy} data-fill={variant} inert={!visible}
 onPointerEnter={()=>setHovered(true)} onPointerLeave={()=>{setHovered(link.current?.dataset.magnetized==='true');}} onFocus={()=>setHovered(true)} onBlur={()=>{setHovered(false);}} onClick={event=>{
  if(onAction&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey&&event.button===0){
   event.preventDefault();if(busy)return;const keyboard=event.detail===0;setBusy(true);
   const b=event.currentTarget.getBoundingClientRect();
   window.dispatchEvent(new CustomEvent("madagin:surface-pulse",{detail:{x:(b.left+b.width/2)/innerWidth,y:(b.top+b.height/2)/innerHeight,strength:1.4,duration:2.2}}));
   if(managedExit){onAction(keyboard);timer.current=setTimeout(()=>setBusy(false),1000);}
   else timer.current=setTimeout(()=>{onAction(keyboard);timer.current=setTimeout(()=>setBusy(false),1000);},playing?240:0);
  }
 }}><BalsaButtonFill active={visible&&(hovered||busy)} className={styles.flow} variant={variant}/><span className={styles.label}>{children}</span><TablerIcon name="arrow-up-right" size={19}/></a>;
}
