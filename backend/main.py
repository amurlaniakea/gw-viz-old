from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent
SITE_DIR = BASE_DIR.parent / "site"


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
    # Servimos el index.html desde la carpeta site/
    index_file = SITE_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "Frontend not found in site/"}


# Montar assets estáticos de site/ (css, js, etc.)
if SITE_DIR.exists():
    app.mount("/", StaticFiles(directory=SITE_DIR, html=True), name="site")
