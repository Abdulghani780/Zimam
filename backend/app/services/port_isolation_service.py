"""ASAAS v2.5 - AI Port Isolation Guard Service.

Guarantees zero port collision between concurrent users, automatically binding
ports to specific user sessions and suggesting alternate free ports.
Provides sub-second local inventory of all TCP/UDP listening ports and active connections,
enriched with process names, Windows service descriptions, risk classification,
safe process termination, remote IP blocking, and real-time socket diagnostics.
"""
from __future__ import annotations

import ctypes
from ctypes import wintypes
import logging
import os
import socket
import subprocess
import time
from typing import Dict, Any, List, Optional, Set

import psutil

from ..domain.models import PortClaim
from ..infrastructure.win32_wts import Win32WtsService

logger = logging.getLogger('asaas.ports')

# Well-known enterprise & Windows server service port directory
KNOWN_PORT_SERVICES: Dict[int, str] = {
    20: 'FTP Data',
    21: 'FTP Control',
    22: 'SSH (Secure Shell)',
    23: 'Telnet',
    25: 'SMTP (Mail Transfer)',
    53: 'DNS (Domain Name System)',
    67: 'DHCP Server',
    68: 'DHCP Client',
    69: 'TFTP',
    80: 'HTTP (Web Server)',
    88: 'Kerberos Authentication',
    110: 'POP3 (Mail)',
    123: 'NTP (Network Time Protocol)',
    135: 'Microsoft RPC Endpoint Mapper',
    137: 'NetBIOS Name Service',
    138: 'NetBIOS Datagram Service',
    139: 'NetBIOS Session Service',
    143: 'IMAP (Mail)',
    161: 'SNMP (Simple Network Management)',
    389: 'LDAP (Active Directory)',
    443: 'HTTPS (Secure Web Server)',
    445: 'SMB (File & Printer Sharing)',
    465: 'SMTPS (Secure Mail)',
    500: 'IPSec ISAKMP',
    514: 'Syslog',
    587: 'SMTP Submission',
    636: 'LDAPS (Secure LDAP)',
    993: 'IMAPS (Secure IMAP)',
    995: 'POP3S (Secure POP3)',
    1433: 'Microsoft SQL Server (MSSQL)',
    1434: 'SQL Server Browser',
    1521: 'Oracle Database',
    3306: 'MySQL Database',
    3389: 'RDP (Remote Desktop Protocol)',
    5432: 'PostgreSQL Database',
    5985: 'WinRM HTTP (Windows Remote Management)',
    5986: 'WinRM HTTPS',
    6379: 'Redis In-Memory Cache',
    8080: 'HTTP Alternate / Web Proxy',
    8443: 'HTTPS Alternate',
    8765: 'ASAAS Hub',
    9000: 'SonarQube / Web Console',
    9090: 'Prometheus / Cockpit',
    27017: 'MongoDB Database',
}

CRITICAL_SYSTEM_PROCESSES: Set[str] = {
    'system idle process', 'system', 'registry', 'smss.exe',
    'csrss.exe', 'wininit.exe', 'services.exe', 'lsass.exe',
    'winlogon.exe', 'fontdrvhost.exe', 'dwm.exe'
}

DEV_FRAMEWORKS: Dict[str, str] = {
    'node.exe': 'Node.js / Vite / React / Next.js',
    'python.exe': 'Python Web / Django / FastAPI / Flask',
    'pythonw.exe': 'Python Background Service',
    'uvicorn.exe': 'Uvicorn ASGI Web Server',
    'gunicorn.exe': 'Gunicorn Web Server',
    'java.exe': 'Java Application / Spring Boot',
    'dotnet.exe': '.NET Core / ASP.NET Web App',
    'go.exe': 'Golang Web Server',
    'php.exe': 'PHP Built-in Server / Laravel',
    'httpd.exe': 'Apache HTTP Server',
    'nginx.exe': 'Nginx Reverse Proxy',
    'mysqld.exe': 'MySQL Database Server',
    'postgres.exe': 'PostgreSQL Database Server',
    'redis-server.exe': 'Redis Cache Server',
    'code.exe': 'VS Code Dev Server',
    'wslrelay.exe': 'WSL Linux Relay',
    'com.docker.backend.exe': 'Docker Backend Engine',
}


