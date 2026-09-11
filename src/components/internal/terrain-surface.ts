import {CASCADE_VERSION,CASCADE_GLSL} from "./cascade-contact";
import {PLUNGE_BASIN_VERSION, PLUNGE_BASIN_GLSL} from "./plunge-basin";
import {LAKE_SHORE_VERSION, LAKE_SHORE_GLSL} from "./lake-shore";
import { useLoader } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { FrontSide, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, TextureLoader } from "three";
import type { Texture } from "three";
import {FOREST_COVER, forestCoverTexture} from "./forest-cover";

export const TERRAIN_SURFACE = {
  version: "ground-substrate-1",
  rockTileMeters: 80,
  groundTileMeters: 15,
  groundDataResolution: 256,
  coverMethod: "scan-oriented slope and cavity support",
  geometryChanged: false,
  sources: ["/world/cliff-material-v1/color.webp", "/world/cliff-material-v1/normal.webp", "/world/cliff-material-v1/response.webp", "/world/canopy-v1/rock-color.webp", "/world/ground-substrate-v1/normal.webp", "/world/ground-substrate-v1/response.webp"],
  compactSources: ["/world/cliff-material-v1/color-compact.webp", "/world/cliff-material-v1/normal-compact.webp", "/world/cliff-material-v1/response-compact.webp", "/world/ground-substrate-v1/color-compact.webp", "/world/ground-substrate-v1/normal.webp", "/world/ground-substrate-v1/response.webp"],
} as const;

