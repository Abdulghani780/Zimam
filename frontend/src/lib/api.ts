import { t } from './i18n';
/**
 * ASAAS - Typed API Client & Real-time Live Telemetry.
 */

export interface SystemHost {
  host: string;
  hostname?: string;
  os: string;
  platform?: string;
  cpuCores: number;
  cpuPerCore: number[];
  totalRam: number;
  usedRam: number;
  ram: number;
  cpu: number;
  disk: {
    total: number;
    used: number;
    percent: number;
  };
  uptime: string;
  updated?: string;
}

export interface SystemHistory {
  timestamps: string[];
  cpu: {
    cores: Record<string, number[]>;
    core_count: number;
    physical_cores?: number;
    latest: number[];
    total: number;
  };
  memory: {
    history: number[];
    swap_history: number[];
    total_gb: number;
    used_gb: number;
    free_gb: number;
    percent: number;
    swap_total_gb: number;
    swap_used_gb: number;
    swap_percent: number;
  };
  network: {
    rx_history: number[];
    tx_history: number[];
    rx_rate_kb: number;
    tx_rate_kb: number;
    total_recv_gb: number;
    total_sent_gb: number;
  };
  disk: {
    read_history: number[];
    write_history: number[];
    read_rate_kb: number;
    write_rate_kb: number;
    total_read_gb: number;
    total_write_gb: number;
  };
}

export interface ManagedServer {
  id: string;
  name: string;
  ip: string;
  os: string;
  domain?: string;
  status: string;
  roles_count?: number;
  cpu: number;
  ram: number;
  storage: number;
  alerts_count?: number;
  is_local?: number | boolean;
  last_seen?: string;
  created_at?: string;
  latency_ms?: number;
}

export interface JitGrant {
  id: string;
  user: string;
  role: string;
  target_role: string;
  reason: string;
  duration_mins: number;
  remaining_sec: number;
  status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'REJECTED' | string;
  approver: string;
  created_at: string;
  expires_at: string;
}

export interface UserSession {
  id: number;
  user: string;
  role?: string;
  status: string;
  state?: string;
  idle?: number | string | null;
  idle_time?: string;
  idle_formatted?: string;
  login?: string;
  login_time?: string;
  cpu?: number;
  ram?: number;
  ram_mb?: number;
  ram_formatted?: string;
  procs?: number;
  processes_count?: number;
  station?: string;
  is_current?: boolean;
}

export interface ProcessItem {
  pid: number;
  name: string;
  user: string;
  session: number;
  cpu: number;
  ram: number;
  ram_mb?: number;
}

export interface ServiceItem {
  name: string;
  display: string;
  status: 'Running' | 'Stopped' | string;
  startup: string;
  category: string;
  critical: boolean;
}

export interface TelemetrySnapshot {
  host: SystemHost;
  sessions: UserSession[];
  processes: ProcessItem[];
  services: ServiceItem[];
}

export interface GovernorStatus {
  enabled: boolean;
  auto_trim: boolean;
  idle_threshold_mins: number;
  auto_disconnect_enabled: boolean;
  auto_disconnect_mins: number;
  auto_logoff_enabled: boolean;
  auto_logoff_hours: number;
  reclaimed_mb: number;
  trimmed_sessions: number;
  throttled_pids: number;
  active_sessions: number;
}

export interface PortItem {
  local_port: number;
  proto: string;
  pid: number;
  process_name: string;
  service?: string;
  service_name?: string;
  remote_ip: string;
  remote_port: number;
  state?: string;
  status?: string;
  is_listening: boolean;
  is_system?: boolean;
  is_external?: boolean;
  risk: string;
  owner_user?: string;
  owner_session?: number;
  is_isolated?: boolean;
  is_dev_port?: boolean;
  project_hint?: string;
}

export interface SecurityStats {
  blocked_ips_count: number;
  failed_attempts_count: number;
  attacks_intercepted: number;
  auto_ban_enabled: boolean;
  fail_threshold: number;
  ban_duration_hours: number;
  firewall_active?: boolean;
  threat_level?: string;
  failed_logins_today?: number;
}

