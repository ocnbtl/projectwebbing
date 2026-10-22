import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";

// Vercel's disposable checkout only: local experiments and source stay intact.
// This also covers Git deployments, which do not use .vercelignore.
if (process.env.VERCEL !== "1") {
  console.log("Deployment asset pruning skipped outside Vercel.");
} else {
  const publicRoot = path.resolve("public");
  const compileManifests = new Set([
    "world/napali-catchment-v1/route.json",
    "world/napali-catchment-v1/manifest.json",
    "world/napali-catchment-v1/surface.json",
    "world/napali-catchment-v1/streams.json",
    "world/ridge-field-v1/manifest.json",
    "world/foundation-noaa-v1/manifest.json",
    "world/foundation-surface-v2/manifest.json",
  ]);
  let bytes = 0;
  let count = 0;
  async function omit(file) {
    const resolved = path.resolve(file);
    if (!resolved.startsWith(publicRoot + path.sep)) throw new Error("Unsafe asset path");
    const info = await stat(resolved).catch(error => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (!info) return;
    bytes += info.size;
    await unlink(resolved);
    count++;
  }
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true }).catch(error => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    for (const entry of entries) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error("Unexpected symlink in research assets");
      if (entry.isDirectory()) await walk(file);
      // Internal components import these small build-time manifests.
      else if (!compileManifests.has(path.relative(publicRoot, file).split(path.sep).join("/"))) await omit(file);
    }
  }
  await walk(path.join(publicRoot, "world"));
  await omit(path.join(publicRoot, "media", "madagin-mountain-journey-v1.mp4"));
  await omit(path.join(publicRoot, "media", "portraits", "illustrative-clients.png"));
  console.log(`Excluded ${count} research assets (${(bytes / 1024 / 1024).toFixed(1)} MiB) from this deployment.`);
}
