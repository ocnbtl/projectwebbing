import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const runtimeModules = process.env.MADAGIN_NODE_MODULES
  ?? "C:\\Users\\Ocean\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules";
const require = createRequire(path.join(runtimeModules, "madagin-public-sequence.cjs"));
const { chromium } = require("playwright");
const origin = process.env.MADAGIN_PUBLIC_ORIGIN ?? "http://localhost:3108";
const label = (process.env.MADAGIN_PUBLIC_EVIDENCE_LABEL ?? "public-sequence")
  .replace(/[^a-z0-9_-]/gi, "-");
const outputRoot = path.resolve(
  root,
  "output",
  "playwright",
  "madagin-world-progress",
  label,
);
const checkpoints = [
  { id: "opening", progress: 0.01 },
  { id: "valley", progress: 0.34 },
  { id: "lake", progress: 0.5 },
  { id: "waterfall", progress: 0.75 },
  { id: "summit", progress: 0.98 },
];

await fs.mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.locator('[data-renderer-state="live"]').waitFor({ timeout: 60_000 });
await page.waitForFunction(
  () => document.documentElement.dataset.madaginMeaningfulWorldReady === "true",
  undefined,
  { timeout: 60_000 },
);

const results = [];
for (const checkpoint of checkpoints) {
  await page.waitForFunction(
    (target) => Number(document.documentElement.dataset.madaginJourneyProgress ?? 0) >= target,
    checkpoint.progress,
    { timeout: 60_000 },
  );
  await page.waitForTimeout(350);
  const evidence = await page.evaluate(() => {
    const cumulativeVegetation = window.__MADAGIN_CUMULATIVE_VEGETATION_V116__ ?? {};
    const ecologyDebug = window.__MADAGIN_ECOLOGY_DEBUG_V116__ ?? {};
    const regionalHabitat = window.__MADAGIN_REGIONAL_HABITAT_V116__ ?? {};
    return {
      canvasCount: document.querySelectorAll("canvas").length,
      chapter: document.querySelector("[data-world-chapter]")?.getAttribute("data-world-chapter") ?? null,
      rendererState: document.querySelector("[data-renderer-state]")?.getAttribute("data-renderer-state") ?? null,
      journeyState: document.documentElement.dataset.madaginJourneyState ?? null,
      journeyView: document.documentElement.dataset.madaginJourneyView ?? null,
      worldView: document.querySelector("[data-public-world]")?.getAttribute("data-world-view") ?? null,
      scrollY: window.scrollY,
      videoCount: document.querySelectorAll("video").length,
      worldResources: performance.getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((name) => name.includes("/world/"))
        .length,
      structuralEcology: {
        architectureProfiles: Math.max(0, ...Object.values(cumulativeVegetation)
          .map((zone) => zone?.architectureProfiles?.length ?? 0)),
        regionalGroundcover: Object.values(ecologyDebug)
          .reduce((total, zone) => total + (zone?.restoredRegionalHabitatGroundcoverInstances ?? 0), 0),
        releasedPrimaryCanopy: Object.values(ecologyDebug)
          .reduce((total, zone) => total + (zone?.releasedPrimaryCanopyInstances ?? 0), 0),
        regionalHabitatAuthorities: Object.values(regionalHabitat)
          .map((habitat) => habitat?.habitatAuthority)
          .filter(Boolean),
      },
    };
  });
  await page.screenshot({
    path: path.join(outputRoot, `${checkpoint.id}.png`),
    fullPage: false,
  });
  results.push({ ...checkpoint, ...evidence });
}

for (const view of [
  { action: "ocean", id: "ocean", expected: "about" },
  { action: "sky", id: "sky", expected: "projects" },
]) {
  await page.locator(`[data-journey-action="${view.action}"]`).click();
  await page.locator(`[data-public-world][data-world-view="${view.expected}"]`).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(2_500);
  const evidence = await page.evaluate(() => ({
    canvasCount: document.querySelectorAll("canvas").length,
    chapter: document.querySelector("[data-world-chapter]")?.getAttribute("data-world-chapter") ?? null,
    rendererState: document.querySelector("[data-renderer-state]")?.getAttribute("data-renderer-state") ?? null,
    journeyState: document.documentElement.dataset.madaginJourneyState ?? null,
    journeyView: document.documentElement.dataset.madaginJourneyView ?? null,
    worldView: document.querySelector("[data-public-world]")?.getAttribute("data-world-view") ?? null,
    scrollY: window.scrollY,
    videoCount: document.querySelectorAll("video").length,
    worldResources: performance.getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => name.includes("/world/"))
      .length,
  }));
  await page.screenshot({ path: path.join(outputRoot, `${view.id}.png`), fullPage: false });
  results.push({ id: view.id, progress: 1, ...evidence });
}

await browser.close();
const outputPath = path.join(outputRoot, "sequence.json");
await fs.writeFile(
  outputPath,
  `${JSON.stringify({ capturedAt: new Date().toISOString(), origin, pageErrors, results }, null, 2)}\n`,
  "utf8",
);
process.stdout.write(`${JSON.stringify({ outputPath, pageErrors, results }, null, 2)}\n`);
const structuralEcologyPassed = results.some((result) => (
  result.structuralEcology?.architectureProfiles === 5
  && result.structuralEcology?.releasedPrimaryCanopy > 0
)) && results.some((result) => (
  result.structuralEcology?.regionalGroundcover > 0
  && result.structuralEcology?.regionalHabitatAuthorities.length > 0
));
if (
  pageErrors.length
  || !structuralEcologyPassed
  || results.some((result) => result.canvasCount !== 1 || result.rendererState !== "live" || result.videoCount !== 0)
) {
  process.exitCode = 1;
}
