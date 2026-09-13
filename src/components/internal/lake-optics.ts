import {DoubleSide, Matrix4, ShaderMaterial, Vector3} from "three";
import {AERIAL_GLSL} from "./aerial-perspective";
import {LAKE_SHORE_GLSL} from "./lake-shore";

export const LAKE_OPTICS_VERSION = "lake-optics-4";

// An authored sheltered-water spectrum in world metres. Individual travelling
// modes use gravity dispersion; this is not a fluid or wind simulation.
const LAKE_WIND = `
vec2 lakeWindSlope(vec2 p,float depth) {
  vec2 slope=vec2(0.);
  for(int i=0;i<9;i++) {
    float index=float(i);
    float angle=-.48+sin(index*2.399+1.7)*1.4;
    vec2 direction=vec2(cos(angle),sin(angle));
    float k=.9+pow(index*.43,1.35);
    float phase=dot(p,direction)*k-sqrt(9.81*k)*uTime+index*2.13;
    float pixel=fwidth(phase);
    float resolved=exp(-.42*pixel*pixel);
    slope+=direction*cos(phase)*.012*mix(.8,1.,sin(index*1.91)*.5+.5)*resolved;
  }
  float exposure=.78+.22*sin(p.x*.026+p.y*.013)*sin(p.y*.039-p.x*.016);
  return slope*exposure*mix(.22,1.,smoothstep(.08,1.8,depth));
}
`;

export function createLakeWaterMaterial(sun:Vector3) {
  return new ShaderMaterial({name:"Madagin sheltered lake with registered reflections",side:DoubleSide,transparent:true,depthWrite:true,
    uniforms:{uTime:{value:0},uSunDirection:{value:sun.clone()},uLakeReflection:{value:null},uLakeReflectionMatrix:{value:new Matrix4()},uLakeReflectionReady:{value:0}},
    vertexShader:`uniform float uTime;varying vec3 vWorld;${LAKE_SHORE_GLSL}
    void main(){
      vec3 p=position;float depth=max(0.,lakeShore(p.xz).y);
      float envelope=smoothstep(.25,1.6,depth);
      // Sub-grid capillary waves affect normals, not the coarse radial mesh.
      p.y+=(sin(p.x*.034+p.z*.021-uTime*.63)*.035
        +sin(p.x*-.019+p.z*.044-uTime*.69+1.3)*.022)*envelope;
      vec4 w=modelMatrix*vec4(p,1.);vWorld=w.xyz;
      gl_Position=projectionMatrix*viewMatrix*w;
    }`,
    fragmentShader:`uniform float uTime;uniform vec3 uSunDirection;
    uniform sampler2D uLakeReflection;uniform mat4 uLakeReflectionMatrix;uniform float uLakeReflectionReady;
    varying vec3 vWorld;${LAKE_SHORE_GLSL}${AERIAL_GLSL}${LAKE_WIND}
    void main(){
      float depth=max(0.,lakeShore(vWorld.xz).y);if(depth<=.002)discard;
      vec2 slope=lakeWindSlope(vWorld.xz,depth);
      vec3 n=normalize(vec3(-slope.x,1.,-slope.y));
      vec3 viewDirection=normalize(cameraPosition-vWorld);
      float cosine=max(.02,dot(n,viewDirection));
      float reflectance=.0204+.9796*pow(1.-cosine,5.);
      // Refract the viewing ray into the water (n=1.333). Grazing air views
      // don't take an arbitrarily long path through a shallow submerged shelf.
      float waterCosine=sqrt(1.-(1.-cosine*cosine)/(1.333*1.333));
      float pathLength=depth/waterCosine;
      // Composite over the actual shaded basin bed and submerged rocks, which
      // already contain the terrain's normals and sediment variation. A single
      // extinction coefficient is an approximation, not spectral refraction.
      float transmission=exp(-.46*pathLength);
      vec3 column=vec3(.014,.031,.026)*(1.-transmission);
      // Project the reflected direction, not a small displacement of the water
      // point. With a flat normal this is the ray from the mirrored camera to
      // the surface; a wave changes its angle at every viewing distance.
      vec3 ray=reflect(-viewDirection,n);
      vec4 projected=uLakeReflectionMatrix*vec4(ray,0.);
      vec2 reflectionUv=projected.xy/projected.w;
      // Unresolved wave slopes integrate neighbouring reflection directions.
      // This footprint belongs only to water, not to the visible landscape.
      vec2 pixel=max(fwidth(reflectionUv)*.8,vec2(.0014,.0008));
      vec2 sampleUv=clamp(reflectionUv,vec2(.003),vec2(.997));
      vec3 reflected=(texture2D(uLakeReflection,sampleUv+pixel).rgb
        +texture2D(uLakeReflection,sampleUv-pixel).rgb
        +texture2D(uLakeReflection,sampleUv+vec2(pixel.x,-pixel.y)).rgb
        +texture2D(uLakeReflection,sampleUv+vec2(-pixel.x,pixel.y)).rgb)*.25;
      vec3 sky=mix(vec3(.22,.34,.38),vec3(.046,.14,.23),smoothstep(-.05,.85,ray.y));
      float edge=min(min(reflectionUv.x,reflectionUv.y),min(1.-reflectionUv.x,1.-reflectionUv.y));
      float valid=smoothstep(.002,.016,edge)*step(.001,projected.w)*uLakeReflectionReady;
      vec3 environment=mix(sky,reflected,valid);
      float fresnel=clamp(reflectance,.0204,.94);
      float opacity=1.-(1.-fresnel)*transmission;
      vec3 color=(column*(1.-fresnel)+environment*fresnel)/max(.001,opacity);
      float glint=pow(max(0.,dot(reflect(-uSunDirection,n),viewDirection)),180.);
      color+=vec3(.83,.77,.64)*glint*.075;
      gl_FragColor=vec4(aerialPerspective(color,vWorld),opacity*smoothstep(.005,.12,depth));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
}
