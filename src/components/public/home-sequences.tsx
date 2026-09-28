"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useWaterMotion } from "./water-surface";
import { ConnectionPlayground } from "./connection-playground";
import type { ContentItem } from "@/lib/content-types";
import styles from "./public-home.module.css";
import story from "./home-story.module.css";

export const servicePhrases = [
  { service:"Ideas", outcome:"inspire action", note:"A question worth asking. A direction worth pursuing." },
  { service:"Design", outcome:"rewards curiosity", note:"The more you explore, the more there is to discover." },
  { service:"Style", outcome:"earns attention", note:"A recognisable point of view, down to the smallest detail." },
  { service:"Strategy", outcome:"connects dots", note:"What you do, who it is for, and why it matters. Brought into focus." },
  { service:"Websites", outcome:"build trust", note:"Clear words. Thoughtful decisions. A path that feels natural." },
  { service:"Experiences", outcome:"spark connection", note:"An encounter becomes something shared." },
];

function Demonstration({ index }: { index:number }) {
  const [active, setActive] = useState(false);
  const [style, setStyle] = useState(0);
  const [step, setStep] = useState(0);
  if (index === 0) return <div className={story.idea} data-spark={active}><button type="button" onClick={() => setActive(v => !v)} aria-pressed={active}>{active ? "In motion." : "What if?"}</button><small>Tap an idea. See where it goes.</small></div>;
  if (index === 1) return <div className={story.curiosity} onPointerMove={e => { const b=e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty("--x", `${e.clientX-b.left}px`); e.currentTarget.style.setProperty("--y", `${e.clientY-b.top}px`); }} tabIndex={0} onKeyDown={e => { if(e.key==="Enter" || e.key===" ") { e.preventDefault(); setActive(v=>!v); } }} role="button" aria-label="Reveal a different perspective" onClick={()=>setActive(v=>!v)} style={active ? { "--x":"65%", "--y":"35%" } as React.CSSProperties : undefined}><p>Look a little closer.</p><div className={story.reveal}><strong>Oh.</strong></div><small>Move, tap, or press Enter to discover.</small></div>;
  if (index === 2) return <div className={story.styleDemo}><span className={story.styleSample} data-style={style}>Aa.</span><div className={story.swatches}>{["Composed","Expressive","Fluid"].map((label,i)=><button key={label} type="button" aria-label={label} aria-pressed={style===i} onClick={()=>setStyle(i)}>{i===style ? "✓" : ""}</button>)}</div></div>;
  if (index === 3) return <div className={story.dots} data-connected={active}><svg viewBox="0 0 420 240" aria-label="Purpose, audience, and direction connected"><line x1="65" y1="150" x2="200" y2="65" /><line x1="200" y1="65" x2="350" y2="155" /><circle cx="65" cy="150" r="6"/><circle cx="200" cy="65" r="6"/><circle cx="350" cy="155" r="6"/><text x="65" y="184" textAnchor="middle">Purpose</text><text x="200" y="42" textAnchor="middle">Audience</text><text x="350" y="189" textAnchor="middle">Direction</text></svg><button type="button" onClick={()=>setActive(v=>!v)} aria-pressed={active}>{active ? "See it differently ↺" : "Connect the dots ↗"}</button></div>;
  if (index === 4) return <div className={story.browser}><div className={story.browserBar}>A little clarity goes a long way.</div><div className={story.browserBody}><p>{["Make yourself understood.","Make the next step clear.","Make it feel effortless."][step]}</p><span>{["Start with what someone needs to know.","Give each decision a reason.","Good design keeps its promises."][step]}</span><button type="button" onClick={()=>setStep(v=>(v+1)%3)}>{["Find your way","Take the next step","Begin again"][step]} <span aria-hidden="true">↗</span></button></div></div>;
  return <ConnectionPlayground />;
}

export function Capabilities() {
  const section = useRef<HTMLElement>(null);
  const { playing, paused, motion, toggle } = useWaterMotion();
  const [index, setIndex] = useState(0);
  const manual = useRef(false);
  useEffect(() => {
    if (!motion || !section.current) return;
    const element=section.current;
    let frame=0;
    const update=()=>{ frame=0; if(manual.current) return; const b=element.getBoundingClientRect(); const p=Math.max(0,Math.min(.999,-b.top/Math.max(1,element.offsetHeight-innerHeight))); setIndex(Math.floor(p*6)); };
    const scroll=()=>{manual.current=false;if(!frame)frame=requestAnimationFrame(update);};
    window.addEventListener("scroll",scroll,{passive:true}); update();
    return()=>{window.removeEventListener("scroll",scroll);cancelAnimationFrame(frame);};
  },[motion]);
  const phrase=servicePhrases[index];
  return <section ref={section} id="possibilities" className={story.story} data-playing={playing} aria-label="From an idea to a connection">
    <div className={story.stage}>
      <div className={story.topline}><span>From a thought to something felt.</span><button className={story.motion} type="button" disabled={!motion} onClick={toggle} aria-pressed={paused || !motion} aria-label={playing ? "Pause motion" : "Resume motion"}>{playing ? "Ⅱ" : "▷"}</button></div>
      <div className={story.chapter} data-story-index={index}>
        <div className={story.copy} key={phrase.service}><h2>{phrase.service} that <em>{phrase.outcome}.</em></h2><p>{phrase.note}</p></div>
        <div className={story.demo} key={index}><Demonstration index={index}/></div>
      </div>
      <nav className={story.chapterNav} aria-label="Explore the story">{servicePhrases.map((p,i)=><button key={p.service} type="button" aria-current={i===index ? "step" : undefined} onClick={()=>{
        manual.current=true;setIndex(i);
        const element=section.current;
        if(motion&&element)window.scrollTo({top:scrollY+element.getBoundingClientRect().top+Math.max(0,element.offsetHeight-innerHeight)*(i+.15)/6,behavior:"instant"});
      }}>{p.service}</button>)}</nav>
    </div>
  </section>;
}

export function ProjectDropdown({ project, index }: { project:ContentItem; index:number }) {
  const [open,setOpen]=useState(false);
  const panelId=`project-${project.id}`;
  return <article className={styles.project} data-open={open} data-submerge="">
    <Link className={styles.projectImage} href={`/projects/${project.slug}`} aria-label={`Explore ${project.title}`}>
      {project.coverImageUrl ? <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={project.coverImageUrl} alt={`${project.title} website`} width={1440} height={900} loading="lazy"/>
      </> : <span>{project.title}</span>}
      <span className={styles.imageArrow} aria-hidden="true">↗</span>
    </Link>
    <div className={styles.projectMeta}><span>Selected study / {String(index+1).padStart(2,"0")}</span><span>{project.details}</span></div>
    <h3><button className={styles.projectToggle} type="button" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-controls={panelId}><span>{project.title}</span><span className={styles.projectPlus} aria-hidden="true">+</span></button></h3>
    <div className={styles.projectDisclosure} id={panelId} inert={!open} aria-hidden={!open}><div className={styles.projectInside}><p>{project.summary}</p><Link href={`/projects/${project.slug}`}>Inside the project <span aria-hidden="true">↗</span></Link></div></div>
  </article>;
}
