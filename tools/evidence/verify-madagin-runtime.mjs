import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const runtimeModules = process.env.MADAGIN_NODE_MODULES
  ?? "C:\\Users\\Ocean\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules";
const require = createRequire(path.join(runtimeModules, "madagin-runtime-verifier.cjs"));
const { chromium } = require("playwright");
const origin = process.env.MADAGIN_WORLD_ORIGIN ?? "http://localhost:3108";
const executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outputPath = path.resolve(
  root,
  process.env.MADAGIN_RUNTIME_OUTPUT
    ?? path.join("output", "playwright", "madagin-world-progress", "latest", "runtime-gates.json"),
);
await fs.mkdir(path.dirname(outputPath), { recursive: true });
const cases = [
  { id: "v116-live", query: "checkpoint=ridge&quality=balanced&world=116", expectedState: "live", expectedVersion: "v1.16" },
  { id: "forced-fallback", query: "checkpoint=ridge&quality=balanced&world=116&forceFallback=1", expectedState: "fallback", expectedVersion: null },
  { id: "reduced-motion", query: "checkpoint=ridge&quality=balanced&world=116&reducedMotion=1", expectedState: "live", expectedVersion: "v1.16" },
  { id: "v115-switch", query: "checkpoint=ridge&quality=balanced&world=115", expectedState: "live", expectedVersion: null, expectsV115Marker: true },
  { id: "v116-alpine-detailed", query: "checkpoint=summit&quality=balanced&world=116", expectedState: "live", expectedVersion: "v1.16", expectsAlpineDetail: "detailed" },
  { id: "v116-alpine-mobile", query: "checkpoint=summit&quality=balanced&world=116&mobile=1", expectedState: "live", expectedVersion: "v1.16", expectsAlpineDetail: "compact" },
  { id: "v116-mobile-policy", query: "checkpoint=ridge&quality=balanced&world=116&mobile=1", expectedState: "live", expectedVersion: "v1.16" },
];

const browser = await chromium.launch({ executablePath, headless: true });
const results = [];
for (const testCase of cases) {
  const page = await browser.newPage({ viewport: testCase.query.includes("mobile=1") ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
  const consoleMessages = [];
  const failedRequests = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") consoleMessages.push({ location: message.location(), text: message.text(), type: message.type() });
  });
  page.on("requestfailed", (request) => failedRequests.push({ error: request.failure()?.errorText ?? "unknown", url: request.url() }));
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`${origin}/world-lab-review?${testCase.query}`, { waitUntil: "domcontentloaded" });
  await page.locator(`[data-renderer-state="${testCase.expectedState}"]`).waitFor({ timeout: 45_000 });
  if (testCase.expectedState === "live") await page.waitForTimeout(4_000);
  const evidence = await page.evaluate(() => ({
    alpineGeology: window.__MADAGIN_ALPINE_GEOLOGY_V116__ ?? null,
    canvasCount: document.querySelectorAll("canvas").length,
    compactJourneySeam: window.__MADAGIN_COMPACT_JOURNEY_SEAM_V116__ ?? null,
    fallbackVisible: Boolean(document.querySelector('[data-renderer-state="fallback"]')),
    reducedMotionLabel: document.body.textContent?.includes("Calm rail") ?? false,
    rendererState: document.querySelector("[data-renderer-state]")?.getAttribute("data-renderer-state") ?? null,
    resources: performance.getEntriesByType("resource").map((entry) => entry.name).filter((name) => name.includes("/world/")),
    videoElements: document.querySelectorAll("video").length,
    v115Marker: document.body.textContent?.includes("WORLD SLICE V1.15") ?? false,
    worldVersion: document.documentElement.dataset.madaginWorldVersion ?? null,
  }));
  const forbiddenV115OnMobile = testCase.id === "v116-mobile-policy" && evidence.resources.some((name) => name.includes("/world/v115/"));
  const alpineGeology = testCase.expectsAlpineDetail
    ? evidence.alpineGeology?.[testCase.expectsAlpineDetail]
    : null;
  const baseAlpineTriangles = alpineGeology?.sourceTriangles * 4;
  const detailedCrownSubdivisionPassed = testCase.expectsAlpineDetail !== "detailed" || (
    alpineGeology?.crownSubdivision?.selectedTriangles > 0
    && alpineGeology?.crownSubdivision?.sourceTriangles === baseAlpineTriangles
    && alpineGeology?.crownSubdivision?.triangles === alpineGeology?.triangles
    && alpineGeology?.triangles > baseAlpineTriangles
  );
  const alpineGeologyPassed = !testCase.expectsAlpineDetail || (
    alpineGeology?.adjustedVertices > 0
    && alpineGeology?.sourceTriangles > 0
    && (testCase.expectsAlpineDetail === "detailed"
      ? detailedCrownSubdivisionPassed
      : alpineGeology?.triangles === baseAlpineTriangles)
    && alpineGeology?.valleyBoundaryProtected === true
    && alpineGeology?.worldBoundsProtected === true
  );
  const passed = evidence.rendererState === testCase.expectedState
    && evidence.videoElements === 0
    && (testCase.expectedVersion === null || evidence.worldVersion === testCase.expectedVersion)
    && (!testCase.expectsV115Marker || (evidence.v115Marker && evidence.resources.some((name) => name.includes("/world/v115/"))))
    && (testCase.id !== "reduced-motion" || evidence.reducedMotionLabel)
    && (testCase.id !== "v116-mobile-policy"
      || evidence.compactJourneySeam?.method === "exact-source-boundary-zipper-hermite-remesh")
    && alpineGeologyPassed
    && !forbiddenV115OnMobile
    && pageErrors.length === 0;
  results.push({ consoleMessages, evidence, failedRequests, id: testCase.id, pageErrors, passed });
  await page.close();
}
await browser.close();
await fs.writeFile(outputPath, `${JSON.stringify({ capturedAt: new Date().toISOString(), results }, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ outputPath, results: results.map(({ consoleMessages, failedRequests, id, pageErrors, passed }) => ({ console: consoleMessages.length, failedRequests: failedRequests.length, id, pageErrors: pageErrors.length, passed })) }, null, 2)}\n`);
if (results.some((result) => !result.passed)) process.exitCode = 1;
