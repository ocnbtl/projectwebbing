import * as THREE from "three";

export type LiquidRenderer = { dispose: () => void; setPaused: (paused: boolean) => void };

// Shallow optical glass samples the actual Balsa canvas in screen coordinates.
// No second approximation of the water, shadow planes, or reflected silhouettes.
export async function createLiquidRenderer(host: HTMLElement, onHover: (index: number | null) => void, signal: AbortSignal): Promise<LiquidRenderer> {
  type Glyphs = Record<string, { offset: number; vertices: number; indicesOffset: number; count: number; width: number; scale: number }>;
  const [manifestResponse, geometryResponse] = await Promise.all([
    fetch("/media/liquid/letters.json", { signal }), fetch("/media/liquid/letters.bin", { signal }),
  ]);
  if (!manifestResponse.ok || !geometryResponse.ok) throw new Error("Letter shapes unavailable");
  const { glyphs } = await manifestResponse.json() as { glyphs: Glyphs };
  const buffer = await geometryResponse.arrayBuffer();
  signal.throwIfAborted();
  const waterCanvas = document.querySelector<HTMLCanvasElement>("[data-water-canvas]");
  if (!waterCanvas) throw new Error("Water surface unavailable");
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.35));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute("aria-hidden", "true");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  function waterTexture() {
    const value = new THREE.CanvasTexture(waterCanvas!);
    value.colorSpace = THREE.NoColorSpace;
    value.minFilter = THREE.LinearFilter; value.magFilter = THREE.LinearFilter; value.generateMipmaps = false;
    return value;
  }
  let texture = waterTexture();
  let textureWidth = waterCanvas.width, textureHeight = waterCanvas.height;
  const shared = {
    uWater: { value: texture }, uTime: { value: 0 },
    uViewport: { value: new THREE.Vector2(innerWidth, innerHeight) },
    uOrigin: { value: new THREE.Vector2() }, uHeight: { value: 1 },
    uDpr: { value: renderer.getPixelRatio() },
    uEdgeBoost: { value: innerWidth <= 800 ? 2.45 : 1.12 },
  };
  const base = new THREE.ShaderMaterial({
    uniforms: { ...shared, uEmerge: { value: 0 }, uRipple: { value: new THREE.Vector2() }, uHover: { value: 0 } }, transparent: true, toneMapped: false,
    vertexShader: `varying vec3 vNormal; varying vec3 vView; varying vec3 vPosition;
      void main(){vec4 p=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=normalize(-p.xyz);vPosition=position;gl_Position=projectionMatrix*p;}`,
    fragmentShader: `uniform sampler2D uWater;uniform vec2 uViewport;uniform vec2 uOrigin;uniform float uHeight;uniform float uDpr;uniform float uTime;uniform float uEmerge;uniform float uEdgeBoost;uniform vec2 uRipple;uniform float uHover;
      varying vec3 vNormal;varying vec3 vView;varying vec3 vPosition;
      void main(){
        vec3 n=normalize(vNormal);vec3 eye=normalize(vView);
        float edge=pow(1.-abs(dot(n,eye)),2.1);
        vec2 screen=vec2(gl_FragCoord.x/uDpr+uOrigin.x,uViewport.y-uOrigin.y-uHeight+gl_FragCoord.y/uDpr)/uViewport;
        float wave=sin(vPosition.x*3.2+uTime*.6)*sin(vPosition.y*4.1-uTime*.4);
        vec2 bend=n.xy*(.014+edge*.029)+(1.-uEmerge)*vec2(sin(vPosition.y*8.+uTime),wave)*.012;
        vec2 uv=clamp(screen+bend,vec2(.002),vec2(.998));
        vec3 behind=texture2D(uWater,uv).rgb;
        float split=.0013*edge;
        behind.r=texture2D(uWater,uv+vec2(split,0.)).r;
        behind.b=texture2D(uWater,uv-vec2(split,0.)).b;
        vec3 light=normalize(vec3(-.45,.85,1.));
        float reflected=pow(max(dot(reflect(-light,n),eye),0.),42.);
        float rim=pow(edge,.65)*(.22+.56*max(dot(n,light),0.));
        vec3 color=behind*.94+vec3(.075,.105,.13)*(.15+edge*.22);
        color+=vec3(.76,.89,1.)*(rim*uEdgeBoost+reflected*.68+edge*.055*uEdgeBoost)*uEmerge;
        color+=vec3(.3,.42,.55)*max(0.,uEdgeBoost-1.2)*.06*uEmerge;
        float dist=length((vPosition.xy-uRipple)*vec2(1.,1.5));
        float ripple=(.5+.5*sin(dist*22.-uTime*5.))*exp(-dist*1.6)*uHover;
        vec3 ink=.52+.38*cos(vec3(0.,2.1,4.2)+uTime*.26+dist*3.2+wave);
        color=mix(color,ink,ripple*.72);
        float alpha=smoothstep(0.,.8,uEmerge)*(.89+edge*.11);
        gl_FragColor=vec4(color,alpha);
      }`,
  });
  const meshes: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[] = [];
  const positions: number[] = [];
  let advance = 0;
  for (const letter of "MADAGIN") {
    const glyph = glyphs[letter];
    const packed = new Int16Array(buffer, glyph.offset, glyph.vertices * 6);
    const vertices = new Float32Array(glyph.vertices * 3), normals = new Float32Array(glyph.vertices * 3);
    for (let i = 0; i < glyph.vertices; i++) for (let c = 0; c < 3; c++) {
      vertices[i * 3 + c] = packed[i * 6 + c] / 32767 * glyph.scale;
      normals[i * 3 + c] = packed[i * 6 + c + 3] / 32767;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3)); geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(buffer, glyph.indicesOffset, glyph.count), 1));
    const material = base.clone(); Object.assign(material.uniforms, shared);
    const mesh = new THREE.Mesh(geometry, material); mesh.scale.set(1, 1.85, .16);
    positions.push(advance + glyph.width / 2); meshes.push(mesh); scene.add(mesh);
    // Optical pairs: diagonals nest more closely; I needs breathing room.
    const gaps = [.23, .18, .20, .15, .31, .32, 0];
    advance += glyph.width + gaps[meshes.length - 1];
  }
  base.dispose();
  const wordWidth = advance;
  positions.forEach((x, i) => { meshes[i].position.x = x - wordWidth / 2; });
  const pointer = new THREE.Vector2(-4, -4), raycaster = new THREE.Raycaster();
  let hovering: number | null = null;
  let visible = true, paused = false, disposed = false;
  let frame = 0, elapsed = 0, previous = performance.now(), lastDraw = 0, sampledFrame = "";
  function updateOrigin() {
    const bounds = host.getBoundingClientRect(); shared.uOrigin.value.set(bounds.left, bounds.top);
    shared.uHeight.value = bounds.height; shared.uViewport.value.set(innerWidth, innerHeight);
    shared.uEdgeBoost.value = innerWidth <= 800 ? 2.45 : 1.12;
  }
  function syncWaterTexture() {
    if (waterCanvas!.width !== textureWidth || waterCanvas!.height !== textureHeight) {
      texture.dispose(); texture = waterTexture(); shared.uWater.value = texture;
      textureWidth = waterCanvas!.width; textureHeight = waterCanvas!.height;
    }
    if (waterCanvas!.dataset.frame !== sampledFrame) { texture.needsUpdate = true; sampledFrame = waterCanvas!.dataset.frame || ""; }
  }
  function resize() {
    const width = host.clientWidth, height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height); camera.aspect = width / height;
    const distance = wordWidth / (2 * Math.tan(THREE.MathUtils.degToRad(14)) * camera.aspect) * 1.035;
    camera.position.set(0, .7, Math.max(7, distance)); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
    updateOrigin(); syncWaterTexture(); renderer.render(scene, camera);
  }
  function point(event: PointerEvent) {
    if (event.pointerType === "touch") return;
    const b = host.getBoundingClientRect(); pointer.set((event.clientX - b.left) / b.width * 2 - 1, -(event.clientY - b.top) / b.height * 2 + 1);
  }
  function leave() { pointer.set(-4, -4); hovering = null; onHover(null); }
  function pose(still = false) {
    meshes.forEach((mesh, i) => {
      const t = Math.max(0, elapsed - i * .045);
      const emerge = still ? 1 : THREE.MathUtils.smoothstep(t, 0, 1.6);
      mesh.material.uniforms.uEmerge.value = emerge;
      mesh.position.y = (1 - emerge) * -.48 + (still ? 0 : Math.sin(elapsed * .48 + i * .6) * .022);
      mesh.rotation.x = -.045 - (1 - emerge) * .09; mesh.rotation.y = still ? 0 : Math.sin(elapsed * .27 + i) * .006;
    });
  }
  function draw() {
    // WebGL textures must be reallocated after the source canvas changes size.
    syncWaterTexture();
    updateOrigin(); shared.uTime.value = elapsed; pose(paused);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(meshes)[0];
    const next = hit ? meshes.indexOf(hit.object as typeof meshes[number]) : null;
    if (next !== hovering) { hovering = next; onHover(next); }
    meshes.forEach((mesh, i) => {
      mesh.material.uniforms.uHover.value += ((i === next ? 1 : 0) - mesh.material.uniforms.uHover.value) * .075;
      if (hit && i === next) {
        const local = mesh.worldToLocal(hit.point.clone());
        mesh.material.uniforms.uRipple.value.lerp(new THREE.Vector2(local.x, local.y), .23);
      }
    });
    renderer.render(scene, camera); host.dataset.frames = String(Number(host.dataset.frames || 0) + 1);
  }
  function loop(now: number) {
    frame = 0; if (disposed || paused || !visible || document.hidden) return;
    frame = requestAnimationFrame(loop);
    if (now-lastDraw < 1000/60) return;
    lastDraw=now;
    elapsed += Math.min((now - previous) / 1000, .1); previous = now; draw();
  }
  function wake() { previous = performance.now(); if (!frame && !paused && visible && !document.hidden && !disposed) frame = requestAnimationFrame(loop); }
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; wake(); }, { rootMargin: "40px" });
  const resizer = new ResizeObserver(resize);
  host.append(renderer.domElement); pose(); resize(); host.dataset.ready = "true";
  observer.observe(host); resizer.observe(host);
  host.addEventListener("pointermove", point); host.addEventListener("pointerleave", leave);
  window.addEventListener("scroll", leave, { passive: true }); document.addEventListener("visibilitychange", wake); wake();
  return {
    setPaused(value) { paused = value; if (value) { cancelAnimationFrame(frame); frame = 0; draw(); leave(); } else wake(); },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); resizer.disconnect();
      host.removeEventListener("pointermove", point); host.removeEventListener("pointerleave", leave);
      window.removeEventListener("scroll", leave); document.removeEventListener("visibilitychange", wake);
      meshes.forEach(mesh => { mesh.geometry.dispose(); mesh.material.dispose(); }); texture.dispose();
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); delete host.dataset.ready;
    },
  };
}
