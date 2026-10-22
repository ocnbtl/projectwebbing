"use client";

import {useLoader} from "@react-three/fiber";
import {useMemo} from "react";
import {BufferGeometry, FileLoader} from "three";
import config from "../../../public/world/ridge-field-v1/manifest.json";

export function useRidgeSurface() {
  const bytes = useLoader(FileLoader, "/world/ridge-field-v1/surface.f32", loader => loader.setResponseType("arraybuffer")) as unknown as ArrayBuffer;
  return useMemo(() => {
    if (bytes.byteLength !== config.grid ** 2 * 16) throw new Error("Invalid ridge surface");
    const values = new Float32Array(bytes);
    const sample = (x: number, z: number, channel = 0) => {
      const [left, right, near, far] = config.bounds;
      if (x < left || x > right || z < near || z > far) return channel === 1 ? 0 : NaN;
      const px = Math.min(config.grid - 1.001, (x - left) / (right - left) * (config.grid - 1));
      const pz = Math.min(config.grid - 1.001, (z - near) / (far - near) * (config.grid - 1));
      const ix = Math.floor(px), iz = Math.floor(pz), fx = px - ix, fz = pz - iz;
      const i = (iz * config.grid + ix) * 4 + channel, stride = config.grid * 4;
      return (values[i] * (1-fx) + values[i+4] * fx) * (1-fz)
        + (values[i+stride] * (1-fx) + values[i+stride+4] * fx) * fz;
    };
    return {values, sample};
  }, [bytes]);
}

export type RidgeSurface = ReturnType<typeof useRidgeSurface>;

export function resolveRidgeSurface(geometry: BufferGeometry, field: RidgeSurface) {
  const position = geometry.getAttribute("position");
  let adjusted = 0;
  for (let i=0; i<position.count; i++) {
    const x=position.getX(i), z=position.getZ(i);
    if (field.sample(x,z,1) <= .001) continue;
    position.setY(i,field.sample(x,z)); adjusted++;
  }
  position.needsUpdate=true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.userData.sourceRidge={id:config.id, adjustedVertices:adjusted, sourceSha256:config.sourceSha256, authoredHybrid:true};
  return geometry;
}
