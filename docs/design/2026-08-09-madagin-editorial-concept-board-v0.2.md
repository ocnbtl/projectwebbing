# Madagin editorial concept board handoff v0.2

**Design state:** `AWAITING DECISION`  
**Decision owner:** Ocean  
**Date:** 2026-08-09  
**Primary mode:** `MARKETING SITE`  
**Overlay:** `NONE`  

## 1. Design brief

| Field | Contract |
|---|---|
| Outcome | Replace the rejected slogan/card presentation with a sparse, human, name-led editorial direction |
| Scope | One local responsive concept board covering promise, name story, point of view, method, standards, and proposed CTA |
| Non-goals | Final identity; complete homepage; case claims; production route; form; CMS; deployment |
| Authority | Local design and prototype artifact only |
| Decision owner | Ocean |
| Inputs | Ocean's 2026-08-09 feedback; v0.6 strategy; current local artifacts; current live reference observations |
| Constraints | Founder-led truth; approved words retained; rejected lines absent; no copied expression; no fake proof |
| Completion criteria | Board renders at desktop/mobile, has coherent text hierarchy, no horizontal overflow, and remains explicitly unapproved |
| Checks not run | User testing, assistive-technology audit, production performance, case/claim verification, implementation fidelity |

## 2. Source-of-truth and contradiction matrix

| Claim domain | Source | Supported claim | Limitation | Contradiction | Resolution |
|---|---|---|---|---|---|
| Owner approval | Ocean's 2026-08-09 feedback | Promise, name story, method, and standards remain useful; prior copy/presentation fails | Replacement not yet approved | Useful system versus poor expression | Retain system; rebuild every supporting line and visual hierarchy |
| Strategy | v0.6 | Redesign/outgrown-site tension and sparse editorial direction | Proposal | Could over-index on redesign clients | Owner confirms target mix |
| Historical board | v0.1 | Shows the rejected slogan/card direction | Not a baseline to preserve visually | Polished artifact versus direct rejection | Treat as superseded exploration, not approved intent |
| Live references | Noomo, Studio Freight, Réplica, Il Capo, Rhumb, 2026-08-09 | Restraint, scale, name-led meaning, work-first hierarchy, commercial clarity | Viewport-specific; not proof of effectiveness | Inspiration versus originality | Translate principles only |
| Current code | New local static HTML | Proposed responsive board structure | Not production code | None | Browser/source verification before handoff |

## 3. Primary mode and optional overlay

| Field | Value |
|---|---|
| Primary mode | `MARKETING SITE` |
| Ownership rationale | The decision is about brand narrative, hierarchy, trust, and conversion language for Madagin's public site |
| Optional overlay | `NONE` |
| Overlay impact | `NOT APPLICABLE` |
| Other plausible modes | Brand system is staged later because no identity asset is approved; fidelity review is not primary because the old board is rejected rather than authoritative |

## 4. Direction alternatives and selection status

| Direction | Hierarchy | Composition | Tone | Responsive consequence | Risk | Status |
|---|---|---|---|---|---|---|
| v0.1 Framework board | Promise → abstract name line → diagrams → quality cards → copy lab | Color blocks and boxed explanatory content | Constructed, self-explanatory | Many independent cards stack on mobile | Reads as AI-generated strategy presentation | Owner rejected |
| **v0.2 Name-led editorial** | Promise → client tension → name answer → point of view → method → standards → CTA | Full-screen statements, typographic name scene, bordered rows, minimal palette | Direct, spare, founder-led | Scenes linearize without losing hierarchy | Could become too minimal without later work/proof | `DIRECTION PROPOSED` |
| Work-first future homepage | Promise → approved cases → offer/method → proof → CTA | Real case media carries most of the persuasion | Confident and evidentiary | Requires strong mobile case crops and approved content | Blocked by missing approved case assets/claims | Future extension |

**Recommendation:** Use v0.2 to decide voice and editorial grammar, then place approved work earlier in the eventual homepage.

## 5. Decision and approval record

### Current decision state

`AWAITING DECISION`

| Decision | Status | Owner | Evidence | Locked elements | Unresolved elements | Renewed approval trigger |
|---|---|---|---|---|---|---|
| Public promise | `PROPOSED / FAVORED` | Ocean | Direct positive feedback | Exact three verbs | Placement and final category line | Copy change |
| Name origin | `LOCKED` fact | Ocean | Direct statement | Madagin derives from made again | Supporting explanation and visual use | Meaning changes |
| Method words | `PROPOSED / FAVORED` | Ocean | Direct positive feedback | Four terms and order | Supporting sentences | Term/order change |
| Standards | `PROPOSED / FAVORED` | Ocean | Direct positive feedback | Four terms | Supporting questions | Term change |
| v0.2 board | `DIRECTION PROPOSED` | Ocean | Agent recommendation only | None | Copy, palette, typography, hierarchy, name treatment | Any implementation |

