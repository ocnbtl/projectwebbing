import type {MeshStandardMaterial} from "three";

// A bounded authored humid-air response. It uses actual world distance and
// height, never screen-space blur, depth-of-field, or a camera-facing veil.
export const AERIAL_PERSPECTIVE_VERSION="aerial-perspective-1";
export const AERIAL_GLSL=`
vec3 aerialPerspective(vec3 color,vec3 world) {
  float distanceInAir=max(0.,distance(cameraPosition,world)-180.);
  float height=max(-40.,(cameraPosition.y+world.y)*.5);
  float humidity=.5+.5*exp(-max(0.,height)/180.);
  float amount=min(.38,1.-exp(-distanceInAir*.00046*humidity));
  vec3 direction=normalize(world-cameraPosition);
  float sunward=pow(max(0.,dot(direction,normalize(vec3(-.78,.24,.56)))),6.);
  vec3 air=mix(vec3(.16,.245,.28),vec3(.25,.29,.29),sunward*.5);
  return mix(color,air,amount);
}`;

const prepared=new WeakSet<MeshStandardMaterial>();
export function attachAerialPerspective(material:MeshStandardMaterial) {
  if(prepared.has(material))return;prepared.add(material);
  const compile=material.onBeforeCompile,cacheKey=material.customProgramCacheKey();
  // Preserve each asset's normal, UV, wind and lighting customization. All
  // standard materials then cross the same air instead of leaving dark props.
  material.onBeforeCompile=(shader,renderer)=>{
    compile.call(material,shader,renderer);
    shader.vertexShader="varying vec3 vAerialWorld;\n"+shader.vertexShader.replace("#include <worldpos_vertex>",`#include <worldpos_vertex>
      vec4 aerialPosition=vec4(transformed,1.);
      #ifdef USE_INSTANCING
      aerialPosition=instanceMatrix*aerialPosition;
      #endif
      vAerialWorld=(modelMatrix*aerialPosition).xyz;`);
    shader.fragmentShader="varying vec3 vAerialWorld;\n"+AERIAL_GLSL+"\n"+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace("#include <opaque_fragment>","outgoingLight=aerialPerspective(outgoingLight,vAerialWorld);\n#include <opaque_fragment>").replace("#include <fog_fragment>","");
  };
  material.customProgramCacheKey=()=>cacheKey+AERIAL_PERSPECTIVE_VERSION;
  material.needsUpdate=true;
}
