"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { budgetOptions, timingOptions, workNeedOptions } from "@/lib/inquiry-options";
import { MadaginMark } from "./public-chrome";
import styles from "./contact-journey.module.css";
type Answers={context:string;needs:string[];budget:string;timing:string;name:string;email:string;company:string};
const initial:Answers={context:"",needs:[],budget:"",timing:"",name:"",email:"",company:""};
const subscribe=()=>()=>{};
const client=()=>true,server=()=>false;
const chapters=["The idea","The shape","The people","Your outline"];

function Options({label,options,value,onChange}:{label:string;options:readonly string[];value:string|string[];onChange:(value:string)=>void}) {
  const selected=Array.isArray(value)?value:[value];
  return <fieldset className={styles.options}><legend>{label}</legend><div>{options.map(option=><button type="button" key={option} aria-pressed={selected.includes(option)} onClick={()=>onChange(option)}>{option}<span aria-hidden="true">{selected.includes(option)?"✓":"+"}</span></button>)}</div></fieldset>;
}
function outline(a:Answers) { return ["MADAGIN / AN IDEA TAKING SHAPE","Saved on this device. Not sent to Madagin.","",...Object.entries({"The idea":a.context,"The work":a.needs.join(", "),"Investment":a.budget||"To be discussed","Timing":a.timing||"Flexible","Name":a.name,"Email":a.email,"Company":a.company||"Not supplied"}).flatMap(([k,v])=>[k,v,""])].join("\n"); }
export function ContactJourney() {
  const ready=useSyncExternalStore(subscribe,client,server);
  const [answers,setAnswers]=useState<Answers>(initial);
  const [step,setStep]=useState(0),[status,setStatus]=useState(""),[error,setError]=useState("");
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{heading.current?.focus({preventScroll:true});window.scrollTo({top:0,behavior:"instant"});},[step]);
  function patch(part:Partial<Answers>){setAnswers(a=>({...a,...part}));setError("");}
  function next(){
    if(step===0&&answers.context.trim().length<12){setError("Give us a little more to work with. A sentence is plenty.");return;}
    if(step===1&&!answers.needs.length){setError("Choose at least one area, or select Not sure yet.");return;}
    if(step===2&&(!answers.name.trim()||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.email.trim()))){setError("Add your name and a valid email address to finish the outline.");return;}
    setError("");setStep(s=>Math.min(3,s+1));
  }
  function save(){
    const url=URL.createObjectURL(new Blob([outline(answers)],{type:"text/plain;charset=utf-8"}));
    const link=document.createElement("a");link.href=url;link.download="madagin-project-outline.txt";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    setStatus("Your outline was downloaded. It has not been sent to Madagin.");
  }
  async function copy(){try{await navigator.clipboard.writeText(outline(answers));setStatus("Outline copied. Nothing has been sent.");}catch{setStatus("Copy is unavailable. Download the outline instead.");}}
  return <main className={styles.journey}>
    <header className={styles.chrome}><Link href="/" aria-label="Madagin home"><MadaginMark/></Link><Link href="/">Back to the surface <span aria-hidden="true">↗</span></Link></header>
    <div className={styles.layout}>
      <aside className={styles.aside}><p>Bring an idea.</p><h2>It doesn’t need<br/>to be <em>finished.</em></h2><nav aria-label="Outline steps">{chapters.map((chapter,i)=><button key={chapter} type="button" disabled={i>step} onClick={()=>{setStep(i);setError("");}} aria-current={i===step?"step":undefined}><span aria-hidden="true">{String(i+1).padStart(2,"0")}</span>{chapter}</button>)}</nav><small>A private working outline. Direct inquiries aren’t open yet. Your answers stay on this page until you save them or leave.</small></aside>
      <form className={styles.form} onSubmit={e=>{e.preventDefault();if(step<3)next();}} noValidate>
        <section key={step} className={styles.panel} aria-labelledby="question-title">
          <span className={styles.chapterLabel}>{chapters[step]}</span>
          <h1 id="question-title" ref={heading} tabIndex={-1}>{["What’s on your mind?","What could this become?","Who’s behind the idea?","An idea, taking shape."][step]}</h1>
          {step===0?<><p className={styles.intro}>A new venture. A website that no longer fits. Something you haven’t quite found the words for.</p><label className={styles.longAnswer}><span>Tell us a little about it</span><textarea disabled={!ready} maxLength={6000} rows={6} value={answers.context} onChange={e=>patch({context:e.target.value})} placeholder="Here’s what I’m thinking…" aria-describedby={error?"form-error":undefined}/><small>{answers.context.length} / 6,000</small></label><noscript><p>Enable JavaScript to prepare an outline. You can still <Link href="/projects">explore the work</Link>.</p></noscript></>:null}
          {step===1?<><Options label="Where would you like a hand?" options={workNeedOptions} value={answers.needs} onChange={v=>patch({needs:answers.needs.includes(v)?answers.needs.filter(n=>n!==v):[...answers.needs,v]})}/><div className={styles.selects}><label>Investment <span>optional</span><select value={answers.budget} onChange={e=>patch({budget:e.target.value})}><option value="">Let’s work it out</option>{budgetOptions.map(v=><option key={v}>{v}</option>)}</select></label><label>Timing <span>optional</span><select value={answers.timing} onChange={e=>patch({timing:e.target.value})}><option value="">There’s room to explore</option>{timingOptions.map(v=><option key={v}>{v}</option>)}</select></label></div></>:null}
          {step===2?<><p className={styles.intro}>A few details to keep with your project outline.</p><div className={styles.fields}><label>Your name<input autoComplete="name" maxLength={120} value={answers.name} onChange={e=>patch({name:e.target.value})} required/></label><label>Email address<input autoComplete="email" type="email" inputMode="email" maxLength={254} value={answers.email} onChange={e=>patch({email:e.target.value})} required/></label><label>Company <span>optional</span><input autoComplete="organization" maxLength={120} value={answers.company} onChange={e=>patch({company:e.target.value})}/></label></div></>:null}
          {step===3?<><p className={styles.intro}>A useful starting point for the next conversation. Make it yours, then keep a copy.</p><div className={styles.review}>{[
            {label:"The idea",value:answers.context,to:0},{label:"The shape",value:answers.needs.join(" · ")+(answers.budget?" / "+answers.budget:"")+(answers.timing?" / "+answers.timing:""),to:1},{label:"The people",value:answers.name+" · "+answers.email+(answers.company?" · "+answers.company:""),to:2}
          ].map(item=><div key={item.label}><span>{item.label}</span><p>{item.value}</p><button type="button" onClick={()=>setStep(item.to)}>Edit<span className={styles.srOnly}> {item.label.toLowerCase()}</span></button></div>)}</div><button className={styles.primary} type="button" onClick={save}>Keep your outline <span aria-hidden="true">↓</span></button><button type="button" className={styles.copy} onClick={copy}>Copy as text</button><p className={styles.saveNote}>Downloads a text file. Nothing is submitted or sent.</p><p role="status" className={styles.status}>{status}</p></>:null}
          <p id="form-error" role="alert" className={styles.error}>{error}</p>
        </section>
        {step<3?<div className={styles.controls}><button type="button" disabled={step===0} onClick={()=>{setStep(s=>s-1);setError("");}}>Back</button><button className={styles.primary} disabled={!ready} type="submit">{step===2?"See your outline":"Continue"} <span aria-hidden="true">↗</span></button></div>:null}
      </form>
    </div>
  </main>;
}
