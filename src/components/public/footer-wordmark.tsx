"use client";
import {useEffect,useRef} from "react";
import {BrandWordmark} from "./brand-wordmark";
import {useWaterMotion} from "./water-surface";
import type {LiquidRenderer} from "./water-letter-renderer";
import styles from "./footer-wordmark.module.css";

export function FooterWordmark(){
 const host=useRef<HTMLDivElement>(null),renderer=useRef<LiquidRenderer|null>(null),{playing}=useWaterMotion(),playingRef=useRef(playing);
 useEffect(()=>{playingRef.current=playing;renderer.current?.setPaused(!playing);},[playing]);
 useEffect(()=>{
  const element=host.current;if(!element)return;
  const abort=new AbortController();let disposed=false,started=false,timer:ReturnType<typeof setTimeout>|undefined;
  const fallback=()=>{element.dataset.renderState="fallback";};
  const observer=new IntersectionObserver(([entry])=>{
   if(!entry.isIntersecting||started)return;
   started=true;observer.disconnect();
   const saveData=(navigator as Navigator&{connection?:{saveData?:boolean}}).connection?.saveData;
   if(saveData||(!!navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=2)){fallback();return;}
   element.dataset.renderState="pending";
   timer=setTimeout(()=>{abort.abort();fallback();},12000);
   import("./water-letter-renderer").then(module=>module.createLiquidRenderer(element,()=>{},abort.signal,"footer")).then(created=>{
    clearTimeout(timer);if(disposed||abort.signal.aborted){created.dispose();return;}
    renderer.current=created;created.setPaused(!playingRef.current);element.dataset.renderState="ready";
   }).catch(()=>{clearTimeout(timer);if(!disposed)fallback();});
  },{threshold:.08});
  const lost=(event:Event)=>{event.preventDefault();renderer.current?.dispose();renderer.current=null;fallback();};
  observer.observe(element);element.addEventListener("webglcontextlost",lost,true);
  return()=>{disposed=true;abort.abort();clearTimeout(timer);observer.disconnect();element.removeEventListener("webglcontextlost",lost,true);renderer.current?.dispose();renderer.current=null;};
 },[]);
 return <div ref={host} className={styles.stage} data-footer-glass="" data-render-state="idle" aria-hidden="true"><BrandWordmark className={styles.fallback}/><noscript><BrandWordmark className={styles.fallback}/></noscript></div>;
}
