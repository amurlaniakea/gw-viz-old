// GW Lab — interfaz (Canvas 2D + Web Audio). Copyright (C) Pedro Sordo Martínez — AGPL-3.0-or-later
import { analyze, optimize } from './lab.js';
import { spectrogram, inferno } from './dsp.js';
import { orbitAt, bhPositions, fieldImage } from './orbit.js';

const $ = (id) => document.getElementById(id);
const PUB = { m1: 36, m2: 29 };
let data, table, res, spec = {}, raf = 0, actx = null, T = 0, playing = false, lastTs = 0, ofc = null;

function fit(c) {
  const r = window.devicePixelRatio || 1, w = c.clientWidth || 600, h = c.clientHeight || 300;
  c.width = Math.round(w * r); c.height = Math.round(h * r);
  const g = c.getContext('2d'); g.setTransform(r, 0, 0, r, 0, 0); g.font = '12px system-ui,sans-serif';
  return { g, w, h };
}
const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—');

async function init() {
  try {
    [data, table] = await Promise.all(['data/gw150914.json', 'data/final_state.json'].map((u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u + ' → ' + r.status); return r.json(); })));
  } catch (e) { $('status').textContent = 'No se pudieron cargar los datos (' + e.message + '). Genera docs/data con scripts/build_data.py.'; return; }
  for (const [n, d] of Object.entries(data.detectors)) {
    const sp = spectrogram(Float64Array.from(d.whitened), data.fs), lo = Math.ceil(30 / sp.df), vals = [];
    for (const row of sp.frames) for (let k = lo; k < sp.nbins; k++) vals.push(row[k]);
    vals.sort((a, b) => a - b); spec[n] = { ...sp, vmax: vals[Math.floor(vals.length * 0.995)] || 1 };
  }
  $('status').textContent = 'Datos reales cargados: ' + data.source + '.';
  ['m1', 'm2'].forEach((k) => $(k).addEventListener('input', schedule));
  $('b-pub').onclick = () => setMasses(PUB.m1, PUB.m2);
  $('b-opt').onclick = () => { $('status').textContent = 'Optimizando…'; setTimeout(() => { const o = optimize(data, table); setMasses(o.m1, o.m2); $('status').textContent = 'Optimizado sobre el SNR de red (ver la degeneración m₁–m₂).'; }, 20); };
  $('b-snd-data').onclick = () => play(res.det.H1.x);
  $('b-snd-tpl').onclick = () => play(res.det.H1.fit);
  $('det').onchange = () => { draw(); }; addEventListener('resize', draw);
  $('b-play').onclick = () => { playing = !playing; $('b-play').textContent = playing ? '⏸ Pausa' : '▶ Reproducir'; if (playing) { lastTs = 0; requestAnimationFrame(tick); } };
  $('t-slider').addEventListener('input', () => { T = res.wf.t[0] + (+$('t-slider').value / 1000) * (res.wf.t.at(-1) - res.wf.t[0]); frame(); });
  update();
}
function setMasses(a, b) { $('m1').value = a; $('m2').value = b; update(); }
function schedule() { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); }

function update() {
  const m1 = +$('m1').value, m2 = +$('m2').value;
  $('v-m1').textContent = fmt(m1); $('v-m2').textContent = fmt(m2);
  res = analyze(data, table, m1, m2);
  if (!(T >= res.wf.t[0] && T <= res.wf.t.at(-1))) T = res.wf.t[0];
  const H = res.det.H1, L = res.det.L1, rows = [
    ['Masa de chirp 𝓜', fmt(res.Mc, 2) + ' M☉'], ['Razón simétrica η', fmt(res.eta, 3)],
    ['Masa final', fmt(res.mf, 1) + ' M☉'], ['Espín final', fmt(res.af, 2)], ['f ringdown', fmt(res.fRing, 0) + ' Hz'],
    ['SNR local H1', fmt(H.snr)], ['SNR local L1', fmt(L.snr)], ['SNR red (local)', fmt(res.snrNet)],
    ['Retardo L1−H1', fmt(res.dt * 1000, 1) + ' ms'], ['Polaridad H1 / L1', (H.sign > 0 ? '+' : '−') + ' / ' + (L.sign > 0 ? '+' : '−')]];
  $('out').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  draw();
}

