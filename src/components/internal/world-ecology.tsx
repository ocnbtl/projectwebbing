"use client";

import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import {
  BufferGeometry,
  Color,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  Float32BufferAttribute,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Points,
  RepeatWrapping,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
  Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { JourneyCheckpointId } from "@/lib/world-manifest";
import { RidgeProductionV115 } from "./ridge-production-v115";
import { RidgeProductionV116 } from "./ridge-production-v116";

export type WorldQualityTier = "high" | "balanced" | "conservative";

type WorldEcologyProps = {
  diagnosticMode?: "grounding" | "water" | "zones" | null;
  mobile: boolean;
  reducedMotion: boolean;
  shadows: boolean;
  showOcean: boolean;
  tier: WorldQualityTier;
  worldVersion: "v115" | "v116";
  zone: JourneyCheckpointId;
};

type Placement = {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
  color: Color;
  variant: number;
  leanX?: number;
  leanZ?: number;
};

type CanopyPlacement = Placement & {
  scaleX: number;
  scaleY: number;
  scaleZ: number;
};

const ECOLOGY_ROOT = "/world/assets/polyhaven";
const SHOW_LEGACY_TREE_IMPOSTORS = false;
const SHOW_CANOPY_VOLUME_PROXY = true;
const LAKE_CENTER_X = 2.4;
const LAKE_CENTER_Z = -49;
const LAKE_RADIUS_X = 18.1;
const LAKE_RADIUS_Z = 27.1;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mix(a: number, b: number, amount: number) {
  return a + (b - a) * amount;
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const amount = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

function fract(value: number) {
  return value - Math.floor(value);
}

function hash2(x: number, z: number) {
  return fract(Math.sin(x * 127.1 + z * 311.7) * 43758.5453123);
}

function valueNoise(x: number, z: number) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  return mix(
    mix(hash2(ix, iz), hash2(ix + 1, iz), ux),
    mix(hash2(ix, iz + 1), hash2(ix + 1, iz + 1), ux),
    uz,
  );
}

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function ridgeLift(x: number, z: number) {
  const travel = -z;
  const ridgeCenter = -12 + 1.7 * Math.sin(x * 0.14 + 0.9) + 0.72 * Math.sin(x * 0.39 - 0.6);
  const acrossRidge = Math.exp(-(((travel - ridgeCenter) / 8.4) ** 2));
  const saddle = -0.8 * Math.exp(-(((x + 0.6) / 5.1) ** 2));
  const asymmetry = 1.1 * Math.sin(x * 0.19 + 0.7) + 0.42 * Math.sin(x * 0.53 - 1.2);
  const sideFalloff = Math.max(0, 1 - Math.max(0, Math.abs(x) - 22) / 16);
  const ridgeGullies =
    Math.exp(-(((x + 9.2) / 2.8) ** 2)) * 0.72 +
    Math.exp(-(((x - 6.6) / 2.4) ** 2)) * 0.58 +
    Math.exp(-(((x - 14.5) / 3.1) ** 2)) * 0.46;
  const windwardRibs =
    Math.sin(x * 0.31 + travel * 0.16) * 0.72 +
    Math.sin(x * 0.67 - travel * 0.09) * 0.28;
  const lift = Math.max(
    0,
    acrossRidge * (10.6 + saddle * 0.58 + asymmetry * 0.82 - ridgeGullies * 1.55 + windwardRibs) * sideFalloff,
  );
  const brokenGround =
    Math.sin(x * 0.43 + z * 0.21) * 0.16 +
    Math.sin(x * 0.91 - z * 0.38) * 0.07 +
    Math.cos((x + z) * 1.47) * 0.025;
  return lift + brokenGround * Math.min(1, lift / 1.35);
}

function valleyAxis(travel: number) {
  return (
    Math.sin(travel * 0.027) * 5.2 +
    Math.sin(travel * 0.071 + 1.4) * 1.8 -
    0.8
  );
}

function riverAxis(travel: number) {
  return valleyAxis(travel) + Math.sin(travel * 0.12 + 0.6) * 1.25;
}

function lakeBoundaryModulation(angle: number) {
  return (
    0.94 +
    Math.sin(angle * 2 - 0.22) * 0.072 +
    Math.sin(angle * 3 + 0.72) * 0.068 +
    Math.sin(angle * 5 - 1.16) * 0.041 +
    Math.sin(angle * 9 + 2.04) * 0.024 +
    Math.sin(angle * 17 - 0.38) * 0.011
  );
}

function lakeNormalizedRadius(x: number, z: number) {
  const normalizedX = (x - LAKE_CENTER_X) / LAKE_RADIUS_X;
  const normalizedZ = (z - LAKE_CENTER_Z) / LAKE_RADIUS_Z;
  const angle = Math.atan2(normalizedZ, normalizedX);
  return Math.sqrt(normalizedX * normalizedX + normalizedZ * normalizedZ) / lakeBoundaryModulation(angle);
}

function lakeBoundaryPoint(angle: number, radialScale = 1) {
  const modulation = lakeBoundaryModulation(angle) * radialScale;
  return new Vector2(
    LAKE_CENTER_X + Math.cos(angle) * LAKE_RADIUS_X * modulation,
    LAKE_CENTER_Z + Math.sin(angle) * LAKE_RADIUS_Z * modulation,
  );
}

function distanceToSegment2d(
  x: number,
  z: number,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
) {
  const segmentX = endX - startX;
  const segmentZ = endZ - startZ;
  const lengthSquared = segmentX * segmentX + segmentZ * segmentZ;
  const amount = lengthSquared === 0
    ? 0
    : clamp(((x - startX) * segmentX + (z - startZ) * segmentZ) / lengthSquared, 0, 1);
  const nearestX = startX + segmentX * amount;
  const nearestZ = startZ + segmentZ * amount;
  return Math.hypot(x - nearestX, z - nearestZ);
}

const HERO_CAMERA_CLEARINGS = [
  { x: 0, z: 64, radius: 18 },
  { x: 3.5, z: 1.5, radius: 15 },
  { x: -8, z: -8, radius: 14 },
  { x: -14, z: -53, radius: 15 },
  { x: 7, z: -132, radius: 16 },
] as const;

function isNearHeroCamera(x: number, z: number) {
  return HERO_CAMERA_CLEARINGS.some((clearing) =>
    Math.hypot(x - clearing.x, z - clearing.z) < clearing.radius,
  );
}

function isHeroSightline(x: number, z: number) {
  const ridgeSightline = distanceToSegment2d(x, z, 0, 82, 0, 8) < 7.8;
  const valleySightline = distanceToSegment2d(x, z, 3.5, 1.5, 2.4, -104) < 7.2;
  const lakeSightline = distanceToSegment2d(x, z, -8, -8, 3.2, -78) < 6.5;
  const waterfallSightline = distanceToSegment2d(x, z, -14, -53, 4.8, -80) < 6.8;
  const waterfallFace = Math.hypot((x - 4.8) / 1.25, (z + 80.5) / 0.86) < 9.2;
  return isNearHeroCamera(x, z) || ridgeSightline || valleySightline || lakeSightline || waterfallSightline || waterfallFace;
}

function coastlineAt(z: number) {
  return -66 +
    Math.sin(z * 0.041 + 0.8) * 5.8 +
    Math.sin(z * 0.097 - 1.3) * 2.4 +
    (valueNoise(z * 0.028 + 4.2, z * 0.011 - 8.1) - 0.5) * 5.2;
}

export function worldSurfaceHeight(x: number, z: number, waterfall = false) {
  const travel = -z;
  const valleyCenter = valleyAxis(travel);
  const distanceFromValley = Math.abs(x - valleyCenter);
  const rangeNoise =
    Math.sin(x * 0.031 + z * 0.014 + 1.1) * 2.45 +
    Math.sin(x * 0.067 - z * 0.026 - 0.7) * 1.35 +
    Math.cos((x + z) * 0.018 + 2.4) * 1.05;
  const fineErosion =
    Math.sin(x * 0.19 + z * 0.073) * 0.38 +
    Math.sin(x * 0.41 - z * 0.16) * 0.19;
  const westernRangeScale = mix(0.08, 1, smoothstep(-76, -24, x));
  const sideRange = Math.min(
    16,
    Math.max(0, (distanceFromValley - 10) / 30) ** 1.34 * 5.4,
  ) * westernRangeScale;
  const valleyUndulation =
    0.62 * Math.sin(x * 0.12 + z * 0.035) +
    0.38 * Math.sin(z * 0.094 - x * 0.047);
  const farRise = smoothstep(46, 190, travel) * (3.4 + Math.max(0, rangeNoise) * 0.42);
  const mountainA = 8.5 * Math.exp(-(((x + 54) / 23) ** 2 + ((z + 118) / 39) ** 2)) * westernRangeScale;
  const mountainB = 11 * Math.exp(-(((x - 62) / 27) ** 2 + ((z + 146) / 46) ** 2));
  const mountainC = 8 * Math.exp(-(((x + 18) / 20) ** 2 + ((z + 202) / 31) ** 2));
  const mountainD = 15.5 * Math.exp(-(((x + 92) / 31) ** 2 + ((z + 214) / 42) ** 2)) * westernRangeScale;
  const mountainE = 18 * Math.exp(-(((x - 104) / 34) ** 2 + ((z + 236) / 47) ** 2));
  const watershedRibs = smoothstep(38, 218, travel) * (
    Math.abs(Math.sin(x * 0.047 + travel * 0.034)) ** 2.4 * 2.8 +
    Math.abs(Math.sin(x * 0.082 - travel * 0.021 + 1.3)) ** 3.1 * 1.55
  ) * smoothstep(9, 34, distanceFromValley);

  const channelCenter = riverAxis(travel);
  const riverCut = Math.exp(-(((x - channelCenter) / 2.8) ** 2)) * 0.48;

  // The upper river sits on a raised, fractured basalt shelf. A short transition
  // at z ~= -80 creates the actual cliff instead of forcing a water sheet to
  // float above a continuous grassy slope.
  const shelfWidth = Math.exp(-(((x - 4.8) / 19.5) ** 2));
  const shelfFront = smoothstep(79.2, 82.1, travel);
  const shelfBack = 1 - smoothstep(154, 184, travel) * 0.3;
  const waterfallShelf = 10.8 * shelfWidth * shelfFront * shelfBack;
  const cliffBand = Math.exp(-(((travel - 81.1) / 4.8) ** 2));
  const cliffFracture = cliffBand * shelfWidth * (
    Math.sin(x * 0.73 + z * 0.41) * 0.42 +
    Math.sin(x * 1.67 - z * 0.83) * 0.2
  );
  const leftDrainage = Math.exp(-(((x - valleyCenter + 17 + Math.sin(travel * 0.08) * 2.4) / 2.8) ** 2));
  const rightDrainage = Math.exp(-(((x - valleyCenter - 21 + Math.cos(travel * 0.061) * 3.1) / 3.4) ** 2));
  const drainageCut = (leftDrainage * 1.3 + rightDrainage * 1.05) * smoothstep(28, 156, travel);

  let floor =
    0.72 +
    valleyUndulation +
    fineErosion +
    rangeNoise * smoothstep(14, 55, distanceFromValley) +
    sideRange +
    farRise +
    mountainA +
    mountainB +
    mountainC +
    mountainD +
    mountainE +
    watershedRibs -
    riverCut -
    drainageCut +
    (waterfall ? cliffFracture : 0) +
    ridgeLift(x, z) +
    (waterfall ? waterfallShelf : 0);

  // A broad, irregular basin is flattened below one water line instead of
  // placing water on top of rolling terrain. This prevents disconnected blue
  // islands and creates a readable shore from the reveal camera.
  const lakeDistance = lakeNormalizedRadius(x, z);
  const lakeMask = 1 - smoothstep(0.78, 1.09, lakeDistance);
  const lakeDepth = 1 - smoothstep(0.12, 1.03, lakeDistance);
  const lakeFloor = mix(-0.14, -0.72, lakeDepth) + valueNoise(x * 0.11 + 3, z * 0.11 - 7) * 0.055;
  floor = mix(floor, lakeFloor, lakeMask);

  // The west side is a real coast rather than terrain sitting on top of the
  // ocean plane. Its irregular edge follows the same eroded, asymmetric logic
  // as Hawaiian sea cliffs and leaves a clear sightline from every checkpoint.
  const coastline = coastlineAt(z);
  const oceanMask = 1 - smoothstep(coastline - 4.2, coastline + 2.0, x);
  const seabed = -1.28 + valueNoise(x * 0.035 - 2, z * 0.035 + 5) * 0.12;
  floor = mix(floor, seabed, oceanMask);

  return Math.max(-1.42, floor);
}

function surfaceSlope(x: number, z: number, waterfall = false) {
  const sample = 0.8;
  const dx = worldSurfaceHeight(x + sample, z, waterfall) - worldSurfaceHeight(x - sample, z, waterfall);
  const dz = worldSurfaceHeight(x, z + sample, waterfall) - worldSurfaceHeight(x, z - sample, waterfall);
  return Math.sqrt(dx * dx + dz * dz) / (sample * 2);
}

function configureTexture(texture: Texture, repeatX: number, repeatY: number, anisotropy: number, srgb = false) {
  const result = texture.clone();
  result.wrapS = RepeatWrapping;
  result.wrapT = RepeatWrapping;
  result.repeat.set(repeatX, repeatY);
  result.anisotropy = anisotropy;
  if (srgb) result.colorSpace = SRGBColorSpace;
  result.needsUpdate = true;
  return result;
}

function createWaterfallCliffGeometry() {
  const columns = 26;
  const rows = 18;
  const bottom = worldSurfaceHeight(4.8, -76.2) - 0.28;
  const top = Math.max(worldSurfaceHeight(4.8, -84.2, true) + 0.18, bottom + 8.8);
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const basalt = new Color("#343b38");
  const wetStone = new Color("#1f2d2d");
  const moss = new Color("#314431");

  for (let row = 0; row <= rows; row += 1) {
    const vertical = row / rows;
    for (let column = 0; column <= columns; column += 1) {
      const horizontal = column / columns;
      const across = horizontal * 2 - 1;
      const fracture =
        Math.sin(column * 1.37 + row * 0.61) * 0.18 +
        Math.sin(column * 0.43 - row * 1.09) * 0.11;
      const ledge = Math.sin(vertical * Math.PI * 5.0 + horizontal * 4.1) * 0.13;
      const halfWidth = 6.45 + Math.sin(vertical * 7.4 + 0.6) * 0.52 + Math.sin(vertical * 16.0) * 0.17;
      const x = 4.8 + across * halfWidth + fracture * 0.5;
      const lowerEdge = bottom - Math.abs(across) * (0.38 + Math.sin(horizontal * 9.2) * 0.12);
      const upperEdge = top - Math.abs(across) ** 1.45 * 1.12 + Math.sin(horizontal * 10.7) * 0.2;
      const y = mix(lowerEdge, upperEdge, vertical) + Math.sin(column * 0.71 + row * 0.66) * 0.12;
      const outcropA = Math.exp(-(((across + 0.27) / 0.24) ** 2 + ((vertical - 0.58) / 0.16) ** 2)) * 0.58;
      const outcropB = Math.exp(-(((across - 0.31) / 0.23) ** 2 + ((vertical - 0.34) / 0.15) ** 2)) * 0.46;
      const z = -80.73 + fracture + ledge + Math.abs(across) * 0.14 + outcropA + outcropB;
      const wetness = Math.exp(-((across / 0.39) ** 2)) * (0.72 + Math.sin(vertical * 14.0) * 0.1);
      const mossiness = smoothstep(0.55, 0.98, Math.abs(across)) * (0.45 + vertical * 0.35);
      const color = basalt.clone().lerp(wetStone, clamp(wetness, 0, 0.84)).lerp(moss, clamp(mossiness, 0, 0.62));
      positions.push(x, y, z);
      uvs.push(horizontal * 3.2, vertical * 2.4);
      colors.push(color.r, color.g, color.b);
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const stride = columns + 1;
      const a = row * stride + column;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const indexed = new BufferGeometry();
  indexed.setAttribute("position", new Float32BufferAttribute(positions, 3));
  indexed.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  indexed.setAttribute("color", new Float32BufferAttribute(colors, 3));
  indexed.setIndex(indices);
  indexed.computeVertexNormals();
  indexed.computeBoundingSphere();
  return indexed;
}

function ExpandedTerrain({
  shadows,
  tier,
  showWaterfallCliff,
}: Pick<WorldEcologyProps, "shadows" | "tier"> & { showWaterfallCliff: boolean }) {
  const { gl } = useThree();
  const [sourceMap, sourceNormal, sourceArm, sourceRock] = useLoader(TextureLoader, [
    `${ECOLOGY_ROOT}/forrest_ground_03/forrest_ground_03_diff_1k.jpg`,
    `${ECOLOGY_ROOT}/forrest_ground_03/forrest_ground_03_nor_gl_1k.jpg`,
    `${ECOLOGY_ROOT}/forrest_ground_03/forrest_ground_03_arm_1k.jpg`,
    `${ECOLOGY_ROOT}/aerial_grass_rock/aerial_grass_rock_diff_1k.jpg`,
  ]);
  const textures = useMemo(() => {
    const anisotropy = Math.min(tier === "high" ? 8 : 4, gl.capabilities.getMaxAnisotropy());
    return [
      configureTexture(sourceMap, 34, 40, anisotropy, true),
      configureTexture(sourceNormal, 34, 40, anisotropy),
      configureTexture(sourceArm, 34, 40, anisotropy),
      configureTexture(sourceRock, 1, 1, anisotropy, true),
    ];
  }, [gl, sourceArm, sourceMap, sourceNormal, sourceRock, tier]);

  const geometry = useMemo(() => {
    const xSegments = tier === "high" ? 210 : tier === "balanced" ? 150 : 94;
    const zSegments = tier === "high" ? 244 : tier === "balanced" ? 174 : 110;
    const result = new PlaneGeometry(270, 310, xSegments, zSegments);
    result.rotateX(-Math.PI / 2);
    result.translate(0, 0, -82);
    const position = result.getAttribute("position") as Float32BufferAttribute;
    const colors = new Float32Array(position.count * 3);
    const moss = new Color("#64835f");
    const forest = new Color("#3f5c46");
    const stone = new Color("#4a5750");
    const alpine = new Color("#74786e");
    const snow = new Color("#c8c9bd");

    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const z = position.getZ(index);
      const height = worldSurfaceHeight(x, z, showWaterfallCliff);
      const slope = surfaceSlope(x, z, showWaterfallCliff);
      const patch = valueNoise(x * 0.055 + 4, z * 0.055 - 9);
      const color = forest.clone().lerp(moss, clamp(patch * 1.35 - 0.22, 0, 1));
      color.lerp(stone, clamp((slope - 0.3) * 1.25, 0, 0.82));
      color.lerp(alpine, clamp((height - 29) / 19, 0, 0.72));
      color.lerp(snow, clamp((height - 52) / 16, 0, 0.78));
      position.setY(index, height);
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    }
    result.setAttribute("color", new Float32BufferAttribute(colors, 3));
    result.computeVertexNormals();
    result.computeBoundingBox();
    result.computeBoundingSphere();
    return result;
  }, [showWaterfallCliff, tier]);
  const cliffGeometry = useMemo(() => createWaterfallCliffGeometry(), []);

  const material = useMemo(() => {
    const result = new MeshStandardMaterial({
      map: textures[0],
      normalMap: textures[1],
      normalScale: new Vector2(0.52, 0.52),
      emissive: "#263229",
      emissiveIntensity: 0.08,
      roughness: 0.98,
      roughnessMap: textures[2],
      vertexColors: true,
    });
    result.envMapIntensity = 0.32;
    result.onBeforeCompile = (shader) => {
      shader.uniforms.uMadaginRockMap = { value: textures[3] };
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
          varying vec3 vMadaginWorldPosition;
          varying vec3 vMadaginWorldNormal;`,
        )
        .replace(
          "#include <worldpos_vertex>",
          `#include <worldpos_vertex>
          vMadaginWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vMadaginWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          uniform sampler2D uMadaginRockMap;
          varying vec3 vMadaginWorldPosition;
          varying vec3 vMadaginWorldNormal;`,
        )
        .replace(
          "#include <map_fragment>",
          `#ifdef USE_MAP
            mat2 madaginRotation = mat2(0.8, -0.6, 0.6, 0.8);
            vec2 madaginWorldUv = vMadaginWorldPosition.xz;
            vec3 madaginForestBroad = texture2D(map, madaginWorldUv * 0.018).rgb;
            vec3 madaginForestDetail = texture2D(map, madaginRotation * madaginWorldUv * 0.071).rgb;
            float madaginMacro = sin(madaginWorldUv.x * 0.043 + madaginWorldUv.y * 0.031)
              * sin(madaginWorldUv.x * 0.019 - madaginWorldUv.y * 0.057) * 0.5 + 0.5;
            vec3 madaginForest = mix(madaginForestBroad, madaginForestDetail, 0.42 + madaginMacro * 0.24);
            madaginForest *= vec3(0.5, 0.66, 0.46);
            vec3 madaginRock = texture2D(uMadaginRockMap, madaginWorldUv * 0.052).rgb
              * vec3(0.78, 0.82, 0.74);
            float madaginSlope = 1.0 - abs(normalize(vMadaginWorldNormal).y);
            float madaginElevation = smoothstep(25.0, 55.0, vMadaginWorldPosition.y);
            float madaginFracture = sin(madaginWorldUv.x * 0.17 + madaginWorldUv.y * 0.11) * 0.5 + 0.5;
            float madaginRidgeBand = smoothstep(3.0, 7.0, vMadaginWorldPosition.z)
              * (1.0 - smoothstep(18.0, 23.0, vMadaginWorldPosition.z));
            float madaginRidgeFracture = sin(vMadaginWorldPosition.x * 0.53 + vMadaginWorldPosition.z * 0.37)
              * sin(vMadaginWorldPosition.x * 0.21 - vMadaginWorldPosition.z * 0.74) * 0.5 + 0.5;
            vec3 madaginRidgeRock = vec3(0.15, 0.2, 0.16) * (0.82 + madaginRidgeFracture * 0.24);
            madaginRock = mix(madaginRock, madaginRidgeRock, madaginRidgeBand);
            float madaginRidgeExposure = madaginRidgeBand
              * smoothstep(0.58, 0.86, madaginRidgeFracture) * 0.16;
            float madaginRockBlend = clamp(
              smoothstep(0.12, 0.49, madaginSlope) * (0.8 + madaginFracture * 0.2)
              + madaginElevation * 0.46
              + madaginRidgeExposure,
              0.0,
              0.92
            );
            vec3 madaginAlbedo = mix(madaginForest, madaginRock, madaginRockBlend);
            diffuseColor *= vec4(madaginAlbedo, 1.0);
          #endif`,
        );
    };
    result.customProgramCacheKey = () => "madagin-multiscale-terrain-v14";
    return result;
  }, [textures]);
  const cliffMaterial = useMemo(() => {
    const result = new MeshStandardMaterial({
      color: "#9aa39b",
      emissive: "#0b1711",
      emissiveIntensity: 0.055,
      roughness: 0.99,
      vertexColors: true,
    });
    result.envMapIntensity = 0.12;
    return result;
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      cliffGeometry.dispose();
      material.dispose();
      cliffMaterial.dispose();
      textures.forEach((texture) => texture.dispose());
    },
    [cliffGeometry, cliffMaterial, geometry, material, textures],
  );

  return (
    <group name="Eroded terrain and waterfall basalt face">
      <mesh castShadow={false} geometry={geometry} material={material} receiveShadow={shadows} />
      {showWaterfallCliff ? (
        <mesh castShadow={shadows} geometry={cliffGeometry} material={cliffMaterial} receiveShadow={shadows} />
      ) : null}
    </group>
  );
}

function createImpostorGeometry() {
  const front = new PlaneGeometry(4.65, 8.9, 1, 1);
  front.translate(0, 4.45, 0);
  const side = front.clone();
  side.rotateY(Math.PI / 2);
  const merged = mergeGeometries([front, side], false);
  front.dispose();
  side.dispose();
  if (!merged) throw new Error("Unable to build the authored-tree impostor LOD");
  merged.computeBoundingSphere();
  return merged;
}

function createCanopyClusterGeometry(variant: number) {
  const random = seededRandom(61091 + variant * 977);
  const parts: BufferGeometry[] = [];
  const lobeCount = 4 + variant;
  for (let index = 0; index < lobeCount; index += 1) {
    const angle = (index / lobeCount) * Math.PI * 2 + random() * 0.62;
    const radius = index === 0 ? 0 : 0.52 + random() * 0.88;
    const lobe = new IcosahedronGeometry(1, 0);
    const width = 0.88 + random() * 0.58;
    lobe.scale(width, 0.72 + random() * 0.54, width * (0.82 + random() * 0.34));
    lobe.translate(
      Math.cos(angle) * radius,
      1.05 + random() * 0.86 + (index === 0 ? 0.28 : 0),
      Math.sin(angle) * radius,
    );
    parts.push(lobe);
  }
  const crown = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  if (!crown) throw new Error("Unable to build the v1.9 rainforest crown geometry");
  const position = crown.getAttribute("position") as Float32BufferAttribute;
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const weathering = 1 + Math.sin(x * 2.9 + y * 1.7 + z * 2.3 + variant) * 0.035;
    position.setXYZ(index, x * weathering, y, z * weathering);
  }
  crown.computeVertexNormals();
  crown.computeBoundingSphere();
  return crown;
}

