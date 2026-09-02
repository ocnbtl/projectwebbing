import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const runtimeModules = process.env.MADAGIN_NODE_MODULES
  ?? "C:\\Users\\Ocean\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules";
const require = createRequire(path.join(runtimeModules, "madagin-public-runtime-verifier.cjs"));
const { chromium } = require("playwright");

const origin = process.env.MADAGIN_PUBLIC_ORIGIN ?? "http://localhost:3108";
const label = (process.env.MADAGIN_PUBLIC_EVIDENCE_LABEL ?? "local")
  .replace(/[^a-zA-Z0-9._-]+/g, "-");
const outputRoot = path.join(
  root,
  "output",
  "playwright",
  "madagin-world-progress",
  "production-public-runtime",
  label,
);
const outputPath = path.join(outputRoot, "runtime-gates.json");
const executablePath = process.env.MADAGIN_BROWSER_EXECUTABLE
  ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const cases = [
  { id: "desktop-live", viewport: { width: 1440, height: 900 }, expectedPolicy: "supported", expectedState: "live", expectedTier: "balanced", scroll: true },
  { id: "mobile-compact", viewport: { width: 390, height: 844 }, expectedPolicy: "supported", expectedState: "live", expectedTier: "conservative", scroll: true },
  { id: "reduced-motion-fallback", viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", expectedPolicy: "reduced-motion", expectedState: "fallback", expectedTier: null },
  { id: "data-saver-fallback", viewport: { width: 1440, height: 900 }, capability: "data-saver", expectedPolicy: "data-saver", expectedState: "fallback", expectedTier: null },
  { id: "low-power-fallback", viewport: { width: 390, height: 844 }, capability: "low-power", expectedPolicy: "low-power", expectedState: "fallback", expectedTier: null },
  { id: "webgl-unavailable-fallback", viewport: { width: 1440, height: 900 }, capability: "no-webgl", expectedPolicy: "webgl-unavailable", expectedState: "fallback", expectedTier: null },
];

await fs.mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const results = [];

for (const testCase of cases) {
  const context = await browser.newContext({
    colorScheme: "light",
    reducedMotion: testCase.reducedMotion ?? "no-preference",
    viewport: testCase.viewport,
  });

  if (testCase.capability === "data-saver") {
    await context.addInitScript(() => {
      Object.defineProperty(window.navigator, "connection", {
        configurable: true,
        value: { saveData: true },
      });
    });
  }
  if (testCase.capability === "low-power") {
    await context.addInitScript(() => {
      Object.defineProperty(window.navigator, "deviceMemory", { configurable: true, value: 4 });
      Object.defineProperty(window.navigator, "hardwareConcurrency", { configurable: true, value: 4 });
    });
  }
  if (testCase.capability === "no-webgl") {
    await context.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function getContext(type, ...args) {
        if (type === "webgl2") return null;
        return original.call(this, type, ...args);
      };
    });
  }

  const page = await context.newPage();
  const consoleMessages = [];
  const failedRequests = [];
  const pageErrors = [];
  const responses = [];
  const requestedUrls = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      consoleMessages.push({ location: message.location(), text: message.text(), type: message.type() });
    }
  });
  page.on("request", (request) => requestedUrls.push(request.url()));
  page.on("requestfailed", (request) => failedRequests.push({ error: request.failure()?.errorText ?? "unknown", url: request.url() }));
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => responses.push({ status: response.status(), url: response.url() }));

  await page.goto(`${origin}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator(`[data-public-world-loader="${testCase.expectedPolicy}"]`).waitFor({ timeout: 60_000 });
  if (testCase.expectedState === "live") {
    await page.locator('[data-public-world][data-renderer-state="live"]').waitFor({ timeout: 60_000 });
    await page.waitForTimeout(4_000);
  }

  const initialChapter = await page.locator("[data-public-world]").getAttribute("data-world-chapter").catch(() => null);
  if (testCase.scroll) {
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight * 0.62, behavior: "instant" }));
    await page.waitForTimeout(10_000);
  }
  const finalChapter = await page.locator("[data-public-world]").getAttribute("data-world-chapter").catch(() => null);

  await page.keyboard.press("Home");
  await page.waitForTimeout(250);
  await page.keyboard.press("Tab");
  const keyboardFocus = await page.evaluate(() => ({
    href: document.activeElement?.getAttribute("href") ?? null,
    text: document.activeElement?.textContent?.trim() ?? null,
  }));
  await page.screenshot({ fullPage: false, path: path.join(outputRoot, `${testCase.id}.png`) });

  const evidence = await page.evaluate(() => {
    const publicWorld = document.querySelector("[data-public-world]");
    const primaryNavigation = document.querySelector('nav[aria-label="Primary navigation"]');
    return {
      canvasCount: document.querySelectorAll("canvas").length,
      contactLinks: [...document.querySelectorAll('a[href="/contact"]')].length,
      debugCopyVisible: document.body.textContent?.includes("Real-time world prototype")
        || document.body.textContent?.includes("Prototype diagnostics")
        || false,
      h1: document.querySelector("h1")?.textContent?.trim() ?? null,
      loaderPolicy: document.querySelector("[data-public-world-loader]")?.getAttribute("data-public-world-loader") ?? null,
      navigationLinks: primaryNavigation ? [...primaryNavigation.querySelectorAll("a")].map((link) => link.getAttribute("href")) : [],
      qualityTier: publicWorld?.getAttribute("data-quality-tier") ?? null,
      rendererState: publicWorld?.getAttribute("data-renderer-state")
        ?? (document.querySelector("[data-public-world-loader]")?.getAttribute("data-public-world-loader") === "supported" ? null : "fallback"),
      skipLink: document.querySelector('a[href="#site-content"]')?.textContent?.trim() ?? null,
      videoCount: document.querySelectorAll("video").length,
    };
  });

  const worldResponses = responses.filter(({ url }) => new URL(url).pathname.startsWith("/world/"));
  const requiredResponseFailures = worldResponses.filter(({ status }) => status < 200 || status >= 300);
  const videoRequests = requestedUrls.filter((url) => /\.(?:mp4|webm|mov)(?:$|\?)/i.test(new URL(url).pathname));
  const worldRequests = requestedUrls.filter((url) => new URL(url).pathname.startsWith("/world/"));
  const chapterMoved = !testCase.scroll || (initialChapter !== null && finalChapter !== null && initialChapter !== finalChapter);
  const fallbackStayedLightweight = testCase.expectedState !== "fallback" || worldRequests.length === 0;
  const mobileAvoidedV115 = testCase.id !== "mobile-compact" || !worldRequests.some((url) => new URL(url).pathname.startsWith("/world/v115/"));
  const passed = evidence.canvasCount === (testCase.expectedState === "live" ? 1 : 0)
    && evidence.videoCount === 0
    && videoRequests.length === 0
    && evidence.loaderPolicy === testCase.expectedPolicy
    && evidence.rendererState === testCase.expectedState
    && evidence.qualityTier === testCase.expectedTier
    && evidence.h1 === "Madagin"
    && evidence.navigationLinks.join(",") === "/projects,/blog,/about"
    && evidence.contactLinks >= 1
    && evidence.skipLink === "Skip the mountain journey"
    && evidence.debugCopyVisible === false
    && keyboardFocus.href === "#site-content"
    && pageErrors.length === 0
    && requiredResponseFailures.length === 0
    && chapterMoved
    && fallbackStayedLightweight
    && mobileAvoidedV115;

  results.push({
    chapterMoved,
    consoleMessages,
    evidence,
    failedRequests,
    fallbackStayedLightweight,
    finalChapter,
    id: testCase.id,
    initialChapter,
    keyboardFocus,
    mobileAvoidedV115,
    pageErrors,
    passed,
    requiredResponseFailures,
    videoRequests,
    worldRequestCount: worldRequests.length,
  });
  await context.close();
}

await browser.close();
await fs.writeFile(outputPath, `${JSON.stringify({ capturedAt: new Date().toISOString(), origin, results }, null, 2)}\n`, "utf8");
const summary = results.map((result) => ({
  canvasCount: result.evidence.canvasCount,
  finalChapter: result.finalChapter,
  id: result.id,
  pageErrors: result.pageErrors.length,
  passed: result.passed,
  policy: result.evidence.loaderPolicy,
  state: result.evidence.rendererState,
  videoRequests: result.videoRequests.length,
  worldRequests: result.worldRequestCount,
}));
process.stdout.write(`${JSON.stringify({ outputPath, summary }, null, 2)}\n`);
if (results.some((result) => !result.passed)) process.exitCode = 1;
