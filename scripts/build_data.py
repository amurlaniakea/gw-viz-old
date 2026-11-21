#!/usr/bin/env python3
"""Genera docs/data/gw150914.json con datos REALES de GWOSC (H1 y L1), blanqueados.

Uso (en tu máquina, con internet):   python3 scripts/build_data.py
Requiere: numpy scipy gwpy   (pip install gwpy)

Pipeline (estándar GWOSC): 32 s de datos -> PSD de Welch (mediana, 4 s) -> blanqueado
en frecuencia con ventana Tukey -> paso banda 35–350 Hz -> normalización a σ del fondo
-> ventana de 1 s alrededor del evento. Se guardan también las ASD para dibujarlas.
Datos: GWOSC (https://gwosc.org), licencia CC BY 4.0. Cita: Abbott et al., PRL 116, 061102 (2016).
Copyright (C) Pedro Sordo Martínez — AGPL-3.0-or-later
"""
import argparse, json
import numpy as np
from scipy import signal

GPS_EVENT = 1126259462.4          # GW150914 (GWOSC/GWTC-1)
FS = 4096
BAND = (35.0, 350.0)
WIN = (-0.7, 0.3)                 # ventana guardada [s] respecto al evento


def asd_welch(x, fs, seg=4.0, overlap=2.0):
    f, p = signal.welch(x, fs, nperseg=int(seg * fs), noverlap=int(overlap * fs),
                        window="hann", average="median")
    return f, p


def whiten(x, fs, f_psd, psd):
    w = signal.windows.tukey(len(x), alpha=0.1)
    X = np.fft.rfft(x * w)
    fr = np.fft.rfftfreq(len(x), 1 / fs)
    asd = np.sqrt(np.interp(fr, f_psd, psd))
    return np.fft.irfft(X / asd, n=len(x))


def bandpass(x, fs, lo, hi, order=4):
    sos = signal.butter(order, [lo, hi], btype="bandpass", fs=fs, output="sos")
    return signal.sosfiltfilt(sos, x)


def process(x, fs, t0_gps, event_gps=GPS_EVENT, band=BAND, win=WIN):
    """x: strain crudo (32 s). Devuelve (t_rel, whitened_bandpassed_sigma, (f_asd, asd))."""
    f, p = asd_welch(x, fs)
    xw = bandpass(whiten(x, fs, f, p), fs, *band)
    t = t0_gps + np.arange(len(x)) / fs - event_gps
    off = (np.abs(t) > 4) & (t > t[0] + 2) & (t < t[-1] - 2)     # fondo: lejos del evento y de los bordes
    xw = xw / np.std(xw[off])
    sel = (t >= win[0]) & (t <= win[1])
    return t[sel], xw[sel], (f, np.sqrt(p))


def log_asd(f, asd, n=220, lo=20.0, hi=2000.0):
    fg = np.geomspace(lo, hi, n)
    return fg, np.exp(np.interp(np.log(fg), np.log(f[1:]), np.log(asd[1:])))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="docs/data/gw150914.json")
    a = ap.parse_args()
    from gwpy.timeseries import TimeSeries
    out = {"event": "GW150914", "gps": GPS_EVENT, "fs": FS, "band_hz": list(BAND),
           "window_s": list(WIN), "units": "sigma del fondo (blanqueado)",
           "source": "GWOSC (CC BY 4.0), 4 kHz", "detectors": {},
           "meta": {   # Abbott et al., PRL 116, 061102 (2016)
               "m1": 36, "m2": 29, "mf": 62, "af": 0.67, "e_rad_msun": 3.0,
               "dist_mpc": 410, "snr_net": 24,
               "ref": "Abbott et al., PRL 116, 061102 (2016), doi:10.1103/PhysRevLett.116.061102"}}
    for det in ("H1", "L1"):
        ts = TimeSeries.fetch_open_data(det, GPS_EVENT - 16, GPS_EVENT + 16, sample_rate=FS, cache=True)
        x = np.asarray(ts.value, dtype=float)
        t, w, (f, asd) = process(x, FS, float(ts.t0.value))
        fg, ag = log_asd(f, asd)
        out["detectors"][det] = {"t0": float(t[0]), "whitened": [round(float(v), 3) for v in w],
                                 "asd_f": [round(float(v), 2) for v in fg],
                                 "asd": [float(f"{v:.4g}") for v in ag]}
        print(det, len(w), "muestras; pico |w| =", round(float(np.max(np.abs(w))), 2), "σ")
    json.dump(out, open(a.out, "w"), separators=(",", ":"))
    print("escrito", a.out)


if __name__ == "__main__":
    main()
