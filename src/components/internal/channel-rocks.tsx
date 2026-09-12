"use client";

import {useLoader} from "@react-three/fiber";
import {useEffect, useLayoutEffect, useMemo, useRef} from "react";
import {Color, FrontSide, InstancedMesh, Mesh, MeshStandardMaterial, Object3D} from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {normalizeChannelRock} from "./channel-rock-geometry";
import placementData from "./channel-rock-placements.json";
import sourceBank from "./source-bank-placements.json";
import {valleyGroundOffset,useValleyGrounding} from "./valley-hollows";

export const CHANNEL_ROCKS_VERSION = "channel-rocks-1";
export const CHANNEL_ROCKS_SOURCE = "/world/canopy-v1/moss-rock.glb";
type Placement = {family: string; x: number; y: number; z: number; yaw: number; size: number; squash: number; tint: number};
type Part = {family: string; geometry: Mesh["geometry"]; material: MeshStandardMaterial};

function RockBatch({part, placements, shadows,compact}: {part: Part; placements: Placement[]; shadows: boolean;compact:boolean}) {
  const groundingRevision=useValleyGrounding();
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const transform = new Object3D(), color = new Color();
    placements.forEach((p, i) => {
      transform.position.set(p.x, p.y+valleyGroundOffset(p.x,p.z,compact), p.z);
      transform.rotation.set(0, p.yaw, 0);
      transform.scale.set(p.size, p.size * p.squash, p.size);
      transform.updateMatrix();
      ref.current!.setMatrixAt(i, transform.matrix);
      ref.current!.setColorAt(i, color.setRGB(p.tint, p.tint, p.tint));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [placements,compact,groundingRevision]);
  return <instancedMesh ref={ref} args={[part.geometry, part.material, placements.length]} castShadow={shadows} receiveShadow />;
}

export function ChannelRocks({compact, shadows, onReady}: {compact: boolean; shadows: boolean; onReady: () => void}) {
  const {scene} = useLoader(GLTFLoader, CHANNEL_ROCKS_SOURCE, loader => loader.setMeshoptDecoder(MeshoptDecoder));
  const parts = useMemo(() => {
    scene.updateMatrixWorld(true);
    const result: Part[] = [];
    scene.traverse(child => {
      if (!(child instanceof Mesh)) return;
      const source = Array.isArray(child.material) ? child.material[0] : child.material;
      const material = (source as MeshStandardMaterial).clone();
      material.color.set("#b4b9ad");
      material.emissive.set("#000000");
      material.metalness = 0;
      material.roughness = .92;
      material.envMapIntensity = .55;
      material.side = FrontSide;
      result.push({family: child.name, geometry: normalizeChannelRock(child.geometry, child.matrixWorld), material});
    });
    return result;
  }, [scene]);
  const batches = useMemo(() => {
    const key = compact ? "compact" : "desktop";
    const placements = [...placementData[key], ...sourceBank[key].rocks];
    return parts.map(part => ({part, placements: placements.filter(p => p.family === part.family)}));
  }, [parts, compact]);
  useEffect(() => {
    document.documentElement.dataset.madaginChannelRocks = JSON.stringify({version: CHANNEL_ROCKS_VERSION, compact, count: batches.reduce((n, b) => n + b.placements.length, 0), sourceBank: sourceBank.version, sourceBankRocks: sourceBank[compact ? "compact" : "desktop"].rocks.length, source: CHANNEL_ROCKS_SOURCE, placement: "offline-triangle-fit"});
    onReady();
    return () => {delete document.documentElement.dataset.madaginChannelRocks;};
  }, [batches, compact, onReady]);
  useEffect(() => () => {parts.forEach(part => {part.geometry.dispose(); part.material.dispose();});}, [parts]);
  return <group name="Grounded channel rock groups">{batches.map(batch => <RockBatch key={batch.part.family} {...batch} shadows={shadows} compact={compact} />)}</group>;
}
