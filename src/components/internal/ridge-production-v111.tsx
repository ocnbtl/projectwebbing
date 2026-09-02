"use client";

import { useFrame, useLoader } from "@react-three/fiber";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Color,
  BackSide,
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
  Vector2,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { WorldQualityTier } from "./world-ecology";

const RIDGE_ROOT = "/world/v111";
const FOREST_ROOT = "/world/assets/polyhaven/forrest_ground_03";
const ROCK_ROOT = "/world/assets/polyhaven/aerial_grass_rock";
const MANIFEST_URL = `${RIDGE_ROOT}/madagin-ridge-forest-cells-v1.11.json`;

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
  family: "pachira" | "island" | "small";
  variant: number;
  detail: "near" | "mid" | "far";
  cell: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: [number, number, number];
  hue: number;
  wind: number;
};

type RidgeManifest = {
  version: string;
  placements: RidgePlacement[];
  coverage: {
    placementCount: number;
    familyCounts: Record<RidgePlacement["family"], number>;
    detailCounts: Record<RidgePlacement["detail"], number>;
    analyticCrownAreaRatio: number;
    note: string;
  };
};

type RidgeProductionProps = {
  mobile: boolean;
  shadows: boolean;
  tier: WorldQualityTier;
};

type ForestSourcePart = {
  geometry: Mesh["geometry"];
  material: Material | Material[];
  matrixWorld: Matrix4;
  sourceKey: string;
};

type ForestBatch = {
  cell: string;
  placements: RidgePlacement[];
  sourceKey: string;
};

function useRidgeManifest() {
  const raw = useLoader(FileLoader, MANIFEST_URL) as unknown;
  return useMemo(() => {
    const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw as ArrayBuffer);
    return JSON.parse(text) as RidgeManifest;
  }, [raw]);
}

function configureTexture(texture: Texture, color = false) {
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  if (color) texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
}

function terrainUrl(tier: WorldQualityTier, mobile: boolean) {
  if (mobile || tier === "conservative") return `${RIDGE_ROOT}/madagin-ridge-terrain-mobile-v1.11.glb`;
  if (tier === "high") return `${RIDGE_ROOT}/madagin-ridge-terrain-high-v1.11.glb`;
  return `${RIDGE_ROOT}/madagin-ridge-terrain-balanced-v1.11.glb`;
}

function forestUrl(tier: WorldQualityTier, mobile: boolean) {
  if (mobile || tier === "conservative") return `${RIDGE_ROOT}/madagin-ridge-forest-mobile-v1.11.glb`;
  if (tier === "high") return `${RIDGE_ROOT}/madagin-ridge-forest-high-v1.11.glb`;
  return `${RIDGE_ROOT}/madagin-ridge-forest-balanced-v1.11.glb`;
}

function hierarchyName(object: Object3D) {
  const names: string[] = [];
  let current: Object3D | null = object;
  while (current) {
    names.push(current.name.toUpperCase());
    current = current.parent;
  }
  return names.join("/");
}

