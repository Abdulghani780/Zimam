/**
 * ZIMAM Control Plane v1 API client.
 *
 * Talks to `/api/v1` served by the FastAPI control plane (same origin when the
 * SPA is mounted at `/console` on :8876). Auth is an HttpOnly session cookie —
 * no tokens are stored in the browser.
 *
 * Migration rule (docs/MIGRATION_PLAN.md): new features use this client;
 * legacy `/api/*` calls stay in `api.ts` until their page is switched over.
 */

const BASE = '/api/v1';

export class ApiV1Error extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  if (options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    credentials: 'same-origin',
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON error body
  }
  if (!res.ok) {
    const message =
      (data && (data.detail || data.error || data.message)) ||
      `HTTP ${res.status}`;
    throw new ApiV1Error(res.status, typeof message === 'string' ? message : JSON.stringify(message));
  }
  return data as T;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });

// --- Types mirroring control_plane/zimam_control/api.py ---

export interface V1Health {
  ok: boolean;
  status?: string;
  [key: string]: unknown;
}

export interface V1User {
  id: string;
  username: string;
  role?: 'admin' | 'operator' | 'viewer' | string;
  full_name?: string;
  is_active?: boolean;
  is_admin?: boolean;
  mfa_enabled?: boolean;
  created_at?: string;
  [key: string]: unknown;
}

