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
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { WorldQualityTier } from "./world-ecology";

const RIDGE_ROOT = "/world/v112";
const MANIFEST_URL = `${RIDGE_ROOT}/madagin-ridge-canopy-placement-v1.12.json`;
const CLUSTER_URL = `${RIDGE_ROOT}/madagin-ridge-canopy-clusters-v1.12.glb`;
const CLUSTER_LOW_URL = `${RIDGE_ROOT}/madagin-ridge-canopy-clusters-low-v1.12.glb`;
const NEAR_URL = `${RIDGE_ROOT}/madagin-ridge-canopy-near-v1.12.glb`;
const FOREST_GROUND_URL = "/world/assets/polyhaven/forrest_ground_03/forrest_ground_03_diff_1k.jpg";
const CLUSTER_LEAF_URL = "/world/assets/polyhaven/pachira_aquatica_01/textures/pachira_aquatica_01_leaves_diff_1k.jpg";
const NEAR_KEYS = [
  "pachira_broad",
  "pachira_emergent",
  "pachira_secondary",
  "island01_spreader",
  "island01_sheltered",
  "island02_multitrunk",
  "island02_wind",
  "island03_crest",
  "island03_low",
  "small02_upright",
] as const;

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
  z: number;
  rotation: number;
  scale: [number, number, number];
  hue: number;
  occlusion: number;
};

type RidgeManifest = {
  version: string;
  cellSize: number;
  clusters: RidgePlacement[];
  near: RidgePlacement[];
  coverage: {
    clusterCount: number;
    nearEnhancementCount: number;
    sourceCounts: Record<string, number>;
    nearSourceCounts: Record<string, number>;
    communityCounts: Record<string, number>;
    note: string;
  };
};

type RidgeProductionProps = {
  mobile: boolean;
  shadows: boolean;
  tier: WorldQualityTier;
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
  const detail = { at: performance.now(), label, stage, version: "v1.12" };
  const host = window as Window & { __MADAGIN_RIDGE_STAGES_V112__?: typeof detail[] };
  host.__MADAGIN_RIDGE_STAGES_V112__ = [...(host.__MADAGIN_RIDGE_STAGES_V112__ ?? []), detail].slice(-24);
  window.dispatchEvent(new CustomEvent("madagin:ridge-stage", {
    detail,
  }));
}

function createTerrainMaterial(valley: boolean, forestGround: ReturnType<TextureLoader["load"]>) {
  const material = new MeshStandardMaterial({
    color: "#ffffff",
    map: forestGround,
    metalness: 0,
    roughness: valley ? 0.96 : 0.92,
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
        float macro = ridgeFbm(vRidgeWorldPosition.xz * ${valley ? "0.010" : "0.026"});
        float detail = ridgeFbm(vRidgeWorldPosition.xz * ${valley ? "0.043" : "0.105"} + 31.7);
        float slope = smoothstep(0.22, 0.79, 1.0 - abs(normalize(vRidgeWorldNormal).y));
        float drainage = ridgeNoise(vRidgeWorldPosition.xz * 0.017 - vec2(9.1, 3.7));
        vec3 dampSoil = ${valley ? "vec3(0.04, 0.075, 0.045)" : "vec3(0.055, 0.07, 0.028)"};
        vec3 moss = ${valley ? "vec3(0.065, 0.14, 0.065)" : "vec3(0.1, 0.17, 0.045)"};
        vec3 litter = ${valley ? "vec3(0.14, 0.15, 0.055)" : "vec3(0.17, 0.11, 0.04)"};
        vec3 basalt = ${valley ? "vec3(0.052, 0.072, 0.068)" : "vec3(0.06, 0.07, 0.064)"};
        vec3 sourceSurface = diffuseColor.rgb;
        vec3 ground = mix(dampSoil, moss, smoothstep(0.32, 0.74, macro));
        ground = mix(ground, litter, smoothstep(0.66, 0.88, detail) * (1.0 - drainage * 0.48));
        vec3 authoredGround = mix(ground, basalt, slope * (0.67 + detail * 0.2));
        vec3 microSurface = clamp(sourceSurface * 1.42, vec3(0.28), vec3(1.18));
        diffuseColor.rgb = authoredGround * mix(vec3(0.78), microSurface, ${valley ? "0.34" : "0.48"});`,
      );
  };
  material.customProgramCacheKey = () => `madagin-v112-${valley ? "valley" : "ridge"}-procedural-terrain`;
  return material;
}

function createRockMaterial() {
  const material = new MeshPhysicalMaterial({
    color: "#27332d",
    metalness: 0.02,
    roughness: 0.64,
    side: FrontSide,
  });
  material.clearcoat = 0.16;
  material.clearcoatRoughness = 0.38;
  return material;
}

function createWaterMaterial() {
  const material = new MeshPhysicalMaterial({
    color: "#071f21",
    metalness: 0.16,
    roughness: 0.24,
    side: FrontSide,
  });
  material.clearcoat = 0.72;
  material.clearcoatRoughness = 0.18;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWaterWorldPosition;")
      .replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvWaterWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWaterWorldPosition;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float waterVariation = sin(vWaterWorldPosition.x * 0.21 + vWaterWorldPosition.z * 0.13) * 0.5 + 0.5;
        diffuseColor.rgb *= mix(vec3(0.52, 0.76, 0.72), vec3(0.82, 1.0, 0.92), waterVariation * 0.24);`,
      );
  };
  material.customProgramCacheKey = () => "madagin-v112-intentional-deep-water";
  return material;
}

