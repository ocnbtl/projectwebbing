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


## Ridge ecology cycle — September 6, 2026

Accepted narrowly: denser fine-leaved secondary canopy on the opening ridge, exact triangle-based root reconciliation, and one ridge surface across the flight and final turn. Four source variants add coverage while legacy foreground trees remain visible. Desktop changes; compact retains its existing ecology. Opening/held-Ridge bare-slope coverage improves, but ecology stays **2** because combined species scale, contact/shadow response and cliff cover remain visibly synthetic. No other category score increases.

Rejected: additive CUDEM residual transfer made rounded humps; subtractive-only transfer made hollows unrelated to the base watershed. The pale replacement material also failed. Their source and image evidence remain local. Reassessment: compose the next representative scene around a complete geographic terrain/catchment, rather than mixing two landscapes' relief. The NOAA/WorldCover prototype is not promoted.

Evidence: `ridge-release-20260906/matched-views.json` holds comparable optimized public-rail views at 1440×900 and 390×844, including a twelve-second stationary Ridge interval. Camera position and journey look are equal; reading turns have small easing residuals reported explicitly. Animation phase is not locked, so pixels are not an error metric. `motion/review.json` supplies separate uninterrupted flight and held Ocean/Blog recordings and unchanged device targets. `accepted-rejected.json` records final decisions and production links.

Real references freshly inspected: DLNR Nāpali photograph and actual DLNR footage around 03:06 (wet fractured cliff/narrow waterfall) and 04:39 (breaking shore waves). The canopy's finer detail is useful but does not reproduce the source's coherent geology, density or fluid motion. This is diagnostic AI review; the independent human gate remains UNVERIFIED. Rejected development renders used fallback fonts. Early canopy captures before the single-material draw fix did not display the added canopy and cannot establish its appearance.

Acceptance correction: the first selected ridge captures missed a missing-terminal-terrain regression. Compact video at 42.50 seconds exposed visible vegetation above a terrain void; comparison with `7536e49` confirmed regression. The merge rejected mismatched attributes and returned null, which pageerror-only checks missed. The fixed compact geometry matches baseline positions and indices exactly; desktop uses a valid position-only merge of its eroded ridge. Repaired captures and motion replace the selected records; prior affected views and measurements remain in `rejected-terminal-merge/`. Actual-asset geometry checks and console-error capture supplement, rather than replace, visual inspection. Treat the initial runtime passes as interaction evidence only.


## September 6, 2026 — Ocean motion and rejected geographic catchment

Diagnostic AI review, not independent blind acceptance. Anchors remain 1 = conspicuously synthetic, 2 = coherent but obvious, 3 = credible at selected distance, 4 = convincing across views with minor tells, 5 = independently tested photographic equivalence. Keep individual categories visible.

| Required views / category | Before → selected | Perceived delta / remaining defect | Severity |
|---|---|---|---|
| Ridge + terminal About / ocean motion | 2 → 2 | Shoreward surf translation and fading wakes accepted; regular directional wave structure, no overturning/spray and simplified reflection persist. | High |
| Opening, Ridge, Valley, Lake, Waterfall, Summit / geology | 2 → 2 | Accepted geometry retained. All three full-catchment trials rejected for weak close detail; macroform alone is insufficient. | High |
| Same views / ecology and grounding | 2 → 2 | Accepted 4082-root desktop layer retained. Giant legacy leaves, incomplete cliff cover and lighting remain. Catchment cards rejected. | High |
| Lake/Waterfall / connected water | 2 → 2 | Authored inland water unchanged; ocean motion does not qualify watershed realism. | High |
| All views / light, atmosphere, route | 2 → 2 | Retained world. Geographic trial route too fast and lacks a production distance/speed proof. | High |
| About/Projects/Blog + ordinary routes / reading and input | Existing acceptance retained | Actual browser checks cover independent scroll, outside interaction, history/direct links, return/focus and capability fallbacks. See final publication result. | Functional gate |
| Loading / failure | Premature ready → corrected | Held-asset, visible-world and actual context-loss assertions; fallback keeps usable navigation. | Closed scoped defect |

Evidence: `ocean-release-20260906/before-final.json`, `after-final.json`, `camera-parity.json`, original held videos, `motion/review.json`, and `accepted-rejected.json`. Four coast comparisons use identical positions and lighting, look residual <0.00003 m, ocean time 40 s. Other animations are not phase locked. Original WebM streams are served with byte ranges; no transcoding or frame degradation. Full flight is separate from diagnostic jumps and clock freezes. No changed-pixel/hash score is used.

Source-verified DLNR photograph and actual DLNR YouTube `kxJIVCGPac8` opening aerial playback were reviewed this run. DLNR Vimeo human challenge and NPS Flickr playback failure are explicitly unavailable fresh references; old DLNR motion observations remain historical. Current visible cliffs, dense varied canopy and broken surf exceed the render. Generated fallback imagery is not live geometry or a real-Hawaii evaluation reference. Final independent-human still and motion gate remains UNVERIFIED; no formal held-out test was run.

## September 7, 2026 — Cliff surface architecture

Diagnostic AI judgments against real DLNR reference imagery, with no independent human or formal blind test. This table separates surface detail from the geometry it cannot fix; the earlier combined landform/surface rows retain their weak geometry rating.

| Required view / category | Before → selected | Named defect / acceptance | Severity |
|---|---|---|---|
| Ridge held, Valley, Lake headwall, Waterfall / surface detail | 2 → 3 | Scanned fractures, slope-selected cover and linked normal/roughness survive normal viewing size. Generic source geology and repeated texture motifs remain visible on close inspection. | Medium remaining |
| Opening, Ridge exit, Summit / surface detail | 2 → 2 | More readable rock; rounded/crumpled inherited silhouette and broad bare mantle dominate. | High |
| All seven rail views / macro landform | 2 → 2 | Identical retained topography; no native source cliff proof or complete erosion-scale hierarchy. | High |
| All terrain views / ecology | 2 → 2 | Existing crown scale, sparse cliff cover, weak contact lighting and compact simplified crowns remain. | High |
| Lake, Waterfall, About / water | 2 → 2 | Wet-bank contrast improves; inland water still has authored outlines, weak volume and impact turbulence. Accepted offshore motion retained. | High |
| Full flight, About, Projects, Blog / light, weather, route | 2 → 2 | No light/rail/weather changes. Terrain material stays attached under motion; atmosphere remains synthetic. | High |
| About/Projects/Blog / reading | Retained acceptance | Contrasting panels, separate scrolling and input/history/return behavior remain required production checks. | Functional gate |
| Loading and device budgets | Partial improvement | Desktop unused-map removal reduces transfer; final public transfer/readiness/frame/heap observations are in publication evidence. No physical-device qualification. | Open |

Selected evidence: `cliff-release-20260907/matched-views.json`, `after/`, `motion/`, `motion-public/`, `review.html`. The same camera positions and lighting are used, with reported small reading-look residuals; water/vegetation/weather phases are not synchronized. Original held videos include diagnostic setup jumps, distinctly labeled beside the separate automatic full flight. The pale first trial and larger mobile maps remain preserved, not hidden inside the selected captures.

Real source: Hawaii DLNR Nāpali park photograph and Kalalau Trail Visitor Safety Video, https://www.youtube.com/watch?v=kxJIVCGPac8. Fresh browser playback included opening aerial coastline and near-ground vegetation. These reference scenes are not camera-matched formal pairs. Generic CC0 scanned rock is a runtime material source, not evidence of geographic accuracy. Broad realism stays 2/5; independent 45–55% still/motion equivalence remains UNVERIFIED.


## September 7, 2026 — Rooted canopy checkpoint

AI diagnostic review, not a blind human test. Existing anchors remain: 1 conspicuously synthetic, 2 coherent but obvious, 3 credible at selected distance, 4 convincing across views with minor tells, 5 independently tested photographic equivalence.

| Views/category | Before → selected | Named result / remaining defect | Severity |
|---|---|---|---|
| Near-canopy pass, Valley, Lake / leaf and branch architecture | 2 → 3 | Shared root/part transforms and much smaller leaves; curved trunks and layered crowns read more coherently. Repeated two-source forms remain. | Medium/high |
| Opening, Ridge, Summit / ecological distribution | 2 → 2 | Generic core trees improve; patchy cover, inherited secondary crowns and placement patterns remain. No native species reconstruction. | High |
| Near-canopy, Waterfall / shadows | 2 → 3 at selected distance | Focused soft shadows follow matching wind geometry. Limited shadow range, some fine aliasing and physical-device cost remain to assess. | Medium |
| All rail views / terrain and water | 2 → 2 macro; retained surface detail 3 locally | Accepted geometry/surface/ocean implementation retained. Native cliff proof, inland-water volume and turbulence remain unresolved. | High |
| Compact coast / architecture and transfer | Scoped improvement | Source branching retained in a smaller far-only package. Compact inland placeholder ecology remains. Read final public budget result. | Open |
| Full flight, About/Projects/Blog / motion and reading | Functional acceptance retained; realism 2 | Review original flight plus held canopy. Branch/wind coherence improves; repetition, shadow range and procedural atmosphere remain tells. | High realism / functional gate |

Evidence: `ecology-release-20260907/matched-views.json`, `after/`, `motion/`, `motion-public/`, `review.html`, plus `tree-geometry-checks.json` and `scope-checks.json` in its release directory. The new near-canopy sample .58 supplements the prior seven views. Before/after position parity is exact; animation phases differ and shadow projection intentionally changes. Failed global reduction, packed-coordinate and alpha-coverage trials are retained, including the separate texture-loader error.

Fresh reference comparison uses the source-verified DLNR Nāpali photo and actual Kalalau safety-video opening playback. Neither source is a matched formal test pair. Human still/motion equivalence remains UNVERIFIED. No percentage complete, averaged realism score or changed-pixel test is used. Final public checks and device-budget classifications belong to the publication evidence, not this perceptual matrix.


## September 7, 2026 — Falling water checkpoint

| View/category | Before to selected | Named result / remaining defect | Severity |
|---|---|---|---|
| Waterfall / source continuity | 2 to 3 locally | Body now matches the 9.006 m feed instead of an oversized fan; core reaches the retained pool. | Scoped improvement |
| Waterfall / optical volume and motion | 2 to 2 | Depth and accelerating advection added, but silhouette remains regular and mist is weak behind foliage. Not a fluid simulation. | High |
| Lake, pool and river | 2 retained | Existing downstream geometry unchanged; hard pool margins and plate-like inland water remain. | High |
| Other required views / terrain, ecology, light, atmosphere and camera | Prior ratings retained | 161 unrelated renderer functions match; native cliff geometry, sparse cover and procedural weather remain limiting. | High |
| About, Projects, Blog / reading | Functional gate retained | Full fresh local/public scroll, input, history, return and fallback checks required by publication record. | Functional |

