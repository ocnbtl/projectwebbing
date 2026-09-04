"use client";

import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import type { MotionValue } from "motion/react";
import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent as ReactWheelEvent } from "react";
import {
  ACESFilmicToneMapping,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  DirectionalLight as ThreeDirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  CONTACT_ASCENT,
  CONTACT_CAMERA,
  JOURNEY_CHECKPOINTS,
  WORLD_VIEWS,
  getJourneyCheckpoint,
  getWorldView,
  type JourneyCheckpointId,
  type WorldViewId,
} from "@/lib/world-manifest";
import styles from "./world-lab.module.css";
import { MADAGIN_SUN_POSITION, WorldAtmosphere } from "./world-atmosphere";
import { WorldEcology, worldSurfaceHeight } from "./world-ecology";
import { inspectRidgeBenchmarkMode, type RidgeBenchmarkMode } from "./ridge-production-v115";

type DeviceProfile = {
  tier: "high" | "balanced" | "conservative";
  forcedTier: boolean;
  graphics: string;
  memory: string;
  cores: number;
  pixelRatio: number;
  mobile: boolean;
  motionOverride: boolean;
  reducedMotion: boolean;
  forcedFallback: boolean;
  webgl2: boolean;
};

type InspectionState = {
  enabled: boolean;
  pitch: number;
  yaw: number;
  zoom: number;
};

type DiagnosticMode = "grounding" | "water" | "zones" | null;
type WorldVersion = "v115" | "v116";

type RenderStats = {
  fps: number;
  calls: number;
  geometries: number;
  rendererPixelRatio: number;
  textures: number;
  triangles: number;
};

type AssetRequestAudit = {
  encodedWorldBytes: number;
  longTasks: number;
  measuredForMs: number;
  observedWorldBytes: number;
  ridgeRequests: number;
  totalObservedBytes: number;
  totalRequests: number;
  videoRequests: number;
  worldRequests: number;
};

type NavigatorWithMemory = Navigator & { deviceMemory?: number };

function inspectDevice(allowTestOverrides = true): DeviceProfile {
  const canvas = document.createElement("canvas");
  const searchParams = new URLSearchParams(window.location.search);
  const forcedFallback = allowTestOverrides && searchParams.get("forceFallback") === "1";
  const motionOverride = allowTestOverrides && searchParams.get("reducedMotion") === "1";
  const requestedTier = allowTestOverrides ? searchParams.get("quality") : null;
  const forcedTier = requestedTier === "high" || requestedTier === "balanced" || requestedTier === "conservative";
  const webglContext = canvas.getContext("webgl2");
  const debugRendererInfo = webglContext?.getExtension("WEBGL_debug_renderer_info");
  const graphics = webglContext
    ? String(webglContext.getParameter(debugRendererInfo?.UNMASKED_RENDERER_WEBGL ?? webglContext.RENDERER))
    : "Unavailable";
  const webgl2 = Boolean(webglContext) && !forcedFallback;
  const memoryValue = (navigator as NavigatorWithMemory).deviceMemory;
  const cores = navigator.hardwareConcurrency || 1;
  const pixelRatio = window.devicePixelRatio || 1;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches || motionOverride;
  const mobile = (allowTestOverrides && searchParams.get("mobile") === "1") || window.matchMedia("(max-width: 700px)").matches;
  const constrained = (memoryValue !== undefined && memoryValue <= 4) || cores <= 4;
  const abundant = (memoryValue === undefined || memoryValue >= 8) && cores >= 8;
  const detectedTier = allowTestOverrides
    ? constrained ? "conservative" : abundant ? "high" : "balanced"
    : mobile || constrained ? "conservative" : "balanced";

  return {
    tier: forcedTier
      ? requestedTier
      : mobile && detectedTier === "high" ? "balanced" : detectedTier,
    forcedTier,
    graphics,
    memory: memoryValue === undefined ? "Not exposed" : `${memoryValue} GB`,
    cores,
    pixelRatio,
    mobile,
    motionOverride,
    reducedMotion,
    forcedFallback,
    webgl2,
  };
}

function inspectInitialCheckpoint() {
  if (typeof window === "undefined") return 0;
  const checkpointId = new URLSearchParams(window.location.search).get("checkpoint");
  const index = JOURNEY_CHECKPOINTS.findIndex((checkpoint) => checkpoint.id === checkpointId);
  return index >= 0 ? index : 0;
}

