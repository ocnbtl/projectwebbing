"use client";

import {useFrame, useLoader} from "@react-three/fiber";
import {useEffect, useLayoutEffect, useMemo, useRef} from "react";
import {Color, DoubleSide, InstancedMesh, Mesh, MeshDepthMaterial, MeshStandardMaterial, Object3D, RGBADepthPacking} from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {normalizeRiparianPlant} from "./riparian-plant-geometry";
import {RootedTrees} from "./rooted-trees";
import data from "./riparian-placements.json";
import bank from "./groundcover-bank-placements.json";
import canopy from "./bank-canopy-placements.json";
import understory from "./bank-understory-placements.json";
import sourceBank from "./source-bank-placements.json";

type Plant = {family: string; x: number; y: number; z: number; yaw: number; height: number; tint: number};
type Part = {family: string; geometry: Mesh["geometry"]; material: MeshStandardMaterial; depth: MeshDepthMaterial; update: (time: number) => void};

function FernBatch({part, plants, shadows}: {part: Part; plants: Plant[]; shadows: boolean}) {
  const ref = useRef<InstancedMesh>(null);
  useFrame(({clock}) => {part.update(clock.elapsedTime);});
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const transform = new Object3D(), color = new Color();
    plants.forEach((p, i) => {
      transform.position.set(p.x, p.y, p.z);
      transform.rotation.set(0, p.yaw, 0);
      transform.scale.setScalar(p.height);
      transform.updateMatrix();
      mesh.setMatrixAt(i, transform.matrix);
      mesh.setColorAt(i, color.setRGB(p.tint, p.tint, p.tint));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    // Covers the bounded wind displacement at the tallest accepted size.
    if (mesh.boundingSphere) mesh.boundingSphere.radius += .15;
  }, [plants]);
  return <instancedMesh ref={ref} args={[part.geometry, part.material, plants.length]} customDepthMaterial={part.depth} castShadow={shadows} receiveShadow />;
}

export function RiparianEcology({compact, shadows, onReady}: {compact: boolean; shadows: boolean; onReady: () => void}) {
  const {scene} = useLoader(GLTFLoader, "/world/canopy-v1/fern.glb", loader => loader.setMeshoptDecoder(MeshoptDecoder));
  const parts = useMemo(() => {
    scene.updateMatrixWorld(true);
    const result: Part[] = [];
    scene.traverse(child => {
      if (!(child instanceof Mesh)) return;
      const source = Array.isArray(child.material) ? child.material[0] : child.material;
      const material = (source as MeshStandardMaterial).clone(), time = {value: 0};
      material.color.set("#ffffff");
      material.emissive.set("#000000");
      material.metalness = 0;
      material.roughness = .88;
      material.envMapIntensity = .7;
      material.aoMapIntensity = .55;
      material.side = DoubleSide;
      material.alphaTest = .18;
      material.alphaToCoverage = true;
      material.transparent = false;
      material.depthWrite = true;
      material.onBeforeCompile = shader => {
        shader.uniforms.uRiparianTime = time;
        shader.vertexShader = `uniform float uRiparianTime;\n${shader.vertexShader}`.replace("#include <begin_vertex>", `#include <begin_vertex>
          vec3 root = (modelMatrix * instanceMatrix * vec4(0., 0., 0., 1.)).xyz;
          float flex = pow(clamp(position.y, 0., 1.), 2.);
          float gust = sin(uRiparianTime * .66 + root.x * .021 + root.z * .014)
            + .35 * sin(uRiparianTime * .29 - root.x * .008 + root.z * .019);
          transformed.x += gust * flex * .032;
          transformed.z += gust * flex * .011;
          transformed += normal * sin(uRiparianTime * 2.8 + position.x * 17. + position.z * 13.) * flex * .003;
        `);
      };
      material.customProgramCacheKey = () => "riparian-fern-wind-1";
      const depth = new MeshDepthMaterial({depthPacking: RGBADepthPacking, map: material.map, alphaTest: material.alphaTest, side: DoubleSide});
      depth.onBeforeCompile = (shader, renderer) => material.onBeforeCompile(shader, renderer);
      depth.customProgramCacheKey = () => "riparian-fern-depth-1";
      result.push({family: child.name, geometry: normalizeRiparianPlant(child.geometry, child.matrixWorld), material, depth, update: value => {time.value = value;}});
    });
    return result;
  }, [scene]);
  const selected = data[compact ? "compact" : "desktop"];
  const lower = understory[compact ? "compact" : "desktop"];
  const source = sourceBank[compact ? "compact" : "desktop"];
  const batches = useMemo(() => {
    const plants = [...selected.ferns, ...(compact ? [] : bank.ferns), ...lower.ferns, ...source.ferns];
    return parts.map(part => ({part, plants: plants.filter(p => p.family === part.family)}));
  }, [parts, selected, lower, source, compact]);
  useEffect(() => {
    document.documentElement.dataset.madaginRiparianEcology = JSON.stringify({version: "riparian-ecology-1", compact, ferns: selected.ferns.length, saplings: selected.saplings.length, placement: "offline-dry-bank-triangles"});
    document.documentElement.dataset.madaginGroundcoverBank = JSON.stringify({version: bank.version, count: compact ? 0 : bank.ferns.length, compact});
    document.documentElement.dataset.madaginBankUnderstory = JSON.stringify({version: understory.version, compact, ferns: lower.ferns.length, saplings: lower.saplings.length});
    document.documentElement.dataset.madaginSourceBank = JSON.stringify({version: sourceBank.version, compact, rocks: source.rocks.length, ferns: source.ferns.length, trees: source.trees.length, placement: "actual-terrain-and-trunk-footprint", assets: "retained"});
    onReady();
    return () => {delete document.documentElement.dataset.madaginRiparianEcology; delete document.documentElement.dataset.madaginGroundcoverBank; delete document.documentElement.dataset.madaginBankUnderstory; delete document.documentElement.dataset.madaginSourceBank;};
  }, [compact, selected, lower, source, onReady]);
  useEffect(() => () => parts.forEach(p => {p.geometry.dispose(); p.material.dispose(); p.depth.dispose();}), [parts]);
  return <group name="Layered dry riverbank vegetation">
    {batches.map(batch => <FernBatch key={batch.part.family} {...batch} shadows={shadows} />)}
    <RootedTrees placements={selected.saplings} zone="riparian" compact={compact} shadows={shadows} />
    {/* Small crowns share the accepted efficient branching LOD on both tiers. */}
    <RootedTrees placements={canopy[compact ? "compact" : "desktop"]} zone="bank-canopy" compact={compact} efficient shadows={shadows} castFarShadows={!compact} />
    <RootedTrees placements={lower.saplings} zone="bank-understory" compact={compact} efficient shadows={shadows} castFarShadows={!compact} />
    <RootedTrees placements={source.trees} zone="source-bank" compact={compact} efficient shadows={shadows} castFarShadows={!compact} />
  </group>;
}
