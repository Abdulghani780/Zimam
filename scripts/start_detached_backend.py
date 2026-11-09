import subprocess
import time
import urllib.request

cmd = [r'C:\Python315\pythonw.exe', r'Z:\My projects\ASAAS-Server-Control-v2\backend\main.py']
cwd = r'Z:\My projects\ASAAS-Server-Control-v2'

# DETACHED_PROCESS = 0x00000008, CREATE_NEW_PROCESS_GROUP = 0x00000200
p = subprocess.Popen(
    cmd,
    cwd=cwd,
    creationflags=0x00000008 | 0x00000200,
    close_fds=True
)
print(f'Started detached PID: {p.pid}')

time.sleep(1.0)
with urllib.request.urlopen('http://127.0.0.1:8765/api/health') as r:
    print('Health response:', r.read().decode())
