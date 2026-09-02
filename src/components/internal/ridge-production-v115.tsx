"use client";

import { useFrame, useLoader } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  BackSide,
  Color,
  DoubleSide,
  FileLoader,
  FrontSide,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { JourneyCheckpointId } from "@/lib/world-manifest";
import type { WorldQualityTier } from "./world-ecology";

const RIDGE_ROOT = "/world/v115";
const MANIFEST_URL = `${RIDGE_ROOT}/madagin-ridge-ecology-v1.15.json`;
const MID_VEGETATION_URL = `${RIDGE_ROOT}/madagin-ridge-vegetation-mid-v1.15.glb`;
const FAR_VEGETATION_URL = `${RIDGE_ROOT}/madagin-ridge-vegetation-far-v1.15.glb`;
const ASSET_ROOT = "/world/assets/polyhaven";
const TERRAIN_TEXTURES = {
  forest: [`${ASSET_ROOT}/forrest_ground_03/forrest_ground_03_diff_1k.jpg`, `${ASSET_ROOT}/forrest_ground_03/forrest_ground_03_nor_gl_1k.jpg`, `${ASSET_ROOT}/forrest_ground_03/forrest_ground_03_arm_1k.jpg`],
  mossRock: [`${ASSET_ROOT}/aerial_grass_rock/aerial_grass_rock_diff_1k.jpg`, `${ASSET_ROOT}/aerial_grass_rock/aerial_grass_rock_nor_gl_1k.jpg`, `${ASSET_ROOT}/aerial_grass_rock/aerial_grass_rock_arm_1k.jpg`],
  alpine: [`${ASSET_ROOT}/aerial_grass_rock/aerial_grass_rock_diff_1k.jpg`, `${ASSET_ROOT}/aerial_grass_rock/aerial_grass_rock_nor_gl_1k.jpg`, `${ASSET_ROOT}/aerial_grass_rock/aerial_grass_rock_arm_1k.jpg`],
} as const;
const LEAF_TEXTURES = [`${ASSET_ROOT}/pachira_aquatica_01/textures/pachira_aquatica_01_leaves_diff_1k.jpg`, `${ASSET_ROOT}/pachira_aquatica_01/textures/pachira_aquatica_01_leaves_nor_gl_1k.jpg`, `${ASSET_ROOT}/pachira_aquatica_01/textures/pachira_aquatica_01_leaves_arm_1k.jpg`] as const;
const HERO_URL = `${RIDGE_ROOT}/madagin-ridge-vegetation-hero-v1.15.glb`;
type HeroFamily = "pachira_a" | "pachira_b" | "pachira_c" | "pachira_d" | "island_01" | "island_02" | "island_03" | "small_02";
const HERO_BASE_SCALE: Record<HeroFamily, number> = {
  pachira_a: 1,
  pachira_b: 1,
  pachira_c: 1,
  pachira_d: 1,
  island_01: 1,
  island_02: 1,
  island_03: 1,
  small_02: 1,
};
const HERO_FAMILIES: readonly HeroFamily[] = ["pachira_a", "pachira_b", "pachira_c", "pachira_d", "island_01", "island_02", "island_03", "small_02"];

export type RidgeBenchmarkMode =
  | "empty"
  | "terrain"
  | "forest-far"
  | "forest-mid"
  | "forest-near"
  | "shadows"
  | "atmosphere"
  | "full";

const BENCHMARK_MODES = new Set<RidgeBenchmarkMode>([
  "empty",
  "terrain",
  "forest-far",
  "forest-mid",
  "forest-near",
  "shadows",
  "atmosphere",
  "full",
]);

export function inspectRidgeBenchmarkMode(): RidgeBenchmarkMode | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("benchmark") as RidgeBenchmarkMode | null;
  return value && BENCHMARK_MODES.has(value) ? value : null;
}

type RidgePlacement = {
  id: number;
  clusterId?: number;
  source: string;
  community: string;
  cell: string;
  x: number;
  y: number;
  groundY?: number;
  rootOffset?: number;
  rootError?: number;
  rootFootprintRadius?: number;
  rootLocal?: [number, number, number];
  rootWorld?: [number, number, number];
  rootContactSamples?: Array<{
    error: number;
    local: [number, number, number];
    terrainY: number;
    world: [number, number, number];
  }>;
  footprintRelief?: number;
  maxRootGap?: number;
  maxRootBurial?: number;
  slope?: number;
  lean?: [number, number];
  z: number;
  rotation: number;
  scale: [number, number, number];
  hue: number;
  occlusion: number;
  region?: string;
};

type RidgeManifest = {
  version: string;
  cellSize: number;
  clusters: RidgePlacement[];
  near: RidgePlacement[];
  understory: RidgePlacement[];
  coverage: {
    clusterCount: number;
    nearEnhancementCount: number;
    sourceCounts: Record<string, number>;
    nearSourceCounts: Record<string, number>;
    communityCounts: Record<string, number>;
    grounding?: {
      sampleCount: number;
      clusterSampleCount?: number;
      floatingCount: number;
      buriedCount: number;
      maxRootError: number;
      maxRootGap?: number;
      maxRootBurial?: number;
      maxFootprintRelief?: number;
      geometryRootProfilesApplied?: boolean;
      transformedRootVerticesMeasured?: boolean;
      terrainSampledAfterJitter: boolean;
    };
    note: string;
  };
};

type RidgeProductionProps = {
  diagnosticMode?: "grounding" | "water" | "zones" | null;
  mobile: boolean;
  shadows: boolean;
  showOcean: boolean;
  tier: WorldQualityTier;
  zone: JourneyCheckpointId;
};

type SourcePart = {
  geometry: Mesh["geometry"];
  material: Material | Material[];
  matrixWorld: Matrix4;
  sourceKey: string;
};

type PlacementBatch = {
  cell: string;
  placements: RidgePlacement[];
  sourceKey: string;
};

function configureCompressedGltf(loader: GLTFLoader) {
  loader.setMeshoptDecoder(MeshoptDecoder);
}

function useRidgeManifest() {
  const raw = useLoader(FileLoader, MANIFEST_URL) as unknown;
  return useMemo(() => {
    const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw as ArrayBuffer);
    return JSON.parse(text) as RidgeManifest;
  }, [raw]);
}

function hierarchyName(object: Object3D) {
  const names: string[] = [];
  let current: Object3D | null = object;
  while (current) {
    names.push(current.name.toLowerCase());
    current = current.parent;
  }
  return names.join("/");
}

