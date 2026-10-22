"use client";
import { BrandWordmark } from "@/components/public/brand-wordmark";


import Link from "next/link";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ACESFilmicToneMapping, BufferAttribute, BufferGeometry, DataTexture, EquirectangularReflectionMapping, Euler, FileLoader, FloatType, MeshStandardMaterial, ShaderMaterial, PMREMGenerator, RedFormat, RepeatWrapping, TextureLoader, Vector3, SRGBColorSpace } from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import config from "../../../public/world/foundation-noaa-v1/manifest.json";
import surface from "../../../public/world/foundation-surface-v2/manifest.json";
import styles from "./terrain-foundation.module.css";

const ROOT = "/world/foundation-noaa-v1";
const SURFACE_ROOT = "/world/foundation-surface-v2";
const VIEWS = [
  { id: "coast", label: "Coastal approach", camera: [.13, .39, 1080], target: [.43, .69, 100] },
  { id: "valley", label: "Valley", camera: [.43, .43, 900], target: [.63, .76, 80] },
  { id: "ridge", label: "Ridge", camera: [.10, .66, 920], target: [.38, .69, 160] },
  { id: "headwall", label: "Headwall", camera: [.53, .63, 780], target: [.72, .91, 40] },
  { id: "summit", label: "Summit", camera: [.73, .92, 400], target: [.42, .48, 60] },
  { id: "ocean", label: "Ocean", camera: [.38, .65, 340], target: [.13, .30, 0] },
  { id: "sky", label: "Sky", camera: [.38, .65, 340], target: [.20, .42, 2600] },
] as const;

type Field = { values: Uint16Array; sample: (u: number, v: number) => number };
function useField(): Field {
  const buffer = useLoader(FileLoader, `${ROOT}/elevation.u16`, loader => loader.setResponseType("arraybuffer")) as unknown as ArrayBuffer;
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

function point(field: Field, coordinate: readonly number[]) {
  return new Vector3((coordinate[0] - .5) * config.width, Math.max(0, field.sample(coordinate[0], coordinate[1])) + coordinate[2], (coordinate[1] - .5) * config.depth);
}

function Land({ field, compact }: { field: Field; compact: boolean }) {
  const original = useLoader(TextureLoader, `${SURFACE_ROOT}/${compact ? "surface-compact.webp" : "surface.webp"}`);
  const response = useLoader(TextureLoader, `${SURFACE_ROOT}/response.png`);
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
      shader.vertexShader = `varying vec3 vLandPosition; varying vec3 vLandNormal;\n${shader.vertexShader}`
        .replace("#include <begin_vertex>", `#include <begin_vertex>\nvLandPosition = position; vLandNormal = normal;`);
      shader.fragmentShader = `uniform sampler2D uDetail; uniform sampler2D uDetailNormal; uniform sampler2D uSurfaceResponse; varying vec3 vLandPosition; varying vec3 vLandNormal;\n${shader.fragmentShader}`
        .replace("#include <map_fragment>", `
          #include <map_fragment>
          vec3 weights = pow(abs(normalize(vLandNormal)),vec3(4.0));
          weights /= max(.001,weights.x+weights.y+weights.z);
          vec3 terrainDetail = texture2D(uDetail,vLandPosition.zy*.018).rgb*weights.x
            + texture2D(uDetail,vLandPosition.xz*.018).rgb*weights.y
            + texture2D(uDetail,vLandPosition.xy*.018).rgb*weights.z;
          // The composite includes capture illumination; it is not measured albedo.
          diffuseColor.rgb *= mix(vec3(.92),clamp(terrainDetail*3.0,.65,1.25),.14);
          vec3 surfaceResponse = texture2D(uSurfaceResponse,vMapUv).rgb;
        `).replace("#include <normal_fragment_maps>", `
          #include <normal_fragment_maps>
          vec2 nx=texture2D(uDetailNormal,vLandPosition.zy*.12).xy*2.0-1.0;
          vec2 ny=texture2D(uDetailNormal,vLandPosition.xz*.12).xy*2.0-1.0;
          vec2 nz=texture2D(uDetailNormal,vLandPosition.xy*.12).xy*2.0-1.0;
          vec3 detailSlope=vec3(ny.x*weights.y+nz.x*weights.z,nx.y*weights.x+nz.y*weights.z,nx.x*weights.x+ny.y*weights.y);
          vec3 landNormal=normalize(vLandNormal);
          detailSlope-=landNormal*dot(landNormal,detailSlope);
          normal=normalize(normal+mat3(viewMatrix)*detailSlope*mix(.34,.14,surfaceResponse.b));
        `).replace("#include <lights_fragment_end>", `
          #include <lights_fragment_end>
          reflectedLight.directDiffuse *= surfaceResponse.g;
          reflectedLight.directSpecular *= surfaceResponse.g;
          reflectedLight.indirectDiffuse *= mix(.48,1.0,surfaceResponse.r);
        `);
    };
    result.customProgramCacheKey = () => "noaa-worldcover-surface-v2";
    return result;
  }, [detail, detailNormal, map, response]);
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

