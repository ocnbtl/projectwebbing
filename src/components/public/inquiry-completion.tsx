"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { useWaterMotion } from "./water-surface";
import { TablerIcon } from "@/components/ui/tabler-icon";
import styles from "./inquiry-completion.module.css";

/** A single surface breach: the message settles, a seal draws, then the reply appears. */
export function InquiryCompletion({email,preview,onReturn}:{email:string;preview:boolean;onReturn:()=>void}) {
  const {playing}=useWaterMotion();
  const id=useId().replaceAll(":","");
  const root=useRef<HTMLElement>(null),heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{
    heading.current?.focus({preventScroll:true});
    root.current?.scrollIntoView({block:"center",behavior:playing?"smooth":"instant"});
    if (!playing) return;
    const timer=setTimeout(()=>{
      const box=root.current?.getBoundingClientRect();
      if(box)window.dispatchEvent(new CustomEvent("madagin:surface-pulse",{detail:{x:(box.left+box.width/2)/innerWidth,y:(box.top+150)/innerHeight,strength:.65,duration:2.8}}));
    },600);
    return ()=>clearTimeout(timer);
  },[playing]);
  return <section ref={root} className={styles.completion} data-playing={playing} data-confirmation={preview?"preview":"accepted"} aria-labelledby={`${id}-title`}>
    {preview?<p className={styles.preview}>Confirmation preview · no inquiry sent</p>:null}
    <div className={styles.art} aria-hidden="true">
      <i className={styles.ripple}/><i className={styles.ripple}/><span className={styles.constellation}>{Array.from({length:12},(_,i)=><b key={i} style={{"--particle":i} as React.CSSProperties}/>)}</span>
      <div className={styles.seal}>
        <svg viewBox="0 0 120 120" fill="none"><defs><linearGradient id={`${id}-edge`} x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse"><stop stopColor="#fff3f9"/><stop offset=".4" stopColor="#ebabc8"/><stop offset=".75" stopColor="#9fc9e2"/><stop offset="1" stopColor="#fff"/></linearGradient></defs><circle className={styles.rim} cx="60" cy="60" r="53" pathLength="1" stroke={`url(#${id}-edge)`}/><path className={styles.message} d="M37 46h46v29H37z M37 46l23 18 23-18" stroke="currentColor"/><path className={styles.check} d="M40 60l14 14 28-29" pathLength="1" stroke="currentColor"/></svg>
      </div>
    </div>
    <div className={styles.copy}>
      <h2 ref={heading} id={`${id}-title`} tabIndex={-1}>Thank you for the introduction.</h2>
      <p>We’ll read through your inquiry and get back to you at <span>{email}</span>.</p>
      <div className={styles.actions}>{preview?<button type="button" onClick={onReturn}><TablerIcon name="arrow-left" size={18}/>Return to your inquiry</button>:null}<Link className={styles.workLink} href="/projects">Explore our work<TablerIcon name="arrow-right" size={18}/></Link></div>
    </div>
  </section>;
}