## 6. Audience, role, and primary-task model

| Audience | Context | Primary question | Primary task | Success signal | Failure need |
|---|---|---|---|---|---|
| Prospective founder/business owner | Current site no longer matches the business | Can Madagin understand and close the gap? | Read promise, recognize tension, inspect method/proof, start a project | Can restate what Madagin changes and why | Reach services/work without completing an immersive sequence |
| Marketing/brand lead | Comparing creative partners | Is the work distinctive and commercially disciplined? | Evaluate standards, work, and process | Sees creativity tied to decisions and proof | Clear category/service language |
| Ocean | Reviewing direction | Does this sound and feel like Madagin? | Approve/revise consequential lines and grammar | Clear yes/no decisions on a small set of elements | Preserve rejected direction as history, not default |

## 7. Information architecture

```text
Editorial board
├── Promise + category
├── Client tension + name origin
├── Point of view
├── Method
│   ├── Fresh perspective
│   ├── Strategic direction
│   ├── Intentional transformation
│   └── Distinctive presence
├── Standards as questions
└── Proposed project CTA
```

The future homepage must insert approved work/proof after the promise or first tension. This board intentionally tests copy and hierarchy without fabricating that evidence.

## 8. Route, workflow, and state matrix

| Surface | Role | Question answered | Primary action | Content | States | Responsive behavior | Acceptance evidence |
|---|---|---|---|---|---|---|---|
| Local board | Reviewer | Does this direction improve voice and hierarchy? | Scroll, inspect, decide | Static proposed copy | Default; focused nav; reduced motion | 12-column scenes become a single editorial sequence | Browser screenshots + DOM audit |
| Proposed CTA | Reviewer | Is the close directionally right? | None; intentionally nonfunctional | “Start a project” label | Static concept only | Full-width bordered row | Must not imply real form delivery |

Loading, empty, error, success, disabled, and permission-denied states are `NOT APPLICABLE` because the board has no data, forms, authentication, or mutation.

## 9. Design-system contract

| Dimension | Proposed rule | Responsive rule | Accessibility constraint | Approval |
|---|---|---|---|---|
| Typography | One system grotesk; extreme scale difference; sentence case; tight display tracking | Fluid display sizes; no minimum smaller than readable body text | Semantic hierarchy must not depend on scale alone | Proposed |
| Color | Warm paper, near-black, one cobalt “new read” layer | Same roles at all sizes | Contrast verified before implementation; color is never the only meaning | Proposed |
| Layout | 12-column editorial grid; whitespace; full-screen scenes; ruled rows instead of cards | Linear content order under 820px | No horizontal scroll or obscured content | Proposed |
| Name scene | MADE AGAIN and MADAGIN typography used once as a meaning-bearing transition | Stacks and remains legible without motion | Text equivalent in accessible label | Proposed |
| Motion | No required motion in v0.2 | Static by default | Reduced-motion equivalence is inherent | Proposed |
| Voice | One idea per section; plain supporting sentences; no synthesis slogans | Copy order unchanged | Meaning remains intact in source order | Proposed |

## 10. Token specification

| Token | Tier | Value | Purpose | Responsive behavior | Source/status |
|---|---|---|---|---|---|
| `--paper` | Primitive | `#efede6` | Primary light surface | Fixed | Proposed exploration |
| `--ink` | Primitive | `#101010` | Text/dark surface | Fixed | Proposed exploration |
| `--blue` | Primitive | `#2446ff` | New-read/name emphasis | Fixed | Proposed exploration, not brand color |
| `--gutter` | Semantic | `clamp(1rem, 2.4vw, 2.75rem)` | Page edge | Fluid | Proposed |
| `--display` | Semantic | `clamp(4rem, 10.3vw, 10.5rem)` | Promise | Fluid | Proposed |
| `--statement` | Semantic | `clamp(3.25rem, 7.6vw, 8.25rem)` | Singular scene statements | Fluid | Proposed |

## 11. Component and variant inventory

