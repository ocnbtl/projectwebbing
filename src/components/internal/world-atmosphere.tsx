"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  Vector3,
  type WebGLRenderTarget,
} from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import type { WorldQualityTier } from "./world-ecology";

export const MADAGIN_SUN_DIRECTION = new Vector3(-0.76, 0.2, -0.62).normalize();
export const MADAGIN_SUN_POSITION: [number, number, number] = [
  MADAGIN_SUN_DIRECTION.x * 180,
  MADAGIN_SUN_DIRECTION.y * 180,
  MADAGIN_SUN_DIRECTION.z * 180,
];

type WorldAtmosphereProps = {
  reducedMotion: boolean;
  showClouds: boolean;
  showSky: boolean;
  showValleyFog: boolean;
  tier: WorldQualityTier;
};

function configureSky(sky: Sky, showSunDisc = true) {
  sky.scale.setScalar(2400);
  sky.frustumCulled = false;
  const material = sky.material as ShaderMaterial;
  material.uniforms.turbidity.value = 4.8;
  material.uniforms.rayleigh.value = 1.75;
  material.uniforms.mieCoefficient.value = 0.0055;
  material.uniforms.mieDirectionalG.value = 0.82;
  material.uniforms.sunPosition.value.copy(MADAGIN_SUN_DIRECTION);
  if (material.uniforms.showSunDisc) material.uniforms.showSunDisc.value = showSunDisc;
  material.depthWrite = false;
  return sky;
}

function DaylightSky() {
  const sky = useMemo(() => {
    const result = configureSky(new Sky());
    result.name = "Madagin humid golden-hour daylight sky";
    return result;
  }, []);

  useEffect(
    () => () => {
      sky.geometry.dispose();
      (sky.material as ShaderMaterial).dispose();
    },
    [sky],
  );

  return <primitive object={sky} renderOrder={-20} />;
}

function PhysicalSkyEnvironment({ tier }: Pick<WorldAtmosphereProps, "tier">) {
  const { gl, scene } = useThree();

  useEffect(() => {
    const environmentScene = new Scene();
    const environmentSky = configureSky(new Sky(), false);
    environmentSky.scale.setScalar(92);
    environmentScene.add(environmentSky);
    const generator = new PMREMGenerator(gl);
    const size = tier === "high" ? 128 : 64;
    let target: WebGLRenderTarget | null = null;
    const previousEnvironment = scene.environment;
    const previousIntensity = scene.environmentIntensity;

    try {
      target = generator.fromScene(environmentScene, 0.045, 0.1, 100, { size });
      scene.environment = target.texture;
      scene.environmentIntensity = tier === "conservative" ? 0.54 : 0.68;
    } finally {
      generator.dispose();
      environmentScene.remove(environmentSky);
      environmentSky.geometry.dispose();
      (environmentSky.material as ShaderMaterial).dispose();
    }

    return () => {
      scene.environment = previousEnvironment;
      scene.environmentIntensity = previousIntensity;
      target?.dispose();
    };
  }, [gl, scene, tier]);

  return null;
}

type CloudLayer = {
  coverage: number;
  offset: [number, number];
  opacity: number;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  size: [number, number];
  speed: [number, number];
};

const CLOUD_LAYERS: CloudLayer[] = [
  {
    coverage: 0.55,
    offset: [0.14, 0.53],
    opacity: 0.26,
    position: [8, 150, -252],
    rotation: [0, 0, -0.035],
    scale: 2.15,
    size: [650, 174],
    speed: [0.0017, -0.0007],
  },
  {
    coverage: 0.58,
    offset: [0.67, 0.21],
    opacity: 0.2,
    position: [-124, 205, -172],
    rotation: [0.045, -0.06, 0.11],
    scale: 2.72,
    size: [430, 138],
    speed: [-0.001, 0.00135],
  },
  {
    coverage: 0.62,
    offset: [0.42, 0.81],
    opacity: 0.12,
    position: [32, 260, -74],
    rotation: [-Math.PI / 2, 0, -0.16],
    scale: 3.8,
    size: [720, 560],
    speed: [0.0006, 0.0009],
  },
];

