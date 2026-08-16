"use client";

import type { MotionValue } from "motion/react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { useRef } from "react";
import { promise, standards } from "@/lib/brand";
import styles from "./public-home.module.css";

const letters = [..."MADAGIN"];

function DraggedLetter({
  letter,
  index,
  progress,
  reducedMotion,
}: {
  letter: string;
  index: number;
  progress: MotionValue<number>;
  reducedMotion: boolean | null;
}) {
  const delay = index * 0.012;
  const scaleY = useTransform(
    progress,
    [0, 0.36 + delay, 0.49 + delay, 0.66 + delay, 1],
    [1, 1, 3.25 - index * 0.04, 1.08, 1],
  );
  const y = useTransform(
    progress,
    [0, 0.36 + delay, 0.49 + delay, 0.66 + delay, 1],
    ["0vh", "0vh", "13vh", "0vh", "0vh"],
  );

  return (
    <motion.span
      aria-hidden="true"
      className={styles.letter}
      style={reducedMotion ? undefined : { scaleY, y }}
    >
      {letter}
    </motion.span>
  );
}

function FilmField() {
  const videoSource = process.env.NEXT_PUBLIC_MADAGIN_HERO_VIDEO;

  if (videoSource) {
    return (
      <video className={styles.video} autoPlay loop muted playsInline>
        <source src={videoSource} />
      </video>
    );
  }

  return (
    <div className={styles.filmFallback} aria-hidden="true">
      <span className={styles.beamOne} />
      <span className={styles.beamTwo} />
      <span className={styles.aperture} />
      <span className={styles.filmNoise} />
    </div>
  );
}

export function PublicHome() {
  const heroRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end end"],
  });
  const filmOpacity = useTransform(scrollYProgress, [0, 0.58, 0.78], [1, 1, 0]);
  const wordColor = useTransform(
    scrollYProgress,
    [0, 0.7, 0.84],
    ["#FCFCFC", "#FCFCFC", "#000000"],
  );
  const groundColor = useTransform(
    scrollYProgress,
    [0, 0.72, 0.86],
    ["#000000", "#000000", "#FCFCFC"],
  );

  return (
    <>
      <a className="skip-link" href="#after-hero">
        Skip cinematic intro
      </a>
      <main>
        <section ref={heroRef} className={styles.hero} aria-labelledby="madagin-title">
          <motion.div
            className={styles.stickyFrame}
            style={reducedMotion ? undefined : { backgroundColor: groundColor }}
          >
            <motion.div
              className={styles.filmLayer}
              style={reducedMotion ? undefined : { opacity: filmOpacity }}
            >
              <FilmField />
            </motion.div>

            <h1 id="madagin-title" className={styles.srTitle}>
              Madagin
            </h1>
            <motion.div
              className={styles.wordmark}
              aria-label="Madagin"
              role="img"
              style={reducedMotion ? undefined : { color: wordColor }}
            >
              {letters.map((letter, index) => (
                <DraggedLetter
                  key={`${letter}-${index}`}
                  letter={letter}
                  index={index}
                  progress={scrollYProgress}
                  reducedMotion={reducedMotion}
                />
              ))}
            </motion.div>

            <div className={styles.scrollLine} aria-hidden="true" />
          </motion.div>
        </section>

        <section id="after-hero" className={styles.reveal} aria-labelledby="promise-title">
          <div className={styles.revealLead}>
            <h2 id="promise-title">{promise}</h2>
            <p>Strategy, design, and development for businesses ready to show up differently.</p>
          </div>

          <div className={styles.workRail} aria-labelledby="work-title">
            <div>
              <h3 id="work-title">Selected work</h3>
              <p>Portfolio stories are being assembled.</p>
            </div>
            <span aria-hidden="true">01{"\u2014"}</span>
          </div>

          <div className={styles.standardRail} aria-label="Madagin standards">
            {standards.map((standard) => (
              <span key={standard.name}>{standard.name}</span>
            ))}
          </div>

          <footer className={styles.footer}>
            <span>Madagin</span>
            <span>Made again.</span>
            <span>{"\u00A9"} {new Date().getFullYear()}</span>
            <a className={styles.adminLink} href="/internal">
              Admin
            </a>
          </footer>
        </section>
      </main>
    </>
  );
}
