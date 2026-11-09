with open('frontend/src/pages/UsersPage.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# Replace Table style and TableHead widths
c = c.replace(
    '<Table style={{ minWidth: 980 }}>',
    '<Table style={{ width: "100%", minWidth: 920 }}>'
)

old_heads = """                <TableHead style={{ width: 180, textAlign: 'start' }}>اسم الحساب (Username)</TableHead>
                <TableHead style={{ minWidth: 220, textAlign: 'start' }}>الاسم الكامل والوصف</TableHead>
                <TableHead style={{ width: 140, textAlign: 'start' }}>حالة الحساب</TableHead>
                <TableHead style={{ width: 170, textAlign: 'start' }}>صلاحية RDP</TableHead>
                <TableHead style={{ width: 150, textAlign: 'start' }}>دور الحساب</TableHead>
                <TableHead style={{ width: 160, textAlign: 'end' }}>إجراءات الحوكمة</TableHead>"""

new_heads = """                <TableHead style={{ width: '18%', textAlign: 'start' }}>اسم الحساب (Username)</TableHead>
                <TableHead style={{ width: '22%', textAlign: 'start' }}>الاسم الكامل والوصف</TableHead>
                <TableHead style={{ width: '14%', textAlign: 'start' }}>حالة الحساب</TableHead>
                <TableHead style={{ width: '15%', textAlign: 'start' }}>صلاحية RDP</TableHead>
                <TableHead style={{ width: '14%', textAlign: 'start' }}>دور الحساب</TableHead>
                <TableHead style={{ width: '17%', minWidth: 200, textAlign: 'end' }}>إجراءات الحوكمة</TableHead>"""

c = c.replace(old_heads, new_heads)

old_cells = """                  <TableRow key={u.username}>
                    <TableCell className="font-bold text-title">
                      <div className="flex items-center gap-2">
                        <Users size={15} className="text-primary" />
                        <span>{u.username}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted">
                      {u.full_name || u.description || 'حساب مستخدم محلي'}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold ${
                          u.enabled
                            ? 'bg-status-safe-surface text-status-safe'
                            : 'bg-status-danger-surface text-status-danger'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${u.enabled ? 'bg-status-safe' : 'bg-status-danger'}`} />
                        {u.enabled ? 'نشط Active' : 'معطّل Disabled'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-xs font-bold ${
                          u.is_rdp ? 'text-primary' : 'text-muted'
                        }`}
                      >
                        {u.is_rdp ? 'مفعّل (Remote Desktop)' : 'معطّل'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-bold ${
                          u.is_admin
                            ? 'bg-primary/20 text-primary border border-border-gold-rim'
                            : 'bg-surface-glass-tint text-muted'
                        }`}
                      >
                        {u.is_admin ? 'مدير نظام (Admin)' : 'مستخدم قياسي (User)'}
                      </span>
                    </TableCell>
                    <TableCell style={{ textAlign: 'end' }}>
                      <div className="flex justify-end gap-1.5">"""

new_cells = """                  <TableRow key={u.username}>
                    <TableCell style={{ width: '18%' }} className="font-bold text-title">
                      <div className="flex items-center gap-2">
                        <Users size={15} className="text-primary" />
                        <span>{u.username}</span>
                      </div>
                    </TableCell>
                    <TableCell style={{ width: '22%' }} className="text-xs text-muted">
                      {u.full_name || u.description || 'حساب مستخدم محلي'}
                    </TableCell>
                    <TableCell style={{ width: '14%' }}>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold ${
                          u.enabled
                            ? 'bg-status-safe-surface text-status-safe'
                            : 'bg-status-danger-surface text-status-danger'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${u.enabled ? 'bg-status-safe' : 'bg-status-danger'}`} />
                        {u.enabled ? 'نشط Active' : 'معطّل Disabled'}
                      </span>
                    </TableCell>
                    <TableCell style={{ width: '15%' }}>
                      <span
                        className={`text-xs font-bold ${
                          u.is_rdp ? 'text-primary' : 'text-muted'
                        }`}
                      >
                        {u.is_rdp ? 'مفعّل (Remote Desktop)' : 'معطّل'}
                      </span>
                    </TableCell>
                    <TableCell style={{ width: '14%' }}>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-bold ${
                          u.is_admin
                            ? 'bg-primary/20 text-primary border border-border-gold-rim'
                            : 'bg-surface-glass-tint text-muted'
                        }`}
                      >
                        {u.is_admin ? 'مدير نظام (Admin)' : 'مستخدم قياسي (User)'}
                      </span>
                    </TableCell>
                    <TableCell style={{ width: '17%', minWidth: 200, textAlign: 'end' }}>
                      <div className="flex justify-end gap-1.5" style={{ flexWrap: 'nowrap' }}>"""

if old_cells in c:
    c = c.replace(old_cells, new_cells)
    print('[+] Replaced old_cells in UsersPage.tsx')
else:
    print('[-] old_cells not found in UsersPage.tsx')

with open('frontend/src/pages/UsersPage.tsx', 'w', encoding='utf-8') as f:
    f.write(c)

print('[+] Patched UsersPage.tsx')
