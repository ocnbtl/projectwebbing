"use client";

import { useLoader } from "@react-three/fiber";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  DoubleSide,
  FileLoader,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { WorldQualityTier } from "./world-ecology";

const RIDGE_ROOT = "/world/v110";
const ASSET_ROOT = "/world/assets/polyhaven";
const PLACEMENTS_URL = `${RIDGE_ROOT}/madagin-ridge-placements-v1.10.json`;
const FOREST_ROOT = `${ASSET_ROOT}/forrest_ground_03`;
const ROCK_ROOT = `${ASSET_ROOT}/aerial_grass_rock`;

type RidgePlacement = {
  x: number;
  y: number;
  z: number;
  scale: [number, number, number];
  rotation: number;
  variant: number;
};

type RidgePlacementManifest = {
  version: string;
  layers: {
    trees: RidgePlacement[];
    ferns: RidgePlacement[];
    shrubs: RidgePlacement[];
    moss: RidgePlacement[];
    rocks: RidgePlacement[];
    mossRocks: RidgePlacement[];
  };
};

type RidgeProductionProps = {
  mobile: boolean;
  shadows: boolean;
  tier: WorldQualityTier;
};

function useRidgePlacements() {
  const raw = useLoader(FileLoader, PLACEMENTS_URL) as unknown;
  return useMemo(() => {
    const text = typeof raw === "string"
      ? raw
      : new TextDecoder().decode(raw as ArrayBuffer);
    return JSON.parse(text) as RidgePlacementManifest;
  }, [raw]);
}

function firstMesh(scene: Object3D) {
  let result: Mesh | null = null;
  scene.traverse((child) => {
    if (result === null && child instanceof Mesh) result = child;
  });
  const mesh = result as Mesh | null;
  if (mesh === null) throw new Error("The authored Ridge terrain contains no mesh.");
  return mesh;
}

function configureSurfaceTexture(texture: Texture, color = false) {
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  if (color) texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
}

function terrainUrl(tier: WorldQualityTier, mobile: boolean, detailed: boolean) {
  if (!detailed) return `${RIDGE_ROOT}/madagin-ridge-terrain-balanced-v1.10.glb`;
  if (mobile || tier === "conservative") return `${RIDGE_ROOT}/madagin-ridge-terrain-mobile-v1.10.glb`;
  if (tier === "high") return `${RIDGE_ROOT}/madagin-ridge-terrain-high-v1.10.glb`;
  return `${RIDGE_ROOT}/madagin-ridge-terrain-balanced-v1.10.glb`;
}

function RidgeTerrainBase({ mobile, shadows, tier }: RidgeProductionProps) {
  const gltf = useLoader(GLTFLoader, terrainUrl(tier, mobile, false));
  const forest = useLoader(TextureLoader, `${ROCK_ROOT}/aerial_grass_rock_diff_1k.jpg`);
  const source = useMemo(() => firstMesh(gltf.scene), [gltf.scene]);
  const geometry = useMemo(() => {
    const result = mergeVertices(source.geometry.clone(), 0.0001);
    result.computeVertexNormals();
    return result;
  }, [source.geometry]);
  const material = useMemo(() => {
    configureSurfaceTexture(forest, true);
    return new MeshStandardMaterial({
      color: "#9aaa83",
      map: forest,
      metalness: 0,
      roughness: 0.96,
    });
  }, [forest]);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  return (
    <mesh
      castShadow={shadows}
      geometry={geometry}
      material={material}
      name="Ridge v1.10 initial terrain LOD"
      receiveShadow
    />
  );
}

