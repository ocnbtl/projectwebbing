import * as THREE from "three";

export type LiquidRenderer = { dispose: () => void; setPaused: (paused: boolean) => void };

// A bounded material study. No navigation or content depends on this renderer.
export async function createLiquidRenderer(host: HTMLElement, onHover: (index: number | null) => void, signal: AbortSignal): Promise<LiquidRenderer> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
  type Glyphs = Record<string, { offset: number; vertices: number; indicesOffset: number; count: number; width: number; scale: number }>;
  let glyphs: Glyphs;
  let buffer: ArrayBuffer;
  try {
    const [manifestResponse, geometryResponse] = await Promise.all([
      fetch("/media/liquid/letters.json", { signal }), fetch("/media/liquid/letters.bin", { signal }),
    ]);
    if (!manifestResponse.ok || !geometryResponse.ok) throw new Error("Letter shapes unavailable");
    ({ glyphs } = await manifestResponse.json() as { glyphs: Glyphs });
    buffer = await geometryResponse.arrayBuffer();
    signal.throwIfAborted();
  } catch (error) { renderer.dispose(); renderer.forceContextLoss(); throw error; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0xf8f9f8);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute("aria-hidden", "true");
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf8f9f8);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  const pmrem = new THREE.PMREMGenerator(renderer);
  // A studio light field gives transparent white objects legible reflected edges.
  const lightField = document.createElement("canvas");
  lightField.width = 1024; lightField.height = 512;
  const paint = lightField.getContext("2d")!;
  const gradient = paint.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, "#ffffff"); gradient.addColorStop(0.42, "#edf2ed");
  gradient.addColorStop(0.5, "#74887c"); gradient.addColorStop(0.57, "#f9fcf9");
  gradient.addColorStop(1, "#cad5cd");
  paint.fillStyle = gradient; paint.fillRect(0, 0, 1024, 512);
  paint.fillStyle = "#273a30"; paint.fillRect(100, 30, 100, 370); paint.fillRect(650, 100, 60, 270);
  paint.fillStyle = "#ffffff"; paint.fillRect(225, 60, 45, 390); paint.fillRect(750, 30, 150, 260);
  const lightTexture = new THREE.CanvasTexture(lightField);
  lightTexture.mapping = THREE.EquirectangularReflectionMapping;
  lightTexture.colorSpace = THREE.SRGBColorSpace;
  const environment = pmrem.fromEquirectangular(lightTexture);
  scene.environment = environment.texture;
  scene.environmentRotation.set(0.15, 0.65, 0.12);
  lightTexture.dispose();
  pmrem.dispose();

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0.12, roughness: 0.055, transmission: 0.82,
    thickness: 2.3, ior: 2.2, clearcoat: 1, clearcoatRoughness: 0.025,
    attenuationColor: new THREE.Color(0xe5eee8), attenuationDistance: 5,
    envMapIntensity: 2.2,
  });
  const fill = new THREE.DirectionalLight(0xffffff, 2);
  fill.position.set(-4, 8, 9);
  scene.add(fill, new THREE.AmbientLight(0xffffff, 0.5));

  const meshes: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>[] = [];
  const positions: number[] = [];
  let advance = 0;
  for (const letter of "MADAGIN") {
    const glyph = glyphs[letter];
    const packed = new Int16Array(buffer, glyph.offset, glyph.vertices * 6);
    const positionsArray = new Float32Array(glyph.vertices * 3);
    const normals = new Float32Array(glyph.vertices * 3);
    for (let i = 0; i < glyph.vertices; i++) for (let c = 0; c < 3; c++) {
      positionsArray[i * 3 + c] = packed[i * 6 + c] / 32767 * glyph.scale;
      normals[i * 3 + c] = packed[i * 6 + c + 3] / 32767;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positionsArray, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(buffer, glyph.indicesOffset, glyph.count), 1));
    const width = glyph.width;
    const mesh = new THREE.Mesh(geometry, glass);
    positions.push(advance + width / 2);
    meshes.push(mesh);
    scene.add(mesh);
    advance += width + 0.7;
  }
  const wordWidth = advance - 0.7;
  positions.forEach((x, index) => { meshes[index].position.x = x - wordWidth / 2; });

  const uniforms = {
    uTime: { value: 0 }, uPointer: { value: new THREE.Vector2(-50, -50) },
    uTouch: { value: -20 }, uLetters: { value: positions.map(x => x - wordWidth / 2) },
  };
  const water = new THREE.ShaderMaterial({
    uniforms, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `
      varying vec2 vUv; uniform float uTime; uniform vec2 uPointer; uniform float uTouch; uniform float uLetters[7];
      void main(){
        vec2 p=(vUv-.5)*vec2(48.,20.);
        float d=length((p-uPointer)*vec2(1.,1.7));
        float age=max(0.,uTime-uTouch);
        float ripple=sin(d*7.-age*5.)*exp(-abs(d-age*1.8)*1.8)*exp(-age*.5);
        float wave=sin(p.x*1.2+p.y*3.+uTime*.42)*sin(p.x*.55-p.y*2.7-uTime*.3);
        float rings=0.;
        for(int i=0;i<7;i++){
          vec2 q=(p-vec2(uLetters[i],-1.6))*vec2(.9,4.8);
          float r=length(q);
          float arrival=max(0.,uTime-float(i)*.13-.45);
          float drift=sin(r*8.-uTime*1.3+float(i)*.6);
          float arrive=sin(r*8.-arrival*5.)*exp(-abs(r-arrival*1.8)*1.4)*exp(-arrival*.7);
          rings+=(drift*.019+arrive*.045)*exp(-r*.65);
        }
        float caustic=sin(p.x*.7+p.y*1.3+wave*.12)*sin(p.y*1.7-p.x*.6);
        float pool=exp(-pow(p.y+1.6,2.)*3.)*exp(-pow(p.x*.095,4.));
        float tone=.94+caustic*.035*pool+rings+ripple*.025;
        vec3 color=vec3(tone-.001,tone+.007,tone-.001);
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    toneMapped: false,
  });
  const waterGeometry = new THREE.PlaneGeometry(48, 20);
  const waterPlane = new THREE.Mesh(waterGeometry, water);
  waterPlane.position.z = -0.65;
  scene.add(waterPlane);

  const reflectionMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime }, transparent: true, depthWrite: false,
    vertexShader: `varying float fade;uniform float uTime;void main(){vec3 p=position;p.x+=sin(p.y*20.+uTime)*.018;fade=1.-smoothstep(-1.3,1.1,p.y);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader: `varying float fade;void main(){gl_FragColor=vec4(.46,.54,.48,fade*.13);}`,
  });
  const reflections = meshes.map(mesh => {
    const reflection = new THREE.Mesh(mesh.geometry, reflectionMaterial);
    reflection.position.set(mesh.position.x, -1.9, -0.48);
    reflection.scale.set(1, -0.28, 1);
    scene.add(reflection);
    return reflection;
  });

  // Soft contact shadows anchor the letters without a shadow-map render pass.
  const shadowGeometry = new THREE.PlaneGeometry(1, 1);
  const shadowMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 vUv;void main(){vec2 p=(vUv-.5)*2.;float a=exp(-dot(p,p)*5.)*.22;gl_FragColor=vec4(.3,.36,.33,a);}`,
  });
  const shadows = meshes.map((mesh) => {
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.position.set(mesh.position.x, -1.6, -0.5);
    shadow.scale.set(3.3, 0.9, 1);
    scene.add(shadow);
    return shadow;
  });
  const pointer = new THREE.Vector2(-4, -4);
  const raycaster = new THREE.Raycaster();
  let hovering: number | null = null;
  let visible = true;
  let paused = false;
  let disposed = false;
  let frame = 0;
  let elapsed = 0;
  let previous = performance.now();
  let lastRender = 0;
  let lastRipple = -10;

  function resize() {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    const distance = wordWidth / (2 * Math.tan(THREE.MathUtils.degToRad(14)) * camera.aspect) * 1.12;
    camera.position.set(0, 1.3, Math.max(7, distance));
    camera.lookAt(0, -0.12, 0);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  function point(event: PointerEvent) {
    if (event.pointerType === "touch") return;
    const box = host.getBoundingClientRect();
    pointer.set((event.clientX - box.left) / box.width * 2 - 1, -(event.clientY - box.top) / box.height * 2 + 1);
    if (elapsed - lastRipple > 0.3 && !paused) {
      raycaster.setFromCamera(pointer, camera);
      const point = raycaster.intersectObject(waterPlane)[0]?.point;
      if (point) { uniforms.uPointer.value.set(point.x, point.y); uniforms.uTouch.value = elapsed; lastRipple = elapsed; }
    }
  }
  function leave() { pointer.set(-4, -4); hovering = null; onHover(null); }
  function loop(now: number) {
    frame = 0;
    if (disposed || paused || !visible || document.hidden) return;
    frame = requestAnimationFrame(loop);
    if (now - lastRender < 1000 / 45) return;
    elapsed += Math.min((now - previous) / 1000, 0.07);
    previous = now;
    lastRender = now;
    uniforms.uTime.value = elapsed;
    meshes.forEach((mesh, index) => {
      const t = Math.max(0, elapsed - index * 0.13);
      const entrance = 1 - Math.exp(-t * 4.8);
      mesh.scale.setScalar(Math.max(0.001, entrance));
      mesh.position.y = (1 - entrance) * 2.1 + Math.sin(t * 4.2) * Math.exp(-t * 2.4) * 0.13 + Math.sin(elapsed * 0.68 + index * 0.48) * 0.038;
      mesh.rotation.x = (1 - entrance) * -0.45 + Math.sin(elapsed * 0.47 + index) * 0.012;
      mesh.rotation.y = Math.sin(elapsed * 0.37 + index * 0.8) * 0.026;
      shadows[index].scale.set(3.3 * entrance, 0.7 + entrance * 0.2, 1);
      reflections[index].visible = entrance > 0.9;
    });
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(meshes)[0];
    const next = hit ? meshes.indexOf(hit.object as typeof meshes[number]) : null;
    if (next !== hovering) { hovering = next; onHover(next); }
    renderer.render(scene, camera);
    host.dataset.frames = String(Number(host.dataset.frames || 0) + 1);
  }
  function wake() {
    previous = performance.now();
    if (!frame && !paused && visible && !document.hidden && !disposed) frame = requestAnimationFrame(loop);
  }
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; wake(); }, { rootMargin: "40px" });
  const resizer = new ResizeObserver(resize);
  host.append(renderer.domElement);
  resize();
  // Show a complete first render before removing the semantic fallback.
  meshes.forEach((mesh) => mesh.scale.setScalar(0.001));
  renderer.render(scene, camera);
  host.dataset.ready = "true";
  observer.observe(host);
  resizer.observe(host);
  host.addEventListener("pointermove", point);
  host.addEventListener("pointerleave", leave);
  window.addEventListener("scroll", leave, { passive: true });
  document.addEventListener("visibilitychange", wake);
  wake();
  return {
    setPaused(value) {
      paused = value;
      if (value) {
        cancelAnimationFrame(frame); frame = 0;
        elapsed = Math.max(elapsed, 3);
        meshes.forEach((mesh) => { mesh.scale.setScalar(1); mesh.position.y = 0; mesh.rotation.set(0, 0, 0); });
        renderer.render(scene, camera);
        leave();
      } else wake();
    },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); resizer.disconnect();
      host.removeEventListener("pointermove", point); host.removeEventListener("pointerleave", leave);
      window.removeEventListener("scroll", leave);
      document.removeEventListener("visibilitychange", wake);
      meshes.forEach(mesh => mesh.geometry.dispose());
      glass.dispose(); water.dispose(); waterGeometry.dispose(); shadowMaterial.dispose(); shadowGeometry.dispose(); reflectionMaterial.dispose();
      environment.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
      delete host.dataset.ready;
    },
  };
}
