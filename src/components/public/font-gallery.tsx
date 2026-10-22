"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import fontData from "./font-gallery-data.json";
import styles from "./font-gallery.module.css";
import { useWaterMotion } from "./water-surface";
import type { GlassStudyRenderer } from "./font-glass-renderer";
import { fitGlyphs } from "./font-glyph-layout";
import { aliceSpacing } from "./brand-wordmark-spacing";
import { BrandName } from "./brand-wordmark";

type Face = { id: number; name: string; weight: number; file: string; style?: string; category?: string; foundry?: string; designer?: string; source?: string; license?: string; licenseLabel?: string; recommended?: boolean; note?: string };
const fonts: Face[] = fontData;
const directions = ["All 100", "Start here", "Signature", "Expressive serif", "Sculptural", "Shortlist"] as const;
type Direction = typeof directions[number];
const cases = ["Madagin", "MADAGIN", "madagin"] as const;

function Word({ face, solid, word, renderer, unavailable, eager = false }: { face: Face; solid: boolean; word: string; renderer: GlassStudyRenderer | null; unavailable: boolean; eager?: boolean }) {
 const svg = useRef<SVGSVGElement>(null);
 const [fit, setFit] = useState({ size: 130, x: 100, baseline: 230, offsets: [] as number[] });
 const [status, setStatus] = useState<"pending" | "ready" | "error">("pending");
 const text = face.id <= 100 ? "MADAGIN" : word;
 useEffect(() => {
  let cancelled = false, started = false;
  const load = () => {
   if (started) return;
   started = true;
   void document.fonts.load(`${face.weight} 100px "Study${face.id}"`, text).then(loaded => {
    if (cancelled) return;
    if (!loaded.length) throw new Error("Font unavailable");
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) throw new Error("Metrics unavailable");
    setFit(fitGlyphs(ctx, { family: `Study${face.id}`, weight: face.weight, text, pairAdjustments: face.id === 376 && text === "MADAGIN" ? aliceSpacing : undefined }));
    setStatus("ready");
   }).catch(() => { if (!cancelled) setStatus("error"); });
  };
  if (eager) load();
  const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { load(); observer.disconnect(); } }, { rootMargin: "600px" });
  if (svg.current) observer.observe(svg.current);
  return () => { cancelled = true; observer.disconnect(); };
 }, [face, text, eager]);
 useEffect(() => {
  if (status !== "ready" || solid || !renderer || !svg.current) return;
  return renderer.register(svg.current, { family: `Study${face.id}`, weight: face.weight, text, pairAdjustments: face.id === 376 && text === "MADAGIN" ? aliceSpacing : undefined });
 }, [renderer, face, text, solid, status]);
 return <svg ref={svg} viewBox="0 0 1000 360" className={styles.word} role="img" aria-label={`${text} in ${face.name}, ${solid ? "solid lettering" : "liquid glass"}`} data-font-loaded={status === "ready"} data-font-status={status} data-liquid={!solid} data-glass-state={unavailable ? "unavailable" : undefined}>
  <text data-flat-lettering="" x={fit.x} y={fit.baseline} fontFamily={`Study${face.id}`} fontWeight={face.weight} fontSize={fit.size} fill="#edf5fa" opacity={status === "ready" ? 1 : 0}>{fit.offsets.length ? Array.from(text).map((letter, index) => <tspan key={index} x={fit.x + fit.offsets[index]}>{letter}</tspan>) : text}</text>
  {status !== "ready" && <text x="500" y="186" textAnchor="middle" fontFamily="sans-serif" fontSize="22" fill="#cadce8">{status === "error" ? "Preview unavailable · open the source" : "Loading letterforms…"}</text>}
  {status === "ready" && !solid && <text className={styles.glassLoading} x="500" y="186" textAnchor="middle" fontFamily="sans-serif" fontSize="22" fill="#cadce8">Forming liquid glass…</text>}
  {!solid && <text className={styles.glassUnavailable} x="500" y="346" textAnchor="middle" fontFamily="sans-serif" fontSize="18" fill="#cadce8">Glass unavailable · solid preview</text>}
 </svg>;
}

