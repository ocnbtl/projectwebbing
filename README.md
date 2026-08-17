# Project Webbing

Project Webbing is the private repository name for Madagin's public website and owner workspace. Madagin is the only public-facing brand name.

## What is built

- / - a sparse cinematic landing experience with an oversized Plaster wordmark, scroll-linked drag and stretch, a pale editorial reveal, the approved promise, and the four current standards.
- /projects and /blog - repository-backed public content with individual story routes.
- /contact - a six-question cinematic inquiry journey with a review step and an intentionally inactive final control until Madagin's domain and email are ready.
- /internal/login - password-only owner authentication. Private content stays inaccessible until server-side credentials are configured.
- /internal - a concise Vercel Web Analytics dashboard. Missing or unavailable data is shown as unconfigured, never as invented metrics.
- /internal/projects and /internal/blog - an owner editor that commits content to GitHub; the existing GitHub/Vercel connection handles deployment.
- /internal/brand - the living Madagin identity system: palette, typography, verbal identity, motion specimen, and open decisions.
- /robots.txt and /sitemap.xml - public indexing rules that exclude the private workspace.

The public page intentionally uses a code-native cinematic fallback until the final hero film is approved. It is a finished shell, not placeholder copy or a stock-media substitute.

## Stack

- Next.js 16 App Router
- React 19 and TypeScript
- Motion for the scroll-linked wordmark behavior
- next/font for Instrument Sans, Instrument Serif, and Plaster
- jose for signed, short-lived owner sessions
- Vercel Web Analytics tracking and the server-only Web Analytics API
- GitHub Contents API for source-controlled Projects and Blog publishing
- CSS Modules for scoped visual systems

## Local development

Use Node.js 20.9 or newer and pnpm.

    pnpm install
    Copy-Item .env.example .env.local
    pnpm dev

Open http://localhost:3000 for the public site and http://localhost:3000/internal for the private workspace.

Run the complete local gate with:

    pnpm check

That command runs ESLint, TypeScript, and the production build.

## Environment

No production secrets are committed. Copy .env.example to .env.local and provide only the values needed for the current environment.

| Variable | Visibility | Purpose |
| --- | --- | --- |
| MADAGIN_AUTH_SECRET | Server only | Random signing value of at least 32 characters |
| MADAGIN_INTERNAL_PASSWORD | Server only | Owner login password |
| VERCEL_ANALYTICS_TOKEN | Server only | Reads Vercel Web Analytics aggregate data |
| VERCEL_ANALYTICS_PROJECT_ID | Server only | Vercel project identifier |
| VERCEL_ANALYTICS_TEAM_ID | Server only | Optional team identifier |
| VERCEL_ANALYTICS_TEAM_SLUG | Server only | Optional team slug; use either this or team ID |
| NEXT_PUBLIC_MADAGIN_HERO_VIDEO | Public | Optional hero-film URL |
| GITHUB_CONTENT_TOKEN | Server only | Fine-grained GitHub token with Contents read/write access to this repository |
| GITHUB_CONTENT_REPOSITORY | Server only | Repository in owner/name form |
| GITHUB_CONTENT_BRANCH | Server only | Publishing branch; defaults to main |
| NEXT_PUBLIC_SITE_URL | Public | Canonical public origin for the sitemap |

The internal workspace has three truthful states:

1. Locked - auth variables are missing.
2. Connected - credentials and analytics access are configured.
3. Unavailable - authentication works, but the analytics provider cannot return data.

## Projects and Blog without Blob

Published content lives in [src/content/madagin-content.json](src/content/madagin-content.json), so public pages read it at build time and need no runtime database or object store. The protected editor calls GitHub's Contents API with a repository-scoped token, creating a normal commit on the configured branch. Vercel then builds that commit through the existing repository connection.

This removes Vercel Blob and its separate storage bill. The tradeoff is deliberate: drafts are excluded from the public website, but remain visible to anyone who can read the GitHub repository. Cover media can be committed under public/media and referenced as /media/filename.jpg, or supplied as a public HTTPS URL.

## Contact delivery

The contact journey currently keeps every answer in the visitor's browser and ends on a complete review screen. The final Send the project control is visible but intentionally disabled until Madagin's domain, mailbox, sender authentication, and approved recipient are configured. No inquiry is transmitted or stored in this release.

## Hero film handoff

Set NEXT_PUBLIC_MADAGIN_HERO_VIDEO to a public MP4 or WebM URL. A file hosted by this app can be placed under public/media and referenced as /media/filename.mp4. Keep the first frame dark enough for the white wordmark and include a silent autoplay-compatible encode.

See [public/media/README.md](public/media/README.md) for the asset contract.

## Analytics and privacy

The public site includes Vercel Web Analytics. The beforeSend filter drops every /internal route, so owner activity is not counted as public-site traffic. The private dashboard calls Vercel's aggregate API from the server; its token is never passed to client code.

## Design and strategy source

- [Current voice and editorial direction](docs/strategy/2026-08-09-madagin-voice-and-editorial-direction-v0.6.md)
- [Fresh perspective and Made Again language strategy](docs/strategy/2026-08-08-madagin-fresh-perspective-language-v0.5.md)
- [Current editorial concept-board handoff](docs/design/2026-08-09-madagin-editorial-concept-board-v0.2.md)
- [Production build fidelity ledger](docs/design/2026-08-09-madagin-build-fidelity-ledger-v0.1.md)
- [Cinematic implementation feasibility](docs/technical/2026-08-05-cinematic-feasibility-v0.1.md)
- [Higgsfield continuity bible and shot list](docs/production/2026-08-05-higgsfield-continuity-bible-v0.1.md)
- [Current Higgsfield mountain-film production plan](docs/production/2026-08-16-higgsfield-mountain-film-v0.2.md)
- [Generated contact question reference](docs/design/references/madagin-contact-question-concept-v0.1.png)
- [Generated contact review reference](docs/design/references/madagin-contact-review-concept-v0.1.png)
- [Generated public concept reference](docs/design/references/madagin-public-concept-v0.1.png)
- [Generated internal analytics reference](docs/design/references/madagin-internal-analytics-concept-v0.1.png)
- [Generated internal brand-system reference](docs/design/references/madagin-internal-brand-system-concept-v0.1.png)

Earlier prototypes remain in concepts and prototype as project history; the Next.js application under src is now the production implementation.

## Repository and hosting

- GitHub: https://github.com/ocnbtl/projectwebbing
- Vercel project: https://vercel.com/unigentamos/projectwebbing

Production owner credentials, analytics access, the final canonical domain, and the approved cinematic film are deployment configuration, not repository content.
