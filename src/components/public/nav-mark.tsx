"use client";
import {useEffect,useLayoutEffect,useRef,useSyncExternalStore} from "react";
import {usePathname} from "next/navigation";
import {aliceSpacing} from "./brand-wordmark-spacing";
import {waterPageTop} from "./water-viewport";
import {useWaterMotion} from "./water-surface";
import type {LiquidRenderer} from "./water-letter-renderer";
import styles from "./public-chrome.module.css";
// Retain the actual glass pixels while the next route prepares its renderer.
// A bright CSS outline between two glass canvases looked like a navigation glow.
let lastGlassFrame:string|null=null;
const subscribeFrame=()=>()=>{};
const readFrame=()=>lastGlassFrame;
const serverFrame=()=>null;
export function NavMark(){
 const pathname=usePathname();
 const previousFrame=useSyncExternalStore(subscribeFrame,readFrame,serverFrame);
 const root=useRef<HTMLSpanElement>(null);
 const renderer=useRef<LiquidRenderer|null>(null),{playing}=useWaterMotion(),playingRef=useRef(playing);
 useEffect(()=>{playingRef.current=playing;renderer.current?.setPaused(!playing);},[playing]);
 useLayoutEffect(()=>{
  const element=root.current;if(!element)return;
  const home=element.closest<HTMLElement>('[data-phase]');
  const sync=()=>{const expanded=!home||scrollY>waterPageTop()+24||Number(home.dataset.phase??0)>0;element.dataset.expanded=String(expanded);renderer.current?.setExpanded(expanded);};
  const observer=new MutationObserver(sync);if(home)observer.observe(home,{attributes:true,attributeFilter:['data-phase']});
  window.addEventListener('scroll',sync,{passive:true});sync();
  return()=>{observer.disconnect();window.removeEventListener('scroll',sync);};
 },[]);
 useEffect(()=>{
  const element=root.current;if(!element)return;
  const abort=new AbortController();let disposed=false;
  const fallback=()=>{element.dataset.renderState='fallback';};
  const lowPower=!!navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=2;
  if(lowPower||(navigator as Navigator&{connection?:{saveData?:boolean}}).connection?.saveData){fallback();return;}
  const timer=setTimeout(()=>{abort.abort();fallback();},12000);
  import('./water-letter-renderer').then(module=>module.createLiquidRenderer(element,()=>{},abort.signal,'nav')).then(created=>{
   clearTimeout(timer);if(disposed||abort.signal.aborted){created.dispose();return;}
   renderer.current=created;created.setExpanded(element.dataset.expanded==='true');created.setPaused(!playingRef.current);element.dataset.renderState='ready';
  }).catch(()=>{clearTimeout(timer);if(!disposed)fallback();});
  const lost=(event:Event)=>{event.preventDefault();renderer.current?.dispose();renderer.current=null;fallback();};
  element.addEventListener('webglcontextlost',lost,true);
  return()=>{disposed=true;abort.abort();clearTimeout(timer);element.removeEventListener('webglcontextlost',lost,true);if(renderer.current&&element.dataset.expanded==='true'){try{lastGlassFrame=renderer.current.snapshot();}catch{lastGlassFrame=null;}}renderer.current?.dispose();renderer.current=null;};
 },[]);
 return <span ref={root} className={styles.revealingMark} data-nav-glass="" data-render-state="pending" data-expanded={pathname!=="/"} aria-hidden="true">
  {previousFrame?<span className={styles.navSnapshot} style={{backgroundImage:`url(${previousFrame})`}}/>:null}
  <span className="brand-wordmark" data-brand-wordmark="Alice"><span style={{marginInlineEnd:`${aliceSpacing[0]}em`}}>M</span><span className={styles.revealingTail}>{Array.from('ADAGIN').map((letter,index)=><span key={index} style={{marginInlineEnd:`${aliceSpacing[index+1]}em`}}>{letter}</span>)}</span></span>
 </span>;
}
