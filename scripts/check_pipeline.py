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


# --- lectura local (misma estructura que los HDF5 de GWOSC) ---
try:
    import h5py, tempfile, json, subprocess
except ImportError:
    print("h5py no instalado: se omite la prueba --local"); sys.exit(0)
from build_data import read_local
with tempfile.TemporaryDirectory() as d:
    start = GPS_EVENT - 40.0                                   # archivo de 64 s, evento dentro
    for det in ("H1", "L1"):
        with h5py.File(f"{d}/GW150914_{det}.hdf5", "w") as f:
            ds = f.create_dataset("strain/Strain", data=np.concatenate([noise + sig, noise[: 32 * FS]]))
            ds.attrs.update(Xstart=start, Xspacing=1 / FS, Npoints=ds.shape[0])
            q = f.create_dataset("quality/simple/DQmask", data=np.full(64, 127, dtype="uint32"))
            q.attrs.update(Xstart=int(start), Xspacing=1.0)
    x, t0, dq = read_local(f"{d}/GW150914_H1.hdf5")
    assert len(x) == 32 * FS and abs(t0 - (GPS_EVENT - 16)) < 1 / FS and dq == [127]
    try:
        read_local(f"{d}/GW150914_H1.hdf5", event_gps=GPS_EVENT + 100)
        raise SystemExit("debía rechazar un evento fuera del archivo")
    except ValueError:
        pass
    out = f"{d}/o.json"
    subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), "build_data.py"),
                    "--local", d, "--out", out], check=True, capture_output=True)
    j = json.load(open(out))
    assert set(j["detectors"]) == {"H1", "L1"} and len(j["detectors"]["H1"]["whitened"]) == 4096
print("OK (lectura local)")
