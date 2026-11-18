from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="GW Lab",
    version="0.4.0",
    description="Herramienta científica local para ondas gravitacionales.",
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


@app.get("/", include_in_schema=False)
def index():
    if STATIC_DIR.exists() and (STATIC_DIR / "index.html").exists():
        return FileResponse(STATIC_DIR / "index.html")
    return {"message": "Frontend not found."}


if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