export interface SecurityEvent {
  event_id: number;
  time: string;
  user: string;
  ip: string;
  action: string;
  severity: 'info' | 'warning' | 'danger';
}

export interface AssetItem {
  id: string;
  name: string;
  host: string;
  type: string;
  port: number;
  protocol?: string;
  status: string;
  latency_ms: number;
  last_check: string;
}

export interface VaultAccount {
  id: string;
  asset_id: string;
  asset_name: string;
  username: string;
  protocol: string;
  updated_at: string;
}

export interface LocalUser {
  username: string;
  full_name: string;
  is_admin: boolean;
  is_rdp: boolean;
  enabled: boolean;
  password_age_days: number;
  description?: string;
  last_logon?: string;
  is_current?: boolean;
  is_protected?: boolean;
  name?: string;
  fullName?: string;
  isRdp?: boolean;
  isAdmin?: boolean;
}

export interface AuditLog {
  id: number;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  target: string;
  ip: string;
  status: string;
  details: Record<string, any>;
}

export interface HealthInfo {
  ok: boolean;
  is_windows: boolean;
  os_kind: string;
  os_display?: string;
  is_admin: boolean;
  actions_enabled: boolean;
  version: string;
  authenticated?: boolean;
  current_user?: string;
  current_role?: string;
}

export interface AppUser {
  id: number;
  username: string;
  role: 'admin' | 'operator' | 'viewer';
  full_name: string;
  is_active: boolean;
  created_at: string;
  last_login?: string;
}

export interface DomainProfile {
  is_domain_joined: boolean;
  is_domain_controller: boolean;
  domain_role: number;
  domain_name: string;
  workgroup: string;
  role_display: string;
  can_manage_domain: boolean;
  can_modify_users_locally: boolean;
}

