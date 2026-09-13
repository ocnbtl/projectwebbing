import {lakeInletCut, LAKE_INLET_GLSL} from "./channel-profile";

// Authored basin, not a surveyed Hawaiian lake. One boundary/bed profile drives
// terrain, surface optics and wet-ground material. Source assets remain intact.
export const LAKE_SHORE_VERSION = "lake-bank-3";
export const LAKE_CENTER = {x:-2.04,z:-884.765} as const;
export const LAKE_RADIUS = {x:132.4,z:94.6} as const;
export const LAKE_WATER_LEVEL = -47.9439;
function lakeBoundaryFeature(angle: number, center: number, width: number) {
  const wrappedDistance = Math.atan2(Math.sin(angle - center), Math.cos(angle - center));
  return Math.exp(-0.5 * Math.pow(wrappedDistance / width, 2));
}

export function lakeBoundaryScale(angle: number) {
  const broadBasin = 1
    + Math.sin(angle * 2 - 0.4) * 0.135
    + Math.sin(angle * 3 + 0.9) * 0.082
    + Math.sin(angle * 5 - 1.3) * 0.034;
  // Broad paired coves and bedrock spurs interrupt both silhouettes resolved
  // throughout the natural Lake-to-Waterfall rail. Their angular widths keep
  // each feature tens of metres wide, so this remains one erosion-shaped basin
  // rather than the serrated shoreline produced by the rejected AB3 pass.
  const erodedNearBank =
    - lakeBoundaryFeature(angle, 0.15, 0.48) * 0.24
    - lakeBoundaryFeature(angle, 1.15, 0.28) * 0.15
    - lakeBoundaryFeature(angle, 2.45, 0.34) * 0.12
    + lakeBoundaryFeature(angle, 2.92, 0.22) * 0.07;
  const erodedFarBank =
    - lakeBoundaryFeature(angle, -2.82, 0.22) * 0.17
    + lakeBoundaryFeature(angle, -2.38, 0.2) * 0.17
    - lakeBoundaryFeature(angle, -1.92, 0.23) * 0.2
    + lakeBoundaryFeature(angle, -1.46, 0.21) * 0.16
    - lakeBoundaryFeature(angle, -0.98, 0.24) * 0.16
    + lakeBoundaryFeature(angle, -0.54, 0.2) * 0.1;
  // Bedrock joints interrupt the broad coves at 5–25 metre scales. Keep the
  // inlet's angular sector fixed so the river mouth retains its shared join.
  const mouth = 1 - lakeBoundaryFeature(angle, 1.35, .42);
  const joints = (Math.sin(angle*9+.7)*.024 + Math.sin(angle*17-1.1)*.014
    + Math.sin(angle*27+.4)*.006)*mouth;
  return Math.max(0.69, broadBasin + erodedNearBank + erodedFarBank + joints);
}

export function lakeBoundaryDistance(x: number, z: number) {
  const nx = (x - LAKE_CENTER.x) / LAKE_RADIUS.x;
  const nz = (z - LAKE_CENTER.z) / LAKE_RADIUS.z;
  const angle = Math.atan2(nz, nx);
  return Math.hypot(nx, nz) / lakeBoundaryScale(angle);
}


export function lakeBedLevel(x:number,z:number,distance=lakeBoundaryDistance(x,z)) {
  const angle=Math.atan2((z-LAKE_CENTER.z)/LAKE_RADIUS.z,(x-LAKE_CENTER.x)/LAKE_RADIUS.x);
  const breakup=Math.sin(angle*5-.7)*.56+Math.sin(angle*11+1.8)*.24+Math.sin(x*.071-z*.037)*.18;
  const offset=distance-1;
  const core=Math.max(0,Math.min(1,(.82-distance)/.64));
  const shelf = .09 + .075*(.5+.5*Math.sin(angle*3+.8));
  const rock = .5+.5*Math.sin(angle*4-.6);
  const bank = Math.min(1,Math.max(0,offset)/.055);
  const upperBank = Math.min(1,Math.max(0,offset-.055)/.185);
  const bed=offset<=0
    ? LAKE_WATER_LEVEL-.035-Math.pow(Math.min(1,-offset/shelf),.88)*(2.7+rock*1.2)-core*core*(3-2*core)*(4.8-rock*1.2)
    : LAKE_WATER_LEVEL-.035+bank*bank*(3-2*bank)*(2.1+rock*3.3)
      +upperBank*(2.8+breakup);
  if(z<=-835||z>=-764)return bed;
  const inlet=lakeInletCut(x,z);
  return bed+(Math.min(bed,LAKE_WATER_LEVEL-inlet.depth)-bed)*inlet.weight;
}
// GLSL counterpart; the verification runner checks GPU/CPU parity around all coves.
export const LAKE_SHORE_GLSL = `
${LAKE_INLET_GLSL}
float lakeCove(float angle,float center,float width) {
  float delta=atan(sin(angle-center),cos(angle-center));
  return exp(-.5*pow(delta/width,2.0));
}
vec2 lakeShore(vec2 p) {
  vec2 coordinate=(p-vec2(-2.04,-884.765))/vec2(132.4,94.6);
  float a=atan(coordinate.y,coordinate.x);
  float edge=max(.69,1.0+sin(a*2.0-.4)*.135+sin(a*3.0+.9)*.082+sin(a*5.0-1.3)*.034
    -lakeCove(a,.15,.48)*.24-lakeCove(a,1.15,.28)*.15-lakeCove(a,2.45,.34)*.12+lakeCove(a,2.92,.22)*.07
    -lakeCove(a,-2.82,.22)*.17+lakeCove(a,-2.38,.2)*.17-lakeCove(a,-1.92,.23)*.2+lakeCove(a,-1.46,.21)*.16
    -lakeCove(a,-.98,.24)*.16+lakeCove(a,-.54,.2)*.1
    +(sin(a*9.+.7)*.024+sin(a*17.-1.1)*.014+sin(a*27.+.4)*.006)*(1.-lakeCove(a,1.35,.42)));
  float d=length(coordinate)/edge;
  float offset=d-1.0;
  float breakup=sin(a*5.0-.7)*.56+sin(a*11.0+1.8)*.24+sin(p.x*.071-p.y*.037)*.18;
  float core=clamp((.82-d)/.64,0.,1.);
  float shelf=.09+.075*(.5+.5*sin(a*3.+.8));
  float rock=.5+.5*sin(a*4.-.6);
  float bank=clamp(offset/.055,0.,1.),upperBank=clamp((offset-.055)/.185,0.,1.);
  float depth=offset<=0.0?.035+pow(min(1.0,-offset/shelf),.88)*(2.7+rock*1.2)+core*core*(3.-2.*core)*(4.8-rock*1.2)
    :.035-bank*bank*(3.-2.*bank)*(2.1+rock*3.3)-upperBank*(2.8+breakup);
  return vec2(d,inletBedDepth(p.x,p.y,depth));
}`;