function terrainUrl(level: "critical" | "balanced" | "high") {
  return `${RIDGE_ROOT}/madagin-ridge-world-${level}-v1.12.glb`;
}

function RidgeTerrainAsset({
  level,
  onReady,
  shadows,
}: {
  level: "critical" | "balanced" | "high";
  onReady: () => void;
  shadows: boolean;
}) {
  const gltf = useLoader(GLTFLoader, terrainUrl(level), configureCompressedGltf);
  const sourceForestGround = useLoader(TextureLoader, FOREST_GROUND_URL);
  const prepared = useMemo(() => {
    const forestGround = sourceForestGround.clone();
    forestGround.colorSpace = SRGBColorSpace;
    forestGround.wrapS = RepeatWrapping;
    forestGround.wrapT = RepeatWrapping;
    forestGround.repeat.set(18, 18);
    forestGround.needsUpdate = true;
    const ridgeMaterial = createTerrainMaterial(false, forestGround);
    const valleyMaterial = createTerrainMaterial(true, forestGround);
    const rockMaterial = createRockMaterial();
    const waterMaterial = createWaterMaterial();
    const scene = gltf.scene.clone(true);
    scene.name = `Madagin v1.12 ${level} authored Ridge and continuous Valley`;
    scene.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const name = hierarchyName(child);
      child.castShadow = shadows && level === "high" && name.includes("ridge_v112_high");
      child.receiveShadow = true;
      child.frustumCulled = true;
      if (name.includes("river_and_lake")) child.material = waterMaterial;
      else if (name.includes("valley_v112")) child.material = valleyMaterial;
      else if (name.includes("outcrop") || name.includes("rock") || name.includes("stone") || name.includes("face")) {
        child.material = rockMaterial;
      } else child.material = ridgeMaterial;
    });
    return { forestGround, materials: [ridgeMaterial, valleyMaterial, rockMaterial, waterMaterial], scene };
  }, [gltf.scene, level, shadows, sourceForestGround]);

  useEffect(() => {
    onReady();
    return () => {
      prepared.materials.forEach((material) => material.dispose());
      prepared.forestGround.dispose();
    };
  }, [onReady, prepared]);

  return <primitive object={prepared.scene} />;
}

