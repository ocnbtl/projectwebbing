"use client";
import {useId,type CSSProperties} from "react";
import lettering from "./script-lettering.json";
import styles from "./home-story.module.css";

export type JourneyKind=keyof typeof lettering;
export const outcomeWidth=(kind:JourneyKind)=>lettering[kind].width/100;

/** Font-shaped outlines preserve the joins; each letter has its own pen mask. */
export function JourneyOutcome({kind}:{kind:JourneyKind}) {
 const id=useId().replaceAll(":",""),shape=lettering[kind];
 const script=shape.writeDuration>0;
 return <em className={styles.journeyOutcome} data-outcome={kind} data-font={shape.family} style={{"--outcome-width":shape.width/100,"--outcome-height":shape.height/100,"--outcome-top":(1-shape.baseline/100)} as CSSProperties}>
  <span className={styles.scriptLabel}>{shape.text}</span>
  <svg viewBox={`0 0 ${shape.width} ${shape.height}`} aria-hidden="true">
   {script?shape.glyphs.map((glyph,i)=><g key={i}>
    <defs><mask id={`${id}-${i}`} maskUnits="userSpaceOnUse" x="0" y="0" width={shape.width} height={shape.height}>
     {glyph.strokes.map((stroke,j)=><path key={j} className={styles.pen} d={stroke.d} fill="none" stroke="white" strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" pathLength="1" style={{"--pen-delay":`${180+stroke.start}ms`,"--pen-duration":`${Math.max(1,stroke.duration)}ms`} as CSSProperties}/>)}
    </mask></defs><path d={glyph.d} fill="currentColor" mask={`url(#${id}-${i})`}/>
   </g>):kind==="style"?shape.glyphs.map((glyph,i)=><path key={i} className={styles.styleLetter} d={glyph.d} fill="currentColor" style={{"--letter":i,"--spread":(i-(shape.glyphs.length-1)/2)/2} as CSSProperties}/>):shape.words.map((word,i)=><g key={word.text} className={styles.outcomeWord} style={{"--word":i,"--join":i===0?-1:1} as CSSProperties}><path d={word.d} fill="currentColor" fillRule="evenodd" pathLength={1}/></g>)}
  </svg>
 </em>;
}
