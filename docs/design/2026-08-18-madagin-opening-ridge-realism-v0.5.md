# Madagin opening-ridge realism checkpoint v0.5

## Status

`READY FOR OWNER REALISM REVIEW — NOT FINAL, NOT PUBLIC, NOT DEPLOYED`

This checkpoint narrows the protected World Lab to the exact frame Ocean asked to review first: a dark forest ridge that withholds the valley until the next camera state. It is a local approval surface, not evidence that the full journey or production payload is complete.

## What changed

- Replaced the close-camera procedural fir stand-ins with three different authored `LOD2` Fir Tree 01 silhouettes from Poly Haven.
- Corrected the foliage pipeline to use the dedicated twig alpha map rather than the packed material mask that created visible cards.
- Added an asymmetric Blender-generated ridge crest that occludes the lake, waterfall, distant terrain, and benchmark mountain masses on load.
- Added a locally loaded Forest Ground 03 pine-needle PBR material for the ridge surface.
- Added a small Rock 09 CC0 detail layer, kept away from the central camera corridor.
- Disabled the procedural distance forest and old generated ridge/rock stand-ins in the approval slice because they reduced realism.
- Reframed the opening camera to glide level with the ridge instead of looking down into the valley prematurely.
- Preserved the existing authenticated World Lab, camera-state controls, HTML captions, WebGL fallback, adaptive DPR, and OS-driven reduced-motion behavior.

## Licensed sources

| Asset | Source | License | Runtime policy |
|---|---|---|---|
| Fir Tree 01 | https://polyhaven.com/a/fir_tree_01 | CC0 | Authored A-C `LOD2` geometry plus verified local 1K maps. The 219 MB source Blend stays in the ignored vendor cache. |
| Forest Ground 03 | https://polyhaven.com/a/forrest_ground_03 | CC0 | Verified local 1K diffuse, normal, and ARM maps. |
| Rock 09 | https://polyhaven.com/a/rock_09 | CC0 | Verified local 1K glTF, binary geometry, and material maps. |

Exact source URLs, byte counts, and published/local MD5 values are stored beside each asset in its `PROVENANCE.md` file. There is no runtime Poly Haven API or CDN dependency.

## Deterministic outputs

| Output | Bytes | SHA-256 |
|---|---:|---|
| `public/world/v05/madagin-fir-tree-kit-v0.5.glb` | 6,138,672 | `d4b531c59522b4a012a1bc2de917b16f1b68fe680e8298c5b4d78721f1af19d8` |
| `public/world/v05/madagin-opening-ridge-benchmark-v0.5.glb` | 3,899,892 | `d2cce71b2f984626d9a4c0b84fbd94e50734377cc7dd41e71fe588682cc0b008` |

Generators:

- `tools/blender/build_madagin_fir_tree_kit_v05.py`
- `tools/blender/build_madagin_opening_ridge_v05.py`

Blender 5.2 completed both uncompressed GLB exports. Blender's bundled `gltfpack` post-process failed on this Windows environment with `WinError 87`; the experiment was removed and both outputs were regenerated successfully without that post-process.

## Browser evidence

| Check | Result |
|---|---|
| Desktop opening, 1440×1000 | 60 FPS, 84 calls, 1,055,951 submitted triangles, high tier. |
| Desktop reveal | 60 FPS, 60 calls, 674,890 submitted triangles after benchmark stand-ins were disabled. |
| Mobile opening, 390×844 | 60 FPS, 42–44 calls, 551,734 submitted triangles, balanced tier. |
| Console | Zero errors. One upstream `THREE.Clock` deprecation warning from the current renderer dependency. |
| Authentication | The World Lab remained behind the existing password-only internal workspace flow. |

The browser evidence is from one local Chromium environment. It does not replace representative physical-device testing.

## Payload boundary

The currently referenced v0.5 geometry and source-resolution textures total 21,585,475 bytes (20.59 MiB) before HTTP transfer compression and caching. This is acceptable for the protected realism checkpoint but not yet the target public first-load budget.

Before public integration:

1. Produce mesh-optimized/quantized GLBs with a Windows-stable toolchain.
2. Convert runtime PBR maps to KTX2/Basis or another measured GPU-friendly format.
3. Split the opening ridge into a preload group and lazy-load valley/reveal assets only when the journey advances.
4. Add a purpose-built low-poly distant forest rather than restoring the rejected procedural bough field.
5. Re-test on representative iOS Safari, Android Chrome, and integrated-GPU laptops.

## Owner review questions

Ocean owns the visual decision. Review the opening frame in `/internal/world-lab` and decide:

1. Does the ridge feel plausible and cinematic enough to lock its silhouette and camera height?
2. Should the opening be denser and more enclosed by trees, or should it preserve the current breathing room?
3. Is the pine-needle floor the right ecological texture, or should the ridge read wetter, greener, and more rainforest-like?
4. Is the dark blue-green hour correct, or should the first frame carry more visible golden-hour rim light?

## Known limitations

- The opening is reviewable, but it is not yet photoreal final art.
- The valley reveal still uses macro benchmark terrain, lake, and waterfall geometry and must receive its own asset-quality pass after the ridge is approved.
- The current tree kit is appropriate for this camera distance, not extreme closeups.
- Mesh and texture compression remain unresolved for the public payload.
- No public route, production environment, Git remote, or Vercel deployment was changed in this phase.
