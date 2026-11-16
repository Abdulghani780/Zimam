/**
 * ZIMAM v2.5 - Screen _7
 * إدارة سعة التخزين وتطهير السيرفر وفك أقفال العمليات (Storage & Handle Locks)
 * Strict implementation of Stitch Prototype _7
 */

import { useState, useEffect } from 'react';
import { Card, Button, useToast } from '../zimam-ui';
import { api } from '../lib/api';
import { apiV1 } from '../lib/apiV1';
import {
  HardDrive,
  Sparkles,
  User,
  Trash2,
    Search,
  Lock,
  Unlock,
        Bot,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { t } from '../lib/i18n';

type ResultEntry = { job_id: string; completed_at: string | null; result: unknown; error: string | null };

interface FleetDiskAgent {
  id: string;
  name: string;
  status: string;
  hostname?: string | null;
  linked_asset: { id: string; name: string; hostname: string } | null;
  disk: ResultEntry | null;
}

// Heuristic row extraction for disk.list payloads — falls back to raw JSON.
function diskRows(result: unknown): { label: string; used: number; total: number; pct: number }[] {
  const arr = Array.isArray(result)
    ? result
    : Array.isArray((result as any)?.disks)
      ? (result as any).disks
      : Array.isArray((result as any)?.drives)
        ? (result as any).drives
        : null;
  if (!arr) return [];
  return arr
    .filter((d: unknown) => d && typeof d === 'object')
    .map((d: any) => ({
      label: String(d.drive || d.name || d.device || d.mount || d.letter || '?'),
      used: Number(d.used_gb ?? d.usedGB ?? d.used ?? d.size_used ?? d.pused ?? NaN),
      total: Number(d.total_gb ?? d.totalGB ?? d.total ?? d.size ?? d.psize ?? NaN),
      pct: Number(d.percent ?? d.percent_used ?? d.pcent ?? NaN),
    }));
}

export function StoragePage() {
  const toast = useToast();
  const [breakdown, setBreakdown] = useState<any>(null);
  const [userProfiles, setUserProfiles] = useState<any[]>([]);
  const [cleaningJunk, setCleaningJunk] = useState(false);
  const [cleaningUser, setCleaningUser] = useState<string | null>(null);

  // Locked files diagnostic state (Story 9)
    const [customFilePath, setCustomFilePath] = useState('C:\\Data\\ZIMAM_PROD.mdf');
  const [customCheckResult, setCustomCheckResult] = useState<any>(null);
  const [checkingLock, setCheckingLock] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [fleetDisks, setFleetDisks] = useState<FleetDiskAgent[]>([]);

  const fetchStorage = async () => {
    try {
      const [bd, us, lf, fleetRes] = await Promise.all([
        api.getStorageBreakdown('C'),
        api.getStorageUsers().catch(() => ({ users: [] })),
        api.getLockedFiles().catch(() => ({ locked_files: [] })),
        apiV1.fleetSummary().catch(() => null),
      ]);
      setBreakdown(bd);
      setUserProfiles(Array.isArray(us) ? us : (us as any)?.users || []);
      if (lf && Array.isArray(lf.locked_files)) {
        // lf overview
      }
      if (fleetRes?.agents?.length) {
        const detailed = await Promise.all(
          fleetRes.agents.map(async (ag) => {
            let disk: ResultEntry | null = null;
            const r = await apiV1.agentLatestResults(ag.id).catch(() => null);
            disk = r?.results?.['disk.list'] ?? null;
            return { ...ag, disk };
          }),
        );
        setFleetDisks(detailed);
      } else {
        setFleetDisks([]);
      }
    } catch (err: any) {
      toast(err.message || t('فشل فحص التخزين'), 'error');
    }
  };

  useEffect(() => {
    fetchStorage();
  }, []);

  const handleCleanJunk = async () => {
    setCleaningJunk(true);
    try {
      const res = await api.cleanSystemJunk();
      if (res.ok) {
        toast(`${t('تم تطهير مخلفات السيرفر: تم تحرير ')}${res.reclaimed_mb || 0}${t(' MB بنجاح.')}`, 'success');
        fetchStorage();
      } else {
        toast((res as any).error || t('تعذر استكمال التطهير'), 'error');
      }
    } catch (err: any) {
      toast(err.message || t('خطأ في عملية التطهير'), 'error');
    } finally {
      setCleaningJunk(false);
    }
  };

  const handleCleanUserTemp = async (username: string) => {
    setCleaningUser(username);
    try {
      const res = await api.cleanUserTemp(username);
      if (res.ok) {
        toast(`${t('تم تطهير مجلد المستخدم [')}${username}${t(']: تم استرجاع ')}${res.reclaimed_mb || 0} MB.`, 'success');
        fetchStorage();
      } else {
        toast((res as any).error || t('فشل تنظيف مجلد المستخدم'), 'error');
      }
    } catch (err: any) {
      toast(err.message || t('خطأ'), 'error');
    } finally {
      setCleaningUser(null);
    }
  };

  const handleCheckFileLock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customFilePath.trim()) return;
    setCheckingLock(true);
    setCustomCheckResult(null);
    try {
      const res = await api.checkFileLock(customFilePath.trim());
      setCustomCheckResult(res);
      if (res.is_locked) {
        toast(`${t('الملف مقفول بواسطة ')}${res.lockers_count || 1}${t(' عملية!')}`, 'error');
      } else {
        toast(t('الملف سليم ومتاح للوصول الكامل دون أي أقفال.'), 'success');
      }
    } catch (err: any) {
      toast(err.message || t('فشل فحص قفل الملف'), 'error');
    } finally {
      setCheckingLock(false);
    }
  };

  const handleUnlockProcess = async (pid: number, procName: string) => {
    setUnlocking(true);
    try {
      const res = await api.terminateProcess(pid);
      if (res.ok) {
        toast(`${t('تم فك القفل وإنهاء العملية القافلة [')}${procName}] (PID: ${pid}${t(') بنجاح.')}`, 'success');
        handleCheckFileLock();
      } else {
        toast((res as any).error || t('تعذر إنهاء العملية'), 'error');
      }
    } catch (err: any) {
      toast(err.message || t('خطأ أثناء فك القفل'), 'error');
    } finally {
      setUnlocking(false);
    }
  };

  const totalGb = breakdown?.total_gb ?? 0;
  const usedGb = breakdown?.used_gb ?? 0;
  const freeGb = breakdown?.free_gb ?? 0;
  const usedPct = breakdown?.percent ?? (totalGb > 0 ? Math.round((usedGb / totalGb) * 100) : 0);

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
                <HardDrive size={13} />
                Samsung PM9A3 NVMe Gen4 High-IOPS
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
                NTFS Journaling &amp; Restart Manager v2.5
              </span>
            </div>

            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>
              {t('إدارة سعة التخزين وتطهير السيرفر وفك أقفال العمليات')} (Storage &amp; Handle Locks)
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0, maxWidth: 840, lineHeight: 1.6 }}>
              {t('مراقبة مساحات الأقراص السريعة، تحليل استهلاك مجلدات المستخدمين وقواعد البيانات، وتطهير المخلفات مع كاشف فك أقفال الملفات التلقائي عبر مكتبة ويندوز الأصلية Restart Manager (rstrtmgr.dll).')}
            </p>
          </div>

          <Button
            size="md"
            variant="primary"
            loading={cleaningJunk}
            onClick={handleCleanJunk}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <Sparkles size={16} />
            <span>{t('تطهير شامل لمخلفات السيرفر')}</span>
          </Button>
        </div>
      </div>

      {/* 1b. ZIMAM remote agent disks — real disk.list collector results */}
      {fleetDisks.length > 0 && (
        <Card style={{ padding: 22, border: '1px solid var(--glass-rim)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <HardDrive size={18} style={{ color: 'var(--accent)' }} />
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--text-1)' }}>{t('أقراص وكلاء زِمام')}</h3>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('بيانات disk.list حقيقية من كل وكيل')}</span>
            </div>
            <NavLink to="/agents" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>
              {t('إدارة الوكلاء')} ←
            </NavLink>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {fleetDisks.map((ag) => {
              const rows = ag.disk && !ag.disk.error ? diskRows(ag.disk.result) : [];
              return (
                <div key={ag.id} style={{ border: '1px solid var(--hairline)', borderRadius: 12, padding: '14px 16px', background: 'var(--glass-tint)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
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
                  {!ag.disk ? (
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('لم يُرسل جامع الأقراص بعد — أرسله من صفحة الوكلاء.')}</div>
                  ) : ag.disk.error ? (
                    <div className="text-status-danger" style={{ fontSize: 11 }}>{ag.disk.error}</div>
                  ) : rows.length === 0 ? (
                    <details style={{ fontSize: 11 }}>
                      <summary style={{ cursor: 'pointer', color: 'var(--text-3)' }}>{t('نتيجة غير معروفة — عرض خام')} ({ag.disk.completed_at ? new Date(ag.disk.completed_at).toLocaleString('ar-SA') : '—'})</summary>
                      <pre dir="ltr" style={{ margin: '8px 0 0', fontSize: 10, fontFamily: 'var(--font-telemetry)', color: 'var(--text-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 160, overflowY: 'auto' }}>
                        {JSON.stringify(ag.disk.result, null, 2)}
                      </pre>
                    </details>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {rows.map((d, i) => {
                        const pct = Number.isFinite(d.pct) ? d.pct : (Number.isFinite(d.used) && Number.isFinite(d.total) && d.total > 0 ? (d.used / d.total) * 100 : 0);
                        return (
                          <div key={i}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-2)', marginBottom: 3 }}>
                              <span style={{ fontFamily: 'var(--font-telemetry)', direction: 'ltr' }}>{d.label}</span>
                              <span style={{ color: 'var(--text-3)' }}>
                                {Number.isFinite(d.used) && Number.isFinite(d.total) ? `${d.used.toFixed(0)}/${d.total.toFixed(0)} GB` : pct ? `${pct.toFixed(0)}%` : '—'}
                              </span>
                            </div>
                            <div style={{ height: 5, background: 'var(--hairline)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.min(100, Math.max(2, pct))}%`, background: pct > 90 ? 'var(--unpaid)' : 'var(--accent)' }} />
                            </div>
                          </div>
                        );
                      })}
                      {ag.disk.completed_at && (
                        <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{t('آخر قياس')}: {new Date(ag.disk.completed_at).toLocaleString('ar-SA')}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 2. Primary NVMe Matrix & Breakdown Bar (Stitch _7 L51) */}
      <Card
        title={t('مصفوفة التخزين الأساسية C:\\ (Samsung PM9A3 NVMe Gen4)')}
        icon="dashboard"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font)' }}>
              <span dir="ltr">{usedGb} GB</span> {t('من')} <span dir="ltr">{totalGb} GB</span>
            </span>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 4,
                background: usedPct > 80 ? 'var(--unpaid-bg)' : 'var(--paid-bg)',
                color: usedPct > 80 ? 'var(--unpaid)' : 'var(--paid)',
                fontWeight: 700,
              }}
            >
              <span dir="ltr">{usedPct}%</span> {t('مستخدم')}
            </span>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Partitioned Storage Bar */}
          <div
            style={{
              height: 28,
              borderRadius: 8,
              background: 'var(--glass-rim-low)',
              border: '1px solid var(--glass-rim-low)',
              overflow: 'hidden',
              display: 'flex',
            }}
          >
            {/* Windows OS */}
            <div
              style={{ width: '12%', background: 'var(--chart-out)', height: '100%' }}
              title="Windows OS: 48.2 GB (12%)"
            />
            {/* User Profiles */}
            <div
              style={{ width: '30%', background: 'var(--accent)', height: '100%' }}
              title="User Profiles (C:\Users): 142.6 GB (30%)"
            />
            {/* Database & Apps */}
            <div
              style={{ width: '22%', background: 'var(--paid)', height: '100%' }}
              title="Database & SQL Data: 86.4 GB (22%)"
            />
            {/* Temp & Logs */}
            <div
              style={{ width: '7%', background: 'var(--partial)', height: '100%' }}
              title="Temp & Logs: 18.6 GB (7%)"
            />
            {/* Free Space */}
            <div
              style={{ width: '29%', background: 'var(--glass-rim-low)', height: '100%' }}
              title={t('المساحة الحرة الشاغرة: 137.7 GB (29%)')}
            />
          </div>

          {/* Legend Chips */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--chart-out)' }} />
              <div>
                <span style={{ color: 'var(--text-1)', fontWeight: 700, display: 'block' }}>Windows OS</span>
                <span style={{ color: 'var(--text-3)', fontSize: 11 }} dir="ltr">48.2 GB</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--accent)' }} />
              <div>
                <span style={{ color: 'var(--text-1)', fontWeight: 700, display: 'block' }}>{t('مجلدات المستخدمين')}</span>
                <span style={{ color: 'var(--text-3)', fontSize: 11 }} dir="ltr">142.6 GB</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--paid)' }} />
              <div>
                <span style={{ color: 'var(--text-1)', fontWeight: 700, display: 'block' }}>{t('قواعد البيانات SQL')}</span>
                <span style={{ color: 'var(--text-3)', fontSize: 11 }} dir="ltr">86.4 GB</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--partial)' }} />
              <div>
                <span style={{ color: 'var(--text-1)', fontWeight: 700, display: 'block' }}>{t('المخلفات والملفات المؤقتة')}</span>
                <span style={{ color: 'var(--text-3)', fontSize: 11 }} dir="ltr">18.6 GB</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--glass-rim-low)' }} />
              <div>
                <span style={{ color: 'var(--text-1)', fontWeight: 700, display: 'block' }}>{t('المساحة الحرة')}</span>
                <span style={{ color: 'var(--paid)', fontSize: 11, fontWeight: 700 }} dir="ltr">{freeGb} GB {t('شاغر')}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Locked File Handles & Process Unlocker (Stitch _7 L214) */}
      <Card
        title={t('كاشف ومحرر الملفات وقواعد البيانات المقفولة (Locked File Handles &amp; Process Unlocker)')}
        icon="vault"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0, lineHeight: 1.6 }}>
            {t('استعلام لحظي عن المقابض النشطة (Open File Handles) عبر واجهة ويندوز الأصلية')} <code>rstrtmgr.dll</code> {t('لكشف العمليات التي تمنع حذف أو ترحيل أو نسخ قواعد البيانات وملفات النظام المقفلة مع إمكانية تحريرها فوراً.')}
          </p>

          <form onSubmit={handleCheckFileLock} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={16} color="var(--text-3)" style={{ position: 'absolute', insetInlineStart: 12, top: 12 }} />
              <input
                type="text"
                placeholder={t('أدخل المسار الكامل للملف (مثال: C:\\Data\\ZIMAM_PROD.mdf)...')}
                value={customFilePath}
                onChange={(e) => setCustomFilePath(e.target.value)}
                className="text-input"
                style={{ width: '100%', paddingInlineStart: 38, fontFamily: 'var(--font)' }}
              />
            </div>
            <Button
              type="submit"
              size="md"
              variant="primary"
              loading={checkingLock}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Search size={14} />
              <span>{t('كشف العملية القافلة')}</span>
            </Button>
          </form>

          {/* Diagnostic Result */}
          {customCheckResult && (
            <div
              style={{
                padding: '16px 20px',
                borderRadius: 12,
                background: customCheckResult.is_locked ? 'var(--unpaid-bg)' : 'var(--paid-bg)',
                border: `1px solid ${customCheckResult.is_locked ? 'var(--unpaid-bg)' : 'var(--paid-bg)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {customCheckResult.is_locked ? (
                    <Lock size={18} color="var(--unpaid)" />
                  ) : (
                    <Unlock size={18} color="var(--paid)" />
                  )}
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>
                    {customCheckResult.is_locked
                      ? `${t('الملف مقفول حالياً بواسطة ')}${customCheckResult.lockers_count || 1}${t(' عملية!')}`
                      : t('الملف متاح للوصول وغير مقفول.')}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 9999,
                    background: customCheckResult.is_locked ? 'var(--unpaid-bg)' : 'var(--paid-bg)',
                    color: customCheckResult.is_locked ? 'var(--unpaid)' : 'var(--paid)',
                  }}
                >
                  {customCheckResult.is_locked ? 'LOCKED HANDLE' : 'FREE TO ACCESS'}
                </span>
              </div>

              {customCheckResult.is_locked && customCheckResult.lockers && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  {customCheckResult.lockers.map((locker: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: 8,
                        background: 'var(--shadow-soft)',
                        border: '1px solid var(--glass-rim-low)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-1)' }}>
                          {locker.process_name || locker.name}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font)' }}>
                          PID: {locker.pid}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
                          {t('المستخدم')}: {locker.user || 'NT AUTHORITY\\SYSTEM'}
                        </span>
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        loading={unlocking}
                        onClick={() => handleUnlockProcess(locker.pid, locker.process_name || locker.name)}
                        style={{ padding: '4px 10px', fontSize: 11, color: 'var(--unpaid)' }}
                      >
                        <Unlock size={12} />
                        <span>{t('فك القفل الفوري / إنهاء العملية')}</span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* 4. User Profile Disk Quotas & Folder Telemetry (Stitch _7 L305) */}
      <Card
        title={t('جدول استهلاك مساحات مجلدات المستخدمين (User Profile Disk Quotas)')}
        icon="list"
        actions={
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {t('إجمالي الحسابات المفحوصة')}: {userProfiles.length} {t('مستخدم')}
          </span>
        }
      >
        <div className="table-wrap">
          <table className="app-table">
            <thead>
              <tr>
                <th>{t('اسم المستخدم')}</th>
                <th>{t('مسار المجلد (Profile Path)')}</th>
                <th>{t('إجمالي المساحة المستخدمة')}</th>
                <th>{t('حجم الملفات المؤقتة (Temp)')}</th>
                <th style={{ textAlign: 'end' }}>{t('تطهير مساحة المستخدم')}</th>
              </tr>
            </thead>
            <tbody>
              {userProfiles.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 28, color: 'var(--text-3)' }}>
                    {t('جارٍ حساب مساحات مجلدات المستخدمين...')}
                  </td>
                </tr>
              ) : (
                userProfiles.map((u) => (
                  <tr key={u.username}>
                    <td style={{ fontWeight: 700, color: 'var(--text-1)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <User size={14} color="var(--accent)" />
                        <span>{u.username}</span>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--font)', color: 'var(--text-3)', fontSize: 12 }}>
                      <span dir="ltr">{u.path || '—'}</span>
                    </td>
                    <td style={{ fontFamily: 'var(--font)', fontWeight: 800, color: 'var(--text-1)' }}>
                      <span dir="ltr">{u.total_mb ? `${(u.total_mb / 1024).toFixed(1)} GB` : (u.size_gb ? `${u.size_gb} GB` : '—')}</span>
                    </td>
                    <td style={{ fontFamily: 'var(--font)', color: 'var(--accent)', fontWeight: 700 }}>
                      {u.temp_mb ? `${u.temp_mb} MB` : '—'}
                    </td>
                    <td style={{ textAlign: 'end' }}>
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={cleaningUser === u.username}
                        onClick={() => handleCleanUserTemp(u.username)}
                        style={{ padding: '4px 10px', fontSize: 11 }}
                      >
                        <Trash2 size={12} color="var(--accent)" />
                        <span>{t('تطهير Temp للمستخدم')}</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
