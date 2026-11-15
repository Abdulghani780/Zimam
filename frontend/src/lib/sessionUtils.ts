import type { UserSession } from './api';

export interface SessionStatusInfo {
  key: 'active' | 'disconnected' | 'other';
  label: string;
  className: string;
}

function parseLogonDate(value?: string | null): Date | null {
  if (!value) return null;
  const text = value.trim();
  if (!text || text === 'الآن' || text === '—') return null;

  // quser.exe on Windows Server emits M/D/YYYY HH:mm (optionally with seconds).
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const [, month, day, year, hours, minutes, seconds] = match;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds || 0),
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const iso = new Date(text.includes('T') ? text : text.replace(' ', 'T'));
  return Number.isNaN(iso.getTime()) ? null : iso;
}

export function formatSessionDuration(login?: string | null, now: number = Date.now()): string {
  const start = parseLogonDate(login);
  if (!start) return '—';
  const totalSeconds = Math.max(0, Math.floor((now - start.getTime()) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatLoginTimestamp(login?: string | null): string {
  const start = parseLogonDate(login);
  if (!start) return login?.trim() || '—';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())} ${pad(start.getHours())}:${pad(start.getMinutes())}:${pad(start.getSeconds())}`;
}

export function sessionStatus(session: UserSession): SessionStatusInfo {
  const state = (session.state || session.status || '').toLowerCase();
  if (state.includes('active')) {
    return { key: 'active', label: 'نشطة', className: 'pill-status--on' };
  }
  if (state.includes('disc')) {
    return { key: 'disconnected', label: 'خاملة', className: 'pill-status--idle' };
  }
  return { key: 'other', label: 'مستمرة', className: 'pill-status--info' };
}

export function sessionRamLabel(session: UserSession): string {
  if (session.ram_formatted && session.ram_formatted !== '—') return session.ram_formatted;
  if (typeof session.ram_mb === 'number' && session.ram_mb > 0) {
    return session.ram_mb >= 1024
      ? `${(session.ram_mb / 1024).toFixed(2)} GB`
      : `${Math.round(session.ram_mb)} MB`;
  }
  if (typeof session.ram === 'number' && session.ram > 0) {
    return session.ram >= 1 ? `${session.ram.toFixed(2)} GB` : `${Math.round(session.ram * 1024)} MB`;
  }
  return 'أقل من 50 MB';
}

export function sessionProcessCount(session: UserSession): number {
  if (session.processes_count && session.processes_count > 0) return session.processes_count;
  if (session.procs && session.procs > 0) return session.procs;
  return 1;
}

export function sessionIdleLabel(session: UserSession): string {
  return session.idle_time || session.idle_formatted || (session.idle !== null && session.idle !== undefined ? String(session.idle) : 'نشط الآن');
}