function dispatchStage(stage: number, label: string) {
  if (typeof window === "undefined") return;
  const detail = { at: performance.now(), label, stage, version: "v1.15" };
  const host = window as Window & { __MADAGIN_RIDGE_STAGES_V115__?: typeof detail[] };
  host.__MADAGIN_RIDGE_STAGES_V115__ = [...(host.__MADAGIN_RIDGE_STAGES_V115__ ?? []), detail].slice(-24);
  window.dispatchEvent(new CustomEvent("madagin:ridge-stage", {
    detail,
  }));
}

type TerrainZone = "ridge" | "tropical" | "alpine";

type PbrTextureSet = {
  albedo: Texture;
  arm: Texture;
  normal: Texture;
};

function prepareTextureSet(source: Texture[], repeat: number): PbrTextureSet {
  const [sourceAlbedo, sourceNormal, sourceArm] = source;
  const albedo = sourceAlbedo.clone();
  const normal = sourceNormal.clone();
  const arm = sourceArm.clone();
  [albedo, normal, arm].forEach((texture) => {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    texture.needsUpdate = true;
  });
  albedo.colorSpace = SRGBColorSpace;
  return { albedo, arm, normal };
}

function createTerrainMaterial(zone: TerrainZone, textures: PbrTextureSet) {
  const material = new MeshStandardMaterial({
    aoMap: textures.arm,
    aoMapIntensity: zone === "alpine" ? 1.08 : 1.22,
    color: "#ffffff",
    map: textures.albedo,
    metalness: 0,
    normalMap: textures.normal,
    normalScale: new Vector2(zone === "alpine" ? 0.92 : 0.68, zone === "alpine" ? 0.92 : 0.68),
    roughness: zone === "alpine" ? 0.78 : zone === "ridge" ? 0.84 : 0.9,
    roughnessMap: textures.arm,
    side: FrontSide,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vRidgeWorldPosition;\nvarying vec3 vRidgeWorldNormal;",
      )
      .replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvRidgeWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvRidgeWorldNormal = normalize(mat3(modelMatrix) * objectNormal);",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vRidgeWorldPosition;
        varying vec3 vRidgeWorldNormal;
        float ridgeHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
        float ridgeNoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(ridgeHash(i), ridgeHash(i + vec2(1.0, 0.0)), f.x),
            mix(ridgeHash(i + vec2(0.0, 1.0)), ridgeHash(i + vec2(1.0)), f.x), f.y);
        }
        float ridgeFbm(vec2 p) {
          float value = 0.0; float amplitude = 0.55;
          for (int i = 0; i < 5; i++) { value += ridgeNoise(p) * amplitude; p = p * 2.03 + 7.13; amplitude *= 0.48; }
          return value;
        }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float macro = ridgeFbm(vRidgeWorldPosition.xz * ${zone === "alpine" ? "0.008" : zone === "tropical" ? "0.012" : "0.022"});
        float detail = ridgeFbm(vRidgeWorldPosition.xz * ${zone === "alpine" ? "0.035" : "0.068"} + 31.7);
        float slope = smoothstep(${zone === "alpine" ? "0.16, 0.7" : "0.2, 0.74"}, 1.0 - abs(normalize(vRidgeWorldNormal).y));
        float elevation = smoothstep(${zone === "alpine" ? "18.0, 178.0" : "-34.0, 92.0"}, vRidgeWorldPosition.y);
        float drainage = ridgeNoise(vRidgeWorldPosition.xz * 0.017 - vec2(9.1, 3.7));
        vec3 dampSoil = ${zone === "alpine" ? "vec3(0.19, 0.165, 0.13)" : zone === "tropical" ? "vec3(0.06, 0.085, 0.05)" : "vec3(0.075, 0.07, 0.045)"};
        vec3 moss = ${zone === "alpine" ? "vec3(0.22, 0.21, 0.17)" : zone === "tropical" ? "vec3(0.08, 0.145, 0.067)" : "vec3(0.1, 0.14, 0.062)"};
        vec3 litter = ${zone === "alpine" ? "vec3(0.28, 0.235, 0.18)" : zone === "ridge" ? "vec3(0.19, 0.125, 0.055)" : "vec3(0.18, 0.12, 0.055)"};
        vec3 basalt = ${zone === "alpine" ? "vec3(0.28, 0.265, 0.245)" : "vec3(0.11, 0.125, 0.115)"};
        vec3 sourceSurface = diffuseColor.rgb;
        vec3 ground = mix(dampSoil, moss, smoothstep(0.32, 0.74, macro));
        ground = mix(ground, litter, smoothstep(0.66, 0.88, detail) * (1.0 - drainage * 0.48));
        vec3 authoredGround = mix(ground, basalt, clamp(slope * (0.94 + detail * 0.28) + ${zone === "alpine" ? "elevation * 0.48" : "0.0"}, 0.0, 1.0));
        float sourceLuminance = dot(sourceSurface, vec3(0.2126, 0.7152, 0.0722));
        vec3 microSurface = vec3(clamp(sourceLuminance * ${zone === "alpine" ? "1.12" : "1.36"}, 0.46, 1.18));
        diffuseColor.rgb = authoredGround * mix(vec3(0.8), microSurface, ${zone === "ridge" ? "0.34" : zone === "tropical" ? "0.42" : "0.54"});`,
      );
  };
  material.customProgramCacheKey = () => `madagin-v115-${zone}-layered-pbr-terrain`;
  return material;
}

function createCanopyShellMaterial(textures: PbrTextureSet) {
  const material = new MeshStandardMaterial({
    aoMap: textures.arm,
    aoMapIntensity: 1.3,
    color: "#56634d",
    map: textures.albedo,
    metalness: 0,
    normalMap: textures.normal,
    normalScale: new Vector2(0.34, 0.34),
    roughness: 0.95,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vCanopyShellWorld;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvCanopyShellWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
        varying vec3 vCanopyShellWorld;
        float shellHash(vec2 p) { return fract(sin(dot(p, vec2(113.1, 317.7))) * 43758.5453); }`)
      .replace("#include <map_fragment>", `
        vec2 canopyUv = vCanopyShellWorld.xz * 0.082;
        vec2 canopyCell = floor(canopyUv * 0.27);
        float canopyJitter = shellHash(canopyCell);
        float angle = canopyJitter * 6.2831853;
        mat2 canopyRotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
        vec4 sampledDiffuseColor = texture2D(map, canopyRotation * canopyUv + vec2(canopyJitter, canopyJitter * 1.71));
        vec4 sampledDetailColor = texture2D(map, canopyUv * 1.61 + vec2(canopyJitter * 2.3, -canopyJitter));
        diffuseColor *= mix(sampledDiffuseColor, sampledDetailColor, 0.31);`)
      .replace("#include <color_fragment>", `#include <color_fragment>
        vec2 crownCell = floor(vCanopyShellWorld.xz * 0.15);
        float crown = shellHash(crownCell);
        float fold = sin(vCanopyShellWorld.x * 0.061) * sin(vCanopyShellWorld.z * 0.053);
        vec3 humidDark = vec3(0.22, 0.31, 0.19);
        vec3 sunCrown = vec3(0.39, 0.49, 0.27);
        diffuseColor.rgb *= mix(humidDark, sunCrown, clamp(crown * 0.58 + fold * 0.14, 0.0, 1.0));`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        vec3 crownNormal = vec3(
          sin(vCanopyShellWorld.x * 0.49 + vCanopyShellWorld.z * 0.17),
          sin(vCanopyShellWorld.z * 0.53 - vCanopyShellWorld.x * 0.13),
          sin((vCanopyShellWorld.x + vCanopyShellWorld.z) * 0.31)
        );
        normal = normalize(normal + mat3(viewMatrix) * crownNormal * 0.065);`);
  };
  material.customProgramCacheKey = () => "madagin-v115-textured-far-canopy-shell";
  return material;
}

function createWaterMaterial() {
  const material = new ShaderMaterial({
    side: DoubleSide,
    toneMapped: true,
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWaterWorldPosition;

      void main() {
        vec3 transformed = position;
        transformed.y += sin(position.z * 0.071 + position.x * 0.043 + uTime * 0.55) * 0.055;
        transformed.y += sin(position.x * 0.13 - position.z * 0.017 - uTime * 0.38) * 0.032;
        vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
        vWaterWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vWaterWorldPosition;

      void main() {
        float rippleA = sin(vWaterWorldPosition.x * 0.17 + vWaterWorldPosition.z * 0.09 + uTime * 0.72);
        float rippleB = sin(vWaterWorldPosition.x * -0.08 + vWaterWorldPosition.z * 0.19 - uTime * 0.46);
        float ripple = (rippleA + rippleB) * 0.5;
        vec3 viewDirection = normalize(cameraPosition - vWaterWorldPosition);
        float viewFacing = clamp(abs(viewDirection.y), 0.0, 1.0);
        vec3 skyWater = vec3(0.045, 0.20, 0.22);
        vec3 deepWater = vec3(0.015, 0.09, 0.11);
        vec3 color = mix(skyWater, deepWater, 0.34 + viewFacing * 0.38);
        color += ripple * 0.007;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  material.name = "Madagin v1.15 view-aware connected watershed";
  return material;
}

function createWaterfallMaterial() {
  const material = new MeshPhysicalMaterial({
    clearcoat: 0.66,
    color: "#c6d4d1",
    emissive: "#526c69",
    emissiveIntensity: 0.08,
    metalness: 0,
    opacity: 0.9,
    roughness: 0.28,
    side: DoubleSide,
    transparent: true,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    material.userData.shader = shader;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;\nvarying vec3 vFallWorld;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed.x += sin(position.y * 0.31 + uTime * 1.7) * 0.075 + sin(position.y * 0.83 - uTime * 2.3) * 0.028;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvFallWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;\nvarying vec3 vFallWorld;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        float strandA = sin(vFallWorld.x * 1.7 + vFallWorld.y * 0.19 - uTime * 3.1) * 0.5 + 0.5;
        float strandB = sin(vFallWorld.x * 4.1 - vFallWorld.y * 0.11 - uTime * 5.2) * 0.5 + 0.5;
        float broken = smoothstep(0.2, 0.78, strandA * 0.68 + strandB * 0.32);
        diffuseColor.rgb *= mix(vec3(0.66, 0.76, 0.77), vec3(0.96, 1.0, 0.98), broken * 0.5);
        diffuseColor.a *= 0.72 + broken * 0.28;`);
  };
  material.customProgramCacheKey = () => "madagin-v115-broken-connected-waterfall";
  return material;
}