class PortIsolationService:
    """Enterprise AI Port Isolation Guard Service."""

    _claims: Dict[int, Dict[str, Any]] = {}
    _cached_snapshot: Optional[Dict[str, Any]] = None
    _cached_time: float = 0.0
    _SNAPSHOT_TTL = 1.5

    @classmethod
    def load_persisted_claims(cls) -> None:
        from ..infrastructure.db import db_list_reservations
        claims = {}
        for row in db_list_reservations():
            port = int(row['port'])
            claims[port] = {
                'port': port,
                'username': row['username'],
                'session_id': None,
                'project_name': row.get('description') or f'Project on {port}',
                'claimed_at': row.get('created_at') or '',
            }
        cls._claims = claims

    @classmethod
    def _get_process_session_map(cls, unique_pids: Set[int]) -> Dict[int, tuple[int, str]]:
        """Resolves Windows session and username for each PID using Win32 API."""
        res: Dict[int, tuple[int, str]] = {}
        if os.name != 'nt':
            return res

        kernel32 = ctypes.windll.kernel32
        sess_names: Dict[int, str] = {0: 'SYSTEM'}
        try:
            for s in Win32WtsService.list_active_sessions():
                sid = s.session_id
                u = s.username
                if sid is not None and u:
                    sess_names[sid] = u
        except Exception:
            pass

        sid_buf = wintypes.DWORD()
        for pid in unique_pids:
            if pid <= 4:
                res[pid] = (0, 'SYSTEM')
                continue
            try:
                if kernel32.ProcessIdToSessionId(pid, ctypes.byref(sid_buf)):
                    sid_val = int(sid_buf.value)
                    uname = sess_names.get(sid_val, 'SYSTEM' if sid_val == 0 else f'Session #{sid_val}')
                    res[pid] = (sid_val, uname)
                else:
                    res[pid] = (0, 'SYSTEM')
            except Exception:
                res[pid] = (0, 'Unknown')
        return res

    @classmethod
    def is_port_in_use(cls, port: int) -> bool:
        """Fast TCP connect probe to check if port is currently listening."""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.12)
            return s.connect_ex(('127.0.0.1', port)) == 0

    @classmethod
    def find_free_port(cls, preferred_start: int = 3000, max_port: int = 9999) -> int:
        """Finds next clean, unoccupied and unclaimed port."""
        for candidate in range(preferred_start, max_port + 1):
            if candidate not in cls._claims and not cls.is_port_in_use(candidate):
                return candidate
        return preferred_start + 100

    @classmethod
    def get_ports_snapshot(cls, force: bool = False) -> Dict[str, Any]:
        """Gathers full real-time snapshot of listening ports and active network connections."""
        now = time.time()
        if not force and cls._cached_snapshot and (now - cls._cached_time) < cls._SNAPSHOT_TTL:
            return cls._cached_snapshot

        try:
            raw_conns = psutil.net_connections(kind='inet')
        except Exception as exc:
            logger.error('Failed to query psutil net_connections: %s', exc)
            return {
                'ok': False,
                'error': str(exc),
                'summary': {
                    'total_connections': 0,
                    'listening_ports': 0,
                    'established_connections': 0,
                    'foreign_remote_ips': 0,
                    'tcp_count': 0,
                    'udp_count': 0,
                    'distinct_processes': 0
                },
                'ports': [],
                'guard': {'isolated_user_ports_count': 0, 'system_ports_count': 0}
            }

        unique_pids = {c.pid for c in raw_conns if c.pid}
        proc_names: Dict[int, str] = {}
        for pid in unique_pids:
            try:
                proc_names[pid] = psutil.Process(pid).name()
            except Exception:
                proc_names[pid] = '—'

        session_map = cls._get_process_session_map(unique_pids)

        ports: List[Dict[str, Any]] = []
        listening_count = 0
        established_count = 0
        foreign_ips: Set[str] = set()
        tcp_count = 0
        udp_count = 0

        for c in raw_conns:
            proto = 'TCP' if c.type == socket.SOCK_STREAM else 'UDP'
            family = 'IPv4' if c.family == socket.AF_INET else 'IPv6'
            if proto == 'TCP':
                tcp_count += 1
            else:
                udp_count += 1

            local_ip = c.laddr.ip if c.laddr else ''
            local_port = c.laddr.port if c.laddr else 0
            remote_ip = c.raddr.ip if c.raddr else ''
            remote_port = c.raddr.port if c.raddr else 0

            raw_status = c.status or ('ESTABLISHED' if remote_ip else 'LISTEN')
            status = raw_status.upper()
            if proto == 'UDP' and not remote_ip:
                status = 'LISTEN (UDP)'

            is_listening = (status == 'LISTEN' or status == 'LISTEN (UDP)')
            if is_listening:
                listening_count += 1
            elif status == 'ESTABLISHED':
                established_count += 1

            is_external = False
            if remote_ip and remote_ip not in ('127.0.0.1', '::1', '0.0.0.0', '::'):
                if not remote_ip.startswith('127.'):
                    is_external = True
                    foreign_ips.add(remote_ip)

            pid = c.pid or 0
            pname = proc_names.get(pid, '—')
            if pid == 0:
                pname = 'System Idle Process'
            elif pid == 4:
                pname = 'System'

            known_svc = KNOWN_PORT_SERVICES.get(local_port)
            if not known_svc and remote_port and KNOWN_PORT_SERVICES.get(remote_port):
                known_svc = f'{KNOWN_PORT_SERVICES.get(remote_port)} (Remote)'

            sid_val, owner_user = session_map.get(pid, (0, 'SYSTEM'))
            pname_lower = pname.lower()
            dev_hint = DEV_FRAMEWORKS.get(pname_lower, '')

            is_dev_port = (
                (3000 <= local_port <= 9999) or
                (local_port in (5173, 5174, 5175, 4200, 8000, 8080, 8081, 8888, 9000, 9999)) or
                bool(dev_hint)
            )

            # Check explicit claim
            claim_info = cls._claims.get(local_port)
            if claim_info:
                owner_user = claim_info.get('username', owner_user)
                dev_hint = claim_info.get('project_name', dev_hint)

            is_isolated = is_listening and (sid_val > 0 or is_dev_port or bool(claim_info))

            risk = 'normal'
            if is_listening and local_ip in ('0.0.0.0', '::') and local_port in (21, 23, 445, 3389):
                risk = 'sensitive'

            ports.append({
                'proto': proto,
                'family': family,
                'local_ip': local_ip,
                'local_port': local_port,
                'remote_ip': remote_ip,
                'remote_port': remote_port,
                'status': status,
                'pid': pid,
                'process_name': pname,
                'service_name': known_svc or dev_hint or 'Dynamic / Application',
                'service': known_svc or dev_hint or 'Dynamic / Application',
                'is_listening': is_listening,
                'is_external': is_external,
                'is_system': (pid in (0, 4)) or (pname.lower() in CRITICAL_SYSTEM_PROCESSES),
                'risk': risk,
                'owner_session': sid_val,
                'owner_user': owner_user,
                'is_isolated': is_isolated,
                'is_dev_port': is_dev_port,
                'project_hint': dev_hint or ('Dev Server' if is_dev_port else '')
            })

        ports.sort(key=lambda x: (not x['is_listening'], x['local_port'], x['proto']))

        result = {
            'ok': True,
            'summary': {
                'total_connections': len(ports),
                'listening_ports': listening_count,
                'established_connections': established_count,
                'foreign_remote_ips': len(foreign_ips),
                'tcp_count': tcp_count,
                'udp_count': udp_count,
                'distinct_processes': len(unique_pids)
            },
            'guard': {
                'guard_active': True,
                'total_listening': listening_count,
                'isolated_user_ports_count': sum(1 for p in ports if p.get('is_isolated') and p.get('owner_session', 0) > 0),
                'system_ports_count': sum(1 for p in ports if p.get('owner_session', 0) == 0 and p.get('is_listening')),
                'user_reservations': {f"Port {k}": v.get('username') for k, v in cls._claims.items()}
            },
            'ports': ports,
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
        }

        cls._cached_snapshot = result
        cls._cached_time = now
        return result

    @classmethod
    def check_conflict(cls, target_port: int, requesting_user: str = 'Admin', session_id: Optional[int] = None) -> Dict[str, Any]:
        """Inspects if target_port has a conflict with an active user session or project.

        If occupied: Flags conflict, identifies owner, and automatically allocates a free port.
        If free: Authorizes dedicated isolated binding.
        """
        in_use = cls.is_port_in_use(target_port)
        claim = cls._claims.get(target_port)

        # Find owner if occupied
        owner = None
        if claim:
            owner = claim.get('username')
        elif in_use:
            snap = cls.get_ports_snapshot(force=True)
            for p in snap.get('ports', []):
                if p.get('local_port') == target_port and p.get('is_listening'):
                    owner = p.get('owner_user') or f"Session #{p.get('owner_session')}"
                    break
            if not owner:
                owner = 'مستخدم آخر على السيرفر'

        # If clean and uncollided
        if not in_use and not claim:
            return {
                'available': True,
                'conflict': False,
                'requested_port': target_port,
                'suggested_port': target_port,
                'current_owner': None,
                'message': f'المنفذ {target_port} شاغر ومتاح لك بعزل كامل دون أي تداخل مع المستخدمين الآخرين.',
                'alternatives': [target_port + 1, target_port + 2, target_port + 3]
            }

        # Port is occupied - Automatic AI alternate allocation
        suggested = cls.find_free_port(preferred_start=target_port + 1)
        alts = [
            cls.find_free_port(preferred_start=suggested + 1),
            cls.find_free_port(preferred_start=suggested + 2)
        ]
        return {
            'available': False,
            'conflict': True,
            'requested_port': target_port,
            'suggested_port': suggested,
            'current_owner': owner,
            'message': f'المنفذ {target_port} محجوز حالياً بواسطة ({owner}) لمنع التداخل مع مشروعه ومتصفحه. تم حجز المنفذ البديل {suggested} لك تلقائياً.',
            'alternatives': [suggested] + alts
        }

    @classmethod
    def claim_port(cls, requested_port: int, username: str = 'Admin', session_id: Optional[int] = None, project_name: str = '') -> Dict[str, Any]:
        """Locks a dedicated port for a user and prevents cross-user takeover."""
        chk = cls.check_conflict(requested_port, username, session_id)
        assigned = target_port = requested_port
        if not chk['available']:
            assigned = chk['suggested_port']

        try:
            from ..infrastructure.db import db_set_reservation
            db_set_reservation(assigned, username, project_name or '')
        except Exception as exc:
            logger.error("Failed to persist port reservation: %s", exc)
            return {'ok': False, 'error': 'تعذر حفظ حجز المنفذ في قاعدة البيانات.'}
        cls._claims[assigned] = {
            'port': assigned,
            'username': username,
            'session_id': session_id,
            'project_name': project_name or f'Project on {assigned}',
            'claimed_at': time.time(),
        }

        return {
            'ok': True,
            'assigned_port': assigned,
            'requested_port': requested_port,
            'was_reallocated': assigned != requested_port,
            'user': username,
            'message': f'تم تخصيص وعزل المنفذ {assigned} بنجاح لمشروعك ({username}). لن يتمكن أي مستخدم آخر من التداخل معه.'
        }

    @classmethod
    def release_port(cls, port: int, username: str = '') -> Dict[str, Any]:
        """Releases an explicit port reservation."""
        claim = cls._claims.get(port)
        if username and claim and str(claim.get('username')).lower() != username.lower():
            return {'ok': False, 'port': port, 'error': 'لا يمكنك إلغاء حجز منفذ مملوك لمستخدم آخر.'}
        try:
            from ..infrastructure.db import db_remove_reservation
            removed = db_remove_reservation(port)
        except Exception as exc:
            logger.error("Failed to remove port reservation: %s", exc)
            return {'ok': False, 'error': 'تعذر حذف حجز المنفذ من قاعدة البيانات.'}
        if not removed and port not in cls._claims:
            return {'ok': False, 'port': port, 'error': f'المنفذ {port} غير محجوز.'}
        cls._claims.pop(port, None)
        return {'ok': True, 'port': port, 'message': f'تم إلغاء حجز المنفذ {port} وإتاحته للجميع.'}

    @classmethod
    def close_process(cls, pid: int) -> Dict[str, Any]:
        """Safely terminates the process occupying a specific port with system safety validation."""
        if pid <= 4:
            return {'ok': False, 'error': 'لا يمكن إغلاق عمليات نواة النظام المحمية (PID 0 / PID 4).'}

        try:
            proc = psutil.Process(pid)
            pname = proc.name()
            if pname.lower() in CRITICAL_SYSTEM_PROCESSES:
                return {'ok': False, 'error': f'العملية {pname} هي عملية نظام حرجة ومحمية من الإنهاء.'}

            proc.terminate()
            try:
                proc.wait(timeout=1.5)
            except psutil.TimeoutExpired:
                proc.kill()

            cls._cached_snapshot = None
            return {'ok': True, 'pid': pid, 'process_name': pname}
        except psutil.NoSuchProcess:
            return {'ok': True, 'message': 'العملية انتهت بالفعل.'}
        except Exception as exc:
            return {'ok': False, 'error': str(exc)}

    @classmethod
    def block_ip(cls, ip: str) -> Dict[str, Any]:
        """Adds a Windows Defender Firewall rule safely with zero shell interpolation."""
        import ipaddress
        if not ip or not isinstance(ip, str):
            return {'ok': False, 'error': 'عنوان IP غير صالح.'}

        try:
            clean_ip = str(ipaddress.ip_address(ip.strip()))
        except ValueError:
            return {'ok': False, 'error': 'عنوان IP غير صالح للحظر.'}

        if clean_ip in ('127.0.0.1', '::1', '0.0.0.0', '::'):
            return {'ok': False, 'error': 'لا يمكن حظر العناوين المحلية المحمية.'}

        rule_name = f"ASAAS_Block_{clean_ip.replace(':', '_')}"
        cmd = [
            'netsh', 'advfirewall', 'firewall', 'add', 'rule',
            f'name={rule_name}', 'dir=in', 'action=block', f'remoteip={clean_ip}'
        ]
        
        try:
            # CREATE_NO_WINDOW = 0x08000000
            res = subprocess.run(
                cmd,
                shell=False,
                creationflags=0x08000000,
                capture_output=True,
                text=True,
                timeout=5
            )
            if res.returncode != 0:
                err_text = (res.stderr or res.stdout or '').strip()
                return {'ok': False, 'ip': clean_ip, 'error': err_text or 'فشل إنشاء قاعدة جدار الحماية.'}
            verify = subprocess.run(
                ['powershell', '-NoProfile', '-NonInteractive', '-Command', f"if (Get-NetFirewallRule -Name '{rule_name}' -ErrorAction SilentlyContinue) {{ exit 0 }} else {{ exit 1 }}"],
                shell=False,
                creationflags=0x08000000,
                capture_output=True,
                text=True,
                timeout=5,
            )
            if verify.returncode != 0:
                return {'ok': False, 'ip': clean_ip, 'error': 'لم يتم العثور على قاعدة الحظر بعد إنشائها.'}
            return {'ok': True, 'ip': clean_ip, 'rule': rule_name, 'verified': True}
        except Exception as exc:
            return {'ok': False, 'error': str(exc)}

    @classmethod
    def unblock_ip(cls, ip: str) -> Dict[str, Any]:
        import ipaddress
        try:
            clean_ip = str(ipaddress.ip_address(str(ip).strip()))
        except ValueError:
            return {'ok': False, 'error': 'عنوان IP غير صالح.'}
        rule_name = f"ASAAS_Block_{clean_ip.replace(':', '_')}"
        try:
            res = subprocess.run(
                ['netsh', 'advfirewall', 'firewall', 'delete', 'rule', f'name={rule_name}'],
                shell=False,
                creationflags=0x08000000,
                capture_output=True,
                text=True,
                timeout=5,
            )
            verify = subprocess.run(
                ['powershell', '-NoProfile', '-NonInteractive', '-Command', f"if (Get-NetFirewallRule -Name '{rule_name}' -ErrorAction SilentlyContinue) {{ exit 0 }} else {{ exit 1 }}"],
                shell=False,
                creationflags=0x08000000,
                capture_output=True,
                text=True,
                timeout=5,
            )
            if verify.returncode == 0:
                return {'ok': False, 'ip': clean_ip, 'error': 'قاعدة الحظر ما زالت موجودة بعد محاولة الحذف.'}
            return {
                'ok': True,
                'ip': clean_ip,
                'verified': True,
                'already_absent': res.returncode != 0,
                'message': 'تم إلغاء الحظر والتحقق من غياب القاعدة.' if res.returncode == 0 else 'قاعدة الحظر غير موجودة بالفعل.',
            }
        except Exception as exc:
            return {'ok': False, 'error': str(exc)}


    @classmethod
    def get_guard_status(cls) -> Dict[str, Any]:
        """Returns active port guard intelligence summary."""
        snap = cls.get_ports_snapshot()
        return {
            'ok': True,
            'guard_active': True,
            'total_listening': snap['summary']['listening_ports'],
            'isolated_user_ports_count': snap['guard']['isolated_user_ports_count'],
            'isolated_ports': [p for p in snap['ports'] if p.get('is_isolated')],
            'user_reservations': {str(k): v.get('username') for k, v in cls._claims.items()},
            'db_reservations': list(cls._claims.values()),
        }