function Director({ field, selection, playing, onView }: { field: Field; selection: { index: number; serial: number }; playing: boolean; onView: (index: number) => void }) {
  const elapsed = useRef(0);
  const lastView = useRef(-1);
  const { camera } = useThree();
  useEffect(() => { elapsed.current = selection.index / (VIEWS.length - 1) * 40; }, [selection]);
  useFrame((state, delta) => {
    if (playing) elapsed.current = (elapsed.current + Math.min(delta,.05)) % 46;
    const index = Math.min(VIEWS.length - 1, elapsed.current / 40 * (VIEWS.length - 1));
    const a = Math.floor(index), b = Math.min(VIEWS.length-1, a+1);
    if (lastView.current !== a) { lastView.current = a; onView(a); }
    const t = index-a, eased = t*t*(3-2*t);
    const eye = point(field, VIEWS[a].camera).lerp(point(field,VIEWS[b].camera),eased);
    // A flight safety floor on the same source used for rendered terrain.
    eye.y = Math.max(eye.y, field.sample(eye.x/config.width+.5,eye.z/config.depth+.5)+180);
    camera.position.copy(eye);
    camera.lookAt(point(field,VIEWS[a].target).lerp(point(field,VIEWS[b].target),eased));
    const host = document.documentElement;
    host.dataset.foundationReady = "true";
    host.dataset.foundationSurface = surface.id;
    host.dataset.foundationView = VIEWS[a].id;
    host.dataset.foundationTriangles = String(state.gl.info.render.triangles);
    host.dataset.foundationCalls = String(state.gl.info.render.calls);
    host.dataset.foundationCamera = eye.toArray().map(n=>n.toFixed(3)).join(",");
  });
  return null;
}

function Scene({ selection, onView, playing, compact, moving }: { selection: { index: number; serial: number }; onView: (index: number) => void; playing: boolean; compact: boolean; moving: boolean }) {
  const field = useField();
  return <><fog attach="fog" args={["#b4ccd7", 300, 24000]} /><Daylight /><Land compact={compact} field={field} /><CoastalWater field={field} moving={moving} /><Director field={field} selection={selection} onView={onView} playing={playing} /></>;
}

class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p className={styles.fallback}>The terrain preview could not load. The current site remains available.</p> : this.props.children; }
}

export function TerrainFoundation() {
  const [selected, setSelected] = useState(0);
  const [selection, setSelection] = useState({ index: 0, serial: 0 });
  const [playing, setPlaying] = useState(false);
  const [policy, setPolicy] = useState<{ live: boolean; compact: boolean; reduced: boolean } | null>(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const inspect = () => {
      const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
      const reduced = media.matches;
      const excluded = reduced || nav.connection?.saveData || ((nav.deviceMemory ?? 8)<=4 && navigator.hardwareConcurrency<=4);
      const probe = excluded ? null : document.createElement("canvas").getContext("webgl2");
      probe?.getExtension("WEBGL_lose_context")?.loseContext();
      setPolicy({ live: !!probe, compact: window.innerWidth < 700, reduced });
      if (reduced) setPlaying(false);
    };
    inspect(); media.addEventListener("change",inspect);
    return () => { media.removeEventListener("change",inspect); delete document.documentElement.dataset.foundationReady; };
  }, []);
  const live = !!policy?.live;
  return <main className={styles.page} data-foundation-policy={live ? "live" : "fallback"}>
    <div className={styles.viewport}>
      {live ? <PreviewBoundary><Canvas camera={{ fov: 47, near: 5, far: 100000 }} dpr={1} gl={{ antialias: true, powerPreference: "high-performance", toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.05 }}><Suspense fallback={null}><Scene compact={policy.compact} moving={!policy.reduced} playing={playing} selection={selection} onView={setSelected} /></Suspense></Canvas></PreviewBoundary> : <p className={styles.fallback}>A still composition is active for this device or motion preference.</p>}
    </div>
    <header className={styles.header}><Link href="/"><BrandWordmark/></Link><span>Terrain foundation / local study</span><Link href="/world-lab-review">Current world</Link></header>
    <div className={styles.caption}><p>01 / SOURCE TO SURFACE</p><h1>{VIEWS[selected].label}</h1><p>One continuous landform, from volcanic ridges to the ocean floor.</p></div>
    <div className={styles.controls} aria-label="Terrain study views">
      <div>{VIEWS.map((view,index)=><button aria-pressed={selected===index} disabled={!live} onClick={()=>{setSelection(current=>({index,serial:current.serial+1}));setPlaying(false);}} key={view.id} data-foundation-view={view.id}>{view.label}</button>)}</div>
      <button disabled={!live} aria-pressed={playing} onClick={()=>setPlaying(value=>!value)}>{playing ? "Pause flight" : "Play flight"}</button>
    </div>
    <footer className={styles.note}>Local architecture prototype. NOAA CUDEM terrain · Poly Haven CC0 daylight · <a href={surface.licenseUrl} target="_blank" rel="noopener noreferrer">{surface.attribution} · CC-BY 4.0</a>. Annual composite with authored lighting and water; lake, waterfall and close vegetation remain open.</footer>
  </main>;
}
