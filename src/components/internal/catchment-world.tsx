"use client";

import type { MotionValue } from "motion/react";
import type { WorldViewId } from "@/lib/world-manifest";
import { CatmullRomCurve3 } from "three";
import { CatchmentCanopy } from "./catchment-canopy";
import route from "../../../public/world/napali-catchment-v1/route.json";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ACESFilmicToneMapping, BufferAttribute, BufferGeometry, DataTexture, EquirectangularReflectionMapping, Euler, FileLoader, FloatType, MeshStandardMaterial, ShaderMaterial, PMREMGenerator, RedFormat, RepeatWrapping, TextureLoader, Vector3, SRGBColorSpace } from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import config from "../../../public/world/napali-catchment-v1/manifest.json";
import surface from "../../../public/world/napali-catchment-v1/surface.json";
import streams from "../../../public/world/napali-catchment-v1/streams.json";


const ROOT = "/world/napali-catchment-v1";
const SURFACE_ROOT = ROOT;
type Field = { values: Uint16Array; sample: (u: number, v: number) => number };
class ElevationLoader extends FileLoader {
  constructor(){super();this.setResponseType("arraybuffer");}
}
function useField(): Field {
  const buffer = useLoader(ElevationLoader, `${ROOT}/elevation.u16`) as unknown as ArrayBuffer;
  return useMemo(() => {
    if (buffer.byteLength !== config.grid * config.grid * 2) throw new Error("Invalid terrain field length");
    const values = new Uint16Array(buffer);
    const sample = (u: number, v: number) => {
      const x = Math.max(0, Math.min(config.grid - 1.001, u * (config.grid - 1)));
      const z = Math.max(0, Math.min(config.grid - 1.001, v * (config.grid - 1)));
      const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
      const a = iz * config.grid + ix;
      return config.offset + config.scale * ((values[a] * (1 - fx) + values[a + 1] * fx) * (1 - fz)
        + (values[a + config.grid] * (1 - fx) + values[a + config.grid + 1] * fx) * fz);
    };
    return { values, sample };
  }, [buffer]);
}