function inspectInitialWorldVersion(): WorldVersion {
  if (typeof window === "undefined") return "v116";
  return new URLSearchParams(window.location.search).get("world") === "115" ? "v115" : "v116";
}

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function formatTransferSize(bytes: number) {
  if (bytes <= 0) return "0 B";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const FIR_TEXTURE_ROOT = "/world/assets/polyhaven/fir_tree_01";
const SHOW_PROCEDURAL_DISTANCE_FIELD = false;
const RIDGE_SHOT_DURATION_MS = 22_000;
const FULL_JOURNEY_DURATION_MS = 54_000;
const RIDGE_SHOT_POSITION = new CatmullRomCurve3([
  new Vector3(112, 82, 280),
  new Vector3(120, 106, 112),
  new Vector3(106, 144, 12),
  new Vector3(88, 166, -126),
  new Vector3(128, 214, -310),
], false, "centripetal");
const RIDGE_SHOT_LOOK = new CatmullRomCurve3([
  new Vector3(10, 48, 128),
  new Vector3(38, 42, -132),
  new Vector3(8, 10, -350),
  new Vector3(18, -43, -710),
  new Vector3(34, -55, -980),
], false, "centripetal");
const RIDGE_MOBILE_SHOT_POSITION = new CatmullRomCurve3([
  new Vector3(110, 90, 260),
  new Vector3(108, 114, 126),
  new Vector3(90, 150, 18),
  new Vector3(50, 180, -120),
  new Vector3(68, 226, -292),
], false, "centripetal");
const RIDGE_MOBILE_SHOT_LOOK = new CatmullRomCurve3([
  new Vector3(4, 52, 116),
  new Vector3(34, 46, -122),
  new Vector3(0, 18, -330),
  new Vector3(-8, -35, -690),
  new Vector3(-10, -48, -960),
], false, "centripetal");
const FULL_JOURNEY_POSITION = new CatmullRomCurve3(
  JOURNEY_CHECKPOINTS.map((checkpoint) => new Vector3().fromArray(checkpoint.camera)),
  false,
  "centripetal",
);
const FULL_JOURNEY_LOOK = new CatmullRomCurve3(
  JOURNEY_CHECKPOINTS.map((checkpoint) => new Vector3().fromArray(checkpoint.lookAt)),
  false,
  "centripetal",
);
const FULL_JOURNEY_MOBILE_POSITION = new CatmullRomCurve3(
  JOURNEY_CHECKPOINTS.map((checkpoint) => new Vector3().fromArray(checkpoint.mobileCamera)),
  false,
  "centripetal",
);
const FULL_JOURNEY_MOBILE_LOOK = new CatmullRomCurve3(
  JOURNEY_CHECKPOINTS.map((checkpoint) => new Vector3().fromArray(checkpoint.mobileLookAt)),
  false,
  "centripetal",
);

function authoredJourneyCurveParameter(rawProgress: number) {
  const bounded = Math.min(1, Math.max(0, rawProgress));
  let segment = 0;
  for (let index = 1; index < JOURNEY_CHECKPOINTS.length; index += 1) {
    if (bounded >= JOURNEY_CHECKPOINTS[index].progress) segment = index;
  }
  if (segment >= JOURNEY_CHECKPOINTS.length - 1) return 1;
  const start = JOURNEY_CHECKPOINTS[segment].progress;
  const end = JOURNEY_CHECKPOINTS[segment + 1].progress;
  const local = Math.min(1, Math.max(0, (bounded - start) / Math.max(0.0001, end - start)));
  const eased = local * local * (3 - 2 * local);
  return (segment + eased) / (JOURNEY_CHECKPOINTS.length - 1);
}
const SHOW_LEGACY_FIR_GROVE = false;

function createFirCanopyGeometry(tier: DeviceProfile["tier"]) {
  const ringCount = tier === "high" ? 14 : tier === "balanced" ? 11 : 8;
  const planesPerBough = tier === "high" ? 3 : 2;
  const baseBranchCount = tier === "high" ? 9 : tier === "balanced" ? 7 : 6;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  function pushTaperedPlane(base: Vector3, tip: Vector3, axis: Vector3, width: number) {
    const vertexOffset = positions.length / 3;
    const tipWidth = Math.max(0.012, width * 0.12);
    const baseLeft = base.clone().addScaledVector(axis, -width);
    const baseRight = base.clone().addScaledVector(axis, width);
    const tipRight = tip.clone().addScaledVector(axis, tipWidth);
    const tipLeft = tip.clone().addScaledVector(axis, -tipWidth);
    [baseLeft, baseRight, tipRight, tipLeft].forEach((vertex) => {
      positions.push(vertex.x, vertex.y, vertex.z);
    });
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(
      vertexOffset, vertexOffset + 1, vertexOffset + 2,
      vertexOffset, vertexOffset + 2, vertexOffset + 3,
    );
  }

  for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
    const crownProgress = ringIndex / Math.max(1, ringCount - 1);
    const y = 0.72 + crownProgress * 3.48;
    const branchCount = Math.max(5, Math.round(baseBranchCount - crownProgress * 3));
    const branchLength = 0.34 + (1 - crownProgress) ** 0.72 * 1.78;
    const droop = 0.05 + (1 - crownProgress) * branchLength * 0.16;
    const angleOffset = ringIndex * 2.399963 + Math.sin(ringIndex * 1.73) * 0.13;

    for (let branchIndex = 0; branchIndex < branchCount; branchIndex += 1) {
      const angle = angleOffset + (branchIndex / branchCount) * Math.PI * 2;
      const radial = new Vector3(Math.cos(angle), 0, Math.sin(angle));
      const base = radial.clone().multiplyScalar(0.08).setY(y);
      const tip = radial.clone().multiplyScalar(branchLength).setY(y - droop);
      const branchDirection = tip.clone().sub(base).normalize();
      const tangent = new Vector3(-Math.sin(angle), 0, Math.cos(angle)).normalize();
      const lift = new Vector3().crossVectors(tangent, branchDirection).normalize();
      const boughWidth = 0.07 + branchLength * 0.068;

      for (let planeIndex = 0; planeIndex < planesPerBough; planeIndex += 1) {
        const planeAngle = (planeIndex / planesPerBough) * Math.PI;
        const axis = tangent
          .clone()
          .multiplyScalar(Math.cos(planeAngle))
          .addScaledVector(lift, Math.sin(planeAngle))
          .normalize();
        pushTaperedPlane(base, tip, axis, boughWidth);
      }
    }
  }

  const leaderBase = new Vector3(0, 3.85, 0);
  const leaderTip = new Vector3(0, 4.72, 0);
  pushTaperedPlane(leaderBase, leaderTip, new Vector3(1, 0, 0), 0.16);
  pushTaperedPlane(leaderBase, leaderTip, new Vector3(0, 0, 1), 0.16);

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function terrainHeight(x: number, y: number) {
  const broadUndulation = 0.42 * Math.sin(x * 0.23 + y * 0.08) + 0.24 * Math.sin(y * 0.31);
  const eastWall = Math.max(0, (x - 7) / 15) ** 1.7 * (8 + 1.8 * Math.sin(y * 0.12));
  const westFoothill = Math.exp(-(((x + 11.5) / 5.4) ** 2)) * (2.4 + 0.8 * Math.sin(y * 0.19));
  const northernLift = Math.max(0, (y - 27) / 23) ** 1.45 * 8.5;
  const valleyCut = Math.exp(-(((x - 0.5) / 6.2) ** 2)) * 0.9;
  const riverCut = Math.exp(-(((x + 1.8 * Math.sin(y * 0.08)) / 2.4) ** 2)) * 0.38;
  const macro = Math.max(
    -0.18,
    0.65 + broadUndulation + eastWall + westFoothill + northernLift - valleyCut - riverCut,
  );
  const geological =
    0.18 * Math.sin(x * 1.19 + y * 0.31) +
    0.11 * Math.sin(x * 2.41 - y * 0.67) +
    0.07 * Math.sin((x + y) * 4.07);
  const erosion = -0.24 * Math.exp(-(((x - 0.8 * Math.sin(y * 0.12)) / 2.7) ** 2));
  const lakeBasin = -0.32 * Math.exp(-(((x + 0.3) / 6.8) ** 2 + ((y - 12) / 11.5) ** 2));
  return Math.max(-0.24, macro + geological + erosion + lakeBasin);
}

function openingRidgeHeight(x: number, z: number) {
  const y = -z;
  const ridgeCenterY = -12 + 1.35 * Math.sin(x * 0.16 + 0.9) + 0.55 * Math.sin(x * 0.43 - 0.6);
  const alongPath = Math.exp(-(((y - ridgeCenterY) / 7.4) ** 2));
  const centralSaddle = -1.45 * Math.exp(-(((x + 1.2) / 5.3) ** 2));
  const asymmetry = 0.72 * Math.sin(x * 0.24 + 0.7) + 0.34 * Math.sin(x * 0.61 - 1.2);
  const broadCrown = 8.35 + centralSaddle + asymmetry;
  const sideFalloff = Math.max(0, 1 - Math.max(0, Math.abs(x) - 17) / 5);
  const lift = Math.max(0, alongPath * broadCrown * sideFalloff);
  const micro =
    0.14 * Math.sin(x * 1.19 + y * 0.41) +
    0.08 * Math.sin(x * 2.73 - y * 0.83) +
    0.04 * Math.sin((x - y) * 5.11);
  return lift + micro * Math.min(1, lift / 2) + 0.025;
}

function VegetationField({
  reducedMotion,
  tier,
}: {
  reducedMotion: boolean;
  tier: DeviceProfile["tier"];
}) {
  const count = tier === "high" ? 220 : tier === "balanced" ? 140 : 60;
  const trunkRef = useRef<InstancedMesh>(null);
  const canopyRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const canopyGeometry = useMemo(() => createFirCanopyGeometry(tier), [tier]);
  const sourceBarkMap = useLoader(TextureLoader, `${FIR_TEXTURE_ROOT}/fir_tree_01_bark_diff_1k.jpg`);
  const barkMap = useMemo(() => {
    const texture = sourceBarkMap.clone();
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(1, 4);
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
  }, [sourceBarkMap]);
  const windTime = useRef({ value: 0 });
  const foliageMaterial = useMemo(() => {
    const material = new MeshStandardMaterial({
      color: "#f4f8ee",
      emissive: "#173d22",
      emissiveIntensity: 0.85,
      roughness: 0.86,
      side: DoubleSide,
      vertexColors: true,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = windTime.current;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          #ifdef USE_INSTANCING
            float madaginPhase = instanceMatrix[3][0] * 0.19 + instanceMatrix[3][2] * 0.13;
            float madaginLift = clamp(position.y / 4.2, 0.0, 1.0);
            transformed.x += sin(uTime * 0.45 + madaginPhase + position.y * 0.6) * 0.035 * madaginLift;
            transformed.z += cos(uTime * 0.34 + madaginPhase) * 0.022 * madaginLift;
          #endif`,
        );
    };
    material.customProgramCacheKey = () => "madagin-fir-bough-wind-v3";
    return material;
  }, []);
  const barkMaterial = useMemo(
    () => new MeshStandardMaterial({ map: barkMap, roughness: 0.96 }),
    [barkMap],
  );
  const placements = useMemo(() => {
    const random = seededRandom(230819);
    return Array.from({ length: count }, (_, index) => {
      const side = index % 2 === 0 ? -1 : 1;
      let y = 0;
      let x = 0;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        y = -18 + random() * 120;
        x = side < 0 ? -21.5 + random() * 16.5 : 5.0 + random() * 17.5;
        const blocksWaterfall = side > 0 && y > 22 && y < 36 && x < 11;
        if (!blocksWaterfall) break;
      }
      const scale = 0.62 + random() * 0.92;
      return {
        x,
        y: worldSurfaceHeight(x, -y, true),
        z: -y,
        scale,
        rotation: random() * Math.PI * 2,
        color: random(),
      };
    });
  }, [count]);

  useEffect(() => {
    const trunk = trunkRef.current;
    const canopy = canopyRef.current;
    if (!trunk || !canopy) return;

    placements.forEach((placement, index) => {
      const trunkHeight = 3.85 * placement.scale;
      dummy.position.set(placement.x, placement.y + trunkHeight * 0.5, placement.z);
      dummy.rotation.set(0, placement.rotation, 0);
      dummy.scale.set(0.115 * placement.scale, trunkHeight, 0.115 * placement.scale);
      dummy.updateMatrix();
      trunk.setMatrixAt(index, dummy.matrix);

      dummy.position.set(placement.x, placement.y + 0.28 * placement.scale, placement.z);
      dummy.rotation.set(0, placement.rotation, 0);
      dummy.scale.set(placement.scale, placement.scale * 1.12, placement.scale);
      dummy.updateMatrix();
      canopy.setMatrixAt(index, dummy.matrix);

      const foliage = new Color().setHSL(0.29 + placement.color * 0.035, 0.34, 0.46 + placement.color * 0.1);
      canopy.setColorAt(index, foliage);
    });

    trunk.instanceMatrix.needsUpdate = true;
    canopy.instanceMatrix.needsUpdate = true;
    if (canopy.instanceColor) canopy.instanceColor.needsUpdate = true;
  }, [dummy, placements]);

  useFrame(({ clock }) => {
    windTime.current.value = reducedMotion ? 0 : clock.elapsedTime;
  });

  useEffect(
    () => () => {
      canopyGeometry.dispose();
      foliageMaterial.dispose();
      barkMaterial.dispose();
      barkMap.dispose();
    },
    [barkMap, barkMaterial, canopyGeometry, foliageMaterial],
  );

  return (
    <group>
      <instancedMesh args={[undefined, undefined, count]} ref={trunkRef}>
        <cylinderGeometry args={[0.76, 1, 1, 8]} />
        <primitive attach="material" object={barkMaterial} />
      </instancedMesh>
      <instancedMesh args={[undefined, undefined, count]} ref={canopyRef}>
        <primitive attach="geometry" object={canopyGeometry} />
        <primitive attach="material" object={foliageMaterial} />
      </instancedMesh>
    </group>
  );
}

const RIDGE_TREE_VARIANTS = [
  "Madagin_Fir_A_LOD2",
  "Madagin_Fir_B_LOD2",
  "Madagin_Fir_C_LOD2",
] as const;

const RIDGE_TREE_PLACEMENTS = [
  { x: -7.4, z: 18.2, scale: 0.58, rotation: 0.28, variant: 0 },
  { x: 7.6, z: 17.7, scale: 0.65, rotation: 2.18, variant: 1 },
  { x: -11.7, z: 14.1, scale: 0.56, rotation: 4.36, variant: 2 },
  { x: 11.4, z: 13.2, scale: 0.53, rotation: 1.16, variant: 0 },
  { x: -3.3, z: 12.1, scale: 0.46, rotation: 2.42, variant: 2 },
  { x: 3.2, z: 11.4, scale: 0.49, rotation: 4.72, variant: 1 },
  { x: -5.1, z: 8.5, scale: 0.55, rotation: 5.18, variant: 1 },
  { x: 5.4, z: 7.7, scale: 0.59, rotation: 3.28, variant: 2 },
  { x: -14.3, z: 7.1, scale: 0.62, rotation: 2.72, variant: 0 },
  { x: 14.1, z: 5.2, scale: 0.54, rotation: 0.78, variant: 1 },
  { x: -8.8, z: 0.6, scale: 0.49, rotation: 3.92, variant: 2 },
  { x: 9.4, z: -0.4, scale: 0.57, rotation: 5.64, variant: 0 },
  { x: -15.7, z: -5.8, scale: 0.52, rotation: 1.92, variant: 1 },
  { x: 15.6, z: -5.1, scale: 0.48, rotation: 4.88, variant: 2 },
] as const;