function createBankMaterial(textures: PbrTextureSet) {
  return new MeshStandardMaterial({
    aoMap: textures.arm,
    color: "#4b5142",
    map: textures.albedo,
    metalness: 0,
    normalMap: textures.normal,
    normalScale: new Vector2(0.7, 0.7),
    roughness: 0.96,
    roughnessMap: textures.arm,
  });
}

function terrainUrl(level: "critical" | "balanced" | "high") {
  return `${RIDGE_ROOT}/madagin-ridge-to-valley-${level}-v1.15.glb`;
}

function RidgeTerrainAsset({
  benchmark,
  level,
  onReady,
  shadows,
}: {
  benchmark: RidgeBenchmarkMode | null;
  level: "critical" | "balanced" | "high";
  onReady: () => void;
  shadows: boolean;
}) {
  const activeWaterMaterial = useRef<ShaderMaterial | null>(null);
  const activeWaterfallMaterial = useRef<MeshPhysicalMaterial | null>(null);
  const gltf = useLoader(GLTFLoader, terrainUrl(level), configureCompressedGltf);
  const forestSource = useLoader(TextureLoader, [...TERRAIN_TEXTURES.forest]);
  const mossRockSource = useLoader(TextureLoader, [...TERRAIN_TEXTURES.mossRock]);
  const alpineSource = useLoader(TextureLoader, [...TERRAIN_TEXTURES.alpine]);
  const leafSource = useLoader(TextureLoader, [...LEAF_TEXTURES]);
  const prepared = useMemo(() => {
    const forest = prepareTextureSet(forestSource, level === "high" ? 54 : 42);
    const mossRock = prepareTextureSet(mossRockSource, level === "high" ? 48 : 36);
    const alpine = prepareTextureSet(alpineSource, level === "high" ? 74 : 58);
    const leaves = prepareTextureSet(leafSource, level === "high" ? 156 : 124);
    const ridgeMaterial = createTerrainMaterial("ridge", forest);
    const tropicalMaterial = createTerrainMaterial("tropical", mossRock);
    const alpineMaterial = createTerrainMaterial("alpine", alpine);
    const canopyShellMaterial = createCanopyShellMaterial(leaves);
    const bankMaterial = createBankMaterial(mossRock);
    const waterMaterial = createWaterMaterial();
    const waterfallMaterial = createWaterfallMaterial();
    const scene = gltf.scene.clone(true);
    scene.name = `Madagin v1.15 ${level} authored Ridge-to-Valley watershed`;
    scene.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const name = hierarchyName(child);
      if (benchmark === "forest-far") child.visible = name.includes("canopy_shell");
      else child.visible = !name.includes("canopy_shell");
      child.castShadow = shadows && level === "high" && name.includes("ridge_v115_high");
      child.receiveShadow = true;
      child.frustumCulled = true;
      if (name.includes("connected_waterfall")) {
        child.visible = child.visible;
        child.material = waterfallMaterial;
      }
      else if (name.includes("waterfall_source") || name.includes("waterfall_outflow")) {
        child.visible = child.visible;
        child.receiveShadow = false;
        child.material = waterMaterial;
      }
      else if (name.includes("river_and_lake")) {
        child.geometry.computeVertexNormals();
        child.receiveShadow = false;
        child.material = waterMaterial;
      }
      else if (name.includes("wet_river_banks")) {
        // The authored terrain already forms the shoreline. Keeping this
        // broad ribbon directly beneath the lake caused distance-dependent
        // depth fighting that read as long brown bands through the water.
        child.visible = false;
        child.material = bankMaterial;
      }
      else if (name.includes("canopy_shell") || name.includes("canopy_underlay")) child.material = canopyShellMaterial;
      else if (name.includes("alpine_valley")) child.material = alpineMaterial;
      else if (name.includes("tropical_valley")) child.material = tropicalMaterial;
      else child.material = ridgeMaterial;
    });
    return {
      materials: [ridgeMaterial, tropicalMaterial, alpineMaterial, canopyShellMaterial, bankMaterial, waterMaterial, waterfallMaterial],
      scene,
      textureSets: [forest, mossRock, alpine, leaves],
      waterMaterial,
      waterfallMaterial,
    };
  }, [alpineSource, benchmark, forestSource, gltf.scene, leafSource, level, mossRockSource, shadows]);

  useFrame(({ clock }) => {
    const waterTime = activeWaterMaterial.current?.uniforms.uTime;
    if (waterTime) waterTime.value = clock.elapsedTime;
    const waterfallShader = activeWaterfallMaterial.current?.userData.shader as { uniforms?: { uTime?: { value: number } } } | undefined;
    if (waterfallShader?.uniforms?.uTime) waterfallShader.uniforms.uTime.value = clock.elapsedTime;
  });

  useEffect(() => {
    activeWaterMaterial.current = prepared.waterMaterial;
    activeWaterfallMaterial.current = prepared.waterfallMaterial;
    onReady();
    return () => {
      activeWaterMaterial.current = null;
      activeWaterfallMaterial.current = null;
      prepared.materials.forEach((material) => material.dispose());
      prepared.textureSets.forEach((textures) => Object.values(textures).forEach((texture) => texture.dispose()));
    };
  }, [onReady, prepared]);

  return <primitive object={prepared.scene} />;
}