export interface V1Asset {
  id: string;
  name: string;
  hostname: string;
  platform?: string;
  port?: number | null;
  protocol?: string | null;
  metadata?: Record<string, unknown>;
  status?: string;
  node_id?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface V1Account {
  id: string;
  asset_id: string;
  asset_name?: string;
  name: string;
  username: string;
  protocol: string;
  created_at?: string;
  has_secret?: boolean;
  [key: string]: unknown;
}

export interface V1JitGrant {
  id: string;
  user: string;
  user_id?: string;
  target?: string;
  role?: string;
  reason?: string;
  ticket?: string;
  duration_mins?: number;
  remaining_sec?: number;
  status?: string;
  approver?: string;
  created_at?: string | null;
  expires_at?: string | null;
  [key: string]: unknown;
}

export interface V1AccessPolicy {
  id: string;
  name: string;
  effect: 'allow' | 'deny';
  subject_ids?: string[];
  asset_ids?: string[];
  account_ids?: string[];
  protocols?: string[];
  actions?: string[];
  valid_from?: string | null;
  valid_until?: string | null;
  [key: string]: unknown;
}

export interface V1Session {
  id: string;
  user_id?: string;
  asset_id?: string;
  status?: string;
  [key: string]: unknown;
}

export interface V1AuditEvent {
  sequence?: number;
  actor_id?: string;
  action?: string;
  target_id?: string | null;
  payload?: Record<string, unknown>;
  previous_hash?: string;
  event_hash?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface V1AuditVerify {
  chain_intact?: boolean;
  failed_index?: number | null;
  root_signature?: string;
  [key: string]: unknown;
}

export interface V1DirectoryUser {
  id?: string;
  username: string;
  display_name?: string;
  [key: string]: unknown;
}

export interface V1Agent {
  id: string;
  name?: string;
  status?: string;
  last_seen_at?: string | null;
  inventory?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface V1AgentJob {
  id: string;
  agent_id: string;
  job_type: string;
  status: string;
  result?: { result?: Record<string, unknown>; error?: string | null } | null;
  created_by?: string;
  created_at?: string;
  completed_at?: string | null;
  [key: string]: unknown;
}

export const apiV1 = {
  // Health & bootstrap
  health: () => request<V1Health>('/health'),
  bootstrap: (username: string, password: string, token: string) =>
    request<unknown>('/auth/bootstrap', {
      method: 'POST',
      headers: { 'X-Bootstrap-Token': token },
      body: JSON.stringify({ username, password }),
    }),

  // Auth (cookie session)
  login: (username: string, password: string, otp?: string) =>
    post<{ ok?: boolean; user?: V1User }>('/auth/login', {
      username,
      password,
      ...(otp ? { otp } : {}),
    }),
  logout: () => post<unknown>('/auth/logout'),
  me: () => request<V1User>('/auth/me'),
  mfaSetup: () => post<{ secret?: string; otpauth_url?: string }>('/auth/mfa/setup'),
  mfaVerify: (code: string) => post<unknown>('/auth/mfa/verify', { code }),

  // Directory & users
  users: () => request<V1User[] | { users?: V1User[] }>('/users'),
  createUser: (user: { username: string; password: string; role?: string; full_name?: string }) =>
    post<V1User>('/users', user),
  updateUserRole: (username: string, role: string) =>
    post<V1User>(`/users/${encodeURIComponent(username)}/role`, { role }),
  updateUserPassword: (username: string, newPassword: string) =>
    post<unknown>(`/users/${encodeURIComponent(username)}/password`, { new_password: newPassword }),
  updateUserStatus: (username: string, isActive: boolean) =>
    post<unknown>(`/users/${encodeURIComponent(username)}/status`, { is_active: isActive }),
  groups: () => request<unknown>('/groups'),
  directorySync: () => post<unknown>('/directory/sync'),

  // JIT elevation grants
  jitGrants: () => request<{ ok?: boolean; grants?: V1JitGrant[] }>('/jit-grants'),
  requestJitGrant: (body: { target_role: string; reason: string; duration_mins: number; username?: string }) =>
    post<{ ok?: boolean; grant?: V1JitGrant; message?: string }>('/jit-grants', body),
  decideJitGrant: (id: string, approve: boolean) =>
    post<{ ok?: boolean; grant?: V1JitGrant; message?: string }>(`/jit-grants/${encodeURIComponent(id)}/decision`, { approve }),
  revokeJitGrant: (id: string) =>
    post<{ ok?: boolean; grant?: V1JitGrant; message?: string }>(`/jit-grants/${encodeURIComponent(id)}/revoke`, {}),
  directoryUsers: () =>
    request<{ users?: V1DirectoryUser[] } | V1DirectoryUser[]>('/directory/users'),

  // Assets, accounts, policies
  assets: () => request<V1Asset[] | { assets?: V1Asset[] }>('/assets'),
  createAsset: (asset: {
    name: string;
    hostname: string;
    platform?: string;
    node_id?: string | null;
    port?: number | null;
    protocol?: string | null;
    metadata?: Record<string, unknown>;
  }) => post<V1Asset>('/assets', asset),
  accounts: () => request<V1Account[] | { accounts?: V1Account[] }>('/accounts'),
  createAccount: (account: {
    asset_id: string;
    name: string;
    username: string;
    protocol: 'rdp' | 'ssh' | 'sftp' | 'winrm' | 'vnc' | 'telnet';
    secret: string;
  }) => post<V1Account>('/accounts', account),
  revealAccountSecret: (accountId: string) =>
    post<{ secret?: string; username?: string; asset_name?: string; protocol?: string }>(
      `/accounts/${encodeURIComponent(accountId)}/reveal`,
    ),
  deleteAccount: (accountId: string) =>
    request<unknown>(`/accounts/${encodeURIComponent(accountId)}`, { method: 'DELETE' }),
  accessPolicies: () =>
    request<V1AccessPolicy[] | { policies?: V1AccessPolicy[] }>('/access-policies'),
  createAccessPolicy: (policy: Partial<V1AccessPolicy> & { name: string }) =>
    post<V1AccessPolicy>('/access-policies', policy),

  // Sessions & recordings
  sessions: () => request<V1Session[] | { sessions?: V1Session[] }>('/sessions'),
  terminateSession: (sessionId: string) => post<unknown>(`/sessions/${sessionId}/terminate`),
  recordings: () => request<unknown>('/recordings'),

  // Connection tokens (gateway consumption)
  createConnectionToken: (body: {
    asset_id: string;
    account_id: string;
    protocol: 'rdp' | 'ssh' | 'telnet' | 'vnc';
    actions?: string[];
  }) => post<{ token?: string; [key: string]: unknown }>('/connection-tokens', body),
  consumeConnectionToken: (token: string) =>
    post<unknown>('/gateway/connection-tokens/consume', { token }),

  // Asset nodes & agents
  assetNodes: () => request<unknown>('/asset-nodes'),
  agents: () => request<V1Agent[] | { agents?: V1Agent[] }>('/agents'),
  jobs: (agentId?: string) =>
    request<V1AgentJob[] | { jobs?: V1AgentJob[] }>(`/jobs${agentId ? `?agent_id=${encodeURIComponent(agentId)}` : ''}`),
  enrollAgent: (body: { agent_key?: string; [key: string]: unknown }) =>
    post<{ agent_id?: string; agent_key?: string; signing_public_key?: string }>('/agents/enroll', body),
  createJob: (body: { agent_id: string; job_type: string; payload?: Record<string, unknown> }) =>
    post<{ id?: string; status?: string }>('/jobs', body),
  listJobs: (agentId?: string) =>
    request<unknown>(`/jobs${agentId ? `?agent_id=${encodeURIComponent(agentId)}` : ''}`),
  agentLatestResults: (agentId: string) =>
    request<{ agent_id: string; results: Record<string, { job_id: string; completed_at: string | null; result: unknown; error: string | null }> }>(
      `/agents/${encodeURIComponent(agentId)}/results/latest`,
    ),
  fleetSummary: () =>
    request<{
      agents: {
        id: string; name: string; status: string;
        last_seen_at: string | null; hostname?: string | null; os?: string | null;
        process_count?: number | null;
        linked_asset: { id: string; name: string; hostname: string } | null;
        collector_count: number; collectors: string[]; last_collection_at: string | null;
      }[];
      totals: { agents: number; online: number; with_results: number };
    }>('/fleet/summary'),
  agentHeartbeat: (agentId: string, agentKey: string, inventory: Record<string, unknown>) =>
    request<unknown>(`/agents/${agentId}/heartbeat`, {
      method: 'POST',
      headers: { 'X-Agent-Key': agentKey },
      body: JSON.stringify({ inventory }),
    }),

  // First-run setup wizard (public until first admin exists)
  setupStatus: () =>
    request<{ needs_setup?: boolean; user_count?: number; license?: Record<string, unknown> }>('/setup/status'),
  setupComplete: (body: { username: string; password: string; full_name?: string; license_token?: string }) =>
    post<{ authenticated?: boolean; user_id?: string; username?: string }>('/setup/complete', body),

  // Agent self-update bundle (admin uploads the .exe once; agents pull it)
  updateBundleStatus: () => request<Record<string, unknown>>('/agents/update-bundle'),
  uploadUpdateBundle: async (file: File, version: string, sha256: string) => {
    const res = await fetch('/api/v1/agents/update-bundle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Update-Version': version, 'X-Update-Sha256': sha256 },
      body: file,
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<Record<string, unknown>>;
  },

  // License & entitlements
  licenseStatus: () => request<Record<string, unknown>>('/license'),
  activateLicense: (token: string) => post<{ ok?: boolean; tier?: string; expires_at?: string }>('/license/activate', { token }),
  deactivateLicense: () => post<unknown>('/license/deactivate'),

  // Audit & ops
  auditEvents: (params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    const suffix = q.toString() ? `?${q}` : '';
    return request<{ events?: V1AuditEvent[] } | V1AuditEvent[]>(`/audit/events${suffix}`);
  },
  verifyAudit: () => request<unknown>('/audit/verify'),
  backup: () => post<unknown>('/system/backup'),
};

export type { V1AccessPolicy as AccessPolicy, V1Asset as Asset, V1Session as Session };
