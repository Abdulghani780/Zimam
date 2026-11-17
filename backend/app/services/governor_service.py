"""ASAAS v2.5 - Dynamic Resource Governor Service.
Trims working set memory of idle RDP sessions and background apps to free RAM,
backed by persistent SQLite configuration.
"""
from __future__ import annotations
import sys
import threading
import time
import psutil
from typing import Dict, Any, Optional

from ..infrastructure.db import (
    MAX_RECLAIMED_MB,
    db_get_governor_settings,
    db_save_governor_settings,
)

IS_WINDOWS = sys.platform == 'win32'
if IS_WINDOWS:
    import ctypes
    from ctypes import wintypes
    kernel32 = ctypes.windll.kernel32
    psapi = ctypes.windll.psapi


class GovernorService:
    def __init__(self):
        # Load persisted settings from SQLite
        settings = db_get_governor_settings()
        self.auto_trim: bool = settings.get('auto_trim', True)
        self.idle_threshold_mins: int = settings.get('idle_threshold_mins', 15)
        self.auto_disconnect_enabled: bool = settings.get('auto_disconnect_enabled', True)
        self.auto_disconnect_mins: int = settings.get('auto_disconnect_mins', 60)
        self.auto_logoff_enabled: bool = settings.get('auto_logoff_enabled', False)
        self.auto_logoff_hours: int = settings.get('auto_logoff_hours', 8)
        # Reclaimed memory is session-scoped: every server session starts from
        # zero and the counter is capped so a corrupt legacy value can never
        # inflate the UI again.
        self.reclaimed_mb: float = 0.0
        self.trimmed_sessions: int = 0
        self._throttled_pids: set[int] = set()

        # Background enforcement worker thread
        self._running = True
        self._worker = threading.Thread(target=self._governor_loop, daemon=True)
        self._worker.start()

    def get_status(self) -> Dict[str, Any]:
        """Returns the full Governor status, policies, and live enforcement counters."""
        try:
            from ..infrastructure.win32_wts import Win32WtsService
            active_sessions = len(Win32WtsService.list_active_sessions())
        except Exception:
            active_sessions = 0
        return {
            'ok': True,
            'enabled': True,
            'active': True,
            'auto_trim': self.auto_trim,
            'auto_trim_enabled': self.auto_trim,
            'idle_threshold_mins': self.idle_threshold_mins,
            'auto_disconnect_enabled': self.auto_disconnect_enabled,
            'auto_disconnect_mins': self.auto_disconnect_mins,
            'auto_logoff_enabled': self.auto_logoff_enabled,
            'auto_logoff_hours': self.auto_logoff_hours,
            'reclaimed_mb': round(self.reclaimed_mb, 1),
            'total_reclaimed_mb': round(self.reclaimed_mb, 1),
            'session_scoped': True,
            'max_reclaimed_mb': MAX_RECLAIMED_MB,
            'trimmed_sessions': self.trimmed_sessions,
            'throttled_pids': len(self._throttled_pids),
            'active_sessions': active_sessions,
        }

    def update_settings(self, new_settings: Dict[str, Any]) -> Dict[str, Any]:
        """Updates and persists governor policies in SQLite."""
        if 'auto_trim' in new_settings:
            self.auto_trim = bool(new_settings['auto_trim'])
        if 'idle_threshold_mins' in new_settings:
            self.idle_threshold_mins = max(1, int(new_settings['idle_threshold_mins']))
        if 'auto_disconnect_enabled' in new_settings:
            self.auto_disconnect_enabled = bool(new_settings['auto_disconnect_enabled'])
        if 'auto_disconnect_mins' in new_settings:
            self.auto_disconnect_mins = max(5, int(new_settings['auto_disconnect_mins']))
        if 'auto_logoff_enabled' in new_settings:
            self.auto_logoff_enabled = bool(new_settings['auto_logoff_enabled'])
        if 'auto_logoff_hours' in new_settings:
            self.auto_logoff_hours = max(1, int(new_settings['auto_logoff_hours']))

        to_save = {
            'auto_trim': self.auto_trim,
            'idle_threshold_mins': self.idle_threshold_mins,
            'auto_disconnect_enabled': self.auto_disconnect_enabled,
            'auto_disconnect_mins': self.auto_disconnect_mins,
            'auto_logoff_enabled': self.auto_logoff_enabled,
            'auto_logoff_hours': self.auto_logoff_hours,
        }
        db_save_governor_settings(to_save)
        return self.get_status()

    def _add_reclaimed(self, mb: float) -> None:
        """Adds reclaimed MB to the current session, capped at a sane limit."""
        self.reclaimed_mb = min(
            MAX_RECLAIMED_MB,
            round(self.reclaimed_mb + max(0.0, float(mb)), 1),
        )

    def trim_process(self, pid: int) -> int:
        if not IS_WINDOWS or pid <= 4:
            return 0
        try:
            h = kernel32.OpenProcess(0x0400 | 0x0100, False, pid)
            if not h:
                return 0
            try:
                mem_before = psutil.Process(pid).memory_info().rss
                kernel32.SetProcessWorkingSetSize(h, -1, -1)
                psapi.EmptyWorkingSet(h)
                mem_after = psutil.Process(pid).memory_info().rss
                freed = max(0, mem_before - mem_after)
                if freed > 0:
                    self._throttled_pids.add(pid)
                return freed
            finally:
                kernel32.CloseHandle(h)
        except Exception:
            return 0

    def quick_trim_all(self) -> Dict[str, Any]:
        """Trims memory across all accessible user processes with genuine byte calculation."""
        total_freed = 0
        count = 0
        for proc in psutil.process_iter(['pid', 'name']):
            try:
                freed = self.trim_process(proc.info['pid'])
                if freed > 0:
                    total_freed += freed
                    count += 1
            except Exception:
                pass
        mb = round(total_freed / (1024 * 1024), 1)
        self._add_reclaimed(mb)
        return {
            'ok': True,
            'reclaimed_mb': mb,
            'total_reclaimed_mb': round(self.reclaimed_mb, 1),
            'processes_trimmed': count,
            'message': f'تم استرجاع {mb} MB من الذاكرة عبر تفريغ {count} عملية بنجاح.' if mb > 0 else 'تم فحص الذاكرة - لا توجد صفحات خاملة قابلة للتفريغ حالياً.'
        }

    def trim_session(self, session_id: int) -> Dict[str, Any]:
        """Trims working sets for all processes belonging to a specific Windows session."""
        if not IS_WINDOWS:
            return {'ok': False, 'error': 'Supported on Windows only'}
        total_freed = 0
        count = 0
        sid_holder = wintypes.DWORD()
        for proc in psutil.process_iter(['pid']):
            try:
                pid = proc.info['pid']
                if pid <= 4:
                    continue
                if kernel32.ProcessIdToSessionId(pid, ctypes.byref(sid_holder)):
                    if sid_holder.value == session_id:
                        f = self.trim_process(pid)
                        if f > 0:
                            total_freed += f
                            count += 1
            except Exception:
                pass
        mb = round(total_freed / (1024 * 1024), 1)
        self._add_reclaimed(mb)
        if count > 0:
            self.trimmed_sessions += 1
        return {
            'ok': True,
            'session_id': session_id,
            'reclaimed_mb': mb,
            'processes_trimmed': count,
            'message': f'تم تفريغ ذاكرة الجلسة #{session_id} ({count} عملية) واسترجاع {mb} MB.' if mb > 0 else f'ذاكرة الجلسة #{session_id} محسنة بالفعل.'
        }

    def trim_specific(self, target_name: Optional[str] = None, pid: Optional[int] = None) -> Dict[str, Any]:
        """Trims working set of a specific process by PID or name."""
        if pid:
            freed = self.trim_process(int(pid))
            mb = round(freed / (1024 * 1024), 1)
            self._add_reclaimed(mb)
            return {
                'ok': True,
                'pid': int(pid),
                'reclaimed_mb': mb,
                'message': f'تم استرجاع {mb} MB من العملية (PID: {pid}).' if mb > 0 else f'العملية PID {pid} مفرغة بالفعل ولا توجد ذاكرة خاملة لتحريرها.'
            }

        if target_name:
            target_lower = target_name.strip().lower()
            name_aliases = {
                'sql server engine': ['sqlservr.exe', 'sql'],
                'iis worker process': ['w3wp.exe', 'iisexpress.exe'],
                'microsoft defender': ['msmpeng.exe', 'nissrv.exe', 'securityhealthservice.exe'],
                'windows search indexer': ['searchindexer.exe', 'searchhost.exe'],
            }
            match_patterns = name_aliases.get(target_lower, [target_lower])

            total_freed = 0
            trimmed_count = 0
            for proc in psutil.process_iter(['pid', 'name']):
                try:
                    pname = (proc.info['name'] or '').lower()
                    if any(pat in pname for pat in match_patterns):
                        f = self.trim_process(proc.info['pid'])
                        if f > 0:
                            total_freed += f
                            trimmed_count += 1
                except Exception:
                    pass

            mb = round(total_freed / (1024 * 1024), 1)
            self._add_reclaimed(mb)
            return {
                'ok': True,
                'target': target_name,
                'reclaimed_mb': mb,
                'processes_trimmed': trimmed_count,
                'message': f'تم تفريغ ذاكرة [{target_name}] واسترجاع {mb} MB بنجاح.' if mb > 0 else f'ذاكرة [{target_name}] محسنة بالكامل بالفعل.'
            }

        return self.quick_trim_all()

    def _governor_loop(self):
        """Automated background enforcement loop running every 60 seconds."""
        while self._running:
            time.sleep(60)
            if not self.auto_trim:
                continue
            try:
                # If host RAM > 70%, perform background working set trim
                vm = psutil.virtual_memory()
                if vm.percent > 70:
                    self.quick_trim_all()
            except Exception:
                pass