function RealTreeGrove({
  shadows,
  tier,
}: {
  shadows: boolean;
  tier: DeviceProfile["tier"];
}) {
  const gltf = useLoader(GLTFLoader, "/world/v05/madagin-fir-tree-kit-v0.5.glb");
  const { gl } = useThree();
  const [
    sourceBarkMap,
    sourceBarkNormal,
    sourceBarkArm,
    sourceTrunkMap,
    sourceTrunkNormal,
    sourceTrunkArm,
    sourceTwigMap,
    sourceTwigNormal,
    sourceTwigArm,
    sourceTwigAlpha,
  ] = useLoader(TextureLoader, [
    `${FIR_TEXTURE_ROOT}/fir_tree_01_bark_diff_1k.jpg`,
    `${FIR_TEXTURE_ROOT}/fir_tree_01_bark_nor_gl_1k.jpg`,
    `${FIR_TEXTURE_ROOT}/fir_tree_01_bark_arm_1k.jpg`,
    `${FIR_TEXTURE_ROOT}/fir_tree_01_trunk_a_diff_1k.jpg`,
    `${FIR_TEXTURE_ROOT}/fir_tree_01_trunk_a_nor_gl_1k.jpg`,
    `${FIR_TEXTURE_ROOT}/fir_tree_01_trunk_a_arm_1k.jpg`,
    `${FIR_TEXTURE_ROOT}/fir_tree_01_twig_diff_1k.jpg`,
    `${FIR_TEXTURE_ROOT}/fir_tree_01_twig_nor_gl_1k.jpg`,
    `${FIR_TEXTURE_ROOT}/fir_tree_01_twig_arm_1k.jpg`,
    `${FIR_TEXTURE_ROOT}/fir_tree_01_twig_alpha_1k.png`,
  ]);

  const textures = useMemo(() => {
    const anisotropy = Math.min(tier === "high" ? 8 : 4, gl.capabilities.getMaxAnisotropy());
    const sources = [
      sourceBarkMap,
      sourceBarkNormal,
      sourceBarkArm,
      sourceTrunkMap,
      sourceTrunkNormal,
      sourceTrunkArm,
      sourceTwigMap,
      sourceTwigNormal,
      sourceTwigArm,
      sourceTwigAlpha,
    ];
    const result = sources.map((source) => {
      const texture = source.clone();
      texture.flipY = false;
      texture.anisotropy = anisotropy;
      texture.needsUpdate = true;
      return texture;
    });
    result[0].colorSpace = SRGBColorSpace;
    result[3].colorSpace = SRGBColorSpace;
    result[6].colorSpace = SRGBColorSpace;
    return result;
  }, [
    gl,
    sourceBarkArm,
    sourceBarkMap,
    sourceBarkNormal,
    sourceTrunkArm,
    sourceTrunkMap,
    sourceTrunkNormal,
    sourceTwigAlpha,
    sourceTwigArm,
    sourceTwigMap,
    sourceTwigNormal,
    tier,
  ]);

  const materials = useMemo(() => {
    const [
      barkMap,
      barkNormal,
      barkArm,
      trunkMap,
      trunkNormal,
      trunkArm,
      twigMap,
      twigNormal,
      twigArm,
      twigAlpha,
    ] = textures;
    return {
      bark: new MeshStandardMaterial({
        emissive: "#403d31",
        emissiveIntensity: 0.22,
        emissiveMap: barkMap,
        map: barkMap,
        normalMap: barkNormal,
        normalScale: new Vector2(0.7, 0.7),
        roughness: 0.98,
        roughnessMap: barkArm,
      }),
      trunk: new MeshStandardMaterial({
        emissive: "#484437",
        emissiveIntensity: 0.2,
        emissiveMap: trunkMap,
        map: trunkMap,
        normalMap: trunkNormal,
        normalScale: new Vector2(0.72, 0.72),
        roughness: 0.98,
        roughnessMap: trunkArm,
      }),
      twig: new MeshStandardMaterial({
        alphaMap: twigAlpha,
        alphaTest: 0.4,
        alphaToCoverage: true,
        color: "#8fa080",
        emissive: "#17281a",
        emissiveIntensity: 0.12,
        map: twigMap,
        normalMap: twigNormal,
        normalScale: new Vector2(0.52, 0.52),
        roughness: 0.96,
        roughnessMap: twigArm,
        side: DoubleSide,
      }),
      deadwood: new MeshStandardMaterial({
        color: "#8f7a61",
        map: barkMap,
        normalMap: barkNormal,
        normalScale: new Vector2(0.58, 0.58),
        roughness: 1,
        roughnessMap: barkArm,
      }),
    };
  }, [textures]);

  const treeObjects = useMemo(() => {
    const count = tier === "high" ? 10 : tier === "balanced" ? 7 : 4;
    return RIDGE_TREE_PLACEMENTS.slice(0, count).map((placement, index) => {
      const sourceName = RIDGE_TREE_VARIANTS[placement.variant];
      const source = gltf.scene.getObjectByName(sourceName);
      if (!source) throw new Error(`Missing ${sourceName} in the v0.5 fir tree kit`);
      const tree = source.clone(true);
      tree.name = `Opening_Ridge_Fir_${String(index + 1).padStart(2, "0")}`;
      tree.position.set(
        placement.x,
        terrainHeight(placement.x, -placement.z) + openingRidgeHeight(placement.x, placement.z) - 0.08,
        placement.z,
      );
      tree.rotation.set(0, placement.rotation, 0);
      tree.scale.setScalar(placement.scale);
      tree.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
        const mappedMaterials = sourceMaterials.map((material) => {
          const name = material.name.toLowerCase();
          if (name.includes("twig")) return materials.twig;
          if (name.includes("deadwood")) return materials.deadwood;
          if (name.includes("trunk")) return materials.trunk;
          return materials.bark;
        });
        object.material = Array.isArray(object.material) ? mappedMaterials : mappedMaterials[0];
        object.castShadow = shadows;
        object.receiveShadow = true;
      });
      return tree;
    });
  }, [gltf, materials, shadows, tier]);

  useEffect(
    () => () => {
      Object.values(materials).forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
    },
    [materials, textures],
  );

  return (
    <group name="Opening ridge authored fir grove">
      {treeObjects.map((tree) => <primitive key={tree.name} object={tree} />)}
    </group>
  );
}

function BirdFlock({ reducedMotion, tier }: { reducedMotion: boolean; tier: DeviceProfile["tier"] }) {
  const count = tier === "high" ? 22 : tier === "balanced" ? 14 : 8;
  const flockRef = useRef<Group>(null);
  const birdsRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const geometry = useMemo(() => {
    const result = new BufferGeometry();
    result.setAttribute("position", new Float32BufferAttribute([
      -0.9, 0, 0, 0, -0.04, 0, -0.34, 0.22, 0,
      0, -0.04, 0, 0.9, 0, 0, 0.34, 0.22, 0,
    ], 3));
    result.computeVertexNormals();
    result.computeBoundingSphere();
    return result;
  }, []);
  const material = useMemo(
    () => new MeshBasicMaterial({ color: "#172825", side: DoubleSide, transparent: true, opacity: 0.78 }),
    [],
  );
  const placements = useMemo(() => {
    const random = seededRandom(432711);
    return Array.from({ length: count }, () => ({
      x: -22 + random() * 49,
      y: 22 + random() * 17,
      z: -62 - random() * 80,
      scale: 0.25 + random() * 0.34,
      rotation: (random() - 0.5) * 0.5,
    }));
  }, [count]);

  useEffect(() => {
    const birds = birdsRef.current;
    if (!birds) return;
    placements.forEach((placement, index) => {
      dummy.position.set(placement.x, placement.y, placement.z);
      dummy.rotation.set(0, 0, placement.rotation);
      dummy.scale.setScalar(placement.scale);
      dummy.updateMatrix();
      birds.setMatrixAt(index, dummy.matrix);
    });
    birds.instanceMatrix.needsUpdate = true;
    birds.computeBoundingSphere();
  }, [dummy, placements]);

  useFrame(({ clock }) => {
    const group = flockRef.current;
    if (!group) return;
    const time = reducedMotion ? 0 : clock.elapsedTime;
    group.position.x = Math.sin(time * 0.08) * 4.2;
    group.position.z = Math.cos(time * 0.055) * 2.4;
    group.rotation.y = Math.sin(time * 0.045) * 0.06;
  });

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return (
    <group name="Distant valley bird flock" ref={flockRef}>
      <instancedMesh args={[geometry, material, count]} frustumCulled ref={birdsRef} />
    </group>
  );
}

function WorldLayout({
  diagnosticMode,
  mobile,
  reducedMotion,
  shadows,
  showOcean,
  tier,
  worldVersion,
  zone,
}: {
  diagnosticMode: DiagnosticMode;
  mobile: boolean;
  reducedMotion: boolean;
  shadows: boolean;
  showOcean: boolean;
  tier: DeviceProfile["tier"];
  worldVersion: WorldVersion;
  zone: JourneyCheckpointId;
}) {
  return (
    <WorldEcology
      diagnosticMode={diagnosticMode}
      mobile={mobile}
      reducedMotion={reducedMotion}
      shadows={shadows}
      showOcean={showOcean}
      tier={tier}
      worldVersion={worldVersion}
      zone={zone}
    />
  );
}

