"use client";

import { useFrame, useLoader } from "@react-three/fiber";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  BackSide,
  BufferGeometry,
  Color,
  DoubleSide,
  FileLoader,
  Float32BufferAttribute,
  FrontSide,
  Group,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Points,
  RepeatWrapping,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
  Vector3,
} from "three";
import type { BufferAttribute, InterleavedBufferAttribute } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { JourneyCheckpointId } from "@/lib/world-manifest";
import type { WorldQualityTier } from "./world-ecology";
import { PhysicalSkyEnvironment } from "./world-atmosphere";

const ROOT = "/world/v116";
const SPECIES_URL = `${ROOT}/species-core-v1.16.glb`;
const V115_MID_VEGETATION_URL = "/world/v115/madagin-ridge-vegetation-mid-v1.15.glb";
const V115_HERO_VEGETATION_URL = "/world/v115/madagin-ridge-vegetation-hero-v1.15.glb";
const V115_HIGH_TERRAIN_URL = "/world/v115/madagin-ridge-to-valley-high-v1.15.glb";
const ASSET_ROOT = "/world/assets/polyhaven";
const WATERSHED_GROUNDCOVER_URLS = {
  fern: `${ASSET_ROOT}/fern_02/fern_02_1k.gltf`,
  rock: `${ASSET_ROOT}/rock_09/rock_09_1k.gltf`,
  shrub: `${ASSET_ROOT}/shrub_04/shrub_04_1k.gltf`,
} as const;
const GROUND_TEXTURE_URLS: string[] = [
  `${ASSET_ROOT}/forrest_ground_03/forrest_ground_03_diff_1k.jpg`,
  `${ASSET_ROOT}/aerial_grass_rock/aerial_grass_rock_diff_1k.jpg`,
];
const DETAILED_GROUND_TEXTURES = {
  forest: [
    `${ASSET_ROOT}/forrest_ground_03/forrest_ground_03_diff_1k.jpg`,
    `${ASSET_ROOT}/forrest_ground_03/forrest_ground_03_nor_gl_1k.jpg`,
    `${ASSET_ROOT}/forrest_ground_03/forrest_ground_03_arm_1k.jpg`,
  ],
  rock: [
    `${ASSET_ROOT}/aerial_grass_rock/aerial_grass_rock_diff_1k.jpg`,
    `${ASSET_ROOT}/aerial_grass_rock/aerial_grass_rock_nor_gl_1k.jpg`,
    `${ASSET_ROOT}/aerial_grass_rock/aerial_grass_rock_arm_1k.jpg`,
  ],
} as const;

type V116Zone = "ridge" | "valley" | "lake" | "alpine";
type DiagnosticMode = "grounding" | "water" | "zones" | null;
type PlacementTuple = [
  family: number,
  layer: number,
  x: number,
  y: number,
  z: number,
  rotation: number,
  scaleX: number,
  scaleY: number,
  scaleZ: number,
  hueBucket: number,
  maxRootGap: number,
  maxRootBurial: number,
];

type EcologyManifest = {
  version: "v1.16";
  zone: V116Zone;
  fields: string[];
  families: string[];
  instances: PlacementTuple[];
  coverage: {
    count: number;
    byLayer: Record<string, number>;
    grounding: {
      sampleCount: number;
      floatingCount: number;
      buriedCount: number;
      maxRootGap: number;
      maxRootBurial: number;
      nearGapGate: number;
      nearBurialGate: number;
      method: string;
    };
  };
};

type SpeciesPart = {
  family: string;
  geometry: Mesh["geometry"];
  material: Material | Material[];
  matrixWorld: Matrix4;
};

type CoastalBoundarySample = {
  height: number;
  normal: Vector3;
  x: number;
  z: number;
};

type TerrainSeamField = {
  ridge: CoastalBoundarySample[];
  ridgeInterior?: CoastalBoundarySample[];
  valley: CoastalBoundarySample[];
  valleyInterior?: CoastalBoundarySample[];
};

type DetailedVegetationMode = "hero" | "mid";
type DetailedTerrainZone = Exclude<V116Zone, "lake">;
type DetailedTerrainMaterialZone = DetailedTerrainZone | "connected";
type PbrTextureSet = { albedo: Texture; arm: Texture; normal: Texture };
type DetailedVegetationPart = SpeciesPart & {
  foliage: boolean;
  sourceKey: string;
};
type WatershedGroundcoverKey = keyof typeof WATERSHED_GROUNDCOVER_URLS;
type WatershedGroundcoverPart = SpeciesPart & { sourceKey: WatershedGroundcoverKey };

type RidgeProductionV116Props = {
  diagnosticMode?: DiagnosticMode;
  mobile: boolean;
  reducedMotion: boolean;
  shadows: boolean;
  showOcean: boolean;
  tier: WorldQualityTier;
  zone: JourneyCheckpointId;
};

function configureCompressedGltf(loader: GLTFLoader) {
  loader.setMeshoptDecoder(MeshoptDecoder);
}

function dispatchStage(stage: number, label: string, zone?: V116Zone) {
  if (typeof window === "undefined") return;
  const detail = { at: performance.now(), label, stage, version: "v1.16", zone };
  const host = window as Window & { __MADAGIN_RIDGE_STAGES_V116__?: typeof detail[] };
  host.__MADAGIN_RIDGE_STAGES_V116__ = [...(host.__MADAGIN_RIDGE_STAGES_V116__ ?? []), detail].slice(-32);
  window.dispatchEvent(new CustomEvent("madagin:ridge-stage", { detail }));
}

function useEcologyManifest(zone: V116Zone) {
  const raw = useLoader(FileLoader, `${ROOT}/ecology-${zone}-v1.16.json`) as unknown;
  return useMemo(() => {
    const source = typeof raw === "string" ? raw : new TextDecoder().decode(raw as ArrayBuffer);
    return JSON.parse(source) as EcologyManifest;
  }, [raw]);
}

function activeChunks(zone: JourneyCheckpointId): V116Zone[] {
  // Lake and its connected water authority are resident before the opening
  // crest. High-detail ecology can still change by chapter, but the visitor
  // must never look through an unloaded basin while the camera reveals it.
  if (zone === "ridge") return ["ridge", "valley", "lake"];
  if (zone === "reveal") return ["ridge", "valley", "lake"];
  if (zone === "lake") return ["valley", "lake", "alpine"];
  if (zone === "waterfall" || zone === "clearing") return ["valley", "lake"];
  // The Summit camera and Ocean pan look almost parallel to the Valley's
  // near z=-315 boundary. Unloading Ridge here exposed that spatial seam as
  // a perfectly vertical "coastline". Keep the three inherited terrain
  // chunks connected for the terminal composition; they share the cached
  // v1.15 desktop source and remain individually streamed on earlier legs.
  return ["ridge", "valley", "alpine"];
}

function activeTerrainChunks(zone: JourneyCheckpointId): Array<Exclude<V116Zone, "lake">> {
  if (zone === "ridge") return ["ridge", "valley"];
  // The authored rail continues seeing terrain across both sides of the active
  // watershed after the crest. Streaming ecology by current/next chapter is
  // still useful, but removing either neighboring landform exposes the source
  // meshes' vertical export walls as black/cyan world cuts. The three desktop
  // objects share one cached v1.15 GLB, and the compact sources are already
  // visited during the complete rail, so retain the terrain continuity shell
  // without retaining every ecology population.
  return ["ridge", "valley", "alpine"];
}

function prepareTexture(texture: Texture) {
  const result = texture.clone();
  result.colorSpace = SRGBColorSpace;
  result.wrapS = RepeatWrapping;
  result.wrapT = RepeatWrapping;
  result.needsUpdate = true;
  return result;
}

function preparePbrTextureSet(source: Texture[], repeat: number): PbrTextureSet {
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

function createTerrainMaterial(forest: Texture, rock: Texture, zone: V116Zone) {
  const material = new MeshStandardMaterial({
    color: zone === "alpine" ? "#807e77" : "#50574b",
    metalness: 0,
    roughness: zone === "alpine" ? 0.82 : 0.94,
    side: FrontSide,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uV116Forest = { value: forest };
    shader.uniforms.uV116Rock = { value: rock };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vV116WorldPosition;\nvarying vec3 vV116WorldNormal;")
      .replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvV116WorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvV116WorldNormal = normalize(mat3(modelMatrix) * objectNormal);",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform sampler2D uV116Forest;
        uniform sampler2D uV116Rock;
        varying vec3 vV116WorldPosition;
        varying vec3 vV116WorldNormal;
        vec3 v116Triplanar(sampler2D source, vec3 p, vec3 n, float scale) {
          vec3 blend = pow(abs(n), vec3(5.0));
          blend /= max(dot(blend, vec3(1.0)), 0.0001);
          vec3 x = texture2D(source, p.zy * scale).rgb;
          vec3 y = texture2D(source, p.xz * scale).rgb;
          vec3 z = texture2D(source, p.xy * scale).rgb;
          return x * blend.x + y * blend.y + z * blend.z;
        }
        float v116Hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float v116Noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(v116Hash(i), v116Hash(i + vec2(1.0, 0.0)), f.x),
            mix(v116Hash(i + vec2(0.0, 1.0)), v116Hash(i + vec2(1.0)), f.x), f.y);
        }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        vec3 worldNormal = normalize(vV116WorldNormal);
        float slope = smoothstep(0.19, 0.74, 1.0 - abs(worldNormal.y));
        float macro = v116Noise(vV116WorldPosition.xz * 0.035) * 0.68
          + v116Noise(vV116WorldPosition.xz * 0.071 + vec2(11.7, -4.3)) * 0.32;
        float micro = v116Noise(vV116WorldPosition.xz * 0.145 + vec2(-6.4, 13.8)) * 0.62
          + v116Noise(vV116WorldPosition.xz * 0.31 + vec2(17.2, 4.1)) * 0.38;
        vec3 forestSample = v116Triplanar(uV116Forest, vV116WorldPosition, worldNormal, 0.052);
        vec3 rockSample = v116Triplanar(uV116Rock, vV116WorldPosition + vec3(19.0, 0.0, -7.0), worldNormal, 0.038);
        float moisture = smoothstep(0.24, 0.76, macro * 0.68 + micro * 0.32);
        vec3 damp = mix(
          vec3(0.078, 0.07, 0.046),
          vec3(0.052, 0.158, 0.068),
          clamp(forestSample * 0.6 + moisture * 0.44, 0.0, 1.0)
        );
        vec3 basalt = mix(vec3(0.075, 0.095, 0.087), vec3(0.265, 0.205, 0.135), rockSample * 0.72);
        float strataPhase = vV116WorldPosition.y * 0.125
          + vV116WorldPosition.x * 0.039
          - vV116WorldPosition.z * 0.017
          + sin((vV116WorldPosition.x + vV116WorldPosition.z) * 0.021) * 1.35
          + macro * 3.2;
        float strata = smoothstep(0.38, 0.86, sin(strataPhase) * 0.5 + 0.5);
        float fracture = v116Noise(vec2(vV116WorldPosition.x * 0.031 - vV116WorldPosition.y * 0.008, vV116WorldPosition.z * 0.025));
        float rainStreak = v116Noise(vec2(vV116WorldPosition.x * 0.018 + vV116WorldPosition.y * 0.009, vV116WorldPosition.z * 0.012));
        vec3 weatheredRock = mix(vec3(0.07, 0.09, 0.082), vec3(0.31, 0.215, 0.12), mix(strata, fracture, 0.56));
        float alpine = smoothstep(90.0, 230.0, vV116WorldPosition.y) * ${zone === "alpine" ? "1.0" : "0.42"};
        vec2 waterfallBasinCoordinate = vec2(
          (vV116WorldPosition.x - 151.0) / 82.0,
          (vV116WorldPosition.z + 696.0) / 62.0
        );
        float waterfallCatchment = 1.0 - smoothstep(0.72, 1.28, length(waterfallBasinCoordinate));
        float wetCliff = waterfallCatchment * smoothstep(0.3, 0.88, slope);
        basalt = mix(basalt, vec3(0.075, 0.105, 0.096), wetCliff * 0.68);
        vec3 ground = mix(damp, basalt, clamp(slope * 1.08 + alpine * 0.54 + wetCliff * 0.58, 0.0, 1.0));
        float regionalExposure = slope * (0.12 + macro * 0.2 + fracture * 0.2) * (1.0 - waterfallCatchment * 0.36);
        ground = mix(ground, weatheredRock, clamp(regionalExposure + smoothstep(0.68, 0.9, rainStreak) * slope * 0.15, 0.0, 0.48));
        ground = mix(ground, vec3(0.04, 0.115, 0.052), (1.0 - slope) * moisture * smoothstep(0.46, 0.82, micro) * 0.24);
        ground = mix(ground, ground * vec3(0.68, 0.82, 0.75), waterfallCatchment * (0.2 + slope * 0.3));
        float westernCliff = smoothstep(-975.0, -948.0, vV116WorldPosition.z)
          * (1.0 - smoothstep(-746.0, -710.0, vV116WorldPosition.z))
          * smoothstep(-296.0, -244.0, vV116WorldPosition.x)
          * (1.0 - smoothstep(-20.0, 32.0, vV116WorldPosition.x))
          * smoothstep(-58.0, -50.0, vV116WorldPosition.y)
          * (1.0 - smoothstep(122.0, 158.0, vV116WorldPosition.y))
          * smoothstep(0.22, 0.72, 1.0 - abs(worldNormal.y));
        vec3 westernCliffRock = mix(
          vec3(0.15, 0.18, 0.16),
          vec3(0.36, 0.255, 0.155),
          clamp(0.16 + strata * 0.38 + fracture * 0.24, 0.0, 0.72)
        );
        ground = mix(ground, westernCliffRock, westernCliff * (0.66 + micro * 0.13));
        vec2 basinHeadwallCoordinate = vec2(
          (vV116WorldPosition.x + 40.0) / 390.0,
          (vV116WorldPosition.z + 805.0) / 240.0
        );
        float basinHeadwall = (1.0 - smoothstep(0.46, 1.08, length(basinHeadwallCoordinate)))
          * smoothstep(-49.0, -34.0, vV116WorldPosition.y)
          * (1.0 - smoothstep(70.0, 98.0, vV116WorldPosition.y))
          * smoothstep(0.22, 0.72, 1.0 - abs(worldNormal.y))
          * (0.22 + smoothstep(7.0, 25.0, abs(vV116WorldPosition.x - 190.0)) * 0.78);
        float basinDrainage = v116Noise(vec2(
          vV116WorldPosition.x * 0.028 + vV116WorldPosition.y * 0.012,
          vV116WorldPosition.z * 0.024 - vV116WorldPosition.y * 0.009
        ));
        vec3 basinHeadwallRock = mix(
          vec3(0.022, 0.035, 0.03),
          vec3(0.225, 0.135, 0.068),
          clamp(0.08 + strata * 0.25 + fracture * 0.15 + basinDrainage * 0.11, 0.0, 0.45)
        );
        basinHeadwallRock = mix(
          basinHeadwallRock,
          vec3(0.04, 0.11, 0.045),
          smoothstep(0.72, 0.92, basinDrainage) * 0.22
        );
        ground = mix(ground, basinHeadwallRock, basinHeadwall * (0.8 + micro * 0.1));
        float alpineInterior = ${zone === "alpine" ? "1.0" : "0.0"}
          * smoothstep(-1665.0, -1590.0, vV116WorldPosition.z)
          * (1.0 - smoothstep(-1080.0, -1008.0, vV116WorldPosition.z))
          * smoothstep(-940.0, -850.0, vV116WorldPosition.x)
          * (1.0 - smoothstep(850.0, 940.0, vV116WorldPosition.x))
          * smoothstep(36.0, 92.0, vV116WorldPosition.y);
        float alpineDrainage = v116Noise(vec2(
          vV116WorldPosition.x * 0.012 + vV116WorldPosition.z * 0.0045,
          vV116WorldPosition.y * 0.018 - vV116WorldPosition.z * 0.007
        ));
        float alpineOxidation = v116Noise(
          vV116WorldPosition.xz * 0.0065
            + vec2(vV116WorldPosition.y * 0.004, -vV116WorldPosition.y * 0.003)
        );
        float alpineExposure = alpineInterior * clamp(
          0.18
            + slope * 0.66
            + smoothstep(0.58, 0.9, fracture) * 0.18
            + smoothstep(0.62, 0.9, alpineDrainage) * 0.12,
          0.0,
          0.88
        );
        vec3 alpineBasalt = mix(
          vec3(0.075, 0.09, 0.085),
          vec3(0.39, 0.27, 0.14),
          clamp(
            smoothstep(0.48, 0.82, alpineOxidation) * 0.58
              + strata * 0.16
              + fracture * 0.1,
            0.0,
            0.78
          )
        );
        ground = mix(ground, alpineBasalt, alpineExposure);
        ground *= 0.88 + macro * 0.17;
        diffuseColor.rgb = ground;`,
      )
      .replace(
        "#include <lights_fragment_end>",
        `#include <lights_fragment_end>
        reflectedLight.indirectDiffuse += westernCliff
          * westernCliffRock
          * (0.11 + strata * 0.045);
        reflectedLight.indirectDiffuse += basinHeadwall
          * basinHeadwallRock
          * (0.085 + basinDrainage * 0.045);`,
      );
  };
  material.customProgramCacheKey = () => `madagin-v116-triplanar-ap8-${zone}`;
  material.name = `Madagin v1.16 triplanar ${zone} terrain`;
  return material;
}

function TerrainChunk({ shadows, zone }: { shadows: boolean; zone: Exclude<V116Zone, "lake"> }) {
  const gltf = useLoader(GLTFLoader, `${ROOT}/terrain-${zone}-v1.16.glb`, configureCompressedGltf);
  const sourceTextures = useLoader(TextureLoader, GROUND_TEXTURE_URLS) as Texture[];
  const textures = useMemo(() => sourceTextures.map(prepareTexture), [sourceTextures]);
  const material = useMemo(() => createTerrainMaterial(textures[0], textures[1], zone), [textures, zone]);
  const alpineGeometry = useMemo(() => {
    if (zone !== "alpine") return null;
    gltf.scene.updateMatrixWorld(true);
    const source = firstMeshIn(gltf.scene);
    return source ? createAlpineGeologyTerrainGeometry(source, "compact") : null;
  }, [gltf.scene, zone]);
  const watershedGeometry = useMemo(() => {
    if (zone !== "valley") return null;
    gltf.scene.updateMatrixWorld(true);
    const source = firstMeshIn(gltf.scene);
    return source ? createIntegratedWatershedTerrainGeometry(source, [], [], 0, 0) : null;
  }, [gltf.scene, zone]);
  const scene = useMemo(() => {
    if (alpineGeometry) return null;
    const result = gltf.scene.clone(true);
    result.traverse((child) => {
      if (child instanceof Mesh) {
        if (watershedGeometry) child.geometry = watershedGeometry;
        child.material = material;
        child.castShadow = shadows && zone === "ridge";
        child.receiveShadow = true;
      }
    });
    return result;
  }, [alpineGeometry, gltf.scene, material, shadows, watershedGeometry, zone]);

  useEffect(() => {
    if (alpineGeometry) {
      const host = window as Window & { __MADAGIN_ALPINE_GEOLOGY_V116__?: Record<string, unknown> };
      host.__MADAGIN_ALPINE_GEOLOGY_V116__ = {
        ...(host.__MADAGIN_ALPINE_GEOLOGY_V116__ ?? {}),
        compact: alpineGeometry.userData.alpineGeology ?? null,
      };
      document.documentElement.dataset.madaginAlpineGeologyV116 = JSON.stringify(host.__MADAGIN_ALPINE_GEOLOGY_V116__);
      dispatchStage(2, "alpine-compact-fractured-source-terrain-ready", "alpine");
    }
    dispatchStage(zone === "ridge" ? 0 : 1, `${zone}-terrain-ready`, zone);
    return () => {
      alpineGeometry?.dispose();
      watershedGeometry?.dispose();
      material.dispose();
      textures.forEach((texture) => texture.dispose());
    };
  }, [alpineGeometry, material, textures, watershedGeometry, zone]);

  return alpineGeometry ? (
    <mesh geometry={alpineGeometry} material={material} name="Madagin v1.16 compact fractured Alpine terrain" receiveShadow />
  ) : scene ? <primitive object={scene} /> : null;
}

function firstMeshIn(object: Object3D): Mesh | null {
  let result: Mesh | null = null;
  object.traverse((child) => {
    if (!result && child instanceof Mesh) result = child;
  });
  return result;
}

function CompactJourneyTerrain({ shadows }: { shadows: boolean }) {
  const ridgeGltf = useLoader(GLTFLoader, `${ROOT}/terrain-ridge-v1.16.glb`, configureCompressedGltf);
  const valleyGltf = useLoader(GLTFLoader, `${ROOT}/terrain-valley-v1.16.glb`, configureCompressedGltf);
  const sourceTextures = useLoader(TextureLoader, GROUND_TEXTURE_URLS) as Texture[];
  const textures = useMemo(() => sourceTextures.map(prepareTexture), [sourceTextures]);
  const ridgeMaterial = useMemo(() => createTerrainMaterial(textures[0], textures[1], "ridge"), [textures]);
  const valleyMaterial = useMemo(() => createTerrainMaterial(textures[0], textures[1], "valley"), [textures]);
  const sources = useMemo(() => {
    ridgeGltf.scene.updateMatrixWorld(true);
    valleyGltf.scene.updateMatrixWorld(true);
    return { ridge: firstMeshIn(ridgeGltf.scene), valley: firstMeshIn(valleyGltf.scene) };
  }, [ridgeGltf.scene, valleyGltf.scene]);
  const geometries = useMemo(() => {
    if (!sources.ridge || !sources.valley) {
      return { bridge: null, diagnostics: null, ridge: null, valley: null };
    }
    const ridge = geometrySurfaceForMerge(sources.ridge.geometry, sources.ridge.matrixWorld);
    // The compact camera resolves the source mesh's waterline crossings as
    // visible steps. Two conforming shared-edge passes refine only the actual
    // analytic shoreline and its immediate triangle neighbors. That retained
    // AO density is already sufficient for the bounded basin-headwall relief,
    // so compact does not stack another adaptive pass on the same Valley.
    const valley = createIntegratedWatershedTerrainGeometry(sources.valley, [], [], 2, 0);
    const ridgeMesh = new Mesh(ridge);
    const valleyMesh = new Mesh(valley);
    const ridgeBoundary = extractTerrainSeamSamples(ridgeMesh);
    const valleyBoundary = extractTerrainSeamSamples(valleyMesh);
    const field: TerrainSeamField = {
      ridge: ridgeBoundary,
      ridgeInterior: ridgeBoundary.length
        ? extractTerrainSeamSamples(ridgeMesh, ridgeBoundary[0].z + 28)
        : [],
      valley: valleyBoundary,
      valleyInterior: valleyBoundary.length
        ? extractTerrainSeamSamples(valleyMesh, valleyBoundary[0].z - 28)
        : [],
    };
    const bridge = createExactBoundaryTerrainSeamBridge(field);
    const removedRidgeWallTriangles = ridgeBoundary.length
      ? removeCoplanarBoundaryWall(ridge, "z", ridgeBoundary[0].z)
      : 0;
    const removedValleyWallTriangles = valleyBoundary.length
      ? removeCoplanarBoundaryWall(valley, "z", valleyBoundary[0].z)
      : 0;
    ridge.computeVertexNormals();
    ridge.computeBoundingBox();
    ridge.computeBoundingSphere();
    const diagnostics = bridge ? {
      ...bridge.userData.terminalSeamRemesh,
      lakeShorelineSubdivision: (
        valley.userData.watershedIntegration as { subdivision?: unknown } | undefined
      )?.subdivision ?? null,
      removedRidgeWallTriangles,
      removedValleyWallTriangles,
      scope: "normal compact journey Ridge-to-Valley connector",
    } : null;
    ridge.name = "Madagin v1.16 compact journey Ridge terrain without terminal wall";
    valley.name = "Madagin v1.16 compact journey integrated Valley terrain without near wall";
    return { bridge, diagnostics, ridge, valley };
  }, [sources]);
  useEffect(() => {
    const host = window as Window & { __MADAGIN_COMPACT_JOURNEY_SEAM_V116__?: Record<string, unknown> };
    host.__MADAGIN_COMPACT_JOURNEY_SEAM_V116__ = geometries.diagnostics ?? {};
    document.documentElement.dataset.madaginCompactJourneySeamV116 = JSON.stringify(
      host.__MADAGIN_COMPACT_JOURNEY_SEAM_V116__,
    );
    dispatchStage(0, "ridge-terrain-ready", "ridge");
    dispatchStage(1, "valley-terrain-ready", "valley");
    dispatchStage(1, "compact-journey-ridge-valley-zipper-ready", "valley");
    return () => {
      geometries.bridge?.dispose();
      geometries.ridge?.dispose();
      geometries.valley?.dispose();
      ridgeMaterial.dispose();
      valleyMaterial.dispose();
      textures.forEach((texture) => texture.dispose());
    };
  }, [geometries, ridgeMaterial, textures, valleyMaterial]);
  return (
    <group name="Madagin v1.16 exact-boundary compact journey Ridge-to-Valley terrain">
      {geometries.ridge ? (
        <mesh castShadow={shadows} geometry={geometries.ridge} material={ridgeMaterial} receiveShadow />
      ) : null}
      {geometries.bridge ? (
        <mesh geometry={geometries.bridge} material={valleyMaterial} receiveShadow />
      ) : null}
      {geometries.valley ? (
        <mesh geometry={geometries.valley} material={valleyMaterial} receiveShadow />
      ) : null}
    </group>
  );
}

function MobileTerminalTerrain({ shadows, tier }: { shadows: boolean; tier: WorldQualityTier }) {
  const ridgeGltf = useLoader(GLTFLoader, `${ROOT}/terrain-ridge-v1.16.glb`, configureCompressedGltf);
  const valleyGltf = useLoader(GLTFLoader, `${ROOT}/terrain-valley-v1.16.glb`, configureCompressedGltf);
  const sourceTextures = useLoader(TextureLoader, GROUND_TEXTURE_URLS) as Texture[];
  const textures = useMemo(() => sourceTextures.map(prepareTexture), [sourceTextures]);
  const material = useMemo(() => createTerrainMaterial(textures[0], textures[1], "ridge"), [textures]);
  const sources = useMemo(() => {
    ridgeGltf.scene.updateMatrixWorld(true);
    valleyGltf.scene.updateMatrixWorld(true);
    return { ridge: firstMeshIn(ridgeGltf.scene), valley: firstMeshIn(valleyGltf.scene) };
  }, [ridgeGltf.scene, valleyGltf.scene]);
  const seamField = useMemo<TerrainSeamField>(() => {
    const ridge = sources.ridge ? extractTerrainSeamSamples(sources.ridge) : [];
    const valley = sources.valley ? extractTerrainSeamSamples(sources.valley) : [];
    return {
      ridge,
      ridgeInterior: sources.ridge && ridge.length
        ? extractTerrainSeamSamples(sources.ridge, ridge[0].z + 28)
        : [],
      valley,
      valleyInterior: sources.valley && valley.length
        ? extractTerrainSeamSamples(sources.valley, valley[0].z - 28)
        : [],
    };
  }, [sources]);
  const coastalBoundary = useMemo(
    () => sources.ridge ? extractCoastalBoundarySamples(sources.ridge, -310) : [],
    [sources.ridge],
  );
  const geometries = useMemo(() => {
    if (!sources.ridge || !sources.valley || !coastalBoundary.length) {
      return { connected: null, seamDiagnostics: null };
    }
    const shoulder = createCoastalShoulderGeometry(true, tier, coastalBoundary);
    const ridge = createConnectedRidgeGeometry(sources.ridge, shoulder);
    shoulder.dispose();
    const connectedRidge = ridge ? new Mesh(ridge) : null;
    const connectedRidgeBoundary = connectedRidge ? extractTerrainSeamSamples(connectedRidge) : [];
    const connectedSeamField = ridge
      ? {
          ridge: connectedRidgeBoundary,
          ridgeInterior: connectedRidgeBoundary.length
            ? extractTerrainSeamSamples(connectedRidge as Mesh, connectedRidgeBoundary[0].z + 28)
            : [],
          valley: seamField.valley,
          valleyInterior: seamField.valleyInterior,
        }
      : seamField;
    const bridge = connectedSeamField.ridge.length && connectedSeamField.valley.length
      ? createTerrainSeamBridgeGeometry(connectedSeamField, true)
      : null;
    const valley = createTerminalChunkGeometry(sources.valley, connectedSeamField);
    const seamDiagnostics = bridge ? {
      ...bridge.userData.terminalSeamRemesh,
      coastalWeld: ridge?.userData.coastalWeldDiagnostics ?? null,
      removedValleyTerminalWallTriangles: valley.userData.removedTerminalWallTriangles ?? 0,
    } : null;
    const connected = ridge && bridge
      ? createConnectedTerminalTerrainGeometry(ridge, bridge, valley, seamDiagnostics)
      : null;
    ridge?.dispose();
    bridge?.dispose();
    valley.dispose();
    return { connected, seamDiagnostics: connected?.userData.terminalSeamRemesh ?? seamDiagnostics };
  }, [coastalBoundary, seamField, sources, tier]);
  const coastalPlacements = useMemo(() => {
    if (!coastalBoundary.length) return [];
    const shoulder = createCoastalShoulderGeometry(true, tier, coastalBoundary);
    const placements = createCoastalPlacements(shoulder, true, tier);
    shoulder.dispose();
    return placements;
  }, [coastalBoundary, tier]);
  useEffect(() => {
    const host = window as Window & { __MADAGIN_COMPACT_TERMINAL_WELD_V116__?: Record<string, unknown> };
    host.__MADAGIN_COMPACT_TERMINAL_WELD_V116__ = geometries.seamDiagnostics ?? {};
    document.documentElement.dataset.madaginCompactTerminalWeldV116 = JSON.stringify(host.__MADAGIN_COMPACT_TERMINAL_WELD_V116__);
    dispatchStage(1, "summit-tangent-remeshed-mobile-ridge-valley-ready", "ridge");
    return () => {
      geometries.connected?.dispose();
      material.dispose();
      textures.forEach((texture) => texture.dispose());
    };
  }, [geometries, material, textures]);
  return (
    <group name="Madagin v1.16 seam-smoothed mobile terminal terrain">
      {geometries.connected ? (
        <mesh
          castShadow={shadows}
          geometry={geometries.connected}
          material={material}
          name="Madagin v1.16 welded compact ridge-coast-valley terminal terrain"
          receiveShadow
        />
      ) : null}
      {coastalPlacements.length ? <CoastalEcology placements={coastalPlacements} shadows={shadows} /> : null}
    </group>
  );
}

const DETAILED_TERRAIN_OBJECTS: Record<DetailedTerrainZone, string> = {
  ridge: "RIDGE_V115_HIGH",
  valley: "TROPICAL_VALLEY_V115_HIGH",
  alpine: "ALPINE_VALLEY_V115_HIGH",
};

function createDetailedTerrainMaterial(zone: DetailedTerrainMaterialZone, textures: PbrTextureSet) {
  const material = new MeshStandardMaterial({
    aoMap: textures.arm,
    // The v1.15 Valley ARM source was authored for a different light rig. Its
    // full-strength AO crushed steep west-facing geometry to near black under
    // the retained v1.16 sun. Preserve the map, but keep dynamic shadow and
    // sky fill responsible for the broad cliff response.
    aoMapIntensity: zone === "alpine" ? 0.96 : zone === "valley" ? 0.68 : zone === "connected" ? 0.9 : 0.92,
    color: "#ffffff",
    map: textures.albedo,
    metalness: 0,
    normalMap: textures.normal,
    normalScale: new Vector2(
      zone === "alpine" ? 0.92 : zone === "valley" ? 0.76 : zone === "connected" ? 0.68 : 0.72,
      zone === "alpine" ? 0.92 : zone === "valley" ? 0.76 : zone === "connected" ? 0.68 : 0.72,
    ),
    roughness: zone === "alpine" ? 0.88 : zone === "ridge" ? 0.91 : zone === "connected" ? 0.92 : 0.93,
    roughnessMap: textures.arm,
    side: FrontSide,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vDetailedTerrainWorld;\nvarying vec3 vDetailedTerrainNormal;",
      )
      .replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvDetailedTerrainWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvDetailedTerrainNormal = normalize(mat3(modelMatrix) * objectNormal);",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vDetailedTerrainWorld;
        varying vec3 vDetailedTerrainNormal;
        float detailedTerrainHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
        float detailedTerrainNoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(detailedTerrainHash(i), detailedTerrainHash(i + vec2(1.0, 0.0)), f.x),
            mix(detailedTerrainHash(i + vec2(0.0, 1.0)), detailedTerrainHash(i + vec2(1.0)), f.x), f.y);
        }
        float detailedTerrainFbm(vec2 p) {
          float value = 0.0; float amplitude = 0.55;
          for (int i = 0; i < 3; i++) {
            value += detailedTerrainNoise(p) * amplitude; p = p * 2.03 + 7.13; amplitude *= 0.48;
          }
          return value;
        }`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        float terrainMicroCenter = detailedTerrainFbm(vDetailedTerrainWorld.xz * ${zone === "alpine" ? "0.21" : "0.29"} + 91.7);
        float terrainMicroX = detailedTerrainFbm((vDetailedTerrainWorld.xz + vec2(0.32, 0.0)) * ${zone === "alpine" ? "0.21" : "0.29"} + 91.7);
        float terrainMicroZ = detailedTerrainFbm((vDetailedTerrainWorld.xz + vec2(0.0, 0.32)) * ${zone === "alpine" ? "0.21" : "0.29"} + 91.7);
        float terrainMicroSlope = smoothstep(0.08, 0.82, 1.0 - abs(normalize(vDetailedTerrainNormal).y));
        vec3 terrainMicroWorldNormal = normalize(
          normalize(vDetailedTerrainNormal)
            + vec3(terrainMicroCenter - terrainMicroX, 0.0, terrainMicroCenter - terrainMicroZ)
              * mix(1.45, 2.55, terrainMicroSlope)
        );
        normal = normalize(mix(
          normal,
          normalize(mat3(viewMatrix) * terrainMicroWorldNormal),
          ${zone === "connected" ? "0.2" : zone === "valley" ? "0.24" : zone === "alpine" ? "0.28" : "0.23"}
        ));`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float terrainValley = ${zone === "connected" ? "1.0 - smoothstep(-365.0, -275.0, vDetailedTerrainWorld.z)" : zone === "valley" ? "1.0" : "0.0"};
        float macroScale = ${zone === "alpine" ? "0.0065" : zone === "connected" ? "mix(0.018, 0.0095, terrainValley)" : zone === "valley" ? "0.0095" : "0.018"};
        float macro = detailedTerrainFbm(vDetailedTerrainWorld.xz * macroScale);
        float detail = detailedTerrainFbm(vDetailedTerrainWorld.xz * ${zone === "alpine" ? "0.027" : zone === "connected" ? "mix(0.052, 0.043, terrainValley)" : zone === "valley" ? "0.043" : "0.052"} + 31.7);
        float slope = smoothstep(${zone === "alpine" ? "0.16, 0.7" : "0.2, 0.74"}, 1.0 - abs(normalize(vDetailedTerrainNormal).y));
        float elevation = smoothstep(${zone === "alpine" ? "18.0, 178.0" : "-34.0, 92.0"}, vDetailedTerrainWorld.y);
        float drainage = detailedTerrainNoise(vDetailedTerrainWorld.xz * 0.017 - vec2(9.1, 3.7));
        vec3 dampSoil = ${zone === "alpine" ? "vec3(0.155, 0.155, 0.145)" : zone === "connected" ? "mix(vec3(0.085, 0.074, 0.052), vec3(0.052, 0.088, 0.052), terrainValley)" : zone === "valley" ? "vec3(0.052, 0.088, 0.052)" : "vec3(0.085, 0.074, 0.052)"};
        vec3 moss = ${zone === "alpine" ? "vec3(0.175, 0.19, 0.17)" : zone === "connected" ? "mix(vec3(0.085, 0.17, 0.062), vec3(0.052, 0.15, 0.07), terrainValley)" : zone === "valley" ? "vec3(0.052, 0.15, 0.07)" : "vec3(0.085, 0.17, 0.062)"};
        vec3 litter = ${zone === "alpine" ? "vec3(0.225, 0.215, 0.19)" : zone === "connected" ? "mix(vec3(0.235, 0.155, 0.078), vec3(0.205, 0.135, 0.07), terrainValley)" : zone === "ridge" ? "vec3(0.235, 0.155, 0.078)" : "vec3(0.205, 0.135, 0.07)"};
        vec3 basalt = ${zone === "alpine" ? "vec3(0.235, 0.245, 0.235)" : "vec3(0.12, 0.14, 0.127)"};
        vec3 sourceSurface = diffuseColor.rgb;
        vec3 ground = mix(dampSoil, moss, smoothstep(0.32, 0.74, macro));
        ground = mix(ground, litter, smoothstep(0.76, 0.94, detail) * (1.0 - drainage * 0.48));
        vec3 authoredGround = mix(ground, basalt, clamp(slope * (0.94 + detail * 0.28) + ${zone === "alpine" ? "elevation * 0.48" : "0.0"}, 0.0, 1.0));
        float fractureField = detailedTerrainFbm(vec2(
          vDetailedTerrainWorld.x * 0.11 + vDetailedTerrainWorld.y * 0.028,
          vDetailedTerrainWorld.z * 0.095 - vDetailedTerrainWorld.y * 0.041
        ) + 14.9);
        float crossingFracture = detailedTerrainFbm(vec2(
          vDetailedTerrainWorld.z * 0.16 - vDetailedTerrainWorld.y * 0.019,
          vDetailedTerrainWorld.x * 0.13 + vDetailedTerrainWorld.y * 0.033
        ) - 8.4);
        float openFissure = smoothstep(0.76, 0.91, fractureField)
          * smoothstep(0.62, 0.84, crossingFracture)
          * (0.18 + slope * 0.82);
        authoredGround = mix(authoredGround, authoredGround * vec3(0.43, 0.52, 0.48), openFissure * 0.54);
        vec2 waterfallBasinCoordinate = vec2(
          (vDetailedTerrainWorld.x - 151.0) / 92.0,
          (vDetailedTerrainWorld.z + 696.0) / 70.0
        );
        float waterfallCatchment = 1.0 - smoothstep(0.72, 1.32, length(waterfallBasinCoordinate));
        float upperChannel = (1.0 - smoothstep(8.0, 34.0, abs(vDetailedTerrainWorld.x - (190.0 + clamp((-vDetailedTerrainWorld.z - 730.0) / 94.0, 0.0, 1.0) * 11.2))))
          * smoothstep(-836.0, -818.0, vDetailedTerrainWorld.z)
          * (1.0 - smoothstep(-742.0, -724.0, vDetailedTerrainWorld.z));
        float cliffExposure = smoothstep(0.25, 0.78, slope) * (0.38 + waterfallCatchment * 0.72 + upperChannel * 0.24);
        float strataPhase = vDetailedTerrainWorld.y * 0.115
          + vDetailedTerrainWorld.x * 0.042
          - vDetailedTerrainWorld.z * 0.02
          + sin((vDetailedTerrainWorld.x + vDetailedTerrainWorld.z) * 0.018) * 1.4
          + detail * 3.0;
        float strata = smoothstep(0.36, 0.86, sin(strataPhase) * 0.5 + 0.5);
        float erosionalRibs = detailedTerrainNoise(vec2(vDetailedTerrainWorld.x * 0.024 + vDetailedTerrainWorld.y * 0.009, vDetailedTerrainWorld.z * 0.019 - vDetailedTerrainWorld.y * 0.004));
        vec3 wetBasalt = vec3(0.075, 0.105, 0.092);
        vec3 oxidizedRock = vec3(0.33, 0.235, 0.135);
        vec3 exposedGeology = mix(wetBasalt, oxidizedRock, mix(strata, erosionalRibs, 0.74) * (0.42 + (1.0 - drainage) * 0.25));
        float regionalGeologyAuthority = smoothstep(0.18, 0.7, slope)
          * (0.075 + detail * 0.16 + smoothstep(0.58, 0.9, erosionalRibs) * 0.085)
          * (1.0 - waterfallCatchment * 0.42);
        float waterfallGeologyAuthority = clamp(
          cliffExposure * (0.5 + detail * 0.3)
            + waterfallCatchment * (0.18 + detail * 0.18)
            + regionalGeologyAuthority,
          0.0,
          0.68
        );
        authoredGround = mix(authoredGround, exposedGeology, waterfallGeologyAuthority);
        authoredGround = mix(authoredGround, authoredGround * vec3(0.62, 0.75, 0.68), waterfallCatchment * (0.26 + slope * 0.3));
        float westernCliff = terrainValley
          * smoothstep(-975.0, -948.0, vDetailedTerrainWorld.z)
          * (1.0 - smoothstep(-746.0, -710.0, vDetailedTerrainWorld.z))
          * smoothstep(-296.0, -244.0, vDetailedTerrainWorld.x)
          * (1.0 - smoothstep(-20.0, 32.0, vDetailedTerrainWorld.x))
          * smoothstep(-58.0, -50.0, vDetailedTerrainWorld.y)
          * (1.0 - smoothstep(122.0, 158.0, vDetailedTerrainWorld.y))
          * smoothstep(0.22, 0.72, 1.0 - abs(normalize(vDetailedTerrainNormal).y));
        vec3 westernWetBasalt = vec3(0.16, 0.19, 0.17);
        vec3 westernOxidizedRock = vec3(0.38, 0.275, 0.17);
        vec3 westernCliffRock = mix(
          westernWetBasalt,
          westernOxidizedRock,
          clamp(0.18 + strata * 0.36 + erosionalRibs * 0.24, 0.0, 0.72)
        );
        authoredGround = mix(authoredGround, westernCliffRock, westernCliff * (0.72 + detail * 0.14));
        vec2 basinHeadwallCoordinate = vec2(
          (vDetailedTerrainWorld.x + 40.0) / 390.0,
          (vDetailedTerrainWorld.z + 805.0) / 240.0
        );
        float basinHeadwall = terrainValley
          * (1.0 - smoothstep(0.46, 1.08, length(basinHeadwallCoordinate)))
          * smoothstep(-49.0, -34.0, vDetailedTerrainWorld.y)
          * (1.0 - smoothstep(70.0, 98.0, vDetailedTerrainWorld.y))
          * smoothstep(0.22, 0.72, 1.0 - abs(normalize(vDetailedTerrainNormal).y))
          * (0.22 + smoothstep(7.0, 25.0, abs(vDetailedTerrainWorld.x - 190.0)) * 0.78);
        float basinDrainage = detailedTerrainNoise(vec2(
          vDetailedTerrainWorld.x * 0.026 + vDetailedTerrainWorld.y * 0.011,
          vDetailedTerrainWorld.z * 0.023 - vDetailedTerrainWorld.y * 0.008
        ));
        vec3 basinHeadwallRock = mix(
          vec3(0.02, 0.033, 0.029),
          vec3(0.225, 0.145, 0.078),
          clamp(0.09 + strata * 0.26 + erosionalRibs * 0.15 + basinDrainage * 0.11, 0.0, 0.47)
        );
        basinHeadwallRock = mix(
          basinHeadwallRock,
          vec3(0.038, 0.105, 0.043),
          smoothstep(0.71, 0.91, basinDrainage) * 0.24
        );
        authoredGround = mix(authoredGround, basinHeadwallRock, basinHeadwall * (0.84 + detail * 0.08));
        float alpineInterior = ${zone === "alpine" ? "1.0" : "0.0"}
          * smoothstep(-1665.0, -1590.0, vDetailedTerrainWorld.z)
          * (1.0 - smoothstep(-1080.0, -1008.0, vDetailedTerrainWorld.z))
          * smoothstep(-940.0, -850.0, vDetailedTerrainWorld.x)
          * (1.0 - smoothstep(850.0, 940.0, vDetailedTerrainWorld.x))
          * smoothstep(36.0, 92.0, vDetailedTerrainWorld.y);
        float alpineDrainage = detailedTerrainNoise(vec2(
          vDetailedTerrainWorld.x * 0.012 + vDetailedTerrainWorld.z * 0.0045,
          vDetailedTerrainWorld.y * 0.018 - vDetailedTerrainWorld.z * 0.007
        ));
        float alpineOxidation = detailedTerrainNoise(
          vDetailedTerrainWorld.xz * 0.0065
            + vec2(vDetailedTerrainWorld.y * 0.004, -vDetailedTerrainWorld.y * 0.003)
        );
        float alpineExposure = alpineInterior * clamp(
          0.2
            + slope * 0.68
            + smoothstep(0.58, 0.9, erosionalRibs) * 0.18
            + smoothstep(0.62, 0.9, alpineDrainage) * 0.12,
          0.0,
          0.9
        );
        vec3 alpineBasalt = mix(
          vec3(0.06, 0.078, 0.076),
          vec3(0.235, 0.205, 0.165),
          clamp(
            smoothstep(0.48, 0.82, alpineOxidation) * 0.58
              + strata * 0.17
              + erosionalRibs * 0.1,
            0.0,
            0.64
          )
        );
        authoredGround = mix(authoredGround, alpineBasalt, alpineExposure);
        // Give the shared lake boundary a readable littoral transition on the
        // source terrain itself. This is material response on the active bank,
        // not a detached shoreline collar: the same broad basin harmonics used
        // by the water/terrain authority locate damp rock and deposited silt.
        vec2 lakeCoordinate = vec2(
          (vDetailedTerrainWorld.x + 2.04) / 152.816,
          (vDetailedTerrainWorld.z + 884.765) / 118.075
        );
        float lakeAngle = atan(lakeCoordinate.y, lakeCoordinate.x);
        float lakeBoundaryApproximation = 1.0
          + sin(lakeAngle * 2.0 - 0.4) * 0.135
          + sin(lakeAngle * 3.0 + 0.9) * 0.082
          + sin(lakeAngle * 5.0 - 1.3) * 0.034;
        float lakeRadialDistance = length(lakeCoordinate) / max(0.72, lakeBoundaryApproximation);
        float littoralBand = terrainValley
          * smoothstep(0.9, 0.985, lakeRadialDistance)
          * (1.0 - smoothstep(1.0, 1.17, lakeRadialDistance))
          * (1.0 - smoothstep(-45.0, -18.0, vDetailedTerrainWorld.y));
        vec3 wetLittoralRock = mix(
          vec3(0.025, 0.052, 0.045),
          vec3(0.115, 0.105, 0.068),
          clamp(detail * 0.45 + drainage * 0.3, 0.0, 0.68)
        );
        authoredGround = mix(authoredGround, wetLittoralRock, littoralBand * (0.62 + slope * 0.2));
        float sourceLuminance = dot(sourceSurface, vec3(0.2126, 0.7152, 0.0722));
        vec3 sourceChroma = clamp(sourceSurface / max(sourceLuminance, 0.08), vec3(0.62), vec3(1.42));
        float mineralGrain = detailedTerrainFbm(vec2(
          vDetailedTerrainWorld.x * 0.19 - vDetailedTerrainWorld.z * 0.037,
          vDetailedTerrainWorld.z * 0.17 + vDetailedTerrainWorld.y * 0.061
        ) + 63.2);
        vec3 microSurface = sourceChroma
          * clamp(sourceLuminance * ${zone === "alpine" ? "1.18" : "1.34"}, 0.52, 1.28)
          * mix(0.86, 1.11, mineralGrain);
        float sourceAuthority = ${zone === "connected" ? "mix(0.48, 0.58, terrainValley)" : zone === "ridge" ? "0.48" : zone === "valley" ? "0.58" : "0.68"};
        diffuseColor.rgb = authoredGround * mix(vec3(0.86), microSurface, sourceAuthority);`,
      )
      .replace(
        "#include <lights_fragment_end>",
        `#include <lights_fragment_end>
        // The enclosed west wall receives very little direct sun. A bounded,
        // world-space rock bounce preserves the valley's physical lighting
        // hierarchy while keeping its fractures legible instead of black.
        reflectedLight.indirectDiffuse += westernCliff
          * westernCliffRock
          * (0.13 + strata * 0.055);
        reflectedLight.indirectDiffuse += basinHeadwall
          * basinHeadwallRock
          * (0.095 + basinDrainage * 0.05);`,
      );
  };
  material.customProgramCacheKey = () => `madagin-v120-volcanic-microrelief-${zone}`;
  material.name = `Madagin v1.20 micro-relief volcanic PBR ${zone} terrain`;
  return material;
}

const LAKE_CENTER = { x: -2.04, z: -884.765 } as const;
const LAKE_RADIUS = { x: 152.816, z: 118.075 } as const;
const LAKE_WATER_LEVEL = -47.9439;
const WATERFALL_TOP = { x: 190, y: 19.2, z: -730 } as const;
const WATERFALL_BOTTOM = { x: 154, y: -43.7, z: -704 } as const;
const PLUNGE_POOL_CENTER = { x: 151, z: -696 } as const;

function saturate(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothRange(edge0: number, edge1: number, value: number) {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  return smoothCoastalStep((value - edge0) / (edge1 - edge0));
}

const WATERFALL_HEADWATER_START_Z = -858;

function waterfallUpperProgress(z: number) {
  return saturate((-z - 730) / Math.abs(WATERFALL_HEADWATER_START_Z + 730));
}

function waterfallUpperCenter(z: number) {
  const progress = waterfallUpperProgress(z);
  return WATERFALL_TOP.x
    + progress * 13.8
    + Math.sin(progress * Math.PI * 2.1 + 0.25) * 2.35
    + Math.sin(progress * Math.PI * 5.4 - 0.8) * 0.72;
}

function waterfallUpperLevel(z: number) {
  const progress = waterfallUpperProgress(z);
  const riffleA = smoothRange(0.16, 0.24, progress);
  const riffleB = smoothRange(0.5, 0.6, progress);
  const riffleC = smoothRange(0.76, 0.84, progress);
  return WATERFALL_TOP.y
    + progress * 5.25
    + riffleA * 0.32
    + riffleB * 0.42
    + riffleC * 0.28
    + Math.sin(progress * Math.PI * 6.4) * 0.12;
}

function waterfallUpperHalfWidth(z: number) {
  const progress = waterfallUpperProgress(z);
  const sourceTaper = 1 - smoothRange(0.72, 1, progress) * 0.86;
  const channelWidth = 4.45
    - progress * 1.7
    + Math.sin(progress * Math.PI * 4.6 + 0.45) * 0.3
    + Math.sin(progress * Math.PI * 9.2 - 0.7) * 0.12;
  return Math.max(0.48, channelWidth * sourceTaper);
}

function waterfallUpperBankWidth(z: number, side: number) {
  const progress = waterfallUpperProgress(z);
  const asymmetry = Math.sin(progress * Math.PI * 7.3 + side * 1.7) * 0.12
    + Math.sin(progress * Math.PI * 13.1 - side * 0.8) * 0.055;
  return waterfallUpperHalfWidth(z) * (1 + asymmetry * side);
}

function waterfallOutflowCenter(progress: number) {
  const inverse = 1 - progress;
  const start = PLUNGE_POOL_CENTER;
  const control = { x: 122, z: -736 };
  const end = {
    x: v116RiverCenter(-757) + v116RiverHalfWidth(-757) + 1.4,
    z: -757,
  };
  return {
    x: inverse * inverse * start.x + 2 * inverse * progress * control.x + progress * progress * end.x,
    z: inverse * inverse * start.z + 2 * inverse * progress * control.z + progress * progress * end.z,
  };
}

function distanceToWaterfallOutflow(x: number, z: number) {
  let closest = Number.POSITIVE_INFINITY;
  let previous = waterfallOutflowCenter(0);
  for (let sample = 1; sample <= 14; sample += 1) {
    const current = waterfallOutflowCenter(sample / 14);
    const dx = current.x - previous.x;
    const dz = current.z - previous.z;
    const lengthSquared = dx * dx + dz * dz;
    const along = lengthSquared > 0
      ? saturate(((x - previous.x) * dx + (z - previous.z) * dz) / lengthSquared)
      : 0;
    const nearestX = previous.x + dx * along;
    const nearestZ = previous.z + dz * along;
    closest = Math.min(closest, Math.hypot(x - nearestX, z - nearestZ));
    previous = current;
  }
  return closest;
}

function lakeBoundaryFeature(angle: number, center: number, width: number) {
  const wrappedDistance = Math.atan2(Math.sin(angle - center), Math.cos(angle - center));
  return Math.exp(-0.5 * Math.pow(wrappedDistance / width, 2));
}

function lakeBoundaryScale(angle: number) {
  const broadBasin = 1
    + Math.sin(angle * 2 - 0.4) * 0.135
    + Math.sin(angle * 3 + 0.9) * 0.082
    + Math.sin(angle * 5 - 1.3) * 0.034;
  // Broad paired coves and bedrock spurs interrupt both silhouettes resolved
  // throughout the natural Lake-to-Waterfall rail. Their angular widths keep
  // each feature tens of metres wide, so this remains one erosion-shaped basin
  // rather than the serrated shoreline produced by the rejected AB3 pass.
  const erodedNearBank =
    - lakeBoundaryFeature(angle, 0.15, 0.48) * 0.24
    - lakeBoundaryFeature(angle, 1.15, 0.28) * 0.15
    - lakeBoundaryFeature(angle, 2.45, 0.34) * 0.12
    + lakeBoundaryFeature(angle, 2.92, 0.22) * 0.07;
  const erodedFarBank =
    - lakeBoundaryFeature(angle, -2.82, 0.22) * 0.17
    + lakeBoundaryFeature(angle, -2.38, 0.2) * 0.17
    - lakeBoundaryFeature(angle, -1.92, 0.23) * 0.2
    + lakeBoundaryFeature(angle, -1.46, 0.21) * 0.16
    - lakeBoundaryFeature(angle, -0.98, 0.24) * 0.16
    + lakeBoundaryFeature(angle, -0.54, 0.2) * 0.1;
  return Math.max(0.69, broadBasin + erodedNearBank + erodedFarBank);
}

function lakeBoundaryDistance(x: number, z: number) {
  const nx = (x - LAKE_CENTER.x) / LAKE_RADIUS.x;
  const nz = (z - LAKE_CENTER.z) / LAKE_RADIUS.z;
  const angle = Math.atan2(nz, nx);
  return Math.hypot(nx, nz) / lakeBoundaryScale(angle);
}

function valleyGeologyAdjustment(x: number, y: number, z: number, normalY: number) {
  const seamEnvelope = smoothRange(-968, -912, z) * (1 - smoothRange(-372, -320, z));
  const elevationEnvelope = smoothRange(-47, -18, y) * (1 - smoothRange(166, 214, y));
  const slope = 1 - Math.abs(normalY);
  const slopeEnvelope = 0.24 + smoothRange(0.025, 0.58, slope) * 0.76;
  const lakeDistance = lakeBoundaryDistance(x, z);
  const lakeProtection = y < LAKE_WATER_LEVEL + 18 ? smoothRange(1.18, 1.58, lakeDistance) : 1;
  const headwallDistance = Math.hypot((x - 170) / 145, (z + 718) / 116);
  const waterfallProtection = smoothRange(0.78, 1.28, headwallDistance);
  const envelope = seamEnvelope * elevationEnvelope * slopeEnvelope * lakeProtection * waterfallProtection;
  if (envelope <= 0.0001) return 0;

  // These coherent ribs follow the long Valley axis, while the three narrow
  // tributaries remove material. The result is bounded physical relief in the
  // active heightfield, not a screen-space texture or a freestanding rock shell.
  const primaryRibs = Math.sin(x * 0.022 + z * 0.006 + Math.sin(z * 0.012) * 1.18) * 2.25;
  const secondaryRibs = Math.sin(x * 0.051 - z * 0.009 + Math.sin(x * 0.014) * 0.72) * 0.82;
  const strataPhase = Math.sin(
    y * 0.12
    + x * 0.031
    - z * 0.013
    + Math.sin((x + z) * 0.017) * 0.9,
  );
  const fracturedLedges = Math.sign(strataPhase) * Math.pow(Math.abs(strataPhase), 8) * 0.56;
  const tributaryCenters = [
    -238 + Math.sin((z + 640) * 0.013) * 48,
    18 + Math.sin((z + 520) * 0.016 + 1.7) * 66,
    262 + Math.sin((z + 710) * 0.011 - 0.8) * 54,
  ];
  const tributaryWidths = [31, 26, 34];
  let incision = 0;
  tributaryCenters.forEach((center, index) => {
    const distance = Math.abs(x - center);
    incision -= (1 - smoothRange(5.5, tributaryWidths[index], distance)) * (2.1 + index * 0.46);
  });
  return Math.max(-4.8, Math.min(4.2, (primaryRibs + secondaryRibs + fracturedLedges + incision) * envelope));
}

const EASTERN_VALLEY_CATCHMENTS = [
  { baseZ: -884, branchSide: -1, depth: 22.8, phase: 0.35, spread: 66 },
  { baseZ: -780, branchSide: 1, depth: 18.8, phase: 1.7, spread: 82 },
  { baseZ: -674, branchSide: -1, depth: 21.6, phase: 3.05, spread: 74 },
  { baseZ: -578, branchSide: 1, depth: 17.2, phase: 4.45, spread: 61 },
] as const;

function easternValleyCatchmentEnvelope(x: number, y: number, z: number, normalY: number) {
  // Keep both independently authored terrain joins and the exterior source
  // bounds exact. This is the broad east-side Valley shoulder resolved during
  // Lake approach and Waterfall, not the accepted west-cliff or Alpine work.
  const longitudinal = smoothRange(-958, -918, z) * (1 - smoothRange(-560, -516, z));
  const lateral = smoothRange(38, 84, x) * (1 - smoothRange(610, 674, x));
  const elevation = smoothRange(-46, -20, y) * (1 - smoothRange(158, 196, y));
  const steepness = 1 - Math.abs(normalY);
  const slopeAuthority = 0.46 + smoothRange(0.025, 0.62, steepness) * 0.54;

  // The lake bank, river corridor, and waterfall basin already have one shared
  // terrain/water authority. Fade to zero before those systems so the new
  // catchments cannot pull their accepted edges apart or expose water tabs.
  const lakeDistance = lakeBoundaryDistance(x, z);
  const lakeProtection = y < LAKE_WATER_LEVEL + 28
    ? smoothRange(1.12, 1.5, lakeDistance)
    : 1;
  const riverProtection = z >= -808 && z <= -315
    ? smoothRange(
        v116RiverHalfWidth(z) + 11,
        v116RiverHalfWidth(z) + 54,
        Math.abs(x - v116RiverCenter(z)),
      )
    : 1;
  const waterfallProtection = smoothRange(
    0.82,
    1.34,
    Math.hypot((x - 165) / 178, (z + 716) / 148),
  );
  return longitudinal
    * lateral
    * elevation
    * slopeAuthority
    * lakeProtection
    * riverProtection
    * waterfallProtection;
}

function easternValleyCatchmentRelief(x: number, z: number) {
  let drainage = 0;
  const upslope = smoothRange(92, 610, x);
  const branchAuthority = smoothRange(214, 302, x) * (1 - smoothRange(566, 642, x));

  EASTERN_VALLEY_CATCHMENTS.forEach((catchment, catchmentIndex) => {
    const trunkCenter = catchment.baseZ
      + Math.sin((x - 170) * 0.0125 + catchment.phase) * 19
      + Math.sin((x + 80) * 0.0048 - catchment.phase * 0.62) * 9;
    const trunkWidth = 27 - upslope * 9;
    const trunkDistance = Math.abs(z - trunkCenter);
    const trunkShape = 1 - smoothRange(trunkWidth * 0.28, trunkWidth, trunkDistance);
    drainage -= Math.pow(Math.max(0, trunkShape), 1.62)
      * catchment.depth
      * (0.92 - upslope * 0.18);

    const branchSpread = catchment.spread * smoothRange(190, 548, x);
    const branchCenter = trunkCenter
      + catchment.branchSide * branchSpread
      + Math.sin(x * 0.017 - catchment.phase) * 6;
    const branchWidth = 18 - upslope * 4;
    const branchDistance = Math.abs(z - branchCenter);
    const branchShape = 1 - smoothRange(branchWidth * 0.26, branchWidth, branchDistance);
    drainage -= Math.pow(Math.max(0, branchShape), 1.72)
      * (9 + catchmentIndex * 0.8)
      * branchAuthority;

    // Candidate BH adds two narrow second-order rills to each accepted
    // catchment. They inherit the same source-surface envelope and protection
    // distances as the trunk, so the added hierarchy cannot move the lake,
    // river, waterfall, Ridge, Alpine, or exterior Valley boundaries.
    const secondOrderAuthority = smoothRange(168, 250, x) * (1 - smoothRange(560, 634, x));
    const secondOrderSpan = (13 + catchmentIndex * 2.2) * (0.48 + smoothRange(190, 520, x) * 0.52);
    ([-1, 1] as const).forEach((side) => {
      const secondOrderCenter = trunkCenter
        + side * secondOrderSpan
        + Math.sin(x * (0.022 + catchmentIndex * 0.0014) + catchment.phase + side * 0.82) * 3.8;
      const secondOrderWidth = (9.4 - upslope * 2.6) * (0.94 + catchmentIndex * 0.025);
      const secondOrderDistance = Math.abs(z - secondOrderCenter);
      const secondOrderShape = 1 - smoothRange(
        secondOrderWidth * 0.24,
        secondOrderWidth,
        secondOrderDistance,
      );
      drainage -= Math.pow(Math.max(0, secondOrderShape), 2.08)
        * (5.4 + catchmentIndex * 0.52)
        * secondOrderAuthority
        * (side === catchment.branchSide ? 1.08 : 0.84);
    });
  });

  // Two long, differently warped wavelengths leave unequal buttresses between
  // the drainage trees. Their metre-scale amplitude changes the source
  // macroform; it is not shader noise or a repeated decorative ridge row.
  const primaryButtresses = Math.sin(
    z * 0.0185
      + x * 0.0046
      + Math.sin((x - z) * 0.0057) * 0.78,
  ) * 8.8;
  const secondaryButtresses = Math.sin(
    z * 0.039
      - x * 0.0092
      + Math.sin((x + z) * 0.0081) * 0.42,
  ) * 2.8;
  return Math.max(-38, Math.min(13.5, primaryButtresses + secondaryButtresses + drainage));
}

function easternLakeApproachBankEnvelope(x: number, y: number, z: number, normalY: number) {
  // Candidate BE works only on the near eastern bank resolved by the natural
  // Lake-approach camera. It starts beyond the lake and river authorities and
  // fades out before the accepted waterfall lip, basin, and Valley boundaries.
  const longitudinal = smoothRange(-735, -710, z) * (1 - smoothRange(-570, -538, z));
  const lateral = smoothRange(172, 192, x) * (1 - smoothRange(360, 392, x));
  const elevation = smoothRange(8, 28, y) * (1 - smoothRange(108, 146, y));
  const steepness = 1 - Math.abs(normalY);
  const slopeAuthority = 0.58 + smoothRange(0.04, 0.5, steepness) * 0.42;
  const lakeProtection = smoothRange(1.1, 1.38, lakeBoundaryDistance(x, z));
  const riverProtection = z >= -700 && z <= -538
    ? smoothRange(
        v116RiverHalfWidth(z) + 20,
        v116RiverHalfWidth(z) + 58,
        Math.abs(x - v116RiverCenter(z)),
      )
    : 1;
  const waterfallProtection = smoothRange(
    0.42,
    0.64,
    Math.hypot((x - 190) / 140, (z + 730) / 110),
  );
  return longitudinal
    * lateral
    * elevation
    * slopeAuthority
    * lakeProtection
    * riverProtection
    * waterfallProtection;
}

function easternLakeApproachBankRelief(x: number, z: number) {
  // Two locally measured fall-line trunks cover the near and adjoining upper
  // Lake-approach bank. Unequal branches and interlocking shoulders provide a
  // nested hierarchy without producing a straight cross-slope notch or shelf.
  const upslope = smoothRange(190, 286, x);
  const trunkCenter = -642
    - (x - 220) * 1.35
    + Math.sin((x - 186) * 0.057 + 0.2) * 5.5
    + Math.sin(x * 0.019 - 0.55) * 2;
  const trunkWidth = 20 - upslope * 3;
  const trunkShape = 1 - smoothRange(
    trunkWidth * 0.15,
    trunkWidth,
    Math.abs(z - trunkCenter),
  );
  const trunk = -Math.pow(Math.max(0, trunkShape), 1.48) * (5.2 - upslope * 0.6);
  const branchAuthority = smoothRange(210, 236, x) * (1 - smoothRange(278, 310, x));
  const northBranchCenter = trunkCenter - 29 - Math.sin(x * 0.031 + 1.2) * 4.5;
  const southBranchCenter = trunkCenter + 35 + Math.sin(x * 0.027 - 0.35) * 5.5;
  const northBranch = -Math.pow(
    Math.max(0, 1 - smoothRange(4.5, 14, Math.abs(z - northBranchCenter))),
    1.64,
  ) * 3.4 * branchAuthority;
  const southBranch = -Math.pow(
    Math.max(0, 1 - smoothRange(5, 16, Math.abs(z - southBranchCenter))),
    1.58,
  ) * 2.8 * branchAuthority;
  const innerShoulder = Math.pow(
    Math.max(0, 1 - smoothRange(7, 24, Math.abs(z - (trunkCenter + 23)))),
    1.34,
  ) * 3.2;
  const outerShoulder = Math.pow(
    Math.max(0, 1 - smoothRange(8, 27, Math.abs(z - (trunkCenter - 25)))),
    1.3,
  ) * 2.7;
  const upperAuthority = smoothRange(248, 272, x) * (1 - smoothRange(352, 380, x));
  const upperCenter = -672
    + (x - 285) * 0.38
    + Math.sin((x - 250) * 0.052) * 3.2;
  const upperShape = 1 - smoothRange(4, 18, Math.abs(z - upperCenter));
  const upperTrunk = -Math.pow(Math.max(0, upperShape), 1.56) * 4.8 * upperAuthority;
  const upperBranchAuthority = smoothRange(292, 316, x) * (1 - smoothRange(350, 374, x));
  const upperNorthBranch = -Math.pow(
    Math.max(0, 1 - smoothRange(3.5, 12, Math.abs(z - (upperCenter - 25)))),
    1.68,
  ) * 2.4 * upperBranchAuthority;
  const upperSouthBranch = -Math.pow(
    Math.max(0, 1 - smoothRange(4, 14, Math.abs(z - (upperCenter + 29)))),
    1.62,
  ) * 2 * upperBranchAuthority;
  const upperNorthShoulder = Math.pow(
    Math.max(0, 1 - smoothRange(6, 22, Math.abs(z - (upperCenter - 21)))),
    1.36,
  ) * 2.7 * upperAuthority;
  const upperSouthShoulder = Math.pow(
    Math.max(0, 1 - smoothRange(7, 25, Math.abs(z - (upperCenter + 23)))),
    1.32,
  ) * 2.3 * upperAuthority;
  return Math.max(-6.4, Math.min(4.2, (
    trunk
    + northBranch
    + southBranch
    + innerShoulder
    + outerShoulder
    + upperTrunk
    + upperNorthBranch
    + upperSouthBranch
    + upperNorthShoulder
    + upperSouthShoulder
  )));
}

function contactTrailheadReliefEnvelope(x: number, y: number, z: number, normalY: number) {
  // Candidate BF targets the exact near-camera Contact foreground measured by
  // the 1440x900 raycast audit. It remains inside the existing Valley surface,
  // fades before the Lake-approach bank boundary, and cannot reach any water.
  const longitudinal = smoothRange(-684, -672, z) * (1 - smoothRange(-612, -602, z));
  const lateral = smoothRange(260, 276, x) * (1 - smoothRange(372, 390, x));
  const elevation = smoothRange(24, 32, y) * (1 - smoothRange(76, 88, y));
  const steepness = 1 - Math.abs(normalY);
  const slopeAuthority = 0.58 + smoothRange(0.06, 0.42, steepness) * 0.42;
  const lakeProtection = smoothRange(1.2, 1.52, lakeBoundaryDistance(x, z));
  const riverProtection = smoothRange(
    v116RiverHalfWidth(z) + 28,
    v116RiverHalfWidth(z) + 72,
    Math.abs(x - v116RiverCenter(z)),
  );
  const waterfallProtection = smoothRange(
    0.66,
    0.96,
    Math.hypot((x - 190) / 140, (z + 730) / 110),
  );
  return longitudinal
    * lateral
    * elevation
    * slopeAuthority
    * lakeProtection
    * riverProtection
    * waterfallProtection;
}

function contactTrailheadRelief(x: number, z: number) {
  // Two locally measured fall lines descend toward increasing z. Broad paired
  // shoulders break the lawn-like sheet without the deep lip/trench that made
  // BE9 fail at the adjacent 30-second crossing.
  const downslope = smoothRange(-674, -616, z);
  const primaryCenter = 292
    + downslope * 32
    + Math.sin((z + 650) * 0.075) * 2.8;
  const secondaryCenter = 357
    - downslope * 12
    + Math.sin((z + 636) * 0.062 + 0.8) * 3.4;
  const primaryShape = 1 - smoothRange(3.5, 15, Math.abs(x - primaryCenter));
  const secondaryShape = 1 - smoothRange(4, 17, Math.abs(x - secondaryCenter));
  const primaryRill = -Math.pow(Math.max(0, primaryShape), 1.46) * 3.7;
  const secondaryRill = -Math.pow(Math.max(0, secondaryShape), 1.52) * 2.8;
  const branchAuthority = smoothRange(-664, -652, z) * (1 - smoothRange(-628, -616, z));
  const primaryBranchCenter = primaryCenter - 24 + downslope * 8;
  const branchShape = 1 - smoothRange(4, 13, Math.abs(x - primaryBranchCenter));
  const branch = -Math.pow(Math.max(0, branchShape), 1.58) * 2.1 * branchAuthority;
  const primaryShoulder = Math.pow(
    Math.max(0, 1 - smoothRange(6, 23, Math.abs(x - (primaryCenter + 20)))),
    1.32,
  ) * 2.25;
  const secondaryShoulder = Math.pow(
    Math.max(0, 1 - smoothRange(7, 25, Math.abs(x - (secondaryCenter - 22)))),
    1.36,
  ) * 1.8;
  const broadBreakup = Math.sin(x * 0.058 + z * 0.024) * 0.62;
  return Math.max(-4.4, Math.min(2.8, (
    primaryRill
    + secondaryRill
    + branch
    + primaryShoulder
    + secondaryShoulder
    + broadBreakup
  )));
}

function westernValleyCliffEnvelope(x: number, y: number, z: number, normalY: number) {
  const longitudinal = smoothRange(-975, -948, z) * (1 - smoothRange(-746, -710, z));
  const lateral = smoothRange(-296, -244, x) * (1 - smoothRange(-20, 32, x));
  const elevation = smoothRange(-49, -26, y) * (1 - smoothRange(122, 158, y));
  const steepness = 1 - smoothRange(0.58, 0.84, Math.abs(normalY));
  return longitudinal * lateral * elevation * steepness;
}

function westernValleyCliffRelief(x: number, y: number, z: number) {
  const axialRibs = Math.sin((z + 936) * 0.073 + y * 0.018 + Math.sin(y * 0.049) * 1.25) * 4.2;
  const secondaryRibs = Math.sin((z + 902) * 0.147 - y * 0.031 + x * 0.014) * 1.5;
  const fracturePhase = Math.sin(y * 0.17 - z * 0.044 + Math.sin(z * 0.081) * 0.72);
  const fracturedLedges = Math.sign(fracturePhase) * Math.pow(Math.abs(fracturePhase), 7) * 1.2;
  const drainage = Math.pow(Math.abs(Math.sin((z + 918) * 0.031 + y * 0.011)), 10) * -2.4;
  return Math.max(-6.4, Math.min(6.6, axialRibs + secondaryRibs + fracturedLedges + drainage));
}

function waterfallBasinHeadwallEnvelope(x: number, y: number, z: number, normalY: number) {
  const basinDistance = Math.hypot((x - 20) / 310, (z + 790) / 210);
  const footprint = 1 - smoothRange(0.46, 1.08, basinDistance);
  const elevation = smoothRange(-49, -34, y) * (1 - smoothRange(70, 98, y));
  const steepness = 1 - smoothRange(0.58, 0.92, Math.abs(normalY));
  // Keep the immediate water lip stable while allowing the broad source face
  // around it to become an irregular, weathered basin wall.
  const chuteClearance = 0.22 + smoothRange(7, 25, Math.abs(x - WATERFALL_TOP.x)) * 0.78;
  return footprint * elevation * steepness * chuteClearance;
}

function waterfallBasinHeadwallRelief(x: number, y: number, z: number) {
  const axialRibs = Math.sin(
    (x - 28) * 0.026
    + y * 0.043
    + Math.sin((z + 716) * 0.061) * 1.18,
  ) * 4.4;
  const secondaryRibs = Math.sin(x * 0.067 - y * 0.032 + z * 0.018) * 1.35;
  const fracturePhase = Math.sin(y * 0.176 + x * 0.021 - z * 0.039);
  const fracturedLedges = Math.sign(fracturePhase) * Math.pow(Math.abs(fracturePhase), 9) * 1;
  const gullyPhase = Math.sin(x * 0.029 + z * 0.022 + Math.sin(y * 0.035) * 0.68);
  const drainage = -Math.pow(Math.max(0, gullyPhase), 13) * 2.2;
  return Math.max(-6.5, Math.min(6.8, axialRibs + secondaryRibs + fracturedLedges + drainage));
}

function subdivideWatershedTerrainGeometry(source: BufferGeometry) {
  const sourcePositions = source.getAttribute("position");
  const sourceUvs = source.getAttribute("uv");
  const sourceIndex = source.getIndex();
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const midpointCache = new Map<string, number>();

  for (let index = 0; index < sourcePositions.count; index += 1) {
    positions.push(sourcePositions.getX(index), sourcePositions.getY(index), sourcePositions.getZ(index));
    if (sourceUvs) uvs.push(sourceUvs.getX(index), sourceUvs.getY(index));
  }

  const midpoint = (left: number, right: number) => {
    const low = Math.min(left, right);
    const high = Math.max(left, right);
    const key = `${low}:${high}`;
    const cached = midpointCache.get(key);
    if (cached !== undefined) return cached;
    const index = positions.length / 3;
    positions.push(
      (sourcePositions.getX(left) + sourcePositions.getX(right)) * 0.5,
      (sourcePositions.getY(left) + sourcePositions.getY(right)) * 0.5,
      (sourcePositions.getZ(left) + sourcePositions.getZ(right)) * 0.5,
    );
    if (sourceUvs) {
      uvs.push(
        (sourceUvs.getX(left) + sourceUvs.getX(right)) * 0.5,
        (sourceUvs.getY(left) + sourceUvs.getY(right)) * 0.5,
      );
    }
    midpointCache.set(key, index);
    return index;
  };

  const sourceIndexCount = sourceIndex?.count ?? sourcePositions.count;
  for (let offset = 0; offset < sourceIndexCount; offset += 3) {
    const a = sourceIndex ? sourceIndex.getX(offset) : offset;
    const b = sourceIndex ? sourceIndex.getX(offset + 1) : offset + 1;
    const c = sourceIndex ? sourceIndex.getX(offset + 2) : offset + 2;
    const ab = midpoint(a, b);
    const bc = midpoint(b, c);
    const ca = midpoint(c, a);
    indices.push(
      a, ab, ca,
      ab, b, bc,
      ca, bc, c,
      ab, bc, ca,
    );
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  if (sourceUvs) geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData.watershedSubdivision = {
    method: "one-pass shared-edge midpoint subdivision before integrated landform remesh",
    sourceTriangles: sourceIndexCount / 3,
    triangles: indices.length / 3,
    vertices: positions.length / 3,
  };
  return geometry;
}

function subdivideSelectedTerrainGeometry(
  source: BufferGeometry,
  diagnosticKey: string,
  selectTriangle: (
    positions: BufferAttribute | InterleavedBufferAttribute,
    a: number,
    b: number,
    c: number,
  ) => boolean,
) {
  const sourcePositions = source.getAttribute("position");
  const sourceUvs = source.getAttribute("uv");
  const sourceIndex = source.getIndex();
  const sourceIndexCount = sourceIndex?.count ?? sourcePositions.count;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const splitEdges = new Set<string>();
  const midpointCache = new Map<string, number>();

  const vertexIndex = (offset: number) => sourceIndex ? sourceIndex.getX(offset) : offset;
  const edgeKey = (left: number, right: number) => `${Math.min(left, right)}:${Math.max(left, right)}`;
  for (let index = 0; index < sourcePositions.count; index += 1) {
    positions.push(sourcePositions.getX(index), sourcePositions.getY(index), sourcePositions.getZ(index));
    if (sourceUvs) uvs.push(sourceUvs.getX(index), sourceUvs.getY(index));
  }

  let selectedTriangles = 0;
  for (let offset = 0; offset < sourceIndexCount; offset += 3) {
    const a = vertexIndex(offset);
    const b = vertexIndex(offset + 1);
    const c = vertexIndex(offset + 2);
    if (!selectTriangle(sourcePositions, a, b, c)) continue;
    splitEdges.add(edgeKey(a, b));
    splitEdges.add(edgeKey(b, c));
    splitEdges.add(edgeKey(c, a));
    selectedTriangles += 1;
  }

  const midpoint = (left: number, right: number) => {
    const key = edgeKey(left, right);
    const cached = midpointCache.get(key);
    if (cached !== undefined) return cached;
    const index = positions.length / 3;
    positions.push(
      (sourcePositions.getX(left) + sourcePositions.getX(right)) * 0.5,
      (sourcePositions.getY(left) + sourcePositions.getY(right)) * 0.5,
      (sourcePositions.getZ(left) + sourcePositions.getZ(right)) * 0.5,
    );
    if (sourceUvs) {
      uvs.push(
        (sourceUvs.getX(left) + sourceUvs.getX(right)) * 0.5,
        (sourceUvs.getY(left) + sourceUvs.getY(right)) * 0.5,
      );
    }
    midpointCache.set(key, index);
    return index;
  };

  for (let offset = 0; offset < sourceIndexCount; offset += 3) {
    const a = vertexIndex(offset);
    const b = vertexIndex(offset + 1);
    const c = vertexIndex(offset + 2);
    const splitAb = splitEdges.has(edgeKey(a, b));
    const splitBc = splitEdges.has(edgeKey(b, c));
    const splitCa = splitEdges.has(edgeKey(c, a));
    const splitCount = Number(splitAb) + Number(splitBc) + Number(splitCa);
    if (splitCount === 0) {
      indices.push(a, b, c);
      continue;
    }
    const ab = splitAb ? midpoint(a, b) : -1;
    const bc = splitBc ? midpoint(b, c) : -1;
    const ca = splitCa ? midpoint(c, a) : -1;
    if (splitCount === 3) {
      indices.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
    } else if (splitCount === 1 && splitAb) {
      indices.push(a, ab, c, ab, b, c);
    } else if (splitCount === 1 && splitBc) {
      indices.push(a, b, bc, a, bc, c);
    } else if (splitCount === 1 && splitCa) {
      indices.push(a, b, ca, ca, b, c);
    } else if (splitAb && splitBc) {
      indices.push(ab, b, bc, a, ab, c, ab, bc, c);
    } else if (splitBc && splitCa) {
      indices.push(bc, c, ca, a, b, ca, b, bc, ca);
    } else {
      indices.push(a, ab, ca, ab, b, c, ab, c, ca);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  if (sourceUvs) geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData[diagnosticKey] = {
    selectedTriangles,
    sharedEdges: splitEdges.size,
    sourceTriangles: sourceIndexCount / 3,
    triangles: indices.length / 3,
    vertices: positions.length / 3,
  };
  return geometry;
}

function subdivideLakeShorelineTerrainGeometry(source: BufferGeometry) {
  return subdivideSelectedTerrainGeometry(
    source,
    "lakeShorelineSubdivision",
    (positions, a, b, c) => {
      const distances = [a, b, c].map((index) => lakeBoundaryDistance(
        positions.getX(index),
        positions.getZ(index),
      ));
      return Math.min(...distances) <= 1.34 && Math.max(...distances) >= 0.7;
    },
  );
}

function subdivideWaterfallHeadwallTerrainGeometry(source: BufferGeometry) {
  return subdivideSelectedTerrainGeometry(
    source,
    "waterfallHeadwallSubdivision",
    (positions, a, b, c) => {
      const indices = [a, b, c];
      const insideBasinEscarpment = indices.some((index) => {
        const x = positions.getX(index);
        const y = positions.getY(index);
        const z = positions.getZ(index);
        const basinHeadwallDistance = Math.hypot((x - 20) / 310, (z + 790) / 210);
        return basinHeadwallDistance <= 1.14 && y >= -58 && y <= 104;
      });
      if (!insideBasinEscarpment) return false;

      const abX = positions.getX(b) - positions.getX(a);
      const abY = positions.getY(b) - positions.getY(a);
      const abZ = positions.getZ(b) - positions.getZ(a);
      const acX = positions.getX(c) - positions.getX(a);
      const acY = positions.getY(c) - positions.getY(a);
      const acZ = positions.getZ(c) - positions.getZ(a);
      const normalX = abY * acZ - abZ * acY;
      const normalY = abZ * acX - abX * acZ;
      const normalZ = abX * acY - abY * acX;
      const normalLength = Math.hypot(normalX, normalY, normalZ);
      return normalLength > 0.0001 && Math.abs(normalY) / normalLength < 0.88;
    },
  );
}

function subdivideAlpineCrownTerrainGeometry(source: BufferGeometry) {
  return subdivideSelectedTerrainGeometry(
    source,
    "alpineCrownSubdivision",
    (positions, a, b, c) => [a, b, c].some((index) => {
      const x = positions.getX(index);
      const y = positions.getY(index);
      const z = positions.getZ(index);
      // Refine only the visible volcanic crown, headwall, and descending
      // shoulders. The outer Alpine bounds and Valley seam stay on their
      // decoded source topology, while the hero silhouette gains enough real
      // vertices for ledges, talus breaks, and gullies to affect lighting.
      return x > 300 && x < 930
        && y > 82
        && z > -1615 && z < -995;
    }),
  );
}

function alpineVisibleSummitMacroRelief(x: number, y: number, z: number) {
  const summitElevation = smoothRange(170, 236, y);
  const headwallElevation = smoothRange(132, 176, y) * (1 - smoothRange(242, 268, y));
  const drainageElevation = smoothRange(104, 164, y) * (1 - smoothRange(296, 326, y));
  const protectedZ = smoothRange(-1585, -1515, z) * (1 - smoothRange(-1085, -1015, z));
  const protectedX = smoothRange(330, 405, x) * (1 - smoothRange(835, 910, x));
  const macroEnvelope = protectedX * protectedZ;
  if (macroEnvelope <= 0.001) return 0;

  const ellipticalRelief = (
    centerX: number,
    centerZ: number,
    radiusX: number,
    radiusZ: number,
    falloff = 1.8,
  ) => {
    const distanceSquared = ((x - centerX) / radiusX) ** 2 + ((z - centerZ) / radiusZ) ** 2;
    return Math.exp(-distanceSquared * falloff);
  };
  // Extend the authored crown into an asymmetric, descending ridge. These
  // anchors are separated source summits measured from
  // ALPINE_VALLEY_V115_HIGH; the dominant crown itself remains authored data
  // while the lower shoulders broaden its silhouette. No shell or
  // camera-facing geometry is introduced.
  const nearShoulder = ellipticalRelief(532, -1268, 112, 92) * 60;
  const rearShoulder = ellipticalRelief(579, -1480, 118, 88) * 70;
  const outerButtress = ellipticalRelief(486, -1380, 145, 118) * 34;
  const rightButtress = ellipticalRelief(700, -1439, 105, 95) * 50;

  // Separate the inherited single pyramidal crown into a weathered volcanic
  // ridge. Two unequal source-surface spires flank an eroded saddle; a rear
  // shoulder keeps the silhouette dimensional as the rail crosses Summit.
  const westCrown = ellipticalRelief(506, -1425, 72, 76, 2.15) * 42;
  const eastCrown = ellipticalRelief(686, -1450, 64, 72, 2.2) * 31;
  const crownSaddle = ellipticalRelief(603, -1428, 52, 68, 2.3) * -38;
  const rearCrown = ellipticalRelief(594, -1532, 92, 66, 2.0) * 24;

  // A broad upper-face hollow separates the near shoulder from the forested
  // foreground slope. Its low, wide falloff reads as an incised headwall on
  // the source terrain rather than another narrow decorative groove.
  const upperFaceHeadwall = ellipticalRelief(514, -1186, 175, 105, 1.5) * -34;

  const downstream = saturate((z + 1435) / 360);
  const drainageCenter = 615 - (z + 1363) * 0.34 + Math.sin((z + 1320) * 0.022) * 11;
  const drainageWidth = 30 + downstream * 40;
  const drainageDistance = Math.abs(x - drainageCenter);
  const drainageShape = 1 - smoothRange(drainageWidth * 0.24, drainageWidth, drainageDistance);
  const mainDrainage = -Math.pow(Math.max(0, drainageShape), 1.55) * 32;

  const branchAuthority = smoothRange(-1355, -1288, z) * (1 - smoothRange(-1110, -1045, z));
  const branchSpread = downstream * 92;
  const leftBranchDistance = Math.abs(x - (drainageCenter - branchSpread));
  const rightBranchDistance = Math.abs(x - (drainageCenter + branchSpread * 0.82));
  const leftBranch = -Math.pow(
    Math.max(0, 1 - smoothRange(12, 47, leftBranchDistance)),
    1.7,
  ) * 14.5 * branchAuthority;
  const rightBranch = -Math.pow(
    Math.max(0, 1 - smoothRange(11, 43, rightBranchDistance)),
    1.7,
  ) * 12 * branchAuthority;

  return (
    (
      nearShoulder
      + rearShoulder
      + outerButtress
      + rightButtress
      + westCrown
      + eastCrown
      + crownSaddle
      + rearCrown
    ) * summitElevation
    + upperFaceHeadwall * headwallElevation
    + (mainDrainage + leftBranch + rightBranch) * drainageElevation
  ) * macroEnvelope;
}

function createAlpineGeologyTerrainGeometry(source: Mesh, detail: "compact" | "detailed") {
  const sourceGeometry = source.geometry.clone();
  sourceGeometry.applyMatrix4(source.matrixWorld);
  const baseGeometry = subdivideWatershedTerrainGeometry(sourceGeometry);
  sourceGeometry.dispose();
  const baseSubdivision = baseGeometry.userData.watershedSubdivision;
  const geometry = detail === "detailed"
    ? subdivideAlpineCrownTerrainGeometry(baseGeometry)
    : baseGeometry;
  if (geometry !== baseGeometry) baseGeometry.dispose();
  geometry.userData.watershedSubdivision = baseSubdivision;
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  let adjustedVertices = 0;
  let maximumRelief = 0;
  let summitMacroAdjustedVertices = 0;
  let summitMacroMaximumIncision = 0;
  let summitMacroMaximumUplift = 0;

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const normalX = normals ? normals.getX(index) : 0;
    const normalY = normals ? normals.getY(index) : 1;
    const normalZ = normals ? normals.getZ(index) : 0;

    // Preserve every authored outer edge and the decoded Valley adjacency.
    // Relief begins above the alpine floor and well inside the source bounds,
    // so the real heightfield remains one continuous surface rather than a
    // ridge shell, skirt, or camera-facing cover mesh.
    const longitudinal = smoothRange(-1665, -1590, z) * (1 - smoothRange(-1080, -1008, z));
    const lateral = smoothRange(-940, -850, x) * (1 - smoothRange(850, 940, x));
    const elevation = smoothRange(36, 92, y);
    const steepness = 1 - Math.abs(normalY);
    const slopeAuthority = 0.34 + smoothRange(0.08, 0.7, steepness) * 0.66;
    const envelope = longitudinal * lateral * elevation * slopeAuthority;
    if (envelope <= 0.001) continue;

    const axialRibs = Math.sin(
      (x - 115) * 0.014
      + (z + 1325) * 0.0058
      + Math.sin((z + 1280) * 0.0085) * 0.58,
    ) * 6.2;
    const secondaryRibs = Math.sin(
      (x + 260) * 0.033
      - (z + 1200) * 0.009
      + Math.sin((x - z) * 0.0065) * 0.42,
    ) * 1.45;
    const ledgePhase = Math.sin(y * 0.108 + x * 0.009 - z * 0.006);
    const fracturedLedges = Math.sign(ledgePhase) * Math.pow(Math.abs(ledgePhase), 11) * 1.25;
    const drainagePhase = Math.cos(
      x * 0.011
      + z * 0.0043
      + Math.sin(z * 0.0075) * 0.62,
    );
    const secondaryDrainagePhase = Math.cos(
      x * 0.017
      - z * 0.0038
      + Math.sin((x + z) * 0.0048) * 0.36,
    );
    const drainage = -Math.pow(Math.max(0, drainagePhase), 16) * 5.2;
    const secondaryDrainage = -Math.pow(Math.max(0, secondaryDrainagePhase), 20) * 2.1;
    const crownDetailEnvelope = smoothRange(88, 142, y)
      * smoothRange(-1608, -1550, z)
      * (1 - smoothRange(-1095, -1018, z))
      * smoothRange(306, 365, x)
      * (1 - smoothRange(860, 925, x));
    const terracePhase = Math.sin(
      y * 0.162
      + x * 0.012
      - z * 0.0085
      + Math.sin((x + z) * 0.011) * 0.74,
    );
    const terraceScarps = Math.sign(terracePhase)
      * Math.pow(Math.abs(terracePhase), 17)
      * 2.45
      * crownDetailEnvelope;
    const talusBreaks = (
      Math.sin(x * 0.071 - z * 0.019 + Math.sin(y * 0.13) * 0.62) * 0.9
      + Math.sin(x * -0.038 - z * 0.047 + 1.7) * 0.55
    ) * crownDetailEnvelope * (0.32 + steepness * 0.68);
    const crownGullyPhase = Math.cos(
      x * 0.028
      + z * 0.012
      + Math.sin(z * 0.016) * 0.9,
    );
    const crownGullies = -Math.pow(Math.max(0, crownGullyPhase), 24)
      * 3.8
      * crownDetailEnvelope;
    const unclampedRelief = (
      axialRibs
      + secondaryRibs
      + fracturedLedges
      + drainage
      + secondaryDrainage
      + terraceScarps
      + talusBreaks
      + crownGullies
    ) * envelope;
    const relief = Math.max(-9.2, Math.min(9.8, unclampedRelief));
    const summitMacroRelief = alpineVisibleSummitMacroRelief(x, y, z) * envelope;
    const horizontalNormalLength = Math.hypot(normalX, normalZ);
    if (horizontalNormalLength > 0.001) {
      const horizontalRelief = relief * (0.18 + steepness * 0.28)
        + summitMacroRelief * (0.1 + steepness * 0.16);
      positions.setX(index, x + (normalX / horizontalNormalLength) * horizontalRelief);
      positions.setZ(index, z + (normalZ / horizontalNormalLength) * horizontalRelief);
    }
    positions.setY(
      index,
      y + relief * (0.58 + steepness * 0.16) + summitMacroRelief * (0.74 + steepness * 0.12),
    );
    adjustedVertices += 1;
    maximumRelief = Math.max(maximumRelief, Math.abs(relief + summitMacroRelief));
    if (Math.abs(summitMacroRelief) > 0.001) {
      summitMacroAdjustedVertices += 1;
      summitMacroMaximumIncision = Math.max(summitMacroMaximumIncision, -summitMacroRelief);
      summitMacroMaximumUplift = Math.max(summitMacroMaximumUplift, summitMacroRelief);
    }
  }

  positions.needsUpdate = true;
  if (geometry.getAttribute("uv") && !geometry.getAttribute("uv1")) {
    geometry.setAttribute("uv1", geometry.getAttribute("uv").clone());
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.name = `Madagin v1.16 ${detail} fractured Alpine source terrain`;
  geometry.userData.alpineGeology = {
    adjustedVertices,
    detail,
    maximumReliefMeters: maximumRelief,
    method: detail === "detailed"
      ? "shared-edge subdivision plus selective hero-crown refinement, a split asymmetric Alpine crown, upper-face headwall, terrace scarps, talus breaks, and branching source-surface drainage"
      : "shared-edge subdivision plus a split asymmetric Alpine crown, upper-face headwall, terrace scarps, talus breaks, and branching source-surface drainage",
    sourceTriangles: geometry.userData.watershedSubdivision?.sourceTriangles ?? null,
    crownSubdivision: geometry.userData.alpineCrownSubdivision ?? null,
    summitMacroform: {
      adjustedVertices: summitMacroAdjustedVertices,
      detachedGeometry: false,
      maximumIncisionMeters: summitMacroMaximumIncision,
      maximumUpliftMeters: summitMacroMaximumUplift,
      method: "four descending source-summit shoulders, two unequal spires around an eroded saddle, one broad upper-face headwall, terrace scarps, talus breaks, and branching drainage on the existing Alpine surface",
    },
    triangles: (geometry.index?.count ?? geometry.getAttribute("position").count) / 3,
    valleyBoundaryProtected: true,
    worldBoundsProtected: true,
  };
  return geometry;
}


const RIDGE_EROSION_NETWORKS = [
  { baseX: -218, branchSide: -1, depth: 6.2, phase: 0.35, spread: 52 },
  { baseX: -126, branchSide: 1, depth: 4.8, phase: 1.45, spread: 63 },
  { baseX: -36, branchSide: -1, depth: 5.5, phase: 2.5, spread: 57 },
  { baseX: 64, branchSide: 1, depth: 5, phase: 3.65, spread: 68 },
  { baseX: 172, branchSide: -1, depth: 5.7, phase: 4.8, spread: 59 },
] as const;

function ridgeErosionRelief(x: number, z: number) {
  let drainage = 0;
  const downstream = smoothRange(-230, 190, z);
  const branchSpread = 1 - smoothRange(-105, 178, z);
  const branchAuthority = smoothRange(-274, -214, z) * (1 - smoothRange(132, 218, z));

  RIDGE_EROSION_NETWORKS.forEach((network, networkIndex) => {
    const trunkCenter = network.baseX
      + Math.sin((z + 80) * 0.011 + network.phase) * 13
      + Math.sin((z - 36) * 0.0042 + network.phase * 0.7) * 8;
    const trunkWidth = 13.5 + downstream * 5.5;
    const trunkDistance = Math.abs(x - trunkCenter);
    const trunkShape = 1 - smoothRange(trunkWidth * 0.28, trunkWidth, trunkDistance);
    drainage -= Math.pow(Math.max(0, trunkShape), 1.7) * network.depth * (0.78 + downstream * 0.22);

    const branchCenter = trunkCenter
      + network.branchSide * branchSpread * network.spread
      + Math.sin(z * 0.018 - network.phase) * 5.5;
    const branchWidth = 10.5 + downstream * 3.5;
    const branchDistance = Math.abs(x - branchCenter);
    const branchShape = 1 - smoothRange(branchWidth * 0.24, branchWidth, branchDistance);
    drainage -= Math.pow(Math.max(0, branchShape), 1.8) * (3.25 + networkIndex * 0.18) * branchAuthority;
  });

  // Two long, differently warped wavelengths keep the remaining mass reading
  // as buttresses between drainages rather than a repeated row of smooth humps.
  const primaryButtresses = Math.sin(
    x * 0.027
    + z * 0.0042
    + Math.sin((z + 35) * 0.0095) * 0.72,
  ) * 2.75;
  const secondaryButtresses = Math.sin(
    x * 0.051
    - z * 0.0062
    + Math.sin((x + z) * 0.007) * 0.38,
  ) * 0.82;
  return Math.max(-10.2, Math.min(4.2, primaryButtresses + secondaryButtresses + drainage));
}

function createRidgeErosionTerrainGeometry(source: Mesh) {
  const sourceGeometry = source.geometry.clone();
  sourceGeometry.applyMatrix4(source.matrixWorld);
  const geometry = subdivideSelectedTerrainGeometry(
    sourceGeometry,
    "ridgeErosionSubdivision",
    (positions, a, b, c) => [a, b, c].some((index) => {
      const x = positions.getX(index);
      const y = positions.getY(index);
      const z = positions.getZ(index);
      return x > -300 && x < 300 && y > -8.5 && z > -290 && z < 270;
    }),
  );
  sourceGeometry.dispose();
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  let adjustedVertices = 0;
  let maximumIncision = 0;
  let maximumUplift = 0;

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const normalX = normals ? normals.getX(index) : 0;
    const normalY = normals ? normals.getY(index) : 1;
    const normalZ = normals ? normals.getZ(index) : 0;

    // All decoded source boundaries remain exact. In particular, relief is
    // fully zero before the z=-315 Ridge-to-Valley edge and the z=285 opening
    // edge, so this stays one erosion-cut source surface with no shell or skirt.
    const longitudinal = smoothRange(-286, -246, z) * (1 - smoothRange(232, 270, z));
    const lateral = smoothRange(-300, -268, x) * (1 - smoothRange(268, 300, x));
    const elevation = smoothRange(-8.2, 3.5, y);
    const steepness = 1 - Math.abs(normalY);
    const slopeAuthority = 0.62 + smoothRange(0.04, 0.46, steepness) * 0.38;
    const envelope = longitudinal * lateral * elevation * slopeAuthority;
    if (envelope <= 0.001) continue;

    const relief = ridgeErosionRelief(x, z) * envelope;
    const horizontalNormalLength = Math.hypot(normalX, normalZ);
    if (horizontalNormalLength > 0.001) {
      const horizontalRelief = relief * (0.1 + steepness * 0.16);
      positions.setX(index, x + (normalX / horizontalNormalLength) * horizontalRelief);
      positions.setZ(index, z + (normalZ / horizontalNormalLength) * horizontalRelief);
    }
    positions.setY(index, y + relief * (0.94 + steepness * 0.08));
    adjustedVertices += 1;
    maximumIncision = Math.max(maximumIncision, -relief);
    maximumUplift = Math.max(maximumUplift, relief);
  }

  positions.needsUpdate = true;
  if (geometry.getAttribute("uv") && !geometry.getAttribute("uv1")) {
    geometry.setAttribute("uv1", geometry.getAttribute("uv").clone());
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.name = "Madagin v1.16 detailed erosion-cut Ridge source terrain";
  geometry.userData.ridgeErosion = {
    adjustedVertices,
    maximumIncisionMeters: maximumIncision,
    maximumUpliftMeters: maximumUplift,
    method: "conforming shared-edge interior subdivision plus five branching drainage networks and two non-repeating buttress wavelengths",
    ridgeValleyBoundaryProtected: true,
    worldBoundsProtected: true,
    subdivision: geometry.userData.ridgeErosionSubdivision ?? null,
  };
  return geometry;
}


function createIntegratedWatershedTerrainGeometry(
  source: Mesh,
  alpineBoundary: CoastalBoundarySample[] = [],
  ridgeBoundary: CoastalBoundarySample[] = [],
  lakeShorelineSubdivisionPasses = 0,
  waterfallHeadwallSubdivisionPasses = 0,
  ridgeInteriorBoundary: CoastalBoundarySample[] = [],
) {
  const sourceGeometry = source.geometry.clone();
  sourceGeometry.applyMatrix4(source.matrixWorld);
  const sourceTriangles = (sourceGeometry.index?.count ?? sourceGeometry.getAttribute("position").count) / 3;
  let geometry = subdivideWatershedTerrainGeometry(sourceGeometry);
  sourceGeometry.dispose();
  const lakeShorelineSubdivision: Array<Record<string, unknown>> = [];
  for (let pass = 0; pass < lakeShorelineSubdivisionPasses; pass += 1) {
    const previous = geometry;
    geometry = subdivideLakeShorelineTerrainGeometry(previous);
    lakeShorelineSubdivision.push(geometry.userData.lakeShorelineSubdivision ?? {});
    previous.dispose();
  }
  const waterfallHeadwallSubdivision: Array<Record<string, unknown>> = [];
  for (let pass = 0; pass < waterfallHeadwallSubdivisionPasses; pass += 1) {
    const previous = geometry;
    geometry = subdivideWaterfallHeadwallTerrainGeometry(previous);
    waterfallHeadwallSubdivision.push(geometry.userData.waterfallHeadwallSubdivision ?? {});
    previous.dispose();
  }
  geometry.userData.watershedSubdivision = {
    ...(geometry.userData.watershedSubdivision ?? {}),
    lakeShorelinePasses: lakeShorelineSubdivisionPasses,
    lakeShorelineSubdivision,
    waterfallHeadwallPasses: waterfallHeadwallSubdivisionPasses,
    waterfallHeadwallSubdivision,
    method: `${[
      "one uniform shared-edge pass",
      lakeShorelineSubdivisionPasses ? "conforming adaptive lake-shoreline passes" : null,
      waterfallHeadwallSubdivisionPasses ? "conforming adaptive waterfall-headwall passes" : null,
    ].filter(Boolean).join(" plus ")} before integrated landform remesh`,
    sourceTriangles,
    triangles: (geometry.index?.count ?? geometry.getAttribute("position").count) / 3,
    vertices: geometry.getAttribute("position").count,
  };
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  let adjustedVertices = 0;
  let maximumAdjustment = 0;
  let waterfallBasinVertices = 0;
  let waterfallChannelVertices = 0;
  let waterfallErosionVertices = 0;
  let waterfallOutflowVertices = 0;
  let riverChannelVertices = 0;
  let valleyGeologyVertices = 0;
  let easternCatchmentVertices = 0;
  let maximumEasternCatchmentIncision = 0;
  let maximumEasternCatchmentUplift = 0;
  let easternLakeApproachBankVertices = 0;
  let maximumEasternLakeApproachBankIncision = 0;
  let maximumEasternLakeApproachBankUplift = 0;
  let contactTrailheadReliefVertices = 0;
  let maximumContactTrailheadIncision = 0;
  let maximumContactTrailheadUplift = 0;
  let westernCliffVertices = 0;
  let maximumWesternCliffRelief = 0;
  let waterfallHeadwallVertices = 0;
  let maximumWaterfallHeadwallRelief = 0;
  let alpineSeamVertices = 0;
  let maximumAlpineSeamAdjustment = 0;
  let ridgeSeamVertices = 0;
  let maximumRidgeSeamAdjustment = 0;
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    let nextY = y;
    const geologyAdjustment = valleyGeologyAdjustment(x, y, z, normals ? normals.getY(index) : 1);
    if (Math.abs(geologyAdjustment) > 0.001) {
      nextY += geologyAdjustment;
      valleyGeologyVertices += 1;
    }

    const normalX = normals ? normals.getX(index) : 0;
    const normalY = normals ? normals.getY(index) : 1;
    const normalZ = normals ? normals.getZ(index) : 0;
    const easternCatchmentEnvelope = easternValleyCatchmentEnvelope(x, y, z, normalY);
    if (easternCatchmentEnvelope > 0.001) {
      const relief = easternValleyCatchmentRelief(x, z) * easternCatchmentEnvelope;
      const steepness = 1 - Math.abs(normalY);
      const horizontalNormalLength = Math.hypot(normalX, normalZ);
      if (horizontalNormalLength > 0.001) {
        const horizontalRelief = relief * (0.1 + steepness * 0.2);
        positions.setX(index, x + (normalX / horizontalNormalLength) * horizontalRelief);
        positions.setZ(index, z + (normalZ / horizontalNormalLength) * horizontalRelief);
      }
      nextY += relief * (0.9 + steepness * 0.1);
      easternCatchmentVertices += 1;
      maximumEasternCatchmentIncision = Math.max(maximumEasternCatchmentIncision, -relief);
      maximumEasternCatchmentUplift = Math.max(maximumEasternCatchmentUplift, relief);
    }

    const easternBankEnvelope = easternLakeApproachBankEnvelope(x, y, z, normalY);
    if (easternBankEnvelope > 0.001) {
      const relief = easternLakeApproachBankRelief(x, z) * easternBankEnvelope;
      const steepness = 1 - Math.abs(normalY);
      const horizontalNormalLength = Math.hypot(normalX, normalZ);
      if (horizontalNormalLength > 0.001) {
        const horizontalRelief = relief * (0.08 + steepness * 0.14);
        positions.setX(index, positions.getX(index) + (normalX / horizontalNormalLength) * horizontalRelief);
        positions.setZ(index, positions.getZ(index) + (normalZ / horizontalNormalLength) * horizontalRelief);
      }
      nextY += relief * (0.92 + steepness * 0.08);
      easternLakeApproachBankVertices += 1;
      maximumEasternLakeApproachBankIncision = Math.max(maximumEasternLakeApproachBankIncision, -relief);
      maximumEasternLakeApproachBankUplift = Math.max(maximumEasternLakeApproachBankUplift, relief);
    }

    const contactReliefEnvelope = contactTrailheadReliefEnvelope(x, y, z, normalY);
    if (contactReliefEnvelope > 0.001) {
      const relief = contactTrailheadRelief(x, z) * contactReliefEnvelope;
      nextY += relief;
      contactTrailheadReliefVertices += 1;
      maximumContactTrailheadIncision = Math.max(maximumContactTrailheadIncision, -relief);
      maximumContactTrailheadUplift = Math.max(maximumContactTrailheadUplift, relief);
    }

    const cliffEnvelope = westernValleyCliffEnvelope(x, y, z, normalY);
    if (cliffEnvelope > 0.001) {
      const horizontalNormalLength = Math.hypot(normalX, normalZ);
      const relief = westernValleyCliffRelief(x, y, z) * cliffEnvelope;
      if (horizontalNormalLength > 0.001) {
        positions.setX(index, x + (normalX / horizontalNormalLength) * relief);
        positions.setZ(index, z + (normalZ / horizontalNormalLength) * relief);
      }
      const ledgeLift = Math.sign(Math.sin(y * 0.142 - z * 0.052))
        * Math.pow(Math.abs(Math.sin(y * 0.142 - z * 0.052)), 9)
        * 1.08 * cliffEnvelope;
      nextY += ledgeLift;
      westernCliffVertices += 1;
      maximumWesternCliffRelief = Math.max(maximumWesternCliffRelief, Math.abs(relief));
    }

    const waterfallHeadwallEnvelope = waterfallBasinHeadwallEnvelope(x, y, z, normalY);
    if (waterfallHeadwallEnvelope > 0.001) {
      const relief = waterfallBasinHeadwallRelief(x, y, z) * waterfallHeadwallEnvelope;
      const basinDirectionX = x - 20;
      const basinDirectionZ = z + 790;
      const basinDirectionLength = Math.hypot(basinDirectionX, basinDirectionZ);
      if (basinDirectionLength > 0.001) {
        positions.setX(index, positions.getX(index) + (basinDirectionX / basinDirectionLength) * relief);
        positions.setZ(index, positions.getZ(index) + (basinDirectionZ / basinDirectionLength) * relief);
      }
      const ledgeLift = Math.sign(Math.sin(y * 0.164 + x * 0.018 - z * 0.046))
        * Math.pow(Math.abs(Math.sin(y * 0.164 + x * 0.018 - z * 0.046)), 10)
        * 1.1 * waterfallHeadwallEnvelope;
      nextY += ledgeLift;
      waterfallHeadwallVertices += 1;
      maximumWaterfallHeadwallRelief = Math.max(maximumWaterfallHeadwallRelief, Math.abs(relief));
    }

    if (z >= -808 && z <= -315) {
      const longitudinal = smoothRange(-808, -792, z) * (1 - smoothRange(-338, -318, z));
      const halfWidth = v116RiverHalfWidth(z);
      const cross = Math.abs(x - v116RiverCenter(z));
      const channel = (1 - smoothRange(halfWidth * 0.72, halfWidth + 4.2, cross)) * longitudinal;
      if (channel > 0.001) {
        const waterLevel = v116WatershedHeight(z) + 0.58;
        const bedDepth = 0.74 + (1 - Math.min(1, cross / Math.max(halfWidth, 0.001))) * 0.62;
        const breakup = Math.sin(z * 0.093 + x * 0.17) * 0.11;
        const target = waterLevel - bedDepth + breakup;
        const corrected = Math.min(nextY, target);
        nextY += (corrected - nextY) * channel;
        riverChannelVertices += 1;
      }
    }

    const distance = lakeBoundaryDistance(x, z);
    if (distance <= 1 || (distance <= 1.24 && y <= LAKE_WATER_LEVEL + 7.5)) {
      const angle = Math.atan2(
        (z - LAKE_CENTER.z) / LAKE_RADIUS.z,
        (x - LAKE_CENTER.x) / LAKE_RADIUS.x,
      );
      const breakup = Math.sin(angle * 5 - 0.7) * 0.56
        + Math.sin(angle * 11 + 1.8) * 0.24
        + Math.sin(x * 0.071 - z * 0.037) * 0.18;
      const edgeOffset = distance - 1;
      const target = edgeOffset <= 0
        ? LAKE_WATER_LEVEL - 0.42 - Math.pow(Math.min(1, -edgeOffset / 0.18), 1.35) * 2.15
        : LAKE_WATER_LEVEL - 0.42 + Math.pow(Math.min(1, edgeOffset / 0.24), 1.38) * (3.65 + breakup);
      // Every source vertex inside the lake is bounded below its water plane.
      // The former interior fade left occasional high source triangles visible
      // through the transparent surface as rectangular shoreline wedges.
      const envelope = edgeOffset <= 0 ? 1 : 1 - smoothCoastalStep(edgeOffset / 0.24);
      const corrected = edgeOffset <= 0 ? Math.min(nextY, target) : Math.max(nextY, target);
      nextY += (corrected - nextY) * envelope;
    }

    // Re-form the source heightfield around the actual waterfall system. The
    // upstream channel, scalloped plunge basin, and downstream outflow all
    // modify the active Valley terrain; there is no freestanding cliff slab or
    // decorative bank collar hiding the old landform.
    if (z >= WATERFALL_HEADWATER_START_Z - 8 && z <= -724) {
      const center = waterfallUpperCenter(z);
      const level = waterfallUpperLevel(z);
      const cross = Math.abs(x - center);
      const halfWidth = waterfallUpperHalfWidth(z);
      const longitudinal = smoothRange(WATERFALL_HEADWATER_START_Z - 8, WATERFALL_HEADWATER_START_Z + 8, z)
        * (1 - smoothRange(-736, -724, z));
      const channel = (1 - smoothRange(halfWidth * 0.72, halfWidth + 9.5, cross)) * longitudinal;
      if (channel > 0.001) {
        const bankRise = smoothRange(halfWidth * 0.34, halfWidth + 8.2, cross) * 2.75;
        const breakup = Math.sin(z * 0.083 + x * 0.119) * 0.38 + Math.sin(z * 0.191 - x * 0.047) * 0.16;
        const target = level - 0.88 + bankRise + breakup;
        const boundedTarget = Math.min(nextY + 9, Math.max(nextY - 9, target));
        nextY += (boundedTarget - nextY) * channel * 0.92;
        waterfallChannelVertices += 1;
      }
    }

    const basinX = (x - PLUNGE_POOL_CENTER.x) / 70;
    const basinZ = (z - PLUNGE_POOL_CENTER.z) / 48;
    const basinDistance = Math.hypot(basinX, basinZ);
    if (basinDistance < 1.22 && z > -733) {
      const basinEnvelope = 1 - smoothRange(0.48, 1.22, basinDistance);
      const radialBreakup = Math.sin(Math.atan2(basinZ, basinX) * 5.0 + 0.7) * 1.1
        + Math.sin(x * 0.087 - z * 0.061) * 0.55;
      const target = WATERFALL_BOTTOM.y - 1.2
        + Math.pow(Math.min(1, basinDistance), 1.55) * 9.8
        + radialBreakup * basinDistance;
      const corrected = Math.min(nextY, target);
      nextY += (corrected - nextY) * basinEnvelope;
      if (Math.abs(corrected - nextY) > 0.001 || nextY < y - 0.001) waterfallBasinVertices += 1;
    }

    const outflowDistance = distanceToWaterfallOutflow(x, z);
    if (outflowDistance < 18.5 && z <= -694 && z >= -792) {
      const outflowEnvelope = 1 - smoothRange(7.5, 18.5, outflowDistance);
      const target = -45.3 + smoothRange(0, 18.5, outflowDistance) * 2.4
        + Math.sin(x * 0.12 + z * 0.077) * 0.28;
      const corrected = Math.min(nextY, target);
      nextY += (corrected - nextY) * outflowEnvelope;
      waterfallOutflowVertices += 1;
    }

    const headwallDistance = Math.hypot((x - 170) / 132, (z + 718) / 104);
    if (headwallDistance < 1 && nextY > -43 && nextY < 92) {
      const headwallEnvelope = 1 - smoothRange(0.42, 1, headwallDistance);
      const elevationEnvelope = smoothRange(-43, -24, nextY) * (1 - smoothRange(62, 92, nextY));
      const ribs = Math.sin(x * 0.061 + z * 0.028 + 0.4) * 1.08
        + Math.sin(x * 0.113 - z * 0.047) * 0.48;
      const gullies = Math.pow(Math.abs(Math.sin(x * 0.038 + z * 0.021 - 0.8)), 4) * -1.25;
      const ledgePhase = nextY * 0.11
        + x * 0.049
        - z * 0.018
        + Math.sin(x * 0.023 + z * 0.031) * 1.2;
      const ledges = Math.sign(Math.sin(ledgePhase))
        * Math.pow(Math.abs(Math.sin(ledgePhase)), 7) * 0.46;
      nextY += (ribs + gullies + ledges) * headwallEnvelope * elevationEnvelope;
      waterfallErosionVertices += 1;
    }

    // The independently authored v1.15 Valley and Alpine meshes meet at
    // z=-980, but their boundary heights were not identical. In the live
    // Valley reveal that mismatch exposed a thin sky/water crack. Align the
    // actual subdivided Valley boundary to the decoded Alpine edge and ease
    // the correction through the final 28 metres of terrain. This changes the
    // source surface itself; there is no seam card, skirt, or camera evasion.
    if (alpineBoundary.length && z <= -952) {
      const seamEnvelope = 1 - smoothCoastalStep((z + 980) / 28);
      if (seamEnvelope > 0.001) {
        const alpineHeight = sampleTerrainSeamHeight(alpineBoundary, x);
        const adjustment = (alpineHeight - nextY) * seamEnvelope;
        nextY += adjustment;
        alpineSeamVertices += 1;
        maximumAlpineSeamAdjustment = Math.max(maximumAlpineSeamAdjustment, Math.abs(adjustment));
      }
    }

    // The Ridge and Valley sources also meet at z=-315. Only the shared
    // x-range is a real adjacency; the wider Valley flanks remain exposed by
    // design. Remesh that shared edge into the decoded Ridge height profile so
    // the first reveal cannot expose a bright background slit between meshes.
    if (
      ridgeBoundary.length
      && z >= -343
      && x >= ridgeBoundary[0].x
      && x <= ridgeBoundary[ridgeBoundary.length - 1].x
    ) {
      const seamEnvelope = smoothCoastalStep((z + 343) / 28);
      if (seamEnvelope > 0.001) {
        const ridgeHeight = sampleTerrainSeamHeight(ridgeBoundary, x);
        const adjustment = (ridgeHeight - nextY) * seamEnvelope;
        nextY += adjustment;
        ridgeSeamVertices += 1;
        maximumRidgeSeamAdjustment = Math.max(maximumRidgeSeamAdjustment, Math.abs(adjustment));
      }
    }

    maximumAdjustment = Math.max(maximumAdjustment, Math.abs(nextY - y));
    if (Math.abs(nextY - y) > 0.001) adjustedVertices += 1;
    positions.setY(index, nextY);
  }
  positions.needsUpdate = true;
  if (geometry.getAttribute("uv") && !geometry.getAttribute("uv1")) {
    geometry.setAttribute("uv1", geometry.getAttribute("uv").clone());
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  if (ridgeBoundary.length) {
    const weldedGeometry = createExactDetailedRidgeValleyWeldGeometry(
      geometry,
      ridgeBoundary,
      ridgeInteriorBoundary,
    );
    if (weldedGeometry !== geometry) {
      geometry.dispose();
      geometry = weldedGeometry;
    }
  }
  geometry.name = "Madagin v1.16 integrated irregular watershed terrain";
  geometry.userData.watershedIntegration = {
    adjustedVertices,
    maximumAdjustmentMeters: maximumAdjustment,
    method: "source-terrain lake boundary plus connected waterfall channel, plunge-basin, and outflow landform remesh",
    riverCorridor: {
      channelVertices: riverChannelVertices,
      method: "bounded centerline-following bed incision under an irregular project-authored surface",
      zRange: [-808, -315],
    },
    valleyGeology: {
      adjustedVertices: valleyGeologyVertices,
      method: "coherent axial ribs, fractured ledges, and three subtractive tributary gullies",
      seamProtected: true,
      watershedProtected: true,
    },
    easternValleyCatchments: {
      adjustedVertices: easternCatchmentVertices,
      lakeRiverAndWaterfallProtected: true,
      maximumIncisionMeters: maximumEasternCatchmentIncision,
      maximumUpliftMeters: maximumEasternCatchmentUplift,
      method: "four branching east-shoulder catchments with eight second-order rills separated by two non-repeating source-surface buttress wavelengths",
      ridgeAndAlpineBoundariesProtected: true,
    },
    easternLakeApproachBank: {
      adjustedVertices: easternLakeApproachBankVertices,
      lakeRiverAndWaterfallProtected: true,
      maximumIncisionMeters: maximumEasternLakeApproachBankIncision,
      maximumUpliftMeters: maximumEasternLakeApproachBankUplift,
      method: "two measured fall-line source-surface ravines with unequal branches and interlocking bank shoulders",
      ridgeAndAlpineBoundariesProtected: true,
    },
    contactTrailheadRelief: {
      adjustedVertices: contactTrailheadReliefVertices,
      lakeRiverAndWaterfallProtected: true,
      maximumIncisionMeters: maximumContactTrailheadIncision,
      maximumUpliftMeters: maximumContactTrailheadUplift,
      method: "two measured downslope rills with an unequal branch and paired source-surface shoulders",
      ridgeAndAlpineBoundariesProtected: true,
    },
    westernCliffGeology: {
      adjustedVertices: westernCliffVertices,
      maximumReliefMeters: maximumWesternCliffRelief,
      method: "normal-directed ribs, fractured ledges, and subtractive drainage on the steep western Valley face",
      alpineBoundaryProtected: true,
      lakeEdgeProtected: true,
    },
    waterfallBasinHeadwall: {
      adjustedVertices: waterfallHeadwallVertices,
      maximumReliefMeters: maximumWaterfallHeadwallRelief,
      method: "conforming shared-edge refinement plus basin-radial ribs, fractured ledges, and subtractive drainage on the active Valley source surface",
      detachedGeometry: false,
      waterfallLipProtected: true,
    },
    alpineBoundaryRemesh: {
      adjustedVertices: alpineSeamVertices,
      boundarySamples: alpineBoundary.length,
      maximumAdjustmentMeters: maximumAlpineSeamAdjustment,
      method: "decoded Alpine boundary alignment eased through the final 28 metres of the subdivided Valley surface",
    },
    ridgeBoundaryRemesh: {
      adjustedVertices: ridgeSeamVertices,
      boundarySamples: ridgeBoundary.length,
      maximumAdjustmentMeters: maximumRidgeSeamAdjustment,
      method: "shared-span decoded Ridge boundary alignment eased through the first 28 metres of the subdivided Valley surface",
    },
    ridgeBoundaryWeld: geometry.userData.detailedRidgeValleyWeld ?? null,
    subdivision: geometry.userData.watershedSubdivision,
    waterfallLandform: {
      basinVertices: waterfallBasinVertices,
      channelVertices: waterfallChannelVertices,
      erosionVertices: waterfallErosionVertices,
      outflowVertices: waterfallOutflowVertices,
      plungePoolCenter: PLUNGE_POOL_CENTER,
      waterfallBottom: WATERFALL_BOTTOM,
      waterfallTop: WATERFALL_TOP,
    },
  };
  return geometry;
}

function DetailedTerrainChunk({ connectedCoast = false, shadows, tier, zone }: {
  connectedCoast?: boolean;
  shadows: boolean;
  tier: WorldQualityTier;
  zone: DetailedTerrainZone;
}) {
  const gltf = useLoader(GLTFLoader, V115_HIGH_TERRAIN_URL, configureCompressedGltf);
  const materialZone: DetailedTerrainMaterialZone = connectedCoast ? "connected" : zone;
  const textureUrls = connectedCoast || zone === "ridge"
    ? [...DETAILED_GROUND_TEXTURES.forest]
    : [...DETAILED_GROUND_TEXTURES.rock];
  const sourceTextures = useLoader(TextureLoader, textureUrls) as Texture[];
  const textures = useMemo(
    () => preparePbrTextureSet(
      sourceTextures,
      materialZone === "connected" ? 94 : zone === "alpine" ? 138 : zone === "valley" ? 116 : 94,
    ),
    [materialZone, sourceTextures, zone],
  );
  const material = useMemo(() => createDetailedTerrainMaterial(materialZone, textures), [materialZone, textures]);
  const ridgeGeometry = useMemo(() => {
    if (connectedCoast || zone !== "ridge") return null;
    gltf.scene.updateMatrixWorld(true);
    const source = gltf.scene.getObjectByName(DETAILED_TERRAIN_OBJECTS.ridge);
    return source instanceof Mesh ? createRidgeErosionTerrainGeometry(source) : null;
  }, [connectedCoast, gltf.scene, zone]);
  const alpineGeometry = useMemo(() => {
    if (connectedCoast || zone !== "alpine") return null;
    gltf.scene.updateMatrixWorld(true);
    const source = gltf.scene.getObjectByName(DETAILED_TERRAIN_OBJECTS.alpine);
    return source instanceof Mesh ? createAlpineGeologyTerrainGeometry(source, "detailed") : null;
  }, [connectedCoast, gltf.scene, zone]);
  const seamField = useMemo<TerrainSeamField>(() => {
    if (!connectedCoast) return { ridge: [], valley: [] };
    gltf.scene.updateMatrixWorld(true);
    const ridge = gltf.scene.getObjectByName(DETAILED_TERRAIN_OBJECTS.ridge);
    const valley = gltf.scene.getObjectByName(DETAILED_TERRAIN_OBJECTS.valley);
    return {
      ridge: ridge instanceof Mesh ? extractTerrainSeamSamples(ridge) : [],
      valley: valley instanceof Mesh ? extractTerrainSeamSamples(valley) : [],
    };
  }, [connectedCoast, gltf.scene]);
  const object = useMemo(() => {
    if (ridgeGeometry) return new Object3D();
    gltf.scene.updateMatrixWorld(true);
    const source = gltf.scene.getObjectByName(DETAILED_TERRAIN_OBJECTS[zone]);
    if (!(source instanceof Mesh)) return new Object3D();
    const result = source.clone(true);
    result.matrix.copy(source.matrixWorld);
    result.matrixAutoUpdate = false;
    result.name = `Madagin v1.16 cumulative ${zone} high-detail terrain`;
    result.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.material = material;
      child.castShadow = shadows && zone === "ridge";
      child.receiveShadow = true;
      child.frustumCulled = true;
    });
    return result;
  }, [gltf.scene, material, ridgeGeometry, shadows, zone]);
  const alpineBoundary = useMemo(() => {
    if (connectedCoast || zone !== "valley") return [];
    gltf.scene.updateMatrixWorld(true);
    const alpine = gltf.scene.getObjectByName(DETAILED_TERRAIN_OBJECTS.alpine);
    return alpine instanceof Mesh ? extractTerrainSeamSamples(alpine, -980) : [];
  }, [connectedCoast, gltf.scene, zone]);
  const ridgeBoundary = useMemo(() => {
    if (connectedCoast || zone !== "valley") return [];
    gltf.scene.updateMatrixWorld(true);
    const ridge = gltf.scene.getObjectByName(DETAILED_TERRAIN_OBJECTS.ridge);
    return ridge instanceof Mesh ? extractTerrainSeamSamples(ridge, -315) : [];
  }, [connectedCoast, gltf.scene, zone]);
  const ridgeInteriorBoundary = useMemo(() => {
    if (connectedCoast || zone !== "valley") return [];
    gltf.scene.updateMatrixWorld(true);
    const ridge = gltf.scene.getObjectByName(DETAILED_TERRAIN_OBJECTS.ridge);
    return ridge instanceof Mesh ? extractTerrainSeamSamples(ridge, -287) : [];
  }, [connectedCoast, gltf.scene, zone]);
  const watershedGeometry = useMemo(() => {
    if (connectedCoast || zone !== "valley") return null;
    gltf.scene.updateMatrixWorld(true);
    const source = gltf.scene.getObjectByName(DETAILED_TERRAIN_OBJECTS.valley);
    return source instanceof Mesh
      ? createIntegratedWatershedTerrainGeometry(source, alpineBoundary, ridgeBoundary, 1, 2, ridgeInteriorBoundary)
      : null;
  }, [alpineBoundary, connectedCoast, gltf.scene, ridgeBoundary, ridgeInteriorBoundary, zone]);
  const coastalBoundary = useMemo(() => {
    if (!connectedCoast || zone !== "ridge") return [];
    gltf.scene.updateMatrixWorld(true);
    const source = gltf.scene.getObjectByName(DETAILED_TERRAIN_OBJECTS.ridge);
    return source instanceof Mesh ? extractCoastalBoundarySamples(source, -310) : [];
  }, [connectedCoast, gltf.scene, zone]);
  const connectedGeometry = useMemo(() => {
    if (!coastalBoundary.length) return null;
    gltf.scene.updateMatrixWorld(true);
    const source = gltf.scene.getObjectByName(DETAILED_TERRAIN_OBJECTS.ridge);
    if (!(source instanceof Mesh)) return null;
    const shoulder = createCoastalShoulderGeometry(false, tier, coastalBoundary);
    const result = createConnectedRidgeGeometry(source, shoulder);
    shoulder.dispose();
    if (result) applyTerminalSeamNormals(result, seamField);
    return result;
  }, [coastalBoundary, gltf.scene, seamField, tier]);
  const coastalPlacements = useMemo(() => {
    if (!coastalBoundary.length) return [];
    const shoulder = createCoastalShoulderGeometry(false, tier, coastalBoundary);
    const placements = createCoastalPlacements(shoulder, false, tier);
    shoulder.dispose();
    return placements;
  }, [coastalBoundary, tier]);
  const terminalChunkGeometry = useMemo(() => {
    if (!connectedCoast || zone !== "valley") return null;
    gltf.scene.updateMatrixWorld(true);
    const source = gltf.scene.getObjectByName(DETAILED_TERRAIN_OBJECTS.valley);
    return source instanceof Mesh ? createTerminalChunkGeometry(source, seamField) : null;
  }, [connectedCoast, gltf.scene, seamField, zone]);
  const terminalBridgeGeometry = useMemo(
    () => connectedCoast && zone === "ridge" && seamField.ridge.length && seamField.valley.length
      ? createTerrainSeamBridgeGeometry(seamField, false)
      : null,
    [connectedCoast, seamField, zone],
  );

  useEffect(() => {
    const host = window as Window & {
      __MADAGIN_COASTAL_SHOULDER_V116__?: Record<string, unknown>;
      __MADAGIN_DETAILED_TERRAIN_V116__?: Record<string, unknown>;
    };
    host.__MADAGIN_DETAILED_TERRAIN_V116__ = {
      ...(host.__MADAGIN_DETAILED_TERRAIN_V116__ ?? {}),
      [zone]: {
        object: DETAILED_TERRAIN_OBJECTS[zone],
        source: V115_HIGH_TERRAIN_URL,
        ridgeErosion: ridgeGeometry?.userData.ridgeErosion ?? null,
        watershedIntegration: watershedGeometry?.userData.watershedIntegration ?? null,
      },
    };
    document.documentElement.dataset.madaginDetailedTerrainV116 = JSON.stringify(host.__MADAGIN_DETAILED_TERRAIN_V116__);
    if (alpineGeometry) {
      const alpineHost = window as Window & { __MADAGIN_ALPINE_GEOLOGY_V116__?: Record<string, unknown> };
      alpineHost.__MADAGIN_ALPINE_GEOLOGY_V116__ = {
        ...(alpineHost.__MADAGIN_ALPINE_GEOLOGY_V116__ ?? {}),
        detailed: alpineGeometry.userData.alpineGeology ?? null,
      };
      document.documentElement.dataset.madaginAlpineGeologyV116 = JSON.stringify(
        alpineHost.__MADAGIN_ALPINE_GEOLOGY_V116__,
      );
      dispatchStage(2, "alpine-detailed-fractured-source-terrain-ready", "alpine");
    }
    dispatchStage(zone === "ridge" ? 0 : 1, `${zone}-cumulative-v115-high-pbr-terrain-ready`, zone);
    if (connectedGeometry) {
      host.__MADAGIN_COASTAL_SHOULDER_V116__ = {
        boundarySamples: coastalBoundary.length,
        boundaryZ: [coastalBoundary[0]?.z ?? null, coastalBoundary[coastalBoundary.length - 1]?.z ?? null],
        joinedVertices: connectedGeometry.getAttribute("position").count,
        mode: "welded-high-detail-ridge",
        weld: connectedGeometry.userData.coastalWeldDiagnostics ?? null,
      };
      document.documentElement.dataset.madaginCoastalShoulderV116 = JSON.stringify(host.__MADAGIN_COASTAL_SHOULDER_V116__);
      dispatchStage(1, "summit-welded-coastal-shoulder-ready", "ridge");
    }
    return () => {
      alpineGeometry?.dispose();
      connectedGeometry?.dispose();
      ridgeGeometry?.dispose();
      terminalChunkGeometry?.dispose();
      terminalBridgeGeometry?.dispose();
      watershedGeometry?.dispose();
      material.dispose();
      Object.values(textures).forEach((texture) => texture.dispose());
    };
  }, [alpineGeometry, coastalBoundary, connectedGeometry, material, ridgeGeometry, terminalBridgeGeometry, terminalChunkGeometry, textures, watershedGeometry, zone]);

  return connectedGeometry ? (
    <>
      <mesh
        castShadow={shadows}
        geometry={connectedGeometry}
        material={material}
        name="Madagin v1.16 connected ridge and coastal shoulder"
        receiveShadow
      />
      {terminalBridgeGeometry ? <mesh geometry={terminalBridgeGeometry} material={material} receiveShadow /> : null}
      {coastalPlacements.length ? (
        <Suspense fallback={null}>
          <CoastalEcology placements={coastalPlacements} shadows={shadows} />
        </Suspense>
      ) : null}
    </>
  ) : terminalChunkGeometry ? (
    <mesh geometry={terminalChunkGeometry} material={material} name="Madagin v1.16 seam-smoothed terminal valley" receiveShadow />
  ) : ridgeGeometry ? (
    <mesh castShadow={shadows} geometry={ridgeGeometry} material={material} name="Madagin v1.16 detailed erosion-cut Ridge terrain" receiveShadow />
  ) : alpineGeometry ? (
    <mesh geometry={alpineGeometry} material={material} name="Madagin v1.16 detailed fractured Alpine terrain" receiveShadow />
  ) : watershedGeometry ? (
    <mesh geometry={watershedGeometry} material={material} name="Madagin v1.16 integrated irregular watershed terrain" receiveShadow />
  ) : <primitive object={object} />;
}

const COASTAL_RIDGE_WEST_PROFILE: Array<[z: number, height: number]> = [
  [-315, 0.23],
  [-261, 0.57],
  [-200, 2.92],
  [-140, 20.94],
  [-79, 41.5],
  [-18, 28.52],
  [42, -2.26],
  [103, -10.31],
  [164, -9.52],
  [224, -9.33],
  [285, -9.93],
];

// First interior column of RIDGE_V115_HIGH (x = -306.7708). Sampling the
// authored neighbor lets the procedural extension meet both the position and
// the local cross-slope of the retained ridge instead of forming a lit seam.
const COASTAL_RIDGE_INNER_PROFILE: Array<[z: number, height: number]> = [
  [-315, 0.31],
  [-261, 1.49],
  [-200, 3.34],
  [-140, 20.45],
  [-79, 42.55],
  [-18, 28.93],
  [42, 1.97],
  [103, -10.21],
  [164, -9.79],
  [224, -9.2],
  [285, -9.88],
];

const COASTAL_VALLEY_NEAR_PROFILE: Array<[x: number, height: number]> = [
  [-730, 0.23],
  [-650, 0.23],
  [-570, 0.23],
  [-490, 0.23],
  [-410, 0.23],
  [-350, 0.22],
  [-310, 0.23],
];

function smoothCoastalStep(value: number) {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function sampleCoastalProfile(profile: Array<[number, number]>, coordinate: number) {
  for (let index = 0; index < profile.length - 1; index += 1) {
    const current = profile[index];
    const next = profile[index + 1];
    if (coordinate >= current[0] && coordinate <= next[0]) {
      const progress = (coordinate - current[0]) / (next[0] - current[0]);
      return current[1] + (next[1] - current[1]) * smoothCoastalStep(progress);
    }
  }
  return coordinate < profile[0][0] ? profile[0][1] : profile[profile.length - 1][1];
}

function extractCoastalBoundarySamples(source: Mesh, targetX: number) {
  source.updateMatrixWorld(true);
  const positions = source.geometry.getAttribute("position");
  const normals = source.geometry.getAttribute("normal");
  const points: Array<{ point: Vector3; normal: Vector3 }> = [];
  let boundaryX = Number.NaN;
  let boundaryDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < positions.count; index += 1) {
    const point = new Vector3().fromBufferAttribute(positions, index).applyMatrix4(source.matrixWorld);
    const distance = Math.abs(point.x - targetX);
    if (distance < boundaryDistance) {
      boundaryDistance = distance;
      boundaryX = point.x;
    }
    points.push({
      point,
      normal: normals
        ? new Vector3().fromBufferAttribute(normals, index).transformDirection(source.matrixWorld)
        : new Vector3(0, 1, 0),
    });
  }
  return points
    .filter(({ point }) => Math.abs(point.x - boundaryX) < 0.02)
    .map(({ point, normal }) => ({ height: point.y, normal, x: point.x, z: point.z }))
    .sort((left, right) => left.z - right.z);
}

function sampleCoastalBoundary(samples: CoastalBoundarySample[], z: number) {
  if (!samples.length) return null;
  for (let index = 0; index < samples.length - 1; index += 1) {
    const current = samples[index];
    const next = samples[index + 1];
    if (z >= current.z && z <= next.z) {
      const progress = (z - current.z) / (next.z - current.z);
      return {
        height: current.height + (next.height - current.height) * progress,
        normal: current.normal.clone().lerp(next.normal, progress).normalize(),
        x: current.x + (next.x - current.x) * progress,
        z,
      };
    }
  }
  const endpoint = z < samples[0].z ? samples[0] : samples[samples.length - 1];
  return { height: endpoint.height, normal: endpoint.normal.clone(), x: endpoint.x, z };
}

function extractTerrainSeamSamples(source: Mesh, targetZ = -315) {
  source.updateMatrixWorld(true);
  const positions = source.geometry.getAttribute("position");
  const normals = source.geometry.getAttribute("normal");
  const points: Array<{ point: Vector3; normal: Vector3 }> = [];
  let boundaryZ = Number.NaN;
  let boundaryDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < positions.count; index += 1) {
    const point = new Vector3().fromBufferAttribute(positions, index).applyMatrix4(source.matrixWorld);
    const distance = Math.abs(point.z - targetZ);
    if (distance < boundaryDistance) {
      boundaryDistance = distance;
      boundaryZ = point.z;
    }
    points.push({
      point,
      normal: normals
        ? new Vector3().fromBufferAttribute(normals, index).transformDirection(source.matrixWorld)
        : new Vector3(0, 1, 0),
    });
  }
  return points
    .filter(({ point }) => Math.abs(point.z - boundaryZ) < 0.04)
    .map(({ point, normal }) => ({ height: point.y, normal, x: point.x, z: point.z }))
    .sort((left, right) => left.x - right.x);
}

function sampleTerrainSeamNormal(samples: CoastalBoundarySample[], x: number) {
  if (!samples.length) return new Vector3(0, 1, 0);
  for (let index = 0; index < samples.length - 1; index += 1) {
    const current = samples[index];
    const next = samples[index + 1];
    if (x >= current.x && x <= next.x) {
      const progress = (x - current.x) / (next.x - current.x);
      return current.normal.clone().lerp(next.normal, progress).normalize();
    }
  }
  return (x < samples[0].x ? samples[0] : samples[samples.length - 1]).normal.clone();
}

function sampleTerrainSeamHeight(samples: CoastalBoundarySample[], x: number) {
  if (!samples.length) return 0;
  for (let index = 0; index < samples.length - 1; index += 1) {
    const current = samples[index];
    const next = samples[index + 1];
    if (x >= current.x && x <= next.x) {
      const progress = (x - current.x) / (next.x - current.x);
      return current.height + (next.height - current.height) * progress;
    }
  }
  return (x < samples[0].x ? samples[0] : samples[samples.length - 1]).height;
}

function createExactDetailedRidgeValleyWeldGeometry(
  source: BufferGeometry,
  ridgeBoundary: CoastalBoundarySample[],
  ridgeInterior: CoastalBoundarySample[] = [],
) {
  if (ridgeBoundary.length < 2) return source;
  const sourceMesh = new Mesh(source);
  const valleyBoundary = extractTerrainSeamSamples(sourceMesh, -315);
  if (valleyBoundary.length < 2) return source;
  const boundaryZ = valleyBoundary[0].z;
  // Replace only the first native subdivided Valley cell. The earlier 28 m
  // calibration closed the edge but visibly straightened the landform; one
  // cell is sufficient to give the two independently tessellated sources an
  // identical decoded boundary without changing the broader Valley grade.
  const valleyInterior = extractTerrainSeamSamples(sourceMesh, boundaryZ - 2.6);
  if (valleyInterior.length < 2) return source;
  const interiorZ = valleyInterior[0].z;
  const valleyDeepInterior = extractTerrainSeamSamples(sourceMesh, interiorZ - 2.6);
  const ridgeMinimumX = ridgeBoundary[0].x;
  const ridgeMaximumX = ridgeBoundary[ridgeBoundary.length - 1].x;
  const joinedBoundary = [
    ...valleyBoundary.filter(({ x }) => x < ridgeMinimumX - 0.001),
    ...ridgeBoundary.map((sample) => ({ ...sample, normal: sample.normal.clone(), z: boundaryZ })),
    ...valleyBoundary.filter(({ x }) => x > ridgeMaximumX + 0.001),
  ].sort((left, right) => left.x - right.x);
  if (joinedBoundary.length < 2) return source;

  const measureChordMismatch = (candidate: CoastalBoundarySample[]) => {
    let maximum = 0;
    for (let probe = 0; probe <= 4096; probe += 1) {
      const x = ridgeMinimumX + (ridgeMaximumX - ridgeMinimumX) * (probe / 4096);
      maximum = Math.max(
        maximum,
        Math.abs(sampleTerrainSeamHeight(candidate, x) - sampleTerrainSeamHeight(ridgeBoundary, x)),
      );
    }
    return maximum;
  };
  const maximumPreWeldChordMismatch = measureChordMismatch(valleyBoundary);
  const maximumPostWeldChordMismatch = measureChordMismatch(joinedBoundary);
  const stripSpan = boundaryZ - interiorZ;
  const rows = Math.max(4, Math.ceil(Math.abs(stripSpan) / 0.7));
  const interiorColumns = Math.max(valleyInterior.length, joinedBoundary.length) - 1;
  const minimumX = valleyInterior[0].x;
  const maximumX = valleyInterior[valleyInterior.length - 1].x;
  const positions: number[] = [];
  const uvs: number[] = [];
  const rowIndices: number[][] = [];

  const heightAt = (x: number, along: number) => {
    const interiorHeight = sampleTerrainSeamHeight(valleyInterior, x);
    const boundaryHeight = sampleTerrainSeamHeight(joinedBoundary, x);
    const deepZ = valleyDeepInterior[0]?.z;
    const interiorSlope = deepZ !== undefined
      ? Math.min(3.2, Math.max(-3.2, (
        interiorHeight - sampleTerrainSeamHeight(valleyDeepInterior, x)
      ) / Math.max(0.001, interiorZ - deepZ)))
      : 0;
    const valleyBoundarySlope = (boundaryHeight - interiorHeight) / Math.max(0.001, stripSpan);
    const ridgeInteriorZ = ridgeInterior[0]?.z;
    const ridgeBoundarySlope = ridgeInteriorZ !== undefined
      ? (sampleTerrainSeamHeight(ridgeInterior, x) - sampleTerrainSeamHeight(ridgeBoundary, x))
        / Math.max(0.001, ridgeInteriorZ - boundaryZ)
      : valleyBoundarySlope;
    const sharedSpan = x >= ridgeMinimumX && x <= ridgeMaximumX;
    const boundarySlope = Math.min(3.2, Math.max(
      -3.2,
      sharedSpan ? ridgeBoundarySlope : valleyBoundarySlope,
    ));
    const along2 = along * along;
    const along3 = along2 * along;
    return (2 * along3 - 3 * along2 + 1) * interiorHeight
      + (along3 - 2 * along2 + along) * interiorSlope * stripSpan
      + (-2 * along3 + 3 * along2) * boundaryHeight
      + (along3 - along2) * boundarySlope * stripSpan;
  };

  source.computeBoundingBox();
  const bounds = source.boundingBox;
  const uvWidth = Math.max(0.001, (bounds?.max.x ?? 730) - (bounds?.min.x ?? -730));
  const uvDepth = Math.max(0.001, (bounds?.max.z ?? -315) - (bounds?.min.z ?? -980));
  for (let row = 0; row <= rows; row += 1) {
    const along = row / rows;
    const samples = row === 0
      ? valleyInterior
      : row === rows
        ? joinedBoundary
        : Array.from({ length: interiorColumns + 1 }, (_, column) => ({
            x: minimumX + (maximumX - minimumX) * (column / interiorColumns),
          }));
    const indices: number[] = [];
    const z = interiorZ + stripSpan * along;
    samples.forEach(({ x }) => {
      indices.push(positions.length / 3);
      positions.push(x, heightAt(x, along), z);
      uvs.push(
        (x - (bounds?.min.x ?? -730)) / uvWidth,
        (z - (bounds?.min.z ?? -980)) / uvDepth,
      );
    });
    rowIndices.push(indices);
  }

  const patchIndices: number[] = [];
  const connectRows = (lower: number[], upper: number[]) => {
    let lowerIndex = 0;
    let upperIndex = 0;
    while (lowerIndex < lower.length - 1 || upperIndex < upper.length - 1) {
      if (lowerIndex >= lower.length - 1) {
        patchIndices.push(lower[lowerIndex], upper[upperIndex], upper[upperIndex + 1]);
        upperIndex += 1;
        continue;
      }
      if (upperIndex >= upper.length - 1) {
        patchIndices.push(lower[lowerIndex], upper[upperIndex], lower[lowerIndex + 1]);
        lowerIndex += 1;
        continue;
      }
      const lowerNextX = positions[lower[lowerIndex + 1] * 3];
      const upperNextX = positions[upper[upperIndex + 1] * 3];
      if (lowerNextX <= upperNextX) {
        patchIndices.push(lower[lowerIndex], upper[upperIndex], lower[lowerIndex + 1]);
        lowerIndex += 1;
      } else {
        patchIndices.push(lower[lowerIndex], upper[upperIndex], upper[upperIndex + 1]);
        upperIndex += 1;
      }
    }
  };
  for (let row = 0; row < rows; row += 1) connectRows(rowIndices[row], rowIndices[row + 1]);

  const patch = new BufferGeometry();
  patch.setAttribute("position", new Float32BufferAttribute(positions, 3));
  const patchUv = new Float32BufferAttribute(uvs, 2);
  patch.setAttribute("uv", patchUv);
  patch.setAttribute("uv1", patchUv.clone());
  patch.setIndex(patchIndices);
  patch.computeVertexNormals();
  const patchNormals = patch.getAttribute("normal");
  [
    { indices: rowIndices[0], samples: valleyInterior },
    { indices: rowIndices[rows], samples: joinedBoundary },
  ].forEach(({ indices, samples }) => {
    indices.forEach((index) => {
      const normal = sampleTerrainSeamNormal(samples, positions[index * 3]);
      patchNormals.setXYZ(index, normal.x, normal.y, normal.z);
    });
  });
  patchNormals.needsUpdate = true;

  const sourcePositions = source.getAttribute("position");
  const sourceIndex = source.getIndex();
  const sourceIndexCount = sourceIndex?.count ?? sourcePositions.count;
  const retainedIndices: number[] = [];
  let removedStripTriangles = 0;
  for (let offset = 0; offset < sourceIndexCount; offset += 3) {
    const a = sourceIndex ? sourceIndex.getX(offset) : offset;
    const b = sourceIndex ? sourceIndex.getX(offset + 1) : offset + 1;
    const c = sourceIndex ? sourceIndex.getX(offset + 2) : offset + 2;
    const minimumTriangleZ = Math.min(
      sourcePositions.getZ(a),
      sourcePositions.getZ(b),
      sourcePositions.getZ(c),
    );
    if (minimumTriangleZ >= interiorZ - 0.04) {
      removedStripTriangles += 1;
    } else {
      retainedIndices.push(a, b, c);
    }
  }
  const retained = new BufferGeometry();
  ["position", "normal", "uv", "uv1"].forEach((attributeName) => {
    const attribute = source.getAttribute(attributeName);
    if (attribute) retained.setAttribute(attributeName, attribute.clone());
  });
  retained.setIndex(retainedIndices);
  const merged = mergeGeometries([retained, patch], false);
  retained.dispose();
  patch.dispose();
  if (!merged) return source;
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  merged.name = "Madagin v1.16 exact-edge welded detailed Valley terrain";
  merged.userData = {
    ...source.userData,
    detailedRidgeValleyWeld: {
      detachedGeometry: false,
      exactRidgeBoundaryPositions: ridgeBoundary.length,
      joinedBoundarySamples: joinedBoundary.length,
      maximumPostWeldChordMismatchMeters: maximumPostWeldChordMismatch,
      maximumPreWeldChordMismatchMeters: maximumPreWeldChordMismatch,
      method: "first-native-cell Valley surface replacement plus exact decoded Ridge edge and zipper-triangulated interior join",
      patchTriangles: patchIndices.length / 3,
      removedStripTriangles,
      ridgeBoundarySamples: ridgeBoundary.length,
      rows,
      sharedXRange: [ridgeMinimumX, ridgeMaximumX],
      sourceSurfaceReplacement: true,
      stripZRange: [interiorZ, boundaryZ],
      valleyBoundarySamples: valleyBoundary.length,
      valleyInteriorSamples: valleyInterior.length,
    },
  };
  return merged;
}

function createExactBoundaryTerrainSeamBridge(field: TerrainSeamField) {
  const ridgeMinX = field.ridge[0]?.x ?? -310;
  const ridgeMaxX = field.ridge[field.ridge.length - 1]?.x ?? 310;
  const valleyMinX = field.valley[0]?.x ?? -730;
  const valleyMaxX = field.valley[field.valley.length - 1]?.x ?? 730;
  const minimumX = Math.max(ridgeMinX, valleyMinX);
  const maximumX = Math.min(ridgeMaxX, valleyMaxX);
  const ridge = field.ridge.filter(({ x }) => x >= minimumX - 0.001 && x <= maximumX + 0.001);
  const valley = field.valley.filter(({ x }) => x >= minimumX - 0.001 && x <= maximumX + 0.001);
  if (ridge.length < 2 || valley.length < 2) return null;

  const ridgeBoundaryZ = ridge[0].z;
  const valleyBoundaryZ = valley[0].z;
  const seamSpan = ridgeBoundaryZ - valleyBoundaryZ;
  const rows = Math.max(12, Math.ceil(Math.abs(seamSpan) / 1.4));
  const interiorColumns = Math.max(ridge.length, valley.length) - 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const rowIndices: number[][] = [];

  const heightAt = (x: number, along: number) => {
    const valleyHeight = sampleTerrainSeamHeight(valley, x);
    const ridgeHeight = sampleTerrainSeamHeight(ridge, x);
    const valleyInteriorZ = field.valleyInterior?.[0]?.z;
    const ridgeInteriorZ = field.ridgeInterior?.[0]?.z;
    const valleySlope = valleyInteriorZ !== undefined
      ? Math.min(3.2, Math.max(-3.2, (
        valleyHeight - sampleTerrainSeamHeight(field.valleyInterior ?? [], x)
      ) / Math.max(0.001, valleyBoundaryZ - valleyInteriorZ)))
      : 0;
    const ridgeSlope = ridgeInteriorZ !== undefined
      ? Math.min(3.2, Math.max(-3.2, (
        sampleTerrainSeamHeight(field.ridgeInterior ?? [], x) - ridgeHeight
      ) / Math.max(0.001, ridgeInteriorZ - ridgeBoundaryZ)))
      : 0;
    const along2 = along * along;
    const along3 = along2 * along;
    return (2 * along3 - 3 * along2 + 1) * valleyHeight
      + (along3 - 2 * along2 + along) * valleySlope * seamSpan
      + (-2 * along3 + 3 * along2) * ridgeHeight
      + (along3 - along2) * ridgeSlope * seamSpan
      + Math.sin(along * Math.PI) * 0.006;
  };

  for (let row = 0; row <= rows; row += 1) {
    const along = row / rows;
    const samples = row === 0
      ? valley
      : row === rows
        ? ridge
        : Array.from({ length: interiorColumns + 1 }, (_, column) => ({
            x: minimumX + (maximumX - minimumX) * (column / interiorColumns),
          }));
    const indices: number[] = [];
    samples.forEach(({ x }) => {
      const z = valleyBoundaryZ + seamSpan * along;
      indices.push(positions.length / 3);
      positions.push(x, heightAt(x, along), z);
      uvs.push((x + 310) / 620, (285 - z) / 600);
    });
    rowIndices.push(indices);
  }

  const indices: number[] = [];
  const connectRows = (lower: number[], upper: number[]) => {
    let lowerIndex = 0;
    let upperIndex = 0;
    while (lowerIndex < lower.length - 1 || upperIndex < upper.length - 1) {
      if (lowerIndex >= lower.length - 1) {
        indices.push(lower[lowerIndex], upper[upperIndex], upper[upperIndex + 1]);
        upperIndex += 1;
        continue;
      }
      if (upperIndex >= upper.length - 1) {
        indices.push(lower[lowerIndex], upper[upperIndex], lower[lowerIndex + 1]);
        lowerIndex += 1;
        continue;
      }
      const lowerNextX = positions[lower[lowerIndex + 1] * 3];
      const upperNextX = positions[upper[upperIndex + 1] * 3];
      if (lowerNextX <= upperNextX) {
        indices.push(lower[lowerIndex], upper[upperIndex], lower[lowerIndex + 1]);
        lowerIndex += 1;
      } else {
        indices.push(lower[lowerIndex], upper[upperIndex], upper[upperIndex + 1]);
        upperIndex += 1;
      }
    }
  };
  for (let row = 0; row < rows; row += 1) connectRows(rowIndices[row], rowIndices[row + 1]);

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  const uv = new Float32BufferAttribute(uvs, 2);
  geometry.setAttribute("uv", uv);
  geometry.setAttribute("uv1", uv.clone());
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.name = "Madagin v1.16 exact-boundary zipper-remeshed compact ridge-valley seam";
  geometry.userData.terminalSeamRemesh = {
    bridgeTriangles: indices.length / 3,
    method: "exact-source-boundary-zipper-hermite-remesh",
    maximumLiftMeters: 0.006,
    ridgeBoundarySamples: ridge.length,
    ridgeBoundaryZ,
    ridgeInteriorSamples: field.ridgeInterior?.length ?? 0,
    ridgeProfileX: [minimumX, maximumX],
    rows,
    seamSpanMeters: seamSpan,
    valleyBoundarySamples: valley.length,
    valleyBoundaryZ,
    valleyInteriorSamples: field.valleyInterior?.length ?? 0,
  };
  return geometry;
}

function createTerrainSeamBridgeGeometry(field: TerrainSeamField, mobile: boolean) {
  if (mobile) {
    const exactBoundaryBridge = createExactBoundaryTerrainSeamBridge(field);
    if (exactBoundaryBridge) return exactBoundaryBridge;
  }
  const columns = mobile ? 112 : 192;
  const ridgeMinX = field.ridge[0]?.x ?? -310;
  const ridgeMaxX = field.ridge[field.ridge.length - 1]?.x ?? 310;
  const ridgeFeatherMeters = mobile ? 180 : 220;
  const ridgeBoundaryZ = field.ridge[0]?.z ?? -315;
  const valleyBoundaryZ = field.valley[0]?.z ?? -315;
  const seamStart = mobile ? Math.min(ridgeBoundaryZ, valleyBoundaryZ) : -316.5;
  const seamEnd = mobile ? Math.max(ridgeBoundaryZ, valleyBoundaryZ) : -313.5;
  const seamSpan = seamEnd - seamStart;
  const rows = mobile ? Math.max(8, Math.ceil(seamSpan / 2)) : 2;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= rows; row += 1) {
    const along = row / rows;
    const z = seamStart + along * seamSpan;
    for (let column = 0; column <= columns; column += 1) {
      const across = column / columns;
      const x = -730 + across * 1460;
      const valleyHeight = sampleTerrainSeamHeight(field.valley, x);
      const hasRidgeProfile = x >= ridgeMinX && x <= ridgeMaxX;
      const ridgeFeather = x > ridgeMaxX && x < ridgeMaxX + ridgeFeatherMeters
        ? 1 - smoothCoastalStep((x - ridgeMaxX) / ridgeFeatherMeters)
        : 0;
      const ridgeInfluence = hasRidgeProfile ? 1 : ridgeFeather;
      const sampledRidgeHeight = sampleTerrainSeamHeight(field.ridge, Math.min(ridgeMaxX, Math.max(ridgeMinX, x)));
      const ridgeHeight = sampledRidgeHeight * ridgeInfluence + valleyHeight * (1 - ridgeInfluence);
      const valleyNormal = sampleTerrainSeamNormal(field.valley, x);
      const sampledRidgeNormal = sampleTerrainSeamNormal(field.ridge, Math.min(ridgeMaxX, Math.max(ridgeMinX, x)));
      const ridgeNormal = valleyNormal.clone().lerp(sampledRidgeNormal, ridgeInfluence).normalize();
      const valleyInteriorZ = field.valleyInterior?.[0]?.z;
      const ridgeInteriorZ = field.ridgeInterior?.[0]?.z;
      const measuredValleySlope = valleyInteriorZ !== undefined
        ? (valleyHeight - sampleTerrainSeamHeight(field.valleyInterior ?? [], x))
          / Math.max(0.001, valleyBoundaryZ - valleyInteriorZ)
        : -valleyNormal.z / Math.max(0.12, valleyNormal.y);
      const measuredRidgeSlope = ridgeInteriorZ !== undefined && ridgeInfluence > 0
        ? (
          sampleTerrainSeamHeight(
            field.ridgeInterior ?? [],
            Math.min(ridgeMaxX, Math.max(ridgeMinX, x)),
          ) - sampledRidgeHeight
        ) / Math.max(0.001, ridgeInteriorZ - ridgeBoundaryZ) * ridgeInfluence
          + (-valleyNormal.z / Math.max(0.12, valleyNormal.y)) * (1 - ridgeInfluence)
        : -ridgeNormal.z / Math.max(0.12, ridgeNormal.y);
      const valleySlope = Math.min(4.5, Math.max(-4.5, measuredValleySlope));
      const ridgeSlope = Math.min(4.5, Math.max(-4.5, measuredRidgeSlope));
      const along2 = along * along;
      const along3 = along2 * along;
      const projectedHeight = (2 * along3 - 3 * along2 + 1) * valleyHeight
        + (along3 - 2 * along2 + along) * valleySlope * seamSpan
        + (-2 * along3 + 3 * along2) * ridgeHeight
        + (along3 - along2) * ridgeSlope * seamSpan;
      const capLift = mobile ? Math.sin(along * Math.PI) * 0.008 : 0.012;
      positions.push(x, projectedHeight + capLift, z);
      uvs.push((x + 310) / 620, (285 - z) / 600);
      if (row < rows && column < columns) {
        const current = row * (columns + 1) + column;
        const next = current + columns + 1;
        indices.push(current, next, current + 1, current + 1, next, next + 1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  const uv = new Float32BufferAttribute(uvs, 2);
  geometry.setAttribute("uv", uv);
  geometry.setAttribute("uv1", uv.clone());
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const normals = geometry.getAttribute("normal");
  for (let row = 0; row <= rows; row += 1) {
    const along = row / rows;
    const normalBlend = smoothCoastalStep(along);
    for (let column = 0; column <= columns; column += 1) {
      const index = row * (columns + 1) + column;
      const x = positions[index * 3];
      const normal = sampleTerrainSeamNormal(field.valley, x)
        .lerp(sampleTerrainSeamNormal(field.ridge, x), normalBlend)
        .normalize();
      normals.setXYZ(index, normal.x, normal.y, normal.z);
    }
  }
  normals.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  let maximumCrossGrade = { grade: 0, x: 0, z: 0 };
  let maximumLongitudinalGrade = { grade: 0, x: 0, z: 0 };
  for (let row = 0; row <= rows; row += 1) {
    for (let column = 0; column <= columns; column += 1) {
      const index = row * (columns + 1) + column;
      if (column < columns) {
        const next = index + 1;
        const dx = Math.max(0.001, Math.abs(positions[next * 3] - positions[index * 3]));
        const grade = Math.abs(positions[next * 3 + 1] - positions[index * 3 + 1]) / dx;
        if (grade > maximumCrossGrade.grade) {
          maximumCrossGrade = { grade, x: positions[index * 3], z: positions[index * 3 + 2] };
        }
      }
      if (row < rows) {
        const next = index + columns + 1;
        const dz = Math.max(0.001, Math.abs(positions[next * 3 + 2] - positions[index * 3 + 2]));
        const grade = Math.abs(positions[next * 3 + 1] - positions[index * 3 + 1]) / dz;
        if (grade > maximumLongitudinalGrade.grade) {
          maximumLongitudinalGrade = { grade, x: positions[index * 3], z: positions[index * 3 + 2] };
        }
      }
    }
  }
  geometry.name = mobile
    ? "Madagin v1.16 tangent-remeshed compact ridge-valley seam cap"
    : "Madagin v1.16 decoded ridge-valley seam bridge";
  geometry.userData.terminalSeamRemesh = {
    columns,
    ridgeBoundaryZ,
    seamEnd,
    seamSpanMeters: seamSpan,
    seamStart,
    valleyBoundaryZ,
    maximumLiftMeters: mobile ? 0.008 : 0.012,
    method: field.ridgeInterior?.length && field.valleyInterior?.length
      ? "measured-interior-profile-hermite-remesh"
      : mobile ? "resolved-boundary-tangent-remesh" : "decoded-boundary-bridge",
    maximumCrossGrade,
    maximumLongitudinalGrade,
    ridgeBoundarySamples: field.ridge.length,
    ridgeProfileX: [ridgeMinX, ridgeMaxX],
    ridgeProfileFeatherMeters: ridgeFeatherMeters,
    ridgeInteriorSamples: field.ridgeInterior?.length ?? 0,
    rows,
    valleyBoundarySamples: field.valley.length,
    valleyInteriorSamples: field.valleyInterior?.length ?? 0,
  };
  return geometry;
}

function applyTerminalSeamNormals(geometry: BufferGeometry, field: TerrainSeamField) {
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const seamCenter = ((field.ridge[0]?.z ?? -315) + (field.valley[0]?.z ?? -315)) * 0.5;
  for (let index = 0; index < positions.count; index += 1) {
    const seamDistance = Math.abs(positions.getZ(index) - seamCenter);
    if (seamDistance > 26) continue;
    const x = positions.getX(index);
    const shared = sampleTerrainSeamNormal(field.ridge, x)
      .add(sampleTerrainSeamNormal(field.valley, x))
      .normalize();
    const blend = 1 - smoothCoastalStep(seamDistance / 26);
    const normal = new Vector3(normals.getX(index), normals.getY(index), normals.getZ(index))
      .lerp(shared, blend)
      .normalize();
    normals.setXYZ(index, normal.x, normal.y, normal.z);
  }
  normals.needsUpdate = true;
}

function createTerminalChunkGeometry(source: Mesh, seamField: TerrainSeamField) {
  const geometry = geometrySurfaceForMerge(source.geometry, source.matrixWorld);
  const removedTerminalWallTriangles = removeCoplanarBoundaryWall(
    geometry,
    "z",
    seamField.valley[0]?.z ?? -335,
  );
  geometry.userData.removedTerminalWallTriangles = removedTerminalWallTriangles;
  geometry.computeVertexNormals();
  const positions = geometry.getAttribute("position");
  const uvs: number[] = [];
  for (let index = 0; index < positions.count; index += 1) {
    uvs.push((positions.getX(index) + 310) / 620, (285 - positions.getZ(index)) / 600);
  }
  const uv = new Float32BufferAttribute(uvs, 2);
  geometry.setAttribute("uv", uv);
  geometry.setAttribute("uv1", uv.clone());
  applyTerminalSeamNormals(geometry, seamField);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function sampleCoastalOverlap(profiles: CoastalBoundarySample[][], x: number, z: number) {
  if (!profiles.length) return null;
  for (let index = 0; index < profiles.length - 1; index += 1) {
    const currentX = profiles[index][0]?.x;
    const nextX = profiles[index + 1][0]?.x;
    if (currentX === undefined || nextX === undefined || x < currentX || x > nextX) continue;
    const current = sampleCoastalBoundary(profiles[index], z);
    const next = sampleCoastalBoundary(profiles[index + 1], z);
    if (!current || !next) return current ?? next;
    const progress = (x - currentX) / (nextX - currentX);
    return {
      height: current.height + (next.height - current.height) * progress,
      normal: current.normal.clone().lerp(next.normal, progress).normalize(),
      x,
      z,
    };
  }
  const endpoint = x < (profiles[0][0]?.x ?? x) ? profiles[0] : profiles[profiles.length - 1];
  return sampleCoastalBoundary(endpoint, z);
}

function createCoastalShoulderGeometry(
  mobile: boolean,
  tier: WorldQualityTier,
  boundarySamples: CoastalBoundarySample[] = [],
  overlapProfiles: CoastalBoundarySample[][] = [],
) {
  // Desktop uses the exact 179-row sampling of RIDGE_V115_HIGH so the shared
  // edge can be vertex-welded instead of merely placed at the same coordinates.
  const rows = mobile
    ? boundarySamples.length > 1 ? boundarySamples.length - 1 : 58
    : 178;
  const columns = mobile ? 18 : tier === "high" ? 34 : tier === "balanced" ? 28 : 20;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const innerProfile = overlapProfiles[overlapProfiles.length - 1] ?? boundarySamples;
  const innerX = innerProfile[0]?.x ?? -310;

  for (let row = 0; row <= rows; row += 1) {
    const along = row / rows;
    const decodedBoundary = boundarySamples.length === rows + 1 ? boundarySamples[row] : null;
    const z = decodedBoundary?.z ?? -315 + 600 * along;
    const taper = smoothCoastalStep(Math.pow(along, 0.78));
    const outerX = -730 + 420 * taper
      + (Math.sin(z * 0.027 + 0.8) * 17 + Math.sin(z * 0.071 - 1.4) * 7.5) * Math.sin(along * Math.PI);
    const exactBoundary = sampleCoastalBoundary(boundarySamples, z);
    const ridgeHeight = exactBoundary?.height ?? sampleCoastalProfile(COASTAL_RIDGE_WEST_PROFILE, z);
    const ridgeInnerHeight = sampleCoastalProfile(COASTAL_RIDGE_INNER_PROFILE, z);
    const ridgeCrossSlope = exactBoundary
      ? Math.min(1.2, Math.max(-1.2, -exactBoundary.normal.x / Math.max(0.08, exactBoundary.normal.y)))
      : Math.min(1.2, Math.max(-1.2, (ridgeInnerHeight - ridgeHeight) / 3.2291666667));
    const apexBlend = smoothCoastalStep((along - 0.73) / 0.27);
    const coastalHeight = -15.7
      + Math.sin(z * 0.029 + 0.4) * 2.7
      + Math.sin(z * 0.083 - 0.9) * 1.15;
    const outerHeight = coastalHeight * (1 - apexBlend) + ridgeHeight * apexBlend;

    for (let column = 0; column <= columns; column += 1) {
      const across = column / columns;
      const spatialAcross = 1 - Math.pow(1 - across, 1.7);
      const x = outerX + (innerX - outerX) * spatialAcross;
      const shoulderAcross = Math.min(1, Math.max(0, (x - outerX) / Math.max(0.001, -310 - outerX)));
      // Hold a low, irregular marine terrace before the terrain rises into the
      // inherited ridge. This avoids replacing the old open edge with one giant
      // mathematically smooth ramp.
      const ridgeBlend = smoothCoastalStep((shoulderAcross - 0.18) / 0.82);
      const broadHeight = outerHeight * (1 - ridgeBlend) + ridgeHeight * ridgeBlend;
      const seamDistance = -310 - x;
      const seamBlend = smoothCoastalStep((13 - seamDistance) / 13);
      const slopeMatchedHeight = ridgeHeight + ridgeCrossSlope * (x + 310);
      const formedHeight = broadHeight * (1 - seamBlend) + slopeMatchedHeight * seamBlend;
      const inheritedNearHeight = sampleCoastalProfile(COASTAL_VALLEY_NEAR_PROFILE, x);
      const startBlend = smoothCoastalStep(along / 0.095);
      const reliefEnvelope = Math.sin(shoulderAcross * Math.PI) * Math.sin(along * Math.PI);
      const headlands = (
        Math.sin(z * 0.031 + 0.7)
        + Math.sin(z * 0.067 - 1.1) * 0.42
      ) * reliefEnvelope * (2.8 + ridgeBlend * 7.2);
      const drainage = -Math.pow(Math.max(0, Math.sin(z * 0.045 - across * 3.2 + 1.4)), 6)
        * reliefEnvelope * (2.1 + ridgeBlend * 5.4);
      const fracture = (
        Math.sin(x * 0.051 + z * 0.034)
        + Math.sin(x * 0.019 - z * 0.079) * 0.48
        + Math.sin(x * 0.103 + z * 0.013) * 0.22
      ) * reliefEnvelope * (2.7 + ridgeBlend * 4.9);
      const coastalFloor = -18.5 * (1 - smoothCoastalStep(across / 0.08))
        + -16.35 * smoothCoastalStep(across / 0.08);
      const authoredHeight = Math.max(coastalFloor, formedHeight + headlands + drainage + fracture);
      const overlap = x >= -310 ? sampleCoastalOverlap(overlapProfiles, x, z) : null;
      const overlayLift = overlap
        ? 0.05 * (1 - smoothCoastalStep((x + 310) / Math.max(0.001, innerX + 310)))
        : 0;
      const y = decodedBoundary && column === columns && !overlap
        ? decodedBoundary.height
        : overlap
        ? overlap.height + overlayLift
        : inheritedNearHeight * (1 - startBlend) + authoredHeight * startBlend;
      positions.push(x, y, z);
      // Continue the authored ridge UV field across its western boundary so the
      // PBR source surface cannot jump at the join (ridge west edge is u = 0).
      uvs.push((x + 310) / 620, (285 - z) / 600);

      if (row < rows && column < columns) {
        const current = row * (columns + 1) + column;
        const next = current + columns + 1;
        indices.push(current, next, current + 1, current + 1, next, next + 1);
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  const uv = new Float32BufferAttribute(uvs, 2);
  geometry.setAttribute("uv", uv);
  geometry.setAttribute("uv1", uv.clone());
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const normals = geometry.getAttribute("normal");
  for (let row = 0; row <= rows; row += 1) {
    const decodedBoundary = boundarySamples.length === rows + 1 ? boundarySamples[row] : null;
    const z = decodedBoundary?.z ?? -315 + 600 * (row / rows);
    const exactBoundary = decodedBoundary ?? sampleCoastalBoundary(innerProfile, z);
    const ridgeCrossSlope = Math.min(1.2, Math.max(-1.2, (
      sampleCoastalProfile(COASTAL_RIDGE_INNER_PROFILE, z)
      - sampleCoastalProfile(COASTAL_RIDGE_WEST_PROFILE, z)
    ) / 3.2291666667));
    const ridgeAlongSlope = (
      sampleCoastalProfile(COASTAL_RIDGE_WEST_PROFILE, z + 1)
      - sampleCoastalProfile(COASTAL_RIDGE_WEST_PROFILE, z - 1)
    ) * 0.5;
    const edgeNormal = exactBoundary?.normal
      ?? new Vector3(-ridgeCrossSlope, 1, -ridgeAlongSlope).normalize();
    normals.setXYZ(row * (columns + 1) + columns, edgeNormal.x, edgeNormal.y, edgeNormal.z);
  }
  normals.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

const COASTAL_FAMILIES = [
  "ohia_emergent",
  "koa_broad",
  "kukui_round",
  "pandanus_form",
  "palm_form",
  "tree_fern_form",
  "ridge_wind_form",
  "humid_sapling",
] as const;

function createCoastalPlacements(geometry: BufferGeometry, mobile: boolean, tier: WorldQualityTier) {
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const columns = mobile ? 18 : tier === "high" ? 34 : tier === "balanced" ? 28 : 20;
  const rows = positions.count / (columns + 1) - 1;
  const rowStride = mobile ? 4 : tier === "high" ? 4 : 6;
  const columnStride = mobile ? 2 : 2;
  const limit = mobile ? 88 : tier === "high" ? 260 : tier === "balanced" ? 180 : 110;
  const placements: PlacementTuple[] = [];

  for (let row = mobile ? 5 : 12; row < rows - 4 && placements.length < limit; row += rowStride) {
    for (let column = 2 + (row % 3); column < columns - 1 && placements.length < limit; column += columnStride) {
      const index = row * (columns + 1) + column;
      const x = positions.getX(index);
      const y = positions.getY(index);
      const z = positions.getZ(index);
      const normalY = normals.getY(index);
      if (x > -318 || y < -9.5 || normalY < (mobile ? 0.66 : 0.7)) continue;
      const seed = row * 97 + column * 53;
      const jitterX = ((seed % 17) - 8) * (mobile ? 0.36 : 0.55);
      const jitterZ = (((seed * 7) % 19) - 9) * (mobile ? 0.32 : 0.48);
      const jitterY = (-normals.getX(index) * jitterX - normals.getZ(index) * jitterZ) / normalY;
      const layer = seed % 6 === 0 ? 1 : 0;
      const family = (seed + Math.floor((z + 315) * 0.03)) % COASTAL_FAMILIES.length;
      const scale = (layer === 0 ? 0.62 : 0.42) + (seed % 11) * (layer === 0 ? 0.035 : 0.024);
      placements.push([
        family,
        layer,
        x + jitterX,
        y + jitterY + 0.035,
        z + jitterZ,
        (seed % 628) * 0.01,
        scale * (0.88 + (seed % 5) * 0.04),
        scale * (1.02 + (seed % 7) * 0.035),
        scale * (0.9 + (seed % 3) * 0.055),
        seed % 3,
        0.018,
        0,
      ]);
    }
  }
  return placements;
}

function CoastalEcology({ placements, shadows }: { placements: PlacementTuple[]; shadows: boolean }) {
  const gltf = useLoader(GLTFLoader, SPECIES_URL, configureCompressedGltf);
  const parts = useMemo(() => prepareSpecies(gltf.scene), [gltf.scene]);
  const batches = useMemo(() => {
    const grouped = new Map<string, PlacementTuple[]>();
    placements.forEach((placement) => {
      const key = COASTAL_FAMILIES[placement[0] % COASTAL_FAMILIES.length];
      grouped.set(key, [...(grouped.get(key) ?? []), placement]);
    });
    return grouped;
  }, [placements]);
  useEffect(() => {
    const host = window as Window & { __MADAGIN_COASTAL_ECOLOGY_V116__?: Record<string, unknown> };
    host.__MADAGIN_COASTAL_ECOLOGY_V116__ = { placements: placements.length, source: SPECIES_URL };
    document.documentElement.dataset.madaginCoastalEcologyV116 = JSON.stringify(host.__MADAGIN_COASTAL_ECOLOGY_V116__);
    dispatchStage(2, "summit-grounded-coastal-ecology-ready", "ridge");
  }, [placements.length]);
  return (
    <group name={`Madagin v1.16 grounded coastal ecology · ${placements.length}`}>
      {[...batches.entries()].flatMap(([key, batch]) => parts
        .filter((part) => part.family === key)
        .map((part, index) => (
          <InstancedSpeciesBatch
            key={`coastal-${key}-${index}`}
            part={part}
            placements={batch}
            shadows={shadows}
          />
        )))}
    </group>
  );
}

function geometrySurfaceForMerge(source: BufferGeometry, matrix?: Matrix4) {
  const result = new BufferGeometry();
  result.setAttribute("position", source.getAttribute("position").clone());
  if (source.index) result.setIndex(source.index.clone());
  if (matrix) result.applyMatrix4(matrix);
  return result;
}

function removeCoplanarBoundaryWall(
  geometry: BufferGeometry,
  axis: "x" | "z",
  boundary: number,
  tolerance = 0.04,
) {
  const positions = geometry.getAttribute("position");
  if (!geometry.index) {
    geometry.setIndex(Array.from({ length: positions.count }, (_, index) => index));
  }
  const sourceIndex = geometry.index;
  if (!sourceIndex) return 0;
  const kept: number[] = [];
  let removed = 0;
  const coordinate = (index: number) => axis === "x" ? positions.getX(index) : positions.getZ(index);
  for (let offset = 0; offset < sourceIndex.count; offset += 3) {
    const a = sourceIndex.getX(offset);
    const b = sourceIndex.getX(offset + 1);
    const c = sourceIndex.getX(offset + 2);
    const isBoundaryWall = [a, b, c].every((index) => Math.abs(coordinate(index) - boundary) < tolerance);
    if (isBoundaryWall) {
      removed += 1;
    } else {
      kept.push(a, b, c);
    }
  }
  geometry.setIndex(kept);
  return removed;
}

function createConnectedTerminalTerrainGeometry(
  ridge: BufferGeometry,
  bridge: BufferGeometry,
  valley: BufferGeometry,
  seamDiagnostics: Record<string, unknown> | null,
) {
  const surfaces = [ridge, bridge, valley].map((geometry) => geometrySurfaceForMerge(geometry));
  const merged = mergeGeometries(surfaces, false);
  surfaces.forEach((geometry) => geometry.dispose());
  if (!merged) return null;

  const connected = mergeVertices(merged, 0.001);
  merged.dispose();
  const positions = connected.getAttribute("position");
  const uvs: number[] = [];
  for (let index = 0; index < positions.count; index += 1) {
    uvs.push((positions.getX(index) + 310) / 620, (285 - positions.getZ(index)) / 600);
  }
  const uv = new Float32BufferAttribute(uvs, 2);
  connected.setAttribute("uv", uv);
  connected.setAttribute("uv1", uv.clone());
  connected.computeVertexNormals();
  connected.computeBoundingBox();
  connected.computeBoundingSphere();
  connected.name = "Madagin v1.16 single-indexed compact terminal terrain";
  connected.userData.terminalSeamRemesh = {
    ...seamDiagnostics,
    bridgeMethod: seamDiagnostics?.method ?? null,
    joinedVertices: positions.count,
    method: "single-indexed-resolved-boundary-weld",
  };
  return connected;
}

function createConnectedRidgeGeometry(source: Mesh, shoulder: BufferGeometry) {
  const sourcePositions = source.geometry.getAttribute("position");
  const shoulderPositions = shoulder.getAttribute("position");
  let shoulderBoundaryX = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < shoulderPositions.count; index += 1) {
    shoulderBoundaryX = Math.max(shoulderBoundaryX, shoulderPositions.getX(index));
  }
  let sourceBoundaryX = Number.NaN;
  let sourceBoundaryDistance = Number.POSITIVE_INFINITY;
  const sourcePoints: Vector3[] = [];
  for (let index = 0; index < sourcePositions.count; index += 1) {
    const point = new Vector3().fromBufferAttribute(sourcePositions, index).applyMatrix4(source.matrixWorld);
    const distance = Math.abs(point.x - shoulderBoundaryX);
    if (distance < sourceBoundaryDistance) {
      sourceBoundaryDistance = distance;
      sourceBoundaryX = point.x;
    }
    sourcePoints.push(point);
  }
  const sourceBoundary: Vector3[] = [];
  sourcePoints.forEach((point) => {
    if (Math.abs(point.x - sourceBoundaryX) < 0.02) sourceBoundary.push(point);
  });
  sourceBoundary.sort((left, right) => left.z - right.z);
  const shoulderBoundary: Vector3[] = [];
  const shoulderRowSize = shoulderPositions.count / Math.max(1, sourceBoundary.length);
  for (let row = 0; row < sourceBoundary.length; row += 1) {
    shoulderBoundary.push(new Vector3().fromBufferAttribute(
      shoulderPositions,
      row * shoulderRowSize + shoulderRowSize - 1,
    ));
  }
  const boundaryMatches = shoulderBoundary.map((point) => sourceBoundary.reduce(
    (best, candidate) => point.distanceTo(candidate) < best.distance
      ? { candidate, distance: point.distanceTo(candidate) }
      : best,
    { candidate: sourceBoundary[0], distance: Number.POSITIVE_INFINITY },
  ));
  const boundaryDistances = boundaryMatches.map(({ distance }) => distance);
  const worstBoundaryIndex = boundaryDistances.indexOf(Math.max(...boundaryDistances));
  const ridgeSurface = geometrySurfaceForMerge(source.geometry, source.matrixWorld);
  const ridgePositions = ridgeSurface.getAttribute("position");
  let terminalZ = Number.POSITIVE_INFINITY;
  for (let index = 0; index < ridgePositions.count; index += 1) {
    terminalZ = Math.min(terminalZ, ridgePositions.getZ(index));
  }
  const removedWestWallTriangles = removeCoplanarBoundaryWall(ridgeSurface, "x", sourceBoundaryX);
  const removedTerminalWallTriangles = removeCoplanarBoundaryWall(ridgeSurface, "z", terminalZ);
  const shoulderSurface = geometrySurfaceForMerge(shoulder);
  const merged = mergeGeometries([ridgeSurface, shoulderSurface], false);
  ridgeSurface.dispose();
  shoulderSurface.dispose();
  if (!merged) return null;
  const connected = mergeVertices(merged, 0.001);
  merged.dispose();
  const positions = connected.getAttribute("position");
  const uvs: number[] = [];
  for (let index = 0; index < positions.count; index += 1) {
    uvs.push((positions.getX(index) + 310) / 620, (285 - positions.getZ(index)) / 600);
  }
  const uv = new Float32BufferAttribute(uvs, 2);
  connected.setAttribute("uv", uv);
  connected.setAttribute("uv1", uv.clone());
  connected.computeVertexNormals();
  connected.computeBoundingBox();
  connected.computeBoundingSphere();
  connected.name = "Madagin v1.16 welded ridge and coastal shoulder";
  connected.userData.coastalWeldDiagnostics = {
    maximumDistance: Math.max(...boundaryDistances),
    shoulderBoundaryX,
    sourceBoundaryX,
    sourceBoundary: sourceBoundary.length,
    underOneCentimeter: boundaryDistances.filter((distance) => distance < 0.01).length,
    underOneMillimeter: boundaryDistances.filter((distance) => distance < 0.001).length,
    shoulderBoundary: shoulderBoundary.length,
    removedTerminalWallTriangles,
    removedWestWallTriangles,
    worst: {
      shoulder: shoulderBoundary[worstBoundaryIndex]?.toArray() ?? null,
      source: boundaryMatches[worstBoundaryIndex]?.candidate.toArray() ?? null,
    },
  };
  return connected;
}

function prepareSpecies(scene: Object3D) {
  scene.updateMatrixWorld(true);
  const parts: SpeciesPart[] = [];
  scene.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const family = child.name.replace(/^species_/, "").replace(/_mesh(?:_\d+)?$/, "");
    parts.push({
      family,
      geometry: child.geometry,
      material: child.material,
      matrixWorld: child.matrixWorld.clone(),
    });
  });
  return parts;
}

type LivingWindUniform = { value: number };

function enableLivingWind(material: MeshStandardMaterial, strength: number) {
  const windTime: LivingWindUniform = { value: 0 };
  material.userData.madaginWindTime = windTime;
  material.userData.madaginWindStrength = strength;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uMadaginWindTime = windTime;
    shader.uniforms.uMadaginWindStrength = { value: strength };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float uMadaginWindTime;
uniform float uMadaginWindStrength;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vec3 madaginAnchor = vec3(modelMatrix[3]);
#ifdef USE_INSTANCING
  madaginAnchor = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
#endif
float madaginHeight = 1.0 - exp(-max(position.y, 0.0) * 0.42);
float madaginExposure = 0.72 + 0.28 * sin(madaginAnchor.x * 0.013 - madaginAnchor.z * 0.017);
float madaginGust = sin(uMadaginWindTime * 0.74 + madaginAnchor.x * 0.021 + madaginAnchor.z * 0.014)
  + sin(uMadaginWindTime * 0.31 - madaginAnchor.x * 0.008 + madaginAnchor.z * 0.019 + position.y * 0.38) * 0.46;
float madaginFlutter = sin(uMadaginWindTime * 1.9 + madaginAnchor.x * 0.043 - madaginAnchor.z * 0.037 + position.y * 1.7) * 0.22;
transformed.x += (madaginGust + madaginFlutter) * madaginHeight * madaginExposure * uMadaginWindStrength;
transformed.z += (madaginGust * 0.34 - madaginFlutter * 0.58) * madaginHeight * madaginExposure * uMadaginWindStrength;`,
      );
  };
  material.customProgramCacheKey = () => `madagin-living-wind-v2-${strength}`;
  material.needsUpdate = true;
}

function updateLivingWind(source: Material | Material[], elapsedTime: number) {
  (Array.isArray(source) ? source : [source]).forEach((material) => {
    const windTime = material.userData.madaginWindTime as LivingWindUniform | undefined;
    if (windTime) windTime.value = elapsedTime;
  });
}

function variantMaterials(source: Material | Material[]) {
  const originals = Array.isArray(source) ? source : [source];
  const result = originals.map((original) => {
    const foliage = /foliage|leaf|frond/i.test(original.name);
    const material = new MeshStandardMaterial({
      color: foliage ? "#a5afa0" : "#78604d",
      emissive: foliage ? "#17291b" : "#070503",
      emissiveIntensity: foliage ? 0.13 : 0.015,
      envMapIntensity: foliage ? 0.34 : 0.18,
      metalness: 0,
      roughness: foliage ? 0.95 : 0.97,
      side: foliage ? DoubleSide : FrontSide,
    });
    material.name = `${original.name} · v1.16 instanced variation`;
    if (foliage) enableLivingWind(material, 0.16);
    return material;
  });
  return Array.isArray(source) ? result : result[0];
}

const VOLUMETRIC_CROWN_FAMILIES = new Set([
  "alpine_conifer",
  "humid_sapling",
  "koa_broad",
  "kukui_round",
  "ohia_emergent",
  "ridge_wind_form",
]);

function volumetricCrownLobeCount(family: string, placement: PlacementTuple, mobile: boolean) {
  if (mobile || placement[1] !== 0 || !VOLUMETRIC_CROWN_FAMILIES.has(family)) return 1;
  return family === "alpine_conifer" || family === "ridge_wind_form" ? 2 : 3;
}

function InstancedSpeciesBatch({ mobile = false, part, placements, shadows }: {
  mobile?: boolean;
  part: SpeciesPart;
  placements: PlacementTuple[];
  shadows: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);
  const materials = useMemo(() => variantMaterials(part.material), [part.material]);
  const foliage = useMemo(
    () => (Array.isArray(part.material) ? part.material : [part.material]).some((material) => /foliage|leaf|frond/i.test(material.name)),
    [part.material],
  );
  const instances = useMemo(() => placements.flatMap((placement, placementIndex) => {
    const lobeCount = foliage ? volumetricCrownLobeCount(part.family, placement, mobile) : 1;
    return Array.from({ length: lobeCount }, (_, lobe) => ({ lobe, lobeCount, placement, placementIndex }));
  }), [foliage, mobile, part.family, placements]);
  useFrame(({ clock }) => updateLivingWind(materials, clock.elapsedTime));
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new Object3D();
    const matrix = new Matrix4();
    const crownScale = new Matrix4();
    const instanceColor = new Color();
    instances.forEach(({ lobe, lobeCount, placement, placementIndex }, index) => {
      const signature = Math.abs(Math.round(placement[2] * 0.17 + placement[4] * 0.11 + placement[9] * 13 + placementIndex * 7));
      const lobeAngle = placement[5] + lobe * 2.26 + (signature % 7) * 0.11;
      const lateralOffset = lobe === 0 ? 0 : placement[6] * (lobeCount === 2 ? 1.08 : lobe === 1 ? 1.18 : 0.96);
      const verticalOffset = lobe === 0 ? 0 : placement[7] * (lobe === 1 ? 0.52 : -0.08);
      dummy.position.set(
        placement[2] + Math.cos(lobeAngle) * lateralOffset,
        placement[3] + verticalOffset,
        placement[4] + Math.sin(lobeAngle) * lateralOffset,
      );
      dummy.rotation.set(0, placement[5] + lobe * 0.17, 0);
      dummy.scale.set(placement[6], placement[7], placement[8]);
      dummy.updateMatrix();
      matrix.multiplyMatrices(dummy.matrix, part.matrixWorld);
      if (foliage) {
        const spread = placement[1] === 0 ? mobile ? 2.5 : 1.42 : placement[1] === 1 ? mobile ? 2.02 : 1.34 : mobile ? 1.52 : 1.18;
        const lobeWidth = lobe === 0 ? (lobeCount > 1 ? 0.86 : 1) : lobe === 1 ? 0.58 : 0.5;
        const lobeHeight = lobe === 0 ? (lobeCount > 1 ? 0.96 : 1) : lobe === 1 ? 0.68 : 0.61;
        const windPrunedDepth = part.family === "ridge_wind_form" ? 0.7 : lobe === 2 ? 0.83 : 0.92;
        crownScale.makeScale(
          spread * lobeWidth,
          (placement[1] === 0 ? 1.12 : 1.06) * lobeHeight,
          spread * lobeWidth * windPrunedDepth,
        );
        matrix.multiply(crownScale);
      }
      mesh.setMatrixAt(index, matrix);
      const foliagePalette = ["#50634f", "#60705a", "#6d7658", "#485c4c", "#747753", "#596b5c", "#667044", "#4b604f"];
      const barkPalette = ["#5a4333", "#674d3c", "#745845", "#806954"];
      instanceColor.set(foliage
        ? foliagePalette[(signature + lobe * 3) % foliagePalette.length]
        : barkPalette[signature % barkPalette.length]);
      mesh.setColorAt(index, instanceColor);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  }, [foliage, instances, mobile, part.family, part.matrixWorld]);
  useEffect(() => () => {
    (Array.isArray(materials) ? materials : [materials]).forEach((material) => material.dispose());
  }, [materials]);
  return (
    <instancedMesh
      args={[part.geometry, materials, instances.length]}
      castShadow={shadows && !foliage}
      receiveShadow={!foliage}
      ref={ref}
    />
  );
}

function RidgeBasaltField({ placements, shadows, zone }: {
  placements: PlacementTuple[];
  shadows: boolean;
  zone: V116Zone;
}) {
  const gltf = useLoader(GLTFLoader, `${ASSET_ROOT}/rock_09/rock_09_1k.gltf`);
  const parts = useMemo(() => {
    gltf.scene.updateMatrixWorld(true);
    const result: SpeciesPart[] = [];
    gltf.scene.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const materials = (Array.isArray(child.material) ? child.material : [child.material]).map((source) => {
        const material = source.clone() as MeshStandardMaterial;
        material.color.multiplyScalar(0.72);
        material.metalness = 0;
        material.roughness = 0.94;
        material.needsUpdate = true;
        return material;
      });
      result.push({
        family: "wet-basalt",
        geometry: child.geometry,
        material: Array.isArray(child.material) ? materials : materials[0],
        matrixWorld: child.matrixWorld.clone(),
      });
    });
    return result;
  }, [gltf.scene]);
  const selected = useMemo(
    () => placements
      .filter((placement, index) => placement[1] === 2 && index % (zone === "ridge" ? 31 : zone === "alpine" ? 17 : 43) === 0)
      .slice(0, zone === "ridge" ? 58 : zone === "alpine" ? 76 : 42),
    [placements, zone],
  );
  const refs = useRef<Array<InstancedMesh | null>>([]);
  useLayoutEffect(() => {
    const dummy = new Object3D();
    const matrix = new Matrix4();
    parts.forEach((part, partIndex) => {
      const mesh = refs.current[partIndex];
      if (!mesh) return;
      selected.forEach((placement, index) => {
        // Poly Haven rock_09 is authored at hand-sample scale (~15 cm tall).
        // Landscape outcrops need metre-scale transforms to remain perceptible
        // from the aerial journey cameras.
        const scale = (zone === "ridge" ? 34 : zone === "alpine" ? 52 : 42) + ((index * 17) % 13) * 2.4;
        dummy.position.set(placement[2], placement[3] - 0.18, placement[4]);
        dummy.rotation.set((index % 5) * 0.07, placement[5], ((index + 2) % 7) * 0.045);
        dummy.scale.set(scale * (0.82 + (index % 3) * 0.13), scale * 0.62, scale);
        dummy.updateMatrix();
        matrix.multiplyMatrices(dummy.matrix, part.matrixWorld);
        mesh.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
    });
  }, [parts, selected, zone]);
  useEffect(() => () => parts.forEach((part) => {
    (Array.isArray(part.material) ? part.material : [part.material]).forEach((material) => material.dispose());
  }), [parts]);
  return (
    <group name={`Madagin v1.16 ${zone} textured wet-basalt field · ${selected.length}`}>
      {parts.map((part, index) => (
        <instancedMesh
          args={[part.geometry, part.material, selected.length]}
          castShadow={shadows}
          key={`basalt-${zone}-${index}`}
          receiveShadow
          ref={(mesh) => { refs.current[index] = mesh; }}
        />
      ))}
    </group>
  );
}

const V115_HERO_FAMILIES = [
  "pachira_a",
  "pachira_b",
  "pachira_c",
  "pachira_d",
  "island_01",
  "island_02",
  "island_03",
  "small_02",
] as const;
const V115_CONTACT_HERO_FAMILIES = V115_HERO_FAMILIES.slice(0, 4);

// The v1.15 island-tree mid LODs contain a few heavily decimated, multi-square-metre
// trunk/canopy faces. They read as pale triangles in motion. Keep the sound Pachira
// and small-tree variants in balanced mode; high mode can use the intact hero set.
const V115_SAFE_MID_VARIANTS = [0, 1, 2, 3, 4, 5, 6, 7, 14, 15] as const;

function detailedHierarchyName(object: Object3D) {
  const names: string[] = [];
  let current: Object3D | null = object;
  while (current) {
    names.push(current.name);
    current = current.parent;
  }
  return names.join("/").toLowerCase();
}

function detailedSourceKey(object: Object3D, mode: DetailedVegetationMode) {
  const name = detailedHierarchyName(object);
  if (mode === "mid") return name.match(/mid_variant_\d{2}/)?.[0] ?? null;
  return name.match(/hero_(pachira_[abcd]|island_0[123]|small_02)/)?.[1] ?? null;
}

function detailedVegetationTint(sourceKey: string, foliage: boolean) {
  if (!foliage) return "#755f4e";
  const tints = ["#f3f5ec", "#e4ecdf", "#f1f1e5", "#dbe7d8", "#ecebd7", "#dfe9df", "#efe9d5", "#d9e4d9"];
  const signature = [...sourceKey].reduce((total, character) => total + character.charCodeAt(0), 0);
  return tints[signature % tints.length];
}

function prepareDetailedVegetation(scene: Object3D, mode: DetailedVegetationMode) {
  scene.updateMatrixWorld(true);
  const parts: DetailedVegetationPart[] = [];
  scene.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const sourceKey = detailedSourceKey(child, mode);
    if (!sourceKey) return;
    const originals = Array.isArray(child.material) ? child.material : [child.material];
    const materials = originals.map((original) => {
      const material = (original as MeshStandardMaterial).clone();
      const foliage = /lea|twig|branch/i.test(`${original.name}/${child.name}`);
      material.alphaTest = foliage ? Math.max(mode === "hero" ? 0.46 : 0.42, material.alphaTest || 0) : material.alphaTest;
      material.color.set(detailedVegetationTint(sourceKey, foliage));
      material.vertexColors = true;
      material.depthWrite = true;
      material.emissive.set(foliage ? "#315d2d" : "#080604");
      material.emissiveIntensity = foliage ? 0.34 : 0.018;
      material.emissiveMap = null;
      material.envMapIntensity = foliage ? 0.22 : 0.18;
      material.metalness = 0;
      material.roughness = Math.max(foliage ? 0.95 : 0.97, material.roughness ?? 0.94);
      material.side = foliage ? DoubleSide : FrontSide;
      material.transparent = false;
      if (foliage) enableLivingWind(material, mode === "hero" ? 0.2 : 0.14);
      material.needsUpdate = true;
      return material;
    });
    const foliage = originals.some((material) => /lea|twig|branch/i.test(`${material.name}/${child.name}`));
    parts.push({
      family: sourceKey,
      foliage,
      geometry: child.geometry,
      material: Array.isArray(child.material) ? materials : materials[0],
      matrixWorld: child.matrixWorld.clone(),
      sourceKey,
    });
  });
  return parts;
}

function isLakeBankSuccessionPlacement(placement: PlacementTuple) {
  return placement[1] === 2
    && placement[2] >= 180
    && placement[2] <= 430
    && placement[4] > -650
    && placement[4] <= -540;
}

function isLakeApproachMidstoryPlacement(placement: PlacementTuple) {
  return placement[1] === 2
    && placement[0] < 8
    && placement[2] >= 160
    && placement[2] <= 310
    && placement[4] >= -720
    && placement[4] <= -650;
}

function isMultiSlopeSuccessionPlacement(placement: PlacementTuple, zone: V116Zone) {
  // Candidate AW restores one intermediate-height stratum from the existing
  // grounded inventory. The altitude gates keep it on readable upper and
  // middle slopes instead of uniformly increasing density across each chunk.
  if (placement[0] >= 8) return false;
  if (zone === "ridge") return placement[1] === 1 && placement[3] >= -4;
  if (zone === "valley") return placement[1] === 1 && placement[3] >= 12;
  if (zone === "alpine") return placement[1] === 2 && placement[3] >= 20 && placement[3] <= 185;
  return false;
}

function multiSlopeSuccessionSignature(placement: PlacementTuple) {
  return Math.abs(Math.round(
    placement[2] * 3
    + placement[4] * 5
    + placement[3] * 7
    + placement[0] * 11
    + placement[9] * 13,
  ));
}

function ridgeDrainageHabitatDistanceRatio(placement: PlacementTuple) {
  const x = placement[2];
  const y = placement[3];
  const z = placement[4];
  if (
    (placement[1] !== 1 && placement[1] !== 2)
    || placement[0] >= 8
    || x < -268
    || x > 268
    || y < -4
    || y > 60
    || z < -230
    || z > 210
  ) return Number.POSITIVE_INFINITY;

  const downstream = smoothRange(-230, 190, z);
  const branchSpread = 1 - smoothRange(-105, 178, z);
  const branchAuthority = smoothRange(-274, -214, z) * (1 - smoothRange(132, 218, z));
  let nearestRatio = Number.POSITIVE_INFINITY;

  RIDGE_EROSION_NETWORKS.forEach((network) => {
    const trunkCenter = network.baseX
      + Math.sin((z + 80) * 0.011 + network.phase) * 13
      + Math.sin((z - 36) * 0.0042 + network.phase * 0.7) * 8;
    nearestRatio = Math.min(
      nearestRatio,
      Math.abs(x - trunkCenter) / (13.5 + downstream * 5.5),
    );

    if (branchAuthority <= 0.15) return;
    const branchCenter = trunkCenter
      + network.branchSide * branchSpread * network.spread
      + Math.sin(z * 0.018 - network.phase) * 5.5;
    nearestRatio = Math.min(
      nearestRatio,
      Math.abs(x - branchCenter)
        / ((10.5 + downstream * 3.5) * Math.max(0.45, branchAuthority)),
    );
  });

  return nearestRatio;
}

function isRidgeDrainageSuccessionPlacement(placement: PlacementTuple) {
  // Candidate AY couples habitat to AX's actual erosion authority instead of
  // increasing Ridge density uniformly. Only already-grounded low-succession
  // anchors inside the five warped catchments are eligible.
  return ridgeDrainageHabitatDistanceRatio(placement) <= 1.1;
}

function isAddedRidgeDrainageSuccessionPlacement(placement: PlacementTuple) {
  if (!isRidgeDrainageSuccessionPlacement(placement)) return false;
  return placement[1] === 2 || multiSlopeSuccessionSignature(placement) % 2 !== 0;
}

function easternValleyCatchmentHabitatDistanceRatio(placement: PlacementTuple) {
  const x = placement[2];
  const y = placement[3];
  const z = placement[4];
  if (
    (placement[1] !== 1 && placement[1] !== 2)
    || placement[0] >= 8
    || x < 84
    || x > 642
    || y < -20
    || y > 158
    || z < -918
    || z > -516
  ) return Number.POSITIVE_INFINITY;

  const upslope = smoothRange(92, 610, x);
  const branchAuthority = smoothRange(214, 302, x) * (1 - smoothRange(566, 642, x));
  let nearestRatio = Number.POSITIVE_INFINITY;

  EASTERN_VALLEY_CATCHMENTS.forEach((catchment) => {
    const trunkCenter = catchment.baseZ
      + Math.sin((x - 170) * 0.0125 + catchment.phase) * 19
      + Math.sin((x + 80) * 0.0048 - catchment.phase * 0.62) * 9;
    const trunkWidth = 27 - upslope * 9;
    nearestRatio = Math.min(
      nearestRatio,
      Math.abs(z - trunkCenter) / trunkWidth,
    );

    if (branchAuthority <= 0.15) return;
    const branchSpread = catchment.spread * smoothRange(190, 548, x);
    const branchCenter = trunkCenter
      + catchment.branchSide * branchSpread
      + Math.sin(x * 0.017 - catchment.phase) * 6;
    const branchWidth = 18 - upslope * 4;
    nearestRatio = Math.min(
      nearestRatio,
      Math.abs(z - branchCenter)
        / (branchWidth * Math.max(0.45, branchAuthority)),
    );
  });

  return nearestRatio;
}

function isEasternValleyCatchmentHabitatPlacement(placement: PlacementTuple) {
  return easternValleyCatchmentHabitatDistanceRatio(placement) <= 1.45;
}

function isAddedEasternValleyCatchmentHabitatPlacement(placement: PlacementTuple) {
  if (!isEasternValleyCatchmentHabitatPlacement(placement)) return false;
  const alreadyPromoted = isMultiSlopeSuccessionPlacement(placement, "valley")
    && multiSlopeSuccessionSignature(placement) % 2 === 0;
  return !alreadyPromoted;
}

function isWithinContactTrailheadHabitatBounds(placement: PlacementTuple) {
  // Candidate BF reuses only the manifest's already-grounded safe families in
  // the near-camera Contact corridor. The bounds stop before the lake and keep
  // this as a localized succession layer rather than a uniform Valley refill.
  return placement[0] < 8
    && placement[2] >= 270
    && placement[2] <= 430
    && placement[3] >= 30
    && placement[3] <= 105
    && placement[4] >= -710
    && placement[4] <= -605;
}

function isContactTrailheadHabitatPlacement(placement: PlacementTuple) {
  return (placement[1] === 1 || placement[1] === 2)
    && isWithinContactTrailheadHabitatBounds(placement);
}

function isHighContactTrailheadCanopyPlacement(placement: PlacementTuple) {
  return (placement[1] === 0 || placement[1] === 1)
    && isWithinContactTrailheadHabitatBounds(placement);
}

function isAddedContactTrailheadHabitatPlacement(placement: PlacementTuple) {
  if (!isContactTrailheadHabitatPlacement(placement) || placement[1] !== 1) return false;
  const alreadySuccession = isMultiSlopeSuccessionPlacement(placement, "valley")
    && multiSlopeSuccessionSignature(placement) % 2 === 0;
  return !alreadySuccession && !isAddedEasternValleyCatchmentHabitatPlacement(placement);
}

function contactTrailheadPlacementRelief(placement: PlacementTuple) {
  if (!isContactTrailheadHabitatPlacement(placement)) return 0;
  return contactTrailheadRelief(placement[2], placement[4])
    * contactTrailheadReliefEnvelope(placement[2], placement[3], placement[4], 0.82);
}

function selectDetailedPlacements(instances: PlacementTuple[], mobile: boolean, tier: WorldQualityTier, zone: V116Zone) {
  if (mobile || tier === "conservative") return [];
  const baselineEligible = instances.filter((placement, index) => (
    zone === "lake"
      ? placement[1] === 1 || (
        isLakeApproachMidstoryPlacement(placement)
        && (
          index % 3 !== 1
          || (placement[2] >= 180 && placement[2] <= 215 && placement[3] >= 10)
        )
      )
      : placement[1] === 0
  ) && placement[0] < 8);
  const stride = tier === "high"
    ? zone === "lake" ? 8 : zone === "alpine" ? 6 : zone === "ridge" ? 12 : 14
    : 1;
  const baseline = baselineEligible.filter((placement, index) => {
    if (index % stride !== 0) return false;
    if (tier !== "balanced" || zone === "lake") return true;
    // Candidate BN turns the detailed v1.15 inventory into an emergent anchor
    // stratum instead of replacing the entire primary canopy. The released
    // placements remain occupied by the ten grounded v1.16 species families,
    // so silhouette diversity increases without thinning the forest.
    const signature = multiSlopeSuccessionSignature(placement);
    const retention = zone === "ridge" ? 76 : zone === "valley" ? 74 : 80;
    return signature % 100 < retention;
  });
  if (zone === "lake") return baseline;
  // Balanced can carry the denser mid LOD. High keeps a sparse hero review
  // sample after the denser AW2 branch proved visually modest for its cost.
  const successionDivisor = tier === "high" ? 8 : 2;
  const succession = instances.filter((placement) => (
    isMultiSlopeSuccessionPlacement(placement, zone)
    && multiSlopeSuccessionSignature(placement) % successionDivisor === 0
  ));
  const drainageSuccession = zone === "ridge" && tier !== "high"
    ? instances.filter((placement) => (
      placement[1] === 1 && isAddedRidgeDrainageSuccessionPlacement(placement)
    ))
    : [];
  const easternValleyCatchmentHabitat = zone === "valley" && tier !== "high"
    ? instances.filter((placement) => (
      placement[1] === 1 && isAddedEasternValleyCatchmentHabitatPlacement(placement)
    ))
    : [];
  const contactTrailheadHabitat = zone === "valley"
    ? instances.filter(tier === "high"
      ? isHighContactTrailheadCanopyPlacement
      : isAddedContactTrailheadHabitatPlacement)
      .filter((placement) => !baseline.includes(placement) && !succession.includes(placement))
    : [];
  return [
    ...baseline,
    ...succession,
    ...drainageSuccession,
    ...easternValleyCatchmentHabitat,
    ...contactTrailheadHabitat,
  ];
}

function detailedPlacementSource(placement: PlacementTuple, index: number, mode: DetailedVegetationMode) {
  if (mode === "hero") {
    const families = isHighContactTrailheadCanopyPlacement(placement)
      ? V115_CONTACT_HERO_FAMILIES
      : V115_HERO_FAMILIES;
    return families[(placement[0] + placement[9] + index) % families.length];
  }
  const variant = V115_SAFE_MID_VARIANTS[(placement[0] * 2 + placement[9] + index) % V115_SAFE_MID_VARIANTS.length];
  return `mid_variant_${String(variant).padStart(2, "0")}`;
}

type CanopyArchitecture = "emergent" | "mature" | "umbrella" | "wind-pruned" | "columnar";

function canopyArchitecture(placement: PlacementTuple, index: number, zone: V116Zone): CanopyArchitecture {
  const signature = multiSlopeSuccessionSignature(placement) + index * 19;
  if (zone === "ridge" && (placement[3] > 34 || signature % 11 < 3)) return "wind-pruned";
  if ((zone === "valley" || zone === "lake") && signature % 9 < 3) return "umbrella";
  if (placement[1] === 0 && signature % 7 < 2) return "emergent";
  if (signature % 13 < 3) return "columnar";
  return "mature";
}

function canopyArchitectureScale(architecture: CanopyArchitecture, foliage: boolean) {
  if (architecture === "emergent") return foliage
    ? { x: 0.8, y: 1.24, z: 0.86 }
    : { x: 0.92, y: 1.24, z: 0.92 };
  if (architecture === "umbrella") return foliage
    ? { x: 1.36, y: 0.86, z: 1.22 }
    : { x: 1.02, y: 0.9, z: 1.02 };
  if (architecture === "wind-pruned") return foliage
    ? { x: 1.23, y: 0.92, z: 0.72 }
    : { x: 1.03, y: 0.95, z: 0.9 };
  if (architecture === "columnar") return foliage
    ? { x: 0.76, y: 1.16, z: 0.84 }
    : { x: 0.9, y: 1.16, z: 0.9 };
  return foliage
    ? { x: 1.1, y: 1.04, z: 1.06 }
    : { x: 1, y: 1.04, z: 1 };
}

function InstancedDetailedVegetation({ mode, part, placements, shadows, zone }: {
  mode: DetailedVegetationMode;
  part: DetailedVegetationPart;
  placements: PlacementTuple[];
  shadows: boolean;
  zone: V116Zone;
}) {
  const ref = useRef<InstancedMesh>(null);
  useFrame(({ clock }) => updateLivingWind(part.material, clock.elapsedTime));
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new Object3D();
    const matrix = new Matrix4();
    const instanceColor = new Color();
    const scale = mode === "hero" ? 1.08 : 1.62;
    const sourceCanopySpread = part.foliage ? mode === "hero" ? 1.2 : 1.3 : 1.04;
    const habitatCanopySpread = part.foliage
      ? zone === "ridge" ? 1.12 : zone === "valley" || zone === "lake" ? 1.08 : 1
      : 1;
    placements.forEach((placement, index) => {
      const signature = Math.abs(Math.round(
        placement[2] * 0.31
        + placement[4] * 0.19
        + placement[3] * 0.47
        + placement[9] * 17
        + index * 23,
      ));
      const crownWidthVariation = 0.82 + (signature % 13) * 0.034;
      const crownDepthVariation = 0.86 + ((signature * 7) % 11) * 0.032;
      const heightVariation = 0.88 + ((signature * 11) % 9) * 0.036;
      const architecture = canopyArchitecture(placement, index, zone);
      const architectureScale = canopyArchitectureScale(architecture, part.foliage);
      const lakeApproachMidstoryScale = mode === "mid" && isLakeApproachMidstoryPlacement(placement) ? 1.18 : 1;
      // Keep the promoted anchors subordinate to the retained canopy. The high
      // hero source needs less compensation than the compact balanced mid LOD.
      const verticalSuccessionScale = isMultiSlopeSuccessionPlacement(placement, zone)
        ? mode === "hero" ? 1.08 : 1.16
        : 1;
      const drainageSuccessionScale = zone === "ridge" && isRidgeDrainageSuccessionPlacement(placement)
        ? mode === "hero"
          ? 1
          : placement[1] === 1 ? 1.06 : 1.42
        : 1;
      const easternValleyCatchmentScale = zone === "valley" && isEasternValleyCatchmentHabitatPlacement(placement)
        ? mode === "hero"
          ? 1
          : placement[1] === 1 ? 1.14 : 1.48
        : 1;
      const contactTrailheadScale = zone === "valley" && (
        mode === "hero"
          ? isHighContactTrailheadCanopyPlacement(placement)
          : isContactTrailheadHabitatPlacement(placement)
      )
        ? mode === "hero"
          ? 1.55
          : placement[1] === 1 ? 1.12 : 1.34
        : 1;
      dummy.position.set(
        placement[2],
        placement[3] + (zone === "valley" ? contactTrailheadPlacementRelief(placement) : 0),
        placement[4],
      );
      const architectureLean = architecture === "wind-pruned" ? 1.95 : architecture === "emergent" ? 0.72 : 1;
      const leanX = (((signature % 9) - 4) / 4) * (mode === "hero" ? 0.035 : 0.052) * architectureLean;
      const leanZ = ((((signature * 5) % 11) - 5) / 5) * (mode === "hero" ? 0.03 : 0.047) * architectureLean;
      dummy.rotation.set(leanX, placement[5] + (signature % 7) * 0.027, leanZ);
      dummy.scale.set(
        placement[6] * scale * sourceCanopySpread * habitatCanopySpread * crownWidthVariation * architectureScale.x * lakeApproachMidstoryScale * verticalSuccessionScale * drainageSuccessionScale * easternValleyCatchmentScale * contactTrailheadScale,
        placement[7] * scale * heightVariation * architectureScale.y * lakeApproachMidstoryScale * verticalSuccessionScale * drainageSuccessionScale * easternValleyCatchmentScale * contactTrailheadScale,
        placement[8] * scale * sourceCanopySpread * habitatCanopySpread * crownDepthVariation * architectureScale.z * lakeApproachMidstoryScale * verticalSuccessionScale * drainageSuccessionScale * easternValleyCatchmentScale * contactTrailheadScale,
      );
      dummy.updateMatrix();
      matrix.multiplyMatrices(dummy.matrix, part.matrixWorld);
      mesh.setMatrixAt(index, matrix);
      const foliagePalette = ["#eef2df", "#d5e2cf", "#c3d2b9", "#e2e1c6", "#b6c9aa", "#cdd7b5", "#d8cfaa"];
      const barkPalette = ["#f0dfca", "#d9c4ad", "#c9b29c", "#e5d0b7"];
      instanceColor.set(part.foliage
        ? foliagePalette[signature % foliagePalette.length]
        : barkPalette[signature % barkPalette.length]);
      mesh.setColorAt(index, instanceColor);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  }, [mode, part.foliage, part.matrixWorld, placements, zone]);
  return (
    <instancedMesh
      args={[part.geometry, part.material, placements.length]}
      // The balanced forest previously cast only trunk/branch shadows because
      // its alpha foliage was excluded. At this aerial scale that produced
      // long black scratches with no canopy mass. Keep the heavier complete
      // hero shadow path in high mode and let balanced contact come from the
      // terrain response instead of orphaned branch silhouettes.
      castShadow={shadows && mode === "hero"}
      receiveShadow={!part.foliage}
      ref={ref}
    />
  );
}

function DetailedVegetationLod({ placements, shadows, tier, zone }: {
  placements: PlacementTuple[];
  shadows: boolean;
  tier: WorldQualityTier;
  zone: V116Zone;
}) {
  const mode: DetailedVegetationMode = tier === "high" ? "hero" : "mid";
  const url = mode === "hero" ? V115_HERO_VEGETATION_URL : V115_MID_VEGETATION_URL;
  const gltf = useLoader(GLTFLoader, url, configureCompressedGltf);
  const parts = useMemo(() => prepareDetailedVegetation(gltf.scene, mode), [gltf.scene, mode]);
  const bySource = useMemo(() => {
    const result = new Map<string, PlacementTuple[]>();
    placements.forEach((placement, index) => {
      const sourceKey = detailedPlacementSource(placement, index, mode);
      result.set(sourceKey, [...(result.get(sourceKey) ?? []), placement]);
    });
    return result;
  }, [mode, placements]);
  useEffect(() => {
    const host = window as Window & { __MADAGIN_CUMULATIVE_VEGETATION_V116__?: Record<string, unknown> };
    host.__MADAGIN_CUMULATIVE_VEGETATION_V116__ = {
      ...(host.__MADAGIN_CUMULATIVE_VEGETATION_V116__ ?? {}),
      [zone]: {
        lakeApproachMidstoryPlacements: zone === "lake"
          ? placements.filter(isLakeApproachMidstoryPlacement).length
          : 0,
        mode,
        placements: placements.length,
        ridgeDrainageAddedPlacements: zone === "ridge"
          ? placements.filter(isAddedRidgeDrainageSuccessionPlacement).length
          : 0,
        ridgeDrainageHabitatPlacements: zone === "ridge"
          ? placements.filter(isRidgeDrainageSuccessionPlacement).length
          : 0,
        easternValleyCatchmentAddedPlacements: zone === "valley"
          ? placements.filter(isAddedEasternValleyCatchmentHabitatPlacement).length
          : 0,
        easternValleyCatchmentHabitatPlacements: zone === "valley"
          ? placements.filter(isEasternValleyCatchmentHabitatPlacement).length
          : 0,
        contactTrailheadAddedPlacements: zone === "valley"
          ? placements.filter(mode === "hero"
            ? isHighContactTrailheadCanopyPlacement
            : isAddedContactTrailheadHabitatPlacement).length
          : 0,
        contactTrailheadHabitatPlacements: zone === "valley"
          ? placements.filter(mode === "hero"
            ? isHighContactTrailheadCanopyPlacement
            : isContactTrailheadHabitatPlacement).length
          : 0,
        architectureProfiles: ["emergent", "mature", "umbrella", "wind-pruned", "columnar"],
        verticalSuccessionPlacements: placements.filter((placement) => (
          isMultiSlopeSuccessionPlacement(placement, zone)
        )).length,
        source: url,
      },
    };
    document.documentElement.dataset.madaginCumulativeVegetationV116 = JSON.stringify(host.__MADAGIN_CUMULATIVE_VEGETATION_V116__);
    dispatchStage(2, `${zone}-restored-v115-${mode}-vegetation-ready`, zone);
    return () => parts.forEach((part) => {
      (Array.isArray(part.material) ? part.material : [part.material]).forEach((material) => material.dispose());
    });
  }, [mode, parts, placements, url, zone]);
  return (
    <group name={`Madagin v1.16 cumulative ${zone} · restored v1.15 ${mode} vegetation · ${placements.length}`}>
      {parts.flatMap((part, index) => {
        const sourcePlacements = bySource.get(part.sourceKey) ?? [];
        return sourcePlacements.length ? (
          <InstancedDetailedVegetation
            key={`${zone}-${mode}-${part.sourceKey}-${index}`}
            mode={mode}
            part={part}
            placements={sourcePlacements}
            shadows={shadows}
            zone={zone}
          />
        ) : [];
      })}
    </group>
  );
}

function prepareWatershedGroundcover(scene: Object3D, sourceKey: WatershedGroundcoverKey) {
  scene.updateMatrixWorld(true);
  const result: WatershedGroundcoverPart[] = [];
  scene.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const originals = Array.isArray(child.material) ? child.material : [child.material];
    const materials = originals.map((original) => {
      const material = (original as MeshStandardMaterial).clone();
      const foliage = sourceKey !== "rock";
      material.alphaTest = foliage ? Math.max(0.44, material.alphaTest || 0) : material.alphaTest;
      material.color.multiply(new Color(
        sourceKey === "fern" ? "#8f9f84" : sourceKey === "shrub" ? "#81957c" : "#70766f",
      ));
      material.vertexColors = true;
      material.depthWrite = true;
      material.emissive.set(foliage ? "#141f14" : "#0b0e0c");
      material.emissiveIntensity = foliage ? 0.09 : 0.025;
      material.envMapIntensity = foliage ? 0.38 : 0.28;
      material.metalness = 0;
      material.roughness = Math.max(foliage ? 0.94 : 0.97, material.roughness ?? 0.94);
      material.side = foliage ? DoubleSide : FrontSide;
      material.transparent = false;
      if (foliage) enableLivingWind(material, sourceKey === "fern" ? 0.22 : 0.15);
      material.needsUpdate = true;
      return material;
    });
    result.push({
      family: sourceKey,
      geometry: child.geometry,
      material: Array.isArray(child.material) ? materials : materials[0],
      matrixWorld: child.matrixWorld.clone(),
      sourceKey,
    });
  });
  return result;
}

function selectWatershedGroundcover(instances: PlacementTuple[], mobile: boolean, tier: WorldQualityTier) {
  if (mobile || tier === "conservative") return [];
  const lakeCenterX = v116RiverCenter(-890);
  const eligible = instances.filter((placement) => {
    if (placement[1] !== 2) return false;
    const shorelineDistance = Math.hypot((placement[2] - lakeCenterX) / 146, (placement[4] + 890) / 118);
    return shorelineDistance > 0.82 && shorelineDistance < 1.32;
  });
  return tier === "high" ? eligible : eligible.filter((_, index) => index % 3 !== 1);
}

function isRiparianHabitatPlacement(placement: PlacementTuple) {
  const x = placement[2];
  const z = placement[4];
  const riverCenter = v116RiverBaseCenter(z);
  const nearRiver = z >= -780 && z <= -313
    && Math.abs(x - riverCenter) < Math.max(26, v116RiverBaseHalfWidth(z) * 3.2);
  const shorelineDistance = Math.hypot((x - v116RiverCenter(-890)) / 146, (z + 890) / 118);
  const nearLake = shorelineDistance > 0.76 && shorelineDistance < 1.36;
  const nearWaterfall = Math.hypot((x - 160) / 78, (z + 704) / 64) < 0.95;
  return nearRiver || nearLake || nearWaterfall;
}

function selectRiparianGroundcover(instances: PlacementTuple[], mobile: boolean, tier: WorldQualityTier) {
  if (mobile || tier === "conservative") return [];
  const eligible = instances.filter((placement) => placement[1] === 2 && isRiparianHabitatPlacement(placement));
  return tier === "high" ? eligible : eligible.filter((_, index) => index % 3 !== 2);
}

function selectLakeBankSuccession(instances: PlacementTuple[], mobile: boolean, tier: WorldQualityTier) {
  if (mobile || tier === "conservative") return [];
  return instances.filter(isLakeBankSuccessionPlacement);
}

function selectContactTrailheadGroundcover(instances: PlacementTuple[], mobile: boolean, tier: WorldQualityTier) {
  if (mobile || tier === "conservative") return [];
  return instances.filter((placement) => (
    placement[1] === 2 && isContactTrailheadHabitatPlacement(placement)
  ));
}

function selectRegionalHabitatGroundcover(
  instances: PlacementTuple[],
  mobile: boolean,
  tier: WorldQualityTier,
  zone: V116Zone,
) {
  if (mobile || tier === "conservative") return [];
  const eligible = instances.filter((placement) => (
    placement[1] === 2
    && (
      (zone === "ridge" && isRidgeDrainageSuccessionPlacement(placement))
      || (zone === "valley" && isEasternValleyCatchmentHabitatPlacement(placement))
    )
  ));
  return tier === "high" ? eligible : eligible.filter((placement) => (
    multiSlopeSuccessionSignature(placement) % 4 !== 1
  ));
}

function watershedGroundcoverSource(placement: PlacementTuple, index: number): WatershedGroundcoverKey {
  void placement;
  void index;
  return "rock";
}

function riparianGroundcoverSource(placement: PlacementTuple, index: number): WatershedGroundcoverKey {
  const signature = Math.abs(Math.round(placement[2] * 3 + placement[4] * 5 + index * 17));
  return signature % 3 === 0 ? "shrub" : "fern";
}

function InstancedWatershedGroundcover({ part, placements, shadows }: {
  part: WatershedGroundcoverPart;
  placements: PlacementTuple[];
  shadows: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);
  useFrame(({ clock }) => updateLivingWind(part.material, clock.elapsedTime));
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new Object3D();
    const matrix = new Matrix4();
    const instanceColor = new Color();
    const baseScale = part.sourceKey === "fern" ? 8.5 : part.sourceKey === "shrub" ? 14.5 : 38;
    placements.forEach((placement, index) => {
      const signature = Math.abs(Math.round(placement[2] * 0.43 + placement[4] * 0.29 + index * 17 + placement[9]));
      const variation = 0.82 + (signature % 11) * 0.042;
      const widthVariation = 0.78 + ((signature * 5) % 13) * 0.041;
      const depthVariation = 0.82 + ((signature * 7) % 9) * 0.047;
      const habitatScale = isLakeBankSuccessionPlacement(placement) ? 2 : 1;
      const regionalHabitatScale = (
        isRidgeDrainageSuccessionPlacement(placement)
        || isEasternValleyCatchmentHabitatPlacement(placement)
      ) ? 1.42 : 1;
      dummy.position.set(placement[2], placement[3] - (part.sourceKey === "rock" ? 0.08 : 0.075), placement[4]);
      dummy.rotation.set(
        part.sourceKey === "rock" ? ((signature % 7) - 3) * 0.035 : ((signature % 5) - 2) * 0.018,
        placement[5] + (signature % 9) * 0.041,
        part.sourceKey === "rock" ? (((signature * 3) % 7) - 3) * 0.03 : (((signature * 3) % 5) - 2) * 0.016,
      );
      dummy.scale.set(
        placement[6] * baseScale * variation * widthVariation * habitatScale * regionalHabitatScale,
        placement[7] * baseScale * (part.sourceKey === "rock" ? 0.68 : variation) * habitatScale * regionalHabitatScale,
        placement[8] * baseScale * variation * depthVariation * habitatScale * regionalHabitatScale,
      );
      dummy.updateMatrix();
      matrix.multiplyMatrices(dummy.matrix, part.matrixWorld);
      mesh.setMatrixAt(index, matrix);
      const fernPalette = ["#eef3df", "#d4e4c7", "#bfcea9", "#e5e6c7"];
      const shrubPalette = ["#d9e5cf", "#c3d6bb", "#e5e6c8", "#b6c8a5"];
      const rockPalette = ["#d6d1c4", "#bdbbae", "#e0d4bd", "#aeb8ad"];
      const palette = part.sourceKey === "fern" ? fernPalette : part.sourceKey === "shrub" ? shrubPalette : rockPalette;
      instanceColor.set(palette[signature % palette.length]);
      mesh.setColorAt(index, instanceColor);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  }, [part.matrixWorld, part.sourceKey, placements]);
  return (
    <instancedMesh
      args={[part.geometry, part.material, placements.length]}
      castShadow={shadows && part.sourceKey === "rock"}
      receiveShadow
      ref={ref}
    />
  );
}

function DetailedWatershedGroundcover({ placements, shadows }: {
  placements: PlacementTuple[];
  shadows: boolean;
}) {
  const rock = useLoader(GLTFLoader, WATERSHED_GROUNDCOVER_URLS.rock);
  const parts = useMemo(() => [
    ...prepareWatershedGroundcover(rock.scene, "rock"),
  ], [rock.scene]);
  const bySource = useMemo(() => {
    const result = new Map<WatershedGroundcoverKey, PlacementTuple[]>();
    placements.forEach((placement, index) => {
      const sourceKey = watershedGroundcoverSource(placement, index);
      result.set(sourceKey, [...(result.get(sourceKey) ?? []), placement]);
    });
    return result;
  }, [placements]);
  useEffect(() => {
    dispatchStage(3, "lake-grounded-existing-source-geology-ready", "lake");
    return () => parts.forEach((part) => {
      (Array.isArray(part.material) ? part.material : [part.material]).forEach((material) => material.dispose());
    });
  }, [parts]);
  return (
    <group name={`Madagin v1.16 grounded existing-source watershed geology · ${placements.length}`}>
      {parts.flatMap((part, index) => {
        const sourcePlacements = bySource.get(part.sourceKey) ?? [];
        return sourcePlacements.length ? (
          <InstancedWatershedGroundcover
            key={`${part.sourceKey}-${index}`}
            part={part}
            placements={sourcePlacements}
            shadows={shadows}
          />
        ) : [];
      })}
    </group>
  );
}

function DetailedRiparianGroundcover({ lakeBankSuccessionPlacements, placements, shadows }: {
  lakeBankSuccessionPlacements: number;
  placements: PlacementTuple[];
  shadows: boolean;
}) {
  const fern = useLoader(GLTFLoader, WATERSHED_GROUNDCOVER_URLS.fern);
  const shrub = useLoader(GLTFLoader, WATERSHED_GROUNDCOVER_URLS.shrub);
  const parts = useMemo(() => [
    ...prepareWatershedGroundcover(fern.scene, "fern"),
    ...prepareWatershedGroundcover(shrub.scene, "shrub"),
  ], [fern.scene, shrub.scene]);
  const bySource = useMemo(() => {
    const result = new Map<WatershedGroundcoverKey, PlacementTuple[]>();
    placements.forEach((placement, index) => {
      const sourceKey = riparianGroundcoverSource(placement, index);
      result.set(sourceKey, [...(result.get(sourceKey) ?? []), placement]);
    });
    return result;
  }, [placements]);
  useEffect(() => {
    const host = window as Window & { __MADAGIN_RIPARIAN_ECOLOGY_V116__?: Record<string, unknown> };
    host.__MADAGIN_RIPARIAN_ECOLOGY_V116__ = {
      fern: bySource.get("fern")?.length ?? 0,
      groundedPlacements: placements.length,
      lakeBankSuccessionPlacements,
      riparianPlacements: placements.length - lakeBankSuccessionPlacements,
      shrub: bySource.get("shrub")?.length ?? 0,
      sources: [WATERSHED_GROUNDCOVER_URLS.fern, WATERSHED_GROUNDCOVER_URLS.shrub],
    };
    document.documentElement.dataset.madaginRiparianEcologyV116 = JSON.stringify(host.__MADAGIN_RIPARIAN_ECOLOGY_V116__);
    dispatchStage(3, "lake-grounded-riparian-ecology-ready", "lake");
    return () => parts.forEach((part) => {
      (Array.isArray(part.material) ? part.material : [part.material]).forEach((material) => material.dispose());
    });
  }, [bySource, lakeBankSuccessionPlacements, parts, placements.length]);
  return (
    <group name={`Madagin v1.16 grounded CC0 riparian and bank-succession ecology · ${placements.length}`}>
      {parts.flatMap((part, index) => {
        const sourcePlacements = bySource.get(part.sourceKey) ?? [];
        return sourcePlacements.length ? (
          <InstancedWatershedGroundcover
            key={`riparian-${part.sourceKey}-${index}`}
            part={part}
            placements={sourcePlacements}
            shadows={shadows}
          />
        ) : [];
      })}
    </group>
  );
}

function DetailedContactTrailheadGroundcover({ placements, shadows }: {
  placements: PlacementTuple[];
  shadows: boolean;
}) {
  const fern = useLoader(GLTFLoader, WATERSHED_GROUNDCOVER_URLS.fern);
  const shrub = useLoader(GLTFLoader, WATERSHED_GROUNDCOVER_URLS.shrub);
  const parts = useMemo(() => [
    ...prepareWatershedGroundcover(fern.scene, "fern"),
    ...prepareWatershedGroundcover(shrub.scene, "shrub"),
  ], [fern.scene, shrub.scene]);
  const adjustedPlacements = useMemo(() => placements.map((placement) => {
    const adjusted = [...placement] as PlacementTuple;
    adjusted[3] += contactTrailheadPlacementRelief(placement);
    return adjusted;
  }), [placements]);
  const bySource = useMemo(() => {
    const result = new Map<WatershedGroundcoverKey, PlacementTuple[]>();
    adjustedPlacements.forEach((placement, index) => {
      const sourceKey = riparianGroundcoverSource(placement, index);
      result.set(sourceKey, [...(result.get(sourceKey) ?? []), placement]);
    });
    return result;
  }, [adjustedPlacements]);
  useEffect(() => {
    const host = window as Window & { __MADAGIN_CONTACT_TRAILHEAD_HABITAT_V116__?: Record<string, unknown> };
    host.__MADAGIN_CONTACT_TRAILHEAD_HABITAT_V116__ = {
      fern: bySource.get("fern")?.length ?? 0,
      groundedPlacements: placements.length,
      method: "existing grounded layer-2 anchors restored as fern and shrub contact succession",
      shrub: bySource.get("shrub")?.length ?? 0,
      sources: [WATERSHED_GROUNDCOVER_URLS.fern, WATERSHED_GROUNDCOVER_URLS.shrub],
    };
    document.documentElement.dataset.madaginContactTrailheadHabitatV116 = JSON.stringify(
      host.__MADAGIN_CONTACT_TRAILHEAD_HABITAT_V116__,
    );
    dispatchStage(3, "valley-contact-trailhead-groundcover-ready", "valley");
    return () => parts.forEach((part) => {
      (Array.isArray(part.material) ? part.material : [part.material]).forEach((material) => material.dispose());
    });
  }, [bySource, parts, placements.length]);
  return (
    <group name={`Madagin v1.16 grounded Contact trailhead succession · ${placements.length}`}>
      {parts.flatMap((part, index) => {
        const sourcePlacements = bySource.get(part.sourceKey) ?? [];
        return sourcePlacements.length ? (
          <InstancedWatershedGroundcover
            key={`contact-${part.sourceKey}-${index}`}
            part={part}
            placements={sourcePlacements}
            shadows={shadows}
          />
        ) : [];
      })}
    </group>
  );
}

function DetailedRegionalHabitatGroundcover({ placements, shadows, zone }: {
  placements: PlacementTuple[];
  shadows: boolean;
  zone: "ridge" | "valley";
}) {
  const fern = useLoader(GLTFLoader, WATERSHED_GROUNDCOVER_URLS.fern);
  const shrub = useLoader(GLTFLoader, WATERSHED_GROUNDCOVER_URLS.shrub);
  const parts = useMemo(() => [
    ...prepareWatershedGroundcover(fern.scene, "fern"),
    ...prepareWatershedGroundcover(shrub.scene, "shrub"),
  ], [fern.scene, shrub.scene]);
  const bySource = useMemo(() => {
    const result = new Map<WatershedGroundcoverKey, PlacementTuple[]>();
    placements.forEach((placement, index) => {
      const sourceKey = riparianGroundcoverSource(placement, index);
      result.set(sourceKey, [...(result.get(sourceKey) ?? []), placement]);
    });
    return result;
  }, [placements]);
  useEffect(() => {
    const host = window as Window & { __MADAGIN_REGIONAL_HABITAT_V116__?: Record<string, unknown> };
    const key = zone === "ridge" ? "ridgeDrainage" : "easternValleyCatchment";
    host.__MADAGIN_REGIONAL_HABITAT_V116__ = {
      ...(host.__MADAGIN_REGIONAL_HABITAT_V116__ ?? {}),
      [key]: {
        fern: bySource.get("fern")?.length ?? 0,
        groundedPlacements: placements.length,
        habitatAuthority: zone === "ridge" ? "ridge-erosion-network" : "eastern-valley-catchment-network",
        shrub: bySource.get("shrub")?.length ?? 0,
        sources: [WATERSHED_GROUNDCOVER_URLS.fern, WATERSHED_GROUNDCOVER_URLS.shrub],
      },
    };
    document.documentElement.dataset.madaginRegionalHabitatV116 = JSON.stringify(
      host.__MADAGIN_REGIONAL_HABITAT_V116__,
    );
    dispatchStage(3, `${zone}-regional-habitat-groundcover-ready`, zone);
    return () => parts.forEach((part) => {
      (Array.isArray(part.material) ? part.material : [part.material]).forEach((material) => material.dispose());
    });
  }, [bySource, parts, placements.length, zone]);
  return (
    <group name={`Madagin v1.16 ${zone} drainage-coupled fern and shrub succession · ${placements.length}`}>
      {parts.flatMap((part, index) => {
        const sourcePlacements = bySource.get(part.sourceKey) ?? [];
        return sourcePlacements.length ? (
          <InstancedWatershedGroundcover
            key={`regional-${zone}-${part.sourceKey}-${index}`}
            part={part}
            placements={sourcePlacements}
            shadows={shadows}
          />
        ) : [];
      })}
    </group>
  );
}

function EcologyChunk({ diagnosticMode, mobile, shadows, tier, zone }: {
  diagnosticMode?: DiagnosticMode;
  mobile: boolean;
  shadows: boolean;
  tier: WorldQualityTier;
  zone: V116Zone;
}) {
  const manifest = useEcologyManifest(zone);
  const gltf = useLoader(GLTFLoader, SPECIES_URL, configureCompressedGltf);
  const parts = useMemo(() => prepareSpecies(gltf.scene), [gltf.scene]);
  const detailedPlacements = useMemo(
    () => selectDetailedPlacements(manifest.instances, mobile, tier, zone),
    [manifest.instances, mobile, tier, zone],
  );
  const detailedVegetationSet = useMemo(() => new Set(detailedPlacements), [detailedPlacements]);
  const watershedGroundcover = useMemo(
    () => zone === "lake"
      ? selectWatershedGroundcover(manifest.instances, mobile, tier)
        .filter((placement) => !detailedVegetationSet.has(placement))
      : [],
    [detailedVegetationSet, manifest.instances, mobile, tier, zone],
  );
  const riparianGroundcover = useMemo(
    () => zone === "lake"
      ? selectRiparianGroundcover(manifest.instances, mobile, tier)
        .filter((placement) => !detailedVegetationSet.has(placement))
      : [],
    [detailedVegetationSet, manifest.instances, mobile, tier, zone],
  );
  const lakeBankSuccession = useMemo(() => {
    if (zone !== "lake") return [];
    const occupied = new Set([...detailedPlacements, ...watershedGroundcover, ...riparianGroundcover]);
    return selectLakeBankSuccession(manifest.instances, mobile, tier)
      .filter((placement) => !occupied.has(placement));
  }, [detailedPlacements, manifest.instances, mobile, riparianGroundcover, tier, watershedGroundcover, zone]);
  const groundedRiparianEcology = useMemo(
    () => [...riparianGroundcover, ...lakeBankSuccession],
    [lakeBankSuccession, riparianGroundcover],
  );
  const contactTrailheadGroundcover = useMemo(
    () => zone === "valley"
      ? selectContactTrailheadGroundcover(manifest.instances, mobile, tier)
        .filter((placement) => !detailedVegetationSet.has(placement))
      : [],
    [detailedVegetationSet, manifest.instances, mobile, tier, zone],
  );
  const regionalHabitatGroundcover = useMemo(() => {
    if (zone !== "ridge" && zone !== "valley") return [];
    const occupied = new Set([...detailedPlacements, ...contactTrailheadGroundcover]);
    return selectRegionalHabitatGroundcover(manifest.instances, mobile, tier, zone)
      .filter((placement) => !occupied.has(placement));
  }, [contactTrailheadGroundcover, detailedPlacements, manifest.instances, mobile, tier, zone]);
  const detailedSet = useMemo(
    () => new Set([
      ...detailedPlacements,
      ...watershedGroundcover,
      ...groundedRiparianEcology,
      ...contactTrailheadGroundcover,
      ...regionalHabitatGroundcover,
    ]),
    [contactTrailheadGroundcover, detailedPlacements, groundedRiparianEcology, regionalHabitatGroundcover, watershedGroundcover],
  );
  const visible = useMemo(() => manifest.instances.filter((placement, index) => {
    if (detailedSet.has(placement)) return false;
    if (zone === "lake" && isLakeBankSuccessionPlacement(placement)) return false;
    if (tier === "high" && !mobile) return true;
    if (tier === "balanced" && !mobile) return placement[1] < 2 || index % 4 !== 1;
    if (mobile && zone === "lake" && isRiparianHabitatPlacement(placement)) return true;
    if (mobile) return placement[1] === 0 ? index % 4 !== 1 : index % 2 === 0;
    return placement[1] === 0 ? index % 3 === 0 : index % 5 === 0;
  }), [detailedSet, manifest.instances, mobile, tier, zone]);
  const volumetricCrownStats = useMemo(() => visible.reduce((stats, placement) => {
    const family = manifest.families[placement[0]];
    const lobes = volumetricCrownLobeCount(family, placement, mobile);
    if (lobes > 1) {
      stats.placements += 1;
      stats.renderedLobes += lobes;
    }
    return stats;
  }, { placements: 0, renderedLobes: 0 }), [manifest.families, mobile, visible]);
  const batches = useMemo(() => {
    const grouped = new Map<string, PlacementTuple[]>();
    visible.forEach((placement) => {
      const key = manifest.families[placement[0]];
      grouped.set(key, [...(grouped.get(key) ?? []), placement]);
    });
    return grouped;
  }, [manifest.families, visible]);

  useEffect(() => {
    const host = window as Window & {
      __MADAGIN_RIDGE_GROUNDING_V116__?: Record<string, EcologyManifest["coverage"]["grounding"]>;
      __MADAGIN_ECOLOGY_DEBUG_V116__?: Record<string, unknown>;
    };
    host.__MADAGIN_RIDGE_GROUNDING_V116__ = {
      ...(host.__MADAGIN_RIDGE_GROUNDING_V116__ ?? {}),
      [zone]: manifest.coverage.grounding,
    };
    host.__MADAGIN_ECOLOGY_DEBUG_V116__ = {
      ...(host.__MADAGIN_ECOLOGY_DEBUG_V116__ ?? {}),
      [zone]: {
        batches: [...batches.entries()].map(([key, placements]) => ({ key, count: placements.length })),
        parts: parts.map((part) => {
          part.geometry.computeBoundingBox();
          const size = part.geometry.boundingBox?.getSize(new Vector3());
          const center = part.geometry.boundingBox?.getCenter(new Vector3());
          return {
            family: part.family,
            materials: (Array.isArray(part.material) ? part.material : [part.material]).map((material) => material.name),
            size: size ? [size.x, size.y, size.z] : null,
            center: center ? [center.x, center.y, center.z] : null,
            translation: part.matrixWorld.elements.slice(12, 15),
            vertices: part.geometry.attributes.position?.count ?? 0,
          };
        }),
        sourceInstances: manifest.instances.length,
        restoredGroundcoverInstances: watershedGroundcover.length,
        restoredContactTrailheadGroundcoverInstances: contactTrailheadGroundcover.length,
        restoredRegionalHabitatGroundcoverInstances: regionalHabitatGroundcover.length,
        restoredLakeBankSuccessionInstances: lakeBankSuccession.length,
        restoredRiparianInstances: riparianGroundcover.length,
        restoredDetailedInstances: detailedPlacements.length,
        releasedPrimaryCanopyInstances: tier === "balanced" && !mobile && zone !== "lake"
          ? manifest.instances.filter((placement) => (
            placement[1] === 0 && placement[0] < 8 && !detailedVegetationSet.has(placement)
          )).length
          : 0,
        volumetricCrownPlacements: volumetricCrownStats.placements,
        volumetricCrownRenderedLobes: volumetricCrownStats.renderedLobes,
        visibleInstances: visible.length,
      },
    };
    document.documentElement.dataset.madaginRidgeGroundingV116 = JSON.stringify(host.__MADAGIN_RIDGE_GROUNDING_V116__);
    document.documentElement.dataset.madaginEcologyDebugV116 = JSON.stringify(host.__MADAGIN_ECOLOGY_DEBUG_V116__);
    dispatchStage(2, `${zone}-ecology-ready`, zone);
  }, [batches, contactTrailheadGroundcover.length, detailedPlacements.length, detailedVegetationSet, lakeBankSuccession.length, manifest.coverage.grounding, manifest.instances, mobile, parts, regionalHabitatGroundcover.length, riparianGroundcover.length, tier, visible.length, volumetricCrownStats, watershedGroundcover.length, zone]);

  return (
    <group name={`Madagin v1.16 ${zone} spatial ecology · ${visible.length} visible instances`}>
      {detailedPlacements.length ? (
        <Suspense fallback={null}>
          <DetailedVegetationLod placements={detailedPlacements} shadows={shadows} tier={tier} zone={zone} />
        </Suspense>
      ) : null}
      {watershedGroundcover.length ? (
        <Suspense fallback={null}>
          <DetailedWatershedGroundcover placements={watershedGroundcover} shadows={shadows} />
        </Suspense>
      ) : null}
      {groundedRiparianEcology.length ? (
        <Suspense fallback={null}>
          <DetailedRiparianGroundcover
            lakeBankSuccessionPlacements={lakeBankSuccession.length}
            placements={groundedRiparianEcology}
            shadows={shadows}
          />
        </Suspense>
      ) : null}
      {contactTrailheadGroundcover.length ? (
        <Suspense fallback={null}>
          <DetailedContactTrailheadGroundcover placements={contactTrailheadGroundcover} shadows={shadows} />
        </Suspense>
      ) : null}
      {regionalHabitatGroundcover.length && (zone === "ridge" || zone === "valley") ? (
        <Suspense fallback={null}>
          <DetailedRegionalHabitatGroundcover
            placements={regionalHabitatGroundcover}
            shadows={shadows}
            zone={zone}
          />
        </Suspense>
      ) : null}
      {[...batches.entries()].flatMap(([key, placements]) => {
        const familyParts = parts.filter((candidate) => candidate.family === key);
        return familyParts.map((part, partIndex) => (
          <InstancedSpeciesBatch
            key={`${key}-${partIndex}`}
            mobile={mobile}
            part={part}
            placements={placements}
            shadows={shadows && tier === "high" && (zone === "ridge" || zone === "valley")}
          />
        ));
      })}
      {zone === "ridge" || zone === "valley" || zone === "alpine" ? (
        <RidgeBasaltField placements={visible} shadows={shadows} zone={zone} />
      ) : null}
      {diagnosticMode === "grounding" ? visible.filter((_, index) => index % 20 === 0).slice(0, 140).map((placement, index) => (
        <mesh key={`root-${zone}-${index}`} position={[placement[2], placement[3] + 0.08, placement[4]]}>
          <sphereGeometry args={[0.16, 6, 4]} />
          <meshBasicMaterial color={placement[10] <= 0.02 && placement[11] <= 0.1 ? "#f2d15a" : "#ff4d42"} depthTest={false} />
        </mesh>
      )) : null}
    </group>
  );
}

function createWaterMaterial(kind: "watershed" | "river" | "headwater" | "pool" = "watershed") {
  const lake = kind === "watershed";
  const river = kind === "river";
  const headwater = kind === "headwater";
  const directional = river || headwater;
  const material = new ShaderMaterial({
    depthTest: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: true,
    transparent: true,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorld;
      varying vec2 vWaterUv;
      void main() {
        vec3 p = position;
        float lakeInterior = 1.0 - clamp(length((uv - 0.5) * 2.0), 0.0, 1.0);
        float lakeWaveEnvelope = ${lake ? "smoothstep(0.0, 0.2, lakeInterior)" : "0.0"};
        // Tens-of-metres wave fields move the lake's physical surface while
        // the final boundary ring remains fixed on the shared terrain edge.
        // This avoids both shoreline breathing and the dense corrugation made
        // by displacing individual radial rows.
        float lakeWaveA = sin(p.x * 0.034 + p.z * 0.021 + uTime * 0.18);
        float lakeWaveB = sin(p.x * -0.019 + p.z * 0.044 - uTime * 0.13 + sin(p.x * 0.008) * 0.9);
        p.y += (lakeWaveA * 0.045 + lakeWaveB * 0.026) * lakeWaveEnvelope;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        vWaterUv = uv;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vWorld;
      varying vec2 vWaterUv;
      void main() {
        vec3 dx = dFdx(vWorld);
        vec3 dy = dFdy(vWorld);
        vec3 n = normalize(cross(dx, dy));
        if (n.y < 0.0) n *= -1.0;
        float phaseA = vWorld.x * ${lake ? "0.052" : directional ? "0.72" : "1.73"} + vWorld.z * ${lake ? "0.037" : directional ? "2.64" : "2.11"} + uTime * ${lake ? "0.21" : directional ? "0.94" : "0.72"};
        float phaseB = vWorld.x * ${lake ? "-0.029" : directional ? "-1.31" : "-2.31"} + vWorld.z * ${lake ? "0.083" : directional ? "4.22" : "3.67"} - uTime * ${lake ? "0.16" : directional ? "0.71" : "0.54"} + sin(vWorld.x * 0.009 + vWorld.z * 0.006) * ${lake ? "1.25" : "0.0"};
        float capillary = vWorld.x * 0.31 - vWorld.z * 0.24 + uTime * 0.48 + sin(vWorld.z * 0.018) * 1.1;
        vec3 rippleNormal = normalize(vec3(
          cos(phaseA) * 0.105 - cos(phaseB) * 0.065 + cos(capillary) * ${lake ? "0.018" : "0.0"},
          1.0,
          cos(phaseA) * 0.07 + cos(phaseB) * 0.125 + sin(capillary) * ${lake ? "0.014" : "0.0"}
        ));
        n = ${lake
    ? "normalize(mix(vec3(0.0, 1.0, 0.0), rippleNormal, 0.14))"
    : `normalize(mix(n, rippleNormal, ${directional ? "0.105" : "0.078"}))`};
        vec3 viewDirection = normalize(cameraPosition - vWorld);
        float fresnel = pow(
          1.0 - clamp(dot(n, viewDirection), 0.0, 1.0),
          ${lake ? "2.35" : directional ? "3.1" : "3.4"}
        );
        float broad = sin(vWorld.x * 0.025 + vWorld.z * 0.019 + uTime * 0.08) * 0.5 + 0.5;
        float windBand = ${lake
    ? "clamp(0.5 + sin(vWorld.x * 0.038 - vWorld.z * 0.029 + uTime * 0.14 + sin(vWorld.z * 0.011) * 1.6) * 0.18 + sin(vWorld.x * -0.017 + vWorld.z * 0.052 - uTime * 0.1 + sin(vWorld.x * 0.008) * 1.2) * 0.14 + sin(vWorld.x * 0.013 + vWorld.z * 0.016 + uTime * 0.045) * 0.08, 0.0, 1.0)"
    : "sin(vWorld.x * 0.071 - vWorld.z * 0.054 + uTime * 0.19 + sin(vWorld.z * 0.017) * 1.8) * 0.5 + 0.5"};
        float glint = pow(
          max(dot(reflect(-normalize(vec3(-0.72, 0.48, 0.38)), n), viewDirection), 0.0),
          ${lake ? "22.0" : directional ? "72.0" : "48.0"}
        );
        float lakeInterior = 1.0 - clamp(length((vWaterUv - 0.5) * 2.0), 0.0, 1.0);
        float lakeSurfaceVariation = clamp(
          0.5
            + sin(vWorld.x * 0.041 + vWorld.z * 0.018 + uTime * 0.045) * 0.16
            + sin(vWorld.x * -0.023 + vWorld.z * 0.052 - uTime * 0.034) * 0.12,
          0.0,
          1.0
        );
        float bankSoftening = ${directional
    ? "smoothstep(0.025, 0.18, min(vWaterUv.x, 1.0 - vWaterUv.x))"
    : "smoothstep(0.0, 0.16, lakeInterior)"};
        float basinDepth = ${directional ? "bankSoftening" : "smoothstep(0.12, 0.76, lakeInterior)"};
        float riverMouth = ${river ? "smoothstep(0.94, 1.0, vWaterUv.y)" : "0.0"};
        vec3 depthColor = ${headwater ? "vec3(0.004, 0.021, 0.021)" : river ? "mix(vec3(0.005, 0.029, 0.03), vec3(0.003, 0.021, 0.028), riverMouth)" : lake ? "vec3(0.003, 0.019, 0.028)" : "vec3(0.007, 0.043, 0.05)"};
        vec3 surfaceColor = ${headwater ? "vec3(0.019, 0.062, 0.052)" : river ? "mix(vec3(0.022, 0.086, 0.083), vec3(0.014, 0.064, 0.078), riverMouth)" : lake ? "vec3(0.018, 0.064, 0.078)" : "vec3(0.03, 0.11, 0.125)"};
        vec3 shallowColor = ${headwater ? "vec3(0.042, 0.09, 0.07)" : river ? "mix(vec3(0.054, 0.12, 0.1), vec3(0.052, 0.13, 0.12), riverMouth)" : lake ? "vec3(0.05, 0.125, 0.115)" : "vec3(0.085, 0.17, 0.15)"};
        vec3 reflectionDirection = reflect(-viewDirection, n);
        float reflectedHeight = smoothstep(-0.12, 0.78, reflectionDirection.y);
        vec3 atmosphericReflection = mix(
          vec3(0.31, 0.46, 0.51),
          vec3(0.055, 0.18, 0.31),
          reflectedHeight
        );
        vec3 skyReflection = ${headwater
    ? "mix(vec3(0.075, 0.135, 0.14), atmosphericReflection, 0.24)"
    : river
      ? "mix(mix(vec3(0.12, 0.205, 0.21), vec3(0.09, 0.18, 0.24), riverMouth), atmosphericReflection, 0.34)"
      : lake
        ? "mix(vec3(0.075, 0.145, 0.17), atmosphericReflection, 0.58)"
        : "mix(vec3(0.17, 0.28, 0.31), atmosphericReflection, 0.46)"};
        vec3 color = mix(shallowColor, depthColor, basinDepth * ${headwater ? "0.82" : river ? "0.72" : lake ? "0.9" : "0.88"});
        float shorelineTurbidity = ${lake ? "(1.0 - bankSoftening) * (0.72 + windBand * 0.18)" : "0.0"};
        float submergedStone = sin(vWorld.x * 0.73 + sin(vWorld.z * 0.21) * 1.7)
          * sin(vWorld.z * 0.64 - vWorld.x * 0.13) * 0.5 + 0.5;
        float littoralCaustic = pow(max(0.0, sin(vWorld.x * 0.19 - vWorld.z * 0.23 + uTime * 0.23)), 8.0)
          * (1.0 - basinDepth) * bankSoftening;
        color = mix(color, mix(vec3(0.075, 0.095, 0.058), vec3(0.15, 0.14, 0.086), submergedStone), shorelineTurbidity * 0.52);
        color += vec3(0.28, 0.34, 0.22) * littoralCaustic * ${lake ? "0.0" : directional ? "0.055" : "0.075"};
        color = mix(color, surfaceColor, ${headwater ? "0.16 + broad * 0.055" : river ? "0.22 + broad * 0.08" : lake ? "0.09" : "0.2 + broad * 0.11"});
        color += vec3(0.025, 0.052, 0.057) * (lakeSurfaceVariation - 0.5) * lakeInterior * ${lake ? "0.44" : "0.0"};
        color = mix(color, skyReflection, fresnel * ${headwater ? "0.2" : river ? "0.34" : lake ? "0.7" : "0.4"});
        color += vec3(0.36, 0.47, 0.44) * (windBand - 0.5) * ${headwater ? "0.022" : river ? "0.035" : lake ? "0.0" : "0.055"};
        color += vec3(0.72, 0.74, 0.65) * glint * ${headwater ? "0.02" : river ? "0.055" : lake ? "0.012" : "0.06"};
        float opacity = mix(${headwater ? "0.8, 0.92" : river ? "mix(0.74, 0.69, riverMouth), mix(0.92, 0.9, riverMouth)" : lake ? "0.61, 0.92" : "0.66, 0.88"}, fresnel) * mix(${headwater ? "0.72" : river ? "mix(0.68, 0.7, riverMouth)" : lake ? "0.62" : "0.72"}, 1.0, bankSoftening) * ${river ? "mix(1.0, 0.72, riverMouth)" : "1.0"};
        gl_FragColor = vec4(color, opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  material.name = headwater
    ? "Madagin v1.16 dark incised headwater"
    : river
      ? "Madagin v1.16 darker directional river water"
      : "Madagin v1.17 atmospheric Fresnel watershed";
  return material;
}

function createWaterfallMaterial() {
  const material = new ShaderMaterial({
    depthTest: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: true,
    transparent: true,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorld;
      varying vec2 vFallUv;
      void main() {
        vec3 p = position;
        p.x += sin(position.y * 0.19 + uTime * 1.7) * 0.18;
        p.z += sin(position.y * 0.11 - uTime * 1.15 + position.x * 0.31) * 0.16;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        vFallUv = uv;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vWorld;
      varying vec2 vFallUv;
      float fallHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float fallNoise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(fallHash(i), fallHash(i + vec2(1.0, 0.0)), f.x),
          mix(fallHash(i + vec2(0.0, 1.0)), fallHash(i + vec2(1.0)), f.x), f.y);
      }
      void main() {
        vec2 flowUv = vec2(vWorld.x * 0.31, -vWorld.y * 0.075);
        float verticalFlow = fallNoise(flowUv + vec2(0.0, -uTime * 0.78));
        float fineThreads = fallNoise(flowUv * vec2(2.7, 2.2) + vec2(8.7, -uTime * 1.35));
        float crossFlow = sin(-vWorld.y * 0.72 - uTime * 7.2 + fineThreads * 3.2) * 0.5 + 0.5;
        float body = smoothstep(0.26, 0.79, verticalFlow * 0.62 + fineThreads * 0.28 + crossFlow * 0.1);
        float breakup = smoothstep(0.18, 0.66, fallNoise(flowUv * vec2(1.2, 3.4) + vec2(uTime * 0.08, -uTime * 1.1)));
        float edgeNoise = fallNoise(vec2(vFallUv.y * 11.0, uTime * 0.12)) * 0.028;
        float edge = smoothstep(0.0, 0.045 + edgeNoise, vFallUv.x)
          * smoothstep(0.0, 0.045 + edgeNoise, 1.0 - vFallUv.x);
        vec3 geometricNormal = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
        vec3 viewDirection = normalize(cameraPosition - vWorld);
        float faceLight = 0.58 + abs(dot(geometricNormal, normalize(vec3(-0.52, 0.58, 0.63)))) * 0.42;
        float fresnel = pow(1.0 - abs(dot(geometricNormal, viewDirection)), 2.2);
        float aeration = smoothstep(0.2, 0.92, vFallUv.y) * (0.32 + body * 0.68);
        float alpha = edge * (0.17 + body * 0.52 + aeration * 0.2) * mix(0.72, 1.0, breakup);
        vec3 deepWater = vec3(0.055, 0.16, 0.18);
        vec3 whiteWater = vec3(0.78, 0.89, 0.88);
        vec3 color = mix(deepWater, whiteWater, body * 0.52 + crossFlow * 0.1 + aeration * 0.24 + fresnel * 0.1);
        color *= faceLight;
        if (alpha < 0.055) discard;
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  material.name = "Madagin v1.17 broad aerated waterfall";
  return material;
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function waterfallCurtainWindow(progress: number, start: number, peak: number, end: number) {
  if (progress <= start || progress >= end) return 0;
  return progress <= peak
    ? smoothRange(start, peak, progress)
    : 1 - smoothRange(peak, end, progress);
}

function waterfallCurtainState(progress: number) {
  const upperFan = waterfallCurtainWindow(progress, 0.2, 0.34, 0.5);
  const lowerFan = waterfallCurtainWindow(progress, 0.52, 0.68, 0.86);
  const waist = waterfallCurtainWindow(progress, 0.43, 0.51, 0.6);
  return {
    fan: Math.max(0, upperFan * 3.8 + lowerFan * 2.65 - waist * 1.1),
    lowerFan,
    upperFan,
    waist,
  };
}

function createCumulativeWaterfallGeometry() {
  const columns = 34;
  const rows = 64;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= rows; row += 1) {
    const progress = row / rows;
    const curtain = waterfallCurtainState(progress);
    const drop = Math.pow(progress, 1.04);
    const y = WATERFALL_TOP.y + (WATERFALL_BOTTOM.y - WATERFALL_TOP.y) * drop;
    const centerX = WATERFALL_TOP.x + (WATERFALL_BOTTOM.x - WATERFALL_TOP.x) * Math.pow(progress, 1.18)
      + Math.sin(progress * 7.2 + 0.2) * (0.55 + progress * 0.5);
    const centerZ = WATERFALL_TOP.z + (WATERFALL_BOTTOM.z - WATERFALL_TOP.z) * Math.pow(progress, 1.42)
      + Math.sin(progress * 6.1) * 0.42;
    const halfWidth = 7.2 + progress * 8.1 + Math.sin(progress * 8.7 + 0.6) * (0.5 + progress * 0.42)
      + curtain.fan * 1.28;
    for (let column = 0; column <= columns; column += 1) {
      const horizontal = column / columns;
      const across = horizontal * 2 - 1;
      const brokenEdge = 0.94 + Math.sin(progress * 12.0 + across * 3.4)
        * (0.052 + curtain.upperFan * 0.022 + curtain.lowerFan * 0.016);
      const thread = Math.sin(column * 1.91 + progress * 19.0) * (0.16 + progress * 0.14);
      const bankFan = Math.max(0, across) * curtain.upperFan * 1.55
        + Math.max(0, -across) * curtain.lowerFan * 1.15;
      const braidDepth = Math.sin(across * 7.6 + progress * 12.4)
        * (0.18 + curtain.upperFan * 0.42 + curtain.lowerFan * 0.34);
      const runnelDepth = Math.sin(across * 13.2 - progress * 18.1) * (0.08 + progress * 0.08);
      const faceCurvature = across * across * (0.72 + progress * 1.35 + curtain.fan * 0.22);
      const z = centerZ + faceCurvature + Math.sin(progress * 6.1 + across * 2.5) * 0.28
        + thread + braidDepth + runnelDepth;
      positions.push(centerX + across * (halfWidth + bankFan) * brokenEdge, y, z);
      uvs.push(horizontal, progress);
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
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.name = "Madagin v1.16 curved connected waterfall body";
  geometry.userData.waterfallBody = {
    columns,
    rows,
    bottom: WATERFALL_BOTTOM,
    top: WATERFALL_TOP,
    curtainFans: [
      { favoredBank: "positive-x", maximumAddedHalfWidthMeters: 5.35, progressRange: [0.2, 0.5] },
      { favoredBank: "negative-x", maximumAddedHalfWidthMeters: 3.8, progressRange: [0.52, 0.86] },
    ],
    centralSpineContinuous: true,
    constriction: { maximumHalfWidthReductionMeters: 1.1, progressRange: [0.43, 0.6] },
    connectedGeometry: true,
    detachedGeometry: false,
    topology: "continuous two-fan braided curtain with asymmetric bank spread and cross-flow depth",
  };
  return geometry;
}

function createSecondaryWaterfallGeometry() {
  const columns = 12;
  const rows = 52;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= rows; row += 1) {
    const progress = row / rows;
    const fallProgress = 0.08 + progress * 0.92;
    const curtain = waterfallCurtainState(fallProgress);
    const y = WATERFALL_TOP.y + (WATERFALL_BOTTOM.y - WATERFALL_TOP.y) * fallProgress;
    const centerX = WATERFALL_TOP.x + (WATERFALL_BOTTOM.x - WATERFALL_TOP.x) * Math.pow(fallProgress, 1.14)
      - 7.2 + Math.sin(fallProgress * 12.0) * 1.1;
    const centerZ = WATERFALL_TOP.z + (WATERFALL_BOTTOM.z - WATERFALL_TOP.z) * Math.pow(fallProgress, 1.38)
      + 2.1 + Math.sin(fallProgress * 8.3) * 0.48;
    const halfWidth = 2.5 + progress * 1.8 + Math.sin(progress * 9.1) * 0.38 + curtain.fan * 0.32;
    for (let column = 0; column <= columns; column += 1) {
      const horizontal = column / columns;
      const across = horizontal * 2 - 1;
      positions.push(
        centerX + across * halfWidth,
        y,
        centerZ + across * across * (0.42 + progress * 0.72) + Math.sin(column * 1.7 + progress * 16.0) * 0.14,
      );
      uvs.push(horizontal, progress);
    }
  }
  const stride = columns + 1;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
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
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.name = "Madagin v1.16 broken secondary waterfall sheet";
  return geometry;
}

function createWaterfallUpperStreamGeometry(longitudinalSegments: number, acrossSegments: number) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= longitudinalSegments; row += 1) {
    const progress = row / longitudinalSegments;
    const z = WATERFALL_HEADWATER_START_Z + progress * Math.abs(WATERFALL_HEADWATER_START_Z + 730);
    const center = waterfallUpperCenter(z);
    const level = waterfallUpperLevel(z) + 0.075;
    for (let column = 0; column <= acrossSegments; column += 1) {
      const horizontal = column / acrossSegments;
      const across = horizontal * 2 - 1;
      const bankWidth = waterfallUpperBankWidth(z, across < 0 ? -1 : 1);
      const crossSection = 1 - across * across;
      const bedRoughness = Math.sin(progress * Math.PI * 18 + across * 4.1) * 0.035
        + Math.sin(progress * Math.PI * 7.4 - across * 6.2) * 0.018;
      positions.push(
        center + across * bankWidth,
        level + crossSection * 0.07 + bedRoughness,
        z + across * across * 0.22 + Math.sin(progress * Math.PI * 11.0 + across * 2.6) * 0.11,
      );
      uvs.push(horizontal, progress);
    }
  }
  const stride = acrossSegments + 1;
  for (let row = 0; row < longitudinalSegments; row += 1) {
    for (let column = 0; column < acrossSegments; column += 1) {
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
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.name = "Madagin v1.16 terrain-following waterfall source channel";
  geometry.userData.headwaterChannel = {
    method: "shared irregular banks, graded riffles, and an incised source taper",
    zRange: [WATERFALL_HEADWATER_START_Z, WATERFALL_TOP.z],
    lipHalfWidth: waterfallUpperHalfWidth(WATERFALL_TOP.z),
    sourceHalfWidth: waterfallUpperHalfWidth(WATERFALL_HEADWATER_START_Z),
  };
  return geometry;
}

function createWaterfallPlungeGeometry(angularSegments: number, radialSegments: number) {
  const positions: number[] = [PLUNGE_POOL_CENTER.x, WATERFALL_BOTTOM.y - 0.35, PLUNGE_POOL_CENTER.z];
  const uvs: number[] = [0.5, 0.5];
  const indices: number[] = [];
  for (let ring = 1; ring <= radialSegments; ring += 1) {
    const radius = Math.pow(ring / radialSegments, 0.88);
    for (let segment = 0; segment < angularSegments; segment += 1) {
      const angle = segment / angularSegments * Math.PI * 2;
      const irregular = 1 + Math.sin(angle * 3 + 0.6) * 0.085 + Math.sin(angle * 7 - 0.9) * 0.035;
      const x = PLUNGE_POOL_CENTER.x + Math.cos(angle) * 39 * radius * irregular;
      const z = PLUNGE_POOL_CENTER.z + Math.sin(angle) * 24 * radius * irregular;
      positions.push(x, WATERFALL_BOTTOM.y - 0.35 - radius * 0.18, z);
      uvs.push(0.5 + Math.cos(angle) * radius * 0.5, 0.5 + Math.sin(angle) * radius * 0.5);
    }
  }
  for (let segment = 0; segment < angularSegments; segment += 1) {
    indices.push(0, 1 + segment, 1 + ((segment + 1) % angularSegments));
  }
  for (let ring = 1; ring < radialSegments; ring += 1) {
    const current = 1 + (ring - 1) * angularSegments;
    const next = current + angularSegments;
    for (let segment = 0; segment < angularSegments; segment += 1) {
      const following = (segment + 1) % angularSegments;
      indices.push(current + segment, next + segment, current + following, current + following, next + segment, next + following);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.name = "Madagin v1.16 irregular integrated plunge pool";
  return geometry;
}

function createWaterfallOutflowGeometry(longitudinalSegments: number, acrossSegments: number) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= longitudinalSegments; row += 1) {
    const progress = row / longitudinalSegments;
    const center = waterfallOutflowCenter(progress);
    const before = waterfallOutflowCenter(Math.max(0, progress - 0.01));
    const after = waterfallOutflowCenter(Math.min(1, progress + 0.01));
    const tangentX = after.x - before.x;
    const tangentZ = after.z - before.z;
    const tangentLength = Math.max(0.0001, Math.hypot(tangentX, tangentZ));
    const normalX = -tangentZ / tangentLength;
    const normalZ = tangentX / tangentLength;
    const confluenceTaper = 1 - smoothRange(0.72, 1, progress) * 0.86;
    const halfWidth = (8.8 + Math.sin(progress * 10.4 + 0.5) * 0.75 + progress * 1.9) * confluenceTaper;
    const mergeLevel = v116WatershedHeight(-757) + 0.58;
    const level = WATERFALL_BOTTOM.y - 0.38 + (mergeLevel - WATERFALL_BOTTOM.y + 0.38) * smoothCoastalStep(progress);
    for (let column = 0; column <= acrossSegments; column += 1) {
      const horizontal = column / acrossSegments;
      const across = horizontal * 2 - 1;
      const breakup = Math.sin(progress * 17.0 + across * 4.2) * 0.24;
      positions.push(
        center.x + normalX * across * halfWidth,
        level + breakup * 0.08,
        center.z + normalZ * across * halfWidth + breakup,
      );
      uvs.push(horizontal, progress);
    }
  }
  const stride = acrossSegments + 1;
  for (let row = 0; row < longitudinalSegments; row += 1) {
    for (let column = 0; column < acrossSegments; column += 1) {
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
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.name = "Madagin v1.16 connected plunge outflow";
  geometry.userData.outflowJoin = {
    method: "plunge outflow merges into the main river before its lake boundary",
    riverCenter: [v116RiverCenter(-757), v116WatershedHeight(-757) + 0.58, -757],
  };
  return geometry;
}

function WaterfallMist({ reducedMotion, tier }: { reducedMotion: boolean; tier: WorldQualityTier }) {
  const sprayRef = useRef<Points<BufferGeometry, ShaderMaterial> | null>(null);
  const count = tier === "high" ? 620 : tier === "balanced" ? 420 : 140;
  const geometry = useMemo(() => {
    const random = seededRandom(116880214);
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const sizes = new Float32Array(count);
    const impacts = new Float32Array(count);
    let impactCount = 0;
    for (let index = 0; index < count; index += 1) {
      const impact = index < Math.floor(count * 0.84);
      const angle = random() * Math.PI * 2;
      const radius = impact ? random() ** 0.72 * 20 : random() * 5.2;
      const fallProgress = random();
      const fallX = WATERFALL_TOP.x + (WATERFALL_BOTTOM.x - WATERFALL_TOP.x) * Math.pow(fallProgress, 1.18);
      const fallY = WATERFALL_TOP.y + (WATERFALL_BOTTOM.y - WATERFALL_TOP.y) * fallProgress;
      const fallZ = WATERFALL_TOP.z + (WATERFALL_BOTTOM.z - WATERFALL_TOP.z) * Math.pow(fallProgress, 1.42);
      positions[index * 3] = impact
        ? PLUNGE_POOL_CENTER.x + Math.cos(angle) * radius
        : fallX + Math.cos(angle) * radius;
      positions[index * 3 + 1] = impact ? WATERFALL_BOTTOM.y + random() ** 2.05 * 9.5 : fallY + (random() - 0.5) * 3.6;
      positions[index * 3 + 2] = impact
        ? PLUNGE_POOL_CENTER.z + Math.sin(angle) * radius * 0.48
        : fallZ + (random() - 0.5) * 3.4;
      phases[index] = random() * Math.PI * 2;
      sizes[index] = impact ? 5.2 + random() * 8.2 : 3.2 + random() * 5.4;
      impacts[index] = impact ? 1 : 0;
      if (impact) impactCount += 1;
    }
    const result = new BufferGeometry();
    result.setAttribute("position", new Float32BufferAttribute(positions, 3));
    result.setAttribute("sprayPhase", new Float32BufferAttribute(phases, 1));
    result.setAttribute("spraySize", new Float32BufferAttribute(sizes, 1));
    result.setAttribute("sprayImpact", new Float32BufferAttribute(impacts, 1));
    result.computeBoundingSphere();
    result.userData.waterfallSpray = {
      fallingThreadCount: count - impactCount,
      impactMistCount: impactCount,
      method: "seeded anisotropic impact mist plus falling aerated threads",
      pointCount: count,
    };
    return result;
  }, [count]);
  const material = useMemo(() => new ShaderMaterial({
    depthWrite: false,
    transparent: true,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float sprayPhase;
      attribute float spraySize;
      attribute float sprayImpact;
      uniform float uTime;
      varying float vAlpha;
      varying float vImpact;
      varying float vPhase;
      void main() {
        vec3 moved = position;
        float age = fract(sprayPhase * 0.159 + uTime * 0.065);
        if (sprayImpact > 0.5) {
          moved.x += cos(sprayPhase + uTime * 0.18) * age * 5.8;
          moved.y += age * 5.4 - age * age * 1.7;
          moved.z += sin(sprayPhase * 1.37 + uTime * 0.14) * age * 2.8;
        } else {
          moved.x += sin(sprayPhase + uTime * 0.34) * age * 1.35;
          moved.y -= age * 9.2;
          moved.z += cos(sprayPhase * 1.7 + uTime * 0.25) * age * 1.1;
        }
        vec4 mvPosition = modelViewMatrix * vec4(moved, 1.0);
        gl_PointSize = spraySize * mix(300.0, 500.0, sprayImpact) / max(1.0, -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
        vAlpha = sin(age * 3.14159265) * mix(0.24, 0.32, sprayImpact);
        vImpact = sprayImpact;
        vPhase = sprayPhase;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying float vImpact;
      varying float vPhase;
      void main() {
        vec2 point = gl_PointCoord - 0.5;
        float rotation = vImpact > 0.5 ? vPhase * 0.18 : vPhase * 0.07;
        mat2 turn = mat2(cos(rotation), -sin(rotation), sin(rotation), cos(rotation));
        vec2 rotated = turn * point;
        vec2 anisotropic = vImpact > 0.5
          ? rotated * vec2(0.68, 1.6)
          : rotated * vec2(2.0, 0.68);
        float soft = 1.0 - smoothstep(0.08, 0.5, length(anisotropic));
        float breakup = 0.88 + sin((rotated.x - rotated.y) * 19.0 + vPhase * 2.1) * 0.12;
        float alpha = soft * breakup * vAlpha;
        if (alpha < 0.012) discard;
        vec3 mistColor = mix(vec3(0.52, 0.68, 0.7), vec3(0.72, 0.84, 0.84), soft);
        gl_FragColor = vec4(mistColor, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  }), []);
  useFrame(({ clock }) => {
    if (sprayRef.current) sprayRef.current.material.uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime;
  });
  useEffect(() => {
    const host = window as Window & { __MADAGIN_WATERFALL_SPRAY_V116__?: Record<string, unknown> };
    const evidence = geometry.userData.waterfallSpray as Record<string, unknown>;
    host.__MADAGIN_WATERFALL_SPRAY_V116__ = evidence;
    document.documentElement.dataset.madaginWaterfallSprayV116 = JSON.stringify(evidence);
    return () => {
      if (host.__MADAGIN_WATERFALL_SPRAY_V116__ === evidence) {
        delete host.__MADAGIN_WATERFALL_SPRAY_V116__;
        delete document.documentElement.dataset.madaginWaterfallSprayV116;
      }
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);
  return <points geometry={geometry} material={material} ref={sprayRef} renderOrder={10} />;
}

function createImpactFoamMaterial() {
  return new ShaderMaterial({
    depthWrite: false,
    side: DoubleSide,
    toneMapped: true,
    transparent: true,
    uniforms: { uTime: { value: 0 } },
    vertexShader: "varying vec2 vFoamUv; void main(){vFoamUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader: `
      uniform float uTime;
      varying vec2 vFoamUv;
      void main() {
        vec2 p = vFoamUv - 0.5;
        float radius = length(p * vec2(1.0, 1.55));
        float turbulenceA = sin(p.x * 46.0 + p.y * 17.0 + uTime * 1.8) * 0.5 + 0.5;
        float turbulenceB = sin(p.y * 53.0 - p.x * 21.0 - uTime * 1.25) * 0.5 + 0.5;
        float brokenArc = smoothstep(0.07, 0.0, abs(radius - 0.27 - sin(atan(p.y, p.x) * 4.0 + uTime * 0.42) * 0.035));
        float impact = 1.0 - smoothstep(0.05, 0.29, radius);
        float edge = 1.0 - smoothstep(0.34, 0.52, radius);
        float alpha = edge * (impact * (0.16 + turbulenceA * turbulenceB * 0.2) + brokenArc * 0.16);
        if (alpha < 0.018) discard;
        gl_FragColor = vec4(0.64, 0.8, 0.8, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

// Retained for comparison with rejected Candidate M; mounting it produced a
// visibly stacked rock border instead of a credible weathered cliff edge.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function WaterfallRockFrame({ shadows, tier }: { shadows: boolean; tier: WorldQualityTier }) {
  const gltf = useLoader(GLTFLoader, `${ASSET_ROOT}/rock_09/rock_09_1k.gltf`);
  const source = useMemo(() => {
    gltf.scene.updateMatrixWorld(true);
    let match: Mesh | null = null;
    gltf.scene.traverse((child) => {
      if (!match && child instanceof Mesh) match = child;
    });
    return match as Mesh | null;
  }, [gltf.scene]);
  const count = tier === "high" ? 24 : tier === "balanced" ? 18 : 12;
  const ref = useRef<InstancedMesh>(null);
  const material = useMemo(() => {
    if (!source) return new MeshStandardMaterial({ color: "#26312c", roughness: 0.96 });
    const originals = Array.isArray(source.material) ? source.material : [source.material];
    const prepared = originals.map((original) => {
      const result = (original as MeshStandardMaterial).clone();
      result.color.multiply(new Color("#abb3ab"));
      result.emissive.set("#101714");
      result.emissiveIntensity = 0.12;
      result.metalness = 0;
      result.roughness = 0.96;
      return result;
    });
    return Array.isArray(source.material) ? prepared : prepared[0];
  }, [source]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh || !source) return;
    const dummy = new Object3D();
    const matrix = new Matrix4();
    const edgeCount = Math.min(8, count);
    for (let index = 0; index < count; index += 1) {
      if (index < edgeCount) {
        const lip = index < 4;
        const localIndex = lip ? index : index - 4;
        const side = localIndex % 2 === 0 ? -1 : 1;
        dummy.position.set(
          lip ? 148 + localIndex * 12.5 : 167 + side * (19 + localIndex * 0.8),
          lip ? 18.4 + Math.sin(localIndex * 1.7) * 0.8 : -7 - Math.floor(localIndex / 2) * 23,
          -727.8 + Math.sin(index * 1.71) * 1.2,
        );
        dummy.scale.set(52 + (index % 3) * 8, 42 + (index % 2) * 7, 48 + ((index + 2) % 4) * 6);
        dummy.rotation.set(index * 0.37, side * 0.62 + index * 0.43, index * 0.21);
      } else {
        const poolIndex = index - edgeCount;
        const poolCount = count - edgeCount;
        const angle = (poolIndex / Math.max(1, poolCount)) * Math.PI * 2 + 0.3;
        dummy.position.set(167 + Math.cos(angle) * 25, -42.4, -716 + Math.sin(angle) * 11.5);
        dummy.scale.set(58 + (poolIndex % 3) * 10, 38 + (poolIndex % 2) * 8, 55 + ((poolIndex + 1) % 4) * 7);
        dummy.rotation.set(poolIndex * 0.41, angle + 0.6, poolIndex * 0.23);
      }
      dummy.updateMatrix();
      matrix.multiplyMatrices(dummy.matrix, source.matrixWorld);
      mesh.setMatrixAt(index, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  }, [count, source]);
  useEffect(() => () => {
    (Array.isArray(material) ? material : [material]).forEach((candidate) => candidate.dispose());
  }, [material]);
  if (!source) return null;
  return (
    <instancedMesh
      args={[source.geometry, material, count]}
      castShadow={shadows}
      receiveShadow
      ref={ref}
    />
  );
}

function v116RiverConfluenceProgress(z: number) {
  return 1 - smoothRange(-792, -724, z);
}

function v116RiverBaseCenter(z: number) {
  const progress = Math.min(1, Math.max(0, (-315 - z) / 1395));
  return 34
    + Math.sin((z + 85) * 0.0085) * (34 + progress * 108)
    + Math.sin(z * 0.021) * 16
    + Math.sin(z * 0.053 + 0.6) * 4.5
    + Math.sin(z * 0.127 - 0.3) * 1.4;
}

function v116RiverCenter(z: number) {
  const confluence = v116RiverConfluenceProgress(z);
  return v116RiverBaseCenter(z)
    + confluence * (
      Math.sin((z + 752) * 0.052) * 2.4
      + Math.sin((z + 781) * 0.11) * 0.75
    );
}

function v116RiverSourceFade(z: number) {
  return 0.035 + (1 - smoothRange(-388, -313, z)) * 0.965;
}

function v116RiverBaseHalfWidth(z: number) {
  const progress = Math.min(1, Math.max(0, (-315 - z) / 480));
  return (4.7 + progress * 6.9
    + Math.sin(z * 0.037 + 0.8) * (0.58 + progress * 0.34)
    + Math.sin(z * 0.091 - 1.2) * 0.28) * v116RiverSourceFade(z);
}

function v116RiverHalfWidth(z: number) {
  const confluence = v116RiverConfluenceProgress(z);
  const baseWidth = v116RiverBaseHalfWidth(z);
  const inletFlare = 1 + confluence * (
    0.62
    + Math.sin((z + 777) * 0.055) * 0.08
  );
  return baseWidth * inletFlare;
}

function v116WatershedHeight(z: number) {
  if (z >= -315) return 8.57;
  const tropicalProgress = Math.min(1, Math.max(0, (-315 - z) / 665));
  const gradeBlend = smoothCoastalStep(Math.min(1, tropicalProgress / 0.2));
  const tropicalLevel = 7.95 * (1 - gradeBlend) + (-34 - tropicalProgress * 18) * gradeBlend + 0.9;
  if (z >= -980) {
    // The project-authored centerline first crosses the irregular lake boundary
    // at z≈-777. Ease the final reach onto the lake plane before that crossing;
    // the former unbroken grade arrived about 2.8 m high and read as a clear
    // translucent step where the two live water surfaces overlapped.
    const lakeJoin = 1 - smoothRange(-777, -744, z);
    const connectedBedLevel = LAKE_WATER_LEVEL - 0.58;
    return tropicalLevel * (1 - lakeJoin) + connectedBedLevel * lakeJoin;
  }
  const alpineProgress = Math.min(1, Math.max(0, (-980 - z) / 730));
  return -51.1 - alpineProgress * 4;
}

function v116RiverEdgeX(z: number, across: number) {
  const edgeBreakup = 1
    + Math.sin(z * 0.067 + across * 2.8) * 0.035 * Math.pow(Math.abs(across), 1.7)
    + Math.sin(z * 0.139 - across * 4.1) * 0.016 * Math.pow(Math.abs(across), 2.2);
  return v116RiverCenter(z) + across * v116RiverHalfWidth(z) * edgeBreakup;
}

function v116RiverLakeJoinZ(across: number) {
  let outside = -742;
  let inside = -812;
  for (let iteration = 0; iteration < 18; iteration += 1) {
    const middle = (outside + inside) * 0.5;
    if (lakeBoundaryDistance(v116RiverEdgeX(middle, across), middle) > 1) {
      outside = middle;
    } else {
      inside = middle;
    }
  }
  // Use the lake surface's structural edge overlap for coverage: the banks
  // stop just outside the analytic line while the centre reaches only half a
  // metre inside it. That keeps the inlet rounded without coplanar overlap.
  return inside + 1.25 - (1 - Math.abs(across)) * 1.75;
}

function createIntegratedRiverGeometry(samples: number, columns: number) {
  const geometry = new BufferGeometry();
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const lakeJoinZ = Array.from({ length: columns + 1 }, (_, column) => (
    v116RiverLakeJoinZ((column / columns) * 2 - 1)
  ));
  for (let row = 0; row < samples; row += 1) {
    const progress = row / (samples - 1);
    for (let column = 0; column <= columns; column += 1) {
      const horizontal = column / columns;
      const across = horizontal * 2 - 1;
      const z = -313 + (lakeJoinZ[column] + 313) * progress;
      const joinBlend = smoothRange(0.82, 1, progress);
      const waterLevel = (v116WatershedHeight(z) + 0.58) * (1 - joinBlend) + LAKE_WATER_LEVEL * joinBlend;
      const camber = -Math.pow(Math.abs(across), 1.55) * 0.055;
      positions.push(v116RiverEdgeX(z, across), waterLevel + camber * (1 - joinBlend), z);
      uvs.push(horizontal, progress);
    }
  }
  const stride = columns + 1;
  for (let row = 0; row < samples - 1; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * stride + column;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.name = "Madagin v1.16 centerline-following irregular river surface";
  geometry.userData.riverCorridor = {
    columns,
    samples,
    source: "project-authored runtime centerline",
    vertices: positions.length / 3,
    lakeJoin: {
      elevation: LAKE_WATER_LEVEL,
      method: "shared terrain-incised asymmetric inlet flare with a rounded edge-overlap handoff on the irregular lake edge",
      flareStartZ: -724,
      maximumWidthMultiplier: 1.7,
      bankJoinOffsetMeters: 1.25,
      centrelineJoinInsetMeters: 0.5,
      zRange: [Math.min(...lakeJoinZ), Math.max(...lakeJoinZ)],
    },
    zRange: [Math.min(...lakeJoinZ), -313],
  };
  return geometry;
}

function createIntegratedLakeGeometry(angularSegments: number, radialSegments: number, edgeOverlap: number) {
  const geometry = new BufferGeometry();
  const positions: number[] = [LAKE_CENTER.x, LAKE_WATER_LEVEL, LAKE_CENTER.z];
  const uvs: number[] = [0.5, 0.5];
  const indices: number[] = [];
  for (let ring = 1; ring <= radialSegments; ring += 1) {
    const radius = Math.pow(ring / radialSegments, 0.92);
    for (let segment = 0; segment < angularSegments; segment += 1) {
      const angle = (segment / angularSegments) * Math.PI * 2;
      // A small radial overlap keeps the high-resolution water boundary over
      // the remeshed low-bank triangles. It is a topology join, not a visible
      // shoreline strip, and prevents the source grid from creating teeth.
      const edge = lakeBoundaryScale(angle) * (1 + edgeOverlap * Math.pow(radius, 4));
      const x = LAKE_CENTER.x + Math.cos(angle) * LAKE_RADIUS.x * edge * radius;
      const z = LAKE_CENTER.z + Math.sin(angle) * LAKE_RADIUS.z * edge * radius;
      positions.push(x, LAKE_WATER_LEVEL, z);
      uvs.push(
        0.5 + Math.cos(angle) * radius * 0.5,
        0.5 + Math.sin(angle) * radius * 0.5,
      );
    }
  }
  for (let segment = 0; segment < angularSegments; segment += 1) {
    indices.push(0, 1 + segment, 1 + ((segment + 1) % angularSegments));
  }
  for (let ring = 1; ring < radialSegments; ring += 1) {
    const current = 1 + (ring - 1) * angularSegments;
    const next = current + angularSegments;
    for (let segment = 0; segment < angularSegments; segment += 1) {
      const following = (segment + 1) % angularSegments;
      indices.push(
        current + segment,
        next + segment,
        current + following,
        current + following,
        next + segment,
        next + following,
      );
    }
  }
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.name = "Madagin v1.16 high-resolution irregular lake surface";
  geometry.userData.watershedSurface = {
    angularSegments,
    radialSegments,
    edgeOverlap,
    shorelineUv: "normalized analytic radial coordinate",
    shorelineVertices: angularSegments,
    replaces: "lake_basin_surface_v116",
  };
  return geometry;
}

function createIntegratedLakeBedGeometry(angularSegments: number, radialSegments: number, edgeOverlap: number) {
  const geometry = new BufferGeometry();
  const positions: number[] = [LAKE_CENTER.x, LAKE_WATER_LEVEL - 8.75, LAKE_CENTER.z];
  const indices: number[] = [];
  for (let ring = 1; ring <= radialSegments; ring += 1) {
    const radius = Math.pow(ring / radialSegments, 0.92);
    for (let segment = 0; segment < angularSegments; segment += 1) {
      const angle = (segment / angularSegments) * Math.PI * 2;
      const edge = lakeBoundaryScale(angle) * (1 + edgeOverlap * Math.pow(radius, 4));
      const depth = 0.34
        + Math.pow(1 - radius, 0.72) * 8.35
        + Math.sin(angle * 3 - 0.6) * 0.24 * (1 - radius)
        + Math.sin(angle * 7 + radius * 4.2) * 0.1 * Math.pow(1 - radius, 0.6);
      positions.push(
        LAKE_CENTER.x + Math.cos(angle) * LAKE_RADIUS.x * edge * radius,
        LAKE_WATER_LEVEL - depth,
        LAKE_CENTER.z + Math.sin(angle) * LAKE_RADIUS.z * edge * radius,
      );
    }
  }
  for (let segment = 0; segment < angularSegments; segment += 1) {
    indices.push(0, 1 + segment, 1 + ((segment + 1) % angularSegments));
  }
  for (let ring = 1; ring < radialSegments; ring += 1) {
    const current = 1 + (ring - 1) * angularSegments;
    const next = current + angularSegments;
    for (let segment = 0; segment < angularSegments; segment += 1) {
      const following = (segment + 1) % angularSegments;
      indices.push(
        current + segment,
        next + segment,
        current + following,
        current + following,
        next + segment,
        next + following,
      );
    }
  }
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.name = "Madagin v1.16 continuous irregular lake basin bed";
  geometry.userData.watershedBed = {
    angularSegments,
    depthRangeMeters: [0.34, 8.75],
    edgeOverlap,
    method: "continuous deepened asymmetric radial basin above the carved source terrain",
    radialSegments,
    shorelineVertices: angularSegments,
  };
  return geometry;
}

function WaterNetwork({ mobile, reducedMotion, shadows, tier, zone }: { mobile: boolean; reducedMotion: boolean; shadows: boolean; tier: WorldQualityTier; zone: JourneyCheckpointId }) {
  // The complete hydrological chain stays resident from the first Ridge frame;
  // chapter visibility is determined by geography and camera occlusion rather
  // than mounting the headwater only after the visitor has reached it.
  const waterfallVisible = true;
  const gltf = useLoader(GLTFLoader, `${ROOT}/water-lake-waterfall-v1.16.glb`, configureCompressedGltf);
  const activeWaterMaterial = useRef<ShaderMaterial | null>(null);
  const activePoolMaterial = useRef<ShaderMaterial | null>(null);
  const activeRiverMaterial = useRef<ShaderMaterial | null>(null);
  const activeHeadwaterMaterial = useRef<ShaderMaterial | null>(null);
  const activeWaterfallMaterial = useRef<ShaderMaterial | null>(null);
  const activeImpactMaterial = useRef<ShaderMaterial | null>(null);
  const waterMaterial = useMemo(() => createWaterMaterial(), []);
  const poolMaterial = useMemo(() => createWaterMaterial("pool"), []);
  const riverMaterial = useMemo(() => createWaterMaterial("river"), []);
  const headwaterMaterial = useMemo(() => createWaterMaterial("headwater"), []);
  const waterfallMaterial = useMemo(() => createWaterfallMaterial(), []);
  const impactMaterial = useMemo(() => createImpactFoamMaterial(), []);
  const waterfallGeometry = useMemo(() => createCumulativeWaterfallGeometry(), []);
  const waterfallSecondaryGeometry = useMemo(() => createSecondaryWaterfallGeometry(), []);
  const waterfallUpperGeometry = useMemo(
    () => createWaterfallUpperStreamGeometry(mobile ? 42 : tier === "high" ? 92 : 68, mobile ? 6 : 10),
    [mobile, tier],
  );
  const waterfallPlungeGeometry = useMemo(
    () => createWaterfallPlungeGeometry(mobile ? 72 : tier === "high" ? 144 : 108, mobile ? 8 : 14),
    [mobile, tier],
  );
  const waterfallOutflowGeometry = useMemo(
    () => createWaterfallOutflowGeometry(mobile ? 36 : tier === "high" ? 84 : 62, mobile ? 5 : 8),
    [mobile, tier],
  );
  const lakeGeometry = useMemo(
    () => createIntegratedLakeGeometry(
      mobile ? 320 : tier === "high" ? 320 : 256,
      mobile ? 18 : tier === "high" ? 42 : 34,
      mobile ? 0.014 : 0.009,
    ),
    [mobile, tier],
  );
  const lakeBedGeometry = useMemo(
    () => createIntegratedLakeBedGeometry(
      mobile ? 320 : tier === "high" ? 320 : 256,
      mobile ? 18 : tier === "high" ? 42 : 34,
      mobile ? 0.014 : 0.009,
    ),
    [mobile, tier],
  );
  const lakeBedMaterial = useMemo(() => new MeshBasicMaterial({
    color: "#101f1c",
    side: DoubleSide,
  }), []);
  const riverGeometry = useMemo(
    () => createIntegratedRiverGeometry(mobile ? 74 : tier === "high" ? 156 : 118, mobile ? 5 : tier === "high" ? 12 : 8),
    [mobile, tier],
  );
  const cliffMaterial = useMemo(() => new MeshStandardMaterial({
    color: "#ffffff",
    metalness: 0,
    roughness: 0.92,
    side: DoubleSide,
    vertexColors: true,
  }), []);
  const scene = useMemo(() => {
    const result = gltf.scene.clone(true);
    result.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const name = child.name.toLowerCase();
      if (name.includes("lake_basin_surface")) {
        child.visible = false;
        return;
      }
      if (name.includes("river_channel")) {
        child.visible = false;
        return;
      }
      if (name.includes("waterfall") && zone !== "waterfall") {
        child.visible = false;
        return;
      }
      if (name.includes("waterfall_plunge_pool") || name.includes("waterfall_upper_stream")) {
        child.visible = false;
        return;
      }
      if (name.includes("cliff")) {
        // This legacy support shell is deliberately excluded. Its simplified
        // silhouette occludes the detailed terrain and reads as a flat slab.
        child.visible = false;
        return;
      }
      if (name.includes("waterfall_sheet")) {
        child.visible = false;
        return;
      }
      if (!name.includes("waterfall_sheet")) child.geometry.computeVertexNormals();
      child.material = name.includes("waterfall_sheet") ? waterfallMaterial : name.includes("cliff") ? cliffMaterial : waterMaterial;
      if (name.includes("waterfall_sheet")) child.renderOrder = 8;
      child.receiveShadow = !name.includes("sheet");
      child.castShadow = shadows && name.includes("cliff");
    });
    return result;
  }, [cliffMaterial, gltf.scene, shadows, waterMaterial, waterfallMaterial, zone]);
  useFrame(({ clock }) => {
    const time = reducedMotion ? 0 : clock.elapsedTime;
    const waterTime = activeWaterMaterial.current?.uniforms.uTime;
    const poolTime = activePoolMaterial.current?.uniforms.uTime;
    const riverTime = activeRiverMaterial.current?.uniforms.uTime;
    const headwaterTime = activeHeadwaterMaterial.current?.uniforms.uTime;
    const waterfallTime = activeWaterfallMaterial.current?.uniforms.uTime;
    const impactTime = activeImpactMaterial.current?.uniforms.uTime;
    if (waterTime) waterTime.value = time;
    if (poolTime) poolTime.value = time;
    if (riverTime) riverTime.value = time;
    if (headwaterTime) headwaterTime.value = time;
    if (waterfallTime) waterfallTime.value = time;
    if (impactTime) impactTime.value = time;
  });
  useEffect(() => {
    activeWaterMaterial.current = waterMaterial;
    activePoolMaterial.current = poolMaterial;
    activeRiverMaterial.current = riverMaterial;
    activeHeadwaterMaterial.current = headwaterMaterial;
    activeWaterfallMaterial.current = waterfallMaterial;
    activeImpactMaterial.current = impactMaterial;
    const host = window as Window & {
      __MADAGIN_WATERFALL_LANDFORM_V116__?: unknown;
      __MADAGIN_RIVER_CORRIDOR_V116__?: unknown;
      __MADAGIN_WATERSHED_SURFACE_V116__?: unknown;
    };
    host.__MADAGIN_WATERSHED_SURFACE_V116__ = {
      ...lakeGeometry.userData.watershedSurface,
      basinBed: lakeBedGeometry.userData.watershedBed,
    };
    host.__MADAGIN_RIVER_CORRIDOR_V116__ = riverGeometry.userData.riverCorridor;
    host.__MADAGIN_WATERFALL_LANDFORM_V116__ = {
      authority: "runtime remesh of active Valley terrain plus connected project-authored water surfaces",
      body: waterfallGeometry.userData.waterfallBody,
      continuousHydrology: true,
      networkOrder: ["headwater", "waterfall lip", "waterfall body", "plunge pool", "outflow", "main river", "lake inlet", "lake", "coastal outlet", "ocean"],
      outflowJoin: waterfallOutflowGeometry.userData.outflowJoin,
      outflowVertices: waterfallOutflowGeometry.getAttribute("position").count,
      plungeVertices: waterfallPlungeGeometry.getAttribute("position").count,
      secondarySheetVertices: waterfallSecondaryGeometry.getAttribute("position").count,
      sourceChannelVertices: waterfallUpperGeometry.getAttribute("position").count,
      sourceChannel: waterfallUpperGeometry.userData.headwaterChannel,
      replaces: ["waterfall_upper_stream_v116", "waterfall_plunge_pool_v116", "flat impact rings"],
    };
    document.documentElement.dataset.madaginWatershedSurfaceV116 = JSON.stringify(host.__MADAGIN_WATERSHED_SURFACE_V116__);
    document.documentElement.dataset.madaginRiverCorridorV116 = JSON.stringify(host.__MADAGIN_RIVER_CORRIDOR_V116__);
    document.documentElement.dataset.madaginWaterfallLandformV116 = JSON.stringify(host.__MADAGIN_WATERFALL_LANDFORM_V116__);
    dispatchStage(3, "connected-waterfall-landform-and-outflow-ready", "lake");
    return () => {
      activeWaterMaterial.current = null;
      activePoolMaterial.current = null;
      activeRiverMaterial.current = null;
      activeHeadwaterMaterial.current = null;
      activeWaterfallMaterial.current = null;
      activeImpactMaterial.current = null;
      cliffMaterial.dispose();
      impactMaterial.dispose();
      lakeBedGeometry.dispose();
      lakeBedMaterial.dispose();
      lakeGeometry.dispose();
      poolMaterial.dispose();
      riverGeometry.dispose();
      riverMaterial.dispose();
      headwaterMaterial.dispose();
      waterfallMaterial.dispose();
      waterfallGeometry.dispose();
      waterfallOutflowGeometry.dispose();
      waterfallPlungeGeometry.dispose();
      waterfallSecondaryGeometry.dispose();
      waterfallUpperGeometry.dispose();
      waterMaterial.dispose();
    };
  }, [
    cliffMaterial,
    impactMaterial,
    headwaterMaterial,
    lakeBedGeometry,
    lakeBedMaterial,
    lakeGeometry,
    mobile,
    poolMaterial,
    riverGeometry,
    riverMaterial,
    waterfallGeometry,
    waterfallMaterial,
    waterfallOutflowGeometry,
    waterfallPlungeGeometry,
    waterfallSecondaryGeometry,
    waterfallUpperGeometry,
    waterMaterial,
    tier,
  ]);
  return (
    <group name="Madagin v1.16 connected watershed and remeshed waterfall landform">
      <mesh geometry={lakeBedGeometry} material={lakeBedMaterial} name="Madagin v1.16 continuous irregular lake basin bed" receiveShadow />
      <mesh geometry={lakeGeometry} material={waterMaterial} name="Madagin v1.16 integrated irregular lake surface" />
      <mesh geometry={riverGeometry} material={riverMaterial} name="Madagin v1.16 centerline-following irregular river surface" />
      <primitive object={scene} />
      {waterfallVisible ? (
        <>
          <mesh geometry={waterfallUpperGeometry} material={headwaterMaterial} name="Madagin v1.16 terrain-following waterfall source" />
          <mesh geometry={waterfallGeometry} material={waterfallMaterial} name="Madagin v1.16 curved connected waterfall body" renderOrder={8} />
          <mesh geometry={waterfallSecondaryGeometry} material={waterfallMaterial} name="Madagin v1.16 broken secondary waterfall sheet" renderOrder={8} />
          <mesh geometry={waterfallPlungeGeometry} material={poolMaterial} name="Madagin v1.16 integrated plunge pool" />
          <mesh geometry={waterfallOutflowGeometry} material={riverMaterial} name="Madagin v1.16 connected plunge outflow" />
          <mesh material={impactMaterial} position={[PLUNGE_POOL_CENTER.x, WATERFALL_BOTTOM.y - 0.12, PLUNGE_POOL_CENTER.z]} renderOrder={9} rotation={[-Math.PI / 2, 0, 0]} scale={[31, 17, 1]}>
            <circleGeometry args={[1, 64]} />
          </mesh>
          <WaterfallMist reducedMotion={reducedMotion} tier={tier} />
        </>
      ) : null}
    </group>
  );
}

function SkyDome({ reducedMotion }: { reducedMotion: boolean }) {
  const activeMaterial = useRef<ShaderMaterial | null>(null);
  const material = useMemo(() => new ShaderMaterial({
    depthWrite: false,
    side: BackSide,
    toneMapped: true,
    uniforms: { uTime: { value: 0 } },
    vertexShader: "varying vec3 vDirection; void main(){vDirection=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader: `
      uniform float uTime;
      varying vec3 vDirection;
      float skyHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float skyNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(skyHash(i),skyHash(i+vec2(1,0)),f.x),mix(skyHash(i+vec2(0,1)),skyHash(i+vec2(1)),f.x),f.y);}
      float skyFbm(vec2 p){float v=0.0,a=0.56;for(int i=0;i<5;i++){v+=skyNoise(p)*a;p=p*2.03+5.17;a*=0.47;}return v;}
      void main() {
        vec3 direction = normalize(vDirection);
        float h = smoothstep(-0.08, 0.82, direction.y);
        vec3 horizon = vec3(0.255, 0.455, 0.525);
        vec3 zenith = vec3(0.022, 0.125, 0.285);
        float sun = pow(max(dot(direction, normalize(vec3(-0.78, 0.24, 0.56))), 0.0), 180.0);
        vec3 sky = mix(horizon, zenith, h) + vec3(1.0, 0.48, 0.18) * sun * 0.86;
        vec2 cloudUv = direction.xz / max(0.28, 0.48 + direction.y * 0.58);
        vec2 drift = vec2(uTime * 0.0035, -uTime * 0.0017);
        float cloudMacro = skyFbm(cloudUv * 1.68 + vec2(2.8, -4.3) + drift);
        float cloudMeso = skyFbm(cloudUv * 3.9 - vec2(7.1, 1.4) - drift * 1.7);
        float cloudFine = skyFbm(cloudUv * 8.4 + vec2(1.9, 6.2) + drift * 2.3);
        float cloudBody = cloudMacro * 0.68 + cloudMeso * 0.25 + cloudFine * 0.07;
        float cloudFloor = smoothstep(-0.1, 0.11, direction.y);
        float cloud = smoothstep(0.47, 0.63, cloudBody) * cloudFloor;
        float cloudCore = smoothstep(0.57, 0.72, cloudBody);
        float sunFacing = max(dot(direction, normalize(vec3(-0.72, 0.38, 0.58))), 0.0);
        vec3 cloudShade = mix(vec3(0.52, 0.58, 0.59), vec3(0.87, 0.86, 0.8), cloudCore * 0.72 + sunFacing * 0.22);
        sky = mix(sky, cloudShade, cloud * (0.74 + cloudCore * 0.18));
        float distantBank = smoothstep(0.02, 0.2, direction.y) * (1.0 - smoothstep(0.24, 0.48, direction.y));
        sky = mix(sky, vec3(0.46, 0.575, 0.6), distantBank * smoothstep(0.46, 0.68, cloudMeso) * 0.27);
        gl_FragColor = vec4(sky, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  }), []);
  useFrame(({ clock }) => {
    const skyTime = activeMaterial.current?.uniforms.uTime;
    if (skyTime) skyTime.value = reducedMotion ? 0 : clock.elapsedTime;
  });
  useEffect(() => {
    activeMaterial.current = material;
    return () => {
      activeMaterial.current = null;
      material.dispose();
    };
  }, [material]);
  return <mesh material={material} scale={1900}><sphereGeometry args={[1, 36, 20]} /></mesh>;
}

function createCloudMaterial(opacity: number, seed: number) {
  return new ShaderMaterial({
    depthWrite: false,
    side: DoubleSide,
    toneMapped: true,
    transparent: true,
    uniforms: { uOpacity: { value: opacity }, uSeed: { value: seed }, uTime: { value: 0 } },
    vertexShader: "varying vec3 vLocal; void main(){vLocal=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader: `
      uniform float uOpacity; uniform float uSeed; uniform float uTime; varying vec3 vLocal;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
      void main(){
        vec3 q=abs(vLocal*2.0); float edge=1.0-smoothstep(0.28,1.0,max(max(q.x,q.y*1.65),q.z));
        float macro=noise(vLocal.xz*2.6+vec2(uTime*0.006,uSeed*7.1));
        float billow=noise(vLocal.xz*6.8+vLocal.xy*1.7-uSeed+vec2(uTime*0.009,0.0));
        float erosion=noise(vLocal.zy*11.6+vLocal.xz*2.1+uSeed*3.7-vec2(uTime*0.012,0.0));
        float body=macro*0.58+billow*0.29+erosion*0.13;
        float baseDensity=smoothstep(-0.48,-0.08,vLocal.y)*(1.0-smoothstep(0.16,0.5,vLocal.y));
        float alpha=edge*smoothstep(0.3,0.73,body+edge*0.24)*mix(0.76,1.0,baseDensity)*uOpacity;
        if(alpha<0.004)discard;
        float sunward=clamp(0.42+vLocal.x*0.22+vLocal.y*0.34,0.0,1.0);
        vec3 underside=vec3(0.28,0.37,0.39);
        vec3 litCloud=vec3(0.78,0.79,0.75);
        gl_FragColor=vec4(mix(underside,litCloud,clamp(body*0.63+sunward*0.31+baseDensity*0.08,0.0,1.0)),alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

function createTerrainMistMaterial(opacity: number, seed: number) {
  return new ShaderMaterial({
    depthTest: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: true,
    transparent: true,
    uniforms: { uOpacity: { value: opacity }, uSeed: { value: seed }, uTime: { value: 0 } },
    vertexShader: "varying vec3 vLocal; void main(){vLocal=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader: `
      uniform float uOpacity; uniform float uSeed; uniform float uTime; varying vec3 vLocal;
      float mistHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float mistNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mistHash(i),mistHash(i+vec2(1,0)),f.x),mix(mistHash(i+vec2(0,1)),mistHash(i+vec2(1)),f.x),f.y);}
      void main(){
        vec3 q=abs(vLocal*2.0);
        float envelope=1.0-smoothstep(0.18,1.0,max(max(q.x,q.z),q.y*2.8));
        float drift=uTime*0.008;
        float macro=mistNoise(vLocal.xz*3.4+vec2(drift,uSeed*5.7));
        float breakup=mistNoise(vLocal.zx*8.1+vLocal.xy*1.8+uSeed*2.3-vec2(drift*1.7,0.0));
        float floorFade=smoothstep(-0.48,-0.2,vLocal.y)*(1.0-smoothstep(0.1,0.5,vLocal.y));
        float alpha=envelope*smoothstep(0.27,0.7,macro*0.68+breakup*0.32)*mix(0.62,1.0,floorFade)*uOpacity;
        if(alpha<0.003)discard;
        vec3 mistColor=mix(vec3(0.34,0.43,0.43),vec3(0.68,0.73,0.7),clamp(macro*0.72+vLocal.y*0.18,0.0,1.0));
        gl_FragColor=vec4(mistColor,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

const CLOUD_BANKS = [
  { position: [-165, 112, -285] as [number, number, number], scale: [230, 38, 82] as [number, number, number], opacity: 0.19 },
  { position: [172, 68, -650] as [number, number, number], scale: [310, 48, 116] as [number, number, number], opacity: 0.23 },
  { position: [-260, 132, -980] as [number, number, number], scale: [390, 55, 148] as [number, number, number], opacity: 0.2 },
  { position: [360, 338, -1040] as [number, number, number], scale: [330, 46, 126] as [number, number, number], opacity: 0.2 },
  { position: [-515, 155, -1420] as [number, number, number], scale: [430, 39, 154] as [number, number, number], opacity: 0.1 },
  { position: [610, 215, -1545] as [number, number, number], scale: [380, 34, 128] as [number, number, number], opacity: 0.09 },
];

const TERRAIN_CONTACT_MIST_BANKS = [
  { authority: "ridge-drainage", position: [-72, 48, -205] as [number, number, number], scale: [152, 32, 54] as [number, number, number], opacity: 0.12 },
  { authority: "valley-catchment", position: [-88, 16, -720] as [number, number, number], scale: [258, 36, 88] as [number, number, number], opacity: 0.16 },
  { authority: "waterfall-plunge", position: [146, -6, -700] as [number, number, number], scale: [106, 30, 58] as [number, number, number], opacity: 0.18 },
  { authority: "lake-basin", position: [-8, -25, -888] as [number, number, number], scale: [188, 25, 68] as [number, number, number], opacity: 0.12 },
];

function V116Atmosphere({ reducedMotion, shadows, tier }: { reducedMotion: boolean; shadows: boolean; tier: WorldQualityTier }) {
  const cloudGroup = useRef<Group>(null);
  const mistGroup = useRef<Group>(null);
  const clouds = useMemo(() => CLOUD_BANKS.slice(0, tier === "conservative" ? 1 : tier === "balanced" ? 4 : 6), [tier]);
  const mistBanks = useMemo(() => tier === "conservative" ? [] : TERRAIN_CONTACT_MIST_BANKS, [tier]);
  const materials = useMemo(() => clouds.map((cloud, index) => createCloudMaterial(cloud.opacity, index + 1)), [clouds]);
  const mistMaterials = useMemo(
    () => mistBanks.map((mist, index) => createTerrainMistMaterial(mist.opacity, index + 11)),
    [mistBanks],
  );
  useFrame(({ clock }) => {
    const time = reducedMotion ? 0 : clock.elapsedTime;
    materials.forEach((material) => { material.uniforms.uTime.value = time; });
    mistMaterials.forEach((material) => { material.uniforms.uTime.value = time; });
    if (cloudGroup.current) {
      cloudGroup.current.position.x = Math.sin(time * 0.018) * 9 + time * 0.12 % 18;
      cloudGroup.current.position.z = Math.sin(time * 0.011 + 0.8) * 7;
    }
    if (mistGroup.current) {
      mistGroup.current.position.x = Math.sin(time * 0.026 + 0.5) * 2.4;
      mistGroup.current.position.z = Math.sin(time * 0.019) * 1.8;
    }
  });
  useEffect(() => {
    const host = window as Window & { __MADAGIN_TERRAIN_MIST_V120__?: Record<string, unknown> };
    host.__MADAGIN_TERRAIN_MIST_V120__ = {
      authorities: mistBanks.map((mist) => mist.authority),
      banks: mistBanks.length,
      mobileExcluded: tier === "conservative",
    };
    document.documentElement.dataset.madaginTerrainMistV120 = JSON.stringify(host.__MADAGIN_TERRAIN_MIST_V120__);
    if (mistBanks.length) dispatchStage(3, "terrain-contact-mist-ready", "valley");
    return () => {
      materials.forEach((material) => material.dispose());
      mistMaterials.forEach((material) => material.dispose());
    };
  }, [materials, mistBanks, mistMaterials, tier]);
  return (
    <group name="Madagin v1.16 single physical atmosphere and lighting authority">
      <color attach="background" args={["#4f7582"]} />
      <fogExp2 attach="fog" args={["#78969e", tier === "conservative" ? 0.00042 : 0.00046]} />
      <SkyDome reducedMotion={reducedMotion} />
      <PhysicalSkyEnvironment intensityScale={0.7} tier={tier} />
      <hemisphereLight args={["#c8dde0", "#17251e", 0.96]} />
      <ambientLight color="#758d8c" intensity={0.12} />
      <directionalLight
        castShadow={shadows}
        color="#ffd0a0"
        intensity={2.34}
        position={[-420, 280, 360]}
        shadow-bias={-0.00012}
        shadow-normalBias={0.24}
        shadow-radius={2.2}
        shadow-camera-bottom={-240}
        shadow-camera-far={920}
        shadow-camera-left={-260}
        shadow-camera-near={2}
        shadow-camera-right={260}
        shadow-camera-top={240}
        shadow-mapSize-height={tier === "high" ? 1536 : 1024}
        shadow-mapSize-width={tier === "high" ? 1536 : 1024}
      />
      <directionalLight color="#b2ccd0" intensity={0.36} position={[190, 150, -220]} />
      <group ref={cloudGroup}>
        {clouds.map((cloud, index) => (
          <mesh key={cloud.position.join(":")} material={materials[index]} position={cloud.position} scale={cloud.scale}>
            <sphereGeometry args={[0.5, 24, 12]} />
          </mesh>
        ))}
      </group>
      <group name={`Madagin v1.20 terrain-contact weather · ${mistBanks.length} grounded banks`} ref={mistGroup}>
        {mistBanks.map((mist, index) => (
          <mesh key={mist.authority} material={mistMaterials[index]} position={mist.position} scale={mist.scale}>
            <sphereGeometry args={[0.5, 24, 12]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function createOceanMaterial() {
  return new ShaderMaterial({
    depthWrite: true,
    side: DoubleSide,
    toneMapped: true,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      varying float vWaveHeight;
      varying float vWaveSlope;
      varying float vCoastDepth;
      varying float vOceanDistance;
      void main() {
        vec3 displaced = position;
        vec2 p = position.xy;
        vec4 baseWorld = modelMatrix * vec4(position, 1.0);
        float coastline = -690.0
          + sin(baseWorld.z * 0.012 + 0.8) * 18.0
          + sin(baseWorld.z * 0.029 - 1.3) * 7.5;
        float oceanDistance = coastline - baseWorld.x;
        float coastDepth = smoothstep(5.0, 72.0, oceanDistance);
        vCoastDepth = coastDepth;
        vOceanDistance = oceanDistance;
        float warpA = sin(p.x * 0.006 + p.y * 0.009 + 0.8) * 1.12
          + sin(p.x * -0.013 + p.y * 0.005 - 1.7) * 0.68;
        float warpB = sin(p.x * 0.011 - p.y * 0.007 + 2.1) * 0.82;
        float phaseA = p.x * 0.016 + p.y * 0.009 + warpA * 0.2 + uTime * 0.49;
        float phaseB = p.x * -0.026 + p.y * 0.035 + warpB * 0.24 + uTime * 0.36 + 1.7;
        float phaseC = p.x * 0.061 + p.y * -0.053 + warpA * 0.12 + uTime * 0.68 + 4.2;
        float phaseD = p.x * -0.132 + p.y * -0.108 + warpB * 0.16 + uTime * 0.94 + 2.4;
        float swellA = sin(phaseA) * 1.08;
        float swellB = sin(phaseB) * 0.54;
        float swellC = sin(phaseC) * 0.2;
        float swellD = sin(phaseD) * 0.075;
        float height = (swellA + swellB + swellC + swellD) * coastDepth;
        displaced.x += (cos(phaseA) * 0.38 - cos(phaseB) * 0.16) * coastDepth;
        displaced.y += (cos(phaseA) * 0.24 + cos(phaseB) * 0.2) * coastDepth;
        displaced.z += height;
        float dx = (cos(phaseA) * 0.016 * 1.08
          + cos(phaseB) * -0.026 * 0.54
          + cos(phaseC) * 0.061 * 0.2
          + cos(phaseD) * -0.132 * 0.075) * coastDepth;
        float dy = (cos(phaseA) * 0.009 * 1.08
          + cos(phaseB) * 0.035 * 0.54
          + cos(phaseC) * -0.053 * 0.2
          + cos(phaseD) * -0.108 * 0.075) * coastDepth;
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
      uniform float uTime;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      varying float vWaveHeight;
      varying float vWaveSlope;
      varying float vCoastDepth;
      varying float vOceanDistance;
      float oceanHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float oceanNoise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(oceanHash(i), oceanHash(i + vec2(1.0, 0.0)), f.x),
          mix(oceanHash(i + vec2(0.0, 1.0)), oceanHash(i + vec2(1.0)), f.x), f.y);
      }
      void main() {
        if (vOceanDistance < -1.5) discard;
        vec3 normal = normalize(vWorldNormal);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float distanceToCamera = length(cameraPosition - vWorldPosition);
        float detailFade = 1.0 - smoothstep(120.0, 820.0, distanceToCamera);
        vec2 capillary = vec2(
          sin(vWorldPosition.x * 0.72 + vWorldPosition.z * 0.91 + uTime * 0.63),
          cos(vWorldPosition.z * 0.77 - vWorldPosition.x * 0.66 + uTime * 0.57)
        );
        normal = normalize(normal + vec3(capillary.x * 0.016, 0.0, capillary.y * 0.016) * detailFade);
        vec3 reflected = reflect(-viewDirection, normal);
        float skyAmount = smoothstep(-0.08, 0.78, reflected.y);
        vec3 horizon = vec3(0.19, 0.39, 0.46);
        vec3 zenith = vec3(0.025, 0.12, 0.235);
        vec3 reflectedSky = mix(horizon, zenith, skyAmount);
        float fresnel = pow(1.0 - max(dot(viewDirection, normal), 0.0), 3.6);
        float surfaceVariation = oceanNoise(vWorldPosition.xz * 0.046 + vec2(uTime * 0.014, -uTime * 0.011));
        float shoal = 1.0 - vCoastDepth;
        vec3 deepWater = vec3(0.003, 0.043, 0.071);
        vec3 coastalWater = vec3(0.025, 0.16, 0.17);
        vec3 color = mix(mix(deepWater, coastalWater, shoal * 0.68), reflectedSky, 0.17 + fresnel * 0.66);
        color *= 0.78 + surfaceVariation * 0.24;
        float crest = smoothstep(0.052, 0.12, vWaveSlope) * smoothstep(0.38, 1.35, vWaveHeight);
        color = mix(color, vec3(0.46, 0.67, 0.7), crest * smoothstep(0.58, 0.88, surfaceVariation) * 0.24);
        float shorePulse = sin(vWorldPosition.z * 0.071 - uTime * 0.66 + sin(vWorldPosition.z * 0.017) * 1.4) * 3.8;
        float shoreBreak = exp(-pow((vOceanDistance - 13.0 - shorePulse) / 5.8, 2.0));
        float shoreFeather = smoothstep(2.5, 9.0, vOceanDistance) * (1.0 - smoothstep(34.0, 58.0, vOceanDistance));
        float foamNoise = oceanNoise(vWorldPosition.xz * 0.13 + vec2(-uTime * 0.035, uTime * 0.012));
        float shoreFoam = shoreBreak * shoreFeather * smoothstep(0.32, 0.72, foamNoise + surfaceVariation * 0.32);
        color = mix(color, vec3(0.63, 0.76, 0.74), shoreFoam * 0.68);
        vec3 sunDirection = normalize(vec3(-0.78, 0.24, 0.56));
        float broadGlint = pow(max(dot(reflected, sunDirection), 0.0), 54.0);
        float sharpGlint = pow(max(dot(reflected, sunDirection), 0.0), 280.0);
        color += vec3(1.0, 0.67, 0.42) * (broadGlint * 0.11 + sharpGlint * 0.38);
        float fogFactor = 1.0 - exp(-0.0000002 * distanceToCamera * distanceToCamera);
        color = mix(color, vec3(0.2, 0.38, 0.45), clamp(fogFactor, 0.0, 0.31));
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

function Ocean({ mobile, reducedMotion, tier }: { mobile: boolean; reducedMotion: boolean; tier: WorldQualityTier }) {
  const activeMaterial = useRef<ShaderMaterial | null>(null);
  const material = useMemo(() => createOceanMaterial(), []);
  const segments = mobile ? 96 : tier === "high" ? 256 : tier === "balanced" ? 192 : 120;
  useFrame(({ clock }) => {
    const waterTime = activeMaterial.current?.uniforms.uTime;
    if (waterTime) waterTime.value = reducedMotion ? 0 : clock.elapsedTime * 0.55;
  });
  useEffect(() => {
    activeMaterial.current = material;
    return () => {
      activeMaterial.current = null;
      material.dispose();
    };
  }, [material]);
  return (
    <mesh material={material} position={[-2500, -18, -700]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[5200, 6000, segments, segments]} />
    </mesh>
  );
}

export function RidgeProductionV116({ diagnosticMode, mobile, reducedMotion, shadows, showOcean, tier, zone }: RidgeProductionV116Props) {
  const chunks = useMemo(() => activeChunks(zone), [zone]);
  const terrainChunks = useMemo(() => activeTerrainChunks(zone), [zone]);
  // Ridge terrain must remain at Summit to close the world, but its full ecology
  // was not part of T1's terminal budget. The connected shoulder supplies its own
  // bounded grounding set, so retaining the earlier Ridge forest would duplicate
  // millions of vegetation triangles without a proportional perceptual gain.
  const ecologyChunks = zone === "summit" ? chunks.filter((chunk) => chunk !== "ridge") : chunks;
  useEffect(() => {
    document.documentElement.dataset.madaginWorldVersion = "v1.16";
    const host = window as Window & { __MADAGIN_WORLD_STREAM_V116__?: unknown };
    host.__MADAGIN_WORLD_STREAM_V116__ = {
      chapter: zone,
      currentAndNextChunks: chunks,
      terrainContinuityChunks: terrainChunks,
      terrainContinuityPolicy: "retain visible neighboring landforms; stream ecology by current and next chapter",
      updatedAt: new Date().toISOString(),
    };
    document.documentElement.dataset.madaginLivingWindV116 = "spatial-phased-vertex-wind";
  }, [chunks, terrainChunks, zone]);
  return (
    <group name={`Madagin Ridge-to-Valley v1.16 + Candidate BO real-time spatial world · ${zone} · ${chunks.join("+")} · ${showOcean ? "ocean focus" : "journey focus"}`}>
      <V116Atmosphere reducedMotion={reducedMotion} shadows={shadows} tier={tier} />
      {terrainChunks.map((chunk) => (
        <Suspense fallback={null} key={`terrain-${chunk}`}>
          {!mobile && tier !== "conservative" ? (
            <DetailedTerrainChunk
              connectedCoast={zone === "summit" && (chunk === "ridge" || chunk === "valley")}
              shadows={shadows}
              tier={tier}
              zone={chunk}
            />
          ) : (
            zone === "summit" && chunk === "ridge" ? (
              <MobileTerminalTerrain shadows={shadows} tier={tier} />
            ) : zone === "summit" && chunk === "valley" ? null : (
              chunk === "ridge" ? (
                <CompactJourneyTerrain shadows={shadows} />
              ) : chunk === "valley" ? null : (
                <TerrainChunk shadows={shadows} zone={chunk} />
              )
            )
          )}
        </Suspense>
      ))}
      {ecologyChunks.map((chunk) => (
        <Suspense fallback={null} key={`ecology-${chunk}`}>
          <EcologyChunk diagnosticMode={diagnosticMode} mobile={mobile} shadows={shadows} tier={tier} zone={chunk} />
        </Suspense>
      ))}
      {/* Keep both water authorities resident for the entire rail. This closes
          the former Summit lake gap and prevents the western ocean from first
          appearing only after the guided camera has already begun its pan. */}
      <Suspense fallback={null}><WaterNetwork mobile={mobile} reducedMotion={reducedMotion} shadows={shadows} tier={tier} zone={zone} /></Suspense>
      <Ocean mobile={mobile} reducedMotion={reducedMotion} tier={tier} />
    </group>
  );
}
