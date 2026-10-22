const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');

// Run the actual component's effect with browser frame timing and Canvas2D's
// specified behavior: assigning an out-of-range globalAlpha keeps its old value.
async function mount({ playing = true } = {}) {
  const effects = [], refs = [], frames = new Map(), draws = [];
  let frameId = 0, settled = 0, alpha = 1;
  const destination = {
    clearRect() { draws.length = 0; },
    drawImage() { draws.push(alpha); },
    get globalAlpha() { return alpha; },
    set globalAlpha(value) { if (value >= 0 && value <= 1) alpha = value; },
  };
  const context = { scale() {}, fillText() {}, drawImage() {}, measureText: () => ({ fontBoundingBoxDescent: 3 }) };
  const rect = { left: 20, top: 20, bottom: 40, width: 350, height: 50 };
  const text = { style: {}, getBoundingClientRect: () => rect, querySelector: () => text };
  const canvas = { style: {}, dataset: {}, getContext: () => destination };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync('src/components/public/intro-water-reveal.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, {
    exports: module.exports,
    require(name) {
      if (name === 'react') return {
        useRef(value) { const ref = { current: value }; refs.push(ref); return ref; },
        useLayoutEffect(effect) { effects.push(effect); },
      };
      if (name === './water-surface') return { useWaterMotion: () => ({ playing }) };
      if (name === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null };
      throw new Error(name);
    },
    performance: { now: () => 200 }, devicePixelRatio: 1, innerWidth: 390, innerHeight: 844,
    requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
    getComputedStyle: () => ({ fontWeight: '400', fontSize: '15px', fontFamily: 'Arial', color: 'white', letterSpacing: 'normal' }),
    NodeFilter: { SHOW_TEXT: 4 },
    ResizeObserver: class { observe() {} disconnect() {} },
    CustomEvent: class {}, window: { dispatchEvent() {} },
    document: {
      hidden: false, fonts: { ready: Promise.resolve() },
      createElement: () => ({ getContext: () => context }),
      createTreeWalker() { let read = false; return { nextNode() { if (read) return null; read = true; return { textContent: 'Our aim' }; } }; },
      createRange: () => ({ setStart() {}, setEnd() {}, getBoundingClientRect: () => rect }),
    },
  });
  module.exports.IntroWaterReveal({ visible: true, children: null, onSettling() { settled++; } });
  refs[0].current = text; refs[1].current = canvas;
  const cleanups = effects.map(effect => effect());
  await Promise.resolve();
  return {
    text, canvas, draws, settled: () => settled,
    tick(now) { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(now)); },
    cleanup() { cleanups.forEach(cleanup => cleanup?.()); },
  };
}

test('a frame timestamp before setup cannot flash a fully opaque paragraph', async () => {
  const reveal = await mount();
  reveal.tick(194); // rAF timestamp can precede performance.now() in setup.
  assert.equal(reveal.text.style.opacity, '0');
  assert.ok(reveal.draws.every(alpha => alpha === 0), 'first canvas frame must be transparent');
  reveal.tick(210);
  assert.ok(reveal.draws.every(alpha => alpha >= 0 && alpha < 0.01));
  reveal.tick(2100);
  assert.equal(reveal.canvas.dataset.state, 'settled');
  assert.equal(reveal.text.style.opacity, '1');
  assert.equal(reveal.canvas.style.opacity, '0');
  assert.equal(reveal.settled(), 1);
  reveal.cleanup();
});

test('reduced motion presents readable text without a canvas reveal', async () => {
  const reveal = await mount({ playing: false });
  assert.equal(reveal.canvas.dataset.state, 'settled');
  assert.equal(reveal.text.style.opacity, '1');
  assert.equal(reveal.settled(), 1);
  assert.equal(reveal.draws.length, 0);
  reveal.cleanup();
});

test('a delayed first frame still starts transparent and completes one handoff', async () => {
  const reveal = await mount();
  reveal.tick(2000); // Main-thread work delayed the first browser frame.
  assert.ok(reveal.draws.every(alpha => alpha === 0));
  let previous = 0;
  for (let now = 2016; now <= 3920; now += 16) {
    reveal.tick(now);
    const opacity = Number(reveal.text.style.opacity);
    assert.ok(opacity >= previous, 'DOM handoff must not reverse');
    assert.ok(reveal.draws.every(alpha => alpha >= 0 && alpha <= 1));
    previous = opacity;
  }
  assert.equal(reveal.canvas.dataset.state, 'settled');
  assert.equal(reveal.settled(), 1);
  reveal.cleanup();
});
