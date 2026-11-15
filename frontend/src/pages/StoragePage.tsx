/**
 * ASAAS Server Control v2.5 - Screen _7
 * إدارة سعة التخزين وتطهير السيرفر وفك أقفال العمليات (Storage & Handle Locks)
 * Strict implementation of Stitch Prototype _7
 */

import { useState, useEffect } from 'react';
import { Card, Button, useToast } from '../asaas-ui';
import { api } from '../lib/api';
import {
  HardDrive,
  Sparkles,
  User,
  Trash2,
    Search,
  Lock,
  Unlock,
        } from 'lucide-react';

export function StoragePage() {
  const toast = useToast();
  const [breakdown, setBreakdown] = useState<any>(null);
  const [userProfiles, setUserProfiles] = useState<any[]>([]);
  const [cleaningJunk, setCleaningJunk] = useState(false);
  const [cleaningUser, setCleaningUser] = useState<string | null>(null);

  // Locked files diagnostic state (Story 9)
    const [customFilePath, setCustomFilePath] = useState('C:\\Data\\ASAAS_PROD.mdf');
  const [customCheckResult, setCustomCheckResult] = useState<any>(null);
  const [checkingLock, setCheckingLock] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const fetchStorage = async () => {
    try {
      const [bd, us, lf] = await Promise.all([
        api.getStorageBreakdown('C'),
        api.getStorageUsers().catch(() => ({ users: [] })),
        api.getLockedFiles().catch(() => ({ locked_files: [] })),
      ]);
      setBreakdown(bd);
      setUserProfiles(Array.isArray(us) ? us : (us as any)?.users || []);
      if (lf && Array.isArray(lf.locked_files)) {
        // lf overview
      }
    } catch (err: any) {
      toast(err.message || 'فشل فحص التخزين', 'error');
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
        toast(`تم تطهير مخلفات السيرفر: تم تحرير ${res.reclaimed_mb || 0} MB بنجاح.`, 'success');
        fetchStorage();
      } else {
        toast((res as any).error || 'تعذر استكمال التطهير', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ في عملية التطهير', 'error');
    } finally {
      setCleaningJunk(false);
    }
  };

  const handleCleanUserTemp = async (username: string) => {
    setCleaningUser(username);
    try {
      const res = await api.cleanUserTemp(username);
      if (res.ok) {
        toast(`تم تطهير مجلد المستخدم [${username}]: تم استرجاع ${res.reclaimed_mb || 0} MB.`, 'success');
        fetchStorage();
      } else {
        toast((res as any).error || 'فشل تنظيف مجلد المستخدم', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ', 'error');
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
        toast(`الملف مقفول بواسطة ${res.lockers_count || 1} عملية!`, 'error');
      } else {
        toast('الملف سليم ومتاح للوصول الكامل دون أي أقفال.', 'success');
      }
    } catch (err: any) {
      toast(err.message || 'فشل فحص قفل الملف', 'error');
    } finally {
      setCheckingLock(false);
    }
  };

  const handleUnlockProcess = async (pid: number, procName: string) => {
    setUnlocking(true);
    try {
      const res = await api.terminateProcess(pid);
      if (res.ok) {
        toast(`تم فك القفل وإنهاء العملية القافلة [${procName}] (PID: ${pid}) بنجاح.`, 'success');
        handleCheckFileLock();
      } else {
        toast((res as any).error || 'تعذر إنهاء العملية', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ أثناء فك القفل', 'error');
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
              إدارة سعة التخزين وتطهير السيرفر وفك أقفال العمليات (Storage &amp; Handle Locks)
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0, maxWidth: 840, lineHeight: 1.6 }}>
              مراقبة مساحات الأقراص السريعة، تحليل استهلاك مجلدات المستخدمين وقواعد البيانات، وتطهير المخلفات مع كاشف فك أقفال
              الملفات التلقائي عبر مكتبة ويندوز الأصلية Restart Manager (rstrtmgr.dll).
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
            <span>تطهير شامل لمخلفات السيرفر</span>
          </Button>
        </div>
      </div>

      {/* 2. Primary NVMe Matrix & Breakdown Bar (Stitch _7 L51) */}
      <Card
        title="مصفوفة التخزين الأساسية C:\ (Samsung PM9A3 NVMe Gen4)"
        icon="dashboard"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font)' }}>
              <span dir="ltr">{usedGb} GB</span> من <span dir="ltr">{totalGb} GB</span>
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
              <span dir="ltr">{usedPct}%</span> مستخدم
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
              title="المساحة الحرة الشاغرة: 137.7 GB (29%)"
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
                <span style={{ color: 'var(--text-1)', fontWeight: 700, display: 'block' }}>مجلدات المستخدمين</span>
                <span style={{ color: 'var(--text-3)', fontSize: 11 }} dir="ltr">142.6 GB</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--paid)' }} />
              <div>
                <span style={{ color: 'var(--text-1)', fontWeight: 700, display: 'block' }}>قواعد البيانات SQL</span>
                <span style={{ color: 'var(--text-3)', fontSize: 11 }} dir="ltr">86.4 GB</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--partial)' }} />
              <div>
                <span style={{ color: 'var(--text-1)', fontWeight: 700, display: 'block' }}>المخلفات والملفات المؤقتة</span>
                <span style={{ color: 'var(--text-3)', fontSize: 11 }} dir="ltr">18.6 GB</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--glass-rim-low)' }} />
              <div>
                <span style={{ color: 'var(--text-1)', fontWeight: 700, display: 'block' }}>المساحة الحرة</span>
                <span style={{ color: 'var(--paid)', fontSize: 11, fontWeight: 700 }} dir="ltr">{freeGb} GB شاغر</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Locked File Handles & Process Unlocker (Stitch _7 L214) */}
      <Card
        title="كاشف ومحرر الملفات وقواعد البيانات المقفولة (Locked File Handles &amp; Process Unlocker)"
        icon="vault"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0, lineHeight: 1.6 }}>
            استعلام لحظي عن المقابض النشطة (Open File Handles) عبر واجهة ويندوز الأصلية <code>rstrtmgr.dll</code> لكشف العمليات
            التي تمنع حذف أو ترحيل أو نسخ قواعد البيانات وملفات النظام المقفلة مع إمكانية تحريرها فوراً.
          </p>

          <form onSubmit={handleCheckFileLock} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={16} color="var(--text-3)" style={{ position: 'absolute', insetInlineStart: 12, top: 12 }} />
              <input
                type="text"
                placeholder="أدخل المسار الكامل للملف (مثال: C:\Data\ASAAS_PROD.mdf)..."
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
              <span>كشف العملية القافلة</span>
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
                      ? `الملف مقفول حالياً بواسطة ${customCheckResult.lockers_count || 1} عملية!`
                      : 'الملف متاح للوصول وغير مقفول.'}
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
                          المستخدم: {locker.user || 'NT AUTHORITY\\SYSTEM'}
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
                        <span>فك القفل الفوري / إنهاء العملية</span>
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
        title="جدول استهلاك مساحات مجلدات المستخدمين (User Profile Disk Quotas)"
        icon="list"
        actions={
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            إجمالي الحسابات المفحوصة: {userProfiles.length} مستخدم
          </span>
        }
      >
        <div className="table-wrap">
          <table className="app-table">
            <thead>
              <tr>
                <th>اسم المستخدم</th>
                <th>مسار المجلد (Profile Path)</th>
                <th>إجمالي المساحة المستخدمة</th>
                <th>حجم الملفات المؤقتة (Temp)</th>
                <th style={{ textAlign: 'end' }}>تطهير مساحة المستخدم</th>
              </tr>
            </thead>
            <tbody>
              {userProfiles.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 28, color: 'var(--text-3)' }}>
                    جارٍ حساب مساحات مجلدات المستخدمين...
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
                        <span>تطهير Temp للمستخدم</span>
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