function makeRainforestCanopyPlacements(count: number) {
  const random = seededRandom(733119);
  const placements: CanopyPlacement[] = [];
  for (let attempt = 0; attempt < count * 18 && placements.length < count; attempt += 1) {
    const openingBiome = random() < 0.68;
    const z = openingBiome
      ? 38 - random() ** 0.82 * 92
      : -42 - random() ** 0.88 * 126;
    const travel = -z;
    const center = valleyAxis(travel);
    const width = openingBiome ? 31 + random() * 37 : 25 + random() * 68;
    const x = (openingBiome ? 0 : center) + (random() * 2 - 1) * width;
    const height = worldSurfaceHeight(x, z);
    const slope = surfaceSlope(x, z);
    const lake = lakeNormalizedRadius(x, z);
    const riverDistance = Math.abs(x - riverAxis(travel));
    const moisture = valueNoise(x * 0.042 + 8.2, z * 0.042 - 5.7);
    const tropicalTreeLine = travel < 145 ? 51 + moisture * 9 : 36 + moisture * 10;
    const highAlpine = height > tropicalTreeLine;
    if (
      height < -0.04 ||
      highAlpine ||
      slope > 2.2 ||
      isHeroSightline(x, z) ||
      (lake < 1.06 && height < 2.4) ||
      (z < -70 && riverDistance < 2.35)
    ) {
      continue;
    }

    const oldGrowth = random();
    const scale = 0.58 + oldGrowth * 0.48 + moisture * 0.14;
    placements.push({
      x,
      y: height + 0.25,
      z,
      scale: 1,
      scaleX: scale * (0.86 + random() * 0.34),
      scaleY: scale * (0.72 + random() * 0.42),
      scaleZ: scale * (0.86 + random() * 0.34),
      rotation: random() * Math.PI * 2,
      color: new Color().setHSL(0.27 + random() * 0.065, 0.32 + random() * 0.24, 0.38 + random() * 0.14),
      variant: Math.floor(random() * 4),
      leanX: (random() - 0.5) * 0.08,
      leanZ: (random() - 0.5) * 0.08,
    });
  }
  return placements;
}

function RainforestCanopyMass({ mobile, tier }: Pick<WorldEcologyProps, "mobile" | "tier">) {
  const count = mobile
    ? tier === "conservative" ? 220 : 380
    : tier === "high" ? 940 : tier === "balanced" ? 610 : 300;
  const placements = useMemo(() => makeRainforestCanopyPlacements(count), [count]);
  const geometries = useMemo(() => [0, 1, 2, 3].map(createCanopyClusterGeometry), []);
  const materials = useMemo(
    () => ["#e2ebdc", "#d8e7d8", "#e5ecdc", "#d4e2d2"].map((color) => new MeshStandardMaterial({
      color,
      emissive: "#1c422d",
      emissiveIntensity: 0.16,
      flatShading: false,
      roughness: 0.98,
      vertexColors: true,
    })),
    [],
  );

  useEffect(
    () => () => {
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
    },
    [geometries, materials],
  );

  return (
    <group name="Continuous Hawaiian rainforest understory mass">
      {materials.map((material, variant) => (
        <CanopyPlacementInstances
          geometry={geometries[variant]}
          key={variant}
          material={material}
          placements={placements.filter((placement) => placement.variant === variant)}
        />
      ))}
    </group>
  );
}

