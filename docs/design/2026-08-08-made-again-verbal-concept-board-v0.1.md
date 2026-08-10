# Made Again Verbal Concept Board — Design Handoff v0.1

**Design state:** `AWAITING DECISION`  
**Decision owner:** Ocean  
**Primary mode:** `MARKETING SITE`  
**Optional overlay:** `NONE`  
**Artifact:** `concepts/2026-08-08-made-again-verbal-board/index.html`  
**Observation date:** 2026-08-08

## 1. Design brief

| Field | Contract |
|---|---|
| Outcome | Judge Madagin's revised promise, Made Again explanation, founder-led method sequence, and retained outcome criteria in one tangible context |
| Scope | One private standalone concept-board page; desktop/mobile composition; light motion; static/reduced-motion equivalent; copy alternatives |
| Non-goals | Production homepage, final identity, final copy, real form, analytics, CMS, deployment, public preview, replacement of the seed prototype |
| Authority | User-authorized local brainstorming and tangible design exploration only |
| Decision owner | Ocean |
| Inputs | v0.5 strategy; direct owner feedback; retained originality, truth, accessibility, and performance guardrails |
| Constraints | Founder-led truth; no external assets; no fabricated work or claims; exploratory palette/type; no production implication |
| Completion criteria | Board renders at desktop and mobile, communicates the four-stage sequence without animation, labels proposal status, and retains all selected copy alternatives |
| Checks not run | Real audience research, assistive-technology audit, production performance, CMS/form/API behavior, browser matrix, live release verification |

## 2. Source-of-truth and contradiction matrix

| Claim domain | Source / timestamp | Scope | Supported claim | Limitation | Contradiction | Impact | Resolution owner / next step |
|---|---|---|---|---|---|---|---|
| Current intent | Ocean's 2026-08-08 feedback | Verbal direction | Fresh perspective; reject Next Form words; consider expanded promise | Does not approve replacements | v0.4 wording is superseded | Drives v0.5 and this board | Ocean reviews board |
| Strategy | v0.5, 2026-08-08 | Language system | Promise, name-story alternatives, method, criteria | Proposal only | None within board scope | Supplies content | Ocean selects wording |
| Existing prototype | `prototype/`, inspected 2026-08-08 | Historical seed exploration | Existing local artifact remains parked | Not approved direction | Board must not overwrite it | Separate path used | Preserve |
| Identity assets | None supplied/approved | Visual system | No final palette, font, logo, or imagery can be claimed | Missing input | Board still needs visual hierarchy | Neutral exploratory system | Ocean decides later |
| Runtime | Local standalone HTML | Concept rendering | Can show layout/motion proposal | Cannot prove production behavior | None | Keep claims bounded | Retain screenshots/QA |

## 3. Primary mode and optional overlay

| Field | Value |
|---|---|
| Primary mode | `MARKETING SITE` |
| Ownership rationale | The artifact tests identity, narrative, trust, conversion language, and homepage-like content hierarchy |
| Optional overlay | `NONE` |
| Overlay impact | `NOT APPLICABLE` |
| Other plausible modes | `BRAND / VISUAL SYSTEM` is staged later because no identity assets are approved; this board uses visuals only to test narrative causality |

## 4. Direction alternatives and selection status

| Direction | Hierarchy / action | Composition | System logic | Tone | Responsive consequence | Dependencies | Functional risk | Accessibility risk | Reversibility | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| A — Balanced nouns | Promise → Made Again → four stages → criteria → copy lab | Large editorial statements and four-panel sequence | Fresh perspective → direction → transformation → presence | Assured, clear, graphic | Four panels become 2×2, then stacked | Owner copy review | None; standalone board | Motion meaning could be missed | High | `DIRECTION PROPOSED` and shown |
| B — Human verbs | Promise → See / Decide / Transform / Stand apart | More conversational chapter copy | Active verbs drive sequence | Direct, energetic | Short labels favor mobile | Owner tone choice | None | Imperatives may feel aggressive | High | `EXPLORING` |
| C — Plain explanation | Category → paragraph → proof-style steps | Text-first, minimal visual metaphor | Concrete explanation before symbolism | Quiet, pragmatic | Simplest reflow | Approved category copy | None | Lowest | High | `EXPLORING` |

