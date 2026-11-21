// Test de humo de la interfaz: DOM simulado + datos sintéticos (NO sustituye a mirar la página en un navegador).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { waveform } from '../docs/js/physics.js';
import { whitenBand } from '../docs/js/dsp.js';
import { placeTemplate } from '../docs/js/lab.js';

const rd = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const ref = rd('./fixtures/lal_reference.json'), finalState = rd('../docs/data/final_state.json');
let s = 5; const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32, g = () => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
const F = Array.from({ length: 220 }, (_, i) => 20 * Math.pow(100, i / 219)), A = F.map((f) => 1e-23 * Math.sqrt((30 / f) ** 8 + 1 + (f / 800) ** 2));
const wf = waveform({ m1: 36, m2: 29, fs: 4096, finalTable: ref.final, tail: 0.08 }), w = whitenBand(placeTemplate(wf, -0.7, 4096, 4096), 4096, F, A);
let n2 = 0; for (const v of w) n2 += v * v;
const det = {}; [['H1', 0, 1], ['L1', 28, -1]].forEach(([n, sh, sg]) => {
  det[n] = { t0: -0.7, whitened: Array.from({ length: 4096 }, (_, i) => g() + (i - sh >= 0 ? (sg * 9 / Math.sqrt(n2)) * w[i - sh] : 0)), asd_f: F, asd: A };
});
const synthetic = { event: 'GW150914', fs: 4096, band_hz: [35, 350], window_s: [-0.7, 0.3], source: 'sintético', meta: { dist_mpc: 410 }, detectors: det };

test('app.js carga, analiza y dibuja sin excepciones', async () => {
  const els = {}, noop = new Proxy(function () {}, {
    get: (t, k) => (k === 'createImageData' ? (a, b) => ({ data: new Uint8ClampedArray(a * b * 4) }) : noop), apply: () => noop, set: () => true });
  const mk = (id) => ({ id, value: { m1: '36', m2: '29', det: 'H1', speed: '1' }[id] ?? '', textContent: '', innerHTML: '', clientWidth: 700, clientHeight: 300,
    addEventListener() {}, getContext: () => noop });
  Object.assign(globalThis, { document: { getElementById: (id) => (els[id] ||= mk(id)), createElement: () => mk('off') },
    devicePixelRatio: 2, addEventListener() {}, requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    fetch: async (u) => ({ ok: true, json: async () => (u.includes('final_state') ? finalState : synthetic) }) });
  globalThis.window = globalThis;
  await import('../docs/js/app.js');
  await new Promise((ok) => setTimeout(ok, 1500));
  assert.match(els.status.textContent, /cargados/);
  assert.match(els.out.innerHTML, /Retardo L1−H1<\/dt><dd>6\.\d ms/);
  assert.match(els.out.innerHTML, /\+ \/ −/);
  els['b-pub'].onclick();
});
