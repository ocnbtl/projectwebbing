"use client";

import type { MotionValue } from "motion/react";
import { motion, useMotionValue, useTransform } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { MadaginMark, PublicFooter, PublicHeader } from "@/components/public/public-chrome";
import { PublicWorldLoader } from "@/components/public/public-world-loader";
import type { ContentItem } from "@/lib/content-types";
import { method, promise, standards } from "@/lib/brand";
import type { WorldViewId } from "@/lib/world-manifest";
import styles from "./public-home.module.css";

const letters = [..."MADAGIN"];
const valueWindows = [
  [0.3, 0.43],
  [0.45, 0.58],
  [0.6, 0.73],
  [0.75, 0.9],
] as const;

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
const guidedJourneyDurationMs = 36_000;
const oceanHoldDurationMs = 5_000;
const skyHoldDurationMs = 5_000;

type JourneyPlaybackState = "waiting" | "playing" | "paused" | "complete";

type PublicJourneyTelemetry = {
  elapsedMs: number;
  progress: number;
  state: JourneyPlaybackState;
  view: WorldViewId;
};

function subscribeToReducedMotion(onChange: () => void) {
  const mediaQuery = window.matchMedia(reducedMotionQuery);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

function getReducedMotionPreference() {
  return window.matchMedia(reducedMotionQuery).matches;
}

function getServerReducedMotionPreference() {
  return false;
}

function useHydrationSafeReducedMotion() {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionPreference,
    getServerReducedMotionPreference,
  );
}

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
  const motionToggleUsed = useRef(false);
  const elapsedJourneyMs = useRef(0);
  const activeViewRef = useRef<WorldViewId>("journey");
  const pointerStart = useRef<{ id: number; x: number; y: number } | null>(null);
  const prefersReducedMotion = useHydrationSafeReducedMotion();
  const [useLessMotion, setUseLessMotion] = useState(false);
  const [worldReady, setWorldReady] = useState(false);
  const [activeView, setActiveView] = useState<WorldViewId>("journey");
  const [playbackState, setPlaybackState] = useState<JourneyPlaybackState>("waiting");
  const motionOff = Boolean(prefersReducedMotion || useLessMotion);
  const worldProgress = useMotionValue(0);
  const wordFilter = useTransform(worldProgress, [0, 0.08, 0.2, 1], ["opacity(1)", "opacity(1)", "opacity(0)", "opacity(0)"]);
  const shadeFilter = useTransform(worldProgress, [0, 0.05, 0.28, 0.92, 1], ["opacity(0.2)", "opacity(0.2)", "opacity(0.04)", "opacity(0.22)", "opacity(0.22)"]);

  const publishJourneyTelemetry = useCallback((progress: number, state: JourneyPlaybackState, view: WorldViewId) => {
    const detail: PublicJourneyTelemetry = {
      elapsedMs: Math.round(elapsedJourneyMs.current),
      progress: Math.round(progress * 10_000) / 10_000,
      state,
      view,
    };
    const host = window as Window & { __MADAGIN_PUBLIC_JOURNEY__?: PublicJourneyTelemetry };
    host.__MADAGIN_PUBLIC_JOURNEY__ = detail;
    document.documentElement.dataset.madaginJourneyProgress = detail.progress.toFixed(4);
    document.documentElement.dataset.madaginJourneyState = state;
    document.documentElement.dataset.madaginJourneyView = view;
  }, []);

  const selectView = useCallback((view: WorldViewId) => {
    activeViewRef.current = view;
    setActiveView(view);
  }, []);

  const pauseJourney = useCallback(() => {
    setPlaybackState((current) => current === "complete" ? current : "paused");
  }, []);

  const replayJourney = useCallback(() => {
    elapsedJourneyMs.current = 0;
    worldProgress.set(0);
    selectView("journey");
    setPlaybackState(worldReady ? "playing" : "waiting");
  }, [selectView, worldProgress, worldReady]);

  const resumeJourney = useCallback(() => {
    if (playbackState === "complete") {
      replayJourney();
      return;
    }
    selectView("journey");
    setPlaybackState(worldReady ? "playing" : "waiting");
  }, [playbackState, replayJourney, selectView, worldReady]);

  const openGuidedView = useCallback((view: "about" | "projects") => {
    pauseJourney();
    selectView(view);
  }, [pauseJourney, selectView]);

  const handleWorldReady = useCallback(() => {
    setWorldReady(true);
    setPlaybackState((current) => current === "waiting" ? "playing" : current);
  }, []);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("a, button")) return;
    pointerStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }, []);

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || start.id !== event.pointerId || (event.target as HTMLElement).closest("a, button")) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 48 && Math.abs(deltaY) < 48) return;
    if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX < 0) openGuidedView("about");
    if (Math.abs(deltaY) >= Math.abs(deltaX) && deltaY < 0) openGuidedView("projects");
  }, [openGuidedView]);

  useEffect(() => {
    publishJourneyTelemetry(worldProgress.get(), playbackState, activeView);
  }, [activeView, playbackState, publishJourneyTelemetry, worldProgress]);

  useEffect(() => {
    if (motionOff || playbackState !== "playing" || !worldReady) {
      publishJourneyTelemetry(worldProgress.get(), playbackState, activeViewRef.current);
      return;
    }

    let frame = 0;
    let previousAt = performance.now();
    let telemetryAt = previousAt;
    const resetFrameClock = () => { previousAt = performance.now(); };
    document.addEventListener("visibilitychange", resetFrameClock);
    const totalDurationMs = guidedJourneyDurationMs + oceanHoldDurationMs + skyHoldDurationMs;
    const tick = (now: number) => {
      const delta = document.hidden ? 0 : Math.max(0, now - previousAt);
      previousAt = now;
      elapsedJourneyMs.current = Math.min(totalDurationMs, elapsedJourneyMs.current + delta);
      const elapsed = elapsedJourneyMs.current;
      if (elapsed < guidedJourneyDurationMs) {
        if (activeViewRef.current !== "journey") selectView("journey");
        worldProgress.set(elapsed / guidedJourneyDurationMs);
      } else if (elapsed < guidedJourneyDurationMs + oceanHoldDurationMs) {
        worldProgress.set(1);
        if (activeViewRef.current !== "about") selectView("about");
      } else if (elapsed < totalDurationMs) {
        worldProgress.set(1);
        if (activeViewRef.current !== "projects") selectView("projects");
      } else {
        worldProgress.set(1);
        selectView("journey");
        setPlaybackState("complete");
        publishJourneyTelemetry(1, "complete", "journey");
        return;
      }
      if (now - telemetryAt >= 200) {
        telemetryAt = now;
        publishJourneyTelemetry(worldProgress.get(), "playing", activeViewRef.current);
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      document.removeEventListener("visibilitychange", resetFrameClock);
      window.cancelAnimationFrame(frame);
    };
  }, [motionOff, playbackState, publishJourneyTelemetry, selectView, worldProgress, worldReady]);

  useEffect(() => {
    if (!motionToggleUsed.current) return;
    const root = document.documentElement;
    const previousBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    journeyRef.current?.scrollIntoView({ block: "start" });
    root.style.scrollBehavior = previousBehavior;
  }, [useLessMotion]);

  return (
    <>
      <a className="skip-link" href="#site-content">Skip the mountain journey</a>
      <main>
        <section ref={journeyRef} className={`${styles.journey} ${motionOff ? styles.motionOff : ""}`} aria-labelledby="madagin-title">
          <div
            className={styles.stage}
            data-public-journey-state={playbackState}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
          >
            <PublicHeader tone="dark" />
            <div className={styles.worldPlate}>
              <PublicWorldLoader activeView={activeView} motionOff={motionOff} onReady={handleWorldReady} progress={worldProgress} />
            </div>
            <motion.div className={styles.stageShade} style={motionOff ? undefined : { filter: shadeFilter }} />
            <h1 id="madagin-title" className={styles.srTitle}>Madagin</h1>
            <p className={styles.heroPromise}>{promise}</p>
            <motion.div className={styles.wordmark} role="img" aria-label="Madagin" style={motionOff ? undefined : { filter: wordFilter }}>
              {letters.map((letter, index) => <DraggedLetter index={index} key={`${letter}-${index}`} letter={letter} motionOff={motionOff} progress={worldProgress} />)}
            </motion.div>
            <div className={styles.valueStack} aria-label="The standards Madagin works toward">
              {standards.map((standard, index) => <ValueScene index={index} key={standard.name} motionOff={motionOff} name={standard.name} progress={worldProgress} question={standard.question} />)}
            </div>
            {!motionOff && worldReady ? (
              <div className={styles.journeyControls} aria-label="Mountain journey controls">
                <div className={styles.viewControls}>
                  <button aria-pressed={activeView === "about"} data-journey-action="ocean" onClick={() => openGuidedView("about")} type="button">← Ocean</button>
                  <button aria-pressed={activeView === "projects"} data-journey-action="sky" onClick={() => openGuidedView("projects")} type="button">↑ Sky</button>
                  {activeView !== "journey" ? <button data-journey-action="continue" onClick={resumeJourney} type="button">Continue</button> : null}
                </div>
                <div className={styles.playbackControls}>
                  <button
                    data-journey-action={playbackState === "playing" ? "pause" : "play"}
                    onClick={playbackState === "playing" ? pauseJourney : resumeJourney}
                    type="button"
                  >
                    {playbackState === "playing" ? "Pause" : playbackState === "complete" ? "Play again" : "Resume"}
                  </button>
                  <button data-journey-action="replay" onClick={replayJourney} type="button">Replay</button>
                  <a href="#site-content">Skip</a>
                </div>
                <div className={styles.journeyProgress} aria-hidden="true"><motion.span style={{ scaleX: worldProgress }} /></div>
                <p className={styles.gestureHint}>Swipe or drag left for the ocean · up for the sky</p>
              </div>
            ) : null}
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
            <div className={styles.scrollCue} aria-hidden="true"><span /> The journey begins automatically</div>
            <p className={styles.srTitle} aria-live="polite">
              {playbackState === "playing" ? "The guided mountain journey is playing." : playbackState === "complete" ? "The guided mountain journey is complete." : "The guided mountain journey is paused."}
            </p>
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
