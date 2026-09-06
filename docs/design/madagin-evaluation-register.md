# Madagin evaluation register

September 6, 2026. The formal still and motion gates are **UNVERIFIED**. This register supports diagnosis and prevents passing technical checks from being mistaken for realism.

## Anchors and required views

1 = a severe visible break; 2 = coherent blockout but obviously synthetic; 3 = plausible at a glance with prominent defects on inspection; 4 = convincing under careful diagnostic comparison; 5 = reserved for the independently verified target. A row's weak category is not hidden inside an average. “—” means the system is outside that view, not passed.

| View | Landforms / surface | Ecology | Water | Lighting / atmosphere | Camera / continuity | Named limiting defect and severity |
|---|---:|---:|---:|---:|---:|---|
| Opening | 2 | 2 | — | 2 | 3 | High: broad low-detail slopes and repeated tree forms. |
| Valley | 2 | 2 | 2 | 2 | 3 | High: stretched rock scale, thin repeated canopy, simplified drainage. |
| Lake | 2 | 2 | 2 | 2 | 3 | High: authored basin and plate-like optical surface. |
| Waterfall | 2 | 2 | 2 | 2 | 3 | High: procedural curtain and weak impact/volume cues. |
| Summit | 2 | 2 | — | 2 | 3 | High: rounded source silhouette and uniform upland cover. |
| Ocean / About | 2 | 2 | 2 | 2 | 3 | Early coast gap closed; high: smooth shoulder, regular water structure and repeated vegetation. |
| Sky / Projects | — | — | — | 2 | 3 | High: clouds lack photographic internal structure and terrain interaction. |
| Right / Blog | 2 | 2 | 2 | 2 | 2 | High: source extent limits broad rightward exploration; accepted restrained framing avoids the rejected exposed edge. |

Ratings are diagnostic judgments against the retained DLNR sources, not independent scores. The quality bar remains a complete, genuinely navigable environment. Hiding weak views cannot establish final acceptance.

Canopy package cycle: all ratings above are retained. Two darker shadow/foliage trials were rejected; the accepted runtime package preserves the prior light, placement and motion. Transfer savings do not establish improved ecology, photographic material response, or B completion. See `output/playwright/madagin-world-progress/canopy-release-20260906/accepted-rejected.json` and the package's per-image error/geometry bounds in `public/world/canopy-v1/manifest.json`.

References: [DLNR Nāpali photograph](https://dlnr.hawaii.gov/dsp/wp-content/blogs.dir/34/files/2014/09/h_napali.jpg) and [DLNR coastal footage](https://vimeo.com/1006821259), including the layered coast near 06:42. Real captures show stratified cliff masses, varied canopy coverage, subdued long water streaks and atmospheric separation that the render does not reproduce. They are reference material, not runtime textures or generated concept images. Runtime asset lineage remains unchanged by this cycle.

## Explicit runtime targets

Targets for the full journey: desktop world transfer <=24 MiB, compact <=8 MiB; JS heap <=384/192 MiB respectively; meaningful world <=8 seconds; stationary frame p95 <=33.3 ms and p99 <=50 ms. Physical validation requires at least a typical laptop and a phone, a repeat cold load, and ten minutes of navigation/reading to expose thermal degradation. Record network conditions, GPU, DPR and device model. Heap is JS memory, not total GPU/process memory.

`tools/evidence/record-world-review.mjs` records uninterrupted startup/flight plus twelve-second held Ocean and Blog observations and reports all budget failures. Its headless Chrome measurements are a host-specific screening result, not physical-device validation or a network-throttled field estimate. Release functionality can pass while readiness budgets remain open. Do not infer fluid/foliage/weather realism from hashes, FPS, counts or camera movement.

Latest result (`canopy-release-20260906/motion-final/review.json`): desktop 26,414,873 bytes / 8,809 ms; compact 9,484,775 bytes / 3,488 ms. Both transfer gates fail; desktop meaningful-readiness gate fails. JS heap and held rAF p95/p99 pass on the RTX 5080 host. The earlier embedded-package iteration remains in `motion/`; the selected shared-resource iteration is `motion-final/`. These are unchanged predeclared budgets, not revised to accept this package.

## Small evaluation first; formal test later

Pilot: freeze 6 representative still pairs and 6 motion pairs only after each real/render pair matches subject, framing, illumination, scale and viewing size. Retain origin/license records. Use separate control examples; randomize left/right and presentation order; remove filenames, UI and metadata. Keep answer keys outside reviewer material. Recruit 12 independent people when available, report raw results and failure descriptions separately from any AI review, and do not call the pilot a precision or equivalence test.

No eligible pair set is claimed yet: the authored scene does not have sufficiently matched real views, especially the lake/fall. Current diagnostic boards openly identify sources and are not blind tests. Acquiring unmatched photographs or building a randomizer alone would not close this gap.

Proposed formal plan, to freeze before collecting final answers: independent still and motion samples, a primary correctness endpoint, and a 95% interval entirely within 45–55%. Provisionally plan 1,600 independent scored judgments per modality, one primary pair per person per modality, balanced across at least 40 scene pairs including held-out secondary views. At chance, an independent binomial sample of that size has a nominal interval roughly ±2.5 percentage points; scene clustering can make it wider. Report Wilson intervals for the finite presented set and scene-cluster uncertainty for claims across views. The pilot must inform scene diversity/design effects and the final sample size before this plan is frozen.

Predeclare exclusions using two obvious controls and missing/invalid responses before revealing the key. Do not count repeated answers by one person or adjacent video frames as independent trials. Do not repeatedly sample a held-out set until it passes. Preserve source quality, weak views, normal playback and image sharpness. If the interval crosses either equivalence boundary, the result is inconclusive or failed even if it includes 50%. AI-only evidence cannot pass the human gate.