function createCloudMaterial(layer: CloudLayer) {
  return new ShaderMaterial({
    depthWrite: false,
    transparent: true,
    uniforms: {
      uHighlight: { value: new Color("#dccfc0") },
      uOpacity: { value: layer.opacity },
      uPointSize: { value: 720 / Math.max(0.7, layer.scale) },
      uShadow: { value: new Color("#7d9298") },
      uSpeed: { value: layer.speed },
      uTime: { value: 0 },
    },
    vertexShader: `
      attribute float aSeed;
      uniform float uPointSize;
      uniform vec2 uSpeed;
      uniform float uTime;
      varying float vSeed;
      varying float vHeight;
      void main() {
        vSeed = aSeed;
        vHeight = position.y;
        vec3 animated = position;
        animated.x += sin(aSeed * 31.7 + uTime * 0.045) * 3.4 + uSpeed.x * uTime * 120.0;
        animated.z += cos(aSeed * 19.3 + uTime * 0.038) * 2.8 + uSpeed.y * uTime * 120.0;
        vec4 viewPosition = modelViewMatrix * vec4(animated, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = clamp(uPointSize * (260.0 / max(48.0, -viewPosition.z)), 48.0, 420.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uHighlight;
      uniform float uOpacity;
      uniform vec3 uShadow;
      uniform float uTime;
      varying float vSeed;
      varying float vHeight;

      float hash(float p) {
        return fract(sin(p * 127.1) * 43758.5453123);
      }
      void main() {
        vec2 centered = gl_PointCoord - 0.5;
        float radius = length(centered) * 2.0;
        float softBody = 1.0 - smoothstep(0.34, 1.0, radius);
        float erosion = hash(vSeed * 97.3 + floor(gl_PointCoord.x * 7.0) + floor(gl_PointCoord.y * 7.0) * 11.0);
        float density = smoothstep(0.18, 0.72, softBody * (0.78 + erosion * 0.34));
        float light = clamp(0.38 + gl_PointCoord.y * 0.48 + hash(vSeed * 41.0) * 0.18, 0.0, 1.0);
        vec3 color = mix(uShadow, uHighlight, light);
        float alpha = density * uOpacity * (0.66 + hash(vSeed * 13.7) * 0.34);
        if (alpha < 0.008) discard;
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

function createVolumeGeometry(size: [number, number], count: number, seed: number, depthScale = 1.15) {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const positions: number[] = [];
  const seeds: number[] = [];
  while (seeds.length < count) {
    const x = random() * 2 - 1;
    const y = random() * 2 - 1;
    const z = random() * 2 - 1;
    if (x * x + y * y + z * z > 1) continue;
    positions.push(x * size[0] * 0.48, y * size[1] * 0.48, z * size[1] * depthScale);
    seeds.push(random());
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new Float32BufferAttribute(seeds, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

function CloudVolumes({ reducedMotion, tier }: WorldAtmosphereProps) {
  const visibleLayers = tier === "high" ? 3 : tier === "balanced" ? 2 : 1;
  const layers = useMemo(() => CLOUD_LAYERS.slice(0, visibleLayers), [visibleLayers]);
  const materials = useMemo(() => layers.map(createCloudMaterial), [layers]);
  const geometries = useMemo(
    () => layers.map((layer, index) => createVolumeGeometry(layer.size, tier === "high" ? 74 : tier === "balanced" ? 48 : 28, 1150 + index * 97)),
    [layers, tier],
  );
  const materialRefs = useRef(materials);

  useEffect(() => {
    materialRefs.current = materials;
    return () => {
      materials.forEach((material) => material.dispose());
      geometries.forEach((geometry) => geometry.dispose());
    };
  }, [geometries, materials]);

  useFrame(({ clock }) => {
    const time = reducedMotion ? 0 : clock.elapsedTime;
    materialRefs.current.forEach((material) => {
      material.uniforms.uTime.value = time;
    });
  });

  return (
    <group name="Spatial trade-wind particle cloud volumes">
      {layers.map((layer, index) => (
        <points
          geometry={geometries[index]}
          key={`${layer.position.join("-")}-${index}`}
          material={materials[index]}
          position={layer.position}
          renderOrder={-12 + index}
          rotation={layer.rotation}
        />
      ))}
    </group>
  );
}

type FogRibbon = {
  opacity: number;
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number];
  speed: number;
};

const FOG_RIBBONS: FogRibbon[] = [
  { opacity: 0.12, position: [-8, 7.8, -43], rotation: [-Math.PI / 2, 0, 0.08], size: [94, 31], speed: 0.012 },
  { opacity: 0.1, position: [16, 11.5, -82], rotation: [-Math.PI / 2, 0, -0.11], size: [124, 38], speed: -0.009 },
  { opacity: 0.08, position: [-11, 17, -128], rotation: [-Math.PI / 2, 0, 0.16], size: [162, 46], speed: 0.006 },
  { opacity: 0.065, position: [22, 23, -178], rotation: [-Math.PI / 2, 0, -0.04], size: [196, 52], speed: -0.004 },
];

function createFogMaterial(ribbon: FogRibbon) {
  const material = createCloudMaterial({
    coverage: 0.5,
    offset: [0, 0],
    opacity: ribbon.opacity,
    position: ribbon.position,
    rotation: ribbon.rotation,
    scale: 3.2,
    size: ribbon.size,
    speed: [ribbon.speed, -ribbon.speed * 0.37],
  });
  material.uniforms.uHighlight.value = new Color("#b9cbc7");
  material.uniforms.uShadow.value = new Color("#58706f");
  material.uniforms.uPointSize.value = 26;
  return material;
}

function ValleyFogRibbons({ reducedMotion, tier }: WorldAtmosphereProps) {
  const visibleCount = tier === "high" ? 4 : tier === "balanced" ? 3 : 2;
  const ribbons = useMemo(() => FOG_RIBBONS.slice(0, visibleCount), [visibleCount]);
  const materials = useMemo(() => ribbons.map(createFogMaterial), [ribbons]);
  const geometries = useMemo(
    () => ribbons.map((ribbon, index) => createVolumeGeometry(ribbon.size, tier === "high" ? 150 : 96, 2250 + index * 53, 0.48)),
    [ribbons, tier],
  );

  useFrame(({ clock }) => {
    const time = reducedMotion ? 0 : clock.elapsedTime;
    materials.forEach((material) => {
      material.uniforms.uTime.value = time;
    });
  });
  useEffect(() => () => {
    materials.forEach((material) => material.dispose());
    geometries.forEach((geometry) => geometry.dispose());
  }, [geometries, materials]);

  return (
    <group name="Spatial valley fog particle volumes">
      {ribbons.map((ribbon, index) => (
        <points
          geometry={geometries[index]}
          key={`${ribbon.position.join("-")}-${index}`}
          material={materials[index]}
          position={ribbon.position}
          renderOrder={-4 + index}
          rotation={ribbon.rotation}
        />
      ))}
    </group>
  );
}

export function WorldAtmosphere(props: WorldAtmosphereProps) {
  return (
    <group name="Madagin physical atmosphere v1.1">
      {props.showSky ? <DaylightSky /> : null}
      <PhysicalSkyEnvironment tier={props.tier} />
      {props.showClouds ? <CloudVolumes {...props} /> : null}
      {props.showValleyFog ? <ValleyFogRibbons {...props} /> : null}
    </group>
  );
}