Evidence: `falls-release-20260907/review.html`, matched views and separate held/full-motion recordings. Actual GoHawaii Wailua photo and Go Visit Hawaii's 16-second Wailua clip (0-8 s) were viewed, including real irregular lobes, frayed edges and a substantial soft impact plume. Reference and render are diagnostic subjects, not matched formal pairs. The first flat-strip candidate is explicitly rejected and retained. Whole-world realism remains 2/5; independent 45-55% human still and motion gates remain UNVERIFIED. Final budget results are reported individually in the publication record, with no physical-device claim.


## September 8, 2026 — Native-grid foreland checkpoint

| Required views/category | Before → selected | Named result and remaining defect | Severity |
|---|---|---|---|
| Opening, Ridge held/exit / landform | 2 → 2 | More continuous source-shaped slope; artificial cliff walls from trials 1/2 rejected. Selected crop remains rounded, without strong buttress architecture. | High |
| Opening, Ridge / ecology | 2 → 2 | Triangle-grounded replacement with two tree layers. Repetition, sparse understory and exposed pale roots remain. | High |
| Valley, Lake, Near-canopy, Waterfall, Summit | Prior ratings retained | Outside-field geometry, light, water and route retained. Remaining inland-water/atmospheric defects remain. | High |
| About, Projects, Blog / continuity and reading | Functional gate | Native ground persists in terminal renderer; compact merge repaired. Fresh visitor checks and public full flight required. | Functional |
| Human still and motion equivalence | UNVERIFIED | No independent randomized evaluation; no average or percent-complete claim. | Final gate |

Evidence: `native-cliff-release-20260908/matched-views.json`, `after/`, original held video, separate `motion/` and `motion-public/`, `review.html`; source and geometry gates under `output/releases/madagin-native-cliff-20260908`. Compare actual DLNR photo and Kalalau opening footage. Camera positions exact; sun/camera retained, geometry/ecology change and animation phases differ. References are diagnostic, not matched formal pairs. Original rejected wall candidates are preserved. Final performance results distinguish emulation, script transfer and world transfer from physical-device qualification.


## September 8, 2026 — Cliff-profile checkpoint

| Required views/category | Before → selected | Named result and remaining defect | Severity |
|---|---|---|---|
| Opening, Ridge held / landform | 2 → 3 locally | Substantial source-shaped rock face and recessed gully; source elevation range about 249 m. Close compact framing and collar remain apparent. | Scoped improvement / high remaining |
| Opening, Ridge / ecology | 2 → 2 | Fewer trees on steep rock, actual-triangle grounding retained. Sparse foot cover, repeated crowns and pale roots remain. | High |
| Ridge exit, Valley, Lake, Near-canopy, Waterfall, Summit | Prior ratings retained | Unchanged geometry outside the patch and unchanged water/light/atmosphere/camera. Patch still has no connected drainage. | High |
| About/Ocean / terrain continuity | 2 → 2 | New rocky edge visible at left; coast-facing smooth shoulder/collar remains. | High |
| About, Projects, Blog / reading | Functional gate | Persistent canvas, readable surface and input/history/return/fallback checks recorded separately in publication evidence. | Functional |
| Human still and motion equivalence | UNVERIFIED | No independent randomized evaluation or supported equivalence interval. | Final gate |

Evidence: `cliff-profile-release-20260908/review.html`, 22 fresh matched pairs, held recordings and separate full local/public recordings. Actual DLNR Nāpali photograph and Kalalau safety-video opening through 29 s were inspected; screenshot observations at 0.15 and 28.9 s show coast and later helicopter/vegetation footage, not 29 s of continuous aerial footage. Real buttress scale, dense layered foliage, occlusion and atmospheric depth remain stronger. These are diagnostic references, not matched formal pairs. Source scans are not rendered rejection evidence. Existing crop and rejected earlier wall trials remain recoverable. No average or changed-pixel metric establishes realism.


## September 8, 2026 — Startup ordering correction

| View/category | Decision | Evidence / limit |
|---|---|---|
| Compact opening / completeness | Reject premature ready state and floating trees in c8371f5 playback at 3 s. | Original `cliff-profile-release-20260908/motion-public/` and `terrain-readiness-release-20260908/ordering-baseline-reproduction/`. |
| Desktop and compact / asynchronous loading | Accept current terrain-plus-foliage readiness and retained loading still after both ordering tests pass. | Four independent terrain/foliage holds; stale mount history included. The still is not rendered-realism evidence. |
| Completed cliff and full journey / quality | Retain c8371f5 geometry; B remains open, world 2/5. | Original 22 matched geometry comparisons plus corrected local/public full flights and held Ocean/Blog observations. |
| Budgets | Re-measure after correcting the early readiness marker. | New publication record separates each pass/fail; old compact 1.23 s is invalid as terrain-ready evidence. |

Human still/motion and physical-device gates remain unverified. Domain/mailbox delivery stays unverified; copy/download behavior is retained.


## September 8, 2026 — Compact field of view and rejected ecology variants

| View / category | Anchored decision | Severity and evidence |
|---|---|---|
| Compact opening / spatial framing | 2 → 3 for framing only: cliff silhouette and neighboring gully become legible at 60° vertical FOV. | Moderate framing defect reduced. Exact rail/targets unchanged; `cliff-ecology-release-20260908/before/390/opening.png` versus `after/390/opening.png`. |
| Desktop opening and ridge / ecology | Remains 2. Reject small trees, patch-only shrub, wider shrub and fern-layer trials. | High: sparse crowns, weak lower cover and exposed roots. `trial-*` and `fixed-lens-ferns/` preserve alternatives. |
| Compact secondary views / ecology | Remains 2; broader lens exposes existing faceted foreground plants. | High. Inspect all 11 compact checkpoints and uninterrupted motion. |
| Terrain/water/atmosphere across journey | Prior ratings retained; no changes to these systems. | High: authored coastal collar, absent cliff-to-valley drainage, synthetic water/atmosphere. |
| Reading / return and loading | Technical gates evaluated separately from visual quality. | Local/public reading, fallback, brief, loading-order matrices and full flights in this cycle. |

Release evidence: `output/releases/madagin-cliff-ecology-20260908/publication.json`. The local review distinguishes composition pairs (compact lens changed) from rejected same-lens ecology pairs. No averaged score, percentage complete or AI-only human-equivalence pass is reported.


## September 8, 2026 — Compact branching architecture

| Required views/category | Anchored decision | Remaining defect / severity |
|---|---|---|
| Compact Ridge held/exit, Valley, Near-canopy, Waterfall / tree architecture | 2 → 3 at selected distances: trunks, branching crowns and fine foliage replace polygonal blobs. | Generic two-source repetition, thin distant crowns and sparse understory remain high priority. |
| Compact fine edges / motion | Reject first no-MSAA trial; accept multisample coverage. Existing subtle sway retained. | No realistic living-motion claim; full flight and held intervals are separate evidence. |
| Opening / cliff foot and Summit / ecology | Overall 2 retained. | Sparse lower layers and exposed pale roots remain; count changes are not acceptance evidence. |
| Desktop, terrain, water, atmosphere and camera | Prior ratings retained; scoped source invariants pass. | Collar, disconnected cliff drainage and synthetic water/weather remain high priority. |
| About, Projects, Blog / readability and interaction | Functional gates recorded separately. | Preserve scroll/steering/history/return/fallback behavior. |
| Performance | Compact full-flight measurements added beyond held views; existing desktop transfer/readiness failures stay visible. | Headless host cadence is not physical-device or GPU qualification. |
| Independent human still/motion equivalence | UNVERIFIED | No formal blind result or averaged realism score. |

Evidence: `compact-canopy-release-20260908/review.html`, 22 same-position/same-lens pairs, `trial-1-no-msaa`, held and uninterrupted recordings. Publication and frame-profile details: `output/releases/madagin-compact-canopy-20260908`. Diagnostic reference: DLNR Nāpali photo and Kalalau safety film valley near 256 s; real canopy remains stronger. Animation phases are not synchronized and source scenes are not formal viewpoint-matched pairs.


## September 8 — Compact distant canopy cost

Evidence: `output/playwright/madagin-world-progress/canopy-lod-release-20260908/review.html`, `output/releases/madagin-canopy-lod-20260908/publication.json` and `leaf-geometry.json`. Baseline b4f7e78; exact same 22 camera/lens pairs, sun, resolution and MSAA. Compact distant leaf representation changes; wind phases differ.

| Required view/category | Prior → selected | Remaining defect / severity |
|---|---|---|
| Compact Opening/Ridge/Valley/Near-canopy/Waterfall branch architecture | 3 → 3 diagnostic | Generic repeated crowns and sparse lower layers / high |
| Compact geometry workload | ~12.7M → first trial 6.73M peak triangles | Final local/public profiles in publication record; physical GPU/phone evidence unverified / high |
| Lake/Summit/Ocean/About/Sky/Projects/Blog continuity | 2 → 2 diagnostic | Authored geography, water/weather and sparse ecology / high |
| Whole-world realism | 2 → 2 diagnostic | Integrated B exit unmet; no percentage-complete claim |
| Human still and motion equivalence | UNVERIFIED → UNVERIFIED | Independent held-out 45–55% equivalence with 95% CI still required |

The compact workload reduction must preserve normal-size branch silhouettes and continuous transitions. Geometry counts do not establish speed, thermal behavior or realism. DLNR Nāpali photograph and actual Kalalau valley footage at 256.52–259.23 s are diagnostic real references, not formal matched pairs. Previous rejected no-MSAA and understory trials remain excluded. Inquiry domain/mailbox/delivery gates remain separate and unverified.


## September 8 — Grounded drainage

Baseline 27b6cd47; same 22 fixed camera/lens pairs, sun and resolution. Evidence: `headwater-release-20260908/review.html` and `output/releases/madagin-headwater-20260908/publication.json`. Held and uninterrupted motion are separate; phases differ.

| Required view/category | Prior → selected | Remaining defect / severity |
|---|---|---|
| Ridge held/exit and Valley / channel contact | 2 → 3 diagnostic: authored tributary joins the grounded river; reject raised-bank-only trial | Smooth banks, sparse riparian layers, missing stream boulders / high |
| River and waterfall source / flow direction and light | Downstream metric flow and common sun replace world-axis phase/light mismatch | Surface optics and turbulence remain synthetic / high |
| Lake/Waterfall / catchment continuity | 2 retained | Artificial lake perimeter, outflow and broad catchment geography / high |
| Opening/Near-canopy/Summit / ecology and landforms | Prior ratings retained | Generic trees, sparse understory and authored coast collar / high |
| About/Projects/Blog / interaction | Separate local/public visitor and loading gates | Scroll, steering, history, focus, return and fallback must remain reliable |
| Whole-world realism | 2 → 2 diagnostic | B integrated proof still open |
| Independent human still/motion equivalence | UNVERIFIED | Held-out 45–55% equivalence with 95% CI remains required |