function draw() { if (res) { drawStrain(); drawSpec(); drawASD(); frame(); } }
function frame() { drawOrbit(); moveCursors(); }
function tick(ts) {
  if (!playing) return;
  const dt = lastTs ? (ts - lastTs) / 1000 : 0; lastTs = ts;
  const t0 = res.wf.t[0], t1 = res.wf.t.at(-1); T += dt * +$('o-speed').value; if (T > t1) T = t0;
  $('t-slider').value = Math.round(((T - t0) / (t1 - t0)) * 1000); frame(); requestAnimationFrame(tick);
}
function moveCursors() {
  const [ta, tb] = data.window_s;
  for (const [id, cv, det] of [['cur-strain', 'c-strain', 'H1'], ['cur-spec', 'c-spec', $('det').value]]) {
    const w = $(cv).clientWidth || 600, td = T + res.det[det].shift, x = 46 + ((td - ta) / (tb - ta)) * (w - 56);
    $(id).style.left = (td < ta || td > tb ? -10 : x) + 'px';
  }
}
function drawOrbit() {
  const { g, w, h } = fit($('c-orbit')), wf = res.wf, m1 = res.m1, m2 = res.m2, M = m1 + m2, FOV = 36, SZ = 150, S = w / (2 * FOV);
  ofc = ofc || document.createElement('canvas'); ofc.width = ofc.height = SZ;
  const og = ofc.getContext('2d'), img = og.createImageData(SZ, SZ); fieldImage(wf, m1, m2, T, SZ, FOV, img.data); og.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true; g.drawImage(ofc, 0, 0, w, h);
  const st = orbitAt(wf, m1, m2, T), disc = (x, y, r) => { g.shadowColor = '#000'; g.shadowBlur = 8; g.fillStyle = '#000'; g.beginPath(); g.arc(x, y, Math.max(r, 1.5), 0, 7); g.fill(); g.shadowBlur = 0; g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.stroke(); };
  if (st.inspiral) bhPositions(st, m1, m2).forEach((p, i) => disc(w / 2 + p.x * S, h / 2 - p.y * S, 2 * ((i ? m2 : m1) / M) * S));
  else disc(w / 2, h / 2, 2 * (res.mf / M) * S * (1 + 0.12 * Math.cos(wf.p[st.j]) * (wf.a[st.j] / (wf.a[wf.nInsp - 1] || 1))));
  const phase = st.inspiral ? 'inspiral' : T < wf.t[wf.nInsp] + 0.02 ? 'fusión' : 'ringdown';
  $('o-out').innerHTML = [['t − t_fusión', fmt(T * 1000, 0) + ' ms'], ['Fase', phase], ['f onda gravitacional', fmt(st.fgw, 0) + ' Hz'],
    ['Separación', st.inspiral ? fmt(st.r, 1) + ' M = ' + fmt(st.r * M * 1.476625, 0) + ' km' : '—'], ['Velocidad orbital', st.inspiral ? fmt(st.v, 2) + ' c' : '—']]
    .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
}

