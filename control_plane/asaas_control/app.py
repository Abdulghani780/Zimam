from __future__ import annotations

import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from .api import router
from .config import settings
from .entitlements import license_guard
from .legacy_proxy import router as legacy_proxy_router
from .storage import init_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="ASAAS Control Plane", version="1.0.0", lifespan=lifespan)
if settings.allowed_origins:
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.allowed_origins), allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.middleware("http")(license_guard)
app.include_router(router)
# Legacy /api/* passthrough — registered after /api/v1 so v1 always wins.
app.include_router(legacy_proxy_router)

# Vite builds to the repo-root dist/ (vite.config.ts outDir: ../dist) and the
# SPA references absolute asset paths (/assets/*, /theme-init.js), so the
# console is served at the origin root with an index.html fallback for
# client-side routes — registered last so /api/* always wins.
repo_root = Path(__file__).resolve().parents[2]
frontend_dist = Path(os.environ["ASAAS_FRONTEND_DIST"]) if os.environ.get("ASAAS_FRONTEND_DIST") else repo_root / "dist"
if not frontend_dist.exists():
    frontend_dist = repo_root / "frontend" / "dist"
# Packaged layout: <install>/web or <install>/bin/../web next to the exe.
if not frontend_dist.exists() and getattr(sys, "frozen", False):
    exe_dir = Path(sys.executable).resolve().parent
    for candidate in (exe_dir / "web", exe_dir.parent / "web"):
        if candidate.is_dir():
            frontend_dist = candidate
            break


@app.get("/{full_path:path}", include_in_schema=False)
async def spa(full_path: str):
    if frontend_dist.exists():
        target = (frontend_dist / full_path).resolve()
        if full_path and target.is_file() and target.is_relative_to(frontend_dist):
            return FileResponse(target)
        index = frontend_dist / "index.html"
        if index.is_file():
            return FileResponse(
                index,
                headers={
                    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
                    "X-Content-Type-Options": "nosniff",
                },
            )
    return JSONResponse(status_code=404, content={"ok": False, "error": "Console build not found. Run `npm --prefix frontend run build`."})
