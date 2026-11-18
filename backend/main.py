from __future__ import annotations

import json
from contextlib import asynccontextmanager
from pathlib import Path

import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# Importaciones científicas correctas
from backend.science.waveform import generate_chirp_waveform, calculate_optimal_snr
from backend.science.noise import add_colored_noise

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "data" / "events.json"
STATIC_DIR = BASE_DIR / "static"


def load_events() -> dict:
    if not DATA_FILE.exists():
        return {"events": []}
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.events_data = load_events()
    yield


app = FastAPI(
    title="GW Lab",
    version="0.3.0",
    description="Herramienta científica para análisis de ondas gravitacionales.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "gw-lab"}


@app.get("/api/events")
def list_events():
    data = app.state.events_data
    summaries = []
    for ev in data.get("events", []):
        summaries.append({
            "id": ev.get("id"),
            "name": ev.get("name", ev.get("id")),
            "date": ev.get("date"),
            "mass_1": ev.get("mass_1"),
            "mass_2": ev.get("mass_2"),
        })
    return {"events": summaries}


@app.get("/api/events/{event_id}")
def get_event(event_id: str):
    data = app.state.events_data
    for ev in data.get("events", []):
        if ev.get("id") == event_id:
            return ev
    raise HTTPException(status_code=404, detail=f"Event '{event_id}' not found")


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
    
    Física subyacente: Aproximación Post-Newtoniana (PN) integrada numéricamente.
    Ruido: Gaussiano blanco calibrado por SNR objetivo.
    """
    try:
        # 1. Validar parámetros físicos básicos
        if m1 <= 0 or m2 <= 0:
            raise ValueError("Masas deben ser positivas.")
        if f_start >= f_end:
            raise ValueError("f_start debe ser menor que f_end.")
            
        # 2. Generar señal limpia (Teoría)
        t, h_clean = generate_chirp_waveform(m1, m2, f_start, f_end)
        
        # 3. Añadir ruido controlado (Simulación Observación)
        h_noisy = add_colored_noise(h_clean, snr_simulated, seed=seed)
        
        # 4. Decimar para transporte web eficiente (mantener ~2000 puntos máx)
        step = max(1, len(t) // 2000)
        t_out = t[::step].tolist()
        h_clean_out = h_clean[::step].tolist()
        h_noisy_out = h_noisy[::step].tolist()
        
        # 5. Métricas físicas
        M_total = m1 + m2
        mu = (m1 * m2) / M_total
        mc = ((mu ** (3/5)) / (M_total ** (1/5)))
        
        # SNR medido real en la simulación (norma de señal / norma de ruido)
        noise_component = h_noisy - h_clean
        signal_norm = np.linalg.norm(h_clean)
        noise_norm = np.linalg.norm(noise_component)
        
        snr_measured = float(signal_norm / noise_norm) if noise_norm > 0 else 0.0
        
        return {
            "status": "success",
            "parameters": {
                "m1": m1, 
                "m2": m2, 
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


@app.get("/", include_in_schema=False)
def index():
    # Sirve el frontend local si existe, sino redirige a docs
    if STATIC_DIR.exists() and (STATIC_DIR / "index.html").exists():
        return FileResponse(STATIC_DIR / "index.html")
    return {"message": "Frontend not found. Visit /docs for API."}


# Montar static files si existe la carpeta
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
