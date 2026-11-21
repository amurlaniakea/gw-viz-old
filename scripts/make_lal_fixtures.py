#!/usr/bin/env python3
"""Genera tests/fixtures/lal_reference.json con LALSuite (referencia independiente).
Solo hace falta ejecutarlo para regenerar el fixture:  pip install lalsuite qnm numpy
Copyright (C) Pedro Sordo Martínez — AGPL-3.0-or-later
"""
import json, numpy as np
import lal, lalsimulation as ls

MSUN = lal.MSUN_SI; MPC = lal.PC_SI * 1e6
out = {"lalsuite": lal.__version__, "t4": [], "final": [], "qnm": [], "qnm_source": "qnm (Stein 2019, JOSS 4(42), 1683)"}

# 1) TaylorT4 a 2.5PN: frecuencia GW vs tiempo (t_c libre). T3 se descartó: su serie 2.5PN deja de
#    ser monótona a ~31 Hz para M≈65 Msun (rotura conocida de T3), así que no cubre el chirp real.
for m1, m2 in [(35.6, 30.6), (10.0, 10.0), (30.0, 10.0), (50.0, 50.0)]:
    p = lal.CreateDict(); ls.SimInspiralWaveformParamsInsertPNPhaseOrder(p, 5)
    dt = 1 / 16384.
    hp, hc = ls.SimInspiralChooseTDWaveform(m1*MSUN, m2*MSUN, 0,0,0, 0,0,0,
        400*MPC, 0., 0., 0., 0., 0., dt, 20., 20., p, ls.TaylorT4)
    n = hp.data.length; t = np.arange(n) * dt + float(hp.epoch)
    ph = np.unwrap(np.arctan2(hc.data.data, hp.data.data))
    f = np.gradient(ph, dt) / (2*np.pi)
    sel = np.where((t > t[0] + 0.02) & (t < t[-1] - 0.02))[0]
    idx = np.linspace(sel[0], sel[-1], 16).astype(int)
    out["t4"].append({"m1": m1, "m2": m2,
        "t": [float(t[i]) for i in idx], "f": [float(f[i]) for i in idx]})

# 2) Masa y espín finales (ajustes NR de PhenomX, Jiménez-Forteza+ 2017), chi=0
for eta in np.linspace(0.05, 0.25, 21):
    out["final"].append({"eta": float(eta),
        "mf": float(ls.SimIMRPhenomXFinalMass2017(eta, 0., 0.)),
        "af": float(ls.SimIMRPhenomXFinalSpin2017(eta, 0., 0.))})

# 3) QNM l=m=2 n=0 de Kerr (método de Leaver, paquete `qnm` de L. Stein): M*omega complejo
import qnm
grav = qnm.modes_cache(s=-2, l=2, m=2, n=0)
for a in [0.0, 0.3, 0.5, 0.69, 0.8, 0.9, 0.95]:
    w, _, _ = grav(a=a)
    out["qnm"].append({"a": a, "re": w.real, "im": w.imag})

json.dump(out, open("tests/fixtures/lal_reference.json", "w"), indent=1)
print("ok")
