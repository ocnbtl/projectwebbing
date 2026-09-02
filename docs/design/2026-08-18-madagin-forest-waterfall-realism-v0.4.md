# Madagin forest and waterfall realism benchmark v0.4

## 1. Design brief

| Field | Contract |
|---|---|
| Outcome | Replace the v0.3 faceted vegetation and flat waterfall treatment with a credible mid-distance forest and atmospheric waterfall while retaining a web-responsible payload. |
| Scope | Protected `/internal/world-lab`; runtime fir LOD geometry; local CC0 texture subset; higher-detail joined rock field; animated waterfall ribbons and mist; desktop and mobile policies. |
| Non-goals | Final close-up hero assets, public-route integration, audio, contact delivery, analytics changes, publication, deployment, or a production-readiness decision. |
| Authority | Ocean's 2026-08-18 instruction to continue implementing strategically authorizes scoped local implementation and verification. |
| Decision owner | Ocean. |
| Inputs | v0.3 benchmark and runtime evidence; current repository; Poly Haven Fir Tree 01 page, API metadata, and CC0 license. |
| Constraints | One continuous world; fast load; no runtime third-party dependency; no copied agency assets; deterministic generation; mobile parity; protected lab remains authenticated. |
| Completion criteria | Deterministic v0.4 Blender and GLB outputs; texture provenance; zero diagnostic geometry; responsive desktop/mobile runtime; performance and repository gates pass. |
| Checks not run | Public-route and provider checks are intentionally not applicable to this protected local phase. |

## 2. Source-of-truth and contradiction matrix

| Claim domain | Source | Supported claim | Limitation or contradiction | Resolution |
|---|---|---|---|---|
| Product direction | Ocean's current and prior instructions | A cinematic, plausible shared landscape with meaningful camera transitions is approved. | Final asset fidelity is not yet approved. | Keep the work labeled benchmark. |
| Runtime baseline | v0.3 protected lab, 2026-08-18 | Camera architecture and adaptive tiering work locally. | Faceted canopies and proxy-like waterfall fail the desired realism bar. | Replace those layers without changing route architecture. |
| Tree source | https://polyhaven.com/a/fir_tree_01 | Photoreal fir textures, authored LOD source, CC0. | Official glTF uses a roughly 478 MB shared binary and is unsuitable for direct web delivery. | Vendor four 1K textures only; author deterministic runtime geometry. |
| License | https://polyhaven.com/license | Poly Haven assets are CC0 and may be used commercially. | CC0 does not itself prove Madagin exclusivity. | Preserve provenance; do not claim exclusivity. |
| Repository | Current dirty `main` at `2678bc99` | v0.1–v0.3 work is local and uncommitted. | Remote and production do not contain these changes. | Preserve the working tree; do not commit, push, or deploy. |

## 3. Primary mode and optional overlay

| Field | Value |
|---|---|
| Primary mode | `MARKETING SITE` |
| Ownership rationale | The benchmark serves Madagin's identity, narrative, memorability, trust, and eventual conversion experience. |
| Optional overlay | `NONE` |
| Other plausible modes | `BRAND / VISUAL SYSTEM` is represented by the existing internal brand route, but this phase is a runtime experience benchmark. |

## 4. Direction alternatives and selection status

| Direction | System logic | Payload consequence | Visual consequence | Status |
|---|---|---|---|---|
| Ship Poly Haven's full fir glTF | Reuse source geometry directly. | Approximately 478 MB geometry before the wider world. | Highest source fidelity but unacceptable load. | Rejected. |
| Retain procedural solids | Continue dodecahedron canopies. | Small. | Reads as faceted placeholder art. | Rejected. |
| Texture-atlas LOD forest | Cut real twig atlas regions onto Madagin-authored crossed cards with instanced trunks and shader wind. | Four local 1K JPGs plus very small procedural geometry. | Browser QA proved the packed source mask does not provide a clean branch silhouette; cards became visible slabs. | Rejected after real-browser evidence. |
| Authored bough LOD forest | Instance deterministic, tapered 3D boughs with CC0 textured trunks and low-amplitude shader wind. | Two runtime-loaded 1K bark JPGs, one compact draw field, and no alpha overdraw. | Clean conifer silhouettes at journey distance; deliberately not represented as final close-up foliage. | `APPROVED FOR IMPLEMENTATION` by current continuation authority. |

