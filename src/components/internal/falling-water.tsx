"use client";
import {AERIAL_GLSL} from "./aerial-perspective";

import {useFrame} from "@react-three/fiber";
import {useEffect, useMemo, useRef} from "react";
import {BufferGeometry, DoubleSide, Float32BufferAttribute, FrontSide, ShaderMaterial, Vector2, Vector3} from "three";

import {CASCADE_VERSION, CASCADE_START_Z, cascadeSection, cascadeLevel} from "./cascade-contact";
type Point = {x:number;y:number;z:number};
export const FALLING_WATER = {version:"cascade-streams-1",impactVersion:"cascade-impact-1",gravity:9.81,entrySpeed:2.4} as const;

function cascadeGrade(z:number) {
  const before=cascadeSection(z-.3),after=cascadeSection(z+.3);
  return Math.max(0,(cascadeLevel(before.x,z-.3)-cascadeLevel(after.x,z+.3))/.6);
}

// Both meshes use these same upper-half cross-section vertices at the lip.
export function fallingLipPoint(across:number) {
  const s=cascadeSection(CASCADE_START_Z),x=s.x+across*(across<0?s.left:s.right);
  const thickness=.14+Math.min(1,cascadeGrade(CASCADE_START_Z))*.25;
  return {x,y:cascadeLevel(x,CASCADE_START_Z)+Math.sqrt(Math.max(0,1-across*across))*thickness,z:CASCADE_START_Z};
}

// The route is authored to follow the retained cliff. Gravity supplies travel
// time along the drop, not a claim of a free-flight or fluid simulation.
export function fallingTravelTime(drop:number) {
  return (Math.sqrt(FALLING_WATER.entrySpeed**2+2*FALLING_WATER.gravity*Math.max(0,drop))-FALLING_WATER.entrySpeed)/FALLING_WATER.gravity;
}

// Unequal source shares stay fixed at the feed and pool. Downstream gaps are
// real missing geometry between tubular stream surfaces, not an alpha mask.
export const FALLING_STREAMS = [
  {low:-1,high:-.7,phase:.8},
  {low:-.7,high:.05,phase:3.1},
  {low:.05,high:1,phase:5.8},
] as const;
const unit=(v:number)=>Math.max(0,Math.min(1,v));
const ease=(v:number)=>{v=unit(v);return v*v*(3-2*v);};
export function fallingStreamSection(p:number,index:number) {
  const stream=FALLING_STREAMS[index],center=(stream.low+stream.high)*.5;
  const split=ease((p-.055)/.13)*(1-ease((p-.88)/.12));
  const neck=1-split*(.34+.07*Math.sin(p*13+stream.phase));
  return {center:center+split*Math.sin(p*11+stream.phase)*.025,half:(stream.high-stream.low)*.5*neck,split};
}
export function createFallingWaterGeometry(top:Point,bottom:Point,lipHalfWidth:number) {
  const positions:number[]=[],uvs:number[]=[],times:number[]=[],aeration:number[]=[],indices:number[]=[],streams:number[]=[];
  const rows=160,columns=20;
  const append=(rowCount:number,columnCount:number,streamIndex:number,collar:boolean)=>{
    const offset=positions.length/3;
    for(let row=0;row<=rowCount;row++){
      const p=row/rowCount*(collar?.065:1),z=CASCADE_START_Z+(bottom.z-CASCADE_START_Z)*p,section=cascadeSection(z);
      const part=collar?{center:0,half:1,split:0}:fallingStreamSection(p,streamIndex);
      const centerX=section.x+part.center*(part.center<0?section.left:section.right);
      const centerY=cascadeLevel(centerX,z),grade=cascadeGrade(z);
      const za=Math.max(CASCADE_START_Z,z-.2),zb=Math.min(bottom.z,z+.2),sa=cascadeSection(za),sb=cascadeSection(zb);
      const tangent=new Vector3(sb.x-sa.x,cascadeLevel(sb.x,zb)-cascadeLevel(sa.x,za),zb-za).normalize();
      const side=new Vector3(1,0,0).addScaledVector(tangent,-tangent.x).normalize();
      const outward=new Vector3().crossVectors(tangent,side).normalize();
      const volume=ease(p/.08)*(1-ease((p-.91)/.09));
      for(let col=0;col<=columnCount;col++){
        const angle=col/columnCount*Math.PI*2,a=part.center+Math.cos(angle)*part.half;
        const width=a<0?section.left:section.right,x=section.x+a*width,thickness=.14+Math.min(1,grade)*.25;
        const original=new Vector3(x,cascadeLevel(x,z)+Math.sin(angle)*thickness,z);
        const halfWidth=part.half*(section.left+section.right)*.5;
        const phase=FALLING_STREAMS[streamIndex]?.phase??0;
        const fold=1+Math.sin(p*29+angle*3+phase)*.21+Math.sin(p*51-angle*2+phase)*.10;
        const radius=(.22+halfWidth*.38)*fold*(1+ease((p-.7)/.2)*.45);
        const body=new Vector3(centerX,centerY,z).addScaledVector(side,Math.cos(angle)*halfWidth*fold)
          .addScaledVector(outward,(.92+Math.sin(angle))*radius);
        if(!collar)original.add(body.sub(original).clampLength(0,4.5).multiplyScalar(volume));
        positions.push(original.x,original.y,original.z);uvs.push(col/columnCount,p);
        times.push(fallingTravelTime(top.y-centerY));aeration.push(unit(.22+grade*.37+p*.18));streams.push(streamIndex);
        if(row<rowCount&&col<columnCount){const i=offset+row*(columnCount+1)+col;indices.push(i,i+1,i+columnCount+1,i+1,i+columnCount+2,i+columnCount+1);}
      }
    }
  };
  // A short complete ring retains the exact established upper half lip points.
  // The three touching source shares overlap it before their necks separate.
  append(12,40,0,true);for(let i=0;i<FALLING_STREAMS.length;i++)append(rows,columns,i,false);
  const geometry=new BufferGeometry();
  geometry.setAttribute("position",new Float32BufferAttribute(positions,3));geometry.setAttribute("uv",new Float32BufferAttribute(uvs,2));
  geometry.setAttribute("travelTime",new Float32BufferAttribute(times,1));geometry.setAttribute("aeration",new Float32BufferAttribute(aeration,1));geometry.setAttribute("streamId",new Float32BufferAttribute(streams,1));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData.waterfallBody={version:FALLING_WATER.version,guideVersion:CASCADE_VERSION,top,bottom,lipHalfWidthMeters:lipHalfWidth,rows,columns,streams:FALLING_STREAMS.length,collarVertices:13*41,travelSeconds:fallingTravelTime(top.y-bottom.y),gravity:FALLING_WATER.gravity,entrySpeed:FALLING_WATER.entrySpeed,contactPathAuthored:true,connectedGeometry:true,terrainGuide:true,topology:"Three unequal tubular cross sections with physical gaps, source collar and shared pool datum. Gravity-timed authored guide; no fluid simulation."};
  return geometry;
}
const NOISE=`
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
`;

