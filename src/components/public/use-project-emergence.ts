"use client";
import {useLayoutEffect,useRef,useState,type RefObject} from "react";
import {useWaterMotion} from "./water-surface";
import {contentWaterMotion} from "./content-water-motion";

/** Reveal only the content entering the viewport, never the entire collection. */
export function useProjectEmergence(host:RefObject<HTMLElement|null>,showingIndex:boolean){
 const {playing,paused}=useWaterMotion();
 const [arrowReady,setArrowReady]=useState(false);
 const titleSeen=useRef(false),cardsSeen=useRef(new Set<string>());
 useLayoutEffect(()=>{
  const root=host.current;if(!showingIndex||!root)return;
  // The motion provider deliberately reports false during hydration. Wait for
  // its browser snapshot instead of flashing everything before the real reveal.
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData=(navigator as Navigator&{connection?:{saveData?:boolean}}).connection?.saveData;
  if(!playing&&!paused&&!reduced&&!saveData)return;
  const title=root.querySelector<HTMLElement>('[data-project-title]');
  const cards=[...root.querySelectorAll<HTMLElement>('[data-project-card]')];
  let cancelled=false;
  const animations=new Set<Animation>(),timers=new Set<ReturnType<typeof setTimeout>>();
  const pulse=(element:HTMLElement,strength:number)=>{
   const b=element.getBoundingClientRect();
   if(b.bottom<0||b.top>innerHeight)return;
   window.dispatchEvent(new CustomEvent('madagin:surface-pulse',{detail:{x:(b.left+b.width*.46)/innerWidth,y:Math.max(0,Math.min(innerHeight-48,b.top+Math.min(b.height*.35,70)))/innerHeight,strength,duration:1.7}}));
  };
  const emerge=(element:HTMLElement,duration:number,done:()=>void)=>{
   element.dataset.projectEmergence='emerging';
   const animation=contentWaterMotion(element,true,duration);animations.add(animation);
   animation.finished.then(()=>{animations.delete(animation);if(cancelled)return;element.dataset.projectEmergence='settled';done();},()=>{});
  };
  if(title){
   if(!playing||titleSeen.current){title.dataset.projectEmergence='settled';setArrowReady(true);}
   else {
    setArrowReady(false);pulse(title,.32);
    emerge(title,1400,()=>{titleSeen.current=true;const timer=setTimeout(()=>{if(!cancelled)setArrowReady(true);},120);timers.add(timer);});
   }
  }
  const reveal=(card:HTMLElement)=>{
   if(card.dataset.projectEmergence!=='waiting')return;
   const key=card.dataset.project??'';
   if(!playing||cardsSeen.current.has(key)){card.dataset.projectEmergence='settled';return;}
   pulse(card,.2);
   emerge(card,1250,()=>cardsSeen.current.add(key));
  };
  const observer=new IntersectionObserver(entries=>{
   for(const entry of entries)if(entry.isIntersecting){const card=entry.target as HTMLElement;reveal(card);observer.unobserve(card);}
  },{threshold:0,rootMargin:'0px 0px -56px 0px'});
  cards.forEach(card=>{
   card.dataset.projectEmergence='waiting';
   if(!playing||cardsSeen.current.has(card.dataset.project??''))reveal(card);else observer.observe(card);
  });
  // Keyboard traversal must never land on an invisible project.
  const focus=(event:FocusEvent)=>{const card=(event.target as HTMLElement).closest<HTMLElement>('[data-project-card]');if(card){reveal(card);observer.unobserve(card);}};
  root.addEventListener('focusin',focus);
  return()=>{cancelled=true;observer.disconnect();root.removeEventListener('focusin',focus);timers.forEach(clearTimeout);animations.forEach(animation=>animation.cancel());};
 },[host,showingIndex,playing,paused]);
 return arrowReady;
}
