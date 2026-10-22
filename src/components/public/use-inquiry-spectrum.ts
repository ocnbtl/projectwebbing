"use client";
import {useEffect,type RefObject} from 'react';
/** Animate real stop colors rather than an SVG gradient transform, which can
 * remain cached during touch selection in Safari. Only visible selections run. */
export function useInquirySpectrum(ref:RefObject<SVGLinearGradientElement|null>,active:boolean,playing:boolean,phase=0){
 useEffect(()=>{
  const gradient=ref.current;if(!gradient||!active||!playing)return;
  const initialWidth=Number(gradient.getAttribute("x2"))||24,initialHeight=Number(gradient.getAttribute("y2"))||24;
  const stops=[...gradient.querySelectorAll('stop')];let frame=0,last=0;
  const tick=(now:number)=>{
   if(document.hidden){frame=0;return;}
   if(now-last>32){last=now;const angle=now/(1800+(phase%5)*180)+phase;const width=Number(gradient.getAttribute("data-width")||initialWidth)||24,height=Number(gradient.getAttribute("data-height")||initialHeight)||24;
    const dx=Math.cos(angle)*width*.6,dy=Math.sin(angle)*height*.6;
    gradient.setAttribute("x1",String(width/2-dx));gradient.setAttribute("y1",String(height/2-dy));gradient.setAttribute("x2",String(width/2+dx));gradient.setAttribute("y2",String(height/2+dy));
    stops.forEach((stop,index)=>{stop.setAttribute("stop-color",'hsl('+((now/(15+(phase%7))+phase+index*(280/Math.max(1,stops.length-1)))%360)+' 88% 72%)');});}
   frame=requestAnimationFrame(tick);
  };
  const wake=()=>{cancelAnimationFrame(frame);if(!document.hidden)frame=requestAnimationFrame(tick);};
  wake();document.addEventListener('visibilitychange',wake);
  return()=>{cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',wake);};
 },[ref,active,playing,phase]);
}