No average score or percent-complete claim. No new source asset is fetched. Runtime channel incision/fill is authored and recorded separately from original NOAA/source geometry. Physical GPU/phone/thermal qualification and domain/mailbox delivery remain unverified. Exact release measurements report each transfer/readiness/heap/frame budget separately.


Drainage finishing check: the new bank initially obstructed the existing waterfall outflow. That second trial is rejected in `trial-2-blocked-outflow`. The selected outflow now reaches inside the main channel and its bed is cut through the bank using the same graded path. Both terrain resolutions pass 84 additional outflow-center samples (minimum clearance 0.60 m). The river's right bank is intentionally open only at that inlet. Broader pool/bank appearance and the coarser terminal coastal terrain remain later continuity work, not a completed whole-catchment claim.


## September 8, 2026 — Lake shoreline contact

| Required views / category | Before → selected | Evidence and remaining defect | Severity |
|---|---|---|---|
| Lake + Waterfall / lake contact | 2 → 2 | Shared coves/depth remove the abrupt sheet edge; damp low-bank soil joins the shallows. The smooth basin and soft optical transition remain obviously authored. | High |
| Ridge through Waterfall / drainage | Retained | Actual terrain positions/indices and previous bed/bank/outflow checks pass at both resolutions. No wider-catchment claim. | High |
| Complete journey / vegetation, geology, light/weather | 2 → 2 | Generic repeated trees, sparse riparian layers, coarse pool geometry and synthetic environmental motion remain. | High |
| Human still/motion equivalence + physical devices | UNVERIFIED | Host browser captures and AI review cannot pass these gates. | Open |

Accepted shared-shore calculation and selected visual attachment; rejected extended substrate collar is preserved. See `lake-shore-release-20260908/review.html` for 22 camera pairs and uninterrupted/held motion; `output/releases/madagin-lake-shore-20260908/publication.json` for actual local/public budgets and provenance. Earlier transfer/readiness misses remain visible, not averaged away. Real NPS ʻOheʻo coastal-mouth photography and DLNR Kalalau stream footage are diagnostic material/contact references, not matched lake pairs. The formal still/motion plan and 45–55% equivalence requirement remain unchanged.


## September 8, 2026 — Contained waterfall pool

| Required view / category | Before → selected | Evidence / remaining defect | Severity |
|---|---|---|---|
| Waterfall desktop + compact / pool contact | 2 → 3 diagnostic for local contact | Smaller dark pool meets exposed rock; actual submerged bed and dry rim outside the connected outlet. Smooth banks and broad river surface remain. | High |
| Waterfall / falling curtain | Retained after rejected trial | Removing macro cliff clearance obstructed the curtain. Selected revision restores it; geometry checks now cover the falling body. | Closed regression |
| Waterfall / motion | 2 retained | Impact disturbances radiate and dissipate in stationary holds; appearance remains procedural, without convincing rock interruption. | High |
| Opening, Ridge, Valley, Lake, near canopy, Summit / integrated environment | 2 retained | Generic canopy, sparse understory, shadow/material inconsistency and wider drainage geography remain. | High |
| About, Projects, Blog, brief and fallbacks | Relevant local + public verification | Persistent canvas, readable independent content, return/history, honest copy/download and loading gates. | Required |
| Whole-world realism / human still and motion | 2 diagnostic / UNVERIFIED | No category average; no self-certification of 45–55% equivalence or physical-device performance. | Open |

Evidence: `plunge-basin-release-20260908/review.html` and `output/releases/madagin-plunge-basin-20260908/publication.json`. Compare with official Wailuku/Rainbow Falls photography and DLNR Kalalau footage at 256.21–259.30 s; these are diagnostic, not matched blind pairs. Rejected obstruction remains visible beside the accepted revision. All transfer/readiness/heap/frame results remain individual gates. No new runtime source asset or delivery claim.


## September 8, 2026 — Exact terrain construction

| Gate | Before → selected | Meaning and limits |
|---|---|---|
| Terrain/water output | Exact | All generated attribute and index bytes, metadata, four water shader sources/uniforms; actual desktop/compact production builders and sources. No density/LOD reduction. |
| CPU Valley construction median | 9.04→6.43 s desktop; 3.18→2.26 s compact | Five alternating measured pairs after warm-up, GC outside timing. CPU work, not complete readiness. |
| Paired local browser readiness median | 12.19→7.78 s desktop; 5.31→3.45 s compact | Four fresh-context pairs each, alternating order. Local medians pass unchanged 8 s; OS/GPU caches not reset. Actual public values remain separate. |
| Required views and stationary/flight motion | Prior ratings retained | 22 matched camera pairs and original recordings. Animation phases differ; no photographic improvement claimed from faster construction. |
| Whole-world realism | 2→2 diagnostic | Broad smooth outlet, sparse layered vegetation, material/light inconsistency and synthetic water/weather remain high-severity defects. B remains open. |
| Human still/motion + physical devices | UNVERIFIED | No independent 45–55%/95% CI result, phone/GPU/thermal qualification or verified inquiry delivery. |

Evidence: `terrain-startup-release-20260908/review.html`, `output/releases/madagin-terrain-startup-20260908/construction-benchmark.json`, `browser-startup.json` and final `publication.json`. Retain the prior DLNR photographic/footage comparison and bounded new observation record. Original assets and historical rejected trials stay unchanged. Do not replace individual public transfer/readiness/heap/frame failures with the passing local median or an overall score.


## September 8, 2026 — Grounded channel rock groups

| Required view / category | Before → selected | Named defect, severity and evidence |
|---|---|---|
| Waterfall desktop / bank geology | 1 → 2 diagnostic | Separated grounded forms break up smooth outlet/river shoulders. Broad uniform channel and generic source lithology remain high severity. |
| Waterfall compact / bank geology | 1 → 2 diagnostic, limited visibility | Small deposits visible during approach; adjacent channel is partly outside the narrow held frame. Full flight required; do not claim the still demonstrates the whole reach. |
| Valley, Lake, near-canopy / contact and continuity | 2 retained, local rock detail improved | No floating base in inspected views; actual terrain fits and central outlet clearance checked separately. Missing riparian layers remain high severity. |
| Water / stationary and uninterrupted motion | 2 retained | Existing flowing water, plunge disturbance and flight continue; no rock-aware wakes or foam. Do not credit static rock geometry as improved motion realism. |
| Opening, Ridge held/exit, Summit / integrated environment | 2 retained | Exact retained terrain/water implementation, generic/sparse ecology and material/light inconsistencies remain high severity. |
| About, Projects, Blog / reading and movement | Retained | One canvas, independent scrolling and outside steering, history/return/focus, direct routes and fallbacks checked locally/live. |
| Resource readiness / loading | Added rock dependency | Model and map holds at both widths preserve the still and withhold journey controls; stale logs ignored. Actual 8-second readiness budget reported separately. |
| Whole-world / independent evaluation | 2 diagnostic / UNVERIFIED | No category average or self-certified 45–55% human equivalence. Still and motion, physical devices and delivery remain separate gates. |

Evidence: `channel-rocks-release-20260908/review.html`, actual-source `rock-grounding.json`, unchanged-function `retained-source.json` and final `publication.json`. Twenty-two matched camera pairs preserve sun/FOV/rail; animation phases differ. Original full flights and stationary holds remain distinct from reference footage and formal testing. Official Rainbow Falls photography and the DLNR Kalalau boulder-stream interval explain why layered dense vegetation, uneven exposed rock and local flow interruption are still needed. Actual observed intervals and accept/reject decisions are in the current visual record. All budgets retain their existing thresholds; compact additional downloads and any desktop/readiness failures remain visible.

## September 9, 2026 - Rooted riparian layers

| View / category | Before to selected | Named defect and evidence |
|---|---|---|
| Waterfall / bank ecology, both sizes | 1 to 2 diagnostic | Fern/small-tree groups add a middle layer beside outlet and river. Broad exposed areas and sparse cliff-foot canopy remain high severity. |
| Lake / channel approach | 2 retained, local layering improved | Separated plants join some rock shoulders to larger trees. Engineered channel and missing local flow response remain high severity. |
| Near canopy / architecture and light | 2 retained | Bare slope, thin repeated canopy and older dark branch patches remain high severity; new plants do not solve this view. |
| Opening, Ridge held/exit, Summit / continuity | 2 retained | Same terrain/water/rail/sun/original ecology. Integrated realism remains open. |
| Stationary and full-flight motion | Diagnostic only | Original recordings and observed intervals in visual record; shared mild wind and moving water are not proof of photographic realism. |
| About, Projects, Blog / reading and steering | Retained | Persistent canvas, independent scrolling, outside steering, return/history/focus/routes/fallbacks checked separately. |
| Plant loading / resource order | Added | Five model/map cases include constrained desktop and stale stages. Current-mount meshes precede flight/poster release. Readiness target remains 8 seconds. |
| Whole world / independent evaluation / devices | 2 diagnostic / UNVERIFIED | No category average, human 45-55% equivalence claim, physical-phone/GPU/thermal or mailbox qualification. |

The first 38-tree trial was too sparse and remains preserved. The selected 111-tree revision is a partial bank-layer improvement. Real Rainbow Falls photography and played DLNR stream footage show much denser, better-lit enclosure and complex water/rock contact. `riparian-ecology-release-20260909/review.html` links 22 matched pairs and original local/public flight/held evidence. Actual-source root fits and final source/alias, sixty visitor/loading cases and every budget appear in `plant-grounding.json` and `publication.json`. The overlapped initial local motion measurement is excluded and repeated separately. Original assets, study work and prior rejected approaches remain untouched.


## September 9, 2026 - Groundcover source color

| View / category | Before to selected | Named defect and evidence |
|---|---|---|
| Near canopy / groundcover material | Black cast corrected; overall 2 retained | Lower foreground branches recover dark green detail. Flat oversized arrangements, sparse repeated trees and bare slopes remain high severity. |
| Waterfall and Lake / groundcover material | Local color restored; overall 2 retained | Scattered dark patches better share scene illumination. Broad outlet, sparse cliff-foot ecology and idealized water remain high severity. |
| Compact / scene continuity | 2 retained, no new visual benefit claimed | Legacy layer is omitted on compact/constrained desktop. Camera, geometry, ecology and asset requests remain exact. |
| Other fixed views / integrated world | 2 retained | Recorded at unchanged cameras/sun. A material fix does not close geology, atmosphere or canopy architecture. |
| Held and full-flight motion | Retained, diagnostic only | Actual original local/public motion is separate from still comparison. No new wind model or realistic-motion claim. |
| Reading / loading / delivery | Retained | Persistent world, scrolling, steering, return/focus/history, fallbacks and resource orders checked separately. Inquiry is still copy/download-only. |
| Whole world / independent evaluation | 2 diagnostic / UNVERIFIED | Human 45-55% equivalence and physical-phone/GPU/thermal evidence remain unverified. Individual public budgets stay explicit. |