function RidgeTerrainV111({ mobile, shadows, tier }: RidgeProductionProps) {
  const gltf = useLoader(GLTFLoader, terrainUrl(tier, mobile));
  const [forestColor, forestNormal, forestArm, rockColor] = useLoader(TextureLoader, [
    `${FOREST_ROOT}/forrest_ground_03_diff_1k.jpg`,
    `${FOREST_ROOT}/forrest_ground_03_nor_gl_1k.jpg`,
    `${FOREST_ROOT}/forrest_ground_03_arm_1k.jpg`,
    `${ROCK_ROOT}/aerial_grass_rock_diff_1k.jpg`,
  ]);

  const prepared = useMemo(() => {
    configureTexture(forestColor, true);
    configureTexture(forestNormal);
    configureTexture(forestArm);
    configureTexture(rockColor, true);

    const terrainMaterial = new MeshStandardMaterial({
      color: "#8ca17d",
      map: forestColor,
      metalness: 0,
      normalMap: forestNormal,
      normalScale: new Vector2(0.58, 0.58),
      roughness: 0.94,
      roughnessMap: forestArm,
      side: DoubleSide,
    });
    terrainMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.ridgeRockMap = { value: rockColor };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vRidgeWorldNormal;\nvarying vec3 vRidgeWorldPosition;")
        .replace(
          "#include <worldpos_vertex>",
          "#include <worldpos_vertex>\nvRidgeWorldNormal = normalize(mat3(modelMatrix) * objectNormal);\nvRidgeWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform sampler2D ridgeRockMap;\nvarying vec3 vRidgeWorldNormal;\nvarying vec3 vRidgeWorldPosition;",
        )
        .replace(
          "#include <map_fragment>",
          [
            "#ifdef USE_MAP",
            "  vec4 ridgeForest = texture2D(map, vMapUv);",
            "  vec4 ridgeRock = texture2D(ridgeRockMap, vMapUv * 1.23);",
            "  ridgeForest.rgb *= vec3(0.32, 0.52, 0.29);",
            "  ridgeRock.rgb *= vec3(0.36, 0.39, 0.31);",
            "  float slope = smoothstep(0.34, 0.84, 1.0 - abs(vRidgeWorldNormal.y));",
            "  float exposed = smoothstep(20.0, 35.0, vRidgeWorldPosition.y) * 0.18;",
            "  diffuseColor *= mix(ridgeForest, ridgeRock, clamp(slope * 0.72 + exposed, 0.0, 0.84));",
            "#endif",
          ].join("\n"),
        );
    };
    terrainMaterial.customProgramCacheKey = () => "madagin-dem-slope-pbr-v111";

    const farMaterial = new MeshStandardMaterial({
      color: "#244735",
      metalness: 0,
      roughness: 1,
      side: DoubleSide,
    });
    farMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vFarWorldPosition;\nvarying vec3 vFarWorldNormal;")
        .replace(
          "#include <worldpos_vertex>",
          "#include <worldpos_vertex>\nvFarWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvFarWorldNormal = normalize(mat3(modelMatrix) * objectNormal);",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vFarWorldPosition;\nvarying vec3 vFarWorldNormal;")
        .replace(
          "#include <color_fragment>",
          [
            "#include <color_fragment>",
            "float broad = sin(vFarWorldPosition.x * 0.021 + vFarWorldPosition.z * 0.013) * 0.5 + 0.5;",
            "float detail = sin(vFarWorldPosition.x * 0.073 - vFarWorldPosition.z * 0.041) * 0.5 + 0.5;",
            "float farSlope = smoothstep(0.16, 0.74, 1.0 - abs(vFarWorldNormal.y));",
            "vec3 humidGreen = mix(vec3(0.48, 0.68, 0.51), vec3(0.2, 0.38, 0.28), broad * 0.58 + detail * 0.16);",
            "vec3 basalt = vec3(0.19, 0.24, 0.21);",
            "diffuseColor.rgb *= mix(humidGreen, basalt, farSlope * 0.62);",
          ].join("\n"),
        );
    };
    farMaterial.customProgramCacheKey = () => "madagin-humid-far-valley-v111";
    const waterMaterial = new MeshPhysicalMaterial({
      color: "#173f42",
      metalness: 0.04,
      opacity: 1,
      roughness: 0.46,
      side: DoubleSide,
      transparent: false,
    });
    waterMaterial.depthWrite = true;

    const scene = gltf.scene.clone(true);
    scene.name = "Madagin v1.11 USGS-derived Ridge terrain and far-valley proxy";
    scene.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const name = hierarchyName(child);
      child.castShadow = shadows && name.includes("RIDGE_TERRAIN") && tier === "high";
      child.receiveShadow = true;
      if (name.includes("WATER")) child.material = waterMaterial;
      else if (name.includes("FAR_VALLEY")) {
        child.material = farMaterial;
        child.scale.x *= 1.8;
      }
      else child.material = terrainMaterial;
    });
    return { farMaterial, scene, terrainMaterial, waterMaterial };
  }, [forestArm, forestColor, forestNormal, gltf.scene, rockColor, shadows, tier]);

  useEffect(() => () => {
    prepared.terrainMaterial.dispose();
    prepared.farMaterial.dispose();
    prepared.waterMaterial.dispose();
  }, [prepared]);

  return <primitive object={prepared.scene} />;
}

