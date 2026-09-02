import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const runtimeModules = process.env.MADAGIN_NODE_MODULES
  ?? "C:\\Users\\Ocean\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules";
const require = createRequire(path.join(runtimeModules, "madagin-recording-verifier.cjs"));
const { chromium } = require("playwright");
const executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const sources = process.argv.slice(2).map((source) => path.resolve(source));
const outputPath = process.env.MADAGIN_RECORDING_OUTPUT
  ? path.resolve(process.env.MADAGIN_RECORDING_OUTPUT)
  : null;

if (!sources.length) throw new Error("Pass one or more WebM recording paths.");

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required"],
});
const results = [];
for (const source of sources) {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(source).href, { waitUntil: "load" });
  await page.locator("video").waitFor({ timeout: 15_000 });
  const before = await page.locator("video").evaluate(async (video) => {
    if (video.readyState < 1) await new Promise((resolve) => video.addEventListener("loadedmetadata", resolve, { once: true }));
    return { duration: video.duration, readyState: video.readyState, videoHeight: video.videoHeight, videoWidth: video.videoWidth };
  });
  await page.locator("video").evaluate((video) => video.play());
  await page.waitForTimeout(750);
  const after = await page.locator("video").evaluate((video) => ({ currentTime: video.currentTime, paused: video.paused }));
  results.push({ after, before, playable: Number.isFinite(before.duration) && before.duration > 1 && after.currentTime > 0, source });
  await page.close();
}
await browser.close();
if (outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify({ capturedAt: new Date().toISOString(), results }, null, 2)}\n`, "utf8");
}
process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
if (results.some((result) => !result.playable)) process.exitCode = 1;
