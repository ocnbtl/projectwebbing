import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const runtimeModules = process.env.MADAGIN_NODE_MODULES
  ?? "C:\\Users\\Ocean\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules";
const require = createRequire(path.join(runtimeModules, "madagin-checkpoint-capture.cjs"));
const { chromium } = require("playwright");
const checkpoint = (process.env.MADAGIN_CHECKPOINT ?? process.argv[2] ?? "waterfall").replace(/[^a-z0-9-]+/gi, "-");
const candidate = (process.env.MADAGIN_CAPTURE_CANDIDATE ?? process.argv[3] ?? "checkpoint-review").replace(/[^a-z0-9._-]+/gi, "-");
const view = (process.env.MADAGIN_CAPTURE_VIEW ?? "").replace(/[^a-z0-9-]+/gi, "-");
const outputRoot = path.join(root, "output", "playwright", "madagin-world-progress", candidate, "checkpoint");
const executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const origin = process.env.MADAGIN_WORLD_ORIGIN ?? "http://localhost:3108";
const world = process.env.MADAGIN_WORLD_VERSION ?? "116";
const mobile = process.env.MADAGIN_CAPTURE_MOBILE === "1";
const quality = (process.env.MADAGIN_CAPTURE_QUALITY ?? "balanced").replace(/[^a-z-]+/gi, "");
if (!["balanced", "conservative", "high"].includes(quality)) throw new Error(`Unsupported MADAGIN_CAPTURE_QUALITY: ${quality}`);
const journeySeconds = Number.parseFloat(process.env.MADAGIN_CAPTURE_JOURNEY_SECONDS ?? "");
const contactStep = Math.max(0, Math.min(6, Number.parseInt(process.env.MADAGIN_CAPTURE_CONTACT_STEP ?? "0", 10) || 0));