function drawStrain() {
  const { g, w, h } = fit($('c-strain')), [ta, tb] = data.window_s, pad = { l: 46, r: 10, t: 8, b: 24 };
  const X = (t) => pad.l + ((t - ta) / (tb - ta)) * (w - pad.l - pad.r), lanes = ['H1', 'L1'], lh = (h - pad.t - pad.b) / 2;
  lanes.forEach((n, li) => {
    const d = res.det[n], y0 = pad.t + li * lh, ym = y0 + lh / 2, amax = Math.max(4, ...d.x.map(Math.abs)) * 1.1, Y = (v) => ym - (v / amax) * (lh / 2 - 4);
    g.strokeStyle = '#26325c'; g.beginPath(); g.moveTo(pad.l, ym); g.lineTo(w - pad.r, ym); g.stroke();
    g.fillStyle = '#9aa6d1'; g.fillText(n === 'H1' ? 'H1 Hanford' : 'L1 Livingston', pad.l + 6, y0 + 14);
    g.fillText('±' + fmt(amax, 0) + 'σ', 6, y0 + 14);
    const t0 = data.detectors[n].t0;
    for (const [arr, col, lw] of [[d.x, '#7dd3fc', 1], [d.fit, '#fb923c', 2]]) {
      g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
      arr.forEach((v, i) => { const x = X(t0 + i / data.fs), y = Y(v); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    }
    g.lineWidth = 1;
  });
  g.strokeStyle = '#ffffff55'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(X(0), pad.t); g.lineTo(X(0), h - pad.b); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#9aa6d1';
  for (let t = Math.ceil(ta * 10) / 10; t <= tb + 1e-9; t += 0.1) { g.fillText(fmt(t, 1), X(t) - 9, h - 8); }
  g.fillText('t − t_evento (s)', w - 110, h - 8);
}

function drawSpec() {
  const { g, w, h } = fit($('c-spec')), n = $('det').value, sp = spec[n], pad = { l: 46, r: 10, t: 8, b: 24 }, [ta, tb] = data.window_s;
  const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b, fmax = sp.nbins * sp.df, fmin = 20;
  const off = document.createElement('canvas'); off.width = sp.frames.length; off.height = sp.nbins;
  const og = off.getContext('2d'), img = og.createImageData(off.width, off.height);
  sp.frames.forEach((row, x) => row.forEach((v, k) => { const c = inferno(Math.pow(v / sp.vmax, 0.75)), p = ((sp.nbins - 1 - k) * off.width + x) * 4; img.data.set([c[0], c[1], c[2], 255], p); }));
  og.putImageData(img, 0, 0);
  const t0 = data.detectors[n].t0, xa = pad.l + ((t0 + sp.times[0] - ta) / (tb - ta)) * pw, xb = pad.l + ((t0 + sp.times.at(-1) - ta) / (tb - ta)) * pw;
  const Yf = (f) => pad.t + ph * (1 - (f - fmin) / (fmax - fmin));
  g.imageSmoothingEnabled = true; g.save(); g.beginPath(); g.rect(pad.l, pad.t, pw, ph); g.clip();
  g.drawImage(off, 0, 0, off.width, sp.nbins - Math.floor(fmin / sp.df), xa, pad.t, xb - xa, ph);
  g.restore();
  const sh = res.det[n].shift, wf = res.wf; g.strokeStyle = '#38bdf8'; g.lineWidth = 2; g.setLineDash([6, 4]); g.beginPath();
  let started = false;
  for (let i = 0; i < wf.t.length; i += 4) { const f = wf.f[i], x = pad.l + ((wf.t[i] + sh - ta) / (tb - ta)) * pw; if (f < fmin || f > fmax || x < pad.l) continue; started ? g.lineTo(x, Yf(f)) : g.moveTo(x, Yf(f)); started = true; }
  g.stroke(); g.setLineDash([]); g.lineWidth = 1; g.fillStyle = '#9aa6d1';
  for (const f of [50, 100, 150, 200, 250, 300, 350]) { g.fillText(f + '', 12, Yf(f) + 4); }
  g.fillText('Hz', 12, pad.t + 10);
  for (let t = Math.ceil(ta * 10) / 10; t <= tb + 1e-9; t += 0.1) g.fillText(fmt(t, 1), pad.l + ((t - ta) / (tb - ta)) * pw - 9, h - 8);
}

function drawASD() {
  const { g, w, h } = fit($('c-asd')), pad = { l: 56, r: 10, t: 8, b: 24 }, D = data.detectors, all = Object.values(D).flatMap((d) => d.asd);
  const lo = Math.log10(Math.min(...all)), hi = Math.log10(Math.max(...all)), f0 = Math.log10(20), f1 = Math.log10(2000);
  const X = (f) => pad.l + ((Math.log10(f) - f0) / (f1 - f0)) * (w - pad.l - pad.r), Y = (a) => pad.t + (1 - (Math.log10(a) - lo) / (hi - lo)) * (h - pad.t - pad.b);
  g.fillStyle = '#38bdf822'; g.fillRect(X(data.band_hz[0]), pad.t, X(data.band_hz[1]) - X(data.band_hz[0]), h - pad.t - pad.b);
  Object.entries(D).forEach(([n, d], k) => {
    g.strokeStyle = k ? '#fb923c' : '#7dd3fc'; g.beginPath(); d.asd_f.forEach((f, i) => (i ? g.lineTo(X(f), Y(d.asd[i])) : g.moveTo(X(f), Y(d.asd[i])))); g.stroke();
    g.fillStyle = g.strokeStyle; g.fillText(n, w - 40, pad.t + 14 + 14 * k);
  });
  g.fillStyle = '#9aa6d1'; for (const f of [20, 50, 100, 200, 500, 1000, 2000]) g.fillText(f + '', X(f) - 8, h - 8);
  g.fillText('Hz', w - 24, h - 8); g.fillText('1/√Hz', 6, pad.t + 12);
  for (let e = Math.ceil(lo); e <= hi; e++) g.fillText('1e' + e, 6, Y(10 ** e) + 4);
}

function play(arr) {
  actx = actx || new (window.AudioContext || window.webkitAudioContext)();
  const sr = actx.sampleRate, n = Math.floor((arr.length / data.fs) * sr), buf = actx.createBuffer(1, n, sr), ch = buf.getChannelData(0);
  let peak = 1e-12; for (const v of arr) peak = Math.max(peak, Math.abs(v));
  for (let i = 0; i < n; i++) {
    const p = (i / sr) * data.fs, i0 = Math.floor(p), f = p - i0, v = arr[i0] * (1 - f) + (arr[Math.min(i0 + 1, arr.length - 1)] ?? 0) * f;
    ch[i] = (v / peak) * 0.8 * Math.min(1, i / (0.02 * sr), (n - i) / (0.02 * sr));
  }
  const src = actx.createBufferSource(); src.buffer = buf; src.playbackRate.value = +$('speed').value; src.connect(actx.destination); src.start();
}
init();