function clusterSourceKey(object: Object3D) {
  const match = hierarchyName(object).match(/(?:mid|far)_variant_\d{2}/);
  return match?.[0] ?? null;
}

function nearSourceKey(object: Object3D) {
  const name = hierarchyName(object);
  return name.match(/hero_(pachira_[abcd]|island_0[123]|small_02)/)?.[1] ?? null;
}

function prepareSourceParts(scene: Object3D, sourceKind: "cluster" | "near") {
  scene.updateMatrixWorld(true);
  const result: SourcePart[] = [];
  scene.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const sourceKey = sourceKind === "cluster" ? clusterSourceKey(child) : nearSourceKey(child);
    if (!sourceKey) return;
    const originals = Array.isArray(child.material) ? child.material : [child.material];
    const material = originals.map((original) => {
      const source = original as MeshStandardMaterial;
      const foliage = /lea|twig/i.test(`${original.name}/${child.name}`);
      if (foliage) {
        const leaf = new MeshLambertMaterial({
          alphaMap: source.alphaMap,
          alphaTest: Math.max(sourceKind === "near" ? 0.42 : 0.34, source.alphaTest || 0),
          color: sourceKind === "near" ? "#8caf72" : "#789c68",
          depthWrite: true,
          emissive: "#375532",
          emissiveIntensity: 0.42,
          map: source.map,
          side: DoubleSide,
          transparent: false,
          vertexColors: true,
        });
        leaf.name = `${original.name} · diffuse foliage`;
        return leaf;
      }
      const clone = source.clone();
      clone.color.set("#624733");
      clone.depthWrite = true;
      clone.emissive.set("#080604");
      clone.emissiveIntensity = 0.018;
      clone.metalness = 0;
      clone.roughness = Math.max(0.92, clone.roughness ?? 0.9);
      clone.envMapIntensity = 0.05;
      if (clone.normalScale) clone.normalScale.setScalar(0.72);
      clone.side = FrontSide;
      clone.transparent = false;
      clone.vertexColors = true;
      clone.needsUpdate = true;
      return clone;
    });
    result.push({
      geometry: child.geometry,
      material: material.length === 1 ? material[0] : material,
      matrixWorld: child.matrixWorld.clone(),
      sourceKey,
    });
  });
  return result;
}

function placementSource(placement: RidgePlacement, tier: WorldQualityTier) {
  const index = Number(placement.source.slice(-2));
  if (placement.region === "far-emergents" && index < 8) return `far_variant_${String(index).padStart(2, "0")}`;
  if (tier === "conservative") return `far_variant_${String(index % 8).padStart(2, "0")}`;
  return `mid_variant_${String(index).padStart(2, "0")}`;
}

function includeCluster(placement: RidgePlacement, tier: WorldQualityTier, mobile: boolean) {
  if (placement.region === "ridge" && tier === "balanced" && !mobile) return true;
  if (placement.region === "ridge" && placement.z > -170 && placement.id % 3 !== 0) return false;
  if (tier === "high" && !mobile) return true;
  if (tier === "balanced" && !mobile) return placement.region !== "far-emergents" || placement.id % 2 === 0;
  return placement.id % 5 === 0;
}

function includeNear(placement: RidgePlacement, tier: WorldQualityTier) {
  if (tier === "high") return true;
  if (tier === "balanced") return placement.id % 2 === 0;
  return placement.id % 4 === 0;
}

function createClusterBatches(manifest: RidgeManifest, tier: WorldQualityTier, mobile: boolean) {
  const grouped = new Map<string, PlacementBatch>();
  const replacedClusters = new Set(
    manifest.near
      .filter((placement) => includeNear(placement, tier))
      .map((placement) => placement.clusterId)
      .filter((clusterId): clusterId is number => typeof clusterId === "number"),
  );
  manifest.clusters.forEach((placement) => {
    if (!includeCluster(placement, tier, mobile)) return;
    if (replacedClusters.has(placement.id)) return;
    const sourceKey = placementSource(placement, tier);
    const cell = `${Math.floor((placement.x + 1000) / 500)}:${Math.floor((placement.z + 1750) / 500)}`;
    const id = `${cell}:${sourceKey}`;
    const batch = grouped.get(id) ?? { cell, placements: [], sourceKey };
    batch.placements.push(placement);
    grouped.set(id, batch);
  });
  return [...grouped.values()];
}

