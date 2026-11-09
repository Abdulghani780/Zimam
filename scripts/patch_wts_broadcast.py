from pathlib import Path

p = Path('backend/app/infrastructure/win32_wts.py')
content = p.read_text(encoding='utf-8')

target = """    @classmethod
    def broadcast_message(cls, title: str, message: str, timeout_sec: int = 15) -> Dict[str, Any]:
        \"\"\"Broadcasts a desktop alert to all active user sessions.\"\"\"
        sessions = cls.list_active_sessions()
        results = []
        for s in sessions:
            res = cls.send_message(s.session_id, title, message, timeout_sec)
            results.append(res)
        return {'ok': True, 'broadcast_count': len(results), 'details': results}"""

replacement = """    @classmethod
    def broadcast_message(cls, title: str, message: str, timeout_sec: int = 15) -> Dict[str, Any]:
        \"\"\"Broadcasts a desktop alert to all active user sessions with native msg.exe * broadcast.\"\"\"
        # 1. Native Windows terminal broadcast across all sessions simultaneously
        import subprocess
        msg_body = f"{title}: {message}" if title else message
        try:
            subprocess.run(
                ['msg.exe', '*', f'/TIME:{timeout_sec}', msg_body],
                capture_output=True, text=True, timeout=5, creationflags=0x08000000
            )
        except Exception:
            pass

        # 2. Targeted per-session delivery
        sessions = cls.list_active_sessions()
        results = []
        for s in sessions:
            res = cls.send_message(s.session_id, title, message, timeout_sec)
            results.append(res)
        return {'ok': True, 'broadcast_count': len(results), 'details': results}"""

content_norm = content.replace('\r\n', '\n')
target_norm = target.replace('\r\n', '\n')
replacement_norm = replacement.replace('\r\n', '\n')

if target_norm in content_norm:
    content_norm = content_norm.replace(target_norm, replacement_norm)
    p.write_text(content_norm, encoding='utf-8')
    print('Successfully patched broadcast_message in win32_wts.py')
else:
    print('Target not found')
