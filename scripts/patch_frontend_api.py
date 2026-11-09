from pathlib import Path

p = Path('frontend/src/lib/api.ts')
content = p.read_text(encoding='utf-8')

# 1. Update trimGovernor
trim_old = """  trimGovernor: (sessionId?: number) =>
    request<{ ok: boolean; result?: any }>('/api/governor/trim', {
      method: 'POST',
      body: JSON.stringify(sessionId ? { session_id: sessionId } : {}),
    }),"""

trim_new = """  trimGovernor: (sessionId?: number, name?: string, pid?: number) =>
    request<{ ok: boolean; reclaimed_mb?: number; result?: any; message?: string; error?: string }>('/api/governor/trim', {
      method: 'POST',
      body: JSON.stringify({
        ...(sessionId !== undefined ? { session_id: sessionId } : {}),
        ...(name ? { name } : {}),
        ...(pid ? { pid } : {}),
      }),
    }),"""

if trim_old in content:
    content = content.replace(trim_old, trim_new)

# 2. Add resetUserPassword
users_anchor = "  toggleUserState: (username: string, enabled: boolean) =>\n    request<any>('/api/users/toggle-state', {\n      method: 'POST',\n      body: JSON.stringify({ username, enabled }),\n    }),"
users_addition = """  toggleUserState: (username: string, enabled: boolean) =>
    request<any>('/api/users/toggle-state', {
      method: 'POST',
      body: JSON.stringify({ username, enabled }),
    }),
  resetUserPassword: (username: string, password: string) =>
    request<{ ok: boolean; username?: string; message?: string; error?: string }>('/api/users/reset-password', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),"""

if users_anchor in content and "resetUserPassword" not in content:
    content = content.replace(users_anchor, users_addition)

# 3. Add JIT & Audit methods at the end of api object
end_anchor = "  checkFileLock: (path: string) =>\n    request<{ ok: boolean; path: string; is_locked: boolean; lockers: any[]; lockers_count: number }>('/api/storage/check-file-lock', {\n      method: 'POST',\n      body: JSON.stringify({ path }),\n    }),\n};"
end_replacement = """  checkFileLock: (path: string) =>
    request<{ ok: boolean; path: string; is_locked: boolean; lockers: any[]; lockers_count: number }>('/api/storage/check-file-lock', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),

  // JIT Zero-Trust Elevation (Story 1 / JumpServer PAM)
  getJitGrants: () =>
    request<{ ok: boolean; grants: any[]; count: number }>('/api/jit/grants'),
  requestJitElevation: (params: { role: string; reason: string; duration_mins: number; user?: string }) =>
    request<{ ok: boolean; id: string; message: string; grant?: any }>('/api/jit/request', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  revokeJitElevation: (id: string) =>
    request<{ ok: boolean; id: string; user?: string; message: string }>('/api/jit/revoke', {
      method: 'POST',
      body: JSON.stringify({ id }),
    }),

  // Audit Cryptographic Chain Verification
  verifyAuditChain: () =>
    request<{ ok: boolean; records_checked: number; chain_intact: boolean; root_hash: string; full_digest?: string; message: string }>('/api/audit/verify-chain'),
};"""

if end_anchor in content:
    content = content.replace(end_anchor, end_replacement)

p.write_text(content, encoding='utf-8')
print('Successfully patched frontend/src/lib/api.ts')
