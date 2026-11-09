with open('frontend/src/pages/UsersPage.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# Replace Table style to use tableLayout fixed and 100% width
c = c.replace(
    '<Table style={{ width: "100%", minWidth: 920 }}>',
    '<Table style={{ width: "100%", tableLayout: "fixed" }}>'
)
c = c.replace(
    '<Table style={{ minWidth: 980 }}>',
    '<Table style={{ width: "100%", tableLayout: "fixed" }}>'
)

old_heads = """              <TableRow>
                <TableHead style={{ width: '18%', textAlign: 'start' }}>اسم الحساب (Username)</TableHead>
                <TableHead style={{ width: '22%', textAlign: 'start' }}>الاسم الكامل والوصف</TableHead>
                <TableHead style={{ width: '14%', textAlign: 'start' }}>حالة الحساب</TableHead>
                <TableHead style={{ width: '15%', textAlign: 'start' }}>صلاحية RDP</TableHead>
                <TableHead style={{ width: '14%', textAlign: 'start' }}>دور الحساب</TableHead>
                <TableHead style={{ width: '17%', minWidth: 200, textAlign: 'end' }}>إجراءات الحوكمة</TableHead>
              </TableRow>"""

new_heads = """              <TableRow>
                <TableHead style={{ width: '17%', textAlign: 'start' }}>اسم الحساب (Username)</TableHead>
                <TableHead style={{ width: '20%', textAlign: 'start' }}>الاسم الكامل والوصف</TableHead>
                <TableHead style={{ width: '12%', textAlign: 'start' }}>حالة الحساب</TableHead>
                <TableHead style={{ width: '14%', textAlign: 'start' }}>صلاحية RDP</TableHead>
                <TableHead style={{ width: '13%', textAlign: 'start' }}>دور الحساب</TableHead>
                <TableHead style={{ width: '24%', textAlign: 'end' }}>إجراءات الحوكمة</TableHead>
              </TableRow>"""

c = c.replace(old_heads, new_heads)

old_cells = """                  <TableRow key={u.username}>
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
                      <div className="flex justify-end gap-1.5" style={{ flexWrap: 'nowrap' }}>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedUser(u.username);
                            setNewPassword('');
                            setPasswordModalOpen(true);
                          }}
                          className="text-xs px-2 text-primary"
                        >
                          <KeyRound size={13} className="ml-1" />
                          كلمة المرور
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={actionUser === u.username}
                          onClick={() => handleToggleState(u)}
                          className="text-xs px-2"
                        >
                          {u.enabled ? 'تعطيل' : 'تفعيل'}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDelete(u.username)}
                          className="text-xs px-2"
                        >
                          حذف
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>"""

new_cells = """                  <TableRow key={u.username}>
                    <TableCell style={{ width: '17%' }} className="font-bold text-title">
                      <div className="flex items-center gap-2">
                        <Users size={15} className="text-primary" />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.username}</span>
                      </div>
                    </TableCell>
                    <TableCell style={{ width: '20%' }} className="text-xs text-muted">
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {u.full_name || u.description || 'حساب مستخدم محلي'}
                      </span>
                    </TableCell>
                    <TableCell style={{ width: '12%' }}>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold ${
                          u.enabled
                            ? 'bg-status-safe-surface text-status-safe'
                            : 'bg-status-danger-surface text-status-danger'
                        }`}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${u.enabled ? 'bg-status-safe' : 'bg-status-danger'}`} />
                        {u.enabled ? 'نشط Active' : 'معطّل Disabled'}
                      </span>
                    </TableCell>
                    <TableCell style={{ width: '14%' }}>
                      <span
                        className={`text-xs font-bold ${
                          u.is_rdp ? 'text-primary' : 'text-muted'
                        }`}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        {u.is_rdp ? 'مفعّل (RDP)' : 'معطّل'}
                      </span>
                    </TableCell>
                    <TableCell style={{ width: '13%' }}>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-bold ${
                          u.is_admin
                            ? 'bg-primary/20 text-primary border border-border-gold-rim'
                            : 'bg-surface-glass-tint text-muted'
                        }`}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        {u.is_admin ? 'مدير نظام (Admin)' : 'مستخدم قياسي (User)'}
                      </span>
                    </TableCell>
                    <TableCell style={{ width: '24%', textAlign: 'end' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedUser(u.username);
                            setNewPassword('');
                            setPasswordModalOpen(true);
                          }}
                          style={{ fontSize: 11, padding: '3px 8px', whiteSpace: 'nowrap' }}
                          className="text-primary"
                        >
                          <KeyRound size={12} style={{ marginInlineEnd: 4 }} />
                          كلمة المرور
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={actionUser === u.username}
                          onClick={() => handleToggleState(u)}
                          style={{ fontSize: 11, padding: '3px 8px', whiteSpace: 'nowrap' }}
                        >
                          {u.enabled ? 'تعطيل' : 'تفعيل'}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDelete(u.username)}
                          style={{ fontSize: 11, padding: '3px 8px', whiteSpace: 'nowrap' }}
                        >
                          حذف
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>"""

if old_cells in c:
    c = c.replace(old_cells, new_cells)
    print('[+] Replaced old_cells in UsersPage.tsx')
else:
    print('[-] old_cells not found in UsersPage.tsx')

with open('frontend/src/pages/UsersPage.tsx', 'w', encoding='utf-8') as f:
    f.write(c)

print('[+] Done updating UsersPage.tsx')
