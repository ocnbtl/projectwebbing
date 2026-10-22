"use client";
import {useEffect,useLayoutEffect,useId,useRef} from "react";
import {useWaterMotion} from "./water-surface";

/** Refracts the actual navigation shapes as they cross the shared water surface. */
export function SurfaceEmergence({visible,children,skipAnimation=false,duration=1650,intensity=1,treatment="refracted",onSettling,onComplete}:{visible:boolean;children:React.ReactNode;skipAnimation?:boolean;duration?:number;intensity?:number;treatment?:"refracted"|"soft"|"ripple"|"composited";onSettling?:()=>void;onComplete?:()=>void}) {
 const id=useId().replaceAll(":",""),host=useRef<HTMLDivElement>(null),displacement=useRef<SVGFEDisplacementMapElement>(null),blur=useRef<SVGFEGaussianBlurElement>(null),noise=useRef<SVGFETurbulenceElement>(null);
 const clearLayer=useRef<HTMLDivElement>(null),hazeLayer=useRef<HTMLDivElement>(null);
 const {playing}=useWaterMotion();
 const complete=useRef(onComplete);
 const settling=useRef(onSettling);
 useEffect(()=>{complete.current=onComplete;settling.current=onSettling;},[onComplete,onSettling]);
 useLayoutEffect(()=>{
  const element=host.current;if(!element)return;
  if(!visible||!playing||skipAnimation){element.style.filter="none";element.style.opacity="1";if(visible){settling.current?.();complete.current?.();}return;}
  let frame=0,settlingSent=false;const start=performance.now();element.style.filter=treatment!=="refracted"?"none":`url(#${id})`;
  const targets=element.querySelectorAll<HTMLElement>('[data-nav-item]');
  const emit=(target:HTMLElement)=>{const b=target.getBoundingClientRect();window.dispatchEvent(new CustomEvent("madagin:surface-pulse",{detail:{x:(b.left+b.width/2)/innerWidth,y:(b.top+b.height/2)/innerHeight,strength:.34*intensity,duration:duration/1000+1}}));};
  // Release smaller patches along the content instead of one large circle
  // centred on its bounding box. The refraction still uses the real alpha.
  if(targets.length)targets.forEach(emit);else {
   const text=element.querySelector('h1,h2,h3,p,strong')??element;
   const range=document.createRange();range.selectNodeContents(text);
   const boxes=[...range.getClientRects()].filter(b=>b.width>8&&b.height>8).slice(0,4);
   const patches=boxes.flatMap(b=>Array.from({length:Math.min(3,Math.max(1,Math.ceil(b.width/220)))},(_,i)=>({x:b.left+b.width*(i+.35+Math.random()*.3)/Math.min(3,Math.max(1,Math.ceil(b.width/220))),y:b.top+b.height*(.25+Math.random()*.5)})));
   patches.forEach(p=>window.dispatchEvent(new CustomEvent('madagin:surface-pulse',{detail:{x:p.x/innerWidth,y:p.y/innerHeight,strength:.24*intensity/Math.sqrt(patches.length),duration:duration/1000+.7+Math.random()*.45}})));
  }
  if(treatment==="composited"){
   const animation=element.animate([{opacity:0,transform:"translate3d(0,-6px,0)"},{opacity:1,transform:"translate3d(0,0,0)"}],{duration,easing:"cubic-bezier(.22,.65,.25,1)"});
   const timer=setTimeout(()=>settling.current?.(),duration*.82);
   animation.onfinish=()=>complete.current?.();
   return()=>{clearTimeout(timer);animation.onfinish=null;animation.cancel();};
  }
  if(treatment!=="refracted"){
   const clear=clearLayer.current,haze=hazeLayer.current;if(!clear||!haze)return;
   // Keep the haze fixed and composite it into sharp text. The optional ripple
   // below only changes displacement strength, never the noise or blur radius.
   element.style.willChange="opacity, transform";clear.style.willChange="opacity";haze.style.willChange="opacity";
   const options={duration,easing:"cubic-bezier(.22,.55,.3,1)",fill:"both" as const};
   const arrival=element.animate([{opacity:0,transform:"translate3d(0,7px,0)"},{opacity:1,transform:"translate3d(0,0,0)"}],options);
   const focus=clear.animate([{opacity:0},{opacity:1}],options);
   const mist=haze.animate([{opacity:.8},{opacity:0}],options);
   if(treatment==="ripple"){
    // A cached, broad wave field instead of regenerating fine noise each frame.
    // Bound its displacement to body type size, and resolve it before settling.
    const amplitude=Math.min(13,parseFloat(getComputedStyle(element).fontSize)*.9);
    clear.style.filter=`url(#${id}-ripple)`;
    const ripple=(now:number)=>{
     const t=Math.min(1,(now-start)/(duration*.9));
     displacement.current?.setAttribute('scale',String(amplitude*Math.pow(1-t,1.5)*Math.sin(t*Math.PI*2.5+.5)));
     if(t<1)frame=requestAnimationFrame(ripple);else clear.style.filter="none";
    };
    frame=requestAnimationFrame(ripple);
   }
   const timer=setTimeout(()=>settling.current?.(),duration*.82);
   const release=()=>{cancelAnimationFrame(frame);clear.style.filter="none";arrival.onfinish=null;arrival.cancel();focus.cancel();mist.cancel();element.style.willChange="auto";clear.style.willChange="auto";haze.style.willChange="auto";};
   arrival.onfinish=()=>{clearTimeout(timer);release();complete.current?.();};
   return()=>{clearTimeout(timer);release();};
  }
  noise.current?.setAttribute('seed',String(Math.floor(Math.random()*900)+1));
  element.style.opacity="0";
  const tick=(now:number)=>{const t=Math.min(1,(now-start)/duration),ease=t*t*(3-2*t);element.style.opacity=String(ease);displacement.current?.setAttribute("scale",String(22*intensity*(1-ease)));blur.current?.setAttribute('stdDeviation',String(3.5*(1-ease)));noise.current?.setAttribute('baseFrequency',`${.009+t*.002} ${.017+t*.005}`);if(t>=.82&&!settlingSent){settlingSent=true;settling.current?.();}if(t<1)frame=requestAnimationFrame(tick);else{element.style.filter="none";complete.current?.();}};
  frame=requestAnimationFrame(tick);return()=>{cancelAnimationFrame(frame);element.style.filter="none";element.style.opacity="1";};
 },[visible,playing,skipAnimation,id,duration,intensity,treatment]);
 if(treatment==="composited")return <div ref={host}>{children}</div>;
 if(treatment!=="refracted")return <>{treatment==="ripple"?<svg width="0" height="0" aria-hidden="true" style={{position:"absolute"}}><defs><filter id={`${id}-ripple`} x="-6%" y="-15%" width="112%" height="130%" colorInterpolationFilters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".009 .032" numOctaves="1" seed="13" result="waves"/><feDisplacementMap ref={displacement} in="SourceGraphic" in2="waves" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter></defs></svg>:null}<div ref={host} data-surface-emergence={treatment} style={{position:"relative"}}><div ref={clearLayer}>{children}</div><div ref={hazeLayer} aria-hidden="true" inert style={{position:"absolute",inset:0,opacity:0,filter:"blur(2.5px)",pointerEvents:"none",userSelect:"none"}}>{children}</div></div></>;
 return <><svg width="0" height="0" aria-hidden="true" style={{position:"absolute"}}><defs><filter id={id} x="-10%" y="-50%" width="120%" height="200%"><feTurbulence ref={noise} type="fractalNoise" baseFrequency=".009 .017" numOctaves="2" seed="7" result="waves"/><feDisplacementMap ref={displacement} in="SourceGraphic" in2="waves" scale="0" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur ref={blur} stdDeviation="0"/></filter></defs></svg><div ref={host}>{children}</div></>;
}