// One world-space projection controls color, roughness, occlusion and normal
// detail. UV islands on the inherited geometry never enter this material.
export function createTerrainSurface(textures: Texture[]) {
  const material = new MeshStandardMaterial({color: "white", roughness: 1, metalness: 0, side: FrontSide});
  material.name = "Madagin scanned rock and slope cover";
  material.customProgramCacheKey = () => TERRAIN_SURFACE.version + LAKE_SHORE_VERSION + PLUNGE_BASIN_VERSION + CASCADE_VERSION + FOREST_COVER.version;
  material.onBeforeCompile = shader => {
    shader.uniforms.uForestCover={value:forestCoverTexture};
    ["uCliffColor", "uCliffNormal", "uCliffResponse", "uGroundColor", "uGroundNormal", "uGroundResponse"].forEach((name, i) => {shader.uniforms[name] = {value: textures[i]};});
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vGroundWorld; varying vec3 vGroundNormal;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvGroundWorld = (modelMatrix * vec4(transformed, 1.0)).xyz; vGroundNormal = inverseTransformDirection(transformedNormal, viewMatrix);");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
        ${LAKE_SHORE_GLSL}
        ${PLUNGE_BASIN_GLSL}
        ${CASCADE_GLSL}
        varying vec3 vGroundWorld; varying vec3 vGroundNormal;
        uniform sampler2D uCliffColor, uCliffNormal, uCliffResponse, uGroundColor, uGroundNormal, uGroundResponse;
        uniform sampler2D uForestCover;
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
        vec2 groundSlope(sampler2D source, vec2 plane, float meters) {
          vec3 n = texture2D(source, plane / meters).xyz * 2.0 - 1.0;
          vec2 gradient = -n.xy / max(n.z, 0.25);
          return vec2(dot(gradient, dFdx(plane)), dot(gradient, dFdy(plane)));
        }
      `)
      .replace("#include <map_fragment>", `#include <map_fragment>
        vec3 terrainNormal = normalize(vGroundNormal);
        vec3 terrainWeights = groundWeights(terrainNormal);
        vec3 cliff = groundSample(uCliffColor, vGroundWorld, terrainWeights, ${TERRAIN_SURFACE.rockTileMeters.toFixed(1)});
        vec3 response = groundSample(uCliffResponse, vGroundWorld, terrainWeights, ${TERRAIN_SURFACE.rockTileMeters.toFixed(1)});
        vec3 ground = groundSample(uGroundColor, vGroundWorld, terrainWeights, ${TERRAIN_SURFACE.groundTileMeters.toFixed(1)});
        vec3 groundResponse = groundSample(uGroundResponse, vGroundWorld, terrainWeights, ${TERRAIN_SURFACE.groundTileMeters.toFixed(1)});
        // Transport the scan slope once in world space. Both cover and lighting
        // then respond to the same rock faces instead of painting an unbroken
        // green film across every interpolated upward-facing mesh normal.
        vec2 surfaceSlope = groundSlope(uCliffNormal, vGroundWorld.zy, 80.0) * terrainWeights.x
          + groundSlope(uCliffNormal, vGroundWorld.xz, 80.0) * terrainWeights.y
          + groundSlope(uCliffNormal, vGroundWorld.xy, 80.0) * terrainWeights.z;
        vec2 substrateSlope = groundSlope(uGroundNormal, vGroundWorld.zy, 15.0) * terrainWeights.x
          + groundSlope(uGroundNormal, vGroundWorld.xz, 15.0) * terrainWeights.y
          + groundSlope(uGroundNormal, vGroundWorld.xy, 15.0) * terrainWeights.z;
        vec3 surfaceDx = dFdx(vGroundWorld), surfaceDy = dFdy(vGroundWorld);
        vec3 surfaceR1 = cross(surfaceDy, terrainNormal), surfaceR2 = cross(terrainNormal, surfaceDx);
        float surfaceDeterminant = dot(surfaceDx, surfaceR1);
        vec3 surfaceGradient = vec3(0.0);
        vec3 substrateGradient = vec3(0.0);
        if (abs(surfaceDeterminant) > 1e-8) {
          surfaceGradient = (surfaceSlope.x * surfaceR1 + surfaceSlope.y * surfaceR2) / surfaceDeterminant;
          substrateGradient = (substrateSlope.x * surfaceR1 + substrateSlope.y * surfaceR2) / surfaceDeterminant;
        }
        vec3 supportNormal = normalize(terrainNormal - surfaceGradient * .55);
        float supportSlope = mix(abs(terrainNormal.y), abs(supportNormal.y), .45);
        // AO is only a bounded cavity cue, not measured soil depth or ecology.
        float cover = smoothstep(.45, .88, supportSlope + (.7 - response.r) * .12);
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
        vec2 pool=plungeBasin(vGroundWorld.xz);
        float poolMargin=(1.0-smoothstep(1.03,1.28,pool.x))*(1.0-smoothstep(-42.8,-39.5,vGroundWorld.y));
        float poolWet=poolMargin*(1.0-smoothstep(-44.0,-42.5,vGroundWorld.y));
        float cascade=cascadeWet(vGroundWorld.xz);
        cover*=1.0-max(poolMargin,cascade)*.98;
        float surfaceWet = max(max(waterfall * .55, coastWet * .8), max(max(lakeWet * .34,poolWet*.6),cascade*.82));
        // Bounded authored reflectance adjustment keeps the generic scan's
        // contrast while placing it beside this world's shaded forest. This
        // is an art-directed material, not measured Hawaiian rock reflectance.
        vec3 soil = ground * vec3(.58, .76, .52);
        vec3 weatheredRock = cliff * vec3(.58, .65, .64);
        // Exposed low banks reveal damp mineral soil instead of grass growing
        // beneath the lake. The scanned detail and common sun remain active.
        vec3 shoreSoil = mix(cliff * vec3(.49,.46,.37), ground * vec3(.33,.34,.21), .32);
        vec3 groundCover = mix(soil, shoreSoil, lakeMargin * (.35 + .5 * response.r));
        vec2 forestUv=(vGroundWorld.xz-vec2(${FOREST_COVER.minX.toFixed(1)},${FOREST_COVER.minZ.toFixed(1)}))/vec2(${FOREST_COVER.width.toFixed(1)},${FOREST_COVER.depth.toFixed(1)});
        vec2 forest=texture2D(uForestCover,forestUv).rg;
        float forestGround=forest.g/max(forest.r,.01)*${FOREST_COVER.heightRange.toFixed(1)}+${FOREST_COVER.heightMin.toFixed(1)};
        float shelter=smoothstep(.08,.7,forest.r)*(1.-smoothstep(3.,10.,abs(vGroundWorld.y-forestGround)));
        shelter*=step(0.,forestUv.x)*step(forestUv.x,1.)*step(0.,forestUv.y)*step(forestUv.y,1.);
        shelter*=1.-max(lakeMargin,max(poolMargin,cascade));
        // Litter and restrained ambient contact beneath the actual crowns.
        groundCover=mix(groundCover,ground*vec3(.29,.30,.18),shelter*.82);
        diffuseColor.rgb = mix(weatheredRock, groundCover, cover * .96) * mix(1.0, .56, surfaceWet);
      `)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
        roughnessFactor = clamp(mix(response.g, groundResponse.g, cover) - surfaceWet * .18, .52, .98);
      `)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        vec3 detailGradient = mix(surfaceGradient * .72, substrateGradient * .48, cover);
        normal = normalize(normal - mat3(viewMatrix) * detailGradient);
      `)
      .replace("#include <aomap_fragment>", `#include <aomap_fragment>
        reflectedLight.indirectDiffuse *= .56 + .44 * mix(response.r, groundResponse.r, cover);
        reflectedLight.indirectDiffuse *= 1.-shelter*.22;
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
