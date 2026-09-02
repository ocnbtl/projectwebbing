import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const runtimeModules = process.env.MADAGIN_NODE_MODULES
  ?? "C:\\Users\\Ocean\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules";
const require = createRequire(path.join(runtimeModules, "madagin-reference-review.cjs"));
const { chromium } = require("playwright");

const videoId = (process.argv[2] ?? "").replace(/[^a-zA-Z0-9_-]/g, "");
const seconds = Math.max(0, Number.parseInt(process.argv[3] ?? "0", 10) || 0);
if (!videoId) throw new Error("Usage: node tools/evidence/review-madagin-reference-video.mjs <youtube-id> <seconds>");

const outputRoot = path.join(root, "output", "playwright", "madagin-world-progress", "reference-footage");
const executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const url = `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`;
await fs.mkdir(outputRoot, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: false });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const messages = [];
page.on("console", (message) => {
  if (message.type() === "error" || message.type() === "warning") messages.push({ text: message.text(), type: message.type() });
});
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
await page.waitForTimeout(5_000);
const consent = page.getByRole("button", { name: /accept all/i });
if (await consent.count()) await consent.first().click();
await page.waitForTimeout(5_000);
await page.evaluate((requestedSeconds) => {
  const video = document.querySelector("video");
  if (video instanceof HTMLVideoElement) {
    video.muted = true;
    if (Math.abs(video.currentTime - requestedSeconds) > 3) video.currentTime = requestedSeconds;
    void video.play().catch(() => undefined);
  }
}, seconds);
await page.waitForTimeout(4_000);
const state = await page.evaluate(() => {
  const video = document.querySelector("video");
  return {
    currentTime: video instanceof HTMLVideoElement ? video.currentTime : null,
    duration: video instanceof HTMLVideoElement ? video.duration : null,
    paused: video instanceof HTMLVideoElement ? video.paused : null,
    title: document.title,
  };
});
const stem = `${videoId}-${String(seconds).padStart(4, "0")}`;
const screenshot = path.join(outputRoot, `${stem}.png`);
await page.screenshot({ path: screenshot });
await fs.writeFile(
  path.join(outputRoot, `${stem}.json`),
  `${JSON.stringify({ messages, requestedSeconds: seconds, screenshot, state, url, videoId }, null, 2)}\n`,
  "utf8",
);
await browser.close();
process.stdout.write(`${JSON.stringify({ requestedSeconds: seconds, screenshot, state, url, videoId }, null, 2)}\n`);
