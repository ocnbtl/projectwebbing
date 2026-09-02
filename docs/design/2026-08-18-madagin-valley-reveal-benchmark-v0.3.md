# Madagin valley-reveal benchmark v0.3

## 1. Design brief

| Field | Contract |
|---|---|
| Outcome | Establish one believable real-time landscape frame that becomes the quality and performance benchmark for Madagin's wider world. |
| Scope | Protected `/internal/world-lab`; valley-reveal checkpoint; authored terrain and ridges; PBR surface treatment; instanced vegetation; water; sky, haze, and golden-hour light; desktop and mobile quality tiers. |
| Non-goals | Public-route replacement, route-wide copy changes, contact delivery, production deployment, final audio, final fauna, final close-up foliage, or a complete open world. |
| Authority | Ocean explicitly asked Codex to continue implementing strategically after approving the western-ocean world model. Local reversible implementation is authorized. |
| Decision owner | Ocean. |
| Inputs | v0.2 shared-world architecture, contextual-ocean specification, current protected lab, Blender source, current Madagin type and color system, and the selected CC0 surface source. |
| Constraints | The world must remain continuous, fast-loading, mobile-capable, non-video, and legible behind HTML copy. Diagnostic geometry must never enter the runtime camera volume. |
| Completion criteria | A deterministic v0.3 Blender export loads in the protected lab; the valley reveal is visually legible; desktop and mobile remain operable; asset provenance and budgets are recorded; lint, typecheck, build, and browser checks pass. |
| Checks not run | Production deployment and representative physical-device GPU testing are outside this local benchmark. |

## 2. Source-of-truth and contradiction matrix

| Claim domain | Source | Supported claim | Limitation or contradiction | Resolution |
|---|---|---|---|---|
| Experience direction | Ocean's approved real-time-world direction in this task | One continuous geography; mountain journey; ocean is a contextual west-facing view; Let’s Talk is a mountain ascent. | Does not specify final terrain topology or individual asset choice. | This benchmark resolves only one visual slice. |
| Architecture | `2026-08-18-madagin-contextual-ocean-and-realism-v0.2.md` | Five saved journey checkpoints, quality tiers, progressive loading, no video fallback. | v0.2 geometry is explicitly a greybox. | Preserve behavior; replace only benchmark fidelity. |
| Current implementation | `world-lab.tsx`, `world-manifest.ts`, v0.2 GLB | Protected runtime, checkpoint state, WebGL diagnostics, mobile reflow. | Cone mountains and flat materials cannot establish final realism. | Retain controls and state while loading v0.3 assets. |
| Surface asset rights | Poly Haven asset and license pages, checked 2026-08-18 | `aerial_grass_rock` is a photo-based CC0 PBR texture; commercial use is allowed. | Poly Haven's translated API summary and an older API page disagree about API commercial terms. The asset license itself is unambiguous. | Vendor the exact files locally with hashes; no production runtime API dependency. |
| Runtime evidence | Local protected World Lab, 2026-08-18 | v0.2 reached 60 FPS in one desktop browser and reflowed at 390x844 without horizontal overflow. | One browser is not representative device coverage. | Re-measure v0.3 and retain conservative tier. |

## 3. Primary mode and optional overlay

| Field | Value |
|---|---|
| Primary mode | `MARKETING SITE` |
| Ownership rationale | The benchmark exists to carry Madagin's narrative, identity, trust, and conversion experience. |
| Optional overlay | `NONE` |
| Other plausible modes | Brand-system work supplies inputs but does not own this interaction benchmark; the internal lab is only the safe test surface. |

## 4. Direction alternatives and selection status

The real-time geography and west-ocean direction are already approved. The selected benchmark method is authored macro geography plus licensed photo-based surface detail and runtime instancing. A fully procedural shader-only world was rejected for this phase because it would make surface authenticity harder to evaluate. A large purchased environment pack was rejected because provenance, style control, payload, and dependency cost would be worse.

## 5. Decision and approval record

### Current decision state

`APPROVED FOR IMPLEMENTATION`

