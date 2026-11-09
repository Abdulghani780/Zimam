from pathlib import Path

p = Path('backend/app/infrastructure/win32_wts.py')
text = p.read_text(encoding='utf-8')

priv_func = '''
def _enable_windows_privileges():
    """Enables required token privileges (SeDebugPrivilege, SeTcbPrivilege, SeShutdownPrivilege)."""
    if not IS_WINDOWS:
        return
    try:
        advapi32 = ctypes.windll.advapi32
        kernel32 = ctypes.windll.kernel32
        advapi32.OpenProcessToken.argtypes = [wintypes.HANDLE, wintypes.DWORD, ctypes.POINTER(wintypes.HANDLE)]
        advapi32.OpenProcessToken.restype = wintypes.BOOL

        class LUID(ctypes.Structure):
            _fields_ = [('LowPart', wintypes.DWORD), ('HighPart', wintypes.LONG)]

        class LUID_AND_ATTRIBUTES(ctypes.Structure):
            _fields_ = [('Luid', LUID), ('Attributes', wintypes.DWORD)]

        class TOKEN_PRIVILEGES(ctypes.Structure):
            _fields_ = [('PrivilegeCount', wintypes.DWORD), ('Privileges', LUID_AND_ATTRIBUTES * 1)]

        hToken = wintypes.HANDLE()
        if advapi32.OpenProcessToken(kernel32.GetCurrentProcess(), 0x0020 | 0x0008, ctypes.byref(hToken)):
            for priv in ['SeShutdownPrivilege', 'SeDebugPrivilege', 'SeTcbPrivilege']:
                luid = LUID()
                if advapi32.LookupPrivilegeValueW(None, priv, ctypes.byref(luid)):
                    tp = TOKEN_PRIVILEGES()
                    tp.PrivilegeCount = 1
                    tp.Privileges[0].Luid = luid
                    tp.Privileges[0].Attributes = 0x00000002
                    advapi32.AdjustTokenPrivileges(hToken, False, ctypes.byref(tp), 0, None, None)
            kernel32.CloseHandle(hToken)
    except Exception:
        pass

if IS_WINDOWS:
    _enable_windows_privileges()
'''

if '_enable_windows_privileges' not in text:
    text += '\n' + priv_func
    p.write_text(text, encoding='utf-8')
    print("[+] Added _enable_windows_privileges to win32_wts.py successfully!")
else:
    print("[*] Already present!")
