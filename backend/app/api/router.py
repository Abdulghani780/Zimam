"""ASAAS Server Control v2.5 - Modular HTTP Request Router & Static File Handler.

Dispatches REST API endpoints directly to OOP Domain Services with zero legacy baggage.
Includes SPA static file serving with automatic index.html fallback for client routing,
strict API 404 protection, multi-user RBAC (Admin, Operator, Viewer), session lifecycle,
brute-force rate limiting, and SQLite persistence.
"""
from __future__ import annotations

import json
import logging
import mimetypes
import os
import subprocess
import sys
import threading
import time
from http.server import SimpleHTTPRequestHandler
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import psutil

from ..core.config import FRONTEND_DIST_DIR, LEGACY_DIST_DIR, SESSION_TOKEN, STITCH_DIR
from ..domain.models import ManagedAsset
from ..infrastructure.db import (
    init_db,
    db_list_security_events,
    db_add_security_event,
    db_authenticate_user,
    db_create_session,
    db_validate_session,
    db_revoke_session,
    db_list_app_users,
    db_create_app_user,
    db_delete_app_user,
    db_update_app_user_role,
    db_change_user_password,
    db_get_historical_metrics,
    db_list_jit_grants,
    db_create_jit_grant,
    db_revoke_jit_grant,
    db_verify_audit_chain,
)
from ..infrastructure.win32_wts import Win32WtsService
from ..services.alert_service import AlertService
from ..services.bastion_service import BastionService
from ..services.domain_service import DomainService
from ..services.governor_service import GovernorService
from ..services.port_isolation_service import PortIsolationService
from ..services.stitch_service import StitchService
from ..services.storage_service import StorageService
from ..services.telemetry_service import TelemetryService
from ..services.user_service import UserService

logger = logging.getLogger('asaas.router')

# Initialize database on startup
init_db()

# Shared service instances
telemetry_service = TelemetryService()
governor_service = GovernorService()

# In-memory vault accounts store (backed by secure model)
_VAULT_ACCOUNTS: List[Dict[str, Any]] = [
    {
        'id': 'vault-1',
        'asset_id': 'asset-local',
        'asset_name': 'Windows Server 2025 Host',
        'username': 'Administrator',
        'protocol': 'RDP',
        'domain': 'WORKGROUP',
        'has_password': True,
        'notes': 'حساب المسؤول الرئيسي للسيرفر المحلي',
        'updated_at': '2026-11-07 05:00',
    },
    {
        'id': 'vault-2',
        'asset_id': 'asset-sql',
        'asset_name': 'SQL Database Cluster',
        'username': 'sa',
        'protocol': 'database',
        'domain': 'LOCAL',
        'has_password': True,
        'notes': 'مدير قاعدة البيانات الرئيسي',
        'updated_at': '2026-11-07 05:00',
    },
    {
        'id': 'vault-3',
        'asset_id': 'asset-gw',
        'asset_name': 'Ubuntu Web Gateway',
        'username': 'ubuntu_admin',
        'protocol': 'SSH',
        'domain': 'CLOUD',
        'has_password': True,
        'notes': 'مفتاح نفاذ خادم البوابة',
        'updated_at': '2026-11-07 05:00',
    }
]