function Land({ field, compact }: { field: Field; compact: boolean }) {
  const original = useLoader(TextureLoader, `${SURFACE_ROOT}/${compact ? "surface-compact.webp" : "surface.webp"}`);
  const response = useLoader(TextureLoader, `${SURFACE_ROOT}/response.png`);
  const geologyNormal=useLoader(TextureLoader,`${SURFACE_ROOT}/geology-normal.webp`);
  const map = useMemo(() => { const t = original.clone(); t.colorSpace = SRGBColorSpace; t.anisotropy = 8; return t; }, [original]);
  const geometry = useMemo(() => {
    const segments = compact ? surface.geometrySegments.compact : surface.geometrySegments.desktop;
    const count = (segments + 1) ** 2;
    const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2), indices = new Uint32Array(segments * segments * 6);
    const du = 1 / (config.grid - 1);
    for (let z = 0; z <= segments; z++) for (let x = 0; x <= segments; x++) {
      const u = x / segments, v = z / segments;
      const vertex = z * (segments + 1) + x;
      positions.set([(u - .5) * config.width, field.sample(u, v), (v - .5) * config.depth], vertex * 3);
      const gx = (field.sample(u + du, v) - field.sample(u - du, v)) / (2 * du * config.width);
      const gz = (field.sample(u, v + du) - field.sample(u, v - du)) / (2 * du * config.depth);
      const length = Math.hypot(gx, 1, gz);
      normals.set([-gx / length, 1 / length, -gz / length], vertex * 3);
      uvs.set([u, 1 - v], vertex * 2);
      if (z < segments && x < segments) {
        indices.set([vertex, vertex + segments + 1, vertex + 1, vertex + 1, vertex + segments + 1, vertex + segments + 2], (z * segments + x) * 6);
      }
    }
    const mesh = new BufferGeometry();
    mesh.setAttribute("position", new BufferAttribute(positions, 3));
    mesh.setAttribute("normal", new BufferAttribute(normals, 3));
    mesh.setAttribute("uv", new BufferAttribute(uvs, 2));
    mesh.setIndex(new BufferAttribute(indices, 1));
    mesh.computeBoundingSphere();
    return mesh;
  }, [compact, field]);
  const sourceDetail = useLoader(TextureLoader, "/world/assets/polyhaven/aerial_grass_rock/aerial_grass_rock_diff_1k.jpg");
  const sourceNormal = useLoader(TextureLoader, "/world/assets/polyhaven/aerial_grass_rock/aerial_grass_rock_nor_gl_1k.jpg");
  const detailNormal = useMemo(() => {
    const texture = sourceNormal.clone();
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.anisotropy = 4;
    return texture;
  }, [sourceNormal]);
  const detail = useMemo(() => {
    const texture = sourceDetail.clone();
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }, [sourceDetail]);
  const material = useMemo(() => {
    const result = new MeshStandardMaterial({ map, roughness: .96, envMapIntensity: .48 });
    result.onBeforeCompile = shader => {
      shader.uniforms.uDetail = { value: detail };
      shader.uniforms.uSurfaceResponse = { value: response };
      shader.uniforms.uDetailNormal = { value: detailNormal };
      shader.uniforms.uGeologyNormal = { value: geologyNormal };
      shader.vertexShader = `varying vec3 vLandPosition; varying vec3 vLandNormal;\n${shader.vertexShader}`
        .replace("#include <begin_vertex>", `#include <begin_vertex>\nvLandPosition = position; vLandNormal = normal;`);
      shader.fragmentShader = `uniform sampler2D uGeologyNormal; uniform sampler2D uDetail; uniform sampler2D uDetailNormal; uniform sampler2D uSurfaceResponse; varying vec3 vLandPosition; varying vec3 vLandNormal;\n${shader.fragmentShader}`
        .replace("#include <map_fragment>", `
          #include <map_fragment>
          vec3 weights = pow(abs(normalize(vLandNormal)),vec3(4.0));
          weights /= max(.001,weights.x+weights.y+weights.z);
          vec3 terrainDetail = texture2D(uDetail,vLandPosition.zy*.018).rgb*weights.x
            + texture2D(uDetail,vLandPosition.xz*.018).rgb*weights.y
            + texture2D(uDetail,vLandPosition.xy*.018).rgb*weights.z;
          // The composite includes capture illumination; it is not measured albedo.
          diffuseColor.rgb *= mix(vec3(.92),clamp(terrainDetail*3.0,.58,1.32),.48);
          vec3 surfaceResponse = texture2D(uSurfaceResponse,vMapUv).rgb;
        `).replace("#include <normal_fragment_maps>", `
          #include <normal_fragment_maps>
          vec2 nx=texture2D(uDetailNormal,vLandPosition.zy*.12).xy*2.0-1.0;
          vec2 ny=texture2D(uDetailNormal,vLandPosition.xz*.12).xy*2.0-1.0;
          vec2 nz=texture2D(uDetailNormal,vLandPosition.xy*.12).xy*2.0-1.0;
          vec3 detailSlope=vec3(ny.x*weights.y+nz.x*weights.z,nx.y*weights.x+nz.y*weights.z,nx.x*weights.x+ny.y*weights.y);
          vec3 landNormal=normalize(vLandNormal);
          detailSlope-=landNormal*dot(landNormal,detailSlope);
          vec3 fineNormal=normalize(texture2D(uGeologyNormal,vMapUv).rgb*2.0-1.0);
          normal=normalize(mat3(viewMatrix)*(fineNormal+detailSlope*mix(.38,.17,surfaceResponse.b)));
        `).replace("#include <lights_fragment_end>", `
          #include <lights_fragment_end>
          reflectedLight.directDiffuse *= surfaceResponse.g;
          reflectedLight.directSpecular *= surfaceResponse.g;
          reflectedLight.indirectDiffuse *= mix(.48,1.0,surfaceResponse.r);
        `);
    };
    result.customProgramCacheKey = () => "noaa-worldcover-surface-v2";
    return result;
  }, [detail, detailNormal, geologyNormal, map, response]);
  useEffect(() => () => { geometry.dispose(); map.dispose(); detail.dispose(); detailNormal.dispose(); material.dispose(); }, [detail, detailNormal, geometry, map, material]);
  return <mesh geometry={geometry} material={material} receiveShadow castShadow />;
}