function RidgeTerrainDetailed({ mobile, shadows, tier }: RidgeProductionProps) {
  const gltf = useLoader(GLTFLoader, terrainUrl(tier, mobile, true));
  const [forestColor, forestNormal, forestArm, rockColor] = useLoader(TextureLoader, [
    `${ROCK_ROOT}/aerial_grass_rock_diff_1k.jpg`,
    `${ROCK_ROOT}/aerial_grass_rock_nor_gl_1k.jpg`,
    `${ROCK_ROOT}/aerial_grass_rock_arm_1k.jpg`,
    `${FOREST_ROOT}/forrest_ground_03_diff_1k.jpg`,
  ]);
  const source = useMemo(() => firstMesh(gltf.scene), [gltf.scene]);
  const geometry = useMemo(() => {
    const result = mergeVertices(source.geometry.clone(), 0.0001);
    result.computeVertexNormals();
    return result;
  }, [source.geometry]);
  const material = useMemo(() => {
    configureSurfaceTexture(forestColor, true);
    configureSurfaceTexture(forestNormal);
    configureSurfaceTexture(forestArm);
    configureSurfaceTexture(rockColor, true);
    const result = new MeshStandardMaterial({
      color: "#b9c3ad",
      map: forestColor,
      metalness: 0,
      normalMap: forestNormal,
      normalScale: new Vector2(0.62, 0.62),
      polygonOffset: true,
      polygonOffsetFactor: -1,
      roughness: 0.92,
      roughnessMap: forestArm,
    });
    result.onBeforeCompile = (shader) => {
      shader.uniforms.ridgeRockMap = { value: rockColor };
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec3 vRidgeWorldNormal;",
        )
        .replace(
          "#include <worldpos_vertex>",
          "#include <worldpos_vertex>\nvRidgeWorldNormal = mat3(modelMatrix) * objectNormal;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform sampler2D ridgeRockMap;\nvarying vec3 vRidgeWorldNormal;",
        )
        .replace(
          "#include <map_fragment>",
          [
            "#ifdef USE_MAP",
            "  vec4 ridgeForestSample = texture2D(map, vMapUv);",
            "  vec4 ridgeRockSample = texture2D(ridgeRockMap, vMapUv * 1.17);",
            "  ridgeRockSample.rgb *= vec3(0.38, 0.42, 0.36);",
            "  float ridgeSlope = 0.07 + smoothstep(0.22, 0.82, 1.0 - abs(vRidgeWorldNormal.y)) * 0.54;",
            "  diffuseColor *= mix(ridgeForestSample, ridgeRockSample, ridgeSlope);",
            "#endif",
          ].join("\n"),
        );
    };
    result.customProgramCacheKey = () => "madagin-ridge-slope-pbr-v110";
    return result;
  }, [forestArm, forestColor, forestNormal, rockColor]);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  return (
    <mesh
      castShadow={shadows}
      geometry={geometry}
      material={material}
      name="Ridge v1.10 detailed slope-blended terrain"
      receiveShadow
    />
  );
}

function RidgeImpostorBatch({
  angleOffset,
  material,
  placements,
  profile = "pachira",
}: {
  angleOffset: number;
  material: Material;
  placements: RidgePlacement[];
  profile?: "island" | "pachira";
}) {
  const ref = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => new PlaneGeometry(1, 1), []);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const dummy = new Object3D();
    placements.forEach((placement, index) => {
      const width = (placement.scale[0] + placement.scale[2]) * (profile === "island" ? 1.04 : 0.86);
      const height = Math.max(5.2, placement.scale[1] * (profile === "island" ? 2.9 : 3.45));
      dummy.position.set(placement.x, placement.y + height * 0.48, placement.z);
      dummy.rotation.set(0, placement.rotation + angleOffset, 0);
      dummy.scale.set(width, height, 1);
      dummy.updateMatrix();
      ref.current?.setMatrixAt(index, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingBox();
    ref.current.computeBoundingSphere();
  }, [angleOffset, placements, profile]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <instancedMesh
      args={[geometry, material, placements.length]}
      frustumCulled={false}
      ref={ref}
      receiveShadow
    />
  );
}

function RidgeCrownBatch({
  angleOffset,
  material,
  placements,
}: {
  angleOffset: number;
  material: Material;
  placements: RidgePlacement[];
}) {
  const ref = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => new PlaneGeometry(1, 1), []);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const dummy = new Object3D();
    placements.forEach((placement, index) => {
      const width = (placement.scale[0] + placement.scale[2]) * 0.64;
      const crownHeight = Math.max(3.1, placement.scale[1] * 2.3);
      dummy.position.set(placement.x, placement.y + crownHeight, placement.z);
      dummy.rotation.set(0, placement.rotation + angleOffset, 0);
      dummy.scale.set(width, width * (0.7 + (placement.variant % 3) * 0.08), 1);
      dummy.updateMatrix();
      ref.current?.setMatrixAt(index, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingBox();
    ref.current.computeBoundingSphere();
  }, [angleOffset, placements]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <instancedMesh
      args={[geometry, material, placements.length]}
      frustumCulled={false}
      ref={ref}
      receiveShadow
    />
  );
}

