import os
import shutil
import ctypes
import win32com.client

desktop = os.path.expanduser('~/Desktop')
shortcut_path = os.path.join(desktop, 'ZIMAM v2.lnk')

project_dir = r"Z:\My projects\ASAAS-Server-Control-v2"
exe_path = os.path.join(project_dir, "launcher", "ZimamLauncher.exe")
ico_path = os.path.join(project_dir, "launcher", "zimam.ico")

# Also copy icon to LocalAppData for ultra-reliable explorer caching
local_app_data = os.environ.get('LOCALAPPDATA', os.path.expanduser('~'))
zimam_cache_dir = os.path.join(local_app_data, 'ZIMAM')
os.makedirs(zimam_cache_dir, exist_ok=True)
cached_ico = os.path.join(zimam_cache_dir, 'zimam.ico')
shutil.copy2(ico_path, cached_ico)

shell = win32com.client.Dispatch('WScript.Shell')
shortcut = shell.CreateShortcut(shortcut_path)
shortcut.TargetPath = exe_path
shortcut.WorkingDirectory = project_dir
shortcut.Description = "زِمام · مركز إدارة ومراقبة السيرفر وحاكم الموارد الذكي v2.5"
shortcut.IconLocation = f"{cached_ico},0"
shortcut.WindowStyle = 1
shortcut.Save()

print(f"[+] Desktop shortcut updated: {shortcut_path}")
print(f"    TargetPath: {shortcut.TargetPath}")
print(f"    IconLocation: {shortcut.IconLocation}")

# Notify Windows Explorer that associations/icons have changed
try:
    SHCNE_ASSOCCHANGED = 0x08000000
    SHCNF_IDLIST = 0x0000
    ctypes.windll.shell32.SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, None, None)
    print("[+] Windows Shell notified of icon change (SHChangeNotify)")
except Exception as e:
    print(f"[-] SHChangeNotify error: {e}")