function inferSourceKey(object: Object3D) {
  let current: Object3D | null = object;
  while (current) {
    const match = current.name.toLowerCase().match(/(pachira_[a-d]|island|small)_(near|mid|far)/);
    if (match) return match[0];
    current = current.parent;
  }
  return null;
}

function sourceDetail(sourceKey: string) {
  return sourceKey.endsWith("_near") ? "near" : sourceKey.endsWith("_mid") ? "mid" : "far";
}

function cloneForestMaterial(material: Material, detail: RidgePlacement["detail"]) {
  const result = material.clone() as MeshStandardMaterial;
  result.alphaTest = Math.max(0.42, result.alphaTest || 0);
  result.depthWrite = true;
  result.side = detail === "near" ? DoubleSide : FrontSide;
  result.transparent = false;
  result.roughness = Math.max(0.72, result.roughness ?? 0.9);
  result.needsUpdate = true;
  return result;
}

function chooseSourceKey(
  placement: RidgePlacement,
  tier: WorldQualityTier,
  mobile: boolean,
) {
  let detail: RidgePlacement["detail"];
  if (mobile || tier === "conservative") {
    if (placement.id % (mobile ? 4 : 3) !== 0) return null;
    detail = "far";
  } else if (tier === "balanced") {
    if (placement.id % 2 !== 0) return null;
    detail = placement.detail !== "far" && placement.id % 10 === 0 ? "mid" : "far";
  } else {
    detail = placement.detail === "near"
      ? "near"
      : placement.detail === "mid" && placement.id % 5 === 0 ? "mid" : "far";
  }

  if (placement.family === "small") {
    const supportsStructuralSmall = detail !== "far"
      && !mobile
      && tier !== "conservative"
      && placement.id % (tier === "high" ? 7 : 19) === 0;
    if (supportsStructuralSmall) return `small_${detail}`;
    const fallbackVariant = "abcd"[(placement.variant + placement.id) % 4];
    return `pachira_${fallbackVariant}_${detail}`;
  }
  if (placement.family === "island") return `island_${detail}`;
  return `pachira_${"abcd"[placement.variant % 4]}_${detail}`;
}

function RidgeForestCell({
  castShadow,
  part,
  placements,
  scaleMultiplier,
}: {
  castShadow: boolean;
  part: ForestSourcePart;
  placements: RidgePlacement[];
  scaleMultiplier: number;
}) {
  const ref = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const dummy = new Object3D();
    const matrix = new Matrix4();
    const color = new Color();
    placements.forEach((placement, index) => {
      dummy.position.set(placement.x, placement.y, placement.z);
      dummy.rotation.set(0, placement.rotation, 0);
      dummy.scale.fromArray(placement.scale);
      dummy.scale.multiplyScalar(scaleMultiplier);
      dummy.updateMatrix();
      matrix.multiplyMatrices(dummy.matrix, part.matrixWorld);
      ref.current?.setMatrixAt(index, matrix);
      color.setHSL(0.305 + placement.hue * 0.28, 0.2, 0.82 - placement.wind * 0.035);
      ref.current?.setColorAt(index, color);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingBox();
    ref.current.computeBoundingSphere();
  }, [part.matrixWorld, placements, scaleMultiplier]);

  return (
    <instancedMesh
      args={[part.geometry, part.material, placements.length]}
      castShadow={castShadow}
      receiveShadow
      ref={ref}
    />
  );
}

