# Madagin contextual ocean and realism direction v0.2

Status: approved for local prototype implementation by Ocean on 2026-08-18. Public replacement and deployment remain unapproved.

## Geography decision

The mountain journey is the spatial spine. A single coastline and ocean run parallel to it on the west/left side. About is no longer a separate destination. At any journey checkpoint, About rotates the camera toward the same ocean from that exact location. Returning Home rotates forward and restores the mountain view at the saved checkpoint.

Projects follows the same rule: tilt toward the sky from the saved checkpoint without moving the camera. Let’s Talk is intentionally different; it accelerates from the saved checkpoint to the contact trailhead and then climbs the form rail.

| Action | Position | View direction | Saved journey state |
| --- | --- | --- | --- |
| Continue journey | Moves along the mountain rail | Forward | Advances after a narrative arrival |
| About | Unchanged | Pans west toward the ocean | Preserved |
| Selected projects | Unchanged | Tilts into the sky | Preserved |
| Return Home | Returns from contextual view only | Faces forward | Preserved |
| Let’s Talk | Accelerates to contact trailhead | Faces ascent | Preserved for return |

The western ocean also gives the golden-hour lighting a physical source. Warm light travels inland from the water and grazes the mountain faces; the blue ambient fill comes from the open sky.

## Journey checkpoints

1. Ridge approach — dark foreground and anticipation.
2. Valley reveal — the geography opens; Distinctive.
3. Alpine lake — calm reflection and scale; Resonant.
4. Waterfall passage — mist and an intentional atmospheric shift; Trusted.
5. Summit horizon — open air and arrival; Compelling.

Each checkpoint owns a forward target, an ocean target, a sky target, a desktop camera, and a portrait camera. About and Projects must share the checkpoint camera coordinates exactly. Any translational drift during those transitions is a defect.

## Authenticity model

The final world should be plausible before it is beautiful. Realism comes from relationships between systems, not from adding detail everywhere.

### Terrain

- Establish watershed, valley, ridgeline, and coastline logic at macro scale before sculpting local detail.
- Use erosion-shaped forms, drainage lines, talus fields, exposed rock strata, and vegetation boundaries that respond to slope and elevation.
- Avoid symmetrical peaks, uniformly distributed noise, repeated S-curves, and isolated “hero” rocks with no geological context.
- Preserve recognizable silhouettes at every LOD. Distance models may lose surface detail, not landform identity.

### Materials

- Every material needs measured physical scale, roughness variation, and a reason for appearing in its location.
- Blend rock, soil, moss, snow, and wetness by slope, height, drainage, and exposure—not hand-painted randomness alone.
- Use tileable PBR material families plus sparse unique masks. Do not solve the whole terrain with one enormous texture.
- Runtime textures will be KTX2. Normal maps and masks may use higher-quality compression than broad color fields when visible artifacts justify it.

### Water

- The ocean is one continuous western body, not a decorative plane revealed only on About.
- Shore contact must hold from all five checkpoints: no water climbing terrain, floating beaches, hard rectangular boundaries, or repeated wave direction.
- Use large and small normal scales, Fresnel response, depth color, shoreline foam, and wind direction consistently.
- High tier may use a restrained reflection pass. Lower tiers preserve silhouette, color, normals, and shoreline motion without expensive full-scene reflection.
- The alpine lake is calmer, darker, and more reflective than the ocean. The waterfall has separate velocity, mist, and acoustic behavior.

### Vegetation

- Define a small believable regional ecosystem rather than scattering unrelated marketplace plants.
- Density, species, age, wind response, and color shift with altitude, moisture, slope, and distance from exposed rock.
- Near trees require distinct trunks, branching silhouettes, and leaf clusters. Mid and far vegetation uses instancing and impostors without obvious repetition.
- No final vegetation asset enters the repository until provenance, licensing, polycount, texture set, and permitted distribution are recorded.

### Atmosphere and lighting

- Use height fog and localized mist volumes to establish depth. Fog cannot be a flat veil that erases the terrain hierarchy.
- Golden-hour sun originates over the western ocean. Cloud shadow and terrain shadow must agree with it.
- Bloom remains optical and restrained. Sun shafts require actual occlusion and should not appear uniformly across the frame.
- Color grading is the last unifying layer, not a repair for mismatched materials or lighting.

## Web quality tiers

| Budget | High | Balanced | Conservative/mobile |
| --- | --- | --- | --- |
| Target frame rate | 60 fps | 45–60 fps | Stable 30–45 fps |
| Render scale | Adaptive up to 1.6 DPR | Adaptive up to 1.25 DPR | Usually 1.0 DPR |
| Visible triangles | Measured per checkpoint; target under 1.2M | Target under 650K | Target under 250K |
| Draw calls | Target under 120 | Target under 90 | Target under 65 |
| Hero textures | Selective 2K | Mostly 1K | 512–1K |
| Vegetation | Full near instances + LODs | Earlier LOD transitions | Aggressive instancing + impostors |
| Water | Reflection only if measured safe | Simplified reflection or probe | No full reflection pass |

These are starting budgets, not permission to fill them. Every effect must survive comparison against the same scene with the effect disabled.

## Loading contract

1. Semantic HTML and a versioned still frame arrive first.
2. The renderer and ridge-approach bundle load next.
3. The next journey checkpoint preloads during the current dwell.
4. Ocean materials and coastline detail preload on About intent because the ocean macro geometry is already present.
5. Contact assets preload on Let’s Talk intent.
6. Context loss restores the still frame and HTML without losing journey or form state.

There is no pre-rendered video fallback. Unsupported or failed rendering receives an honest still-world fallback with the same page content and navigation.

## Acceptance gates before public replacement

- Five desktop and five portrait journey frames approved for composition.
- About pans from all five checkpoints with zero camera translation.
- Returning Home restores the exact checkpoint and forward target.
- Let’s Talk preserves journey state and reaches every form altitude reliably.
- No visible shoreline discontinuity from any approved camera.
- Terrain, vegetation, water, cloud, and audio provenance recorded.
- High, balanced, and conservative device tiers pass frame-time and memory tests.
- Complete navigation, content, contact form, and fallback remain usable without WebGL.
- Public replacement receives a separate release decision after production-like browser QA.
