"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {useWaterMotion} from "./water-surface";
import styles from "./public-chrome.module.css";

export function HomeMarkLink({children,onHome}:{children:React.ReactNode;onHome?:(keyboard:boolean)=>void}){
 const router=useRouter(),{playing}=useWaterMotion(),[departing,setDeparting]=useState(false),busy=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 return <Link href="/" data-home-mark="" data-nav-item="" data-home-departing={departing} aria-label="Madagin home" aria-busy={departing} className={styles.logoLink} onClick={event=>{
  if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;
  event.preventDefault();if(busy.current)return;busy.current=true;setDeparting(true);
  const keyboard=event.detail===0,rect=event.currentTarget.getBoundingClientRect();
  const go=()=>{if(onHome)onHome(keyboard);else router.push('/');timer.current=setTimeout(()=>{busy.current=false;setDeparting(false);},700);};
  if(!playing){go();return;}
  timer.current=setTimeout(()=>{
   window.dispatchEvent(new CustomEvent('madagin:surface-pulse',{detail:{x:(rect.left+rect.width/2)/innerWidth,y:(rect.top+rect.height/2)/innerHeight,strength:.65,duration:1.8}}));
   timer.current=setTimeout(go,400);
  },780);
 }}>{children}</Link>;
}
