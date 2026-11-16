"""ZIMAM v2.5 - Modular HTTP Request Router & Static File Handler.

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
import re
import subprocess
import sys
import threading
import time
import socket
import secrets
import html
import urllib.parse
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import psutil

from ..core.config import FRONTEND_DIST_DIR, LEGACY_DIST_DIR
from ..domain.models import ManagedAsset
from ..infrastructure.db import (
    init_db,
    db_list_security_events,
    db_add_security_event,
    db_authenticate_user,
    db_create_session,
    db_validate_session,
    db_sync_proxied_user,
    db_revoke_session,
    db_list_app_users,
    db_get_app_user,
    db_create_app_user,
    db_delete_app_user,
    db_update_app_user_role,
    db_change_user_password,
    db_get_historical_metrics,
    db_list_jit_grants,
    db_create_jit_grant,
    db_approve_jit_grant,
    db_revoke_jit_grant,
    db_verify_audit_chain,
    db_refresh_server_health,
)
from ..infrastructure.win32_wts import Win32WtsService
from ..infrastructure.windows_providers import (
    SystemProvider,
    RoleProvider,
    ServiceProvider,
    ProcessProvider,
    StorageProvider,
    NetworkProvider,
    FirewallProvider,
    EventViewerProvider,
    UpdateProvider,
    TaskSchedulerProvider,
    CertificatesProvider,
    HyperVProvider,
    DockerProvider,
)
from ..infrastructure.action_engine import ActionEngine
from ..services.developer_workspace_service import (
    SmartPortOrchestrator,
    DeveloperWorkspaceManager,
)
from ..infrastructure.db import (
    db_list_servers,
    db_add_server,
    db_delete_server,
    db_list_server_groups,
    db_create_server_group,
    db_delete_server_group,
    db_list_developer_projects,
    db_create_developer_project,
    db_update_project_status,
    db_delete_developer_project,
    db_list_action_jobs,
    db_get_resource_quotas,
    db_save_resource_quota,
    db_list_conflict_events,
)
from ..services.alert_service import AlertService
from ..services.bastion_service import BastionService
from ..services.domain_service import DomainService
from ..services.governor_service import GovernorService
from ..services.port_isolation_service import PortIsolationService
from ..services.storage_service import StorageService
from ..services.telemetry_service import TelemetryService
from ..services.user_service import UserService
from ..services.database_service import DatabaseService

logger = logging.getLogger('zimam.router')

# Initialize database on startup
init_db()
AlertService.initialize()

# Shared service instances
telemetry_service = TelemetryService()
governor_service = GovernorService()

# The legacy v2 vault is intentionally empty. Real account secrets live in the
# encrypted v1 control-plane store and are consumed by a gateway, never shown
# to this browser API.
_VAULT_ACCOUNTS: List[Dict[str, Any]] = []


def _extract_blocked_ips(events: List[Dict[str, Any]]) -> List[str]:
    """Replays firewall block/unblock audit events to return the currently blocked IPs."""
    blocked: List[str] = []
    for ev in sorted(events, key=lambda item: item.get('id', 0)):
        event_type = str(ev.get('event_type', '')).upper()
        ip = str(ev.get('ip') or ev.get('ip_address') or '').strip()
        if not ip:
            continue
        if event_type in ('IP_BLOCKED', 'BRUTE_FORCE_BLOCKED', 'IP_BANNED', 'FAIL2BAN_BAN'):
            if ip not in blocked:
                blocked.append(ip)
        elif event_type == 'IP_UNBLOCKED':
            blocked = [item for item in blocked if item != ip]
    return blocked


class ZimamApiHandler(SimpleHTTPRequestHandler):
    """Clean HTTP Request Handler for ZIMAM v2.5 with Multi-User RBAC."""

    server_version = "ZIMAM-Control/3.0"

    def log_message(self, format: str, *args: Any) -> None:
        """Safe request logging resilient to pythonw (where sys.stderr is None)."""
        try:
            if sys.stderr is not None:
                sys.stderr.write("%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), format % args))
                sys.stderr.flush()
        except Exception:
            pass

    def _origin_allowed(self) -> bool:
        """Allow same-origin browser calls and explicitly configured console origins."""
        origin = self.headers.get('Origin', '').rstrip('/')
        if not origin:
            return True
        host = self.headers.get('Host', '')
        same_origin = {f'http://{host}', f'https://{host}'}
        configured = {
            item.strip().rstrip('/')
            for item in os.getenv('ZIMAM_ALLOWED_ORIGINS', '').split(',')
            if item.strip()
        }
        return origin in same_origin or origin in configured

    def _session_cookie(self, token: str, *, clear: bool = False) -> str:
        # Local development uses HTTP; production deployments should set this
        # explicitly to 1 behind the TLS reverse proxy.
        secure = os.getenv('ZIMAM_COOKIE_SECURE', '0').lower() not in {'0', 'false', 'no'}
        value = '' if clear else token
        max_age = 0 if clear else 86400
        cookie = f'zimam_session={value}; Path=/; HttpOnly; SameSite=Strict; Max-Age={max_age}'
        if secure:
            cookie += '; Secure'
        return cookie

    def respond_json(
        self,
        status: int,
        data: Dict[str, Any],
        elapsed_ms: float = 0.0,
        extra_headers: Optional[Dict[str, str]] = None,
    ) -> None:
        """Sends a UTF-8 encoded JSON response with enterprise security headers and benchmark time."""
        body = json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        origin = self.headers.get('Origin', '').rstrip('/')
        if origin and self._origin_allowed():
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Access-Control-Allow-Credentials', 'true')
            self.send_header('Vary', 'Origin')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'SAMEORIGIN')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        if elapsed_ms > 0:
            self.send_header('X-Response-Time-Ms', f"{elapsed_ms:.2f}")
        for name, value in (extra_headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        if getattr(self, 'command', 'GET') != 'HEAD':
            self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        """Handles CORS preflight requests."""
        if not self._origin_allowed():
            return self.respond_json(403, {'ok': False, 'error': 'Origin غير مسموح.'})
        self.send_response(204)
        origin = self.headers.get('Origin', '').rstrip('/')
        if origin:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Access-Control-Allow-Credentials', 'true')
            self.send_header('Vary', 'Origin')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Token, X-Zimam-Token')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'SAMEORIGIN')
        self.end_headers()

    def _extract_token(self) -> str:
        """Extract a server session from HttpOnly cookie or explicit API header."""
        token = self.headers.get('X-Session-Token') or self.headers.get('X-Zimam-Token') or ''
        if not token:
            auth_h = self.headers.get('Authorization', '')
            if auth_h.startswith('Bearer '):
                token = auth_h[7:].strip()
        if not token:
            cookie = SimpleCookie()
            try:
                cookie.load(self.headers.get('Cookie', ''))
                morsel = cookie.get('zimam_session')
                token = morsel.value if morsel else ''
            except Exception:
                token = ''
        return token

    def _authenticate(self) -> Tuple[bool, Dict[str, Any]]:
        """Validate a per-user server-side session."""
        token = self._extract_token()
        if token:
            sess = db_validate_session(token)
            if sess:
                return True, sess

        # Control-plane bridge: the :8876 proxy validates an /api/v1 session
        # and forwards username + role as X-ZIMAM-Proxy-*. Trusted only from
        # loopback — browsers cannot set the headers (absent from the CORS
        # allow-headers list) and this listener is not exposed remotely.
        # The local app_users row is a projection kept in sync by role.
        # NOTE: dual-stack listeners report IPv4 peers as '::ffff:127.0.0.1',
        # so the mapped form must be listed alongside plain loopback.
        if self.client_address[0] in ('127.0.0.1', '::1', '::ffff:127.0.0.1'):
            proxy_user = (self.headers.get('X-ZIMAM-Proxy-User') or '').strip()
            if proxy_user:
                proxy_role = (self.headers.get('X-ZIMAM-Proxy-Role') or '').strip()
                profile = db_sync_proxied_user(proxy_user, proxy_role)
                if profile:
                    return True, {
                        'user_id': profile.get('id'),
                        'username': profile.get('username'),
                        'role': profile.get('role'),
                        'full_name': profile.get('full_name'),
                        'ip': self.client_address[0],
                        'expires_at': '',
                    }

        return False, {}

    def do_GET(self) -> None:
        t0 = time.perf_counter()
        path = self.path.split('?')[0]

        # --- Health & Diagnostic (Public / Unauthenticated) ---
        if path == '/api/health':
            is_valid, sess = self._authenticate()
            health_metrics = telemetry_service.get_metrics()
            return self.respond_json(200, {
                'ok': True,
                'status': 'operational',
                'version': '3.0.0',
                'is_admin': Win32WtsService.is_admin(),
                'is_windows': getattr(health_metrics, 'is_windows', True),
                'os_kind': 'windows' if getattr(health_metrics, 'is_windows', True) else 'linux',
                'os_display': getattr(health_metrics, 'os', None),
                'authenticated': is_valid,
                'current_user': sess.get('username') if is_valid else None,
                'current_role': sess.get('role') if is_valid else None,
            }, (time.perf_counter() - t0) * 1000)

        # Every legacy data/control endpoint is authenticated.  This v2 surface
        # remains only as a compatibility layer while pages migrate to /api/v1.
        if path.startswith('/api/'):
            is_valid, _ = self._authenticate()
            if not is_valid:
                return self.respond_json(401, {
                    'ok': False,
                    'error': 'غير مصرح: يلزم تسجيل الدخول للوصول إلى واجهة الإدارة.',
                })

        # --- High-Performance Server-Sent Events (SSE) Live Stream ---
        if path in ('/api/stream/telemetry', '/api/telemetry/stream'):
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream; charset=utf-8')
            self.send_header('Cache-Control', 'no-cache, no-transform')
            self.send_header('Connection', 'keep-alive')
            origin = self.headers.get('Origin', '').rstrip('/')
            if origin and self._origin_allowed():
                self.send_header('Access-Control-Allow-Origin', origin)
                self.send_header('Access-Control-Allow-Credentials', 'true')
                self.send_header('Vary', 'Origin')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.end_headers()

            try:
                self.wfile.write(b": zimam-v2.5 sse stream initialized\n\n")
                self.wfile.flush()

                while not getattr(self.server, '_BaseServer__shutdown_request', False):
                    metrics = telemetry_service.get_metrics().to_dict()
                    active_sess = [s.to_dict() for s in Win32WtsService.list_active_sessions()]
                    inventory = telemetry_service.get_live_inventory()
                    from ..infrastructure.db import db_list_user_notifications
                    recent_notifs = db_list_user_notifications(limit=5)
                    payload = json.dumps({
                        'ok': True,
                        'host': metrics,
                        'metrics': metrics,
                        'sessions': active_sess if active_sess else metrics.get('active_sessions', []),
                        'users_count': len(active_sess),
                        'processes': inventory.get('processes', []),
                        'services': inventory.get('services', []),
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
            profile = db_get_app_user(sess.get('username', '')) or {}
            return self.respond_json(200, {
                'ok': True,
                'user': {
                    'id': profile.get('id', sess.get('user_id', 1)),
                    'username': profile.get('username', sess.get('username', 'admin')),
                    'role': profile.get('role', sess.get('role', 'admin')),
                    'full_name': profile.get('full_name', sess.get('full_name', 'مدير النظام')),
                    'is_active': bool(profile.get('is_active', True)),
                    'created_at': profile.get('created_at', ''),
                    'last_login': profile.get('last_login'),
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
            inventory = telemetry_service.get_live_inventory()
            users = UserService.list_users()

            return self.respond_json(200, {
                'ok': True,
                'host': metrics,
                'metrics': metrics,
                'sessions': [s.to_dict() for s in sessions],
                'users': [u.to_dict() for u in users],
                'users_count': len(users),
                'processes': inventory.get('processes', []),
                'services': inventory.get('services', []),
                'governor': {
                    'active': True,
                    'reclaimed_mb': governor_service.reclaimed_mb,
                    'auto_trim_enabled': governor_service.auto_trim,
                    'session_scoped': True,
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
                'cleanable_mb': drive.cleanable_mb,
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
                svc_list = []
            return self.respond_json(200, {
                'ok': True,
                'services': svc_list,
                'count': len(svc_list)
            })

        # --- Vault Accounts API & Bastion Session Launch ---
        if path == '/api/bastion/connect':
            qs = self.path.split('?')[1] if '?' in self.path else ''
            params = urllib.parse.parse_qs(qs)
            target_host = params.get('host', ['127.0.0.1'])[0].strip()
            protocol = params.get('protocol', ['rdp'])[0].strip().lower()
            asset_name = params.get('name', [target_host])[0].strip() or target_host
            user_hint = params.get('username', ['Administrator'])[0].strip() or 'Administrator'
            try:
                target_port = int(params.get('port', ['3389'])[0])
            except (TypeError, ValueError):
                target_port = 3389
            if not (0 < target_port < 65536):
                target_port = 3389 if protocol.startswith('rdp') else 22

            safe_name = re.sub(r'[^A-Za-z0-9._-]+', '-', asset_name).strip('-') or 'target'
            safe_host = re.sub(r'[^A-Za-z0-9._:\\-]+', '', target_host) or '127.0.0.1'
            safe_user = re.sub(r'[^A-Za-z0-9._@\\-]+', '', user_hint) or 'Administrator'

            if protocol in ('ssh', 'sftp'):
                scheme = 'sftp' if protocol == 'sftp' else 'ssh'
                protocol_uri = f"{scheme}://{urllib.parse.quote(safe_user, safe='')}@{safe_host}:{target_port}"
                protocol_label = 'SFTP' if scheme == 'sftp' else 'SSH'
                page = f"""<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>ZIMAM {protocol_label} Session</title>
