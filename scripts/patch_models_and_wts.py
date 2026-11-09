import sys

# 1. Patch backend/app/domain/models.py
with open('backend/app/domain/models.py', 'r', encoding='utf-8') as f:
    content = f.read()

target = 'ram_disp = f"{ram_gb} GB" if ram_gb >= 1.0 else f"{int(self.ram_mb)} MB" if self.ram_mb > 0 else "—"'
replacement = '''if ram_gb >= 1.0:
            ram_disp = f"{ram_gb} GB"
        elif self.ram_mb > 0:
            ram_disp = f"{int(self.ram_mb)} MB"
        else:
            ram_disp = "أقل من 50 MB"'''

if target in content:
    content = content.replace(target, replacement)
    content = content.replace("'processes_count': self.processes_count,", "'processes_count': max(1, self.processes_count),")
    content = content.replace("'procs': self.processes_count,", "'procs': max(1, self.processes_count),")
    with open('backend/app/domain/models.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print('[+] Successfully patched models.py')
else:
    print('[-] Target already modified or not found in models.py')

# 2. Patch backend/app/infrastructure/win32_wts.py
with open('backend/app/infrastructure/win32_wts.py', 'r', encoding='utf-8') as f:
    wts_content = f.read()

# Increase tasklist timeout from 3 to 8
wts_content = wts_content.replace(
    "['tasklist.exe', '/FO', 'CSV'],\n                capture_output=True, text=True, timeout=3",
    "['tasklist.exe', '/FO', 'CSV'],\n                capture_output=True, text=True, timeout=8"
)

# In get_wts_process_counts, return merged cache
old_wts_counts = """                cls._wts.WTSFreeMemory(p_info)
                if counts:
                    cls._SESSION_PROC_CACHE.update(counts)
                return counts"""

new_wts_counts = """                cls._wts.WTSFreeMemory(p_info)
                if counts:
                    cls._SESSION_PROC_CACHE.update(counts)
                return cls._SESSION_PROC_CACHE.copy()"""

if old_wts_counts in wts_content:
    wts_content = wts_content.replace(old_wts_counts, new_wts_counts)
    print('[+] Successfully patched get_wts_process_counts in win32_wts.py')

# In list_active_sessions, safeguard procs_cnt and ram_mb from ever being 0
old_proc_assign = """                    ram_mb = round(proc_ram_mb.get(sid, 0.0), 1)
                    procs_cnt = proc_counts.get(sid, 0)"""

new_proc_assign = """                    ram_mb = round(proc_ram_mb.get(sid, cls._SESSION_RAM_CACHE.get(sid, 0.0)), 1)
                    procs_cnt = proc_counts.get(sid, cls._SESSION_PROC_CACHE.get(sid, 1))
                    if procs_cnt <= 0:
                        procs_cnt = max(1, cls._SESSION_PROC_CACHE.get(sid, 1))"""

if old_proc_assign in wts_content:
    wts_content = wts_content.replace(old_proc_assign, new_proc_assign)
    print('[+] Successfully patched list_active_sessions in win32_wts.py')

with open('backend/app/infrastructure/win32_wts.py', 'w', encoding='utf-8') as f:
    wts_content = f.write(wts_content)

print('[+] Done patching models and win32_wts.')
