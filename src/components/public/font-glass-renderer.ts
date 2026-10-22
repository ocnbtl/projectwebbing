import * as THREE from "three";
import { liquidLetterFragment } from "./liquid-letter-material";
import { fitGlyphs, type FontSpecimen } from "./font-glyph-layout";

type Specimen = FontSpecimen;
type Entry = { host: SVGSVGElement; specimen: Specimen; mesh?: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>; width: number; seen: number; hover: number };
export type GlassStudyRenderer = { register: (host: SVGSVGElement, specimen: Specimen) => () => void; setPlaying: (playing: boolean) => void; dispose: () => void };

// Exact squared Euclidean distance transform, separable into two 1D envelopes.
// The field follows the browser's actual loaded glyphs, including font kerning.
function distances(alpha: Uint8ClampedArray, width: number, height: number, toInk: boolean) {
 const field = new Float32Array(width * height), size = Math.max(width, height);
 const f = new Float64Array(size), d = new Float64Array(size), v = new Int32Array(size), z = new Float64Array(size + 1);
 const pass = (length: number) => {
  let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < length; q++) {
   let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
   while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
   k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < length; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) ** 2 + f[v[k]]; }
 };
 for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) f[x] = (alpha[(y * width + x) * 4 + 3] >= 128) === toInk ? 0 : 1e12;
  pass(width); for (let x = 0; x < width; x++) field[y * width + x] = d[x];
 }
 for (let x = 0; x < width; x++) {
  for (let y = 0; y < height; y++) f[y] = field[y * width + x];
  pass(height); for (let y = 0; y < height; y++) field[y * width + x] = d[y];
 }
 return field;
}

export function buildGlyphSurface(specimen: Specimen, requestedWidth: number, embolden = 0) {
 const width = Math.min(2200, Math.max(900, Math.round(requestedWidth * 2))), height = Math.round(width * .36);
 const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
 const ctx = canvas.getContext("2d", { willReadFrequently: true });
 if (!ctx) throw new Error("Letter surface unavailable");
 const { size, x, baseline, offsets } = fitGlyphs(ctx, specimen, width, height);
 ctx.fillStyle = "white";
 // Optical weight is applied only to the commissioned mark, never the study.
 // A small round stroke keeps Alice's open counters and original spacing.
 if (embolden) {
  ctx.strokeStyle = "white"; ctx.lineJoin = "round"; ctx.lineWidth = size * embolden * 2;
  if (offsets.length) Array.from(specimen.text).forEach((letter, index) => ctx.strokeText(letter, x + offsets[index], baseline));
  else ctx.strokeText(specimen.text, x, baseline);
 }
 if (offsets.length) Array.from(specimen.text).forEach((letter, index) => ctx.fillText(letter, x + offsets[index], baseline));
 else ctx.fillText(specimen.text, x, baseline);
 const ink = ctx.getImageData(0, 0, width, height).data;
 const outside = distances(ink, width, height, false), inside = distances(ink, width, height, true);
 for (let i = 0; i < outside.length; i++) outside[i] = Math.sqrt(outside[i]) - Math.sqrt(inside[i]);
 const data = new Uint8Array(width * height * 4), unit = 2.5 / size;
 const bevel = Math.max(1.5, size * .018), relief = new Float32Array(width * height);
 for (let i = 0; i < relief.length; i++) relief[i] = bevel * 1.8 * (1 - Math.exp(-Math.max(0, outside[i]) / (bevel * .7)));
 // Smooth the relief, never the coverage. This softens distance-field ridges
 // at script joins while preserving every counter and antialiased hairline.
 const smooth = new Float32Array(relief.length);
 for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
  const i = y * width + x;
  smooth[i] = (relief[i] * 4 + (relief[i - 1] + relief[i + 1] + relief[i - width] + relief[i + width]) * 2 + relief[i - width - 1] + relief[i - width + 1] + relief[i + width - 1] + relief[i + width + 1]) / 16;
 }
 // Neutral normals outside the ink prevent dark fringes during filtering.
 for (let i = 0; i < width * height; i++) { data[i * 4] = 128; data[i * 4 + 1] = 128; data[i * 4 + 2] = 255; }
 for (let y = 2; y < height - 2; y++) for (let x = 2; x < width - 2; x++) {
  const i = y * width + x;
  if (!ink[i * 4 + 3]) continue;
  const nx = (smooth[i - 1] - smooth[i + 1]) / 2, ny = (smooth[i + width] - smooth[i - width]) / 2, length = Math.hypot(nx, ny, 1);
  const p = i * 4; data[p] = Math.round((nx / length * .5 + .5) * 255); data[p + 1] = Math.round((ny / length * .5 + .5) * 255); data[p + 2] = Math.round((1 / length * .5 + .5) * 255);
  data[p + 3] = ink[p + 3];
 }
 const texture = new THREE.DataTexture(data, width, height); texture.flipY = true; texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter; texture.needsUpdate = true;
 const cuts = offsets.slice(1).map((offset,index)=>{
  const prior=ctx.measureText(Array.from(specimen.text)[index]);
  const next=ctx.measureText(Array.from(specimen.text)[index+1]);
  return (x+(offsets[index]+prior.actualBoundingBoxRight+offset-next.actualBoundingBoxLeft)/2)/width;
 });
 return { texture, worldWidth: width * unit, worldHeight: height * unit, ink, cuts };
}