// Kept as an inactive authored fallback while the textured Pachira hero LOD is evaluated.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CanopyTrunkInstances({ placements }: { placements: CanopyPlacement[] }) {
  const ref = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const geometry = useMemo(() => {
    const result = new CylinderGeometry(0.17, 0.29, 4.4, 6, 1);
    result.translate(0, 2.2, 0);
    return result;
  }, []);
  const material = useMemo(
    () => new MeshStandardMaterial({ color: "#4d4436", roughness: 1 }),
    [],
  );

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    placements.forEach((placement, index) => {
      const width = (placement.scaleX + placement.scaleZ) * 0.34;
      dummy.position.set(placement.x, placement.y, placement.z);
      dummy.rotation.set(placement.leanX ?? 0, placement.rotation, placement.leanZ ?? 0);
      dummy.scale.set(width, placement.scaleY, width);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [dummy, placements]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return (
    <instancedMesh
      args={[geometry, material, placements.length]}
      castShadow={false}
      frustumCulled
      receiveShadow={false}
      ref={ref}
    />
  );
}

function CanopyPlacementInstances({
  geometry,
  material,
  placements,
}: {
  geometry: BufferGeometry;
  material: MeshStandardMaterial;
  placements: CanopyPlacement[];
}) {
  const ref = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    placements.forEach((placement, index) => {
      dummy.position.set(placement.x, placement.y, placement.z);
      dummy.rotation.set(placement.leanX ?? 0, placement.rotation, placement.leanZ ?? 0);
      dummy.scale.set(placement.scaleX, placement.scaleY, placement.scaleZ);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, placement.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [dummy, placements]);

  if (placements.length === 0) return null;
  return (
    <instancedMesh
      args={[geometry, material, placements.length]}
      castShadow={false}
      frustumCulled
      ref={ref}
      receiveShadow={false}
    />
  );
}

function makeForestPlacements(count: number) {
  const random = seededRandom(981734);
  const placements: Placement[] = [];
  const maximumAttempts = count * 18;
  for (let attempt = 0; attempt < maximumAttempts && placements.length < count; attempt += 1) {
    const z = 32 - random() ** 0.78 * 226;
    const x = (random() * 2 - 1) * (31 + random() * 92);
    const height = worldSurfaceHeight(x, z);
    const slope = surfaceSlope(x, z);
    const travel = -z;
    const riverCenter = riverAxis(travel);
    const waterClearance = Math.abs(x - riverCenter);
    const openingCorridor = z > -2 && z < 29 && Math.abs(x) < 3.6 + (z - 2) * 0.035;
    const lakeClearance = lakeNormalizedRadius(x, z);
    const cluster = valueNoise(x * 0.052 + 4.3, z * 0.052 - 7.2);
    const treeLine = 39 + valueNoise(x * 0.02, z * 0.02) * 9;
    const tropicalFront = z > -48 && height < 24;
    if (
      height < -0.05 ||
      height > treeLine ||
      slope > 1.38 ||
      openingCorridor ||
      isHeroSightline(x, z) ||
      (lakeClearance < 1.08 && height < 2.1) ||
      (waterClearance < 2.7 && z < -19) ||
      tropicalFront ||
      random() > 0.38 + cluster * 0.66
    ) {
      continue;
    }

    const age = random();
    const scale = 0.54 + age * 0.98 + cluster * 0.26;
    const hue = 0.27 + random() * 0.055;
    const saturation = 0.18 + random() * 0.2;
    const lightness = 0.58 + random() * 0.22 + smoothstep(75, 190, -z) * 0.025;
    placements.push({
      x,
      y: height - 0.08,
      z,
      scale,
      rotation: random() * Math.PI * 2,
      color: new Color().setHSL(hue, saturation, lightness),
      variant: Math.floor(random() * 6),
      leanX: (random() - 0.5) * 0.035,
      leanZ: (random() - 0.5) * 0.035,
    });
  }
  return placements;
}

function ForestCanopy({ tier }: Pick<WorldEcologyProps, "tier">) {
  const count = tier === "high" ? 48 : tier === "balanced" ? 36 : 24;
  const placements = useMemo(() => makeForestPlacements(count), [count]);
  const sourceTextures = useLoader(
    TextureLoader,
    Array.from({ length: 6 }, (_, index) =>
      `/world/v06/impostors/fir-${Math.floor(index / 2) + 1}-${(index % 2) + 1}.png`,
    ),
  );
  const textures = useMemo(
    () => sourceTextures.map((source) => {
      const texture = source.clone();
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 4;
      texture.needsUpdate = true;
      return texture;
    }),
    [sourceTextures],
  );
  const geometry = useMemo(() => createImpostorGeometry(), []);
  const materials = useMemo(
    () => textures.map((texture) => new MeshStandardMaterial({
      alphaTest: 0.31,
      alphaToCoverage: true,
      color: "#dce6d8",
      emissive: "#183020",
      emissiveIntensity: 0.12,
      map: texture,
      roughness: 0.94,
      side: DoubleSide,
      vertexColors: true,
    })),
    [textures],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
    },
    [geometry, materials, textures],
  );

  return (
    <group name="Expanded authored-impostor forest">
      {materials.map((material, variant) => (
        <PlacementInstances
          castShadow={false}
          geometry={geometry}
          key={variant}
          material={material}
          placements={placements.filter((placement) => placement.variant === variant)}
          receiveShadow={false}
        />
      ))}
    </group>
  );
}

function makeTropicalPlacements(count: number) {
  const random = seededRandom(707813);
  const placements: Placement[] = [];
  for (let attempt = 0; attempt < count * 18 && placements.length < count; attempt += 1) {
    const openingBiome = random() < 0.72;
    const z = openingBiome ? 34 - random() * 94 : -46 - random() * 104;
    const travel = -z;
    const center = valleyAxis(travel);
    const x = (openingBiome ? 0 : center) + (random() * 2 - 1) * (openingBiome ? 44 : 66);
    const height = worldSurfaceHeight(x, z);
    const slope = surfaceSlope(x, z);
    const lake = lakeNormalizedRadius(x, z);
    const riverDistance = Math.abs(x - riverAxis(travel));
    const tropicalTreeLine = travel < 145 ? 52 : 37;
    if (
      height < -0.02 ||
      height > tropicalTreeLine ||
      slope > 2.38 ||
      isHeroSightline(x, z) ||
      (lake < 1.08 && height < 2.5) ||
      (z < -70 && riverDistance < 2.5)
    ) {
      continue;
    }
    placements.push({
      x,
      y: height - 0.08,
      z,
      scale: 0.9 + random() * 1.58,
      rotation: random() * Math.PI * 2,
      color: new Color().setHSL(0.27 + random() * 0.055, 0.25 + random() * 0.2, 0.47 + random() * 0.18),
      variant: Math.floor(random() * 8),
      leanX: (random() - 0.5) * 0.075,
      leanZ: (random() - 0.5) * 0.075,
    });
  }
  return placements;
}

function TropicalEmergentCanopy({ mobile, tier }: Pick<WorldEcologyProps, "mobile" | "tier">) {
  const count = mobile ? 120 : tier === "high" ? 160 : tier === "balanced" ? 110 : 70;
  const placements = useMemo(() => makeTropicalPlacements(count), [count]);
  const sourceTextures = useLoader(
    TextureLoader,
    Array.from({ length: 8 }, (_, index) => `/world/v07/impostors/tropical-${index + 1}.png`),
  );
  const textures = useMemo(
    () => sourceTextures.map((source) => {
      const texture = source.clone();
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 4;
      texture.needsUpdate = true;
      return texture;
    }),
    [sourceTextures],
  );
  const geometry = useMemo(() => createImpostorGeometry(), []);
  const materials = useMemo(
    () => textures.map((texture) => new MeshStandardMaterial({
      alphaTest: 0.3,
      alphaToCoverage: true,
      color: "#dde7d8",
      emissive: "#173020",
      emissiveIntensity: 0.13,
      map: texture,
      roughness: 0.92,
      side: DoubleSide,
      vertexColors: true,
    })),
    [textures],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
    },
    [geometry, materials, textures],
  );

  return (
    <group name="Pachira tropical emergent silhouettes">
      {materials.map((material, variant) => (
        <PlacementInstances
          castShadow={false}
          geometry={geometry}
          key={variant}
          material={material}
          placements={placements.filter((placement) => placement.variant === variant)}
          receiveShadow={false}
        />
      ))}
    </group>
  );
}

function makePalmPlacements(count: number) {
  const random = seededRandom(310871);
  const placements: Placement[] = [];
  for (let attempt = 0; attempt < count * 24 && placements.length < count; attempt += 1) {
    const z = 28 - random() ** 0.82 * 154;
    const travel = -z;
    const center = valleyAxis(travel);
    const x = center + (random() * 2 - 1) * (17 + random() * 42);
    const height = worldSurfaceHeight(x, z);
    const slope = surfaceSlope(x, z);
    const lake = lakeNormalizedRadius(x, z);
    const riverDistance = Math.abs(x - riverAxis(travel));
    if (
      height < -0.02 ||
      height > 22 ||
      slope > 1.7 ||
      isHeroSightline(x, z) ||
      (lake < 1.08 && height < 2.5) ||
      (z < -70 && riverDistance < 2.25)
    ) {
      continue;
    }
    placements.push({
      x,
      y: height - 0.06,
      z,
      scale: 0.72 + random() * 1.05,
      rotation: random() * Math.PI * 2,
      color: new Color().setHSL(0.28 + random() * 0.04, 0.24 + random() * 0.2, 0.58 + random() * 0.25),
      variant: Math.floor(random() * 4),
      leanX: (random() - 0.5) * 0.055,
      leanZ: (random() - 0.5) * 0.055,
    });
  }
  return placements;
}

function PalmEmergents({ tier }: Pick<WorldEcologyProps, "tier">) {
  const count = tier === "high" ? 32 : tier === "balanced" ? 24 : 16;
  const placements = useMemo(() => makePalmPlacements(count), [count]);
  const sourceTextures = useLoader(
    TextureLoader,
    Array.from({ length: 4 }, (_, index) => `/world/v07/impostors/palm-${index + 1}.png`),
  );
  const textures = useMemo(
    () => sourceTextures.map((source) => {
      const texture = source.clone();
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 4;
      texture.needsUpdate = true;
      return texture;
    }),
    [sourceTextures],
  );
  const geometry = useMemo(() => createImpostorGeometry(), []);
  const materials = useMemo(
    () => textures.map((texture) => new MeshStandardMaterial({
      alphaTest: 0.29,
      alphaToCoverage: true,
      color: "#dce5d6",
      emissive: "#1a3020",
      emissiveIntensity: 0.12,
      map: texture,
      roughness: 0.92,
      side: DoubleSide,
      vertexColors: true,
    })),
    [textures],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
    },
    [geometry, materials, textures],
  );

  return (
    <group name="Hawaiian palm emergents">
      {materials.map((material, variant) => (
        <PlacementInstances
          castShadow={false}
          geometry={geometry}
          key={variant}
          material={material}
          placements={placements.filter((placement) => placement.variant === variant)}
          receiveShadow={false}
        />
      ))}
    </group>
  );
}

function makeBroadleafPlacements(count: number) {
  const random = seededRandom(427691);
  const placements: Placement[] = [];
  for (let attempt = 0; attempt < count * 18 && placements.length < count; attempt += 1) {
    const z = 24 - random() ** 0.86 * 166;
    const travel = -z;
    const center = valleyAxis(travel);
    const x = center + (random() * 2 - 1) * (11 + random() * 44);
    const height = worldSurfaceHeight(x, z);
    const slope = surfaceSlope(x, z);
    const lakeDistance = lakeNormalizedRadius(x, z);
    const riverDistance = Math.abs(x - riverAxis(travel));
    const cluster = valueNoise(x * 0.061 - 2.7, z * 0.061 + 8.1);
    const revealSightline = z > -35 && z < 18 && Math.abs(x - 1.5) < 8.2;
    if (
      height < -0.02 ||
      height > 17.5 ||
      slope > 1.12 ||
      revealSightline ||
      isHeroSightline(x, z) ||
      lakeDistance < 1.08 ||
      (z < -72 && riverDistance < 2.5) ||
      random() > 0.32 + cluster * 0.72
    ) {
      continue;
    }
    placements.push({
      x,
      y: height - 0.05,
      z,
      scale: 0.52 + random() * 0.56,
      rotation: random() * Math.PI * 2,
      color: new Color().setHSL(0.22 + random() * 0.08, 0.2 + random() * 0.22, 0.56 + random() * 0.25),
      variant: Math.floor(random() * 4),
      leanX: (random() - 0.5) * 0.045,
      leanZ: (random() - 0.5) * 0.045,
    });
  }
  return placements;
}

function BroadleafCanopy({ tier }: Pick<WorldEcologyProps, "tier">) {
  const count = tier === "high" ? 48 : tier === "balanced" ? 34 : 22;
  const placements = useMemo(() => makeBroadleafPlacements(count), [count]);
  const sourceTextures = useLoader(
    TextureLoader,
    Array.from({ length: 4 }, (_, index) => `/world/v06/impostors/broadleaf-${index + 1}.png`),
  );
  const textures = useMemo(
    () => sourceTextures.map((source) => {
      const texture = source.clone();
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 4;
      texture.needsUpdate = true;
      return texture;
    }),
    [sourceTextures],
  );
  const geometry = useMemo(() => createImpostorGeometry(), []);
  const materials = useMemo(
    () => textures.map((texture) => new MeshStandardMaterial({
      alphaTest: 0.32,
      alphaToCoverage: true,
      color: "#e0e8dc",
      emissive: "#1b3020",
      emissiveIntensity: 0.12,
      map: texture,
      roughness: 0.94,
      side: DoubleSide,
      vertexColors: true,
    })),
    [textures],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
    },
    [geometry, materials, textures],
  );

  return (
    <group name="Young broadleaf forest breaks">
      {materials.map((material, variant) => (
        <PlacementInstances
          castShadow={false}
          geometry={geometry}
          key={variant}
          material={material}
          placements={placements.filter((placement) => placement.variant === variant)}
          receiveShadow={false}
        />
      ))}
    </group>
  );
}