| Component | Purpose | Anatomy | States | Responsive behavior | Accessibility | Status |
|---|---|---|---|---|---|---|
| Status strip | Prevent approval confusion | Artifact name + review status | Static | Condenses to status only | Text status, not color only | New proposal |
| Editorial hero | State promise and category | Eyebrow, one `h1`, founder note, descriptor | Default | Becomes vertical, full-height composition | One `h1`; meaningful source order | New proposal |
| Name scene | Connect client tension to name origin | Typographic study, heading, origin copy | Static | Visual stacks above copy | Labeled decorative/meaning aid | New proposal |
| Statement scene | Hold one point of view | Eyebrow, statement, one supporting line | Static | Linear | `h2` + paragraph | New proposal |
| Method row | Explain one stage as an action | Number, retained name, sentence | Default | Three-column row becomes stacked | Ordered list | New proposal |
| Standard quadrant | Turn a value into a review question | Retained word + question | Static | 2×2 becomes one column | Articles with headings | New proposal |
| Proposed CTA row | Test closing hierarchy | CTA label + “Proposed CTA” disclosure | Nonfunctional | Full width | Not presented as an active control | New proposal |

## 12. Responsive behavior matrix

| Surface | Desktop | Tablet | Mobile | Rationale | Evidence |
|---|---|---|---|---|---|
| Header | Wordmark + four links | Wordmark + contact link | Wordmark + contact link | Preserve a direct exit while removing crowding | Confirmed at 1440px and 390px |
| Hero | Promise spans 9 columns; support at lower right | Narrower display | Vertical full-height statement | Preserve dramatic hierarchy without unreadable line lengths | Confirmed in retained desktop/mobile captures |
| Name scene | Visual and copy split | Similar split until pressure point | Visual above copy | Keep name origin before explanation | Name result fits its container at both tested widths |
| Method | Number/name/copy in one ruled row | Same with tighter scale | One-column rows | Preserve stage order without cards | Mobile grid is one column; no overflow |
| Standards | 2×2 quadrants | 2×2 | One column | Each question receives enough reading space | Mobile grid is one column; no overflow |
| Persistent UI | None beyond header/status | Same | Simplified nav | Avoid content collisions | No collision observed at tested viewports |

## 13. Accessibility plan and acceptance criteria

| Requirement | Design rule | Observable criterion | Method | Limitation |
|---|---|---|---|---|
| Semantic structure | One `h1`; sequential `h2`/`h3`; ordered method | DOM contains one `h1`, landmarks, ordered list, and named nav | Source + DOM audit | Not an assistive-technology test |
| Keyboard | Skip link and header links reachable | First Tab exposes skip link; anchors receive visible focus | Browser smoke test | No complex controls exist |
| Contrast | Ink/paper and white/dark pairings; cobalt checked before production | No low-contrast body copy in representative views | Visual/token check | Full WCAG calculation pending |
| Reduced motion | No essential animation | All meaning available with motion disabled | Source inspection | Browser emulation pending |
| Reflow | Linear mobile order and fluid scale | No horizontal overflow at 390px | Browser measurement | One mobile width only |
| Non-color meaning | Status and name relation use text, not blue alone | Text equivalents remain when styles are removed | Source inspection | Visual-name comprehension still needs owner review |

## 14. Content, asset, approval, and technical blockers

| Class | Item | Impact | Work that may continue | Resolution | Owner |
|---|---|---|---|---|---|
| `MISSING APPROVAL` | v0.2 copy and visual direction | Blocks broader route design | Browser QA and bounded alternatives | Ocean approves/revises | Ocean |
| `MISSING CONTENT` | Case studies, outcomes, testimonials, service detail | Blocks proof-led full homepage | Preserve proof slot in IA | Supply and approve evidence | Ocean |
| `DESIGN DECISION` | Redesign-first audience tension | Could exclude first-site prospects | Test alternatives in strategy | Confirm client mix | Ocean |
| `DESIGN DECISION` | Name typography as identity behavior | Affects future visual system | Keep isolated to board | Approve or confine it | Ocean |
| `MISSING AUTHORITY` | Production implementation/publication | Blocks live change | Local design only | Separate authorization | Ocean |

## 15. Prototype or fidelity evidence log

### Prototype direction contract

| Decision risk | Fidelity | Flow | Artifact | Viewports | Accessibility represented | Limitation | State |
|---|---|---|---|---|---|---|---|
| Can a sparse, name-led hierarchy make the approved language feel human and authored? | Structural: high; content: high-proposal; visual: medium; interaction: low; data: none | Promise → name/tension → point of view → method → standards → CTA | Local static HTML | Desktop + mobile | Semantics, focus intent, static/reduced-motion equivalence, reflow | No proof, forms, identity approval, or production behavior | `AWAITING DECISION` |

### Evidence log

