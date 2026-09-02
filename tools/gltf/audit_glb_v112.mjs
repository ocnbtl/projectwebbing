import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function duplicateGroups(values, identity) {
  const groups = new Map();
  values.forEach((value, index) => {
    const key = identity(value, index);
    const group = groups.get(key) ?? [];
    group.push(index);
    groups.set(key, group);
  });
  return [...groups.entries()]
    .filter(([, indices]) => indices.length > 1)
    .map(([key, indices]) => ({ key, indices }))
    .sort((a, b) => b.indices.length - a.indices.length);
}

async function auditGlb(filename) {
  const bytes = await readFile(filename);
  if (bytes.toString("ascii", 0, 4) !== "glTF") throw new Error(`${filename} is not a binary glTF file`);
  if (bytes.readUInt32LE(4) !== 2) throw new Error(`${filename} is not glTF 2.0`);

  let offset = 12;
  let json;
  let bin = Buffer.alloc(0);
  const chunks = [];
  while (offset < bytes.length) {
    const byteLength = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const data = bytes.subarray(offset + 8, offset + 8 + byteLength);
    chunks.push({ type: `0x${type.toString(16)}`, byteLength });
    if (type === JSON_CHUNK) json = JSON.parse(data.toString("utf8").trimEnd());
    if (type === BIN_CHUNK) bin = data;
    offset += 8 + byteLength;
  }
  if (!json) throw new Error(`${filename} has no JSON chunk`);

  const bufferViews = json.bufferViews ?? [];
  const accessors = json.accessors ?? [];
  const materials = json.materials ?? [];
  const images = json.images ?? [];
  const textures = json.textures ?? [];
  const meshes = json.meshes ?? [];

  const viewHashes = bufferViews.map((view) => {
    const start = view.byteOffset ?? 0;
    const end = start + view.byteLength;
    return sha256(bin.subarray(start, end));
  });
  const duplicateBufferViews = duplicateGroups(bufferViews, (_, index) => `${viewHashes[index]}:${bufferViews[index].byteLength}`);

  const accessorHashes = accessors.map((accessor) => {
    if (accessor.bufferView == null) return sha256(canonical(accessor));
    const view = bufferViews[accessor.bufferView];
    const viewStart = view.byteOffset ?? 0;
    const descriptor = {
      componentType: accessor.componentType,
      count: accessor.count,
      type: accessor.type,
      normalized: accessor.normalized ?? false,
      byteOffset: accessor.byteOffset ?? 0,
      byteStride: view.byteStride ?? null,
      sparse: accessor.sparse ?? null,
    };
    return sha256(`${viewHashes[accessor.bufferView]}:${canonical(descriptor)}`);
  });
  const duplicateAccessors = duplicateGroups(accessors, (_, index) => accessorHashes[index]);

  const materialHashes = materials.map((material) => {
    const copy = structuredClone(material);
    delete copy.name;
    return sha256(canonical(copy));
  });
  const duplicateMaterials = duplicateGroups(materials, (_, index) => materialHashes[index]);

  const imageRecords = images.map((image, index) => ({
    index,
    name: image.name ?? null,
    mimeType: image.mimeType ?? null,
    uri: image.uri ?? null,
    bufferView: image.bufferView ?? null,
    embeddedBytes: image.bufferView == null ? null : bufferViews[image.bufferView]?.byteLength ?? null,
    sha256: image.bufferView == null ? null : viewHashes[image.bufferView],
  }));
  const duplicateImages = duplicateGroups(imageRecords, (image) => image.sha256 ?? `${image.uri}:${image.mimeType}`);

  const primitives = meshes.flatMap((mesh, meshIndex) => (mesh.primitives ?? []).map((primitive, primitiveIndex) => ({
    meshIndex,
    meshName: mesh.name ?? null,
    primitiveIndex,
    material: primitive.material ?? null,
    mode: primitive.mode ?? 4,
    attributes: primitive.attributes ?? {},
    indices: primitive.indices ?? null,
    targets: primitive.targets ?? null,
  })));
  const primitiveHashes = primitives.map((primitive) => sha256(canonical({
    mode: primitive.mode,
    materialHash: primitive.material == null ? null : materialHashes[primitive.material],
    attributes: Object.fromEntries(Object.entries(primitive.attributes).map(([semantic, accessor]) => [semantic, accessorHashes[accessor]])),
    indices: primitive.indices == null ? null : accessorHashes[primitive.indices],
    targets: primitive.targets,
  })));
  const duplicatePrimitives = duplicateGroups(primitives, (_, index) => primitiveHashes[index]);

  const totalEmbeddedImageBytes = imageRecords.reduce((sum, image) => sum + (image.embeddedBytes ?? 0), 0);
  const duplicateBufferBytes = duplicateBufferViews.reduce((sum, group) => {
    const view = bufferViews[group.indices[0]];
    return sum + view.byteLength * (group.indices.length - 1);
  }, 0);
  const duplicateImageBytes = duplicateImages.reduce((sum, group) => {
    const image = imageRecords[group.indices[0]];
    return sum + (image.embeddedBytes ?? 0) * (group.indices.length - 1);
  }, 0);

  return {
    file: path.resolve(filename).replaceAll("\\", "/"),
    bytes: bytes.length,
    sha256: sha256(bytes),
    asset: json.asset ?? null,
    extensionsUsed: json.extensionsUsed ?? [],
    extensionsRequired: json.extensionsRequired ?? [],
    counts: {
      scenes: json.scenes?.length ?? 0,
      nodes: json.nodes?.length ?? 0,
      meshes: meshes.length,
      primitives: primitives.length,
      accessors: accessors.length,
      bufferViews: bufferViews.length,
      materials: materials.length,
      textures: textures.length,
      images: images.length,
      samplers: json.samplers?.length ?? 0,
    },
    bytesByRole: {
      binaryChunk: bin.length,
      embeddedImages: totalEmbeddedImageBytes,
      nonImageBinaryApproximation: Math.max(0, bin.length - totalEmbeddedImageBytes),
    },
    duplication: {
      duplicateBufferViewGroups: duplicateBufferViews,
      duplicateBufferBytes,
      duplicateAccessorGroups: duplicateAccessors,
      duplicateMaterialGroups: duplicateMaterials,
      duplicateImageGroups: duplicateImages,
      duplicateImageBytes,
      duplicatePrimitiveGroups: duplicatePrimitives,
    },
    images: imageRecords,
    meshes: meshes.map((mesh, index) => ({
      index,
      name: mesh.name ?? null,
      primitiveCount: mesh.primitives?.length ?? 0,
    })),
    materials: materials.map((material, index) => ({ index, name: material.name ?? null, hash: materialHashes[index] })),
  };
}

const outputArgument = process.argv.slice(2).find((argument) => argument.startsWith("--output="));
const outputFilename = outputArgument?.slice("--output=".length);
const filenames = process.argv.slice(2).filter((argument) => !argument.startsWith("--output="));
if (filenames.length === 0) {
  console.error("Usage: node tools/gltf/audit_glb_v112.mjs <file.glb> [...]");
  process.exitCode = 1;
} else {
  const reports = [];
  for (const filename of filenames) reports.push(await auditGlb(filename));
  const output = `${JSON.stringify({ schemaVersion: 1, reports }, null, 2)}\n`;
  if (outputFilename) await writeFile(outputFilename, output, "utf8");
  else process.stdout.write(output);
}
