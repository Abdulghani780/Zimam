import { useState, useEffect } from 'react';
import { Card, Button, Glass, useToast, TableContainer, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmpty } from '../asaas-ui';
import { useTelemetry } from '../lib/useTelemetry';
import { api, type UserSession } from '../lib/api';
import { SessionDrawer } from '../components/SessionDrawer';
import { BroadcastModal } from '../components/BroadcastModal';
import { CpuHistoryChart } from '../components/CpuHistoryChart';
import { GovernorSettingsModal } from '../components/GovernorSettingsModal';
import { HistoricalMetricsChart } from '../components/HistoricalMetricsChart';
import {
  Cpu,
  Database,
  Users,
  HardDrive,
  Zap,
  ShieldCheck,
  ChevronLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function OverviewPage() {
  const { snapshot, governor, health, refresh } = useTelemetry();
  const toast = useToast();
  const navigate = useNavigate();

  const [selectedSession, setSelectedSession] = useState<UserSession | null>(null);
  const [directMsgSession, setDirectMsgSession] = useState<{ id: number; user: string } | null>(null);
  const [terminatingPid, setTerminatingPid] = useState<number | null>(null);
  const [governorModalOpen, setGovernorModalOpen] = useState(false);

  const host = snapshot?.host;
  const sessions = snapshot?.sessions || [];
  const processes = (snapshot?.processes || []).slice(0, 10);

  // Keep selectedSession live with snapshot updates
  useEffect(() => {
    if (selectedSession) {
      const fresh = sessions.find((s) => s.id === selectedSession.id);
      if (fresh) {
        setSelectedSession(fresh);
      }
    }
  }, [sessions]);

  const handleKillProc = async (pid: number, name: string) => {
    if (!confirm(`هل أنت متأكد من رغبتك في إنهاء العملية ${name} (PID: ${pid})؟`)) return;
    setTerminatingPid(pid);
    try {
      const res = await api.terminateProcess(pid);
      if (res.ok) {
        toast(`تم إنهاء ${name} بنجاح.`, 'success');
        refresh();
      } else {
        toast(res.error || 'فشل إنهاء العملية', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ', 'error');
    } finally {
      setTerminatingPid(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 1. Main Stat Cards */}
      <div className="stat-grid">
        <Glass className="stat-card">
          <div className="stat-card__header">
            <span>استخدام المعالج</span>
            <Cpu size={18} color="var(--accent)" />
          </div>
          <div className="stat-card__value">
            <span dir="ltr">{host?.cpu ?? 0}%</span>
          </div>
          <div className="stat-card__sub">
            <span>{host?.cpuCores || 8} أنوية قياس لحظي</span>
          </div>
        </Glass>

        <Glass className="stat-card">
          <div className="stat-card__header">
            <span>الذاكرة المستخدمة</span>
            <Database size={18} color="var(--accent)" />
          </div>
          <div className="stat-card__value" dir="ltr" style={{ justifyContent: 'flex-start' }}>
            <span>{host?.usedRam ?? 0}</span> <span style={{ fontSize: 16, fontWeight: 500, marginInlineStart: 4 }}>GB</span>
          </div>
          <div className="stat-card__sub">
            <span><span dir="ltr">{host?.ram ?? 0}%</span> من إجمالي <span dir="ltr">{host?.totalRam ?? 64} GB</span></span>
          </div>
        </Glass>

        <Glass className="stat-card">
          <div className="stat-card__header">
            <span>الجلسات النشطة</span>
            <Users size={18} color="var(--accent)" />
          </div>
          <div className="stat-card__value">
            {sessions.length}
          </div>
          <div className="stat-card__sub">
            <span>{sessions.filter((s) => s.status === 'Active').length} متصلة حالياً</span>
          </div>
        </Glass>

        <Glass className="stat-card">
          <div className="stat-card__header">
            <span>التخزين والملفات</span>
            <HardDrive size={18} color="var(--accent)" />
          </div>
          <div className="stat-card__value">
            <span dir="ltr">{host?.disk?.percent ?? 0}%</span>
          </div>
          <div className="stat-card__sub">
            <span><span dir="ltr">{host?.disk?.used ?? 0} GB</span> من <span dir="ltr">{host?.disk?.total ?? 0} GB</span></span>
          </div>
        </Glass>
      </div>

      {/* 2. Resource Governor & JumpServer PAM Banners */}
      <div className="hero-grid">
        <Glass className="hero-banner" style={{ background: 'var(--glass-tint-strong)' }}>
          <div className="hero-banner__content">
            <div className="hero-banner__title">
              <Zap size={20} color="var(--accent)" />
              <span>حاكم الموارد الذكي</span>
              <bdi dir="ltr" style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600 }}>(Resource Governor)</bdi>
              <span className="badge badge--success">
                {governor?.auto_trim ? 'الحاكم: نشط' : 'وضع يدوي'}
              </span>
            </div>
            <div className="hero-banner__desc">
              مكافحة استنزاف الرام والمعالج وسحب الموارد من الحسابات الخاملة وضخها للمستخدم النشط.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ textAlign: 'start' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>المستعاد</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font)' }} dir="ltr">
                {governor?.reclaimed_mb || 0} MB
              </div>
            </div>
            <Button variant="primary" size="sm" onClick={() => setGovernorModalOpen(true)}>
              إعدادات الحاكم
            </Button>
          </div>
        </Glass>

        <Glass className="hero-banner">
          <div className="hero-banner__content">
            <div className="hero-banner__title">
              <ShieldCheck size={20} color="var(--accent)" />
              <span>حصن إدارة الوصول المميز</span>
              <bdi dir="ltr" style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600 }}>(JumpServer PAM)</bdi>
              <span className="badge badge--accent">Zero-Trust</span>
            </div>
            <div className="hero-banner__desc">
              خزنة بيانات اعتماد مشفرة عتادياً ورادار رصد محاولات الاختراق التلقائي وتدقيق الامتثال.
            </div>
          </div>

          <div className="cluster">
            <Button size="sm" variant="glass" onClick={() => navigate('/security')}>
              درع الأمان
            </Button>
            <Button size="sm" variant="glass" onClick={() => navigate('/vault')}>
              خزنة الحسابات
            </Button>
          </div>
        </Glass>
      </div>

      {/* 3. Hardware Cores Matrix & Realtime Wave Oscilloscope */}
      <CpuHistoryChart
        cpuPerCore={host?.cpuPerCore}
        cpuTotal={host?.cpu}
        cpuModel={host?.os}
      />

      {/* 3.1 Historical Telemetry Persistence (24h & 7d - Story 5) */}
      <HistoricalMetricsChart />

      {/* 4. Active RDP User Sessions */}
      <Card
        title="جلسات سطح المكتب النشطة (RDP User Sessions)"
        icon="users"
        actions={
          <div className="cluster">
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
              انقر على أي مستخدم للمشاهدة أو التحكم بالجلسة
            </span>
          </div>
        }
      >
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: 100, textAlign: 'center' }}>معرف الجلسة</TableHead>
                <TableHead style={{ minWidth: 200 }}>اسم المستخدم</TableHead>
                <TableHead style={{ width: 120, textAlign: 'center' }}>الحالة</TableHead>
                <TableHead style={{ width: 130, textAlign: 'center' }}>وقت الخمول (Idle)</TableHead>
                <TableHead style={{ width: 140, textAlign: 'end' }}>الذاكرة المستخدمة</TableHead>
                <TableHead style={{ width: 90, textAlign: 'center' }}>العمليات</TableHead>
                <TableHead style={{ width: 150, textAlign: 'center' }}>وقت الدخول</TableHead>
                <TableHead style={{ width: 130, textAlign: 'end' }}>الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.length === 0 ? (
                <TableEmpty colSpan={8} message="لا توجد جلسات مستخدمين نشطة حالياً." />
              ) : (
                sessions.map((s) => (
                  <TableRow
                    key={s.id}
                    tabIndex={0}
                    onClick={() => setSelectedSession(s)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedSession(s);
                      }
                    }}
                    className="cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                    aria-label={`جلسة ${s.user} رقم ${s.id}`}
                  >
                    <TableCell style={{ width: 100, textAlign: 'center' }}>
                      <span className="badge badge--accent font-telemetry">#{s.id}</span>
                    </TableCell>
                    <TableCell style={{ minWidth: 200 }}>
                      <div className="flex items-center gap-2.5">
                        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(212, 160, 23, 0.4)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(212, 160, 23, 0.1)', color: '#d4a017', flexShrink: 0, fontSize: 12, fontWeight: 700 }}>
                          {s.user.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-title" style={{ color: '#f0ede6' }}>{s.user}</span>
                            {s.is_current && (
                              <span
                                style={{
                                  whiteSpace: 'nowrap',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '2px 8px',
                                  borderRadius: 9999,
                                  fontSize: 10,
                                  fontWeight: 800,
                                  backgroundColor: 'var(--accent, #d4a017)',
                                  color: '#000',
                                }}
                              >
                                أنت هنا
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted" style={{ color: '#8a8478' }}>{s.station || 'RDP'}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell style={{ width: 120, textAlign: 'center' }}>
                      <span className={`badge ${s.status === 'Active' ? 'badge--success' : 'badge--danger'}`}>
                        {s.status === 'Active' ? 'نشطة' : 'منفصلة (Disc)'}
                      </span>
                    </TableCell>
                    <TableCell style={{ width: 130, textAlign: 'center' }} className="font-telemetry text-muted text-xs">
                      {s.idle_time || (s as any).idle_formatted || (s.idle !== null && s.idle !== undefined ? String(s.idle) : 'نشط الآن')}
                    </TableCell>
                    <TableCell style={{ width: 140, textAlign: 'end' }} className="font-telemetry font-bold text-title">
                      <span dir="ltr" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {s.ram_formatted || (s.ram_mb ? (s.ram_mb >= 1024 ? `${(s.ram_mb / 1024).toFixed(2)} GB` : `${Math.round(s.ram_mb)} MB`) : s.ram ? `${s.ram} GB` : '—')}
                      </span>
                    </TableCell>
                    <TableCell style={{ width: 90, textAlign: 'center' }} className="font-telemetry text-title">
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{s.processes_count || s.procs || 0}</span>
                    </TableCell>
                    <TableCell style={{ width: 150, textAlign: 'center' }} className="text-xs text-muted font-telemetry">
                      <span dir="ltr">{s.login_time || s.login || 'الآن'}</span>
                    </TableCell>
                    <TableCell style={{ width: 130, textAlign: 'end' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedSession(s)}
                          className="text-xs px-2.5"
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          تفاصيل الجلسة
                          <ChevronLeft size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* 5. Top Resource Processes */}
      <Card title="أعلى العمليات استهلاكاً للذاكرة (Active Processes)" icon="list">
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: 90, textAlign: 'start' }}>PID</TableHead>
                <TableHead style={{ minWidth: 200, textAlign: 'start' }}>اسم العملية</TableHead>
                <TableHead style={{ minWidth: 160, textAlign: 'start' }}>المستخدم / الجلسة</TableHead>
                <TableHead style={{ width: 140, textAlign: 'end' }}>الذاكرة (RAM)</TableHead>
                <TableHead style={{ width: 110, textAlign: 'end' }}>إنهاء العملية</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processes.length === 0 ? (
                <TableEmpty colSpan={5} message="جارٍ حصر العمليات..." />
              ) : (
                processes.map((p) => (
                  <TableRow key={p.pid}>
                    <TableCell style={{ width: 90, textAlign: 'start' }} className="font-telemetry font-semibold text-muted">
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{p.pid}</span>
                    </TableCell>
                    <TableCell style={{ minWidth: 200, textAlign: 'start' }} className="font-bold text-title">
                      <span style={{ color: '#f0ede6', fontWeight: 700 }}>{p.name}</span>
                    </TableCell>
                    <TableCell style={{ minWidth: 160, textAlign: 'start' }} className="text-muted text-xs">
                      <span style={{ color: '#8a8478' }}>{p.user} (جلسة #{p.session})</span>
                    </TableCell>
                    <TableCell style={{ width: 140, textAlign: 'end' }} className="font-telemetry font-bold text-primary">
                      <span dir="ltr" style={{ fontVariantNumeric: 'tabular-nums', color: '#d4a017' }}>
                        {(p as any).ram_mb ? (
                          (p as any).ram_mb >= 1024
                            ? `${((p as any).ram_mb / 1024).toFixed(1)} GB`
                            : `${(p as any).ram_mb} MB`
                        ) : p.ram ? (
                          p.ram >= 1
                            ? `${p.ram.toFixed(1)} GB`
                            : `${Math.round(p.ram * 1024)} MB`
                        ) : '—'}
                      </span>
                    </TableCell>
                    <TableCell style={{ width: 110, textAlign: 'end' }}>
                      <Button
                        size="sm"
                        variant="danger"
                        loading={terminatingPid === p.pid}
                        onClick={() => handleKillProc(p.pid, p.name)}
                        className="text-xs px-3"
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        إنهاء
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Drawers and Dialogs */}
      <SessionDrawer
        session={selectedSession}
        isAdmin={health?.is_admin ?? false}
        onClose={() => setSelectedSession(null)}
        onSendMessage={(sid, user) => {
          setSelectedSession(null);
          setDirectMsgSession({ id: sid, user });
        }}
        onRefresh={refresh}
        onRequestElevation={async () => {
          try {
            const res = await api.requestElevation();
            toast(res.message || 'تم إرسال طلب الترقية كمسؤول.', 'success');
          } catch (e: any) {
            toast(e.message || 'فشل الترقية', 'error');
          }
        }}
      />

      <GovernorSettingsModal open={governorModalOpen} onClose={() => setGovernorModalOpen(false)} onSaved={refresh} />

      {directMsgSession && (
        <BroadcastModal
          open={true}
          onClose={() => setDirectMsgSession(null)}
          targetSessionId={directMsgSession.id}
          targetUser={directMsgSession.user}
        />
      )}
    </div>
  );
}