function makePachiraSpecimenPlacements(count: number) {
  const random = seededRandom(608221);
  const placements: Placement[] = [];
  const heroSpecimens = [
    [-18.5, 47, 5.8],
    [18, 45, 6.1],
    [-13.5, 40, 6.5],
    [14.2, 38, 6.8],
    [-20.5, 31, 5.2],
    [19.5, 29, 5.6],
    [-12.8, 23, 5.4],
    [13.5, 20, 5.8],
    [-17.5, 11, 4.8],
    [17.2, 8, 5.1],
    [-11.8, -2, 4.6],
    [12.4, -5, 4.9],
    [-15.5, -29, 4.5],
    [18.5, -34, 4.1],
    [-16.5, -59, 3.7],
    [19.5, -61, 4.6],
    [-9.2, -70, 3.5],
    [16.5, -69, 4.2],
    [-10.5, -118, 3.6],
    [18, -126, 4.2],
  ] as const;

  heroSpecimens.forEach(([x, z, scale], index) => {
    if (placements.length >= count) return;
    const height = worldSurfaceHeight(x, z);
    const travel = -z;
    const riverDistance = Math.abs(x - riverAxis(travel));
    if (
      height < -0.02 ||
      height > 34 ||
      lakeNormalizedRadius(x, z) < 1.1 ||
      (z < -70 && riverDistance < 3)
    ) {
      return;
    }
    placements.push({
      x,
      y: height - 0.04,
      z,
      scale: scale * 1.42,
      rotation: (index * 2.399963) % (Math.PI * 2),
      color: new Color().setHSL(0.27 + (index % 4) * 0.014, 0.42, 0.31 + (index % 3) * 0.045),
      variant: index % 4,
      leanX: Math.sin(index * 1.7) * 0.025,
      leanZ: Math.cos(index * 1.3) * 0.025,
    });
  });

  for (let attempt = 0; attempt < count * 26 && placements.length < count; attempt += 1) {
    const nearRidge = random() < 0.66;
    const z = nearRidge ? 38 - random() * 112 : -58 - random() * 111;
    const travel = -z;
    const center = valleyAxis(travel);
    const x = (nearRidge ? -1.5 : center) + (random() * 2 - 1) * (nearRidge ? 38 : 57);
    const height = worldSurfaceHeight(x, z);
    const slope = surfaceSlope(x, z);
    const lake = lakeNormalizedRadius(x, z) < 1.08;
    const riverDistance = Math.abs(x - riverAxis(travel));
    const cluster = valueNoise(x * 0.063 + 3.4, z * 0.063 - 7.9);
    if (
      height < -0.02 ||
      height > 31 ||
      slope > 1.45 ||
      lake ||
      (z < -70 && riverDistance < 2.7) ||
      random() > 0.42 + cluster * 0.56
    ) {
      continue;
    }
    placements.push({
      x,
      y: height - 0.04,
      z,
      scale: 4.2 + random() * 4.2,
      rotation: random() * Math.PI * 2,
      color: new Color().setHSL(
        0.255 + random() * 0.08,
        0.22 + random() * 0.25,
        0.3 + random() * 0.14,
      ),
      variant: Math.floor(random() * 4),
      leanX: (random() - 0.5) * 0.075,
      leanZ: (random() - 0.5) * 0.075,
    });
  }
  return placements;
}

// Retained as a source-quality comparison; v1.9 mounts the bounded authored LOD below.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PachiraSpecimens({ mobile, shadows, tier }: Pick<WorldEcologyProps, "mobile" | "shadows" | "tier">) {
  const pachira = useLoader(GLTFLoader, `${ECOLOGY_ROOT}/pachira_aquatica_01/pachira_aquatica_01_1k.gltf`);
  const barkMeshes = useMemo(
    () => [getMesh(pachira.scene, "pachira_aquatica_01_bark_b")],
    [pachira],
  );
  const leafMeshes = useMemo(
    () => [getMesh(pachira.scene, "pachira_aquatica_01_leaves_b")],
    [pachira],
  );
  const barkMaterials = useMemo(
    () => barkMeshes.map((mesh) => materialFromMesh(mesh, "#d7c2a9")),
    [barkMeshes],
  );
  const leafMaterials = useMemo(
    () => leafMeshes.map((mesh) => {
      const material = materialFromMesh(mesh, "#a9c6a0");
      material.emissive.set("#16301d");
      material.emissiveIntensity = 0.09;
      material.metalness = 0;
      material.normalScale.set(0.28, 0.28);
      material.roughness = 0.98;
      material.roughnessMap = null;
      return material;
    }),
    [leafMeshes],
  );
  const count = mobile ? 8 : tier === "high" ? 32 : tier === "balanced" ? 22 : 12;
  const placements = useMemo(
    () => makePachiraSpecimenPlacements(count).map((placement) => ({ ...placement, variant: 0 })),
    [count],
  );
  const barkPlacements = useMemo(
    () => placements.map((placement) => ({ ...placement, color: new Color("#846b57") })),
    [placements],
  );

  useEffect(
    () => () => {
      [...barkMeshes, ...leafMeshes].forEach((mesh) => mesh.geometry.dispose());
      [...barkMaterials, ...leafMaterials].forEach((material) => material.dispose());
    },
    [barkMaterials, barkMeshes, leafMaterials, leafMeshes],
  );

  return (
    <group name="Near-field linked Pachira specimens">
      {barkMeshes.map((mesh, variant) => (
        <PlacementInstances
          castShadow={shadows}
          geometry={mesh.geometry}
          key={`pachira-bark-${variant}`}
          material={barkMaterials[variant]}
          placements={barkPlacements.filter((placement) => placement.variant === variant)}
          receiveShadow={shadows}
        />
      ))}
      {leafMeshes.map((mesh, variant) => (
        <PlacementInstances
          castShadow={shadows}
          geometry={mesh.geometry}
          key={`pachira-leaves-${variant}`}
          material={leafMaterials[variant]}
          placements={placements.filter((placement) => placement.variant === variant)}
          receiveShadow={shadows}
        />
      ))}
    </group>
  );
}

function AuthoredHeroTrees({ mobile, shadows, tier }: Pick<WorldEcologyProps, "mobile" | "shadows" | "tier">) {
  const count = mobile ? 8 : tier === "high" ? 28 : tier === "balanced" ? 20 : 12;
  const tree = useLoader(GLTFLoader, "/world/v19/madagin-tropical-tree-v1.9.glb?v=19b");
  const parts = useMemo(() => {
    const next: Array<{ geometry: BufferGeometry; material: MeshStandardMaterial }> = [];
    tree.scene.updateMatrixWorld(true);
    tree.scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const sourceMaterial = Array.isArray(object.material) ? object.material[0] : object.material;
      if (!(sourceMaterial instanceof MeshStandardMaterial)) return;
      const geometry = object.geometry.clone();
      geometry.applyMatrix4(object.matrixWorld);
      const material = sourceMaterial.clone();
      material.envMapIntensity = 0.14;
      material.metalness = 0;
      material.roughness = 0.98;
      material.color.set(
        sourceMaterial.name.toLowerCase().includes("foliage") ? "#173c27" : "#423021",
      );
      next.push({ geometry, material });
    });
    if (next.length === 0) throw new Error("Missing authored tropical tree primitives");
    return next;
  }, [tree.scene]);
  const placements = useMemo(
    () => makePachiraSpecimenPlacements(count).map((placement) => ({
      ...placement,
      scale: placement.scale * 0.145,
    })),
    [count],
  );
  useEffect(
    () => () => {
      parts.forEach(({ geometry, material }) => {
        geometry.dispose();
        material.dispose();
      });
    },
    [parts],
  );

  return (
    <group name="Madagin authored tropical trees v1.9">
      {parts.map(({ geometry, material }, index) => (
        <PlacementInstances
          castShadow={shadows}
          geometry={geometry}
          instanceColors={false}
          key={`authored-tropical-tree-part-${index}`}
          material={material}
          placements={placements}
          receiveShadow={shadows}
        />
      ))}
    </group>
  );
}

