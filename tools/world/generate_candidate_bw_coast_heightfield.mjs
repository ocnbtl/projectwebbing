import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "../..");
const outputPath = path.resolve(
  process.argv[2] ?? path.join(projectRoot, "public/world/v116/coast-heightfield-bw.json"),
);

const rows = 178;
const columns = 76;
const round = (value) => Math.round(value * 100_000) / 100_000;
const smoothstep = (value) => {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * (3 - 2 * clamped);
};

const samples = [];
for (let row = 0; row <= rows; row += 1) {
  const along = row / rows;
  const z = -315 + 600 * along;
  const taper = smoothstep(Math.pow(along, 0.78));
  const outerX = -730 + 420 * taper
    + (Math.sin(z * 0.027 + 0.8) * 17 + Math.sin(z * 0.071 - 1.4) * 7.5) * Math.sin(along * Math.PI);
  for (let column = 0; column <= columns; column += 1) {
    const across = column / columns;
    const spatialAcross = 1 - Math.pow(1 - across, 1.7);
    const x = outerX + (-310 - outerX) * spatialAcross;
    const reliefEnvelope = Math.sin(spatialAcross * Math.PI) * Math.sin(along * Math.PI);
    const headlands = (
      Math.sin(z * 0.031 + 0.7)
      + Math.sin(z * 0.067 - 1.1) * 0.42
    ) * reliefEnvelope * (2.8 + smoothstep((spatialAcross - 0.18) / 0.82) * 7.2);
    const drainage = -Math.pow(Math.max(0, Math.sin(z * 0.045 - across * 3.2 + 1.4)), 6)
      * reliefEnvelope * (2.1 + smoothstep((spatialAcross - 0.18) / 0.82) * 5.4);
    const fracture = (
      Math.sin(x * 0.051 + z * 0.034)
      + Math.sin(x * 0.019 - z * 0.079) * 0.48
      + Math.sin(x * 0.103 + z * 0.013) * 0.22
    ) * reliefEnvelope * (2.7 + smoothstep((spatialAcross - 0.18) / 0.82) * 4.9);
    const secondaryRills = -Math.pow(
      Math.max(0, Math.sin(z * 0.137 + x * 0.021 - 0.6)),
      12,
    ) * reliefEnvelope * (0.7 + spatialAcross * 1.9);
    const weatheredBenches = Math.sign(Math.sin(x * 0.094 - z * 0.052))
      * Math.pow(Math.abs(Math.sin(x * 0.094 - z * 0.052)), 10)
      * reliefEnvelope * (0.28 + spatialAcross * 0.68);
    samples.push(round(headlands + drainage + fracture + secondaryRills + weatheredBenches));
  }
}

const document = {
  candidate: "BW",
  source: "project-authored connected western coast heightfield",
  method: "179 x 77 deterministic landform samples with headlands, hierarchical drainage, fractures, and weathered benches",
  dimensions: { rows: rows + 1, columns: columns + 1 },
  zRangeMeters: [-315, 285],
  sharedRidgeBoundaryX: -310,
  samples,
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(document)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ outputPath, samples: samples.length, bytes: Buffer.byteLength(JSON.stringify(document)) })}\n`);