function createCanopyMaterial(index: number, leafMap: Texture, foliage: boolean) {
  const colors = ["#123b1b", "#225f28", "#4a7d32"];
  const material = new MeshStandardMaterial({
    color: foliage ? ["#d8e3c4", "#c3d5ae", "#e4edcb"][index % colors.length] : "#76583e",
    emissive: foliage ? "#315f2f" : "#120c08",
    emissiveIntensity: foliage ? 0.18 : 0.06,
    map: foliage ? leafMap : null,
    metalness: 0,
    roughness: 0.91,
    side: FrontSide,
    vertexColors: true,
  });
  if (foliage) material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vCanopyWorldPosition;\nvarying vec3 vCanopyWorldNormal;")
      .replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvCanopyWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvCanopyWorldNormal = normalize(mat3(modelMatrix) * objectNormal);",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vCanopyWorldPosition;\nvarying vec3 vCanopyWorldNormal;",
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float crownBreakup = sin(vCanopyWorldPosition.x * 0.37 + vCanopyWorldPosition.z * 0.29)
          * sin(vCanopyWorldPosition.y * 0.71 - vCanopyWorldPosition.x * 0.18);
        float crownLight = smoothstep(-0.25, 0.9, normalize(vCanopyWorldNormal).y);
        diffuseColor.rgb *= 0.8 + crownBreakup * 0.13 + crownLight * 0.2;`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        float microA = sin(vCanopyWorldPosition.x * 2.7 + vCanopyWorldPosition.y * 3.9 - vCanopyWorldPosition.z * 1.8);
        float microB = sin(vCanopyWorldPosition.z * 3.2 - vCanopyWorldPosition.x * 1.4 + vCanopyWorldPosition.y * 2.1);
        float microC = sin((vCanopyWorldPosition.x + vCanopyWorldPosition.z) * 4.1);
        normal = normalize(normal + mat3(viewMatrix) * vec3(microA, microB, microC) * 0.16);`,
      );
  };
  material.customProgramCacheKey = () => `madagin-v112-canopy-mass-${index}-${foliage ? "leaf" : "bark"}`;
  return material;
}

function clusterSourceKey(object: Object3D) {
  const match = hierarchyName(object).match(/cluster_0[0-7]/);
  return match?.[0] ?? null;
}

function nearSourceKey(object: Object3D) {
  const name = hierarchyName(object);
  return NEAR_KEYS.find((key) => name.includes(key)) ?? null;
}

function prepareSourceParts(scene: Object3D, sourceKind: "cluster" | "near", clusterLeaf?: Texture) {
  scene.updateMatrixWorld(true);
  const result: SourcePart[] = [];
  scene.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const sourceKey = sourceKind === "cluster" ? clusterSourceKey(child) : nearSourceKey(child);
    if (!sourceKey) return;
    const originals = Array.isArray(child.material) ? child.material : [child.material];
    const material = sourceKind === "cluster"
      ? originals.map((original, index) => createCanopyMaterial(
          index,
          clusterLeaf as Texture,
          !original.name.toLowerCase().includes("bark"),
        ))
      : originals.map((original) => {
          const clone = original.clone() as MeshStandardMaterial;
          const foliage = original.name.toLowerCase().includes("leav");
          clone.alphaTest = Math.max(0.38, clone.alphaTest || 0);
          clone.color.set(foliage ? "#dce7cb" : "#8a684c");
          clone.depthWrite = true;
          clone.emissive.set(foliage ? "#294129" : "#080604");
          clone.emissiveIntensity = foliage ? 0.18 : 0.04;
          clone.metalness = 0;
          clone.roughness = Math.max(0.74, clone.roughness ?? 0.9);
          clone.side = DoubleSide;
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
  if (tier !== "conservative") return placement.source;
  const index = Number(placement.source.slice(-2));
  return `cluster_0${index % 4}`;
}

function includeCluster(placement: RidgePlacement, tier: WorldQualityTier, mobile: boolean) {
  if (tier === "high" && !mobile) return true;
  if (tier === "balanced" && !mobile) return true;
  return placement.id % 4 === 0;
}

function includeNear(placement: RidgePlacement, tier: WorldQualityTier) {
  return tier === "high" || placement.id % 3 === 0;
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
    const [cellX, cellZ] = placement.cell.split(":").map(Number);
    const divisorX = tier === "conservative" || mobile ? 3 : tier === "balanced" ? 1.5 : 1;
    const divisorZ = tier === "conservative" || mobile ? 3 : tier === "balanced" ? 1.5 : 1.01;
    const runtimeCell = `${Math.floor(cellX / divisorX)}:${Math.floor(cellZ / divisorZ)}`;
    const id = `${runtimeCell}|${sourceKey}`;
    const batch = grouped.get(id) ?? { cell: runtimeCell, placements: [], sourceKey };
    batch.placements.push(placement);
    if (!mobile && tier !== "conservative" && placement.id % 10 === 0) {
      const direction = placement.id % 2 === 0 ? 1 : -1;
      batch.placements.push({
        ...placement,
        id: placement.id + 100_000,
        hue: placement.hue - 0.018,
        occlusion: Math.min(1, placement.occlusion + 0.04),
        rotation: placement.rotation + 1.73,
        scale: placement.scale.map((value) => value * 0.68) as [number, number, number],
        x: placement.x + direction * (3.4 + (placement.id % 5) * 0.52),
        z: placement.z - direction * (2.7 + (placement.id % 7) * 0.38),
      });
    }
    grouped.set(id, batch);
  });
  return [...grouped.values()];
}

