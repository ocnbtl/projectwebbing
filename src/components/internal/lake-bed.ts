import {DoubleSide, MeshStandardMaterial} from "three";
import {LAKE_SHORE_GLSL} from "./lake-shore";

export const LAKE_BED_VERSION = "lake-bed-light-1";

// The submerged bed participates in the same sun, sky and shadow lighting as
// the dry banks. The water layer transmits this real geometry instead of painting
// a second, uniformly lit sediment image across the surface plane.
export function createLakeBedMaterial() {
  const material=new MeshStandardMaterial({name:LAKE_BED_VERSION,roughness:1,metalness:0,side:DoubleSide});
  material.customProgramCacheKey=()=>LAKE_BED_VERSION;
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vLakeBedWorld;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvLakeBedWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vLakeBedWorld;
      ${LAKE_SHORE_GLSL}
      float lakeBedHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float lakeBedNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(lakeBedHash(i),lakeBedHash(i+vec2(1.,0.)),f.x),mix(lakeBedHash(i+vec2(0.,1.)),lakeBedHash(i+vec2(1.)),f.x),f.y);}
    `).replace('#include <color_fragment>',`#include <color_fragment>
      float bedDepth=max(0.,lakeShore(vLakeBedWorld.xz).y);
      if(bedDepth<=.04)discard;
      float silt=lakeBedNoise(vLakeBedWorld.xz*.075);
      float stone=lakeBedNoise(vLakeBedWorld.xz*.61);
      vec3 sediment=mix(vec3(.064,.057,.039),vec3(.17,.145,.095),silt);
      sediment=mix(sediment,vec3(.058,.060,.047),smoothstep(.62,.85,stone)*.6);
      // Downward irradiance is filtered before the upward water transmission.
      // 0.68 is the refracted cosine for the fixed, shared low-elevation sun.
      diffuseColor.rgb*=sediment*exp(-vec3(.30,.21,.17)*bedDepth/.68);
    `);
  };
  return material;
}
