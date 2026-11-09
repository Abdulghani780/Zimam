"""ASAAS Server Control v2.5 - Domain Models & DTOs
Strict, strongly-typed domain representations guaranteeing 100% contract alignment
between the Windows Server backend and the React frontend.
"""
from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional

@dataclass
class HostMetrics:
    cpu: float
    cpu_cores: int
    cpu_per_core: List[float]
    ram: float
    used_ram: float
    total_ram: float
    os: str
    hostname: str
    uptime_sec: int
    is_windows: bool = True
    is_admin: bool = False
    disk_total_gb: float = 0.0
    disk_used_gb: float = 0.0
    disk_free_gb: float = 0.0
    disk_percent: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        hours = self.uptime_sec // 3600
        mins = (self.uptime_sec % 3600) // 60
        uptime_human = f"{hours} س و {mins} د"
        return {
            'cpu': round(self.cpu, 1),
            'cpu_percent': round(self.cpu, 1),
            'cpuCores': self.cpu_cores,
            'cpu_cores': self.cpu_cores,
            'cpuPerCore': [round(c, 1) for c in self.cpu_per_core],
            'cpu_per_core': [round(c, 1) for c in self.cpu_per_core],
            'ram': round(self.ram, 1),
            'ram_percent': round(self.ram, 1),
            'usedRam': round(self.used_ram, 1),
            'used_ram': round(self.used_ram, 1),
            'used_ram_gb': round(self.used_ram, 1),
            'totalRam': round(self.total_ram, 1),
            'total_ram': round(self.total_ram, 1),
            'total_ram_gb': round(self.total_ram, 1),
            'free_ram_gb': round(max(0.0, self.total_ram - self.used_ram), 1),
            'disk': {
                'total': round(self.disk_total_gb, 1),
                'used': round(self.disk_used_gb, 1),
                'free': round(self.disk_free_gb, 1),
                'percent': round(self.disk_percent, 1),
            },
            'disk_total_gb': round(self.disk_total_gb, 1),
            'disk_used_gb': round(self.disk_used_gb, 1),
            'disk_free_gb': round(self.disk_free_gb, 1),
            'disk_percent': round(self.disk_percent, 1),
            'os': self.os,
            'os_name': self.os,
            'hostname': self.hostname,
            'uptimeSec': self.uptime_sec,
            'uptime_sec': self.uptime_sec,
            'uptime_human': uptime_human,
            'isWindows': self.is_windows,
            'is_windows': self.is_windows,
            'isAdmin': self.is_admin,
            'is_admin': self.is_admin,
        }

@dataclass
class UserSession:
    id: int
    user: str
    station: str
    state: str
    ram_mb: float = 0.0
    idle_time: Optional[str] = None
    login_time: Optional[str] = None
    processes_count: int = 0
    is_current: bool = False

    @property
    def username(self) -> str:
        return self.user

    @property
    def session_id(self) -> int:
        return self.id

    def to_dict(self) -> Dict[str, Any]:
        ram_gb = round(self.ram_mb / 1024, 2)
        ram_disp = f"{ram_gb} GB" if ram_gb >= 1.0 else f"{int(self.ram_mb)} MB" if self.ram_mb > 0 else "—"
        return {
            'id': self.id,
            'session_id': self.id,
            'sessionId': self.id,
            'user': self.user,
            'username': self.user,
            'station': self.station,
            'win_station': self.station,
            'state': self.state,
            'status': self.state,
            'ram_mb': round(self.ram_mb, 1),
            'ram': ram_gb if ram_gb > 0 else round(self.ram_mb, 1),
            'ram_gb': ram_gb,
            'ram_formatted': ram_disp,
            'idle_time': self.idle_time or 'نشط الآن',
            'idle_formatted': self.idle_time or 'نشط الآن',
            'idle': self.idle_time or 'نشط الآن',
            'login_time': self.login_time or 'الآن',
            'login': self.login_time or 'الآن',
            'processes_count': self.processes_count,
            'procs': self.processes_count,
            'is_current': self.is_current,
        }

@dataclass
class LocalUser:
    username: str
    full_name: str
    enabled: bool
    is_rdp: bool
    is_admin: bool
    password_age_days: int = 0
    description: str = ''
    last_logon: Optional[str] = None
    is_current: bool = False
    is_protected: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            'username': self.username,
            'full_name': self.full_name,
            'enabled': self.enabled,
            'is_rdp': self.is_rdp,
            'is_admin': self.is_admin,
            'password_age_days': self.password_age_days,
            'description': self.description,
            'lastLogon': self.last_logon,
            'is_current': self.is_current,
            'is_protected': self.is_protected,
            # Dual compatibility keys so frontend never fails
            'name': self.username,
            'fullName': self.full_name,
            'isRdp': self.is_rdp,
            'isAdmin': self.is_admin,
        }

@dataclass
class StorageBreakdown:
    drive: str
    total_gb: float
    used_gb: float
    free_gb: float
    percent_used: float
    cleanable_mb: float
    cleanable_gb: float
    categories: List[Dict[str, Any]] = field(default_factory=list)
    heavy_items: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'ok': True,
            'drive': self.drive,
            'total_gb': round(self.total_gb, 1),
            'used_gb': round(self.used_gb, 1),
            'free_gb': round(self.free_gb, 1),
            'percent_used': round(self.percent_used, 1),
            'cleanable_mb': round(self.cleanable_mb, 1),
            'cleanable_gb': round(self.cleanable_gb, 2),
            'categories': self.categories,
            'heavy_items': self.heavy_items,
            # Compatibility keys for older UI adapters
            'total': round(self.total_gb, 1),
            'used': round(self.used_gb, 1),
            'free': round(self.free_gb, 1),
            'percent': round(self.percent_used, 1),
        }

@dataclass
class UserProfileStorage:
    username: str
    path: str
    total_mb: float
    temp_mb: float
    downloads_mb: float = 0.0
    documents_mb: float = 0.0
    desktop_mb: float = 0.0

    @property
    def size_mb(self) -> float:
        return self.total_mb

    @property
    def temp_size_mb(self) -> float:
        return self.temp_mb

    def to_dict(self) -> Dict[str, Any]:
        return {
            'username': self.username,
            'path': self.path,
            'total_mb': round(self.total_mb, 1),
            'temp_mb': round(self.temp_mb, 1),
            'downloads_mb': round(self.downloads_mb, 1),
            'documents_mb': round(self.documents_mb, 1),
            'desktop_mb': round(self.desktop_mb, 1),
            # Compatibility keys
            'size_mb': round(self.total_mb, 1),
            'temp_size_mb': round(self.temp_mb, 1),
        }

@dataclass
class ManagedAsset:
    id: str
    name: str
    host: str
    type: str
    port: int
    protocol: str = 'RDP'
    status: str = 'online'
    latency_ms: float = 1.2
    category: str = 'Windows Core Server'
    is_local: bool = False
    tags: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'host': self.host,
            'address': self.host,
            'type': self.type,
            'platform': 'windows' if 'win' in self.type.lower() else 'ubuntu',
            'platform_display': self.type,
            'port': self.port,
            'protocol': self.protocol,
            'status': self.status,
            'latency_ms': self.latency_ms,
            'category': self.category,
            'is_local': self.is_local,
            'tags': self.tags,
        }

@dataclass
class PortClaim:
    port: int
    user: str
    session_id: int
    project_name: str
    process_name: str
    pid: int
    timestamp: float

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