function InstancedPlacementBatch({
  castShadow,
  nearStructure = false,
  part,
  placements,
  tier,
}: {
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
      const farMass = nearStructure ? 1.32 : placement.z < -275 ? 2.28 : 2.42;
      const tierMass = nearStructure ? 1 : tier === "conservative" ? 1.3 : tier === "balanced" ? 1.12 : 1;
      dummy.position.set(placement.x, placement.y + (nearStructure ? 0.8 : 0), placement.z);
      dummy.rotation.set(0, placement.rotation, 0);
      dummy.scale.set(
        placement.scale[0] * farMass * tierMass,
        placement.scale[2] * (nearStructure ? 1.72 : 1.08 + (placement.id % 7) * 0.045),
        placement.scale[2] * farMass * tierMass,
      );
      dummy.updateMatrix();
      matrix.multiplyMatrices(dummy.matrix, part.matrixWorld);
      ref.current?.setMatrixAt(index, matrix);
      const shade = 0.84 + placement.hue * 0.22 + placement.occlusion * 0.06;
      color.setRGB(shade, shade * (1.0 + placement.hue * 0.08), shade * 0.96);
      ref.current?.setColorAt(index, color);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingBox();
    ref.current.computeBoundingSphere();
  }, [nearStructure, part.matrixWorld, placements, tier]);

  return (
    <instancedMesh
      args={[part.geometry, part.material, placements.length]}
      castShadow={castShadow}
      receiveShadow
      ref={ref}
    />
  );
}

function RidgeCanopyClusters({
  manifest,
  mobile,
  shadows,
  tier,
}: RidgeProductionProps & { manifest: RidgeManifest }) {
  const clusterUrl = tier === "high" && !mobile ? CLUSTER_URL : CLUSTER_LOW_URL;
  const gltf = useLoader(GLTFLoader, clusterUrl, configureCompressedGltf);
  const sourceLeaf = useLoader(TextureLoader, CLUSTER_LEAF_URL);
  const leafMap = useMemo(() => {
    const texture = sourceLeaf.clone();
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.needsUpdate = true;
    return texture;
  }, [sourceLeaf]);
  const sources = useMemo(() => prepareSourceParts(gltf.scene, "cluster", leafMap), [gltf.scene, leafMap]);
  const batches = useMemo(() => createClusterBatches(manifest, tier, mobile), [manifest, mobile, tier]);
  const sourcesByKey = useMemo(() => {
    const result = new Map<string, SourcePart[]>();
    sources.forEach((source) => result.set(source.sourceKey, [...(result.get(source.sourceKey) ?? []), source]));
    return result;
  }, [sources]);

  useEffect(() => {
    dispatchStage(1, "canopy-clusters-ready");
    return () => {
      sources.forEach((source) => {
        (Array.isArray(source.material) ? source.material : [source.material]).forEach((item) => item.dispose());
      });
      leafMap.dispose();
    };
  }, [leafMap, sources]);

  return (
    <group name={`Madagin v1.12 canopy · ${batches.length} culled source-cell batches`}>
      {batches.flatMap((batch) => (sourcesByKey.get(batch.sourceKey) ?? []).map((part, index) => (
        <InstancedPlacementBatch
          castShadow={shadows && tier === "high" && batch.placements.some((placement) => placement.z > -120 && placement.id % 17 === 0)}
          key={`${batch.cell}-${batch.sourceKey}-${index}`}
          part={part}
          placements={batch.placements}
          tier={tier}
        />
      )))}
    </group>
  );
}

