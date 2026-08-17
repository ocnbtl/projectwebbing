"use client";

import type { MotionValue } from "motion/react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ridgeImage from "../../../public/media/madagin-ridge-approach-v3.png";
import valleyImage from "../../../public/media/madagin-valley-reveal-v4.png";
import { MadaginMark, PublicFooter, PublicHeader } from "@/components/public/public-chrome";
import type { ContentItem } from "@/lib/content-types";
import { method, promise, standards } from "@/lib/brand";
import styles from "./public-home.module.css";

const letters = [..."MADAGIN"];
const valueWindows = [
  [0.3, 0.43],
  [0.45, 0.58],
  [0.6, 0.73],
  [0.75, 0.9],
] as const;

function DraggedLetter({ letter, index, progress, motionOff }: {
  letter: string;
  index: number;
  progress: MotionValue<number>;
  motionOff: boolean;
}) {
  const delay = index * 0.01;
  const scaleY = useTransform(progress, [0, 0.12 + delay, 0.2 + delay, 0.28 + delay], [1, 1, 2.5 - index * 0.03, 1]);
  const y = useTransform(progress, [0, 0.12 + delay, 0.2 + delay, 0.28 + delay], ["0vh", "0vh", "10vh", "-3vh"]);
  return <motion.span aria-hidden="true" className={styles.letter} style={motionOff ? undefined : { scaleY, y }}>{letter}</motion.span>;
}

function ValueScene({ name, question, index, progress, motionOff }: {
  name: string;
  question: string;
  index: number;
  progress: MotionValue<number>;
  motionOff: boolean;
}) {
  const [start, end] = valueWindows[index];
  const opacity = useTransform(progress, [start - 0.02, start, end - 0.03, end], [0, 1, 1, 0]);
  const y = useTransform(progress, [start - 0.04, start, end], [28, 0, -18]);
  return (
    <motion.article className={`${styles.valueScene} ${index % 2 ? styles.valueRight : styles.valueLeft}`} style={motionOff ? undefined : { opacity, y }}>
      <span className={styles.valueNumber}>0{index + 1}</span>
      <h2>{name}</h2>
      <p>{question}</p>
    </motion.article>
  );
}

