"use client";
import {useEffect,useState} from "react";
import {useWaterMotion} from "./water-surface";
export function useHumanText(text:string,active=true,delay=0,pace=1,cadence:'story'|'question'|'audience'|'strategy'='story'){
 const {playing}=useWaterMotion();const [count,setCount]=useState(0);
 useEffect(()=>{
  if(!active||!playing)return;
  let frame=0,elapsed=0,previous=0,index=0,next=delay;
  const tick=(now:number)=>{frame=0;if(document.hidden){previous=0;return;}if(previous)elapsed+=Math.min(64,now-previous);previous=now;
   while(index<text.length&&elapsed>=next){const letter=text[index];index++;const burst=Math.floor(index/5)%3;
    // Questions read as a continuous thought: spaces are normal keystrokes,
    // with gentle variation across the phrase rather than pauses at every word.
    const interval=cadence==='audience'||cadence==='strategy'
     ? (letter===','?125:letter===' '?70:62+Math.sin(index*.63)*11+Math.sin(index*1.71)*6)
     : cadence==='question'
     ? (letter===' '?58+(index*11)%22:letter===','?150:65+(text.charCodeAt((index-1)%text.length)+index*17)%34)
     : (letter===' '?135+(index*37)%165:letter===','?230:28+burst*20+(text.charCodeAt(index%text.length)*7+index*13)%66);
    next+=interval*pace;
   }
   setCount(index);if(index<text.length)frame=requestAnimationFrame(tick);
  };
  const wake=()=>{cancelAnimationFrame(frame);previous=0;if(!document.hidden)frame=requestAnimationFrame(tick);};wake();document.addEventListener('visibilitychange',wake);
  return()=>{cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',wake);};
 },[text,active,delay,playing,pace,cadence]);
 const amount=!playing?text.length:active?count:0;
 return {value:text.slice(0,amount),complete:amount===text.length};
}
export function TypedError({text}:{text:string}){const {value,complete}=useHumanText(text,true,0,.38);return <><span className="sr-only" role="alert">{text}</span><span aria-hidden="true">{value}{text&&!complete?<i data-typing-caret=""/>:null}</span></>;}