export interface HistoricalPoint {
  timestamp: string;
  cpu: number;
  ram: number;
  ram_used_gb: number;
  disk_used_gb: number;
  active_sessions: number;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  if (options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(path, { ...options, headers, credentials: 'same-origin' });
  if (!res.ok) {
    let errMessage = `HTTP error ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson && errJson.error) {
        errMessage = errJson.error;
      }
    } catch {
      // ignore
    }
    throw new Error(errMessage);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Health
  getHealth: async (): Promise<HealthInfo> => {
    return request<HealthInfo>('/api/health');
  },

  // Telemetry & Snapshot
  getSnapshot: () => request<TelemetrySnapshot>('/api/snapshot'),

  // Governor
  getGovernorStatus: () => request<GovernorStatus>('/api/governor/status'),
  trimGovernor: (sessionId?: number, name?: string, pid?: number) =>
    request<{ ok: boolean; reclaimed_mb?: number; result?: any; message?: string; error?: string }>('/api/governor/trim', {
      method: 'POST',
      body: JSON.stringify({
        ...(sessionId !== undefined ? { session_id: sessionId } : {}),
        ...(name ? { name } : {}),
        ...(pid ? { pid } : {}),
      }),
    }),
  updateGovernor: (params: Partial<GovernorStatus>) =>
    request<GovernorStatus>('/api/governor/toggle', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  // Services
  getServices: async (): Promise<ServiceItem[]> => {
    const res = await request<any>('/api/services');
    return Array.isArray(res) ? res : (res?.services || []);
  },
  controlService: (name: string, action: 'start' | 'stop' | 'restart') =>
    request<{ ok: boolean; error?: string }>('/api/services/control', {
      method: 'POST',
      body: JSON.stringify({ name, action }),
    }),

  // Ports & Isolation Guard
  getPorts: (force: boolean = false) =>
    request<{ ok: boolean; summary: any; ports: PortItem[]; guard?: any }>(`/api/ports${force ? '?force=1' : ''}`),
  checkPortConflict: (port: number, username?: string, session_id?: number) =>
    request<{
      available: boolean;
      conflict?: boolean;
      requested_port?: number;
      status?: string;
      message: string;
      current_owner?: string | null;
      owner_user?: string;
      owner_session?: number;
      suggested_port?: number;
      alternatives?: number[];
    }>('/api/ports/guard/check', {
      method: 'POST',
      body: JSON.stringify({ port, username, session_id }),
    }),
  getGuardStatus: () =>
    request<{ ok: boolean; guard_active: boolean; total_listening: number; isolated_user_ports_count: number; isolated_ports: any[]; user_reservations: Record<string, string | number[]>; db_reservations?: any[] }>('/api/ports/guard/status'),
  claimPort: (params: { requested_port: number; username?: string; session_id?: number; project_name?: string }) =>
    request<{
      ok: boolean;
      assigned_port: number;
      requested_port: number;
      was_redirected?: boolean;
      was_reallocated?: boolean;
      owner_user?: string;
      user?: string;
      session_id?: number;
      project_name?: string;
      message: string;
      command_hint?: string;
    }>('/api/ports/guard/claim', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  releasePort: (port: number, username?: string) =>
    request<{ ok: boolean; port: number; message: string }>('/api/ports/guard/release', {
      method: 'POST',
      body: JSON.stringify({ port, username }),
    }),
  closePortProcess: (pid: number) =>
    request<{ ok: boolean; error?: string }>('/api/ports/close-process', {
      method: 'POST',
      body: JSON.stringify({ pid }),
    }),
  blockIp: (ip: string) =>
    request<{ ok: boolean; error?: string }>('/api/ports/block-ip', {
      method: 'POST',
      body: JSON.stringify({ ip }),
    }),
  diagnosePort: (host: string, port: number) =>
    request<any>('/api/ports/diagnose', {
      method: 'POST',
      body: JSON.stringify({ host, port }),
    }),

  // Security Defense Shield
  getSecurityStats: () => request<SecurityStats>('/api/security/stats'),
  getSecurityEvents: async (): Promise<SecurityEvent[]> => {
    const res = await request<any>('/api/security/events');
    const list = Array.isArray(res) ? res : (res?.events || []);
    return list.map((e: any, idx: number) => {
      const rawSeverity = String(e?.details?.severity || e?.severity || e?.status || 'info').toLowerCase();
      const severity = rawSeverity.includes('critical') || rawSeverity.includes('block')
        ? 'danger'
        : rawSeverity.includes('warn') || rawSeverity.includes('alert')
          ? 'warning'
          : 'info';
      return {
        event_id: Number(e?.id ?? e?.event_id ?? idx),
        time: e?.timestamp || e?.time || '',
        user: e?.user || 'System',
        ip: e?.ip || e?.ip_address || '—',
        action: e?.action || e?.event || e?.event_type || 'EVENT',
        severity,
      } as SecurityEvent;
    });
  },
  getBlockedIps: async (): Promise<string[]> => {
    const res = await request<any>('/api/security/events');
    return Array.isArray(res?.blocked_ips) ? res.blocked_ips : (Array.isArray(res) ? res : []);
  },
  blockSecurityIp: (ip: string, reason: string) =>
    request<{ ok: boolean; error?: string }>('/api/security/block', {
      method: 'POST',
      body: JSON.stringify({ ip, reason }),
    }),
  unblockSecurityIp: (ip: string) =>
    request<{ ok: boolean; error?: string }>('/api/security/unblock', {
      method: 'POST',
      body: JSON.stringify({ ip }),
    }),
  checkCommandRisk: (command: string) =>
    request<{ safe: boolean; reason: string; risk_level: string }>('/api/security/command-check', {
      method: 'POST',
      body: JSON.stringify({ command }),
    }),

  // Assets
  getAssets: async (): Promise<AssetItem[]> => {
    const res = await request<any>('/api/assets');
    const list = Array.isArray(res) ? res : (res?.assets || []);
    return list.map((a: any) => ({
      id: a.id || String(a.port || Math.random()),
      name: a.name || t('خادم غير مسمى'),
      host: a.host || a.address || '127.0.0.1',
      type: a.type || a.platform_display || a.platform || 'Windows Server',
      port: Number(a.port || 3389),
      protocol: a.protocol || (Number(a.port) === 22 ? 'SSH' : 'RDP'),
      status: String(a.status || 'unknown').toLowerCase(),
      latency_ms: Number(a.latency_ms ?? 0),
      last_check: a.last_check || '',
    }));
  },
  addAsset: (asset: { name: string; host: string; type: string; port: number; protocol?: string }) =>
    request<any>('/api/assets/add', {
      method: 'POST',
      body: JSON.stringify({
        name: asset.name,
        address: asset.host,
        platform: asset.type?.toLowerCase().includes('linux') ? 'ubuntu' : 'windows',
        platform_display: asset.type,
        port: Number(asset.port),
        protocol: asset.protocol || (Number(asset.port) === 22 ? 'SSH' : 'RDP'),
      }),
    }),
  deleteAsset: (id: string) =>
    request<any>('/api/assets/remove', {
      method: 'POST',
      body: JSON.stringify({ id }),
    }),
  testAsset: (id: string, address?: string, port?: number) =>
    request<any>('/api/assets/test', {
      method: 'POST',
      body: JSON.stringify({
        asset_id: id,
        address: address || '127.0.0.1',
        port: port || 3389,
        protocol: port === 22 ? 'SSH' : 'TCP',
      }),
    }),

  // Vault (PAM)
  getVaultAccounts: async (): Promise<VaultAccount[]> => {
    const res = await request<any>('/api/vault/accounts');
    return Array.isArray(res) ? res : (res?.accounts || []);
  },
  addVaultAccount: (account: { asset_id?: string; asset_name: string; username: string; protocol: string; password: string }) =>
    request<{ ok: boolean; id: string; message?: string }>('/api/vault/accounts/add', {
      method: 'POST',
      body: JSON.stringify(account),
    }),
  deleteVaultAccount: (id: string) =>
    request<{ ok: boolean; id: string }>('/api/vault/accounts/delete', {
      method: 'POST',
      body: JSON.stringify({ id }),
    }),
  revealVaultSecret: (id: string) =>
    request<{ ok: boolean; secret?: string; error?: string; username?: string; asset_name?: string }>('/api/vault/reveal', {
      method: 'POST',
      body: JSON.stringify({ id }),
    }),
  // Storage
  getStorageBreakdown: async (drive: string = 'C'): Promise<any> => {
    const res = await request<any>(`/api/storage/breakdown?drive=${drive}`);
    return {
      ok: res?.ok ?? true,
      drive: res?.drive || drive,
      total: res?.total_gb ?? res?.total ?? 0,
      used: res?.used_gb ?? res?.used ?? 0,
      free: res?.free_gb ?? res?.free ?? 0,
      percent: res?.percent_used ?? res?.percent ?? 0,
      cleanable_mb: res?.cleanable_mb ?? 0,
      cleanable_gb: res?.cleanable_gb ?? 0,
      categories: res?.categories || [],
      heavy_items: res?.heavy_items || [],
    };
  },
  getStorageUsers: async (): Promise<any[]> => {
    const res = await request<any>('/api/storage/users');
    const list = res?.profiles || res?.users || (Array.isArray(res) ? res : []);
    return list.map((u: any) => ({
      username: u.username || t('مستخدم'),
      path: u.path || `C:\\Users\\${u.username}`,
      size_mb: u.total_mb ?? u.size_mb ?? 0,
      temp_size_mb: u.temp_mb ?? u.temp_size_mb ?? 0,
      downloads_mb: u.downloads_mb ?? 0,
      documents_mb: u.documents_mb ?? 0,
      desktop_mb: u.desktop_mb ?? 0,
    }));
  },
  cleanSystemJunk: () =>
    request<{ ok: boolean; reclaimed_mb: number; cleaned_items: any }>('/api/storage/clean-junk', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  cleanUserTemp: (username: string) =>
    request<{ ok: boolean; reclaimed_mb: number }>('/api/storage/clean-user-temp', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),

  // Local Users
  getUsers: async (): Promise<LocalUser[]> => {
    const res = await request<any>('/api/users');
    const rawList = Array.isArray(res) ? res : (res?.users || []);
    return rawList.map((u: any) => ({
      username: u.username || u.name || '',
      full_name: u.full_name || u.fullName || u.name || '',
      enabled: Boolean(u.enabled ?? true),
      is_rdp: Boolean(u.is_rdp ?? u.isRdp ?? false),
      is_admin: Boolean(u.is_admin ?? u.isAdmin ?? false),
      password_age_days: Number(u.password_age_days ?? 0),
      description: u.description || '',
      last_logon: u.last_logon || u.lastLogon,
      is_current: Boolean(u.is_current),
      is_protected: Boolean(u.is_protected),
    }));
  },
  createUser: (user: { username: string; password: string; full_name?: string; is_rdp?: boolean; is_admin?: boolean }) =>
    request<any>('/api/users/create', {
      method: 'POST',
      body: JSON.stringify(user),
    }),
  deleteUser: (username: string) =>
    request<any>('/api/users/delete', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),
  toggleUserState: (username: string, enabled: boolean) =>
    request<any>('/api/users/toggle-state', {
      method: 'POST',
      body: JSON.stringify({ username, enabled }),
    }),
  resetUserPassword: (username: string, password: string) =>
    request<{ ok: boolean; username?: string; message?: string; error?: string }>('/api/users/reset-password', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  // Audit Logs
  getAuditLogs: async (limit: number = 100): Promise<AuditLog[]> => {
    const res = await request<any>(`/api/audit/logs?limit=${limit}`);
    return Array.isArray(res) ? res : (res?.logs || []);
  },

  logAuditEvent: (eventType: string, details: string) =>
    request<{ ok: boolean }>('/api/security/events', {
      method: 'POST',
      body: JSON.stringify({ event_type: eventType, details }),
    }),

  // Telegram Alert Config
  getAlertsConfig: () => request<{ ok: boolean; config: any }>('/api/alerts/config'),
  saveAlertsConfig: (cfg: { telegram_enabled: boolean; bot_token: string; chat_id: string }) =>
    request<any>('/api/alerts/config', {
      method: 'POST',
      body: JSON.stringify(cfg),
    }),
  testAlert: (message: string) =>
    request<any>('/api/alerts/test', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),

  // Session Management & Shadowing
  sendMessage: (sessionId: number, title: string, message: string, broadcast: boolean = false) =>
    request<any>('/api/messages/send', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId, title, message, broadcast }),
    }),
  disconnectSession: (sessionId: number) =>
    request<any>('/api/sessions/disconnect', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    }),
  logoffSession: (sessionId: number) =>
    request<any>('/api/sessions/logoff', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    }),
  shadowSession: (sessionId: number, mode: 'view' | 'control') =>
    request<any>('/api/sessions/shadow', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId, mode, no_consent: true }),
    }),
  enableShadowPolicy: () =>
    request<{ ok: boolean; message?: string; error?: string }>('/api/sessions/shadow/enable-policy', {
      method: 'POST',
    }),
  getBastionConnectUrl: (host: string, port: number = 3389, name?: string) =>
    `/api/bastion/connect?host=${encodeURIComponent(host)}&port=${port}&name=${encodeURIComponent(name || host)}`,

  // Process termination
  terminateProcess: (pid: number) =>
    request<any>('/api/processes/terminate', {
      method: 'POST',
      body: JSON.stringify({ pid }),
    }),

  // AI Diagnostic Ops
  getAiDiagnosis: () => request<any>('/api/ai/diagnose'),

  // Elevation
  requestElevation: () =>
    request<{ ok: boolean; message: string; already_admin?: boolean }>('/api/system/elevate', {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  // Multi-User RBAC & Auth (Story 1)
  login: async (username: string, password: string) => {
    const res = await request<{ ok: boolean; user: AppUser; message: string; token?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    return res;
  },
  logout: async () => {
    // Best-effort: also revoke the control-plane session when present.
    try {
      const { apiV1 } = await import('./apiV1');
      await apiV1.logout();
    } catch { /* control plane may be absent on the legacy origin */ }
    await request('/api/auth/logout', { method: 'POST' });
  },
  getCurrentUser: () => request<{ ok: boolean; user: AppUser }>('/api/auth/me'),
  getAppUsers: () => request<{ ok: boolean; users: AppUser[]; count: number }>('/api/auth/users'),
  createAppUser: (user: { username: string; password: string; role: string; full_name?: string }) =>
    request<{ ok: boolean; message?: string; error?: string }>('/api/auth/users/create', {
      method: 'POST',
      body: JSON.stringify(user),
    }),
  deleteAppUser: (username: string) =>
    request<{ ok: boolean; message?: string; error?: string }>('/api/auth/users/delete', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),
  changePassword: (username: string, new_password: string) =>
    request<{ ok: boolean; message?: string; error?: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ username, new_password }),
    }),
  updateAppUserRole: (username: string, role: string) =>
    request<{ ok: boolean; message?: string; error?: string }>('/api/auth/users/update-role', {
      method: 'POST',
      body: JSON.stringify({ username, role }),
    }),

  // Domain & Active Directory (Story 7)
  getDomainProfile: () => request<{ ok: boolean; domain: DomainProfile }>('/api/domain/profile'),
  getDomainUsers: () => request<{ ok: boolean; domain_users: any[]; count: number }>('/api/domain/users'),

  // Historical Telemetry (Story 5)
  getHistoricalMetrics: (range: '24h' | '7d' = '24h') =>
    request<{ ok: boolean; range: string; points_count: number; history: HistoricalPoint[] }>(`/api/metrics/history?range=${range}`),

  // Live rolling system history (CPU cores, memory, network and disk rates)
  getSystemHistory: () =>
    request<{ ok: boolean; history: SystemHistory }>('/api/metrics/system-history'),

  // CPU Cores Rolling History
  getCpuHistory: () =>
    request<{ ok: boolean; history: { timestamps: string[]; cores: Record<string, number[]>; core_count: number } }>('/api/metrics/cpu-history'),

  // Storage Locked Files Diagnostic (Story 9)
  getLockedFiles: () => request<{ ok: boolean; locked_files: any[] }>('/api/storage/locked-files'),
  checkFileLock: (path: string) =>
    request<{ ok: boolean; path: string; is_locked: boolean; lockers: any[]; lockers_count: number }>('/api/storage/check-file-lock', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),

  // Legacy JIT compatibility surface; real grants are policy + gateway work.
  getJitGrants: () =>
    request<{ ok: boolean; grants: JitGrant[]; count: number }>('/api/jit/grants'),
  requestJitElevation: (params: { role: string; reason: string; duration_mins: number; user?: string }) =>
    request<{ ok: boolean; id: string; message: string; status?: string; grant?: any }>('/api/jit/request', {
      method: 'POST',
      body: JSON.stringify({
        role: params.role,
        reason: params.reason,
        duration_mins: params.duration_mins,
        ...(params.user ? { username: params.user } : {}),
      }),
    }),
  approveJitElevation: (id: string, approve: boolean = true) =>
    request<{ ok: boolean; id: string; user?: string; status?: string; message: string; error?: string }>('/api/jit/approve', {
      method: 'POST',
      body: JSON.stringify({ id, approve }),
    }),
  revokeJitElevation: (id: string) =>
    request<{ ok: boolean; id: string; user?: string; message: string }>('/api/jit/revoke', {
      method: 'POST',
      body: JSON.stringify({ id }),
    }),

  // Audit Cryptographic Chain Verification
  verifyAuditChain: () =>
    request<{ ok: boolean; records_checked: number; chain_intact: boolean; root_hash: string; full_digest?: string; message: string }>('/api/audit/verify-chain'),

  // =====================================================================
  // ASAAS Enterprise v3.0: Windows Server & Developer Platform API Client
  // =====================================================================

  // 1. Servers & Server Groups
  getServers: () => request<{ ok: boolean; servers: ManagedServer[] }>('/api/servers'),
  checkServers: () => request<{ ok: boolean; servers: ManagedServer[] }>('/api/servers/check'),
  addServer: (server: { name: string; ip: string; os?: string; domain?: string }) =>
    request<{ ok: boolean; id: string; name: string; error?: string }>('/api/servers', {
      method: 'POST',
      body: JSON.stringify(server),
    }),
  deleteServer: (id: string) =>
    request<{ ok: boolean; message?: string; error?: string }>('/api/servers/delete', {
      method: 'POST',
      body: JSON.stringify({ id }),
    }),
  getServerGroups: () => request<{ ok: boolean; groups: any[] }>('/api/server-groups'),
  createServerGroup: (group: { name: string; description: string; server_ids: string[] }) =>
    request<{ ok: boolean; id: string; name: string; error?: string }>('/api/server-groups/create', {
      method: 'POST',
      body: JSON.stringify(group),
    }),
  deleteServerGroup: (id: string) =>
    request<{ ok: boolean; message?: string; error?: string }>('/api/server-groups/delete', {
      method: 'POST',
      body: JSON.stringify({ id }),
    }),
  getLocalServerInfo: () => request<any>('/api/server/local'),
  restartServer: (params: { reason?: string; timeout?: number; confirmed?: boolean }) =>
    request<any>('/api/server/restart', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  shutdownServer: (params: { reason?: string; timeout?: number; confirmed?: boolean }) =>
    request<any>('/api/server/shutdown', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  // 2. Roles & Features
  getRoles: (refresh = false) => request<{ ok: boolean; roles: any[] }>(`/api/roles${refresh ? '?refresh=1' : ''}`),
  installRole: (name: string) =>
    request<any>('/api/roles/install', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  uninstallRole: (name: string, confirmed = false) =>
    request<any>('/api/roles/uninstall', {
      method: 'POST',
      body: JSON.stringify({ name, confirmed }),
    }),

  // 3. Services & Processes
  getServicesList: (query = '') => request<{ ok: boolean; services: any[] }>(`/api/services${query ? `?q=${query}` : ''}`),
  controlServiceAction: (name: string, action: 'start' | 'stop' | 'restart') =>
    request<any>('/api/services/control', {
      method: 'POST',
      body: JSON.stringify({ name, action }),
    }),
  getProcessesList: () => request<{ ok: boolean; processes: any[] }>('/api/processes'),
  terminateProcessAction: (pid: number, force = false) =>
    request<any>('/api/processes/terminate', {
      method: 'POST',
      body: JSON.stringify({ pid, force }),
    }),

  // 4. Storage, Volumes, SMB Shares, File Explorer
  getDisks: () => request<{ ok: boolean; disks: any[] }>('/api/storage/disks'),
  getVolumes: () => request<{ ok: boolean; volumes: any[] }>('/api/storage/volumes'),
  getSmbShares: () => request<{ ok: boolean; shares: any[] }>('/api/storage/shares'),
  createSmbShare: (share: { name: string; path: string; description?: string }) =>
    request<any>('/api/storage/shares/create', {
      method: 'POST',
      body: JSON.stringify(share),
    }),
  deleteSmbShare: (name: string) =>
    request<any>('/api/storage/shares/delete', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  browseFiles: (path = 'C:\\') => request<any>(`/api/storage/explorer?path=${encodeURIComponent(path)}`),

  // 5. Network & Firewall
  getNetworkAdapters: () => request<{ ok: boolean; adapters: any[] }>('/api/network/adapters'),
  pingHost: (host: string, count = 4) =>
    request<any>('/api/network/ping', {
      method: 'POST',
      body: JSON.stringify({ host, count }),
    }),
  testTcpPort: (host: string, port: number) =>
    request<any>('/api/network/test-port', {
      method: 'POST',
      body: JSON.stringify({ host, port }),
    }),
  getFirewallStatus: () => request<any>('/api/firewall/status'),
  getFirewallRulesList: () => request<{ ok: boolean; rules: any[] }>('/api/firewall/rules'),
  toggleFirewallRule: (name: string, enabled: boolean) =>
    request<any>('/api/firewall/rules/toggle', {
      method: 'POST',
      body: JSON.stringify({ name, enabled }),
    }),

  // 6. Events, Tasks, Updates, Certificates
  getEventLogs: (logName = 'System') => request<{ ok: boolean; events: any[] }>(`/api/events?log=${logName}`),
  getTasksList: () => request<{ ok: boolean; tasks: any[] }>('/api/tasks'),
  getUpdates: () => request<any>('/api/updates/status'),
  getCertificatesList: () => request<{ ok: boolean; certificates: any[] }>('/api/certificates'),

  // 7. Virtualization & Containers
  getHyperV: () => request<any>('/api/hyperv/status'),
  getDocker: () => request<any>('/api/docker/status'),

  // 8. Developer Workspaces & Projects
  getDeveloperProjects: () => request<{ ok: boolean; projects: any[] }>('/api/workspaces/projects'),
  createDeveloperProject: (params: { name: string; runtime?: string; port?: number }) =>
    request<any>('/api/workspaces/projects/create', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  startDeveloperProject: (project_id: string) =>
    request<any>('/api/workspaces/projects/start', {
      method: 'POST',
      body: JSON.stringify({ project_id }),
    }),
  stopDeveloperProject: (project_id: string) =>
    request<any>('/api/workspaces/projects/stop', {
      method: 'POST',
      body: JSON.stringify({ project_id }),
    }),
  deleteDeveloperProject: (project_id: string) =>
    request<any>('/api/workspaces/projects/delete', {
      method: 'POST',
      body: JSON.stringify({ project_id }),
    }),
  allocatePortProbe: (port?: number, project_name = 'TestProject') =>
    request<any>('/api/ports/allocate', {
      method: 'POST',
      body: JSON.stringify({ port, project_name }),
    }),
  getConflictsList: () => request<{ ok: boolean; conflicts: any[] }>('/api/conflicts'),
  getQuotasConfig: () => request<any>('/api/quotas'),
  saveQuotasConfig: (quotas: any) =>
    request<any>('/api/quotas', {
      method: 'POST',
      body: JSON.stringify(quotas),
    }),
  getActionJobsList: () => request<{ ok: boolean; jobs: any[] }>('/api/action-jobs'),
  getReplayEvents: () =>
    request<{ ok: boolean; events: Array<{ id: string; time: string; event: string; command: string; risk: string; user: string }> }>('/api/replay/events'),

  // 9. Sovereign Database Management & SQL Studio (Story 10)
  getDatabaseEngines: () => request<{ ok: boolean; engines: any[] }>('/api/database/engines'),
  getDatabaseStats: () => request<any>('/api/database/stats'),
  getDatabaseTables: () => request<{ ok: boolean; tables: any[] }>('/api/database/tables'),
  getTableData: (table: string, limit = 50, offset = 0) =>
    request<any>(`/api/database/table-data?table=${encodeURIComponent(table)}&limit=${limit}&offset=${offset}`),
  executeDatabaseQuery: (query: string) =>
    request<any>('/api/database/query', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),
  createDatabaseBackup: (description = 'Manual Snapshot') =>
    request<any>('/api/database/backup', {
      method: 'POST',
      body: JSON.stringify({ description }),
    }),
  getDatabaseBackups: () => request<{ ok: boolean; backups: any[] }>('/api/database/backups'),
  optimizeDatabase: () =>
    request<any>('/api/database/optimize', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
};
