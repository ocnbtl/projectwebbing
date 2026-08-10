# Madagin production build fidelity ledger v0.1

Date: 2026-08-09

## Source references

- docs/design/references/madagin-public-concept-v0.1.png
- docs/design/references/madagin-internal-analytics-concept-v0.1.png
- docs/design/references/madagin-internal-brand-system-concept-v0.1.png
- Madagin color scheme handoff.pdf supplied by Ocean

The generated images set composition and art-direction boundaries. They are not source assets and are not shown on the website.

## Fidelity comparison

| Area | Reference intent | Built result | Status |
| --- | --- | --- | --- |
| Public focal point | One enormous name over a near-black cinematic field | MADAGIN fills the viewport and remains the sole opening message | Kept |
| Public transformation | A second elongated name marks the transition into content | Individual Plaster letters drag downward in sequence and fully resettle before the reveal | Kept and made interactive |
| Public reveal | Black film gives way to a pale editorial field and a short promise | Milk White reveal leads with Sites people remember, trust, and choose. | Kept |
| Public type | Monumental display type plus quiet editorial copy | Actual requested Plaster is used for the hero; Instrument Serif and Instrument Sans carry the rest | Intentionally corrected |
| Internal frame | Mineral Shadowblue navigation beside an open specimen sheet | Fixed desktop rail and ruled Milk White workspace, with tabs on mobile | Kept |
| Analytics hierarchy | Three concise facts, chart, and supporting breakdowns | Visitors, page views, source status, daily series, pages, referrers, and devices | Kept |
| Analytics truthfulness | Concept contained illustrative metrics | Unconfigured values render as em dashes with a connection instruction | Intentionally corrected |
| Brand palette | Unequal editorial swatches | Six exact named source colors with roles and long-name wrapping | Kept |
| Brand typography | Large Instrument Serif and Plaster specimens | Instrument Serif, Instrument Sans, and Plaster each have a distinct documented job | Kept |
| Product depth | Fine rules and strong spacing instead of a card wall | Open sections, square geometry, no rounded SaaS-card treatment | Kept |
| Responsive behavior | Desktop concept needed a real mobile interpretation | Rail becomes a compact owner header and tab row; content reflows without horizontal overflow | Expanded |

## Above-the-fold copy comparison

The public concept and implementation use the same approved lead promise:

Sites people remember, trust, and choose.

The implementation removes concept-only navigation labels and speculative service language from the opening frame. The only added support line appears after the cinematic transition:

Strategy, design, and development for businesses ready to show up differently.

No testimonial, client result, award, team-size claim, or performance metric was added without evidence.

## Intentional deviations

1. The public concept generator approximated the hero in a sharp serif. The build uses the requested Plaster font.
2. A final cinematic film was not supplied or approved. The build uses a restrained architectural fallback and exposes one environment variable for the future film.
3. The analytics concept contained plausible-looking sample values. The build uses no fake numbers and connects only to Vercel's aggregate API.
4. Plaster is reserved for the public display moment and motion specimen. Small internal wordmarks use Instrument Sans for legibility.
5. The desktop sidebar becomes a compact mobile header with explicit Site and Sign out controls.

## Material QA fixes

- Replaced small Plaster navigation labels with tracked Instrument Sans.
- Removed long-name and Plaster-specimen overflow on the brand page.
- Added mobile owner exit and sign-out controls.
- Corrected character encoding in editorial punctuation and symbols.
- Added the framework's smooth-scroll declaration to the root HTML element.

## Interaction and viewport evidence

- Native desktop QA viewport: 1440 x 1000; document client width 1425; no horizontal overflow.
- Native mobile QA viewport: 390 x 844; document client width 375; no horizontal overflow.
- Scroll motion sampled at its peak and after resettling. Each letter reached a distinct scale before every transform returned to none.
- The motion specimen replay control produced a non-identity transform.
- The skip link is the first public anchor, receives focus, and resolves to #after-hero at the start of the content.
- Unauthenticated /internal and /internal/brand requests redirect to /internal/login.
- Sign-in, analytics navigation, brand-system navigation, sign-out, and post-sign-out route protection were exercised.
- The final browser-console sample after the last source change contained no warnings or errors.

The local image-viewer helper was unavailable in the Windows sandbox. Fidelity was therefore checked from the original in-app generated images, native browser screenshots, and in-memory comparison thumbnails.