Six decoded source forms lack COLOR_0. Production-function regression exercises both absent and supplied color attributes while preserving transforms and shared source materials. Source correctness and 22 matched camera pairs do not replace visual judgment. The official Rainbow Falls photo and played DLNR stream-bank footage show stronger green variation, dense overlapping vegetation and irregular boulder flow. `groundcover-lighting-release-20260909/review.html` and final `publication.json` link original evidence and accepted scope. No extra visual trial or new asset was introduced; historical rejects remain preserved.

## September 9, 2026 — Individually rooted bank ferns

| View / category | Before to selected | Named defect and evidence |
|---|---|---|
| Near canopy / groundcover scale and support | Local improvement; overall 2 retained | Smaller rooted green fern groups replace a few oversized dark branch islands. Broad bare slope and thin repeated canopy remain high severity. |
| Waterfall / bank ecology | Bounded improvement; overall 2 retained | Selected near-bank footprint improves; legacy arrangements outside it, sparse cliff foot and engineered water remain high severity. |
| Compact / scene continuity | 2 retained, no new benefit claimed | Patch omitted on compact/constrained desktop; base riparian ferns, rocks and larger trees remain. |
| Other fixed views / integrated world | 2 retained | Same camera/sun/world geometry and retained plant indices. Twenty-two matched camera pairs; animation phase differs. |
| Held and continuous motion | Diagnostic only | Original source recordings and actual observation intervals are in the visual record. Shared mild wind is not proof of realistic motion. |
| Reading / loading / delivery | Retained | Nineteen relevant local/public cases each; fern model/map readiness includes constrained desktop. Unchanged other resource-order source retains earlier proof. No inquiry transmission. |
| Whole world / formal evaluation | 2 diagnostic / UNVERIFIED | Human still/motion equivalence and physical-phone/GPU/thermal remain unverified. Individual public budgets retain their targets. |

The reindexed first trial is rejected for altering surviving foliage outside the patch; the final version preserves original variation indices. The official Rainbow Falls photo and played DLNR stream-bank interval (257.36–259.49 s) show denser overlapping layers, varied green illumination and irregular boulder flow. Actual terrain root fits establish support separately from visual acceptance. `groundcover-bank-release-20260909/review.html`, `visual-review.json` and final `publication.json` retain selected views, original local/public motion, every budget and exact source/alias/rollback proof. No new source assets or broader realism qualification.

## September 9, 2026 — Connected near-bank canopy

| View / category | Before to selected | Named defect and evidence |
|---|---|---|
| Near canopy / enclosure | 1 to 2 diagnostic | Connected young/middle crowns replace a broad gap on both sizes. Repeated fine architecture and speckled leaf/shadow patterns remain high severity. |
| Waterfall / ecology | 2 retained, local upper-bank gain | Unequal canopy groups visible beyond the fall; sparse cliff foot, broad outlet and bare surrounding slopes remain high severity. |
| Lake, Ridge, Summit / integrated continuity | 2 retained | Same geometry, water, camera and sun; existing trees and accepted ferns remain. Fixed 22-pair comparison has differing animation phases. |
| Roots / camera clearance | Scoped technical pass | Actual terrain supports and source-derived envelope plus sampled rail clearance; separate from visual judgment. |
| Held/full-flight motion | Diagnostic only | Original recordings and actual observed intervals are in visual-review.json; repeated mild wind and idealized water/weather remain. |
| Reading / resource orders / inquiry | Retained | Nineteen local/public cases each; added canopy model/maps held through readiness, including constrained desktop. No inquiry transmission. |
| Whole world / formal human and device gate | 2 diagnostic / UNVERIFIED | No averaged realism score, independent equivalence claim, physical-phone/GPU/thermal or working-mailbox claim. All actual budgets remain separate. |

Real Rainbow Falls photography and official DLNR motion at 254.94–257.96 s show varied overlapping crowns, fine illuminated leaves and irregular exposed stream rock. Selected source bounds corrected the initial camera-envelope estimate before rendering. The first rendered trial improved enclosure but used a separate efficient-model loader key, adding about 1.7 MiB to desktop resource accounting. Reject that loading arrangement; retain planting and share each device tier's existing loader key. Final captures and gates repeat after the correction. `trial-1-loader-pair` preserves the original trial and its measurements. `bank-canopy-release-20260909/review.html` links matched views and original local/public motion; `output/releases/madagin-bank-canopy-20260909/publication.json` records exact source, provider/alias/rollback, final gates and individual budgets.


## September 9, 2026 — Fuller efficient leaf coverage

| View / category | Before to selected | Named defect and evidence |
|---|---|---|
| Compact near canopy / leaf coverage | Local improvement; overall 2 retained | More continuous rounded crowns with fewer internal gaps. Fine speckles and generic repeated architecture remain high severity. |
| Desktop near canopy and Ridge middle layer | Bounded improvement; overall 2 retained | Efficient middle crowns become fuller; retained detailed near trees change little. Lighting-only trial is insufficient and rejected. |
| Waterfall, Lake and wider environment | 2 retained | Same placement, terrain, water, sun and rail. Sparse cliff foot, broad bare landscape and synthetic flow/weather remain high severity. |
| Source shape / camera margin | Scoped technical pass | Connected leaf topology and exact source maps/bark; fuller-source wind envelope 1.13, 1,001 rail samples per tier, 13.43/20.23 m minimum bank clearance. Root supports remain exact. |
| Held and uninterrupted motion | Diagnostic only | Original recordings and actual observed intervals in visual-review.json; fuller static source coverage is not a new wind or realistic-motion model. |
| Reading / loading / inquiry | Retained | Nineteen relevant original cases locally and publicly; new model paths held through current-mount readiness, including constrained desktop. No inquiry transmission. |
| Cost / independent evaluation | Explicit tradeoff / UNVERIFIED | 709,224 additional raw GLB bytes; 27,802 more triangles per complete source pair, multiplied by visible instances. Actual transfer/readiness/heap/frame gates remain separate; no physical-device or human equivalence claim. |

The official Rainbow Falls photograph and DLNR Kalalau stream-bank playback at 255.43–258.16 s show denser overlapping growth, brighter exposed leaf clusters, darker interiors and irregular wet boulders. The first lighting-only trial did not materially repair the normal-size sparse crown and remains under trial-1-lighting with stills and checkpoint holds; no uninterrupted trial flight was captured. Selected source coverage keeps one in three whole leaves with the existing 2.05x expansion and original lighting. Initial verification against the previous 1.12 envelope failed; the measured 1.12448 bound was corrected to a 1.13 verification envelope and freshly checked against both rails. This is a modest local acceptance, not closure of the speckle or integrated-world defect. leaf-lighting-release-20260909/review.html and the final publication record link exact source, reference/motion judgment, all gates and rollback.


## September 9, 2026 — Supported desktop shadow filtering

| View / criterion | Before → selected | Named change / remaining defect | Severity |
|---|---|---|---|
| Desktop near bank, Ridge held and Waterfall / shadow coherence | 1 → 2 | Harsh blocky foliage shadows become softer ground and crown shade; contact remains. Leaf geometry speckles and generic light response remain visible. | Medium remaining |
| Compact and constrained desktop / shadows | Retained | Shadows stay disabled; no compact visual improvement claimed. | Existing limitation |
| All required views / integrated lighting and realism | 2 → 2 | No change to sun, atmosphere, landforms, water, plant architecture or camera. This fixes a filtering defect; it does not close B. | High |
| Navigation, reading, inquiry and startup | Retained functional acceptance | Nineteen original cases plus two actual program audits per environment. Exact final results are in publication.json. | Functional gate |

Installed Three r182 does not map deprecated PCFSoftShadowMap to a filter and its internal fallback does not correct the renderer setting. The prior live 57 bound shadow-mode programs compiled Basic. Both R3F Canvas settings now use percentage/PCF; actual receiver functions verify filtered sampling and existing radius use. Compact remains disabled. Two runtime string changes, 15 surrounding modules and six unchanged tree GLBs are checked separately. No new sources or rendering dependency upgrade.

Normal-size matched views and original flight/held observations, actual intervals and decisions: `output/releases/madagin-shadow-filter-20260909/visual-review.json`; public provenance and all individual unchanged budgets: `publication.json`; review: `shadow-filter-release-20260909/review.html`. Real Rainbow Falls imagery and fresh DLNR stream-bank playback show more coherent natural architecture, illumination and contact. These comparisons are diagnostic AI observations, not matched blind pairs or independent human judgments. The 45–55% still/motion gate remains UNVERIFIED, as do physical devices and mailbox delivery. No overall score increase.

The first program fixture incorrectly required shadow-sampling functions in all mode-defined programs, including custom shaders that do not receive shadows. Its failed output is retained. The corrected fixture checks mode defines for every observed program and sampling/radius code only for actual receivers. This is a fixture correction, not a rejected visual implementation or runtime regression. Historical rejects remain preserved.


## September 9, 2026 — Preserve the first brief answer

The public shadow-release check failed once at compact Continue. Passive events showed the choice click at 268.7 ms, before hydration focus at 516.2 ms. Holding all Next client scripts reproduces the lost first answer on both widths. The contact source was identical to the preceding release; the shadow correction did not edit it. A normal repeat passing cannot close this defect.

Accepted correction: disable initial choices in server HTML and through hydration, then enable them using the client snapshot when handlers are attached. Normal pointer/keyboard validation remains. A no-JavaScript notice inside the question links to ordinary Projects. Criterion: first answer retained after genuinely delayed scripts, desktop and compact; no-JavaScript route works; original full brief validation/edit/copy/download/denial recovery still passes. Three delayed/no-JS cases and two full brief cases pass locally. Public follow-up checks await publication: automatic approval review rejects the attached standing authorization and requires approval directly in chat. Prepared scope and exact evidence are in output/releases/madagin-brief-ready-20260909/publication.json.

The first no-JS fixture used a text selector that skips noscript; both delayed-script cases had passed. A second pointer-actionability wait stalled during the entrance animation. Direct inspection showed opacity 1 and successful native keyboard navigation; the final fixture waits for visible opacity and verifies that keyboard route. The corrected fixture addresses the actual noscript DOM, and notice placement was improved inside the question before release. Failed logs and initial screenshot remain. This is inquiry reliability finishing; world ratings remain 2/5 and human/device/delivery gates remain unverified.


## September 9, 2026 — Spatial leaf grouping rejected

Two isolated derivatives retain exactly 9,927 / 10,084 source leaves in 36 irregular spatial groups. Trial one retains the accepted 2.05x local leaf expansion; one revision uses 2.65x. Source leaf centres, maps, source branches, roots, placement, light, PCF shadows, wind, LOD and cameras remain. At normal size on both widths, trial one opens bare interiors and weakens connected cover; the revision recovers some cover but leaves patchy crowns and the original fine speckling. Neither is an accepted realism improvement. Preserve the published leaf-coverage-1 assets and all earlier evidence.

