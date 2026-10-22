"use client";
import {useEffect,useRef} from "react";
import {useWaterMotion} from "./water-surface";
import styles from "./design-phrase.module.css";

const ease=(value:number)=>{const t=Math.max(0,Math.min(1,value));return t*t*t*(t*(t*6-15)+10);};
// Type the approved sentence once, without a deliberate typo or correction.
// Resize and visibility changes never retype a letter.
const typing=(()=>{
 const frames:{time:number;text:string}[]=[{time:0,text:""}];let time=270,text="";
 const type=(letters:string)=>{for(const letter of letters){time+=letter===" "?54:43+[0,12,-7,5,17,-4,8][text.length%7];text+=letter;frames.push({time,text});}};
 type("Design that provokes action");return frames;
})();
const TYPE_END=typing.at(-1)!.time,CURL_START=TYPE_END+200,CURL_DURATION=1350,FINISH=CURL_START+CURL_DURATION;

export function DesignPhrase({className,active,onComplete}:{className:string;active:boolean;onComplete:()=>void}){
 const heading=useRef<HTMLHeadingElement>(null),words=useRef<HTMLSpanElement>(null),action=useRef<HTMLSpanElement>(null),typed=useRef<HTMLSpanElement>(null),canvas=useRef<HTMLCanvasElement>(null),elapsedRef=useRef(0);
 const {playing}=useWaterMotion();
 useEffect(()=>{
  const title=heading.current,line=words.current,text=action.current,ink=typed.current,surface=canvas.current,section=title?.closest("section"),button=section?.querySelector<HTMLElement>('[data-variant="wide"]');
  if(!active||!title||!line||!text||!ink||!surface||!section||!button||!playing)return;
  let disposed=false,frame=0,previous=0,visible=!document.hidden,announced=false,lastText="";
  let renderer:ReturnType<typeof import("./action-curl-renderer").createActionCurl>|undefined;
  let observer:ResizeObserver|undefined;
  const paint=()=>{
   const elapsed=elapsedRef.current;
   const current=typing.findLast(step=>step.time<=elapsed)!.text;
   if(current!==lastText){
    // Match the reserved word spans exactly, including their spacing, so
    // finishing the typing cannot move the sentence before the curl begins.
    ink.replaceChildren(...current.split(' ').flatMap((word,index)=>{
     const span=document.createElement('span');span.style.display='inline-block';span.textContent=word;
     return index?[document.createTextNode(' '),span]:[span];
    }));lastText=current;
   }
   title.dataset.typing=String(elapsed<TYPE_END);title.dataset.typedText=current;
   const curl=ease((elapsed-CURL_START)/CURL_DURATION);
   renderer?.draw(curl);surface.dataset.curl=curl.toFixed(3);surface.dataset.elapsed=String(Math.round(elapsed));
   title.dataset.curled=String(elapsed>=CURL_START);
   if(elapsed>=CURL_START+300&&!announced){announced=true;onComplete();}
  };
  const tick=(now:number)=>{
   frame=0;if(disposed||!visible)return;
   if(previous)elapsedRef.current+=Math.min(now-previous,64);previous=now;paint();
   if(elapsedRef.current<FINISH)frame=requestAnimationFrame(tick);
  };
  const visibility=()=>{visible=!document.hidden;cancelAnimationFrame(frame);frame=0;previous=0;if(visible&&renderer&&elapsedRef.current<FINISH)frame=requestAnimationFrame(tick);};
  const fallback=()=>{title.dataset.curled="false";title.dataset.typing="false";title.dataset.prepared="true";surface.dataset.ready="false";cancelAnimationFrame(frame);elapsedRef.current=FINISH;onComplete();};
  const lost=(event:Event)=>{event.preventDefault();if(!disposed)fallback();};
  title.dataset.prepared="false";title.dataset.typing="true";
  Promise.all([import("./action-curl-renderer"),document.fonts.ready]).then(([module])=>{
   if(disposed)return;
   renderer=module.createActionCurl(surface);
   const measure=()=>{
    line.style.transform="none";title.style.fontSize='';
    if(!line.offsetWidth||!title.offsetWidth)return;
    if(line.offsetWidth>title.offsetWidth-12)title.style.fontSize=`${parseFloat(getComputedStyle(title).fontSize)*(title.offsetWidth-12)/line.offsetWidth}px`;
    const bounds=title.getBoundingClientRect(),source=text.getBoundingClientRect(),rimInset=Number(button.dataset.magnetInset)||7,arc=module.actionArc(source);
    section.style.setProperty('--design-button-width',module.getActionButtonWidth(bounds,source,button.getBoundingClientRect(),0,rimInset)+'px');
    button.style.left='0px';button.style.top='0px';
    let hitArea=button.getBoundingClientRect();
    const destinationY=source.top+source.height/2+arc.y;
    button.style.top=`${destinationY-hitArea.top-hitArea.height/2+7}px`;hitArea=button.getBoundingClientRect();
    const target=new DOMRect(hitArea.left+rimInset,hitArea.top+rimInset,hitArea.width-rimInset*2,hitArea.height-rimInset*2),font=getComputedStyle(text);
    const height=Math.max(hitArea.bottom,source.bottom+arc.y)-bounds.top+24;surface.style.height=String(height)+'px';
    renderer!.resize({area:new DOMRect(bounds.left,bounds.top,bounds.width,height),source,target,font:font.fontWeight+' '+font.fontSize+' '+font.fontFamily,color:font.color,size:parseFloat(font.fontSize),spacing:font.letterSpacing});paint();
   };
   measure();surface.dataset.ready="true";title.dataset.prepared="true";
   observer=new ResizeObserver(measure);observer.observe(title);observer.observe(line);observer.observe(button);
   paint();if(elapsedRef.current<FINISH&&visible)frame=requestAnimationFrame(tick);
  }).catch(()=>{if(!disposed)fallback();});
  document.addEventListener("visibilitychange",visibility);surface.addEventListener("webglcontextlost",lost);
  return()=>{disposed=true;cancelAnimationFrame(frame);observer?.disconnect();document.removeEventListener("visibilitychange",visibility);surface.removeEventListener("webglcontextlost",lost);renderer?.dispose();surface.dataset.ready="false";title.dataset.curled="false";title.dataset.typing="false";title.dataset.prepared="true";};
 },[active,playing,onComplete]);
 return <h2 ref={heading} id="design-title" className={className+' '+styles.heading} tabIndex={-1} aria-label="Design that provokes action" data-design-active={active&&playing}>
  <span ref={words} aria-hidden="true" className={styles.words}><span className={styles.reserved}><span data-design-word="">Design</span>{" "}<span data-design-word="">that</span>{" "}<span data-design-word="">provokes</span>{" "}<span ref={action} data-design-word="" className={styles.action}>action</span></span><span className={styles.typed}><span ref={typed}/><i className={styles.caret}/></span></span>
  <canvas ref={canvas} className={styles.lettering} data-action-curl="" data-ready="false" aria-hidden="true"/>
 </h2>;
}