<style>
body{{font-family:system-ui,sans-serif;background:#141111;color:#f6f0e5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}}
.card{{max-width:560px;padding:32px;border:1px solid rgba(216,179,111,.35);border-radius:16px;background:rgba(255,246,230,.05)}}
a{{display:inline-block;margin-top:16px;padding:12px 20px;border-radius:10px;background:#d8b36f;color:#141111;font-weight:700;text-decoration:none}}
code{{direction:ltr;display:block;margin-top:12px;color:#d8b36f;word-break:break-all}}
</style></head><body><div class="card">
<h1>جلسة {protocol_label} الآمنة عبر الحصن</h1>
<p>الخادم: <strong>{html.escape(safe_host)}</strong> — المنفذ: <strong>{target_port}</strong></p>
<p>سيُفتح معالج بروتوكول {protocol_label} القياسي في تطبيق العميل المسجل على جهازك.</p>
<a href="{html.escape(protocol_uri)}">فتح رابط {protocol_label} الآن</a>
<code>{html.escape(protocol_uri)}</code>
</div></body></html>""".encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(page)))
                self.send_header('X-ZIMAM-Protocol', protocol_label)
                self.send_header('X-ZIMAM-Session-URI', protocol_uri)
                self.send_header('X-Content-Type-Options', 'nosniff')
                self.end_headers()
                self.wfile.write(page)
                return

            if protocol not in ('rdp', 'rdp-file', 'mstsc'):
                return self.respond_json(400, {
                    'ok': False,
                    'error': f'بروتوكول غير مدعوم: {protocol}. المدعوم: rdp, ssh, sftp.',
                })

            rdp_content = (
                f"full address:s:{safe_host}:{target_port}\r\n"
                f"username:s:{safe_user}\r\n"
                f"screen mode id:i:2\r\n"
                f"desktopwidth:i:1920\r\n"
                f"desktopheight:i:1080\r\n"
                f"session bpp:i:32\r\n"
                f"compression:i:1\r\n"
                f"keyboardhook:i:2\r\n"
                f"audiomode:i:0\r\n"
                f"redirectclipboard:i:1\r\n"
                f"authentication level:i:2\r\n"
                f"prompt for credentials:i:1\r\n"
                f"negotiate security layer:i:1\r\n"
            ).encode('utf-8')

            self.send_response(200)
            self.send_header('Content-Type', 'application/x-rdp')
            self.send_header('Content-Disposition', f'attachment; filename="zimam-{safe_name}.rdp"')
            self.send_header('Content-Length', str(len(rdp_content)))
            self.send_header('X-ZIMAM-Protocol', 'RDP')
            self.end_headers()
            self.wfile.write(rdp_content)
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
            from ..infrastructure.db import db_list_vault_accounts
            accounts = db_list_vault_accounts()
            return self.respond_json(200, {
                'ok': True,
                'accounts': accounts,
                'count': len(accounts)
            })

        if path in ('/api/replay/events', '/api/replay/timeline'):
            try:
                win_events = EventViewerProvider.get_events('System', max_events=30)
                db_evts = db_list_security_events(50)
                combined = []
                for ev in (win_events or []):
                    msg = ev.get('message', '') or ''
                    combined.append({
                        'id': f"win-{ev.get('id', secrets.token_hex(4))}",
                        'time': str(ev.get('time_created', ''))[-8:],
                        'event': ev.get('provider', 'System Audit'),
                        'command': msg[:120] if msg else f"Windows Event ID {ev.get('id')}",
                        'risk': 'CRITICAL' if 'fail' in msg.lower() or ev.get('level') == 'Error' else 'INFO',
                        'user': 'SYSTEM'
                    })
                for ev in (db_evts or []):
                    combined.append({
                        'id': f"db-{ev.get('id', secrets.token_hex(4))}",
                        'time': str(ev.get('created_at', ''))[-8:],
                        'event': ev.get('event_type', 'ADMIN_ACTION'),
                        'command': str(ev.get('details', '')),
                        'risk': ev.get('severity', 'INFO'),
                        'user': 'admin'
                    })
                return self.respond_json(200, {
                    'ok': True,
                    'events': combined,
                    'count': len(combined)
                })
            except Exception as exc:
                return self.respond_json(200, {'ok': True, 'events': [], 'error': str(exc)})

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
                    'target': 'ZIMAM Server Node',
                    'ip': e.get('ip', '127.0.0.1'),
                    'status': 'SUCCESS' if e.get('severity') != 'CRITICAL' else 'BLOCKED',
                    'details': {'info': e.get('details', ''), 'severity': e.get('severity', 'INFO')}
                })
            return self.respond_json(200, {
                'ok': True,
                'logs': formatted_logs,
                'events': formatted_logs,
                'blocked_ips': _extract_blocked_ips(events),
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
                self.send_header('Content-Disposition', 'attachment; filename="zimam-audit-trail.csv"')
                self.send_header('Content-Length', str(len(exp_body)))
                self.end_headers()
                self.wfile.write(exp_body)
                return
            else:
                exp_body = json.dumps({'ok': True, 'exported_at': time.strftime('%Y-%m-%d %H:%M:%S'), 'events': [dict(x) for x in events]}, indent=2, ensure_ascii=False).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Disposition', 'attachment; filename="zimam-audit-trail.json"')
                self.send_header('Content-Length', str(len(exp_body)))
                self.end_headers()
                self.wfile.write(exp_body)
                return

        if path == '/api/security/stats':
            events = db_list_security_events(1000)
            blocked = [e for e in events if str(e.get('severity', '')).upper() in {'ALERT', 'CRITICAL', 'BLOCKED'}]
            failed = [e for e in events if str(e.get('event_type', '')).upper() in {'LOGIN_FAILED', 'AUTH_FAILED'}]
            blocked_ips = _extract_blocked_ips(events)
            threat = 'HIGH' if len(blocked) >= 20 else 'MEDIUM' if blocked else 'LOW'
            return self.respond_json(200, {
                'ok': True,
                'attacks_intercepted': len(blocked),
                'blocked_ips_count': len(blocked_ips),
                'firewall_active': True,
                'failed_logins_today': len(failed),
                'failed_attempts_count': len(failed),
                'auto_ban_enabled': True,
                'fail_threshold': 5,
                'ban_duration_hours': round(600 / 3600, 2),
                'threat_level': threat,
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
            score = max(0, min(100, round(100 - (metrics.cpu * 0.35) - (metrics.ram * 0.35) - (len(sessions) * 2))))
            status = 'CRITICAL' if score < 50 else 'DEGRADED' if score < 75 else 'HEALTHY'
            return self.respond_json(200, {
                'ok': True,
                'score': score,
                'status': status,
                'summary': f'تم احتساب الحالة من قياسات CPU {metrics.cpu:.1f}% وRAM {metrics.ram:.1f}% وعدد الجلسات الحالية.',
                'recommendations': [
                    'تفعيل الجدار الناري التلقائي لحظر عناوين IP المتكررة في الإخفاق.',
                    'الاستفادة من حاكم الموارد لتفريغ خمول الرام دورياً.',
                ],
                'active_sessions_count': len(sessions),
                'cpu_load': metrics.cpu,
                'ram_load': metrics.ram,
            })

        # =====================================================================
        # ZIMAM Enterprise v3.0: Core Infrastructure & Windows Server Endpoints
        # =====================================================================
        if path == '/api/servers/check':
            db_refresh_server_health(force=True)
            return self.respond_json(200, {'ok': True, 'servers': db_list_servers()})

        if path == '/api/servers':
            return self.respond_json(200, {'ok': True, 'servers': db_list_servers()})

        if path == '/api/server-groups':
            return self.respond_json(200, {'ok': True, 'groups': db_list_server_groups()})

        if path == '/api/server/local':
            info = SystemProvider.get_local_server_info()
            return self.respond_json(200, {'ok': True, 'local_server': info, **info})

        if path == '/api/roles':
            force_ref = 'refresh=1' in self.path
            return self.respond_json(200, {'ok': True, 'roles': RoleProvider.get_roles_inventory(force_ref)})

        if path == '/api/processes':
            return self.respond_json(200, {'ok': True, 'processes': ProcessProvider.get_process_list()})

        if path == '/api/storage/disks':
            return self.respond_json(200, {'ok': True, 'disks': StorageProvider.get_physical_disks()})

        if path == '/api/storage/volumes':
            return self.respond_json(200, {'ok': True, 'volumes': StorageProvider.get_volumes()})

        if path == '/api/storage/shares':
            return self.respond_json(200, {'ok': True, 'shares': StorageProvider.get_smb_shares()})

        if path == '/api/storage/explorer':
            target_dir = 'C:\\'
            if 'path=' in self.path:
                try:
                    qs = self.path.split('?')[1]
                    params = urllib.parse.parse_qs(qs)
                    target_dir = params.get('path', ['C:\\'])[0]
                except Exception:
                    pass
            return self.respond_json(200, StorageProvider.browse_directory(target_dir))

        if path == '/api/network/adapters':
            return self.respond_json(200, {'ok': True, 'adapters': NetworkProvider.get_adapters()})

        if path == '/api/firewall/status':
            return self.respond_json(200, FirewallProvider.get_firewall_status())

        if path == '/api/firewall/rules':
            return self.respond_json(200, {'ok': True, 'rules': FirewallProvider.get_firewall_rules()})

        if path == '/api/events':
            log_n = 'System'
            if 'log=' in self.path:
                for part in self.path.split('?')[1].split('&'):
                    if part.startswith('log='):
                        log_n = part.split('=')[1]
            return self.respond_json(200, {'ok': True, 'events': EventViewerProvider.get_events(log_n)})

        if path == '/api/tasks':
            return self.respond_json(200, {'ok': True, 'tasks': TaskSchedulerProvider.get_tasks()})

        if path in ('/api/updates', '/api/updates/status'):
            return self.respond_json(200, UpdateProvider.get_update_status())

        if path == '/api/certificates':
            return self.respond_json(200, {'ok': True, 'certificates': CertificatesProvider.get_certificates()})

        if path == '/api/hyperv/status':
            return self.respond_json(200, HyperVProvider.get_hyperv_status())

        if path == '/api/docker/status':
            return self.respond_json(200, DockerProvider.get_docker_status())

        if path == '/api/workspaces/projects':
            is_valid, sess = self._authenticate()
            owner = sess.get('username') if sess.get('role') != 'admin' else None
            return self.respond_json(200, {'ok': True, 'projects': DeveloperWorkspaceManager.list_projects_with_health(owner)})

        if path == '/api/conflicts':
            return self.respond_json(200, {'ok': True, 'conflicts': db_list_conflict_events()})

        if path == '/api/quotas':
            is_valid, sess = self._authenticate()
            scope_user = sess.get('username', 'default')
            return self.respond_json(200, {'ok': True, 'quotas': db_get_resource_quotas('user', scope_user)})

        if path == '/api/action-jobs':
            return self.respond_json(200, {'ok': True, 'jobs': db_list_action_jobs()})

        # --- Sovereign Database Studio & Engine Governance (Story 10) ---
        if path == '/api/database/engines':
            return self.respond_json(200, {'ok': True, 'engines': DatabaseService.get_database_engines()})

        if path == '/api/database/stats':
            return self.respond_json(200, DatabaseService.get_system_database_stats())

        if path == '/api/database/tables':
            return self.respond_json(200, {'ok': True, 'tables': DatabaseService.get_tables_list()})

        if path == '/api/database/table-data':
            table_name = ''
            limit = 50
            offset = 0
            if '?' in self.path:
                for part in self.path.split('?')[1].split('&'):
                    if part.startswith('table='):
                        table_name = urllib.parse.unquote(part.split('=')[1])
                    elif part.startswith('limit='):
                        try:
                            limit = int(part.split('=')[1])
                        except:
                            pass
                    elif part.startswith('offset='):
                        try:
                            offset = int(part.split('=')[1])
                        except:
                            pass
            return self.respond_json(200, DatabaseService.get_table_data(table_name, limit, offset))

        if path == '/api/database/backups':
            return self.respond_json(200, {'ok': True, 'backups': DatabaseService.list_backups()})

        # --- CRITICAL: Prevent API routes from falling into static SPA index.html ---
        if path.startswith('/api/'):
            return self.respond_json(404, {
                'ok': False,
                'error': f'المسار {path} قيد التطوير أو غير موجود على سيرفر ZIMAM.'
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

        if not self._origin_allowed():
            return self.respond_json(403, {'ok': False, 'error': 'Origin غير مسموح.'})

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
                'user': user,
                'message': f'مرحباً بك {user["full_name"]}. تم تسجيل الدخول بنجاح.',
            }, extra_headers={'Set-Cookie': self._session_cookie(token)})

        if path == '/api/auth/logout':
            token = self._extract_token()
            db_revoke_session(token)
            return self.respond_json(
                200,
                {'ok': True, 'message': 'تم تسجيل الخروج بنجاح.'},
                extra_headers={'Set-Cookie': self._session_cookie('', clear=True)},
            )

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
        # 1. Block Viewer role from ALL mutating/control endpoints, except changing their own password.
        #    JIT requests are self-service workflow submissions, not direct
        #    privileged actions, so viewers may submit one for admin approval.
        if user_role == 'viewer' and path not in ('/api/auth/change-password', '/api/jit/request'):
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
            '/api/jit/approve',
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
            is_adm = Win32WtsService.is_admin()
            db_add_security_event('ELEVATION_CHECK', client_ip, f'فحص صلاحيات المسؤول للنظام: {is_adm}', 'INFO')
            return self.respond_json(200, {
                'ok': True,
                'already_admin': is_adm,
                'message': 'السيرفر يعمل بصلاحيات تشغيلية آمنة. كافة العمليات الإدارية الحساسة تخضع لمحرك Action Engine ووسيط العمليات المميزة.' if not is_adm else 'السيرفر يعمل بصلاحيات مسؤول كاملة.',
            })

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
            title = body.get('title', 'تنبيه إداري من سيرفر ZIMAM')
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
            rule_name = f"ZIMAM_Block_{ip.replace(':', '_')}"
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
            started = time.perf_counter()
            reachable = False
            error = None
            try:
                with socket.create_connection((str(host), port), timeout=2.0):
                    reachable = True
            except OSError as exc:
                error = str(exc)
            latency = round((time.perf_counter() - started) * 1000, 2) if reachable else None
            return self.respond_json(200, {
                'ok': True,
                'host': host,
                'port': port,
                'reachable': reachable,
                'status': 'OPEN' if reachable else 'CLOSED',
                'latency_ms': latency,
                'error': error,
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

        # --- Vault Management Actions (Domain 8: AES-256-GCM Encrypted Vault) ---
        if path == '/api/vault/accounts/add':
            from ..infrastructure.db import db_add_vault_account
            res = db_add_vault_account(
                asset_id=body.get('asset_id', ''),
                asset_name=body.get('asset_name', body.get('name', '')),
                username=body.get('username', ''),
                protocol=body.get('protocol', 'RDP'),
                secret=body.get('password', body.get('secret', '')),
                metadata=body.get('metadata')
            )
            return self.respond_json(200, res)

        if path == '/api/vault/accounts/delete':
            from ..infrastructure.db import db_delete_vault_account
            res = db_delete_vault_account(body.get('id', ''))
            return self.respond_json(200, res)

        if path == '/api/vault/reveal':
            from ..infrastructure.db import db_reveal_vault_secret
            res = db_reveal_vault_secret(body.get('id', ''), requester=username)
            return self.respond_json(200 if res.get('ok') else 400, res)

        # --- Alerts Config & Test (Story 6) ---
        if path == '/api/alerts/config':
            updated = AlertService.update_config(body)
            db_add_security_event('ALERT_CONFIG_UPDATED', client_ip, f'تحديث إعدادات الإنذار وتيليجرام بواسطة {username}', 'INFO')
            return self.respond_json(200, {'ok': True, 'config': updated})

        if path == '/api/alerts/test':
            msg = body.get('message', 'اختبار تنبيه تجريبي مباشر من زِمام ZIMAM v2.5')
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

        # --- JIT Elevation Actions (Domain 6: Sovereign Elevation & JIT PAM) ---
        if path == '/api/jit/request':
            requested_user = username
            if user_role == 'admin' and body.get('username'):
                requested_user = str(body.get('username')).strip() or username
            is_admin_self_request = (
                user_role == 'admin' and requested_user.lower() == username.lower()
            )
            grant_status = 'ACTIVE' if is_admin_self_request else 'PENDING'
            approver = f"Admin Policy Engine ({username})" if is_admin_self_request else 'Pending Admin Approval'
            try:
                duration_mins = max(1, min(480, int(body.get('duration_mins', 30))))
            except (TypeError, ValueError):
                duration_mins = 30
            res = db_create_jit_grant(
                user=requested_user,
                target_role=body.get('role', body.get('target_role', 'Local Administrator')),
                reason=body.get('reason', 'Administrative Emergency Elevation'),
                duration_mins=duration_mins,
                approver=approver,
                status=grant_status,
            )
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path == '/api/jit/approve':
            grant_id = str(body.get('id', '')).strip()
            if not grant_id:
                return self.respond_json(400, {'ok': False, 'error': 'معرف طلب الصلاحية (id) مطلوب.'})
            res = db_approve_jit_grant(
                grant_id,
                approver=username,
                approve=bool(body.get('approve', True)),
            )
            return self.respond_json(200 if res.get('ok') else 400, res)

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

        # =====================================================================
        # ZIMAM Enterprise v3.0: Mutating Operations via Unified Action Engine
        # =====================================================================
        if path == '/api/servers':
            s_name = body.get('name', 'Server')
            s_ip = body.get('ip', '127.0.0.1')
            s_os = body.get('os', 'Windows Server 2025')
            s_dom = body.get('domain', 'WORKGROUP')
            res = db_add_server(s_name, s_ip, s_os, s_dom)
            db_add_security_event('SERVER_REGISTERED', s_ip, f'تسجيل خادم جديد {s_name} بواسطة {username}', 'INFO')
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path == '/api/servers/delete':
            sid = body.get('id', '')
            res = db_delete_server(sid)
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path == '/api/server-groups/create':
            g_name = body.get('name', '')
            g_desc = body.get('description', '')
            s_ids = body.get('server_ids', [])
            res = db_create_server_group(g_name, g_desc, s_ids)
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path == '/api/server-groups/delete':
            gid = body.get('id', '')
            res = db_delete_server_group(gid)
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path == '/api/server/restart':
            confirmed = bool(body.get('confirmed', False))
            res = ActionEngine.execute(
                'SYSTEM_RESTART', username, user_role, 'srv-local',
                {'reason': body.get('reason', 'ZIMAM UI Restart'), 'timeout_sec': int(body.get('timeout', 30))},
                SystemProvider.restart_server,
                confirmed=confirmed
            )
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path == '/api/server/shutdown':
            confirmed = bool(body.get('confirmed', False))
            res = ActionEngine.execute(
                'SYSTEM_SHUTDOWN', username, user_role, 'srv-local',
                {'reason': body.get('reason', 'ZIMAM UI Shutdown'), 'timeout_sec': int(body.get('timeout', 30))},
                SystemProvider.shutdown_server,
                confirmed=confirmed
            )
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path == '/api/roles/install':
            f_name = body.get('name', '')
            res = ActionEngine.execute(
                'ROLE_INSTALL', username, user_role, 'srv-local',
                {'feature_name': f_name},
                RoleProvider.install_feature,
                confirmed=True
            )
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path == '/api/roles/uninstall':
            f_name = body.get('name', '')
            confirmed = bool(body.get('confirmed', False))
            res = ActionEngine.execute(
                'ROLE_UNINSTALL', username, user_role, 'srv-local',
                {'feature_name': f_name},
                RoleProvider.uninstall_feature,
                confirmed=confirmed
            )
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path in ('/api/processes/terminate', '/api/processes/kill'):
            target_pid = int(body.get('pid', 0))
            force = bool(body.get('force', False))
            res = ActionEngine.execute(
                'PROCESS_TERMINATE', username, user_role, 'srv-local',
                {'pid': target_pid, 'force': force},
                ProcessProvider.terminate_process,
                confirmed=True
            )
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path == '/api/storage/shares/create':
            s_name = body.get('name', '')
            s_path = body.get('path', '')
            s_desc = body.get('description', '')
            res = ActionEngine.execute(
                'SMB_SHARE_CREATE', username, user_role, 'srv-local',
                {'name': s_name, 'path': s_path, 'description': s_desc},
                StorageProvider.create_smb_share,
                confirmed=True
            )
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path == '/api/storage/shares/delete':
            s_name = body.get('name', '')
            res = ActionEngine.execute(
                'SMB_SHARE_DELETE', username, user_role, 'srv-local',
                {'name': s_name},
                StorageProvider.delete_smb_share,
                confirmed=True
            )
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path == '/api/network/ping':
            host = body.get('host', '127.0.0.1')
            count = int(body.get('count', 4))
            return self.respond_json(200, NetworkProvider.ping_test(host, count))

        if path == '/api/network/test-port':
            host = body.get('host', '127.0.0.1')
            port = int(body.get('port', 80))
            return self.respond_json(200, NetworkProvider.test_tcp_port(host, port))

        if path == '/api/firewall/rules/toggle':
            r_name = body.get('name', '')
            en = bool(body.get('enabled', True))
            res = ActionEngine.execute(
                'FIREWALL_RULE_TOGGLE', username, user_role, 'srv-local',
                {'rule_name': r_name, 'enable': en},
                FirewallProvider.toggle_rule,
                confirmed=True
            )
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path == '/api/workspaces/projects/create':
            p_name = body.get('name', '')
            p_rt = body.get('runtime', 'auto')
            p_port = body.get('port')
            res = DeveloperWorkspaceManager.create_project(p_name, username, p_rt, requested_port=p_port)
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path == '/api/workspaces/projects/start':
            p_id = body.get('project_id', '')
            res = DeveloperWorkspaceManager.start_project(p_id, username)
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path == '/api/workspaces/projects/stop':
            p_id = body.get('project_id', '')
            res = DeveloperWorkspaceManager.stop_project(p_id, username)
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path == '/api/workspaces/projects/delete':
            p_id = body.get('project_id', '')
            res = db_delete_developer_project(p_id)
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path == '/api/ports/allocate':
            p_port = body.get('port')
            p_name = body.get('project_name', 'TestProject')
            res = SmartPortOrchestrator.allocate_port(username, p_name, requested_port=p_port)
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path == '/api/quotas':
            s_type = body.get('scope_type', 'user')
            s_id = body.get('scope_id', username)
            c_lim = float(body.get('cpu_limit', body.get('max_cpu_percent', 4.0)))
            r_lim = int(body.get('ram_limit_mb', body.get('max_memory_mb', 4096)))
            d_lim = float(body.get('disk_limit_gb', body.get('max_disk_gb', 50.0)))
            m_cont = int(body.get('max_containers', 5))
            m_proj = int(body.get('max_projects', 5))
            res = db_save_resource_quota(s_type, s_id, c_lim, r_lim, d_lim, m_cont, m_proj)
            return self.respond_json(200, res)

        # --- Sovereign Database Studio & Engine Governance (Story 10) ---
        if path == '/api/database/query':
            sql = body.get('query', '')
            res = DatabaseService.execute_custom_query(sql, actor=username)
            if res.get('ok') and not res.get('is_select'):
                db_add_security_event('DATABASE_QUERY_EXECUTE', client_ip, f'تنفيذ استعلام SQL من {username}: {sql[:100]}', 'WARNING')
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path == '/api/database/backup':
            desc = body.get('description', 'نسخة يدوية من واجهة التحكم')
            res = DatabaseService.create_backup(desc)
            if res.get('ok'):
                db_add_security_event('DATABASE_BACKUP_CREATED', client_ip, f'تم أخذ نسخة احتياطية: {res.get("filename")}', 'INFO')
            return self.respond_json(200 if res.get('ok') else 400, res)

        if path == '/api/database/optimize':
            res = DatabaseService.optimize_database()
            if res.get('ok'):
                db_add_security_event('DATABASE_OPTIMIZED', client_ip, f'تحسين وفهرسة قاعدة البيانات بواسطة {username}', 'INFO')
            return self.respond_json(200 if res.get('ok') else 400, res)

        # --- Fallback for unmatched API routes ---
        if path.startswith('/api/'):
            return self.respond_json(404, {
                'ok': False,
                'error': f'المسار {path} قيد التطوير أو غير موجود على سيرفر ZIMAM.'
            })

        self.send_error(405, "Method Not Allowed")

    def serve_static(self, path: str) -> None:
        """Serves frontend static build assets with SPA client-side fallback."""
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