function Daylight() {
  const hdr = useLoader(HDRLoader, `${ROOT}/daylight.hdr`);
  const { gl } = useThree();
  const resources = useMemo(() => {
    const background = hdr.clone();
    background.mapping = EquirectangularReflectionMapping;
    const generator = new PMREMGenerator(gl);
    const environment = generator.fromEquirectangular(background);
    generator.dispose();
    return { background, environment };
  }, [gl, hdr]);
  useEffect(() => () => { resources.background.dispose(); resources.environment.dispose(); }, [resources]);
  const rotation = useMemo(() => new Euler(0, surface.skyRotationY, 0), []);
  return <><primitive attach="background" object={resources.background} /><primitive attach="environment" object={resources.environment.texture} /><primitive attach="backgroundRotation" object={rotation} /><primitive attach="environmentRotation" object={rotation} /><hemisphereLight args={["#dce9f3", "#435241", .5]} /><directionalLight position={new Vector3(...surface.sunDirection).multiplyScalar(10000)} color="#fff5e3" intensity={2.0} /></>;
}

function CoastalWater({ field, moving }: { field: Field; moving: boolean }) {
  const materialRef = useRef<ShaderMaterial>(null);
  const sky = useLoader(HDRLoader, `${ROOT}/daylight.hdr`);
  const fieldTexture = useMemo(() => {
    const texture = new DataTexture(Float32Array.from(field.values, value => value * config.scale + config.offset), config.grid, config.grid, RedFormat, FloatType);
    texture.needsUpdate = true;
    return texture;
  }, [field]);
  const material = useMemo(() => new ShaderMaterial({
    uniforms: { uTerrain: { value: fieldTexture }, uSky: { value: sky }, uTime: { value: 0 } },
    vertexShader: `
      varying vec3 vWaterPosition;
      void main() {
        vec4 world = modelMatrix * vec4(position,1.0);
        vWaterPosition = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      uniform sampler2D uTerrain;
      uniform sampler2D uSky;
      uniform float uTime;
      varying vec3 vWaterPosition;
      float waterNoise(vec2 p) {
        vec2 cell=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        vec4 q=vec4(dot(cell,vec2(127.1,311.7)),dot(cell+vec2(1,0),vec2(127.1,311.7)),dot(cell+vec2(0,1),vec2(127.1,311.7)),dot(cell+vec2(1),vec2(127.1,311.7)));
        vec4 h=fract(sin(q)*43758.5453);
        return mix(mix(h.x,h.y,f.x),mix(h.z,h.w,f.x),f.y);
      }
      float terrainHeight(vec2 uv) {
        vec2 p=clamp(uv,vec2(0),vec2(.999999))*1024.0;
        vec2 cell=floor(p), t=fract(p), q=(cell+.5)/1025.0;
        float d=1.0/1025.0;
        return mix(mix(texture2D(uTerrain,q).r,texture2D(uTerrain,q+vec2(d,0)).r,t.x),mix(texture2D(uTerrain,q+vec2(0,d)).r,texture2D(uTerrain,q+vec2(d)).r,t.x),t.y);
      }
      vec3 reflectedDaylight(vec3 direction) {
        // Same pi rotation as the visible sky and land illumination.
        direction=normalize(vec3(-direction.x,max(.001,direction.y),-direction.z));
        vec2 uv=vec2(atan(direction.z,direction.x)/6.28318530718+.5,asin(direction.y)/3.14159265359+.5);
        return min(texture2D(uSky,uv).rgb,vec3(60.0));
      }
      float resolvedWave(float phase) {
        float footprint=fwidth(phase);
        return cos(phase)*exp(-footprint*footprint*.18);
      }
      void main() {
        vec2 terrainUv=vWaterPosition.xz/vec2(${config.width.toFixed(5)},${config.depth.toFixed(5)})+.5;
        float ground=-1000.0;
        if(all(greaterThanEqual(terrainUv,vec2(0)))&&all(lessThanEqual(terrainUv,vec2(1)))) ground=terrainHeight(terrainUv);
        if(ground>.18) discard;
        float depth=max(0.0,-ground);
        vec2 slope=vec2(0);
        for(int i=0;i<12;i++) {
          float band=float(i), angle=.6+sin(band*2.399)*1.25;
          vec2 direction=vec2(cos(angle),sin(angle));
          float frequency=.011*pow(1.43,band);
          float phase=dot(vWaterPosition.xz,direction)*frequency-uTime*sqrt(9.81*frequency)+band*7.19;
          slope+=direction*resolvedWave(phase)*(.025*pow(.93,band));
        }
        vec3 normal=normalize(vec3(slope.x,1.0,slope.y));
        vec3 view=normalize(cameraPosition-vWaterPosition);
        float fresnel=.0204+.9796*pow(1.0-max(dot(normal,view),0.0),5.0);
        vec3 reflected=reflect(-view,normal);
        // Integrate a small roughness cone instead of turning unresolved waves
        // into a perfect mirror. The continuous wave filter avoids LOD bands.
        vec3 reflection=reflectedDaylight(reflected)*.4;
        reflection+=reflectedDaylight(reflected+vec3(.035,.02,0))*.15;
        reflection+=reflectedDaylight(reflected+vec3(-.035,.02,0))*.15;
        reflection+=reflectedDaylight(reflected+vec3(0,.02,.035))*.15;
        reflection+=reflectedDaylight(reflected+vec3(0,.02,-.035))*.15;
        // Depth limits converge before the crop edge. Outside is authored ocean.
        vec3 water=mix(vec3(.012,.12,.105),vec3(.004,.024,.046),1.0-exp(-depth*.075));
        vec3 color=mix(water,reflection,fresnel);
        float breakup=waterNoise(vWaterPosition.xz*.062+vec2(uTime*.02,-uTime*.04));
        float wave=sin(depth*.7-uTime*1.15+waterNoise(vWaterPosition.xz*.017)*2.7);
        float foam=(1.0-smoothstep(.8,7.0,depth))*smoothstep(.28,.92,wave)*smoothstep(.2,.75,breakup);
        color=mix(color,vec3(.67,.75,.76),foam*.85);
        vec3 horizon=reflectedDaylight(vec3(-view.x,.012,-view.z));
        float atmosphere=1.0-exp(-length(cameraPosition-vWaterPosition)*.000045);
        color=mix(color,horizon,atmosphere);
        gl_FragColor=vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }), [fieldTexture, sky]);
  useFrame((_, delta) => { if (moving && materialRef.current) materialRef.current.uniforms.uTime.value += Math.min(delta, .05); });
  useEffect(() => () => { material.dispose(); fieldTexture.dispose(); }, [fieldTexture, material]);
  return <mesh rotation={[-Math.PI / 2,0,0]} position={[0,.2,0]}><primitive attach="material" object={material} ref={materialRef} /><planeGeometry args={[180000,180000,128,128]} /></mesh>;
}

function Streams() {
  const material=useMemo(()=>new ShaderMaterial({
    uniforms:{uTime:{value:0}},
    vertexShader:`varying vec2 vFlow;void main(){vFlow=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform float uTime;varying vec2 vFlow;void main(){float ribbon=pow(abs(vFlow.x*2.0-1.0),5.0);float ripple=sin(vFlow.y*.62-uTime*2.2+sin(vFlow.x*11.0))*sin(vFlow.y*.091-uTime*.38);vec3 water=mix(vec3(.033,.14,.14),vec3(.36,.47,.43),smoothstep(.36,.85,ripple)*.7);gl_FragColor=vec4(water,1.0-ribbon*.65);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include'),
    transparent:true,depthWrite:false,
  }),[]);
  const geometry=useMemo(()=>{
    const positions:number[]=[],uv:number[]=[],indices:number[]=[];
    streams.forEach(points=>{let distance=0;const base=positions.length/3;
      points.forEach((p,i)=>{
        const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];const length=Math.hypot(b[0]-a[0],b[2]-a[2])||1;
        if(i)distance+=Math.hypot(p[0]-a[0],p[2]-a[2]);
        const nx=-(b[2]-a[2])/length*p[3]/2,nz=(b[0]-a[0])/length*p[3]/2;
        positions.push(p[0]+nx,p[1],p[2]+nz,p[0]-nx,p[1],p[2]-nz);uv.push(0,distance,1,distance);
        if(i<points.length-1){const j=base+i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2)}
      });
    });
    const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(positions),3));g.setAttribute('uv',new BufferAttribute(new Float32Array(uv),2));g.setIndex(indices);g.computeVertexNormals();return g;
  },[]);
  useFrame(({clock})=>{material.uniforms.uTime.value=clock.elapsedTime});
  useEffect(()=>()=>{material.dispose();geometry.dispose()},[geometry,material]);
  return <mesh geometry={geometry} material={material} name="Downhill tributaries reaching the sea" />;
}

