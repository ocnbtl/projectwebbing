# Madagin mountain film — Higgsfield production plan v0.2

Date: 2026-08-17
Status: final 1080p film accepted and integrated.

## Implemented release

The public release uses one five-second, 1080p, 16:9, high-bitrate Seedance 2.5 shot generated from `@loc_MDG_valley_dawn_v4`. The camera makes a restrained forward glide through the asymmetric rainforest river basin while preserving the off-center limestone massif, irregular river course, forest distribution, mist, and dawn direction. Higgsfield asset: `57fc70ab-5dd1-4f0f-a259-70d299f5b985`. Delivery: `public/media/madagin-mountain-journey-v1.mp4`.

The ridge crossing itself is authored in the website: `@loc_MDG_ridge_predawn_v3` transitions into the valley film as scroll progresses. This keeps the reveal legible and controllable without asking the video model to invent a second geography. The original multi-shot notes below are retained as production exploration, not the current implementation.

## The story

The film is one physical idea: a constrained view becomes a wider one. We approach a dark ridge, cross it, discover the valley, then move with the river instead of hovering above a generic landscape. The motion carries the public story from fresh perspective to intentional change. Typography and values stay in the website, never inside the generated footage.

## What the Higgsfield research changed

The current plan follows four repeated patterns from Higgsfield's own public breakdowns and open projects:

1. Build the location before the shots. Treat the ridge, valley, river, cloud layer, light direction, grade, and lens character as one named location asset.
2. Keep one name and one version for every reference. New states get new versions; approved references are never silently overwritten.
3. Write every shot as if the model has no memory. Repeat the active reference, camera path, blocking, light, lens, physics, and positive locks verbatim.
4. Direct one visual beat at a time. Each generation has one camera intention and one reveal, then the edit joins approved shots.

Primary research:

- https://higgsfield.ai/blog/Santiago-breakdown
- https://higgsfield.ai/blog/Become-The-Director-of-AI-Cinema-with-best-Video-Model
- https://higgsfield.ai/blog/The-AI-Storyboard-Generator-That-Feels-Like-Directing
- https://higgsfield.ai/@higgsfield.studio/projects/oneiric

## Locked references

| Tag | Role | Current source |
| --- | --- | --- |
| `@loc_MDG_ridge_predawn_v3` | Matching pre-reveal rainforest ridge, partial massif, cloud cover, dawn direction | `public/media/madagin-ridge-approach-v3.png` |
| `@loc_MDG_valley_dawn_v4` | Asymmetric rainforest river basin, off-center limestone massif, broken receding ridges, dawn direction | `public/media/madagin-valley-reveal-v4.png` |

Before video generation, Cinema Studio should contain a single location element built from both frames. Its visual constants are: one central river running away from camera, steep forested mountain walls, low cloud caught below the summits, predawn blue in the shadows, pale first light at the horizon, and no signs of habitation.

## Camera and grade lock

Paste this block unchanged into every shot:

```text
CAMERA / FORMAT
Live-action photoreal aerial cinema. 24 fps. 16:9. A stabilized heavy-lift cinema drone with natural inertia. 28 mm spherical cinema lens, deep landscape focus, clean restrained glass, believable parallax, no abrupt acceleration. The horizon remains level unless the shot explicitly calls for a gentle bank.

LIGHTING / GRADE
The same blue-hour-to-first-light dawn across the entire sequence. Cool deep-blue mountain shadows, a narrow pale warm horizon, soft cloud diffusion, natural atmospheric perspective, restrained highlight rolloff, fine 35 mm film grain, neutral blacks, cohesive low-saturation grade.

POSITIVE LOCKS
The mountain topology, central river course, cloud altitude, light direction, color grade, lens character, and weather remain identical to the named location references. Motion stays physically plausible and continuous. The frame contains only the landscape and natural atmosphere.
```

## Shot 01 — The limited view

Duration: 5 seconds. Reference: `@loc_MDG_ridge_predawn_v1`.