| ID | Surface | Source | Viewport | Method | Target | Result | Limitation | Artifact |
|---|---|---|---|---|---|---|---|---|
| `EV-01` | Source structure | Local HTML v0.2 | N/A | Static + rendered DOM inspection | Required copy, semantics, accessibility hooks | One `h1`; named nav and landmarks; ordered method; skip link; focus and reduced-motion rules present | Does not prove assistive-technology behavior | `concepts/2026-08-09-madagin-editorial-board/index.html` |
| `EV-02` | Desktop | Local runtime | `1440×1000` | Browser screenshot + DOM metrics | Hierarchy, composition, overflow | No horizontal overflow; six-scene order intact; name result fits its container | One browser/OS | `output/concept-board/madagin-editorial-board-desktop.png` |
| `EV-03` | Mobile | Local runtime | `390×844` | Browser screenshot + DOM metrics | Reflow, order, overflow | No horizontal overflow; promise intact; method and standards reflow to one column; simplified nav | One compact viewport | `output/concept-board/madagin-editorial-board-mobile.png` |
| `EV-04` | Keyboard | Local runtime | `390×844` | Browser keyboard smoke test | Skip-link access | First Tab focuses `Skip to concept` | One browser/OS | Browser observation |
| `EV-05` | Runtime console | Local runtime | `1440×1000` | Browser log filter for localhost warnings/errors | Clean concept-board runtime | No matching warnings or errors | Does not inspect unrelated browser-extension logs | Browser observation |

## 16. Functional-preservation matrix

| Visual change | Current contract | Evidence | Classification | Risk | Verification | Owner |
|---|---|---|---|---|---|---|
| New concept-board path | Existing v0.1 board and seed prototype remain at their paths | Separate files/directories | `PRESERVED` | Accidental overwrite | File/timestamp audit | Codex |
| CTA presentation | Board has no real contact workflow | Static label disclosed as proposed | `PRESERVED` | Mock mistaken for function | Source/visual audit | Codex |
| Forms, APIs, persistence, analytics | None in board | Source | `PRESERVED` by non-interaction | False runtime inference | Explicit limitation | Future build owner |
| Accessibility intent | Skip link, semantics, focus styles, reflow, reduced-motion equivalence | Source/browser | `PRESERVED` | Visual design obscures focus/reflow | Browser smoke tests | Future build owner |
| Legal/trust content | Not defined for board | No applicable content | `UNKNOWN — VERIFY` for future site | Omission in implementation | Future content inventory | Ocean |

## 17. Implementation handoff and acceptance criteria

### Approved scope

`NONE.` The direction is `AWAITING DECISION`; no route, component, token, asset, copy line, or behavior is approved for production.

### Source mapping

| Artifact | Version/status | Future target | Dependency | Owner |
|---|---|---|---|---|
| v0.6 strategy | Proposed | Homepage content model | Owner decisions | Ocean |
| v0.2 editorial board | Awaiting decision | Visual/content system | Direction approval + proof assets | Ocean + future builder |

### Observable criteria

| ID | Surface | Action | Observable result | Viewport/input | Evidence | Owner |
|---|---|---|---|---|---|---|
| `AC-01` | Board | Load page | Promise is the only `h1`; rejected lines are absent | Any | Source/DOM audit | Codex |
| `AC-02` | Board | Scroll top to bottom | Sequence remains promise → name → point of view → method → standards → CTA | Desktop/mobile | Screenshot + DOM order | Codex |
| `AC-03` | Board | Resize to 390px | No horizontal overflow; method and standards become linear | Mobile | Browser metrics | Codex |
| `AC-04` | Board | Press Tab from page start | Skip link becomes visible and focused | Keyboard | Browser observation | Codex |

### Guardrails

- Do not publish or treat the board as final identity.
- Do not restore the rejected synthesis headlines or abstract shape cards.
- Do not fabricate proof to complete the homepage.
- Do not make the name typography an identity asset without approval.
- Keep the founder-led claim truthful.

### Open work

- Ocean's line-level review.
- Confirm redesign-first client focus.
- Approve case studies and claims.
- Decide whether the name scene informs the identity.
- Only then expand to a complete homepage and production design.

## 18. Runtime-aware next-owner recommendation

| Field | Value |
|---|---|
| Canonical owner | `product-design-and-prototype` |
| Reason | Continue the selected marketing-site direction into proof-led homepage design after owner approval |
| Availability | `AVAILABLE` |
| Availability evidence | Current installed skill catalog |
| Task status | `APPLIED IN THIS TASK` for this board; further expansion remains pending approval |
| Input packet | v0.6 strategy, v0.2 board, owner decisions, approved case evidence |
| Bounded fallback | Continue copy review only; do not implement or publish |

## 19. Plain-English summary

This board replaces the rejected framework-like presentation with a sparse editorial story: the promise comes first, an outgrown website creates the tension, **made again** becomes the answer, and the method and standards are explained through concrete actions and questions. It is still a proposal awaiting Ocean's decision. Existing artifacts and functionality remain untouched, and the missing proof content prevents this from being treated as a complete homepage or implementation handoff.