function Director({field,activeView,progress,onReady}:{field:Field;activeView:WorldViewId;progress:MotionValue<number>;onReady:()=>void}) {
  const curves=useMemo(()=>({position:new CatmullRomCurve3(route.camera.map(p=>new Vector3((p[0]-.5)*config.width,p[2],(p[1]-.5)*config.depth))),look:new CatmullRomCurve3(route.look.map(p=>new Vector3((p[0]-.5)*config.width,p[2],(p[1]-.5)*config.depth)))}),[]);
  const look=useRef(new Vector3()),position=useMemo(()=>new Vector3(),[]),target=useMemo(()=>new Vector3(),[]);
  const previousView=useRef(activeView),returning=useRef(0),frames=useRef(0),lastSample=useRef(0);
  useFrame(({camera,gl},delta)=>{
    const t=Math.min(1,Math.max(0,progress.get()));curves.position.getPoint(t,position);curves.look.getPoint(t,target);
    const ground=field.sample(position.x/config.width+.5,position.z/config.depth+.5);
    position.y=Math.max(position.y,ground+route.minimumClearanceMeters);
    const dx=target.x-position.x,dz=target.z-position.z,distance=Math.hypot(dx,dz);
    if(activeView==='about')target.set(position.x+900,Math.max(35,position.y-170),position.z-1900);
    else if(activeView==='projects')target.set(position.x+dx*.2,position.y+Math.max(700,distance*.9),position.z+dz*.2);
    else if(activeView==='blog')target.set(position.x+dx*.866-dz*.5,target.y,position.z+dz*.866+dx*.5);
    if(previousView.current!==activeView){if(activeView==='journey')returning.current=2;previousView.current=activeView;}
    camera.position.copy(position);
    if(frames.current===0)look.current.copy(target);
    else if(activeView!=='journey'||returning.current>0){look.current.lerp(target,1-Math.exp(-Math.min(delta,.05)*5.5));returning.current=Math.max(0,returning.current-delta)}else look.current.copy(target);
    camera.lookAt(look.current);frames.current++;
    if(frames.current===3){document.documentElement.dataset.madaginMeaningfulWorldReady='true';onReady();}
    if(performance.now()-lastSample.current>100){lastSample.current=performance.now();
      document.documentElement.dataset.madaginPublicCamera=JSON.stringify({position:camera.position.toArray(),look:look.current.toArray(),view:activeView,progress:t});
      document.documentElement.dataset.madaginCatchment=JSON.stringify({id:config.id,groundClearance:position.y-ground,calls:gl.info.render.calls,triangles:gl.info.render.triangles});
    }
  });
  return null;
}

