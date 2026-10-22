"use client";
import {useEffect,useRef} from 'react';

/** One deliberate gesture advances one chapter; reading and form scrolling stay native. */
export function useStoryScroll(phase:number,blocked:boolean){
 const gesture=useRef({last:0,total:0,consumed:false}),touch=useRef<{x:number;y:number}|null>(null);
 useEffect(()=>{
  if(phase>=6)return;
  const editable=(target:EventTarget|null)=>target instanceof Element&&!!target.closest('input,textarea,select,[contenteditable],dialog,[role="dialog"]');
  const atReadingEnd=()=>scrollY+innerHeight>=document.documentElement.scrollHeight-8;
  const advance=()=>{
   if(blocked)return false;
   const panel=document.querySelector<HTMLElement>('[data-guided-panel]:not([hidden])');
   const control=phase===4?document.querySelector<HTMLElement>('[data-reading-advance] [data-ready="true"]'):panel?.querySelector<HTMLElement>('[data-active="true"][data-cursor-magnet],a[data-visible="true"][data-cursor-magnet]');
   if(!control||control.closest('[inert]')||control.matches(':disabled')||control.dataset.busy==='true')return false;
   control.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window,detail:1}));return true;
  };
  const wheel=(event:WheelEvent)=>{
   if(event.ctrlKey||event.metaKey||editable(event.target)||Math.abs(event.deltaX)>Math.abs(event.deltaY)||event.deltaY<=0)return;
   const now=performance.now(),g=gesture.current;if(now-g.last>650){g.total=0;g.consumed=false;}g.last=now;
   if(phase===4&&!atReadingEnd())return;
   event.preventDefault();if(g.consumed||blocked)return;
   g.total+=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1);
   if(g.total>=75&&advance()){g.consumed=true;g.total=0;}
  };
  const start=(event:TouchEvent)=>{touch.current=event.touches.length===1&&!editable(event.target)?{x:event.touches[0].clientX,y:event.touches[0].clientY}:null;};
  const move=(event:TouchEvent)=>{
   const from=touch.current;if(!from||event.touches.length!==1)return;
   const p=event.touches[0],dy=from.y-p.clientY;if(dy<=0||Math.abs(p.clientX-from.x)>dy)return;
   if(phase===4&&!atReadingEnd())return;
   event.preventDefault();if(dy>=64&&advance())touch.current=null;
  };
  const end=()=>{touch.current=null;};
  window.addEventListener('wheel',wheel,{passive:false});window.addEventListener('touchstart',start,{passive:true});window.addEventListener('touchmove',move,{passive:false});window.addEventListener('touchend',end);window.addEventListener('touchcancel',end);
  return()=>{window.removeEventListener('wheel',wheel);window.removeEventListener('touchstart',start);window.removeEventListener('touchmove',move);window.removeEventListener('touchend',end);window.removeEventListener('touchcancel',end);touch.current=null;};
 },[phase,blocked]);
}
