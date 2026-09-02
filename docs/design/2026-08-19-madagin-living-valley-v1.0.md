# Madagin living valley benchmark v1.0

Status: local world-lab and Blender benchmark; not imported by the public route and not deployed.

## Intent

This pass turns the v0.9 atmosphere, ocean, and ecology systems into visible parts of the authored journey. It focuses on the ridge approach, valley reveal, alpine lake, and the contextual western-ocean turn. The target remains a cinematic guided world rather than a freely explorable open world.

## Runtime systems

- Procedural Preetham daylight with a one-time PMREM capture for physically based image lighting on water, rock, terrain, and vegetation.
- Multi-axis animated cloud cards so cloud masses remain visible while facing the mountain journey, western ocean, or sky view.
- Four spatially separated fog ribbons, lighter exponential distance fog, valley particles, and denser waterfall spray.
- A four-band warped Gerstner-style Pacific surface with choppy displacement, capillary normal breakup, crest aeration, moving shoreline foam, and a broader golden-hour reflection path.
- An animated alpine-lake shader with small displacement, ripple normals, Fresnel response, cloud breakup, sun glint, and shallow-edge color.
- Embedded lake talus, rush habitat, photogrammetry waterfall rocks, and an adjusted aerial lake camera.
- A context-specific About rise that clears the rainforest canopy while preserving the saved journey checkpoint.

## Blender source

- Generator: `tools/blender/build_madagin_living_valley_v10.py`
- Editable source: `world-source/madagin-living-valley-v1.0.blend`
- Local inspection export: `world-source/exports/madagin-living-valley-v1.0.glb`

The inspection GLB is gitignored and is not requested by the browser. Blender weather volumes and material graphs cannot be represented with full fidelity in glTF; the runtime recreates them with quality-tiered shaders and instances.

The Blender source contains:

- three procedural cloud volumes and four valley-weather volumes;
- a two-scale displaced Pacific surface;
- an irregular reflective alpine lake;
- 320 linked lake-edge rushes and 92 linked photogrammetry lake rocks;
- 76 linked photogrammetry waterfall and plunge-pool rocks;
- the existing 236 linked Pachira specimens and 108 regional outcrops;
- ridge, reveal, alpine-lake, and lake-to-ocean inspection cameras.

## Quality policy

| System | High | Balanced | Conservative | Mobile-balanced |
| --- | ---: | ---: | ---: | ---: |
| Mountain-facing cloud layers | 3 | 2 | 1 | 2 |
| West-facing cloud layers | 3 | 2 | 1 | 2 |
| Valley fog ribbons | 4 | 3 | 2 | 3 |
| Ocean grid | 192 × 192 | 128 × 128 | 64 × 64 | 80 × 80 |
| Lake-edge rocks | 92 | 58 | 30 | 58 |
| Lake-edge rushes | 320 | 180 | 86 | 180 |

## Acceptance checks

- Ridge, valley, lake, ocean, and sky states compile with no WebGL shader errors.
- Cloud structure remains visible from both the journey and western-ocean directions.
- Ocean displacement and reflected light read in still captures and continue moving in runtime.
- The lake is not a flat single-color polygon and its shore contains irregular habitat detail.
- The About turn clears foreground canopy from the ridge, reveal, and lake checkpoints.
- Desktop median remains at or above 50 FPS.
- Balanced mobile remains at or above 30 FPS without a sustained sub-24 FPS interval.
- Existing internal authentication, semantic controls, saved journey state, reduced-motion handling, and WebGL fallback remain intact.

## Local verification evidence

- Desktop high tier, 1440 × 1000: ridge, valley, lake, and contextual ocean states each stabilized at 60 FPS. The observed draw-call range was 94–113.
- Mobile balanced tier, 390 × 844: ridge, valley, lake, and contextual ocean states each stabilized at 60 FPS. The observed draw-call range was 59–84.
- Mobile triangle counts were approximately 1.80 million at the ridge, 1.55 million in the valley/lake, and 1.31 million in the ocean view.
- The fresh browser pass reported zero console errors. The two warnings were the upstream Three.js `Clock` deprecation and a non-blocking GPU double-precision program-info warning.
- Captures: `output/playwright/madagin-v10/desktop-ridge.png`, `desktop-valley.png`, `desktop-lake.png`, `desktop-ocean.png`, `mobile-ridge.png`, `mobile-valley.png`, `mobile-lake.png`, and `mobile-ocean.png`.
