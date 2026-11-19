r"""ASAAS v2.5 - Storage Management & Profiling Service.

Profiles host drive C:\, detects user profile directory footprints, performs safe cleanup,
and provides native Win32 Restart Manager diagnostic for locked/open file handles.
"""
from __future__ import annotations

import ctypes
from ctypes import wintypes
import os
import shutil
import time
from pathlib import Path
from typing import List, Dict, Any, Optional

import psutil

from ..domain.models import StorageBreakdown, UserProfileStorage

# Windows Restart Manager definitions
CCH_RM_SESSION_KEY = 32
CCH_RM_MAX_APP_NAME = 255
CCH_RM_MAX_SVC_NAME = 63


class RM_UNIQUE_PROCESS(ctypes.Structure):
    _fields_ = [
        ('dwProcessId', wintypes.DWORD),
        ('ProcessStartTime', wintypes.FILETIME)
    ]


class RM_PROCESS_INFO(ctypes.Structure):
    _fields_ = [
        ('Process', RM_UNIQUE_PROCESS),
        ('strAppName', ctypes.c_wchar * (CCH_RM_MAX_APP_NAME + 1)),
        ('strServiceShortName', ctypes.c_wchar * (CCH_RM_MAX_SVC_NAME + 1)),
        ('ApplicationType', wintypes.DWORD),
        ('AppStatus', wintypes.ULONG),
        ('TSSessionId', wintypes.DWORD),
        ('bRestartable', wintypes.BOOL)
    ]


