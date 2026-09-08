"use client";

import {useFrame} from "@react-three/fiber";
import {useEffect, useMemo, useRef} from "react";
import {BufferGeometry, DoubleSide, Float32BufferAttribute, ShaderMaterial, Vector3} from "three";

type Point = {x:number;y:number;z:number};
export const FALLING_WATER = {version:"gravity-fall-1",gravity:9.81,entrySpeed:2.4} as const;

// The route is authored to follow the retained cliff. Gravity supplies travel
// time along the drop, not a claim of a free-flight or fluid simulation.
export function fallingTravelTime(drop:number) {
  return (Math.sqrt(FALLING_WATER.entrySpeed**2+2*FALLING_WATER.gravity*Math.max(0,drop))-FALLING_WATER.entrySpeed)/FALLING_WATER.gravity;
}

export function createFallingWaterGeometry(top:Point,bottom:Point,lipHalfWidth:number) {
  const positions:number[]=[],uvs:number[]=[],times:number[]=[],indices:number[]=[];
  const rows=144,columns=40;
  for(let row=0;row<=rows;row++){
    const p=row/rows,drop=(top.y-bottom.y)*p,flex=Math.sin(Math.PI*p);
    const x=top.x+(bottom.x-top.x)*Math.pow(p,1.18)+Math.sin(p*7.2)*flex*.42;
    const z=top.z+(bottom.z-top.z)*Math.pow(p,1.42)+Math.sin(p*6.1)*flex*.3;
    // Preserve the supplied lip, then contract the coherent core as it speeds
    // up. The air-entrained lower fringe spreads only a few metres.
    const halfWidth=lipHalfWidth*(1-.24*Math.sin(Math.PI*p*.8))+p*p*2.3;
    for(let col=0;col<=columns;col++){
      const u=col/columns,angle=u*Math.PI*2,a=Math.cos(angle);
      const edge=(Math.sin(p*19+a*2.4)*.23+Math.sin(p*37-a*4.1)*.13)*flex;
      const thickness=(.34*(1-p)+.18+p*p*.62);
      positions.push(x+a*(halfWidth+edge),top.y-drop,z+Math.sin(angle)*thickness+Math.sin(a*8+p*16)*flex*.15);
      uvs.push((a+1)*.5,p);times.push(fallingTravelTime(drop));
      if(row<rows&&col<columns){const i=row*(columns+1)+col;indices.push(i,i+columns+1,i+1,i+1,i+columns+1,i+columns+2);}
    }
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute("position",new Float32BufferAttribute(positions,3));
  geometry.setAttribute("uv",new Float32BufferAttribute(uvs,2));
  geometry.setAttribute("travelTime",new Float32BufferAttribute(times,1));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData.waterfallBody={version:FALLING_WATER.version,top,bottom,lipHalfWidthMeters:lipHalfWidth,rows,columns,travelSeconds:fallingTravelTime(top.y-bottom.y),gravity:FALLING_WATER.gravity,entrySpeed:FALLING_WATER.entrySpeed,contactPathAuthored:true,connectedGeometry:true,centralSpineContinuous:true,topology:"One lip-aligned closed elliptic water body; accelerating coherent core with a bounded aerated fringe"};
  return geometry;
}

const NOISE=`
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
`;

export function createFallingWaterMaterial(sun:Vector3) {
  return new ShaderMaterial({name:"Madagin gravity-timed falling water",side:DoubleSide,transparent:true,depthWrite:false,uniforms:{uTime:{value:0},uSun:{value:sun.clone()}},
    vertexShader:`uniform float uTime;attribute float travelTime;varying vec2 vUv;varying float vTravel;varying vec3 vWorld;
    void main(){vec3 p=position;float envelope=sin(uv.y*3.14159265);p.x+=sin((travelTime-uTime)*5.+uv.x*13.)*.08*envelope;p.z+=sin((travelTime-uTime)*7.+uv.x*21.)*.06*envelope;vUv=uv;vTravel=travelTime;vec4 w=modelMatrix*vec4(p,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`uniform float uTime;uniform vec3 uSun;varying vec2 vUv;varying float vTravel;varying vec3 vWorld;${NOISE}
    void main(){
      float clock=vTravel-uTime;
      float broad=noise(vec2(vUv.x*9.,clock*2.2));
      float strands=noise(vec2(vUv.x*23.+broad*1.5,clock*6.1));
      float fine=noise(vec2(vUv.x*71.+strands*2.,clock*17.));
      float core=smoothstep(.22,.64,broad*.58+strands*.42);
      float edge=mix(.36,1.,smoothstep(0.,.06,vUv.x)*smoothstep(0.,.06,1.-vUv.x));
      float air=smoothstep(.12,.85,vUv.y);
      float torn=smoothstep(.27,.49,broad*.4+strands*.4+fine*.2);
      float alpha=edge*mix(.30+core*.4,(.16+core*.58)*torn,air*.7);
      vec3 normal=normalize(cross(dFdx(vWorld),dFdy(vWorld)));
      float light=.69+.31*abs(dot(normal,uSun));
      vec3 color=mix(vec3(.16,.27,.27),vec3(.72,.79,.76),clamp(.34+core*.4+air*.23+fine*.1,0.,1.))*light;
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
      float patches=noise(flow)*.65+noise(flow*2.7)*.35;
      float core=exp(-r*r*32.);
      float wake=(1.-smoothstep(.12,1.,r))*smoothstep(.29,.68,patches);
      float alpha=(core*.7+wake*.57)*(1.-smoothstep(.78,1.,r));
      gl_FragColor=vec4(vec3(.64,.73,.70),alpha);
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
      void main(){float mist=step(.68,seed.w);float life=mix(.7+seed.y*.65,2.8+seed.y*2.,mist);float age=fract(uTime/life+seed.x)*life;float angle=seed.z*6.2831853;float speed=mix(2.+seed.w*5.,1.2+seed.z*1.3,mist);vec3 p=position;p.x+=cos(angle)*speed*age+mist*age*.6;p.z+=sin(angle)*speed*age+age*.8;p.y+=mix(.2+(3.3+seed.y*3.)*age-4.905*age*age,.2+age*.65,mist);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(mix(.035+seed.w*.07,1.6+seed.y*2.4,mist)*650./max(1.,-mv.z),.6,28.);vAlpha=smoothstep(0.,.12,age)*(1.-smoothstep(life*.4,life,age))*mix(.52,.065,mist)*step(-.1,p.y);}`,
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
