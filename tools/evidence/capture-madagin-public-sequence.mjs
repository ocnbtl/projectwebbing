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
    const detailedTerrain = window.__MADAGIN_DETAILED_TERRAIN_V116__ ?? {};
    const ecologyDebug = window.__MADAGIN_ECOLOGY_DEBUG_V116__ ?? {};
    const regionalHabitat = window.__MADAGIN_REGIONAL_HABITAT_V116__ ?? {};
    const sourceQualityVegetation = window.__MADAGIN_SOURCE_QUALITY_VEGETATION_BR__ ?? {};
    const sourceQualityGeology = window.__MADAGIN_SOURCE_GEOLOGY_BS__ ?? {};
    const sourceIslandTree = window.__MADAGIN_SOURCE_ISLAND_TREE_BT__ ?? {};
    const terrainMist = window.__MADAGIN_TERRAIN_MIST_V120__ ?? {};
    const realism = window.__MADAGIN_REALISM_BT__ ?? null;
    const watershedSurface = window.__MADAGIN_WATERSHED_SURFACE_V116__ ?? {};
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
        candidate: realism?.candidate ?? null,
        architectureProfiles: Math.max(0, ...Object.values(cumulativeVegetation)
          .map((zone) => zone?.architectureProfiles?.length ?? 0)),
        regionalVolcanicAdjustedVertices: detailedTerrain.valley?.watershedIntegration
          ?.regionalVolcanicLandform?.adjustedVertices ?? 0,
        regionalVolcanicSubdivisionPasses: detailedTerrain.valley?.watershedIntegration
          ?.regionalVolcanicLandform?.subdivisionPasses ?? 0,
        regionalVolcanicWaterProtection: detailedTerrain.valley?.watershedIntegration
          ?.regionalVolcanicLandform?.lakeRiverAndWaterfallProtected ?? false,
        watershedTriangles: detailedTerrain.valley?.watershedIntegration?.subdivision?.triangles ?? 0,
        regionalGroundcover: Object.values(ecologyDebug)
          .reduce((total, zone) => total + (zone?.restoredRegionalHabitatGroundcoverInstances ?? 0), 0),
        releasedPrimaryCanopy: Object.values(ecologyDebug)
          .reduce((total, zone) => total + (zone?.releasedPrimaryCanopyInstances ?? 0), 0),
        sourceQualityPachira: Object.values(sourceQualityVegetation)
          .reduce((total, zone) => total + (zone?.placements ?? 0), 0),
        sourceQualityPachiraTriangles: Math.max(0, ...Object.values(sourceQualityVegetation)
          .map((zone) => zone?.sourceTriangles ?? 0)),
        sourceQualityGeology: Object.values(sourceQualityGeology)
          .reduce((total, zone) => total + (zone?.placements ?? 0), 0),
        sourceQualityGeologyForms: Math.max(0, ...Object.values(sourceQualityGeology)
          .map((zone) => zone?.forms ?? 0)),
        sourceIslandTree: Object.values(sourceIslandTree)
          .reduce((total, zone) => total + (zone?.placements ?? 0), 0),
        sourceIslandTreeLicenses: Object.values(sourceIslandTree)
          .map((zone) => zone?.sourceLicense)
          .filter(Boolean),
        volcanicTarnFootprint: watershedSurface.volcanicTarnFootprint ?? false,
        volcanicTarnRadiusMeters: watershedSurface.radiusMeters ?? null,
        regionalHabitatAuthorities: Object.values(regionalHabitat)
          .map((habitat) => habitat?.habitatAuthority)
          .filter(Boolean),
        terrainContactMistAuthorities: terrainMist.authorities ?? [],
        terrainContactMistBanks: terrainMist.banks ?? 0,
        volumetricCrownPlacements: Object.values(ecologyDebug)
          .reduce((total, zone) => total + (zone?.volumetricCrownPlacements ?? 0), 0),
        volumetricCrownRenderedLobes: Object.values(ecologyDebug)
          .reduce((total, zone) => total + (zone?.volumetricCrownRenderedLobes ?? 0), 0),
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
  && result.structuralEcology?.candidate === "BT"
  && result.structuralEcology?.releasedPrimaryCanopy > 0
  && result.structuralEcology?.regionalVolcanicAdjustedVertices > 0
  && result.structuralEcology?.regionalVolcanicSubdivisionPasses === 0
  && result.structuralEcology?.regionalVolcanicWaterProtection === true
  && result.structuralEcology?.watershedTriangles > 0
  && result.structuralEcology?.watershedTriangles <= 1_500_000
  && result.structuralEcology?.sourceQualityPachira > 0
  && result.structuralEcology?.sourceQualityPachiraTriangles === 76_914
  && result.structuralEcology?.sourceQualityGeology > 0
  && result.structuralEcology?.sourceQualityGeologyForms === 7
  && result.structuralEcology?.sourceIslandTree > 0
  && result.structuralEcology?.sourceIslandTreeLicenses.every((license) => license === "CC0 1.0 Universal")
  && result.structuralEcology?.volcanicTarnFootprint === true
  && result.structuralEcology?.volcanicTarnRadiusMeters?.join(",") === "132.4,94.6"
  && result.structuralEcology?.volumetricCrownPlacements > 0
  && result.structuralEcology?.volumetricCrownRenderedLobes > result.structuralEcology?.volumetricCrownPlacements
)) && results.some((result) => (
  result.structuralEcology?.regionalGroundcover > 0
  && result.structuralEcology?.regionalHabitatAuthorities.length > 0
  && result.structuralEcology?.terrainContactMistBanks === 6
  && result.structuralEcology?.terrainContactMistAuthorities.length === 6
));
if (
  pageErrors.length
  || !structuralEcologyPassed
  || results.some((result) => result.canvasCount !== 1 || result.rendererState !== "live" || result.videoCount !== 0)
) {
  process.exitCode = 1;
}