Each has an optimized build, four actual decoded geometry cases, 22 matched rail pairs and original checkpoint/flight recordings. Measured envelopes 1.12790 / 1.12817 fit the existing 1.13 bound; sampled bank flight clearance stays 13.43 m desktop / 20.23 m compact. These technical passes do not outweigh the rendered result. Actual DLNR Rainbow Falls photography and Kalalau playback near 256–259 s show richer overlapping growth and shaded interiors. Detailed observed intervals, budgets and limits are in the two decision.json records under output/releases/madagin-canopy-clusters[-revised]-20260909.

A separate lossless-codec probe enlarged every retained legacy JPEG map; rejected without changing assets or relaxing the existing data-map error limits. The first trial cost recording overlapped that small probe and revision preparation, so it cannot support a paired speed claim. First restricted build could not fetch Google Fonts; the same build passed with approved network access. An initial report compared trial bytes with the older rooted far models; the corrected report compares the actual published leaf models and retains the initial log. No performance result establishes realism. Whole-world rating remains 2/5; B, independent blind still/motion review, physical devices and delivery remain open.


## September 9, 2026 — Cloud depth rejected; inquiry failure closed

B remains open. The bounded 700–1160 m density layer and its hash/weather/fade revision both fail normal-size Summit and content-background comparison: regular horizontal white bands and a synthetic distant layer replace the accepted sky. Preserve both isolated sources, 44 matched pairs and original held/flight recordings. The per-texel-hash change did not remove the artifact; the earlier LCG-correlation explanation is unproven. The revised source also fails one react-hooks/immutability lint rule and has one unused-import warning. Optimized builds and TypeScript pass; they do not override these failures. Full decision, observed frames, failed lint and limits are in output/releases/madagin-cloud-depth-20260909/decision.json.

Actual DLNR Nāpali photography shows separated clouds and coastal haze. The original USGS Mauna Loa time-lapse played from 25 to 34.93 s; the inspected daytime frame at 25.22 s shows rounded cloud masses below a broad summit, while the later inspected frame is night. This supports morphology comparison only, not matched location, altitude or real-time speed. Vimeo scenic playback failed and is excluded. Original cloud trial motion is retained; AI sampling is not continuous independent human review. Desktop trial transfer 25.287 MiB and readiness 10.973 s fail the unchanged 24 MiB / 8 s targets. Compact 6.710 MiB / 5.669 s and measured heap/held frames pass; no paired speedup or physical-device claim.

The separate inquiry hydration correction is now published at 306b4d7 with five local and five public cases passing. Delayed client scripts retain the first choice after hydration; no-JavaScript fallback reaches Projects; full validation/edit/copy/download and clipboard-denial recovery pass with zero inquiry transmissions. Exact public deployment/source/alias and retained world programs/assets pass. Whole-world realism remains 2/5 diagnostic; independent human still/motion evaluation, device/thermal and domain/mailbox/delivery remain unverified.


## September 9, 2026 — Cloud volume after actual GPU sampling diagnosis

Accepted a bounded cloud-shape improvement after one rejected candidate and one revision. Summit and ocean views gain separated masses, blue gaps and a horizontal layer with depth; overhead clouds remain soft and the far bank retains fine sampling artifacts. Whole-world realism stays 2/5 diagnostic and B remains open (8–14 cycles, low confidence); C 4–8 after B, D 3–6 plus external devices, reviewers and delivery access.

The prior rejected sky draw itself produced the regular bands. Five GPU slices (20,480 texels) exactly match CPU density; the upload/hash explanation is not supported. Increased sampling reduces bands; fixed spatial stratification breaks common sampling planes. The new 64³ R8 field has seven mip levels, 299,593 GPU bytes and no new downloads. 64/80/96 steps by tier use ray-interval filtering and sampled attenuation toward the existing sun. No output-image blur or temporal noise was added. Diagnostic layer isolation is excluded from visual acceptance.

Candidate one retained compact stripes/flat distance and is rejected; its source, 22 camera pairs and checkpoint holds are preserved without claiming an uninterrupted first-trial flight. The revised build passes types/lint, three actual GPU profiles, three reading, six capability and three loading cases. Its 22 matched pairs reuse the exact accepted world baseline with differing simulation phases. Original revised desktop/compact flights include 12-second Ocean, Projects and Blog holds. Actual AI-observed intervals and original DLNR photography/USGS playback are in visual-review.json; this is neither a matched reference scene nor independent continuous human evaluation.

Local desktop transfer 25.287 MiB and readiness 10.683 seconds fail the unchanged 24 MiB / 8-second targets. Compact 6.710 MiB / 5.377 seconds pass; measured heap and held frame targets pass for both. These are sequential host viewport diagnostics, not paired performance, physical-phone, GPU-time or thermal proof. All surrounding runtime/assets, navigation, water, ecology, camera and inquiry are retained. Direct ongoing publication authority is resolved; exact source/digest/remote/provider/alias/public checks, rollback and preservation are in output/releases/madagin-cloud-volume-20260909/publication.json. Domain/mailbox/delivery and formal held-out human still/motion gates remain UNVERIFIED.


## September 9, 2026 — Branch architecture and source-footprint support

The bank now mixes broader, forked crowns with the retained finer trees, breaking the repeated thin branching pattern. Source-footprint embedding keeps the wider roots in the slope. This is a bounded architecture and grounding gain; fine leaf speckling and generic canopy lighting persist, and the wider Hawaiian environment remains visibly authored.

One efficient derivative of existing CC0 Poly Haven island_tree_01 replaces bank variant zero only (134 desktop / 133 compact among 260 trees). 7,362 connected leaves, 27,878 total near-efficient triangles and 8,190 distant triangles; this is source architecture variation, not density or species validation. The existing one-in-six bake retains connected source leaves with 2.05 local expansion. Model plus three new maps add 939,886 bytes; six maps reuse existing content. Every RootedTrees instance shares the same device-tier loader key and the new model is requested once. Other variants and zones retain their source geometry/materials/wind/LOD.

Wider roots required measured per-tree embedding: 27 source base vertices per tree are now at least 0.030 m below the actual desktop/compact Valley triangles. The original layout is retained; only selected root heights are adjusted. Corrected crown envelopes clear 1,001 sampled camera positions by at least 18.33 m desktop / 25.20 m compact. An initial PowerShell numeric-overload error rounded offsets; the independent terrain check caught it. The selected Node-generated millimetre offsets pass, and all final stills/motion use that corrected source. Initial captures are excluded from acceptance.

Two canopy-normal variants failed normal-size visual comparison; official mask inspection did not support missing opaque leaf interiors as the cause of fine speckles. Those trials and raw source assets remain local. Actual official Rainbow Falls photography and DLNR Kalalau footage at 250–261 seconds show much richer connected foliage and layered lighting. Final 22 camera pairs preserve sun/FOV/route but have different simulation phases. Original desktop/compact uninterrupted flights and 12-second content holds are recorded; precise AI-viewed intervals are in visual-review.json. Formal independent human still/motion equivalence and physical devices remain UNVERIFIED.

Build/types/lint, decoded source/terrain support, three reading, six capability, three loading and five held-new-model/map cases pass. Local costs: 1440: 26.317 MiB, 10.261 s ready, 215.77 MiB heap, held p95/p99 12.6/12.7 ms; 390: 7.740 MiB, 5.737 s ready, 108.24 MiB heap, held p95/p99 4.3/4.3 ms. Individual budget failures remain failures; no speed or phone qualification claim. Whole-world realism remains 2/5 diagnostic. B remains earliest unmet, 8–14 focused cycles low confidence; C 4–8 after B, D 3–6 plus external qualification. B: resolve foliage frequency and crown light/shade against the same genuine bank reference; investigate source leaf scale and texture filtering without more density-only expansion. Use this mixed branch architecture as the local comparison baseline. Close desktop transfer/startup costs separately.

Exact selected digest, commit, remote, Ready deployment, public alias, live journeys and rollback: output/releases/madagin-branch-canopy-20260909/publication.json. Rollback: bd8dae94fdb1f542f450b9e1761a712dbe84a17a / dpl_tqk9Ux5LPcGC3ST5XZBEJgYKxPGj. Review: http://127.0.0.1:3143/branch-canopy-release-20260909/review.html. Ongoing scoped publication authority remains in force. madagin.com and contact@madagin.com ownership, mailbox and delivery remain UNVERIFIED; no transmission is enabled.


## September 9, 2026 — Canopy payload and rejected material hypotheses

The selected canopy packages remove unused source geometry and reduce bark normal-map transfer while retaining the published appearance in inspected normal-size Ridge, near-bank, lake/flight and compact views. No visible compression regression was observed in those samples. The world remains visibly authored, with fine leaf speckling, broad bare slopes, soft water and incomplete geological/atmospheric coherence.

Two isolated material trials failed perceptual acceptance: disabling leaf normal maps and redistributing front/back direct diffuse lighting. Both remain local. Texture format trials then established that lossless WebP increased these JPEG sources. The selected delivery change preserves seven rendered source nodes exactly (all attributes, indices, UVs, normals, transforms, material descriptors and samplers), removes six unused secondary-canopy variants, and re-encodes four 1024-square bark normal maps as JPEG95 4:4:4 while retaining profiles. Two derived GLBs plus four maps save 1,444,026 raw bytes. This does not add geometry, change leaf/alpha textures, camera, source-footprint grounding, wind, shadows, light or water. All original source assets and the untracked catchment study are preserved.

Normal-map p99 error is 3.16–4.93 degrees, maximum 8.66–43.37 degrees. No uniform five-degree bound or pixel identity is claimed. Normal-size comparisons retain the published appearance in inspected views. Genuine DLNR Rainbow Falls photography and sampled Kalalau stream-bank/waterfall footage show much richer connected growth and material/weather relationships; realism is still 2/5 diagnostic. Original uninterrupted desktop/compact flights and reading holds are available; actual sampled observations are in visual-review.json.

Build/types/lint, exact geometry/material checks, 22 camera pairs, three reading, six capability and three loading checks pass locally. Local costs: 1440: 25.005 MiB, 11.469 s ready, 284.21 MiB heap, held p95/p99 12.6/16.7 ms; 390: 7.740 MiB, 6.475 s ready, 87.66 MiB heap, held p95/p99 4.3/4.3 ms. Individual budget failures remain failures. Public measurements, visitor checks, source/remote/Ready/alias/asset proof and rollback are recorded in output/releases/madagin-canopy-payload-20260909/publication.json when complete. Prior production/rollback: dd091114dfeff49952e2b3d8c440e6ff945f9565 / dpl_DJS9pGDeQJ6Rw9p2SaZQ8jY1Vjxy.

