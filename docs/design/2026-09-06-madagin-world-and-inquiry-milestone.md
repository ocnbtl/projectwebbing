# Madagin: spatial reading and a continuous coast

## Finite development sequence

1. Publish the approved 24-file website batch. Completion: exact snapshot and commit identity, GitHub main, Vercel Ready/alias provenance, rollback, and passing affected visitor journeys. Completed as `9e888651b0e2bf670fb276e8cb2fe05d2a242f20`; release evidence is in `output/releases/madagin-website-20260905/publication.json`.
2. Make the world usable as navigation. Completion: left/About, up/Projects, right/Blog; both published projects readable in place; honest empty Blog; independent scrolling; Escape and visible return restore the saved camera and focus; the same canvas continues animating; ordinary routes and capability fallbacks remain usable. This run's implementation and browser evidence assess this milestone.
3. Close coast discontinuities exposed by those new views. Completion: existing cumulative Ridge/Valley surfaces connect to the shared shoreline before Summit, including compact mode; sky and ocean use one sun direction; continuous foam variation; actual moving renders reviewed at early and late route positions against Hawaiian photographs and footage. This is a bounded continuity improvement, not terrain-study integration or a photorealism claim.
4. Replace the dominant terrain/vegetation limitations using the retained NOAA foundation and licensed source corpus. Completion: matched near/mid/far cameras and flight recordings show resolved cliff stratification, varied canopy silhouettes and grounded shadows, with no stretched source imagery, missing coast, or disconnected drainage. Current study fails this boundary and remains local.
5. Integrate the accepted environment and inquiry delivery after their independent prerequisites pass. Completion: connected lake/river/fall/ocean and weather in a believable route, readable destination views, and real phone/laptop evidence; separately verify domain ownership, mailbox access, and receipt of an approved delivery fixture before exposing a Send interaction. None of those unverified prerequisites is implied by the website release.

## Reference observations

- Hawaii DLNR, Nāpali Coast park photograph: https://dlnr.hawaii.gov/dsp/wp-content/blogs.dir/34/files/2014/09/h_napali.jpg (viewed September 6, 2026). Cliff buttresses contain visible horizontal strata; vegetation clusters vary in size and exposure; surf sits against land rather than an empty strip. Used for comparison, not copied into the runtime.
- Hawaii DLNR, *Kalalau–Nāpali Coast State Wilderness Park Scenics*, September 5, 2024: https://vimeo.com/1006821259. Played in the browser; an observed frame at 06:42/07:15 shows layered rock, a hazy cloud horizon and long, subdued surface streaks. Motion and parallax are visual evidence; a source's availability does not establish asset reuse permission.
- USGS, *Wave crashing over lava*, July 21, 2002: https://www.usgs.gov/media/videos/wave-crashing-over-lava. Played its approximately ten-second clip. Useful only for localized turbulent breakup; this active lava-entry scene is not a model for Nāpali geology or its entire ocean.

## Inquiry delivery preparation

Brand is **Madagin**. **madagin.com** and **contact@madagin.com** are planned. Domain ownership, mailbox operation, and delivery are unverified.

`src/lib/inquiry-delivery.ts` is a server-only adapter for a configurable HTTPS webhook. `.env.example` keeps the mode off, verification attestations false, and endpoint/token blank. No public handler or contact component calls it. The current six-question brief, copy and download behavior is unchanged, and answers are not transmitted.

The future webhook contract is a POST containing `to`, `replyTo`, `subject`, and plain `text`, with a server-only bearer credential, a ten-second timeout and redirects disabled. Recipient comes from server configuration, never the visitor. HTTP success means **accepted**, not delivered. Verification flags are operator attestations requiring recorded evidence; they do not perform DNS, mailbox or delivery verification themselves. Before connecting a public handler, add server validation, same-origin/abuse controls and duplicate protection, then verify a consented fixture arriving in the intended mailbox. Do not enable through guessed DNS or mailbox status.

`tools/evidence/verify-inquiry-delivery.mjs` uses an injected local transport and makes no network requests. It checks disabled/unverified gates, invalid configuration/input, success semantics and provider/network failures.
