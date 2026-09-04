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
  { id: "v116-watershed-relief", query: "checkpoint=lake&quality=balanced&world=116", expectedState: "live", expectedVersion: "v1.16", expectsWatershedRelief: true },
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
  if (testCase.expectedVersion === "v1.16" && !testCase.query.includes("mobile=1")) {
    await page.waitForFunction(
      () => Object.values(window.__MADAGIN_SOURCE_QUALITY_VEGETATION_BR__ ?? {})
        .some((zone) => (zone?.placements ?? 0) > 0)
        && Object.values(window.__MADAGIN_SOURCE_GEOLOGY_BS__ ?? {})
          .some((zone) => (zone?.placements ?? 0) > 0)
        && Object.values(window.__MADAGIN_SOURCE_ISLAND_TREE_BT__ ?? {})
          .some((zone) => (zone?.placements ?? 0) > 0)
        && Object.values(window.__MADAGIN_SOURCE_ISLAND_TREE_01_BW__ ?? {})
          .some((zone) => (zone?.placements ?? 0) > 0),
      undefined,
      { timeout: 45_000 },
    );
  }
  const evidence = await page.evaluate(() => ({
    alpineGeology: window.__MADAGIN_ALPINE_GEOLOGY_V116__ ?? null,
    canvasCount: document.querySelectorAll("canvas").length,
    compactJourneySeam: window.__MADAGIN_COMPACT_JOURNEY_SEAM_V116__ ?? null,
    coastalEcology: window.__MADAGIN_COASTAL_ECOLOGY_V116__ ?? null,
    coastalShoulder: window.__MADAGIN_COASTAL_SHOULDER_V116__ ?? null,
    cumulativeVegetation: window.__MADAGIN_CUMULATIVE_VEGETATION_V116__ ?? null,
    detailedTerrain: window.__MADAGIN_DETAILED_TERRAIN_V116__ ?? null,
    ecologyDebug: window.__MADAGIN_ECOLOGY_DEBUG_V116__ ?? null,
    fallbackVisible: Boolean(document.querySelector('[data-renderer-state="fallback"]')),
    reducedMotionLabel: document.body.textContent?.includes("Calm rail") ?? false,
    rendererState: document.querySelector("[data-renderer-state]")?.getAttribute("data-renderer-state") ?? null,
    resources: performance.getEntriesByType("resource").map((entry) => entry.name).filter((name) => name.includes("/world/")),
    regionalHabitat: window.__MADAGIN_REGIONAL_HABITAT_V116__ ?? null,
    oceanRealismBY: window.__MADAGIN_OCEAN_REALISM_BY__ ?? null,
    oceanRealismBZ: window.__MADAGIN_OCEAN_REALISM_BZ__ ?? null,
    orographicWeatherBX: window.__MADAGIN_OROGRAPHIC_WEATHER_BX__ ?? null,
    orographicWeatherBZ: window.__MADAGIN_OROGRAPHIC_WEATHER_BZ__ ?? null,
    orographicWeatherCA: window.__MADAGIN_OROGRAPHIC_WEATHER_CA__ ?? null,
    realismBY: window.__MADAGIN_REALISM_BY__ ?? null,
    realismBZ: window.__MADAGIN_REALISM_BZ__ ?? null,
    realismCA: window.__MADAGIN_REALISM_CA__ ?? null,
    sourceIslandTreeBT: window.__MADAGIN_SOURCE_ISLAND_TREE_BT__ ?? null,
    sourceIslandTree01BW: window.__MADAGIN_SOURCE_ISLAND_TREE_01_BW__ ?? null,
    sourceQualityGeologyBS: window.__MADAGIN_SOURCE_GEOLOGY_BS__ ?? null,
    sourceQualityVegetationBR: window.__MADAGIN_SOURCE_QUALITY_VEGETATION_BR__ ?? null,
    terrainContactMist: window.__MADAGIN_TERRAIN_MIST_V120__ ?? null,
    waterRealismBY: window.__MADAGIN_WATER_REALISM_BY__ ?? null,
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
    alpineGeology?.crownSubdivisionPasses === 2
    && alpineGeology?.crownSubdivision?.length === 2
    && alpineGeology?.crownSubdivision?.every((pass) => pass?.selectedTriangles > 0)
    && alpineGeology?.crownSubdivision?.[0]?.sourceTriangles === baseAlpineTriangles
    && alpineGeology?.crownSubdivision?.[1]?.triangles === alpineGeology?.triangles
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
    && (testCase.expectsAlpineDetail !== "detailed" || (
      alpineGeology?.maximumReliefMeters > 0
      && alpineGeology?.maximumReliefMeters <= 180
      && alpineGeology?.summitMacroform?.detachedGeometry === false
      && alpineGeology?.summitMacroform?.maximumIncisionMeters > 0
      && alpineGeology?.summitMacroform?.maximumIncisionMeters <= 170
      && alpineGeology?.summitMacroform?.maximumUpliftMeters > 0
      && alpineGeology?.summitMacroform?.maximumUpliftMeters <= 40
      && alpineGeology?.summitSurfaceRelaxation?.adjustedVertices > 0
      && alpineGeology?.summitSurfaceRelaxation?.iterations === 2
    ))
  );
  const watershedRelief = testCase.expectsWatershedRelief
    ? evidence.detailedTerrain?.valley?.watershedIntegration?.regionalVolcanicLandform
    : null;
  const watershedReliefPassed = !testCase.expectsWatershedRelief || (
    watershedRelief?.adjustedVertices > 0
    && watershedRelief?.lakeRiverAndWaterfallProtected === true
    && watershedRelief?.subdivisionPasses === 2
    && watershedRelief?.maximumIncisionMeters > 0
    && watershedRelief?.maximumIncisionMeters <= 22.5
    && watershedRelief?.maximumUpliftMeters > 0
    && watershedRelief?.maximumUpliftMeters <= 17.5
    && evidence.detailedTerrain?.valley?.watershedIntegration?.subdivision?.triangles <= 1_500_000
    && evidence.detailedTerrain?.valley?.watershedIntegration?.valleyEscarpmentMesoRelief?.adjustedVertices > 0
    && evidence.detailedTerrain?.valley?.watershedIntegration?.valleyEscarpmentMesoRelief?.detachedGeometry === false
    && evidence.detailedTerrain?.valley?.watershedIntegration?.valleyEscarpmentMesoRelief?.lakeRiverAndWaterfallProtected === true
    && evidence.detailedTerrain?.valley?.watershedIntegration?.westernValleyCatchments?.adjustedVertices > 0
    && evidence.detailedTerrain?.valley?.watershedIntegration?.westernValleyCatchments?.detachedGeometry === false
    && evidence.detailedTerrain?.valley?.watershedIntegration?.westernValleyCatchments?.lakeRiverAndWaterfallProtected === true
    && evidence.detailedTerrain?.valley?.watershedIntegration?.westernValleyCatchments?.maximumIncisionMeters > 0
    && evidence.detailedTerrain?.valley?.watershedIntegration?.westernValleyCatchments?.maximumIncisionMeters <= 39
    && evidence.terrainContactMist?.banks === 16
    && evidence.orographicWeatherBX?.candidate === "BX"
    && evidence.orographicWeatherBX?.groundedBanks === 16
    && evidence.orographicWeatherBZ?.candidate === "BZ"
    && evidence.orographicWeatherBZ?.groundedBanks === 16
    && evidence.orographicWeatherBZ?.coastalContactBanks === 2
    && evidence.orographicWeatherCA?.candidate === "CA"
    && evidence.orographicWeatherCA?.groundedBanks === 16
    && evidence.orographicWeatherCA?.westernCatchmentBanks === 2
    && evidence.regionalHabitat?.easternValleyCatchment?.habitatAuthority === "paired-eastern-western-valley-catchment-networks"
    && evidence.regionalHabitat?.easternValleyCatchment?.westernGroundedPlacements > 0
  );
  const sourceQualityPachira = Object.values(evidence.sourceQualityVegetationBR ?? {});
  const sourceQualityPachiraPassed = testCase.expectedVersion !== "v1.16"
    || testCase.query.includes("mobile=1")
    || (
      sourceQualityPachira.reduce((total, zone) => total + (zone?.placements ?? 0), 0) > 0
      && sourceQualityPachira.every((zone) => zone?.sourceTriangles === 76_914)
    );
  const sourceQualityGeology = Object.values(evidence.sourceQualityGeologyBS ?? {});
  const sourceQualityGeologyPassed = testCase.expectedVersion !== "v1.16"
    || testCase.query.includes("mobile=1")
    || (
      sourceQualityGeology.reduce((total, zone) => total + (zone?.placements ?? 0), 0) > 0
      && sourceQualityGeology.every((zone) => zone?.forms === 7)
      && (testCase.id !== "v116-alpine-detailed" || (evidence.sourceQualityGeologyBS?.alpine?.placements ?? 0) > 0)
    );
  const sourceIslandTree = Object.values(evidence.sourceIslandTreeBT ?? {});
  const sourceIslandTreePassed = testCase.expectedVersion !== "v1.16"
    || testCase.query.includes("mobile=1")
    || (
      sourceIslandTree.reduce((total, zone) => total + (zone?.placements ?? 0), 0) > 0
      && sourceIslandTree.every((zone) => zone?.sourceLicense === "CC0 1.0 Universal")
      && sourceIslandTree.every((zone) => zone?.crossedPlanesPerPlacement === 2)
    );
  const sourceIslandTree01 = Object.values(evidence.sourceIslandTree01BW ?? {});
  const sourceIslandTree01Passed = testCase.expectedVersion !== "v1.16"
    || testCase.query.includes("mobile=1")
    || (
      sourceIslandTree01.reduce((total, zone) => total + (zone?.placements ?? 0), 0) > 0
      && sourceIslandTree01.every((zone) => zone?.sourceLicense === "CC0 1.0 Universal")
      && sourceIslandTree01.every((zone) => zone?.runtimeTriangles === 109_999)
    );
  const coastalHeightfieldPassed = testCase.expectedVersion !== "v1.16"
    || testCase.id !== "v116-alpine-detailed"
    || (
      evidence.coastalShoulder?.structuralSource?.dimensions?.columns === 77
      && evidence.coastalShoulder?.structuralSource?.dimensions?.rows === 179
      && evidence.coastalShoulder?.structuralSource?.triangles === 27_056
      && evidence.coastalShoulder?.candidate === "BZ"
      && evidence.coastalShoulder?.exposedCoastalVoidClosed === true
      && evidence.coastalShoulder?.southernExtension?.detachedGeometry === false
      && evidence.coastalShoulder?.southernExtension?.structuralSpan?.span === "valley"
      && evidence.coastalShoulder?.southernExtension?.structuralSpan?.triangles > 0
      && evidence.coastalShoulder?.southernBoundarySamples >= 39
      && evidence.coastalEcology?.["coastal-north"]?.sourceQualityIslandTree01Placements > 0
      && evidence.coastalEcology?.["coastal-south"]?.sourceQualityIslandTree01Placements > 0
    );
  const passed = evidence.rendererState === testCase.expectedState
    && evidence.videoElements === 0
    && (testCase.expectedVersion === null || evidence.worldVersion === testCase.expectedVersion)
    && (!testCase.expectsV115Marker || (evidence.v115Marker && evidence.resources.some((name) => name.includes("/world/v115/"))))
    && (testCase.id !== "reduced-motion" || evidence.reducedMotionLabel)
    && (testCase.id !== "v116-mobile-policy"
      || evidence.compactJourneySeam?.method === "exact-source-boundary-zipper-hermite-remesh")
    && alpineGeologyPassed
    && watershedReliefPassed
    && (testCase.expectedVersion !== "v1.16" || (
      evidence.realismBY?.candidate === "BY"
      && Object.keys(evidence.realismBY?.categories ?? {}).length === 5
      && evidence.realismBY?.detachedTerrainShells === false
      && evidence.realismBY?.waterNetworkProtected === true
      && evidence.realismBY?.lakeRadiusMeters?.join(",") === "132.4,94.6"
      && evidence.waterRealismBY?.candidate === "BY"
      && evidence.waterRealismBY?.waterfall?.body?.lowerHalfWidthMeters === 25.6
      && evidence.waterRealismBY?.waterfall?.braidedTransparentGaps === true
      && evidence.waterRealismBY?.waterfall?.cascadeShelves === 2
      && evidence.waterRealismBY?.plungeImpact?.brokenFoamArcs === 3
      && evidence.waterRealismBY?.lakeBed?.analyticBoundaryOptics === true
      && evidence.waterRealismBY?.lakeBed?.brokenTerrainReflection === true
      && evidence.waterRealismBY?.lakeBed?.opaqueInteriorSorting === true
      && evidence.waterRealismBY?.lakeBed?.proceduralWorldScale === true
      && evidence.waterRealismBY?.lakeBed?.shorelineBands === 3
      && (testCase.query.includes("mobile=1") || evidence.waterRealismBY?.lakeBed?.sourceGeologyPlacements >= 24)
      && evidence.oceanRealismBY?.candidate === "BY"
      && evidence.oceanRealismBY?.breakerBands === 3
      && evidence.oceanRealismBY?.deepenedVolcanicShallows === true
      && evidence.oceanRealismBY?.displacedPrimaryBreaker === true
      && evidence.oceanRealismBY?.nearshoreBackwash === true
      && evidence.oceanRealismBY?.foamTongues === true
      && (testCase.query.includes("mobile=1") || evidence.oceanRealismBY?.surfaceSegments >= 384)
      && evidence.realismBZ?.candidate === "BZ"
      && evidence.realismBZ?.detachedTerrainShells === false
      && evidence.realismBZ?.exposedCoastalVoidClosed === true
      && evidence.realismBZ?.waterNetworkProtected === true
      && evidence.realismCA?.candidate === "CA"
      && Object.keys(evidence.realismCA?.categories ?? {}).length === 5
      && evidence.realismCA?.detachedTerrainShells === false
      && evidence.realismCA?.waterNetworkProtected === true
      && evidence.realismCA?.westernCatchments === 4
      && evidence.realismCA?.westernSecondOrderRills === 8
      && evidence.oceanRealismBZ?.candidate === "BZ"
      && evidence.oceanRealismBZ?.breakerBands === 4
      && evidence.oceanRealismBZ?.coastalVoidClosed === true
      && evidence.oceanRealismBZ?.displacedBreakerBands === 3
      && evidence.oceanRealismBZ?.sedimentBearingShallows === true
      && (testCase.query.includes("mobile=1") || evidence.oceanRealismBZ?.surfaceSegments >= 448)
      && sourceQualityPachiraPassed
      && sourceQualityGeologyPassed
      && sourceIslandTreePassed
      && sourceIslandTree01Passed
      && coastalHeightfieldPassed
    ))
    && !forbiddenV115OnMobile
    && pageErrors.length === 0;
  results.push({ consoleMessages, evidence, failedRequests, id: testCase.id, pageErrors, passed });
  await page.close();
}
await browser.close();
await fs.writeFile(outputPath, `${JSON.stringify({ capturedAt: new Date().toISOString(), results }, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ outputPath, results: results.map(({ consoleMessages, failedRequests, id, pageErrors, passed }) => ({ console: consoleMessages.length, failedRequests: failedRequests.length, id, pageErrors: pageErrors.length, passed })) }, null, 2)}\n`);
if (results.some((result) => !result.passed)) process.exitCode = 1;
