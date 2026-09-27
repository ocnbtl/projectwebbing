"use client";

/* THESIS: Madagin's craft is visible in a single material wordmark and actual work.
   OWN-WORLD: cool white, charcoal, rounded milk glass, spare navigation, large type.
   STORY: recognize a web studio, inspect two real projects, prepare a useful brief.
   FIRST VIEWPORT: masthead, full-width sculpture, small offer, fold-crossing descriptor.
   FORM: user-pinned liquid specimen; composition A with C's cursor reveal. */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type RefObject } from "react";
import { PublicFooter, PublicHeader } from "./public-chrome";
import type { ContentItem } from "@/lib/content-types";
import type { LiquidRenderer } from "./liquid-renderer";
import styles from "./public-home.module.css";

type Connection = EventTarget & { saveData?: boolean };
function subscribeMotion(callback: () => void) {
  const query = matchMedia("(prefers-reduced-motion: reduce)");
  const connection = (navigator as Navigator & { connection?: Connection }).connection;
  query.addEventListener("change", callback);
  connection?.addEventListener("change", callback);
  return () => { query.removeEventListener("change", callback); connection?.removeEventListener("change", callback); };
}
function motionAvailable() {
  return !matchMedia("(prefers-reduced-motion: reduce)").matches && !(navigator as Navigator & { connection?: Connection }).connection?.saveData;
}
const serverMotion = () => false;

function useVisibleTicker(ref: RefObject<HTMLElement | null>, count: number, duration: number, playing: boolean) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!playing || !ref.current || count < 2) return;
    let visible = false;
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    observer.observe(ref.current);
    const timer = window.setInterval(() => {
      if (visible && !document.hidden) setIndex(current => (current + 1) % count);
    }, duration);
    return () => { observer.disconnect(); window.clearInterval(timer); };
  }, [ref, count, duration, playing]);
  return index;
}

function LiquidWordmark({ enabled, paused, onHover }: { enabled: boolean; paused: boolean; onHover: (index: number | null) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<LiquidRenderer | null>(null);
  const pausedRef = useRef(paused);
  useEffect(() => { pausedRef.current = paused; controller.current?.setPaused(paused); }, [paused]);
  useEffect(() => {
    if (!enabled || !host.current || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2)) return;
    const container = host.current;
    const abort = new AbortController();
    let disposed = false;
    let renderer: LiquidRenderer | null = null;
    import("./liquid-renderer").then(module => module.createLiquidRenderer(container, onHover, abort.signal)).then(created => {
      if (disposed) { created.dispose(); return; }
      renderer = created; controller.current = created; created.setPaused(pausedRef.current);
    }).catch(() => { container.dataset.ready = "false"; });
    const contextLost = (event: Event) => { event.preventDefault(); renderer?.setPaused(true); container.dataset.ready = "false"; onHover(null); };
    container.addEventListener("webglcontextlost", contextLost, true);
    return () => {
      disposed = true; abort.abort(); renderer?.dispose(); controller.current = null;
      container.removeEventListener("webglcontextlost", contextLost, true);
    };
  }, [enabled, onHover]);
  return <a className={styles.wordmarkLink} href="#work" aria-label="Madagin. Explore selected work">
    <div ref={host} className={styles.letterStage} data-liquid-stage="">
      <span className={styles.staticWordmark} aria-hidden="true">MADAGIN</span>
    </div>
  </a>;
}

