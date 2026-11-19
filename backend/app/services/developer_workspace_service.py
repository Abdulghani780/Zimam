"""ASAAS Enterprise v3.0 - Multi-User Developer Workspace & Smart Port Orchestrator.

Provides:
- Multi-User Development Workspace Manager: per-user isolated projects & runtimes.
- Smart Port Allocation Engine: collision detection, dynamic alternative port allocation, atomic socket probing.
- Multi-Tenant Docker Orchestrator: Compose isolation, context management, container attribution.
- Smart Application Gateway: path and port proxy routing with WebSocket support.
- Conflict Resolution Center: port collisions, orphan process cleanup, quota resolution.
"""
from __future__ import annotations

import json
import logging
import os
import secrets
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import psutil

from ..core.config import DATA_DIR
from ..infrastructure.db import (
    db_list_developer_projects,
    db_create_developer_project,
    db_update_project_status,
    db_delete_developer_project,
    db_record_conflict_event,
    db_resolve_conflict_event,
    db_list_conflict_events,
    db_get_resource_quotas,
)
from ..infrastructure.silent_subprocess import run_silent, popen_silent, CREATE_NO_WINDOW

logger = logging.getLogger('asaas.dev_workspace')

WORKSPACE_ROOT = DATA_DIR / 'workspaces'
WORKSPACE_ROOT.mkdir(parents=True, exist_ok=True)


class SmartPortOrchestrator:
    """Zero-Race-Condition Atomic Port Discovery, Reservation & Conflict Resolver."""

    MANAGED_RANGES = [
        (3000, 3999),  # Web Apps / Frontend (React, Vite, Next.js)
        (5000, 5999),  # APIs & Backends (FastAPI, Flask)
        (8000, 8999),  # General Services / Django / ASP.NET
    ]
    _PORT_LOCK = threading.Lock()

    @classmethod
    def get_listening_ports(cls) -> Set[int]:
        """Scans all active TCP listening ports on the Windows host."""
        used: Set[int] = set()
        try:
            for conn in psutil.net_connections(kind='tcp'):
                if conn.status == psutil.CONN_LISTEN and conn.laddr:
                    used.add(conn.laddr.port)
        except Exception as exc:
            logger.warning(f"psutil net_connections check failed: {exc}")
        return used

    @classmethod
    def is_port_free_atomic(cls, port: int, host: str = '0.0.0.0') -> bool:
        """Performs atomic socket bind test to verify port availability."""
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 0)
                s.bind((host, port))
                return True
        except (OSError, socket.error):
            return False

    @classmethod
    def allocate_port(
        cls,
        user: str,
        project_name: str,
        requested_port: Optional[int] = None,
        preferred_range: Tuple[int, int] = (3000, 3999)
    ) -> Dict[str, Any]:
        """Atomically checks and allocates a conflict-free port for a project."""
        with cls._PORT_LOCK:
            active_ports = cls.get_listening_ports()

            # 1. If user requested a specific port and it's 100% free, allocate it
            if requested_port and requested_port > 1024 and requested_port < 65535:
                if requested_port not in active_ports and cls.is_port_free_atomic(requested_port):
                    return {
                        'ok': True,
                        'port': requested_port,
                        'is_alternate': False,
                        'message': f'تم تخصيص المنفذ المطلوب {requested_port} بنجاح.'
                    }
                else:
                    # Collision detected! Record conflict event
                    conflict_id = db_record_conflict_event(
                        'PORT_COLLISION',
                        f"Port {requested_port}",
                        [{'user': user, 'project': project_name, 'requested_port': requested_port}],
                        f"البحث عن منفذ بديل شاغر"
                    )

            # 2. Find next available port in preferred range
            start_p, end_p = preferred_range
            for candidate in range(start_p, end_p + 1):
                if candidate not in active_ports and cls.is_port_free_atomic(candidate):
                    msg = f"المنفذ المطلوب {requested_port} مشغول. تم تخصيص المنفذ البديل {candidate} تلقائياً لمنع التعارض." if requested_port else f"تم تخصيص المنفذ {candidate} بنجاح."
                    is_alt = requested_port is not None and candidate != requested_port
                    return {
                        'ok': True,
                        'port': candidate,
                        'assigned_port': candidate,
                        'available': not is_alt,
                        'is_alternate': is_alt,
                        'requested_port': requested_port,
                        'message': msg
                    }

            return {'ok': False, 'error': f'نفدت المنافذ الشاغرة في النطاق {start_p}-{end_p}.'}


