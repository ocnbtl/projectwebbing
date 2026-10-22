"use client";
import {useId,useRef,type CSSProperties} from "react";
import {TablerGlyph,type TablerIconName} from "@/components/ui/tabler-icon";
import {useWaterMotion} from "./water-surface";
import {useInquirySpectrum} from "./use-inquiry-spectrum";
import styles from "./contact-journey.module.css";

export function InquiryIcon({name,selected=false}:{name:TablerIconName;selected?:boolean}){
 const id=useId().replaceAll(':','');
 const phase=Array.from(id+name).reduce((hash,letter)=>(hash*31+letter.charCodeAt(0))>>>0,7);
 const gradient=useRef<SVGLinearGradientElement>(null),{playing}=useWaterMotion();
 useInquirySpectrum(gradient,selected,playing,phase%360);
 return <svg className={styles.choiceMark} style={{'--icon-phase':`-${phase%7000}ms`,'--icon-duration':`${6200+phase%2300}ms`} as CSSProperties} viewBox="0 0 24 24" fill="none" stroke="#f6fbff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-inquiry-icon={name}>
  <defs><linearGradient ref={gradient} id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="24"><stop className={styles.rainbowStop} stopColor="#ffa9d7"/><stop className={styles.rainbowStop} offset=".48" stopColor="#f6e898"/><stop className={styles.rainbowStop} offset="1" stopColor="#86ddfa"/></linearGradient><linearGradient id={`${id}-feather`} gradientUnits="userSpaceOnUse" x1="-12" x2="0"><stop stopColor="white"/><stop offset="1" stopColor="white" stopOpacity="0"/></linearGradient><mask id={`${id}-wipe`} maskUnits="userSpaceOnUse" x="-4" y="-4" width="32" height="32"><rect className={styles.iconReveal} x="-96" y="-4" width="192" height="32" fill={`url(#${id}-feather)`}/></mask></defs>
  <g className={styles.iconWhite}><TablerGlyph name={name}/></g>
  <g className={styles.iconRainbow} mask={`url(#${id}-wipe)`} stroke={`url(#${id})`}><TablerGlyph name={name}/></g>
 </svg>;
}
