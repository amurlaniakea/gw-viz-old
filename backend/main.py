from __future__ import annotations

import csv
import json
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
STATIC_DIR = BASE_DIR / "static"


def load_events() -> dict:
    return json.loads((DATA_DIR / "events.json").read_text(encoding="utf-8"))


def load_strain(event_id: str) -> list[dict]:
    if event_id.lower() != "gw150914":
        return []
    strain_file = DATA_DIR / "gw150914_strain.csv"
    data = []
    with open(strain_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            data.append({"t": float(row["time"]), "h": float(row["strain"])})
    return data


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.events = load_events()
    app.state.strain_data = load_strain("gw150914")
    yield


app = FastAPI(
    title="GW Viz",
    version="0.1.0",
    description="Visualización educativa de ondas gravitacionales.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/events")
def list_events():
    return app.state.events


@app.get("/api/events/{event_id}")
def get_event(event_id: str):
    for ev in app.state.events.get("events", []):
        if ev["id"].lower() == event_id.lower():
            return ev
    raise HTTPException(status_code=404, detail=f"Event '{event_id}' not found")


@app.get("/api/events/{event_id}/strain")
def get_strain(event_id: str):
    if event_id.lower() != "gw150914":
        raise HTTPException(status_code=404, detail="Strain data not found")
    return app.state.strain_data


@app.get("/", include_in_schema=False)
def index():
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

from backend.science.waveform import generate_taylor_t2_inspiral, calculate_snr
from backend.science.noise import add_white_noise
import numpy as np

@app.get("/api/science/waveform")
async def get_science_waveform(
    m1: float = 36.0,
    m2: float = 29.0,
    f_start: float = 20.0,
    f_end: float = 500.0,
    snr_simulated: float = 25.0
):
    """
    Genera una forma de onda teórica y añade ruido simulado para práctica de detección.
    
    Retorna JSON con arrays de tiempo, señal limpia y señal ruidosa.
    Nota: Los arrays son decimados para mantener el payload ligero (<1MB).
    """
    # Generar señal base
    t, h_clean = generate_taylor_t2_inspiral(m1, m2, f_start, f_end)
    
    # Añadir ruido para simular observación realista
    h_noisy = add_white_noise(h_clean, snr_simulated)
    
    # Decimar para transporte web (cada 10 puntos)
    step = max(1, len(t) // 2000)
    t_decimated = t[::step].tolist()
    h_clean_decimated = h_clean[::step].tolist()
    h_noisy_decimated = h_noisy[::step].tolist()
    
    # Calcular SNR teórico vs observado (demostración de poder de detección)
    snr_observed = calculate_snr(h_clean, h_noisy)
    
    return {
        "parameters": {"m1": m1, "m2": m2, "f_start": f_start, "f_end": f_end},
        "time_s": t_decimated,
        "strain_clean": h_clean_decimated,
        "strain_noisy": h_noisy_decimated,
        "snr_theoretical_input": snr_simulated,
        "snr_measured_output": round(float(snr_observed), 2),
        "units": {"time": "seconds", "strain": "dimensionless"}
    }

from backend.science.waveform import generate_chirp_waveform, calculate_optimal_snr
from backend.science.noise import add_colored_noise
import numpy as np

@app.get("/api/lab/waveform")
async def get_lab_waveform(
    m1: float = 36.0,
    m2: float = 29.0,
    f_start: float = 20.0,
    f_end: float = 500.0,
    snr_simulated: float = 25.0,
    seed: int = 42
):
    """
    Laboratorio Virtual GW: Genera señal teórica y observada simulada.
    
    Permite estudiar cómo cambia la forma de onda con las masas y 
    cómo el ruido afecta la detección (SNR).
    """
    try:
        # 1. Generar señal limpia (Teoría)
        t, h_clean = generate_chirp_waveform(m1, m2, f_start, f_end)
        
        # 2. Añadir ruido controlado (Simulación Observación)
        h_noisy = add_colored_noise(h_clean, snr_simulated, seed=seed)
        
        # 3. Decimar para transporte web eficiente (mantener ~2000 puntos)
        step = max(1, len(t) // 2000)
        t_out = t[::step].tolist()
        h_clean_out = h_clean[::step].tolist()
        h_noisy_out = h_noisy[::step].tolist()
        
        # 4. Métricas físicas
        M_total = m1 + m2
        mu = (m1 * m2) / M_total
        mc = ((mu ** (3/5)) / (M_total ** (1/5)))
        
        # SNR medido en la simulación (aproximado por norma)
        snr_measured = float(np.linalg.norm(h_clean) / np.linalg.norm(h_noisy - h_clean)) if np.any(h_noisy != h_clean) else 0.0
        
        return {
            "status": "success",
            "parameters": {
                "m1": m1, "m2": m2, 
                "chirp_mass_mc": round(mc, 2),
                "total_mass": round(M_total, 2),
                "f_range_hz": [f_start, f_end],
                "snr_input": snr_simulated
            },
            "data": {
                "time_s": t_out,
                "strain_theory": h_clean_out,
                "strain_observed": h_noisy_out
            },
            "metrics": {
                "snr_measured_approx": round(snr_measured, 2),
                "max_strain_amplitude": float(np.max(np.abs(h_clean))),
                "duration_seconds": float(t[-1])
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating waveform: {str(e)}")
