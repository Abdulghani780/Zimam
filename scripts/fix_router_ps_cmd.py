from pathlib import Path

p = Path('backend/app/api/router.py')
text = p.read_text(encoding='utf-8')

old_str = """                    # Fallback via PowerShell Start-Process -Verb RunAs
                    try:
                        ps_cmd = f"Start-Process '{py_exe}' -ArgumentList '\"{main_py}\" --replace-pid {my_pid}' -Verb RunAs"
                        subprocess.run(['powershell', '-NoProfile', '-Command', ps_cmd], creationflags=0x08000000)
                    except Exception:
                        pass"""

new_str = """                    # Fallback via PowerShell Start-Process -Verb RunAs
                    try:
                        arg_str = f'\\\"{main_py}\\\" --replace-pid {my_pid}'
                        ps_cmd = f"Start-Process '{py_exe}' -ArgumentList '{arg_str}' -Verb RunAs"
                        subprocess.run(['powershell', '-NoProfile', '-Command', ps_cmd], creationflags=0x08000000)
                    except Exception:
                        pass"""

if old_str in text:
    text = text.replace(old_str, new_str, 1)
    p.write_text(text, encoding='utf-8')
    print("Fixed syntax in router.py!")
else:
    print("old_str not found in router.py")
