import { useState, useEffect } from 'react';
import { Card, Button, Glass, useToast, TableContainer, Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../asaas-ui';
import { api, type PortItem } from '../lib/api';
import { Search, RefreshCw, ShieldCheck, AlertTriangle, CheckCircle, Zap } from 'lucide-react';

export function PortsPage() {
  const toast = useToast();
  const [ports, setPorts] = useState<PortItem[]>([]);
  const [guardSummary, setGuardSummary] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionPid, setActionPid] = useState<number | null>(null);

  // Port Guard Conflict Checker state
  const [checkPortInput, setCheckPortInput] = useState('3000');
  const [projectNameInput, setProjectNameInput] = useState('');
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [conflictResult, setConflictResult] = useState<any>(null);
  const [claiming, setClaiming] = useState(false);

  const fetchPorts = async (force = false) => {
    setLoading(true);
    try {
      const res = await api.getPorts(force);
      setPorts(Array.isArray(res?.ports) ? res.ports : []);
      if (res?.guard) {
        setGuardSummary(res.guard);
      } else {
        const gRes = await api.getGuardStatus();
        setGuardSummary(gRes);
      }
    } catch (err: any) {
      toast(err.message || 'فشل فحص المنافذ', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPorts();
  }, []);

  const handleCheckConflict = async (e?: React.FormEvent, customPort?: number) => {
    if (e) e.preventDefault();
    const portNum = customPort !== undefined ? customPort : parseInt(checkPortInput, 10);
    if (!portNum || portNum <= 0 || portNum > 65535) {
      toast('يرجى إدخال رقم منفذ صالح بين 1 و 65535', 'error');
      return;
    }
    if (customPort !== undefined) {
      setCheckPortInput(String(customPort));
    }
    setCheckingConflict(true);
    setConflictResult(null);
    try {
      const res = await api.checkPortConflict(portNum);
      setConflictResult(res);
      if (res.available) {
        toast(`المنفذ ${portNum} شاغر وجاهز للاستخدام بعزل كامل!`, 'success');
      } else {
        toast(`المنفذ ${portNum} محجوز! تم اقتراح المنفذ الشاغر ${res.suggested_port}.`, 'error');
      }
    } catch (err: any) {
      toast(err.message || 'فشل فحص المنفذ', 'error');
    } finally {
      setCheckingConflict(false);
    }
  };

  const handleClaimPort = async (targetPort: number) => {
    setClaiming(true);
    try {
      const res = await api.claimPort({
        requested_port: targetPort,
        project_name: projectNameInput || 'مشروع جديد'
      });
      if (res.ok) {
        toast(res.message || `تم حجز وتخصيص المنفذ ${res.assigned_port} بنجاح!`, 'success');
        setConflictResult(null);
        fetchPorts(true);
      } else {
        toast('تعذر حجز المنفذ', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'فشل حجز المنفذ', 'error');
    } finally {
      setClaiming(false);
    }
  };

  const handleReleasePort = async (portToRelease: number) => {
    if (!confirm(`هل أنت متأكد من تحرير حجز المنفذ ${portToRelease} وإتاحته للجميع؟`)) return;
    try {
      const res = await api.releasePort(portToRelease);
      if (res.ok) {
        toast(res.message || `تم تحرير المنفذ ${portToRelease} بنجاح.`, 'success');
        fetchPorts(true);
      } else {
        toast('تعذر تحرير المنفذ', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'فشل تحرير المنفذ', 'error');
    }
  };

  const handleCloseProcess = async (pid: number) => {
    if (!confirm(`هل أنت متأكد من رغبتك في إغلاق العملية المرتبطة بالمنفذ (PID: ${pid})؟`)) return;
    setActionPid(pid);
    try {
      const res = await api.closePortProcess(pid);
      if (res.ok) {
        toast(`تم إغلاق PID ${pid} بنجاح وتحرير المنفذ.`, 'success');
        fetchPorts(true);
      } else {
        toast(res.error || 'فشل إغلاق العملية', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ', 'error');
    } finally {
      setActionPid(null);
    }
  };

  const handleBlockIp = async (ip: string) => {
    if (!ip || ip === '—' || ip === '0.0.0.0' || ip === '127.0.0.1') return;
    if (!confirm(`تحذير: هل ترغب بحظر عنوان الـ IP المتصل (${ip}) عبر جدار حماية ويندوز؟`)) return;
    try {
      const res = await api.blockIp(ip);
      if (res.ok) {
        toast(`تمت إضافة قاعدة حظر في Windows Defender Firewall لـ ${ip}.`, 'success');
        fetchPorts(true);
      } else {
        toast(res.error || 'فشل الحظر', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ', 'error');
    }
  };

  const filteredPorts = ports.filter(
    (p) =>
      String(p.local_port).includes(search) ||
      p.process_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.service_name || p.service || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.owner_user || '').toLowerCase().includes(search.toLowerCase()) ||
      String(p.remote_ip).includes(search)
  );

  const isolatedPortsCount = ports.filter((p) => p.is_isolated && p.owner_session && p.owner_session > 0).length;

  return (
    <div className="page">
      {/* 1. Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <Glass style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>إجمالي اتصالات ومنافذ الشبكة</div>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font)' }}>{ports.length}</div>
          <div style={{ fontSize: 11, color: 'var(--paid)' }}>مراقبة نشطة في الذاكرة الحية</div>
        </Glass>

        <Glass style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>منافذ الاستماع (Listening Ports)</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font)' }}>
            {ports.filter((p) => p.is_listening).length}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>خدمات وتطبيقات جاهزة للاستقبال</div>
        </Glass>

        <Glass style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>منافذ المشاريع المعزولة للمستخدمين</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--paid)', fontFamily: 'var(--font)' }}>
            {guardSummary?.isolated_user_ports_count ?? isolatedPortsCount}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>محمية ضد التداخل بين المستخدمين</div>
        </Glass>

        <Glass style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>حارس العزل التلقائي (Port Guard)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span className="badge badge--success" style={{ fontSize: 13, padding: '4px 12px' }}>
              <ShieldCheck size={14} style={{ marginInlineEnd: 4 }} />
              نشط وتلقائي
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>حماية فورية لمشاريع Node و Python</div>
        </Glass>
      </div>

      {/* 2. Autonomous Port Isolation & Conflict Resolver Banner */}
      <Card
        title="درع الذكاء الاصطناعي لعزل المنافذ ومنع التداخل بين المستخدمين (Port Isolation Guard)"
        icon="vault"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>
            يقوم هذا الدرع الذكي تلقائياً بحجز كل منفذ يبدأ به أي مستخدم مشروعه (مثل منافذ Node و Vite و Django و Next.js من 3000 إلى 9999) وربطه بجلسة المستخدم الخاصة به، مانعاً أي مستخدم آخر من فتح نفس المنفذ أو التداخل مع متصفحه، مع توجيه المستخدمين تلقائياً للمنافذ الشاغرة.
          </p>

          {/* Quick Test Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>فحص سريع لمنافذ التطوير:</span>
            {[
              { p: 3000, label: '3000 (React / Next.js)' },
              { p: 5173, label: '5173 (Vite)' },
              { p: 8000, label: '8000 (Django / FastAPI)' },
              { p: 8080, label: '8080 (Java / Proxy)' },
              { p: 4321, label: '4321 (Astro)' }
            ].map(({ p, label }) => (
              <button
                key={p}
                type="button"
                onClick={() => handleCheckConflict(undefined, p)}
                className="badge"
                style={{
                  cursor: 'pointer',
                  border: '1px solid var(--hairline)',
                  background: checkPortInput === String(p) ? 'var(--accent)' : 'var(--glass-inset)',
                  color: checkPortInput === String(p) ? 'var(--on-accent)' : 'var(--text-2)',
                  fontWeight: 600,
                  fontSize: 12,
                  padding: '4px 10px'
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={(e) => handleCheckConflict(e)} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>المنفذ المستهدف:</span>
              <input
                type="number"
                min="1"
                max="65535"
                value={checkPortInput}
                onChange={(e) => setCheckPortInput(e.target.value)}
                placeholder="مثال: 3000 أو 5173"
                className="text-input"
                style={{ width: 130, fontWeight: 700, fontFamily: 'var(--font)' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>اسم مشروعك (اختياري):</span>
              <input
                type="text"
                value={projectNameInput}
                onChange={(e) => setProjectNameInput(e.target.value)}
                placeholder="مثال: متجر أساس / نظام ERP"
                className="text-input"
                style={{ width: 200, fontSize: 13 }}
              />
            </div>

            <Button
              type="submit"
              size="sm"
              variant="primary"
              loading={checkingConflict}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Zap size={15} />
              <span>فحص الحجز واقتراح بديل شاغر</span>
            </Button>
          </form>

          {conflictResult && (
            <Glass
              style={{
                padding: 18,
                borderInlineStart: conflictResult.available
                  ? '4px solid var(--paid)'
                  : '4px solid var(--partial)',
                background: 'var(--glass-tint-strong)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {conflictResult.available ? (
                    <CheckCircle size={22} color="var(--paid)" />
                  ) : (
                    <AlertTriangle size={22} color="var(--partial)" />
                  )}
                  <span style={{ fontWeight: 800, fontSize: 16 }}>
                    {conflictResult.available
                      ? `المنفذ ${conflictResult.requested_port} شاغر ومتاح تماماً!`
                      : `المنفذ ${conflictResult.requested_port} محجوز لمستخدم آخر!`
                    }
                  </span>
                  <span className={`badge ${conflictResult.available ? 'badge--success' : 'badge--warning'}`}>
                    {conflictResult.available ? 'متاح للعزل والحجز' : 'محجوز ومعزول'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {conflictResult.available ? (
                    <Button
                      size="sm"
                      variant="primary"
                      loading={claiming}
                      onClick={() => handleClaimPort(conflictResult.requested_port)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <ShieldCheck size={14} />
                      <span>حجز المنفذ {conflictResult.requested_port} حصرياً لمشروعي</span>
                    </Button>
                  ) : (
                    conflictResult.suggested_port && (
                      <Button
                        size="sm"
                        variant="primary"
                        loading={claiming}
                        onClick={() => handleClaimPort(conflictResult.suggested_port)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <Zap size={14} />
                        <span>اعتماد المنفذ البديل {conflictResult.suggested_port} فوراً لمشروعي</span>
                      </Button>
                    )
                  )}
                </div>
              </div>

              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                {conflictResult.message}
              </p>

              {!conflictResult.available && conflictResult.suggested_port && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>المنفذ البديل الآمن المقترح:</span>
                  <span className="badge badge--accent" style={{ fontSize: 16, fontWeight: 800, padding: '4px 14px' }}>
                    {conflictResult.suggested_port}
                  </span>
                  {conflictResult.alternatives?.length > 1 && (
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      بدائل شاغرة أخرى: {conflictResult.alternatives.filter((a: number) => a !== conflictResult.suggested_port).join(', ')}
                    </span>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--paid)', fontWeight: 600 }}>
                    💡 أمر التشغيل الموصى به: <code style={{ direction: 'ltr', display: 'inline-block', background: 'var(--shadow-soft)', padding: '2px 6px', borderRadius: 4 }}>PORT={conflictResult.suggested_port} npm run dev</code>
                  </div>
                </div>
              )}
            </Glass>
          )}

          {/* Active Reservations in DB */}
          {guardSummary?.db_reservations && guardSummary.db_reservations.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                📋 جدول الحجوزات النشطة لمشاريع المطورين (Multi-Tenant Leases):
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {guardSummary.db_reservations.map((res: any) => (
                  <Glass key={res.port} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, borderRadius: 'var(--radius-pill)' }}>
                    <span className="badge badge--accent" style={{ fontWeight: 800 }}>{res.port}</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{res.username}</span>
                    {res.project_name && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>({res.project_name})</span>}
                    <button
                      type="button"
                      onClick={() => handleReleasePort(res.port)}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: '2px 4px' }}
                      title="تحرير المنفذ"
                    >
                      تحرير ✕
                    </button>
                  </Glass>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* 3. Ports Radar Table */}
      <Card
        title="كاشف المنافذ والاتصالات والخدمات (Ports & Sockets Radar)"
        icon="collect"
        actions={
          <div className="cluster">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
              <Search size={15} color="var(--text-3)" style={{ position: 'absolute', insetInlineEnd: 10 }} />
              <input
                type="text"
                placeholder="بحث برقم المنفذ أو الخدمة أو العملية أو المستخدم..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-input"
                style={{ width: 280, paddingInlineEnd: 32 }}
              />
            </div>
            <Button
              size="sm"
              variant="ghost"
              loading={loading}
              onClick={() => fetchPorts(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={14} />
              <span>إعادة فحص المنافذ</span>
            </Button>
          </div>
        }
      >
        <TableContainer className="max-h-[540px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المنفذ</TableHead>
                <TableHead>البروتوكول</TableHead>
                <TableHead>العملية (Process)</TableHead>
                <TableHead>PID</TableHead>
                <TableHead>المستخدم المالك وحالة العزل</TableHead>
                <TableHead>خدمة ويندوز / نوع المشروع</TableHead>
                <TableHead>حالة المقبس</TableHead>
                <TableHead>العنوان البعيد</TableHead>
                <TableHead style={{ textAlign: 'end' }}>الإجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPorts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)' }}>
                    لا توجد منافذ مطابقة للبحث حالياً.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPorts.map((p, idx) => (
                  <TableRow key={`${p.local_port}-${p.proto}-${idx}`}>
                    <TableCell>
                      <span className="badge badge--accent" style={{ fontFamily: 'var(--font)', fontWeight: 700 }}>
                        {p.local_port}
                      </span>
                    </TableCell>
                    <TableCell>{p.proto}</TableCell>
                    <TableCell style={{ fontWeight: 600 }}>{p.process_name}</TableCell>
                    <TableCell style={{ fontFamily: 'var(--font)' }}>{p.pid}</TableCell>
                    <TableCell>
                      {p.owner_user && p.owner_user !== 'SYSTEM' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontWeight: 700, color: 'var(--accent)' }}>
                            {p.owner_user}
                          </span>
                          <span className="badge badge--success" style={{ fontSize: 10, alignSelf: 'flex-start' }}>
                            معزول (جلسة #{p.owner_session})
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-3)', fontSize: 12 }}>
                          نظام ويندوز (SYSTEM)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div>{p.service_name || p.service || 'Dynamic'}</div>
                        {p.project_hint && (
                          <span style={{ fontSize: 11, color: 'var(--paid)', fontWeight: 600 }}>
                            {p.project_hint}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`badge ${p.is_listening ? 'badge--success' : 'badge--warning'}`}>
                        {p.status || (p.is_listening ? 'LISTEN' : 'ACTIVE')}
                      </span>
                    </TableCell>
                    <TableCell style={{ fontFamily: 'var(--font)', color: 'var(--text-2)' }}>
                      {p.remote_ip || '—'}
                    </TableCell>
                    <TableCell style={{ textAlign: 'end' }}>
                      <div className="cluster" style={{ justifyContent: 'flex-end', gap: 6 }}>
                        {!p.is_system && p.pid > 4 && (
                          <Button
                            size="sm"
                            variant="danger"
                            loading={actionPid === p.pid}
                            onClick={() => handleCloseProcess(p.pid)}
                          >
                            إنهاء وتحرير
                          </Button>
                        )}
                        {p.is_external && p.remote_ip && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleBlockIp(p.remote_ip)}
                          >
                            حظر IP
                          </Button>
                        )}
                      </div>
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
