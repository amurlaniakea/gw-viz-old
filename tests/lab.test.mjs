// Tests de dsp.js y lab.js con datos sintéticos de semilla fija (sin red). node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fft, asdAt, whitenBand, matchFilter, spectrogram, inferno } from '../docs/js/dsp.js';
import { analyze, optimize, placeTemplate } from '../docs/js/lab.js';
import { waveform, massParams } from '../docs/js/physics.js';
const ref = JSON.parse(readFileSync(new URL('./fixtures/lal_reference.json', import.meta.url)));
const FS = 4096, N = 4096, T0 = -0.7, F = [20, 2000], A = [1, 1];

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()); }
function inject(m1, m2, norm, shift, sign, seed) {      // ruido blanco σ=1 + plantilla de norma `norm` desplazada
  const wf = waveform({ m1, m2, fs: FS, finalTable: ref.final, tail: 0.08 });
  const w = whitenBand(placeTemplate(wf, T0, FS, N), FS, F, A);
  let n2 = 0; for (const v of w) n2 += v * v;
  const r = rng(seed), x = Float64Array.from({ length: N }, () => gauss(r));
  for (let i = 0; i < N; i++) { const j = i - shift; if (j >= 0 && j < N) x[i] += sign * (norm / Math.sqrt(n2)) * w[j]; }
  return x;
}

test('fft coincide con la DFT directa y la inversa recupera la señal', () => {
  const n = 16, re = Float64Array.from({ length: n }, (_, i) => Math.sin(i) + i / 7), im = new Float64Array(n), r0 = re.slice();
  fft(re, im);
  for (const k of [0, 3, 9]) {
    let a = 0, b = 0; r0.forEach((v, t) => { a += v * Math.cos((2 * Math.PI * k * t) / n); b -= v * Math.sin((2 * Math.PI * k * t) / n); });
    assert.ok(Math.abs(re[k] - a) < 1e-9 && Math.abs(im[k] - b) < 1e-9);
  }
  fft(re, im, true); assert.ok(r0.every((v, i) => Math.abs(re[i] - v) < 1e-12));
});

test('asdAt interpola en log-log; spectrogram localiza una senoide de 100 Hz', () => {
  assert.ok(Math.abs(asdAt(200, [100, 400], [1, 4]) - 2) < 1e-12);
  const x = Float64Array.from({ length: N }, (_, i) => Math.sin((2 * Math.PI * 100 * i) / FS));
  const sp = spectrogram(x, FS), row = sp.frames[20];
  assert.ok(Math.abs(row.indexOf(Math.max(...row)) * sp.df - 100) <= 8);
  const c = inferno(0.5); assert.ok(c.length === 3 && c.every((v) => v >= 0 && v <= 255));
});

test('filtro adaptado: recupera desplazamiento, polaridad y SNR inyectados', () => {
  const wf = waveform({ m1: 36, m2: 29, fs: FS, finalTable: ref.final, tail: 0.08 });
  const w = whitenBand(placeTemplate(wf, T0, FS, N), FS, F, A);
  const x = inject(36, 29, 10, 20, -1, 7), m = matchFilter(x, w, FS);
  assert.ok(Math.abs(m.shift - 20 / FS) <= 2 / FS, `shift ${m.shift}`);
  assert.equal(m.sign, -1);
  assert.ok(m.snr > 6.5 && m.snr < 14, `snr ${m.snr}`);
});

test('analyze: retardo L1−H1 ≈ 6.8 ms con polaridad opuesta; masas erróneas dan menos SNR', () => {
  const data = { fs: FS, band_hz: [35, 350], meta: { dist_mpc: 410 }, detectors: {} };
  [['H1', 0, 1, 11], ['L1', 28, -1, 12]].forEach(([n, sh, sg, sd]) => {
    data.detectors[n] = { t0: T0, whitened: Array.from(inject(36, 29, 9, sh, sg, sd)), asd_f: F, asd: A };
  });
  const good = analyze(data, ref.final, 36, 29), bad = analyze(data, ref.final, 12, 12);
  assert.ok(Math.abs(good.dt - 28 / FS) < 0.0015, `dt ${good.dt}`);
  assert.equal(good.det.H1.sign, 1); assert.equal(good.det.L1.sign, -1);
  assert.ok(good.snrNet > 1.3 * bad.snrNet, `${good.snrNet} vs ${bad.snrNet}`);
});

test('optimize recupera la masa de chirp inyectada (±8%), no necesariamente m1 y m2', () => {
  const data = { fs: FS, band_hz: [35, 350], meta: { dist_mpc: 410 }, detectors: {} };
  [['H1', 0, 1, 21], ['L1', 28, -1, 22]].forEach(([n, sh, sg, sd]) => {
    data.detectors[n] = { t0: T0, whitened: Array.from(inject(36, 29, 12, sh, sg, sd)), asd_f: F, asd: A };
  });
  const o = optimize(data, ref.final), mc = massParams(o.m1, o.m2).Mc, mc0 = massParams(36, 29).Mc;
  assert.ok(Math.abs(mc / mc0 - 1) < 0.08, `Mc ${mc} vs ${mc0} (m1=${o.m1}, m2=${o.m2})`);
});
