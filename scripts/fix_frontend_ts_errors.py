from pathlib import Path

# 1. Fix cx.ts
cx_p = Path('frontend/src/asaas-ui/lib/cx.ts')
cx_p.write_text("/** Joins truthy class names. */\nexport const cx = (...names: Array<any>) => names.filter(Boolean).join(' ');\n", encoding='utf-8')
print("cx.ts fixed!")

# 2. Fix Toast.tsx
toast_p = Path('frontend/src/asaas-ui/ui/Toast.tsx')
toast_text = toast_p.read_text(encoding='utf-8')
toast_text = toast_text.replace("type Tone = 'success' | 'error';", "type Tone = 'success' | 'error' | 'info' | 'warn';")
toast_p.write_text(toast_text, encoding='utf-8')
print("Toast.tsx fixed!")

# 3. Fix UsersPage.tsx
users_p = Path('frontend/src/pages/UsersPage.tsx')
users_text = users_p.read_text(encoding='utf-8')
users_text = users_text.replace("setResetUser(u.username);", "setSelectedUser(u.username);")
users_text = users_text.replace("setResetModalOpen(true);", "setPasswordModalOpen(true);")
users_text = users_text.replace("handleToggleUser(u.username, u.enabled)", "handleToggleState(u)")
users_text = users_text.replace("handleDeleteUser(u.username)", "handleDelete(u.username)")
# Remove unused imports if present
users_text = users_text.replace("  Trash2,\n", "")
users_text = users_text.replace("  Power,\n", "")
users_p.write_text(users_text, encoding='utf-8')
print("UsersPage.tsx fixed!")

# 4. Fix PortsPage.tsx unused TableEmpty
ports_p = Path('frontend/src/pages/PortsPage.tsx')
ports_text = ports_p.read_text(encoding='utf-8')
ports_text = ports_text.replace(", TableEmpty", "")
ports_p.write_text(ports_text, encoding='utf-8')
print("PortsPage.tsx TableEmpty fixed!")

# 5. Fix SecurityPage.tsx unused TableEmpty
sec_p = Path('frontend/src/pages/SecurityPage.tsx')
sec_text = sec_p.read_text(encoding='utf-8')
sec_text = sec_text.replace(", TableEmpty", "")
sec_p.write_text(sec_text, encoding='utf-8')
print("SecurityPage.tsx TableEmpty fixed!")
