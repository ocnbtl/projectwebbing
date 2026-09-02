# Madagin atmosphere, ocean, and geology benchmark v0.9

Status: local world-lab benchmark; not imported by the public route and not deployed.

## What this pass changes

- Replaces the color-dome sky with Three.js's analytical Preetham daylight model.
- Adds one to three drifting cloud decks according to the detected device tier.
- Replaces the flat western ocean with a four-wave displaced surface, analytical normals, Fresnel sky reflection, golden-hour glint, irregular shoreline foam, and distance haze.
- Expands the ocean to 900 world units so the About pan ends on a real horizon instead of a visible plane edge.
- Blends two differently scaled CC0 PBR ground scans by terrain slope, elevation, and macro breakup instead of repeating one forest-floor texture across every biome.
- Adds tiered linked instances of the Poly Haven `rock_09` photogrammetry model to ridge, mountain, and coastal exposures.
- Regenerates the editable Blender benchmark with a multiple-scattering daylight world, volumetric air, procedural cloud decks, displaced ocean, 108 linked rock outcrops, and 236 linked Pachira specimens.

## Runtime quality policy

| System | High | Balanced | Conservative | Mobile-balanced |
| --- | ---: | ---: | ---: | ---: |
| Cloud layers | 3 | 2 | 1 | 2 |
| Ocean grid | 168 × 168 | 112 × 112 | 56 × 56 | 64 × 64 |
| New rock instances | 104 | 58 | 24 | 24 |
| Pachira mesh instances | 84 | 44 | 16 | 12 |
| Rainforest canopy cards | 5,400 | 3,600 | 2,100 | 2,200 |

The ocean intentionally avoids a planar reflection render target. At the aerial camera heights, most visible water reflection is sky; an analytical Fresnel shader preserves that read without rendering the multi-million-triangle ecology a second time every frame.

## Source and license boundary

- Poly Haven `forrest_ground_03`, `aerial_grass_rock`, `rock_09`, and `pachira_aquatica_01`: CC0. Each local asset folder retains its `PROVENANCE.md`.
- Three.js `Sky`: MIT-licensed addon already provided by the installed Three.js dependency.
- Cloud, wave, coast-foam, terrain-blend, and Blender scattering logic: authored for Madagin in this repository.

## Editable source

- Generator: `tools/blender/build_madagin_atmosphere_ocean_benchmark_v09.py`
- Blender file: `world-source/madagin-atmosphere-ocean-benchmark-v0.9.blend`
- Inspection GLB: `world-source/exports/madagin-atmosphere-ocean-benchmark-v0.9.glb`

The inspection GLB is deliberately gitignored, kept local, and not requested by the browser prototype. Its procedural atmosphere and Blender material graph do not survive glTF with full fidelity, and its 14 MB payload exceeds the current initial-zone budget. The runtime scene recreates those systems in tiered shaders and instances.

## Local verification evidence

- Desktop high tier, 1440 × 1000: ridge held 60 FPS at 109 calls and approximately 9.06 million triangles; ocean and sky views also held 60 FPS.
- Mobile balanced tier, 390 × 844: valley reveal stabilized at 60 FPS, 77 calls, and approximately 1.54 million triangles; the ocean view stabilized at 60 FPS and 59 calls.
- A fresh browser pass reported zero console errors and one non-blocking Three.js `Clock` deprecation warning.
- Captures: `output/playwright/madagin-v09/desktop-ridge.png`, `desktop-ocean.png`, `desktop-sky.png`, `mobile-ridge.png`, `mobile-reveal.png`, and `mobile-ocean.png`.

## Acceptance checks for this pass

- Ridge, reveal, ocean, and sky views compile without WebGL shader errors.
- Desktop median remains at or above 50 FPS in the local lab.
- Balanced mobile remains at or above 30 FPS without a sustained sub-24 FPS interval.
- Ocean horizon fills the About view at every saved journey checkpoint.
- Existing semantic controls, camera states, reduced-motion behavior, WebGL fallback, and internal authentication remain intact.