function CameraDirector({
  activeView,
  fullJourneyNonce,
  fullJourneyPlaying,
  journeyCheckpoint,
  contactStep,
  mobile,
  reducedMotion,
  ridgeShotNonce,
  inspection,
  publicJourneyProgress,
  worldVersion,
}: {
  activeView: WorldViewId;
  fullJourneyNonce: number;
  fullJourneyPlaying: boolean;
  journeyCheckpoint: number;
  contactStep: number;
  mobile: boolean;
  reducedMotion: boolean;
  ridgeShotNonce: number;
  inspection: InspectionState;
  publicJourneyProgress?: MotionValue<number>;
  worldVersion: WorldVersion;
}) {
  const { camera } = useThree();
  const positionTarget = useRef(new Vector3());
  const lookTarget = useRef(new Vector3());
  const currentLook = useRef(new Vector3());
  const contactSummitPosition = useRef(new Vector3());
  const contactSummitLook = useRef(new Vector3());
  const cameraBank = useRef(0);
  const fullJourneyStartedAt = useRef<number | null>(null);
  const lastFullJourneyNonce = useRef(0);
  const lastFullJourneyChapter = useRef(-1);
  const lastRidgeShotNonce = useRef(0);
  const ridgeShotStartedAt = useRef<number | null>(null);
  const ridgeShotHolding = useRef(false);
  const lastRidgePhase = useRef(-1);

  useEffect(() => {
    if (!fullJourneyPlaying || activeView !== "journey") {
      fullJourneyStartedAt.current = null;
      return;
    }
    if (fullJourneyNonce > lastFullJourneyNonce.current) {
      lastFullJourneyNonce.current = fullJourneyNonce;
      fullJourneyStartedAt.current = performance.now();
      lastFullJourneyChapter.current = -1;
      ridgeShotStartedAt.current = null;
      ridgeShotHolding.current = false;
      window.dispatchEvent(new CustomEvent("madagin:journey-motion", {
        detail: { at: performance.now(), durationMs: FULL_JOURNEY_DURATION_MS, state: "moving" },
      }));
    }
  }, [activeView, fullJourneyNonce, fullJourneyPlaying]);

  useEffect(() => {
    const onRidge = getJourneyCheckpoint(journeyCheckpoint).id === "ridge";
    if (activeView !== "journey" || !onRidge) {
      ridgeShotStartedAt.current = null;
      ridgeShotHolding.current = false;
      return;
    }
    if (ridgeShotNonce > lastRidgeShotNonce.current) {
      lastRidgeShotNonce.current = ridgeShotNonce;
      ridgeShotStartedAt.current = performance.now();
      ridgeShotHolding.current = false;
      lastRidgePhase.current = -1;
      window.dispatchEvent(new CustomEvent("madagin:ridge-motion", {
        detail: { at: performance.now(), durationMs: RIDGE_SHOT_DURATION_MS, state: "moving" },
      }));
    }
  }, [activeView, journeyCheckpoint, ridgeShotNonce]);

  useFrame((_, delta) => {
    const checkpoint = getJourneyCheckpoint(journeyCheckpoint);
    const nextPosition = positionTarget.current;
    const nextLook = lookTarget.current;

    if (activeView === "journey" && publicJourneyProgress && !inspection.enabled) {
      const rawProgress = Math.min(1, Math.max(0, publicJourneyProgress.get()));
      const curveParameter = authoredJourneyCurveParameter(rawProgress);
      (mobile ? FULL_JOURNEY_MOBILE_POSITION : FULL_JOURNEY_POSITION).getPoint(curveParameter, nextPosition);
      (mobile ? FULL_JOURNEY_MOBILE_LOOK : FULL_JOURNEY_LOOK).getPoint(curveParameter, nextLook);
      camera.position.copy(nextPosition);
      currentLook.current.copy(nextLook);
      camera.lookAt(currentLook.current);
      let chapterIndex = 0;
      JOURNEY_CHECKPOINTS.forEach((item, index) => {
        if (rawProgress >= item.progress) chapterIndex = index;
      });
      if (chapterIndex !== lastFullJourneyChapter.current) {
        lastFullJourneyChapter.current = chapterIndex;
        window.dispatchEvent(new CustomEvent("madagin:journey-chapter", { detail: { chapterIndex, progress: rawProgress } }));
      }
      return;
    }

    if (activeView === "journey" && fullJourneyPlaying && fullJourneyStartedAt.current !== null && !inspection.enabled) {
      const rawProgress = Math.min(1, (performance.now() - fullJourneyStartedAt.current) / FULL_JOURNEY_DURATION_MS);
      const curveParameter = authoredJourneyCurveParameter(rawProgress);
      (mobile ? FULL_JOURNEY_MOBILE_POSITION : FULL_JOURNEY_POSITION).getPoint(curveParameter, nextPosition);
      (mobile ? FULL_JOURNEY_MOBILE_LOOK : FULL_JOURNEY_LOOK).getPoint(curveParameter, nextLook);
      camera.position.copy(nextPosition);
      currentLook.current.copy(nextLook);
      camera.lookAt(currentLook.current);
      let chapterIndex = 0;
      JOURNEY_CHECKPOINTS.forEach((item, index) => {
        if (rawProgress >= item.progress) chapterIndex = index;
      });
      if (chapterIndex !== lastFullJourneyChapter.current) {
        lastFullJourneyChapter.current = chapterIndex;
        window.dispatchEvent(new CustomEvent("madagin:journey-chapter", { detail: { chapterIndex, progress: rawProgress } }));
      }
      if (rawProgress >= 1) {
        fullJourneyStartedAt.current = null;
        window.dispatchEvent(new CustomEvent("madagin:journey-motion", {
          detail: { at: performance.now(), durationMs: FULL_JOURNEY_DURATION_MS, state: "complete" },
        }));
      }
      return;
    }

    if (
      activeView === "journey"
      && checkpoint.id === "ridge"
      && !inspection.enabled
      && (ridgeShotStartedAt.current !== null || ridgeShotHolding.current)
    ) {
      const rawProgress = ridgeShotHolding.current || reducedMotion
        ? 1
        : Math.min(1, (performance.now() - (ridgeShotStartedAt.current ?? performance.now())) / RIDGE_SHOT_DURATION_MS);
      const progress = rawProgress * rawProgress * (3 - 2 * rawProgress);
      const phase = rawProgress < 0.22 ? 0 : rawProgress < 0.5 ? 1 : rawProgress < 0.67 ? 2 : rawProgress < 0.92 ? 3 : 4;
      if (phase !== lastRidgePhase.current) {
        lastRidgePhase.current = phase;
        window.dispatchEvent(new CustomEvent("madagin:ridge-phase", { detail: { phase } }));
      }
      (mobile ? RIDGE_MOBILE_SHOT_POSITION : RIDGE_SHOT_POSITION).getPoint(progress, nextPosition);
      (mobile ? RIDGE_MOBILE_SHOT_LOOK : RIDGE_SHOT_LOOK).getPoint(progress, nextLook);
      camera.position.copy(nextPosition);
      currentLook.current.copy(nextLook);
      camera.lookAt(currentLook.current);
      if (rawProgress >= 1) {
        const completedMovingRail = ridgeShotStartedAt.current !== null;
        ridgeShotStartedAt.current = null;
        ridgeShotHolding.current = true;
        if (completedMovingRail) {
          window.dispatchEvent(new CustomEvent("madagin:ridge-motion", {
            detail: { at: performance.now(), durationMs: RIDGE_SHOT_DURATION_MS, state: "complete" },
          }));
        }
      }
      return;
    }

    if (activeView === "contact") {
      nextPosition.fromArray(mobile ? CONTACT_CAMERA.mobileCamera : CONTACT_CAMERA.camera);
      nextLook.fromArray(mobile ? CONTACT_CAMERA.mobileLookAt : CONTACT_CAMERA.lookAt);
      const ascent = CONTACT_ASCENT[contactStep]?.altitude ?? 0;
      contactSummitPosition.current.fromArray(
        mobile ? CONTACT_CAMERA.mobileSummitCamera : CONTACT_CAMERA.summitCamera,
      );
      contactSummitLook.current.fromArray(
        mobile ? CONTACT_CAMERA.mobileSummitLookAt : CONTACT_CAMERA.summitLookAt,
      );
      nextPosition.lerp(contactSummitPosition.current, ascent);
      nextPosition.y += Math.sin(ascent * Math.PI) * (mobile ? 34 : 42);
      nextLook.lerp(contactSummitLook.current, ascent);
    } else if (activeView === "journey" && worldVersion === "v116" && checkpoint.id === "waterfall") {
      nextPosition.set(mobile ? -2 : 5, mobile ? 94 : 80, mobile ? -486 : -500);
      nextLook.set(mobile ? 166 : 168, mobile ? -16 : -20, -730);
    } else if (activeView === "journey" && checkpoint.id === "ridge") {
      nextPosition.set(mobile ? 110 : 112, mobile ? 90 : 82, mobile ? 260 : 280);
      nextLook.set(mobile ? 4 : 10, mobile ? 52 : 48, mobile ? 116 : 128);
    } else {
      nextPosition.fromArray(mobile ? checkpoint.mobileCamera : checkpoint.camera);
      if (activeView === "about") {
        nextLook.fromArray(mobile ? checkpoint.mobileOceanLookAt : checkpoint.oceanLookAt);
        nextPosition.y += mobile ? 30 : 28;
      } else if (activeView === "projects") {
        nextLook.fromArray(mobile ? checkpoint.mobileSkyLookAt : checkpoint.skyLookAt);
      } else {
        nextLook.fromArray(mobile ? checkpoint.mobileLookAt : checkpoint.lookAt);
      }
    }

    if (!reducedMotion && activeView === "journey") {
      const breathing = performance.now() * 0.00012 + journeyCheckpoint * 1.31;
      nextPosition.y += Math.sin(breathing) * (mobile ? 0.045 : 0.08);
      nextLook.x += Math.sin(breathing * 0.73 + 0.9) * (mobile ? 0.045 : 0.085);
    }

    if (inspection.enabled) {
      const offsetX = nextPosition.x - nextLook.x;
      const offsetY = nextPosition.y - nextLook.y;
      const offsetZ = nextPosition.z - nextLook.z;
      const baseDistance = Math.max(2, Math.hypot(offsetX, offsetY, offsetZ));
      const yaw = Math.atan2(offsetX, offsetZ) + inspection.yaw;
      const pitch = Math.max(-1.15, Math.min(1.15, Math.asin(offsetY / baseDistance) + inspection.pitch));
      const distance = baseDistance * inspection.zoom;
      const horizontal = Math.cos(pitch) * distance;
      nextPosition.set(
        nextLook.x + Math.sin(yaw) * horizontal,
        nextLook.y + Math.sin(pitch) * distance,
        nextLook.z + Math.cos(yaw) * horizontal,
      );
    }

    if (reducedMotion) {
      camera.position.copy(nextPosition);
      currentLook.current.copy(nextLook);
    } else {
      const positionRate = inspection.enabled ? 7.5 : activeView === "about" || activeView === "projects" ? 3.8 : 1.55;
      const lookRate = inspection.enabled ? 7.5 : activeView === "about" || activeView === "projects" ? 2.35 : 1.8;
      camera.position.lerp(nextPosition, 1 - Math.exp(-delta * positionRate));
      currentLook.current.lerp(nextLook, 1 - Math.exp(-delta * lookRate));
    }

    camera.lookAt(currentLook.current);
    if (reducedMotion || inspection.enabled) {
      cameraBank.current = 0;
    } else {
      const desiredBank = Math.min(0.032, Math.max(-0.032, (nextPosition.x - camera.position.x) * -0.0065));
      cameraBank.current += (desiredBank - cameraBank.current) * (1 - Math.exp(-delta * 2.4));
    }
    camera.rotateZ(cameraBank.current);
  });

  return null;
}

function percentile(sorted: number[], fraction: number) {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index];
}

