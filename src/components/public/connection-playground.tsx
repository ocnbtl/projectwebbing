"use client";
import { useEffect, useRef, useState } from "react";
import { useWaterMotion } from "./water-surface";
import { usePresence } from "./presence-provider";
import styles from "./home-story.module.css";

// This is an explicitly labeled capability demo, never an analytics counter.
export function ConnectionPlayground() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [count, setCount] = useState(24);
  const { playing } = useWaterMotion();
  const presence = usePresence();
  const state = useRef({ count, presence });
  useEffect(() => { state.current = { count, presence }; }, [count, presence]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setCount(current => Math.max(10, Math.min(40, current + Math.floor(Math.random() * 9) - 4))), 4800);
    return () => clearInterval(timer);
  }, [playing]);
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    let frame = 0, time = 0, previous = 0, width = 0, height = 0;
    const pointer = { x: -1, y: -1 };
    const trails = new Map<string, { x: number; y: number }[]>();
    const resize = () => { width = el.clientWidth; height = el.clientHeight; const dpr = Math.min(devicePixelRatio, 1.5); el.width = width * dpr; el.height = height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    const move = (e: PointerEvent) => { const b = el.getBoundingClientRect(); pointer.x = e.clientX - b.left; pointer.y = e.clientY - b.top; state.current.presence.send(pointer.x / b.width, pointer.y / b.height); };
    const leave = () => { pointer.x = -1; };
    const draw = (now: number) => {
      if (playing) frame = requestAnimationFrame(draw);
      if (document.hidden || now - previous < 32) return;
      previous = now; if (playing) time += .018;
      ctx.clearRect(0, 0, width, height);
      const add = (i: string, x: number, y: number, color: string, label?: string) => {
        const trail = trails.get(i) || []; trails.set(i, trail); trail.push({ x, y }); if (trail.length > 28) trail.shift();
        ctx.strokeStyle = color; ctx.lineWidth = 1.4;
        for (let j = 1; j < trail.length; j++) { ctx.globalAlpha = j / trail.length * .48; ctx.beginPath(); ctx.moveTo(trail[j-1].x, trail[j-1].y); ctx.lineTo(trail[j].x, trail[j].y); ctx.stroke(); }
        ctx.globalAlpha = .9; ctx.fillStyle = color;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x+4, y+14); ctx.lineTo(x+7, y+9); ctx.lineTo(x+13, y+7); ctx.closePath(); ctx.fill();
        if (label) { ctx.font = "11px sans-serif"; ctx.fillText(label, x+17, y+19); }
      };
      const live = state.current.presence;
      const simulated = (live.count ?? 0) > 40 ? 0 : state.current.count;
      for (let i = 0; i < simulated; i++) {
        const x = width * (.5 + .42 * Math.sin(i * 9.2 + time * (.22 + i % 4 * .05)));
        const y = height * (.53 + .32 * Math.cos(i * 5.7 + time * (.3 + i % 3 * .04)));
        add(String(i), x, y, ["#f9c7ac", "#cbdfff", "#b0ecdc", "#e5c0ee"][i % 4]);
      }
      let drawn = 0;
      for (const [id, peer] of live.peers.current) {
        if (performance.now() - peer.at > 6000) { live.peers.current.delete(id); trails.delete(id); continue; }
        if (drawn++ < 40) { const previousPoint = trails.get(id)?.at(-1); const x = previousPoint ? previousPoint.x + (peer.x * width - previousPoint.x) * .24 : peer.x * width; const y = previousPoint ? previousPoint.y + (peer.y * height - previousPoint.y) * .24 : peer.y * height; add(id, x, y, "#d4f4e0", "visitor"); }
      }
      if (pointer.x >= 0) add("you", pointer.x, pointer.y, "#ffffff", "you");
      el.dataset.livePeers = String(drawn);
      ctx.globalAlpha = 1;
    };
    resize(); draw(100); const observer = new ResizeObserver(resize); observer.observe(el);
    el.addEventListener("pointermove", move); el.addEventListener("pointerleave", leave);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); };
  }, [playing]);
  return <div className={styles.connection} data-real-count={presence.count ?? 0} data-connected={presence.connected}>
    <div className={styles.presence}><span aria-hidden="true" /> <strong>{(presence.count ?? 0) > 40 ? presence.count : count}</strong> {(presence.count ?? 0) > 40 ? "here now" : "participants"} <small>{(presence.count ?? 0) > 40 ? "live" : "demo"}</small></div>
    <canvas ref={canvas} aria-label="An interactive demonstration of colorful cursor trails. Move your pointer to add a trail." />
    <p>Different paths. A shared moment.<span>{presence.connected ? `${presence.count ?? 1} real connections · ` : ""}{(presence.count ?? 0) > 40 ? "move or drag to connect" : "simulated scene · move or drag to join"}</span></p>
  </div>;
}
