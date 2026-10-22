"use client";
import {useState,type CSSProperties} from "react";
import {useWaterMotion} from "./water-surface";
import styles from "./public-chrome.module.css";

const motto="Pursuit of excellence";

export function FooterMotto(){
 const [tracing,setTracing]=useState(false),{playing}=useWaterMotion();
 const trace=()=>{if(playing)setTracing(true);};
 return <span className={styles.footerMotto} data-footer-motto="" data-tracing={tracing} data-playing={playing} role="button" tabIndex={0} aria-label="Play Pursuit of excellence shine"
  onClick={trace} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();trace();}}}
  onPointerEnter={event=>{if(playing&&event.pointerType!=="touch")setTracing(true);}}
  onAnimationEnd={event=>{if((event.target as HTMLElement).dataset.traceEnd==='true')setTracing(false);}}>
  {motto}<span className={styles.mottoTrace} aria-hidden="true">{Array.from(motto).map((letter,i)=><span key={i} data-trace-end={i===motto.length-1} style={{'--letter':i} as CSSProperties}>{letter}</span>)}</span>
 </span>;
}
