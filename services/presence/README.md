# Madagin presence

A small Cloudflare Worker and SQLite-compatible Durable Object for transient shared cursors. The site remains on Vercel. No database writes or paid services are enabled by this configuration.

Endpoint: `wss://madagin-presence.oceanx1400.workers.dev/connect`.

Install the pinned development tools with `npm ci --prefix services/presence`. Run `npm run dev --prefix services/presence`, then `npm run verify --prefix services/presence` in another terminal. Deploy with `npm run deploy --prefix services/presence` after signing in to the intended Cloudflare account.

Set the public build variable `NEXT_PUBLIC_PRESENCE_URL` on Vercel and locally. The Worker allows only the origins listed in `wrangler.json`; add an explicitly verified preview or custom domain there when needed. Unlisted preview origins intentionally fall back to the labeled simulation.

## Behavior and limits

- Each visible public browser session opens one socket. Hidden tabs disconnect; visible tabs reconnect with bounded exponential backoff. Internal routes do not connect.
- The counter measures active connections, not unique people. Below or at 40 connections, the main count is an explicitly labeled simulation and the real count is separate. Above 40 the main count becomes live and artificial cursors stop.
- Real positions are sent only from the connection playground, at most eight times per second. The server validates normalized coordinates and limits each sender. Rendering interpolates points locally.
- Maximum 256 simultaneous connections; no stored trails, form data, names, cookies, IP addresses, or persistent visitor identifiers. A server-generated random ID lasts for one connection. At most 40 current peer cursors are drawn per browser.
- WebSocket hibernation and automatic ping replies avoid persistent timers on the server. Free-tier exhaustion should be treated as an unavailable live service; the labeled demonstration remains usable. No paid plan was enabled during this release.

The public endpoint is not authentication: origin restrictions deter unrelated browser embeds but are not bot-proof. Protocol caps limit payload and fan-out. Review usage before a major campaign or raising connection limits.