**Recommendation:** Direction A is the strongest current bridge between Ocean's preferred words and a visual story. The board includes human supporting sentences so the noun sequence does not become another values wall.

## 5. Decision and approval record

### Current decision state

`AWAITING DECISION`

| Decision | Status | Owner | Evidence | Scope | Rationale | Locked elements | Unresolved elements | Reopen condition | Renewed approval trigger |
|---|---|---|---|---|---|---|---|---|---|
| Expanded promise | Proposed / favored | Ocean | Current feedback | Board hero | Strong three-beat arc | None final | Literal meaning of “choose” | In-context discomfort | Any production use |
| Fresh-perspective method | Proposed | Ocean | Current feedback + v0.5 | Narrative | Founder-led and causal | Founder-led truth | Exact words | Owner revision | Motion expansion |
| Visual language | Exploring | Ocean | Local board | Board only | Makes language tangible | No identity assets | Color, type, shapes | Owner selects a different direction | Any brand use |
| Implementation | Not approved | Ocean | Authority boundary | Production site | Requirements remain unsettled | Existing prototype preserved | All build decisions | Explicit request | Repository production edits |

## 6. Audience, role, and primary-task model

| Audience / role | Context and need | Primary question | Primary task | Secondary tasks | Allowed actions | Protected actions | Success signal | Recovery need |
|---|---|---|---|---|---|---|---|---|
| Ocean | Reviewing the direction | Does this sound and feel like Madagin? | Compare promise, name story, method, and criteria | Open copy alternatives | Read and react | No accidental publication | Can approve/reject exact elements | Return to text-only alternatives |
| Future prospective client | Simulated reviewer | What does Madagin do and why is the name meaningful? | Follow promise into method | Understand outcomes | Read only | No fabricated submission path | Can repeat the transformation story | Plain explanation remains present |

## 7. Information architecture

```text
Concept board
├── Status and proposal boundary
├── Promise
├── Made Again name story
├── Method sequence
│   ├── Fresh perspective
│   ├── Strategic direction
│   ├── Intentional transformation
│   └── Distinctive presence
├── Plain-language explanation
├── Desired site qualities
└── Copy alternatives
```

The board has no production navigation, inquiry flow, or global route claim. Responsive order remains identical to preserve narrative causality.

## 8. Route, workflow, and state matrix

| Surface | Role | Question | Primary action | Entry / exit | Content | Components | Functional contract | States | Responsive behavior | Accessibility | Source | Blocker | Acceptance evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Local board `/index.html` | Ocean | Does the language form a coherent story? | Read, scroll, open alternatives | Direct file/local URL; close tab | Proposed copy only | Status bar, hero, sequence, criteria, details | Static document; no persistence or submission | Default and details open/closed; loading/error are browser-level; success/permission `NOT APPLICABLE` | 2-col hero to 1-col; 4 stages to 2×2 to stack | Semantic sections, skip link, visible focus, reduced motion | v0.5 + direct feedback | Final identity missing | Desktop/mobile screenshots + structural checks |

## 9. Design-system contract

| Dimension | Current source | Proposed rule | Variants / states | Responsive rule | Accessibility constraint | Approval status | Implementation evidence |
|---|---|---|---|---|---|---|---|
| Typography | System fonts | Oversized sans statements + compact labels | Display, body, eyebrow | Fluid `clamp()` sizes | Readable hierarchy and reflow | Exploring | Local render only |
| Color | No approved palette | Warm neutral, black, orange, acid, blue | High-contrast sections | Same semantic roles | Text contrast and non-color labels | Exploring | Visual QA required |
| Spacing | New board | Fluid gutter/section tokens | Desktop/mobile | Clamp-based | Reflow without overlap | Exploring | Local render |
| Grid | New board | 2-col editorial + four-stage grid | 4, 2, and 1 columns | 60rem and 38rem behavior points | Reading order matches DOM | Exploring | Local render |
| Components | New board | Minimal semantic sections | Details open/closed | Stack on mobile | Keyboard/focus | Exploring | Local render |
| Imagery | None | CSS abstract forms only | Static/reduced motion | Scale within panels | Decorative art hidden from AT | Exploring | Source inspection |
| Motion | New board | Lens scans familiar material | Animated/static | Same layout | Reduced-motion disables animation | Exploring | Media-query check |
| Content | v0.5 | Human, explicit proposal labels | Three copy alternatives | No truncation | Natural read-aloud | Awaiting decision | Board copy |

