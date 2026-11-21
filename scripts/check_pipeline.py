#!/usr/bin/env python3
"""Comprueba el pipeline de blanqueado con datos sintéticos (sin red). Uso: python3 scripts/check_pipeline.py"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from build_data import process, FS, GPS_EVENT

rng = np.random.default_rng(1)
n = 32 * FS
# ruido coloreado tipo LIGO: pared sísmica <30 Hz y fondo plano ~ 1e-23
f = np.fft.rfftfreq(n, 1 / FS)
shape = np.sqrt((30.0 / np.maximum(f, 1)) ** 8 + 1 + (f / 800) ** 2)
noise = np.fft.irfft((rng.normal(size=f.size) + 1j * rng.normal(size=f.size)) * shape, n=n) * np.sqrt(n) * 1e-23 * 20
# inyección: chirp newtoniano (Mc≈28.7) que acaba en el evento
t = np.arange(n) / FS - 16
tau = np.clip(-t, 1e-3, None)
mc = 28.7 * 4.925491e-6
fi = np.clip((1 / np.pi) * (5 / (256 * tau)) ** 0.375 * mc ** -0.625, 0, 300)
env = np.where(t < 0, (fi / 100) ** (2 / 3), 0) * np.exp(-np.clip(t, 0, None) / 0.004) * (t < 0.03)
sig = 6e-22 * env * np.cos(2 * np.pi * np.cumsum(fi) / FS)
tt, w, _ = process(noise + sig, FS, GPS_EVENT - 16)

off = np.abs(tt) > 0.45
print("σ fuera de señal:", round(float(np.std(w[off])), 2), "| pico:", round(float(np.max(np.abs(w))), 2),
      "σ en t =", round(float(tt[np.argmax(np.abs(w))]), 3), "s")
assert 0.6 < np.std(w[off]) < 1.6, "blanqueado: varianza fuera de lo esperado"
assert np.max(np.abs(w)) > 4 and abs(tt[np.argmax(np.abs(w))]) < 0.08, "no recupera la inyección"
print("OK")