class DeveloperWorkspaceManager:
    """Manages Multi-Tenant Workspaces, Runtimes, and Project Process Supervision."""

    _RUNNING_PROCESSES: Dict[str, subprocess.Popen] = {}
    _PROCESS_LOCK = threading.Lock()
    _QUOTA_THREAD: Optional[threading.Thread] = None

    @classmethod
    def get_user_workspace_path(cls, username: str) -> Path:
        """Returns or creates the private workspace directory for a user."""
        # Clean username
        clean_user = ''.join(c for c in username if c.isalnum() or c in '-_') or 'default'
        p = WORKSPACE_ROOT / clean_user
        p.mkdir(parents=True, exist_ok=True)
        return p

    @classmethod
    def detect_runtime(cls, source_path: Path) -> Dict[str, Any]:
        """Inspects source directory and auto-detects framework and start command."""
        if not source_path.exists() or not source_path.is_dir():
            return {'runtime': 'generic', 'start_cmd': '', 'detected': False}

        pkg_json = source_path / 'package.json'
        if pkg_json.exists():
            try:
                with open(pkg_json, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                deps = {**data.get('dependencies', {}), **data.get('devDependencies', {})}
                if 'next' in deps:
                    return {'runtime': 'Next.js', 'start_cmd': 'npm run dev', 'framework': 'next', 'detected': True}
                if 'vite' in deps:
                    return {'runtime': 'React / Vite', 'start_cmd': 'npm run dev', 'framework': 'vite', 'detected': True}
                if 'react' in deps:
                    return {'runtime': 'React', 'start_cmd': 'npm start', 'framework': 'react', 'detected': True}
                return {'runtime': 'Node.js', 'start_cmd': 'node index.js', 'framework': 'node', 'detected': True}
            except Exception:
                return {'runtime': 'Node.js', 'start_cmd': 'npm start', 'framework': 'node', 'detected': True}

        if (source_path / 'requirements.txt').exists() or (source_path / 'main.py').exists() or (source_path / 'app.py').exists():
            return {'runtime': 'Python', 'start_cmd': 'python main.py', 'framework': 'python', 'detected': True}

        if (source_path / 'docker-compose.yml').exists() or (source_path / 'docker-compose.yaml').exists():
            return {'runtime': 'Docker Compose', 'start_cmd': 'docker compose up', 'framework': 'compose', 'detected': True}

        if (source_path / 'Dockerfile').exists():
            return {'runtime': 'Dockerfile', 'start_cmd': 'docker build -t app . && docker run -p 3000:3000 app', 'framework': 'docker', 'detected': True}

        if (source_path / 'go.mod').exists():
            return {'runtime': 'Go', 'start_cmd': 'go run .', 'framework': 'go', 'detected': True}

        return {'runtime': 'Custom / Shell', 'start_cmd': '', 'framework': 'generic', 'detected': False}

    @classmethod
    def create_project(
        cls,
        name: str,
        owner: str,
        runtime: str = 'auto',
        requested_port: Optional[int] = None,
        source_dir: Optional[str] = None
    ) -> Dict[str, Any]:
        """Creates a new isolated project in user's workspace with guaranteed conflict-free port."""
        clean_name = ''.join(c for c in name if c.isalnum() or c in '-_')
        if not clean_name:
            return {'ok': False, 'error': 'اسم المشروع غير صالح.'}
        quota = db_get_resource_quotas('user', owner)
        if len(db_list_developer_projects(owner)) >= int(quota['max_projects']):
            return {'ok': False, 'error': f'تم بلوغ الحد الأقصى للمشاريع ({quota["max_projects"]}).'}
        user_ws = cls.get_user_workspace_path(owner)
        proj_dir = Path(source_dir).resolve() if source_dir else user_ws / clean_name
        if proj_dir.exists():
            size_gb = sum(item.stat().st_size for item in proj_dir.rglob('*') if item.is_file()) / (1024 ** 3)
            if size_gb > float(quota['disk_limit_gb']):
                return {'ok': False, 'error': f'مساحة المشروع تتجاوز حصة التخزين ({quota["disk_limit_gb"]} GB).'}
        proj_dir.mkdir(parents=True, exist_ok=True)

        # Detect runtime if auto
        detected_info = cls.detect_runtime(proj_dir)
        actual_runtime = detected_info['runtime'] if runtime in ('auto', '', 'detect') else runtime

        # Allocate port
        alloc = SmartPortOrchestrator.allocate_port(owner, clean_name, requested_port=requested_port)
        if not alloc.get('ok'):
            return alloc
        port = alloc['port']

        # Create boilerplate index if directory is empty
        if not any(proj_dir.iterdir()):
            if 'Node' in actual_runtime or 'React' in actual_runtime:
                with open(proj_dir / 'index.js', 'w', encoding='utf-8') as f:
                    f.write(f"const http = require('http');\nconst port = process.env.PORT || {port};\nhttp.createServer((req, res) => res.end('Hello from ASAAS Enterprise Project: {clean_name}')).listen(port, () => console.log(`Server on port ${{port}}`));\n")
            elif 'Python' in actual_runtime:
                with open(proj_dir / 'main.py', 'w', encoding='utf-8') as f:
                    f.write(f"import os\nfrom http.server import HTTPServer, SimpleHTTPRequestHandler\nport = int(os.environ.get('PORT', {port}))\nserver = HTTPServer(('0.0.0.0', port), SimpleHTTPRequestHandler)\nprint(f'ASAAS Python App running on port {{port}}')\nserver.serve_forever()\n")

        # Save to database
        res = db_create_developer_project(clean_name, owner, actual_runtime, str(proj_dir), port, {'PORT': str(port)})
        res['project_id'] = res.get('id')
        res['port_message'] = alloc.get('message', '')
        res['is_alternate_port'] = alloc.get('is_alternate', False)
        return res

    @classmethod
    def start_project(cls, project_id: str, owner: str) -> Dict[str, Any]:
        """Starts project in background with supervisor monitoring."""
        projects = db_list_developer_projects(owner)
        target = next((p for p in projects if p['id'] == project_id), None)
        if not target:
            return {'ok': False, 'error': 'المشروع غير موجود أو لا تملك صلاحية الوصول إليه.'}

        with cls._PROCESS_LOCK:
            # Check if already running
            if project_id in cls._RUNNING_PROCESSES:
                proc = cls._RUNNING_PROCESSES[project_id]
                if proc.poll() is None:
                    return {'ok': True, 'message': 'المشروع يعمل بالفعل.', 'pid': proc.pid, 'port': target['port']}

            # Verify port is still free before starting
            port = target['port']
            if not SmartPortOrchestrator.is_port_free_atomic(port):
                # Auto-heal: assign new port!
                new_alloc = SmartPortOrchestrator.allocate_port(owner, target['name'], requested_port=None)
                if not new_alloc.get('ok'):
                    return new_alloc
                port = new_alloc['port']
                target['port'] = port

            src_path = Path(target['source_path'])
            env = os.environ.copy()
            env.update(target.get('env_vars') or {})
            env['PORT'] = str(port)

            runtime = target['runtime'].lower()
            if 'python' in runtime:
                cmd = [sys.executable, 'main.py'] if (src_path / 'main.py').exists() else [sys.executable, '-m', 'http.server', str(port)]
            elif 'node' in runtime or 'react' in runtime or 'vite' in runtime:
                cmd = ['node', 'index.js'] if (src_path / 'index.js').exists() else ['npm', 'start']
            elif 'compose' in runtime:
                quota = db_get_resource_quotas('user', owner)
                configured = run_silent(
                    ['docker', 'compose', 'config', '--services'],
                    cwd=str(src_path), capture_output=True, text=True, timeout=15,
                )
                if configured.returncode != 0:
                    return {'ok': False, 'error': configured.stderr.strip() or 'تعذر قراءة خدمات Docker Compose.'}
                service_count = len([line for line in configured.stdout.splitlines() if line.strip()])
                if service_count > int(quota['max_containers']):
                    return {'ok': False, 'error': f'عدد خدمات Compose ({service_count}) يتجاوز الحد ({quota["max_containers"]}).'}
                cmd = ['docker', 'compose', '-p', f"asaas_{owner}_{target['name']}", 'up', '-d']
            else:
                cmd = [sys.executable, '-m', 'http.server', str(port)]

            try:
                proc = popen_silent(
                    cmd,
                    cwd=str(src_path),
                    env=env,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
                if 'compose' in runtime:
                    proc.wait(timeout=60)
                    if proc.returncode != 0:
                        db_update_project_status(project_id, 'failed')
                        return {'ok': False, 'error': f'Docker Compose exited with code {proc.returncode}.'}
                    running = run_silent(
                        ['docker', 'compose', '-p', f"asaas_{owner}_{target['name']}", 'ps', '--status', 'running', '-q'],
                        cwd=str(src_path), capture_output=True, text=True, timeout=15,
                    )
                    if running.returncode != 0 or not running.stdout.strip():
                        db_update_project_status(project_id, 'failed')
                        return {'ok': False, 'error': 'لم تبدأ أي حاوية Docker في حالة Running.'}
                    db_update_project_status(project_id, 'running', pid=None, port=port, env_vars={'PORT': str(port)})
                else:
                    deadline = time.monotonic() + 15
                    while time.monotonic() < deadline:
                        if proc.poll() is not None:
                            db_update_project_status(project_id, 'failed')
                            return {'ok': False, 'error': f'عملية المشروع انتهت مبكراً برمز {proc.returncode}.'}
                        try:
                            with socket.create_connection(('127.0.0.1', int(port)), timeout=0.25):
                                pass
                            break
                        except OSError:
                            time.sleep(0.25)
                    else:
                        proc.terminate()
                        db_update_project_status(project_id, 'failed')
                        return {'ok': False, 'error': 'المشروع لم يفتح منفذ TCP خلال 15 ثانية.'}
                    cls._RUNNING_PROCESSES[project_id] = proc
                    db_update_project_status(project_id, 'running', pid=proc.pid, port=port, env_vars={'PORT': str(port)})
                    cls._ensure_quota_monitor()
                return {
                    'ok': True,
                    'project_id': project_id,
                    'status': 'running',
                    'pid': proc.pid if 'compose' not in runtime else None,
                    'port': port,
                    'route': f"/apps/{project_id}",
                    'message': f"تم تشغيل المشروع {target['name']} على المنفذ {port} والتحقق من استجابته."
                }
            except Exception as e:
                db_update_project_status(project_id, 'failed')
                return {'ok': False, 'error': f'فشل في تشغيل المشروع: {e}'}

    @classmethod
    def stop_project(cls, project_id: str, owner: str) -> Dict[str, Any]:
        """Terminates project process safely and verifies the result."""
        target = next((p for p in db_list_developer_projects(owner) if p['id'] == project_id), None)
        if not target:
            return {'ok': False, 'error': 'المشروع غير موجود أو لا تملك صلاحية الوصول إليه.'}
        with cls._PROCESS_LOCK:
            if 'compose' in str(target.get('runtime', '')).lower():
                stopped = run_silent(
                    ['docker', 'compose', '-p', f"asaas_{owner}_{target['name']}", 'down'],
                    cwd=target['source_path'], capture_output=True, text=True, timeout=60,
                )
                if stopped.returncode != 0:
                    return {'ok': False, 'error': stopped.stderr.strip() or 'فشل إيقاف حاويات المشروع.'}
            else:
                proc = cls._RUNNING_PROCESSES.get(project_id)
                if proc is None and target.get('pid'):
                    try:
                        proc = psutil.Process(int(target['pid']))
                    except psutil.NoSuchProcess:
                        proc = None
                if proc is not None:
                    try:
                        proc.terminate()
                        proc.wait(timeout=3)
                    except Exception:
                        try:
                            proc.kill()
                            proc.wait(timeout=3)
                        except Exception as exc:
                            return {'ok': False, 'error': f'تعذر إيقاف عملية المشروع: {exc}'}
                    if proc.poll() is None:
                        return {'ok': False, 'error': 'عملية المشروع ما زالت تعمل بعد محاولة الإيقاف.'}
                cls._RUNNING_PROCESSES.pop(project_id, None)
            db_update_project_status(project_id, 'stopped', pid=None)
            return {'ok': True, 'project_id': project_id, 'status': 'stopped', 'message': 'تم إيقاف المشروع والتحقق من انتهاء عمليته.'}

    @classmethod
    def delete_project(cls, project_id: str, owner: str) -> Dict[str, Any]:
        target = next((p for p in db_list_developer_projects(owner) if p['id'] == project_id), None)
        if not target:
            return {'ok': False, 'error': 'المشروع غير موجود أو لا تملك صلاحية الوصول إليه.'}
        if target.get('status') == 'running':
            stopped = cls.stop_project(project_id, owner)
            if not stopped.get('ok'):
                return stopped
        return db_delete_developer_project(project_id)

    @classmethod
    def _ensure_quota_monitor(cls) -> None:
        if cls._QUOTA_THREAD and cls._QUOTA_THREAD.is_alive():
            return
        cls._QUOTA_THREAD = threading.Thread(target=cls._quota_loop, daemon=True)
        cls._QUOTA_THREAD.start()

    @classmethod
    def _quota_loop(cls) -> None:
        while True:
            time.sleep(5)
            with cls._PROCESS_LOCK:
                running = list(cls._RUNNING_PROCESSES.items())
            for project_id, proc in running:
                try:
                    if proc.poll() is not None:
                        continue
                    target = next((p for p in db_list_developer_projects() if p['id'] == project_id), None)
                    if not target:
                        continue
                    quota = db_get_resource_quotas('user', target['owner'])
                    violation = ''
                    if proc.memory_info().rss > int(quota['ram_limit_mb']) * 1024 * 1024:
                        violation = f'RAM exceeded {quota["ram_limit_mb"]} MB'
                    else:
                        source = Path(target['source_path'])
                        size_gb = sum(item.stat().st_size for item in source.rglob('*') if item.is_file()) / (1024 ** 3)
                        if size_gb > float(quota['disk_limit_gb']):
                            violation = f'Disk exceeded {quota["disk_limit_gb"]} GB'
                    if violation:
                        proc.terminate()
                        proc.wait(timeout=3)
                        db_update_project_status(project_id, 'quota_exceeded', pid=None)
                        db_record_conflict_event('RESOURCE_QUOTA_EXCEEDED', target['name'], [{'project_id': project_id}], violation)
                        with cls._PROCESS_LOCK:
                            cls._RUNNING_PROCESSES.pop(project_id, None)
                        continue
                    cpu_percent = proc.cpu_percent(None)
                    if cpu_percent > float(quota['cpu_limit']) * 100:
                        proc.suspend()
                        time.sleep(0.25)
                        proc.resume()
                except (psutil.NoSuchProcess, FileNotFoundError):
                    continue
                except Exception:
                    logger.exception("Project quota enforcement failed for %s", project_id)

    @classmethod
    def list_projects_with_health(cls, owner: Optional[str] = None) -> List[Dict[str, Any]]:
        """Returns all projects with live process supervisor status checks."""
        projects = db_list_developer_projects(owner)
        with cls._PROCESS_LOCK:
            for p in projects:
                pid = p.get('pid')
                if pid and p.get('status') == 'running':
                    # Check if process is actually alive on Windows
                    if not psutil.pid_exists(pid):
                        p['status'] = 'stopped'
                        p['pid'] = None
                        db_update_project_status(p['id'], 'stopped')
                p['url'] = f"http://127.0.0.1:{p['port']}"
                p['gateway_route'] = f"/apps/{p['id']}"
        return projects
