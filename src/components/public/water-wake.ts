/** Damped, linear shallow-water height field. One CPU field feeds both GL contexts.
 * Fixed CFL-bounded substeps keep propagation stable on slow/mobile frames.
 * The source is the actual glyph silhouette, not an expanding circular graphic.
 */
export class WaterWake {
 readonly width: number;
 readonly height: number;
 readonly data: Uint8Array;
 private displacement: Float32Array;
 private velocity: Float32Array;
 private nextVelocity: Float32Array;
 private next: Float32Array;
 private softened: Float32Array;
 private emitter: Float32Array;
 private progress = 1;
 private previousSource: Float32Array;
 private forcing: Float32Array;
 private edgeBand: Uint8Array;
 private sources: { index: number; delay: number; pace:number; gain:number; sinA: number; cosA: number; sinB: number; cosB: number }[] = [];
 // Stable for this surface's lifetime. Local contact patches rise at different
 // depths, including along a single glyph; no row-wide release or repeated ring.
 private contactSeeds=Array.from({length:23},()=>({sample:Math.random(),phase:Math.random()*Math.PI*2,depth:Math.random(),spread:.7+Math.random()*.9}));
 private resting = false;
 private time = 0;
 private restAmount = 0;
 private waveScale = 1;
 private restingGain = 1;
 revision = 0;
 energy = 0;
 peakSlope = 0;
 constructor(readonly aspect: number) {
  this.height = Math.max(8, Math.round(320 / Math.max(1, aspect)));
  this.width = Math.max(8, Math.round(this.height * aspect));
  const count = this.width * this.height;
  this.data = new Uint8Array(count * 4);
  this.displacement = new Float32Array(count); this.velocity = new Float32Array(count); this.nextVelocity = new Float32Array(count);
  this.next = new Float32Array(count); this.softened = new Float32Array(count); this.emitter = new Float32Array(count); this.previousSource = new Float32Array(count);
  this.forcing = new Float32Array(count); this.edgeBand = new Uint8Array(count);
  for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) this.edgeBand[y * this.width + x] = Math.min(12, x, y, this.width - 1 - x, this.height - 1 - y);
  this.encode();
 }
 setMask(ink: Uint8ClampedArray, width: number, height: number, rect: { x: number; y: number; width: number; height: number }) {
  const { width: w, height: h } = this;
  // Keep wave size relative to the mark, including narrow portrait screens.
  this.waveScale = Math.max(.4, Math.min(1.2, rect.width * this.aspect / 1.38));
  const raw = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
   const u = (x / (w - 1) - rect.x) / rect.width, v = ((1 - y / (h - 1)) - rect.y) / rect.height;
   if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
   // Small box footprint preserves narrow serifs at simulation resolution.
   let value = 0;
   for (const ox of [-.3, 0, .3]) for (const oy of [-.3, 0, .3]) {
    const sx = Math.max(0, Math.min(width - 1.001, u * width + ox * width / (w * rect.width)));
    const sy = Math.max(0, Math.min(height - 1.001, v * height + oy * height / (h * rect.height)));
    const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy;
    const a=ink[(iy*width+ix)*4+3],b=ink[(iy*width+ix+1)*4+3];
    const c=ink[((iy+1)*width+ix)*4+3],d=ink[((iy+1)*width+ix+1)*4+3];
    value += ((a+(b-a)*fx)*(1-fy)+(c+(d-c)*fx)*fy)/255;
   }
   raw[y * w + x] = value / 9;
  }
  this.emitter.fill(0);
  // Scrolling a footer repositions the mask. Keep the source's current phase:
  // resetting it here reinjected the entire displaced volume every frame.
  this.forcing.fill(0); this.sources = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
   const i = y * w + x;
   // Contact line rather than filled glyphs: a rising serif releases a local
   // meniscus, and the solver carries that disturbance out into open water.
   const lo=Math.min(raw[i],raw[i-1],raw[i+1],raw[i-w],raw[i+w]);
   const hi=Math.max(raw[i],raw[i-1],raw[i+1],raw[i-w],raw[i+w]);
   this.emitter[i] = (hi-lo)*.85+raw[i]*.08;
  }
  // Choose contact patches from the measured ink edge, including the inner
  // counters. Sampling the actual contour avoids sources arranged in rows.
  const candidates: {u:number;v:number}[]=[];
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++)if(this.emitter[y*w+x]>.15)candidates.push({u:(x/(w-1)-rect.x)/rect.width,v:((1-y/(h-1))-rect.y)/rect.height});
  const contacts=this.contactSeeds.map(seed=>({...seed,...(candidates[Math.floor(seed.sample*candidates.length)]??{u:.5,v:.5})}));
  const contour=this.emitter.slice();
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
   const i=y*w+x;
   this.emitter[i]=(contour[i]*4+(contour[i-1]+contour[i+1]+contour[i-w]+contour[i+w])*2+contour[i-w-1]+contour[i-w+1]+contour[i+w-1]+contour[i+w+1])/16;
   const a=x/h*3.7+y/h*2.1,b=y/h*5.3-x/h*1.9;
   if (this.emitter[i] > .0001) {
    const u=(x/(w-1)-rect.x)/rect.width,v=((1-y/(h-1))-rect.y)/rect.height;
    let weight=0,depth=0,phase=0;
    for(const contact of contacts){const falloff=Math.exp(-((u-contact.u)**2*650+(v-contact.v)**2*55)*contact.spread);weight+=falloff;depth+=falloff*contact.depth;phase+=falloff*contact.phase;}
    depth/=Math.max(.001,weight);phase/=Math.max(.001,weight);
    const delay=.005+depth*.22+.018*Math.sin(v*8+phase),pace=1.16+depth*.19,gain=.60+.43*(.5+.5*Math.sin(phase+v*4+u*7));
    this.sources.push({index:i,delay,pace,gain,sinA:Math.sin(a+phase),cosA:Math.cos(a+phase),sinB:Math.sin(b-phase*.7),cosB:Math.cos(b-phase*.7)});
    this.previousSource[i]=this.sourceHeight((this.progress-delay)*pace)*gain;
   }
  }
 }
 setProgress(progress: number) { this.progress = Math.max(0, Math.min(1, progress)); }
 setResting(active: boolean, gain=1) { this.resting = active;this.restingGain=gain; }
 private sourceHeight(progress:number) {
  const smooth=(from:number,to:number)=>{const t=Math.max(0,Math.min(1,(progress-from)/(to-from)));return t*t*(3-2*t);};
  // A single displaced volume and a longer release, not a train of impulses.
  return this.waveScale*.07*smooth(.025,.35)*(1-smooth(.35,.92));
 }
 settle() { this.resting = false; this.restAmount = 0; this.progress = 1; this.previousSource.fill(0); this.displacement.fill(0); this.velocity.fill(0); this.energy = 0; this.encode(); }
 advance(delta: number) {
  const dt = Math.min(.05, Math.max(0, delta));
  if (!dt) return;
  this.time += dt;
  this.restAmount += ((this.resting ? 1 : 0) - this.restAmount) * (1 - Math.exp(-dt * 1.8));
  // A displaced volume rises, releases the meniscus, then settles. Small phase
  // differences along the actual glyph contour avoid one expanding word-shaped blob.
  const sinA=Math.sin(this.time*.83),cosA=Math.cos(this.time*.83),sinB=Math.sin(this.time*1.17),cosB=Math.cos(this.time*1.17);
  for (const point of this.sources) {
   const i=point.index;
   const source = this.sourceHeight((this.progress-point.delay)*point.pace)*point.gain;
   this.displacement[i] += (source - this.previousSource[i]) * this.emitter[i];
   this.previousSource[i] = source;
   this.forcing[i]=this.resting?this.emitter[i]*this.restAmount*this.restingGain*this.waveScale*.105*(point.sinA*cosA-point.cosA*sinA+.43*(point.sinB*cosB-point.cosB*sinB)):0;
  }
  if (this.progress >= 1 && !this.resting && this.energy < 1e-9) return;
  const w = this.width, h = this.height, dx = 1 / (h - 1), speed = .18 * this.waveScale;
  const steps = Math.ceil(dt / (.38 * dx / speed)), step = dt / steps;
  const damping=Float32Array.from({length:13},(_,border)=>Math.exp(-(1.05+(12-border)*.9)*step));
  for (let n = 0; n < steps; n++) {
   let energy = 0;
   for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, center = this.displacement[i];
    // Isotropic nine-point propagation avoids the four-axis grid imprint of
    // the old stencil. Mild viscosity damps unresolved cell-sized vibration.
    const axial=this.displacement[i-1]+this.displacement[i+1]+this.displacement[i-w]+this.displacement[i+w];
    const diagonal=this.displacement[i-w-1]+this.displacement[i-w+1]+this.displacement[i+w-1]+this.displacement[i+w+1];
    const laplacian=(4*axial+diagonal-20*center)/(6*dx*dx);
    // Two passing swells excite separate parts of the silhouette. There is no
    // shared expansion pulse: the damped field propagates the local disturbance.
    const viscous=(this.velocity[i-1]+this.velocity[i+1]+this.velocity[i-w]+this.velocity[i+w]-4*this.velocity[i])/(dx*dx)*.000012;
    this.nextVelocity[i] = (this.velocity[i] + (speed * speed * laplacian + this.forcing[i]+viscous) * step) * damping[this.edgeBand[i]];
    this.next[i] = center + this.nextVelocity[i] * step;
    energy += this.next[i] ** 2 + this.nextVelocity[i] ** 2 * .02;
   }
   [this.displacement, this.next] = [this.next, this.displacement];[this.velocity,this.nextVelocity]=[this.nextVelocity,this.velocity]; this.energy = energy / (w * h);
  }
  this.encode();
 }
 private encode() {
  const w = this.width, h = this.height, dx = 1 / (h - 1);
  // Reconstruct a smooth optical surface before differentiating it. This
  // suppresses sub-grid ridges instead of magnifying them into bright combs.
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
   const i=y*w+x,d=this.displacement;
   this.softened[i]=(d[i]*4+(d[i-1]+d[i+1]+d[i-w]+d[i+w])*2+d[i-w-1]+d[i-w+1]+d[i+w-1]+d[i+w+1])/16;
  }
  this.peakSlope=0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
   const i = y * w + x, p = i * 4;
   const height = Math.round(32768 + Math.max(-1, Math.min(1, this.softened[i] / .05)) * 32767);
   this.data[p] = height >> 8; this.data[p + 1] = height & 255;
   const gx = (this.softened[y * w + Math.min(w - 1, x + 1)] - this.softened[y * w + Math.max(0, x - 1)]) / (2 * dx);
   const gy = (this.softened[Math.min(h - 1, y + 1) * w + x] - this.softened[Math.max(0, y - 1) * w + x]) / (2 * dx);
   this.peakSlope=Math.max(this.peakSlope,Math.abs(gx),Math.abs(gy));
   this.data[p + 2] = 128 + Math.round(Math.max(-1, Math.min(1, gx / .35)) * 127);
   this.data[p + 3] = 128 + Math.round(Math.max(-1, Math.min(1, gy / .35)) * 127);
  }
  this.revision++;
 }
}

let shared: WaterWake | undefined;
export function getWaterWake() {
 const aspect = innerWidth / innerHeight;
 if (!shared || Math.abs(shared.aspect - aspect) > .01) shared = new WaterWake(aspect);
 return shared;
}

export const wakeGLSL = `
uniform sampler2D uWake;
vec3 waterWake(vec2 uv) {
 vec4 packed=texture2D(uWake,clamp(uv,vec2(.001),vec2(.999)));
 float height=(packed.r*65280.+packed.g*255.-32768.)/32767.*.05;
 return vec3((packed.ba*255.-128.)/127.*.35,height);
}`;
