# Madagin Cinematic Implementation Feasibility v0.1

**Status:** `PROPOSED`  
**Architecture decision owner:** Ocean, informed by measured implementation evidence  
**Current spike method:** Semantic HTML + CSS/SVG layers + small progressive-enhancement JavaScript

## 1. Decision

Use a layered static/SVG prototype to validate story clarity now. For production, begin with **segmented responsive video plus poster frames over complete semantic content**. Test an image-sequence/canvas implementation only if owner review establishes that precise reversible scroll scrubbing is central to the approved story. Use WebGL only if a real 3D or depth interaction produces a decision-relevant benefit that the simpler methods cannot provide within accessibility and performance budgets.

The architecture invariant is the semantic site, not the cinematic renderer. Every renderer can fail or be disabled without removing the offer, proof, capabilities, navigation, or inquiry path.

## 2. Evidence and constraints

- [web.dev currently defines “good” Core Web Vitals](https://web.dev/articles/defining-core-web-vitals-thresholds) as LCP <=2.5s, INP <=200ms, and CLS <=0.1 at the 75th percentile.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) is the proposed AA target. The design additionally adopts a 44x44 CSS px standalone-control target and a motion-off path.
- [W3C's animation guidance](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions) says users should be able to prevent nonessential interaction-triggered motion; scroll-driven parallax is a named concern.
- [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion) is established across current browsers and can remove or replace nonessential motion.
- No production media, target traffic profile, CMS, stack, browser support matrix, analytics provider, or field baseline exists. Budgets below are proposals, not measured current state.

## 3. Options and tradeoffs

| Method | Best use | Benefits | Costs / risks | Accessibility/fallback | Reversibility | Recommendation |
|---|---|---|---|---|---|---|
| A. Layered SVG/stills + CSS | Narrative/interaction validation; reduced-motion path | Tiny assets, crisp, easy to edit, strong semantic separation, deterministic | Cannot prove cinematic realism; complex illustration can become heavy | Excellent; render full static composition and normal document flow | High | **Use now** and retain as fallback |
| B. Segmented responsive video | Directed photoreal scenes and loops | Predictable grade/camera; efficient hardware decode; source-independent | Scrubbing/seek can be inconsistent; encoding/cropping work; decoder/memory pressure | Posters and semantic chapters; pause/skip/motion-off controls | High | **Production base** |
| C. Image sequence on canvas | Precise scroll-to-frame mapping | Deterministic frame selection; flexible compositing | Many requests or large sprite; memory/decode pressure; canvas has no semantic content; mobile risk | DOM content and poster strip must remain authoritative | Medium | **Measured spike only** |
| D. Selective WebGL | Real depth, particles, camera or 3D exploration that the story genuinely needs | Highest spatial control and differentiation | Largest engineering/QA surface; GPU/battery/device/browser risk; asset/tooling complexity | Separate static/video path required; never sole content | Low–medium | **Defer unless unique value is proven** |

### Why segmented video is the provisional production base

The desired shots are directed, short, and photoreal. Video is the closest delivery format to the actual output, and modern browsers can decode it without rebuilding the scene at runtime. Segments let the page load only the nearby scene, provide dedicated mobile crops, stop inactive decoders, and use a still when motion is reduced or unavailable. Scroll should select/enter scenes and apply modest crossfades; it should not continuously seek a long video on every scroll tick until device testing proves that behavior reliable.

## 4. Proposed production architecture

```text
Semantic document (source of meaning and navigation)
├─ Global navigation, skip journey, motion control, CTA
├─ Story chapters with headings, text, links, and proof
├─ Selected work / capabilities / approach / inquiry
└─ Legal and trust routes

Progressive cinematic layer (replaceable renderer)
├─ LCP poster: static, responsive, eagerly loaded
├─ Nearby scene preloader: one scene ahead, respects data constraints
├─ Active renderer: video OR canvas/WebGL experiment
├─ Poster/error fallback per scene
└─ media manifest: identity, crop, codec, dimensions, size, rights, approval
```

Renderer selection is a capability decision:

1. If reduced motion is requested, use static approved posters and normal content flow.
2. If data saver, low memory, unsupported codec/API, or load/decode failure is detected, use posters.
3. Otherwise use segmented video by default.
4. Enable canvas/WebGL only after the exact device/browser/asset gate passes; do not infer support from API presence alone.

## 5. Interaction model

- Natural document scrolling only; no wheel interception, scroll lock, forced snapping, or artificial inertia.
- A sticky visual stage may accompany normal-height chapters, but headings and actions stay in DOM reading order.
- Scroll progress updates at most once per animation frame and writes only compositor-friendly visual variables.
- The active scene changes at stable chapter boundaries; inactive video pauses and releases resources where practical.
- `Skip the journey` moves focus to the first proof/content section.
- `Use less motion` disables nonessential transforms and video playback without hiding content.
- No autoplay audio. Any future audio is opt-in, separately controlled, captioned/transcribed where meaningful, and nonessential.
- Deep links and browser back/forward must not depend on animation state.

## 6. Fallback and failure matrix

| Condition | Visual behavior | Content/action behavior | Verification |
|---|---|---|---|
| JavaScript disabled | Static complete tree/poster and normal chapters | Full nav, headings, links, work, capabilities, CTA | Browser no-JS run |
| `prefers-reduced-motion: reduce` | No scroll-linked position/scale motion; static posters; opacity changes only if necessary and accepted | Same content and focus order | OS/browser emulation + manual review |
| Site motion control active | Same as reduced-motion path | Control remains reachable and state is communicated | Keyboard walkthrough |
| `Save-Data` / constrained connection | Poster-first; no speculative video preload | Complete experience; optional explicit media action if later approved | Request-header/network simulation |
| Video error/unsupported codec | Scene poster; no blank stage | Chapter and CTA remain | Block media requests / codec test |
| Canvas/WebGL context loss | Replace renderer with poster; log non-sensitive diagnostic | No route/action loss | Synthetic context-loss test if renderer is adopted |
| Short viewport | Sticky stage shrinks or becomes inline; no “rotate your device” blocker | Navigation and CTA remain visible | 1280x600 and mobile landscape |
| Zoom/reflow | Stage becomes inline/static if it competes with text | No horizontal scrolling at 320 CSS px equivalent | 200%/400% and narrow reflow review |
| Keyboard/screen reader | Decorative progress is silent; story is headings/text; skip moves focus | All actions named and ordered | Accessibility tree and keyboard path |

## 7. Proposed performance budgets

These budgets are an approval gate, not evidence of current performance.

| Budget | Proposed target | Why / test |
|---|---:|---|
| HTML + critical CSS + critical JS | <=120 KB compressed | Keeps narrative shell inexpensive; bundle report |
| LCP poster | <=250 KB compressed at mobile DPR strategy | Image inspection and network profile |
| Total initial mobile transfer | <=650 KB compressed before deferred cinematic media | Throttled first-load trace |
| Total optional narrative media | <=6 MB mobile; <=12 MB desktop per full journey | Media manifest sum; revisit only with user evidence |
| Font delivery | System stack for spike; production subsets <=100 KB initial total | Font manifest and fallback test |
| Active decoders | One video decoder at a time | Runtime inspection and memory profile |
| Layout shift | Lab CLS <=0.05; field p75 <=0.1 | Reserve media dimensions; lab/field evidence |
| Largest content paint | Lab mobile target <=2.3s; field p75 <=2.5s | Throttled lab and later field evidence |
| Interaction | No repeated long task >50ms during scroll; field p75 INP <=200ms | Performance trace and later RUM |
| Frame pacing | Target 60 fps; no sustained visible stutter on agreed mid-tier devices | DevTools trace with real assets |
| Memory | Establish baseline, then cap renderer increase at an owner-approved measured threshold | Device profiling; no guessed universal MB claim |

Do not preload every clip. Preload the LCP poster, then at most the current/next approved scene based on distance, connection, memory, and user preference.

## 8. Encoding and asset delivery proposal

- Store a high-quality mezzanine outside the public bundle with provenance and hashes.
- Produce responsive landscape and portrait compositions; crops are not assumed equivalent.
- Provide modern codecs after real compatibility analysis, plus a broadly supported fallback; do not lock codec names before the browser matrix is approved.
- Every `<video>` gets explicit dimensions/aspect ratio, poster, `muted`, `playsinline`, and no audio dependency.
- Avoid one long hero video. Segment by story beat so a failed/deferred scene cannot block the rest.
- Use a media manifest containing scene ID, source hash, approved crop, dimensions, duration, codecs, byte size, poster, rights status, and owner approval.
- Do not ship alpha video or 4K merely because a provider generated it; display size and measured quality govern derivatives.

## 9. Accessibility contract

| Area | Observable design/implementation requirement |
|---|---|
| Structure | One `h1`; logical headings; `header`, `nav`, `main`, section labels, and footer; visual stage does not replace text |
| Keyboard | Skip link first; every control and CTA reachable; no trap; focus moved deliberately after skip only |
| Focus | Two-color or otherwise robust visible indicator with >=3:1 change contrast against relevant surfaces; never hidden under sticky UI |
| Motion | OS preference and site control disable nonessential scroll animation; core meaning does not require movement |
| Targets | Standalone controls target 44x44 CSS px where feasible, exceeding WCAG 2.2 AA's 24x24 minimum |
| Contrast | Normal text >=4.5:1 and large text >=3:1 against its actual rendered background; non-text/focus checks included |
| Reflow | No loss of content/action at 320 CSS px equivalent; sticky composition yields to normal flow |
| Media | Decorative media has empty/hidden semantics; meaningful visual information is present in adjacent text; no baked-in text |
| Status | Scene progress is not announced on every scroll frame; motion-control state has an accessible pressed/status representation |
| Forms | Future inquiry uses explicit labels/instructions/errors; focuses an error summary; announces server-confirmed success only |

## 10. Technical spike order

1. **Static/SVG clarity spike (completed in v0.1 files):** Test hierarchy, natural scroll, progressive scene variables, skip, reduced motion, desktop/mobile composition.
2. **Real poster spike:** After visual direction approval, export one desktop and one mobile P0 poster; measure LCP and crop legibility.
3. **Segmented-video spike:** Test P0-01 and P0-05 on agreed representative devices; measure transfer, decode, memory, frame pacing, poster fallback, motion-off behavior.
4. **Image-sequence spike:** Only if precise scrub is required; use the same visual beat and byte ceiling for fair comparison.
5. **WebGL proof:** Only if a named spatial behavior cannot be achieved by the first three; build an isolated scene, not the site.
6. Record evidence in one comparison: exact asset hashes, browser/device, viewport, connection/CPU profile, transfer, LCP, long tasks, memory, frames, preference/failure results.

### Decision gate

Choose the simplest renderer that preserves the approved experience and passes budgets on the agreed weakest supported device. A prettier desktop capture does not overrule a failed mobile, reduced-motion, keyboard, or fallback path.

## 11. Prototype limitations

The v0.1 local prototype validates document structure, narrative hierarchy, a representative sticky scene, keyboard-reachable controls, and the intended reduced-motion approach. It does **not** prove:

- production identity, copy, case-study claims, assets, or owner approval;
- video/canvas/WebGL performance;
- media rights or Higgsfield output quality;
- WCAG conformance, screen-reader interoperability, or cross-browser completeness;
- form delivery, CMS, analytics, SEO outcomes, provider compatibility, or live Core Web Vitals.

## 12. Production acceptance evidence

Before architecture selection becomes implementation-ready, retain:

- owner-approved narrative and media behavior;
- exact representative device/browser matrix;
- P0 desktop/mobile media hashes and manifest;
- comparable traces for every serious renderer candidate;
- no-JS, reduced-motion, data-saver, media-failure, short-height, keyboard, zoom/reflow evidence;
- accessibility tree and automated scan results with manual review;
- measured bundle/media budgets;
- owner decision recording the selected method and why rejected methods lost.
