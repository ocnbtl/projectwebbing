"use client";
import {useId} from "react";
import styles from "./connection-playground.module.css";
export function LiveSignal({connected,playing}:{connected:boolean;playing:boolean}){
 const id=useId();
 return <svg className={styles.signal} viewBox="0 0 36 32" aria-hidden="true" data-live-signal="" data-animated={connected&&playing}>
  <defs><radialGradient id={id} cx="34%" cy="25%"><stop stopColor="#ffe1ef"/><stop offset=".62" stopColor="#f5b0d2"/><stop offset="1" stopColor="#e18eb9"/></radialGradient></defs>
  <circle className={styles.signalCore} cx="11" cy="16" r="6" fill={connected?`url(#${id})`:"currentColor"}/>
  <circle className={styles.signalEdge} cx="11" cy="16" r="5.8"/>
  <g className={styles.signalRays}><path d="M22 11 26 8"/><path d="M24 16H30"/><path d="M22 21 26 24"/></g>
 </svg>;
}
