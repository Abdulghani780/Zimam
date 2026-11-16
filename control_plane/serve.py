"""Packaged/dev entrypoint for the ASAAS control plane.

Equivalent to `uvicorn asaas_control.app:app --host 127.0.0.1 --port 8876`,
but usable as a PyInstaller entry script and Windows service target.
"""
from __future__ import annotations

import os

import uvicorn

from asaas_control.app import app


def main() -> None:
    host = os.getenv("ASAAS_HOST", "127.0.0.1")
    port = int(os.getenv("ASAAS_CP_PORT", "8876"))
    uvicorn.run(app, host=host, port=port, log_level=os.getenv("ASAAS_LOG_LEVEL", "info"))


if __name__ == "__main__":
    main()
