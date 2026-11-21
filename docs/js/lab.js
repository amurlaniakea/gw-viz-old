// GW Lab — lógica de análisis (sin DOM): plantilla PN → blanqueo → filtro adaptado en H1 y L1.
// Copyright (C) Pedro Sordo Martínez — AGPL-3.0-or-later
import { waveform, massParams, finalState, qnm220 } from './physics.js';
import { whitenBand, matchFilter } from './dsp.js';

/** Coloca la forma de onda (t=0 en la fusión) en la rejilla de los datos (muestra i ↔ t0+i/fs). */
export function placeTemplate(wf, t0, fs, N) {
  const out = new Float64Array(N), i0 = Math.round(-t0 * fs);
  for (let j = 0; j < wf.t.length; j++) { const i = i0 + Math.round(wf.t[j] * fs); if (i >= 0 && i < N) out[i] = wf.h[j]; }
  return out;
}

/** Analiza (m1,m2) contra los datos reales (SNR local por filtro adaptado en H1 y L1). */
export function analyze(data, finalTable, m1, m2) {
  const fs = data.fs, res = { m1, m2, ...massParams(m1, m2), det: {} };
  const wf = waveform({ m1, m2, distMpc: data.meta.dist_mpc, fs, fLow: 20, finalTable, tail: 0.08 });
  Object.assign(res, { wf, mf: wf.mf, af: wf.af, fRing: wf.fRing, fEnd: wf.fEnd });
  for (const [name, d] of Object.entries(data.detectors)) {
    const x = Float64Array.from(d.whitened), tpl = placeTemplate(wf, d.t0, fs, x.length);
    const w = whitenBand(tpl, fs, d.asd_f, d.asd, data.band_hz);
    const mf = matchFilter(x, w, fs);
    const fit = new Float64Array(x.length), s = Math.round(mf.shift * fs);
    for (let i = 0; i < x.length; i++) { const j = i - s; fit[i] = j >= 0 && j < x.length ? mf.amp * w[j] : 0; }
    res.det[name] = { ...mf, w, fit, x };
  }
  const H = res.det.H1, L = res.det.L1;
  res.snrNet = H && L ? Math.hypot(H.snr, L.snr) : (H || L).snr;
  res.dt = H && L ? L.shift - H.shift : null;
  return res;
}

/** Ascenso de colina sobre (m1,m2) con paso decreciente; devuelve {m1,m2}. */
export function optimize(data, finalTable, start = { m1: 30, m2: 30 }, range = [10, 80]) {
  let { m1, m2 } = start, best = analyze(data, finalTable, m1, m2).snrNet;
  for (const step of [8, 4, 2, 1, 0.5]) {
    for (let improved = true, guard = 0; improved && guard < 12; guard++) {
      improved = false;
      for (const [a, b] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
        const n1 = m1 + a, n2 = m2 + b;
        if (n1 < range[0] || n2 < range[0] || n1 > range[1] || n2 > range[1]) continue;
        const v = analyze(data, finalTable, n1, n2).snrNet;
        if (v > best + 1e-9) { best = v; m1 = n1; m2 = n2; improved = true; }
      }
    }
  }
  return { m1, m2 };
}
export { massParams, finalState, qnm220 };
