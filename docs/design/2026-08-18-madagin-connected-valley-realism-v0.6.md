# Madagin connected valley realism v0.6

## Status

Local internal-world prototype. This pass is verified for review, but it is not a production-art approval and has not been pushed or deployed.

## What changed

- Replaced the small benchmark ground with one connected `270 x 310 m` adaptive terrain surface extending from the opening ridge through the lake basin, waterfall shelf, distant ranges, summit corridor, and western ocean.
- Rebuilt the terrain height function around an irregular valley axis, macro mountain masses, a carved lake basin, an upper river shelf, a waterfall drop, and spatially varied erosion.
- Expanded the camera rail so the five checkpoints occupy meaningfully different parts of the world instead of orbiting one small set.
- Added 1,120 authored fir impostors on the high tier, six rendered variants, 260 derived broadleaf impostors, fourteen close authored fir meshes, and height/slope/water exclusion rules.
- Added layered ground ecology: ferns, shrubs, moss clusters, mossy stones, grass tufts, and fallen deadwood. High tier uses 5,200 grass tufts while the balanced and conservative tiers reduce density.
- Rebuilt water as a carved, irregular lake. The detailed upstream river, waterfall lip, rock outcrop, fall, plunge pool, and mist load only at the waterfall checkpoint so the long-distance valley composition stays clean.
- Shifted terrain, tree, and foliage materials toward physically based local textures with lighter fill and authored alpha masks.

## Asset and runtime policy

- Runtime assets are local. No Poly Haven API or CDN request occurs in the scene.
- Imported ecology assets are Poly Haven CC0 1.0 and have file-level provenance beside each asset.
- Broadleaf tree impostors are locally rendered derivatives of the CC0 Shrub 04 asset. Fir impostors are locally rendered from the existing authored fir tree kit.
- High, balanced, and conservative tiers select terrain tessellation, ecology counts, shadow policy, and display ratio at load.

## Verification snapshot

| View | Viewport | Tier | FPS | Calls | Submitted triangles |
|---|---:|---|---:|---:|---:|
| Ridge approach | 1440 x 1000 | high | 60 | 120 | 3,678,919 |
| Valley reveal | 1440 x 1000 | high | 60 | 77 | 3,117,146 |
| Ridge approach | 390 x 844 | balanced | 60 | 78 | 1,419,527 |

- Browser console: zero errors; one upstream `THREE.Clock` deprecation warning from the current renderer dependency.
- `pnpm check`: passed lint, TypeScript, and the optimized Next.js production build.
- Evidence:
  - `output/playwright/madagin-v06/ridge-desktop.png`
  - `output/playwright/madagin-v06/valley-reveal-desktop.png`
  - `output/playwright/madagin-v06/ridge-mobile.png`

## Known limits before production art

- The opening and reveal now establish scale, density, and the camera language, but they are still a web-world prototype rather than final photoreal environment art.
- The waterfall checkpoint is structurally grounded and connected; its rock outcrop and water shader still need a dedicated Blender sculpt, baked mesh LODs, foam/depth treatment, and art-directed mist before production approval.
- The broadleaf family is suitable for composition testing, but final vegetation should add at least two authored deciduous species and improve near-camera canopy shading.
- Texture compression, mesh compression, progressive asset groups, and true distance LOD transitions remain to be completed before public integration.
- Physical iOS, Android, integrated-GPU, and throttled-network tests have not yet been run.
- Nothing in this pass changes the public site or production deployment.