function FrameMeter({ device, onSample, worldVersion }: { device: DeviceProfile; onSample: (stats: RenderStats) => void; worldVersion: WorldVersion }) {
  const { gl } = useThree();
  const frameCount = useRef(0);
  const elapsed = useRef(0);
  const frameTimes = useRef<number[]>([]);
  const totalFrames = useRef(0);
  const traceStartedAt = useRef(0);
  const traceEndedAt = useRef<number | null>(null);
  const traceKind = useRef<"startup-and-static" | "full-18s-rail">("startup-and-static");
  const recording = useRef(true);
  const moving = useRef(false);
  const firstFrameAt = useRef<number | null>(null);
  const stableAt = useRef<number | null>(null);
  const longTasks = useRef({ count: 0, durationMs: 0 });
  const publishRequested = useRef(false);

  useEffect(() => {
    traceStartedAt.current = performance.now();
    const handleMotion = (event: Event) => {
      const detail = (event as CustomEvent<{ at?: number; state?: string }>).detail;
      if (detail?.state === "moving") {
        frameTimes.current = [];
        totalFrames.current = 0;
        traceStartedAt.current = detail.at ?? performance.now();
        traceEndedAt.current = null;
        traceKind.current = "full-18s-rail";
        recording.current = true;
        moving.current = true;
        stableAt.current = null;
        longTasks.current = { count: 0, durationMs: 0 };
      } else if (detail?.state === "complete") {
        traceEndedAt.current = detail.at ?? performance.now();
        recording.current = false;
        moving.current = false;
        publishRequested.current = true;
      }
    };
    window.addEventListener("madagin:ridge-motion", handleMotion);
    return () => window.removeEventListener("madagin:ridge-motion", handleMotion);
  }, []);

  useEffect(() => {
    if (!("PerformanceObserver" in window)) return;
    const observer = new PerformanceObserver((list) => {
      if (!recording.current) return;
      const entries = list.getEntries();
      longTasks.current.count += entries.length;
      longTasks.current.durationMs += entries.reduce((total, entry) => total + entry.duration, 0);
    });
    try {
      observer.observe({ type: "longtask", buffered: true });
    } catch {
      observer.disconnect();
      return;
    }
    return () => observer.disconnect();
  }, []);

  const publishTrace = useCallback(() => {
    const ordered = [...frameTimes.current].sort((a, b) => a - b);
    if (ordered.length === 0) return;
    const medianFrameMs = percentile(ordered, 0.5);
    const worstOnePercent = ordered.slice(Math.max(0, Math.floor(ordered.length * 0.99)));
    const onePercentAverageMs = worstOnePercent.reduce((total, value) => total + value, 0) / Math.max(1, worstOnePercent.length);
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const ridgeResources = resources.filter((resource) => {
      try {
        const pathname = new URL(resource.name).pathname;
        return worldVersion === "v116"
          ? pathname.startsWith("/world/v116/")
          : pathname.startsWith("/world/v115/") || pathname.startsWith("/world/v114/") || pathname.startsWith("/world/v113/madagin-ridge-hero") || pathname.startsWith("/world/v112/madagin-ridge-canopy-clusters");
      } catch { return false; }
    });
    const stageHost = window as Window & {
      __MADAGIN_RIDGE_STAGES_V115__?: Array<{ at: number; label: string; stage: number; version: string }>;
      __MADAGIN_RIDGE_STAGES_V116__?: Array<{ at: number; label: string; stage: number; version: string }>;
      __MADAGIN_RIDGE_BENCHMARK_V115__?: unknown;
      __MADAGIN_RIDGE_BENCHMARK_V116__?: unknown;
    };
    const stages = worldVersion === "v116" ? stageHost.__MADAGIN_RIDGE_STAGES_V116__ ?? [] : stageHost.__MADAGIN_RIDGE_STAGES_V115__ ?? [];
    const meaningful = worldVersion === "v116"
      ? stages.find((stage) => stage.label.endsWith("ecology-ready"))
      : stages.find((stage) => stage.label === "textured-middle-canopy-ready");
    const decodeUploadEstimates = ridgeResources.flatMap((resource) => {
      const pathname = new URL(resource.name).pathname;
      const v116Match = pathname.match(/ecology-(ridge|valley|lake|alpine)-v1\.16/)?.[1];
      const label = worldVersion === "v116"
        ? pathname.includes("water-lake-waterfall")
          ? "connected-water-lake-waterfall-ready"
          : v116Match
            ? `${v116Match}-ecology-ready`
            : pathname.includes("terrain-")
              ? `${pathname.match(/terrain-(ridge|valley|alpine)/)?.[1]}-terrain-ready`
              : null
        : pathname.includes("canopy-clusters")
        ? "textured-middle-canopy-ready"
        : pathname.includes("hero-families")
          ? "deduplicated-hero-vegetation-ready"
          : pathname.includes("to-valley-balanced")
            ? "balanced-terrain-ready"
            : pathname.includes("to-valley-high")
              ? "high-terrain-ready"
              : pathname.includes("to-valley-critical")
                ? "critical-terrain-ready"
                : null;
      const stage = label ? stages.find((item) => item.label === label) : null;
      return stage ? [{
        asset: pathname,
        estimateMs: Math.max(0, stage.at - resource.responseEnd),
        method: "stage-ready minus Resource Timing responseEnd; includes decode, upload, React commit, and scheduling",
      }] : [];
    });
    const context = gl.getContext() as WebGL2RenderingContext;
    const gpuTimerAvailable = Boolean(context.getExtension("EXT_disjoint_timer_query_webgl2"));
    const now = traceEndedAt.current ?? performance.now();
    const evidence = {
      version: worldVersion === "v116" ? "v1.16" : "v1.15",
      capturedAt: new Date().toISOString(),
      traceKind: traceKind.current,
      traceComplete: traceEndedAt.current !== null,
      durationMs: now - traceStartedAt.current,
      totalFrames: totalFrames.current,
      sampledFrames: ordered.length,
      frameTimeMs: {
        median: medianFrameMs,
        p90: percentile(ordered, 0.9),
        p95: percentile(ordered, 0.95),
        p99: percentile(ordered, 0.99),
      },
      medianFps: medianFrameMs ? 1000 / medianFrameMs : null,
      onePercentLowFps: onePercentAverageMs > 0 ? 1000 / onePercentAverageMs : null,
      thresholdCounts: {
        over16_7ms: ordered.filter((value) => value > 16.7).length,
        over33_3ms: ordered.filter((value) => value > 33.3).length,
        over50ms: ordered.filter((value) => value > 50).length,
      },
      longTasks: longTasks.current,
      milestones: {
        timeToFirstLiveFrameMs: firstFrameAt.current,
        timeToFirstMeaningfulEnvironmentMs: meaningful?.at ?? null,
        timeToStableFramePacingMs: stableAt.current === null ? null : stableAt.current - traceStartedAt.current,
      },
      stages,
      decodeAndUpload: { classification: "inferential", estimates: decodeUploadEstimates },
      shaderCompile: { measured: false, reason: "WebGL does not expose complete per-program compile cost through Three.js renderer statistics." },
      gpuStall: { measured: false, timerQueryExtensionAvailable: gpuTimerAvailable, reason: "No intrusive timer queries were inserted into the production render loop." },
      state: {
        cameraMode: moving.current ? "moving-rail" : traceEndedAt.current ? "rail-complete" : "static-or-micro-motion",
        documentVisibility: document.visibilityState,
        focused: document.hasFocus(),
        renderer: device.graphics,
        tier: device.tier,
        forcedTier: device.forcedTier,
        mobileViewport: device.mobile,
        displayPixelRatio: window.devicePixelRatio,
        rendererPixelRatio: gl.getPixelRatio(),
        canvasCss: { width: gl.domElement.clientWidth, height: gl.domElement.clientHeight },
        drawingBuffer: { width: gl.domElement.width, height: gl.domElement.height },
      },
      render: {
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
      },
      resources: {
        count: ridgeResources.length,
        encodedBytes: ridgeResources.reduce((total, resource) => total + resource.encodedBodySize, 0),
        transferredBytes: ridgeResources.reduce((total, resource) => total + (resource.transferSize || resource.encodedBodySize), 0),
        entries: ridgeResources.map((resource) => ({
          name: new URL(resource.name).pathname,
          durationMs: resource.duration,
          encodedBytes: resource.encodedBodySize,
          transferBytes: resource.transferSize,
        })),
      },
    };
    if (worldVersion === "v116") {
      stageHost.__MADAGIN_RIDGE_BENCHMARK_V116__ = evidence;
      document.documentElement.dataset.madaginRidgeBenchmarkV116 = JSON.stringify(evidence);
    } else {
      stageHost.__MADAGIN_RIDGE_BENCHMARK_V115__ = evidence;
      document.documentElement.dataset.madaginRidgeBenchmarkV115 = JSON.stringify(evidence);
    }
  }, [device, gl, worldVersion]);

  useFrame((_, delta) => {
    const frameMs = delta * 1000;
    if (firstFrameAt.current === null) firstFrameAt.current = performance.now();
    if (recording.current) {
      totalFrames.current += 1;
      frameTimes.current.push(frameMs);
      if (frameTimes.current.length > 3600) frameTimes.current.shift();
      if (stableAt.current === null && frameTimes.current.length >= 120) {
        const recent = [...frameTimes.current.slice(-120)].sort((a, b) => a - b);
        const recentP95 = percentile(recent, 0.95) ?? Infinity;
        if (recentP95 <= 33.3 && recent.filter((value) => value > 50).length <= 2) {
          stableAt.current = performance.now();
        }
      }
    }
    frameCount.current += 1;
    elapsed.current += delta;
    if (elapsed.current >= 1 || publishRequested.current) {
      onSample({
        fps: Math.round(frameCount.current / elapsed.current),
        calls: gl.info.render.calls,
        geometries: gl.info.memory.geometries,
        rendererPixelRatio: gl.getPixelRatio(),
        textures: gl.info.memory.textures,
        triangles: gl.info.render.triangles,
      });
      publishTrace();
      publishRequested.current = false;
      frameCount.current = 0;
      elapsed.current = 0;
    }
  });

  return null;
}

const JOURNEY_FALLBACK_STILLS = [
  "/media/madagin-ridge-approach-v3.png",
  "/media/madagin-valley-reveal-v4.png",
  "/media/madagin-valley-reveal-v1.png",
  "/media/madagin-valley-reveal-v1.png",
  "/media/madagin-ridge-approach-v1.png",
] as const;

class WorldCanvasBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFailure();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function WebGLContextMonitor({ onFailure }: { onFailure: () => void }) {
  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const handleLoss = (event: Event) => {
      event.preventDefault();
      onFailure();
    };
    canvas.addEventListener("webglcontextlost", handleLoss);
    return () => canvas.removeEventListener("webglcontextlost", handleLoss);
  }, [gl, onFailure]);
  return null;
}

function ChapterSun({ intensity, shadows, tier, zone }: {
  intensity: number;
  shadows: boolean;
  tier: DeviceProfile["tier"];
  zone: JourneyCheckpointId;
}) {
  const light = useRef<ThreeDirectionalLight>(null);
  const { scene } = useThree();
  const checkpoint = JOURNEY_CHECKPOINTS.find((item) => item.id === zone) ?? JOURNEY_CHECKPOINTS[0];
  const focus = useMemo(() => new Vector3().fromArray(checkpoint.lookAt), [checkpoint.lookAt]);
  const position = useMemo(
    () => focus.clone().add(new Vector3(...MADAGIN_SUN_POSITION).multiplyScalar(1.35)),
    [focus],
  );

  useEffect(() => {
    const target = light.current?.target;
    if (!target) return;
    target.position.copy(focus);
    scene.add(target);
    return () => {
      scene.remove(target);
    };
  }, [focus, scene]);

  return (
    <directionalLight
      castShadow={shadows}
      color="#ffc078"
      intensity={intensity}
      position={position}
      ref={light}
      shadow-bias={-0.00012}
      shadow-camera-bottom={-210}
      shadow-camera-far={720}
      shadow-camera-left={-230}
      shadow-camera-near={1}
      shadow-camera-right={230}
      shadow-camera-top={210}
      shadow-mapSize-height={tier === "high" ? 1536 : 1024}
      shadow-mapSize-width={tier === "high" ? 1536 : 1024}
    />
  );
}

function Scene({
  activeView,
  fullJourneyNonce,
  fullJourneyPlaying,
  journeyCheckpoint,
  contactStep,
  device,
  onRendererFailure,
  onStats,
  ridgeShotNonce,
  benchmarkMode,
  diagnosticMode,
  inspection,
  publicJourneyProgress,
  worldVersion,
}: {
  activeView: WorldViewId;
  fullJourneyNonce: number;
  fullJourneyPlaying: boolean;
  journeyCheckpoint: number;
  contactStep: number;
  device: DeviceProfile;
  onRendererFailure: () => void;
  onStats: (stats: RenderStats) => void;
  ridgeShotNonce: number;
  benchmarkMode: RidgeBenchmarkMode | null;
  diagnosticMode: DiagnosticMode;
  inspection: InspectionState;
  publicJourneyProgress?: MotionValue<number>;
  worldVersion: WorldVersion;
}) {
  const mobile = device.mobile;
  const shadows = benchmarkMode === "shadows" || (device.tier !== "conservative" && !mobile);
  const zone = getJourneyCheckpoint(journeyCheckpoint).id;
  const ridgeLighting = activeView !== "contact";
  const showPhysicalAtmosphere = benchmarkMode === null || benchmarkMode === "full" || benchmarkMode === "atmosphere";

  return (
    <>
      {worldVersion === "v115" ? (
        <>
          <color attach="background" args={[new Color(ridgeLighting ? "#315f78" : "#315667")]} />
          <fogExp2 attach="fog" args={[ridgeLighting ? "#78959a" : "#66838a", ridgeLighting ? 0.00052 : 0.00115]} />
          {showPhysicalAtmosphere ? (
            <WorldAtmosphere
              reducedMotion={device.reducedMotion}
              showClouds
              showSky
              showValleyFog
              tier={device.tier}
            />
          ) : null}
          <hemisphereLight args={[ridgeLighting ? "#b8d9e5" : "#b8d2d6", "#1d2b1d", ridgeLighting ? 0.92 : 0.86]} />
          <ambientLight color={ridgeLighting ? "#789aa2" : "#648078"} intensity={ridgeLighting ? 0.1 : 0.08} />
          <ChapterSun intensity={ridgeLighting ? 2.35 : 2.2} shadows={shadows} tier={device.tier} zone={zone} />
          <directionalLight color="#a9d5df" intensity={ridgeLighting ? 0.12 : 0.14} position={[36, 28, -12]} />
          <directionalLight color="#ffc99a" intensity={ridgeLighting ? 0.07 : 0.12} position={[-24, 18, 58]} />
        </>
      ) : null}
      <Suspense fallback={null}>
        <WorldLayout
          diagnosticMode={diagnosticMode}
          mobile={mobile}
          reducedMotion={device.reducedMotion}
          shadows={shadows}
          showOcean={activeView === "about"}
          tier={device.tier}
          worldVersion={worldVersion}
          zone={zone}
        />
        {SHOW_LEGACY_FIR_GROVE ? <RealTreeGrove shadows={shadows} tier={device.tier} /> : null}
        {SHOW_PROCEDURAL_DISTANCE_FIELD && activeView !== "contact" && zone === "summit" ? (
          <VegetationField reducedMotion={device.reducedMotion} tier={device.tier} />
        ) : null}
        {!benchmarkMode ? <BirdFlock reducedMotion={device.reducedMotion} tier={device.tier} /> : null}
      </Suspense>
      <CameraDirector
        activeView={activeView}
        contactStep={contactStep}
        fullJourneyNonce={fullJourneyNonce}
        fullJourneyPlaying={fullJourneyPlaying}
        journeyCheckpoint={journeyCheckpoint}
        mobile={mobile}
        reducedMotion={device.reducedMotion}
        ridgeShotNonce={ridgeShotNonce}
        inspection={inspection}
        publicJourneyProgress={publicJourneyProgress}
        worldVersion={worldVersion}
      />
      <WebGLContextMonitor onFailure={onRendererFailure} />
      <FrameMeter device={device} onSample={onStats} worldVersion={worldVersion} />
    </>
  );
}

