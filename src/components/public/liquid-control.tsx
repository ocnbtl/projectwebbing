"use client";
import {scrollToWaterTop} from "./water-viewport";
import {useEffect,useRef,useState} from "react";
import {useWaterMotion} from "./water-surface";

import styles from "./liquid-control.module.css";
export function LiquidControl({href,label,onAction,onRevealed,variant="chapter",active=true,revealOnView=false}:{href:string;label:string;onAction?:(keyboard:boolean)=>void;onRevealed?:()=>void;variant?:"hero"|"chapter"|"up"|"wide";active?:boolean;revealOnView?:boolean}) {
 const {playing}=useWaterMotion();const [busy,setBusy]=useState(false);const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),focusCleanup=useRef<()=>void>(()=>{});
 const [reached,setReached]=useState(false),[pressed,setPressed]=useState(false);
 const revealed=!revealOnView||reached||!playing;
 const control=useRef<HTMLAnchorElement>(null);
 const [size,setSize]=useState({width:320,height:72});
 useEffect(()=>{const el=control.current;if(!el)return;const resize=new ResizeObserver(()=>{const b=el.getBoundingClientRect();if(b.width&&b.height)setSize({width:b.width,height:b.height});});resize.observe(el);return()=>resize.disconnect();},[]);
 const radius=Math.max(1,size.height/2-7);
 const outline=`M${size.width/2} 7 H${size.width-size.height/2} A${radius} ${radius} 0 0 1 ${size.width-size.height/2} ${size.height-7} H${size.height/2} A${radius} ${radius} 0 0 1 ${size.height/2} 7 Z`;
 useEffect(()=>{
  const element=control.current;if(!element||!active||!revealOnView||reached||!playing)return;
  const observer=new IntersectionObserver(([entry])=>{
   if(entry.isIntersecting&&entry.intersectionRatio>=.6){setReached(true);observer.disconnect();}
  },{threshold:.6,rootMargin:"0px 0px -72px 0px"});
  observer.observe(element);return()=>observer.disconnect();
 },[active,revealOnView,reached,playing]);
 useEffect(()=>()=>{clearTimeout(timer.current);focusCleanup.current();},[]);
 useEffect(()=>{if(active&&revealed&&!playing)onRevealed?.();},[active,revealed,playing,onRevealed]);
 useEffect(()=>{if(variant!=="hero")return;const visibility=()=>{if(control.current)control.current.dataset.pageVisible=String(!document.hidden);};visibility();document.addEventListener("visibilitychange",visibility);return()=>document.removeEventListener("visibilitychange",visibility);},[variant]);
 return <a ref={control} href={href} aria-label={label} className={styles.control} data-cursor-magnet="" data-magnet-inset={variant==="wide"?7:7*size.height/72} data-variant={variant} data-active={active} data-playing={playing} data-revealed={revealed} data-busy={busy} data-pressed={pressed} onPointerDown={()=>setPressed(true)} onPointerUp={()=>setPressed(false)} onPointerCancel={()=>setPressed(false)} onPointerLeave={()=>setPressed(false)} onContextMenu={event=>event.preventDefault()} inert={!active} onFocus={()=>setReached(true)} onAnimationEnd={event=>{if((event.target as Element).classList.contains(styles.stem)&&active)onRevealed?.();}} onClick={e=>{
 if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button!==0)return;e.preventDefault();if(busy||!active)return;setBusy(true);
 const b=e.currentTarget.getBoundingClientRect();window.dispatchEvent(new CustomEvent("madagin:surface-pulse",{detail:{x:(b.left+b.width/2)/innerWidth,y:(b.top+b.height/2)/innerHeight,strength:variant==="hero"?1.9:1,duration:variant==="hero"?2.5:1.8}}));
 const collective=e.currentTarget.closest("[data-scene]")?.getAttribute("data-scene")==="experiences";
 if(collective)window.dispatchEvent(new CustomEvent("madagin:connection-depart",{detail:{x:b.left+b.width/2,y:b.top+b.height/2}}));
 const keyboard=e.detail===0;
 const go=()=>{
  if(keyboard&&!onAction){
   focusCleanup.current();
   const finish=()=>{const destination=document.querySelector<HTMLElement>(href);const target=href==="#top"?destination?.querySelector<HTMLElement>('[data-variant="hero"],h1'):destination?.querySelector<HTMLElement>("h2,h1,h3");if(target&&!target.closest("[inert]")){if(!target.matches("a,button"))target.tabIndex=-1;target.focus({preventScroll:true});}focusCleanup.current();};
   const fallback=setTimeout(finish,playing?2400:100);
   document.addEventListener("scrollend",finish,{once:true});
   focusCleanup.current=()=>{clearTimeout(fallback);document.removeEventListener("scrollend",finish);};
  }
  if(onAction)onAction(keyboard);else if(href==="#top")scrollToWaterTop(playing?"smooth":"instant");else document.querySelector(href)?.scrollIntoView({behavior:playing?"smooth":"instant",block:"start"});timer.current=setTimeout(()=>setBusy(false),700);
 };
 if(playing)timer.current=setTimeout(go,collective?620:variant==="up"?180:220);else go();
 }}><span className={styles.rippleFill} aria-hidden="true"/><svg viewBox={variant==="wide"?`0 0 ${size.width} ${size.height}`:"0 0 72 72"} preserveAspectRatio="none" aria-hidden="true"><path className={styles.ring} pathLength="1" d={variant==="wide"?outline:variant==="hero"||variant==="up"?"M36 7 A29 29 0 1 1 35.99 7":"M65 36 A29 29 0 1 0 7 36 A29 29 0 1 0 65 36"}/></svg>{variant==="wide"?<span className={styles.continueLabel} aria-hidden="true">Continue</span>:<svg className={styles.icon} viewBox="0 0 72 72" aria-hidden="true"><g className={styles.arrow}><path className={styles.stem} pathLength="1" d="M36 22 V49 L26 39 L36 49 L46 39"/></g></svg>}</a>;
}


