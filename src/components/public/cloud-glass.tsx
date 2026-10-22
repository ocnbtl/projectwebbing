"use client";
import {useEffect,useRef} from "react";
import {useWaterMotion} from "./water-surface";
/** Sample the real water inside a feathered mist, without a hard lens boundary. */
export function CloudGlass({active,className}:{active:boolean;className:string}){
 const ref=useRef<HTMLCanvasElement>(null);const {playing}=useWaterMotion();
 useEffect(()=>{
  const canvas=ref.current,ctx=canvas?.getContext('2d');if(!canvas||!ctx||!active)return;
  let frame=0,last=0;
  const draw=(now:number)=>{
   frame=0;if(document.hidden)return;
   if(now-last<33){frame=requestAnimationFrame(draw);return;}last=now;
   const water=document.querySelector<HTMLCanvasElement>('[data-water-canvas]'),b=canvas.getBoundingClientRect();
   if(water&&b.width&&b.height){
    const dpr=Math.min(devicePixelRatio||1,2),w=Math.round(canvas.offsetWidth*dpr),h=Math.round(canvas.offsetHeight*dpr);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    ctx.setTransform(w/b.width,0,0,h/b.height,0,0);ctx.clearRect(0,0,b.width,b.height);ctx.save();
    const wb=water.getBoundingClientRect(),sx=water.width/wb.width,sy=water.height/wb.height;
    const shiftX=Math.sin(now*.00057)*4,shiftY=Math.cos(now*.00043)*3;
    ctx.drawImage(water,(b.left-wb.left+shiftX-b.width*.035)*sx,(b.top-wb.top+shiftY-b.height*.035)*sy,b.width*1.07*sx,b.height*1.07*sy,0,0,b.width,b.height);
    for(let i=0;i<3;i++){
     const x=b.width*(.18+i*.32)+Math.sin(now*.00043+i*2.1)*b.width*.09,y=b.height*(.24+i*.2)+Math.cos(now*.00058+i)*b.height*.18;
     const fog=ctx.createRadialGradient(x,y,0,x,y,b.height*(.48+i*.16));
     fog.addColorStop(0,i===1?'#c1dbe546':'#8fb4cb32');fog.addColorStop(.3,'#aacad827');fog.addColorStop(.65,'#aacad80f');fog.addColorStop(1,'#cee9f400');ctx.fillStyle=fog;ctx.fillRect(0,0,b.width,b.height);
    }
    ctx.restore();
   }
   if(playing)frame=requestAnimationFrame(draw);
  };
  const wake=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);};wake();document.addEventListener('visibilitychange',wake);
  return()=>{cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',wake);};
 },[active,playing]);
 return <canvas ref={ref} className={className} aria-hidden="true"/>;
}