| Decision | Status | Owner | Evidence | Locked elements | Unresolved elements | Reopen condition |
|---|---|---|---|---|---|---|
| Western ocean beside the mountain journey | Approved | Ocean | Direct task approval | Ocean stays west/left; About pans without translating. | Exact coastline mesh and ocean shader. | Geography fails a camera checkpoint. |
| Valley reveal as v0.3 benchmark | Approved | Ocean | “Continue implementing strategically, and working and making progress.” following approval of v0.2 | One benchmark before broad propagation. | Final vegetation species and hero-grade close detail. | Benchmark misses performance or authenticity gates. |
| Photo-based CC0 terrain material | Approved within local implementation scope | Ocean / implementation | Reversible, locally vendored asset with verified license and hashes. | No runtime dependency on a third-party API. | Final material library selection. | Rights or provenance evidence changes. |

## 6. Audience, role, and primary-task model

| Audience | Context | Primary question | Primary task | Success signal | Recovery need |
|---|---|---|---|---|---|
| Prospective client | Arrives with little context | Is Madagin distinctive and capable enough to trust? | Experience the journey, then inspect work or begin a conversation. | The world supports, rather than obscures, the promise and navigation. | HTML content and still fallback remain readable if WebGL fails. |
| Owner in protected lab | Authenticated and evaluating quality | Is this scene authentic, coherent, and fast enough to propagate? | Compare checkpoints and quality evidence. | Measured scene stays within the benchmark budget. | v0.2 remains recoverable and public rendering remains unchanged. |

## 7. Information architecture

The route tree remains unchanged. The protected lab gains a v0.3 benchmark payload under the existing Journey state. About, Projects, and Let’s Talk retain their current contextual behavior. The benchmark does not add public navigation or a second public experience.

## 8. Route, workflow, and state matrix

| Surface | Role | Primary action | Functional contract | States | Responsive behavior | Acceptance evidence |
|---|---|---|---|---|---|---|
| `/internal/world-lab` | Authenticated owner | Select checkpoint or contextual view | Password protection and saved checkpoint behavior are preserved. | Loading, WebGL-ready, WebGL-unavailable, journey, about, projects, contact. | Canvas and controls stack below 1050px; no horizontal overflow at 390px. | Browser snapshot, screenshot, console, dimensions, FPS, calls, triangles. |
| Valley reveal | Authenticated owner | Inspect benchmark | Camera reaches a clear corridor and never starts inside geometry. | Progressive asset load and settled benchmark. | Mobile camera rises and DPR caps lower. | Desktop and mobile screenshots plus performance readout. |

## 9. Design-system contract

| Dimension | Rule | Responsive rule | Accessibility constraint | Status |
|---|---|---|---|---|
| Typography and copy | Existing Instrument hierarchy and HTML caption remain authoritative. | Fluid sizes and existing mobile order remain. | World imagery never contains essential text. | Preserved. |
| Color | Cool forest and stone shadows with restrained warm western light; no fantasy saturation. | Tone mapping exposure may step down on conservative tier. | Caption contrast is maintained by the existing stage veil. | Proposed benchmark rule. |
| Imagery | Authored geography plus a locally vendored photo-based CC0 PBR material. | 1K maps are the benchmark payload; future KTX2 variants may replace them. | Decorative world uses an empty alt model because equivalent HTML content is present. | Approved for benchmark. |
| Motion | Eased checkpoint camera; slow water and foliage motion; no scroll scrubbing. | Reduced motion snaps the camera and freezes nonessential surface drift. | OS reduced-motion preference remains automatic. | Preserved and extended. |

## 10. Token specification

| Token | Tier | Value | Purpose | Fallback | Status |
|---|---|---|---|---|---|
| `world.sun.warm` | Semantic | `#ffd39a` | Western golden-hour key light. | Neutral daylight key. | Proposed. |
| `world.fog.horizon` | Semantic | `#829b9a` | Unifies distant ridges and water. | Existing linear fog. | Proposed. |
| `world.sky.zenith` | Semantic | `#071b2b` | Deep cinematic sky without crushed black. | Canvas background. | Proposed. |
| `world.water.deep` | Semantic | `#123f4b` | Ocean and lake body. | Current proxy water material. | Proposed. |
| `world.quality.high` | Component alias | 900 tree instances, shadows, up to 1.5 DPR | Desktop benchmark. | Balanced tier. | Proposed. |
| `world.quality.balanced` | Component alias | 520 tree instances, no dynamic shadows, up to 1.25 DPR | General mobile and laptop default. | Conservative tier. | Proposed. |
| `world.quality.conservative` | Component alias | 220 tree instances, static water, 1 DPR | Constrained devices. | Semantic HTML and still image. | Proposed. |