function RidgeNearEnhancements({ manifest, tier }: { manifest: RidgeManifest; tier: WorldQualityTier }) {
  const gltf = useLoader(GLTFLoader, NEAR_URL, configureCompressedGltf);
  const sources = useMemo(() => prepareSourceParts(gltf.scene, "near"), [gltf.scene]);
  const selected = useMemo(
    () => manifest.near.filter((placement) => includeNear(placement, tier)),
    [manifest.near, tier],
  );
  const bySource = useMemo(() => {
    const result = new Map<string, RidgePlacement[]>();
    selected.forEach((placement) => result.set(placement.source, [...(result.get(placement.source) ?? []), placement]));
    return result;
  }, [selected]);

  useEffect(() => {
    dispatchStage(3, "near-structure-ready");
    return () => sources.forEach((source) => {
      (Array.isArray(source.material) ? source.material : [source.material]).forEach((item) => item.dispose());
    });
  }, [sources]);

  return (
    <group name={`Madagin v1.12 sparse real-tree enhancements · ${selected.length}`}>
      {sources.flatMap((part, index) => {
        const placements = bySource.get(part.sourceKey) ?? [];
        return placements.length ? (
          <InstancedPlacementBatch
            castShadow={false}
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

const MIST_POOLS = [
  { position: [42, -33, -390] as [number, number, number], rotation: [-Math.PI / 2, 0, 0.12] as [number, number, number], scale: [310, 135] as [number, number], opacity: 0.16 },
  { position: [-74, -39, -540] as [number, number, number], rotation: [-Math.PI / 2, 0, -0.18] as [number, number, number], scale: [390, 155] as [number, number], opacity: 0.14 },
  { position: [155, -42, -680] as [number, number, number], rotation: [-Math.PI / 2, 0, 0.31] as [number, number, number], scale: [460, 175] as [number, number], opacity: 0.13 },
  { position: [-210, -30, -825] as [number, number, number], rotation: [-Math.PI / 2, 0, -0.24] as [number, number, number], scale: [520, 185] as [number, number], opacity: 0.11 },
  { position: [82, -19, -955] as [number, number, number], rotation: [-Math.PI / 2, 0, 0.08] as [number, number, number], scale: [610, 205] as [number, number], opacity: 0.09 },
];

function createMistMaterial(opacity: number, seed: number) {
  return new ShaderMaterial({
    depthWrite: false,
    transparent: true,
    side: DoubleSide,
    uniforms: {
      uOpacity: { value: opacity },
      uSeed: { value: seed },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform float uSeed;
      uniform float uTime;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
      }
      void main() {
        vec2 centered = (vUv - 0.5) * vec2(1.0, 2.25);
        float radial = 1.0 - smoothstep(0.22, 1.0, length(centered));
        vec2 drift = vUv * vec2(5.5, 8.0) + vec2(uTime * 0.012, uSeed * 3.7);
        float body = noise(drift) * 0.55 + noise(drift * 2.07 + 8.3) * 0.28;
        float alpha = radial * smoothstep(0.28, 0.82, body + radial * 0.35) * uOpacity;
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(0.58, 0.69, 0.67, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

function RidgeSkyV112({ reducedMotion }: { reducedMotion: boolean }) {
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
        float altitude = smoothstep(-0.08, 0.82, direction.y);
        vec3 horizon = vec3(0.42, 0.34, 0.25);
        vec3 humid = vec3(0.24, 0.4, 0.48);
        vec3 zenith = vec3(0.035, 0.13, 0.29);
        vec3 color = mix(horizon, humid, smoothstep(-0.04, 0.2, direction.y));
        color = mix(color, zenith, altitude);
        vec2 cloudUv = direction.xz / max(0.13, direction.y + 0.42) * 1.55 + vec2(uTime * 0.0025, 0.0);
        float cloudField = fbm(cloudUv) * 0.7 + fbm(cloudUv * 2.3 + 12.0) * 0.3;
        float clouds = smoothstep(0.47, 0.64, cloudField) * smoothstep(-0.02, 0.44, direction.y) * (1.0 - smoothstep(0.62, 0.93, direction.y));
        vec3 cloudShade = mix(vec3(0.42, 0.46, 0.43), vec3(0.88, 0.78, 0.62), smoothstep(0.48, 0.76, cloudField));
        color = mix(color, cloudShade, clouds * 0.66);
        vec3 sunDirection = normalize(vec3(-0.73, 0.23, 0.64));
        float glow = pow(max(dot(direction, sunDirection), 0.0), 18.0);
        float disc = pow(max(dot(direction, sunDirection), 0.0), 620.0);
        color += vec3(0.96, 0.43, 0.13) * glow * 0.34 + vec3(1.0, 0.82, 0.5) * disc * 1.9;
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

function RidgeAtmosphereV112({ reducedMotion, tier }: { reducedMotion: boolean; tier: WorldQualityTier }) {
  const pools = useMemo(
    () => tier === "conservative" ? MIST_POOLS.filter((_, index) => index % 2 === 0) : MIST_POOLS,
    [tier],
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
    <group name="Madagin v1.12 soft-edged spatial atmosphere">
      <RidgeSkyV112 reducedMotion={reducedMotion} />
      {pools.map((pool, index) => (
        <mesh
          key={pool.position.join(":")}
          material={materials[index]}
          position={pool.position}
          renderOrder={-5 + index}
          rotation={pool.rotation}
        >
          <planeGeometry args={[pool.scale[0], pool.scale[1], 1, 1]} />
        </mesh>
      ))}
    </group>
  );
}

function RidgeWorldV112({
  benchmark,
  mobile,
  shadows,
  stage,
  tier,
  reducedMotion,
}: RidgeProductionProps & { benchmark: RidgeBenchmarkMode | null; reducedMotion: boolean; stage: number }) {
  const manifest = useRidgeManifest();
  const [refinedReady, setRefinedReady] = useState(false);
  const refinedLevel = tier === "high" && !mobile ? "high" : "balanced";
  const criticalReady = useCallback(() => dispatchStage(0, "critical-terrain-ready"), []);
  const refinedLoaded = useCallback(() => {
    setRefinedReady(true);
    dispatchStage(2, `${refinedLevel}-terrain-ready`);
  }, [refinedLevel]);
  const showTerrain = benchmark === null || benchmark === "terrain" || benchmark === "full" || benchmark === "shadows";
  const showClusters = benchmark === null || benchmark === "full" || benchmark === "shadows" || benchmark === "forest-far" || benchmark === "forest-mid";
  const showNear = benchmark === "forest-near" || ((benchmark === null || benchmark === "full" || benchmark === "shadows") && stage >= 3 && tier !== "conservative" && !mobile);
  const showAtmosphere = benchmark === null || benchmark === "full" || benchmark === "atmosphere";

  return (
    <group name={`Madagin Ridge v1.12 progressive real-time world · stage ${stage}`}>
      {showTerrain && !refinedReady ? (
        <Suspense fallback={null}>
          <RidgeTerrainAsset level="critical" onReady={criticalReady} shadows={false} />
        </Suspense>
      ) : null}
      {showTerrain && stage >= 2 && tier !== "conservative" ? (
        <Suspense fallback={null}>
          <RidgeTerrainAsset level={refinedLevel} onReady={refinedLoaded} shadows={shadows} />
        </Suspense>
      ) : null}
      {showClusters && stage >= 1 ? (
        <Suspense fallback={null}>
          <RidgeCanopyClusters manifest={manifest} mobile={mobile} shadows={shadows} tier={tier} />
        </Suspense>
      ) : null}
      {showNear ? (
        <Suspense fallback={null}>
          <RidgeNearEnhancements manifest={manifest} tier={tier} />
        </Suspense>
      ) : null}
      {showAtmosphere ? <RidgeAtmosphereV112 reducedMotion={reducedMotion} tier={tier} /> : null}
    </group>
  );
}

export function RidgeProductionV112({ mobile, shadows, tier }: RidgeProductionProps) {
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
    <RidgeWorldV112
      benchmark={benchmark}
      mobile={mobile}
      reducedMotion={reducedMotion}
      shadows={shadows}
      stage={stage}
      tier={tier}
    />
  );
}