```text
SCENE CONTEXT
Opening shot of the Madagin mountain journey. The viewer is close to a dark ridgeline before dawn and cannot yet see the valley beyond it.

FIRST FRAME AND BLOCKING
The ridge occupies the lower half of frame as one strong silhouette. Layered mountains recede behind it. The camera begins several metres below the crest, facing directly toward the lowest pass. Sparse low cloud moves slowly across the distant peaks.

CAMERA PATH
One patient forward push with a slight rise, heavy and controlled. The camera approaches the pass but ends just before crossing it. The ridge grows with believable parallax while the distant horizon stays stable.
```

## Shot 02 — Cross the ridge

Duration: 7 seconds. Start reference: `@loc_MDG_ridge_predawn_v1`. End reference: `@loc_MDG_valley_dawn_v1`.

```text
SCENE CONTEXT
The single reveal of the film. The camera completes the approach, rises over the exact ridgeline, and the previously hidden valley opens below.

FIRST FRAME AND BLOCKING
Begin at the final position of Shot 01. The nearest rock crest sits just below the centre of frame. The valley is still concealed.

CAMERA PATH
Continue the same forward velocity. Rise smoothly by a few metres, cross the crest, then allow a gentle downward pitch so the central river becomes the visual axis. The reveal happens once, cleanly, with no orbit and no cut inside the shot. End on the exact topology and framing of the valley reference.

ATMOSPHERE
As the valley appears, first light reaches the river and the high cloud edges while the forested walls stay in cool shadow.
```

## Shot 03 — Follow the new line

Duration: 8 seconds. Reference: `@loc_MDG_valley_dawn_v1`.

```text
SCENE CONTEXT
The perspective has changed. The camera is now inside the valley, moving with its natural line rather than looking at a static postcard.

FIRST FRAME AND BLOCKING
The river begins at lower centre and leads into the distance. The left and right mountain walls create a deep corridor. Cloud sits below the highest summits and leaves the flight path clear.

CAMERA PATH
Descend gradually while pushing forward along the river. Pass above the nearest foreground canopy with strong but calm parallax. Make one very gentle rightward bank halfway through, then level out. The river remains visible and central throughout.
```

## Shot 04 — Room for the words

Duration: 8 seconds. Reference: `@loc_MDG_valley_dawn_v1`.

```text
SCENE CONTEXT
The closing movement gives the website stable visual windows for Distinctive, Resonant, Trusted, and Compelling.

FIRST FRAME AND BLOCKING
Continue from Shot 03 at a slightly higher altitude. Keep the central river and the same mountain geometry. Leave broad, calm negative space alternately in the left and right thirds as the camera moves.

CAMERA PATH
Continue forward with a barely perceptible rise. Use one slow, shallow S-curve: a gentle left drift, settle, then a gentle right drift, settle. No reveal, no sudden event, and no change of weather. End looking deeper into the same valley as the dawn brightens by one natural stop.
```

## Assembly and delivery

- Generate low-resolution tests first; approve topology and camera physics before the final render.
- Select one take per shot by topology, continuity, camera path, and lack of visual artifacts—not by spectacle alone.
- Match-cut on direction and velocity. Add short optical-flow transitions only if the accepted frames need them.
- Grade the assembled sequence as one film; generated clips arrive with slightly different baked grades.
- Deliver a silent `1920x1080`, 24 fps H.264 MP4 at `public/media/madagin-mountain-journey-v1.mp4`, plus a WebM if the quality-per-byte win is material.
- Keep `madagin-ridge-approach-v3.png` and `madagin-valley-reveal-v4.png` as poster/reduced-motion fallbacks.
- No public text, logo, watermark, people, buildings, roads, animals, fantasy structures, or branded objects appear in the footage.

## Acceptance gate

The film is accepted only if the ridge crossing reads instantly without copy, the two location anchors remain recognizably the same world, the river never teleports, the camera has real inertia, the dawn direction and grade remain stable, and every frame can sit behind legible DOM text. Final integration also requires desktop/mobile crop review, reduced-motion verification, media-error fallback, and measured file weight.
