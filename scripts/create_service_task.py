import subprocess
import sys

# Create a batch file launcher to avoid any command line quote issues
bat_path = r"Z:\My projects\ASAAS-Server-Control-v2\launcher\run_service.bat"
with open(bat_path, "w", encoding="utf-8") as f:
    f.write('@echo off\n')
    f.write('cd /d "Z:\\My projects\\ASAAS-Server-Control-v2"\n')
    f.write('"C:\\Python315\\pythonw.exe" "Z:\\My projects\\ASAAS-Server-Control-v2\\backend\\main.py"\n')

print(f"[+] Created {bat_path}")

cmd = [
    'schtasks', '/create',
    '/tn', 'ASAAS_Backend_Service',
    '/tr', f'"{bat_path}"',
    '/sc', 'onstart',
    '/rl', 'highest',
    '/f'
]

r = subprocess.run(cmd, capture_output=True, text=True)
print("Return code:", r.returncode)
print("stdout:", r.stdout.strip())
print("stderr:", r.stderr.strip())
