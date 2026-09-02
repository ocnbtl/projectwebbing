# Madagin photoreal opening slice rubric v1.1

Status: local acceptance rubric for the protected World Lab. This does not approve public integration, paid assets, or deployment.

## Why this pass exists

The v1.0 baseline is functional and fast on the development RTX 5080, but it is not visually approved. The August 19 evidence set shows a cutout-heavy forest, smooth terrain, planar water, visible world bounds, crushed shadow detail, and a 35.6 MB all-at-once world transfer on both desktop and mobile emulation. v1.1 is therefore a depth-and-material pass on the opening slice, not an expansion of the world.

## Environmental anchors

These references govern structure and material behavior, not a literal geographic composite:

- [Kīpahulu Biological Reserve](https://www.nps.gov/hale/learn/nature/forest-kipahulu.htm): wet rainforest and bog, high biodiversity, and a continuous mountain-to-ocean relationship.
- [Haleakalā natural features and ecosystems](https://www.nps.gov/hale/learn/nature/naturalfeaturesandecosystems.htm): windward rainforest with 120-400 inches of annual rain, closed ʻōhiʻa/koa canopy, and strong altitude-driven transitions.
- [Hawaiʻi Volcanoes ferns](https://www.nps.gov/havo/learn/nature/ferns.htm): large hāpuʻu tree ferns, dense uluhe mats, red-to-glossy-green ʻamaʻu growth, and layered native understory.
- [USGS rainforest vegetation and waterfall](https://www.usgs.gov/media/images/rainforest-vegetation-and-waterfall-2): public-domain visual reference for tree ferns, epiphytes, broadleaf forms, and foreground vegetation framing a distant fall.
- [Rocky Mountain National Park lakes and waterfalls](https://www.nps.gov/media/photo/gallery.htm?id=2743AD86-155D-451F-67D343C9E1778AB8): high-mountain basin, talus, water-edge, reflection, and waterfall-scale reference. Image-detail rights must be checked before any download or reuse.

## Locked art direction

- The world remains authored and guided. It is not a free-flight environment.
- The opening establishes humid Hawaiian ridge ecology; the alpine basin is a cinematic transition, not a claim that one literal site contains every biome shown.
- Near, mid, and far depth layers must be distinguishable in a still frame before motion or post-processing is counted as a success.
- Foliage variation comes from silhouette, scale, hue, age, lean, clustering, and ecological placement—not random scatter alone.
- Atmosphere reveals geography. It cannot hide missing terrain, world bounds, or weak composition behind white fog.
- Water follows geology. Streams, falls, pools, lake edges, and ocean shoreline must connect spatially.
- The semantic controls, owner navigation, reduced-motion behavior, and WebGL fallback remain independent of the renderer.

## Opening-slice acceptance matrix

| Checkpoint | Pass conditions | Automatic fail |
| --- | --- | --- |
| Ridge approach | At least three readable vegetation strata; non-black shadow color in focal foliage; framed view through real near/mid parallax; damp ground and volcanic rock cues. | Card silhouettes dominate the focal third; foreground becomes a black mass; the ridge is a smooth green mound. |
| Valley reveal | Two sidewalls read as geologically distinct; river or stream has a believable source and direction; atmospheric depth separates at least three distance planes. | Repeated tree wall; flat green carpet; blue guide-ribbon water; white sky void. |
| Alpine lake | Basin and shore are irregular; reflection changes with view angle; talus/rush/wet-ground transitions anchor the edge; far slopes do not expose scene limits. | Polygon shoreline; opaque uniform fill; shoreline floats above terrain; world edge visible. |
| Waterfall passage | Water breaks around rock, varies between sheet and strands, and creates localized spray/wet surfaces; the fall is framed rather than isolated. | Repeating curtain shader; detached flat stream strips; circular white mist blob; no geological lip. |
| Summit horizon | Foreground/midground silhouettes lead into a resolved horizon with no square geometry boundary; cloud mass has readable volume and scale. | Blank white void; ocean plane corner; fog card seam; no focal hierarchy. |
| Ocean pan | Long waves are non-periodic at camera distance; horizon blends into atmospheric perspective; shoreline direction is legible; no vertical fog-plane seam. | Moiré bands; planar tiled water; atmosphere column; hard plane or terrain edge. |

## Quantitative review gates

### Visual stills

- Capture the six states at 1440 x 1000 and 360 x 732 at scroll position zero.
- Review at 100% scale; no focal card edge, world boundary, flat water strip, or repeated shader band may be visible without zooming.
- Foreground foliage must retain visible hue and local contrast in the screenshots; black clipping cannot occupy the majority of the focal vegetation mass.
- The lake, fall, and ocean must each have a distinct surface response and silhouette.

### Runtime

- Desktop high: median at least 50 FPS, no sustained interval below 40 FPS, no more than 150 calls in the opening slice.
- Mobile balanced: median at least 30 FPS and no sustained interval below 24 FPS on a physical mid-tier device; emulator numbers do not satisfy this gate.
- Desktop triangle count must fall materially below the v1.0 8.7-9.1 million range before public integration; mobile must not rely on the RTX development GPU to mask 1.3-1.8 million visible triangles.
- Mobile must not request the same 35.6 MB world set as desktop. The architectural target remains at most 3 MB for the initial mobile zone and 5 MB for desktop before next-zone loading.
- The diagnostic must distinguish physical display DPR from renderer DPR.
- No shader compilation error, context-loss dead end, or false audio/status claim.

## v1.1 execution order

1. Recover shadow and midtone readability in focal foliage without flattening depth.
2. Conceal world bounds and remove view-inappropriate ocean/fog planes.
3. Remove periodic ocean aliasing and atmosphere seams.
4. Rebuild waterfall and lake geometry around rock and basin structure.
5. Replace focal near/mid cards with bounded PBR clusters and authored LODs.
6. Split current/next-zone loading and define a smaller mobile asset set.
7. Re-capture the matrix, then test representative physical devices.

## v1.1 first-pass boundary

The first reversible code pass is limited to foliage shadow lift, context-aware ocean/fog visibility, ocean distance-detail filtering, and truthful DPR diagnostics. It does not claim photorealism; it is accepted only if fresh captures show a visible improvement without new errors or a material performance regression.
