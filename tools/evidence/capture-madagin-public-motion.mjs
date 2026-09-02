import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const runtimeModules = process.env.MADAGIN_NODE_MODULES
  ?? "C:\\Users\\Ocean\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules";
const require = createRequire(path.join(runtimeModules, "madagin-public-motion.cjs"));
const { chromium } = require("playwright");
const origin = process.env.MADAGIN_PUBLIC_ORIGIN ?? "http://localhost:3108";
const label = (process.env.MADAGIN_PUBLIC_EVIDENCE_LABEL ?? "public-motion")
  .replace(/[^a-z0-9_-]/gi, "-");
const outputRoot = path.join(root, "output", "playwright", "madagin-world-progress", label, "motion");

await fs.mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.MADAGIN_BROWSER_EXECUTABLE
    ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
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
await page.locator('[data-journey-action="pause"]').click();
await page.waitForFunction(() => document.documentElement.dataset.madaginJourneyState === "paused");
await page.waitForTimeout(1_000);

async function capturePair(id, holdMs = 1_600) {
  const before = await page.evaluate(() => ({
    progress: document.documentElement.dataset.madaginJourneyProgress ?? null,
    scrollY: window.scrollY,
    view: document.querySelector("[data-public-world]")?.getAttribute("data-world-view") ?? null,
  }));
  const firstPath = path.join(outputRoot, `${id}-a.png`);
  const secondPath = path.join(outputRoot, `${id}-b.png`);
  const first = await page.screenshot({ path: firstPath, fullPage: false });
  await page.waitForTimeout(holdMs);
  const second = await page.screenshot({ path: secondPath, fullPage: false });
  const after = await page.evaluate(() => ({
    progress: document.documentElement.dataset.madaginJourneyProgress ?? null,
    scrollY: window.scrollY,
    view: document.querySelector("[data-public-world]")?.getAttribute("data-world-view") ?? null,
  }));
  const firstSha256 = createHash("sha256").update(first).digest("hex");
  const secondSha256 = createHash("sha256").update(second).digest("hex");
  return {
    after,
    before,
    cameraRailHeld: before.progress === after.progress,
    firstPath: path.relative(root, firstPath).replaceAll("\\", "/"),
    firstSha256,
    framesDiffer: firstSha256 !== secondSha256,
    holdMs,
    id,
    secondPath: path.relative(root, secondPath).replaceAll("\\", "/"),
    secondSha256,
  };
}

const results = [await capturePair("ridge-environment")];
await page.locator('[data-journey-action="ocean"]').click();
await page.locator('[data-public-world][data-world-view="about"]').waitFor({ timeout: 10_000 });
await page.waitForTimeout(2_500);
results.push(await capturePair("ocean-environment"));

await browser.close();
const outputPath = path.join(outputRoot, "motion-evidence.json");
const passed = pageErrors.length === 0 && results.every((result) => (
  result.cameraRailHeld && result.framesDiffer && result.before.scrollY === 0 && result.after.scrollY === 0
));
await fs.writeFile(
  outputPath,
  `${JSON.stringify({ capturedAt: new Date().toISOString(), origin, pageErrors, passed, results }, null, 2)}\n`,
  "utf8",
);
process.stdout.write(`${JSON.stringify({ outputPath, pageErrors, passed, results }, null, 2)}\n`);
if (!passed) process.exitCode = 1;