function RidgeCanopyImpostors({ mobile, tier }: Pick<RidgeProductionProps, "mobile" | "tier">) {
  const manifest = useRidgePlacements();
  const textures = useLoader(TextureLoader, [
    "/world/v07/impostors/tropical-1.png",
    "/world/v07/impostors/tropical-3.png",
    "/world/v07/impostors/tropical-5.png",
    "/world/v07/impostors/tropical-7.png",
    "/world/v07/impostors/tropical-top-1.png",
    "/world/v07/impostors/tropical-top-2.png",
    "/world/v07/impostors/tropical-top-3.png",
    "/world/v07/impostors/tropical-top-4.png",
    `${RIDGE_ROOT}/island-tree-03-impostors/island-tree-03-side-1.png`,
    `${RIDGE_ROOT}/island-tree-03-impostors/island-tree-03-side-2.png`,
    `${RIDGE_ROOT}/island-tree-03-impostors/island-tree-03-side-3.png`,
    `${RIDGE_ROOT}/island-tree-03-impostors/island-tree-03-side-4.png`,
  ]);
  const limit = mobile || tier === "conservative" ? 280 : tier === "balanced" ? 520 : 680;
  const placements = useMemo(() => manifest.layers.trees
    .filter((placement) => placement.z < 20)
    .slice(0, limit), [limit, manifest]);
  const materials = useMemo(() => textures.map((texture) => {
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;
    return new MeshStandardMaterial({
      alphaTest: 0.34,
      color: "#d7e0d0",
      map: texture,
      metalness: 0,
      roughness: 1,
      side: DoubleSide,
    });
  }), [textures]);
  const sideLimit = mobile || tier === "conservative" ? 125 : tier === "balanced" ? 205 : 260;
  const sidePlacements = useMemo(() => placements
    .filter((placement) => Math.abs(placement.x) < 76)
    .sort((a, b) => b.z - a.z)
    .slice(0, sideLimit), [placements, sideLimit]);
  const isIslandTree = (placement: RidgePlacement) => (
    (Math.abs(Math.round(placement.x * 7)) + Math.abs(Math.round(placement.z * 3))) % 3 === 0
  );

  useEffect(() => () => materials.forEach((material) => material.dispose()), [materials]);

  return (
    <group name="Ridge v1.10 Pachira-derived canopy impostor LOD">
      {materials.slice(0, 4).flatMap((material, variant) => {
        const batch = sidePlacements.filter((placement) => placement.variant === variant && !isIslandTree(placement));
        return [
          <RidgeImpostorBatch angleOffset={0} key={`${variant}-a`} material={material} placements={batch} />,
          <RidgeImpostorBatch angleOffset={Math.PI / 2} key={`${variant}-b`} material={material} placements={batch} />,
        ];
      })}
      {materials.slice(8, 12).flatMap((material, variant) => {
        const batch = sidePlacements.filter((placement) => placement.variant === variant && isIslandTree(placement));
        return [
          <RidgeImpostorBatch angleOffset={0} key={`island-${variant}-a`} material={material} placements={batch} profile="island" />,
          <RidgeImpostorBatch angleOffset={Math.PI / 2} key={`island-${variant}-b`} material={material} placements={batch} profile="island" />,
        ];
      })}
      {materials.slice(4).flatMap((material, variant) => {
        if (variant > 3) return [];
        const batch = placements.filter((placement) => placement.variant === variant && !isIslandTree(placement));
        return [
          <RidgeCrownBatch angleOffset={0} key={`crown-${variant}-a`} material={material} placements={batch} />,
          <RidgeCrownBatch angleOffset={Math.PI / 2} key={`crown-${variant}-b`} material={material} placements={batch} />,
        ];
      })}
    </group>
  );
}

function RidgeSourceInstances({
  castShadow,
  placements,
  source,
}: {
  castShadow: boolean;
  placements: RidgePlacement[];
  source: Mesh;
}) {
  const ref = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const dummy = new Object3D();
    const sourceMatrix = source.matrixWorld.clone();
    placements.forEach((placement, index) => {
      dummy.position.set(placement.x, placement.y - 0.03, placement.z);
      dummy.rotation.set(0, placement.rotation, 0);
      dummy.scale.fromArray(placement.scale);
      dummy.updateMatrix();
      ref.current?.setMatrixAt(index, new Matrix4().multiplyMatrices(dummy.matrix, sourceMatrix));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingBox();
    ref.current.computeBoundingSphere();
  }, [placements, source]);

  return (
    <instancedMesh
      args={[source.geometry, source.material, placements.length]}
      castShadow={castShadow}
      frustumCulled={false}
      ref={ref}
      receiveShadow
    />
  );
}