function CatchmentScene(props:{activeView:WorldViewId;progress:MotionValue<number>;onReady:()=>void;compact:boolean}) {
  const field=useField();
  return <><fog attach="fog" args={["#bbcdd1",2800,21000]} /><Daylight /><Land field={field} compact={props.compact} /><CoastalWater field={field} moving /><Streams /><CatchmentCanopy compact={props.compact} /><Director field={field} {...props} /></>;
}

class CatchmentBoundary extends Component<{children:ReactNode;onFailure:()=>void},{failed:boolean}> {
  state={failed:false};static getDerivedStateFromError(){return {failed:true}}
  componentDidCatch(){this.props.onFailure()}
  render(){return this.state.failed?null:this.props.children}
}

export function PublicCatchmentExperience({activeView,className,onReady,onUnavailable,progress}:{activeView:WorldViewId;className?:string;onReady:()=>void;onUnavailable:()=>void;progress:MotionValue<number>}) {
  const [compact]=useState(()=>typeof window!=='undefined'&&window.innerWidth<700);
  const [ready,setReady]=useState(false),[failed,setFailed]=useState(false);
  useEffect(()=>()=>{delete document.documentElement.dataset.madaginMeaningfulWorldReady;delete document.documentElement.dataset.madaginCatchment;},[]);
  const fail=()=>{setFailed(true);onUnavailable();};
  return <div aria-hidden="true" className={className} style={{background:'url(/media/madagin-ridge-approach-v3.png) center 58% / cover no-repeat'}} data-public-world="true" data-renderer-state={failed?'fallback':ready?'live':'loading'} data-quality-tier={compact?'balanced':'high'} data-world-view={activeView}>
    {!failed?<CatchmentBoundary onFailure={fail}><Canvas camera={{position:[0,400,0],fov:compact?56:48,near:2,far:100000}} dpr={1} gl={{antialias:true,powerPreference:'high-performance',toneMapping:ACESFilmicToneMapping,toneMappingExposure:1.05}} onCreated={({gl})=>{setReady(true);gl.domElement.addEventListener('webglcontextlost',fail,{once:true})}}><Suspense fallback={null}><CatchmentScene activeView={activeView} progress={progress} compact={compact} onReady={onReady} /></Suspense></Canvas></CatchmentBoundary>:null}
  </div>;
}
