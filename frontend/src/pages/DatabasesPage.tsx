/**
 * ASAAS Enterprise v3.0 - Sovereign Windows Server Management
 * Domain 10: Database Management & Sovereign SQL Studio (إدارة واستكشاف قواعد البيانات)
 * Zero-Mock Production with Real Windows SQL Server, PostgreSQL, and SQLite Engine
 */

import { useState, useEffect } from 'react';
import { Card, Button, Modal, TextInput, Segmented, useToast } from '../asaas-ui';
import { api } from '../lib/api';
import { apiV1 } from '../lib/apiV1';
import { NavLink } from 'react-router-dom';
import {
  Database,
  Table,
  Terminal,
  Save,
  Wrench,
  CheckCircle2,
  Play,
  RotateCw,
  HardDrive,
  Layers,
  ShieldCheck,
  Server,
  Bot,
} from 'lucide-react';
import { t } from '../lib/i18n';

export function DatabasesPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'tables' | 'query' | 'backups' | 'engines'>('tables');
  const [loading, setLoading] = useState(false);

  // Stats & Engines
  const [stats, setStats] = useState<any>(null);
  const [engines, setEngines] = useState<any[]>([]);

  // Tables & Data Explorer
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('app_users');
  const [tableData, setTableData] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [pageOffset, setPageOffset] = useState(0);
  const pageSize = 25;

  // SQL Studio
  const [sqlQuery, setSqlQuery] = useState<string>('SELECT * FROM app_users;');
  const [queryResult, setQueryResult] = useState<any>(null);
  const [executingQuery, setExecutingQuery] = useState(false);

  // Backups
  const [backups, setBackups] = useState<any[]>([]);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [backupDesc, setBackupDesc] = useState('');
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  // Remote agent DB engines — derived from real service.list/process.list collectors.
  const [fleetDbs, setFleetDbs] = useState<any[]>([]);

  const DB_PATTERN = /mssql|mysql|postgres|mongo|redis|oracle|mariadb|sql ?server|db2|elastic|cassandra|couch|influx/i;

  const fetchFleetDbs = async () => {
    try {
      const fleetRes = await apiV1.fleetSummary();
      if (!fleetRes?.agents?.length) { setFleetDbs([]); return; }
      const detailed = await Promise.all(
        fleetRes.agents.map(async (ag) => {
          const r = await apiV1.agentLatestResults(ag.id).catch(() => null);
          const svcEntry = r?.results?.['service.list'] ?? null;
          const procEntry = r?.results?.['process.list'] ?? null;
          const rowsOf = (e: any) => {
            const raw = e && !e.error ? e.result : null;
            const src = Array.isArray(raw) ? raw : ((raw as any)?.services ?? (raw as any)?.items ?? (raw as any)?.processes ?? []);
            return Array.isArray(src) ? src.filter((x: any) => x && typeof x === 'object') : [];
          };
          const svcs = rowsOf(svcEntry).filter((s: any) =>
            DB_PATTERN.test(String(s.Name ?? s.name ?? s.DisplayName ?? s.display_name ?? '')));
          const procs = rowsOf(procEntry).filter((p: any) =>
            DB_PATTERN.test(String(p.Name ?? p.name ?? p.ProcessName ?? '')));
          return { id: ag.id, name: ag.name, hostname: ag.hostname, status: ag.status, svcs, procs, hasData: !!(svcEntry || procEntry) };
        }),
      );
      setFleetDbs(detailed);
    } catch {
      setFleetDbs([]);
    }
  };

  useEffect(() => {
    fetchFleetDbs();
  }, []);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const [statsRes, engRes, tablesRes, backupsRes] = await Promise.all([
        api.getDatabaseStats().catch(() => null),
        api.getDatabaseEngines().catch(() => ({ ok: false, engines: [] })),
        api.getDatabaseTables().catch(() => ({ ok: false, tables: [] })),
        api.getDatabaseBackups().catch(() => ({ ok: false, backups: [] })),
      ]);

      if (statsRes?.ok) setStats(statsRes);
      setEngines(engRes?.engines || []);
      const tblList = tablesRes?.tables || [];
      setTables(tblList);
      if (tblList.length > 0 && !selectedTable) {
        setSelectedTable(tblList[0].name);
      }
      setBackups(backupsRes?.backups || []);
    } catch (err: any) {
      toast(err.message || t('فشل جلب بيانات محركات قواعد البيانات'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchTableContent = async (tblName: string, offset = 0) => {
    if (!tblName) return;
    setLoadingData(true);
    try {
      const res = await api.getTableData(tblName, pageSize, offset);
      if (res.ok) {
        setTableData(res);
        setPageOffset(offset);
      } else {
        toast(res.error || t('فشل جلب سجلات الجدول'), 'error');
      }
    } catch (err: any) {
      toast(err.message || t('خطأ أثناء قراءة الجدول'), 'error');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      fetchTableContent(selectedTable, 0);
    }
  }, [selectedTable]);

  const handleExecuteQuery = async (queryToRun?: string) => {
    const q = (queryToRun || sqlQuery).trim();
    if (!q) {
      toast(t('يرجى كتابة استعلام SQL صالح'), 'error');
      return;
    }
    setExecutingQuery(true);
    try {
      const res = await api.executeDatabaseQuery(q);
      if (res.ok) {
        setQueryResult(res);
        toast(res.is_select ? `${t('تم جلب ')}${res.row_count}${t(' صف في ')}${res.duration_ms}ms` : res.message, 'success');
        if (!res.is_select) {
          fetchOverview();
          if (selectedTable) fetchTableContent(selectedTable, pageOffset);
        }
      } else {
        setQueryResult(null);
        toast(res.error || t('فشل تنفيذ استعلام SQL'), 'error');
      }
    } catch (err: any) {
      setQueryResult(null);
      toast(err.message || t('خطأ في معالجة الاستعلام'), 'error');
    } finally {
      setExecutingQuery(false);
    }
  };

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    try {
      const res = await api.createDatabaseBackup(backupDesc || t('نسخة احتياطية يدوية'));
      if (res.ok) {
        toast(`${t('تم إنشاء النسخة الاحتياطية [')}${res.filename}${t('] بنجاح (')}${res.size_mb} MB)`, 'success');
        setBackupModalOpen(false);
        setBackupDesc('');
        const bRes = await api.getDatabaseBackups();
        setBackups(bRes?.backups || []);
      } else {
        toast(res.error || t('فشل أخذ النسخة الاحتياطية'), 'error');
      }
    } catch (err: any) {
      toast(err.message || t('خطأ أثناء إنشاء النسخة الاحتياطية'), 'error');
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleOptimizeDb = async () => {
    setOptimizing(true);
    try {
      const res = await api.optimizeDatabase();
      if (res.ok) {
        toast(res.message, 'success');
        fetchOverview();
      } else {
        toast(res.error || t('فشل تحسين قاعدة البيانات'), 'error');
      }
    } catch (err: any) {
      toast(err.message || t('خطأ أثناء تحسين قاعدة البيانات'), 'error');
    } finally {
      setOptimizing(false);
    }
  };

  const quickQueries = [
    { label: t('حسابات مديري النظام'), sql: 'SELECT id, username, role, full_name, is_active, created_at FROM app_users;' },
    { label: t('أحدث سجلات تدقيق الأمان'), sql: 'SELECT id, timestamp, event_type, client_ip, severity, details FROM security_audit_events ORDER BY id DESC LIMIT 15;' },
    { label: t('الخوادم المسجلة بالمنظومة'), sql: 'SELECT * FROM servers;' },
    { label: t('بيئات ومشاريع المطورين'), sql: 'SELECT id, name, runtime, port, status, created_at FROM developer_projects;' },
    { label: t('صلاحيات JIT المؤقتة'), sql: 'SELECT id, user, role, granted_at, expires_at, status, reason FROM jit_grants;' },
  ];

  return (
    <div className="page">
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'var(--accent)',
                color: 'var(--on-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--accent-glow)',
              }}
            >
              <Database size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--text-1)' }}>
                {t('إدارة محركات وقواعد البيانات السيادية (Database Studio)')}
              </h1>
              <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '2px 0 0' }}>
                {t('مراقبة محركات SQL Server وPostgreSQL، استكشاف الجداول، محرر SQL مباشر، والنسخ الاحتياطي المشفر')}
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Button
            variant="ghost"
            onClick={fetchOverview}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
            {t('تحديث المؤشرات')}
          </Button>
          <Button
            variant="primary"
            onClick={() => setBackupModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Save size={14} />
            {t('أخذ نسخة احتياطية فورية')}
          </Button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 14,
          marginBottom: 20,
        }}
      >
        <Card style={{ padding: 14, borderRight: '4px solid var(--status-safe)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{t('سلامة قاعدة البيانات')}</span>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--status-safe)', marginTop: 4 }}>
                {stats?.integrity_status || t('سليم (OK)')}
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-2)' }}>{t('وضع المعاملات')}: {stats?.journal_mode || 'WAL'}</span>
            </div>
            <ShieldCheck size={22} style={{ color: 'var(--status-safe)' }} />
          </div>
        </Card>

        <Card style={{ padding: 14, borderRight: '4px solid var(--accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{t('حجم التخزين الفعلي')}</span>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', marginTop: 4 }}>
                {stats?.file_size_mb || 0} MB
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-2)' }}>{stats?.total_tables || 0} {t('جدولاً هيكلياً')}</span>
            </div>
            <HardDrive size={22} style={{ color: 'var(--accent)' }} />
          </div>
        </Card>

        <Card style={{ padding: 14, borderRight: '4px solid var(--status-info)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{t('إجمالي السجلات الحية')}</span>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', marginTop: 4 }}>
                {stats?.total_records?.toLocaleString() || 0}
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-2)' }}>{t('سجل موثق تشفيرياً')}</span>
            </div>
            <Layers size={22} style={{ color: 'var(--status-info)' }} />
          </div>
        </Card>

        <Card style={{ padding: 14, borderRight: '4px solid var(--status-warning)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{t('المحركات المكتشفة بالسيرفر')}</span>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', marginTop: 4 }}>
                {engines.length} {t('محركات')}
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-2)' }}>SQL Server / Postgres / SQLite</span>
            </div>
            <Server size={22} style={{ color: 'var(--status-warning)' }} />
          </div>
        </Card>
      </div>

      {/* ASAAS remote agent DB engines — derived from real service/process collectors */}
      {fleetDbs.length > 0 && (
        <Card style={{ padding: 22, border: '1px solid var(--glass-rim)', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Database size={18} style={{ color: 'var(--accent)' }} />
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--text-1)' }}>{t('محركات قواعد البيانات على وكلاء أساس')}</h3>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('مُشتقة من service.list و process.list الحقيقية — خدمات وعمليات قواعد البيانات فقط')}</span>
            </div>
            <NavLink to="/agents" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>
              {t('إدارة الوكلاء')} ←
            </NavLink>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {fleetDbs.map((ag) => (
              <div key={ag.id} style={{ border: '1px solid var(--hairline)', borderRadius: 12, padding: '14px 16px', background: 'var(--glass-tint)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Bot size={15} style={{ color: 'var(--accent)' }} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{ag.name}</span>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: ag.status === 'online' ? 'var(--paid-bg)' : 'var(--surface-glass-tint)', color: ag.status === 'online' ? 'var(--paid)' : 'var(--text-3)' }}>
                    {ag.status}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-telemetry)', direction: 'ltr', textAlign: 'left', marginBottom: 10 }}>
                  {ag.hostname || ag.id.slice(0, 8)}
                  {ag.hasData ? ` · ${ag.svcs.length} ${t('خدمة DB')} · ${ag.procs.length} ${t('عملية DB')}` : ''}
                </div>
                {!ag.hasData ? (
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('لم تُرسل قياسات الخدمات/العمليات بعد — أرسلها من صفحة الوكلاء.')}</div>
                ) : ag.svcs.length + ag.procs.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('لا خدمات أو عمليات قواعد بيانات مكتشفة على هذا الوكيل.')}</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                    {ag.svcs.slice(0, 15).map((s: any, i: number) => (
                      <div key={`s${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 10, padding: '4px 8px', borderRadius: 6, background: 'var(--surface-ground)' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'left' }}>
                          {String(s.Name ?? s.name ?? s.DisplayName ?? s.display_name ?? '?')}
                        </span>
                        <span style={{ color: /run|active/i.test(String(s.Status ?? s.status ?? '')) ? 'var(--paid)' : 'var(--unpaid)', flexShrink: 0 }}>
                          {String(s.Status ?? s.status ?? '')}
                        </span>
                      </div>
                    ))}
                    {ag.procs.slice(0, 10).map((p: any, i: number) => (
                      <div key={`p${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 10, padding: '4px 8px', borderRadius: 6, background: 'var(--surface-glass-tint)' }}>
                        <span style={{ color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'left' }}>
                          ⚙ {String(p.Name ?? p.name ?? p.ProcessName ?? '?')}
                        </span>
                        <span style={{ color: 'var(--text-3)', flexShrink: 0 }}>PID {String(p.Id ?? p.pid ?? p.ProcessId ?? '')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Navigation Tabs */}
<Segmented
value={activeTab}
onChange={setActiveTab}
label={t('أقسام قواعد البيانات')}
options={[
{ value: 'tables', label: t('مستكشف الجداول والبيانات'), count: tables.length },
{ value: 'query', label: t('محرر استعلامات SQL المباشر (Console)') },
{ value: 'backups', label: t('النسخ الاحتياطية والصيانة'), count: backups.length },
{ value: 'engines', label: t('محركات قواعد البيانات بالسيرفر') },
]}
/>


      {/* Tab 1: Tables & Data Explorer */}
      {activeTab === 'tables' && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
          {/* Tables Sidebar List */}
          <Card style={{ padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>{t('قائمة الجداول')}</span>
              <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>{tables.length} {t('جداول')}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 600, overflowY: 'auto' }}>
              {tables.map((tbl) => {
                const isSelected = selectedTable === tbl.name;
                return (
                  <button
                    key={tbl.name}
                    type="button"
                    onClick={() => setSelectedTable(tbl.name)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      background: isSelected ? 'var(--glass-tint-strong)' : 'transparent',
                      border: isSelected ? '1px solid var(--accent)' : '1px solid transparent',
                      cursor: 'pointer',
                      textAlign: 'start',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <Table size={14} style={{ color: isSelected ? 'var(--accent)' : 'var(--text-3)', flexShrink: 0 }} />
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: isSelected ? 700 : 500,
                          color: isSelected ? 'var(--text-1)' : 'var(--text-2)',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {tbl.name}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: 'var(--glass-rim)',
                        color: 'var(--text-3)',
                        flexShrink: 0,
                      }}
                    >
                      {tbl.row_count}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Table Data Viewer */}
          <Card style={{ padding: 14 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: 12,
                borderBottom: '1px solid var(--glass-rim-low)',
                marginBottom: 12,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)' }}>{t('جدول')}: {selectedTable}</span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: 'var(--glass-tint)',
                      color: 'var(--accent)',
                      fontWeight: 700,
                    }}
                  >
                    {tableData?.total || 0} {t('سجل')}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {t('عرض الصفوف من')} {pageOffset + 1} {t('إلى')} {Math.min(pageOffset + pageSize, tableData?.total || 0)}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => fetchTableContent(selectedTable, pageOffset)}
                  disabled={loadingData}
                >
                  <RotateCw size={13} className={loadingData ? 'animate-spin' : ''} />
                  {t('تحديث')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pageOffset === 0 || loadingData}
                  onClick={() => fetchTableContent(selectedTable, Math.max(0, pageOffset - pageSize))}
                >
                  {t('السابق')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pageOffset + pageSize >= (tableData?.total || 0) || loadingData}
                  onClick={() => fetchTableContent(selectedTable, pageOffset + pageSize)}
                >
                  {t('التالي')}
                </Button>
              </div>
            </div>

            {/* Render Columns & Rows */}
            {tableData?.rows && tableData.rows.length > 0 ? (
              <div style={{ overflowX: 'auto', maxHeight: 520 }}>
                <table className="table" style={{ width: '100%', fontSize: 11 }}>
                  <thead>
                    <tr>
                      {tableData.columns.map((col: string) => (
                        <th key={col} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.rows.map((row: any, rIdx: number) => (
                      <tr key={rIdx}>
                        {tableData.columns.map((col: string) => {
                          const val = row[col];
                          const strVal = val === null || val === undefined ? 'NULL' : String(val);
                          return (
                            <td
                              key={col}
                              style={{
                                padding: '6px 10px',
                                maxWidth: 240,
                                textOverflow: 'ellipsis',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                fontFamily: typeof val === 'number' || col.includes('id') || col.includes('hash') ? 'monospace' : 'inherit',
                                color: val === null ? 'var(--text-3)' : 'var(--text-1)',
                              }}
                              title={strVal}
                            >
                              {strVal}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
                {t('لا توجد سجلات في هذا الجدول حتى الآن.')}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab 2: SQL Query Console */}
      {activeTab === 'query' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Quick Queries Bar */}
          <Card style={{ padding: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>
              {t('نماذج استعلام سريعة وجاهزة:')}
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {quickQueries.map((qq, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSqlQuery(qq.sql);
                    handleExecuteQuery(qq.sql);
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 4,
                    background: 'var(--glass-tint)',
                    border: '1px solid var(--glass-rim-low)',
                    color: 'var(--text-1)',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {qq.label}
                </button>
              ))}
            </div>
          </Card>

          {/* SQL Editor Area */}
          <Card style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Terminal size={15} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{t('محرر استعلامات SQL (Live Sovereign Engine)')}</span>
              </div>
              <Button
                variant="primary"
                onClick={() => handleExecuteQuery()}
                loading={executingQuery}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Play size={13} />
                {t('تشغيل الاستعلام (F5)')}
              </Button>
            </div>

            <textarea
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              placeholder={t('اكتب استعلام SQL هنا (مثال: SELECT * FROM app_users WHERE is_active = 1;)')}
              rows={4}
              style={{
                width: '100%',
                background: 'var(--glass-inset)',
                color: 'var(--text)',
                fontFamily: 'monospace',
                fontSize: 13,
                padding: 12,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--glass-rim)',
                resize: 'vertical',
                outline: 'none',
                direction: 'ltr',
              }}
            />
          </Card>

          {/* Query Result Grid */}
          {queryResult && (
            <Card style={{ padding: 14 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                  paddingBottom: 8,
                  borderBottom: '1px solid var(--glass-rim-low)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckCircle2 size={16} style={{ color: 'var(--status-safe)' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>
                    {t('نتائج الاستعلام')} ({queryResult.row_count || queryResult.affected_rows || 0})
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    {t('استغرق')}: {queryResult.duration_ms} {t('مللي ثانية')}
                  </span>
                </div>
              </div>

              {queryResult.is_select && queryResult.rows && queryResult.rows.length > 0 ? (
                <div style={{ overflowX: 'auto', maxHeight: 420 }}>
                  <table className="table" style={{ width: '100%', fontSize: 11 }}>
                    <thead>
                      <tr>
                        {queryResult.columns.map((c: string) => (
                          <th key={c} style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {queryResult.rows.map((r: any[], rIdx: number) => (
                        <tr key={rIdx}>
                          {r.map((val: any, cIdx: number) => (
                            <td
                              key={cIdx}
                              style={{
                                padding: '6px 10px',
                                fontFamily: 'monospace',
                                color: val === 'NULL' ? 'var(--text-3)' : 'var(--text-1)',
                              }}
                            >
                              {val}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-2)', fontSize: 12 }}>
                  {queryResult.message || t('لا توجد بيانات مطابقة للاستعلام.')}
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Tab 3: Backups & Maintenance */}
      {activeTab === 'backups' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Action Header Card */}
          <Card style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-1)' }}>
                  {t('النسخ الاحتياطي والصيانة التلقائية')}
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '4px 0 0' }}>
                  {t('توليد نسخ احتياطية فيزيائية فورية، حساب التواقيع التشفيرية SHA-256، وتحرير مساحة التخزين عبر VACUUM')}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <Button
                  variant="secondary"
                  onClick={handleOptimizeDb}
                  loading={optimizing}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Wrench size={14} />
                  {t('تحسين وفهرسة (Optimize & VACUUM)')}
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setBackupModalOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Save size={14} />
                  {t('إنشاء نسخة احتياطية جديدة')}
                </Button>
              </div>
            </div>
          </Card>

          {/* Existing Backups List */}
          <Card style={{ padding: 14 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12 }}>
              {t('أرشيف النسخ الاحتياطية المتاحة')} ({backups.length})
            </h4>

            {backups.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {backups.map((b, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'var(--glass-tint)',
                      border: '1px solid var(--glass-rim-low)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Save size={18} style={{ color: 'var(--accent)' }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{b.filename}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'monospace' }}>
                          {t('المسار')}: {b.path}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: 'var(--glass-rim)',
                          color: 'var(--text-1)',
                        }}
                      >
                        {b.size_mb} MB
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{b.modified_at}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
                {t('لم يتم تسجيل أي نسخ احتياطية بعد. اضغط على الزر أعلاه لإنشاء نسخة احتياطية فورية.')}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab 4: Discovered SQL Server Engines */}
      {activeTab === 'engines' && (
        <Card style={{ padding: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-1)' }}>
            {t('محركات قواعد البيانات النشطة على Windows Server')}
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 16px' }}>
            {t('فحص خدمات النظام والعمليات لاكتشاف خدمات Microsoft SQL Server، PostgreSQL، MySQL، والمحرك السيادي الداخلي')}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
            {engines.map((eng, idx) => {
              const isOnline = eng.status === 'Online';
              return (
                <div
                  key={idx}
                  style={{
                    padding: 14,
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--glass-tint)',
                    border: '1px solid var(--glass-rim-low)',
                    borderRight: isOnline ? '4px solid var(--status-safe)' : '4px solid var(--status-warning)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Database size={16} style={{ color: isOnline ? 'var(--status-safe)' : 'var(--status-warning)' }} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{eng.name}</span>
                    </div>
                    <span className={`badge ${isOnline ? 'badge--success' : 'badge--warning'}`}>
                      {eng.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-2)' }}>
                    <div>{t('نوع المحرك:')} <strong style={{ color: 'var(--text-1)' }}>{eng.type}</strong></div>
                    <div>{t('خدمة الويندوز:')} <code style={{ color: 'var(--accent)' }}>{eng.service_name}</code></div>
                    <div>{t('المسار / المرجع:')} <span style={{ color: 'var(--text-3)', fontSize: 10 }}>{eng.database_path}</span></div>
                    {eng.storage_size_mb > 0 && (
                      <div>{t('حجم البيانات:')} <strong style={{ color: 'var(--text-1)' }}>{eng.storage_size_mb} MB</strong></div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Backup Modal */}
      {backupModalOpen && (
        <Modal
          title={t('أخذ نسخة احتياطية فورية لقاعدة البيانات')}
          open={backupModalOpen}
          onClose={() => setBackupModalOpen(false)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 12, color: 'var(--text-2)' }}>
              {t('سيتم إنشاء لقطة فيزيائية مشفرة لقاعدة البيانات')} <code>asaas_v2.db</code> {t('وحفظها في المجلد السيادي مع حساب الهاش SHA-256.')}
            </p>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>
                {t('وصف النسخة الاحتياطية')}
              </label>
              <TextInput
                value={backupDesc}
                onChange={(e: any) => setBackupDesc(e.target.value)}
                placeholder={t('مثال: ترقية الإصدار v3.0 قبل الصيانة')}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <Button variant="ghost" onClick={() => setBackupModalOpen(false)}>
                {t('إلغاء')}
              </Button>
              <Button variant="primary" onClick={handleCreateBackup} loading={creatingBackup}>
                {t('إنشاء وتوثيق النسخة')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
