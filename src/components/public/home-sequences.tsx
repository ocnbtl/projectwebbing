"use client";
import Image from "next/image";
import {useCallback,useEffect,useRef,useState} from "react";
import {LiquidControl} from "./liquid-control";
import {PinkGlassLink} from "./pink-glass-link";
import {StrategyPhrase} from "./strategy-phrase";
import {SurfaceEmergence} from "./surface-emergence";
import {DesignPhrase} from "./design-phrase";

import {ContactJourney} from "./contact-journey";
import {useHumanText} from "./human-type";
import {TablerIcon} from "@/components/ui/tabler-icon";
import {useWaterMotion} from "./water-surface";
import styles from "./home-story.module.css";

export const servicePhrases=[
 {service:"Design",outcome:"provokes action",kind:"design"},
 {service:"Style",outcome:"pays attention to the details",kind:"style"},
 {service:"Experiences",outcome:"bring people closer",kind:"experiences"},
 {service:"Websites",outcome:"build trust",kind:"websites"},
 {service:"Strategy",outcome:"makes the next move clear",kind:"strategy"},
] as const;
// Client-approved wording supplied by Ocean from Jim's recorded testimonial.
const jimQuote="We had our website set up and Ocean did a beautiful job. He went beyond my expectation with what was delivered. We just got our first call and it's upwards of a 6 figure bid, I can't believe the results. Life-changing. Pat yourself on the back.";
function DetailType(){return <span className={styles.detailWord}>detail<span className={styles.adjustedLetter}>s<span className={styles.typeGuides} aria-hidden="true"><i/><b>↔</b><svg viewBox="0 0 24 24"><path d="M4 3v17l5-5 4 7 3-2-4-7h8Z"/></svg></span></span></span>;}
function DrawnAmpersand(){return <span className={styles.ampersand} role="img" aria-label="and"><svg viewBox="0 0 70 80" aria-hidden="true"><text x="35" y="66" textAnchor="middle" fontFamily="var(--font-royal),serif" fontStyle="normal" fontSize="76">&amp;</text></svg></span>;}
function CornerFlair(){
 const ref=useRef<HTMLSpanElement>(null);
 useEffect(()=>{const el=ref.current,heading=el?.closest('h2');if(!el||!heading)return;
  const measure=()=>{const ranges=[...heading.querySelectorAll<HTMLElement>('[data-phrase-ink]')].flatMap(node=>{const range=document.createRange();range.selectNodeContents(node);return [...range.getClientRects()];}).filter(r=>r.width>2&&r.height>2);if(!ranges.length)return;
   const box=heading.getBoundingClientRect(),top=Math.min(...ranges.map(r=>r.top)),firstLine=ranges.filter(r=>Math.abs(r.top-top)<8),left=Math.min(...firstLine.map(r=>r.left)),right=Math.max(...firstLine.map(r=>r.right));
   const font=getComputedStyle(heading),ctx=document.createElement('canvas').getContext('2d')!;ctx.font=`${font.fontWeight} ${font.fontSize} ${font.fontFamily}`;const metrics=ctx.measureText('Style');
   const inkInset=Math.max(0,(ranges[0].height-metrics.actualBoundingBoxAscent-metrics.actualBoundingBoxDescent)/2);
   el.style.setProperty('--flair-left',left-box.left+'px');el.style.setProperty('--flair-right',right-box.left+'px');el.style.setProperty('--flair-top',top-box.top+inkInset+'px');
   // Phone fans sit just inside the ink corners and fade before the edge.
   const mobileLeft=Math.max(32,left-8),mobileRight=Math.min(innerWidth-32,right+8);
   el.style.setProperty('--flair-mobile-top',top-box.top+inkInset+parseFloat(font.fontSize)*.42+'px');
   el.style.setProperty('--flair-mobile-left',mobileLeft-box.left+'px');
   el.style.setProperty('--flair-mobile-right',mobileRight-box.left+'px');
   el.style.setProperty('--flair-left-room',Math.max(0,Math.min(66,mobileLeft-20))+'px');
   el.style.setProperty('--flair-right-room',Math.max(0,Math.min(66,innerWidth-mobileRight-20))+'px');
  };const observer=new ResizeObserver(measure);observer.observe(heading);document.fonts.ready.then(measure);heading.addEventListener('animationend',measure);window.addEventListener('resize',measure);measure();return()=>{observer.disconnect();heading.removeEventListener('animationend',measure);window.removeEventListener('resize',measure);};
 },[]);
 return <span ref={ref} className={styles.finishFlair} data-sequence-end="true" aria-hidden="true">{Array.from({length:10},(_,n)=><i key={n} style={{'--n':n%5,'--side':n<5?-1:1} as React.CSSProperties}/>)}</span>;
}
function ChapterPhrase({phrase,active,onDesignComplete}:{phrase:typeof servicePhrases[number];active:boolean;onDesignComplete:()=>void}){
 if(phrase.kind==="strategy")return <StrategyPhrase className={styles.phrase} active={active}/>;
 if(phrase.kind==="design")return <DesignPhrase className={styles.phrase} active={active} onComplete={onDesignComplete}/>;
 return <h2 id={`${phrase.kind}-title`} className={`${styles.phrase} ${phrase.kind==='style'?styles.styleComposition:''}`} tabIndex={-1}><span className={styles.phraseLead} data-phrase-ink="">{phrase.service} that</span>{" "}{
  phrase.kind==="style"?<><span className={styles.dragHand} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 12V5a2 2 0 0 1 4 0v6-3a2 2 0 0 1 4 0v3-1a2 2 0 0 1 4 0v5c0 4-2 6-6 6h-2c-2 0-3-1-4-3l-4-5a2 2 0 0 1 3-2l1 1Z"/></svg></span><span className={styles.styleOutcome} data-phrase-ink="">pays a<span className={styles.joinedTs}>tt</span>ention to the <DetailType/></span><CornerFlair/></>:
  phrase.kind==="experiences"?<span className={styles.outcome}>bring <span className={styles.closingWords}><span>people</span><span>closer</span></span></span>:
  <span className={styles.outcome}>{phrase.outcome}</span>}</h2>;
}
function TrustAudience({active,onComplete}:{active:boolean;onComplete:()=>void}){const text='with followers, customers, partners, and investors';const {value,complete}=useHumanText(text,active,1860,.70,'audience');useEffect(()=>{if(active&&complete)onComplete();},[complete,active,onComplete]);return <p className={styles.trustAudience} data-audience="" aria-label={text}><span aria-hidden="true">{value}{active&&value.length>0&&!complete?<span className={styles.typeCaret}/>:null}</span></p>;}
function Testimonials(){
 const card=useRef<HTMLElement>(null),portrait=useRef<HTMLSpanElement>(null);
 useEffect(()=>{
  const figure=card.current,photo=portrait.current;if(!figure||!photo)return;
  // Measure the aperture from the actual portrait, including wrapped captions.
  const measure=()=>{const outer=figure.getBoundingClientRect(),inner=photo.getBoundingClientRect();figure.style.setProperty('--portrait-x',`${inner.left-outer.left-figure.clientLeft+inner.width/2}px`);figure.style.setProperty('--portrait-y',`${inner.top-outer.top-figure.clientTop+inner.height/2}px`);figure.style.setProperty('--portrait-radius',`${inner.width/2}px`);};
  const observer=new ResizeObserver(measure);observer.observe(figure);observer.observe(photo);measure();return()=>observer.disconnect();
 },[]);
 return <div className={`${styles.testimonials} ${styles.singleTestimonial}`}>
 <figure ref={card} className={styles.message} data-message="0"><blockquote>“{jimQuote}”</blockquote><figcaption><span ref={portrait} className={styles.jimPortrait}><Image src="/media/portraits/jim-masonry-color-corrections.png" alt="James Andres from Masonry Color Corrections" width={96} height={96} sizes="(max-width: 500px) 88px, 96px"/></span><a href="https://masonrycolorcorrections.com" target="_blank" rel="noopener noreferrer" aria-label="James Andres from Masonry Color Corrections — visit website (opens in a new tab)"><span><span className={styles.authorName}>James Andres</span><span className={styles.authorCompany}><span>from <span className={styles.authorCompanyName}>Masonry Color Corrections</span></span><TablerIcon name="arrow-up-right" size={22}/></span></span></a></figcaption></figure>
 </div>;
}
export function Capabilities({phase,arrived=true,onAdvance,previewProof,inquiryOpen=false,onNavigationReady,navigationEmerged=false}:{onNavigationReady?:()=>void;navigationEmerged?:boolean;phase:number;arrived?:boolean;onAdvance:(next:number,keyboard?:boolean)=>void;previewProof:boolean;inquiryOpen?:boolean}){
 const websites=useRef<HTMLElement>(null);const {playing}=useWaterMotion();
 const [finished,setFinished]=useState<number|null>(null),[read,setRead]=useState(false),[departing,setDeparting]=useState(false),[inquiryEntered,setInquiryEntered]=useState(inquiryOpen);const exitTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const strategyComplete=useCallback(()=>setFinished(5),[]);
 const designComplete=useCallback(()=>setFinished(1),[]),audienceComplete=useCallback(()=>setFinished(4),[]);
 const complete=(event:React.AnimationEvent<HTMLElement>)=>{if(inquiryOpen&&(event.target as HTMLElement).dataset.inquiryDeparture==="true")setInquiryEntered(true);if((event.target as HTMLElement).dataset.sequenceEnd==="true")setFinished(phase);};
 useEffect(()=>()=>clearTimeout(exitTimer.current),[]);

 useEffect(()=>{if(!inquiryOpen||playing)return;const frame=requestAnimationFrame(()=>setInquiryEntered(true));return()=>cancelAnimationFrame(frame);},[inquiryOpen,playing]);
 useEffect(()=>{if(phase!==2||!arrived)return;const timer=setTimeout(()=>onNavigationReady?.(),playing?2050:0);return()=>clearTimeout(timer);},[phase,playing,arrived,onNavigationReady]);
 useEffect(()=>{if(phase!==4||(playing&&finished!==4))return;const timer=setTimeout(()=>setRead(true),playing?1500:0);return()=>clearTimeout(timer);},[phase,playing,finished]);
 useEffect(()=>{
  const section=websites.current;if(!section||phase!==4||(playing&&finished!==4))return;const targets=section.querySelectorAll<HTMLElement>('[data-message]');
  if(!playing){targets.forEach(el=>{el.dataset.revealed='true';});return;}
  // Reserve a separate start time even when a tall viewport reveals several
  // cards in one observer delivery. Scrolling never restarts a revealed card.
  let nextStart=0;const timers:ReturnType<typeof setTimeout>[]=[];
  const observer=new IntersectionObserver(entries=>{
   entries.filter(entry=>entry.isIntersecting).sort((a,b)=>Number((a.target as HTMLElement).dataset.message)-Number((b.target as HTMLElement).dataset.message)).forEach(entry=>{
    const card=entry.target as HTMLElement;observer.unobserve(card);if(card.dataset.revealed==='true')return;
    const now=performance.now(),start=Math.max(now,nextStart);nextStart=start+480;
    timers.push(setTimeout(()=>{card.dataset.revealed='true';},start-now));
   });
  },{threshold:.16,rootMargin:'0px 0px -14% 0px'});targets.forEach(el=>observer.observe(el));return()=>{observer.disconnect();timers.forEach(clearTimeout);};
 },[phase,playing,finished]);
 const finishReading=(keyboard:boolean)=>{if(departing)return;setDeparting(true);window.dispatchEvent(new CustomEvent('madagin:surface-pulse',{detail:{x:.5,y:.6,strength:1.3,duration:1.8}}));exitTimer.current=setTimeout(()=>onAdvance(5,keyboard),playing?380:0);};
 return <>{servicePhrases.map((phrase,i)=>{
  if(phase!==i+1)return null;
  const active=phase===i+1,ready=active&&arrived&&(!playing||finished===phase)&&(phase!==2||navigationEmerged);
  return <section key={phrase.kind} ref={phrase.kind==='websites'?websites:undefined} id={`chapter-${phrase.kind}`} className={`${styles.scene} ${phrase.kind==='websites'?styles.trustScene:''}`} data-scene={phrase.kind} data-guided-panel={phrase.kind} data-arrived={active&&arrived} data-playing={playing} data-sequence-complete={ready} data-audience-ready={finished===4||!playing} data-departing={departing} data-inquiry={phrase.kind==='strategy'&&inquiryOpen} data-inquiry-entered={phrase.kind==='strategy'&&inquiryEntered} hidden={!active} inert={!active} aria-label={phrase.kind==='strategy'&&inquiryEntered?'Project inquiry':undefined} aria-labelledby={phrase.kind==='strategy'&&inquiryEntered?undefined:`${phrase.kind}-title`} onAnimationEnd={complete}>
   {!inquiryOpen?<div className={styles.phraseStack} data-inquiry-departure={phrase.kind==="strategy"} aria-hidden={phrase.kind==='strategy'&&inquiryEntered||undefined} inert={phrase.kind==='strategy'&&inquiryEntered}><div className={styles.phraseContents}>{phrase.kind==="strategy"?<SurfaceEmergence visible={active&&arrived} treatment="ripple" duration={1500} onComplete={strategyComplete}><ChapterPhrase phrase={phrase} active={active&&arrived} onDesignComplete={designComplete}/></SurfaceEmergence>:phrase.kind==="websites"?<SurfaceEmergence visible={active&&arrived} duration={1850}><ChapterPhrase phrase={phrase} active={active&&arrived} onDesignComplete={designComplete}/></SurfaceEmergence>:<ChapterPhrase phrase={phrase} active={active&&arrived} onDesignComplete={designComplete}/>}
    {phrase.kind==='experiences'?<p className={styles.identityLine}><span className={styles.identityBrand}>to your brand</span><DrawnAmpersand/><span className={styles.identityPeople} data-sequence-end="true">to each other</span></p>:null}
    {phrase.kind==='websites'?<TrustAudience active={active&&arrived} onComplete={audienceComplete}/>:null}
   </div></div>:null}
   {phrase.kind==='websites'?<><Testimonials/><div className={styles.singleReadingAdvance} data-reading-advance="" data-departing={departing}><button data-cursor-magnet="" data-cursor-orbit="true" className={styles.doneReading} data-ready={read} disabled={!read||departing} onClick={e=>finishReading(e.detail===0)}>Continue<TablerIcon name="arrow-right" size={24}/></button></div></>:null}
   {phrase.kind==='strategy'&&inquiryOpen?<div id="inquiry" className={styles.inlineInquiry} aria-label="Plan your project" onAnimationEnd={event=>{if(event.target===event.currentTarget)setInquiryEntered(true);}}><ContactJourney embedded preview={previewProof} active={inquiryEntered||!playing}/></div>:
    !(phrase.kind==='websites')?<div className={styles.next}>{phrase.kind==='strategy'?<PinkGlassLink href="#inquiry" visible={ready} onAction={keyboard=>{const scene=document.querySelector<HTMLElement>('[data-scene="strategy"]'),stack=scene?.querySelector<HTMLElement>('[data-inquiry-departure]');if(scene&&stack)scene.style.setProperty("--invitation-top",`${stack.getBoundingClientRect().top-scene.getBoundingClientRect().top}px`);onAdvance(6,keyboard);}}>Inquire</PinkGlassLink>:<LiquidControl href={`#chapter-${servicePhrases[i+1]?.kind}`} label={`Continue to ${servicePhrases[i+1]?.service}`} variant={phrase.kind==='design'?'wide':'chapter'} active={ready} onAction={keyboard=>onAdvance(i+2,keyboard)}/>}</div>:null}
  </section>;
 })}</>;
}
