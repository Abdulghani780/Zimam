from pathlib import Path

p = Path('backend/app/api/router.py')
content = p.read_text(encoding='utf-8')

# 1. Update imports
import_old = "    db_get_historical_metrics,\n)"
import_new = """    db_get_historical_metrics,
    db_list_jit_grants,
    db_create_jit_grant,
    db_revoke_jit_grant,
    db_verify_audit_chain,
)"""
if import_old in content and "db_list_jit_grants" not in content:
    content = content.replace(import_old, import_new)

# 2. Add GET endpoints: /api/bastion/connect, /api/audit/verify-chain, /api/jit/grants
get_anchor = "        if path == '/api/vault/accounts':"
get_additions = """        if path == '/api/bastion/connect':
            from urllib.parse import parse_qs, urlparse
            qs = parse_qs(urlparse(self.path).query)
            host = qs.get('host', ['127.0.0.1'])[0]
            port = qs.get('port', ['3389'])[0]
            name = qs.get('name', [host])[0]

            rdp_content = f\"\"\"screen mode id:i:2
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
\"\"\"
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

"""

if get_anchor in content and "/api/bastion/connect" not in content:
    content = content.replace(get_anchor, get_additions + get_anchor)

# 3. Update Governor Trim
gov_old = """        # --- Governor Memory Trim & Toggle ---
        if path == '/api/governor/trim':
            res = governor_service.quick_trim_all()
            db_add_security_event('RAM_TRIMMED', client_ip, f'تفريغ الذاكرة: {res.get("reclaimed_mb", 0)} MB', 'INFO')
            return self.respond_json(200, res)"""

gov_new = """        # --- Governor Memory Trim & Toggle ---
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
            return self.respond_json(200, res)"""

if gov_old in content:
    content = content.replace(gov_old, gov_new)

# 4. Update Storage clean
storage_old = """        # --- Storage Cleanup & Lock Check (Story 9) ---
        if path in ('/api/storage/clean', '/api/storage/clean-junk', '/api/storage/clean-user-temp'):
            res = StorageService.clean_temp_directories()
            db_add_security_event('STORAGE_CLEANED', client_ip, f'تنظيف الملفات المؤقتة: {res}', 'INFO')
            return self.respond_json(200, res)"""

storage_new = """        # --- Storage Cleanup & Lock Check (Story 9) ---
        if path in ('/api/storage/clean', '/api/storage/clean-junk', '/api/storage/clean-user-temp'):
            target_user = body.get('username') if path == '/api/storage/clean-user-temp' else None
            res = StorageService.clean_temp_directories(target_user=target_user)
            db_add_security_event('STORAGE_CLEANED', client_ip, f'تنظيف الملفات المؤقتة: {res.get("reclaimed_mb", 0)} MB', 'INFO')
            return self.respond_json(200, res)"""

if storage_old in content:
    content = content.replace(storage_old, storage_new)

# 5. Update Service Control to check returncode
svc_old = """            try:
                if action == 'restart':
                    subprocess.run(['sc.exe', 'stop', svc_name], capture_output=True, timeout=5, creationflags=0x08000000)
                    time.sleep(1.0)
                    r = subprocess.run(['sc.exe', 'start', svc_name], capture_output=True, text=True, timeout=10, creationflags=0x08000000)
                elif action in cmd_map:
                    r = subprocess.run(cmd_map[action], capture_output=True, text=True, timeout=10, creationflags=0x08000000)
                else:
                    return self.respond_json(400, {'ok': False, 'error': f'الإجراء {action} غير معتمد.'})

                db_add_security_event('SERVICE_CONTROL', client_ip, f'إجراء {action} على الخدمة {svc_name} بواسطة {username}', 'INFO')
                return self.respond_json(200, {
                    'ok': True,
                    'service': svc_name,
                    'action': action,
                    'status': 'Running' if action in ('start', 'restart') else 'Stopped',
                    'message': f'تم تنفيذ أمر ({action}) على الخدمة {svc_name} بنجاح.',
                })
            except Exception as exc:
                return self.respond_json(500, {'ok': False, 'error': str(exc)})"""

svc_new = """            try:
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
                return self.respond_json(500, {'ok': False, 'error': str(exc)})"""

if svc_old in content:
    content = content.replace(svc_old, svc_new)

# 6. Add POST endpoints: JIT and Reset Password
post_anchor = "        # --- Local Windows User Management ---"
post_additions = """        # --- JIT Elevation Actions ---
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

"""

if post_anchor in content and "/api/users/reset-password" not in content:
    content = content.replace(post_anchor, post_additions + post_anchor)

p.write_text(content, encoding='utf-8')
print('Successfully patched router.py')
