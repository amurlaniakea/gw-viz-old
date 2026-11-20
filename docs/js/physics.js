// GW Lab — motor físico (sin dependencias). ES module, funciona en navegador y Node.
// Copyright (C) Pedro Sordo Martínez — AGPL-3.0-or-later
//
// Referencias:
//  [B14] Blanchet, Living Rev. Relativ. 17, 2 (2014) — evolución PN (TaylorT3 a 2.5PN)
//  [BCW06] Berti, Cardoso & Will, PRD 73, 064030 (2006) — ajuste de QNM
//  [JF17] Jiménez-Forteza et al., PRD 95, 064024 (2017) — masa/espín finales (tabla vía LALSuite)
// LIMITES: inspiral PN (sin espines) + ringdown didáctico unido por mezcla suave.
// No es relatividad numérica: no usar para inferencia de parámetros.

export const TSUN = 4.925490947e-6;      // G·Msun/c^3 [s]
export const MPC_S = 3.0856775814913673e22 / 299792458; // Mpc/c [s]

export function massParams(m1, m2) {
  const M = m1 + m2, eta = (m1 * m2) / (M * M);
  return { M, eta, Mc: Math.pow(eta, 0.6) * M };
}

/** Frecuencia GW f(τ) [Hz], τ = tc − t [s]; TaylorT3 a 2.5PN [B14]. */
export function fGW(tau, m1, m2) {
  const { M, eta } = massParams(m1, m2), Ms = M * TSUN;
  const th = (eta * tau) / (5 * Ms);
  const t8 = Math.pow(th, -0.25);          // Θ^(-1/4)
  const x = Math.pow(th, -3 / 8) / (8 * Math.PI * Ms);
  return x * (1
    + (743 / 2688 + 11 * eta / 32) * t8
    - (3 * Math.PI / 10) * Math.pow(th, -3 / 8)
    + (1855099 / 14450688 + 56975 * eta / 258048 + 371 * eta * eta / 2048) * Math.pow(th, -0.5)
    - (7729 / 21504 - 3 * eta / 256) * Math.PI * Math.pow(th, -5 / 8));
}

/** f_ISCO (Schwarzschild, GW) [Hz] */
export const fISCO = (M) => 1 / (Math.PI * Math.pow(6, 1.5) * M * TSUN);

// Tabla η → (M_f/M, a_f), ajustes NR de [JF17] evaluados con LALSuite (ver fixture).
export function finalState(eta, table) {
  const T = table; let i = 0;
  while (i < T.length - 2 && eta > T[i + 1].eta) i++;
  const u = (eta - T[i].eta) / (T[i + 1].eta - T[i].eta);
  return { mf: T[i].mf + u * (T[i + 1].mf - T[i].mf), af: T[i].af + u * (T[i + 1].af - T[i].af) };
}

/** Modo QNM l=m=2 n=0: f [Hz], Q [BCW06 Tabla VIII]. */
export function qnm220(Mf, af) {
  const f = (1.5251 - 1.1568 * Math.pow(1 - af, 0.1292)) / (2 * Math.PI * Mf * TSUN);
  const Q = 0.7 + 1.4187 * Math.pow(1 - af, -0.499);
  return { f, Q, tau: Q / (Math.PI * f) };
}

/**
 * Forma de onda h(t) cara-sobre (ι=0), t=0 en la fusión.
 * Devuelve { t[], h[], f[], fRing, mf, af }.
 */
export function waveform({ m1, m2, distMpc = 410, fs = 4096, fLow = 20, finalTable, tail = 0.05 }) {
  const { M, Mc, eta } = massParams(m1, m2), dt = 1 / fs, D = distMpc * MPC_S;
  const fEnd = fISCO(M);
  // τ en el que f(τ)=fLow y en el que f=fISCO (bisección; f decrece con τ)
  const solve = (ft) => { let lo = 1e-6, hi = 1e4;
    for (let k = 0; k < 200; k++) { const mid = Math.sqrt(lo * hi); (fGW(mid, m1, m2) > ft ? lo = mid : hi = mid); }
    return Math.sqrt(lo * hi); };
  const tauStart = solve(fLow);
  const t = [], h = [], f = []; let phi = 0, k = 0, tau = tauStart, last = 0;
  for (; tau > 1e-4; tau -= dt, k++) {
    const fi = fGW(tau, m1, m2);
    // La serie PN deja de ser monótona cerca de la fusión: paramos en ISCO o al dejar de crecer.
    if (!Number.isFinite(fi) || fi >= fEnd || (f.length && fi <= f[f.length - 1])) break;
    phi += 2 * Math.PI * fi * dt;
    const A = (4 * Math.pow(Mc * TSUN, 5 / 3) * Math.pow(Math.PI * fi, 2 / 3)) / D;
    t.push(-tau); h.push(A * Math.cos(phi)); f.push(fi); last = A;
  }
  const fInspEnd = f[f.length - 1];
  let fRing = null, mf = null, af = null;
  if (finalTable) {
    ({ mf, af } = finalState(eta, finalTable)); mf *= M;
    const q = qnm220(mf, af); fRing = q.f;
    const t0 = t[t.length - 1], blend = 3 / f[f.length - 1];     // transición f: fISCO → fRing en ~3 ciclos
    for (let j = 1; j <= Math.ceil(tail * fs); j++) {
      const s = j * dt, w = Math.min(1, s / blend), fi = f[f.length - 1] + (fRing - f[f.length - 1]) * w;
      phi += 2 * Math.PI * fi * dt;
      t.push(t0 + s); h.push(last * Math.exp(-s / q.tau) * Math.cos(phi)); f.push(fi);
    }
  }
  return { t, h, f, fRing, mf, af, fEnd: fInspEnd, eta, Mc };
}