function PortfolioCursor({ projects, letter, enabled, root }: { projects: ContentItem[]; letter: number | null; enabled: boolean; root: RefObject<HTMLDivElement | null> }) {
  const cursor = useRef<HTMLDivElement>(null);
  const lastPoint = useRef({ x: 0, y: 0 });
  const [cut, setCut] = useState(0);
  const preview = letter !== null && projects.length > 0;
  useEffect(() => {
    if (!cursor.current) return;
    // Raycasting can open a preview after the mouse has stopped moving.
    const { x, y } = lastPoint.current;
    const px = preview ? Math.max(148, Math.min(innerWidth - 148, x)) : x;
    const py = preview ? Math.max(105.5, Math.min(innerHeight - 105.5, y)) : y;
    cursor.current.style.transform = `translate3d(${px}px,${py}px,0) translate(-50%,-50%)`;
  }, [preview]);
  useEffect(() => {
    if (!preview || !enabled) return;
    const timer = window.setInterval(() => { if (!document.hidden) setCut(value => value + 1); }, 1800);
    return () => window.clearInterval(timer);
  }, [preview, enabled]);
  useEffect(() => {
    const pointerQuery = matchMedia("(hover: hover) and (pointer: fine)");
    if (!enabled || !pointerQuery.matches || !root.current) return;
    const element = cursor.current;
    const surface = root.current;
    if (!element) return;
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      lastPoint.current = { x: event.clientX, y: event.clientY };
      const target = event.target as HTMLElement;
      const input = target.closest("input,textarea,select,[contenteditable=true]");
      element.dataset.visible = input ? "false" : "true";
      element.dataset.link = target.closest("a,button") ? "true" : "false";
      // The enlarged window stays in the viewport; the small pointer stays exact.
      const width = element.dataset.preview === "true" ? 280 : 24;
      const height = element.dataset.preview === "true" ? 195 : 24;
      const x = width > 24 ? Math.max(width / 2 + 8, Math.min(innerWidth - width / 2 - 8, event.clientX)) : event.clientX;
      const y = height > 24 ? Math.max(height / 2 + 8, Math.min(innerHeight - height / 2 - 8, event.clientY)) : event.clientY;
      element.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
      surface.dataset.customCursor = input ? "false" : "true";
    };
    const hide = () => { element.dataset.visible = "false"; surface.dataset.customCursor = "false"; };
    const keyboard = (event: KeyboardEvent) => { if (event.key === "Tab" || event.key === "Escape") hide(); };
    surface.addEventListener("pointermove", move);
    surface.addEventListener("pointerleave", hide);
    window.addEventListener("blur", hide);
    window.addEventListener("keydown", keyboard);
    return () => { surface.removeEventListener("pointermove", move); surface.removeEventListener("pointerleave", hide); window.removeEventListener("blur", hide); window.removeEventListener("keydown", keyboard); hide(); };
  }, [enabled, root]);
  const project = projects[cut % Math.max(projects.length, 1)];
  return <div ref={cursor} className={styles.cursor} data-preview={preview && enabled} aria-hidden="true">
    {project?.coverImageUrl ? <div className={styles.cursorMedia}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={project.coverImageUrl} alt="" width={280} height={165} loading="lazy" />
      <span>{project.title}<span>↗</span></span>
    </div> : null}
  </div>;
}

const descriptors = ["the excellent", "the superb", "the iconic"];
const verbs = ["express", "reveal", "shape"];
const nouns = ["ideas", "character", "ambition"];

function Capabilities({ playing }: { playing: boolean }) {
  const section = useRef<HTMLElement>(null);
  const verb = useVisibleTicker(section, verbs.length, 3400, playing);
  const noun = useVisibleTicker(section, nouns.length, 4900, playing);
  return <section ref={section} className={styles.capabilities} aria-labelledby="capability-title" data-playing={playing}>
    <div className={styles.glassSurface} aria-hidden="true">
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <defs><filter id="liquid-light" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency=".006 .011" numOctaves="2" seed="8" result="height" />
          <feGaussianBlur in="height" stdDeviation="3" result="softHeight" />
          <feSpecularLighting in="softHeight" surfaceScale="26" specularConstant="1.7" specularExponent="22" lightingColor="#ffffff" result="light"><feDistantLight azimuth="-35" elevation="48" /></feSpecularLighting>
          <feComposite in="light" in2="light" operator="arithmetic" k1="0" k2="1" k3="0" k4="0" />
        </filter></defs>
        <rect x="-100" y="-100" width="1640" height="1100" filter="url(#liquid-light)" />
      </svg>
    </div>
    <div className={styles.capabilityIntro}><p>Built around your business.</p><p>Strategy, design, development.<br />One considered whole.</p></div>
    <h2 id="capability-title">
      <span>Websites that</span>
      <span className={styles.srOnly}>express ideas, reveal character, and shape ambition.</span>
      <span className={styles.wordColumns} aria-hidden="true">
        <span className={styles.wordColumn}><span key={verb}>{verbs[verb]}</span><span className={styles.columnArrow}>⌄</span></span>
        <span className={styles.wordColumn}><span key={noun}>{nouns[noun]}</span><span className={styles.columnArrow}>⌄</span></span>
      </span>
    </h2>
    <div className={styles.capabilityBottom}><p>Make the complicated clear. Give the work a point of view. Make the next step feel natural.</p><Link href="/about">How we work <span aria-hidden="true">↗</span></Link></div>
  </section>;
}

