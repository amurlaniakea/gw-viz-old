// GW Lab — motor físico (sin dependencias). ES module, funciona en navegador y Node.
// Copyright (C) Pedro Sordo Martínez — AGPL-3.0-or-later
//
// Referencias:
//  [B14] Blanchet, Living Rev. Relativ. 17, 2 (2014) — flujo PN: dx/dt a 2.5PN (TaylorT4)
//  [BCW06] Berti, Cardoso & Will, PRD 73, 064030 (2006) — ajuste de QNM
//  [JF17] Jiménez-Forteza et al., PRD 95, 064024 (2017) — masa/espín finales (tabla vía LALSuite)
// Nota: se usa TaylorT4 (integra dx/dt) y NO TaylorT3: la serie cerrada de T3 a 2.5PN deja de ser
// monótona a ~31 Hz para M≈65 Msun y no llega al chirp real (verificado contra LALSuite).
// LIMITES: inspiral PN sin espines, extendido hasta x_end (v/c≈0.5, más allá del ISCO, donde PN ya
// no es rigurosa) + ringdown didáctico unido por mezcla suave. No es relatividad numérica: no usar
// para inferencia de parámetros.

export const TSUN = 4.925490947e-6;      // G·Msun/c^3 [s]
export const MPC_S = 3.0856775814913673e22 / 299792458; // Mpc/c [s]

export function massParams(m1, m2) {
  const M = m1 + m2, eta = (m1 * m2) / (M * M);
  return { M, eta, Mc: Math.pow(eta, 0.6) * M };
}

/** dx/dt a 2.5PN [B14, eq. 314], x=(Mω)^(2/3), Ms = G·M/c³ [s]. */
export function dxdt(x, eta, Ms) {
  const s = Math.sqrt(x), x15 = x * s, x2 = x * x, x25 = x2 * s;
  const b = 1 - (743 / 336 + (11 * eta) / 4) * x + 4 * Math.PI * x15
    + (34103 / 18144 + (13661 * eta) / 2016 + (59 * eta * eta) / 18) * x2
    - (4159 / 672 + (189 * eta) / 8) * Math.PI * x25;
  return ((64 * eta) / (5 * Ms)) * Math.pow(x, 5) * b;
}

/** f_ISCO (Schwarzschild, GW) [Hz] */
export const fISCO = (M) => 1 / (Math.PI * Math.pow(6, 1.5) * M * TSUN);

/**
 * Inspiral TaylorT4 2.5PN integrado con RK4 desde fLow hasta x_end; t=0 en la última muestra.
 * Devuelve {t[], x[], f[] (GW, Hz), phi[] (fase GW = 2·fase orbital)}.
 */
export function inspiral({ m1, m2, fs = 4096, fLow = 20, xEnd = 0.25 }) {
  const { M, eta } = massParams(m1, m2), Ms = M * TSUN, h = 1 / fs;
  let x = Math.pow(Math.PI * Ms * fLow, 2 / 3), phi = 0;
  const X = [], PH = [];
  const w = (xx) => Math.pow(xx, 1.5) / Ms;          // ω orbital
  for (let guard = 0; x < xEnd && guard < 5e7; guard++) {
    X.push(x); PH.push(2 * phi);
    const k1 = dxdt(x, eta, Ms), p1 = w(x);
    const k2 = dxdt(x + 0.5 * h * k1, eta, Ms), p2 = w(x + 0.5 * h * k1);
    const k3 = dxdt(x + 0.5 * h * k2, eta, Ms), p3 = w(x + 0.5 * h * k2);
    const k4 = dxdt(x + h * k3, eta, Ms), p4 = w(x + h * k3);
    x += (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4); phi += (h / 6) * (p1 + 2 * p2 + 2 * p3 + p4);
    if (!(x > X[X.length - 1])) break;                // la serie dejó de crecer: parar
  }
  const n = X.length;
  return { t: X.map((_, i) => (i - (n - 1)) * h), x: X, phi: PH, f: X.map((v) => Math.pow(v, 1.5) / (Math.PI * Ms)) };
}

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
 * Forma de onda h(t) cara-sobre (ι=0), t=0 al final del inspiral (≈ fusión).
 * Devuelve { t[], h[], f[], a[], p[], nInsp, fRing, mf, af, fEnd, eta, Mc }.
 */
export function waveform({ m1, m2, distMpc = 410, fs = 4096, fLow = 20, finalTable, tail = 0.05, xEnd = 0.25 }) {
  const { M, Mc, eta } = massParams(m1, m2), D = distMpc * MPC_S, ins = inspiral({ m1, m2, fs, fLow, xEnd });
  const t = ins.t.slice(), f = ins.f.slice(), p = ins.phi.slice(), dt = 1 / fs;
  const a = f.map((fi) => (4 * Math.pow(Mc * TSUN, 5 / 3) * Math.pow(Math.PI * fi, 2 / 3)) / D);
  const h = a.map((A, i) => A * Math.cos(p[i])), nInsp = t.length, fInspEnd = f[nInsp - 1], last = a[nInsp - 1];
  let fRing = null, mf = null, af = null, phi = p[nInsp - 1];
  if (finalTable) {
    ({ mf, af } = finalState(eta, finalTable)); mf *= M;
    const q = qnm220(mf, af); fRing = q.f;
    const blend = 3 / fInspEnd;                        // transición f: f_fin → f_ring en ~3 ciclos
    for (let j = 1; j <= Math.ceil(tail * fs); j++) {
      const s = j * dt, wgt = Math.min(1, s / blend), fi = fInspEnd + (fRing - fInspEnd) * wgt, am = last * Math.exp(-s / q.tau);
      phi += 2 * Math.PI * fi * dt;
      t.push(s); h.push(am * Math.cos(phi)); f.push(fi); a.push(am); p.push(phi);
    }
  }
  return { t, h, f, a, p, nInsp, fRing, mf, af, fEnd: fInspEnd, eta, Mc };
}