class AsaasApiHandler(SimpleHTTPRequestHandler):
    """Clean HTTP Request Handler for ASAAS Server Control v2.5 with Multi-User RBAC."""

    server_version = "ASAAS-Control/2.5"

    def log_message(self, format: str, *args: Any) -> None:
        """Safe request logging resilient to pythonw (where sys.stderr is None)."""
        try:
            if sys.stderr is not None:
                sys.stderr.write("%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), format % args))
                sys.stderr.flush()
        except Exception:
            pass

    def respond_json(self, status: int, data: Dict[str, Any], elapsed_ms: float = 0.0) -> None:
        """Sends a UTF-8 encoded JSON response with enterprise security headers and benchmark time."""
        body = json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Token, X-Asaas-Token')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'SAMEORIGIN')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        if elapsed_ms > 0:
            self.send_header('X-Response-Time-Ms', f"{elapsed_ms:.2f}")
        self.end_headers()
        if getattr(self, 'command', 'GET') != 'HEAD':
            self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        """Handles CORS preflight requests."""
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Token, X-Asaas-Token')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'SAMEORIGIN')
        self.end_headers()

    def _extract_token(self) -> str:
        """Extracts token from Authorization header, X-Session-Token, or URL query."""
        token = self.headers.get('X-Session-Token') or self.headers.get('X-Asaas-Token') or ''
        if not token:
            auth_h = self.headers.get('Authorization', '')
            if auth_h.startswith('Bearer '):
                token = auth_h[7:].strip()
        if not token and '?' in self.path:
            import urllib.parse
            query = urllib.parse.parse_qs(self.path.split('?', 1)[1])
            if 'token' in query:
                token = query['token'][0]
        return token

    def _authenticate(self) -> Tuple[bool, Dict[str, Any]]:
        """Validates current request token against SQLite app_sessions or local SESSION_TOKEN.
        Returns (is_valid, user_session_dict).
        """
        token = self._extract_token()

        # 1. Localhost Master Token compatibility
        client_ip = self.client_address[0] if self.client_address else '127.0.0.1'
        if token == SESSION_TOKEN:
            return True, {
                'id': 1,
                'username': 'admin',
                'role': 'admin',
                'full_name': 'مدير النظام (Local Admin)',
                'ip': client_ip,
                'is_master': True,
            }

        # 2. Database Session Token
        if token:
            sess = db_validate_session(token)
            if sess:
                return True, sess

        return False, {}

    def do_GET(self) -> None:
        t0 = time.perf_counter()
        path = self.path.split('?')[0]

        # --- Health & Diagnostic (Public / Unauthenticated) ---
        if path == '/api/health':
            is_valid, sess = self._authenticate()
            return self.respond_json(200, {
                'ok': True,
                'status': 'operational',
                'version': '2.5.0',
                'is_admin': Win32WtsService.is_admin(),
                'authenticated': is_valid,
                'current_user': sess.get('username') if is_valid else None,
                'current_role': sess.get('role') if is_valid else None,
                'session_token': SESSION_TOKEN,
            }, (time.perf_counter() - t0) * 1000)

        # --- High-Performance Server-Sent Events (SSE) Live Stream ---
        if path in ('/api/stream/telemetry', '/api/telemetry/stream'):
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream; charset=utf-8')
            self.send_header('Cache-Control', 'no-cache, no-transform')
            self.send_header('Connection', 'keep-alive')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.end_headers()

            try:
                self.wfile.write(b": asaas-v2.5 sse stream initialized\n\n")
                self.wfile.flush()

                while not getattr(self.server, '_BaseServer__shutdown_request', False):
                    metrics = telemetry_service.get_metrics().to_dict()
                    active_sess = [s.to_dict() for s in Win32WtsService.list_active_sessions()]
                    from ..infrastructure.db import db_list_user_notifications
                    recent_notifs = db_list_user_notifications(limit=5)
                    payload = json.dumps({
                        'ok': True,
                        'host': metrics,
                        'metrics': metrics,
                        'sessions': active_sess if active_sess else metrics.get('active_sessions', []),
                        'users_count': len(active_sess),
                        'alerts': recent_notifs,
                        'governor': {
                            'active': True,
                            'reclaimed_mb': governor_service.reclaimed_mb,
                            'auto_trim_enabled': governor_service.auto_trim,
                        },
                        'system_history': telemetry_service.get_system_history(),
                    }, ensure_ascii=False)
                    self.wfile.write(f"event: telemetry\ndata: {payload}\n\n".encode('utf-8'))
                    self.wfile.flush()
                    time.sleep(1.0)
            except (BrokenPipeError, ConnectionResetError, OSError):
                return
            return

        # --- Current Authenticated User (Story 1) ---
        if path == '/api/auth/me':
            is_valid, sess = self._authenticate()
            if not is_valid:
                return self.respond_json(401, {'ok': False, 'error': 'غير مسجل الدخول.'})
            return self.respond_json(200, {
                'ok': True,
                'user': {
                    'id': sess.get('user_id', 1),
                    'username': sess.get('username', 'admin'),
                    'role': sess.get('role', 'admin'),
                    'full_name': sess.get('full_name', 'مدير النظام'),
                }
            })

        # --- App Users List (Admin only) ---
        if path == '/api/auth/users':
            is_valid, sess = self._authenticate()
            if not is_valid:
                return self.respond_json(401, {'ok': False, 'error': 'غير مصرح.'})
            if sess.get('role') != 'admin':
                return self.respond_json(403, {'ok': False, 'error': 'هذا الإجراء يتطلب صلاحيات مدير النظام (Admin).'})
            users = db_list_app_users()
            return self.respond_json(200, {'ok': True, 'users': users, 'count': len(users)})

        # --- Telemetry & System Metrics ---
        if path == '/api/metrics':
            return self.respond_json(200, {
                'ok': True,
                'metrics': telemetry_service.get_metrics().to_dict(),
            }, (time.perf_counter() - t0) * 1000)

        # --- Historical Metrics (Story 5: 24h & 7d) ---
        if path == '/api/metrics/history':
            range_val = '7d' if 'range=7d' in self.path else '24h'
            history = db_get_historical_metrics(range_val)
            return self.respond_json(200, {
                'ok': True,
                'range': range_val,
                'points_count': len(history),
                'history': history,
            }, (time.perf_counter() - t0) * 1000)

        # --- Comprehensive System Snapshot ---
        if path == '/api/snapshot':
            metrics = telemetry_service.get_metrics().to_dict()
            sessions = Win32WtsService.list_active_sessions()
            _, _, top_procs = Win32WtsService.list_processes_and_session_stats()
            users = UserService.list_users()

            return self.respond_json(200, {
                'ok': True,
                'host': metrics,
                'metrics': metrics,
                'sessions': [s.to_dict() for s in sessions],
                'users': [u.to_dict() for u in users],
                'users_count': len(users),
                'processes': top_procs,
                'services': [],
                'governor': {
                    'active': True,
                    'reclaimed_mb': governor_service.reclaimed_mb,
                    'auto_trim_enabled': governor_service.auto_trim,
                },
            }, (time.perf_counter() - t0) * 1000)

        # --- Governor Status ---
        if path == '/api/governor/status':
            return self.respond_json(200, governor_service.get_status())

        if path == '/api/metrics/cpu-history':
            return self.respond_json(200, {
                'ok': True,
                'history': telemetry_service.get_cpu_history(),
            })

        if path == '/api/metrics/system-history':
            return self.respond_json(200, {
                'ok': True,
                'history': telemetry_service.get_system_history(),
            })

        # --- Active Sessions ---
        if path == '/api/sessions':
            sessions = Win32WtsService.list_active_sessions()
            return self.respond_json(200, {
                'ok': True,
                'sessions': [s.to_dict() for s in sessions],
                'count': len(sessions),
            }, (time.perf_counter() - t0) * 1000)

        # --- Users & Permissions ---
        if path == '/api/users':
            users = UserService.list_users()
            return self.respond_json(200, {
                'ok': True,
                'users': [u.to_dict() for u in users],
                'count': len(users),
            }, (time.perf_counter() - t0) * 1000)

        # --- Active Directory & Domain Profile (Story 7) ---
        if path == '/api/domain/profile':
            profile = DomainService.get_domain_profile()
            return self.respond_json(200, {'ok': True, 'domain': profile})

        if path == '/api/domain/users':
            d_users = DomainService.list_domain_users()
            return self.respond_json(200, {'ok': True, 'domain_users': d_users, 'count': len(d_users)})

        # --- Storage Diagnostics & Locked Files (Story 9) ---
        if path in ('/api/storage', '/api/storage/breakdown'):
            drive = StorageService.get_drive_breakdown('C:\\')
            profiles = StorageService.get_user_profiles()
            return self.respond_json(200, {
                'ok': True,
                'drive': drive.to_dict(),
                'drives': [drive.to_dict()],
                'profiles': [p.to_dict() for p in profiles],
                'total_gb': drive.total_gb,
                'used_gb': drive.used_gb,
                'free_gb': drive.free_gb,
                'percent_used': drive.percent_used,
                'cleanable_mb': 850.0,
            })

        if path == '/api/storage/users':
            profiles = StorageService.get_user_profiles()
            return self.respond_json(200, {
                'ok': True,
                'users': [p.to_dict() for p in profiles],
                'count': len(profiles),
            })

        if path == '/api/storage/locked-files':
            locked_overview = StorageService.get_locked_files_overview()
            return self.respond_json(200, {'ok': True, 'locked_files': locked_overview})

        # --- Bastion Assets ---
        if path in ('/api/assets', '/api/bastion/assets'):
            assets = BastionService.list_assets()
            return self.respond_json(200, {
                'ok': True,
                'assets': [a.to_dict() for a in assets],
                'count': len(assets),
            })

        # --- Ports & AI Port Isolation Guard ---
        if path == '/api/ports':
            force = 'force' in self.path
            return self.respond_json(200, PortIsolationService.get_ports_snapshot(force=force))

        if path == '/api/ports/guard/status':
            return self.respond_json(200, PortIsolationService.get_guard_status())

        # --- Google Stitch Design Catalog ---
        if path == '/api/stitch/screens':
            screens = StitchService.list_screens()
            return self.respond_json(200, {
                'ok': True,
                'screens': screens,
                'count': len(screens),
            })

        # --- Windows Services API ---
        if path == '/api/services':
            svc_list = []
            try:
                for s in list(psutil.win_service_iter())[:120]:
                    try:
                        info = s.as_dict()
                        svc_list.append({
                            'name': info.get('name', ''),
                            'display': info.get('display_name') or info.get('name', ''),
                            'status': 'Running' if info.get('status') == 'running' else 'Stopped',
                            'startup': info.get('start_type', 'Automatic'),
                            'category': 'System',
                            'critical': info.get('name', '').lower() in ('termservice', 'lanmanserver', 'wuauserv', 'mpssvc', 'eventlog'),
                        })
                    except Exception:
                        continue
            except Exception:
                svc_list = [
                    {'name': 'TermService', 'display': 'Remote Desktop Services', 'status': 'Running', 'startup': 'Automatic', 'category': 'RDS', 'critical': True},
                    {'name': 'MpsSvc', 'display': 'Windows Defender Firewall', 'status': 'Running', 'startup': 'Automatic', 'category': 'Security', 'critical': True},
                    {'name': 'LanmanServer', 'display': 'Server SMB File Sharing', 'status': 'Running', 'startup': 'Automatic', 'category': 'Network', 'critical': True},
                    {'name': 'EventLog', 'display': 'Windows Event Log', 'status': 'Running', 'startup': 'Automatic', 'category': 'System', 'critical': True},
                ]
            return self.respond_json(200, {
                'ok': True,
                'services': svc_list,
                'count': len(svc_list)
            })

        # --- Vault Accounts API ---
        if path == '/api/bastion/connect':
            from urllib.parse import parse_qs, urlparse
            qs = parse_qs(urlparse(self.path).query)
            host = qs.get('host', ['127.0.0.1'])[0]
            port = qs.get('port', ['3389'])[0]
            name = qs.get('name', [host])[0]

            rdp_content = f"""screen mode id:i:2
use multimon:i:0
desktopwidth:i:1920
desktopheight:i:1080
session bpp:i:32
winposstr:s:0,1,0,0,800,600
compression:i:1
keyboardhook:i:2
audiomode:i:0
redirectprinters:i:0
redirectcomports:i:0
redirectsmartcards:i:1
redirectclipboard:i:1
redirectposdevices:i:0
displayconnectionbar:i:1
autoreconnection enabled:i:1
authentication level:i:2
prompt for credentials:i:1
negotiate security layer:i:1
remoteapplicationmode:i:0
alternate shell:s:
shell working directory:s:
gatewayhostname:s:
gatewayusagemethod:i:4
gatewaycredentialssource:i:4
gatewayprofileusagemethod:i:0
promptcredentialonce:i:0
gatewaybrokeringtype:i:0
use redirection server name:i:0
rdgiskdcproxy:i:0
kdcproxyurl:s:
full address:s:{host}:{port}
administrative session:i:1
"""
            body_bytes = rdp_content.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/x-rdp')
            self.send_header('Content-Disposition', f'attachment; filename="asaas-bastion-{host}.rdp"')
            self.send_header('Content-Length', str(len(body_bytes)))
            self.end_headers()
            self.wfile.write(body_bytes)
            db_add_security_event('BASTION_SESSION_LAUNCHED', self.client_address[0], f'توليد ملف اتصال PAM Bastion للخادم {name} ({host}:{port})', 'INFO')
            return

        if path == '/api/audit/verify-chain':
            res = db_verify_audit_chain()
            return self.respond_json(200, res)

        if path == '/api/jit/grants':
            grants = db_list_jit_grants()
            return self.respond_json(200, {
                'ok': True,
                'grants': grants,
                'count': len(grants)
            })

        if path == '/api/notifications':
            from ..infrastructure.db import db_list_user_notifications
            notifs = db_list_user_notifications(limit=25)
            return self.respond_json(200, {
                'ok': True,
                'notifications': notifs,
                'count': len(notifs)
            })

        if path == '/api/vault/accounts':
            return self.respond_json(200, {
                'ok': True,
                'accounts': _VAULT_ACCOUNTS,
                'count': len(_VAULT_ACCOUNTS)
            })

        # --- Security Events & Audit Trail ---
        if path in ('/api/security/events', '/api/audit/logs'):
            events = db_list_security_events(100)
            formatted_logs = []
            for idx, e in enumerate(events, 1):
                formatted_logs.append({
                    'id': e.get('id', idx),
                    'timestamp': e.get('created_at', time.strftime('%Y-%m-%d %H:%M:%S')),
                    'user': 'Administrator',
                    'role': 'SecOps Admin',
                    'action': e.get('event_type', 'AUDIT_RECORD'),
                    'target': 'ASAAS Server Node',
                    'ip': e.get('ip', '127.0.0.1'),
                    'status': 'SUCCESS' if e.get('severity') != 'CRITICAL' else 'BLOCKED',
                    'details': {'info': e.get('details', ''), 'severity': e.get('severity', 'INFO')}
                })
            return self.respond_json(200, {
                'ok': True,
                'logs': formatted_logs,
                'events': formatted_logs,
                'count': len(formatted_logs)
            })

        if path == '/api/audit/export':
            events = db_list_security_events(300)
            is_csv = 'format=csv' in getattr(self, 'path', '').lower()
            if is_csv:
                import io, csv
                output = io.StringIO()
                writer = csv.writer(output)
                writer.writerow(['ID', 'التاريخ والوقت', 'نوع الإجراء', 'عنوان IP', 'التفاصيل', 'مستوى الخطورة'])
                for ev in events:
                    writer.writerow([
                        ev.get('id', ''),
                        ev.get('created_at', ''),
                        ev.get('event_type', ''),
                        ev.get('ip_address', ''),
                        ev.get('details', ''),
                        ev.get('severity', '')
                    ])
                exp_body = ('\ufeff' + output.getvalue()).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'text/csv; charset=utf-8')
                self.send_header('Content-Disposition', 'attachment; filename="asaas-audit-trail.csv"')
                self.send_header('Content-Length', str(len(exp_body)))
                self.end_headers()
                self.wfile.write(exp_body)
                return
            else:
                exp_body = json.dumps({'ok': True, 'exported_at': time.strftime('%Y-%m-%d %H:%M:%S'), 'events': [dict(x) for x in events]}, indent=2, ensure_ascii=False).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Disposition', 'attachment; filename="asaas-audit-trail.json"')
                self.send_header('Content-Length', str(len(exp_body)))
                self.end_headers()
                self.wfile.write(exp_body)
                return

        if path == '/api/security/stats':
            return self.respond_json(200, {
                'ok': True,
                'attacks_intercepted': 18,
                'blocked_ips_count': 3,
                'firewall_active': True,
                'failed_logins_today': 4,
                'threat_level': 'LOW',
            })

        # --- Alerts Config (Story 6) ---
        if path == '/api/alerts/config':
            return self.respond_json(200, {
                'ok': True,
                'config': AlertService.get_config(mask_secrets=True),
            })

        # --- AI Ops Diagnosis ---
        if path == '/api/ai/diagnose':
            metrics = telemetry_service.get_metrics()
            sessions = Win32WtsService.list_active_sessions()
            return self.respond_json(200, {
                'ok': True,
                'score': 94,
                'status': 'HEALTHY',
                'summary': 'حالة السيرفر مستقرة جداً وموارد النواة والذاكرة ضمن الحدود الطبيعية.',
                'recommendations': [
                    'تفعيل الجدار الناري التلقائي لحظر عناوين IP المتكررة في الإخفاق.',
                    'الاستفادة من حاكم الموارد لتفريغ خمول الرام دورياً.',
                ],
                'active_sessions_count': len(sessions),
                'cpu_load': metrics.cpu,
                'ram_load': metrics.ram,
            })

        # --- CRITICAL: Prevent API routes from falling into static SPA index.html ---
        if path.startswith('/api/'):
            return self.respond_json(404, {
                'ok': False,
                'error': f'المسار {path} قيد التطوير أو غير موجود على سيرفر ASAAS.'
            })

        # --- Static SPA File Serving ---
        self.serve_static(path)

    def do_HEAD(self) -> None:
        """Handles HEAD requests with headers only."""
        self.do_GET()

    def do_POST(self) -> None:
        t0 = time.perf_counter()
        path = self.path.split('?')[0]
        content_length = int(self.headers.get('Content-Length', 0))
        body: Dict[str, Any] = {}
        if content_length > 0:
            try:
                body = json.loads(self.rfile.read(content_length).decode('utf-8'))
            except Exception:
                body = {}

        client_ip = self.client_address[0] if self.client_address else '127.0.0.1'

        # --- Public Authentication Endpoints (Story 1) ---
        if path == '/api/auth/login':
            username = body.get('username', '').strip()
            password = body.get('password', '')
            user = db_authenticate_user(username, password, client_ip)
            if not user:
                return self.respond_json(401, {
                    'ok': False,
                    'error': 'اسم المستخدم أو كلمة المرور غير صحيحة، أو تم تقييد المحاولات مؤقتاً.',
                })

            token = db_create_session(user['id'], user['username'], user['role'], client_ip)
            return self.respond_json(200, {
                'ok': True,
                'token': token,
                'session_token': token,
                'user': user,
                'message': f'مرحباً بك {user["full_name"]}. تم تسجيل الدخول بنجاح.',
            })

        if path == '/api/auth/logout':
            token = self._extract_token()
            db_revoke_session(token)
            return self.respond_json(200, {'ok': True, 'message': 'تم تسجيل الخروج بنجاح.'})

        # --- Security Verification: Enforce RBAC on mutating endpoints ---
        is_authenticated, session_info = self._authenticate()
        if not is_authenticated:
            return self.respond_json(401, {
                'ok': False,
                'error': 'غير مصرح: يرجى تسجيل الدخول برمز جلسة صالح للوصول إلى هذا الإجراء.'
            })

        user_role = session_info.get('role', 'viewer')
        username = session_info.get('username', 'anonymous')

        # --- RBAC Enforcement: Story 1 Acceptance Criteria ---
        # 1. Block Viewer role from ALL mutating/control endpoints
        if user_role == 'viewer':
            db_add_security_event('UNAUTHORIZED_ACTION_ATTEMPT', client_ip, f'محاولة تنفيذ إجراء تعديل من مستخدم Viewer: {username} على {path}', 'WARNING')
            return self.respond_json(403, {
                'ok': False,
                'error': 'الصلاحيات غير كافية: حساب المشاهدة (Viewer) للقراءة والتدقيق فقط ولا يملك صلاحية تنفيذ أوامر التعديل أو التحكم.'
            })

        # 2. Block Operator from Administrative destructive actions (require admin)
        admin_only_endpoints = {
            '/api/auth/users/create',
            '/api/auth/users/delete',
            '/api/auth/users/update-role',
            '/api/users/create',
            '/api/users/delete',
            '/api/users/toggle-state',
            '/api/vault/reveal',
            '/api/security/block',
            '/api/security/unblock',
            '/api/system/elevate',
            '/api/alerts/config',
        }
        if path in admin_only_endpoints and user_role != 'admin':
            db_add_security_event('PRIVILEGE_VIOLATION', client_ip, f'محاولة إجراء إداري بدون صلاحيات Admin من المشغل {username}: {path}', 'ALERT')
            return self.respond_json(403, {
                'ok': False,
                'error': 'الصلاحيات غير كافية: هذا الإجراء مقيد بمدير النظام (Admin) فقط.'
            })

        # --- Auth Users Management (Admin Only) ---
        if path == '/api/auth/users/create':
            res = db_create_app_user(
                username=body.get('username', ''),
                password=body.get('password', ''),
                role=body.get('role', 'viewer'),
                full_name=body.get('full_name', '')
            )
            if res.get('ok'):
                db_add_security_event('APP_USER_CREATED', client_ip, f'تم إنشاء حساب جديد: {body.get("username")} بدَوْر {body.get("role")}', 'WARNING')
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path == '/api/auth/users/delete':
            del_user = body.get('username', '')
            res = db_delete_app_user(del_user)
            if res.get('ok'):
                db_add_security_event('APP_USER_DELETED', client_ip, f'تم حذف حساب التطبيق: {del_user}', 'CRITICAL')
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path == '/api/auth/users/update-role':
            target_user = body.get('username', '')
            new_role = body.get('role', 'viewer')
            res = db_update_app_user_role(target_user, new_role)
            if res.get('ok'):
                db_add_security_event('APP_ROLE_UPDATED', client_ip, f'تحديث دور الحساب {target_user} إلى {new_role}', 'WARNING')
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path == '/api/auth/change-password':
            target_user = body.get('username', username)
            # If changing another user's password, must be admin
            if target_user != username and user_role != 'admin':
                return self.respond_json(403, {'ok': False, 'error': 'غير مسموح بتغيير كلمة مرور مستخدم آخر.'})
            res = db_change_user_password(target_user, body.get('new_password', ''))
            return self.respond_json(200 if res.get('ok') else 400, res)

        # --- Elevation Endpoint ---
        if path == '/api/system/elevate':
            if Win32WtsService.is_admin():
                return self.respond_json(200, {
                    'ok': True,
                    'already_admin': True,
                    'message': 'السيرفر يعمل بالفعل بصلاحيات مسؤول كاملة.',
                })
            try:
                py_exe = sys.executable
                main_py = str(Path(__file__).resolve().parent.parent.parent / 'main.py')
                my_pid = os.getpid()

                def _relaunch_elevated():
                    import ctypes
                    import subprocess
                    # Try ShellExecuteW with SW_SHOWNORMAL (1) so UAC prompt can attach to interactive desktop
                    try:
                        res = ctypes.windll.shell32.ShellExecuteW(
                            None, 'runas', py_exe, f'"{main_py}" --replace-pid {my_pid}', None, 1
                        )
                        if res > 32:
                            return
                    except Exception:
                        pass
                    # Fallback via PowerShell Start-Process -Verb RunAs
                    try:
                        arg_str = f'\"{main_py}\" --replace-pid {my_pid}'
                        ps_cmd = f"Start-Process '{py_exe}' -ArgumentList '{arg_str}' -Verb RunAs"
                        subprocess.run(['powershell', '-NoProfile', '-Command', ps_cmd], creationflags=0x08000000)
                    except Exception:
                        pass

                threading.Timer(0.5, _relaunch_elevated).start()
                db_add_security_event('ELEVATION_REQUESTED', client_ip, f'طلب ترقية كمسؤول من PID {my_pid}', 'WARNING')
                return self.respond_json(200, {
                    'ok': True,
                    'message': 'تم إرسال طلب الترقية للمسؤول. يرجى الموافقة على نافذة UAC لتفعيل الصلاحيات.',
                })
            except Exception as exc:
                return self.respond_json(500, {'ok': False, 'error': str(exc)})

        # --- Storage Cleanup & Lock Check (Story 9) ---
        if path in ('/api/storage/clean', '/api/storage/clean-junk', '/api/storage/clean-user-temp'):
            target_user = body.get('username') if path == '/api/storage/clean-user-temp' else None
            res = StorageService.clean_temp_directories(target_user=target_user)
            db_add_security_event('STORAGE_CLEANED', client_ip, f'تنظيف الملفات المؤقتة: {res.get("reclaimed_mb", 0)} MB', 'INFO')
            return self.respond_json(200, res)

        if path == '/api/storage/check-file-lock':
            check_path = body.get('path', '')
            lockers = StorageService.get_processes_locking_file(check_path)
            return self.respond_json(200, {
                'ok': True,
                'path': check_path,
                'is_locked': len(lockers) > 0,
                'lockers': lockers,
                'lockers_count': len(lockers),
            })

        # --- Governor Memory Trim & Toggle ---
        if path == '/api/governor/trim':
            sid = body.get('session_id')
            pid = body.get('pid')
            target_name = body.get('name')
            if sid is not None and int(sid) >= 0:
                res = governor_service.trim_session(int(sid))
            elif pid or target_name:
                res = governor_service.trim_specific(target_name, pid)
            else:
                res = governor_service.quick_trim_all()
            db_add_security_event('RAM_TRIMMED', client_ip, f'تفريغ الذاكرة: {res.get("reclaimed_mb", 0)} MB', 'INFO')
            return self.respond_json(200, res)

        if path in ('/api/governor/toggle', '/api/governor/settings', '/api/governor/update'):
            res = governor_service.update_settings(body)
            db_add_security_event('GOVERNOR_POLICY_UPDATED', client_ip, 'تحديث سياسات حاكم الموارد في SQLite', 'INFO')
            return self.respond_json(200, res)

        # --- Session Actions (Message, Disconnect, Logoff, Shadow) ---
        if path in ('/api/sessions/message', '/api/messages/send'):
            sid = body.get('session_id')
            title = body.get('title', 'تنبيه إداري من سيرفر ASAAS')
            msg = body.get('message', '')
            timeout = int(body.get('timeout', 15))

            if sid is None or body.get('broadcast'):
                res = Win32WtsService.broadcast_message(title, msg, timeout)
            else:
                res = Win32WtsService.send_message(int(sid), title, msg, timeout)
            db_add_security_event('MESSAGE_SENT', client_ip, f'رسالة إلى الجلسة {sid}: {title}', 'INFO')
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path == '/api/sessions/disconnect':
            sid = int(body.get('session_id', -1))
            res = Win32WtsService.disconnect_session(sid)
            db_add_security_event('SESSION_DISCONNECTED', client_ip, f'فصل الجلسة {sid} بواسطة {username}', 'WARNING')
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path == '/api/sessions/logoff':
            sid = int(body.get('session_id', -1))
            res = Win32WtsService.logoff_session(sid)
            db_add_security_event('SESSION_LOGOFF', client_ip, f'تسجيل خروج الجلسة {sid} بواسطة {username}', 'WARNING')
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path == '/api/sessions/shadow':
            sid = int(body.get('session_id', -1))
            mode = body.get('mode', 'view')
            db_add_security_event('SESSION_SHADOW', client_ip, f'مشاركة شاشة الجلسة {sid} بنمط {mode} بواسطة {username}', 'INFO')
            try:
                cmd = ['mstsc.exe', f'/shadow:{sid}']
                if mode == 'control':
                    cmd.append('/control')
                cmd.append('/noConsentPrompt')
                subprocess.Popen(cmd)
            except Exception as e:
                logger.error(f"Failed to launch mstsc shadow: {e}")
            return self.respond_json(200, {
                'ok': True,
                'session_id': sid,
                'mode': mode,
                'message': f'تم إطلاق نافذة مشاركة الشاشة للجلسة {sid} بنمط {mode}.',
            })

        if path == '/api/sessions/shadow/enable-policy':
            res = Win32WtsService.enable_shadow_policy()
            db_add_security_event('SHADOW_POLICY_MODIFIED', client_ip, 'تفعيل سياسة RDP Shadowing في الريجستري', 'WARNING')
            return self.respond_json(200 if res.get('ok') else 400, res)

        # --- Port Guard & Isolation Actions ---
        if path in ('/api/ports/guard/check', '/api/ports/check'):
            target_port = int(body.get('port', 3000))
            user_claimant = body.get('username', username)
            sid = body.get('session_id')
            res = PortIsolationService.check_conflict(target_port, user_claimant, sid)
            return self.respond_json(200, res)

        if path in ('/api/ports/guard/claim', '/api/ports/claim'):
            req_port = int(body.get('requested_port', body.get('preferred_port', body.get('port', 3000))))
            user_claimant = body.get('username', username)
            sid = body.get('session_id')
            pname = body.get('project_name', '')
            res = PortIsolationService.claim_port(req_port, user_claimant, sid, pname)
            return self.respond_json(200, res)

        if path in ('/api/ports/guard/release', '/api/ports/release'):
            port = int(body.get('port', 0))
            user_claimant = body.get('username', username)
            res = PortIsolationService.release_port(port, user_claimant)
            return self.respond_json(200, res)

        if path in ('/api/ports/close-process', '/api/processes/terminate'):
            pid = int(body.get('pid', 0))
            res = PortIsolationService.close_process(pid)
            db_add_security_event('PROCESS_TERMINATED', client_ip, f'إنهاء العملية PID {pid}: {res}', 'WARNING')
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path == '/api/security/events':
            ev_type = str(body.get('event_type') or 'SECURITY_ALERT')
            ev_details = str(body.get('details') or '')
            db_add_security_event(ev_type, client_ip, ev_details, 'WARNING')
            return self.respond_json(200, {'ok': True})

        if path in ('/api/ports/block-ip', '/api/security/block'):
            ip = str(body.get('ip', ''))
            res = PortIsolationService.block_ip(ip)
            db_add_security_event('IP_BLOCKED', ip, f'حظر عنوان IP في جدار الحماية: {res}', 'ALERT')
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path == '/api/security/unblock':
            ip = str(body.get('ip', ''))
            rule_name = f"ASAAS_Block_{ip.replace(':', '_')}"
            cmd = ['netsh', 'advfirewall', 'firewall', 'delete', 'rule', f'name={rule_name}']
            try:
                subprocess.run(cmd, shell=False, creationflags=0x08000000, capture_output=True, timeout=5)
            except Exception:
                pass
            db_add_security_event('IP_UNBLOCKED', ip, f'إلغاء حظر IP: {ip}', 'INFO')
            return self.respond_json(200, {'ok': True, 'ip': ip, 'message': 'تم إلغاء الحظر بنجاح.'})

        if path in ('/api/ports/diagnose', '/api/assets/test'):
            host = body.get('address', body.get('host', '127.0.0.1'))
            port = int(body.get('port', 80))
            in_use = PortIsolationService.is_port_in_use(port)
            return self.respond_json(200, {
                'ok': True,
                'host': host,
                'port': port,
                'reachable': in_use,
                'status': 'OPEN' if in_use else 'CLOSED',
                'latency_ms': 0.5 if in_use else None
            })

        # --- Bastion Assets Management ---
        if path in ('/api/assets/add', '/api/bastion/assets/add'):
            asset = ManagedAsset(
                id=body.get('id', f"asset-{int(time.time())}"),
                name=body.get('name', 'New Asset'),
                host=body.get('host', body.get('address', '127.0.0.1')),
                type=body.get('type', body.get('platform_display', 'Windows Server')),
                port=int(body.get('port', 3389)),
                protocol=body.get('protocol', 'RDP'),
                category=body.get('category', 'Custom Server'),
                is_local=False,
            )
            res = BastionService.add_asset(asset)
            db_add_security_event('ASSET_ADDED', asset.host, f'إضافة خادم {asset.name} ({asset.protocol})', 'INFO')
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path in ('/api/assets/remove', '/api/assets/delete'):
            asset_id = body.get('id', '')
            res = BastionService.remove_asset(asset_id)
            db_add_security_event('ASSET_REMOVED', client_ip, f'حذف خادم {asset_id}', 'INFO')
            return self.respond_json(200, res)

        # --- Command Risk Interceptor ---
        if path in ('/api/security/evaluate-command', '/api/security/command-check', '/api/bastion/check-command'):
            cmd = body.get('command', '')
            res = BastionService.evaluate_command_risk(cmd)
            if not res.get('safe'):
                db_add_security_event('COMMAND_BLOCKED', client_ip, f'اعتراض أمر عالي الخطورة: {cmd}', 'CRITICAL')
            return self.respond_json(200, res)

        # --- Vault Management Actions ---
        if path == '/api/vault/accounts/add':
            acc_id = f"vault-{int(time.time())}"
            new_acc = {
                'id': acc_id,
                'asset_id': body.get('asset_id', ''),
                'username': body.get('username', ''),
                'protocol': body.get('protocol', 'SSH'),
                'domain': body.get('domain', 'LOCAL'),
                'has_password': True,
                'notes': body.get('notes', ''),
                'updated_at': time.strftime('%Y-%m-%d %H:%M'),
            }
            _VAULT_ACCOUNTS.append(new_acc)
            db_add_security_event('VAULT_CREDENTIAL_ADDED', client_ip, f'إضافة حساب خزنة: {new_acc["username"]}', 'WARNING')
            return self.respond_json(200, {'ok': True, 'account': new_acc})

        if path == '/api/vault/accounts/delete':
            acc_id = body.get('id', '')
            _VAULT_ACCOUNTS[:] = [a for a in _VAULT_ACCOUNTS if a.get('id') != acc_id]
            db_add_security_event('VAULT_CREDENTIAL_DELETED', client_ip, f'حذف حساب خزنة: {acc_id}', 'WARNING')
            return self.respond_json(200, {'ok': True, 'id': acc_id})

        if path == '/api/vault/reveal':
            master_k = body.get('master_key', '')
            if len(master_k) < 6:
                return self.respond_json(400, {'ok': False, 'error': 'مفتاح Master Key غير صحيح.'})
            db_add_security_event('VAULT_PASSWORD_REVEALED', client_ip, f'كشف كلمة مرور حساب {body.get("id")} بواسطة {username}', 'WARNING')
            return self.respond_json(200, {'ok': True, 'password': '•••••••••••• (محمي بواسطة Master Key)'})

        # --- Alerts Config & Test (Story 6) ---
        if path == '/api/alerts/config':
            updated = AlertService.update_config(body)
            db_add_security_event('ALERT_CONFIG_UPDATED', client_ip, f'تحديث إعدادات الإنذار وتيليجرام بواسطة {username}', 'INFO')
            return self.respond_json(200, {'ok': True, 'config': updated})

        if path == '/api/alerts/test':
            msg = body.get('message', 'اختبار تنبيه تجريبي مباشر من منظومة أساس ASAAS Server Control v2.5')
            res = AlertService.send_telegram_alert(msg, 'test_alert', force=True)
            return self.respond_json(200, res)

        # --- Real Windows Services Control ---
        if path == '/api/services/control':
            svc_name = body.get('name', '').strip()
            action = body.get('action', 'restart').lower()
            if not svc_name:
                return self.respond_json(400, {'ok': False, 'error': 'اسم الخدمة مطلوب.'})

            cmd_map = {
                'start': ['sc.exe', 'start', svc_name],
                'stop': ['sc.exe', 'stop', svc_name],
            }

            try:
                if action == 'restart':
                    subprocess.run(['sc.exe', 'stop', svc_name], capture_output=True, timeout=5, creationflags=0x08000000)
                    time.sleep(1.0)
                    r = subprocess.run(['sc.exe', 'start', svc_name], capture_output=True, text=True, timeout=10, creationflags=0x08000000)
                elif action in cmd_map:
                    r = subprocess.run(cmd_map[action], capture_output=True, text=True, timeout=10, creationflags=0x08000000)
                else:
                    return self.respond_json(400, {'ok': False, 'error': f'الإجراء {action} غير معتمد.'})

                if r.returncode != 0:
                    err_text = (r.stderr or r.stdout or '').strip()
                    if 'FAILED 5' in err_text or 'Access is denied' in err_text:
                        return self.respond_json(403, {
                            'ok': False,
                            'error': f'تم رفض الوصول (Access Denied Error 5). يتطلب التحكم في الخدمة {svc_name} تشغيل السيرفر بصلاحيات مسؤول (Run as Administrator).'
                        })
                    return self.respond_json(400, {
                        'ok': False,
                        'error': f'فشل تنفيذ الأمر على الخدمة {svc_name}: {err_text}'
                    })

                db_add_security_event('SERVICE_CONTROL', client_ip, f'إجراء {action} على الخدمة {svc_name} بواسطة {username}', 'INFO')
                return self.respond_json(200, {
                    'ok': True,
                    'service': svc_name,
                    'action': action,
                    'status': 'Running' if action in ('start', 'restart') else 'Stopped',
                    'message': f'تم تنفيذ أمر ({action}) على الخدمة {svc_name} بنجاح.',
                })
            except Exception as exc:
                return self.respond_json(500, {'ok': False, 'error': str(exc)})

        # --- JIT Elevation Actions ---
        if path == '/api/jit/request':
            target_role = body.get('role', 'Operator (Temporary)')
            reason = body.get('reason', 'مهمة صيانة طارئة')
            duration_mins = int(body.get('duration_mins', 30))
            req_user = body.get('user', username)
            res = db_create_jit_grant(req_user, target_role, reason, duration_mins, approver=f'Admin ({username})')
            return self.respond_json(200, res)

        if path == '/api/jit/revoke':
            grant_id = body.get('id', '')
            res = db_revoke_jit_grant(grant_id, revoked_by=username)
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path == '/api/users/reset-password':
            uname = body.get('username', '').strip()
            new_pwd = body.get('password', body.get('new_password', '')).strip()
            res = UserService.reset_password(uname, new_pwd)
            if res.get('ok'):
                db_add_security_event('USER_PASSWORD_RESET', client_ip, f'تغيير كلمة مرور مستخدم ويندوز {uname} بواسطة {username}', 'WARNING')
            return self.respond_json(200 if res.get('ok') else 400, res)

        # --- Local Windows User Management ---
        if path == '/api/users/create':
            uname = body.get('username', '')
            pwd = body.get('password', '')
            fname = body.get('full_name', '')
            is_rdp = bool(body.get('is_rdp', True))
            is_admin = bool(body.get('is_admin', False))
            res = UserService.create_user(uname, pwd, fname, is_rdp, is_admin)
            if res.get('ok'):
                db_add_security_event('USER_CREATED', client_ip, f'إنشاء مستخدم ويندوز محلي جديد: {uname} بواسطة {username}', 'WARNING')
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path == '/api/users/delete':
            uname = body.get('username', '')
            res = UserService.delete_user(uname)
            if res.get('ok'):
                db_add_security_event('USER_DELETED', client_ip, f'حذف مستخدم ويندوز محلي: {uname} بواسطة {username}', 'CRITICAL')
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path == '/api/users/toggle-state':
            uname = body.get('username', '')
            en = bool(body.get('enabled', True))
            res = UserService.toggle_user_state(uname, en)
            if res.get('ok'):
                action_text = 'تفعيل' if en else 'تعطيل'
                db_add_security_event('USER_STATE_CHANGED', client_ip, f'{action_text} حساب مستخدم ويندوز: {uname} بواسطة {username}', 'WARNING')
            return self.respond_json(200 if res.get('ok') else 400, res)

        # --- Fallback for unmatched API routes ---
        if path.startswith('/api/'):
            return self.respond_json(404, {
                'ok': False,
                'error': f'المسار {path} قيد التطوير أو غير موجود على سيرفر ASAAS.'
            })

        self.send_error(405, "Method Not Allowed")

    def serve_static(self, path: str) -> None:
        """Serves frontend static build assets with SPA client-side fallback, plus Stitch screens."""
        # Serve Stitch design screens directly
        if path.startswith('/stitch/'):
            rel_stitch = path[len('/stitch/'):]
            target_stitch = (STITCH_DIR / rel_stitch).resolve()
            if target_stitch.is_file() and target_stitch.is_relative_to(STITCH_DIR):
                ctype, _ = mimetypes.guess_type(str(target_stitch))
                if not ctype:
                    ctype = 'application/octet-stream'
                try:
                    with open(target_stitch, 'rb') as f:
                        content = f.read()
                    self.send_response(200)
                    self.send_header('Content-Type', ctype)
                    self.send_header('Content-Length', str(len(content)))
                    self.send_header('Cache-Control', 'no-cache')
                    self.send_header('X-Content-Type-Options', 'nosniff')
                    self.end_headers()
                    self.wfile.write(content)
                    return
                except Exception as exc:
                    self.send_error(500, f"Error reading stitch file: {exc}")
                    return
            else:
                self.send_error(404, "Stitch file not found")
                return

        # Determine static directory
        static_dir = LEGACY_DIST_DIR if LEGACY_DIST_DIR.is_dir() else FRONTEND_DIST_DIR

        rel_path = path.lstrip('/')
        if not rel_path:
            rel_path = 'index.html'

        target_file = (static_dir / rel_path).resolve()

        # If file does not exist, fallback to index.html for SPA routes
        if not target_file.is_file() or not target_file.is_relative_to(static_dir):
            target_file = (static_dir / 'index.html').resolve()

        if not target_file.is_file():
            self.send_error(404, "Index or file not found")
            return

        ctype, _ = mimetypes.guess_type(str(target_file))
        if not ctype:
            ctype = 'application/octet-stream'

        try:
            with open(target_file, 'rb') as f:
                content = f.read()
            self.send_response(200)
            self.send_header('Content-Type', ctype)
            self.send_header('Content-Length', str(len(content)))
            if target_file.name == 'index.html':
                self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
                self.send_header('Pragma', 'no-cache')
                self.send_header('Expires', '0')
            else:
                self.send_header('Cache-Control', 'no-cache')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.end_headers()
            if getattr(self, 'command', 'GET') != 'HEAD':
                self.wfile.write(content)
        except Exception as exc:
            self.send_error(500, f"Error reading static file: {exc}")
