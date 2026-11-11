from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api import router
from .config import settings
from .storage import init_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="ASAAS Control Plane", version="1.0.0", lifespan=lifespan)
if settings.allowed_origins:
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.allowed_origins), allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(router)

frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/console", StaticFiles(directory=frontend_dist, html=True), name="console")
