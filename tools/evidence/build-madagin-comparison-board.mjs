import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const runtimeModules = process.env.MADAGIN_NODE_MODULES
  ?? "C:\\Users\\Ocean\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules";
const require = createRequire(path.join(runtimeModules, "madagin-board.cjs"));
const sharp = require("sharp");

const [outputArg, labelA, framesAArg, labelB, framesBArg, ...requestedFrames] = process.argv.slice(2);
if (!outputArg || !labelA || !framesAArg || !labelB || !framesBArg) {
  throw new Error("Usage: node build-madagin-comparison-board.mjs <output> <label-a> <frames-a> <label-b> <frames-b> [frame names...]");
}
const frameNames = requestedFrames.length ? requestedFrames : [
  "00-opening.png",
  "04-valley-wide.png",
  "07-waterfall-establishing.png",
  "08-waterfall-close.png",
  "10-summit.png",
  "11-ocean.png",
];
const output = path.resolve(root, outputArg);
const framesA = path.resolve(root, framesAArg);
const framesB = path.resolve(root, framesBArg);
const first = await sharp(path.join(framesA, frameNames[0])).metadata();
const portrait = (first.height ?? 1) > (first.width ?? 1);
const cellWidth = portrait ? 260 : 480;
const imageHeight = Math.round(cellWidth * (first.height ?? 1) / (first.width ?? 1));
const labelHeight = 38;
const cellHeight = imageHeight + labelHeight;
const columns = Math.min(3, frameNames.length);
const groups = Math.ceil(frameNames.length / columns);
const canvasWidth = cellWidth * columns;
const canvasHeight = cellHeight * groups * 2;
const composites = [];

function escapeXml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
}

for (let index = 0; index < frameNames.length; index += 1) {
  const column = index % columns;
  const group = Math.floor(index / columns);
  for (const [variant, label, directory] of [[0, labelA, framesA], [1, labelB, framesB]]) {
    const top = (group * 2 + variant) * cellHeight;
    const image = await sharp(path.join(directory, frameNames[index]))
      .resize(cellWidth, imageHeight, { fit: "cover" })
      .png()
      .toBuffer();
    const caption = `${label} · ${frameNames[index].replace(/\.png$/i, "")}`;
    const svg = Buffer.from(`<svg width="${cellWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#101819"/>
      <text x="14" y="25" fill="#eef4ef" font-size="16" font-family="Arial, sans-serif">${escapeXml(caption)}</text>
    </svg>`);
    composites.push({ input: svg, left: column * cellWidth, top });
    composites.push({ input: image, left: column * cellWidth, top: top + labelHeight });
  }
}

await fs.mkdir(path.dirname(output), { recursive: true });
await sharp({ create: { width: canvasWidth, height: canvasHeight, channels: 3, background: "#0b1112" } })
  .composite(composites)
  .png()
  .toFile(output);
process.stdout.write(`${JSON.stringify({ frameNames, output, size: [canvasWidth, canvasHeight] }, null, 2)}\n`);