## 10. Token specification

| Token | Tier | Value | Purpose | Modes | Responsive | Fallback | Accessibility | Source/status | Change impact |
|---|---|---|---|---|---|---|---|---|---|
| `--paper` | Primitive | `#f1eee6` | Primary surface | Light only | Fixed | White | Dark text pairing | Proposed | All surfaces |
| `--ink` | Semantic | `#121212` | Text/dark surface | Light only | Fixed | Black | High contrast | Proposed | Text/lines/footer |
| `--orange` | Semantic | `#ff542e` | Transformation emphasis | Light only | Fixed | Underline/shape | Never sole meaning | Proposed | Hero/art/section |
| `--acid` | Semantic | `#dbff55` | Emergent possibility | Dark-section accent | Fixed | White text | Decorative only | Proposed | Made Again/stage art |
| `--blue` | Semantic | `#3754ff` | Strategic axis/focus | Light only | Fixed | Black outline | Not sole meaning | Proposed | Axis/focus |
| `--gutter` | Semantic | `clamp(1rem, 3vw, 2.75rem)` | Viewport inset | All | Fluid | `1rem` | Supports reflow | Proposed | All sections |
| `--section` | Semantic | `clamp(5rem, 12vw, 10rem)` | Narrative pacing | All | Fluid | `5rem` | No content loss | Proposed | All sections |

## 11. Component and variant inventory

| Component | Status | Purpose | Anatomy | Variants | Interaction states | Data states | Permission | Content limits | Responsive | Accessibility | Contract | Routes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Status bar | Proposed | Prevent approval confusion | Artifact/version/status | One | Static | N/A | N/A | Short status | Wraps/stacks | Header label | Informational only | Board |
| Hero promise | Proposed | Test headline cadence | Eyebrow, H1, note, anchor | One | Link focus | N/A | N/A | Three verbs | 2→1 columns | H1 + normal link | Anchor scroll | Board |
| Four-stage sequence | Proposed | Show causality | Four articles + abstract art | Desktop/tablet/mobile | Motion/static | N/A | N/A | Two-word stage names | 4→2→1 columns | ARIA summary; art decorative | No data | Board |
| Criteria grid | Proposed | Test outcome words together | Four definitions | One | Static | N/A | N/A | One short paragraph each | 2→1 | Heading hierarchy | Informational | Board |
| Copy accordion | Proposed | Compare alternatives | Details/summary/content | Open/closed | Keyboard, focus | N/A | N/A | Three alternatives | Stable | Native details semantics | Local disclosure | Board |

## 12. Responsive behavior matrix

| Surface | Desktop | Tablet | Mobile | Rationale | Evidence | Risk |
|---|---|---|---|---|---|---|
| Hero | 2 columns, oversized promise | 1 column | 1 column, smaller fluid type | Preserve reading order and category context | To be rendered | Long “remember, trust” wrap |
| Made Again | Label + statement grid | 1 column | 1 column | Give explanation full width | To be rendered | Statement length |
| Method | 4 columns | 2×2 | 1 column | Maintain stage order and readable art | To be rendered | Tall mobile scroll |
| Criteria | 2×2 | 2×2 | 1 column | Avoid cramped definitions | To be rendered | None material |
| Copy details | Wide summaries | Same | Narrow grid | Native disclosure remains usable | To be rendered | Long labels wrap |
| Persistent UI | Status only | Wraps | Stacks | No fixed obstruction | To be rendered | None expected |

Representative review coordinates: desktop `1440×1000`; mobile `390×844`. Tablet is material only for the 4→2 stage transition and is specified but not required for the first evidence pass.

## 13. Accessibility plan and acceptance criteria