await fs.mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: false });
const context = await browser.newContext({
  deviceScaleFactor: mobile ? 2 : 1,
  isMobile: mobile,
  viewport: mobile ? { width: 430, height: 900 } : { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error" || message.type() === "warning") errors.push({ location: message.location(), text: message.text(), type: message.type() });
});
await page.goto(`${origin}/world-lab-review?checkpoint=${checkpoint}&quality=${quality}&world=${world}&mobile=${mobile ? "1" : "0"}`, { waitUntil: "domcontentloaded" });
try {
  await page.locator('[data-renderer-state="live"]').waitFor({ timeout: 75_000 });
} catch (error) {
  const failureName = `${mobile ? "mobile-" : ""}${checkpoint}-renderer-timeout`;
  const diagnostic = await page.evaluate(() => ({
    bodyText: document.body?.innerText.slice(0, 4_000) ?? "",
    canvasCount: document.querySelectorAll("canvas").length,
    documentReadyState: document.readyState,
    rendererStates: [...document.querySelectorAll("[data-renderer-state]")].map((element) => ({
      state: element.getAttribute("data-renderer-state"),
      text: element.textContent?.slice(0, 500) ?? "",
    })),
  })).catch((evaluationError) => ({ evaluationError: String(evaluationError) }));
  await page.screenshot({ path: path.join(outputRoot, `${failureName}.png`) }).catch(() => {});
  await fs.writeFile(
    path.join(outputRoot, `${failureName}.json`),
    `${JSON.stringify({ candidate, checkpoint, diagnostic, errors, error: String(error), mobile, world }, null, 2)}\n`,
    "utf8",
  );
  await browser.close();
  throw new Error(`Renderer did not become live; diagnostic written to ${failureName}.json`, { cause: error });
}
await page.waitForFunction((version) => version === "116"
  ? Boolean(window.__MADAGIN_WORLD_STREAM_V116__)
  : Boolean(window.__MADAGIN_RIDGE_STAGES_V115__?.length), world, { timeout: 45_000 });
await page.waitForTimeout(4_000);
await page.evaluate(() => {
  for (const label of ["Hide scene UI", "Present full screen"]) {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes(label));
    button?.click();
  }
});
await page.waitForTimeout(800);
if (Number.isFinite(journeySeconds) && journeySeconds > 0) {
  const played = await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes("Play full journey"));
    button?.click();
    return Boolean(button);
  });
  if (!played) throw new Error("Full journey action unavailable.");
  const startedAt = Date.now();
  await page.waitForTimeout(Math.max(0, journeySeconds * 1_000 - (Date.now() - startedAt)));
}
if (view) {
  const labels = { ocean: "Ocean pan", sky: "Sky tilt", contact: "Mountain ascent" };
  const label = labels[view];
  if (!label) throw new Error(`Unsupported MADAGIN_CAPTURE_VIEW: ${view}`);
  const clicked = await page.evaluate((text) => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes(text));
    button?.click();
    return Boolean(button);
  }, label);
  if (!clicked) throw new Error(`View action unavailable: ${label}`);
  await page.waitForTimeout(view === "contact" ? 4_000 : 6_000);
  if (view === "contact" && contactStep > 0) {
    const ascentLabels = ["What needs to change", "Investment range", "Timing", "The wider picture", "Where to reply", "Review + send"];
    for (const stepLabel of ascentLabels.slice(0, contactStep)) {
      const stepClicked = await page.evaluate((text) => {
        const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes(text));
        button?.click();
        return Boolean(button);
      }, stepLabel);
      if (!stepClicked) throw new Error(`Contact ascent action unavailable: ${stepLabel}`);
      await page.waitForTimeout(900);
    }
    await page.waitForTimeout(1_200);
  }
}
await page.waitForTimeout(200);
const motionSuffix = Number.isFinite(journeySeconds) && journeySeconds > 0 ? `-motion-${journeySeconds.toFixed(1).replace(".", "_")}` : "";
const contactSuffix = view === "contact" ? `-step-${contactStep}` : "";
const qualityPrefix = quality === "balanced" ? "" : `${quality}-`;
const captureName = `${qualityPrefix}${mobile ? "mobile-" : ""}${view || checkpoint}${contactSuffix}${motionSuffix}`;
const screenshot = path.join(outputRoot, `${captureName}.png`);
await page.screenshot({ path: screenshot });
const evidence = await page.evaluate(() => ({
  alpineGeology: window.__MADAGIN_ALPINE_GEOLOGY_V116__ ?? null,
  benchmark: window.__MADAGIN_RIDGE_BENCHMARK_V116__ ?? null,
  canvasCount: document.querySelectorAll("canvas").length,
  coastalShoulder: window.__MADAGIN_COASTAL_SHOULDER_V116__ ?? null,
  compactJourneySeam: window.__MADAGIN_COMPACT_JOURNEY_SEAM_V116__ ?? null,
  compactTerminalWeld: window.__MADAGIN_COMPACT_TERMINAL_WELD_V116__ ?? null,
  contactTrailheadHabitat: window.__MADAGIN_CONTACT_TRAILHEAD_HABITAT_V116__ ?? null,
  detailedTerrain: window.__MADAGIN_DETAILED_TERRAIN_V116__ ?? null,
  riparianEcology: window.__MADAGIN_RIPARIAN_ECOLOGY_V116__ ?? null,
  oceanRealismBU: window.__MADAGIN_OCEAN_REALISM_BU__ ?? null,
  realismBU: window.__MADAGIN_REALISM_BU__ ?? null,
  sourceIslandTreeBT: window.__MADAGIN_SOURCE_ISLAND_TREE_BT__ ?? null,
  stream: window.__MADAGIN_WORLD_STREAM_V116__ ?? null,
  waterfallSpray: window.__MADAGIN_WATERFALL_SPRAY_V116__ ?? null,
  waterRealismBU: window.__MADAGIN_WATER_REALISM_BU__ ?? null,
  videoElements: document.querySelectorAll("video").length,
}));
await fs.writeFile(path.join(outputRoot, `${captureName}.json`), `${JSON.stringify({ candidate, checkpoint, contactStep, errors, evidence, journeySeconds: Number.isFinite(journeySeconds) ? journeySeconds : null, mobile, quality, view: view || null, world }, null, 2)}\n`, "utf8");
await browser.close();
process.stdout.write(`${JSON.stringify({ candidate, checkpoint, quality, screenshot, view: view || null, world }, null, 2)}\n`);