function RidgeForestV111({
  benchmark,
  mobile,
  shadows,
  stage,
  tier,
}: RidgeProductionProps & { benchmark: RidgeBenchmarkMode | null; stage: number }) {
  const manifest = useRidgeManifest();
  const gltf = useLoader(GLTFLoader, forestUrl(tier, mobile));
  const sources = useMemo(() => {
    gltf.scene.updateMatrixWorld(true);
    const parts: ForestSourcePart[] = [];
    gltf.scene.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const sourceKey = inferSourceKey(child);
      if (!sourceKey) return;
      const detail = sourceDetail(sourceKey);
      const material = Array.isArray(child.material)
        ? child.material.map((item) => cloneForestMaterial(item, detail))
        : cloneForestMaterial(child.material, detail);
      parts.push({
        geometry: child.geometry,
        material,
        matrixWorld: child.matrixWorld.clone(),
        sourceKey,
      });
    });
    return parts;
  }, [gltf.scene]);

  useEffect(() => () => {
    sources.forEach((source) => {
      const materials = Array.isArray(source.material) ? source.material : [source.material];
      materials.forEach((material) => material.dispose());
    });
  }, [sources]);

  const batches = useMemo(() => {
    const grouped = new Map<string, ForestBatch>();
    manifest.placements.forEach((placement) => {
      const sourceKey = chooseSourceKey(placement, tier, mobile);
      if (!sourceKey) return;
      const detail = sourceDetail(sourceKey);
      if (benchmark?.startsWith("forest-") && benchmark !== `forest-${detail}`) return;
      if (!benchmark && (detail === "far" ? stage < 1 : detail === "mid" ? stage < 2 : stage < 3)) return;
      const [cellX, cellZ] = placement.cell.split(":").map(Number);
      const runtimeCell = `${Math.floor(cellX / 2)}:${Math.floor(cellZ / 2)}`;
      const id = `${runtimeCell}|${sourceKey}`;
      const batch = grouped.get(id) ?? { cell: runtimeCell, placements: [], sourceKey };
      batch.placements.push(placement);
      grouped.set(id, batch);
    });
    return [...grouped.values()];
  }, [benchmark, manifest.placements, mobile, stage, tier]);

  const sourcesByKey = useMemo(() => {
    const result = new Map<string, ForestSourcePart[]>();
    sources.forEach((source) => {
      const parts = result.get(source.sourceKey) ?? [];
      parts.push(source);
      result.set(source.sourceKey, parts);
    });
    return result;
  }, [sources]);

  return (
    <group name={`Madagin v1.11 spatial forest cells · ${batches.length} source-cell batches`}>
      {batches.flatMap((batch) => (sourcesByKey.get(batch.sourceKey) ?? []).map((part, index) => (
        <RidgeForestCell
          castShadow={shadows && tier === "high" && sourceDetail(batch.sourceKey) === "near"}
          key={`${batch.cell}-${batch.sourceKey}-${index}`}
          part={part}
          placements={batch.placements}
          scaleMultiplier={tier === "high" ? 1 : mobile ? 1.28 : tier === "balanced" ? 1.16 : 1.22}
        />
      )))}
    </group>
  );
}

const MIST_LAYERS = [
  { position: [55, 8, -315] as [number, number, number], size: [520, 74] as [number, number], opacity: 0.16, speed: 0.012 },
  { position: [42, 3, -470] as [number, number, number], size: [690, 92] as [number, number], opacity: 0.2, speed: -0.008 },
  { position: [20, -4, -650] as [number, number, number], size: [850, 126] as [number, number], opacity: 0.24, speed: 0.005 },
];

