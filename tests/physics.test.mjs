// Valida docs/js/physics.js contra referencias independientes (LALSuite, qnm). Ejecutar: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspiral, qnm220, massParams, finalState, waveform, TSUN } from '../docs/js/physics.js';
const ref = JSON.parse(readFileSync(new URL('./fixtures/lal_reference.json', import.meta.url)));

test('chirp mass de (35.6+30.6) Msun ≈ 28.7 Msun', () => {
  assert.ok(Math.abs(massParams(35.6, 30.6).Mc - 28.7) < 0.1);
});

test('inspiral T4 2.5PN: f(t) coincide con TaylorT4 de LAL en todo su rango (t_c libre) < 0.7%', () => {
  for (const c of ref.t4) {
    const ins = inspiral({ m1: c.m1, m2: c.m2, fLow: 20, xEnd: 0.4 }), n = ins.t.length;
    const fAt = (t) => { const k = (t - ins.t[0]) * 4096, j = Math.floor(k); if (j < 0 || j >= n - 1) return NaN; const u = k - j; return ins.f[j] * (1 - u) + ins.f[j + 1] * u; };
    let best = Infinity;
    for (let s = -0.5; s < 6; s += 0.0002) {             // t_ours = t_lal + s
      let e = 0; for (let i = 0; i < c.t.length; i++) { const v = fAt(c.t[i] + s); e = Math.max(e, Math.abs(v / c.f[i] - 1)); if (!(e < best)) break; }
      if (e < best) best = e;
    }
    assert.ok(best < 0.007, `(${c.m1},${c.m2}) error máx ${(best * 100).toFixed(3)}%`);
  }
});

test('el chirp llega al rango de GW150914: la inspiral alcanza >100 Hz y es monótona', () => {
  const w = waveform({ m1: 35.6, m2: 30.6, finalTable: ref.final });
  assert.ok(w.fEnd > 100 && w.fEnd < 140, `fEnd ${w.fEnd}`);
  for (let i = 1; i < w.nInsp; i++) assert.ok(w.f[i] > w.f[i - 1]);
});

test('QNM 220: ajuste BCW06 vs Leaver exacto < 3% (f) y < 6% (decaimiento)', () => {
  for (const q of ref.qnm) {
    const { f, tau } = qnm220(1, q.a);                 // M = 1 Msun
    const fExact = q.re / (2 * Math.PI * TSUN);        // Re(Mω)/(2π M)
    const tauExact = TSUN / Math.abs(q.im);            // 1/|Im ω|
    assert.ok(Math.abs(f / fExact - 1) < 0.03, `a=${q.a} f ${f} vs ${fExact}`);
    assert.ok(Math.abs(tau / tauExact - 1) < 0.06, `a=${q.a} tau ${tau} vs ${tauExact}`);
  }
});

test('espín final GW150914 ≈ 0.69 y masa final ≈ 0.95 M (ajustes NR)', () => {
  const { mf, af } = finalState(massParams(35.6, 30.6).eta, ref.final);
  assert.ok(Math.abs(af - 0.69) < 0.02 && Math.abs(mf - 0.95) < 0.01);
});

test('waveform: tiene chirp creciente y ringdown amortiguado', () => {
  const w = waveform({ m1: 35.6, m2: 30.6, finalTable: ref.final });
  assert.ok(w.f.at(-1) > 1.2 * w.f[0] && w.fRing > 200 && w.fRing < 300);
  const amp = (a, b) => Math.max(...w.h.slice(a, b).map(Math.abs));
  assert.ok(amp(-60, -1) < amp(-400, -300) * 2);   // la cola decae, no explota
  assert.ok(w.h.every(Number.isFinite));
});