## 11. Component and variant inventory

| Component | Status | Purpose | Variants | Accessibility | Functional contract |
|---|---|---|---|---|---|
| `WorldLayout` | Revise | Load authored v0.3 geometry and apply material policy. | Textured and conservative. | Decorative canvas only. | Keeps current checkpoint state. |
| `VegetationField` | New | Add distant forest density using GPU instancing. | High, balanced, conservative. | Noninteractive. | Must not block route controls. |
| `WaterSurface` | New | Give lake and ocean plausible reflectance and small-scale motion. | Animated and reduced-motion/static. | Nonessential motion freezes when requested. | No external data. |
| `Atmosphere` | New | Sky gradient, sun glow, fog, and layered haze. | Quality-tier density. | Does not carry content. | HTML remains foreground authority. |
| `FrameMeter` | Reuse | Report local runtime evidence. | All tiers. | Text status remains visible. | Existing diagnostics preserved. |

## 12. Responsive behavior matrix

| Surface | Desktop | Tablet | Mobile | Rationale |
|---|---|---|---|---|
| Canvas | High tier may use shadows and 1.5 DPR. | Balanced tier caps at 1.25 DPR. | Camera rises, 1.0–1.25 DPR, fewer instances. | Preserve composition without treating mobile as a cropped desktop. |
| Lab controls | Side rail. | Stack below canvas. | Two-column view choices, sequential diagnostics. | Existing verified transformation. |
| Persistent internal navigation | Left rail. | Current shell behavior. | Horizontal compact navigation. | Preserve authenticated workspace access. |
| Constrained height | Stage remains scrollable with controls below. | Same. | No fixed control overlays beyond sound and caption. | Prevent blocked actions. |

## 13. Accessibility plan and acceptance criteria

| Requirement | Target | Acceptance criterion | Method |
|---|---|---|---|
| Keyboard | All lab controls operable without pointer | Checkpoint, view, sound, and ascent controls retain native buttons and range inputs. | Browser accessibility snapshot and keyboard pass. |
| Reduced motion | Respect OS preference | Camera snaps; water/foliage time uniforms stop or reduce to zero. | Emulated media query or code inspection plus browser state. |
| Reflow | 320px minimum content width | No horizontal document overflow at 390px benchmark and no control clipping. | Browser width measurement and screenshot. |
| Screen-reader names | Controls have explicit names and pressed states | Existing names remain present after scene replacement. | Accessibility snapshot. |
| Contrast | HTML caption remains legible over changing imagery | Existing veil and white caption remain; no copy is baked into WebGL. | Representative screenshot review. |

## 14. Content, asset, approval, and technical blockers

| Class | Item | Impact | Work that may continue | Resolution owner |
|---|---|---|---|---|
| `MISSING ASSET` | Final hero-grade tree, rock, and waterfall scan library | Blocks final close-up realism, not the benchmark. | Distant instanced vegetation and authored ridge forms. | Ocean. |
| `TECHNICAL CONSTRAINT` | WebGL device capability and texture compression vary | Prevents universal high tier. | Adaptive DPR, instancing, and conservative tier. | Implementation. |
| `MISSING APPROVAL` | Public replacement and release | Keeps v0.3 protected and local. | Full local benchmark. | Ocean. |

## 15. Prototype or fidelity evidence log

| Decision risk | Fidelity | Flow | Artifact | Data boundary | Viewports | Limitation | State |
|---|---|---|---|---|---|---|---|
| Can an authentic-looking frame fit the real-time budget? | High macro geography and PBR surface fidelity; medium vegetation and water fidelity; low final copy fidelity. | Open lab, select Valley reveal, inspect Journey/About/Contact return behavior. | Blender source, generated GLB, local textures, protected browser runtime. | Deterministic local assets only. | Desktop and 390x844 mobile. | Does not prove physical-device coverage or final close-up foliage. | Approved for implementation. |

