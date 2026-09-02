import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const ridgeVersion = process.env.MADAGIN_RIDGE_VERSION ?? "v112";
const artifactDirectory = `artifacts/ridge-${ridgeVersion}`;
const output = `${artifactDirectory}/evidence-manifest.json`;

async function collectFiles(directory) {
  const result = [];
  for (const entry of await fs.readdir(path.join(root, directory), { withFileTypes: true })) {
    if (entry.name === "chrome-profile" || entry.name === "evidence-manifest.json") continue;
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await collectFiles(relative));
    else result.push(relative);
  }
  return result;
}

const files = [
  ...await collectFiles(`public/world/${ridgeVersion}`),
  ...await collectFiles(artifactDirectory),
].sort();

const records = [];
for (const filename of files) {
  const bytes = await fs.readFile(path.join(root, filename));
  records.push({
    bytes: bytes.length,
    file: filename.replaceAll("\\", "/"),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

await fs.writeFile(
  path.join(root, output),
  `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    scope: `Madagin Ridge real-time ${ridgeVersion} local implementation evidence`,
    schemaVersion: 1,
    files: records,
  }, null, 2)}\n`,
  "utf8",
);
process.stdout.write(`${output}: ${records.length} hashed files\n`);