B: build one reference-bounded cliff-to-bank patch with real-scale foliage clusters and connected ground cover. Judge aerial and close silhouette, canopy light/shade and bare-ground proportion together. No further isolated normal/shader tuning without a new supported explanation. At most two candidates before reassessing the production approach. B remains earliest unmet; revise the low-confidence estimate to 10–16 focused cycles because repeated material-only approaches have not closed the main reference gap. C remains 4–8 cycles after B, D 3–6 plus independent reviewers/devices and delivery setup. This closes no visual-realism gap; whole-world diagnostic remains 2/5 and B remains open. JPEG normal-map encoding is lossy: per-map p99 angular error 3.16–4.93 degrees; maximum 8.66–43.37 degrees. Same resolution and ICC profile are retained. It is not pixel equivalence. Sequential host viewport diagnostics are not paired speed, GPU-time, thermal or physical-device qualification. Formal independent human still and motion equivalence remain UNVERIFIED. Domain ownership, mailbox and delivery remain UNVERIFIED; copy/download stays active.


## September 9, 2026 — Connected lower bank vegetation

Lower fern groups and young branching crowns visibly fill gaps beneath the near-bank canopy at desktop and compact sizes, giving the trees a more connected lower layer. The wider ridge changes little. The corrected candidate retains the accepted green terrain and supported roots. This is a bounded ecological composition improvement; fine leaf speckling, repeated forms, broad bare slopes and authored water/light remain conspicuous.

The existing bank canopy anchors deterministic lower groups: 820 ferns and 160 young crowns on desktop; 440 and 80 on compact. Existing individual fern forms and efficient branching sources are reused with the same shared loader key; no new world asset files, source geometry or textures. This adds 1,230,072 / 650,568 fern triangles plus the young-tree instances; placement data travels in the script bundle. Existing mature canopy, terrain material, water, camera, sunlight and wind models remain. These are generic CC0 forms, not native-species validation.

Initial floor recoloring failed normal-size comparison with official DLNR Rainbow Falls photography and was removed. Nine-point root grids missed source-foot edges by up to 0.159 m. Reproducible placement baking now fits the actual source base vertices with runtime variant, yaw and scale against each terrain mesh; an independent invocation confirms at least 0.030 m burial. Wet/rock/stem exclusions, at least 65 percent exposed fern vertices and conservative flight clearance above 18 m desktop / 29 m compact pass. The rejected source and images remain local at output/releases/madagin-bank-understory-20260909/trial-1.

Build/types/lint, actual submitted fern counts and live wind uniforms on two profiles, 22 matched camera pairs, three reading, six capability and three loading cases pass. Original desktop/compact flights include stationary Ocean, Projects and Blog holds. Exact AI-observed playback samples are in output/releases/madagin-bank-understory-20260909/visual-review.json; recording availability is separate from human motion evaluation. Local costs: 1440: 25.005 MiB world, 756.8 KiB scripts, 13.433 s ready, 244.64 MiB heap, held p95/p99 12.6/16.6 ms; 390: 7.740 MiB world, 756.8 KiB scripts, 6.728 s ready, 105.80 MiB heap, held p95/p99 4.3/4.3 ms. Individual budget failures remain failures. Public costs, exact commit/remote/Ready/alias proof, live journeys and rollback are in output/releases/madagin-bank-understory-20260909/publication.json when complete. Rollback is 331be12a79ff9fa2262ad73717a36fe080b1a8f5 / dpl_6scAJin8KXUt3soz8sfb6FHpMMth.

Whole-world realism remains 2/5 diagnostic. B remains earliest unmet, 10–16 focused cycles with low confidence; this local improvement does not justify shrinking that estimate. C: 4–8 cycles after B. D: 3–6 finishing cycles plus reviewers, devices and delivery setup. B: address the dominant fine canopy frequency and broad bare terrain with a reference-bounded source/geometry composition study, then judge the full cliff-to-bank sequence. Do not add more density merely to conceal those defects. Close desktop transfer/startup and compact cold-start cost separately. Independent human still/motion equivalence, physical devices and domain/mailbox/delivery remain UNVERIFIED. The truthful copy/download behavior stays active.


## September 9, 2026 — Rock-guided terrain cover

More exposed rock connects through the green transitions across the waterfall headwall and valley slopes. Local surface orientation now influences cover as well as shading, reducing the unbroken green film over tilted rock. Opening close-rock detail remains readable at both sizes. The gain is modest; broad smooth ground, repeated foliage, inherited terrain facets and ribbon-like water remain prominent. Whole-world realism remains 2/5 and B stays open.

The existing CC0 Aerial Rocks 04 scan retains its documented 80-metre projection and reflectance. One transported world-space gradient now drives both local cover support and lighting, with a bounded scan-AO cavity cue. It is an authored material rule, not measured Hawaiian soil or ecology. All 263 tracked src/public files were compared: only terrain-surface.ts differs. No new world assets, source geometry, placement, water, camera or lighting changes. Shrinking the scan for apparent detail was rejected before rendering. A diagnostic initially sampled overwritten texture bindings; the corrected test observes actual terrain draws.

Optimized build/types/lint, two actual GPU profiles with four correctly bound and mip-filtered maps, 22 matched camera pairs, three reading, six capability, three loading and two zero-transmission inquiry cases pass locally. Original desktop/compact flights and stationary content holds are retained; actual AI samples, reference observations and limits are in output/releases/madagin-terrain-cover-20260909/visual-review.json. Local costs: 1440: 25.005 MiB world, 757.1 KiB scripts, 13.149 s ready, 208.49 MiB heap, held p95/p99 12.6/12.6 ms; 390: 7.740 MiB world, 757.1 KiB scripts, 6.337 s ready, 100.63 MiB heap, held p95/p99 4.3/4.3 ms. Desktop transfer/readiness remain failed. Public commit, remote, Ready/alias, served feature hashes, journeys, costs and rollback are recorded in output/releases/madagin-terrain-cover-20260909/publication.json when complete. Rollback: eeb1b43db48da0416645e9c5849014335d970d7b / dpl_9isHwuDrQ3qxEdb6SMRMpZypoQsP.

B remains earliest unmet at 10–16 focused cycles, low confidence; this material improvement does not reduce that estimate. C: 4–8 cycles after B. D: 3–6 finishing cycles plus reviewers, devices and delivery setup. B: replace a bounded inherited valley landform patch with source-supported relief, because material adjustments cannot remove the broad rolling/faceted shape. Require the same boundary heights, drainage and ecology support and route clearance, then judge the full opening-to-fall flight against real Nāpali ribs and strata. Do not use more texture contrast or foliage density as a substitute. Desktop transfer/startup remains a separate open cost gate. Independent human still/motion equivalence and physical-device qualification remain UNVERIFIED. Domain/mailbox/delivery remain UNVERIFIED; copy/download remains truthful.


## September 10, 2026 — West Valley source relief

Accepted intermediate geometry and supported planting, whole-world diagnostic 2/5; B open. AI inspected matched 1440/390 Valley, 1440 lake/ridge-exit/waterfall and actual original local recordings with reading holds against the official Nāpali photo and DLNR Kalalau footage. This is qualitative reference comparison, not independent human equivalence. Native height scale, bounded geometry, preserved wet anchors and flight support pass. The first publication e2c3a0d was rolled back for lake-bed overlap; its bounding-box water pass was invalidated. Corrected native-valley-2 protects the actual lake authority and assembled coastal shoulder, and includes a reusable geometry regression check. Matrix and exact observations: output/releases/madagin-valley-relief-20260910/quality-matrix.json and visual-review.json. Public proof/costs: output/releases/madagin-valley-relief-20260910/publication.json when complete. Only corrected sequential capture costs qualify for this release; earlier overlap and rejected-release results are superseded. Human still/motion equivalence, physical devices and delivery remain UNVERIFIED. B: resolve the thin ribbon-like waterfall and flat channel against the real wet-wall footage: connected falling volume, breakup and rock contact must agree in stationary and moving views. Also fix the inherited late Alpine backdrop activation at the Ridge-to-Valley reveal. Keep desktop startup/transfer as a separate failing gate; do not claim final realism from this source patch.


## September 10, 2026 — Terrain-guided cascade and mountain continuity

The cascade now bends over the actual headwall instead of hanging as a straight diagonal strip. Its source, curved fall and pool read as a connected sequence. Distant mountains are present during the Ridge-to-Valley reveal. Thin white strands and weak impact still look synthetic; the wider world remains about 2/5 diagnostic realism.

The 29,305-byte guide samples the actual desktop and compact headwall, retaining source and pool datums. The source channel ends at z=-750 and the guide curves to the existing impact at z=-704. Final-mesh bed changes affect 863 desktop/135 compact vertices, at most 3.000/0.866 m; every position outside the bounded footprint and in the protected plunge pool matches the control. Most core samples follow the wall, but measured edge extremes include intersection and lift-off. This is an authored contact treatment, not measured geography or fluid simulation. Existing terrain topology is retained; falling water rises from 11,520 to 12,800 triangles. No new world asset requests. The material retains the documented 80 m scan scale.

A pre-refinement bed trial changed five outside vertices through interpolation and was rejected. Final source review also found a duplicate pre-refinement adjustment left in the first candidate. Its control disabled only the final call, invalidating the earlier preservation claim. Both source and test were corrected before publication: the test now requires exactly one bed call and compares its removal against the final assembly. Corrected source, stills, original motion and gates replace those superseded records; earlier captures remain in rejected-duplicate-adjustment. Initial generated-code syntax errors were corrected before accepted capture and GPU checks. Geometry checks, exact guide reproduction, optimized build/types/focused lint, two submitted GPU profiles, 22 matched camera pairs, three reading/six capability/three loading/two zero-transmission brief cases pass locally. Actual original flight and held playback samples were compared with the genuine Wailua photograph and DLNR wet-wall footage; these different sites support qualitative judgment, not formal equivalence. Evidence: output/releases/madagin-water-contact-20260910/visual-review.json and quality-matrix.json.

Corrected local sequential costs: 1440: 25.005 MiB world, 798.3 KiB scripts, 13.486 s readiness, 224.32 MiB heap, held p95/p99 16.8/20.8 ms; 390: 7.740 MiB world, 798.3 KiB scripts, 6.965 s readiness, 105.17 MiB heap, held p95/p99 4.3/4.4 ms. Budget results: 1440 {"worldBytes":false,"heap":true,"steadyFrames":true,"meaningfulWorld":false}; 390 {"worldBytes":true,"heap":true,"steadyFrames":true,"meaningfulWorld":true}. Exact public costs remain separate in the publication record. Public sequential costs and source/remote/Ready/alias/journey proof are in output/releases/madagin-water-contact-20260910/publication.json when complete. Rollback: 9da720d67dd30dda4c6a38c8c8a1d9c9a6cc2308 / dpl_Hw7izZgN61LXnuitFNh3PRxagCvN. Review: http://127.0.0.1:3143/water-contact-release-20260910/review.html.

