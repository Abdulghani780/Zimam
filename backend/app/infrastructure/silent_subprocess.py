"""ZIMAM v2.5 - Silent Subprocess Execution.
Guarantees 100% invisible CLI execution on Windows without creating any
flashing CMD / console / conhost windows.
"""
from __future__ import annotations
import sys
import subprocess
from typing import Any, Dict, List

IS_WINDOWS = sys.platform == 'win32'
CREATE_NO_WINDOW = 0x08000000 if IS_WINDOWS else 0

def get_silent_kwargs() -> Dict[str, Any]:
    kwargs: Dict[str, Any] = {}
    if IS_WINDOWS:
        kwargs['creationflags'] = CREATE_NO_WINDOW
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        startupinfo.wShowWindow = 0  # SW_HIDE
        kwargs['startupinfo'] = startupinfo
        kwargs['stdin'] = subprocess.DEVNULL
    return kwargs

def run_silent(cmd: List[str], **kwargs) -> subprocess.CompletedProcess:
    silent = get_silent_kwargs()
    for k, v in silent.items():
        if k not in kwargs:
            kwargs[k] = v
        elif k == 'creationflags':
            kwargs[k] = kwargs[k] | v
    if kwargs.get('text') or kwargs.get('capture_output'):
        if 'errors' not in kwargs:
            kwargs['errors'] = 'replace'
    return subprocess.run(cmd, **kwargs)

def popen_silent(cmd: List[str], **kwargs) -> subprocess.Popen:
    silent = get_silent_kwargs()
    for k, v in silent.items():
        if k not in kwargs:
            kwargs[k] = v
        elif k == 'creationflags':
            kwargs[k] = kwargs[k] | v
    if kwargs.get('text') or kwargs.get('capture_output'):
        if 'errors' not in kwargs:
            kwargs['errors'] = 'replace'
    return subprocess.Popen(cmd, **kwargs)