## 5. Decision and approval record

### Current decision state

`APPROVED FOR IMPLEMENTATION`

| Decision | Owner | Evidence | Locked elements | Unresolved elements | Reopen condition |
|---|---|---|---|---|---|
| Use authored bough LOD trees in the protected benchmark | Ocean | Current instruction to continue strategically after v0.3 review, with implementation adjusted after browser QA exposed the atlas-mask failure. | Shared geography, adaptive tiers, local assets, no public release. | Final species mix and close-camera tree hero assets. | Owner rejects the v0.4 visual evidence or a device budget fails. |
| Use a single joined detailed rock field | Ocean | Same bounded continuation authority. | Deterministic generator and one draw field. | Final cliff and waterfall-basin sculpting. | Rock field harms camera clearance or performance. |

## 6. Audience, role, and primary-task model

| Role | Context | Primary task | Success | Protected action |
|---|---|---|---|---|
| Owner | Authenticated internal workspace | Evaluate forest, waterfall, and device cost before public integration. | Can compare every camera state with visible runtime diagnostics. | Public publication remains unavailable in this phase. |
| Future visitor | Public experience, not implemented here | Move through a cinematic landscape without UI or load friction. | The eventual world reads as plausible and responsive. | No visitor runtime claim is made from the protected lab. |

## 7. Information architecture

`/internal/world-lab` retains the existing journey, ocean/About, sky/Projects, and mountain-ascent/Let's Talk state model. v0.4 replaces asset and rendering layers only; it does not add navigation or expose a new public route.

## 8. Route, workflow, and state matrix

| Surface | Role | Primary action | States | Responsive behavior | Acceptance evidence |
|---|---|---|---|---|---|
| `/internal/world-lab` | Authenticated owner | Select journey or contextual camera states. | Loading, WebGL ready, WebGL unavailable, journey, about, projects, contact. | Canvas and controls remain sequential on narrow screens. | Browser accessibility snapshot, screenshots, FPS/calls/triangles, overflow measurement. |
| `/internal/login` | Unauthenticated owner | Enter password. | Default, invalid, authenticated redirect. | Existing form contract preserved. | Route and auth behavior remain untouched. |

## 9. Design-system contract

| Dimension | v0.4 rule | Responsive rule | Status |
|---|---|---|---|
| Imagery | CC0 bark surfaces and authored 3D bough silhouettes drive mid-distance detail; source geometry is not shipped. | Geometry density varies by tier and mobile caps at balanced. | Approved for protected benchmark. |
| Motion | Wind is a low-amplitude vertex deformation; waterfall ribbons and mist move independently. | Reduced motion freezes time at a readable frame. | Approved. |
| Color | Foliage stays natural olive/fir green; no synthetic neon accent enters the world. | Same palette with existing mobile exposure. | Approved. |
| Content | Diagnostics name sources and benchmark state plainly. | Labels wrap; no horizontal overflow. | Approved. |
| Accessibility | HTML controls, names, pressed states, focus behavior, and fallback remain outside the canvas. | Touch and keyboard alternatives remain explicit. | Preserved. |

## 10. Token specification

| Token | Tier | Value | Purpose | Fallback |
|---|---|---|---|---|
| `world.fir.count.high` | Component | `540` | Desktop forest density. | Balanced or conservative count. |
| `world.fir.count.balanced` | Component | `340` | Mid-tier density. | Conservative count. |
| `world.fir.count.conservative` | Component | `145` | Constrained/mobile geometry floor. | WebGL still-image fallback. |
| `world.fir.rings` | Component | `14 / 11 / 8` | Tiered bough-ring density without alpha sorting or overdraw. | Conservative ring count. |
| `world.mobile.maxTier` | Page | `balanced` | Prevents phone-sized viewports from inheriting desktop-high geometry on many-core devices. | Conservative tier still applies on constrained hardware. |
| `world.waterfall.mist` | Component | `78 / 46 / 24` | Tiered base spray particles. | Waterfall ribbon remains readable without mist. |

## 11. Component and variant inventory

