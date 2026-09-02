# Madagin shared-world architecture v0.1

Status: active local prototype direction. This document does not authorize a public release.

## The world

Madagin should feel like one geography with several deliberately framed places, not an open-world game and not a sequence of disconnected effects. A persistent renderer will eventually keep the world alive while the interface moves between four compact zones.

| Zone | Public role | Camera behavior | Transition idea |
| --- | --- | --- | --- |
| Valley | Landing and values | Guided continuous flight | Crest the forest ridge and reveal the wider valley |
| Coastline | About | Living ocean and weather; quiet camera while reading | Drift west through sea mist and settle above the coast |
| Open sky | Selected projects | Moving atmosphere; locked reading plane | Bank upward through cloud cover and hold on open sky |
| Mountain | Let’s Talk | One controlled rise per form answer | Accelerate to the trailhead, then climb toward a summit review |

The existing blog remains editorial until its role in the geography is earned. It should not receive a decorative world only to complete a set.

## Let’s Talk: the ascent

The form is seven moments rather than a long panel. Progress is made visible through altitude, vegetation, weather, and sound—not through a game-like score.

1. Trailhead — where the prospect is now.
2. Forest path — what needs to change.
3. River shelf — investment range.
4. Alpine meadow — timing.
5. High ridge — project context.
6. Summit approach — contact details.
7. Summit — review and send.

Moving backward through the form moves backward along the same rail. Validation never discards an answer or advances the camera before the answer is accepted. Submission success must wait for a server-confirmed result once email delivery is connected.

## Runtime architecture

- One persistent `WorldCanvas` in the public layout when the prototype graduates from the lab.
- One route/scene manifest defining anchors, desktop and portrait camera rails, transition occluders, audio zones, and asset bundles.
- Route content remains semantic HTML above the canvas. Projects, About, and contact fields must still work if the renderer fails.
- Zones load on demand. The destination bundle can be prefetched on link hover, focus, or touch intent.
- The first public frame is a small static world poster. It is replaced by live 3D after capability detection; there is no pre-rendered video fallback.
- WebGL 2 is the baseline. WebGPU can be explored later as an enhancement, not a dependency.

## Loading and quality tiers

Quality is not a single export. Every device receives the same art direction and narrative moments, with different budgets.

| Tier | Target | Geometry | Textures | Effects |
| --- | --- | --- | --- | --- |
| High | Discrete desktop GPU | Full nearby LOD, instanced distance detail | KTX2 up to 2K selectively | Volumetric approximation, reflections, restrained bloom |
| Balanced | Typical laptop/tablet | Earlier LOD changes | Mostly 1K | Cheaper fog and water, limited post-processing |
| Conservative | Mobile or constrained hardware | Aggressive LOD and impostors | 512–1K | Baked lighting cues, no expensive screen-space effects |

Initial public-load targets: HTML and poster first, core renderer second, landing-zone geometry third, other zones on intent. The lab must measure frame rate, device tier, context loss, total transferred bytes, and the time from navigation to an interactive live frame before the production renderer replaces the current site.

## Motion and sound

- Scroll affects desired velocity; it does not scrub the camera one-to-one.
- Every narrative stop has a stable arrival state and a readable dwell.
- There is no visible reduced-motion button. The operating-system preference automatically uses the same live scene with a calm camera rail, shorter transitions, and reduced ambient movement.
- The volume control can appear on by default, but audible sound begins only after the first visitor gesture because browsers block reliable audible autoplay. No separate “enter” screen is required.

## Blender-to-web handoff

1. Build one coordinate system and named zone anchors in Blender.
2. Keep source collections separated by zone and by performance class.
3. Export runtime geometry as glTF/GLB with stable names and custom metadata.
4. Compress geometry with Meshopt or Draco only after measuring decode cost on target phones.
5. Transcode runtime textures to KTX2/Basis after material direction is approved.
6. Preserve the `.blend` source, generation script, export preset, and runtime manifest together so future stories can reuse the pipeline.

## Current build boundary

The first build is intentionally a protected greybox. It proves geography, route handoffs, camera behavior, portrait framing, and device diagnostics. It does not attempt photoreal vegetation, water, clouds, audio, or final lighting yet, and it does not change the public renderer.