function InstancedPlacementBatch({
  assetScale = 1,
  castShadow,
  nearStructure = false,
  part,
  placements,
  tier,
}: {
  assetScale?: number;
  castShadow: boolean;
  nearStructure?: boolean;
  part: SourcePart;
  placements: RidgePlacement[];
  tier: WorldQualityTier;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const dummy = new Object3D();
    const matrix = new Matrix4();
    const color = new Color();
    placements.forEach((placement, index) => {
      dummy.position.set(placement.x, placement.y, placement.z);
      dummy.rotation.set(placement.lean?.[0] ?? 0, placement.rotation, placement.lean?.[1] ?? 0);
      dummy.scale.set(
        placement.scale[0] * assetScale,
        placement.scale[1] * assetScale,
        placement.scale[2] * assetScale,
      );
      dummy.updateMatrix();
      matrix.multiplyMatrices(dummy.matrix, part.matrixWorld);
      ref.current?.setMatrixAt(index, matrix);
      const shade = 0.8 + (placement.occlusion ?? 0.78) * 0.1 + ((placement.id * 17) % 11) * 0.006;
      color.setRGB(
        shade * (0.72 + (placement.hue ?? 0) * 0.24),
        shade * (0.98 + (placement.hue ?? 0) * 0.42),
        shade * (0.62 - (placement.hue ?? 0) * 0.12),
      );
      ref.current?.setColorAt(index, color);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingBox();
    ref.current.computeBoundingSphere();
  }, [assetScale, nearStructure, part.matrixWorld, placements, tier]);

  const receivesShadow = (Array.isArray(part.material) ? part.material : [part.material])
    .every((material) => !(material instanceof MeshLambertMaterial));

  return (
    <instancedMesh
      args={[part.geometry, part.material, placements.length]}
      castShadow={castShadow}
      receiveShadow={receivesShadow}
      ref={ref}
    />
  );
}

function RidgeCanopyClusters({
  manifest,
  mobile,
  shadows,
  tier,
}: Pick<RidgeProductionProps, "mobile" | "shadows" | "tier"> & { manifest: RidgeManifest }) {
  const midGltf = useLoader(GLTFLoader, MID_VEGETATION_URL, configureCompressedGltf);
  const farGltf = useLoader(GLTFLoader, FAR_VEGETATION_URL, configureCompressedGltf);
  const sources = useMemo(
    () => [...prepareSourceParts(midGltf.scene, "cluster"), ...prepareSourceParts(farGltf.scene, "cluster")],
    [farGltf.scene, midGltf.scene],
  );
  const batches = useMemo(() => createClusterBatches(manifest, tier, mobile), [manifest, mobile, tier]);
  const sourcesByKey = useMemo(() => {
    const result = new Map<string, SourcePart[]>();
    sources.forEach((source) => result.set(source.sourceKey, [...(result.get(source.sourceKey) ?? []), source]));
    return result;
  }, [sources]);

  useEffect(() => {
    dispatchStage(1, "textured-middle-canopy-ready");
    return () => {
      sources.forEach((source) => {
        (Array.isArray(source.material) ? source.material : [source.material]).forEach((item) => item.dispose());
      });
    };
  }, [sources]);

  return (
    <group name={`Madagin v1.15 multi-source middle and far canopy · ${batches.length} culled source-cell batches`}>
      {batches.flatMap((batch) => (sourcesByKey.get(batch.sourceKey) ?? []).map((part, index) => (
        <InstancedPlacementBatch
          castShadow={shadows && batch.placements.some((placement) => placement.z > -220 && placement.id % (tier === "high" ? 13 : 31) === 0)}
          key={`${batch.cell}-${batch.sourceKey}-${index}`}
          part={part}
          placements={batch.placements}
          tier={tier}
        />
      )))}
    </group>
  );
}

function heroFamily(source: string, id: number): HeroFamily {
  if (HERO_FAMILIES.includes(source as HeroFamily)) return source as HeroFamily;
  return HERO_FAMILIES[id % HERO_FAMILIES.length];
}

function prepareHeroParts(scene: Object3D, sourceKey: string) {
  scene.updateMatrixWorld(true);
  const result: SourcePart[] = [];
  scene.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const originals = Array.isArray(child.material) ? child.material : [child.material];
    const materials = originals.map((original) => {
      const material = original.clone() as MeshStandardMaterial;
      const foliage = /lea|twig|branch|fern|shrub|moss/i.test(`${original.name}/${child.name}`);
      material.alphaTest = foliage ? Math.max(0.48, material.alphaTest || 0) : material.alphaTest;
      material.color.set(foliage ? "#527843" : "#694b37");
      material.depthWrite = true;
      material.emissive.set(foliage ? "#101c12" : "#050403");
      material.emissiveIntensity = foliage ? 0.14 : 0.028;
      material.metalness = 0;
      material.roughness = Math.max(foliage ? 0.95 : 0.9, material.roughness ?? 0.9);
      material.envMapIntensity = foliage ? 0.035 : 0.06;
      if (material.normalScale) material.normalScale.setScalar(foliage ? 0.46 : 0.72);
      material.side = foliage ? DoubleSide : FrontSide;
      material.transparent = false;
      material.needsUpdate = true;
      return material;
    });
    result.push({
      geometry: child.geometry,
      material: materials.length === 1 ? materials[0] : materials,
      matrixWorld: child.matrixWorld.clone(),
      sourceKey,
    });
  });
  return result;
}

