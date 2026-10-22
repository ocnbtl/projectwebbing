"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import config from "./balsa/madagin-background.json";
import type { BalsaBackgroundConfig } from "./balsa/gradient-background";
import styles from "./water-surface.module.css";
import { WaterNavigation } from "./water-navigation";
import { PresenceProvider } from "./presence-provider";
import { GlassCursor } from "./glass-cursor";
import { trackWaterPage } from "./water-page-tracking";
import { settleWaterPageTop, containWaterScroll } from "./water-viewport";

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
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stopTracking = trackWaterPage(canvas);
    let cancelled = false;
    let frame = 0;
    let cleanup = () => {};
    Promise.all([import("./balsa/gradient-background-renderer"),import("./water-refraction")]).then(([{ GradientBackgroundRenderer },{createWaterRefraction}]) => {
      if (cancelled) return;
      const source=document.createElement("canvas");
      const renderer = new GradientBackgroundRenderer(source, config as BalsaBackgroundConfig, config.colors, undefined, { preserveDrawingBuffer: true });
      let optical:ReturnType<typeof createWaterRefraction>;
      try { optical=createWaterRefraction(canvas,source); } catch(error) { renderer.dispose(); throw error; }
      let elapsed = 0;
      let previous = performance.now();
      let lastRender = 0;
      const render = () => {
        renderer.render(elapsed * config.speed);
        optical.render(elapsed, playingRef.current);
        canvas.dataset.frame = String(Number(canvas.dataset.frame || 0) + 1);
      };
      const resize = () => { renderer.resize(innerWidth, innerHeight); optical.resize(); render(); };
      const loop = (now: number) => {
        frame = 0;
        if (cancelled || document.hidden || !playingRef.current) return;
        frame = requestAnimationFrame(loop);
        if (now - lastRender < 1000 / renderer.framesPerSecond) return;
        elapsed += Math.max(0, Math.min((now - previous) / 1000, 0.1));
        previous = now; lastRender = now; render();
      };
      const wake = () => {
        cancelAnimationFrame(frame); frame = 0; previous = performance.now();
        if (!document.hidden) frame = requestAnimationFrame(playingRef.current ? loop : () => { frame=0; render(); });
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
        optical.dispose();renderer.dispose();
      };
    }).catch(() => { canvas.dataset.ready = "false"; });
    return () => { cancelled = true; cleanup(); cancelAnimationFrame(frame); stopTracking(); };
  }, []);
  return <div className={styles.surface} data-public-water="" aria-hidden="true"><div className={styles.field} data-water-field=""><canvas ref={canvasRef} data-water-canvas="" /></div></div>;
}

export function PublicWaterProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const motion = useSyncExternalStore(subscribe, motionAllowed, () => false);
  const [paused, setPaused] = useState(false);
  const publicRoute = !pathname.startsWith("/internal") && !pathname.endsWith("-review");
  useLayoutEffect(() => {
    if (!publicRoute) return;
    return settleWaterPageTop();
  }, [pathname, publicRoute]);
  useLayoutEffect(()=>publicRoute?containWaterScroll():undefined,[publicRoute]);
  const playing = motion && !paused;
  return <MotionContext.Provider value={{ playing, motion, paused, toggle: () => setPaused(value => !value) }}>
    {publicRoute ? <WaterCanvas playing={playing} /> : null}
    <PresenceProvider enabled={publicRoute}><WaterNavigation>{children}</WaterNavigation></PresenceProvider>
    {publicRoute ? <GlassCursor /> : null}
  </MotionContext.Provider>;
}
