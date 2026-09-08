import {LAKE_SHORE_VERSION, LAKE_SHORE_GLSL} from "./lake-shore";
import { useLoader } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { FrontSide, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, TextureLoader } from "three";
import type { Texture } from "three";

export const TERRAIN_SURFACE = {
  version: "scanned-surface-1",
  rockTileMeters: 80,
  geometryChanged: false,
  sources: ["/world/cliff-material-v1/color.webp", "/world/cliff-material-v1/normal.webp", "/world/cliff-material-v1/response.webp", "/world/canopy-v1/forest-color.webp"],
  compactSources: ["/world/cliff-material-v1/color-compact.webp", "/world/cliff-material-v1/normal-compact.webp", "/world/cliff-material-v1/response-compact.webp", "/world/cliff-material-v1/ground-compact.webp"],
} as const;

// One world-space projection controls color, roughness, occlusion and normal
// detail. UV islands on the inherited geometry never enter this material.
export function createTerrainSurface(textures: Texture[]) {
  const material = new MeshStandardMaterial({color: "white", roughness: 1, metalness: 0, side: FrontSide});
  material.name = "Madagin scanned rock and slope cover";
  material.customProgramCacheKey = () => TERRAIN_SURFACE.version + LAKE_SHORE_VERSION;
  material.onBeforeCompile = shader => {
    ["uCliffColor", "uCliffNormal", "uCliffResponse", "uGroundColor"].forEach((name, i) => {shader.uniforms[name] = {value: textures[i]};});
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vGroundWorld; varying vec3 vGroundNormal;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvGroundWorld = (modelMatrix * vec4(transformed, 1.0)).xyz; vGroundNormal = inverseTransformDirection(transformedNormal, viewMatrix);");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
        ${LAKE_SHORE_GLSL}
        varying vec3 vGroundWorld; varying vec3 vGroundNormal;
        uniform sampler2D uCliffColor, uCliffNormal, uCliffResponse, uGroundColor;
        vec3 groundWeights(vec3 n) {
          vec3 w = pow(abs(n), vec3(4.0));
          return w / max(dot(w, vec3(1.0)), 0.0001);
        }
        vec3 groundSample(sampler2D source, vec3 p, vec3 w, float meters) {
          return texture2D(source, p.zy / meters).rgb * w.x
            + texture2D(source, p.xz / meters).rgb * w.y
            + texture2D(source, p.xy / meters).rgb * w.z;
        }
        // Convert each sampled normal to a surface height gradient. Projection
        // derivatives transport all three gradients into the SAME view basis.
        // This preserves the macro normal and avoids axis seams and inverted
        // tangent normals on negative-facing or steep terrain.
        vec2 groundSlope(vec2 plane) {
          vec3 n = texture2D(uCliffNormal, plane / 80.0).xyz * 2.0 - 1.0;
          vec2 gradient = -n.xy / max(n.z, 0.25);
          return vec2(dot(gradient, dFdx(plane)), dot(gradient, dFdy(plane)));
        }
      `)
      .replace("#include <map_fragment>", `#include <map_fragment>
        vec3 terrainNormal = normalize(vGroundNormal);
        vec3 terrainWeights = groundWeights(terrainNormal);
        vec3 cliff = groundSample(uCliffColor, vGroundWorld, terrainWeights, 80.0);
        vec3 response = groundSample(uCliffResponse, vGroundWorld, terrainWeights, 80.0);
        vec3 ground = groundSample(uGroundColor, vGroundWorld, terrainWeights, 6.0);
        float cover = smoothstep(0.36, 0.82, abs(terrainNormal.y));
        // Existing water authorities: wet waterfall headwall and sea contact.
        float waterfall = (1.0 - smoothstep(0.6, 1.2, length(vec2((vGroundWorld.x-151.0)/82.0, (vGroundWorld.z+696.0)/62.0))))
          * (1.0 - smoothstep(10.0, 35.0, vGroundWorld.y));
        float coastX = -690.0 + sin(vGroundWorld.z*.012+.8)*18.0
          + sin(vGroundWorld.z*.029-1.3)*7.5 + sin(vGroundWorld.z*.061+.35)*2.8;
        float coastWet = (1.0 - smoothstep(2.0, 19.0, vGroundWorld.x-coastX))
          * (1.0 - smoothstep(-7.0, 6.0, vGroundWorld.y));
        vec2 basin = lakeShore(vGroundWorld.xz);
        float lakeMargin = (1.0-smoothstep(1.12,1.24,basin.x))
          * (1.0-smoothstep(-46.9,-44.5,vGroundWorld.y));
        float lakeWet = lakeMargin*(1.0-smoothstep(-47.8,-46.5,vGroundWorld.y));
        float surfaceWet = max(max(waterfall * .55, coastWet * .8), lakeWet * .34);
        // Bounded authored reflectance adjustment keeps the generic scan's
        // contrast while placing it beside this world's shaded forest. This
        // is an art-directed material, not measured Hawaiian rock reflectance.
        vec3 soil = ground * vec3(.26, .52, .23);
        vec3 weatheredRock = cliff * vec3(.58, .65, .64);
        // Exposed low banks reveal damp mineral soil instead of grass growing
        // beneath the lake. The scanned detail and common sun remain active.
        vec3 shoreSoil = mix(cliff * vec3(.49,.46,.37), ground * vec3(.33,.34,.21), .32);
        vec3 groundCover = mix(soil, shoreSoil, lakeMargin * (.35 + .5 * response.r));
        diffuseColor.rgb = mix(weatheredRock, groundCover, cover * .96) * mix(1.0, .56, surfaceWet);
      `)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
        roughnessFactor = clamp(mix(response.g, .94, cover) - surfaceWet * .18, .52, .98);
      `)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        vec2 surfaceSlope = groundSlope(vGroundWorld.zy) * terrainWeights.x
          + groundSlope(vGroundWorld.xz) * terrainWeights.y
          + groundSlope(vGroundWorld.xy) * terrainWeights.z;
        vec3 dx = dFdx(-vViewPosition), dy = dFdy(-vViewPosition);
        vec3 r1 = cross(dy, normal), r2 = cross(normal, dx);
        float determinant = dot(dx, r1);
        if (abs(determinant) > 1e-8) {
          vec3 gradient = (surfaceSlope.x * r1 + surfaceSlope.y * r2) / determinant;
          normal = normalize(normal - gradient * mix(.72, .20, cover));
        }
      `)
      .replace("#include <aomap_fragment>", `#include <aomap_fragment>
        reflectedLight.indirectDiffuse *= mix(.56 + .44 * response.r, 1.0, cover);
      `);
  };
  return material;
}

export function useTerrainSurface(compact = false) {
  const source = useLoader(TextureLoader, [...(compact ? TERRAIN_SURFACE.compactSources : TERRAIN_SURFACE.sources)]);
  const textures = useMemo(() => source.map((texture, i) => {
    const clone = texture.clone();
    clone.wrapS = clone.wrapT = RepeatWrapping;
    clone.anisotropy = 4;
    if (i === 0 || i === 3) clone.colorSpace = SRGBColorSpace;
    clone.needsUpdate = true;
    return clone;
  }), [source]);
  const material = useMemo(() => createTerrainSurface(textures), [textures]);
  useEffect(() => {
    document.documentElement.dataset.madaginTerrainSurface = JSON.stringify({...TERRAIN_SURFACE, textureResolution: compact ? 512 : 1024, activeSources: compact ? TERRAIN_SURFACE.compactSources : TERRAIN_SURFACE.sources});
    return () => {material.dispose(); textures.forEach(texture => texture.dispose());};
  }, [compact, material, textures]);
  return material;
}