function ViewButton({
  id,
  active,
  onSelect,
}: {
  id: WorldViewId;
  active: boolean;
  onSelect: (id: WorldViewId) => void;
}) {
  const view = getWorldView(id);
  return (
    <button
      aria-pressed={active}
      className={active ? styles.activeZone : undefined}
      onClick={() => onSelect(id)}
      type="button"
    >
      <span>{view.label}</span>
      <small>{view.role}</small>
    </button>
  );
}

function sceneCopy(activeView: WorldViewId, journeyCheckpoint: number, contactStep: number) {
  const checkpoint = getJourneyCheckpoint(journeyCheckpoint);
  const contact = CONTACT_ASCENT[contactStep];

  if (activeView === "about") {
    return {
      role: `About · checkpoint ${String(journeyCheckpoint + 1).padStart(2, "0")}`,
      label: "The ocean, from here.",
      detail: `The camera stays at ${checkpoint.label.toLowerCase()} and turns west.`,
    };
  }
  if (activeView === "projects") {
    return {
      role: `Selected projects · checkpoint ${String(journeyCheckpoint + 1).padStart(2, "0")}`,
      label: "Look up.",
      detail: `The camera stays at ${checkpoint.label.toLowerCase()} and tilts into the moving sky.`,
    };
  }
  if (activeView === "contact") {
    return {
      role: `Let’s Talk · ${contact.place}`,
      label: "Mountain ascent.",
      detail: getWorldView("contact").entry,
    };
  }
  return { role: checkpoint.role, label: checkpoint.label, detail: checkpoint.story };
}

const RIDGE_PHASE_COPY = [
  { role: "Opening", label: "Ridge approach", detail: "Move above the dark canopy while the ridgeline holds the Valley out of sight." },
  { role: "Approach", label: "Crest glide", detail: "Gain speed across varied crowns, wet basalt, and wind-shaped trees." },
  { role: "Crest", label: "The threshold", detail: "Rise over the saddle as the foreground falls away and the first depth layer appears." },
  { role: "Reveal", label: "The Valley opens", detail: "Rainforest folds give way to the connected river, partial lake, and distant alpine walls." },
  { role: "Endpoint", label: "Watershed horizon", detail: "Settle into a calm aerial drift with the full geography held in one composition." },
] as const;

