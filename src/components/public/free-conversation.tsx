"use client";
import Link from "next/link";
import {useState} from "react";
import {BalsaButtonFill} from "./balsa-button-fill";
import {TablerIcon} from "@/components/ui/tabler-icon";
import styles from "./free-conversation.module.css";
export function FreeConversation({href,visible,onAction,className}:{href:string;visible:boolean;onAction?:(keyboard:boolean)=>void;className?:string}){
 const [hover,setHover]=useState(false);
 return <div className={`${styles.free} ${className??''}`} data-visible={visible} inert={!visible}>
  <Link href={href} aria-label="Inquire" className={styles.trigger} data-nav-item="" data-cursor-magnet="" data-cursor-orbit="true" onPointerEnter={()=>setHover(true)} onPointerLeave={()=>setHover(false)} onFocus={()=>setHover(true)} onBlur={()=>setHover(false)} onClick={event=>{if(!onAction||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;event.preventDefault();onAction(event.detail===0);}}>
   <BalsaButtonFill active={visible&&hover} variant="dark" className={styles.flow}/><span className={styles.label} data-nav-ink="" data-nav-ink-mobile="" data-word="Inquire">Inquire</span><span data-nav-arrow=""><TablerIcon name="arrow-up-right" size={17}/></span>
  </Link>
 </div>;
}
