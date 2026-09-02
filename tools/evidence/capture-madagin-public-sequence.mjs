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
  // The public journey intentionally holds its opening composition through
  // the first 18 percent of the section, then maps the remaining 72 percent
  // to the complete World Lab rail. These scroll positions therefore sample
  // the authored world chapters rather than evenly spaced page positions.
  { id: "opening", progress: 0 },
  { id: "valley", progress: 0.419 },
  { id: "lake", progress: 0.541 },
  { id: "waterfall", progress: 0.721 },
  { id: "summit", progress: 0.9 },
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
await page.waitForTimeout(4_000);

const results = [];
for (const checkpoint of checkpoints) {
  await page.evaluate((progress) => {
    const loader = document.querySelector("[data-public-world-loader]");
    const journey = loader?.closest("section");
    if (!(journey instanceof HTMLElement)) throw new Error("Public journey section was not found.");
    const travel = Math.max(0, journey.offsetHeight - window.innerHeight);
    window.scrollTo({ behavior: "instant", top: journey.offsetTop + travel * progress });
  }, checkpoint.progress);
  await page.waitForTimeout(2_500);
  const evidence = await page.evaluate(() => ({
    canvasCount: document.querySelectorAll("canvas").length,
    chapter: document.querySelector("[data-world-chapter]")?.getAttribute("data-world-chapter") ?? null,
    rendererState: document.querySelector("[data-renderer-state]")?.getAttribute("data-renderer-state") ?? null,
    scrollY: window.scrollY,
    videoCount: document.querySelectorAll("video").length,
    worldResources: performance.getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => name.includes("/world/"))
      .length,
  }));
  await page.screenshot({
    path: path.join(outputRoot, `${checkpoint.id}.png`),
    fullPage: false,
  });
  results.push({ ...checkpoint, ...evidence });
}

await browser.close();
const outputPath = path.join(outputRoot, "sequence.json");
await fs.writeFile(
  outputPath,
  `${JSON.stringify({ capturedAt: new Date().toISOString(), origin, pageErrors, results }, null, 2)}\n`,
  "utf8",
);
process.stdout.write(`${JSON.stringify({ outputPath, pageErrors, results }, null, 2)}\n`);
if (pageErrors.length || results.some((result) => result.canvasCount !== 1 || result.rendererState !== "live" || result.videoCount !== 0)) {
  process.exitCode = 1;
}