| Component | Change | Variants | Functional contract |
|---|---|---|---|
| `VegetationField` | Replace solid canopies with instanced tapered bough geometry and textured trunks. | High, balanced, conservative; moving and reduced-motion. | Deterministic placement, waterfall clearance, and two draw fields. |
| `WaterfallMist` | New bounded point-sprite base mist. | Tiered count; moving and reduced-motion. | No input interception or DOM dependency. |
| `WorldLayout` | Load v0.4 GLB and use procedural waterfall ribbon shader. | Existing device tiers. | Camera and water behavior preserved. |
| Blender v0.4 generator | Replace v0.3 boulders with UV-mapped irregular joined rock field. | Deterministic seed. | Source `.blend`, runtime `.glb`, and preview remain reproducible. |

## 12. Responsive behavior matrix

| Behavior | Desktop | Tablet | Mobile | Unresolved risk |
|---|---|---|---|---|
| Forest | 540 high-detail bough instances where capable. | Adaptive CPU tier. | No dynamic shadows; DPR capped; high tier capped to balanced. | Real low-end hardware still needs device testing. |
| Mist | Up to 78 particles. | 46 or 78 by tier. | 24–78 by CPU tier while mobile shadow policy remains enforced. | Real low-end hardware is not represented by desktop emulation. |
| Control shell | Concurrent stage and state rail. | Stacked at existing breakpoint. | Sequential content with full-width canvas. | Constrained landscape height needs a later public-shell check. |

## 13. Accessibility plan and acceptance criteria

| Requirement | Observable criterion | Method |
|---|---|---|
| Keyboard and semantics | Every camera state remains a named HTML button; sliders retain accessible names. | Accessibility snapshot and keyboard path. |
| Reduced motion | Wind, water offset, waterfall ribbons, particles, and camera easing stop or settle immediately. | Emulate `prefers-reduced-motion: reduce`. |
| Reflow | 390px viewport has no horizontal overflow and all state controls remain reachable. | Browser dimension check and screenshot. |
| Non-WebGL recovery | HTML explains the still-image fallback contract. | Existing fallback inspection. |

## 14. Content, asset, approval, and technical blockers

| Class | Item | Impact | Work that may continue | Owner |
|---|---|---|---|---|
| `MISSING APPROVAL` | Final close-camera species and sculpted cliff assets. | Blocks calling the world final. | Mid-distance runtime and LOD validation. | Ocean. |
| `TECHNICAL CONSTRAINT` | Source fir glTF is approximately 478 MB. | Prevents direct use. | Authored runtime LOD implementation. | Codex implementation. |
| `TECHNICAL CONSTRAINT` | The source twig mask is a packed material map, not a clean opacity silhouette. | Atlas-card browser test produced dark slabs. | Retain exact files for provenance/reference; do not runtime-load them in v0.4. | Codex implementation. |
| `TECHNICAL CONSTRAINT` | Current R3F dependency emits an upstream `THREE.Clock` deprecation warning. | No observed runtime failure. | Continue with zero console errors; track dependency upgrade later. | Future dependency maintenance. |

## 15. Prototype or fidelity evidence log

| Decision risk | Fidelity | Artifact | Boundary | Validation |
|---|---|---|---|---|
| Can forest massing remain convincing within a web budget? | Medium geometry fidelity with real-time silhouettes and wind. | Protected v0.4 World Lab. | Local benchmark, not final close-up foliage or public production. | Desktop/mobile screenshots and metrics. |
| Can waterfall motion read without a video? | Real-time procedural ribbon and bounded particle fidelity. | Same route. | No refraction or audio claim yet. | Waterfall checkpoint inspection. |

## 16. Functional-preservation matrix

| Contract | Classification | Verification |
|---|---|---|
| Internal authentication and protected routing | `PRESERVED` | No auth files or middleware changed; authenticated browser path required. |
| Journey checkpoint and contextual camera state | `PRESERVED` | Existing manifest and control behavior retained. |
| Public routes, contact form, projects, blog, analytics | `PRESERVED` | No public component or data-flow edits. |
| Reduced-motion behavior | `INTENTIONALLY CHANGED WITH APPROVAL` | New world motion now respects the existing preference. |
| Asset provenance | `INTENTIONALLY CHANGED WITH APPROVAL` | New Fir Tree subset has exact source URLs, sizes, and MD5 hashes. |