| Requirement | Target | Surfaces | Rule | Observable criterion | Method | Owner | Limitation |
|---|---|---|---|---|---|---|---|
| Semantics | Meaningful HTML | Whole board | One H1; ordered H2/H3; native details | Heading/order inspection passes | DOM/source review | Design owner | No screen-reader session yet |
| Keyboard | All interactive items reachable | Skip link, anchor, details | Native controls; visible focus | Tab reaches all controls with visible outline | Browser walkthrough | Design owner | No cross-browser matrix |
| Reduced motion | Essential meaning without motion | Lens/scroll | Disable animation and smooth scroll | Four stages remain present and ordered | Emulated preference | Design owner | Runtime setting test needed |
| Contrast | Readable text | All sections | Dark/light text; accents decorative | No text depends on low-contrast accent | Token/render review | Design owner | Formal ratio calculation pending |
| Reflow | No loss at `390px` and zoom-equivalent narrow width | Whole board | Stack grids; fluid type | No horizontal overflow or clipped copy | Browser screenshot/measurement | Design owner | 400% zoom not yet run |
| Non-color meaning | Labels accompany color | Stage art/status | Text names every stage/status | Meaning remains in grayscale/static | Content inspection | Design owner | Grayscale capture optional |

## 14. Content, asset, approval, and technical blockers

| Class | Item | Required from | Impact | Work that may continue | Stop condition | Resolution | Owner |
|---|---|---|---|---|---|---|---|
| `MISSING APPROVAL` | Promise and name story | Ocean | Blocks final copy | Local comparison | Before production use | Approve/rewrite | Ocean |
| `DESIGN DECISION` | Method wording | Ocean | Blocks motion storyboard | Board review | Before broad visual exploration | Select A/B/C | Ocean |
| `MISSING ASSET` | Final identity system | Ocean/future brand work | Blocks production styling | Neutral board | Before identity claim | Supply/approve assets | Ocean |
| `MISSING CONTENT` | Real case proof | Ocean | Blocks public differentiator evidence | Concept only | Before publication | Audit case evidence | Ocean |
| `MISSING AUTHORITY` | Production implementation/publication | Ocean | Blocks site change | Strategy/design artifacts | Before build/deploy | Explicit request | Ocean |

## 15. Prototype or fidelity evidence log

### Prototype direction contract

| Decision risk | Fidelity | Flows | States | Artifact | Data boundary | Viewports/input | Accessibility represented | Limitations | Validation | Decision owner/state |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Do the words form a coherent hierarchy and causal story? | Structural: medium; content: high-proposal; visual: medium-exploratory; interaction: low; data: none | Open → promise → name → method → criteria → alternatives | Default; details open/closed; reduced motion | Standalone local HTML | Static proposed copy; no data | Desktop/mobile; keyboard/pointer | Semantics, focus, reduced-motion CSS, reflow intent | No production behavior, final identity, measured conversion, or full accessibility proof | Owner review + browser QA | Ocean / `AWAITING DECISION` |

### Evidence log

| ID | Surface/state | Role | Source type | Version | Viewport | Method | Target | Result | Limitation | Artifact |
|---|---|---|---|---|---|---|---|---|---|---|
| `EV-01` | Source structure | Codex | Local HTML | 2026-08-08 v0.1 | N/A | Static + rendered DOM inspection | Required content/accessibility hooks | One `h1`; `main` and skip link present; three native `details`; reduced-motion and focus rules present | Does not prove assistive-technology behavior | `concepts/2026-08-08-made-again-verbal-board/index.html` |
| `EV-02` | Default desktop | Codex | Local runtime | 2026-08-08 v0.1 | `1440×1000` | Chrome browser audit + full-page screenshot | Hierarchy, overflow, composition | Required promise, sequence, and criteria present; no horizontal overflow; no browser warnings/errors | One browser and OS rendering stack | `output/concept-board/made-again-verbal-board-desktop.png` |
| `EV-03` | Default mobile | Codex | Local runtime | 2026-08-08 v0.1 | `390×844` | Chrome browser audit + full-page screenshot | Reflow, wrapping, content order | No horizontal overflow; four-stage method reflows to one column; promise remains intact | One compact viewport, browser, and OS rendering stack | `output/concept-board/made-again-verbal-board-mobile.png` |
| `EV-04` | Initial keyboard focus | Codex | Local runtime | 2026-08-08 v0.1 | `1440×1000` | Tab-key smoke test | Keyboard entry and skip navigation | First Tab focuses the visible `Skip to concept` link | Not a complete keyboard or screen-reader audit | Browser observation |

