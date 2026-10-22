"use client";
import {useEffect,useId,useRef} from 'react';
import catalog from './monogram-glyphs.json';
import {useWaterMotion} from './water-surface';
import {useMonogramFonts} from './monogram-preferences';
import type {MonogramController} from './monogram-renderer';
import styles from './glass-monogram.module.css';
const faces=catalog.M.versions;
export async function prepareGlassMonogram(){const {prepareMonogram}=await import('./monogram-renderer');await prepareMonogram(faces.find(face=>face.family==='Alice')||faces[0]);}
export function GlassMonogram({face='Alice',cycle=true,onFontChange}:{face?:string;cycle?:boolean;onFontChange?:(family:string)=>void}){
 const enabled=useMonogramFonts(),selection=enabled.join('|'),{playing}=useWaterMotion();
 const host=useRef<HTMLSpanElement>(null),canvas=useRef<HTMLCanvasElement>(null),controller=useRef<MonogramController|null>(null),target=useRef(face),motion=useRef(playing),listener=useRef(onFontChange),id=useId().replaceAll(':','');
 const rest=faces.find(f=>f.family===face)||faces[0];
 useEffect(()=>{listener.current=onFontChange;},[onFontChange]);
 useEffect(()=>{target.current=face;motion.current=playing;controller.current?.setPlaying(playing);controller.current?.setFace(faces.find(f=>f.family===face)||faces[0],false);listener.current?.(face);},[face,playing]);
 useEffect(()=>{
  let cancelled=false;const el=host.current,view=canvas.current;if(!el||!view)return;
  import('./monogram-renderer').then(({registerMonogram})=>{if(cancelled)return;controller.current=registerMonogram(el,view,faces.find(f=>f.family===target.current)||faces[0],motion.current);}).catch(()=>{if(!cancelled)el.dataset.glassState='fallback';});
  return()=>{cancelled=true;controller.current?.dispose();controller.current=null;};
 },[]);
 useEffect(()=>{
  const el=host.current,link=el?.closest<HTMLElement>('a,button');if(!el||!link||!cycle)return;
  const choices=faces.filter(f=>selection.split('|').includes(f.family));let visible=false,timer:ReturnType<typeof setTimeout>|undefined,settledAt=0;
  const change=(name:string,animate=true)=>{target.current=name;el.dataset.font=name;const next=faces.find(f=>f.family===name)||faces[0];el.querySelector('[data-monogram-fallback]')?.setAttribute('d',next.path);controller.current?.setFace(next,animate);listener.current?.(name);};
  const stop=()=>clearTimeout(timer);
  const next=()=>{stop();if(document.hidden||!visible||!playing)return;
   // Let the glass M surface and settle before beginning its first morph.
   const unveiling=el.parentElement?.getAnimations().some(animation=>animation.playState==='running');
   if(link.closest('[hidden],[inert]')||unveiling||link.dataset.homeDeparting==='true'){settledAt=0;timer=setTimeout(next,120);return;}
   if(!settledAt)settledAt=performance.now();
   if(performance.now()-settledAt<1000){timer=setTimeout(next,120);return;}
   const index=choices.findIndex(f=>f.family===target.current);change((choices[(index+1)%choices.length]||faces[0]).family);timer=setTimeout(next,4600);};
  const wake=()=>{stop();if(!document.hidden&&visible&&playing&&choices.length>1)timer=setTimeout(next,3000);};
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;wake();});observer.observe(el);
  document.addEventListener('visibilitychange',wake);
  return()=>{stop();observer.disconnect();document.removeEventListener('visibilitychange',wake);};
 },[cycle,face,playing,selection]);
 return <span ref={host} className={styles.mark} aria-hidden="true" data-glass-monogram="" data-font-count={enabled.length} data-font={face}>
  <svg viewBox="0 0 256 256" className={styles.fallback}><defs><linearGradient id={`${id}-rim`} x2=".8" y2="1"><stop stopColor="#f4fbff"/><stop offset=".3" stopColor="#bdddec" stopOpacity=".58"/><stop offset=".62" stopColor="#e7f6ff" stopOpacity=".9"/><stop offset="1" stopColor="#749db7"/></linearGradient><linearGradient id={`${id}-fill`} x2=".3" y2="1"><stop stopColor="#eafaff" stopOpacity=".2"/><stop offset=".5" stopColor="#eafaff" stopOpacity=".035"/><stop offset="1" stopColor="#b7dcf4" stopOpacity=".13"/></linearGradient></defs><path data-monogram-fallback="" d={rest.path} fill={`url(#${id}-fill)`} stroke={`url(#${id}-rim)`} strokeWidth="2.4" strokeLinejoin="round"/></svg>
  <canvas ref={canvas} className={styles.optics} width={1} height={1}/>
 </span>;
}