B: build one coherent source-to-impact water treatment with broader irregular breakup, wet cliff detail and credible pool disturbance, using these fixed views and the real wet-wall footage. Preserve the accepted guide and mountain reveal; reject merely brighter or denser noise. Address desktop startup/transfer and frame cost alongside that bounded scene work. At most two candidates before reassessing the approach. B remains earliest unmet at 10–16 focused cycles, low confidence; C 4–8 after B; D 3–6 plus external qualification. Human equivalence, physical-device evidence and domain/mailbox/delivery remain UNVERIFIED. Existing confirmed client facts and truthful copy/download remain active.


## September 10, 2026 — Cascade breakup and impact

The waterfall has fewer regular white strands and more uneven moving folds, with a broader foam and mist impact. The revised opacity retains gaps into the wet cliff. The gain is modest: the smooth narrow silhouette, flat upper channel, schematic pool and wider authored world remain conspicuous.

The previous guide, terrain, planting, camera and asset files are retained. A comparison of all 267 tracked src/public files finds only falling-water.tsx changed. Actual constructor positions, normals, UVs, travel-time/aeration attributes and 38,400 indices are identical to c56769c. Spray trajectories intentionally disperse across seven metres, with the same 720/240 particles. No new world assets. The first candidate's opaque-sheet result was rejected; source and captures remain local.

Optimized build, TypeScript, runtime lint, exact geometry preservation, retained headwall contact, two submitted shader/texture profiles, 22 matched camera pairs, three reading/six capability/three loading/two zero-transmission brief cases pass locally. Genuine Wailua photography and sampled original DLNR stream footage informed the comparison. Original desktop/compact flights and actual held/flight AI observations are in output/releases/madagin-water-breakup-20260910/visual-review.json. Human still/motion equivalence and physical devices remain UNVERIFIED.

Local host diagnostics: 1440: 25.005 MiB world, 798.5 KiB scripts, 12.706 s ready, 241.37 MiB heap, held p95/p99 12.6/12.7 ms; 390: 7.740 MiB world, 798.5 KiB scripts, 6.105 s ready, 155.83 MiB heap, held p95/p99 4.3/4.3 ms. Desktop transfer/startup fail; compact passes these local limits. Source checks overlapped local recording, so no speed claim is made. Exact public costs, GitHub commit, Ready deployment, public alias, served feature bundle, visitor checks and recoverable rollback are recorded separately in output/releases/madagin-water-breakup-20260910/publication.json when complete. Rollback: c56769c2f19ee8e9548bd07369194c729d93622f / dpl_C1m16exETsFfoyyeMH9wqn1V4dnF.

B: replace the narrow smooth outline and flat upper channel through a bounded geometry/material comparison based on the actual guide. Keep the accepted breakup/contact and judge the whole bank-to-cascade reveal. No further opacity/noise-only tuning. Close the inherited compact terrain seam in finishing; desktop transfer/startup remains a separate unresolved architecture gate. Whole-world realism remains 2/5 diagnostic and B remains open. Estimates remain B 10–16 focused cycles, low confidence; C 4–8 after B; D 3–6 plus external qualification. Domain ownership, mailbox and delivery remain UNVERIFIED; truthful copy/download stays active.


## September 10, 2026 — Compact Valley to Alpine boundary

The compact lake-side cyan slit and dotted terrain edge are gone. Valley and Alpine now share the actual decoded boundary at z=-1000, including all profile bends. The join stays continuous through the inspected moving lake approach; the broader world remains visibly authored.

Cause: compact meshes meet at -1000, unlike the detailed export at -980, and their edge samples differ. A bounded 12 m Valley strip now follows the Alpine source edge, with 114/118 triangle splits for journey/summit. The Alpine source profile matches its actual generated boundary exactly. Maximum shared-edge mismatch: 9.326 m before, below 0.000008 m after. The formerly empty lake-camera ray hits terrain. All original positions outside the strip, other src/public bytes, detailed terrain constructors and water/planting sources are preserved. No new assets; browser observes one reused Alpine request.

Accepted after normal-size stills, original flight and held-view AI samples against actual Go Hawaii Wailua photography and original DLNR Kalalau footage. No human equivalence claim. Optimized build, types, runtime lint, geometry, 22 matched camera pairs, submitted GPU programs and local visitor checks pass. 1440: 25.005 MiB world, 799.3 KiB scripts, 11.557 s ready, 244.40 MiB heap, held p95/p99 12.6/12.7 ms; 390: 7.740 MiB world, 799.3 KiB scripts, 6.090 s ready, 104.03 MiB heap, held p95/p99 4.3/4.3 ms. Desktop transfer/startup fail; host diagnostics are separate from physical devices. Exact public results and recoverable rollback are recorded in output/releases/madagin-alpine-seam-20260910/publication.json.

The wrong -980 interior-row diagnostic remains local and is rejected as boundary evidence; no runtime candidate was rejected. The distinct compact foreground ridge-exit sliver, broad mottled ground, repeated canopy, narrow cascade and flat atmosphere remain. B: compare the upper channel and cascade silhouette together against real flows, preserving accepted contact, breakup and this boundary join. Stop noise-only tuning. Diagnose the separate compact foreground ridge-exit sliver in bounded finishing. Desktop transfer/startup remains a distinct unresolved gate.

B remains earliest unmet, about 2/5 diagnostic. Estimates: B 10–16 focused cycles, low confidence; C 4–8 after B; D 3–6 plus external qualification. Human 45–55% still/motion equivalence with 95% CI, physical devices, domain/mailbox/delivery remain UNVERIFIED. Inquiry remains truthful copy/download. Rollback: 552fb24b056db577b3de7912337125fe5aaecfc2 / dpl_DtJrZoAG9iWQmx33na8dbGcsGPp3. Evidence: output/releases/madagin-alpine-seam-20260910/geometry-local.json, visual-review.json, quality-matrix.json, publication.json.


## September 10, 2026 — Downhill riffles and common cascade lip

Broken whitewater now travels along the downhill source into an exact shared lip. The falling curtain gains broader, unequal shoulders. These changes are visible at normal desktop and compact waterfall views; the improvement is modest and the world remains conspicuously authored.

The source redistributes its drop into three short riffles and derives aeration from local grade. Twenty cross-channel samples exactly match the upper half of the falling mesh at z=-750. All 42/68/92-row source centreline checks remain downhill, with zero lip gap. Unequal intermediate shoulders move 6,201 vertices by at most 1.8493 m; source/pool cross-sections and the 12,800-triangle curtain are retained. Source triangles are now 1680/2720/3680 for compact/medium/high, formerly 504/1360/1840. One dedicated animated material is added. Terrain constructors, compact join, guide, pool, planting and all other src/public bytes are retained; no new world assets.

Accepted from normal-size stills, actual original flight and held-water playback against inspected Go Hawaii Wailua photography and original DLNR Kalalau footage. This is qualitative AI diagnosis, not human equivalence. Optimized build, types, runtime lint, actual geometry/contact checks, 22 matched camera pairs, submitted source/fall/terrain GPU programs and visitor gates pass locally. 1440: 25.005 MiB world, 800.0 KiB scripts, 12.762 s ready, 223.41 MiB heap, held p95/p99 12.6/12.7 ms; 390: 7.740 MiB world, 800.0 KiB scripts, 6.210 s ready, 98.41 MiB heap, held p95/p99 4.3/4.3 ms. Exact public results and costs are separately recorded in output/releases/madagin-cascade-shape-20260910/publication.json.

Initial 4 cm lip rise and residual 1 mm centreline rise were rejected mechanically and corrected before rendered review; their failure log remains local. No rendered candidate rejected. B remains earliest unmet, about 2/5 diagnostic. B: couple the smooth source banks and rocky bed with varied rooted vegetation. Preserve the exact shared lip, terrain guide and accepted compact lake boundary. Stop water-noise-only tuning. Diagnose the distinct compact foreground ridge-exit sliver within bounded finishing; desktop transfer/startup remains a separate unresolved gate.

Estimates: B 10–16 focused cycles, low confidence; C 4–8 after B; D 3–6 plus external qualification. Human 45–55% still/motion equivalence with 95% CI, physical devices, domain/mailbox/delivery remain UNVERIFIED. Inquiry remains truthful copy/download. Rollback: bb3da483052830b7197ce1eddd456bb5179fca49 / dpl_9oA1wFVHrbMPgwYthL7LSLruSPEq. Evidence: output/releases/madagin-cascade-shape-20260910/geometry-local.json, visual-review.json, quality-matrix.json, publication.json.


## September 10, 2026 — Grounded cascade source banks

Uneven clusters of small crowns and exposed rocks interrupt the previously bare source banks. The change is visible in the lake-to-waterfall reveal on desktop and compact, with water and the shared lip retained. This is a modest ecological placement gain; the broad smooth slopes and repeated fine crowns remain conspicuously authored.

Desktop adds 16 rocks, 73 ferns and 35 trees; compact adds 10 rocks, 60 ferns and 25 trees. Placements are individually fitted to actual terrain triangles, including complete normalized trunk footprints, dry-bank exclusion and flight clearance. Seven scanned rock forms and existing fern and tree assets are retained; no new world requests. Existing rock/fern instancing is extended and the added tree group uses the retained wind and distance LOD. Grounding report source triangle sums are unreduced asset estimates, not measured GPU load.

Optimized build, types, runtime lint, actual bank grounding, all submitted instance roots and wind, retained terrain/water GPU programs, 22 matched camera pairs and local visitor gates pass. Actual normal-size stills, original flight and stationary playback were judged against Go Hawaii Wailua photography and original DLNR Kalalau footage. Qualitative AI review only. Local cost: 1440: 25.005 MiB world, 811.2 KiB scripts, 12.544 s ready, 224.42 MiB heap, held p95/p99 12.6/12.6 ms; 390: 7.740 MiB world, 811.2 KiB scripts, 6.075 s ready, 121.65 MiB heap, held p95/p99 4.3/4.3 ms. Public proof and costs are recorded separately in output/releases/madagin-source-bank-20260910/publication.json.

Initial sparse candidate sampling failed the layout coverage assertion; the sampler was expanded without weakening grounding. The compact minimum was corrected to an explicitly smaller 8-rock tier, accepting 10. All wet, unsupported, buried, crowded or camera-obstructing placements are rejected and counted in bank-grounding.json. No rendered layout was rejected or revised this cycle. Geometry, terrain, guide, pool, camera, previous ecology, all public assets and inquiry behavior are retained. B remains earliest unmet, 2/5 diagnostic. B: resolve the broad source slope and riparian composition together. Compare a reference-scaled mix of crown architecture, shaded understory and exposed rock against this bank proof before expanding its placements. More scattering alone will not meet B. Keep one major coupled candidate and a bounded finishing allowance; separately close the compact foreground ridge-exit sliver and desktop transfer/startup gate.

Estimates: B 10–16 cycles, low confidence; C 4–8 after B; D 3–6 plus external qualification. Human 45–55% still/motion equivalence with 95% CI, physical devices, domain/mailbox/delivery remain UNVERIFIED. Rollback: cd5104209071e6ba8761a8a6914b282527df33e6 / dpl_AoTZi7JXqmng2v31Dpq4Af4jFgw2. Evidence: output/releases/madagin-source-bank-20260910/bank-grounding.json, scope-proof.json, bank-gpu-local.json, visual-review.json, quality-matrix.json, publication.json.


