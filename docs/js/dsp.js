// GW Lab — procesado de señal sin dependencias (FFT, blanqueado de plantilla, filtro adaptado, espectrograma).
// Copyright (C) Pedro Sordo Martínez — AGPL-3.0-or-later

/** FFT radix-2 in-place (longitud potencia de 2). inv=true → inversa normalizada. */
export function fft(re, im, inv = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((2 * Math.PI) / len) * (inv ? 1 : -1), wr = Math.cos(ang), wi = Math.sin(ang), h = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < h; k++) {
        const a = i + k, b = a + h, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
  if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

/** ASD(f) por interpolación lineal en log-log (F ascendente). */
export function asdAt(f, F, A) {
  if (f <= F[0]) return A[0];
  if (f >= F[F.length - 1]) return A[A.length - 1];
  let lo = 0, hi = F.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (F[m] <= f) lo = m; else hi = m; }
  const u = Math.log(f / F[lo]) / Math.log(F[hi] / F[lo]);
  return Math.exp(Math.log(A[lo]) * (1 - u) + Math.log(A[hi]) * u);
}

/** Blanquea una plantilla igual que los datos: ventana Tukey, ÷ASD(f), paso banda con rampas de 10 Hz. */
export function whitenBand(h, fs, F, A, band = [35, 350]) {
  const N = h.length; let P = 1; while (P < 2 * N) P <<= 1;
  const re = new Float64Array(P), im = new Float64Array(P), edge = Math.floor(0.05 * N);
  for (let i = 0; i < N; i++) {
    const w = i < edge ? 0.5 - 0.5 * Math.cos((Math.PI * i) / edge) : i >= N - edge ? 0.5 - 0.5 * Math.cos((Math.PI * (N - 1 - i)) / edge) : 1;
    re[i] = h[i] * w;
  }
  fft(re, im);
  for (let k = 0; k < P; k++) {
    const f = (Math.min(k, P - k) * fs) / P;
    let g = 0;
    if (f > band[0] && f < band[1]) { const r = Math.min(1, (f - band[0]) / 10, (band[1] - f) / 10); g = (0.5 - 0.5 * Math.cos(Math.PI * r)) / asdAt(f, F, A); }
    re[k] *= g; im[k] *= g;
  }
  fft(re, im, true);
  return re.slice(0, N);
}

/**
 * Filtro adaptado (correlación cruzada por FFT) para desplazamientos |s| ≤ maxShift.
 * z[s] = Σ_t d[t]·w[t−s]. El pico se busca en |s| ≤ peakWin; σ(z) se estima fuera de |s| > excl
 * (estimación LOCAL en esta ventana: no sustituye a un fondo de decenas de segundos).
 */
export function matchFilter(d, w, fs, { maxShift = 0.25, peakWin = 0.06, excl = 0.1 } = {}) {
  const N = d.length, S = Math.round(maxShift * fs), z = new Float64Array(2 * S + 1);
  let P = 1; while (P < 2 * N) P <<= 1;
  const dr = new Float64Array(P), di = new Float64Array(P), wr = new Float64Array(P), wi = new Float64Array(P);
  let ww = 0; for (let i = 0; i < N; i++) { dr[i] = d[i]; wr[i] = w[i]; ww += w[i] * w[i]; }
  fft(dr, di); fft(wr, wi);
  for (let k = 0; k < P; k++) {                       // D·conj(W): correlación cruzada por FFT (P ≥ 2N → sin solape circular)
    const a = dr[k], b = di[k], c = wr[k], e = wi[k];
    dr[k] = a * c + b * e; di[k] = b * c - a * e;
  }
  fft(dr, di, true);
  for (let s = -S; s <= S; s++) z[s + S] = dr[(s + P) % P];   // z[s] = Σ_t d[t]·w[t−s]
  const Pw = Math.round(peakWin * fs), E = Math.round(excl * fs);
  let best = 0, bs = 0;
  for (let s = -Pw; s <= Pw; s++) if (Math.abs(z[s + S]) > best) { best = Math.abs(z[s + S]); bs = s; }
  let n = 0, m2 = 0;
  for (let s = -S; s <= S; s++) if (Math.abs(s) > E) { n++; m2 += z[s + S] * z[s + S]; }
  const sigma = Math.sqrt(m2 / Math.max(n, 1));
  return { shift: bs / fs, snr: ww > 0 && sigma > 0 ? best / sigma : 0, sign: Math.sign(z[bs + S]) || 1,
           amp: ww > 0 ? z[bs + S] / ww : 0, z, S };
}

/** Espectrograma STFT (Hann, relleno a nfft). Devuelve {frames[Float32Array], times, df, nbins}. */
export function spectrogram(x, fs, { nwin = 256, hop = 8, nfft = 1024, fmax = 400 } = {}) {
  const win = new Float64Array(nwin).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (nwin - 1)));
  const df = fs / nfft, nbins = Math.floor(fmax / df), frames = [], times = [];
  for (let s = 0; s + nwin <= x.length; s += hop) {
    const re = new Float64Array(nfft), im = new Float64Array(nfft);
    for (let i = 0; i < nwin; i++) re[i] = x[s + i] * win[i];
    fft(re, im);
    const row = new Float32Array(nbins);
    for (let k = 0; k < nbins; k++) row[k] = Math.hypot(re[k], im[k]);
    frames.push(row); times.push((s + nwin / 2) / fs);
  }
  return { frames, times, df, nbins };
}

const STOPS = [[0, 0, 4], [66, 10, 104], [147, 38, 103], [221, 81, 58], [252, 165, 10], [252, 255, 164]];
/** Mapa de color tipo inferno, u en [0,1] → [r,g,b]. */
export function inferno(u) {
  const x = Math.min(Math.max(u, 0), 1) * (STOPS.length - 1), i = Math.min(Math.floor(x), STOPS.length - 2), f = x - i;
  return STOPS[i].map((c, k) => Math.round(c + (STOPS[i + 1][k] - c) * f));
}
