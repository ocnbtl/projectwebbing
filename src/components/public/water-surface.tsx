"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import config from "./balsa/madagin-background.json";
import type { BalsaBackgroundConfig } from "./balsa/gradient-background";
import styles from "./water-surface.module.css";
import { WaterNavigation } from "./water-navigation";
import { PresenceProvider } from "./presence-provider";

type Connection = EventTarget & { saveData?: boolean };
function subscribe(callback: () => void) {
  const query = matchMedia("(prefers-reduced-motion: reduce)");
  const connection = (navigator as Navigator & { connection?: Connection }).connection;
  query.addEventListener("change", callback);
  connection?.addEventListener("change", callback);
  return () => { query.removeEventListener("change", callback); connection?.removeEventListener("change", callback); };
}
function motionAllowed() {
  return !matchMedia("(prefers-reduced-motion: reduce)").matches && !(navigator as Navigator & { connection?: Connection }).connection?.saveData;
}
const MotionContext = createContext({ playing: false, motion: false, paused: false, toggle: () => {} });
export const useWaterMotion = () => useContext(MotionContext);

// The six Balsa source files and exported configuration are vendored unchanged.
// This React lifecycle adapter owns visibility, disposal, and our shared glass surface.
function WaterCanvas({ playing }: { playing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playingRef = useRef(playing);
  useEffect(() => { playingRef.current = playing; window.dispatchEvent(new Event("madagin:motion")); }, [playing]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let frame = 0;
    let cleanup = () => {};
    import("./balsa/gradient-background-renderer").then(({ GradientBackgroundRenderer }) => {
      if (cancelled) return;
      const renderer = new GradientBackgroundRenderer(canvas, config as BalsaBackgroundConfig, config.colors, undefined, { preserveDrawingBuffer: true });
      let elapsed = 0;
      let previous = performance.now();
      let lastRender = 0;
      const render = () => {
        renderer.render(elapsed * config.speed);
        canvas.dataset.frame = String(Number(canvas.dataset.frame || 0) + 1);
      };
      const resize = () => { renderer.resize(innerWidth, innerHeight); render(); };
      const loop = (now: number) => {
        frame = 0;
        if (cancelled || document.hidden || !playingRef.current) return;
        frame = requestAnimationFrame(loop);
        if (now - lastRender < 1000 / renderer.framesPerSecond) return;
        elapsed += Math.min((now - previous) / 1000, 0.1);
        previous = now; lastRender = now; render();
      };
      const wake = () => {
        cancelAnimationFrame(frame); frame = 0; previous = performance.now();
        if (!document.hidden && playingRef.current) frame = requestAnimationFrame(loop);
      };
      const contextLost = (event: Event) => {
        event.preventDefault(); cancelAnimationFrame(frame); frame = 0;
        canvas.dataset.ready = "false";
      };
      const contextRestored = () => { resize(); canvas.dataset.ready = "true"; wake(); };
      resize(); canvas.dataset.ready = "true";
      window.dispatchEvent(new Event("madagin:water-ready"));
      wake();
      window.addEventListener("resize", resize);
      window.addEventListener("madagin:motion", wake);
      document.addEventListener("visibilitychange", wake);
      canvas.addEventListener("webglcontextlost", contextLost);
      canvas.addEventListener("webglcontextrestored", contextRestored);
      cleanup = () => {
        cancelAnimationFrame(frame); window.removeEventListener("resize", resize);
        window.removeEventListener("madagin:motion", wake); document.removeEventListener("visibilitychange", wake);
        canvas.removeEventListener("webglcontextlost", contextLost); canvas.removeEventListener("webglcontextrestored", contextRestored);
        renderer.dispose();
      };
    }).catch(() => { canvas.dataset.ready = "false"; });
    return () => { cancelled = true; cleanup(); cancelAnimationFrame(frame); };
  }, []);
  return <div className={styles.surface} data-public-water="" aria-hidden="true"><canvas ref={canvasRef} data-water-canvas="" /></div>;
}

export function PublicWaterProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const motion = useSyncExternalStore(subscribe, motionAllowed, () => false);
  const [paused, setPaused] = useState(false);
  const publicRoute = !pathname.startsWith("/internal") && !pathname.endsWith("-review");
  const playing = motion && !paused;
  return <MotionContext.Provider value={{ playing, motion, paused, toggle: () => setPaused(value => !value) }}>
    {publicRoute ? <WaterCanvas playing={playing} /> : null}
    <PresenceProvider enabled={publicRoute}><WaterNavigation>{children}</WaterNavigation></PresenceProvider>
  </MotionContext.Provider>;
}
