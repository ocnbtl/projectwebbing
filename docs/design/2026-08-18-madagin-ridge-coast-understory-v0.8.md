# Madagin ridge, coast, and understory v0.8

Status: internal World Lab implementation, not public-site integration or release.

## Intent

- Make the opening landform read as a real ridgeline before the camera crosses it.
- Preserve one continuous mountain journey while giving About a real west-facing ocean view from every saved checkpoint.
- Replace sparse, evenly distributed ground props with clustered Hawaiian wet-forest layers.
- Keep the browser scene viable through instancing, adaptive quality tiers, and a separate Blender geography source.

## Reference translation

- USGS describes the Na Pali coast as huge cliffs, knife-like ridges, and deep canyons shaped by collapse and erosion. The v0.8 ridge is therefore narrower, taller, asymmetric, and broken rather than a broad rounded berm: https://www.usgs.gov/news/volcano-watch-you-can-see-history-landscape-kauai
- USGS describes steep cliffs, large valleys, and erosion working together in Hawaiian landscapes. The west side is therefore an irregular coastal break instead of a mountain wall placed in front of a flat ocean: https://www.usgs.gov/observatories/hvo/news/volcano-watch-complex-interactions-between-air-and-land-help-shape-hawaii
- NPS notes that uluhe forms dense rainforest mats and builds soil. The visible floor therefore uses continuous fern/shrub cards, close-range real meshes, moss, rocks, tufts, and fallen wood rather than isolated trees on bare ground: https://www.nps.gov/havo/learn/nature/ferns.htm
- Hawaiʻi DLNR lists ferns, hāpuʻu, loulu, ʻōhiʻa, koa, maile, and multiple understory shrubs among common native plants. The current model kit is still a visual proxy, but the structure now supports that level of future species variety: https://dlnr.hawaii.gov/forestry/plants/

## Geography contract

- Opening ridge center: runtime z approximately 12.
- Opening camera: `[0, 29.5, 82]`; aim: `[0, 19.5, 10.5]`.
- Reveal camera: `[3.5, 43, 1.5]`; it is physically beyond the ridge rather than looking through it from behind.
- West coastline: irregular x approximately -66 with multi-frequency erosion offsets.
- Terrain is lowered below the ocean plane west of the coast; the ocean is not layered underneath an unmodified mountain.
- About preserves camera position and rotates toward a checkpoint-specific point in the western ocean.

## Ecology and production policy

- Close anchors: CC0 fern, shrub, moss, moss-rock, and fallen-deadwood geometry.
- Density layers: crossed fern/shrub cards and top-down crown cards, grouped into a small number of instanced draw calls.
- High tier: full density, desktop shadows, adaptive DPR up to 1.5.
- Balanced tier: reduced real geometry and card counts.
- Conservative tier: aggressively reduced counts, DPR, and no expensive shadow path.
- The 4.05 MB v0.8 GLB is a Blender geography benchmark and is not imported by the browser prototype; it therefore adds no runtime transfer today.

## Blender source of truth

- Generator: `tools/blender/build_madagin_ridge_coast_benchmark_v08.py`
- Source scene: `world-source/madagin-ridge-coast-benchmark-v0.8.blend`
- Benchmark export: `public/world/v08/madagin-ridge-coast-benchmark-v0.8.glb`
- Cameras in Blender: Ridge approach, Valley reveal, About / west ocean.
- Browser terrain and Blender terrain share the same deterministic heightfield equations.

## Current acceptance boundary

- The ridgeline is readable before the crest and the reveal camera crosses it.
- About shows open ocean from the ridge checkpoint instead of a mountain wall.
- The ground and valley walls receive denser foliage layers with fewer visible bare regions.
- This remains an internal realism prototype. Water shading, waterfall geometry, species-specific Hawaiian models, atmospheric cloud layers, and final production compression remain later passes.