export function createFallingWaterMaterial(sun:Vector3) {
  return new ShaderMaterial({name:"Madagin separated falling streams",side:FrontSide,transparent:true,depthWrite:false,uniforms:{uTime:{value:0},uSun:{value:sun.clone()}},
    vertexShader:`uniform float uTime;attribute float travelTime;attribute float aeration;attribute float streamId;varying float vAir;varying vec2 vUv;varying float vTravel;varying float vStream;varying vec3 vWorld;varying vec3 vNormal;
    void main(){vec3 p=position;float envelope=sin(uv.y*3.14159265);p+=normal*sin((travelTime-uTime)*7.+uv.x*18.+streamId*2.7)*.19*envelope;vUv=uv;vTravel=travelTime;vAir=aeration;vStream=streamId;vNormal=mat3(modelMatrix)*normal;vec4 w=modelMatrix*vec4(p,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`uniform float uTime;uniform vec3 uSun;varying float vAir;varying vec2 vUv;varying float vTravel;varying float vStream;varying vec3 vWorld;varying vec3 vNormal;${NOISE}${AERIAL_GLSL}
    void main(){
      float clock=vTravel-uTime;
      float broad=noise(vec2(vUv.x*4.2+vStream*9.3,clock*6.3));
      float folded=noise(vec2(vUv.x*10.7+vStream*5.1,clock*17.1+broad));
      vec2 bubbles=vec2(vUv.x*29.,clock*37.);
      float fine=mix(noise(bubbles),.5,smoothstep(.3,1.1,length(fwidth(bubbles))));
      vec3 normal=normalize(vNormal);
      float direct=max(0.,dot(normal,uSun));
      float light=.38+.62*direct;
      float density=smoothstep(.24,.78,broad*.7+folded*.3);
      float air=clamp(.06+vAir*.45+density*.26+fine*.10,0.,1.);
      vec3 color=mix(vec3(.13,.23,.23),vec3(.78,.85,.82),air)*light;
      float alpha=mix(.28,.9,density)*mix(.75,1.,vAir);
      gl_FragColor=vec4(aerialPerspective(color,vWorld),alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
}

export const FALLING_IMPACT_VERSION="cascade-impact-1";
export function fallingImpactCenters(z=-704) {
  const section=cascadeSection(z);
  return FALLING_STREAMS.map(stream=>{
    const across=(stream.low+stream.high)*.5;
    return new Vector2(section.x+across*(across<0?section.left:section.right),z);
  });
}
export function createFallingImpactMaterial() {
  return new ShaderMaterial({name:"Madagin localized stream impact foam",side:DoubleSide,transparent:true,depthWrite:false,uniforms:{uTime:{value:0},uImpactCenters:{value:fallingImpactCenters()}},
    vertexShader:`varying vec3 vWorld;void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float uTime;uniform vec2 uImpactCenters[3];varying vec3 vWorld;${NOISE}${AERIAL_GLSL}
    void main(){
      float foam=0.;
      // Unequal impact footprints and short-lived rafts follow the actual
      // stream endpoints. World-space metres keep them fixed to the pool.
      for(int i=0;i<3;i++){
        float id=float(i);vec2 jet=vWorld.xz-uImpactCenters[i];
        float radius=2.1+id*.68;
        float churn=noise(jet*.8+vec2(uTime*.46,-uTime*.71)+id*7.);
        foam+=exp(-dot(jet,jet)/(radius*radius))*(.65+churn*.35);
        for(int k=0;k<3;k++){
          float birth=floor((uTime+float(k)*2.1+id*.8)/6.3);
          float age=mod(uTime+float(k)*2.1+id*.8,6.3);
          float seed=hash(vec2(birth,id*3.+float(k)));
          vec2 drift=normalize(vec2(-.9,.35+(seed-.5)*.7));
          vec2 q=jet-drift*age*(.8+seed*.6);
          float along=dot(q,drift)/(1.3+age*.38),across=dot(q,vec2(-drift.y,drift.x))/(radius*.65+age*.21);
          float raft=exp(-along*along-across*across);
          float broken=smoothstep(.22,.70,noise(q*1.3+seed*13.)*.7+noise(q*3.1-age*.2)*.3);
          foam+=raft*broken*smoothstep(0.,.7,age)*(1.-smoothstep(2.,6.3,age))*.48;
        }
      }
      foam=clamp(foam,0.,1.);float alpha=foam*.88;
      if(alpha<.015)discard;
      gl_FragColor=vec4(aerialPerspective(mix(vec3(.27,.39,.37),vec3(.78,.84,.80),foam),vWorld),alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
}

export function FallingSpray({origin,compact,reducedMotion}:{origin:Point;compact:boolean;reducedMotion:boolean}) {
  const active=useRef<ShaderMaterial|null>(null);
  const resources=useMemo(()=>{
    const count=compact?320:880,positions=new Float32Array(count*3),seed=new Float32Array(count*4);
    let state=116907;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    for(let i=0;i<count;i++)seed.set([random(),random(),random(),random()],i*4);
    const geometry=new BufferGeometry();geometry.setAttribute("position",new Float32BufferAttribute(positions,3));geometry.setAttribute("seed",new Float32BufferAttribute(seed,4));
    const material=new ShaderMaterial({name:"Madagin short-lived ballistic impact spray",transparent:true,depthWrite:false,uniforms:{uTime:{value:0},uImpactCenters:{value:fallingImpactCenters().map(c=>new Vector2(c.x-origin.x,c.y-origin.z))}},
      vertexShader:`uniform float uTime;uniform vec2 uImpactCenters[3];attribute vec4 seed;varying float vAlpha;
      void main(){float mist=step(.48,seed.w);float life=mix(.7+seed.y*.65,2.7+seed.y*1.6,mist);float age=fract(uTime/life+seed.x)*life;float angle=seed.z*6.2831853;float speed=mix(2.+seed.w*5.,1.5+seed.z*1.5,mist);vec3 p=position;vec2 center=uImpactCenters[int(floor(fract(seed.w*7.17)*2.999))];p.x+=center.x+(seed.y-.5)*1.1+cos(angle)*speed*age-mist*age*.5;p.z+=center.y+sin(angle)*speed*age+age*.3;p.y+=mix(.2+(3.3+seed.y*3.)*age-4.905*age*age,.2+age*.95,mist);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(mix(.035+seed.w*.07,3.8+seed.y*4.8,mist)*650./max(1.,-mv.z),.6,42.);vAlpha=smoothstep(0.,.12,age)*(1.-smoothstep(life*.35,life,age))*mix(.52,.12,mist)*step(-.1,p.y);}`,
      fragmentShader:`varying float vAlpha;void main(){float r=length(gl_PointCoord-.5)*2.;float a=(1.-smoothstep(.2,1.,r))*vAlpha;if(a<.01)discard;gl_FragColor=vec4(.74,.81,.78,a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
    return {geometry,material};
  },[compact,origin.x,origin.z]);
  useFrame(({clock})=>{if(active.current)active.current.uniforms.uTime.value=reducedMotion?0:clock.elapsedTime;});
  useEffect(()=>{active.current=resources.material;return ()=>{active.current=null;resources.geometry.dispose();resources.material.dispose();};},[resources]);
  return <points geometry={resources.geometry} material={resources.material} position={[origin.x,origin.y,origin.z]} frustumCulled={false}/>;
}