function PlacementInstances({
  castShadow,
  geometry,
  instanceColors = true,
  material,
  placements,
  receiveShadow,
}: {
  castShadow: boolean;
  geometry: BufferGeometry;
  instanceColors?: boolean;
  material: MeshStandardMaterial;
  placements: Placement[];
  receiveShadow: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    placements.forEach((placement, index) => {
      dummy.position.set(placement.x, placement.y, placement.z);
      dummy.rotation.set(placement.leanX ?? 0, placement.rotation, placement.leanZ ?? 0);
      dummy.scale.setScalar(placement.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      if (instanceColors) mesh.setColorAt(index, placement.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [dummy, instanceColors, placements]);

  if (placements.length === 0) return null;
  return (
    <instancedMesh
      args={[geometry, material, placements.length]}
      castShadow={castShadow}
      frustumCulled
      ref={ref}
      receiveShadow={receiveShadow}
    />
  );
}

function createTuftGeometry() {
  const positions: number[] = [];
  const indices: number[] = [];
  const bladeCount = 8;
  for (let blade = 0; blade < bladeCount; blade += 1) {
    const angle = (blade / bladeCount) * Math.PI * 2 + Math.sin(blade * 2.17) * 0.24;
    const radialX = Math.cos(angle);
    const radialZ = Math.sin(angle);
    const tangentX = -radialZ;
    const tangentZ = radialX;
    const radius = 0.035 + (blade % 3) * 0.018;
    const width = 0.035 + (blade % 4) * 0.012;
    const height = 0.38 + (blade % 5) * 0.085;
    const lean = 0.08 + (blade % 3) * 0.035;
    const centerX = radialX * radius;
    const centerZ = radialZ * radius;
    const start = positions.length / 3;
    positions.push(
      centerX - tangentX * width, 0, centerZ - tangentZ * width,
      centerX + tangentX * width, 0, centerZ + tangentZ * width,
      centerX + radialX * lean, height, centerZ + radialZ * lean,
    );
    indices.push(start, start + 1, start + 2);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createUnderstoryCardGeometry(width: number, height: number) {
  const front = new PlaneGeometry(width, height, 1, 1);
  front.translate(0, height * 0.5, 0);
  const side = front.clone();
  side.rotateY(Math.PI / 2);
  const merged = mergeGeometries([front, side], false);
  front.dispose();
  side.dispose();
  if (!merged) throw new Error("Unable to build the understory impostor cluster");
  merged.computeBoundingSphere();
  return merged;
}

function makeGroundPlacements(count: number, seed: number, variants: number, scale: [number, number]) {
  const random = seededRandom(seed);
  const placements: Placement[] = [];
  for (let attempt = 0; attempt < count * 14 && placements.length < count; attempt += 1) {
    const nearField = random() < 0.76;
    const z = nearField ? 36 - random() * 128 : -78 - random() * 92;
    const x = (random() * 2 - 1) * (nearField ? 18 + random() * 34 : 30 + random() * 52);
    const height = worldSurfaceHeight(x, z);
    const slope = surfaceSlope(x, z);
    const centralTrail = z > 1 && Math.abs(x) < 1.7 + random() * 1.6;
    const lake = lakeNormalizedRadius(x, z) < 1.06;
    const stream = z < -72 && z > -154 && Math.abs(x - riverAxis(-z)) < 2.35;
    if (height < -0.02 || slope > 1.05 || centralTrail || lake || stream) continue;
    const size = mix(scale[0], scale[1], random());
    placements.push({
      x,
      y: height + 0.025,
      z,
      scale: size,
      rotation: random() * Math.PI * 2,
      color: new Color().setHSL(0.25 + random() * 0.08, 0.18 + random() * 0.22, 0.54 + random() * 0.27),
      variant: Math.floor(random() * variants),
      leanX: (random() - 0.5) * 0.08,
      leanZ: (random() - 0.5) * 0.08,
    });
  }
  return placements;
}

function ProceduralGroundLayer({ shadows, tier, zone }: Pick<WorldEcologyProps, "shadows" | "tier" | "zone">) {
  const active = zone !== "summit";
  const tuftCount = active
    ? tier === "high" ? 2800 : tier === "balanced" ? 1700 : 760
    : tier === "high" ? 220 : tier === "balanced" ? 120 : 60;
  const stoneCount = active
    ? tier === "high" ? 150 : tier === "balanced" ? 92 : 42
    : tier === "high" ? 84 : tier === "balanced" ? 52 : 28;
  const tuftGeometry = useMemo(() => createTuftGeometry(), []);
  const stoneGeometry = useMemo(() => {
    const geometry = new DodecahedronGeometry(0.34, 0);
    geometry.scale(1.35, 0.62, 1);
    return geometry;
  }, []);
  const tuftMaterial = useMemo(
    () => new MeshStandardMaterial({
      color: zone === "summit" ? "#7d806d" : "#4f6d47",
      emissive: "#102017",
      emissiveIntensity: 0.08,
      roughness: 1,
      side: DoubleSide,
      vertexColors: true,
    }),
    [zone],
  );
  const stoneMaterial = useMemo(
    () => new MeshStandardMaterial({
      color: zone === "waterfall" ? "#39413e" : "#636b61",
      roughness: 0.99,
      vertexColors: true,
    }),
    [zone],
  );
  const tuftPlacements = useMemo(
    () => makeGroundPlacements(tuftCount, 219743, 1, zone === "summit" ? [0.32, 0.68] : [0.46, 1.32]),
    [tuftCount, zone],
  );
  const stonePlacements = useMemo(
    () => makeGroundPlacements(stoneCount, 580123, 1, zone === "summit" ? [0.5, 1.55] : [0.32, 1.08]),
    [stoneCount, zone],
  );

  useEffect(
    () => () => {
      tuftGeometry.dispose();
      stoneGeometry.dispose();
      tuftMaterial.dispose();
      stoneMaterial.dispose();
    },
    [stoneGeometry, stoneMaterial, tuftGeometry, tuftMaterial],
  );

  return (
    <group name={`Bounded procedural ${zone} ground ecology`}>
      <PlacementInstances
        castShadow={false}
        geometry={tuftGeometry}
        material={tuftMaterial}
        placements={tuftPlacements}
        receiveShadow={shadows}
      />
      <PlacementInstances
        castShadow={shadows}
        geometry={stoneGeometry}
        material={stoneMaterial}
        placements={stonePlacements}
        receiveShadow={shadows}
      />
      {active ? <FallenDeadwood shadows={shadows} tier={tier} /> : null}
    </group>
  );
}

function makeUnderstoryPlacements(count: number, seed: number, scale: [number, number]) {
  const random = seededRandom(seed);
  const placements: Placement[] = [];
  for (let attempt = 0; attempt < count * 22 && placements.length < count; attempt += 1) {
    const opening = random() < 0.73;
    const z = opening ? 43 - random() ** 0.9 * 142 : -76 - random() ** 0.86 * 108;
    const travel = -z;
    const center = valleyAxis(travel);
    const x = (opening ? -4 : center) + (random() * 2 - 1) * (opening ? 58 : 78);
    const height = worldSurfaceHeight(x, z);
    const slope = surfaceSlope(x, z);
    const lake = lakeNormalizedRadius(x, z) < 1.08;
    const stream = z < -70 && z > -158 && Math.abs(x - riverAxis(travel)) < 2.55;
    const moisture = valueNoise(x * 0.045 + 7.8, z * 0.045 - 3.1);
    const exposedRock = valueNoise(x * 0.092 - 4.1, z * 0.092 + 6.4);
    if (
      height < -0.02 ||
      height > 40 ||
      slope > 2.45 ||
      isHeroSightline(x, z) ||
      lake ||
      stream ||
      random() > 0.58 + moisture * 0.34 - exposedRock * 0.12
    ) {
      continue;
    }
    const size = mix(scale[0], scale[1], random()) * (0.88 + moisture * 0.32);
    placements.push({
      x,
      y: height - 0.015,
      z,
      scale: size,
      rotation: random() * Math.PI * 2,
      color: new Color().setHSL(
        0.245 + random() * 0.085,
        0.18 + moisture * 0.2,
        0.54 + random() * 0.26,
      ),
      variant: 0,
      leanX: (random() - 0.5) * 0.075,
      leanZ: (random() - 0.5) * 0.075,
    });
  }
  return placements;
}

function materialFromMesh(mesh: Mesh, color: string, alphaMap?: Texture) {
  const source = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (!(source instanceof MeshStandardMaterial)) {
    return new MeshStandardMaterial({ color, roughness: 0.95, vertexColors: true });
  }
  const material = source.clone();
  material.color.multiply(new Color(color));
  material.roughness = Math.max(0.88, material.roughness);
  material.vertexColors = true;
  material.side = DoubleSide;
  material.emissive.set("#182116");
  material.emissiveIntensity = 0.28;
  material.alphaMap = alphaMap ?? material.alphaMap;
  material.alphaTest = alphaMap ? 0.34 : Math.max(0.24, material.alphaTest);
  if (material.map) material.map.colorSpace = SRGBColorSpace;
  material.needsUpdate = true;
  return material;
}

function getMesh(scene: Object3D, name: string) {
  scene.updateMatrixWorld(true);
  const object = scene.getObjectByName(name);
  if (!(object instanceof Mesh)) throw new Error(`Missing ecology mesh ${name}`);
  const clone = object.clone(false);
  clone.geometry = object.geometry.clone();
  const transform = object.matrixWorld.clone();
  transform.setPosition(0, 0, 0);
  clone.geometry.applyMatrix4(transform);
  clone.position.set(0, 0, 0);
  clone.rotation.set(0, 0, 0);
  clone.scale.set(1, 1, 1);
  clone.updateMatrix();
  return clone;
}

// Kept for side-by-side payload comparisons; v1.9 does not mount this texture-heavy path.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function GroundEcology({ shadows, tier }: Pick<WorldEcologyProps, "shadows" | "tier">) {
  const fern = useLoader(GLTFLoader, `${ECOLOGY_ROOT}/fern_02/fern_02_1k.gltf`);
  const shrub = useLoader(GLTFLoader, `${ECOLOGY_ROOT}/shrub_04/shrub_04_1k.gltf`);
  const moss = useLoader(GLTFLoader, `${ECOLOGY_ROOT}/moss_01/moss_01_1k.gltf`);
  const mossRocks = useLoader(GLTFLoader, `${ECOLOGY_ROOT}/rock_moss_set_02/rock_moss_set_02_1k.gltf`);
  const sourceAlphaMaps = useLoader(TextureLoader, [
    `${ECOLOGY_ROOT}/fern_02/textures/fern_02_alpha_1k.png`,
    `${ECOLOGY_ROOT}/shrub_04/textures/shrub_04_alpha_1k.png`,
    `${ECOLOGY_ROOT}/moss_01/textures/moss_01_alpha_1k.png`,
  ]);
  const alphaMaps = useMemo(
    () => sourceAlphaMaps.map((source) => {
      const texture = source.clone();
      texture.flipY = false;
      texture.needsUpdate = true;
      return texture;
    }),
    [sourceAlphaMaps],
  );
  const fernMeshes = useMemo(
    () => ["fern_02_a", "fern_02_b", "fern_02_c", "fern_02_d"].map((name) => getMesh(fern.scene, name)),
    [fern],
  );
  const shrubMeshes = useMemo(() => [getMesh(shrub.scene, "shrub_04")], [shrub]);
  const mossMeshes = useMemo(
    () => ["moss_01_a_LOD0", "moss_01_c_LOD0", "moss_01_f_LOD0", "moss_01_j_LOD0"].map((name) => getMesh(moss.scene, name)),
    [moss],
  );
  const rockMeshes = useMemo(
    () => [
      "rock_moss_set_02_rock07",
      "rock_moss_set_02_rock08",
      "rock_moss_set_02_rock09",
      "rock_moss_set_02_rock10",
      "rock_moss_set_02_rock11",
      "rock_moss_set_02_rock12",
      "rock_moss_set_02_rock13",
    ].map((name) => getMesh(mossRocks.scene, name)),
    [mossRocks],
  );
  const materials = useMemo(
    () => ({
      fern: materialFromMesh(fernMeshes[0], "#78936d", alphaMaps[0]),
      shrub: materialFromMesh(shrubMeshes[0], "#6f8965", alphaMaps[1]),
      moss: materialFromMesh(mossMeshes[0], "#748260", alphaMaps[2]),
      rock: materialFromMesh(rockMeshes[0], "#929b82"),
    }),
    [alphaMaps, fernMeshes, mossMeshes, rockMeshes, shrubMeshes],
  );
  const counts = tier === "high"
    ? { fern: 300, shrub: 18, moss: 520, rock: 50, tuft: 7000, fernCard: 0, shrubCard: 0 }
    : tier === "balanced"
      ? { fern: 180, shrub: 12, moss: 300, rock: 32, tuft: 3800, fernCard: 0, shrubCard: 0 }
      : { fern: 72, shrub: 6, moss: 120, rock: 16, tuft: 1200, fernCard: 0, shrubCard: 0 };
  const fernPlacements = useMemo(
    () => makeGroundPlacements(counts.fern, 85111, fernMeshes.length, [0.45, 1.18]),
    [counts.fern, fernMeshes.length],
  );
  const shrubPlacements = useMemo(
    () => makeGroundPlacements(counts.shrub, 51429, shrubMeshes.length, [0.38, 0.92]),
    [counts.shrub, shrubMeshes.length],
  );
  const mossPlacements = useMemo(
    () => makeGroundPlacements(counts.moss, 17231, mossMeshes.length, [0.65, 1.9]),
    [counts.moss, mossMeshes.length],
  );
  const rockPlacements = useMemo(
    () => makeGroundPlacements(counts.rock, 73103, rockMeshes.length, [0.34, 1.25]),
    [counts.rock, rockMeshes.length],
  );
  const tuftGeometry = useMemo(() => createTuftGeometry(), []);
  const tuftMaterial = useMemo(
    () => new MeshStandardMaterial({
      color: "#637b59",
      emissive: "#122116",
      emissiveIntensity: 0.16,
      roughness: 0.98,
      side: DoubleSide,
      vertexColors: true,
    }),
    [],
  );
  const tuftPlacements = useMemo(
    () => makeGroundPlacements(counts.tuft, 92741, 1, [0.38, 1.24]),
    [counts.tuft],
  );
  const fernCardGeometry = useMemo(() => createUnderstoryCardGeometry(1.75, 0.92), []);
  const shrubCardGeometry = useMemo(() => createUnderstoryCardGeometry(2.6, 1.52), []);
  const fernCardPlacements = useMemo(
    () => makeUnderstoryPlacements(counts.fernCard, 304331, [0.48, 1.22]),
    [counts.fernCard],
  );
  const shrubCardPlacements = useMemo(
    () => makeUnderstoryPlacements(counts.shrubCard, 794117, [0.44, 1.08]),
    [counts.shrubCard],
  );

  useEffect(
    () => () => {
      Object.values(materials).forEach((material) => material.dispose());
      alphaMaps.forEach((texture) => texture.dispose());
      [...fernMeshes, ...shrubMeshes, ...mossMeshes, ...rockMeshes].forEach((mesh) => mesh.geometry.dispose());
      tuftGeometry.dispose();
      tuftMaterial.dispose();
      fernCardGeometry.dispose();
      shrubCardGeometry.dispose();
    },
    [
      alphaMaps,
      fernCardGeometry,
      fernMeshes,
      materials,
      mossMeshes,
      rockMeshes,
      shrubCardGeometry,
      shrubMeshes,
      tuftGeometry,
      tuftMaterial,
    ],
  );

  return (
    <group name="Layered ridge-floor ecology">
      <VariantScatter material={materials.fern} meshes={fernMeshes} placements={fernPlacements} shadows={shadows} />
      <VariantScatter material={materials.shrub} meshes={shrubMeshes} placements={shrubPlacements} shadows={shadows} />
      <VariantScatter material={materials.moss} meshes={mossMeshes} placements={mossPlacements} shadows={false} />
      <VariantScatter material={materials.rock} meshes={rockMeshes} placements={rockPlacements} shadows={shadows} />
      <PlacementInstances
        castShadow={false}
        geometry={fernCardGeometry}
        material={materials.fern}
        placements={fernCardPlacements}
        receiveShadow={false}
      />
      <PlacementInstances
        castShadow={false}
        geometry={shrubCardGeometry}
        material={materials.shrub}
        placements={shrubCardPlacements}
        receiveShadow={false}
      />
      <PlacementInstances
        castShadow={false}
        geometry={tuftGeometry}
        material={tuftMaterial}
        placements={tuftPlacements}
        receiveShadow={shadows}
      />
      <FallenDeadwood shadows={shadows} tier={tier} />
    </group>
  );
}

function VariantScatter({
  material,
  meshes,
  placements,
  shadows,
}: {
  material: MeshStandardMaterial;
  meshes: Mesh[];
  placements: Placement[];
  shadows: boolean;
}) {
  return meshes.map((mesh, variant) => (
    <PlacementInstances
      castShadow={shadows}
      geometry={mesh.geometry}
      key={mesh.uuid}
      material={material}
      placements={placements.filter((placement) => placement.variant === variant)}
      receiveShadow={shadows}
    />
  ));
}

function FallenDeadwood({ shadows, tier }: Pick<WorldEcologyProps, "shadows" | "tier">) {
  const count = tier === "high" ? 46 : tier === "balanced" ? 28 : 14;
  const ref = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => new CylinderGeometry(0.09, 0.13, 1, 7, 1), []);
  const material = useMemo(
    () => new MeshStandardMaterial({ color: "#554535", roughness: 1 }),
    [],
  );
  const placements = useMemo(() => {
    const random = seededRandom(55283);
    const result: Array<{
      x: number;
      y: number;
      z: number;
      angle: number;
      length: number;
      thickness: number;
      color: Color;
    }> = [];
    for (let attempt = 0; attempt < count * 20 && result.length < count; attempt += 1) {
      const x = (random() * 2 - 1) * 35;
      const z = 31 - random() * 101;
      if (lakeNormalizedRadius(x, z) < 1.12 || surfaceSlope(x, z) > 1.35) continue;
      result.push({
        x,
        y: worldSurfaceHeight(x, z) + 0.13,
        z,
        angle: random() * Math.PI * 2,
        length: 1.1 + random() * 2.7,
        thickness: 0.62 + random() * 0.82,
        color: new Color().setHSL(0.07 + random() * 0.035, 0.22, 0.24 + random() * 0.16),
      });
    }
    return result;
  }, [count]);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new Object3D();
    const up = new Vector3(0, 1, 0);
    placements.forEach((placement, index) => {
      const direction = new Vector3(Math.cos(placement.angle), 0.06, Math.sin(placement.angle)).normalize();
      dummy.position.set(placement.x, placement.y, placement.z);
      dummy.quaternion.setFromUnitVectors(up, direction);
      dummy.scale.set(placement.thickness, placement.length, placement.thickness);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, placement.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [placements]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return (
    <instancedMesh
      args={[geometry, material, count]}
      castShadow={shadows}
      ref={ref}
      receiveShadow={shadows}
    />
  );
}

function makeGeologyPlacements(count: number, waterfall: boolean) {
  const random = seededRandom(991703);
  const placements: Placement[] = [];
  const ridgeOutcrops = [
    [-15.8, 14.2, 2.75, -0.16, 0.12],
    [-12.4, 10.5, 1.65, 0.08, -0.18],
    [-9.6, 17.1, 2.2, -0.12, 0.2],
    [-6.8, 8.6, 1.48, 0.18, -0.08],
    [-4.7, 15.6, 2.05, -0.18, 0.1],
    [-2.9, 7.4, 1.1, 0.09, 0.12],
    [3.6, 7.8, 1.25, -0.1, -0.08],
    [5.8, 15.2, 2.35, 0.16, -0.12],
    [8.3, 9.4, 1.7, -0.08, 0.18],
    [10.8, 17.3, 2.45, 0.12, -0.14],
    [13.6, 11.2, 1.8, -0.14, 0.08],
    [16.2, 14.9, 2.9, 0.18, 0.14],
  ] as const;
  ridgeOutcrops.slice(0, Math.min(ridgeOutcrops.length, Math.max(6, Math.floor(count * 0.15)))).forEach(
    ([x, z, scale, leanX, leanZ], index) => {
      placements.push({
        x,
        y: worldSurfaceHeight(x, z) - scale * 0.2,
        z,
        scale,
        rotation: (index * 2.399963 + 0.42) % (Math.PI * 2),
        color: new Color().setHSL(0.17 + (index % 4) * 0.008, 0.035, 0.5 + (index % 3) * 0.055),
        variant: 0,
        leanX,
        leanZ,
      });
    },
  );
  const waterfallCount = waterfall ? Math.min(58, Math.max(28, Math.floor(count * 0.56))) : 0;
  const waterfallBottom = worldSurfaceHeight(4.8, -76.2) - 0.38;
  const waterfallTop = Math.max(worldSurfaceHeight(4.8, -84.2, true), waterfallBottom + 7.5);
  for (let index = 0; index < waterfallCount; index += 1) {
    const poolStone = index < Math.floor(waterfallCount * 0.3);
    const midLedge = !poolStone && index < Math.floor(waterfallCount * 0.64);
    const side = index % 2 === 0 ? -1 : 1;
    const scale = poolStone
        ? 0.65 + random() * 1.05
        : midLedge
        ? 1.9 + random() * 1.55
        : 0.9 + random() * 1.75;
    placements.push({
      x: poolStone
        ? 4.8 + (random() * 2 - 1) * 5.8
        : midLedge
          ? 4.8 + (random() * 2 - 1) * 3.25
        : 4.8 + side * (2.4 + random() * 4.2),
      y: poolStone
        ? waterfallBottom - scale * 0.12 + random() * 0.48
        : midLedge
          ? mix(waterfallBottom, waterfallTop, 0.46 + random() * 0.18) + (random() - 0.5) * 0.48
        : waterfallBottom + random() * (waterfallTop - waterfallBottom) - scale * 0.08,
      z: poolStone
        ? -76.7 + (random() * 2 - 1) * 2.9
        : midLedge
          ? -79.1 + (random() - 0.5) * 0.58
        : -80.5 + (random() - 0.5) * 1.45,
      scale,
      rotation: random() * Math.PI * 2,
      color: new Color().setHSL(0.17 + random() * 0.035, 0.025 + random() * 0.04, 0.44 + random() * 0.2),
      variant: 0,
      leanX: (random() - 0.5) * 0.52,
      leanZ: (random() - 0.5) * 0.52,
    });
  }
  for (let attempt = 0; attempt < count * 28 && placements.length < count; attempt += 1) {
    const zone = random();
    let x: number;
    let z: number;
    if (zone < 0.38) {
      z = 31 - random() * 83;
      x = (random() * 2 - 1) * (14 + random() * 31);
    } else if (zone < 0.72) {
      z = -34 - random() * 172;
      const travel = -z;
      const center = valleyAxis(travel);
      x = center + (random() < 0.5 ? -1 : 1) * (22 + random() * 73);
    } else {
      z = 45 - random() * 248;
      x = coastlineAt(z) + 1.2 + random() * 15;
    }

    const height = worldSurfaceHeight(x, z);
    const slope = surfaceSlope(x, z);
    const coastDistance = Math.abs(x - coastlineAt(z));
    const exposed = valueNoise(x * 0.074 + 9.2, z * 0.074 - 2.8);
    const lake = lakeNormalizedRadius(x, z) < 1.08;
    if (
      height < -0.05 ||
      lake ||
      (slope < 0.22 && coastDistance > 8.5 && exposed < 0.66) ||
      slope > 3.4
    ) {
      continue;
    }

    const scale = 0.58 + random() ** 1.6 * 2.9 + Math.min(1.8, slope * 0.42);
    placements.push({
      x,
      y: height - 0.12 * scale,
      z,
      scale,
      rotation: random() * Math.PI * 2,
      color: new Color().setHSL(
        0.17 + random() * 0.04,
        0.025 + random() * 0.035,
        0.58 + random() * 0.24,
      ),
      variant: 0,
      leanX: (random() - 0.5) * 0.34,
      leanZ: (random() - 0.5) * 0.34,
    });
  }
  return placements;
}

// Kept for side-by-side payload comparisons; authored v1.9 zone geology owns the live path.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function GeologyScatter({
  mobile,
  shadows,
  tier,
  waterfall,
}: Pick<WorldEcologyProps, "mobile" | "shadows" | "tier"> & { waterfall: boolean }) {
  const rock = useLoader(GLTFLoader, `${ECOLOGY_ROOT}/rock_09/rock_09_1k.gltf`);
  const mesh = useMemo(() => getMesh(rock.scene, "rock_09_LOD0"), [rock]);
  const material = useMemo(() => {
    const result = materialFromMesh(mesh, "#dce0d7");
    result.emissive.set("#303a33");
    result.emissiveIntensity = 0.42;
    return result;
  }, [mesh]);
  const count = mobile ? 24 : tier === "high" ? 104 : tier === "balanced" ? 58 : 24;
  const placements = useMemo(() => makeGeologyPlacements(count, waterfall), [count, waterfall]);

  useEffect(
    () => () => {
      mesh.geometry.dispose();
      material.dispose();
    },
    [material, mesh],
  );

  return (
    <group name="Photogrammetry basalt and weathered outcrops">
      <PlacementInstances
        castShadow={shadows}
        geometry={mesh.geometry}
        material={material}
        placements={placements}
        receiveShadow={shadows}
      />
    </group>
  );
}

function createLakeGeometry(tier: WorldQualityTier) {
  const angularSegments = tier === "high" ? 96 : tier === "balanced" ? 72 : 52;
  const radialSegments = tier === "high" ? 16 : tier === "balanced" ? 12 : 9;
  const positions: number[] = [LAKE_CENTER_X, 0.035, LAKE_CENTER_Z];
  const uvs: number[] = [0.5, 0.5];
  const indices: number[] = [];

  for (let ring = 1; ring <= radialSegments; ring += 1) {
    const radius = ring / radialSegments;
    for (let segment = 0; segment < angularSegments; segment += 1) {
      const angle = (segment / angularSegments) * Math.PI * 2;
      const edge = lakeBoundaryPoint(angle, 0.985);
      const x = mix(LAKE_CENTER_X, edge.x, radius);
      const z = mix(LAKE_CENTER_Z, edge.y, radius);
      positions.push(x, 0.035, z);
      uvs.push(
        0.5 + (x - LAKE_CENTER_X) / (LAKE_RADIUS_X * 2),
        0.5 + (z - LAKE_CENTER_Z) / (LAKE_RADIUS_Z * 2),
      );
    }
  }

  for (let segment = 0; segment < angularSegments; segment += 1) {
    indices.push(0, 1 + ((segment + 1) % angularSegments), 1 + segment);
  }
  for (let ring = 1; ring < radialSegments; ring += 1) {
    const innerStart = 1 + (ring - 1) * angularSegments;
    const outerStart = 1 + ring * angularSegments;
    for (let segment = 0; segment < angularSegments; segment += 1) {
      const next = (segment + 1) % angularSegments;
      const innerCurrent = innerStart + segment;
      const innerNext = innerStart + next;
      const outerCurrent = outerStart + segment;
      const outerNext = outerStart + next;
      indices.push(innerCurrent, outerNext, outerCurrent, innerCurrent, innerNext, outerNext);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createStreamGeometry(waterfall: boolean) {
  const rows = 62;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row < rows; row += 1) {
    const progress = row / (rows - 1);
    const z = mix(-154, -84.2, progress);
    const travel = -z;
    const center = riverAxis(travel) + Math.sin(progress * 16.1) * 0.24;
    const width = 0.2 + Math.sin(progress * 5.2 + 0.8) * 0.055 + progress * 0.11;
    const surface = worldSurfaceHeight(center, z, waterfall) + 0.055;
    positions.push(center - width, surface, z, center + width, surface, z);
    uvs.push(0, progress * 8, 1, progress * 8);
    if (row < rows - 1) {
      const base = row * 2;
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createRiverToLakeGeometry() {
  const rows = 28;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row < rows; row += 1) {
    const progress = row / (rows - 1);
    const z = mix(-76.2, -69.5, progress);
    const center = mix(4.8, 3.4, progress) + Math.sin(progress * 9.8) * 0.22;
    const width = 1.15 + progress * 0.72 + Math.sin(progress * 8.2) * 0.12;
    const surface = mix(worldSurfaceHeight(center, -76.2) + 0.055, 0.02, progress);
    positions.push(center - width, surface, z, center + width, surface, z);
    uvs.push(0, progress * 2.4, 1, progress * 2.4);
    if (row < rows - 1) {
      const base = row * 2;
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createWaterfallGeometry() {
  const columns = 24;
  const rows = 46;
  const bottom = worldSurfaceHeight(4.8, -76.2) + 0.16;
  const top = Math.max(worldSurfaceHeight(4.8, -84.2, true) + 0.08, bottom + 8.5);
  const positions: number[] = [];
  const uvs: number[] = [];
  const phases: number[] = [];
  const indices: number[] = [];

  for (let row = 0; row <= rows; row += 1) {
    const progress = row / rows;
    const y = mix(top, bottom, progress);
    const halfWidth = 0.92 + progress * 0.5 + Math.sin(progress * 9.2 + 0.4) * 0.11;
    const center = 4.8 + Math.sin(progress * 5.7 + 0.3) * 0.19 + Math.sin(progress * 17.0) * 0.045;
    for (let column = 0; column <= columns; column += 1) {
      const horizontal = column / columns;
      const across = horizontal * 2 - 1;
      const thread = Math.sin(column * 1.83 + progress * 17.0) * 0.034;
      const brokenEdge = 0.9 + Math.sin(progress * 13.0 + across * 3.1) * 0.055;
      const z = -80.49 + progress * 0.92 + Math.sin(progress * 5.4 + across * 2.2) * 0.065 + thread;
      positions.push(center + across * halfWidth * brokenEdge, y, z);
      uvs.push(horizontal, progress);
      phases.push(horizontal * Math.PI * 7.0 + Math.sin(column * 1.17) * 0.7);
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const stride = columns + 1;
      const a = row * stride + column;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("fallPhase", new Float32BufferAttribute(phases, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createImpactPoolGeometry(tier: WorldQualityTier) {
  const angularSegments = tier === "high" ? 56 : tier === "balanced" ? 40 : 28;
  const radialSegments = tier === "high" ? 7 : tier === "balanced" ? 5 : 4;
  const centerX = 4.8;
  const centerZ = -76.15;
  const surface = worldSurfaceHeight(centerX, -76.2) + 0.12;
  const positions: number[] = [centerX, surface, centerZ];
  const uvs: number[] = [0.5, 0.5];
  const indices: number[] = [];

  for (let ring = 1; ring <= radialSegments; ring += 1) {
    const radius = ring / radialSegments;
    for (let segment = 0; segment < angularSegments; segment += 1) {
      const angle = (segment / angularSegments) * Math.PI * 2;
      const edgeVariation = 0.88 + Math.sin(angle * 3 + 0.4) * 0.11 + Math.sin(angle * 7 - 1.2) * 0.055;
      const x = centerX + Math.cos(angle) * 4.2 * edgeVariation * radius;
      const z = centerZ + Math.sin(angle) * 3.05 * edgeVariation * radius;
      positions.push(x, surface, z);
      uvs.push(0.5 + Math.cos(angle) * radius * 0.5, 0.5 + Math.sin(angle) * radius * 0.5);
    }
  }

  for (let segment = 0; segment < angularSegments; segment += 1) {
    indices.push(0, 1 + ((segment + 1) % angularSegments), 1 + segment);
  }
  for (let ring = 1; ring < radialSegments; ring += 1) {
    const innerStart = 1 + (ring - 1) * angularSegments;
    const outerStart = 1 + ring * angularSegments;
    for (let segment = 0; segment < angularSegments; segment += 1) {
      const next = (segment + 1) % angularSegments;
      const innerCurrent = innerStart + segment;
      const innerNext = innerStart + next;
      const outerCurrent = outerStart + segment;
      const outerNext = outerStart + next;
      indices.push(innerCurrent, outerNext, outerCurrent, innerCurrent, innerNext, outerNext);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createWaterfallLipGeometry() {
  const rows = 22;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row < rows; row += 1) {
    const progress = row / (rows - 1);
    const z = mix(-94, -80.12, progress);
    const center = riverAxis(-z) * (1 - progress) + 4.8 * progress + Math.sin(progress * 8.4) * 0.16;
    const width = 0.34 + progress * 0.42 + Math.sin(progress * 9.1) * 0.075;
    const surface = worldSurfaceHeight(center, z, true) + 0.055;
    positions.push(center - width, surface, z, center + width, surface, z);
    uvs.push(0, progress * 2.5, 1, progress * 2.5);
    if (row < rows - 1) {
      const base = row * 2;
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function LakeEdgeHabitat({ shadows, tier }: Pick<WorldEcologyProps, "shadows" | "tier">) {
  const stoneCount = tier === "high" ? 92 : tier === "balanced" ? 58 : 30;
  const reedCount = tier === "high" ? 320 : tier === "balanced" ? 180 : 86;
  const stoneRef = useRef<InstancedMesh>(null);
  const reedRef = useRef<InstancedMesh>(null);
  const stoneGeometry = useMemo(() => new DodecahedronGeometry(0.26, 0), []);
  const reedGeometry = useMemo(() => createTuftGeometry(), []);
  const stoneMaterial = useMemo(
    () => new MeshStandardMaterial({ color: "#778078", roughness: 0.92, vertexColors: true }),
    [],
  );
  const reedMaterial = useMemo(
    () => new MeshStandardMaterial({ color: "#718861", roughness: 0.96, side: DoubleSide, vertexColors: true }),
    [],
  );
  const placements = useMemo(() => {
    const random = seededRandom(520331);
    const stones = Array.from({ length: stoneCount }, (_, index) => {
      const angle = (index / stoneCount) * Math.PI * 2 + (random() - 0.5) * 0.16;
      const point = lakeBoundaryPoint(angle, 1.015 + random() * 0.105);
      const x = point.x;
      const z = point.y;
      return {
        x,
        y: worldSurfaceHeight(x, z) - 0.1,
        z,
        scale: 0.28 + random() ** 1.7 * 0.92,
        rotation: random() * Math.PI * 2,
        color: new Color().setHSL(0.18 + random() * 0.035, 0.035, 0.48 + random() * 0.2),
      };
    });
    const reeds = Array.from({ length: reedCount }, (_, index) => {
      const cluster = index % 11;
      const angle = (index / reedCount) * Math.PI * 2 + Math.sin(cluster * 2.7) * 0.075;
      const point = lakeBoundaryPoint(angle, 0.965 + random() * 0.125);
      const x = point.x;
      const z = point.y;
      return {
        x,
        y: Math.max(0.025, worldSurfaceHeight(x, z)) + 0.02,
        z,
        height: 0.72 + random() * 1.22,
        width: 0.68 + random() * 0.66,
        tiltX: (random() - 0.5) * 0.15,
        tiltZ: (random() - 0.5) * 0.15,
        color: new Color().setHSL(0.23 + random() * 0.055, 0.32 + random() * 0.19, 0.28 + random() * 0.22),
      };
    });
    return { reeds, stones };
  }, [reedCount, stoneCount]);

  useEffect(() => {
    const stones = stoneRef.current;
    const reeds = reedRef.current;
    if (!stones || !reeds) return;
    const dummy = new Object3D();
    placements.stones.forEach((placement, index) => {
      dummy.position.set(placement.x, placement.y, placement.z);
      dummy.rotation.set((index % 5) * 0.11, placement.rotation, (index % 7) * 0.07);
      dummy.scale.set(placement.scale * 1.25, placement.scale * 0.62, placement.scale);
      dummy.updateMatrix();
      stones.setMatrixAt(index, dummy.matrix);
      stones.setColorAt(index, placement.color);
    });
    placements.reeds.forEach((placement, index) => {
      dummy.position.set(placement.x, placement.y, placement.z);
      dummy.rotation.set(placement.tiltX, index * 2.399, placement.tiltZ);
      dummy.scale.set(placement.width, placement.height, placement.width);
      dummy.updateMatrix();
      reeds.setMatrixAt(index, dummy.matrix);
      reeds.setColorAt(index, placement.color);
    });
    stones.instanceMatrix.needsUpdate = true;
    reeds.instanceMatrix.needsUpdate = true;
    if (stones.instanceColor) stones.instanceColor.needsUpdate = true;
    if (reeds.instanceColor) reeds.instanceColor.needsUpdate = true;
    stones.computeBoundingSphere();
    reeds.computeBoundingSphere();
  }, [placements]);

  useEffect(
    () => () => {
      stoneGeometry.dispose();
      reedGeometry.dispose();
      stoneMaterial.dispose();
      reedMaterial.dispose();
    },
    [reedGeometry, reedMaterial, stoneGeometry, stoneMaterial],
  );

  return (
    <group name="Alpine lake edge habitat">
      <instancedMesh args={[stoneGeometry, stoneMaterial, stoneCount]} castShadow={shadows} receiveShadow={shadows} ref={stoneRef} />
      <instancedMesh args={[reedGeometry, reedMaterial, reedCount]} castShadow={false} receiveShadow={shadows} ref={reedRef} />
    </group>
  );
}

function WaterfallSpray({
  reducedMotion,
  tier,
}: Pick<WorldEcologyProps, "reducedMotion" | "tier">) {
  const sprayRef = useRef<Points<BufferGeometry, ShaderMaterial> | null>(null);
  const count = tier === "high" ? 160 : tier === "balanced" ? 104 : 56;
  const geometry = useMemo(() => {
    const random = seededRandom(880214);
    const bottom = worldSurfaceHeight(4.8, -76.2) + 0.28;
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const sizes = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      const atImpact = index < Math.floor(count * 0.68);
      const angle = random() * Math.PI * 2;
      const radius = atImpact ? random() ** 0.62 * 3.9 : random() * 1.35;
      positions[index * 3] = 4.8 + Math.cos(angle) * radius;
      positions[index * 3 + 1] = atImpact
        ? bottom + random() ** 1.8 * 2.6
        : bottom + 1.7 + random() * 7.8;
      positions[index * 3 + 2] = atImpact
        ? -76.25 + Math.sin(angle) * radius * 0.62
        : -79.65 + (random() - 0.5) * 1.25;
      phases[index] = random() * Math.PI * 2;
      sizes[index] = 2.2 + random() * 5.8;
    }
    const result = new BufferGeometry();
    result.setAttribute("position", new Float32BufferAttribute(positions, 3));
    result.setAttribute("sprayPhase", new Float32BufferAttribute(phases, 1));
    result.setAttribute("spraySize", new Float32BufferAttribute(sizes, 1));
    result.computeBoundingSphere();
    return result;
  }, [count]);
  const material = useMemo(
    () => new ShaderMaterial({
      depthWrite: false,
      transparent: true,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        attribute float sprayPhase;
        attribute float spraySize;
        uniform float uTime;
        varying float vAlpha;
        void main() {
          vec3 moved = position;
          float age = fract(sprayPhase * 0.159 + uTime * 0.075);
          moved.x += sin(sprayPhase + uTime * 0.42) * age * 0.48;
          moved.y += age * 1.35;
          moved.z += cos(sprayPhase * 1.7 + uTime * 0.31) * age * 0.34;
          vec4 mvPosition = modelViewMatrix * vec4(moved, 1.0);
          gl_PointSize = spraySize * (48.0 / max(1.0, -mvPosition.z));
          gl_Position = projectionMatrix * mvPosition;
          vAlpha = sin(age * 3.14159265) * 0.34;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          vec2 point = gl_PointCoord - 0.5;
          float soft = 1.0 - smoothstep(0.12, 0.5, length(point));
          if (soft < 0.03) discard;
          gl_FragColor = vec4(0.74, 0.86, 0.86, soft * vAlpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    }),
    [],
  );

  useFrame(({ clock }) => {
    if (sprayRef.current) {
      sprayRef.current.material.uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime;
    }
  });
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return <points geometry={geometry} material={material} ref={sprayRef} renderOrder={4} />;
}

// Kept for profiling the removed cold-entry bottleneck; the authored cliff is live instead.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function WaterfallRockFrame({ shadows, tier }: Pick<WorldEcologyProps, "shadows" | "tier">) {
  const count = tier === "high" ? 24 : tier === "balanced" ? 18 : 12;
  const ref = useRef<InstancedMesh>(null);
  const rock = useLoader(GLTFLoader, `${ECOLOGY_ROOT}/rock_09/rock_09_1k.gltf`);
  const sourceMesh = useMemo(() => getMesh(rock.scene, "rock_09_LOD0"), [rock]);
  const geometry = sourceMesh.geometry;
  const material = useMemo(() => {
    const result = materialFromMesh(sourceMesh, "#a5aca5");
    result.emissive.set("#17231f");
    result.emissiveIntensity = 0.16;
    result.roughness = 0.96;
    return result;
  }, [sourceMesh]);
  const placements = useMemo(() => {
    const random = seededRandom(418820);
    const bottom = worldSurfaceHeight(4.8, -76.2) - 0.18;
    const top = Math.max(worldSurfaceHeight(4.8, -84.2, true), bottom + 8.2);
    const cliffCount = Math.floor(count * 0.82);
    return Array.from({ length: count }, (_, index) => {
      const poolRock = index >= cliffCount;
      const side = index % 2 === 0 ? -1 : 1;
      if (poolRock) {
        const poolIndex = index - cliffCount;
        const poolCount = Math.max(1, count - cliffCount);
        const angle = (poolIndex / poolCount) * Math.PI * 1.5 + 0.72 + random() * 0.18;
        const radius = 3.15 + random() * 1.35;
        const scale = 9 + random() * 6;
        return {
          color: new Color().setHSL(0.17 + random() * 0.025, 0.035, 0.31 + random() * 0.11),
          rotation: random() * Math.PI * 2,
          scale,
          scaleX: scale * (1.1 + random() * 0.38),
          scaleY: scale * (2.2 + random() * 0.8),
          scaleZ: scale * (0.82 + random() * 0.26),
          x: 4.8 + Math.cos(angle) * radius,
          y: bottom - 0.28,
          z: -76.45 + Math.sin(angle) * radius * 0.45,
        };
      }
      const row = Math.floor(index / 2);
      const rowCount = Math.ceil(cliffCount / 2);
      const vertical = row / Math.max(1, rowCount - 1);
      const scale = 16 + random() * 8;
      return {
        color: new Color().setHSL(0.17 + random() * 0.028, 0.03, 0.3 + random() * 0.12),
        rotation: random() * Math.PI * 2,
        scale,
        scaleX: scale * (0.92 + random() * 0.34),
        scaleY: scale * (2.35 + random() * 0.78),
        scaleZ: scale * (0.78 + random() * 0.26),
        x: 4.8 + side * (1.22 + random() * 0.58) + Math.sin(vertical * 8.4) * 0.18,
        y: mix(bottom + 0.24, top - 0.22, vertical) + (random() - 0.5) * 0.24,
        z: -80.18 + (random() - 0.5) * 0.58,
      };
    });
  }, [count]);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new Object3D();
    placements.forEach((placement, index) => {
      dummy.position.set(placement.x, placement.y, placement.z);
      dummy.rotation.set(((index * 13) % 9 - 4) * 0.055, placement.rotation, ((index * 7) % 9 - 4) * 0.05);
      dummy.scale.set(placement.scaleX, placement.scaleY, placement.scaleZ);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, placement.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [placements]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return (
    <instancedMesh
      args={[geometry, material, count]}
      castShadow={shadows}
      receiveShadow={shadows}
      ref={ref}
    />
  );
}

function WaterNetwork({
  reducedMotion,
  shadows,
  tier,
  zone,
}: Pick<WorldEcologyProps, "reducedMotion" | "shadows" | "tier" | "zone">) {
  const showLake = zone === "reveal" || zone === "lake";
  const showStream = zone === "reveal" || zone === "lake" || zone === "waterfall";
  const showWaterfall = zone === "waterfall";
  const lakeGeometry = useMemo(() => createLakeGeometry(tier), [tier]);
  const streamGeometry = useMemo(() => createStreamGeometry(true), []);
  const connectorGeometry = useMemo(() => createRiverToLakeGeometry(), []);
  const waterfallGeometry = useMemo(() => createWaterfallGeometry(), []);
  const waterfallLipGeometry = useMemo(() => createWaterfallLipGeometry(), []);
  const impactPoolGeometry = useMemo(() => createImpactPoolGeometry(tier), [tier]);
  const lakeRef = useRef<Mesh<BufferGeometry, ShaderMaterial> | null>(null);
  const streamRef = useRef<Mesh<BufferGeometry, ShaderMaterial> | null>(null);
  const waterfallRef = useRef<Mesh<BufferGeometry, ShaderMaterial> | null>(null);
  const waterMaterial = useMemo(
    () => new ShaderMaterial({
      depthWrite: true,
      side: DoubleSide,
      uniforms: {
        uDeep: { value: new Color("#043840") },
        uFogColor: { value: new Color("#66838a") },
        uHorizon: { value: new Color("#718f94") },
        uShallow: { value: new Color("#34796f") },
        uSunColor: { value: new Color("#ffd9ad") },
        uSunDirection: { value: new Vector3(-0.76, 0.31, 0.57).normalize() },
        uTime: { value: 0 },
      },
      vertexShader: `
        uniform float uTime;
        varying vec3 vWorldPosition;
        varying float vWave;
        void main() {
          vec3 displaced = position;
          vec4 baseWorld = modelMatrix * vec4(position, 1.0);
          float rippleA = sin(baseWorld.x * 0.72 + baseWorld.z * 0.39 + uTime * 0.42) * 0.026;
          float rippleB = sin(baseWorld.x * -1.13 + baseWorld.z * 0.88 + uTime * 0.61 + 1.7) * 0.014;
          float rippleC = sin(baseWorld.x * 2.47 + baseWorld.z * -1.84 + uTime * 0.83) * 0.006;
          displaced.y += rippleA + rippleB + rippleC;
          vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
          vWorldPosition = worldPosition.xyz;
          vWave = rippleA + rippleB + rippleC;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uDeep;
        uniform vec3 uFogColor;
        uniform vec3 uHorizon;
        uniform vec3 uShallow;
        uniform vec3 uSunColor;
        uniform vec3 uSunDirection;
        uniform float uTime;
        varying vec3 vWorldPosition;
        varying float vWave;

        void main() {
          vec3 dx = dFdx(vWorldPosition);
          vec3 dy = dFdy(vWorldPosition);
          vec3 normal = normalize(cross(dx, dy));
          if (normal.y < 0.0) normal *= -1.0;
          vec2 micro = vec2(
            sin(vWorldPosition.x * 3.4 + vWorldPosition.z * 1.7 + uTime * 0.7),
            cos(vWorldPosition.z * 3.1 - vWorldPosition.x * 1.2 + uTime * 0.56)
          ) * 0.028;
          normal = normalize(normal + vec3(micro.x, 0.0, micro.y));
          vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
          vec3 reflected = reflect(-viewDirection, normal);
          float fresnel = pow(1.0 - max(dot(viewDirection, normal), 0.0), 3.6);
          vec2 lakeCoordinate = vec2(
            (vWorldPosition.x - 2.4) / 18.1,
            (vWorldPosition.z + 49.0) / 27.1
          );
          float lakeAngle = atan(lakeCoordinate.y, lakeCoordinate.x);
          float lakeBoundary = 0.94
            + sin(lakeAngle * 2.0 - 0.22) * 0.072
            + sin(lakeAngle * 3.0 + 0.72) * 0.068
            + sin(lakeAngle * 5.0 - 1.16) * 0.041
            + sin(lakeAngle * 9.0 + 2.04) * 0.024
            + sin(lakeAngle * 17.0 - 0.38) * 0.011;
          float lakeRadius = length(lakeCoordinate) / lakeBoundary;
          float insideLake = 1.0 - smoothstep(1.04, 1.22, lakeRadius);
          float shore = smoothstep(0.68, 1.04, lakeRadius) * insideLake;
          vec3 waterBase = mix(uDeep, uShallow, shore * 0.62 + smoothstep(-0.03, 0.045, vWave) * 0.045);
          vec3 reflection = mix(uHorizon * 0.72, vec3(0.36, 0.56, 0.61), smoothstep(-0.1, 0.72, reflected.y));
          vec3 color = mix(waterBase, reflection, 0.18 + fresnel * 0.48);
          float longRipple = sin(vWorldPosition.x * 0.46 + vWorldPosition.z * 0.21 + uTime * 0.34) * 0.5 + 0.5;
          float crossingRipple = sin(vWorldPosition.x * -0.83 + vWorldPosition.z * 0.61 + uTime * 0.51) * 0.5 + 0.5;
          float rippleBands = longRipple * crossingRipple;
          float cloudReflection = smoothstep(0.54, 0.92,
            sin(vWorldPosition.x * 0.075 + vWorldPosition.z * 0.043) * 0.28
            + sin(vWorldPosition.x * -0.031 + vWorldPosition.z * 0.091 + 1.7) * 0.24
            + 0.52
          );
          color *= 0.89 + rippleBands * 0.17;
          color = mix(color, uHorizon * 0.96, cloudReflection * (0.028 + fresnel * 0.085));
          float broadGlint = pow(max(dot(reflected, uSunDirection), 0.0), 82.0);
          float sharpGlint = pow(max(dot(reflected, uSunDirection), 0.0), 390.0);
          color += uSunColor * (broadGlint * 0.72 + sharpGlint * 1.9);
          float distanceToCamera = length(cameraPosition - vWorldPosition);
          float fogFactor = 1.0 - exp(-0.00135 * 0.00135 * distanceToCamera * distanceToCamera);
          color = mix(color, uFogColor, clamp(fogFactor, 0.0, 0.42));
          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    }),
    [],
  );
  const streamMaterial = useMemo(() => {
    const material = waterMaterial.clone();
    material.uniforms.uDeep.value = new Color("#061d20");
    material.uniforms.uShallow.value = new Color("#183d3e");
    material.uniforms.uHorizon.value = new Color("#2b4b4c");
    return material;
  }, [waterMaterial]);
  const waterfallMaterial = useMemo(
    () => new ShaderMaterial({
      depthWrite: false,
      side: DoubleSide,
      transparent: true,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        uniform float uTime;
        attribute float fallPhase;
        varying vec2 vUv;
        varying float vFallPhase;
        void main() {
          vUv = uv;
          vFallPhase = fallPhase;
          vec3 displaced = position;
          displaced.z += sin(uv.y * 17.0 - uTime * 2.25 + uv.x * 5.0 + fallPhase) * 0.055;
          displaced.x += sin(uv.y * 9.0 - uTime * 0.72 + fallPhase * 1.7) * 0.035;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying float vFallPhase;
        void main() {
          float edge = smoothstep(0.0, 0.24, vUv.x) * smoothstep(0.0, 0.24, 1.0 - vUv.x);
          float packetA = sin(vUv.y * 23.0 - uTime * 3.15 + vFallPhase * 0.32) * 0.5 + 0.5;
          float packetB = sin(vUv.y * 41.0 - uTime * 4.7 - vFallPhase * 0.21) * 0.5 + 0.5;
          float fineBreakup = sin(vUv.y * 79.0 - uTime * 6.1 + vUv.x * 16.0) * 0.5 + 0.5;
          float lateralFlow = sin(vUv.x * 29.0 + sin(vUv.y * 13.0 - uTime * 1.8) * 2.1) * 0.5 + 0.5;
          float flow = packetA * 0.34 + packetB * 0.24 + fineBreakup * 0.16 + lateralFlow * 0.26;
          float broken = smoothstep(0.42, 0.8, flow);
          float aeration = smoothstep(0.34, 1.0, vUv.y) * (0.48 + packetA * 0.52);
          vec3 deep = vec3(0.2, 0.42, 0.46);
          vec3 foam = vec3(0.78, 0.86, 0.85);
          vec3 color = mix(deep, foam, 0.24 + broken * 0.38 + aeration * 0.38);
          float pocket = smoothstep(0.77, 0.96, sin(vUv.x * 17.0 - vUv.y * 8.0 + vFallPhase * 0.2) * 0.5 + 0.5);
          float strands = smoothstep(0.46, 0.74, lateralFlow + packetB * 0.25);
          float alpha = edge * (0.22 + flow * 0.24 + broken * 0.16 + aeration * 0.16)
            * mix(0.36, 1.0, strands) * (1.0 - pocket * 0.58);
          if (alpha < 0.08) discard;
          gl_FragColor = vec4(color, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    }),
    [],
  );
  useFrame(({ clock }) => {
    const time = reducedMotion ? 0 : clock.elapsedTime;
    const lakeMaterial = lakeRef.current?.material;
    const riverMaterial = streamRef.current?.material;
    const fallsMaterial = waterfallRef.current?.material;
    if (lakeMaterial) lakeMaterial.uniforms.uTime.value = time;
    if (riverMaterial) riverMaterial.uniforms.uTime.value = time;
    if (fallsMaterial) fallsMaterial.uniforms.uTime.value = time;
  });
  useEffect(
    () => () => {
      lakeGeometry.dispose();
      streamGeometry.dispose();
      connectorGeometry.dispose();
      waterfallGeometry.dispose();
      waterfallLipGeometry.dispose();
      impactPoolGeometry.dispose();
      waterMaterial.dispose();
      streamMaterial.dispose();
      waterfallMaterial.dispose();
    },
    [connectorGeometry, impactPoolGeometry, lakeGeometry, streamGeometry, streamMaterial, waterfallGeometry, waterfallLipGeometry, waterMaterial, waterfallMaterial],
  );

  return (
    <group name="Animated alpine lake, river, and waterfall system">
      {showLake ? <mesh geometry={lakeGeometry} material={waterMaterial} ref={lakeRef} renderOrder={2} /> : null}
      {showStream ? <mesh geometry={streamGeometry} material={streamMaterial} ref={streamRef} renderOrder={2} /> : null}
      {showLake ? <mesh geometry={connectorGeometry} material={streamMaterial} renderOrder={2} /> : null}
      {showWaterfall ? (
        <>
          <mesh geometry={waterfallLipGeometry} material={streamMaterial} renderOrder={2} />
          <mesh geometry={waterfallGeometry} material={waterfallMaterial} ref={waterfallRef} renderOrder={3} />
          <mesh geometry={impactPoolGeometry} material={streamMaterial} renderOrder={2} />
          <WaterfallSpray reducedMotion={reducedMotion} tier={tier} />
        </>
      ) : null}
      {showLake ? <LakeEdgeHabitat shadows={shadows} tier={tier} /> : null}
    </group>
  );
}

function WesternOcean({
  mobile,
  reducedMotion,
  tier,
}: Pick<WorldEcologyProps, "mobile" | "reducedMotion" | "tier">) {
  const oceanRef = useRef<Mesh<PlaneGeometry, ShaderMaterial> | null>(null);
  const material = useMemo(
    () => new ShaderMaterial({
      depthWrite: true,
      uniforms: {
        uDeepWater: { value: new Color("#032c3b") },
        uFogColor: { value: new Color("#66838a") },
        uFogDensity: { value: 0.00135 },
        uHorizon: { value: new Color("#789fa6") },
        uSkyZenith: { value: new Color("#17617d") },
        uSunColor: { value: new Color("#ffd8aa") },
        uSunDirection: { value: new Vector3(-0.76, 0.31, 0.57).normalize() },
        uTime: { value: 0 },
      },
      vertexShader: `
        uniform float uTime;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        varying float vWaveHeight;
        varying float vWaveSlope;

        void main() {
          vec3 displaced = position;
          vec2 p = position.xy;
          vec4 baseWorld = modelMatrix * vec4(position, 1.0);
          float coastline = -66.0
            + sin(baseWorld.z * 0.041 + 0.8) * 5.8
            + sin(baseWorld.z * 0.097 - 1.3) * 2.4;
          float coastDepth = smoothstep(2.4, 24.0, abs(baseWorld.x - coastline));
          float warpA = sin(p.x * 0.012 + p.y * 0.017 + 0.8) * 1.15
            + sin(p.x * -0.024 + p.y * 0.009 - 1.7) * 0.72;
          float warpB = sin(p.x * 0.019 - p.y * 0.014 + 2.1) * 0.86;
          float phaseA = p.x * 0.031 + p.y * 0.018 + warpA * 0.2 + uTime * 0.56;
          float phaseB = p.x * -0.047 + p.y * 0.064 + warpB * 0.24 + uTime * 0.41 + 1.7;
          float phaseC = p.x * 0.104 + p.y * -0.091 + warpA * 0.12 + uTime * 0.77 + 4.2;
          float phaseD = p.x * -0.215 + p.y * -0.183 + warpB * 0.16 + uTime * 1.08 + 2.4;
          float swellA = sin(phaseA) * 0.76;
          float swellB = sin(phaseB) * 0.37;
          float swellC = sin(phaseC) * 0.15;
          float swellD = sin(phaseD) * 0.055;
          float height = (swellA + swellB + swellC + swellD) * coastDepth;
          displaced.x += (cos(phaseA) * 0.34 - cos(phaseB) * 0.13) * coastDepth;
          displaced.y += (cos(phaseA) * 0.2 + cos(phaseB) * 0.18) * coastDepth;
          displaced.z += height;

          float dx = (cos(phaseA) * 0.031 * 0.76
            + cos(phaseB) * -0.047 * 0.37
            + cos(phaseC) * 0.104 * 0.15
            + cos(phaseD) * -0.215 * 0.055) * coastDepth;
          float dy = (cos(phaseA) * 0.018 * 0.76
            + cos(phaseB) * 0.064 * 0.37
            + cos(phaseC) * -0.091 * 0.15
            + cos(phaseD) * -0.183 * 0.055) * coastDepth;
          vec3 localNormal = normalize(vec3(-dx, -dy, 1.0));
          vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
          vWorldPosition = worldPosition.xyz;
          vWorldNormal = normalize(mat3(modelMatrix) * localNormal);
          vWaveHeight = height;
          vWaveSlope = length(vec2(dx, dy));
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uDeepWater;
        uniform vec3 uFogColor;
        uniform float uFogDensity;
        uniform vec3 uHorizon;
        uniform vec3 uSkyZenith;
        uniform vec3 uSunColor;
        uniform vec3 uSunDirection;
        uniform float uTime;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        varying float vWaveHeight;
        varying float vWaveSlope;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), u.x),
            u.y
          );
        }

        void main() {
          vec3 normal = normalize(vWorldNormal);
          vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
          float distanceToCamera = length(cameraPosition - vWorldPosition);
          float distanceDetail = 1.0 - smoothstep(72.0, 360.0, distanceToCamera);
          float grazingDetail = smoothstep(0.035, 0.22, abs(viewDirection.y));
          float detailFade = distanceDetail * grazingDetail;
          normal = normalize(mix(vec3(0.0, 1.0, 0.0), normal, 0.34 + detailFade * 0.66));
          vec2 micro = vec2(
            sin(vWorldPosition.x * 0.93 + vWorldPosition.z * 1.31 + uTime * 0.71),
            cos(vWorldPosition.z * 1.07 - vWorldPosition.x * 0.82 + uTime * 0.63)
          );
          vec2 capillary = vec2(
            sin(vWorldPosition.x * 3.7 - vWorldPosition.z * 2.4 + uTime * 1.3),
            cos(vWorldPosition.z * 3.1 + vWorldPosition.x * 2.2 + uTime * 1.12)
          );
          normal = normalize(normal + vec3(
            (micro.x * 0.012 + capillary.x * 0.0025) * detailFade,
            0.0,
            (micro.y * 0.012 + capillary.y * 0.0025) * detailFade
          ));
          vec3 reflected = reflect(-viewDirection, normal);
          float skyAmount = smoothstep(-0.08, 0.78, reflected.y);
          vec3 reflectedSky = mix(uHorizon, uSkyZenith, skyAmount);
          float fresnel = pow(1.0 - max(dot(viewDirection, normal), 0.0), 3.6);
          vec3 color = mix(uDeepWater, reflectedSky, 0.16 + fresnel * 0.78);

          float surfaceVariation = noise(
            vWorldPosition.xz * 0.092 + vec2(uTime * 0.018, -uTime * 0.013)
          );
          float crest = smoothstep(0.055, 0.16, vWaveSlope) * smoothstep(0.42, 1.18, vWaveHeight);
          float crestBreak = smoothstep(0.56, 0.9, surfaceVariation + sin(vWorldPosition.x * 0.21 - vWorldPosition.z * 0.13 - uTime * 0.8) * 0.12);
          color *= 0.78 + surfaceVariation * 0.32;
          color += vec3(0.12, 0.24, 0.25) * vWaveSlope * (0.6 + surfaceVariation * 0.4);
          color = mix(color, vec3(0.7, 0.84, 0.82), crest * crestBreak * 0.42);

          float broadGlint = pow(max(dot(reflected, uSunDirection), 0.0), 58.0);
          float sharpGlint = pow(max(dot(reflected, uSunDirection), 0.0), 330.0);
          color += uSunColor * (broadGlint * 0.9 + sharpGlint * 2.65);

          float coastline = -66.0
            + sin(vWorldPosition.z * 0.041 + 0.8) * 5.8
            + sin(vWorldPosition.z * 0.097 - 1.3) * 2.4;
          float shoreDistance = abs(vWorldPosition.x - coastline);
          float shoreNoise = noise(vWorldPosition.xz * 0.22 + vec2(uTime * 0.038, -uTime * 0.026));
          float shorePulse = sin(shoreDistance * 1.72 - uTime * 1.35 + shoreNoise * 3.2) * 0.5 + 0.5;
          float foam = (1.0 - smoothstep(0.25, 7.4, shoreDistance))
            * smoothstep(0.42, 0.76, shoreNoise * 0.64 + shorePulse * 0.48);
          color = mix(color, vec3(0.8, 0.9, 0.87), foam * 0.82);

          float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * distanceToCamera * distanceToCamera);
          color = mix(color, uFogColor, clamp(fogFactor, 0.0, 0.56));
          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    }),
    [],
  );
  const segments = mobile ? [80, 80] : tier === "high" ? [192, 192] : tier === "balanced" ? [128, 128] : [64, 64];

  useFrame(({ clock }) => {
    const oceanMaterial = oceanRef.current?.material;
    if (oceanMaterial) {
      oceanMaterial.uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime;
    }
  });
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh ref={oceanRef} position={[-1000, -0.68, -100]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[2400, 1800, segments[0], segments[1]]} />
      <primitive attach="material" object={material} />
    </mesh>
  );
}

const V19_ZONE_GEOLOGY: Record<JourneyCheckpointId, string> = {
  ridge: "/world/v19/madagin-ridge-geology-v1.9.glb?v=19g",
  reveal: "/world/v19/madagin-valley-peaks-v1.9.glb?v=19g",
  lake: "/world/v19/madagin-lake-basin-v1.9.glb?v=19g",
  clearing: "/world/v19/madagin-lake-basin-v1.9.glb?v=19g",
  waterfall: "/world/v19/madagin-waterfall-cliff-v1.9.glb?v=19g",
  summit: "/world/v19/madagin-summit-peaks-v1.9.glb?v=19g",
};

function AuthoredZoneGeology({ shadows, zone }: Pick<WorldEcologyProps, "shadows" | "zone">) {
  const gltf = useLoader(GLTFLoader, V19_ZONE_GEOLOGY[zone]);
  const scene = useMemo(() => {
    const result = gltf.scene.clone(true);
    result.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.castShadow = shadows;
      child.receiveShadow = shadows;
      const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material];
      const materials = sourceMaterials.map((source) => {
        const material = source.clone();
        if (material instanceof MeshStandardMaterial) {
          const zoneColor = zone === "waterfall"
            ? "#070d0a"
            : zone === "ridge" ? "#283329" : zone === "lake" ? "#303b34" : "#344746";
          material.color.set(zoneColor);
          material.vertexColors = false;
          material.emissive.set(zone === "waterfall" ? "#08110e" : "#101b17");
          material.emissiveIntensity = 0.035;
          material.envMapIntensity = zone === "waterfall" ? 0.09 : 0.07;
          material.roughness = zone === "waterfall" ? 0.82 : 0.96;
        }
        return material;
      });
      child.material = Array.isArray(child.material) ? materials : materials[0];
    });
    result.name = `Madagin authored ${zone} geology v1.9`;
    return result;
  }, [gltf.scene, shadows, zone]);

  useEffect(
    () => () => {
      scene.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => material.dispose());
      });
    },
    [scene],
  );

  return <primitive object={scene} />;
}

export function WorldEcology({ diagnosticMode, mobile, reducedMotion, shadows, showOcean, tier, worldVersion, zone }: WorldEcologyProps) {
  const connectedV115 = zone === "ridge" || zone === "reveal" || zone === "lake" || zone === "clearing" || zone === "waterfall" || zone === "summit";
  if (connectedV115 && worldVersion === "v116") {
    return (
      <RidgeProductionV116
        diagnosticMode={diagnosticMode}
        mobile={mobile}
        reducedMotion={reducedMotion}
        shadows={shadows}
        showOcean={showOcean}
        tier={tier}
        zone={zone}
      />
    );
  }
  if (connectedV115) {
    return (
      <group name={`Madagin connected v1.15 persistent world · ${zone} chapter`}>
        <RidgeProductionV115
          diagnosticMode={diagnosticMode}
          mobile={mobile}
          shadows={shadows}
          showOcean={showOcean}
          tier={tier}
          zone={zone}
        />
        <Suspense fallback={null}>
          <WesternOcean mobile={mobile} reducedMotion={reducedMotion} tier={tier} />
        </Suspense>
      </group>
    );
  }
  const showHeroTrees = zone === "reveal" || zone === "lake" || zone === "clearing";
  const showWater = zone === "reveal" || zone === "lake" || zone === "waterfall";
  return (
    <group name={`Madagin live ${zone} ecology v1.9`}>
      <Suspense fallback={null}>
        <ExpandedTerrain shadows={shadows} showWaterfallCliff={zone === "waterfall"} tier={tier} />
      </Suspense>
      <Suspense fallback={null}>
        <AuthoredZoneGeology shadows={shadows} zone={zone} />
      </Suspense>
      {showOcean ? <Suspense fallback={null}><WesternOcean mobile={mobile} reducedMotion={reducedMotion} tier={tier} /></Suspense> : null}
      {SHOW_CANOPY_VOLUME_PROXY ? (
        <Suspense fallback={null}><RainforestCanopyMass mobile={mobile} tier={tier} /></Suspense>
      ) : null}
      {SHOW_LEGACY_TREE_IMPOSTORS ? (
        <>
          <Suspense fallback={null}><TropicalEmergentCanopy mobile={mobile} tier={tier} /></Suspense>
          <Suspense fallback={null}><PalmEmergents tier={tier} /></Suspense>
          <Suspense fallback={null}><ForestCanopy tier={tier} /></Suspense>
          <Suspense fallback={null}><BroadleafCanopy tier={tier} /></Suspense>
        </>
      ) : null}
      {showHeroTrees ? (
        <Suspense fallback={null}><AuthoredHeroTrees mobile={mobile} shadows={shadows} tier={tier} /></Suspense>
      ) : null}
      <ProceduralGroundLayer shadows={shadows} tier={tier} zone={zone} />
      {showWater ? (
        <WaterNetwork reducedMotion={reducedMotion} shadows={shadows} tier={tier} zone={zone} />
      ) : null}
    </group>
  );
}
