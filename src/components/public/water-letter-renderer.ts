import * as THREE from "three";
import { buildGlyphSurface } from "./font-glass-renderer";
import { aliceSpacing } from "./brand-wordmark-spacing";
import { aliceLetterFragment } from "./alice-letter-material";
import { getWaterWake } from "./water-wake";

const EMERGENCE_SECONDS = 4.4;
// A page can contain the hidden landing mark and the footer. Only the visible
// mark owns the water emitter; an offscreen renderer must not erase its waves.
let wakeOwner: HTMLElement | null = null;
export type LiquidRenderer = { dispose: () => void; snapshot: () => string; setPaused: (paused: boolean) => void; setExpanded: (expanded: boolean) => void };

export async function createLiquidRenderer(host: HTMLElement, onHover: (index: number | null) => void, signal: AbortSignal, placement: "hero" | "footer" | "nav" = "hero"): Promise<LiquidRenderer> {
 const mark = host.querySelector<HTMLElement>("[data-brand-wordmark]");
 const family = getComputedStyle(mark || host).fontFamily.split(",")[0].replace(/["']/g, "").trim();
 const loaded = await document.fonts.load(`400 100px "${family}"`, "MADAGIN");
 if (!loaded.length) throw new Error("Alice letterforms unavailable");
 signal.throwIfAborted();
 const water = document.querySelector<HTMLCanvasElement>("[data-water-canvas]");
 if (!water) throw new Error("Water surface unavailable");
 if (water.dataset.ready !== "true") await new Promise<void>((resolve, reject) => {
  const clean = () => { window.removeEventListener("madagin:water-ready", ready); signal.removeEventListener("abort", cancel); };
  const ready = () => { clean(); resolve(); }, cancel = () => { clean(); reject(new DOMException("Aborted", "AbortError")); };
  window.addEventListener("madagin:water-ready", ready, { once: true }); signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel(); else if (water.dataset.ready === "true") ready();
 });
 signal.throwIfAborted();
 const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
 renderer.setClearColor(0, 0); renderer.domElement.setAttribute("aria-hidden", "true");
 const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2); camera.position.z = 1;
 const makeWater = () => { const t = new THREE.CanvasTexture(water); t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.colorSpace = THREE.NoColorSpace; return t; };
 let waterTexture = makeWater(), waterWidth = water.width, waterHeight = water.height;
 let wake = getWaterWake();
 const makeWake = () => { const t = new THREE.DataTexture(wake.data, wake.width, wake.height); t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t; };
 let wakeTexture = makeWake();
 let surface: ReturnType<typeof buildGlyphSurface> | undefined, surfaceWidth = 0;
 const u = {
  uSurface: { value: null as THREE.Texture | null }, uWater: { value: waterTexture }, uWaterEdge: { value: 0 }, uWake: { value: wakeTexture },
  uViewport: { value: new THREE.Vector2() }, uOrigin: { value: new THREE.Vector2() }, uHostSize: { value: new THREE.Vector2() },
  uLetterSize: { value: new THREE.Vector2() }, uDpr: { value: 1 }, uProgress: { value: 0 },
  uReveal: { value: placement === "nav" && host.dataset.expanded !== "true" ? 0 : 1 }, uMotionScale: { value: placement === "nav" ? .18 : 1 }, uOpticalBoost: { value: placement === "nav" ? 1.7 : 1 },
  uPointer: { value: new THREE.Vector2(.5, .5) }, uHover: { value: 0 }, uTime: { value: 0 }, uCuts:{value:new Float32Array(6)},
 };
 const material = new THREE.ShaderMaterial({ uniforms: u, transparent: true, toneMapped: false, depthWrite: false,
  vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: aliceLetterFragment,
 });
 const geometry = new THREE.PlaneGeometry(1, 1), mesh = new THREE.Mesh(geometry, material); scene.add(mesh);
 const pointer = new THREE.Vector2(-4, -4);
 let bounds = host.getBoundingClientRect(), letterWidth = 0, letterHeight = 0, left = 0, top = 0;
 let revealTarget = u.uReveal.value;
 let frame = 0, elapsed = 0, previous = performance.now(), lastRender = 0, visible = false, paused = false, disposed = false, sampled = "";
 const sourceMask = () => {
  if (!surface || !letterWidth || !letterHeight || wakeOwner !== host || !visible) return;
  wake.setMask(surface.ink, surface.texture.image.width, surface.texture.image.height, { x: left / innerWidth, y: top / innerHeight, width: letterWidth / innerWidth, height: letterHeight / innerHeight });
 };
 const releaseWake = () => { if (wakeOwner === host) { wake.setProgress(1); wake.setResting(false); wakeOwner = null; } };
 const syncPosition = () => {
  const next = host.getBoundingClientRect();
  if (Math.abs(next.left - bounds.left) < .2 && Math.abs(next.top - bounds.top) < .2) return;
  left += next.left - bounds.left; top += next.top - bounds.top; bounds = next;
  u.uOrigin.value.set(bounds.left, bounds.top); sourceMask();
 };
 function resize() {
  bounds = host.getBoundingClientRect(); if (!bounds.width || !bounds.height) return;
  letterWidth = placement === "nav" ? bounds.width * 1.1 : placement === "footer" ? bounds.width * .98 : Math.min(bounds.width * .98, bounds.height / .36 * .95); letterHeight = letterWidth * .36;
  left = bounds.left + (bounds.width - letterWidth) / 2; top = bounds.top + (bounds.height - letterHeight) / 2;
  renderer.setPixelRatio(placement === "nav" ? Math.min(3,Math.max(2,devicePixelRatio||1)) : Math.min(devicePixelRatio || 1, 2, Math.sqrt(4000000 / (bounds.width * bounds.height))));
  renderer.setSize(bounds.width, bounds.height); u.uDpr.value = renderer.getPixelRatio();
  camera.left = -bounds.width / 2; camera.right = bounds.width / 2; camera.top = bounds.height / 2; camera.bottom = -bounds.height / 2; camera.updateProjectionMatrix();
  mesh.scale.set(letterWidth, letterHeight, 1);
  u.uViewport.value.set(innerWidth, innerHeight); u.uOrigin.value.set(bounds.left, bounds.top); u.uHostSize.value.set(bounds.width, bounds.height); u.uLetterSize.value.set(letterWidth, letterHeight);
  if (!surface || Math.abs(surfaceWidth - letterWidth) > 40) {
   surface?.texture.dispose(); surface = buildGlyphSurface({ family, weight: 400, text: "MADAGIN", pairAdjustments: aliceSpacing }, letterWidth, placement === "nav" ? .005 : .0035);
   // Pre-filter the small mark's bevel highlights instead of undersampling a
   // large glyph field into isolated bright pixels at header size.
   if(placement === "nav") { surface.texture.generateMipmaps=true; surface.texture.minFilter=THREE.LinearMipmapLinearFilter; surface.texture.needsUpdate=true; }
   surfaceWidth = letterWidth; u.uSurface.value = surface.texture; u.uCuts.value=Float32Array.from(surface.cuts);
  }
  const nextWake = getWaterWake(); if (nextWake !== wake) { wake = nextWake; wakeTexture.dispose(); wakeTexture = makeWake(); u.uWake.value = wakeTexture; }
  sourceMask(); host.dataset.fit = `${letterWidth.toFixed(1)}×${letterHeight.toFixed(1)}`;
  draw(0);
 }
 function point(event: PointerEvent) { if (event.pointerType !== "touch") pointer.set((event.clientX - left) / letterWidth, 1 - (event.clientY - top) / letterHeight); }
 function leave() { pointer.set(-4, -4); onHover(null); }
 function draw(dt: number) {
  if (!surface) return;
  if (water!.width !== waterWidth || water!.height !== waterHeight) { waterTexture.dispose(); waterTexture = makeWater(); waterWidth = water!.width; waterHeight = water!.height; u.uWater.value = waterTexture; }
  u.uWaterEdge.value=Number(water!.dataset.waterEdge||0);
  if (sampled !== water!.dataset.frame) { waterTexture.needsUpdate = true; sampled = water!.dataset.frame || ""; }
  wakeTexture.needsUpdate = true;
  const progress = placement === "nav" || paused ? 1 : Math.min(1, elapsed / EMERGENCE_SECONDS);
  if (wakeOwner === host && visible) { wake.setProgress(progress); wake.setResting(!paused && progress === 1,placement==='footer'?.22:1); }
  u.uReveal.value = paused ? revealTarget : u.uReveal.value + (revealTarget - u.uReveal.value) * (1 - Math.exp(-dt * 6));
  if (Math.abs(revealTarget-u.uReveal.value)<.0005) u.uReveal.value=revealTarget;
  u.uProgress.value = progress; u.uTime.value = paused ? 0 : placement==='nav' ? performance.now()/1000 : elapsed;
  const x = Math.floor(pointer.x * surface.texture.image.width), y = Math.floor((1 - pointer.y) * surface.texture.image.height);
  const over = x >= 0 && x < surface.texture.image.width && y >= 0 && y < surface.texture.image.height && surface.ink[(y * surface.texture.image.width + x) * 4 + 3] > 32;
  u.uHover.value += ((over && !paused ? 1 : 0) - u.uHover.value) * (1 - Math.exp(-dt * 7));
  if (over) u.uPointer.value.lerp(pointer, 1 - Math.exp(-dt * 12));
  renderer.render(scene, camera);
  host.dataset.frames = String(Number(host.dataset.frames || 0) + 1); host.dataset.emergence = String(progress); host.dataset.wakeRevision = String(wake.revision);
  if(progress>=.73&&host.dataset.introducing!=="true"){host.dataset.introducing="true";host.dispatchEvent(new Event("madagin:wordmark-introducing"));}
  if (progress === 1 && host.dataset.emerged !== "true") { host.dataset.emerged = "true"; host.dispatchEvent(new Event("madagin:wordmark-emerged")); }
 }
 function loop(now: number) {
  frame = 0; if (disposed || paused || !visible || document.hidden) return;
  if (now - lastRender < 1000 / (placement === "nav" ? 30 : 60)) { frame = requestAnimationFrame(loop); return; }
  lastRender = now;
  const dt = Math.max(0, Math.min((now - previous) / 1000, .05)); previous = now; elapsed += dt;
  if (placement !== "hero") syncPosition();
  draw(dt); frame = requestAnimationFrame(loop);
 }
 function start() { previous = performance.now(); if (!frame && !paused && visible && !document.hidden && !disposed) frame = requestAnimationFrame(loop); }
 const observer = new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting;
  if (visible) { if (placement !== "nav") wakeOwner = host; resize(); sourceMask(); draw(0); }
  else releaseWake();
  start();
 }, { threshold: .08 });
 const scroll = () => { if (visible && placement !== "hero" && paused) { syncPosition(); draw(0); } };
 const resizer = new ResizeObserver(resize);
 host.append(renderer.domElement); host.dataset.brandFont = "Alice"; resize(); host.dataset.ready = "true";
 observer.observe(host); resizer.observe(host); host.addEventListener("pointermove", point); host.addEventListener("pointerleave", leave);
 document.addEventListener("visibilitychange", start); window.addEventListener("scroll", scroll, { passive: true }); start();
 return {
  snapshot() { draw(0); return renderer.domElement.toDataURL(); },
  setExpanded(value) { revealTarget=value?1:0; if(paused){u.uReveal.value=revealTarget;draw(0);}else start(); },
  setPaused(value) { paused = value; if (value) { cancelAnimationFrame(frame); frame = 0; elapsed = EMERGENCE_SECONDS; if (wakeOwner === host) wake.settle(); draw(0); leave(); } else start(); },
  dispose() { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); resizer.disconnect(); host.removeEventListener("pointermove", point); host.removeEventListener("pointerleave", leave); document.removeEventListener("visibilitychange", start); window.removeEventListener("scroll", scroll); releaseWake(); geometry.dispose(); material.dispose(); surface?.texture.dispose(); waterTexture.dispose(); wakeTexture.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); delete host.dataset.ready; },
 };
}
