/**
 * ASAAS Server Control v2 - Core API DTO Interfaces.
 * Strictly synchronized with backend/app/domain/models.py.
 */

export interface UserSessionDto {
  session_id: number;
  sessionId?: number;
  id?: number;
  username: string;
  user?: string;
  state: string;
  status?: string;
  win_station: string;
  station?: string;
  ip_address: string;
  client_name: string;
  idle_time_seconds: number;
  idle_formatted: string;
  logon_time: string;
  login?: string;
  ram_mb: number;
  ram?: number;
  cpu_percent: number;
  cpu?: number;
  process_count: number;
  procs?: number;
}

export interface LocalUserDto {
  username: string;
  name?: string;
  full_name: string;
  fullName?: string;
  is_active: boolean;
  is_admin: boolean;
  isAdmin?: boolean;
  is_rdp: boolean;
  isRdp?: boolean;
  session_id: number | null;
  active_session_id?: number | null;
}

export interface StorageBreakdownDto {
  drive_letter: string;
  drive?: string;
  total_gb: number;
  used_gb: number;
  free_gb: number;
  percent_used: number;
  percent?: number;
}

export interface UserProfileStorageDto {
  username: string;
  user?: string;
  profile_path: string;
  path?: string;
  size_mb: number;
  sizeMb?: number;
  temp_mb: number;
  tempMb?: number;
}

export interface ManagedAssetDto {
  id: string;
  name: string;
  host: string;
  address?: string;
  port: number;
  protocol: 'ssh' | 'rdp' | 'telnet' | 'vnc' | 'winrm' | 'mysql' | 'postgres' | 'k8s' | string;
  type?: string;
  username: string;
  auth_mode: 'password' | 'private_key' | 'certificate' | 'token' | string;
  status: 'online' | 'offline' | 'unreachable' | string;
  latency_ms: number;
  is_local: boolean;
}

export interface HostMetricsDto {
  cpu_percent: number;
  cpu_cores: number[];
  total_ram_gb: number;
  used_ram_gb: number;
  free_ram_gb: number;
  ram_percent: number;
  uptime_seconds: number;
  uptime_human: string;
  os_name: string;
  hostname: string;
  active_sessions: UserSessionDto[];
  total_users_count: number;
}

export interface CpuHistoryDto {
  timestamps: string[];
  cores: Record<number, number[]>;
  core_count: number;
  physical_cores: number;
}

export interface HealthCheckDto {
  ok: boolean;
  status: string;
  version: string;
  is_admin: boolean;
  session_token: string;
}

export interface PortClaimDto {
  port: number;
  assigned_to_user: string;
  service_name: string;
  claimed_at: string;
  is_active: boolean;
}
