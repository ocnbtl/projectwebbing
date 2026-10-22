"use client";
import {scrollToWaterTop} from "./water-viewport";
import {useCallback,useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from "react";
import Link from "next/link";
import {useRetainedNavigation} from "./navigation-session";
import {PublicFooter,PublicHeader} from "./public-chrome";
import type {LiquidRenderer} from "./water-letter-renderer";
import {useWaterMotion} from "./water-surface";
import {Capabilities} from "./home-sequences";
import {ConnectionPlayground} from "./connection-playground";
import {LiquidControl} from "./liquid-control";
import {SurfaceEmergence} from "./surface-emergence";
import {IntroWaterReveal} from "./intro-water-reveal";
import {BrandWordmark} from "./brand-wordmark";
import {useStoryScroll} from "./story-scroll";
import {submergeHomeForInquiry} from "./home-inquiry-exit";
import {TablerIcon} from "@/components/ui/tabler-icon";
import styles from "./public-home.module.css";

function LiquidWordmark({enabled,paused,onEmerged}:{enabled:boolean;paused:boolean;onEmerged:()=>void}) {
 const host=useRef<HTMLDivElement>(null),controller=useRef<LiquidRenderer|null>(null),pausedRef=useRef(paused);
 const onHover=useCallback(()=>{},[]);
 useEffect(()=>{pausedRef.current=paused;controller.current?.setPaused(paused);},[paused]);
 useEffect(()=>{
  const container=host.current;if(!container)return;
  const complete=()=>{container.dataset.emerged="true";onEmerged();};
  container.addEventListener("madagin:wordmark-emerged",complete);
  return()=>{container.removeEventListener("madagin:wordmark-emerged",complete);};
 },[onEmerged]);
 useEffect(()=>{
  const container=host.current;if(!container)return;
  const fallback=()=>{container.dataset.renderState="fallback";container.dataset.emerged="true";onEmerged();};
  const lowPower=!!navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=2;
  const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches||(navigator as Navigator&{connection?:{saveData?:boolean}}).connection?.saveData;
  if(lowPower||reduced){fallback();return;}
  // The server's motion snapshot is false. It is a loading state, not a failure.
  if(!enabled)return;
  container.dataset.renderState="pending";
  const abort=new AbortController();let disposed=false,renderer:LiquidRenderer|null=null;
  const timeout=setTimeout(()=>{abort.abort();fallback();},12000);
  import("./water-letter-renderer").then(module=>module.createLiquidRenderer(container,onHover,abort.signal)).then(created=>{
   clearTimeout(timeout);if(disposed||abort.signal.aborted){created.dispose();return;}
   renderer=created;controller.current=created;created.setPaused(pausedRef.current);container.dataset.renderState="ready";
  }).catch(()=>{clearTimeout(timeout);if(!disposed)fallback();});
  const lost=(event:Event)=>{event.preventDefault();renderer?.setPaused(true);fallback();};
  container.addEventListener("webglcontextlost",lost,true);
  return()=>{disposed=true;clearTimeout(timeout);abort.abort();container.removeEventListener("webglcontextlost",lost,true);renderer?.dispose();controller.current=null;};
 },[enabled,onHover,onEmerged]);
 return <div ref={host} className={styles.letterStage} data-liquid-stage="" data-render-state="pending" aria-hidden="true"><span className={styles.staticWordmark}><BrandWordmark/></span><noscript><span className={styles.noScriptWordmark}><BrandWordmark/></span></noscript></div>;
}
// A wrist-led wave with continuous turns and progressively smaller swings.
// Sampling one curve keeps the automatic greeting and every replay identical.
const greetingWaveFrames=Array.from({length:121},(_,index)=>{
 const t=index/120,ramp=Math.min(1,t/.12),settle=Math.max(0,(t-.66)/.34);
 // Ease the final third to rest with zero velocity and acceleration at its end.
 const release=1-settle*settle*settle*(settle*(settle*6-15)+10);
 const envelope=ramp*ramp*(3-2*ramp)*Math.pow(1-t,1.15)*release,swing=Math.sin(t*Math.PI*5);
 return {offset:t,transform:`translate3d(${.7*envelope*swing}px,${-envelope*swing*swing}px,0) rotate(${9+30*envelope*swing}deg)`};
});
function StudioIntroduction({visible,onSettling}:{visible:boolean;onSettling:()=>void}) {
 const {playing}=useWaterMotion();
 const hand=useRef<HTMLButtonElement>(null),waveAnimation=useRef<Animation|null>(null);
 const wave=useCallback(()=>{
  const icon=hand.current?.querySelector('svg');
  if(!playing||!icon||waveAnimation.current?.playState==='running')return;
  waveAnimation.current=icon.animate(greetingWaveFrames,{duration:2050,easing:'linear'});
 },[playing]);
 useEffect(()=>{
  if(!visible||!playing)return;
  const timer=setTimeout(wave,430);
  return()=>{clearTimeout(timer);waveAnimation.current?.cancel();};
 },[visible,playing,wave]);
 const [studioReady,setStudioReady]=useState(false),[studioFinished,setStudioFinished]=useState(false),[bodyReady,setBodyReady]=useState(false);
 useEffect(()=>{
  if(!visible||!studioFinished)return;
  const timer=setTimeout(()=>setBodyReady(true),playing?180:0);
  return()=>clearTimeout(timer);
 },[visible,studioFinished,playing]);
 useEffect(()=>{
  if(!visible||playing)return;
  const frame=requestAnimationFrame(()=>{setStudioReady(true);setBodyReady(true);});
  return()=>cancelAnimationFrame(frame);
 },[visible,playing]);
 return <div className={styles.introduction} data-studio-intro="" data-visible={visible}>
  <strong onAnimationEnd={event=>{if(event.target===event.currentTarget)setStudioReady(true);}}>Hi, we’re Madagin<button ref={hand} type="button" className={styles.greetingHand} aria-label="Wave hello" onPointerEnter={wave} onFocus={wave} onClick={wave}><TablerIcon name="hand-stop" size={25}/></button></strong>
  <div className={styles.studioLine} data-visible={visible&&studioReady} onAnimationEnd={event=>{if(event.target===event.currentTarget)setStudioFinished(true);}}>a design and development studio</div>
  <div className={styles.introductionBody} data-visible={visible&&bodyReady}>
   <IntroWaterReveal visible={visible&&bodyReady} onSettling={onSettling}>
    <p>Our aim is to bring a little more beauty &amp; character to the world. We combine strategy, design, and technology to create iconic brands &amp; websites that captivate, earn trust, and win business.</p>
   </IntroWaterReveal>
  </div>
 </div>;
}
const subscribeInitialDestination=()=>()=>{};
const inquiryDestination=()=>location.hash==="#inquiry"||document.documentElement.dataset.waterDestination==="inquiry";
const serverDestination=()=>false;
export function PublicHome({previewProof=false}:{previewProof?:boolean}) {
 const {motion,paused,playing}=useWaterMotion();
 const initialInquiry=useSyncExternalStore(subscribeInitialDestination,inquiryDestination,serverDestination);
 const [chosenPhase,setPhase]=useState<number|null>(null);
 const phase=chosenPhase??(initialInquiry?6:0);
 const [leaving,setLeaving]=useState(false),[entering,setEntering]=useState(false),[heroReady,setHeroReady]=useState(false);
 const [inquiryLeaving,setInquiryLeaving]=useState(false);
 const content=useRef<HTMLElement>(null),inquiryExit=useRef<Animation[]>([]);
 useLayoutEffect(()=>{inquiryExit.current.forEach(animation=>animation.cancel());inquiryExit.current=[];},[phase]);
 const retainedNavigation=useRetainedNavigation();
 const [navReady,setNavReady]=useState(false);
 const navigationVisible=retainedNavigation||navReady||phase>2;
 const [navEmerged,setNavEmerged]=useState(false);
 const navigationEmerged=useCallback(()=>setNavEmerged(true),[]);
 const navigationReady=useCallback(()=>setNavReady(true),[]);
 const emerged=useCallback(()=>setHeroReady(true),[]);
 const [arrowReady,setArrowReady]=useState(false);
 const [introReady,setIntroReady]=useState(false);
 // The landing arrow and header emerge together from the same intro cue.
 const introductionSettling=useCallback(()=>{setArrowReady(true);setNavReady(true);},[]);
 const landingFinished=useCallback(()=>{document.querySelector('[data-guided-panel="hero"]')?.setAttribute("data-landing-ready","true");window.dispatchEvent(new Event("madagin:landing-ready"));},[]);
 // Start the cursor after the wordmark, then hand off to the heading as its
 // dots join the rim. The fallback also covers touch and an absent pointer.
 useEffect(()=>{
  if(!heroReady)return;
  let scheduled=false;let introTimer:ReturnType<typeof setTimeout>|undefined;
  const settling=()=>{if(scheduled)return;scheduled=true;introTimer=setTimeout(()=>setIntroReady(true),playing?130:0);};
  window.addEventListener("madagin:cursor-settling",settling);
  landingFinished();
  const fine=matchMedia("(any-pointer: fine) and (any-hover: hover)").matches;
  const fallback=setTimeout(settling,playing?(fine?1100:220):0);
  return()=>{clearTimeout(fallback);clearTimeout(introTimer);window.removeEventListener("madagin:cursor-settling",settling);};
 },[heroReady,landingFinished,playing]);
 useEffect(()=>{if(phase!==0)landingFinished();},[phase,landingFinished]);
 const busy=useRef(false),initialHashRead=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const navigate=useCallback((next:number,keyboard=false)=>{
  if(busy.current)return;
  if(next===phase)return;
  busy.current=true;setLeaving(true);
  const submerge=next===6&&playing&&content.current;
  setInquiryLeaving(!!submerge);
  const arrive=()=>{
   scrollToWaterTop();setPhase(next);setLeaving(false);setInquiryLeaving(false);setEntering(playing&&next!==6);history.replaceState(history.state,"",`${location.pathname}${location.search}${next===6?"#inquiry":""}`);
   timer.current=setTimeout(()=>{setEntering(false);busy.current=false;
    if(keyboard){const target=document.querySelector<HTMLElement>(next===6?'#inquiry h2':'[data-guided-panel]:not([hidden]) h2,[data-guided-panel]:not([hidden]) h1');if(target){target.tabIndex=-1;target.focus({preventScroll:true});}}
   },playing?280:0);
  };
  if(submerge){
   const animations=submergeHomeForInquiry(submerge);inquiryExit.current=animations;
   void Promise.all(animations.map(animation=>animation.finished)).then(()=>{if(inquiryExit.current===animations)arrive();},()=>{});
  }else timer.current=setTimeout(arrive,playing?330:0);
 },[playing,phase]);
 useStoryScroll(phase,leaving||entering);
 useEffect(()=>()=>{clearTimeout(timer.current);inquiryExit.current.forEach(animation=>animation.cancel());inquiryExit.current=[];},[]);
 useLayoutEffect(()=>{if(initialInquiry&&chosenPhase===null){scrollToWaterTop();history.replaceState(history.state,"",`${location.pathname}${location.search}#inquiry`);}},[initialInquiry,chosenPhase]);
 useEffect(()=>{const check=()=>{if(location.hash==="#inquiry")navigate(6);};window.addEventListener("hashchange",check);const frame=requestAnimationFrame(()=>{if(initialHashRead.current)return;initialHashRead.current=true;check();});return()=>{cancelAnimationFrame(frame);window.removeEventListener("hashchange",check);};},[navigate]);
 return <div className={styles.site} data-playing={playing} data-leaving={leaving} data-inquiry-leaving={inquiryLeaving} data-entering={entering} data-phase={phase}>
  <a className="skip-link" href="#inquiry" onClick={event=>{event.preventDefault();navigate(6,true);}}>Skip to project form</a>
  <div className={styles.homeNav} data-visible={navigationVisible} data-retained={retainedNavigation} data-emerged={navEmerged||retainedNavigation} inert={!navigationVisible}><SurfaceEmergence visible={navigationVisible} skipAnimation={retainedNavigation} treatment="composited" duration={1450} intensity={1.45} onComplete={navigationEmerged}><PublicHeader tone="dark" home navigationVisible={navigationVisible} ctaVisible={navigationVisible} onInquiry={keyboard=>navigate(6,keyboard)} onHome={keyboard=>navigate(0,keyboard)}/></SurfaceEmergence></div>
  <ConnectionPlayground enabled={phase===3}/>
  <main ref={content} id="site-content" className={styles.content}>
   <section className={styles.hero} hidden={phase!==0} inert={phase!==0} data-guided-panel="hero" aria-labelledby="studio-name">
    <h1 id="studio-name" className={styles.srOnly}>Madagin. A founder-led web studio.</h1>
    {phase===0?<><LiquidWordmark enabled={motion} paused={paused} onEmerged={emerged}/>
    <StudioIntroduction visible={introReady} onSettling={introductionSettling}/></>:null}
    <div className={styles.heroArrow}><LiquidControl href="#chapter-design" label="Discover Design that provokes action" variant="hero" active={phase===0&&arrowReady&&!entering} onAction={keyboard=>navigate(1,keyboard)}/></div>
    <noscript><nav className={styles.noScriptNav}><Link href="/projects">Work</Link><Link href="/about">About</Link><Link href="/contact">Inquire</Link></nav></noscript>
   </section>
   <Capabilities key={phase>=5?"strategy":phase} phase={phase===6?5:phase} arrived onNavigationReady={navigationReady} navigationEmerged={navEmerged||retainedNavigation} onAdvance={navigate} previewProof={previewProof} inquiryOpen={phase===6}/>
  </main>
  {phase===6?<PublicFooter compact onReturn={keyboard=>navigate(0,keyboard)}/>:null}

 </div>;
}
