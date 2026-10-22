"use client";
import Link from "next/link";
import { startTransition, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {budgetOptions} from "@/lib/inquiry-options";
import { projectOptions as stages, goalOptions as aims, projectServices, inquiryBrief, type InquiryAnswers as Answers } from "@/lib/inquiry-form";
import { submitInquiry } from "@/app/contact/actions";
import { TablerIcon, type TablerIconName } from "@/components/ui/tabler-icon";
import { MadaginMark } from "./public-chrome";
import {useWaterMotion} from "./water-surface";
import {TypedError,useHumanText} from "./human-type";
import {ChoiceEdge} from "./choice-edge";
import {BalsaButtonFill} from "./balsa-button-fill";
import {InquiryCompletion} from "./inquiry-completion";
import {SurfaceEmergence} from "./surface-emergence";
import {InquiryIcon} from "./inquiry-icon";
import styles from "./contact-journey.module.css";

const initial:Answers = { stage:[], aim:[], other:"", otherService:"", needs:[], timing:"", budget:"", name:"", email:"", context:"" };
const stageIcons:TablerIconName[] = ["browser-plus", "palette", "zoom-scan", "code", "compass", "writing"];
const aimIcons:TablerIconName[] = ["messages", "shopping-cart", "brush", "users", "world", "check", "bolt", "tool", "wallet", "layout-dashboard", "help-circle", "writing"];
function QuestionInk({text,onComplete,smile=false,active=true,revisit=false}:{text:string;onComplete:()=>void;smile?:boolean;active?:boolean;revisit?:boolean}){
 const {value,complete}=useHumanText(text,active,revisit?50:70,revisit?.49:.65,'question');
 const row=useRef<HTMLSpanElement>(null),firstBaseline=useRef<HTMLSpanElement>(null),lastBaseline=useRef<HTMLSpanElement>(null);
 useLayoutEffect(()=>{
  const element=row.current;
  if(!smile||!element)return;
  const context=document.createElement('canvas').getContext('2d');
  if(!context)return;
  let disposed=false;
  const align=()=>{
   if(disposed||!firstBaseline.current||!lastBaseline.current)return;
   const font=getComputedStyle(element);
   context.font=`${font.fontStyle} ${font.fontWeight} ${font.fontSize} ${font.fontFamily}`;
   const ink=context.measureText(text),bounds=element.getBoundingClientRect();
   // Flex centers line boxes, not the visible letters. Use the loaded font's
   // ink bounds and real DOM baselines, including when the title wraps.
   const inkCenter=(firstBaseline.current.getBoundingClientRect().top-ink.actualBoundingBoxAscent+lastBaseline.current.getBoundingClientRect().top+ink.actualBoundingBoxDescent)/2;
   element.style.setProperty('--smile-ink-offset',`${inkCenter-bounds.top-bounds.height/2}px`);
  };
  align();
  const observer=new ResizeObserver(align);observer.observe(element);
  void document.fonts.ready.then(align);
  document.fonts.addEventListener('loadingdone',align);
  return()=>{disposed=true;observer.disconnect();document.fonts.removeEventListener('loadingdone',align);};
 },[smile,text]);
 useEffect(()=>{if(active&&complete)onComplete();},[active,complete,onComplete]);
 return <span ref={row} data-question-text="" data-with-smile={smile} aria-hidden="true">{smile?<span className={styles.questionPrompt}><span className={styles.questionMeasure}><span ref={firstBaseline} className={styles.questionBaseline}/>{text}<span ref={lastBaseline} className={styles.questionBaseline}/></span><span data-question-ink="">{value}</span></span>:value}{smile?<span className={styles.questionSmile} data-question-smile="" data-eyes-ready={active&&complete} data-mouth-ready={active&&complete}><svg viewBox="0 0.225 32 30"><circle className={styles.smileEye} cx="10" cy="8" r="1.6"/><circle className={styles.smileEye} cx="22" cy="8" r="1.6"/><path className={styles.smileMouth} d="M6 15 C7 26 25 26 26 15" pathLength="1"/></svg></span>:null}</span>;
}
function CustomGoal({active,value,onChange,onToggle,edge,icon="writing",prompt="Describe your goal"}:{active:boolean;value:string;onChange:(value:string)=>void;onToggle:()=>void;edge:ReactNode;icon?:TablerIconName;prompt?:string}) {
 const input=useRef<HTMLTextAreaElement>(null),trigger=useRef<HTMLButtonElement>(null),wasActive=useRef(active),labelId=useId();
 useEffect(()=>{if(active)input.current?.focus({preventScroll:true});else if(wasActive.current)trigger.current?.focus({preventScroll:true});wasActive.current=active;},[active]);
 return <div className={styles.customSlot}><div className={`${styles.choice} ${styles.customChoice}`} data-selected={active}>
  {edge}
  <span className={styles.customIdentity}><InquiryIcon name={icon} selected={active}/><span id={labelId}>In your own words</span></span>
  <button ref={trigger} type="button" className={styles.customTrigger} aria-labelledby={labelId} aria-expanded={active} aria-pressed={active} inert={active} aria-hidden={active} onClick={onToggle}/>
  <div className={styles.customEditor} inert={!active} aria-hidden={!active}><textarea ref={input} rows={2} aria-labelledby={labelId} value={value} maxLength={500} onChange={event=>onChange(event.target.value)} placeholder={prompt}/><button type="button" aria-label="Remove custom answer" onClick={onToggle}><TablerIcon name="plus" size={17}/></button></div>
 </div></div>;
}
function Choices({label,options,icons,value,onChange,layout="tiles",custom,descriptions}:{label:string;options:readonly string[];icons?:readonly TablerIconName[];value:string|string[];onChange:(value:string)=>void;layout?:"tiles"|"services"|"budget"|"timeline";custom?:{value:string;onChange:(text:string)=>void;prompt?:string};descriptions?:Record<string,string>}) {
 const selected=Array.isArray(value)?value:[value],id=useId().replaceAll(":","");const {playing}=useWaterMotion();
 const field=useRef<HTMLFieldSetElement>(null),pending=useRef(new Map<HTMLElement,HTMLButtonElement>());
 useEffect(()=>{const el=field.current;if(!el)return;const queued=pending.current;
  const settled=(event:Event)=>{const host=event.target as HTMLElement,button=queued.get(host);queued.delete(host);if(button?.isConnected&&!button.disabled&&!button.closest('[inert]'))button.click();};
  el.addEventListener('madagin:choice-settled',settled);return()=>{el.removeEventListener('madagin:choice-settled',settled);queued.clear();};
 },[]);
 // One persistent SVG owns the base edge, dark fill and rainbow edge. The
 // selected group shares a single feathered mask in both directions, including
 // rapid reversals. Its rects use CSS pixels, so corners never stretch a stroke.
 const edge=(index:number,active:boolean)=><ChoiceEdge id={`${id}-${index}`} active={active} playing={playing}/>;
 return <fieldset ref={field} className={styles.choices} data-layout={layout} data-even={options.length%2===0} data-playing={playing} aria-describedby={Array.isArray(value)?"inquiry-selection-hint":undefined} onClickCapture={event=>{
  const button=(event.target as Element).closest<HTMLButtonElement>('button'),host=button?.closest<HTMLElement>('[data-choice-animating="true"]');
  if(host&&button){event.preventDefault();event.stopPropagation();if(!pending.current.has(host))pending.current.set(host,button);}
 }}><legend className={styles.srOnly}>{label}</legend><div>{options.map((option,index)=>{
  const active=selected.includes(option);
  if(option==="Something else"&&custom)return <CustomGoal key={option} active={active} value={custom.value} onChange={custom.onChange} onToggle={()=>onChange(option)} edge={edge(index,active)} icon={icons?.[index]} prompt={custom.prompt}/>;
  return <button type="button" className={styles.choice} key={option} data-choice={index} data-selected={active} aria-pressed={active} onClick={()=>onChange(option)}>{edge(index,active)}{icons?<InquiryIcon name={icons[index]} selected={active}/>:null}<span>{option}{descriptions?.[option]?<small className={styles.choiceDescription}>{descriptions[option]}</small>:null}</span></button>;
 })}</div></fieldset>;
}
export function ContactJourney({embedded=false,preview=false,active=true}:{embedded?:boolean;preview?:boolean;active?:boolean}) {
 const id=useId(),[answers,setAnswers]=useState<Answers>(initial),[step,setStep]=useState(0),[error,setError]=useState(""),[attempted,setAttempted]=useState(false),[status,setStatus]=useState("");
 const heading=useRef<HTMLHeadingElement>(null),lastStep=useRef(step),panel=useRef<HTMLElement>(null),stepBusy=useRef(false);
 const visited=useRef(new Set([0]));const [revisit,setRevisit]=useState(false);
 const [changing,setChanging]=useState(false),[questionReady,setQuestionReady]=useState(false),[controlsReady,setControlsReady]=useState(false);
 const body=useRef<HTMLFieldSetElement>(null),departure=useRef<Animation|null>(null),controlsTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const clickPoint=useRef<{x:number;y:number}|null>(null);
 const details=useRef<HTMLTextAreaElement>(null),form=useRef<HTMLFormElement>(null),busy=useRef(false);
 const [sending,setSending]=useState(false),[completion,setCompletion]=useState<"accepted"|"preview"|null>(null);
 const {playing}=useWaterMotion();
 const questionComplete=useCallback(()=>setQuestionReady(true),[]);
 const optionsComplete=useCallback(()=>{clearTimeout(controlsTimer.current);controlsTimer.current=setTimeout(()=>setControlsReady(true),playing?(revisit?60:140):0);},[playing,revisit]);
 useEffect(()=>()=>{clearTimeout(controlsTimer.current);departure.current?.cancel();},[]);
 useLayoutEffect(()=>{departure.current?.cancel();departure.current=null;},[step]);
 const [buttonHovered,setButtonHovered]=useState(false);
 const Wrapper=embedded?"div":"main",Heading=embedded?"h2":"h1";
 useEffect(()=>{const consumeNote=()=>{try{const note=sessionStorage.getItem('madagin-inquiry-note');if(note){setAnswers(a=>({...a,context:[a.context,`What’s on my mind: ${note}`].filter(Boolean).join('\n\n').slice(0,3000)}));sessionStorage.removeItem('madagin-inquiry-note');}}catch{}};const frame=requestAnimationFrame(consumeNote);window.addEventListener('madagin:inquiry-note',consumeNote);return()=>{cancelAnimationFrame(frame);window.removeEventListener('madagin:inquiry-note',consumeNote);};},[]);
 useEffect(()=>{
  const element=form.current,button=element?.querySelector("button[type=submit]");if(!element||!button)return;
  let inView=false;
  const sync=()=>{element.dataset.controlVisible=String(inView&&!document.hidden);};
  const observer=new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;sync();});
  observer.observe(button);sync();document.addEventListener("visibilitychange",sync);
  return()=>{observer.disconnect();document.removeEventListener("visibilitychange",sync);};
 },[completion]);
 useEffect(()=>{
  if(lastStep.current===step)return;lastStep.current=step;
  const title=heading.current;if(!title)return;title.focus({preventScroll:true});
  if(!embedded){title.scrollIntoView({block:"center",behavior:"instant"});return;}
  // A longer answer grid may have been scrolled. Bring the next question back
  // below the navigation while the previous panel is submerged.
  const top=title.getBoundingClientRect().top,anchor=innerWidth<=800?Math.max(112,innerHeight*.15):Math.min(240,Math.max(150,innerHeight*.24));
  if(Math.abs(top-anchor)>2)window.scrollBy({top:top-anchor,behavior:"instant"});
 },[step,embedded]);
 useLayoutEffect(()=>{
  const field=details.current;if(!field)return;
  const resize=()=>{field.style.height="auto";field.style.height=`${field.scrollHeight+2}px`;};
  resize();window.addEventListener("resize",resize);return()=>window.removeEventListener("resize",resize);
 },[answers.context,step,completion]);
 function patch(part:Partial<Answers>){setAnswers(a=>({...a,...part}));setError("");}
 function toggle(key:"stage"|"aim",value:string){const old=answers[key],undecided=key==="aim"?"Not sure yet":null;const selected=old.includes(value)?old.filter(v=>v!==value):value===undecided?[value]:[...old.filter(v=>v!==undecided),value];patch({[key]:selected,...(key==="stage"?{needs:[...new Set(selected.flatMap(v=>projectServices[v]||[]))]}:{})});}
 async function moveStep(nextStep:number){
  if(stepBusy.current)return;const returning=visited.current.has(nextStep);stepBusy.current=true;setChanging(true);setError("");clearTimeout(controlsTimer.current);
  const control=form.current?.querySelector('button[type="submit"]')?.getBoundingClientRect();
  if(playing){const point=clickPoint.current??{x:control?control.left+control.width/2:innerWidth/2,y:control?control.top+control.height/2:innerHeight*.7};window.dispatchEvent(new CustomEvent('madagin:surface-pulse',{detail:{x:point.x/innerWidth,y:point.y/innerHeight,strength:.6,duration:1.35}}));}
  clickPoint.current=null;
  if(playing&&body.current){departure.current=body.current.animate([{opacity:1,filter:"blur(0)"},{opacity:.35,filter:"blur(5px)",offset:.5},{opacity:0,filter:"blur(13px)"}],{duration:returning?180:400,easing:"cubic-bezier(.4,0,.6,1)",fill:"forwards"});await departure.current.finished.catch(()=>{});}
  setControlsReady(false);
  setQuestionReady(false);
  visited.current.add(nextStep);setRevisit(returning);setStep(nextStep);
  stepBusy.current=false;setChanging(false);
 }
 function next(rehearsal=false){
  if(busy.current||stepBusy.current)return;
  const messages=[!answers.stage.length&&"Choose what you need, or select Find the right direction.",!answers.aim.length&&"Choose a goal, or select Not sure yet.",!answers.budget&&"Choose a budget range, or select Not sure yet."];
  if(step<3){if(messages[step]){setError(String(messages[step]));return;}void moveStep(step+1);return;}
  if(!answers.name.trim()){setError("Enter your name.");return;}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.email)){setError("Enter a valid email address, such as you@company.com.");return;}
  if(!answers.context.trim()){setError("Tell us about your business and the project you have in mind.");return;}
  setError("");busy.current=true;setSending(true);
  startTransition(async()=>{
   try {
    const result=rehearsal&&preview?{status:"preview"}:await submitInquiry({...answers,contactCheck:(form.current?.elements.namedItem('contactCheck') as HTMLInputElement|null)?.value??''});
    if(result.status==="accepted"||result.status==="preview"){
     if(playing&&form.current){
      const exit=form.current.animate([{opacity:1,filter:"blur(0)",transform:"translateY(0)"},{opacity:0,filter:"blur(12px)",transform:"translateY(24px)"}],{duration:650,easing:"cubic-bezier(.5,0,.75,.45)",fill:"forwards"});
      await exit.finished.catch(()=>{});
     }
     setCompletion(result.status);
    }else{
     setAttempted(true);setError(result.status==='limited'?"Please wait a few minutes before trying again. Your answers are still here.":result.status==="disabled"||result.status==="unverified"?"Your inquiry hasn’t been sent. Sending is temporarily unavailable. Save a copy to keep your answers, or try again later.":"Your inquiry couldn’t be sent. Your answers are still here. Try again, or save a copy below.");
    }
   }catch{setAttempted(true);setError("The connection was interrupted. Your answers are still here. Try again, or save a copy below.");}
   finally{busy.current=false;setSending(false);}
  });
 }
 function save(){const url=URL.createObjectURL(new Blob([inquiryBrief(answers,true)],{type:"text/plain;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download="madagin-inquiry.txt";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus("Your inquiry was saved to your device. It has not been sent.");}
 const titles=["What can we help you with?","What would you like to achieve?","What budget do you have in mind?","Tell us more about your project"];
 return <Wrapper className={styles.journey} data-embedded={embedded} data-playing={playing}>
  {!embedded?<header className={styles.chrome}><Link href="/" aria-label="Madagin home"><MadaginMark/></Link><Link href="/" aria-label="Return home"><TablerIcon name="arrow-up-right" size={28}/></Link></header>:null}
  <div className={styles.layout} data-complete={!!completion}>{!embedded&&!completion?<aside className={styles.aside}><p>Let’s talk.</p><h2>Your ambition.{" "}<br/><em>Our next conversation.</em></h2></aside>:null}
   {completion?<InquiryCompletion email={answers.email} preview={completion==="preview"} onReturn={()=>{setCompletion(null);requestAnimationFrame(()=>heading.current?.focus({preventScroll:true}));}}/>:<form ref={form} className={styles.form} aria-busy={sending||changing} data-sending={sending} onSubmit={event=>{event.preventDefault();next();}} noValidate>
    <div hidden aria-hidden="true"><label>Leave this empty<input name="contactCheck" tabIndex={-1} autoComplete="off"/></label></div>
    <fieldset ref={body} className={styles.formBody} disabled={sending||changing||!questionReady}>
    <section ref={panel} key={step} className={styles.panel} data-question-ready={questionReady} data-form-step={step} aria-labelledby={`${id}-question`}>
     <Heading id={`${id}-question`} ref={heading} tabIndex={-1} aria-label={titles[step]}><QuestionInk text={titles[step]} active={active} revisit={revisit} smile={step===3} onComplete={questionComplete}/></Heading>
     {step<2?<p id="inquiry-selection-hint" className={styles.selectionHint}>Choose one or more.</p>:null}
     <SurfaceEmergence visible={questionReady} duration={revisit?350:1150} onComplete={optionsComplete}>
     {step===0?<Choices label="Where we can help, choose any that apply" layout="services" options={stages} icons={stageIcons} value={answers.stage} onChange={value=>toggle("stage",value)} custom={{value:answers.otherService??"",onChange:otherService=>patch({otherService}),prompt:"What would you like help with?"}}/>:null}
     {step===1?<Choices label="Your goals, choose any that apply" options={aims} icons={aimIcons} value={answers.aim} onChange={value=>toggle("aim",value)} custom={{value:answers.other,onChange:other=>patch({other})}}/>:null}
     {step===2?<Choices label="Project budget range in US dollars" layout="budget" options={budgetOptions} value={answers.budget} onChange={budget=>patch({budget})}/>:null}
     {step===3?<div className={styles.fields}>
      <label>Your name<input name="name" required autoComplete="name" maxLength={120} placeholder="First and last name" value={answers.name} onChange={e=>patch({name:e.target.value})}/></label>
      <label>Email address<input name="email" required type="email" autoComplete="email" maxLength={254} placeholder="you@company.com" value={answers.email} onChange={e=>patch({email:e.target.value})}/></label>
      <label>Details<textarea ref={details} name="details" required rows={3} maxLength={3000} value={answers.context} onChange={e=>patch({context:e.target.value})} placeholder="What's the project? What are you building or changing?"/></label>
     </div>:null}
     </SurfaceEmergence>
     <p className={styles.error}><TypedError key={error} text={error}/></p>
     {attempted&&step===3?<><button type="button" className={styles.saveCopy} onClick={save}><TablerIcon name="download" size={18}/>Save your inquiry</button><p role="status">{status}</p></>:null}
    </section>
    <SurfaceEmergence key={`controls-${step}`} visible={controlsReady} duration={revisit?300:850}><div className={styles.controls} data-question-ready={controlsReady} data-final={step===3} inert={!controlsReady} aria-hidden={!controlsReady}>{step>0?<button className={styles.back} type="button" onClick={()=>void moveStep(step-1)}><TablerIcon name="arrow-left" size={18}/>Back</button>:null}<button className={styles.primary} disabled={!controlsReady} data-cursor-magnet="" type="submit" onPointerDown={event=>{clickPoint.current={x:event.clientX,y:event.clientY};}} onPointerEnter={()=>setButtonHovered(true)} onPointerLeave={()=>setButtonHovered(false)} onFocus={()=>setButtonHovered(true)} onBlur={()=>setButtonHovered(false)}><BalsaButtonFill className={styles.buttonWater} active={buttonHovered||sending} variant="white"/><span>{sending?"Sending…":step===3?"Send inquiry":"Advance"}</span><TablerIcon name={step===3?"arrow-up-right":"arrow-right"} size={21}/></button></div></SurfaceEmergence>
    {preview&&step===3?<button type="button" className={styles.previewButton} onClick={()=>next(true)}>Preview confirmation <span>No inquiry will be sent</span></button>:null}
    </fieldset>
   </form>}
  </div>
 </Wrapper>;
}


