import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const runtimeModules = process.env.MADAGIN_NODE_MODULES
  ?? "C:\\Users\\Ocean\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules";
const require = createRequire(path.join(runtimeModules, "madagin-capture.cjs"));
const { chromium } = require("playwright");

const origin = process.env.MADAGIN_WORLD_ORIGIN ?? "http://localhost:3108";
const world = process.env.MADAGIN_WORLD_VERSION ?? "116";
const quality = process.env.MADAGIN_WORLD_QUALITY ?? "balanced";
const mode = process.env.MADAGIN_CAPTURE_MODE ?? "desktop";
const candidate = (process.env.MADAGIN_CAPTURE_CANDIDATE ?? process.argv[2] ?? `v${world}-capture`)
  .replace(/[^a-zA-Z0-9._-]+/g, "-");
const viewport = mode === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const outputRoot = path.join(root, "output", "playwright", "madagin-world-progress", candidate, mode);
const framesRoot = path.join(outputRoot, "frames");
const videoRoot = path.join(outputRoot, "video-tmp");
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function existingChrome() {
  const candidates = [
    process.env.MADAGIN_BROWSER_EXECUTABLE,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean);
  for (const candidatePath of candidates) {
    try {
      await fs.access(candidatePath);
      return candidatePath;
    } catch {
      // Continue to the next installed-browser candidate.
    }
  }
  return chromium.executablePath();
}

async function clickButtonByText(page, label) {
  const clicked = await page.evaluate((text) => {
    const button = [...document.querySelectorAll("button")]
      .find((item) => item.textContent?.trim().includes(text));
    button?.click();
    return Boolean(button);
  }, label);
  if (!clicked) throw new Error(`Button unavailable: ${label}`);
}

