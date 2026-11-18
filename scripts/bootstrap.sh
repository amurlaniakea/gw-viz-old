#!/usr/bin/env bash
set -euo pipefail

mkdir -p backend/data backend/static tests

cat > README.md <<'EOF_README'
# 🌌 GW Viz

Visualización educativa de ondas gravitacionales usando datos abiertos de LIGO/Virgo.

## MVP actual
- Visualización interactiva del Strain $h(t)$ del evento GW150914.
- Estadísticas físicas: Masas de los agujeros negros, energía radiada, distancia.
- Mapa del cielo (Sky Map) con la elipse de localización de la señal.
- Generación matemática de la curva *chirp* (aproximación Newtonian).

## Requisitos
- Python 3.10 o superior
- python3-venv

## Ejecutar
    bash run.sh

Luego abrir:
    http://localhost:8000
EOF_README

cat > .gitignore <<'EOF_GITIGNORE'
__pycache__/
*.py[cod]
*.egg-info/
.venv/
.pytest_cache/
.DS_Store
EOF_GITIGNORE

cat > pyproject.toml <<'EOF_PYPROJECT'
[project]
name = "gw-viz"
version = "0.1.0"
description = "Educational gravitational wave visualization (GW150914)."
readme = "README.md"
requires-python = ">=3.10"
dependencies = [
  "fastapi>=0.115",
  "uvicorn[standard]>=0.30",
]

[project.optional-dependencies]
dev = [
  "pytest>=8",
  "httpx>=0.27",
]

[build-system]
requires = ["setuptools>=69"]
build-backend = "setuptools.build_meta"

[tool.setuptools]
packages = ["backend"]

[tool.setuptools.package-data]
backend = ["data/*.json", "data/*.csv", "static/*"]

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
EOF_PYPROJECT

cat > run.sh <<'EOF_RUN'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  python3 -m venv .venv
  ./.venv/bin/python -m pip install --upgrade pip
fi

./.venv/bin/python -m pip install -e '.[dev]'
exec ./.venv/bin/python -m uvicorn backend.main:app --host 0.0.0.0 --port "${PORT:-8000}" --reload
EOF_RUN
chmod +x run.sh

cat > backend/__init__.py <<'EOF_INIT'
EOF_INIT

cat > backend/main.py <<'EOF_MAIN'
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
EOF_MAIN

cat > backend/data/events.json <<'EOF_JSON'
{
  "events": [
    {
      "id": "GW150914",
      "name": "GW150914",
      "date": "2015-09-14",
      "description": "Primera detección directa de ondas gravitacionales. Fusión de dos agujeros negros de masa estelar.",
      "mass_1": 35.6,
      "mass_2": 30.6,
      "final_mass": 62.3,
      "radiated_energy": 3.1,
      "distance_mpc": 410,
      "location": "Constelación de Equuleus / Pegaso"
    }
  ]
}
EOF_JSON

# Generar CSV con la curva chirp de GW150914 (aproximación matemática educativa)
python3 - <<'PY_CSV' > backend/data/gw150914_strain.csv
import math

dt = 1.0 / 4096.0
t_c = 0.0
t_start = -0.35
t_end = 0.05
t = t_start

print("time,strain")
while t <= t_end:
    tau = t_c - t
    if tau > 1e-4:
        f = 35.0 * math.pow(tau / 0.35, -3.0/8.0)
        A = 1e-21 * math.pow(tau / 0.35, -1.0/4.0)
        if t > -0.01:
            A *= math.exp(-(t + 0.01) * 50.0)
        phase = 2 * math.pi * 100.0 * math.pow(tau, 5.0/8.0)
        strain = A * math.cos(phase)
    else:
        strain = 0.0
    print(f"{t:.6f},{strain:.3e}")
    t += dt
PY_CSV

cat > backend/static/index.html <<'EOF_HTML'
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GW Viz - Ondas Gravitacionales</title>
  <link rel="stylesheet" href="/static/style.css" />
  <script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>
</head>
<body>
  <header>
    <h1>🌌 GW Viz</h1>
    <p>Visualización educativa de ondas gravitacionales (LIGO/Virgo)</p>
  </header>

  <main>
    <section class="layout">
      <div id="chart" class="card"></div>
      <aside id="detail" class="card">
        <h2>Cargando evento...</h2>
      </aside>
    </section>
    
    <section class="skymap-section card">
      <h2>Mapa del Cielo (Localización)</h2>
      <div id="skymap"></div>
    </section>
  </main>

  <script src="/static/app.js"></script>
</body>
</html>
EOF_HTML

