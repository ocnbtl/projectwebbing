"use client";
/* THESIS: Ideas become tangible through an unbroken water surface.
   OWN-WORLD: blue water, tall clear glass, pearl typography, precise liquid motion.
   STORY: thought, curiosity, character, direction, trust, connection; then real work.
   FIRST VIEWPORT: elongated optical MADAGIN, a quiet studio line, Work/About and an invitation.
   FORM: user-directed continuous narrative, six interactive chapters, image-led studies, closing signature. */
import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";
import { PublicFooter, PublicHeader } from "./public-chrome";
import type { ContentItem } from "@/lib/content-types";
import type { LiquidRenderer } from "./water-letter-renderer";
import { useWaterMotion } from "./water-surface";
import { Capabilities, ProjectDropdown } from "./home-sequences";
import styles from "./public-home.module.css";

function LiquidWordmark({ enabled, paused }: { enabled:boolean; paused:boolean }) {
  const host=useRef<HTMLDivElement>(null);
  const controller=useRef<LiquidRenderer|null>(null);
  const pausedRef=useRef(paused);
  const onHover=useCallback(()=>{},[]);
  useEffect(()=>{pausedRef.current=paused;controller.current?.setPaused(paused);},[paused]);
  useEffect(()=>{
    if(!enabled || !host.current || (navigator.hardwareConcurrency && navigator.hardwareConcurrency<=2))return;
    const container=host.current, abort=new AbortController();
    let disposed=false, renderer:LiquidRenderer|null=null;
    import("./water-letter-renderer").then(module=>module.createLiquidRenderer(container,onHover,abort.signal)).then(created=>{
      if(disposed){created.dispose();return;} renderer=created;controller.current=created;created.setPaused(pausedRef.current);
    }).catch(()=>{container.dataset.ready="false";});
    const lost=(event:Event)=>{event.preventDefault();renderer?.setPaused(true);container.dataset.ready="false";};
    container.addEventListener("webglcontextlost",lost,true);
    return()=>{disposed=true;abort.abort();renderer?.dispose();controller.current=null;container.removeEventListener("webglcontextlost",lost,true);};
  },[enabled,onHover]);
  return <div ref={host} className={styles.letterStage} data-liquid-stage="" aria-hidden="true"><span className={styles.staticWordmark}>MADAGIN</span></div>;
}
export function PublicHome({projects}:{projects:ContentItem[];posts:ContentItem[]}) {
  const {motion,paused,playing}=useWaterMotion();
  return <div className={styles.site} data-playing={playing}>
    <a className="skip-link" href="#site-content">Skip to content</a>
    <PublicHeader tone="dark"/>
    <main id="site-content">
      <section className={styles.hero} aria-labelledby="studio-name">
        <h1 id="studio-name" className={styles.srOnly}>Madagin. A founder-led web studio.</h1>
        <LiquidWordmark enabled={motion} paused={paused}/>
        <div className={styles.heroFoot}><p>Websites with<br/><em>a point of view.</em></p><span>Strategy. Design. Development.<br/>From first thought to final detail.</span><a href="#possibilities" aria-label="Explore the story"><span aria-hidden="true">↓</span></a></div>
      </section>
      <Capabilities/>
      <section className={styles.work} id="work" aria-labelledby="work-title">
        <div className={styles.workIntro}><span>Thought into form.</span><h2 id="work-title">The work<br/><em>speaks.</em></h2><p>Different businesses.<br/>Their own way of showing up.</p></div>
        <div className={styles.projectList}>{projects.map((project,index)=><ProjectDropdown project={project} index={index} key={project.id}/>)}</div>
        <Link className={styles.allWork} href="/projects">More about the work <span aria-hidden="true">↗</span></Link>
      </section>
      <section className={styles.studio} aria-labelledby="studio-title">
        <div className={styles.studioOpening}><span>A close collaboration.</span><h2 id="studio-title">Every decision<br/><em>belongs together.</em></h2><p>Strategy, words, design, and development in one conversation. So what you mean and what people experience stay connected.</p></div>
        <div className={styles.method}>
          <div><span className={styles.methodOrb} aria-hidden="true"/><h3>Understand.</h3><p>We get close to the business, the people it serves, and the change you want to make.</p></div>
          <div><span className={styles.methodOrb} aria-hidden="true"/><h3>Explore.</h3><p>We find a visual direction through words, references, and ideas you can respond to.</p></div>
          <div><span className={styles.methodOrb} aria-hidden="true"/><h3>Make.</h3><p>We design, build, and refine the details in the browser, where your website will live.</p></div>
        </div>
        <Link className={styles.studioLink} href="/about">A little more about Madagin <span aria-hidden="true">↗</span></Link>
      </section>
    </main>
    <PublicFooter/>
  </div>;
}