async function main() {
  await fs.mkdir(framesRoot, { recursive: true });
  await fs.mkdir(videoRoot, { recursive: true });
  const executablePath = await existingChrome();
  const browser = await chromium.launch({
    executablePath,
    headless: false,
    args: [
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      `--window-size=${viewport.width},${viewport.height}`,
    ],
  });
  const context = await browser.newContext({
    colorScheme: "light",
    deviceScaleFactor: 1,
    hasTouch: mode === "mobile",
    isMobile: mode === "mobile",
    recordVideo: { dir: videoRoot, size: viewport },
    reducedMotion: "no-preference",
    screen: viewport,
    viewport,
  });
  const page = await context.newPage();
  const runtime = {
    console: [],
    failedRequests: [],
    pageErrors: [],
    responses: [],
  };

  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      runtime.console.push({
        at: new Date().toISOString(),
        location: message.location(),
        text: message.text(),
        type: message.type(),
      });
    }
  });
  page.on("pageerror", (error) => runtime.pageErrors.push({ at: new Date().toISOString(), message: error.message }));
  page.on("requestfailed", (request) => runtime.failedRequests.push({
    at: new Date().toISOString(),
    error: request.failure()?.errorText ?? "unknown",
    resourceType: request.resourceType(),
    url: request.url(),
  }));
  page.on("response", (response) => {
    if (response.url().includes("/world/") || response.status() >= 400) {
      runtime.responses.push({ at: new Date().toISOString(), status: response.status(), url: response.url() });
    }
  });
  await page.addInitScript(() => {
    window.__MADAGIN_CAPTURE_EVENTS__ = [];
    for (const eventName of ["madagin:journey-motion", "madagin:journey-chapter", "madagin:ridge-stage"]) {
      window.addEventListener(eventName, (event) => {
        window.__MADAGIN_CAPTURE_EVENTS__.push({
          at: performance.now(),
          detail: event.detail ?? null,
          name: eventName,
        });
      });
    }
  });

  const url = `${origin}/world-lab-review?checkpoint=ridge&quality=${quality}&world=${world}&mobile=${mode === "mobile" ? "1" : "0"}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.bringToFront();
  await page.locator('[data-renderer-state="live"]').waitFor({ timeout: 45_000 });
  await page.waitForFunction((version) => {
    if (document.querySelectorAll("canvas").length !== 1) return false;
    if (version === "116") return Boolean(window.__MADAGIN_WORLD_STREAM_V116__);
    return Boolean(window.__MADAGIN_RIDGE_STAGES_V115__?.length);
  }, world, { timeout: 45_000 });
  await sleep(4_000);

  await clickButtonByText(page, "Hide scene UI");
  await clickButtonByText(page, "Present full screen");
  await sleep(800);

  const frameEvidence = [];
  const capture = async (name, targetSeconds = null, startedAt = null) => {
    if (targetSeconds !== null && startedAt !== null) {
      const remaining = startedAt + targetSeconds * 1_000 - Date.now();
      if (remaining > 0) await sleep(remaining);
    }
    const state = await page.evaluate(() => ({
      alpineGeology: window.__MADAGIN_ALPINE_GEOLOGY_V116__ ?? null,
      canvasCount: document.querySelectorAll("canvas").length,
      rendererState: document.querySelector("[data-renderer-state]")?.getAttribute("data-renderer-state") ?? null,
      stream: window.__MADAGIN_WORLD_STREAM_V116__ ?? null,
      videoElements: document.querySelectorAll("video").length,
    }));
    const filename = `${name}.png`;
    await page.screenshot({ path: path.join(framesRoot, filename) });
    frameEvidence.push({ at: new Date().toISOString(), filename, state, targetSeconds });
  };

  await capture("00-opening");
  await clickButtonByText(page, "Play full journey");
  const journeyStartedAt = Date.now();
  const journeyFrames = [
    ["01-ridge-early", 5],
    ["02-pre-crest", 15],
    ["03-valley-first", 18.8],
    ["04-valley-wide", 22.5],
    ["05-lake-approach", 27.5],
    ["06-clearing", 35],
    ["07-waterfall-establishing", 41],
    ["08-waterfall-close", 45.5],
    ["09-emergence", 49.5],
    ["10-summit", 53.7],
  ];
  for (const [name, seconds] of journeyFrames) await capture(name, seconds, journeyStartedAt);
  await sleep(Math.max(0, journeyStartedAt + 56_000 - Date.now()));

  await clickButtonByText(page, "Ocean pan");
  await sleep(6_000);
  await capture("11-ocean");
  await clickButtonByText(page, "Sky tilt");
  await sleep(6_000);
  await capture("12-sky");
  await clickButtonByText(page, "Mountain ascent");
  await sleep(4_000);
  await capture("13-contact-trailhead");
  for (const label of ["What needs to change", "Investment range", "Timing", "The wider picture", "Where to reply", "Review + send"]) {
    await clickButtonByText(page, label);
    await sleep(900);
  }
  await sleep(2_000);
  await capture("14-contact-summit");

  const pageEvidence = await page.evaluate(() => ({
    alpineGeology: window.__MADAGIN_ALPINE_GEOLOGY_V116__ ?? null,
    benchmark: window.__MADAGIN_RIDGE_BENCHMARK_V116__ ?? null,
    captureEvents: window.__MADAGIN_CAPTURE_EVENTS__ ?? [],
    compactJourneySeam: window.__MADAGIN_COMPACT_JOURNEY_SEAM_V116__ ?? null,
    compactTerminalWeld: window.__MADAGIN_COMPACT_TERMINAL_WELD_V116__ ?? null,
    contactTrailheadHabitat: window.__MADAGIN_CONTACT_TRAILHEAD_HABITAT_V116__ ?? null,
    cumulativeVegetation: window.__MADAGIN_CUMULATIVE_VEGETATION_V116__ ?? null,
    detailedTerrain: window.__MADAGIN_DETAILED_TERRAIN_V116__ ?? null,
    href: location.href,
    riverCorridor: window.__MADAGIN_RIVER_CORRIDOR_V116__ ?? null,
    riverGeology: window.__MADAGIN_RIVER_GEOLOGY_V116__ ?? null,
    riparianEcology: window.__MADAGIN_RIPARIAN_ECOLOGY_V116__ ?? null,
    resources: performance.getEntriesByType("resource").map((entry) => ({
      decodedBodySize: entry.decodedBodySize,
      duration: entry.duration,
      name: entry.name,
      transferSize: entry.transferSize,
    })),
    videoElements: document.querySelectorAll("video").length,
    videoResources: performance.getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(name)),
    waterfallLandform: window.__MADAGIN_WATERFALL_LANDFORM_V116__ ?? null,
    waterfallSpray: window.__MADAGIN_WATERFALL_SPRAY_V116__ ?? null,
    watershedSurface: window.__MADAGIN_WATERSHED_SURFACE_V116__ ?? null,
    worldVersion: document.documentElement.dataset.madaginWorldVersion ?? null,
  }));
  const metadata = {
    browser: { executablePath, kind: executablePath.toLowerCase().includes("google\\chrome") ? "Google Chrome" : "Playwright Chromium" },
    candidate,
    capturedAt: new Date().toISOString(),
    frameEvidence,
    mode,
    page: pageEvidence,
    quality,
    runtime,
    url,
    viewport,
    world,
  };
  await fs.writeFile(path.join(outputRoot, "capture-metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(outputRoot, "console-and-network.json"), `${JSON.stringify(runtime, null, 2)}\n`, "utf8");
  const video = page.video();
  await context.close();
  const finalVideo = path.join(outputRoot, "journey.webm");
  if (!video) throw new Error("Playwright did not create a video handle.");
  await video.saveAs(finalVideo);
  await browser.close();
  const stat = await fs.stat(finalVideo);
  process.stdout.write(`${JSON.stringify({ candidate, finalVideo, frames: frameEvidence.length, mode, videoBytes: stat.size, viewport }, null, 2)}\n`);
}

await main();