## September10,2026 — Rocky ground substrate and compact Ridge join

Rocky mineral variation and matched small surface relief replace the green-tinted pine-needle ground beneath the canopy and beside the waterfall. The compact foreground Ridge-to-Valley tear is closed by joining the actual outer edge, with the stream bed preserved. This is a visible, bounded improvement; the overall world remains conspicuously authored.

The retained CC0 Poly Haven Aerial Grass Rock scan (Rob Tuytel, published15m width) now supplies consistent color, normal and response. Existing desktop1024 color is reused; compact color and shared data maps are256. Data compression is lossless after resizing because lossy data failed RGB/normal-angle gates. The80m cliff support, wet margins and shared gradient transport remain. No new raw/source asset is introduced.

The compact join previously selected a12m-wide interior stream row near z-315 instead of the620m outer Ridge edge at z-335. A2.75m first-cell Valley surface replacement now uses153 actual Ridge knots.1237 geometric probes agree within1.8e-15m;9 former-gap pixels hit terrain. The first interpolation crossed the stream and was rejected; final0.4m interior channel samples retain at least0.293m clearance beneath the actual water surface. Terrain away from the strip is unchanged.

Optimized build, types, runtime lint, actual geometry/contact and GPU-bound six-map programs pass.22 camera pairs and normal-size views were compared, with original flights and held observations actually played. Genuine DLNR Nā Pali photography and Kalalau original footage informed qualitative AI judgment. Local cost: 1440: 25.009 MiB world, 811.6 KiB scripts, 13.165 s ready, 343.17 MiB heap, held p95/p99 12.6/12.6 ms; 390: 7.900 MiB world, 811.6 KiB scripts, 5.988 s ready, 138.37 MiB heap, held p95/p99 4.3/4.3 ms. Technical budget results remain distinct from visual acceptance. Public source/provider/journeys/costs are recorded separately in output/releases/madagin-ground-substrate-20260910/publication.json.

Rejected work: Full1024 normal derivatives were too expensive; lossy normal/response WebP failed the numerical data gates. Final256 data derivatives preserve resized samples exactly. Compact color is256; desktop reuses the existing1024 color. The first compact weld omitted uv1 required by the existing merge routine; compatibility was corrected before acceptance. The first seam render closed the slit, but its Hermite interior crossed the stream by up to0.441m. Rejected. Final interior samples carry the retained bed with at least0.293m measured water clearance. Material-only and rejected-seam evidence remain local.

Generic CC0 photographed substrate, not surveyed Hawaiian terrain or ecology. The reflectance multiplier is authored. Normal/response are256-pixel derivatives. Their exact compression preserves the resized decoded source; it does not preserve original1024 spatial detail. Compact seam changes a2.75m strip at z[-337.75,-335], using153 actual Ridge knots. 1237 edge probes and9 former-gap rays pass; terrain probes away from the strip are unchanged. This is sampled geometric evidence, not every-pixel/all-frame certification. Broad smooth terrain, fine repeated crowns, flat-looking water and weak atmospheric depth remain. Whole-world diagnostic2/5; B unfulfilled. Host viewport emulation only. Human45–55percent still/motion equivalence with95percent CI, physical devices and thermal qualification remain UNVERIFIED. Domain/mailbox/delivery unverified; inquiry stays truthful copy/download. B: replace speckled repeated crown architecture with a reference-sized connected crown and shaded understory in the representative moving scene, then couple water appearance and atmosphere. Keep the accepted ground, source banks, water guide and joins fixed as comparison authorities. Do not repeat scattering-only or color-only changes.

Finite plan: A established; B earliest unmet,10–16 bounded cycles low confidence, with integrated moving geology/ecology/water/light/atmosphere/camera as exit; C4–8 after B to transfer the proven scene through every route and transition; D3–6 plus external commercial/device/human qualification. Scope and finishing remained bounded to one ground-material candidate and one narrow seam correction with a rejected interpolation revision. Rollback: 597680fd3b0f0921652c48d6e67ea2f6ade29926 / dpl_7VbcQvV2uNwTsyz6CsT9jsP7fwm2. Evidence: output/releases/madagin-ground-substrate-20260910/scope-proof.json, foreground-seam-check.json, terrain-local.json, visual-review.json, quality-matrix.json, publication.json.


## September10,2026 — Overlapping bank foliage sprays

Accepted branch-sprays-1:753 paired-blade sprays in the first bank-tree family, with source roots and branches retained. Fuller compact crowns and a modest desktop close-grove improvement. First smaller-spray trial rejected. Generated foliage uses one stable distance mesh; no new asset requests. Actual GPU position hash/wind, matched22 cameras, build/types/runtime lint, original moving and held review, and local visitor gates pass. Desktop transfer/startup remain over target. Other world systems and2,076 original untracked files remain unchanged. B and final human/device/delivery gates remain unmet. [Decision](../../output/releases/madagin-branch-sprays-20260910/decision.json), [actual review](../../output/releases/madagin-branch-sprays-20260910/visual-review.json), [matrix](../../output/releases/madagin-branch-sprays-20260910/quality-matrix.json), [publication](../../output/releases/madagin-branch-sprays-20260910/publication.json). Current state carries the finite estimates and next integrated-scene constraint.


## September10,2026 — Second bank-crown layers

Accepted a modest second-family bank-grove improvement: coarser overlapping branch-end surfaces and darker crown interiors replace part of the evenly speckled canopy. The gain is clearest in the lower foreground of desktop and compact near-canopy views and the close flight. Cool dark color, repetitive surrounding foliage and broad exposed terrain remain; this does not close milestone B or establish a realistic forest. First flat-disc trial rejected; revised531clusters/2,124blades accepted after real still/motion/reference comparison. Source wood, roots, transforms, accepted first family and273 other src/public files remain. Face orientation/shade bounds, stable distance geometry, actual GPU buffer, build/types/lint,22matched cameras and local visitor gates pass. World2/5; B remains open10–16cycles, C4–8after B, D3–6plus external qualification. Desktop transfer/startup remain open; delivery stays copy/download with no transmission. [Decision](../../output/releases/madagin-crown-layers-20260910/decision.json) · [Visual and motion observations](../../output/releases/madagin-crown-layers-20260910/visual-review.json) · [Matrix](../../output/releases/madagin-crown-layers-20260910/quality-matrix.json) · [Exact release](../../output/releases/madagin-crown-layers-20260910/publication.json). Next: coupled bank/water/light proof, including the flat-looking lake/outlet; preserve accepted canopy/ground/joins.


## September11,2026 — Coupled lake depth, reflection and daylight

Accepted an integrated lake-depth, actual-scene reflection and daylight improvement. The lake carries recognizable valley reflections through ridge-exit, valley, lake and waterfall views, replacing the flat blue cutout. Central depth and rendered substrate now share the terrain authority. Shaded banks have more readable detail. Generic geology, fine repeated crowns, flat outlet/pool water and overly smooth lake motion remain; milestone B is not complete. The first mirror-like low-resolution/dry-collar trial was rejected. Revised actual-scene reflection, shared7.37m central bed, dry-bank clipping and neutral daylight are accepted across multiple checkpoints. No new assets. CPU/GLSL and actual mesh checks, retained compact join, GPU reflection,22 matched camera pairs, build/types/lint and six local visitor groups pass. Actual sampled original flight and held lake motion were inspected against Go Hawaii photography and DLNR coastal footage; coverage gaps are explicit. Desktop transfer/startup remain open. Formal human/device/delivery gates remain unverified. B stays open; unsupported repeated cycle counts are retired. Extend coherent water depth, bank contact and surface response through the outlet, river and plunge pool, while correcting their straight channel-like composition. Compare terrain cross sections and flow against Hawaii references at lake, near-canopy and waterfall before choosing geometry versus optics. Then address broad slope landforms and connected vegetation mass. More foliage scattering or isolated tint changes will not close B.

[Defect matrix](../../output/releases/madagin-water-light-20260911/quality-matrix.json) · [Decision / rejected trial](../../output/releases/madagin-water-light-20260911/decision.json) · [Actual visual and motion coverage](../../output/releases/madagin-water-light-20260911/visual-review.json) · [Exact source, public checks and costs](../../output/releases/madagin-water-light-20260911/publication.json).


## September 11, 2026 — Connected water evaluation

The improvement is visible at ridge exit, valley, lake and waterfall: the water reads as a connected system and carries more depth and surrounding scene response. Fine shore outlines, smooth channel edges, broad slopes, repetitive vegetation and limited flow structure remain. Whole-world realism remains about 2/5 as qualitative AI diagnosis; milestone B is not complete.

Optimized build, TypeScript, focused runtime lint, 852 actual channel-bed probes, 25,380 CPU/GLSL lake comparisons, retained compact ridge join, real GPU reflection/advancing-water checks and all six local visitor groups pass. Sixteen flight camera pairs match exactly; six content views match position/FOV with look-angle differences below 0.00088 degrees. Normal-size stills and sampled original flight/held playback were inspected; unobserved playback is not counted as review.

The freshly inspected Go Hawaii Wailua photograph shows darker rock/canopy reflections, layered cliff structure and impact mist; prior DLNR motion references remain historical for this pass. Authored geometry and optics are not surveyed Hawaiian bathymetry, fluid simulation or exact pool-plane reflections. Human 45–55% still/motion equivalence with 95% CI, physical-device/thermal evidence and madagin.com/contact@madagin.com ownership/mailbox/delivery remain UNVERIFIED. The six-step brief still only copies/downloads; no inquiry is transmitted. Madagin and the confirmed clients Sage Burress and Masonry Color Corrections remain unchanged.

Local full-flight measurements: desktop 25.009 MiB world, 20.951 s ready, 227.49 MiB heap; compact 7.900 MiB, 8.388 s ready, 99.75 MiB heap. Desktop transfer and both local startup samples fail the unchanged 24/8 MiB and 8 s targets. Content-held frame samples pass; held lake p95/p99 is 50.6/72.9 ms desktop (fail) and 20.6/20.7 ms compact (pass). The contemporaneous live baseline also fails desktop lake frames at 49.4/61.8 ms, contradicting the older 29.1/29.3 ms pass. These unpaired host samples establish neither speed improvement nor performance equivalence. Heap targets remain 384/192 MiB; frame targets remain 33.3/50 ms. Public results are recorded separately in the publication receipt.

B remains open. The finite improvement is accepted subject to exact publication verification, while performance and independent qualification failures remain visible. [Decision](../../output/releases/madagin-connected-water-20260911/decision.json) · [Actual observed motion spans and gaps](../../output/releases/madagin-connected-water-20260911/visual-review.json) · [Publication](../../output/releases/madagin-connected-water-20260911/publication.json).
