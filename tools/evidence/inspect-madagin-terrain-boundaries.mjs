import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  CatmullRomCurve3,
  Mesh,
  PerspectiveCamera,
  Raycaster,
  Triangle,
  Vector2,
  Vector3,
} from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const root = path.resolve(import.meta.dirname, "..", "..");
const sourceArg = process.argv[2] ?? "public/world/v115/madagin-ridge-to-valley-high-v1.15.glb";
const source = path.resolve(root, sourceArg);
const bytes = await readFile(source);

if (typeof globalThis.ProgressEvent === "undefined") {
  globalThis.ProgressEvent = class ProgressEvent {
    constructor(type, init = {}) {
      this.type = type;
      Object.assign(this, init);
    }
  };
}

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const gltf = await new Promise((resolve, reject) => loader.parse(arrayBuffer, `${path.dirname(source)}${path.sep}`, resolve, reject));
gltf.scene.updateMatrixWorld(true);

function worldGeometry(mesh) {
  const geometry = mesh.geometry.clone();
  geometry.applyMatrix4(mesh.matrixWorld);
  if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

function terrainDiagnostics(mesh) {
  const geometry = worldGeometry(mesh);
  const positions = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const indexCount = index?.count ?? positions.count;
  const edges = new Map();
  const triangle = new Triangle();
  const centroid = new Vector3();
  const normal = new Vector3();
  const steepTriangles = [];

  const edgeKey = (a, b) => `${Math.min(a, b)}:${Math.max(a, b)}`;
  const registerEdge = (a, b) => {
    const key = edgeKey(a, b);
    const current = edges.get(key);
    if (current) current.count += 1;
    else edges.set(key, { a, b, count: 1 });
  };

  for (let offset = 0; offset < indexCount; offset += 3) {
    const ia = index ? index.getX(offset) : offset;
    const ib = index ? index.getX(offset + 1) : offset + 1;
    const ic = index ? index.getX(offset + 2) : offset + 2;
    registerEdge(ia, ib);
    registerEdge(ib, ic);
    registerEdge(ic, ia);
    triangle.a.fromBufferAttribute(positions, ia);
    triangle.b.fromBufferAttribute(positions, ib);
    triangle.c.fromBufferAttribute(positions, ic);
    triangle.getNormal(normal);
    const verticality = 1 - Math.abs(normal.y);
    const ySpan = Math.max(triangle.a.y, triangle.b.y, triangle.c.y) - Math.min(triangle.a.y, triangle.b.y, triangle.c.y);
    if (verticality > 0.985 && ySpan > 8) {
      triangle.getMidpoint(centroid);
      steepTriangles.push({
        centroid: [centroid.x, centroid.y, centroid.z].map((value) => Number(value.toFixed(3))),
        normalY: Number(normal.y.toFixed(5)),
        ySpan: Number(ySpan.toFixed(3)),
      });
    }
  }

  const boundaryVertices = new Set();
  let boundaryEdges = 0;
  for (const edge of edges.values()) {
    if (edge.count !== 1) continue;
    boundaryEdges += 1;
    boundaryVertices.add(edge.a);
    boundaryVertices.add(edge.b);
  }
  const boundary = [...boundaryVertices].map((vertex) => {
    const point = new Vector3().fromBufferAttribute(positions, vertex);
    return { vertex, x: point.x, y: point.y, z: point.z };
  });
  const bounds = geometry.boundingBox;
  const tolerance = 0.75;
  const faces = {
    minX: boundary.filter((point) => Math.abs(point.x - bounds.min.x) <= tolerance),
    maxX: boundary.filter((point) => Math.abs(point.x - bounds.max.x) <= tolerance),
    minZ: boundary.filter((point) => Math.abs(point.z - bounds.min.z) <= tolerance),
    maxZ: boundary.filter((point) => Math.abs(point.z - bounds.max.z) <= tolerance),
  };
  const summarize = (points) => ({
    count: points.length,
    x: points.length ? [Math.min(...points.map((point) => point.x)), Math.max(...points.map((point) => point.x))].map((value) => Number(value.toFixed(3))) : null,
    y: points.length ? [Math.min(...points.map((point) => point.y)), Math.max(...points.map((point) => point.y))].map((value) => Number(value.toFixed(3))) : null,
    z: points.length ? [Math.min(...points.map((point) => point.z)), Math.max(...points.map((point) => point.z))].map((value) => Number(value.toFixed(3))) : null,
  });

  const result = {
    name: mesh.name,
    bounds: {
      min: bounds.min.toArray().map((value) => Number(value.toFixed(3))),
      max: bounds.max.toArray().map((value) => Number(value.toFixed(3))),
    },
    vertices: positions.count,
    triangles: indexCount / 3,
    boundaryEdges,
    boundaryVertices: boundary.length,
    boundaryFaces: Object.fromEntries(Object.entries(faces).map(([key, points]) => [key, summarize(points)])),
    steepTriangleCount: steepTriangles.length,
    steepTriangles: steepTriangles
      .sort((left, right) => right.ySpan - left.ySpan)
      .slice(0, 24),
  };
  geometry.dispose();
  return result;
}

const names = ["RIDGE_V115_HIGH", "TROPICAL_VALLEY_V115_HIGH", "ALPINE_VALLEY_V115_HIGH"];
const diagnostics = names.map((name) => {
  const object = gltf.scene.getObjectByName(name);
  if (!(object instanceof Mesh)) throw new Error(`Missing mesh ${name}`);
  return terrainDiagnostics(object);
});

const journeySeconds = Number.parseFloat(process.env.MADAGIN_INSPECT_JOURNEY_SECONDS ?? process.argv[3] ?? "27.5");
const rawProgress = journeySeconds / 54;
const progress = rawProgress * rawProgress * (3 - 2 * rawProgress);
const cameraCurve = new CatmullRomCurve3([
  new Vector3(112, 82, 280),
  new Vector3(88, 166, -126),
  new Vector3(320, 190, -540),
  new Vector3(350, 48, -600),
  new Vector3(-360, 170, -380),
  new Vector3(128, 214, -310),
], false, "centripetal");
const lookCurve = new CatmullRomCurve3([
  new Vector3(10, 48, 128),
  new Vector3(18, -43, -710),
  new Vector3(52, -42, -914),
  new Vector3(315, 42, -660),
  new Vector3(160, -20, -730),
  new Vector3(600, 90, -950),
], false, "centripetal");
const camera = new PerspectiveCamera(42, 1440 / 900, 0.2, 2600);
const cameraPosition = cameraCurve.getPointAt(progress);
const lookAt = lookCurve.getPointAt(progress);
camera.position.copy(cameraPosition);
camera.lookAt(lookAt);
camera.updateMatrixWorld(true);
const raycaster = new Raycaster();
const visibleMeshes = names.map((name) => gltf.scene.getObjectByName(name)).filter((object) => object instanceof Mesh);
const raycastPixels = process.env.MADAGIN_INSPECT_PIXELS
  ? JSON.parse(process.env.MADAGIN_INSPECT_PIXELS)
  : [
      [72, 155],
      [108, 260],
      [140, 390],
      [182, 430],
      [260, 410],
      [420, 280],
    ];
const raycasts = raycastPixels.map(([x, y]) => {
  raycaster.setFromCamera(new Vector2((x / 1440) * 2 - 1, 1 - (y / 900) * 2), camera);
  const hit = raycaster.intersectObjects(visibleMeshes, false)[0];
  return {
    pixel: [x, y],
    object: hit?.object.name ?? null,
    point: hit?.point.toArray().map((value) => Number(value.toFixed(3))) ?? null,
    distance: hit ? Number(hit.distance.toFixed(3)) : null,
    faceNormal: hit?.face?.normal.toArray().map((value) => Number(value.toFixed(5))) ?? null,
  };
});

process.stdout.write(`${JSON.stringify({
  source: source.replaceAll("\\", "/"),
  diagnostics,
  exactLakeApproachRaycasts: {
    journeySeconds,
    rawProgress: Number(rawProgress.toFixed(6)),
    easedProgress: Number(progress.toFixed(6)),
    camera: cameraPosition.toArray().map((value) => Number(value.toFixed(3))),
    lookAt: lookAt.toArray().map((value) => Number(value.toFixed(3))),
    raycasts,
  },
}, null, 2)}\n`);