## 16. Functional-preservation matrix

| Visual change | Current contract | Classification | Verification |
|---|---|---|---|
| Replace v0.2 benchmark geometry/materials | Protected lab authentication remains required. | `PRESERVED` | Unauthenticated redirect and authenticated route check. |
| Add vegetation, water, and atmosphere | Checkpoint and contextual-view state remains stable. | `PRESERVED` | Alpine/reveal → About → Journey round trip. |
| Add quality tiers | WebGL-unavailable HTML fallback remains. | `PRESERVED` | Static code and browser condition check. |
| Public renderer | Existing public route remains unchanged. | `PRESERVED` | Final diff inspection. |
| Contact form and delivery | Not touched. | `PRESERVED` | Final diff inspection; no live submission. |

## 17. Implementation handoff and acceptance criteria

### Approved scope

Protected v0.3 benchmark assets and code only. Public publication, final close-detail asset approval, audio, and deployment remain outside scope.

| ID | Surface | Action | Observable result | Viewport | Evidence |
|---|---|---|---|---|---|
| VR-01 | Valley reveal | Select checkpoint 02 | Camera settles outside all geometry with readable lake, ridges, and atmospheric depth. | Desktop and mobile | Screenshots. |
| VR-02 | About | Open from checkpoint 02 | Camera position remains at checkpoint 02 and turns west. | Desktop | Accessibility snapshot and screenshot. |
| VR-03 | Performance | Let scene settle | High-tier desktop stays at or above 50 FPS with under 35 calls and under 190k submitted triangles, including shadow-pass work, in the benchmark environment. | Desktop | Frame meter. |
| VR-04 | Mobile | Load protected lab | No horizontal overflow; controls remain operable; the explicit mobile render policy remains above 30 FPS in the benchmark environment regardless of the device's CPU tier label. | 390x844 | Measurement and screenshot. |
| VR-05 | Build | Run repository gate | Lint, TypeScript, and Next production build pass. | Local | `pnpm check`. |

### Verification result — 2026-08-18

| Gate | Result | Evidence |
|---|---|---|
| Desktop runtime | `PASS` | 60 FPS; 15–27 calls; 94,636–173,684 submitted triangles across the checked journey, ocean, and contact views. |
| Valley reveal composition | `PASS FOR BENCHMARK` | Camera clears the widened ridge corridor and frames the lake, waterfall, and opposing ridges. Final tree and rock assets remain a later realism pass. |
| Mobile runtime | `PASS` | 390x844; 60 FPS; 21 calls; 128,372 submitted triangles; 390px scroll width equals 390px client width. |
| Console | `PASS WITH UPSTREAM WARNING` | Zero errors; one `THREE.Clock` deprecation warning originates in the current React Three Fiber dependency path. |
| Repository gate | `PASS` | `pnpm check` completed lint, TypeScript, and the Next 16.3 production build. The first sandboxed build could not reach Google Fonts; the permitted network retry passed. |

### Guardrails

- Do not copy another agency's layout, footage, shaders, or authored world.
- Do not add unsupported claims or fabricated proof.
- Do not make the PBR source a third-party runtime dependency.
- Do not ship diagnostic rails, markers, or proxy clouds in the runtime payload.
- Do not publish or deploy without a separate release decision.

## 18. Runtime-aware next-owner recommendation

| Field | Value |
|---|---|
| Canonical owner | `production-build-and-integration` |
| Reason | Implement and locally verify the approved benchmark. |
| Availability | `AVAILABLE` |
| Availability evidence | Current installed skill catalog. |
| Task status | `APPLIED IN THIS TASK` |
| Bounded fallback | Preserve v0.2 protected lab if the benchmark misses its visual or performance gate. |

## 19. Plain-English summary

The approved v0.3 phase turns the Valley reveal into a real-time quality benchmark without changing the public site. It combines Madagin-authored geography with a locally vendored, photo-based CC0 terrain material, then adds tiered vegetation, water, and atmosphere in the browser. The existing protected route, checkpoint behavior, contextual ocean view, responsive lab, and public site remain preserved. Final close-up vegetation and public release still require later owner review.
