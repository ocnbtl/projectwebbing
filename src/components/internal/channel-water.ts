import {DoubleSide, Matrix4, ShaderMaterial, Vector3} from "three";
import {LAKE_SHORE_GLSL} from "./lake-shore";

export const WATER_REFLECTION_GLSL = `
uniform sampler2D uLakeReflection;
uniform mat4 uLakeReflectionMatrix;
uniform float uLakeReflectionReady;
vec3 waterEnvironment(vec3 world,vec3 normal,vec3 fallback,float reliability) {
  vec4 projected=uLakeReflectionMatrix*vec4(world,1.);
  vec2 uv=projected.xy/projected.w+normal.xz*.045;
  float inside=step(.004,uv.x)*step(.004,uv.y)*step(uv.x,.996)*step(uv.y,.996)*step(0.,projected.w);
  uv=clamp(uv,vec2(.004),vec2(.996));
  vec2 footprint=vec2(.0014,.001);
  vec3 scene=(texture2D(uLakeReflection,uv+footprint).rgb+texture2D(uLakeReflection,uv-footprint).rgb
    +texture2D(uLakeReflection,uv+vec2(footprint.x,-footprint.y)).rgb
    +texture2D(uLakeReflection,uv+vec2(-footprint.x,footprint.y)).rgb)*.25;
  return mix(fallback,scene,uLakeReflectionReady*inside*reliability);
}`;

export function waterReflectionUniforms() {
  return {uLakeReflection:{value:null},uLakeReflectionMatrix:{value:new Matrix4()},uLakeReflectionReady:{value:0}};
}

export function createChannelWaterMaterial(sun:Vector3,lake:ShaderMaterial) {
  return new ShaderMaterial({
    name:"Madagin depth-coupled flowing channels",transparent:true,depthWrite:false,side:DoubleSide,
    uniforms:{uTime:{value:0},uSunDirection:{value:sun},
      uLakeReflection:lake.uniforms.uLakeReflection,
      uLakeReflectionMatrix:lake.uniforms.uLakeReflectionMatrix,
      uLakeReflectionReady:lake.uniforms.uLakeReflectionReady},
    vertexShader:`attribute vec2 flow;attribute float waterDepth;
      varying vec3 vWorld;varying vec2 vFlow;varying float vDepth;
      void main(){vec4 p=modelMatrix*vec4(position,1.);vWorld=p.xyz;vFlow=flow;vDepth=waterDepth;gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader:`uniform float uTime;uniform vec3 uSunDirection;
      varying vec3 vWorld;varying vec2 vFlow;varying float vDepth;
      ${WATER_REFLECTION_GLSL}
      ${LAKE_SHORE_GLSL}
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
      void main(){
        vec2 shore=lakeShore(vWorld.xz);
        float mouth=(1.-smoothstep(1.,1.09,shore.x))*smoothstep(-835.,-818.,vWorld.z);
        float depth=max(.015,mix(vDepth,max(.015,shore.y),mouth));
        vec3 n=normalize(cross(dFdx(vWorld),dFdy(vWorld)));if(n.y<0.)n=-n;
        // Crests advect in metres along the actual curved channel, breaking up
        // across the flow instead of scrolling a world-axis texture upstream.
        float movement=vFlow.y-uTime*(.85+.38/(depth+.35));
        float flowPatch=noise(vec2(vFlow.x*.34,movement*.23));
        float crest=sin(movement*.72+sin(vFlow.x*.33)*1.2+flowPatch*2.);
        float secondary=cos(movement*.49-vFlow.x*.71);
        float footprint=length(fwidth(vWorld.xz));
        float detail=1.-smoothstep(.35,2.4,footprint);
        n=normalize(n+vec3(crest*.035,0.,secondary*.027)*detail);
        vec3 view=normalize(cameraPosition-vWorld);
        float facing=max(.12,dot(n,view));
        vec3 transmission=exp(-vec3(.48,.24,.17)*depth/facing);
        float gravel=noise(vWorld.xz*.63)*.62+noise(vWorld.xz*1.9)*.38;
        vec3 bed=mix(vec3(.085,.074,.044),vec3(.15,.13,.079),gravel);
        vec3 column=bed*transmission+vec3(.013,.034,.032)*(1.-transmission);
        vec3 reflectedDirection=reflect(-view,n);
        vec3 sky=mix(vec3(.032,.065,.039),vec3(.2,.32,.36),smoothstep(-.1,.65,reflectedDirection.y));
        // The lower reach shares the lake plane. Fade to rough sky response
        // as elevation departs from that plane; never reflect a high tributary
        // using a knowingly wrong mirror height.
        float nearLake=1.-smoothstep(.25,1.6,abs(vWorld.y+47.9439));
        vec3 environment=waterEnvironment(vWorld,n,sky,nearLake);
        float fresnel=.025+.975*pow(1.-max(0.,dot(n,view)),5.);
        vec3 color=mix(column,environment,clamp(fresnel+.08*(1.-transmission.g),.025,.83));
        float glint=pow(max(dot(reflect(-uSunDirection,n),view),0.),84.);
        color+=vec3(.8,.76,.62)*glint*.035*detail;
        float shallow=smoothstep(.12,.4,depth)*(1.-smoothstep(.6,1.1,depth));
        float broken=smoothstep(.6,.84,flowPatch)*pow(max(0.,crest),10.)*shallow*detail;
        color=mix(color,vec3(.38,.44,.36),broken*.28);
        gl_FragColor=vec4(color,smoothstep(.01,.16,depth));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