export function WorldLab() {
  const benchmarkMode = useMemo(() => inspectRidgeBenchmarkMode(), []);
  const [worldVersion, setWorldVersion] = useState<WorldVersion>(inspectInitialWorldVersion);
  const [activeView, setActiveView] = useState<WorldViewId>("journey");
  const [journeyCheckpoint, setJourneyCheckpoint] = useState(inspectInitialCheckpoint);
  const [contactStep, setContactStep] = useState(0);
  const [presentationMode, setPresentationMode] = useState(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("presentation") === "1",
  );
  const [fullJourneyNonce, setFullJourneyNonce] = useState(0);
  const [fullJourneyPlaying, setFullJourneyPlaying] = useState(false);
  const [ridgeShotNonce, setRidgeShotNonce] = useState(0);
  const [ridgePhase, setRidgePhase] = useState(0);
  const [ridgeStage, setRidgeStage] = useState(0);
  const [reviewRoute] = useState(() => window.location.pathname === "/world-lab-review");
  const [reviewUiHidden, setReviewUiHidden] = useState(false);
  const [diagnosticMode, setDiagnosticMode] = useState<DiagnosticMode>(null);
  const [inspection, setInspection] = useState<InspectionState>({ enabled: false, pitch: 0, yaw: 0, zoom: 1 });
  const [device, setDevice] = useState<DeviceProfile | null>(() =>
    typeof document === "undefined" ? null : inspectDevice(),
  );
  const [measurementStartedAt, setMeasurementStartedAt] = useState(() =>
    typeof performance === "undefined" ? 0 : performance.now(),
  );
  const [renderStats, setRenderStats] = useState<RenderStats | null>(null);
  const [fpsSamples, setFpsSamples] = useState<number[]>([]);
  const [assetRequestAudit, setAssetRequestAudit] = useState<AssetRequestAudit | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [canvasFailed, setCanvasFailed] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const longTaskCount = useRef(0);
  const lowFpsStreak = useRef(0);
  const [benchmarkStartedAt] = useState(() => typeof performance === "undefined" ? 0 : performance.now());
  const benchmarkSamples = useRef<RenderStats[]>([]);
  const autoRailStarted = useRef(false);
  const inspectionDrag = useRef({ active: false, x: 0, y: 0 });
  const handleStats = useCallback((stats: RenderStats) => {
    if (benchmarkMode) {
      const samples = [...benchmarkSamples.current.slice(-29), stats];
      benchmarkSamples.current = samples;
      const fps = samples.map((sample) => sample.fps).sort((a, b) => a - b);
      const benchmarkEvidence = {
        mode: benchmarkMode,
        capturedAt: new Date().toISOString(),
        durationMs: performance.now() - benchmarkStartedAt,
        documentVisibility: document.visibilityState,
        focused: document.hasFocus(),
        renderer: device?.graphics ?? "Unavailable",
        viewport: { width: window.innerWidth, height: window.innerHeight },
        displayPixelRatio: window.devicePixelRatio,
        rendererPixelRatio: stats.rendererPixelRatio,
        latest: stats,
        sampleCount: samples.length,
        medianFps: fps[Math.floor(fps.length / 2)] ?? null,
        p10Fps: fps[Math.floor((fps.length - 1) * 0.1)] ?? null,
        minimumFps: fps[0] ?? null,
      };
      (window as Window & { __MADAGIN_RIDGE_BENCHMARK__?: unknown }).__MADAGIN_RIDGE_BENCHMARK__ = benchmarkEvidence;
      document.documentElement.dataset.madaginRidgeBenchmark = JSON.stringify(benchmarkEvidence);
      return;
    }
    setRenderStats(stats);
    setFpsSamples((samples) => [...samples.slice(-14), stats.fps]);
    lowFpsStreak.current = stats.fps < 24 ? lowFpsStreak.current + 1 : 0;
    if (lowFpsStreak.current >= 4) {
      lowFpsStreak.current = 0;
      setDevice((current) => {
        if (!current || current.forcedTier || current.tier === "conservative") return current;
        return { ...current, tier: current.tier === "high" ? "balanced" : "conservative" };
      });
    }
  }, [benchmarkMode, benchmarkStartedAt, device]);
  const handleRendererFailure = useCallback(() => {
    setCanvasReady(false);
    setCanvasFailed(true);
  }, []);
  const selectActiveView = useCallback((id: WorldViewId) => {
    setFpsSamples([]);
    setActiveView(id);
  }, []);
  const selectJourneyCheckpoint = useCallback((index: number) => {
    setFullJourneyPlaying(false);
    setMeasurementStartedAt(performance.now());
    setAssetRequestAudit(null);
    setRidgeStage(0);
    longTaskCount.current = 0;
    lowFpsStreak.current = 0;
    setFpsSamples([]);
    setJourneyCheckpoint(index);
  }, []);
  const selectWorldVersion = useCallback((version: WorldVersion) => {
    setFullJourneyPlaying(false);
    setWorldVersion(version);
    setMeasurementStartedAt(performance.now());
    setAssetRequestAudit(null);
    setRenderStats(null);
    setFpsSamples([]);
    setRidgeStage(0);
    const url = new URL(window.location.href);
    url.searchParams.set("world", version === "v116" ? "116" : "115");
    window.history.replaceState(null, "", url);
  }, []);

  const stopFullJourney = useCallback(() => {
    setFullJourneyPlaying(false);
  }, []);
  const playFullJourney = useCallback(() => {
    setInspection((current) => ({ ...current, enabled: false }));
    setActiveView("journey");
    setJourneyCheckpoint(0);
    setFullJourneyPlaying(true);
    setFullJourneyNonce((nonce) => nonce + 1);
  }, []);
  const resetInspection = useCallback(() => {
    setInspection((current) => ({ ...current, pitch: 0, yaw: 0, zoom: 1 }));
  }, []);
  const handleStagePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!inspection.enabled || !(event.target instanceof HTMLCanvasElement)) return;
    inspectionDrag.current = { active: true, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, [inspection.enabled]);
  const handleStagePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!inspection.enabled || !inspectionDrag.current.active) return;
    const deltaX = event.clientX - inspectionDrag.current.x;
    const deltaY = event.clientY - inspectionDrag.current.y;
    inspectionDrag.current = { active: true, x: event.clientX, y: event.clientY };
    setInspection((current) => ({
      ...current,
      pitch: Math.max(-0.72, Math.min(0.72, current.pitch + deltaY * 0.0042)),
      yaw: current.yaw - deltaX * 0.0048,
    }));
  }, [inspection.enabled]);
  const handleStagePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    inspectionDrag.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);
  const handleStageWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    if (!inspection.enabled || !(event.target instanceof HTMLCanvasElement)) return;
    event.preventDefault();
    setInspection((current) => ({ ...current, zoom: Math.max(0.48, Math.min(1.85, current.zoom + event.deltaY * 0.0008)) }));
  }, [inspection.enabled]);

  const togglePresentation = useCallback(async () => {
    const stage = stageRef.current;
    if (!stage) return;
    try {
      if (document.fullscreenElement === stage) {
        await document.exitFullscreen();
      } else if (stage.requestFullscreen) {
        await stage.requestFullscreen();
      } else {
        setPresentationMode((current) => !current);
      }
    } catch {
      setPresentationMode((current) => !current);
    }
  }, []);
  const view = getWorldView(activeView);
  const checkpoint = getJourneyCheckpoint(journeyCheckpoint);
  const copy = activeView === "journey" && checkpoint.id === "ridge"
    ? RIDGE_PHASE_COPY[ridgePhase]
    : sceneCopy(activeView, journeyCheckpoint, contactStep);

  useEffect(() => {
    const syncFullscreenState = () => setPresentationMode(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  useEffect(() => {
    if (!canvasReady || autoRailStarted.current || checkpoint.id !== "ridge") return;
    if (new URLSearchParams(window.location.search).get("rail") !== "1") return;
    autoRailStarted.current = true;
    const timer = window.setTimeout(() => setRidgeShotNonce((nonce) => nonce + 1), 700);
    return () => window.clearTimeout(timer);
  }, [canvasReady, checkpoint.id]);

  useEffect(() => {
    const handleRidgeStage = (event: Event) => {
      if (benchmarkMode) return;
      const nextStage = (event as CustomEvent<{ stage?: number }>).detail?.stage;
      if (typeof nextStage === "number") setRidgeStage(nextStage);
    };
    window.addEventListener("madagin:ridge-stage", handleRidgeStage);
    return () => window.removeEventListener("madagin:ridge-stage", handleRidgeStage);
  }, [benchmarkMode]);

  useEffect(() => {
    const handleRidgePhase = (event: Event) => {
      const phase = (event as CustomEvent<{ phase?: number }>).detail?.phase;
      if (typeof phase === "number" && phase >= 0 && phase < RIDGE_PHASE_COPY.length) setRidgePhase(phase);
    };
    window.addEventListener("madagin:ridge-phase", handleRidgePhase);
    return () => window.removeEventListener("madagin:ridge-phase", handleRidgePhase);
  }, []);

  useEffect(() => {
    const handleJourneyChapter = (event: Event) => {
      const index = (event as CustomEvent<{ chapterIndex?: number }>).detail?.chapterIndex;
      if (typeof index === "number" && index >= 0 && index < JOURNEY_CHECKPOINTS.length) {
        setJourneyCheckpoint(index);
      }
    };
    const handleJourneyMotion = (event: Event) => {
      const state = (event as CustomEvent<{ state?: string }>).detail?.state;
      if (state === "complete") setFullJourneyPlaying(false);
    };
    window.addEventListener("madagin:journey-chapter", handleJourneyChapter);
    window.addEventListener("madagin:journey-motion", handleJourneyMotion);
    return () => {
      window.removeEventListener("madagin:journey-chapter", handleJourneyChapter);
      window.removeEventListener("madagin:journey-motion", handleJourneyMotion);
    };
  }, []);

  useEffect(() => {
    if (!("PerformanceObserver" in window)) return;
    const observer = new PerformanceObserver((list) => {
      longTaskCount.current += list.getEntries().length;
    });
    try {
      observer.observe({ type: "longtask", buffered: true });
    } catch {
      observer.disconnect();
      return;
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (benchmarkMode) return;
    const sample = () => {
      const resources = window.performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      const measuredResources = resources.filter((resource) => resource.startTime >= measurementStartedAt);
      const worldResources = measuredResources.filter((resource) => {
        try {
          return new URL(resource.name).pathname.startsWith("/world/");
        } catch {
          return false;
        }
      });
      const videoRequests = measuredResources.filter((resource) => {
        try {
          return /\.(?:mp4|webm|mov)$/i.test(new URL(resource.name).pathname);
        } catch {
          return false;
        }
      }).length;
      const ridgeResources = worldResources.filter((resource) => {
        try {
          const pathname = new URL(resource.name).pathname;
          return pathname.startsWith(worldVersion === "v116" ? "/world/v116/" : "/world/v115/");
        } catch {
          return false;
        }
      });
      setAssetRequestAudit({
        encodedWorldBytes: worldResources.reduce((total, resource) => total + resource.encodedBodySize, 0),
        longTasks: longTaskCount.current,
        measuredForMs: performance.now() - measurementStartedAt,
        observedWorldBytes: worldResources.reduce(
          (total, resource) => total + (resource.encodedBodySize || resource.transferSize || 0),
          0,
        ),
        ridgeRequests: ridgeResources.length,
        totalObservedBytes: measuredResources.reduce(
          (total, resource) => total + (resource.encodedBodySize || resource.transferSize || 0),
          0,
        ),
        totalRequests: measuredResources.length,
        videoRequests,
        worldRequests: worldResources.length,
      });
    };
    sample();
    const interval = window.setInterval(sample, 1000);
    const timeout = window.setTimeout(() => window.clearInterval(interval), 8000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [benchmarkMode, canvasReady, journeyCheckpoint, measurementStartedAt, worldVersion]);

  if (!device) {
    return <div className={styles.loading}>Inspecting this device…</div>;
  }

  const rendererAvailable = device.webgl2 && !canvasFailed;
  const orderedFps = [...fpsSamples].sort((a, b) => a - b);
  const medianFps = orderedFps.length === 0 ? null : orderedFps[Math.floor(orderedFps.length / 2)];
  const minimumFps = orderedFps.length === 0 ? null : orderedFps[0];
  const p10Fps = orderedFps.length === 0 ? null : orderedFps[Math.floor((orderedFps.length - 1) * 0.1)];
  const stableThreshold = device.mobile ? 30 : 45;
  const recentFps = fpsSamples.slice(-4);
  const stabilityLabel = recentFps.length < 4
    ? "warming"
    : recentFps.every((sample) => sample >= stableThreshold) ? "stable" : "under target";
  const fallbackStill = rendererAvailable
    ? JOURNEY_FALLBACK_STILLS[0]
    : JOURNEY_FALLBACK_STILLS[journeyCheckpoint] ?? JOURNEY_FALLBACK_STILLS[0];
  const assetPolicy = rendererAvailable
    ? {
        label: canvasReady ? "Live WebGL zone" : "Live world loading",
        detail: assetRequestAudit
          ? `${checkpoint.label} zone delta · ${assetRequestAudit.worldRequests} /world requests (${assetRequestAudit.ridgeRequests} Ridge) · ${formatTransferSize(assetRequestAudit.observedWorldBytes)} world / ${formatTransferSize(assetRequestAudit.totalObservedBytes)} total · ${assetRequestAudit.totalRequests} total requests · ${assetRequestAudit.videoRequests === 0 ? "no video" : `${assetRequestAudit.videoRequests} video request`} · ${assetRequestAudit.longTasks} long tasks · Ridge stage ${ridgeStage}/3 · ${(assetRequestAudit.measuredForMs / 1000).toFixed(1)}s window`
          : `${checkpoint.label} · measuring this zone only`,
      }
    : {
        label: device.forcedFallback ? "Forced still fallback" : "Still fallback",
        detail: device.forcedFallback ? "Test mode · renderer intentionally bypassed" : "Renderer unavailable · HTML journey retained",
      };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p>Real-time world prototype</p>
          <h1>World lab</h1>
        </div>
        <div className={styles.statusLine}>
          <span><i className={rendererAvailable ? styles.readyDot : styles.blockedDot} />{rendererAvailable ? "WebGL 2 live" : device.forcedFallback ? "Fallback test" : "WebGL 2 unavailable"}</span>
          <span>{medianFps === null ? "Measuring FPS" : `${medianFps} FPS median`}</span>
          <span>{benchmarkMode ? `Isolated benchmark · ${benchmarkMode}` : renderStats === null ? "Counting calls" : `${renderStats.calls} calls`}</span>
          <span>{device.tier} tier · {device.forcedTier ? "forced" : "adaptive"}</span>
        </div>
      </header>

      <section className={styles.lab} aria-label="Interactive world prototype">
        <div
          className={styles.stage}
          data-presentation={presentationMode ? "true" : "false"}
          data-benchmark={benchmarkMode ?? "normal"}
          data-inspection={inspection.enabled ? "true" : "false"}
          data-review-ui-hidden={reviewUiHidden ? "true" : "false"}
          data-renderer-state={rendererAvailable ? (canvasReady ? "live" : "loading") : "fallback"}
          onPointerDown={handleStagePointerDown}
          onPointerMove={handleStagePointerMove}
          onPointerUp={handleStagePointerUp}
          onPointerCancel={handleStagePointerUp}
          onWheel={handleStageWheel}
          ref={stageRef}
        >
          <div
            aria-hidden="true"
            className={styles.fallbackPoster}
            style={{ backgroundImage: `url("${fallbackStill}")` }}
          />
          {rendererAvailable ? (
            <WorldCanvasBoundary onFailure={handleRendererFailure}>
              <Canvas
                camera={{ position: [112, 82, 280], fov: 42, near: 0.2, far: 2600 }}
                dpr={device.mobile ? [0.75, 1] : device.tier === "high" ? [1, 1.25] : [0.85, 1]}
                gl={{ antialias: device.tier !== "conservative", powerPreference: "high-performance" }}
                shadows={device.tier !== "conservative" && !device.mobile ? "basic" : false}
                onCreated={({ gl }) => {
                  gl.toneMapping = ACESFilmicToneMapping;
                  gl.toneMappingExposure = device.mobile ? 1.02 : 1.12;
                  setCanvasReady(true);
                }}
              >
                <Scene
                  activeView={activeView}
                  diagnosticMode={diagnosticMode}
                  contactStep={contactStep}
                  device={device}
                  fullJourneyNonce={fullJourneyNonce}
                  fullJourneyPlaying={fullJourneyPlaying}
                  inspection={inspection}
                  journeyCheckpoint={journeyCheckpoint}
                  onRendererFailure={handleRendererFailure}
                  onStats={handleStats}
                  ridgeShotNonce={ridgeShotNonce}
                  benchmarkMode={benchmarkMode}
                  worldVersion={worldVersion}
                />
              </Canvas>
            </WorldCanvasBoundary>
          ) : (
            <div className={styles.webglFallback}>
              <strong>{device.forcedFallback ? "Still fallback test is active." : "This browser cannot start the live scene."}</strong>
              <p>The still preserves the complete HTML journey and controls. No pre-rendered video is used.</p>
            </div>
          )}

          <div className={styles.stageChrome}>
            <span>{`WORLD SLICE ${worldVersion === "v116" ? "V1.16" : "V1.15"} / REAL-TIME ${checkpoint.label.toUpperCase()}${benchmarkMode ? ` / ${benchmarkMode.toUpperCase()}` : ""}`}</span>
            <div className={styles.stageActions}>
              {activeView === "journey" && checkpoint.id === "ridge" && rendererAvailable ? (
                <button onClick={() => setRidgeShotNonce((nonce) => nonce + 1)} type="button">
                  <span aria-hidden="true">▶</span>
                  {device.reducedMotion ? "Show Ridge reveal" : "Play Ridge shot · 22s"}
                </button>
              ) : null}
              <button aria-pressed={presentationMode} onClick={togglePresentation} type="button">
                <span aria-hidden="true">{presentationMode ? "↙" : "↗"}</span>
                {presentationMode ? "Exit full screen" : "Present full screen"}
              </button>
            </div>
          </div>

          <div className={styles.sceneCaption}>
            <span>{copy.role}</span>
            <h2>{copy.label}</h2>
            <p>{copy.detail}</p>
          </div>
          {reviewRoute && diagnosticMode ? (
            <div className={styles.debugOverlay} role="status">
              <strong>{diagnosticMode === "grounding" ? "Tree contact" : diagnosticMode === "water" ? "Water continuity" : "Zone identity"}</strong>
              <span>{diagnosticMode === "grounding"
                ? "Accepted hero trees · transformed low-vertex contacts measured against final terrain · yellow = within gate, amber/red = excessive relief"
                : diagnosticMode === "water"
                  ? "Terrain-sampled tributary → visible fall (170, −730) → terrain-sampled outflow and connected river/lake ribbon"
                  : `${checkpoint.label} · connected ${worldVersion === "v116" ? "v1.16 streamed" : "v1.15 persistent"} Ridge-to-Valley world`}</span>
            </div>
          ) : null}
        </div>

        <aside className={styles.controls}>
          {reviewRoute ? (
            <details className={styles.reviewController} open>
              <summary>Review controller · dev only</summary>
              <div className={styles.reviewActions}>
                <button aria-pressed={worldVersion === "v116"} onClick={() => selectWorldVersion("v116")} type="button">
                  Review v1.16 realism
                </button>
                <button aria-pressed={worldVersion === "v115"} onClick={() => selectWorldVersion("v115")} type="button">
                  Compare v1.15 baseline
                </button>
                <button onClick={fullJourneyPlaying ? stopFullJourney : playFullJourney} type="button">
                  {fullJourneyPlaying ? "Stop continuous journey" : "Play full journey · 54s"}
                </button>
                <button
                  aria-pressed={inspection.enabled}
                  onClick={() => setInspection((current) => ({ ...current, enabled: !current.enabled }))}
                  type="button"
                >{inspection.enabled ? "Exit inspection" : "Inspect camera"}</button>
                <button disabled={!inspection.enabled} onClick={resetInspection} type="button">Reset camera</button>
                <button aria-pressed={reviewUiHidden} onClick={() => setReviewUiHidden((current) => !current)} type="button">
                  {reviewUiHidden ? "Show scene UI" : "Hide scene UI"}
                </button>
              </div>
              <small>{inspection.enabled ? "Drag the live scene to orbit. Wheel to dolly. Limits preserve chapter context." : "The public journey remains on authored camera rails."}</small>
              <div className={styles.reviewChapters} aria-label="Review chapters">
                {JOURNEY_CHECKPOINTS.map((item, index) => (
                  <button
                    aria-pressed={index === journeyCheckpoint}
                    key={`review-${item.id}`}
                    onClick={() => { stopFullJourney(); setActiveView("journey"); selectJourneyCheckpoint(index); }}
                    type="button"
                  >{item.id === "reveal" ? "Crest / Valley reveal" : item.label}</button>
                ))}
              </div>
              <div className={styles.reviewDiagnostics} aria-label="Debug overlays">
                {(["grounding", "water", "zones"] as const).map((mode) => (
                  <button
                    aria-pressed={diagnosticMode === mode}
                    key={mode}
                    onClick={() => setDiagnosticMode((current) => current === mode ? null : mode)}
                    type="button"
                  >{mode === "grounding" ? "Tree contact" : mode === "water" ? "Water path" : "Zone IDs"}</button>
                ))}
              </div>
            </details>
          ) : null}
          <div className={styles.controlHeading}>
            <span>Camera state</span>
            <strong>One mountain journey. Context when you ask for it.</strong>
          </div>
          <div className={styles.zoneList}>
            {WORLD_VIEWS.map((item) => (
              <ViewButton
                active={activeView === item.id}
                id={item.id}
                key={item.id}
                onSelect={selectActiveView}
              />
            ))}
          </div>

          {activeView === "contact" ? (
            <div className={styles.ascent}>
              <div>
                <span>Contact ascent</span>
                <strong>{CONTACT_ASCENT[contactStep].place}</strong>
              </div>
              <input
                aria-label="Contact journey step"
                max={CONTACT_ASCENT.length - 1}
                min="0"
                onChange={(event) => setContactStep(Number(event.target.value))}
                type="range"
                value={contactStep}
              />
              <ol>
                {CONTACT_ASCENT.map((step, index) => (
                  <li className={index === contactStep ? styles.activeStep : undefined} key={step.id}>
                    <button onClick={() => setContactStep(index)} type="button">
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      {step.label}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <div className={styles.ascent}>
              <div>
                <span>Saved journey position</span>
                <strong>{checkpoint.label}</strong>
              </div>
              <input
                aria-label="Mountain journey checkpoint"
                max={JOURNEY_CHECKPOINTS.length - 1}
                min="0"
                onChange={(event) => selectJourneyCheckpoint(Number(event.target.value))}
                type="range"
                value={journeyCheckpoint}
              />
              <ol>
                {JOURNEY_CHECKPOINTS.map((item, index) => (
                  <li className={index === journeyCheckpoint ? styles.activeStep : undefined} key={item.id}>
                    <button onClick={() => selectJourneyCheckpoint(index)} type="button">
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      {item.label}
                    </button>
                  </li>
                ))}
              </ol>
              <dl className={styles.zoneFacts}>
                <div><dt>Movement</dt><dd>{view.behavior}</dd></div>
                <div><dt>Return</dt><dd>Journey progress remains at {checkpoint.label.toLowerCase()}.</dd></div>
              </dl>
            </div>
          )}
        </aside>
      </section>

      <section className={styles.readout} aria-label="Prototype diagnostics">
        <div><span>GPU policy</span><strong>{device.forcedTier ? "Forced test tier" : "Adaptive DPR + tier"}</strong><small>{renderStats?.rendererPixelRatio?.toFixed(2) ?? "—"}× renderer · {device.pixelRatio.toFixed(2)}× display · {renderStats?.triangles.toLocaleString() ?? "—"} triangles · {renderStats?.geometries ?? "—"} geometries / {renderStats?.textures ?? "—"} textures · {medianFps ?? "—"} median / {p10Fps ?? "—"} p10 / {minimumFps ?? "—"} min FPS · {stabilityLabel} · {device.graphics}</small></div>
        <div><span>Journey state</span><strong>{String(journeyCheckpoint + 1).padStart(2, "0")} / {String(JOURNEY_CHECKPOINTS.length).padStart(2, "0")}</strong><small>Persists through ocean and sky views</small></div>
        <div><span>Motion policy</span><strong>{device.reducedMotion ? "Calm rail" : "Cinematic rail"}</strong><small>{device.motionOverride ? "Local test override active" : "OS preference applied automatically"}</small></div>
        <div><span>Asset policy</span><strong>{assetPolicy.label}</strong><small>{assetPolicy.detail}</small></div>
      </section>
    </div>
  );
}

type PublicWorldExperienceProps = {
  activeView: WorldViewId;
  className?: string;
  onReady?: () => void;
  progress: MotionValue<number>;
};

export function PublicWorldExperience({ activeView, className, onReady, progress }: PublicWorldExperienceProps) {
  const [device] = useState<DeviceProfile | null>(() =>
    typeof document === "undefined" ? null : inspectDevice(false),
  );
  const [journeyCheckpoint, setJourneyCheckpoint] = useState(0);
  const [canvasReady, setCanvasReady] = useState(false);
  const [canvasFailed, setCanvasFailed] = useState(false);
  const meaningfulReadySent = useRef(false);
  const handleRendererFailure = useCallback(() => {
    setCanvasReady(false);
    setCanvasFailed(true);
  }, []);
  const ignoreStats = useCallback(() => {}, []);

  useEffect(() => {
    const handleJourneyChapter = (event: Event) => {
      const index = (event as CustomEvent<{ chapterIndex?: number }>).detail?.chapterIndex;
      if (typeof index === "number" && index >= 0 && index < JOURNEY_CHECKPOINTS.length) {
        setJourneyCheckpoint(index);
      }
    };
    window.addEventListener("madagin:journey-chapter", handleJourneyChapter);
    return () => window.removeEventListener("madagin:journey-chapter", handleJourneyChapter);
  }, []);

  useEffect(() => {
    const markMeaningfulReady = () => {
      if (meaningfulReadySent.current) return;
      meaningfulReadySent.current = true;
      document.documentElement.dataset.madaginMeaningfulWorldReady = "true";
      onReady?.();
    };
    const handleRidgeStage = (event: Event) => {
      const detail = (event as CustomEvent<{ stage?: number; zone?: JourneyCheckpointId }>).detail;
      if (!meaningfulReadySent.current && detail?.zone === "ridge" && (detail.stage ?? 0) >= 2) {
        markMeaningfulReady();
      }
    };
    window.addEventListener("madagin:ridge-stage", handleRidgeStage);
    const stages = (window as Window & {
      __MADAGIN_RIDGE_STAGES_V116__?: Array<{ stage?: number; zone?: JourneyCheckpointId }>;
    }).__MADAGIN_RIDGE_STAGES_V116__ ?? [];
    if (stages.some((stage) => stage.zone === "ridge" && (stage.stage ?? 0) >= 2)) markMeaningfulReady();
    return () => window.removeEventListener("madagin:ridge-stage", handleRidgeStage);
  }, [onReady]);

  if (!device) {
    return (
      <div
        aria-hidden="true"
        className={className}
        data-public-world="true"
        data-renderer-state="checking"
      />
    );
  }

  const rendererAvailable = device.webgl2 && !device.reducedMotion && !canvasFailed;
  const fallbackStill = JOURNEY_FALLBACK_STILLS[journeyCheckpoint] ?? JOURNEY_FALLBACK_STILLS[0];

  return (
    <div
      aria-hidden="true"
      className={className}
      data-public-world="true"
      data-quality-tier={device.tier}
      data-renderer-state={rendererAvailable ? (canvasReady ? "live" : "loading") : "fallback"}
      data-world-view={activeView}
      data-world-chapter={JOURNEY_CHECKPOINTS[journeyCheckpoint].id}
    >
      <div
        className={styles.fallbackPoster}
        style={{ backgroundImage: `url("${fallbackStill}")` }}
      />
      {rendererAvailable ? (
        <WorldCanvasBoundary onFailure={handleRendererFailure}>
          <Canvas
            camera={{ position: [112, 82, 280], fov: 42, near: 0.2, far: 2600 }}
            dpr={device.mobile ? [0.75, 1] : [0.85, 1]}
            gl={{ antialias: device.tier !== "conservative", powerPreference: "high-performance" }}
            shadows={device.tier !== "conservative" && !device.mobile ? "basic" : false}
            onCreated={({ gl }) => {
              gl.toneMapping = ACESFilmicToneMapping;
              gl.toneMappingExposure = device.mobile ? 0.98 : 1.05;
              setCanvasReady(true);
            }}
          >
            <Scene
              activeView={activeView}
              diagnosticMode={null}
              contactStep={0}
              device={device}
              fullJourneyNonce={0}
              fullJourneyPlaying={false}
              inspection={{ enabled: false, pitch: 0, yaw: 0, zoom: 1 }}
              journeyCheckpoint={journeyCheckpoint}
              onRendererFailure={handleRendererFailure}
              onStats={ignoreStats}
              publicJourneyProgress={progress}
              ridgeShotNonce={0}
              benchmarkMode={null}
              worldVersion="v116"
            />
          </Canvas>
        </WorldCanvasBoundary>
      ) : null}
    </div>
  );
}