## 17. Implementation handoff and acceptance criteria

### Approved scope

Protected v0.4 benchmark assets and runtime code only.

| ID | Surface | Action | Observable result | Evidence |
|---|---|---|---|---|
| FW-01 | Forest | Load journey and reveal checkpoints. | No faceted solid canopies or opaque atlas slabs; conifer silhouettes read at journey distance; placement remains deterministic. | Desktop/mobile screenshots. |
| FW-02 | Waterfall | Select waterfall checkpoint. | Water sheet shows moving ribbon variation and a bounded mist field; reduced motion freezes both. | Screenshot and runtime inspection. |
| FW-03 | Rocks | Run Blender generator. | Joined irregular UV-mapped rock field appears at valley edges and waterfall basin; outputs are reproducible. | Generator log and preview. |
| FW-04 | Payload | Inspect local assets. | v0.4 GLB plus the four provenance-scoped fir JPGs stay below 7 MB; the browser loads only the two bark JPGs. | File-size reconciliation and request inspection. |
| FW-05 | Performance | Let desktop and mobile scenes settle. | Desktop stays at or above 50 FPS and below 35 calls; mobile stays above 30 FPS with no horizontal overflow. | Runtime metrics. |
| FW-06 | Repository | Run project gate. | Lint, TypeScript, and production build pass. | `pnpm check`. |

### Guardrails

- Do not ship the source fir geometry.
- Do not add a runtime Poly Haven dependency.
- Do not label this final, approved public art, released, or live.
- Do not alter authentication, public content, form delivery, analytics, or persistence.
- Do not commit, push, or deploy without separate authority.

## 18. Runtime-aware next-owner recommendation

| Field | Value |
|---|---|
| Canonical owner | `production-build-and-integration` |
| Reason | Implement and locally verify the approved v0.4 protected benchmark. |
| Availability | `AVAILABLE` |
| Availability evidence | Current installed skill catalog. |
| Task status | `APPLIED IN THIS TASK` |
| Bounded fallback | Retain the authored bough LOD if future photographic cards fail visual, accessibility, payload, or performance gates. |

## 19. Plain-English summary

v0.4 tests a responsible path from placeholder forest to plausible real-time nature: real CC0 surface textures on compact Madagin-authored bough LOD geometry, a more dimensional joined rock field, and a waterfall that moves and breathes without video. Browser evidence rejected the first atlas-card attempt and established the current no-alpha geometry path. The shared-world navigation and protected internal workflow remain unchanged. Ocean still owns final asset approval, and public integration remains a later release-boundary decision.

## 20. Verification evidence

| Gate | Result | Evidence |
|---|---|---|
| Deterministic Blender generation | Pass | Blender 5.2 background export completed; GLB SHA-256 `5425f17357fb4b1d41f97e89e904a40848ecdee841e05de8d47915ea5d825f64`. |
| Payload ceiling | Pass | v0.4 GLB plus four provenance-scoped JPGs: `6,314,639` bytes (`6.02 MiB`), below the `7 MiB` benchmark ceiling. Runtime fetch excludes the two twig candidate files. |
| Desktop opening | Pass | 1280×800, high tier: `60 FPS`, `26` calls, `495,692` triangles, no horizontal overflow. |
| Desktop waterfall | Pass | 1280×800, high tier: `60 FPS`, `18` calls, `474,572` triangles; procedural ribbons and mist active. |
| Context preservation | Pass | Waterfall checkpoint remained `04 / 05` while About changed only the look target to the ocean. |
| Mobile | Pass | 390×844, balanced tier: `60 FPS`, `20` calls, `176,180` triangles, no horizontal overflow. |
| Reduced motion | Pass | Emulated `prefers-reduced-motion: reduce` produced `Calm rail`; scene remained WebGL-ready and overflow-free. |
| Browser console | Pass with upstream note | Zero errors; one `THREE.Clock` deprecation warning originates in the current renderer dependency. |
| Repository gate | Pass | Fresh `pnpm check`: ESLint, TypeScript, and Next 16.3 production build all exited successfully. |