export function FontGallery() {
 const [selected, setSelected] = useState(fonts[375]), [solid, setSolid] = useState(false), [word, setWord] = useState<string>("MADAGIN");
 const [saved, setSaved] = useState<number[]>([]), [direction, setDirection] = useState<Direction>("All 100"), [ready, setReady] = useState(false);
 const large = useRef<HTMLDivElement>(null), study = useRef<HTMLElement>(null);
 const { playing, toggle: toggleMotion, motion } = useWaterMotion();
 const [renderer, setRenderer] = useState<GlassStudyRenderer | null>(null), [unavailable, setUnavailable] = useState(false);
 useEffect(() => {
  const host = study.current; if (!host) return;
  let cancelled = false, controller: GlassStudyRenderer | null = null;
  import("./font-glass-renderer").then(({ createGlassStudyRenderer }) => {
   if (cancelled) return; controller = createGlassStudyRenderer(host); setRenderer(controller);
  }).catch(() => { if (!cancelled) setUnavailable(true); });
  return () => { cancelled = true; controller?.dispose(); };
 }, []);
 useEffect(() => { renderer?.setPlaying(playing); }, [renderer, playing]);
 useEffect(() => {
  const frame = requestAnimationFrame(() => {
   try { const stored: unknown = JSON.parse(localStorage.getItem("madagin-font-shortlist") || "[]"); if (Array.isArray(stored)) setSaved(stored.filter((id): id is number => typeof id === "number" && fonts.some(f => f.id === id))); } catch {}
   setReady(true);
  });
  return () => cancelAnimationFrame(frame);
 }, []);
 useEffect(() => { if (ready) try { localStorage.setItem("madagin-font-shortlist", JSON.stringify(saved)); } catch {} }, [ready, saved]);
 const toggle = (id: number) => setSaved(old => old.includes(id) ? old.filter(n => n !== id) : [...old, id]);
 const visible = fonts.filter(face => direction === "Shortlist" ? saved.includes(face.id) : face.id > 400 && (direction === "All 100" || (direction === "Start here" ? face.recommended : face.category === direction)));
 return <main ref={study} className={styles.study}>
  <style>{fonts.map(f => `@font-face{font-family:Study${f.id};src:url('/media/font-review/${f.file}');font-weight:${f.weight};font-display:block;}`).join("\n")}</style>
  <header><Link href="/">← Back to <BrandName /></Link><Link href="/monogram-study">Choose the M hover fonts →</Link><span>Wordmark study / Round 06</span></header>
  <div className={styles.intro}><h1>The search continues.</h1><p>100 new directions: 25 flowing scripts, 65 expressive serifs and 10 sculptural faces. Distinctive capitals, unconventional proportions and open loops, with no repeats from the previous 400. Start with twelve picks, or explore them all.</p><p className={styles.researchNote}>Alice is our current wordmark, shown below with the same optical spacing as the live site. Every preview preserves the font’s original outline. Compare Solid and Liquid glass to explore both finishes.</p></div>
  <div ref={large} className={styles.featured}><div><span>{selected.id} / {selected.name}</span><button onClick={() => toggle(selected.id)} aria-pressed={saved.includes(selected.id)}>{saved.includes(selected.id) ? "Saved" : "Save to shortlist"}</button></div><Word key={`${selected.id}-${word}`} face={selected} solid={solid} word={word} renderer={renderer} unavailable={unavailable} eager /><p className={styles.note}>{selected.id <= 100 ? "Earlier round · capitals only" : selected.note}</p></div>
  <nav className={styles.toolbar} aria-label="Font study controls">
   <div className={styles.controlRow} role="group" aria-label="Letter case">{cases.map(value => <button key={value} aria-pressed={word === value} onClick={() => setWord(value)}>{value}</button>)}</div>
   <div className={styles.controlRow} role="group" aria-label="Letter finish"><button aria-pressed={solid} onClick={() => setSolid(true)}>Solid</button><button aria-pressed={!solid} onClick={() => setSolid(false)}>Liquid glass</button></div>
   <label className={styles.directionLabel}>Explore<select value={direction} onChange={event => setDirection(event.target.value as Direction)}>{directions.map(value => <option key={value} value={value}>{value === "Start here" ? "Start here · 12 picks" : value === "Shortlist" ? `Shortlist · ${saved.length}` : value}</option>)}</select></label>
  {motion && <button onClick={toggleMotion} aria-pressed={!playing}>{playing ? "Pause water" : "Resume water"}</button>}</nav>
  {unavailable && <p role="status" className={styles.note}>Liquid glass is unavailable on this device. The actual fonts are shown in solid lettering.</p>}
  <div className={styles.resultLine}><span role="status">{visible.length} typefaces · {direction === "All 100" ? "New this round" : direction}</span><button className={styles.shortcut} onClick={() => setDirection(direction === "Start here" ? "All 100" : "Start here")}>{direction === "Start here" ? "See all 100 →" : "Start with 12 picks →"}</button></div>
  <div className={styles.catalog}>{visible.map(face => <article key={face.id} data-font-option={face.id}>
   <div className={styles.caption}><span>{face.id}</span><h2>{face.name}</h2><button aria-label={`${saved.includes(face.id) ? "Remove" : "Save"} ${face.name}`} aria-pressed={saved.includes(face.id)} onClick={() => toggle(face.id)}>{saved.includes(face.id) ? "Saved" : "Save"}</button></div>
   <button className={styles.sample} aria-label={`View ${face.name} large`} onClick={() => { setSelected(face); large.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" }); }}><Word key={`${face.id}-${word}`} face={face} solid={solid} word={word} renderer={renderer} unavailable={unavailable} /><span>View large ↗</span></button>
   <p className={styles.note}>{face.id <= 100 ? "Earlier round · capitals only" : face.note}</p>
   <div className={styles.credit}>{face.source && <a href={face.source} target="_blank" rel="noreferrer">{face.designer ? `${face.designer} / ` : ""}{face.foundry || "Original source"} ↗</a>}{face.license && <a href={face.license} target="_blank" rel="noreferrer" title={face.licenseLabel}>License ↗</a>}</div>
  </article>)}</div>
  {direction === "Shortlist" && !saved.length && <p className={styles.empty}>Save a few favorites from the collection to compare them here.</p>}
  <footer><p>This round features independent designers published through <a href="https://fonts.google.com/" target="_blank" rel="noreferrer">Google Fonts</a>. Each specimen credits its designer and links to the original source and license. These are our own brand studies, not a font download service.</p><p>Your shortlist is saved in this browser on this site, including earlier favorites. Alice is now the live wordmark; saving another font keeps it here for comparison.</p></footer>
 </main>;
}