function RidgeNearEnhancements({ manifest, shadows, tier }: { manifest: RidgeManifest; shadows: boolean; tier: WorldQualityTier }) {
  const gltf = useLoader(GLTFLoader, HERO_URL, configureCompressedGltf);
  const sources = useMemo(() => prepareSourceParts(gltf.scene, "near"), [gltf.scene]);
  const selected = useMemo(
    () => manifest.near.filter((placement) => includeNear(placement, tier)),
    [manifest.near, tier],
  );
  const bySource = useMemo(() => {
    const result = new Map<string, RidgePlacement[]>();
    selected.forEach((placement) => {
      const family = heroFamily(placement.source, placement.id);
      result.set(family, [...(result.get(family) ?? []), placement]);
    });
    return result;
  }, [selected]);

  useEffect(() => {
    dispatchStage(3, "deduplicated-hero-vegetation-ready");
    return () => sources.forEach((source) => {
      (Array.isArray(source.material) ? source.material : [source.material]).forEach((item) => item.dispose());
    });
  }, [sources]);

  return (
    <group name={`Madagin v1.15 eight-family grounded hero vegetation · ${selected.length}`}>
      {sources.flatMap((part, index) => {
        const placements = bySource.get(part.sourceKey) ?? [];
        return placements.length ? (
          <InstancedPlacementBatch
            assetScale={HERO_BASE_SCALE[part.sourceKey as HeroFamily]}
            castShadow={shadows && tier !== "conservative"}
            key={`${part.sourceKey}-${index}`}
            nearStructure
            part={part}
            placements={placements}
            tier={tier}
          />
        ) : [];
      })}
    </group>
  );
}

function authoredFeature(id: number, source: string, x: number, y: number, z: number, scale: [number, number, number], rotation: number): RidgePlacement {
  return { cell: "hero", community: "authored-rail-feature", hue: 0, id, occlusion: 0.82, rotation, scale, source, x, y, z };
}

const HERO_GEOLOGY = [
  authoredFeature(1, "rock09", 118, 12.2, 45, [5.6, 4.1, 7.2], 0.34),
  authoredFeature(2, "rock09", 139, 54.8, -50, [4.6, 5.8, 5.2], -0.48),
  authoredFeature(3, "rock09", -75, 63.4, -79, [3.8, 3.1, 4.5], 0.78),
  authoredFeature(4, "rockMoss", 20, 49.2, -99, [4.8, 3.2, 5.6], -0.22),
  authoredFeature(5, "rockMoss", 68, 49.5, -8, [3.8, 2.9, 4.4], 0.42),
];

function RidgeHeroEnvironment({ manifest, shadows, tier }: { manifest: RidgeManifest; shadows: boolean; tier: WorldQualityTier }) {
  const rock09 = useLoader(GLTFLoader, `${ASSET_ROOT}/rock_09/rock_09_1k.gltf`);
  const rockMoss = useLoader(GLTFLoader, `${ASSET_ROOT}/rock_moss_set_02/rock_moss_set_02_1k.gltf`);
  const fern = useLoader(GLTFLoader, `${ASSET_ROOT}/fern_02/fern_02_1k.gltf`);
  const shrub = useLoader(GLTFLoader, `${ASSET_ROOT}/shrub_04/shrub_04_1k.gltf`);
  const moss = useLoader(GLTFLoader, `${ASSET_ROOT}/moss_01/moss_01_1k.gltf`);
  const sources = useMemo(() => [
    ...prepareHeroParts(rock09.scene, "rock09"),
    ...prepareHeroParts(rockMoss.scene, "rockMoss"),
    ...prepareHeroParts(fern.scene, "fern"),
    ...prepareHeroParts(shrub.scene, "shrub"),
    ...prepareHeroParts(moss.scene, "moss"),
  ], [fern.scene, moss.scene, rock09.scene, rockMoss.scene, shrub.scene]);
  const placements = useMemo(() => {
    const divisor = tier === "high" ? 1 : tier === "balanced" ? 2 : 7;
    const understory = (manifest.understory ?? [])
      .filter((placement) => placement.id % divisor === 0)
      .map((placement) => ({ ...placement, cell: "understory", hue: 0, occlusion: 0.78 }));
    return [...HERO_GEOLOGY, ...understory];
  }, [manifest.understory, tier]);
  const bySource = useMemo(() => {
    const result = new Map<string, RidgePlacement[]>();
    placements.forEach((placement) => result.set(placement.source, [...(result.get(placement.source) ?? []), placement]));
    return result;
  }, [placements]);
  const assetScale: Record<string, number> = { fern: 3.4, moss: 5.6, rock09: 0.72, rockMoss: 0.82, shrub: 4.5 };

  useEffect(() => () => sources.forEach((source) => {
    (Array.isArray(source.material) ? source.material : [source.material]).forEach((material) => material.dispose());
  }), [sources]);

  return (
    <group name={`Madagin v1.15 wet basalt and terrain-sampled understory · ${placements.length}`}>
      {sources.flatMap((part, index) => {
        const siblingParts = sources.filter((source) => source.sourceKey === part.sourceKey);
        const siblingIndex = siblingParts.indexOf(part);
        const sourcePlacements = (bySource.get(part.sourceKey) ?? []).filter((placement) => placement.id % siblingParts.length === siblingIndex);
        return sourcePlacements.length ? (
          <InstancedPlacementBatch
            assetScale={assetScale[part.sourceKey] ?? 1}
            castShadow={shadows && (tier === "high" || sourcePlacements.some((placement) => placement.z > -250 && placement.id % 7 === 0))}
            key={`${part.sourceKey}-${index}`}
            nearStructure
            part={part}
            placements={sourcePlacements}
            tier={tier}
          />
        ) : [];
      })}
    </group>
  );
}

