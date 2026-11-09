from pathlib import Path

p = Path('backend/app/infrastructure/win32_wts.py')
text = p.read_text(encoding='utf-8')

target = """    @classmethod
    def send_message(cls, session_id: int, title: str, message: str, timeout_sec: int = 15, style: int = 0x40) -> Dict[str, Any]:
        \"\"\"Sends an interactive desktop alert to a target Windows session via WTSSendMessageW.\"\"\"
        if not IS_WINDOWS or not cls._wts:
            return {'ok': False, 'error': 'Windows Terminal Services is only supported on Windows.'}
        try:
            response = wintypes.DWORD(0)
            title_bytes = len(title.encode('utf-16le'))
            msg_bytes = len(message.encode('utf-16le'))
            ok = cls._wts.WTSSendMessageW(
                WTS_CURRENT_SERVER_HANDLE,
                wintypes.DWORD(session_id),
                wintypes.LPWSTR(title),
                wintypes.DWORD(title_bytes),
                wintypes.LPWSTR(message),
                wintypes.DWORD(msg_bytes),
                wintypes.DWORD(style),
                wintypes.DWORD(timeout_sec),
                ctypes.byref(response),
                wintypes.BOOL(False)
            )
            if ok:
                return {'ok': True, 'session_id': session_id, 'method': 'WTSSendMessageW'}
            err = ctypes.get_last_error()
            if err == 5:
                return {'ok': False, 'session_id': session_id, 'error': 'تم رفض الوصول (Access Denied Error 5). يتطلب إرسال التنبيهات تشغيل السيرفر كمسؤول.'}
            return {'ok': False, 'session_id': session_id, 'error': f'فشل الإرسال عبر WTS (رمز الخطأ: {err}).'}
        except Exception as exc:
            return {'ok': False, 'session_id': session_id, 'error': str(exc)}"""

replacement = """    @classmethod
    def send_message(cls, session_id: int, title: str, message: str, timeout_sec: int = 15, style: int = 0x40) -> Dict[str, Any]:
        \"\"\"Sends an interactive desktop alert to a target Windows session via WTSSendMessageW or msg.exe fallback.\"\"\"
        if not IS_WINDOWS or not cls._wts:
            return {'ok': False, 'error': 'Windows Terminal Services is only supported on Windows.'}
        try:
            response = wintypes.DWORD(0)
            title_bytes = len(title.encode('utf-16le'))
            msg_bytes = len(message.encode('utf-16le'))
            ok = cls._wts.WTSSendMessageW(
                WTS_CURRENT_SERVER_HANDLE,
                wintypes.DWORD(session_id),
                wintypes.LPWSTR(title),
                wintypes.DWORD(title_bytes),
                wintypes.LPWSTR(message),
                wintypes.DWORD(msg_bytes),
                wintypes.DWORD(style),
                wintypes.DWORD(timeout_sec),
                ctypes.byref(response),
                wintypes.BOOL(False)
            )
            if ok:
                return {'ok': True, 'session_id': session_id, 'method': 'WTSSendMessageW'}
            err = ctypes.get_last_error()

            # Attempt msg.exe fallback
            import subprocess
            try:
                msg_body = f"{title}: {message}" if title else message
                r = subprocess.run(
                    ['msg.exe', str(session_id), f'/TIME:{timeout_sec}', msg_body],
                    capture_output=True, text=True, timeout=5, creationflags=0x08000000
                )
                if r.returncode == 0:
                    return {'ok': True, 'session_id': session_id, 'method': 'msg.exe'}
            except Exception:
                pass

            if err == 5:
                return {
                    'ok': False,
                    'session_id': session_id,
                    'error': 'تم رفض الوصول (Access Denied Error 5). اضغط على زر "ترقية كمسؤول" في الشريط العلوي لتفعيل صلاحية مراسلة جميع المستخدمين أو شغّل التطبيق كمسؤول.'
                }
            return {'ok': False, 'session_id': session_id, 'error': f'فشل الإرسال عبر WTS (رمز الخطأ: {err}).'}
        except Exception as exc:
            return {'ok': False, 'session_id': session_id, 'error': str(exc)}"""

if target in text:
    text = text.replace(target, replacement, 1)
    p.write_text(text, encoding='utf-8')
    print("[+] Updated send_message in win32_wts.py successfully!")
else:
    print("[-] Target not found!")