export function createGlassStudyRenderer(container: HTMLElement): GlassStudyRenderer {
 const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
 renderer.setClearColor(0, 0); renderer.autoClear = false;
 const canvas = renderer.domElement; canvas.dataset.glassStudyCanvas = ""; canvas.setAttribute("aria-hidden", "true");
 Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "2" }); container.prepend(canvas);
 const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2); camera.position.z = 1;
 const plane = new THREE.PlaneGeometry(2, 2), entries = new Set<Entry>();
 const pointer = new THREE.Vector2(-9999, -9999);
 let water: HTMLCanvasElement | null = null, texture: THREE.CanvasTexture | null = null, waterWidth = 0, waterHeight = 0, sampled = "";
 let frame = 0, disposed = false, lost = false, playing = true, dirty = true, previous = 0, elapsed = 0, width = 0, height = 0;
 const started = performance.now();
 const removeMesh = (entry: Entry) => { if (entry.mesh) { entry.mesh.material.uniforms.uSurface.value.dispose(); entry.mesh.material.dispose(); entry.mesh = undefined; } delete entry.host.dataset.glassState; };
 const fragment = `uniform sampler2D uSurface; uniform float uRefractionScale; varying vec2 vUv;\n${liquidLetterFragment}`
  .replace("void main(){", "void main(){ vec4 surfaceSample=texture2D(uSurface,vUv); if(surfaceSample.a<.002) discard;")
  .replace("vec3 n=normalize(vNormal);", "vec3 n=normalize(surfaceSample.rgb*2.-1.);")
  .replace("vec2 uv=clamp(screen+bend", "bend*=uRefractionScale; vec2 uv=clamp(screen+bend")
  .replace("gl_FragColor=vec4(color,alpha);", "gl_FragColor=vec4(color,alpha*surfaceSample.a);");
 function material(entry: Entry, bounds: DOMRect) {
  const built = buildGlyphSurface(entry.specimen, bounds.width); entry.width = bounds.width;
  return new THREE.ShaderMaterial({ transparent: true, toneMapped: false, depthTest: false, depthWrite: false,
   uniforms: {
    uSurface: { value: built.texture }, uWorldSize: { value: new THREE.Vector2(built.worldWidth, built.worldHeight) }, uRefractionScale: { value: .3 },
    uWater: { value: texture }, uWaterEdge: { value: 0 }, uField: { value: new THREE.Vector3(.5, .5, 1) }, uSize: { value: new THREE.Vector2(bounds.width, bounds.height) },
    uViewport: { value: new THREE.Vector2(width, height) }, uOrigin: { value: new THREE.Vector2() }, uHeight: { value: bounds.height }, uDpr: { value: renderer.getPixelRatio() },
    uTime: { value: 0 }, uEmerge: { value: 1 }, uEdgeBoost: { value: innerWidth <= 800 ? 2.45 : 1.12 }, uRipple: { value: new THREE.Vector2() }, uHover: { value: 0 }, uBounds: { value: new THREE.Vector2() },
   },
   vertexShader: `uniform vec2 uWorldSize; varying vec2 vUv; varying vec3 vNormal; varying vec3 vView; varying vec3 vPosition;
    void main(){vUv=uv;vNormal=vec3(0.,0.,1.);vView=vec3(0.,0.,1.);vPosition=vec3((uv-.5)*uWorldSize,0.);gl_Position=vec4(position.xy,0.,1.);}`,
   fragmentShader: fragment,
  });
 }
 function draw(now: number) {
  frame = 0; if (disposed || lost || document.hidden) return;
  if (!entries.size) { renderer.setScissorTest(false); renderer.clear(); return; }
  const dt = previous ? Math.min(.1, (now - previous) / 1000) : 1 / 60; previous = now;
  if (playing) elapsed += dt;
  water = document.querySelector<HTMLCanvasElement>("[data-water-canvas]");
  const waterReady = water?.dataset.ready === "true";
  if (!waterReady) { if (now - started > 5000) { for (const entry of entries) entry.host.dataset.glassState = "unavailable"; } else wake(); return; }
  if (!texture || water!.width !== waterWidth || water!.height !== waterHeight) {
   texture?.dispose(); texture = new THREE.CanvasTexture(water!); texture.colorSpace = THREE.NoColorSpace; texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false;
   waterWidth = water!.width; waterHeight = water!.height; dirty = true;
  }
  if (width !== innerWidth || height !== innerHeight) {
   width = innerWidth; height = innerHeight; renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2, Math.sqrt(4500000 / (width * height)))); renderer.setSize(width, height, false); dirty = true;
  }
  const waterChanged = sampled !== water!.dataset.frame;
  if (waterChanged) { texture.needsUpdate = true; sampled = water!.dataset.frame || ""; }
  if (!dirty && !waterChanged && !playing) return;
  dirty = false;
  renderer.setScissorTest(false); renderer.setViewport(0, 0, width, height); renderer.clear(); renderer.setScissorTest(true);
  let builtThisFrame = false, pending = false;
  const visible: Entry[] = [];
  for (const entry of entries) {
   const bounds = entry.host.getBoundingClientRect();
   if (!bounds.width || bounds.bottom <= 0 || bounds.top >= height) continue;
   visible.push(entry); entry.seen = now;
   if (entry.mesh && Math.abs(entry.width - bounds.width) > 80) removeMesh(entry);
   if (!entry.mesh) {
    if (builtThisFrame) { pending = true; continue; }
    try { entry.mesh = new THREE.Mesh(plane, material(entry, bounds)); builtThisFrame = true; }
    catch { entry.host.dataset.glassState = "unavailable"; continue; }
   }
   const u = entry.mesh.material.uniforms;
   const over = pointer.x >= bounds.left && pointer.x <= bounds.right && pointer.y >= bounds.top && pointer.y <= bounds.bottom;
   entry.hover += ((over && playing ? 1 : 0) - entry.hover) * (1 - Math.exp(-dt * 7));
   u.uHover.value = entry.hover; u.uTime.value = elapsed; u.uWater.value = texture; u.uWaterEdge.value=Number(water!.dataset.waterEdge||0); u.uViewport.value.set(width, height); u.uDpr.value = renderer.getPixelRatio(); u.uEdgeBoost.value = 1.4;
   u.uRefractionScale.value = Math.min(.42, Math.max(.12, bounds.width / width * .42));
   u.uSize.value.set(bounds.width, bounds.height); u.uHeight.value = bounds.height;
   // gl_FragCoord is already in viewport coordinates in this shared canvas.
   u.uOrigin.value.set(0, 0); u.uHeight.value = height;
   if (over) u.uRipple.value.lerp(new THREE.Vector2(((pointer.x - bounds.left) / bounds.width - .5) * u.uWorldSize.value.x, (.5 - (pointer.y - bounds.top) / bounds.height) * u.uWorldSize.value.y), 1 - Math.exp(-dt * 14));
   renderer.setViewport(bounds.left, height - bounds.bottom, bounds.width, bounds.height);
   renderer.setScissor(Math.max(0, bounds.left), Math.max(0, height - bounds.bottom), Math.min(width, bounds.right) - Math.max(0, bounds.left), Math.min(height, bounds.bottom) - Math.max(0, bounds.top));
   scene.add(entry.mesh); renderer.render(scene, camera); scene.remove(entry.mesh); entry.host.dataset.glassState = "ready";
  }
  // A single context and a bounded surface cache serve the whole 100-font page.
  const cached = [...entries].filter(entry => entry.mesh).sort((a, b) => b.seen - a.seen);
  for (const entry of cached.slice(12)) if (!visible.includes(entry)) removeMesh(entry);
  canvas.dataset.surfaces = String([...entries].filter(entry => entry.mesh).length); canvas.dataset.frames = String(Number(canvas.dataset.frames || 0) + 1);
  if (playing || pending) { dirty = pending; wake(); }
 }
 function wake() { if (!frame && !disposed && !lost && !document.hidden) frame = requestAnimationFrame(draw); }
 function invalidate() { dirty = true; wake(); }
 function point(event: PointerEvent) { pointer.set(event.clientX, event.clientY); invalidate(); }
 function leave() { pointer.set(-9999, -9999); invalidate(); }
 function contextLost(event: Event) { event.preventDefault(); lost = true; cancelAnimationFrame(frame); frame = 0; for (const entry of entries) entry.host.dataset.glassState = "unavailable"; }
 function restored() { lost = false; invalidate(); }
 canvas.addEventListener("webglcontextlost", contextLost); canvas.addEventListener("webglcontextrestored", restored);
 window.addEventListener("pointermove", point, { passive: true }); window.addEventListener("pointerout", leave); window.addEventListener("scroll", invalidate, { passive: true }); window.addEventListener("resize", invalidate); window.addEventListener("madagin:water-ready", invalidate); document.addEventListener("visibilitychange", invalidate);
 const resizer = new ResizeObserver(invalidate); resizer.observe(container); wake();
 return {
  register(host, specimen) { const entry: Entry = { host, specimen, width: 0, seen: 0, hover: 0 }; entries.add(entry); invalidate(); return () => { removeMesh(entry); entries.delete(entry); invalidate(); }; },
  setPlaying(value) { playing = value; invalidate(); },
  dispose() { disposed = true; cancelAnimationFrame(frame); resizer.disconnect(); for (const entry of entries) removeMesh(entry); entries.clear(); plane.dispose(); texture?.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove(); window.removeEventListener("pointermove", point); window.removeEventListener("pointerout", leave); window.removeEventListener("scroll", invalidate); window.removeEventListener("resize", invalidate); window.removeEventListener("madagin:water-ready", invalidate); document.removeEventListener("visibilitychange", invalidate); canvas.removeEventListener("webglcontextlost", contextLost); canvas.removeEventListener("webglcontextrestored", restored); },
 };
}