function createMistMaterial(opacity: number, speed: number) {
  return new ShaderMaterial({
    depthWrite: false,
    side: DoubleSide,
    transparent: true,
    uniforms: { uOpacity: { value: opacity }, uSpeed: { value: speed }, uTime: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform float uSpeed;
      uniform float uTime;
      varying vec2 vUv;
      float noise(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      void main() {
        vec2 shifted = vUv + vec2(uTime * uSpeed, 0.0);
        float broad = noise(floor(shifted * vec2(11.0, 4.0))) * 0.32 + noise(floor(shifted * vec2(23.0, 7.0))) * 0.18;
        float edgeX = smoothstep(0.0, 0.18, vUv.x) * smoothstep(0.0, 0.18, 1.0 - vUv.x);
        float edgeY = smoothstep(0.0, 0.42, vUv.y) * smoothstep(0.0, 0.42, 1.0 - vUv.y);
        float alpha = (0.5 + broad) * edgeX * edgeY * uOpacity;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(0.59, 0.72, 0.73, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

function RidgeSkyV111() {
  const material = useMemo(() => new ShaderMaterial({
    depthWrite: false,
    side: BackSide,
    vertexShader: `
      varying vec3 vSkyDirection;
      void main() {
        vSkyDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vSkyDirection;
      void main() {
        vec3 direction = normalize(vSkyDirection);
        float altitude = smoothstep(-0.1, 0.72, direction.y);
        vec3 horizon = vec3(0.78, 0.59, 0.43);
        vec3 humidBand = vec3(0.51, 0.62, 0.62);
        vec3 zenith = vec3(0.16, 0.31, 0.41);
        vec3 color = mix(horizon, humidBand, smoothstep(-0.04, 0.2, direction.y));
        color = mix(color, zenith, altitude);
        vec3 sunDirection = normalize(vec3(-0.76, 0.28, 0.57));
        float glow = pow(max(dot(direction, sunDirection), 0.0), 16.0);
        float disc = pow(max(dot(direction, sunDirection), 0.0), 420.0);
        color += vec3(0.94, 0.48, 0.18) * glow * 0.42 + vec3(1.0, 0.83, 0.56) * disc * 1.8;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  }), []);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh frustumCulled={false} material={material} renderOrder={-100}>
      <sphereGeometry args={[1200, 32, 18]} />
    </mesh>
  );
}

function RidgeAtmosphereV111({ reducedMotion, tier }: { reducedMotion: boolean; tier: WorldQualityTier }) {
  const layers = useMemo(
    () => tier === "conservative" ? MIST_LAYERS.slice(1) : MIST_LAYERS,
    [tier],
  );
  const materials = useMemo(
    () => layers.map((layer) => createMistMaterial(layer.opacity, layer.speed)),
    [layers],
  );
  useFrame(({ clock }) => {
    const time = reducedMotion ? 0 : clock.elapsedTime;
    materials.forEach((material) => { material.uniforms.uTime.value = time; });
  });
  useEffect(() => () => materials.forEach((material) => material.dispose()), [materials]);

  return (
    <group name="Madagin v1.11 spatial humid valley atmosphere">
      <RidgeSkyV111 />
      {layers.map((layer, index) => (
        <mesh key={layer.position.join("-")} material={materials[index]} position={layer.position} renderOrder={-3 + index}>
          <planeGeometry args={[layer.size[0], layer.size[1], 1, 1]} />
        </mesh>
      ))}
    </group>
  );
}

export function RidgeProductionV111({ mobile, shadows, tier }: RidgeProductionProps) {
  const benchmark = useMemo(() => inspectRidgeBenchmarkMode(), []);
  const [stage, setStage] = useState(benchmark ? 3 : 0);
  const reducedMotion = typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (benchmark) return;
    const farTimer = window.setTimeout(() => setStage(1), 260);
    const midTimer = window.setTimeout(() => setStage(2), 920);
    const nearTimer = window.setTimeout(() => setStage(3), 1850);
    return () => {
      window.clearTimeout(farTimer);
      window.clearTimeout(midTimer);
      window.clearTimeout(nearTimer);
    };
  }, [benchmark]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("madagin:ridge-stage", { detail: { stage } }));
  }, [stage]);

  const showTerrain = benchmark === null || benchmark === "terrain" || benchmark === "full" || benchmark === "shadows";
  const showForest = benchmark === null || benchmark === "full" || benchmark === "shadows" || benchmark?.startsWith("forest-");
  const showAtmosphere = benchmark === null || benchmark === "full" || benchmark === "atmosphere";

  return (
    <group name={`Madagin Ridge real-time realism benchmark v1.11 · stage ${stage} · ${benchmark ?? "normal"}`}>
      {showTerrain ? <Suspense fallback={null}><RidgeTerrainV111 mobile={mobile} shadows={shadows} tier={tier} /></Suspense> : null}
      {showForest ? (
        <Suspense fallback={null}>
          <RidgeForestV111 benchmark={benchmark} mobile={mobile} shadows={shadows} stage={stage} tier={tier} />
        </Suspense>
      ) : null}
      {showAtmosphere ? <RidgeAtmosphereV111 reducedMotion={reducedMotion} tier={tier} /> : null}
    </group>
  );
}