cat > backend/static/style.css <<'EOF_CSS'
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  background: #020617;
  color: #e2e8f0;
}
header { padding: 24px 28px 8px; }
h1 { margin: 0 0 6px; font-size: 2rem; }
header p { margin: 0; color: #94a3b8; }
main { padding: 20px 28px 40px; display: grid; gap: 18px; }
.card {
  padding: 16px;
  border: 1px solid #1e293b;
  border-radius: 14px;
  background: #0f172a;
}
.layout {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 18px;
}
#chart { min-height: 400px; }
.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 20px;
}
.stat {
  background: #020617;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #1e293b;
}
.stat-label { display: block; font-size: 0.85rem; color: #94a3b8; margin-bottom: 4px; }
.stat-value { display: block; font-size: 1.2rem; font-weight: bold; color: #38bdf8; }
.skymap-section { display: flex; flex-direction: column; align-items: center; padding: 24px; }
@media (max-width: 800px) { .layout { grid-template-columns: 1fr; } }
EOF_CSS

cat > backend/static/app.js <<'EOF_JS'
const chartEl = document.getElementById('chart');
const detailEl = document.getElementById('detail');
const skymapEl = document.getElementById('skymap');

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/events/GW150914');
    const event = await res.json();
    renderDetail(event);
    renderSkyMap(event);

    const strainRes = await fetch('/api/events/GW150914/strain');
    const strain = await strainRes.json();
    renderChart(strain);
  } catch (err) {
    detailEl.innerHTML = `<p style="color:red;">Error cargando datos: ${err.message}</p>`;
  }
});

function renderDetail(event) {
  detailEl.innerHTML = `
    <h2>${event.name}</h2>
    <p><strong>Fecha:</strong> ${event.date}</p>
    <p>${event.description}</p>
    
    <div class="stat-grid">
      <div class="stat">
        <span class="stat-label">Masa 1</span>
        <span class="stat-value">${event.mass_1} M☉</span>
      </div>
      <div class="stat">
        <span class="stat-label">Masa 2</span>
        <span class="stat-value">${event.mass_2} M☉</span>
      </div>
      <div class="stat">
        <span class="stat-label">Masa Final</span>
        <span class="stat-value">${event.final_mass} M☉</span>
      </div>
      <div class="stat">
        <span class="stat-label">Energía Radiada</span>
        <span class="stat-value">${event.radiated_energy} M☉ c²</span>
      </div>
      <div class="stat">
        <span class="stat-label">Distancia</span>
        <span class="stat-value">${event.distance_mpc} Mpc</span>
      </div>
    </div>
  `;
}

function renderChart(strain) {
  const trace = {
    x: strain.map(d => d.t),
    y: strain.map(d => d.h),
    mode: 'lines',
    line: { color: '#38bdf8', width: 1.5 },
    name: 'Strain (h)'
  };

  const layout = {
    title: 'GW150914 - Strain vs Tiempo',
    xaxis: { title: 'Tiempo (s)', color: '#94a3b8', gridcolor: '#1e293b' },
    yaxis: { title: 'Strain (h)', color: '#94a3b8', gridcolor: '#1e293b' },
    paper_bgcolor: '#0f172a',
    plot_bgcolor: '#0f172a',
    font: { color: '#e2e8f0' },
    margin: { t: 40, r: 20, b: 40, l: 60 },
    hovermode: 'x unified'
  };

  Plotly.newPlot('chart', [trace], layout, { responsive: true });
}

function renderSkyMap(event) {
  skymapEl.innerHTML = `
    <svg viewBox="0 0 400 200" style="width: 100%; max-width: 600px; background: #020617; border-radius: 8px; border: 1px solid #1e293b;">
      <defs>
        <radialGradient id="skyGradient">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#020617"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#skyGradient)"/>
      
      <!-- Estrellas de fondo -->
      ${generateStars(60)}
      
      <!-- Elipse de localizacion de GW150914 -->
      <ellipse cx="200" cy="100" rx="70" ry="25" fill="rgba(239, 68, 68, 0.1)" stroke="#ef4444" stroke-width="2" stroke-dasharray="4"/>
      <text x="200" y="140" fill="#e2e8f0" text-anchor="middle" font-family="sans-serif" font-size="14">${event.location}</text>
      <text x="200" y="105" fill="#ef4444" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="bold">${event.name}</text>
    </svg>
  `;
}

function generateStars(count) {
  let stars = '';
  for (let i = 0; i < count; i++) {
    const cx = Math.random() * 400;
    const cy = Math.random() * 200;
    const r = Math.random() * 1.5;
    stars += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="white" opacity="${Math.random() * 0.8 + 0.2}"/>`;
  }
  return stars;
}
EOF_JS

cat > tests/__init__.py <<'EOF_TESTS_INIT'
EOF_TESTS_INIT

cat > tests/test_api.py <<'EOF_TESTS'
import pytest
from fastapi.testclient import TestClient

from backend.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_list_events(client):
    res = client.get("/api/events")
    assert res.status_code == 200
    assert "events" in res.json()


def test_event_detail(client):
    res = client.get("/api/events/GW150914")
    assert res.status_code == 200
    assert res.json()["id"] == "GW150914"


def test_strain_data(client):
    res = client.get("/api/events/GW150914/strain")
    assert res.status_code == 200
    data = res.json()
    assert len(data) > 100
    assert "t" in data[0] and "h" in data[0]
EOF_TESTS

echo "Scaffold de GW Viz creado correctamente."
