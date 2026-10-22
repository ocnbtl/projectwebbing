"use client";
import {useEffect,useRef} from "react";
import source from "./balsa/madagin-background.json";
import type {BalsaBackgroundConfig} from "./balsa/gradient-background";
import {useWaterMotion} from "./water-surface";

// A separate palette using the same audited Balsa ribbon renderer. The site's
// exported background and vendored shader stay unchanged.
const fills:Record<"pink"|"rainbow"|"dark"|"white",BalsaBackgroundConfig>={
 pink:{...source as BalsaBackgroundConfig,seed:2917,
  colors:["#9C6589","#D3A6C1","#FBE2F1","#B985B0","#EBBDD7","#B785A7"],
  speed:2.15,scale:.85,warp:.76,wave:1.55,softness:.92,contrast:.5,brightness:.13,grain:.012,
  direction:128,fieldOctaves:3,fieldFrequency:.68,patternDensity:1.35,quality:"medium"},
 dark:{...source as BalsaBackgroundConfig,seed:6301,colors:["#0C1520","#243540","#536373","#192937","#8B969E","#14202E"],speed:1.7,scale:.7,warp:.65,wave:1.4,softness:.9,contrast:.55,grain:.01,quality:"medium"},
 white:{...source as BalsaBackgroundConfig,seed:3152,colors:["#4E6473","#A7B8C7","#F7FCFF","#8CABB9","#DDEBF1","#728997"],speed:1.8,scale:.82,warp:.8,wave:1.55,softness:.9,contrast:.65,grain:.006,quality:"medium"},
 rainbow:{...source as BalsaBackgroundConfig,seed:4081,
  colors:["#EDA3C5","#F4C19C","#EEE5A8","#A8DDD1","#AACAF0","#C6B4EE"],
  pattern:"conic",speed:1.55,scale:1.1,warp:.72,wave:1.15,softness:.96,contrast:.6,brightness:.08,grain:.012,
  direction:80,fieldOctaves:2,fieldFrequency:.62,patternDensity:1.2,quality:"medium"},
};

export function BalsaButtonFill({active,className,variant="pink"}:{active:boolean;className?:string;variant?:"pink"|"rainbow"|"dark"|"white"}){
 const canvas=useRef<HTMLCanvasElement>(null),running=useRef(false),wake=useRef(()=>{});
 const {playing}=useWaterMotion();
 useEffect(()=>{running.current=active&&playing;wake.current();},[active,playing]);
 useEffect(()=>{
  const el=canvas.current;if(!el)return;const config=fills[variant];
  let disposed=false,frame=0,elapsed=6,last=0,previous=performance.now();
  let renderer:import("./balsa/gradient-background-renderer").GradientBackgroundRenderer|undefined;
  let loading=false,inView=false;
  const paint=()=>{if(!renderer)return;renderer.render(elapsed*config.speed);el.dataset.frame=String(Number(el.dataset.frame||0)+1);};
  const loop=(now:number)=>{
   frame=0;if(disposed||document.hidden||!inView||!running.current)return;
   frame=requestAnimationFrame(loop);
   if(now-last<1000/30)return;
   elapsed+=Math.min(.1,(now-previous)/1000);previous=now;last=now;paint();
  };
  const start=()=>{cancelAnimationFrame(frame);frame=0;previous=performance.now();if(renderer&&inView&&!document.hidden){paint();if(running.current)frame=requestAnimationFrame(loop);}};
  const prepare=async()=>{
   if(renderer||loading)return;loading=true;
   try{
    const {GradientBackgroundRenderer}=await import("./balsa/gradient-background-renderer");
    if(disposed)return;
    renderer=new GradientBackgroundRenderer(el,config,config.colors);
    renderer.resize(360,100);el.dataset.renderer=`balsa-${config.pattern}`;start();
   }catch{el.dataset.renderer="fallback";}
  };
  const observer=new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;if(inView)void prepare();start();});
  observer.observe(el);wake.current=start;
  document.addEventListener("visibilitychange",start);
  return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener("visibilitychange",start);renderer?.dispose();wake.current=()=>{};};
 },[variant]);
 return <canvas ref={canvas} className={className} data-balsa-button={variant} aria-hidden="true"/>;
}