function LandformIcon({ index }: { index: number }) {
  const paths = [
    "M0 48V35L12 25L23 31L38 8L53 27L63 20L80 38V48Z",
    "M0 48V31H18V20H34V6H49V25H64V16H80V48Z",
    "M0 48V36L18 36L28 23L42 23L52 9L64 9L80 26V48Z",
    "M0 48V39L17 32L35 34L48 15L62 27L80 22V48Z",
  ];
  return <svg className={styles.landformIcon} viewBox="0 0 80 48" aria-hidden="true"><path d={paths[index]} /></svg>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function ContentPreview({ item, route }: { item: ContentItem; route: "projects" | "blog" }) {
  return (
    <article className={styles.contentPreview}>
      {item.coverImageUrl ? (
        // Publishing accepts committed /media paths and public HTTPS images.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.coverImageUrl} alt="" loading="lazy" />
      ) : <div className={styles.contentLandform} aria-hidden="true" />}
      <div>
        <span>{item.details || formatDate(item.publishedOn)}</span>
        <h3>{item.title}</h3>
        <p>{item.summary}</p>
        <Link href={`/${route}/${item.slug}`}>Read {route === "projects" ? "the story" : "the note"}</Link>
      </div>
    </article>
  );
}

export function PublicHome({ projects, posts }: { projects: ContentItem[]; posts: ContentItem[] }) {
  const journeyRef = useRef<HTMLElement>(null);
  const filmRef = useRef<HTMLVideoElement>(null);
  const motionToggleUsed = useRef(false);
  const prefersReducedMotion = useReducedMotion();
  const [filmFailed, setFilmFailed] = useState(false);
  const [useLessMotion, setUseLessMotion] = useState(false);
  const motionOff = Boolean(prefersReducedMotion || useLessMotion);
  const heroFilm = process.env.NEXT_PUBLIC_MADAGIN_HERO_VIDEO || "/media/madagin-mountain-journey-v1.mp4";
  const { scrollYProgress } = useScroll({ target: journeyRef, offset: ["start start", "end end"] });
  const approachScale = useTransform(scrollYProgress, [0, 0.28], [1, 1.22]);
  const approachY = useTransform(scrollYProgress, [0, 0.28], ["0%", "-11%"]);
  const approachFilter = useTransform(scrollYProgress, [0, 0.12, 0.28, 1], ["opacity(1)", "opacity(1)", "opacity(0)", "opacity(0)"]);
  const valleyFilter = useTransform(scrollYProgress, [0, 0.18, 0.31, 1], ["opacity(0)", "opacity(0)", "opacity(1)", "opacity(1)"]);
  const valleyScale = useTransform(scrollYProgress, [0.2, 0.9], [1.18, 1.52]);
  const valleyY = useTransform(scrollYProgress, [0.2, 0.9], ["3%", "-10%"]);
  const wordFilter = useTransform(scrollYProgress, [0, 0.12, 0.27, 1], ["opacity(1)", "opacity(1)", "opacity(0)", "opacity(0)"]);
  const shadeFilter = useTransform(scrollYProgress, [0, 0.22, 0.38, 0.92, 1], ["opacity(0.2)", "opacity(0.2)", "opacity(0.04)", "opacity(0.22)", "opacity(0.22)"]);

  useEffect(() => {
    if (!motionToggleUsed.current) return;
    const root = document.documentElement;
    const previousBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    journeyRef.current?.scrollIntoView({ block: "start" });
    root.style.scrollBehavior = previousBehavior;
  }, [useLessMotion]);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const film = filmRef.current;
    if (!film || motionOff || !Number.isFinite(film.duration)) return;
    const filmProgress = Math.min(1, Math.max(0, (latest - 0.18) / 0.72));
    film.currentTime = film.duration * filmProgress;
  });

  return (
    <>
      <a className="skip-link" href="#site-content">Skip the mountain journey</a>
      <main>
        <section ref={journeyRef} className={`${styles.journey} ${motionOff ? styles.motionOff : ""}`} aria-labelledby="madagin-title">
          <div className={styles.stage}>
            <PublicHeader tone="dark" />
            <motion.div className={styles.approachPlate} style={motionOff ? undefined : { filter: approachFilter, scale: approachScale, y: approachY }}>
              <Image alt="" aria-hidden="true" fill priority sizes="100vw" src={ridgeImage} />
            </motion.div>
            <motion.div className={styles.valleyPlate} style={motionOff ? undefined : { filter: valleyFilter, scale: valleyScale, y: valleyY }}>
              <Image alt="" aria-hidden="true" fill priority sizes="100vw" src={valleyImage} />
              {heroFilm && !filmFailed ? (
                <video
                  aria-hidden="true"
                  className={styles.journeyFilm}
                  muted
                  onError={() => setFilmFailed(true)}
                  playsInline
                  poster={valleyImage.src}
                  preload="metadata"
                  ref={filmRef}
                  src={heroFilm}
                />
              ) : null}
            </motion.div>
            <motion.div className={styles.stageShade} style={motionOff ? undefined : { filter: shadeFilter }} />
            <h1 id="madagin-title" className={styles.srTitle}>Madagin</h1>
            <p className={styles.heroPromise}>{promise}</p>
            <motion.div className={styles.wordmark} role="img" aria-label="Madagin" style={motionOff ? undefined : { filter: wordFilter }}>
              {letters.map((letter, index) => <DraggedLetter index={index} key={`${letter}-${index}`} letter={letter} motionOff={motionOff} progress={scrollYProgress} />)}
            </motion.div>
            <div className={styles.valueStack} aria-label="The standards Madagin works toward">
              {standards.map((standard, index) => <ValueScene index={index} key={standard.name} motionOff={motionOff} name={standard.name} progress={scrollYProgress} question={standard.question} />)}
            </div>
            <button
              aria-pressed={useLessMotion}
              className={styles.motionControl}
              onClick={() => {
                motionToggleUsed.current = true;
                setUseLessMotion((current) => !current);
              }}
              type="button"
            >
              {useLessMotion ? "Use full motion" : "Use less motion"}
            </button>
            <div className={styles.scrollCue} aria-hidden="true"><span /> Scroll to cross the ridge</div>
          </div>
        </section>

        <div id="site-content" className={styles.editorial}>
          <section className={styles.promiseSection} aria-labelledby="promise-title">
            <h2 id="promise-title">{promise}</h2>
            <p>Strategy, design, and development for businesses ready to show up differently.</p>
          </section>

          <section className={styles.projectsSection} aria-labelledby="projects-title">
            <div className={styles.sectionHeading}><h2 id="projects-title">Selected projects</h2><Link href="/projects">All projects</Link></div>
            {projects.length ? (
              <div className={styles.contentList}>{projects.slice(0, 2).map((project) => <ContentPreview item={project} key={project.id} route="projects" />)}</div>
            ) : (
              <div className={styles.emptyWork}>
                <div aria-hidden="true" className={styles.emptyTerrain} />
                <div><h3>Sites people remember.</h3><p>The first project stories are being prepared. Nothing made up in the meantime.</p></div>
              </div>
            )}
          </section>

          <section className={styles.methodSection} aria-labelledby="method-title">
            <div className={styles.sectionHeading}><h2 id="method-title">Method</h2><span>01—04</span></div>
            <div className={styles.methodSequence}>
              {method.map((step, index) => (
                <article key={step.name}>
                  <div className={styles.methodTopline}><span>0{index + 1}</span><LandformIcon index={index} /></div>
                  <h3>{step.name}</h3><p>{step.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.journalSection} aria-labelledby="journal-title">
            <div className={styles.sectionHeading}><h2 id="journal-title">From the desk</h2><Link href="/blog">The blog</Link></div>
            {posts.length ? (
              <div className={styles.journalList}>{posts.slice(0, 3).map((post) => <article key={post.id}><span>{formatDate(post.publishedOn)}</span><h3><Link href={`/blog/${post.slug}`}>{post.title}</Link></h3><p>{post.summary}</p></article>)}</div>
            ) : (
              <div className={styles.journalEmpty}><span>Notes on perspective, websites, and the decisions behind them.</span><p>The first entries are still on the desk.</p></div>
            )}
          </section>

          <section className={styles.nameSection} aria-labelledby="name-title">
            <div className={styles.nameMark}><MadaginMark compact /></div>
            <h2 id="name-title">Madagin comes from <em>made again.</em></h2>
            <p>We rethink and rebuild how your business shows up online—so the site catches up to the work.</p>
          </section>

          <section className={styles.closing} id="contact" aria-labelledby="closing-title">
            <h2 id="closing-title">Let&apos;s talk.</h2>
            <div><p>If the business has moved forward and the site hasn&apos;t, that&apos;s a good place to start.</p><Link href="/contact">Start a conversation</Link></div>
          </section>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
