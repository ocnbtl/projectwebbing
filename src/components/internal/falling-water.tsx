"use client";

import {useFrame} from "@react-three/fiber";
import {useEffect, useMemo, useRef} from "react";
import {BufferGeometry, DoubleSide, Float32BufferAttribute, ShaderMaterial, Vector3} from "three";

import {CASCADE_VERSION, CASCADE_START_Z, cascadeSection, cascadeLevel} from "./cascade-contact";
type Point = {x:number;y:number;z:number};
export const FALLING_WATER = {version:"cascade-breakup-1",gravity:9.81,entrySpeed:2.4} as const;

// The route is authored to follow the retained cliff. Gravity supplies travel
// time along the drop, not a claim of a free-flight or fluid simulation.
export function fallingTravelTime(drop:number) {
  return (Math.sqrt(FALLING_WATER.entrySpeed**2+2*FALLING_WATER.gravity*Math.max(0,drop))-FALLING_WATER.entrySpeed)/FALLING_WATER.gravity;
}

export function createFallingWaterGeometry(top:Point,bottom:Point,lipHalfWidth:number) {
  const positions:number[]=[],uvs:number[]=[],times:number[]=[],aeration:number[]=[],indices:number[]=[];
  const rows=160,columns=40;
  for(let row=0;row<=rows;row++){
    const p=row/rows,z=CASCADE_START_Z+(bottom.z-CASCADE_START_Z)*p,section=cascadeSection(z);
    const centerY=cascadeLevel(section.x,z),before=cascadeSection(z-.3),after=cascadeSection(z+.3);
    const grade=Math.max(0,(cascadeLevel(before.x,z-.3)-cascadeLevel(after.x,z+.3))/.6);
    for(let col=0;col<=columns;col++){
      const angle=col/columns*Math.PI*2,a=Math.cos(angle),envelope=Math.sin(Math.PI*p);
      const width=a<0?section.left:section.right;
      const edge=1+(Math.sin(p*23+a*3.1)*.035+Math.sin(p*47-a*5.4)*.022)*envelope;
      const x=section.x+a*width*edge;
      const lobe=(Math.sin(a*9+p*7)*.12+Math.sin(a*17-p*13)*.06)*envelope;
      const thickness=.14+Math.min(1,grade)*.25;
      positions.push(x,cascadeLevel(x,z)+Math.sin(angle)*thickness+lobe,z);
      uvs.push((a+1)*.5,p);times.push(fallingTravelTime(top.y-centerY));aeration.push(Math.min(1,.15+grade*.55));
      if(row<rows&&col<columns){const i=row*(columns+1)+col;indices.push(i,i+columns+1,i+1,i+1,i+columns+1,i+columns+2);}
    }
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute("position",new Float32BufferAttribute(positions,3));geometry.setAttribute("uv",new Float32BufferAttribute(uvs,2));
  geometry.setAttribute("travelTime",new Float32BufferAttribute(times,1));geometry.setAttribute("aeration",new Float32BufferAttribute(aeration,1));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData.waterfallBody={version:FALLING_WATER.version,guideVersion:CASCADE_VERSION,top,bottom,lipHalfWidthMeters:lipHalfWidth,rows,columns,travelSeconds:fallingTravelTime(top.y-bottom.y),gravity:FALLING_WATER.gravity,entrySpeed:FALLING_WATER.entrySpeed,contactPathAuthored:true,connectedGeometry:true,centralSpineContinuous:true,terrainGuide:true,topology:"Closed cross sections follow the actual headwall guide; local grade controls aeration. Retained source and pool join; no fluid simulation."};
  return geometry;
}
const NOISE=`
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
`;

export function createFallingWaterMaterial(sun:Vector3) {
  return new ShaderMaterial({name:"Madagin gravity-timed falling water",side:DoubleSide,transparent:true,depthWrite:false,uniforms:{uTime:{value:0},uSun:{value:sun.clone()}},
    vertexShader:`uniform float uTime;attribute float travelTime;attribute float aeration;varying float vAir;varying vec2 vUv;varying float vTravel;varying vec3 vWorld;
    void main(){vec3 p=position;float envelope=sin(uv.y*3.14159265);p.x+=sin((travelTime-uTime)*5.+uv.x*13.)*.08*envelope;p.z+=sin((travelTime-uTime)*7.+uv.x*21.)*.06*envelope;vUv=uv;vTravel=travelTime;vAir=aeration;vec4 w=modelMatrix*vec4(p,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`uniform float uTime;uniform vec3 uSun;varying float vAir;varying vec2 vUv;varying float vTravel;varying vec3 vWorld;${NOISE}
    void main(){
      float clock=vTravel-uTime;
      // Broad, advected lobes carry the water mass. Small bubbles are filtered
      // at the pixel footprint instead of drawing a persistent comb of lines.
      float broad=noise(vec2(vUv.x*4.7,clock*4.1));
      float folded=noise(vec2(vUv.x*7.3+broad*1.8,clock*11.7));
      vec2 bubbleUv=vec2(vUv.x*19.+folded,clock*31.);
      float bubble=mix(noise(bubbleUv),.5,smoothstep(.35,1.2,length(fwidth(bubbleUv))));
      float body=smoothstep(.19,.75,broad*.72+folded*.28);
      float air=clamp(vAir+vUv.y*.18,0.,1.)*mix(.35,1.,smoothstep(0.,.12,vUv.y));
      float edgeDistance=min(vUv.x,1.-vUv.x);
      float edge=smoothstep(0.,.025+(.5-folded)*.025,edgeDistance);
      float breakup=smoothstep(.28,.64,broad*.65+folded*.35);
      float alpha=edge*mix(.3+body*.2,.32+body*.32,air)*mix(1.,breakup,.68*air);
      vec3 normal=normalize(cross(dFdx(vWorld),dFdy(vWorld)));
      float light=.82+.18*abs(dot(normal,uSun));
      vec3 color=mix(vec3(.23,.34,.34),vec3(.87,.92,.89),clamp(.16+air*.52+body*.22+bubble*.1,0.,1.))*light;
      if(alpha<.035)discard;gl_FragColor=vec4(color,alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
}

export function createFallingImpactMaterial() {
  return new ShaderMaterial({name:"Madagin advecting impact foam",side:DoubleSide,transparent:true,depthWrite:false,uniforms:{uTime:{value:0}},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float uTime;varying vec2 vUv;${NOISE}
    void main(){
      vec2 p=(vUv-.5)*2.;float r=length(p),a=atan(p.y,p.x);
      // Noise travels outwards in radial coordinates. An angular embedding
      // avoids a seam at +/-pi, and age fades each departing patch.
      vec2 flow=vec2(cos(a)*4.,sin(a)*4.)+vec2(r*7.-uTime*.85,r*5.-uTime*.61);
      float patches=noise(flow)*.72+noise(flow*2.7)*.28;
      float core=exp(-r*r*14.)*(.68+patches*.32);
      float wake=(1.-smoothstep(.18,.96,r))*smoothstep(.24,.66,patches);
      // Departing crests lose energy and fragment as they spread into the pool.
      float phase=r*26.-uTime*2.4+noise(p*4.)*2.4;
      float crest=smoothstep(.74,.98,sin(phase))*(1.-smoothstep(.25,1.,r));
      float foam=clamp(core*.8+wake*.56,0.,1.);
      float alpha=(foam+crest*.12)*(1.-smoothstep(.8,1.,r));
      gl_FragColor=vec4(mix(vec3(.35,.49,.48),vec3(.81,.87,.83),foam),alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
}

export function FallingSpray({origin,compact,reducedMotion}:{origin:Point;compact:boolean;reducedMotion:boolean}) {
  const active=useRef<ShaderMaterial|null>(null);
  const resources=useMemo(()=>{
    const count=compact?240:720,positions=new Float32Array(count*3),seed=new Float32Array(count*4);
    let state=116907;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    for(let i=0;i<count;i++)seed.set([random(),random(),random(),random()],i*4);
    const geometry=new BufferGeometry();geometry.setAttribute("position",new Float32BufferAttribute(positions,3));geometry.setAttribute("seed",new Float32BufferAttribute(seed,4));
    const material=new ShaderMaterial({name:"Madagin short-lived ballistic impact spray",transparent:true,depthWrite:false,uniforms:{uTime:{value:0}},
      vertexShader:`uniform float uTime;attribute vec4 seed;varying float vAlpha;
      void main(){float mist=step(.6,seed.w);float life=mix(.7+seed.y*.65,2.2+seed.y*1.2,mist);float age=fract(uTime/life+seed.x)*life;float angle=seed.z*6.2831853;float speed=mix(2.+seed.w*5.,1.2+seed.z*1.3,mist);vec3 p=position;p.x+=(seed.y-.5)*7.+cos(angle)*speed*age+mist*age*.6;p.z+=sin(angle)*speed*age+age*.8;p.y+=mix(.2+(3.3+seed.y*3.)*age-4.905*age*age,.2+age*.85,mist);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(mix(.035+seed.w*.07,2.4+seed.y*3.2,mist)*650./max(1.,-mv.z),.6,32.);vAlpha=smoothstep(0.,.12,age)*(1.-smoothstep(life*.35,life,age))*mix(.52,.1,mist)*step(-.1,p.y);}`,
      fragmentShader:`varying float vAlpha;void main(){float r=length(gl_PointCoord-.5)*2.;float a=(1.-smoothstep(.2,1.,r))*vAlpha;if(a<.01)discard;gl_FragColor=vec4(.74,.81,.78,a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
    return {geometry,material};
  },[compact]);
  useFrame(({clock})=>{if(active.current)active.current.uniforms.uTime.value=reducedMotion?0:clock.elapsedTime;});
  useEffect(()=>{active.current=resources.material;return ()=>{active.current=null;resources.geometry.dispose();resources.material.dispose();};},[resources]);
  return <points geometry={resources.geometry} material={resources.material} position={[origin.x,origin.y,origin.z]} frustumCulled={false}/>;
}
