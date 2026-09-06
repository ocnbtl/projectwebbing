import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const require = createRequire(path.join(process.env.MADAGIN_NODE_MODULES ?? "C:/Users/Ocean/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules", "project-proof.cjs"));
const { chromium } = require("playwright");
const out = path.resolve("output/playwright/madagin-world-progress/astra-project-proof-20260905");
const media = path.resolve("public/media/projects/proof-20260905");
await fs.mkdir(out, { recursive: true });
await fs.mkdir(media, { recursive: true });
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const report = { capturedAt: new Date().toISOString(), purpose: "Whole-site screenshots of the two owner-confirmed Madagin clients, for local portfolio preparation. No form submission or claim of measured outcomes.", captures: [] };
try {
  for (const client of [
    { id: "sage-burress", origin: "https://sageburress.com", detail: "/portfolio" },
    { id: "masonry-color-corrections", origin: "https://masonrycolorcorrections.com", detail: "/gallery" },
  ]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    for (const capture of [
      { id: "detail", route: client.detail, viewport: { width: 1440, height: 1000 } },
      { id: "mobile", route: "/", viewport: { width: 390, height: 844 } },
    ]) {
      await page.setViewportSize(capture.viewport);
      const response = await page.goto(client.origin + capture.route, { waitUntil: "networkidle", timeout: 60000 });
      if (response.status() !== 200) throw new Error(`Unexpected source status: ${response.status()}`);
      const decline = page.getByRole("button", { name: "Decline", exact: true });
      if (await decline.isVisible()) await decline.click();
      await page.evaluate(() => document.fonts.ready);
      if (capture.id === "detail") {
        const example = page.locator("main img").first();
        await example.scrollIntoViewIfNeeded();
        await example.evaluate(img => img.decode());
        await page.evaluate(() => window.scrollBy(0, -96));
      }
      await page.waitForTimeout(1300);
      const filename = `${client.id}-${capture.id}.jpg`;
      const bytes = await page.screenshot({ path: path.join(media, filename), type: "jpeg", quality: 88 });
      report.captures.push({ client: client.id, kind: capture.id, sourceUrl: page.url(), status: response.status(), viewport: capture.viewport, file: `/media/projects/proof-20260905/${filename}`, sha256: createHash("sha256").update(bytes).digest("hex"), title: await page.title(), rightsBoundary: "Client website presentation retained as a whole. Underlying client photographs are not isolated or relicensed.", headings: await page.locator("h1,h2").allTextContents() });
    }
    await context.close();
  }
} finally {
  await browser.close();
  await fs.writeFile(path.join(out, "captures.json"), JSON.stringify(report, null, 2) + "\n");
  await fs.writeFile(path.join(media, "provenance.json"), JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify(report, null, 2));