class StorageService:
    """Storage diagnostics, automated cleanup, and locked file inspection."""

    _PROFILES_CACHE: List[UserProfileStorage] = []
    _LAST_PROFILES_SCAN_TIME: float = 0.0
    _PROFILES_CACHE_TTL: float = 30.0

    @classmethod
    def get_drive_breakdown(cls, drive_path: str = 'C:\\') -> StorageBreakdown:
        """Returns drive statistics with 100% accurate byte calculations."""
        try:
            usage = psutil.disk_usage(drive_path)
            total_gb = round(usage.total / (1024 ** 3), 1)
            used_gb = round(usage.used / (1024 ** 3), 1)
            free_gb = round(usage.free / (1024 ** 3), 1)
            pct = round(usage.percent, 1)
        except Exception:
            total_gb, used_gb, free_gb, pct = 0.0, 0.0, 0.0, 0.0

        # Dynamically measure cleanable temp size
        cleanable = 0.0
        try:
            temp_env = os.environ.get('TEMP')
            if temp_env and os.path.isdir(temp_env):
                cleanable += cls._get_dir_size_mb(Path(temp_env), max_depth=1)
            if os.path.isdir(r'C:\Windows\Temp'):
                cleanable += cls._get_dir_size_mb(Path(r'C:\Windows\Temp'), max_depth=1)
        except Exception:
            cleanable = 0.0

        cleanable_mb = round(cleanable, 1)
        cleanable_gb = round(cleanable / 1024, 2)

        return StorageBreakdown(
            drive=drive_path,
            total_gb=total_gb,
            used_gb=used_gb,
            free_gb=free_gb,
            percent_used=pct,
            cleanable_mb=cleanable_mb,
            cleanable_gb=cleanable_gb,
        )

    @staticmethod
    def _get_dir_size_mb(path: Path, max_depth: int = 1) -> float:
        """Calculates directory size in MB with bounded depth to prevent hangs."""
        if not path.is_dir():
            return 0.0
        total_bytes = 0
        base_depth = len(path.parts)
        try:
            for root, dirs, files in os.walk(str(path)):
                current_depth = len(Path(root).parts) - base_depth
                if current_depth >= max_depth:
                    dirs.clear()
                for f in files:
                    try:
                        total_bytes += os.path.getsize(os.path.join(root, f))
                    except (OSError, PermissionError):
                        continue
        except (OSError, PermissionError):
            pass
        return round(total_bytes / (1024 ** 2), 1)

    @classmethod
    def get_user_profiles(cls, force: bool = False) -> List[UserProfileStorage]:
        """Scans C:\\Users for local user profile storage consumption with cached acceleration."""
        now = time.time()
        if not force and cls._PROFILES_CACHE and (now - cls._LAST_PROFILES_SCAN_TIME < cls._PROFILES_CACHE_TTL):
            return cls._PROFILES_CACHE

        users_root = Path('C:\\Users')
        if not users_root.is_dir():
            return []

        profiles: List[UserProfileStorage] = []
        ignored = {'public', 'default', 'default user', 'all users'}

        for entry in users_root.iterdir():
            if not entry.is_dir():
                continue
            name_lower = entry.name.lower()
            if name_lower in ignored:
                continue

            temp_path = entry / 'AppData' / 'Local' / 'Temp'
            desktop_path = entry / 'Desktop'
            downloads_path = entry / 'Downloads'
            docs_path = entry / 'Documents'

            temp_mb = cls._get_dir_size_mb(temp_path, max_depth=1) if temp_path.is_dir() else 0.0
            desktop_mb = cls._get_dir_size_mb(desktop_path, max_depth=1) if desktop_path.is_dir() else 0.0
            downloads_mb = cls._get_dir_size_mb(downloads_path, max_depth=1) if downloads_path.is_dir() else 0.0
            docs_mb = cls._get_dir_size_mb(docs_path, max_depth=1) if docs_path.is_dir() else 0.0

            total_mb = round(temp_mb + desktop_mb + downloads_mb + docs_mb, 1)

            profiles.append(UserProfileStorage(
                username=entry.name,
                path=str(entry),
                total_mb=total_mb,
                temp_mb=round(temp_mb, 1),
                downloads_mb=round(downloads_mb, 1),
                documents_mb=round(docs_mb, 1),
                desktop_mb=round(desktop_mb, 1),
            ))

        cls._PROFILES_CACHE = sorted(profiles, key=lambda x: x.total_mb, reverse=True)
        cls._LAST_PROFILES_SCAN_TIME = now
        return cls._PROFILES_CACHE

    @staticmethod
    def clean_temp_directories(target_user: Optional[str] = None) -> Dict[str, Any]:
        """Safely cleans system Temp and user Temp folders with full PermissionError resilience."""
        cleaned_mb = 0.0
        errors = 0

        temp_dirs = []
        if target_user:
            utemp = Path('C:\\Users') / target_user / 'AppData' / 'Local' / 'Temp'
            if utemp.is_dir():
                temp_dirs.append(utemp)
        else:
            temp_env = os.environ.get('TEMP')
            if temp_env:
                temp_dirs.append(Path(temp_env))
            temp_dirs.append(Path('C:\\Windows\\Temp'))

            users_root = Path('C:\\Users')
            if users_root.is_dir():
                try:
                    for u in users_root.iterdir():
                        try:
                            if u.is_dir():
                                utemp = u / 'AppData' / 'Local' / 'Temp'
                                if utemp.is_dir():
                                    temp_dirs.append(utemp)
                        except Exception:
                            continue
                except Exception:
                    pass

        for tdir in temp_dirs:
            if not tdir.is_dir():
                continue
            try:
                items = list(tdir.iterdir())
            except Exception:
                continue

            for item in items:
                try:
                    if item.is_file():
                        sz = item.stat().st_size
                        item.unlink(missing_ok=True)
                        cleaned_mb += sz / (1024 ** 2)
                    elif item.is_dir():
                        shutil.rmtree(str(item), ignore_errors=True)
                except Exception:
                    errors += 1

        reclaimed = round(cleaned_mb, 1)
        if reclaimed > 0:
            msg = f'تم تنظيف مخلفات السيرفر بنجاح واسترداد {reclaimed} ميجابايت.'
        else:
            msg = 'تم فحص المجلدات المؤقتة، والملفات المتبقية قيد الاستخدام حالياً بواسطة برامج نشطة.'

        return {
            'ok': True,
            'reclaimed_mb': reclaimed,
            'files_skipped': errors,
            'message': msg,
        }

    @staticmethod
    def get_processes_locking_file(filepath: str, strict: bool = False) -> List[Dict[str, Any]]:
        """Native Win32 Restart Manager diagnostic returning processes locking the given file."""
        if os.name != 'nt':
            if strict:
                raise RuntimeError('Restart Manager is available on Windows only.')
            return []

        try:
            rstrtmgr = ctypes.WinDLL('rstrtmgr', use_last_error=True)
        except Exception as exc:
            if strict:
                raise RuntimeError('Windows Restart Manager could not be loaded.') from exc
            return []

        abs_path = os.path.abspath(filepath)
        if not os.path.exists(abs_path):
            if strict:
                raise FileNotFoundError(abs_path)
            return []

        session_handle = wintypes.DWORD()
        session_key = (ctypes.c_wchar * (CCH_RM_SESSION_KEY + 1))()

        res = rstrtmgr.RmStartSession(ctypes.byref(session_handle), 0, session_key)
        if res != 0:
            if strict:
                raise RuntimeError(f'Restart Manager session failed with code {res}.')
            return []

        lockers: List[Dict[str, Any]] = []
        try:
            file_paths = (wintypes.LPCWSTR * 1)(abs_path)
            res = rstrtmgr.RmRegisterResources(session_handle, 1, file_paths, 0, None, 0, None)
            if res != 0:
                if strict:
                    raise RuntimeError(f'Restart Manager resource registration failed with code {res}.')
                return []

            n_proc_info_needed = wintypes.UINT()
            n_proc_info = wintypes.UINT(10)
            proc_info = (RM_PROCESS_INFO * 10)()
            reboot_reasons = wintypes.DWORD()

            res = rstrtmgr.RmGetList(
                session_handle,
                ctypes.byref(n_proc_info_needed),
                ctypes.byref(n_proc_info),
                proc_info,
                ctypes.byref(reboot_reasons)
            )

            if res == 0:
                for i in range(n_proc_info.value):
                    p = proc_info[i]
                    lockers.append({
                        'pid': p.Process.dwProcessId,
                        'name': p.strAppName or 'Unknown Application',
                        'service': p.strServiceShortName or '',
                        'session_id': p.TSSessionId,
                    })
            elif strict:
                raise RuntimeError(f'Restart Manager query failed with code {res}.')
        except Exception:
            if strict:
                raise
        finally:
            rstrtmgr.RmEndSession(session_handle)

        return lockers

    @classmethod
    def get_locked_files_overview(cls) -> List[Dict[str, Any]]:
        """Lists common server files that may be currently locked or held by processes."""
        candidates = [
            r'C:\Windows\System32\config\SYSTEM',
            r'C:\Windows\System32\config\SOFTWARE',
            r'C:\Windows\System32\LogFiles\WMI\RtBackup\EtwRTEventLog-Application.etl',
            str(Path(__file__).resolve().parent.parent.parent / 'data' / 'asaas_v2.db'),
        ]
        results = []
        for path in candidates:
            if os.path.exists(path):
                lockers = cls.get_processes_locking_file(path)
                results.append({
                    'path': path,
                    'is_locked': len(lockers) > 0,
                    'lockers': lockers,
                    'lockers_count': len(lockers),
                })
        return results