function pachiraVariant(name: string) {
  const match = name.match(/_(?:bark|leaves)_([a-d])(?:_|$)/i);
  return match ? match[1].toLowerCase().charCodeAt(0) - 97 : 0;
}

function RidgeHeroCanopy({ mobile, shadows, tier }: RidgeProductionProps) {
  const manifest = useRidgePlacements();
  const gltf = useLoader(GLTFLoader, `${ASSET_ROOT}/pachira_aquatica_01/pachira_aquatica_01_1k.gltf`);
  const sources = useMemo(() => {
    gltf.scene.updateMatrixWorld(true);
    const meshes: Mesh[] = [];
    gltf.scene.traverse((child) => {
      if (child instanceof Mesh) meshes.push(child);
    });
    return meshes;
  }, [gltf.scene]);
  const count = mobile || tier === "conservative" ? 0 : tier === "high" ? 8 : 2;
  const placements = useMemo(() => manifest.layers.trees
    .filter((placement) => placement.z < -13 && Math.abs(placement.x) < 54)
    .slice(0, count), [count, manifest]);

  return (
    <group name="Ridge v1.10 close Pachira mesh LOD">
      {sources.map((source) => {
        const variant = pachiraVariant(source.name);
        return (
          <RidgeSourceInstances
            castShadow={shadows}
            key={source.uuid}
            placements={placements.filter((placement) => placement.variant === variant)}
            source={source}
          />
        );
      })}
    </group>
  );
}

function RidgeGroundDetail({ shadows }: { shadows: boolean }) {
  const manifest = useRidgePlacements();
  const fern = useLoader(GLTFLoader, `${ASSET_ROOT}/fern_02/fern_02_1k.gltf`);
  const mossRock = useLoader(GLTFLoader, `${ASSET_ROOT}/rock_moss_set_02/rock_moss_set_02_1k.gltf`);
  const layers = useMemo(() => {
    const collect = (scene: Object3D) => {
      scene.updateMatrixWorld(true);
      const meshes: Mesh[] = [];
      scene.traverse((child) => {
        if (child instanceof Mesh) meshes.push(child);
      });
      return meshes;
    };
    return [
      { meshes: collect(fern.scene), placements: manifest.layers.ferns.filter((item) => item.z < -20).slice(0, 48) },
      { meshes: collect(mossRock.scene), placements: manifest.layers.mossRocks.filter((item) => item.z < -16).slice(0, 8) },
    ];
  }, [fern.scene, manifest, mossRock.scene]);

  return (
    <group name="Ridge v1.10 close fern and moss-rock detail">
      {layers.flatMap((layer, layerIndex) => layer.meshes.map((source, sourceIndex) => (
        <RidgeSourceInstances
          castShadow={shadows}
          key={`${layerIndex}-${source.uuid}`}
          placements={layer.placements.filter((item) => item.variant === sourceIndex)}
          source={source}
        />
      )))}
    </group>
  );
}

export function RidgeProductionV110({ mobile, shadows, tier }: RidgeProductionProps) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const canopyTimer = window.setTimeout(() => setStage(1), 280);
    const materialTimer = window.setTimeout(() => setStage(2), 1050);
    const heroTimer = window.setTimeout(() => setStage(3), 2150);
    return () => {
      window.clearTimeout(canopyTimer);
      window.clearTimeout(materialTimer);
      window.clearTimeout(heroTimer);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("madagin:ridge-stage", { detail: { stage } }));
  }, [stage]);

  return (
    <group name={`Madagin Ridge production benchmark v1.10 stage ${stage}`}>
      {stage < 2 ? <RidgeTerrainBase mobile={mobile} shadows={shadows} tier={tier} /> : null}
      {stage >= 1 ? <Suspense fallback={null}><RidgeCanopyImpostors mobile={mobile} tier={tier} /></Suspense> : null}
      {stage >= 2 ? (
        <Suspense fallback={<RidgeTerrainBase mobile={mobile} shadows={shadows} tier={tier} />}>
          <RidgeTerrainDetailed mobile={mobile} shadows={shadows} tier={tier} />
        </Suspense>
      ) : null}
      {stage >= 3 ? <Suspense fallback={null}><RidgeHeroCanopy mobile={mobile} shadows={shadows} tier={tier} /></Suspense> : null}
      {stage >= 3 && tier === "high" && !mobile ? <Suspense fallback={null}><RidgeGroundDetail shadows={shadows} /></Suspense> : null}
    </group>
  );
}
