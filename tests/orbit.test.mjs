import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { waveform } from '../docs/js/physics.js';
import { orbitAt, bhPositions, phaseAt, fieldImage } from '../docs/js/orbit.js';
const ref = JSON.parse(readFileSync(new URL('./fixtures/lal_reference.json', import.meta.url)));
const wf = waveform({ m1: 36, m2: 29, fs: 4096, finalTable: ref.final, tail: 0.08 });

test('la separación decrece y la velocidad orbital llega a ~0.5 c al final del inspiral (x=0.25)', () => {
  let prev = Infinity;
  for (let k = 0; k < wf.nInsp; k += 50) { const r = orbitAt(wf, 36, 29, wf.t[k]).r; assert.ok(r < prev + 1e-9); prev = r; }
  const last = orbitAt(wf, 36, 29, wf.t[wf.nInsp - 1]);
  assert.ok(last.r > 2.5 && last.r < 4.5 && last.v > 0.45 && last.v < 0.55, `r=${last.r} v=${last.v}`);
  assert.equal(orbitAt(wf, 36, 29, wf.t[wf.nInsp + 5]).inspiral, false);
});

test('centro de masas en el origen y fase continua', () => {
  const st = orbitAt(wf, 36, 29, -0.2), [a, b] = bhPositions(st, 36, 29);
  assert.ok(Math.abs(36 * Math.hypot(a.x, a.y) - 29 * Math.hypot(b.x, b.y)) < 1e-9);      // m1·|r1| = m2·|r2|
  assert.ok(Math.abs(36 * a.x + 29 * b.x) < 1e-9 && Math.abs(36 * a.y + 29 * b.y) < 1e-9);   // COM en el origen
  assert.ok(Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - st.r) < 1e-9);
  assert.ok(Math.abs(phaseAt(wf, wf.t[100] + 1e-5) - phaseAt(wf, wf.t[100])) < 0.01);
});

test('campo de ondas: finito, con contraste, y rota entre dos instantes', () => {
  const a = new Uint8ClampedArray(60 * 60 * 4), b = new Uint8ClampedArray(60 * 60 * 4);
  fieldImage(wf, 36, 29, -0.05, 60, 40, a); fieldImage(wf, 36, 29, -0.045, 60, 40, b);
  assert.ok(Math.max(...a) > 100 && Math.min(...a.filter((_, i) => i % 4 === 0)) < 20);
  assert.ok(a.some((v, i) => Math.abs(v - b[i]) > 20));
});
