"""ASAAS v2 - Telemetry & System Monitoring Service.

Provides instant system metrics, per-core utilization history, and active sessions.
Uses native Win32 APIs and psutil for zero-subprocess, low-overhead performance.
Enriches telemetry with GNOME/Ubuntu System Monitor 4-panel metrics:
1. CPU Multi-core Oscilloscope
2. Memory & Swap Oscilloscope
3. Network RX/TX Oscilloscope
4. Disk Read/Write Oscilloscope
"""
from __future__ import annotations

import collections
import logging
import os
import platform
import socket
import threading
import time
from typing import Dict, List, Any, Optional

import psutil

from ..domain.models import HostMetrics, UserSession
from ..infrastructure.win32_wts import Win32WtsService


class TelemetryService:
    """Enterprise telemetry aggregator with real-time rolling 4-panel oscilloscope buffer."""

    def __init__(self, history_seconds: int = 60) -> None:
        self._history_seconds = history_seconds
        self._core_count = psutil.cpu_count(logical=True) or 8
        self._physical_cores = psutil.cpu_count(logical=False) or 4
        
        self._history_lock = threading.Lock()
        
        # 1. CPU ring buffer per core
        self._core_history: Dict[int, collections.deque] = {
            i: collections.deque(maxlen=self._history_seconds)
            for i in range(self._core_count)
        }
        self._timestamps: collections.deque = collections.deque(maxlen=self._history_seconds)
        
        # 2. Memory & Swap ring buffers
        self._mem_pct_history: collections.deque = collections.deque(maxlen=self._history_seconds)
        self._swap_pct_history: collections.deque = collections.deque(maxlen=self._history_seconds)
        
        # 3. Network ring buffers (KB/s)
        self._net_rx_history: collections.deque = collections.deque(maxlen=self._history_seconds)
        self._net_tx_history: collections.deque = collections.deque(maxlen=self._history_seconds)
        
        # 4. Disk ring buffers (KB/s)
        self._disk_read_history: collections.deque = collections.deque(maxlen=self._history_seconds)
        self._disk_write_history: collections.deque = collections.deque(maxlen=self._history_seconds)

        # Baseline counters for rate derivation
        self._last_sample_time = time.time()
        self._last_net = psutil.net_io_counters()
        self._last_disk = psutil.disk_io_counters()

        # Rates cache
        self._current_net_rx_rate = 0.0
        self._current_net_tx_rate = 0.0
        self._current_disk_read_rate = 0.0
        self._current_disk_write_rate = 0.0
        self._db_counter = 0

        # Live process/service inventory cache (kept short so SSE stays fresh
        # without re-enumerating the SCM on every frame).
        self._inventory_lock = threading.Lock()
        self._inventory_ts = 0.0
        self._inventory_cache: Dict[str, Any] = {'processes': [], 'services': []}
        self._cleanup_counter = 0

        # Boot & Initialization
        psutil.cpu_percent(percpu=True)
        self._boot_time = psutil.boot_time()

        # Background collector thread
        self._running = True
        self._worker_thread = threading.Thread(target=self._collector_loop, daemon=True)
        self._worker_thread.start()

    def _collector_loop(self) -> None:
        """Background thread sampling all 4 system resources every 1.0 second."""
        while self._running:
            try:
                now = time.time()
                dt = max(0.5, now - self._last_sample_time)
                self._last_sample_time = now

                # 1. CPU per core
                per_core = psutil.cpu_percent(interval=1.0, percpu=True)
                now_str = time.strftime('%H:%M:%S')

                # 2. Memory & Swap
                mem = psutil.virtual_memory()
                swap = psutil.swap_memory()
                mem_pct = round(mem.percent, 1)
                swap_pct = round(swap.percent, 1)

                # 3. Network rates (KB/s)
                net_now = psutil.net_io_counters()
                if self._last_net:
                    rx_bytes = max(0, net_now.bytes_recv - self._last_net.bytes_recv)
                    tx_bytes = max(0, net_now.bytes_sent - self._last_net.bytes_sent)
                    rx_rate_kb = round((rx_bytes / dt) / 1024, 1)
                    tx_rate_kb = round((tx_bytes / dt) / 1024, 1)
                else:
                    rx_rate_kb = 0.0
                    tx_rate_kb = 0.0
                self._last_net = net_now
                self._current_net_rx_rate = rx_rate_kb
                self._current_net_tx_rate = tx_rate_kb

                # 4. Disk rates (KB/s)
                disk_now = psutil.disk_io_counters()
                if self._last_disk and disk_now:
                    r_bytes = max(0, disk_now.read_bytes - self._last_disk.read_bytes)
                    w_bytes = max(0, disk_now.write_bytes - self._last_disk.write_bytes)
                    r_rate_kb = round((r_bytes / dt) / 1024, 1)
                    w_rate_kb = round((w_bytes / dt) / 1024, 1)
                else:
                    r_rate_kb = 0.0
                    w_rate_kb = 0.0
                self._last_disk = disk_now
                self._current_disk_read_rate = r_rate_kb
                self._current_disk_write_rate = w_rate_kb

                with self._history_lock:
                    self._timestamps.append(now_str)
                    for i, pct in enumerate(per_core):
                        if i in self._core_history:
                            self._core_history[i].append(round(pct, 1))
                    self._mem_pct_history.append(mem_pct)
                    self._swap_pct_history.append(swap_pct)
                    self._net_rx_history.append(rx_rate_kb)
                    self._net_tx_history.append(tx_rate_kb)
                    self._disk_read_history.append(r_rate_kb)
                    self._disk_write_history.append(w_rate_kb)

                # Periodic Historical Metric Recording & Alerting (Story 5 & 6)
                self._db_counter += 1
                if self._db_counter >= 30:
                    self._db_counter = 0
                    try:
                        from ..infrastructure.db import db_record_metric
                        from .alert_service import AlertService
                        disk_usage = psutil.disk_usage('C:\\')
                        avg_cpu = sum(per_core) / max(1, len(per_core))
                        sess_count = max(1, len(Win32WtsService.list_active_sessions()))
                        db_record_metric(
                            cpu=avg_cpu,
                            ram=mem_pct,
                            ram_used_gb=(mem.total - mem.available) / (1024 ** 3),
                            disk_used_gb=disk_usage.used / (1024 ** 3),
                            active_sessions=sess_count,
                        )
                        AlertService.evaluate_telemetry_thresholds(avg_cpu, mem_pct, disk_usage.percent)
                        connections = collections.Counter(
                            conn.raddr.ip
                            for conn in psutil.net_connections(kind='tcp')
                            if conn.raddr and conn.status in {'ESTABLISHED', 'SYN_SENT', 'SYN_RECV'}
                        )
                        AlertService.evaluate_port_flood(dict(connections))
                        if os.name == 'nt':
                            services = {
                                service.name(): service.status()
                                for service in psutil.win_service_iter()
                                if service.name().lower() in {'termservice', 'mssqlserver', 'w3svc'}
                            }
                            AlertService.evaluate_critical_services(services)
                    except Exception:
                        logger = logging.getLogger('asaas.telemetry')
                        logger.exception("Failed to persist metrics or evaluate alert rules")

                self._cleanup_counter += 1
                if self._cleanup_counter >= 3600:
                    self._cleanup_counter = 0
                    try:
                        from ..infrastructure.db import db_cleanup_old_metrics
                        db_cleanup_old_metrics(7)
                    except Exception:
                        pass



            except Exception:
                time.sleep(1.0)

    def get_metrics(self) -> HostMetrics:
        """Collects an instantaneous snapshot of system metrics."""
        # CPU: extract latest values directly from the background collector history
        with self._history_lock:
            if self._core_history and any(len(h) > 0 for h in self._core_history.values()):
                per_core = [
                    self._core_history[i][-1] if (i in self._core_history and len(self._core_history[i]) > 0) else 0.0
                    for i in range(self._core_count)
                ]
                overall_cpu = round(sum(per_core) / max(1, len(per_core)), 1)
            else:
                per_core = [round(x, 1) for x in psutil.cpu_percent(interval=0.1, percpu=True)]
                overall_cpu = round(sum(per_core) / max(1, len(per_core)), 1)
        
        # Memory
        mem = psutil.virtual_memory()
        total_gb = round(mem.total / (1024 ** 3), 1)
        used_gb = round((mem.total - mem.available) / (1024 ** 3), 1)
        free_gb = round(mem.available / (1024 ** 3), 1)
        mem_pct = round(mem.percent, 1)

        # Uptime
        uptime_seconds = int(time.time() - self._boot_time)

        # OS Information
        os_info = f"{platform.system()} {platform.release()} (Build {platform.version()})"
        hostname = socket.gethostname()

        # Disk Drive C:
        disk_total_gb, disk_used_gb, disk_free_gb, disk_pct = 0.0, 0.0, 0.0, 0.0
        try:
            d = psutil.disk_usage('C:\\')
            disk_total_gb = d.total / (1024 ** 3)
            disk_used_gb = d.used / (1024 ** 3)
            disk_free_gb = d.free / (1024 ** 3)
            disk_pct = d.percent
        except Exception:
            pass

        return HostMetrics(
            cpu=overall_cpu,
            cpu_cores=self._core_count,
            cpu_per_core=per_core,
            ram=mem_pct,
            used_ram=used_gb,
            total_ram=total_gb,
            os=os_info,
            hostname=hostname,
            uptime_sec=uptime_seconds,
            is_windows=True,
            is_admin=Win32WtsService.is_admin(),
            disk_total_gb=disk_total_gb,
            disk_used_gb=disk_used_gb,
            disk_free_gb=disk_free_gb,
            disk_percent=disk_pct,
        )

    def get_live_inventory(self, force: bool = False) -> Dict[str, Any]:
        """Returns the live top-process and service inventory used by snapshot/SSE.

        The SCM enumeration is cached for two seconds to keep the one-second
        SSE cadence cheap while still reflecting real state changes quickly.
        """
        now = time.time()
        with self._inventory_lock:
            if (
                not force
                and self._inventory_ts > 0
                and (now - self._inventory_ts) < 2.0
                and (self._inventory_cache.get('processes') or self._inventory_cache.get('services'))
            ):
                return {
                    'processes': list(self._inventory_cache.get('processes', [])),
                    'services': list(self._inventory_cache.get('services', [])),
                }

        processes: List[Dict[str, Any]] = []
        services: List[Dict[str, Any]] = []

        try:
            _, _, top_procs = Win32WtsService.list_processes_and_session_stats()
            processes = list(top_procs or [])[:30]
        except Exception:
            processes = []

        if not processes:
            try:
                proc_rows = []
                for proc in psutil.process_iter(['pid', 'name', 'username', 'memory_info']):
                    try:
                        info = proc.info
                        mem_mb = (info.get('memory_info').rss if info.get('memory_info') else 0) / (1024 * 1024)
                        if mem_mb <= 25:
                            continue
                        proc_rows.append({
                            'pid': info.get('pid', 0),
                            'name': info.get('name') or 'process',
                            'user': info.get('username') or 'system',
                            'cpu': 0.0,
                            'ram_mb': round(mem_mb, 1),
                            'ram': round(mem_mb / 1024, 2),
                            'session': 0,
                        })
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        continue
                proc_rows.sort(key=lambda item: item['ram_mb'], reverse=True)
                processes = proc_rows[:30]
            except Exception:
                processes = []

        try:
            raw_services = []
            if hasattr(psutil, 'win_service_iter'):
                for svc in list(psutil.win_service_iter())[:160]:
                    try:
                        info = svc.as_dict()
                        raw_services.append({
                            'name': info.get('name', ''),
                            'display': info.get('display_name') or info.get('name', ''),
                            'status': 'Running' if info.get('status') == 'running' else 'Stopped',
                            'startup': info.get('start_type', 'Automatic'),
                            'category': 'System',
                            'critical': info.get('name', '').lower() in (
                                'rpcss', 'dcomlaunch', 'termservice', 'lanmanserver',
                                'wuauserv', 'mpssvc', 'eventlog',
                            ),
                        })
                    except Exception:
                        continue
            raw_services.sort(key=lambda svc: (
                0 if svc['critical'] and svc['status'] == 'Running' else
                1 if svc['status'] == 'Running' else 2,
                svc['display'].lower(),
            ))
            services = raw_services[:40]
        except Exception:
            services = []

        with self._inventory_lock:
            self._inventory_cache = {'processes': processes, 'services': services}
            self._inventory_ts = time.time()
        return {'processes': processes, 'services': services}


    def get_system_history(self) -> Dict[str, Any]:
        """Returns full 4-panel system history for real-time oscilloscope graphs."""
        mem = psutil.virtual_memory()
        swap = psutil.swap_memory()
        net = psutil.net_io_counters()
        disk = psutil.disk_io_counters()

        with self._history_lock:
            return {
                'timestamps': list(self._timestamps),
                'cpu': {
                    'cores': {i: list(self._core_history[i]) for i in range(self._core_count)},
                    'core_count': self._core_count,
                    'physical_cores': self._physical_cores,
                    'latest': [
                        self._core_history[i][-1] if (i in self._core_history and len(self._core_history[i]) > 0) else 0.0
                        for i in range(self._core_count)
                    ],
                    'total': round(sum(
                        self._core_history[i][-1] if (i in self._core_history and len(self._core_history[i]) > 0) else 0.0
                        for i in range(self._core_count)
                    ) / max(1, self._core_count), 1),
                },
                'memory': {
                    'history': list(self._mem_pct_history),
                    'swap_history': list(self._swap_pct_history),
                    'total_gb': round(mem.total / (1024 ** 3), 1),
                    'used_gb': round((mem.total - mem.available) / (1024 ** 3), 1),
                    'free_gb': round(mem.available / (1024 ** 3), 1),
                    'percent': round(mem.percent, 1),
                    'swap_total_gb': round(swap.total / (1024 ** 3), 1),
                    'swap_used_gb': round(swap.used / (1024 ** 3), 1),
                    'swap_percent': round(swap.percent, 1),
                },
                'network': {
                    'rx_history': list(self._net_rx_history),
                    'tx_history': list(self._net_tx_history),
                    'rx_rate_kb': self._current_net_rx_rate,
                    'tx_rate_kb': self._current_net_tx_rate,
                    'total_recv_gb': round(net.bytes_recv / (1024 ** 3), 2),
                    'total_sent_gb': round(net.bytes_sent / (1024 ** 3), 2),
                },
                'disk': {
                    'read_history': list(self._disk_read_history),
                    'write_history': list(self._disk_write_history),
                    'read_rate_kb': self._current_disk_read_rate,
                    'write_rate_kb': self._current_disk_write_rate,
                    'total_read_gb': round((disk.read_bytes if disk else 0) / (1024 ** 3), 2),
                    'total_write_gb': round((disk.write_bytes if disk else 0) / (1024 ** 3), 2),
                }
            }

    # Backward compatibility
    def get_cpu_history(self) -> Dict[str, Any]:
        with self._history_lock:
            return {
                'timestamps': list(self._timestamps),
                'cores': {i: list(self._core_history[i]) for i in range(self._core_count)},
                'core_count': self._core_count,
                'physical_cores': self._physical_cores,
            }

    def shutdown(self) -> None:
        self._running = False