export function PublicHome({ projects, posts }: { projects: ContentItem[]; posts: ContentItem[] }) {
  const root = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLElement>(null);
  const motion = useSyncExternalStore(subscribeMotion, motionAvailable, serverMotion);
  const [paused, setPaused] = useState(false);
  const [letter, setLetter] = useState<number | null>(null);
  const onHover = useCallback((value: number | null) => setLetter(value), []);
  const playing = motion && !paused;
  const descriptor = useVisibleTicker(hero, descriptors.length, 4200, playing);
  return <div ref={root} className={styles.site} data-playing={playing}>
    <a className="skip-link" href="#site-content">Skip to content</a>
    <PublicHeader tone="light" />
    <main id="site-content">
      <section ref={hero} className={styles.hero} aria-labelledby="studio-name">
        <h1 id="studio-name" className={styles.srOnly}>Madagin. A founder-led web studio.</h1>
        <div className={styles.heroTopline}><span>Independent web design & development</span><span>Considered from the first idea.</span></div>
        <LiquidWordmark enabled={motion} paused={paused} onHover={onHover} />
        <div className={styles.heroUnder}><p>A website that catches up<br />to your business.</p><a href="#work">Explore the work <span aria-hidden="true">↓</span></a>
          <button className={styles.motionControl} type="button" disabled={!motion} onClick={() => setPaused(value => !value)} aria-pressed={paused || !motion} aria-label={!motion ? "Animation unavailable in still view" : paused ? "Play animation" : "Pause animation"}>
            <span aria-hidden="true">{paused || !motion ? "▷" : "Ⅱ"}</span><span>{motion ? paused ? "Play motion" : "Pause motion" : "Still view"}</span>
          </button>
        </div>
        <div className={styles.descriptor} aria-hidden="true"><span key={descriptor} className={styles[`descriptor${descriptor}`]}>{descriptors[descriptor]}</span></div>
        <p className={styles.srOnly}>Thoughtful websites, made to be remembered.</p>
      </section>
      <section className={styles.work} id="work" aria-labelledby="work-title">
        <div className={styles.workIntro}><h2 id="work-title">Good work.<br />A better way to show it.</h2><div><p>For the creative practice with more to say. The specialist whose work needs to be seen. Websites shaped around the people behind them.</p><Link href="/projects">Selected work <span aria-hidden="true">↗</span></Link></div></div>
        <div className={styles.projectGrid}>
          {projects.slice(0, 2).map((project, index) => <article className={styles.project} key={project.id} style={{ "--project-offset": index } as CSSProperties}>
            <Link className={styles.projectImage} href={`/projects/${project.slug}`} aria-label={`View ${project.title}`}>
              {project.coverImageUrl ? <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={project.coverImageUrl} alt={`${project.title} website`} width={1440} height={900} loading="lazy" />
              </> : <span className={styles.projectPlaceholder}>{project.title}</span>}
              <span className={styles.projectOpen} aria-hidden="true">↗</span>
            </Link>
            <div className={styles.projectCaption}><h3><Link href={`/projects/${project.slug}`}>{project.title}</Link></h3><p>{project.details}</p></div>
            <p className={styles.projectSummary}>{project.summary}</p>
          </article>)}
        </div>
      </section>
      <Capabilities playing={playing} />
      <section className={styles.studio} aria-labelledby="studio-title">
        <div className={styles.studioTitle}><span>The studio</span><h2 id="studio-title">One conversation.<br />All the way through.</h2></div>
        <div className={styles.studioCopy}><p>Madagin brings strategy, design, and development together. The decisions stay connected, from what your website needs to say to how it feels in someone’s hand.</p><p>We begin with the business you have now. Then build a website that belongs to it.</p><Link href="/about">Meet Madagin <span aria-hidden="true">↗</span></Link></div>
        <div className={styles.method}>
          <div><h3>Find the point.</h3><p>The audience, the offer, and what the current site leaves unsaid.</p></div>
          <div><h3>Give it form.</h3><p>Words, type, images, and interactions with a clear purpose.</p></div>
          <div><h3>Make it work.</h3><p>A responsive build, considered details, and a clear path to launch.</p></div>
        </div>
      </section>
      {posts[0] ? <section className={styles.note} aria-label="From the studio"><span>From the studio</span><Link href={`/blog/${posts[0].slug}`}><h2>{posts[0].title}</h2><span aria-hidden="true">↗</span></Link><p>{posts[0].summary}</p></section> : null}
      <section className={styles.closing} aria-labelledby="closing-title"><span>Made again. Made for you.</span><h2 id="closing-title">What’s next<br />for your website?</h2><div><p>Start with what has changed.<br />Put your first thoughts into a project brief.</p><Link href="/contact">Start your brief <span aria-hidden="true">↗</span></Link></div></section>
    </main>
    <PublicFooter />
    <PortfolioCursor projects={projects} letter={letter} enabled={playing} root={root} />
  </div>;
}
