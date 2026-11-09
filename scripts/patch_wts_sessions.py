import re
from pathlib import Path

p = Path('backend/app/infrastructure/win32_wts.py')
content = p.read_text(encoding='utf-8')

old_pattern = re.compile(
    r'    @classmethod\s+def disconnect_session\(.*?'
    r'    def logoff_session\(.*?'
    r'        except Exception as exc:\s+return \{\'ok\': False, \'session_id\': session_id, \'error\': str\(exc\)\}',
    re.DOTALL
)

replacement = '''    @classmethod
    def disconnect_session(cls, session_id: int) -> Dict[str, Any]:
        """Disconnects an active RDP session via WTSDisconnectSession or tsdiscon.exe fallback."""
        if not IS_WINDOWS or not cls._wts:
            return {'ok': False, 'error': 'Not supported on this platform.'}
        try:
            ok = cls._wts.WTSDisconnectSession(WTS_CURRENT_SERVER_HANDLE, wintypes.DWORD(session_id), wintypes.BOOL(False))
            if ok:
                return {'ok': True, 'session_id': session_id, 'method': 'WTSDisconnectSession'}
            err = ctypes.get_last_error()
            # Fallback to tsdiscon.exe
            import subprocess
            r = subprocess.run(['tsdiscon.exe', str(session_id)], capture_output=True, text=True, timeout=5, creationflags=0x08000000)
            if r.returncode == 0:
                return {'ok': True, 'session_id': session_id, 'method': 'tsdiscon'}
            err_text = r.stderr.strip() or r.stdout.strip()
            if err == 5 or 'Access is denied' in err_text:
                return {'ok': False, 'session_id': session_id, 'error': 'تم رفض الوصول (Access Denied Error 5). يتطلب فصل الجلسة صلاحيات مسؤول (Run as Administrator).'}
            return {'ok': False, 'session_id': session_id, 'error': f'فشل فصل الجلسة: {err_text or err}'}
        except Exception as exc:
            return {'ok': False, 'session_id': session_id, 'error': str(exc)}

    @classmethod
    def logoff_session(cls, session_id: int) -> Dict[str, Any]:
        """Logs off an active session via WTSLogoffSession or logoff.exe fallback."""
        if not IS_WINDOWS or not cls._wts:
            return {'ok': False, 'error': 'Not supported on this platform.'}
        try:
            ok = cls._wts.WTSLogoffSession(WTS_CURRENT_SERVER_HANDLE, wintypes.DWORD(session_id), wintypes.BOOL(False))
            if ok:
                return {'ok': True, 'session_id': session_id, 'method': 'WTSLogoffSession'}
            err = ctypes.get_last_error()
            # Fallback to logoff.exe
            import subprocess
            r = subprocess.run(['logoff.exe', str(session_id)], capture_output=True, text=True, timeout=5, creationflags=0x08000000)
            if r.returncode == 0:
                return {'ok': True, 'session_id': session_id, 'method': 'logoff.exe'}
            err_text = r.stderr.strip() or r.stdout.strip()
            if err == 5 or 'Access is denied' in err_text:
                return {'ok': False, 'session_id': session_id, 'error': 'تم رفض الوصول (Access Denied Error 5). يتطلب تسجيل الخروج صلاحيات مسؤول (Run as Administrator).'}
            return {'ok': False, 'session_id': session_id, 'error': f'فشل إنهاء الجلسة: {err_text or err}'}
        except Exception as exc:
            return {'ok': False, 'session_id': session_id, 'error': str(exc)}'''

new_content, count = old_pattern.subn(replacement, content)
if count > 0:
    p.write_text(new_content, encoding='utf-8')
    print('Successfully patched win32_wts.py')
else:
    print('Regex failed to match')
