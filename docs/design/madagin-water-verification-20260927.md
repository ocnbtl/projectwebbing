# Madagin water preview verification

Date: 2026-09-27. Scope: local public-site preview, available at http://localhost:3000/. No commit, push, or production deployment was performed for this revision.

## Implemented

- Full-site Balsa water surface using the exact exported configuration, with flat refractive glass hero letters and a black-to-water emergence sequence.
- Ten descriptor treatments with distinct fonts and entrances, including cursive “the excellence” and the impact entrance for “the iconic.”
- Matched service phrases that advance with scrolling, a glass motion-control bubble, animated project disclosures, and a distinctive brief CTA.
- Updated public reading pages and contact styling; removed the requested hero filler copy.

## Source integrity

The six vendored Balsa source files are byte-identical to the reviewed React sources from balsa-ui 0.8.1. The configuration matches the decoded user export. Normalized configuration SHA256: `2598d0601d507c171be955fb11492b686a14cb2345717a4e9f61b027d5b7da69`.

The Balsa CLI was not executed. No new npm dependencies were added. License and source provenance are retained alongside the source in `src/components/public/balsa/`.

## Verified

- Production build and TypeScript checks passed. Focused ESLint on the changed TypeScript and vendored files passed. Whitespace checks passed.
- All ten descriptor variants settled within a 360px viewport without horizontal overflow.
- Desktop and mobile homepage, project index, project detail, about, journal, and contact routes were checked. Contact navigation reached the second step without submitting an inquiry.
- Scroll advances preserve the matched phrases; project disclosure controls expand correctly.
- Keyboard activation of the glass bubble pauses the background. The faded phrase section becomes inert.
- Reduced motion renders a still background and static wordmark without the emergence animation.
- Repeated mobile-to-desktop resizing produced no console warnings or errors after the glass texture resize fix. The background rendered 23 frames in a measured mobile second, consistent with its 24 fps limit.

Full repository lint remains blocked by four existing immutability errors in untouched internal landscape files: `catchment-canopy.tsx:123` and `catchment-world.tsx:256,265,268`.

## Visual evidence

Files are in `output/playwright/`:

- `water-arrival-black.png`, `water-arrival-emerging.png`, `water-arrival-settled.png`
- `water-arrival.webm` (opening recording; sampled stills were visually reviewed)
- `water-mobile-final.png`, `water-mobile-work.png`, `water-reduced-motion.png`
- `water-contact-final.png`, `water-contact-mobile.png`
- `water-type-*-360.png` (ten descriptor variants)

One Impeccable detector pass and a finish review were completed. Review refinements increased mobile glass edge visibility and removed faded controls from keyboard navigation. No exhaustive GPU/device compatibility claim is made.