## 16. Functional-preservation matrix

| Visual change | Current contract | Evidence | Classification | Approved change | Risks | Verification | Owner |
|---|---|---|---|---|---|---|---|
| New concept-board path | Existing seed prototype remains available at its path | Separate directories | `PRESERVED` | None | Accidental conflation | File/status audit | Design owner |
| Forms/delivery | No form in board; production contract unknown | Board source | `UNKNOWN — VERIFY` for future site | None | Mock CTA mistaken for function | No form included | Future build owner |
| APIs/persistence/analytics | None in board | Board source | `PRESERVED` by non-interaction | None | False runtime inference | Explicit footer limitation | Future build owner |
| Accessibility behavior | Existing prototype not modified | File separation | `PRESERVED` | None | Board-specific gaps | Board QA only | Design owner |
| Legal/trust content | No production legal contract changed | Board source | `PRESERVED` | None | None | Status/limitation copy | Ocean |

## 17. Implementation handoff and acceptance criteria

### Approved scope

`NONE.` The artifact is `AWAITING DECISION`; no production route, component, token, asset, or behavior is approved for implementation.

### Source mapping

| Design rule | Version/approval | Potential target | Contract | Dependencies | Contradictions | Owner |
|---|---|---|---|---|---|---|
| Promise/name/method hierarchy | v0.1 / awaiting decision | Future homepage | Preserve plain category, proof, navigation, CTA | Owner copy approval | “Choose” comprehension open | Ocean |
| Fresh-perspective visual grammar | v0.1 / exploring | Future story section | Strategy must cause transformation | Visual approval + motion test | Final identity missing | Ocean/designer |

### Observable criteria

| ID | Surface | Precondition | Action | Result | Viewport/input | Method | Contract | Evidence | Owner |
|---|---|---|---|---|---|---|---|---|---|
| `IH-01` | Board | Local file served/opened | Read top to bottom | Promise, name story, four stages, qualities, and alternatives appear in order | Desktop/mobile | Visual + DOM check | Static concept | Screenshots | Design owner |
| `IH-02` | Board | Reduced motion preferred | Load page | Lens motion stops; meaning remains complete | Any | Emulation/source check | Accessibility intent | QA note | Design owner |
| `IH-03` | Board | Keyboard only | Tab and activate details | Focus visible; alternatives open/close | Desktop | Keyboard walkthrough | Native controls | QA note | Design owner |

### Guardrails

- No production implementation from this board.
- No palette, type, or abstract mark is an approved Madagin identity asset.
- No promise is approved for publication until Ocean explicitly selects it.
- No local render proves production accessibility, performance, SEO, analytics, or conversion.

### Open work

- Owner copy and direction decision.
- Real case proof and founder-led About content.
- Approved identity and broader page hierarchy.
- Separate motion, implementation, testing, and release phases.

## 18. Runtime-aware next-owner recommendation

| Field | Value |
|---|---|
| Canonical owner | `product-design-and-prototype` |
| Reason | Resolve the board's language/hierarchy decision and, after approval, explore static/motion variants |
| Availability | `AVAILABLE` |
| Availability evidence | Current runtime skill catalog and applied bounded concept-board work |
| Task status | `APPLIED IN THIS TASK` for the board; broader design `RECOMMENDED ONLY` |
| Input packet | v0.5 strategy, this handoff, board source, QA evidence, owner reactions |
| Bounded blocker | Do not progress to production design until Ocean selects the verbal direction |

## 19. Plain-English summary

This private board makes the revised Made Again story tangible without changing the existing prototype or pretending the language is approved. It tests **Sites people remember, trust, and choose**, the explanation **the shift from what something is to what it can become**, and the founder-led sequence **Fresh perspective → strategic direction → intentional transformation → distinctive presence**. The visual system is intentionally neutral and exploratory. Ocean owns the next decision; broader design remains only recommended after the words and hierarchy are selected.
