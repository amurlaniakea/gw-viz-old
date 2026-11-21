// GW Lab — estado orbital y campo de ondas (cara-sobre) a partir de la forma de onda. Sin DOM.
// Copyright (C) Pedro Sordo Martínez — AGPL-3.0-or-later
// Separación: γ = x[1 + (1−η/3)x] (1PN, coordenadas armónicas; Blanchet 2014), r = M/γ, x = (π M f_GW)^(2/3).
// Campo: patrón h₊ ∝ A(t_r)·cos(Φ_GW(t_r) − 2θ) con tiempo retardado t_r = t − r/c (r en unidades de GM/c²).
import { TSUN } from './physics.js';

export function orbitAt(wf, m1, m2, T, fs = 4096) {
  const M = m1 + m2, eta = (m1 * m2) / (M * M), j = Math.min(wf.t.length - 1, Math.max(0, Math.round((T - wf.t[0]) * fs)));
  const inspiral = j < wf.nInsp, x = Math.pow(Math.PI * M * TSUN * wf.f[j], 2 / 3), r = inspiral ? 1 / (x * (1 + (1 - eta / 3) * x)) : 0;
  return { j, inspiral, fgw: wf.f[j], x, r, phi: wf.p[j] / 2, v: Math.sqrt(x) };
}

/** Posiciones (en unidades de M) respecto al centro de masas; BH1 es el más masivo si m1≥m2. */
export function bhPositions(st, m1, m2) {
  const M = m1 + m2, c = Math.cos(st.phi), s = Math.sin(st.phi);
  return [{ x: (m2 / M) * st.r * c, y: (m2 / M) * st.r * s }, { x: (-m1 / M) * st.r * c, y: (-m1 / M) * st.r * s }];
}

export function phaseAt(wf, tr, fs = 4096) {
  const n = wf.t.length, k = (tr - wf.t[0]) * fs;
  if (k <= 0) return wf.p[0] + 2 * Math.PI * wf.f[0] * (tr - wf.t[0]);
  const j = Math.floor(k);
  if (j >= n - 1) return wf.p[n - 1] + 2 * Math.PI * wf.f[n - 1] * (tr - wf.t[n - 1]);
  const u = k - j; return wf.p[j] * (1 - u) + wf.p[j + 1] * u;
}
export function ampAt(wf, tr, fs = 4096) {
  const n = wf.t.length, j = Math.min(n - 1, Math.max(0, Math.round((tr - wf.t[0]) * fs)));
  return tr > wf.t[n - 1] ? 0 : wf.a[j];
}

/** Rellena RGBA (size×size) con el campo de ondas en el instante T; FOV = semiancho en unidades de M. */
export function fieldImage(wf, m1, m2, T, size, FOV, out, fs = 4096) {
  const Ms = (m1 + m2) * TSUN, aref = wf.a[wf.nInsp - 1] || 1, bg = [8, 13, 28];
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    const X = ((px + 0.5) / size - 0.5) * 2 * FOV, Y = (0.5 - (py + 0.5) / size) * 2 * FOV, r = Math.hypot(X, Y), tr = T - r * Ms;
    const v = (ampAt(wf, tr, fs) / aref / (1 + r / 4)) * Math.cos(phaseAt(wf, tr, fs) - 2 * Math.atan2(Y, X)) * 2.2;
    const m = Math.min(1, Math.pow(Math.abs(v), 0.7)), c = v > 0 ? [251, 146, 60] : [56, 189, 248], o = (py * size + px) * 4;
    out[o] = bg[0] + (c[0] - bg[0]) * m; out[o + 1] = bg[1] + (c[1] - bg[1]) * m; out[o + 2] = bg[2] + (c[2] - bg[2]) * m; out[o + 3] = 255;
  }
}
