import {DoubleSide, ShaderMaterial, Vector3} from "three";

// Authored erosional basin in the assembled world; not surveyed bathymetry.
// One datum and footprint govern the active terrain, water and plant exclusion.
export const PLUNGE_BASIN_VERSION = "plunge-basin-1";
export const PLUNGE_POOL_CENTER = {x:151,z:-696} as const;
export const PLUNGE_POOL_RADIUS = {x:28,z:21} as const;
export const PLUNGE_POOL_LEVEL = -44.08;
export function plungeBoundaryScale(angle:number) {
  return 1 + Math.sin(angle*3+.6)*.085 + Math.sin(angle*5-.9)*.045;
}
export function plungeDistance(x:number,z:number) {
  const nx=(x-151)/28,nz=(z+696)/21;
  return Math.hypot(nx,nz)/plungeBoundaryScale(Math.atan2(nz,nx));
}
export function plungeBedLevel(x:number,z:number) {
  const d=plungeDistance(x,z);
  // Deep scour beneath the falling jet, a gentler depositional near shelf,
  // and a short irregular rock bank. The outlet is incised separately.
  const scour=Math.exp(-((x-154)**2+(z+704)**2)/180)*1.6;
  return PLUNGE_POOL_LEVEL + (d<=1
    ? -(1-Math.pow(d,3))*(2.1+scour)
    : Math.min(3,(d-1)*10));
}
export function plungeTerrainWeight(x:number,z:number) {
  if(Math.abs(x-151)>46||Math.abs(z+696)>35)return 0;
  const t=Math.max(0,Math.min(1,(plungeDistance(x,z)-1.08)/.32));
  return 1-t*t*(3-2*t);
}
export function isPlungeWetPlant(x:number,y:number,z:number) {
  return Math.abs(x-151)<43 && Math.abs(z+696)<33
    && Number.isFinite(y) && plungeDistance(x,z)<1.12;
}
export const PLUNGE_BASIN_GLSL = `
vec2 plungeBasin(vec2 p) {
  vec2 q=(p-vec2(151.0,-696.0))/vec2(28.0,21.0);
  float a=atan(q.y,q.x);
  float d=length(q)/(1.0+sin(a*3.0+.6)*.085+sin(a*5.0-.9)*.045);
  vec2 jet=p-vec2(154.0,-704.0);
  float scour=exp(-dot(jet,jet)/180.0)*1.6;
  return vec2(d,d<=1.0?(1.0-pow(d,3.0))*(2.1+scour):-min(3.0,(d-1.0)*10.0));
}`;

export function createPlungeWaterMaterial(sun:Vector3) {
  return new ShaderMaterial({
    name:"Madagin contained plunge water",transparent:true,depthWrite:true,
    side:DoubleSide,uniforms:{uTime:{value:0},uSunDirection:{value:sun}},
    vertexShader:`varying vec3 vWorld;
      void main(){vec4 p=modelMatrix*vec4(position,1.0);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader:`
      uniform float uTime;uniform vec3 uSunDirection;varying vec3 vWorld;
      ${PLUNGE_BASIN_GLSL}
      void main(){
        vec2 basin=plungeBasin(vWorld.xz);float depth=max(0.0,basin.y);
        if(depth<=.002)discard;
        vec2 jet=vWorld.xz-vec2(154.0,-704.0);float r=length(jet);
        vec2 direction=jet/max(r,.01);
        // Radial disturbances travel away from the impact, fading into the
        // slower cross ripples. The shore stays fixed, with no expanding disc.
        float pulse=cos(r*2.1-uTime*3.2+sin(jet.x*.41)*.35);
        float impact=exp(-r/13.0)*smoothstep(.15,1.0,depth);
        vec2 slope=direction*pulse*.065*impact
          +vec2(cos(vWorld.x*.83+vWorld.z*.29-uTime*.46),sin(vWorld.z*.91-vWorld.x*.37+uTime*.39))*.012;
        vec3 n=normalize(vec3(slope.x,1.0,slope.y));
        vec3 view=normalize(cameraPosition-vWorld);
        float fresnel=.035+.965*pow(1.0-max(dot(n,view),0.0),4.0);
        vec3 color=mix(vec3(.047,.071,.05),vec3(.003,.024,.025),1.0-exp(-depth*1.2));
        vec3 reflection=mix(vec3(.025,.066,.049),vec3(.22,.34,.37),smoothstep(-.1,.7,reflect(-view,n).y));
        color=mix(color,reflection,fresnel*.68);
        float glint=pow(max(dot(reflect(-uSunDirection,n),view),0.0),100.0);
        color+=vec3(.65,.71,.63)*glint*.14;
        float broken=sin(jet.x*1.3+sin(jet.y*.72-uTime*.8))*sin(jet.y*1.6+uTime*.93);
        float foam=pow(max(0.0,pulse),8.0)*smoothstep(.1,.8,broken)*exp(-r/7.0);
        color=mix(color,vec3(.48,.56,.5),foam*.3);
        gl_FragColor=vec4(color,(1.0-exp(-depth*3.0))*mix(.94,1.0,fresnel));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
