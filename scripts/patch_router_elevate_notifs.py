from pathlib import Path

p = Path('backend/app/api/router.py')
text = p.read_text(encoding='utf-8')

# 1. Update /api/system/elevate
old_elevate = """                def _relaunch_elevated():
                    import ctypes
                    ctypes.windll.shell32.ShellExecuteW(
                        None, 'runas', py_exe, f'"{main_py}" --replace-pid {my_pid}', None, 0
                    )"""

new_elevate = """                def _relaunch_elevated():
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
                        ps_cmd = f"Start-Process '{py_exe}' -ArgumentList '\"{main_py}\" --replace-pid {my_pid}' -Verb RunAs"
                        subprocess.run(['powershell', '-NoProfile', '-Command', ps_cmd], creationflags=0x08000000)
                    except Exception:
                        pass"""

if old_elevate in text:
    text = text.replace(old_elevate, new_elevate, 1)

# 2. Add GET /api/notifications
get_anchor = "        if path == '/api/vault/accounts':"
notif_get = """        if path == '/api/notifications':
            from ..infrastructure.db import db_list_user_notifications
            notifs = db_list_user_notifications(limit=25)
            return self.respond_json(200, {
                'ok': True,
                'notifications': notifs,
                'count': len(notifs)
            })

"""

if get_anchor in text and '/api/notifications' not in text:
    text = text.replace(get_anchor, notif_get + get_anchor, 1)

# 3. Add active alerts to SSE stream
old_sse_payload = """                    metrics = telemetry_service.get_metrics().to_dict()
                    active_sess = [s.to_dict() for s in Win32WtsService.list_active_sessions()]
                    payload = json.dumps({
                        'ok': True,
                        'host': metrics,
                        'metrics': metrics,
                        'sessions': active_sess if active_sess else metrics.get('active_sessions', []),
                        'users_count': len(active_sess),
                        'governor': {
                            'active': True,
                            'reclaimed_mb': governor_service.reclaimed_mb,
                            'auto_trim_enabled': governor_service.auto_trim,
                        },
                        'system_history': telemetry_service.get_system_history(),
                    }, ensure_ascii=False)"""

new_sse_payload = """                    metrics = telemetry_service.get_metrics().to_dict()
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
                    }, ensure_ascii=False)"""

if old_sse_payload in text:
    text = text.replace(old_sse_payload, new_sse_payload, 1)

p.write_text(text, encoding='utf-8')
print("router.py updated successfully!")