function RidgeDeadwood({ manifest, tier }: { manifest: RidgeManifest; tier: WorldQualityTier }) {
  const rootSamples = useMemo(
    () => manifest.near.filter((_, index) => index % (tier === "high" ? 3 : 5) === 0).slice(0, tier === "high" ? 42 : 26),
    [manifest.near, tier],
  );
  const logs = useMemo(() => rootSamples.filter((_, index) => index % 3 === 0), [rootSamples]);
  return (
    <group name="Madagin v1.15 humid fallen deadwood">
      {logs.map((placement, index) => (
        <group
          key={`log-${placement.id}`}
          position={[
            (placement.rootWorld?.[0] ?? placement.x) + Math.sin(index * 2.4) * 7,
            (placement.rootWorld?.[1] ?? placement.groundY ?? placement.y) + 0.42,
            (placement.rootWorld?.[2] ?? placement.z) + Math.cos(index * 1.8) * 7,
          ]}
          rotation={[0, placement.rotation + 0.62, 0]}
        >
          <mesh castShadow receiveShadow rotation={[0, 0, Math.PI / 2]} scale={[0.62, 5.6 + (index % 4) * 1.2, 0.72]}>
            <cylinderGeometry args={[0.72, 0.96, 2, 10]} />
            <meshStandardMaterial color={index % 2 === 0 ? "#37412c" : "#453b2b"} metalness={0} roughness={0.97} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function RidgeGroundingDiagnostics({ manifest }: { manifest: RidgeManifest }) {
  const samples = manifest.near;
  return (
    <group name="DEV ONLY v1.15 geometry-root and terrain-footprint diagnostics">
      {samples.map((placement) => {
        const rootWorld = placement.rootWorld ?? [placement.x, placement.groundY ?? placement.y, placement.z];
        const radius = placement.rootFootprintRadius ?? 0.35;
        return (
          <group key={`grounding-${placement.id}`}>
            <mesh position={[rootWorld[0], rootWorld[1] + 0.12, rootWorld[2]]}>
              <sphereGeometry args={[0.34, 8, 6]} />
              <meshBasicMaterial color="#45ff8a" depthTest={false} />
            </mesh>
            <mesh position={[rootWorld[0], rootWorld[1] + 0.08, rootWorld[2]]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[radius, 0.055, 5, 24]} />
              <meshBasicMaterial
                color={(placement.maxRootGap ?? 0) > 0.24 || (placement.maxRootBurial ?? 0) > 0.34 ? "#ff554d" : (placement.rootError ?? 0) > 0.22 ? "#ffbd45" : "#ffe45c"}
                depthTest={false}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

const MIST_VOLUMES = [
  { position: [-68, 22, -282] as [number, number, number], scale: [150, 26, 88] as [number, number, number], opacity: 0.1 },
  { position: [82, -16, -498] as [number, number, number], scale: [260, 34, 118] as [number, number, number], opacity: 0.09 },
  { position: [-164, -20, -718] as [number, number, number], scale: [330, 42, 138] as [number, number, number], opacity: 0.075 },
  { position: [96, -18, -934] as [number, number, number], scale: [420, 48, 164] as [number, number, number], opacity: 0.06 },
  { position: [156, -23, -727] as [number, number, number], scale: [42, 48, 38] as [number, number, number], opacity: 0.11 },
  { position: [-60, 32, -1260] as [number, number, number], scale: [610, 76, 205] as [number, number, number], opacity: 0.045 },
];

function createMistMaterial(opacity: number, seed: number) {
  return new ShaderMaterial({
    depthWrite: false,
    transparent: true,
    side: BackSide,
    uniforms: {
      uOpacity: { value: opacity },
      uSeed: { value: seed },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vLocal;
      varying vec3 vNormalView;
      varying vec3 vViewDirection;
      void main() {
        vUv = uv;
        vLocal = position;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDirection = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform float uSeed;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vLocal;
      varying vec3 vNormalView;
      varying vec3 vViewDirection;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
      }
      void main() {
        vec2 drift = vec2(vLocal.x, vLocal.z) * 3.4 + vec2(uTime * 0.009, uSeed * 3.7);
        float body = noise(drift) * 0.56 + noise(drift * 2.07 + 8.3) * 0.3;
        float viewEdge = pow(1.0 - abs(dot(normalize(vNormalView), normalize(vViewDirection))), 1.25);
        float vertical = smoothstep(-0.92, -0.12, vLocal.y) * (1.0 - smoothstep(0.18, 0.96, vLocal.y));
        float alpha = (0.16 + viewEdge * 0.84) * vertical * smoothstep(0.24, 0.82, body + vertical * 0.34) * uOpacity;
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(mix(vec3(0.36, 0.48, 0.49), vec3(0.66, 0.69, 0.62), body * 0.34), alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

// Retained as a visual-comparison implementation for isolated atmosphere benchmarks.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function RidgeSkyV115({ reducedMotion }: { reducedMotion: boolean }) {
  const activeMaterial = useRef<ShaderMaterial | null>(null);
  const material = useMemo(() => new ShaderMaterial({
    depthWrite: false,
    side: BackSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec3 vDirection;
      void main() { vDirection = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vDirection;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float value = 0.0; float amplitude = 0.55;
        for (int i = 0; i < 5; i++) { value += noise(p) * amplitude; p = p * 2.03 + 5.7; amplitude *= 0.48; }
        return value;
      }
      void main() {
        vec3 direction = normalize(vDirection);
        float altitude = smoothstep(-0.09, 0.9, direction.y);
        vec3 horizon = vec3(0.52, 0.31, 0.19);
        vec3 humid = vec3(0.22, 0.38, 0.47);
        vec3 zenith = vec3(0.025, 0.095, 0.22);
        vec3 color = mix(horizon, humid, smoothstep(-0.05, 0.19, direction.y));
        color = mix(color, zenith, altitude);
        const float PI = 3.14159265359;
        vec2 skyUv = vec2(atan(direction.z, direction.x) / (PI * 2.0) + 0.5, asin(clamp(direction.y, -1.0, 1.0)) / PI + 0.5);
        vec2 bankUv = skyUv * vec2(5.2, 10.5) + vec2(uTime * 0.0011, 0.0);
        float cloudField = fbm(bankUv) * 0.62 + fbm(bankUv * 2.16 + 12.0) * 0.28 + fbm(bankUv * 4.7 - 7.0) * 0.1;
        float bankBand = smoothstep(-0.02, 0.24, direction.y) * (1.0 - smoothstep(0.34, 0.62, direction.y));
        float cloudBanks = smoothstep(0.46, 0.63, cloudField) * bankBand;
        vec2 highUv = skyUv * vec2(11.0, 4.0) + vec2(-uTime * 0.0007, 3.1);
        float highField = fbm(highUv) * 0.72 + fbm(highUv * 2.4 + 5.2) * 0.28;
        float cirrus = smoothstep(0.54, 0.67, highField) * smoothstep(0.26, 0.58, direction.y) * (1.0 - smoothstep(0.82, 0.98, direction.y));
        vec3 bankShadow = vec3(0.24, 0.3, 0.32);
        vec3 bankLight = vec3(0.88, 0.67, 0.46);
        color = mix(color, mix(bankShadow, bankLight, smoothstep(0.48, 0.75, cloudField)), cloudBanks * 0.78);
        color = mix(color, vec3(0.72, 0.72, 0.68), cirrus * 0.28);
        vec3 sunDirection = normalize(vec3(-0.66, 0.17, -0.73));
        float sunAmount = max(dot(direction, sunDirection), 0.0);
        float glow = pow(sunAmount, 16.0);
        float disc = pow(sunAmount, 860.0);
        color += vec3(1.0, 0.42, 0.12) * glow * 0.42 + vec3(1.0, 0.82, 0.52) * disc * 2.4;
        float dither = hash(gl_FragCoord.xy + uTime) - 0.5;
        color += dither / 255.0;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  }), []);
  useEffect(() => {
    activeMaterial.current = material;
    return () => {
      activeMaterial.current = null;
      material.dispose();
    };
  }, [material]);
  useFrame(({ clock }) => {
    const current = activeMaterial.current;
    if (current) current.uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime;
  });
  return (
    <mesh frustumCulled={false} material={material} renderOrder={-100}>
      <sphereGeometry args={[1300, 40, 24]} />
    </mesh>
  );
}

function RidgeAtmosphereV115({ reducedMotion, showOcean, tier, zone }: {
  reducedMotion: boolean;
  showOcean: boolean;
  tier: WorldQualityTier;
  zone: JourneyCheckpointId;
}) {
  const pools = useMemo(
    () => {
      const prioritized = zone === "waterfall"
        ? [MIST_VOLUMES[4], MIST_VOLUMES[5], MIST_VOLUMES[3]]
        : showOcean
          ? [...MIST_VOLUMES].reverse()
          : MIST_VOLUMES;
      if (tier === "high") return prioritized;
      if (tier === "balanced") return prioritized.slice(0, 5);
      return prioritized.filter((_, index) => index % 2 === 0).slice(0, 3);
    },
    [showOcean, tier, zone],
  );
  const materials = useMemo(
    () => pools.map((pool, index) => createMistMaterial(pool.opacity, index + 1)),
    [pools],
  );
  useFrame(({ clock }) => {
    materials.forEach((material) => { material.uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime; });
  });
  useEffect(() => {
    dispatchStage(2, "atmosphere-ready");
    return () => materials.forEach((material) => material.dispose());
  }, [materials]);
  return (
    <group name="Madagin v1.15 terrain-hugging spatial mist and humid depth atmosphere">
      {pools.map((pool, index) => (
        <mesh
          key={pool.position.join(":")}
          material={materials[index]}
          position={pool.position}
          renderOrder={-5 + index}
          scale={pool.scale}
        >
          <sphereGeometry args={[1, tier === "high" ? 32 : 20, tier === "high" ? 18 : 12]} />
        </mesh>
      ))}
    </group>
  );
}

function RidgeWorldV115({
  benchmark,
  diagnosticMode,
  mobile,
  shadows,
  stage,
  tier,
  reducedMotion,
  showOcean,
  zone,
}: RidgeProductionProps & { benchmark: RidgeBenchmarkMode | null; reducedMotion: boolean; stage: number }) {
  const manifest = useRidgeManifest();
  const [refinedReady, setRefinedReady] = useState(false);
  const refinedLevel = tier === "high" && !mobile ? "high" : "balanced";
  const criticalReady = useCallback(() => dispatchStage(0, "critical-terrain-ready"), []);
  const refinedLoaded = useCallback(() => {
    setRefinedReady(true);
    dispatchStage(2, `${refinedLevel}-terrain-ready`);
  }, [refinedLevel]);
  const showTerrain = benchmark === null || benchmark === "terrain" || benchmark === "forest-far" || benchmark === "full" || benchmark === "shadows";
  const showClusters = benchmark === null || benchmark === "full" || benchmark === "shadows" || benchmark === "forest-mid";
  const showNear = benchmark === "forest-near" || ((benchmark === null || benchmark === "full" || benchmark === "shadows") && stage >= 3 && tier !== "conservative" && !mobile);
  const showAtmosphere = benchmark === null || benchmark === "full" || benchmark === "atmosphere";

  useEffect(() => {
    const host = window as Window & { __MADAGIN_RIDGE_GROUNDING_V115__?: RidgeManifest["coverage"]["grounding"] };
    host.__MADAGIN_RIDGE_GROUNDING_V115__ = manifest.coverage.grounding;
    document.documentElement.dataset.madaginRidgeGroundingV115 = JSON.stringify(manifest.coverage.grounding);
    return () => {
      delete host.__MADAGIN_RIDGE_GROUNDING_V115__;
      delete document.documentElement.dataset.madaginRidgeGroundingV115;
    };
  }, [manifest.coverage.grounding]);

  return (
    <group name={`Madagin Ridge-to-Valley v1.15 progressive real-time world · stage ${stage}`}>
      {showTerrain && !refinedReady ? (
        <Suspense fallback={null}>
          <RidgeTerrainAsset benchmark={benchmark} level="critical" onReady={criticalReady} shadows={false} />
        </Suspense>
      ) : null}
      {showTerrain && stage >= 2 && tier !== "conservative" ? (
        <Suspense fallback={null}>
          <RidgeTerrainAsset benchmark={benchmark} level={refinedLevel} onReady={refinedLoaded} shadows={shadows} />
        </Suspense>
      ) : null}
      {showClusters && stage >= 1 ? (
        <Suspense fallback={null}>
          <RidgeCanopyClusters manifest={manifest} mobile={mobile} shadows={shadows} tier={tier} />
        </Suspense>
      ) : null}
      {showNear ? (
        <Suspense fallback={null}>
          <RidgeNearEnhancements manifest={manifest} shadows={shadows} tier={tier} />
          <RidgeHeroEnvironment manifest={manifest} shadows={shadows} tier={tier} />
          <RidgeDeadwood manifest={manifest} tier={tier} />
        </Suspense>
      ) : null}
      {showAtmosphere ? <RidgeAtmosphereV115 reducedMotion={reducedMotion} showOcean={showOcean} tier={tier} zone={zone} /> : null}
      {diagnosticMode === "grounding" ? <RidgeGroundingDiagnostics manifest={manifest} /> : null}
    </group>
  );
}

export function RidgeProductionV115({ diagnosticMode, mobile, shadows, showOcean, tier, zone }: RidgeProductionProps) {
  const benchmark = useMemo(() => inspectRidgeBenchmarkMode(), []);
  const [stage, setStage] = useState(benchmark ? 3 : 0);
  const reducedMotion = typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (benchmark) return;
    const clusters = window.setTimeout(() => setStage(1), 180);
    const refined = window.setTimeout(() => setStage(2), 760);
    const near = window.setTimeout(() => setStage(3), 1500);
    return () => {
      window.clearTimeout(clusters);
      window.clearTimeout(refined);
      window.clearTimeout(near);
    };
  }, [benchmark]);

  useEffect(() => dispatchStage(stage, `progressive-stage-${stage}`), [stage]);
  if (benchmark === "empty") return null;

  return (
    <RidgeWorldV115
      benchmark={benchmark}
      diagnosticMode={diagnosticMode}
      mobile={mobile}
      reducedMotion={reducedMotion}
      shadows={shadows}
      showOcean={showOcean}
      stage={stage}
      tier={tier}
      zone={zone}
    />
  );
}
