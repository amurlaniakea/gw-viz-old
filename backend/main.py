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
