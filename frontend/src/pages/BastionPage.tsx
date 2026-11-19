import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Segmented, useToast } from '../asaas-ui';
import { api, type AssetItem, type JitGrant, type LocalUser } from '../lib/api';
import { apiV1, type V1Agent } from '../lib/apiV1';
import {
  Activity,
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Database,
  Flag,
  FolderOpen,
  Inbox,
  KeyRound,
  MessageSquare,
  Monitor,
  Plus,
  RefreshCw,
  Route,
  Search,
  Server,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Terminal,
  Timer,
  UserCheck,
  UserRound,
  X,
} from 'lucide-react';
import { t } from '../lib/i18n';

type PamTab = 'requests' | 'assets';
type GrantStatusFilter = 'all' | 'PENDING' | 'ACTIVE' | 'REJECTED' | 'EXPIRED' | 'REVOKED';
type RangeFilter = '7d' | '30d' | 'all';
type ConfirmKind = 'reject' | 'revoke';

interface RequestFormState {
  user: string;
  role: string;
  duration: string;
  reason: string;
  agent_id: string;
}

interface AssetFormState {
  name: string;
  host: string;
  type: string;
  port: string;
  protocol: string;
}

const PAGE_SIZES = [10, 25, 50];

const INITIAL_REQUEST_FORM: RequestFormState = {
  user: '',
  role: 'ServerAdmin',
  duration: '15',
  reason: '',
  agent_id: '',
};

const INITIAL_ASSET_FORM: AssetFormState = {
  name: '',
  host: '',
  type: 'Windows Server',
  port: '3389',
  protocol: 'RDP',
};

const ROLE_OPTIONS = [
  { value: 'ServerAdmin', label: t('مدير السيرفر') },
  { value: 'Local Administrator', label: t('مسؤول محلي') },
  { value: 'Network Operator', label: t('مشغل شبكة') },
  { value: 'Security Auditor', label: t('مدقق أمني') },
  { value: 'Backup Operator', label: t('مشغل نسخ احتياطي') },
];

const DURATION_OPTIONS = [5, 15, 30, 60, 120, 240, 480];

const POLICY_RULES = [
  { label: t('تنسيق أو الكتابة فوق الأقراص'), pattern: 'Format / DiskPart' },
  { label: t('حذف عشوائي أو تدمير نظام الملفات'), pattern: 'rm -rf /' },
  { label: t('حذف أو تفريغ قواعد البيانات'), pattern: 'DROP / TRUNCATE' },
  { label: t('إيقاف تشغيل السيرفر أو خدماته'), pattern: 'shutdown /s' },
];

const CONNECT_PROTOCOLS = new Set(['RDP', 'SSH', 'SFTP']);

const ROLE_LABELS: Record<string, string> = {
  ServerAdmin: t('مدير السيرفر'),
  'Local Administrator': t('مسؤول محلي'),
  'Network Operator': t('مشغل شبكة'),
  'Security Auditor': t('مدقق أمني'),
  'Backup Operator': t('مشغل نسخ احتياطي'),
  'Database Operator': t('مشغل قواعد بيانات'),
};

const GRANT_STATUS_META: Record<string, { label: string; className: string }> = {
  PENDING: { label: t('قيد المراجعة'), className: 'pill-status--idle' },
  ACTIVATING: { label: t('جارٍ التفعيل على الوكيل'), className: 'pill-status--idle' },
  REVOKING: { label: t('جارٍ السحب على الوكيل'), className: 'pill-status--idle' },
  FAILED: { label: t('فشل التنفيذ'), className: 'pill-status--off' },
  EXPIRED_UNREVOKED: { label: t('انتهت والسحب معلق'), className: 'pill-status--off' },
  ACTIVE: { label: t('نشط'), className: 'pill-status--on' },
  REJECTED: { label: t('مرفوض'), className: 'pill-status--off' },
  REVOKED: { label: t('ملغى'), className: 'pill-status--off' },
  EXPIRED: { label: t('منتهي'), className: 'pill-status--muted' },
};

const PROTOCOLS = [
  { key: 'RDP', label: 'RDP', description: t('سطح المكتب البعيد'), icon: Monitor },
  { key: 'SSH', label: 'SSH', description: t('طرفية آمنة'), icon: Terminal },
  { key: 'SFTP', label: 'SFTP', description: t('نقل ملفات آمن'), icon: FolderOpen },
  { key: 'DATABASE', label: 'SQL', description: t('قواعد البيانات'), icon: Database },
];

function roleLabel(role?: string | null): string {
  if (!role) return '—';
  return ROLE_LABELS[role] ?? role;
}

function statusMeta(status?: string | null) {
  const key = (status || '').toUpperCase();
  return GRANT_STATUS_META[key] ?? { label: status || t('غير معروف'), className: 'pill-status--muted' };
}

function assetStatusMeta(status?: string | null) {
  const value = (status || '').toLowerCase();
  if (value === 'online') return { label: t('متصل'), className: 'pill-status--on' };
  if (value === 'offline') return { label: t('غير متصل'), className: 'pill-status--off' };
  return { label: status || t('غير معروف'), className: 'pill-status--muted' };
}

function protocolKey(protocol?: string | null): string {
  const value = (protocol || '').toLowerCase();
  if (value.includes('rdp')) return 'RDP';
  if (value.includes('ssh')) return 'SSH';
  if (value.includes('sftp')) return 'SFTP';
  if (value.includes('data') || value.includes('sql')) return 'DATABASE';
  return (protocol || 'TCP').toUpperCase();
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

function durationLabel(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  if (minutes % 60 !== 0) return `${minutes}${t(' دقيقة')}`;
  const hours = minutes / 60;
  if (hours === 1) return t('ساعة واحدة');
  if (hours === 2) return t('ساعتان');
  if (hours <= 10) return `${hours}${t(' ساعات')}`;
  return `${hours}${t(' ساعة')}`;
}

function grantRemainingSeconds(grant: JitGrant, nowMs: number): number {
  if ((grant.status || '').toUpperCase() !== 'ACTIVE') return 0;
  const expiresAt = new Date(grant.expires_at).getTime();
  if (!Number.isFinite(expiresAt)) return Math.max(0, grant.remaining_sec || 0);
  return Math.max(0, Math.floor((expiresAt - nowMs) / 1000));
}

function sessionMessage(protocol: string, name: string, host: string, port: number): string {
  const upper = protocol.toUpperCase();
  if (upper.startsWith('RDP')) {
    return `${t('تم توليد ملف اتصال RDP (.rdp) للأصل [')}${name}${t('] على ')}${host}:${port}${t('. افتح الملف لتشغيل mstsc.')}`;
  }
  return `${t('تم فتح صفحة مشغل ')}${upper}${t(' للأصل [')}${name}${t('] على ')}${host}:${port}.`;
}

function DetailRow({
  icon,
  label,
  children,
  className,
  title,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <div className="detail-row">
      <dt>
        {icon}
        <span>{label}</span>
      </dt>
      <dd className={className} title={title}>
        {children}
      </dd>
    </div>
  );
}

export function BastionPage() {
  const toast = useToast();

  const [tab, setTab] = useState<PamTab>('requests');
  const [grants, setGrants] = useState<JitGrant[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [localUsers, setLocalUsers] = useState<LocalUser[]>([]);
  const [grantLoading, setGrantLoading] = useState(true);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<GrantStatusFilter>('all');
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('7d');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const [confirmState, setConfirmState] = useState<{ kind: ConfirmKind; grant: JitGrant } | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm, setRequestForm] = useState<RequestFormState>(INITIAL_REQUEST_FORM);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [agents, setAgents] = useState<V1Agent[]>([]);

  const [assetProtocolFilter, setAssetProtocolFilter] = useState('all');
  const [assetQuery, setAssetQuery] = useState('');
  const [assetBusyId, setAssetBusyId] = useState<string | null>(null);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [assetForm, setAssetForm] = useState<AssetFormState>(INITIAL_ASSET_FORM);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [assetSubmitting, setAssetSubmitting] = useState(false);

  const [quick, setQuick] = useState({ host: '', user: 'Administrator', protocol: 'RDP' });
  const [quickMessage, setQuickMessage] = useState<string | null>(null);
  const [command, setCommand] = useState('netstat -ano');
  const [commandResult, setCommandResult] = useState<{ safe: boolean; reason: string; risk_level?: string } | null>(null);
  const [commandBusy, setCommandBusy] = useState(false);

  const fetchGrants = useCallback(
    async (silent = false) => {
      if (!silent) setGrantLoading(true);
      try {
        const res = await apiV1.jitGrants();
        setGrants((res.grants || []) as unknown as JitGrant[]);
      } catch (err) {
        if (!silent) {
          toast(err instanceof Error ? err.message : t('تعذر تحميل طلبات الوصول.'), 'error');
        }
      } finally {
        if (!silent) setGrantLoading(false);
      }
    },
    [toast],
  );

  const loadAssets = useCallback(async () => {
    setAssetsLoading(true);
    try {
      const items = await api.getAssets();
      setAssets(items);
    } catch (err) {
      toast(err instanceof Error ? err.message : t('تعذر تحميل الأصول المسجلة.'), 'error');
    } finally {
      setAssetsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void fetchGrants(false);
    const timer = window.setInterval(() => void fetchGrants(true), 15000);
    return () => window.clearInterval(timer);
  }, [fetchGrants]);

  useEffect(() => {
    void loadAssets();
    apiV1.agents().then((res) => {
      setAgents(Array.isArray(res) ? res : res.agents || []);
    }).catch((err) => toast(err instanceof Error ? err.message : t('تعذر تحميل الوكلاء المستهدفين.'), 'error'));
  }, [loadAssets]);

  useEffect(() => {
    let active = true;
    api
      .getUsers()
      .then((users) => {
        if (active) setLocalUsers(users);
      })
      .catch(() => {
        if (active) setLocalUsers([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, roleFilter, rangeFilter, pageSize]);

  const roleOptions = useMemo(() => {
    const options = new Set<string>();
    grants.forEach((grant) => {
      if (grant.target_role) options.add(grant.target_role);
    });
    return Array.from(options);
  }, [grants]);

  const filteredGrants = useMemo(() => {
    const term = search.trim().toLowerCase();
    const nowMs = Date.now();
    const windowMs =
      rangeFilter === '7d' ? 7 * 24 * 60 * 60 * 1000 : rangeFilter === '30d' ? 30 * 24 * 60 * 60 * 1000 : null;

    return grants.filter((grant) => {
      if (statusFilter !== 'all' && (grant.status || '').toUpperCase() !== statusFilter) return false;
      if (roleFilter !== 'all' && grant.target_role !== roleFilter) return false;

      if (windowMs !== null) {
        const createdAt = new Date(grant.created_at).getTime();
        if (Number.isFinite(createdAt) && nowMs - createdAt > windowMs) return false;
      }

      if (!term) return true;
      return [grant.id, grant.user, grant.target_role, grant.reason, grant.approver]
        .some((value) => (value || '').toLowerCase().includes(term));
    });
  }, [grants, statusFilter, roleFilter, rangeFilter, search]);

  useEffect(() => {
    setSelectedId((current) => (
      filteredGrants.some((grant) => grant.id === current)
        ? current
        : filteredGrants[0]?.id ?? null
    ));
  }, [filteredGrants]);

  const totalPages = Math.max(1, Math.ceil(filteredGrants.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const visibleGrants = filteredGrants.slice(pageStart, pageStart + pageSize);
  const visibleFrom = filteredGrants.length === 0 ? 0 : pageStart + 1;
  const visibleTo = Math.min(pageStart + pageSize, filteredGrants.length);

  const pageNumbers: number[] = [];
  const firstPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const lastPage = Math.min(totalPages, firstPage + 4);
  for (let index = firstPage; index <= lastPage; index += 1) pageNumbers.push(index);

  const selectedGrant = grants.find((grant) => grant.id === selectedId) ?? null;
  const selectedStatus = statusMeta(selectedGrant?.status);
  const selectedRemaining = selectedGrant ? grantRemainingSeconds(selectedGrant, now) : 0;

  const pendingCount = grants.filter((grant) => (grant.status || '').toUpperCase() === 'PENDING').length;
  const activeCount = grants.filter((grant) => (grant.status || '').toUpperCase() === 'ACTIVE').length;

  const protocolCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    assets.forEach((asset) => {
      const key = protocolKey(asset.protocol);
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [assets]);

  const filteredAssets = useMemo(() => {
    const term = assetQuery.trim().toLowerCase();
    return assets.filter((asset) => {
      if (assetProtocolFilter !== 'all' && protocolKey(asset.protocol) !== assetProtocolFilter) return false;
      if (!term) return true;
      return (
        asset.name.toLowerCase().includes(term) ||
        asset.host.toLowerCase().includes(term) ||
        asset.type.toLowerCase().includes(term) ||
        String(asset.port).includes(term)
      );
    });
  }, [assets, assetProtocolFilter, assetQuery]);

  const approvalSteps = selectedGrant
    ? (() => {
        const status = (selectedGrant.status || '').toUpperCase();
        const isPending = status === 'PENDING';
        const isRejected = status === 'REJECTED';
        const isActive = status === 'ACTIVE';
        const isRevoked = status === 'REVOKED';
        const isExpired = status === 'EXPIRED';
        const isActivating = status === 'ACTIVATING';
        const isFailed = status === 'FAILED' || status === 'EXPIRED_UNREVOKED';
        const approved = isActive || isRevoked || isExpired;
        return [
          {
            label: t('إنشاء الطلب'),
            meta: formatDateTime(selectedGrant.created_at),
            state: 'done',
            icon: <Plus size={15} />,
          },
          {
            label: t('مراجعة السياسة'),
            meta: t('التحقق من الدور والمدة'),
            state: 'done',
            icon: <ShieldCheck size={15} />,
          },
          {
            label: t('اعتماد المدير'),
            meta: isRejected
              ? `${t('رفضه ')}${selectedGrant.approver || t('مدير النظام')}`
              : isPending
                ? t('بانتظار موافقة مدير النظام')
                : `${t('اعتمده ')}${selectedGrant.approver || t('مدير النظام')}`,
            state: isRejected ? 'failed' : isPending ? 'current' : 'done',
            icon: isRejected ? <X size={15} /> : <UserCheck size={15} />,
          },
          {
            label: t('تفعيل الصلاحية'),
            meta: isActive
              ? `${t('سارية حتى ')}${formatDateTime(selectedGrant.expires_at)}`
              : isActivating
                ? t('أُرسلت مهمة موقعة وتنتظر تأكيد الوكيل')
                : isFailed
                  ? selectedGrant.last_error || t('فشل تنفيذ الصلاحية على الوكيل')
                  : approved
                    ? t('تم تأكيد التفعيل بواسطة الوكيل')
                    : t('تبدأ بعد الاعتماد'),
            state: isActive ? 'current' : isFailed ? 'failed' : isActivating ? 'current' : approved ? 'done' : 'pending',
            icon: <KeyRound size={15} />,
          },
          {
            label: isRevoked ? t('سحب الصلاحية') : t('انتهاء الطلب'),
            meta: isRevoked
              ? t('سُحبت الصلاحية بواسطة المدير')
              : isExpired
                ? t('انتهت المدة المحددة')
                : isActive
                  ? `${t('متبقي ')}${formatSeconds(selectedRemaining)}`
                  : '—',
            state: isRevoked || isExpired ? 'done' : 'pending',
            icon: <Flag size={15} />,
          },
        ];
      })()
    : [];

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchGrants(true), loadAssets()]);
    } finally {
      setRefreshing(false);
    }
  };

  const openNewRequest = (grant?: JitGrant) => {
    setRequestForm(
      grant
        ? {
            user: grant.user,
            role: grant.target_role,
            duration: String(grant.duration_mins),
            reason: grant.reason,
            agent_id: grant.agent_id || '',
          }
        : { ...INITIAL_REQUEST_FORM, agent_id: agents.find((agent) => agent.status === 'online')?.id || agents[0]?.id || '' },
    );
    setRequestError(null);
    setRequestOpen(true);
  };

  const handleRequestSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const reason = requestForm.reason.trim();
    if (reason.length < 5) {
      setRequestError(t('يرجى كتابة سبب واضح للطلب (5 أحرف على الأقل).'));
      return;
    }
    if (!requestForm.agent_id) {
      setRequestError(t('اختر وكيلاً مستهدفاً قبل إرسال الطلب.'));
      return;
    }

    setRequestSubmitting(true);
    setRequestError(null);
    try {
      const res = await apiV1.requestJitGrant({
        target_role: requestForm.role,
        reason,
        duration_mins: Number(requestForm.duration),
        agent_id: requestForm.agent_id,
        ...(requestForm.user.trim() ? { username: requestForm.user.trim() } : {}),
      });
      toast(res.message || t('تم تسجيل طلب الصلاحية بنجاح.'), 'success');
      setRequestOpen(false);
      setTab('requests');
      await fetchGrants(true);
      if (res.grant?.id) setSelectedId(res.grant.id);
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : t('تعذر تسجيل طلب الصلاحية.'));
    } finally {
      setRequestSubmitting(false);
    }
  };

  const handleApprove = async (grant: JitGrant) => {
    setBusyAction(`${grant.id}:approve`);
    try {
      const res = await apiV1.decideJitGrant(grant.id, true);
      toast(res.message || t('تم اعتماد الطلب بنجاح.'), 'success');
      await fetchGrants(true);
    } catch (err) {
      toast(err instanceof Error ? err.message : t('تعذر اعتماد الطلب.'), 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const executeConfirm = async () => {
    if (!confirmState) return;
    const { kind, grant } = confirmState;
    setBusyAction(`${grant.id}:${kind}`);
    try {
      const res =
        kind === 'reject'
          ? await apiV1.decideJitGrant(grant.id, false)
          : await apiV1.revokeJitGrant(grant.id);
      toast(
        res.message || (kind === 'reject' ? t('تم رفض طلب الوصول.') : t('تم سحب الصلاحية المؤقتة.')),
        'success',
      );
      setConfirmState(null);
      await fetchGrants(true);
    } catch (err) {
      toast(err instanceof Error ? err.message : t('تعذر تنفيذ الإجراء.'), 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const handleCopyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      toast(t('تم نسخ معرّف الطلب إلى الحافظة.'), 'success');
    } catch {
      toast(t('تعذر النسخ إلى الحافظة.'), 'error');
    }
  };

  const handleAssetConnect = (asset: AssetItem) => {
    const protocol = protocolKey(asset.protocol);
    if (!CONNECT_PROTOCOLS.has(protocol)) {
      toast(t('الاتصال المباشر متاح عبر RDP أو SSH أو SFTP فقط لهذا الأصل.'), 'error');
      return;
    }
    const url = `/api/bastion/connect?host=${encodeURIComponent(asset.host)}&username=${encodeURIComponent('Administrator')}&name=${encodeURIComponent(asset.name)}&protocol=${encodeURIComponent(protocol)}&port=${encodeURIComponent(String(asset.port))}`;
    const popup = window.open(url, '_blank');
    if (!popup) {
      toast(t('تم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.'), 'error');
      return;
    }
    toast(sessionMessage(protocol, asset.name, asset.host, asset.port), 'success');
  };

  const handleTestAsset = async (asset: AssetItem) => {
    setAssetBusyId(asset.id);
    try {
      const res = await api.testAsset(asset.id, asset.host, asset.port);
      toast(
        res?.message || (res?.ok ? `${t('تم اختبار الاتصال بالأصل ')}${asset.name}${t(' بنجاح.')}` : `${t('تعذر الاتصال بالأصل ')}${asset.name}.`),
        res?.ok ? 'success' : 'error',
      );
      await loadAssets();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('تعذر اختبار الاتصال بالأصل.'), 'error');
    } finally {
      setAssetBusyId(null);
    }
  };

  const handleQuickLaunch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!quick.host.trim()) {
      toast(t('يرجى إدخال عنوان السيرفر.'), 'error');
      return;
    }
    const protocol = quick.protocol.toUpperCase();
    const port = protocol === 'RDP' ? 3389 : 22;
    const url = `/api/bastion/connect?host=${encodeURIComponent(quick.host.trim())}&username=${encodeURIComponent(quick.user.trim() || 'Administrator')}&name=${encodeURIComponent(quick.host.trim())}&protocol=${encodeURIComponent(protocol)}&port=${encodeURIComponent(String(port))}`;
    const popup = window.open(url, '_blank');
    if (!popup) {
      toast(t('تم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.'), 'error');
      return;
    }
    setQuickMessage(sessionMessage(protocol, quick.host.trim(), quick.host.trim(), port));
  };

  const handleCommandCheck = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!command.trim()) return;
    setCommandBusy(true);
    try {
      const res = await api.checkCommandRisk(command.trim());
      setCommandResult(res);
    } catch (err) {
      toast(err instanceof Error ? err.message : t('تعذر فحص الأمر.'), 'error');
    } finally {
      setCommandBusy(false);
    }
  };

  const handleAssetSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!assetForm.name.trim() || !assetForm.host.trim()) {
      setAssetError(t('اسم الأصل وعنوان المضيف مطلوبان.'));
      return;
    }
    const port = Number(assetForm.port);
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      setAssetError(t('رقم المنفذ يجب أن يكون بين 1 و 65535.'));
      return;
    }

    setAssetSubmitting(true);
    setAssetError(null);
    try {
      await api.addAsset({
        name: assetForm.name.trim(),
        host: assetForm.host.trim(),
        type: assetForm.type.trim() || 'Windows Server',
        port,
        protocol: assetForm.protocol,
      });
      toast(t('تمت إضافة الأصل إلى بوابة الوصول.'), 'success');
      setAssetModalOpen(false);
      setAssetForm(INITIAL_ASSET_FORM);
      await loadAssets();
    } catch (err) {
      setAssetError(err instanceof Error ? err.message : t('تعذر إضافة الأصل.'));
    } finally {
      setAssetSubmitting(false);
    }
  };

  const confirmBusy = confirmState ? busyAction === `${confirmState.grant.id}:${confirmState.kind}` : false;

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head__title">
          <span className="page-head__icon"><ShieldCheck size={20} /></span>
          <div>
            <h1>{t('طلبات الوصول الآمن')}</h1>
            <p>{t('إدارة ومراجعة طلبات الوصول إلى السيرفرات عبر بوابة PAM مع تطبيق السياسات الأمنية.')}</p>
          </div>
        </div>

        <div className="page-head__actions">
          <Segmented
value={tab}
onChange={setTab}
label={t('أقسام بوابة الوصول الآمن')}
options={[
{ value: 'requests', label: t('طلبات الوصول'), count: grants.length },
{ value: 'assets', label: t('الأصول والبروتوكولات'), count: assets.length },
]}
/>

          <button type="button" className="icon-btn" onClick={handleRefresh} disabled={refreshing} aria-label={t('تحديث البيانات')}>
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
          </button>

          <button type="button" className="btn-gold-solid" onClick={() => openNewRequest()}>
            <Plus size={15} />
            {t('طلب وصول جديد')}
          </button>
        </div>
      </div>

      {tab === 'requests' ? (
        <div className="pam-stack">
          <section className="pam-filters" aria-label={t('عوامل تصفية طلبات الوصول')}>
            <div className="ui-select">
              <select
                aria-label={t('تصفية حسب الدور')}
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
              >
                <option value="all">{t('كل الأدوار')}</option>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>{roleLabel(role)}</option>
                ))}
              </select>
            </div>

            <div className="ui-select">
              <select
                aria-label={t('تصفية حسب حالة الطلب')}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as GrantStatusFilter)}
              >
                <option value="all">{t('كل الحالات')}</option>
                <option value="PENDING">{t('قيد المراجعة')}</option>
                <option value="ACTIVE">{t('نشط')}</option>
                <option value="REJECTED">{t('مرفوض')}</option>
                <option value="EXPIRED">{t('منتهي')}</option>
                <option value="REVOKED">{t('ملغى')}</option>
              </select>
            </div>

            <div className="ui-select">
              <select
                aria-label={t('تصفية حسب تاريخ الطلب')}
                value={rangeFilter}
                onChange={(event) => setRangeFilter(event.target.value as RangeFilter)}
              >
                <option value="7d">{t('آخر 7 أيام')}</option>
                <option value="30d">{t('آخر 30 يوماً')}</option>
                <option value="all">{t('كل الفترات')}</option>
              </select>
            </div>

            <label className="search-box">
              <Search size={15} />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('بحث في الطلبات (المستخدم، الدور، السبب…)')}
                aria-label={t('البحث في طلبات الوصول')}
              />
            </label>
          </section>

          <div className="pam-grid pam-grid--requests">
            <section className="panel pam-table-panel" aria-label={t('قائمة طلبات الوصول')}>
              <div className="table-shell">
                <table className="data-table pam-table">
                  <thead>
                    <tr>
                      <th>{t('رقم الطلب')}</th>
                      <th>{t('المستخدم')}</th>
                      <th>{t('الدور المستهدف')}</th>
                      <th>{t('المدة')}</th>
                      <th>{t('السبب')}</th>
                      <th>{t('حالة الطلب')}</th>
                      <th>{t('المعتمد')}</th>
                      <th>{t('تاريخ الطلب')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grantLoading && grants.length === 0 && (
                      <tr>
                        <td colSpan={8}>
                          <div className="pam-empty">
                            <RefreshCw size={24} className="spin" />
                            <strong>{t('جارٍ تحميل طلبات الوصول…')}</strong>
                          </div>
                        </td>
                      </tr>
                    )}

                    {!grantLoading && visibleGrants.length === 0 && (
                      <tr>
                        <td colSpan={8}>
                          <div className="pam-empty">
                            <Inbox size={26} />
                            <strong>{t('لا توجد طلبات مطابقة')}</strong>
                            <span>{t('جرّب تغيير عوامل التصفية أو أنشئ طلب وصول جديد.')}</span>
                          </div>
                        </td>
                      </tr>
                    )}

                    {visibleGrants.map((grant) => {
                      const grantStatus = statusMeta(grant.status);
                      return (
                        <tr
                          key={grant.id}
                          data-selected={selectedGrant?.id === grant.id ? 'true' : undefined}
                          onClick={() => setSelectedId(grant.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="cell-mono" dir="ltr" title={grant.id}>{grant.id}</td>
                          <td>
                            <span className="cell-user">
                              <UserRound size={13} />
                              <span className="cell-strong" dir="ltr">{grant.user}</span>
                            </span>
                          </td>
                          <td>
                            <span className="pam-role" title={grant.target_role}>
                              <KeyRound size={12} />
                              {roleLabel(grant.target_role)}
                            </span>
                          </td>
                          <td className="cell-mono" dir="ltr">{durationLabel(grant.duration_mins)}</td>
                          <td className="pam-table__reason" title={grant.reason}>{grant.reason}</td>
                          <td>
                            <span className={`pill-status ${grantStatus.className}`}>
                              <span className="badge-dot" />
                              {grantStatus.label}
                            </span>
                          </td>
                          <td className="cell-muted pam-table__approver" title={grant.approver}>
                            {grant.approver || '—'}
                          </td>
                          <td className="cell-mono" dir="ltr">{formatDateTime(grant.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <span>{t('إظهار')} {visibleFrom} - {visibleTo} {t('من')} {filteredGrants.length} {t('طلب')}</span>

                <span className="pagination__size">
                  {t('طلبات في الصفحة')}
                  <span className="ui-select">
                    <select
                      aria-label={t('عدد الطلبات في الصفحة')}
                      value={pageSize}
                      onChange={(event) => setPageSize(Number(event.target.value))}
                    >
                      {PAGE_SIZES.map((size) => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </span>
                </span>

                {totalPages > 1 && (
                  <div className="pagination__pages">
                    <button
                      type="button"
                      onClick={() => setPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage <= 1}
                      aria-label={t('الصفحة السابقة')}
                    >
                      <ChevronRight size={13} />
                    </button>
                    {pageNumbers.map((pageNumber) => (
                      <button
                        key={pageNumber}
                        type="button"
                        data-active={pageNumber === currentPage ? 'true' : undefined}
                        onClick={() => setPage(pageNumber)}
                      >
                        {pageNumber}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage >= totalPages}
                      aria-label={t('الصفحة التالية')}
                    >
                      <ChevronLeft size={13} />
                    </button>
                  </div>
                )}
              </div>
            </section>

            <aside className="pam-detail" aria-label={t('تفاصيل طلب الوصول')}>
              <header className="pam-detail__head">
                <span className="pam-detail__title">
                  <ShieldCheck size={17} />
                  {t('تفاصيل الطلب')}
                </span>
                {selectedGrant && (
                  <span className={`pill-status ${selectedStatus.className}`}>
                    <span className="badge-dot" />
                    {selectedStatus.label}
                  </span>
                )}
              </header>

              {selectedGrant ? (
                <>
                  <div className="pam-detail__body">
                    <span className="pam-request-record" dir="ltr">{selectedGrant.id}</span>

                    <dl className="detail-rows">
                      <DetailRow icon={<UserRound size={13} />} label={t('المستخدم')}>
                        <span dir="ltr">{selectedGrant.user}</span>
                      </DetailRow>
                      <DetailRow icon={<KeyRound size={13} />} label={t('الدور المستهدف')}>
                        <span title={selectedGrant.target_role}>{roleLabel(selectedGrant.target_role)}</span>
                      </DetailRow>
                      <DetailRow icon={<Timer size={13} />} label={t('المدة المطلوبة')}>
                        {durationLabel(selectedGrant.duration_mins)}
                      </DetailRow>
                      <DetailRow
                        icon={<MessageSquare size={13} />}
                        label={t('السبب')}
                        className="pam-detail__reason"
                      >
                        {selectedGrant.reason || '—'}
                      </DetailRow>
                      <DetailRow icon={<UserCheck size={13} />} label={t('المعتمد')}>
                        <span title={selectedGrant.approver}>{selectedGrant.approver || '—'}</span>
                      </DetailRow>
                      <DetailRow icon={<CalendarDays size={13} />} label={t('تاريخ الإنشاء')}>
                        <span className="ltr">{formatDateTime(selectedGrant.created_at)}</span>
                      </DetailRow>
                      <DetailRow icon={<Clock3 size={13} />} label={t('صلاحية حتى')}>
                        <span className="ltr">{formatDateTime(selectedGrant.expires_at)}</span>
                      </DetailRow>
                      {(selectedGrant.status || '').toUpperCase() === 'ACTIVE' && (
                        <DetailRow icon={<Timer size={13} />} label={t('الوقت المتبقي')}>
                          <span className="ltr gold">{formatSeconds(selectedRemaining)}</span>
                        </DetailRow>
                      )}
                    </dl>

                    <div className="pam-checks">
                      <div className="pam-check">
                        <span>{t('سياسة المدة')}</span>
                        <span className="pam-check__state pam-check__state--ok">
                          <CheckCircle2 size={12} />
                          {t('ضمن الحد المسموح')}
                        </span>
                      </div>
                      <div className="pam-check">
                        <span>{t('سجل التدقيق')}</span>
                        <span className="pam-check__state pam-check__state--rec">
                          <span className="badge-dot" />
                          {t('الطلب مسجّل أمنياً')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pam-detail__actions">
                    {(selectedGrant.status || '').toUpperCase() === 'PENDING' && (
                      <div className="three">
                        <button
                          type="button"
                          className="btn-gold-solid"
                          onClick={() => void handleApprove(selectedGrant)}
                          disabled={busyAction !== null}
                        >
                          <UserCheck size={15} />
                          {busyAction === `${selectedGrant.id}:approve` ? t('جارٍ الاعتماد…') : t('اعتماد الطلب')}
                        </button>
                        <button
                          type="button"
                          className="btn-danger-soft"
                          onClick={() => setConfirmState({ kind: 'reject', grant: selectedGrant })}
                          disabled={busyAction !== null}
                        >
                          <X size={15} />
                          {t('رفض الطلب')}
                        </button>
                      </div>
                    )}

                    {['ACTIVE', 'FAILED'].includes((selectedGrant.status || '').toUpperCase()) && (
                      <div className="three">
                        <button
                          type="button"
                          className="btn-gold-outline"
                          onClick={() => openNewRequest(selectedGrant)}
                          disabled={busyAction !== null}
                        >
                          <RefreshCw size={15} />
                          {t('تجديد الطلب')}
                        </button>
                        <button
                          type="button"
                          className="btn-danger-soft"
                          onClick={() => setConfirmState({ kind: 'revoke', grant: selectedGrant })}
                          disabled={busyAction !== null}
                        >
                          <ShieldX size={15} />
                          {t('سحب الصلاحية')}
                        </button>
                      </div>
                    )}

                    {!['PENDING', 'ACTIVE'].includes((selectedGrant.status || '').toUpperCase()) ? (
                      <div className="three">
                        <button
                          type="button"
                          className="btn-gold-outline"
                          onClick={() => openNewRequest(selectedGrant)}
                        >
                          <RefreshCw size={15} />
                          {t('تجديد الطلب')}
                        </button>
                        <button
                          type="button"
                          className="btn-dark"
                          onClick={() => void handleCopyId(selectedGrant.id)}
                        >
                          <Copy size={15} />
                          {t('نسخ المعرّف')}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn-dark"
                        onClick={() => void handleCopyId(selectedGrant.id)}
                      >
                        <Copy size={15} />
                        {t('نسخ معرّف الطلب')}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="pam-empty pam-empty--panel">
                  <Inbox size={28} />
                  <strong>{t('لا يوجد طلب محدد')}</strong>
                  <span>{t('اختر طلباً من القائمة لعرض تفاصيله وإجراءات الاعتماد.')}</span>
                </div>
              )}
            </aside>
          </div>

          <div className="pam-bottom">
            <div className="pam-bottom__main">
              <section className="panel" aria-label={t('مسار اعتماد الطلب')}>
                <header className="panel__head">
                  <h2 className="panel__title">
                    <Route size={17} />
                    {t('مسار اعتماد الطلب')}
                  </h2>
                  <span className="panel__action">
                    {selectedGrant ? <span dir="ltr">{selectedGrant.id}</span> : t('لا يوجد طلب محدد')}
                  </span>
                </header>

                {selectedGrant ? (
                  <div className="approval-path">
                    {approvalSteps.map((step) => (
                      <div key={step.label} className={`approval-step ${step.state}`}>
                        <span className="approval-step__dot">{step.icon}</span>
                        <span className="approval-step__label">{step.label}</span>
                        <span className="approval-step__meta">{step.meta}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="pam-empty pam-empty--compact">
                    <Inbox size={22} />
                    <span>{t('اختر طلباً لعرض مسار الاعتماد.')}</span>
                  </div>
                )}
              </section>

              <div className="pam-stats">
                <div className="pam-stat">
                  <div className="pam-stat__copy">
                    <div className="pam-stat__label">{t('مستوى الأمان')}</div>
                    <div className="pam-stat__value">{pendingCount === 0 ? t('مرتفع') : t('يتطلب مراجعة')}</div>
                  </div>
                  <span className="pam-stat__icon"><ShieldCheck size={14} /></span>
                </div>
                <div className="pam-stat">
                  <div className="pam-stat__copy">
                    <div className="pam-stat__label">{t('طلبات نشطة')}</div>
                    <div className="pam-stat__value">{activeCount}</div>
                  </div>
                  <span className="pam-stat__icon"><KeyRound size={14} /></span>
                </div>
                <div className="pam-stat">
                  <div className="pam-stat__copy">
                    <div className="pam-stat__label">{t('بانتظار الاعتماد')}</div>
                    <div className="pam-stat__value">{pendingCount}</div>
                  </div>
                  <span className="pam-stat__icon"><Clock3 size={14} /></span>
                </div>
                <div className="pam-stat">
                  <div className="pam-stat__copy">
                    <div className="pam-stat__label">{t('أنماط الأوامر المحظورة')}</div>
                    <div className="pam-stat__value">{POLICY_RULES.length}</div>
                  </div>
                  <span className="pam-stat__icon"><ShieldAlert size={14} /></span>
                </div>
              </div>
            </div>

            <section className="panel policy-panel" aria-label={t('سياسة الأوامر المسموحة والمحظورة')}>
              <header className="panel__head panel__head--stack">
                <div>
                  <h2 className="panel__title">
                    <ShieldAlert size={17} />
                    {t('سياسة الأوامر المسموحة والمحظورة')}
                  </h2>
                  <p className="panel__subtitle">
                    {t('تُطبَّق حماية الأوامر لمنع العمليات التدميرية أثناء جلسات الوصول.')}
                  </p>
                </div>
              </header>

              <div className="policy-list">
                {POLICY_RULES.map((rule) => (
                  <div key={rule.pattern} className="policy-row">
                    <span className="policy-row__label">{rule.label}</span>
                    <span className="policy-row__code">
                      <ShieldX size={12} />
                      <code>{rule.pattern}</code>
                    </span>
                  </div>
                ))}
              </div>

              <div className="policy-foot">
                <Link to="/security">
                  <Settings2 size={13} />
                  {t('إدارة السياسات التفصيلية')}
                </Link>
              </div>
            </section>
          </div>
        </div>
      ) : (
        <div className="pam-stack">
          <div className="protocol-grid">
            {PROTOCOLS.map((protocol) => {
              const Icon = protocol.icon;
              return (
                <button
                  key={protocol.key}
                  type="button"
                  className="protocol-card"
                  data-active={assetProtocolFilter === protocol.key ? 'true' : undefined}
                  onClick={() => setAssetProtocolFilter((current) => (current === protocol.key ? 'all' : protocol.key))}
                >
                  <span className="protocol-card__icon"><Icon size={16} /></span>
                  <span className="protocol-card__copy">
                    <span className="protocol-card__name">{protocol.label}</span>
                    <span className="protocol-card__meta" dir="ltr">
                      {protocolCounts[protocol.key] || 0} assets · :{protocol.key === 'DATABASE' ? 1433 : protocol.key === 'RDP' ? 3389 : 22}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="pam-grid">
            <section className="panel pam-table-panel" aria-label={t('الأصول المسجلة في بوابة الوصول')}>
              <header className="panel__head">
                <h2 className="panel__title">
                  <Server size={17} />
                  {t('الأصول المُدارة')}
                  <span className="panel__count">{filteredAssets.length}</span>
                </h2>
                <div className="panel__action">
                  <button type="button" className="btn-gold-solid btn--sm" onClick={() => setAssetModalOpen(true)}>
                    <Plus size={14} />
                    {t('إضافة أصل')}
                  </button>
                </div>
              </header>

              <div className="pam-assets-toolbar">
                <label className="search-box">
                  <Search size={15} />
                  <input
                    type="text"
                    value={assetQuery}
                    onChange={(event) => setAssetQuery(event.target.value)}
                    placeholder={t('بحث باسم الأصل أو المضيف أو المنفذ…')}
                    aria-label={t('البحث في الأصول')}
                  />
                </label>

                <div className="ui-select">
                  <select
                    aria-label={t('تصفية حسب البروتوكول')}
                    value={assetProtocolFilter}
                    onChange={(event) => setAssetProtocolFilter(event.target.value)}
                  >
                    <option value="all">{t('كل البروتوكولات')}</option>
                    {PROTOCOLS.map((protocol) => (
                      <option key={protocol.key} value={protocol.key}>{protocol.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="table-shell">
                <table className="data-table pam-assets-table">
                  <thead>
                    <tr>
                      <th>{t('الأصل')}</th>
                      <th>{t('المضيف')}</th>
                      <th>{t('البروتوكول')}</th>
                      <th>{t('النوع')}</th>
                      <th>{t('الحالة')}</th>
                      <th>{t('الاستجابة')}</th>
                      <th>{t('إجراءات')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assetsLoading && assets.length === 0 && (
                      <tr>
                        <td colSpan={7}>
                          <div className="pam-empty">
                            <RefreshCw size={24} className="spin" />
                            <strong>{t('جارٍ تحميل الأصول…')}</strong>
                          </div>
                        </td>
                      </tr>
                    )}

                    {!assetsLoading && filteredAssets.length === 0 && (
                      <tr>
                        <td colSpan={7}>
                          <div className="pam-empty">
                            <Server size={26} />
                            <strong>{t('لا توجد أصول مطابقة')}</strong>
                            <span>{t('أضف أصلاً جديداً أو غيّر عوامل التصفية.')}</span>
                          </div>
                        </td>
                      </tr>
                    )}

                    {filteredAssets.map((asset) => {
                      const assetStatus = assetStatusMeta(asset.status);
                      const protocol = protocolKey(asset.protocol);
                      const connectable = CONNECT_PROTOCOLS.has(protocol);
                      return (
                        <tr key={asset.id}>
                          <td>
                            <span className="cell-strong">{asset.name}</span>
                          </td>
                          <td className="cell-mono" dir="ltr">{asset.host}:{asset.port}</td>
                          <td>
                            <span className="pam-protocol">{protocol}</span>
                          </td>
                          <td className="cell-muted">{asset.type}</td>
                          <td>
                            <span className={`pill-status ${assetStatus.className}`}>
                              <span className="badge-dot" />
                              {assetStatus.label}
                            </span>
                          </td>
                          <td className="cell-mono" dir="ltr">
                            {Number.isFinite(asset.latency_ms) ? `${asset.latency_ms.toFixed(1)} ms` : '—'}
                          </td>
                          <td>
                            <div className="pam-row-actions">
                              <button
                                type="button"
                                className="icon-btn icon-btn--xs"
                                onClick={() => void handleTestAsset(asset)}
                                disabled={assetBusyId === asset.id}
                                title={t('اختبار الاتصال بالأصل')}
                                aria-label={`${t('اختبار الاتصال بالأصل ')}${asset.name}`}
                              >
                                <Activity size={13} className={assetBusyId === asset.id ? 'spin' : ''} />
                              </button>
                              <button
                                type="button"
                                className="btn-gold-outline btn--sm"
                                onClick={() => handleAssetConnect(asset)}
                                disabled={!connectable}
                                title={connectable ? `${t('فتح جلسة ')}${protocol}` : t('الاتصال المباشر متاح عبر RDP أو SSH أو SFTP فقط')}
                              >
                                <Terminal size={13} />
                                {t('اتصال')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="pam-assets-side">
              <section className="panel" aria-label={t('الاتصال السريع')}>
                <header className="panel__head">
                  <h2 className="panel__title">
                    <Monitor size={17} />
                    {t('الاتصال السريع')}
                  </h2>
                </header>
                <div className="panel__body">
                  <form className="form-grid" onSubmit={handleQuickLaunch}>
                    <label className="ui-label">
                      {t('عنوان السيرفر')}
                      <input
                        className="ui-input"
                        dir="ltr"
                        value={quick.host}
                        onChange={(event) => setQuick((current) => ({ ...current, host: event.target.value }))}
                        placeholder="192.168.1.100"
                        required
                      />
                    </label>

                    <div className="form-grid form-grid--2">
                      <label className="ui-label">
                        {t('المستخدم')}
                        <input
                          className="ui-input"
                          dir="ltr"
                          value={quick.user}
                          onChange={(event) => setQuick((current) => ({ ...current, user: event.target.value }))}
                          placeholder="Administrator"
                        />
                      </label>

                      <label className="ui-label">
                        {t('البروتوكول')}
                        <span className="ui-select ui-select--block">
                          <select
                            value={quick.protocol}
                            onChange={(event) => setQuick((current) => ({ ...current, protocol: event.target.value }))}
                          >
                            <option value="RDP">RDP (3389)</option>
                            <option value="SSH">SSH (22)</option>
                            <option value="SFTP">SFTP (22)</option>
                          </select>
                        </span>
                      </label>
                    </div>

                    <button type="submit" className="btn-gold-solid">
                      <Terminal size={15} />
                      {t('فتح جلسة عبر الحصن')}
                    </button>
                  </form>

                  {quickMessage && (
                    <div className="quick-message" role="status">{quickMessage}</div>
                  )}
                </div>
              </section>

              <section className="panel" aria-label={t('فحص مخاطر الأوامر')}>
                <header className="panel__head">
                  <h2 className="panel__title">
                    <ShieldAlert size={17} />
                    {t('فحص مخاطر الأوامر')}
                  </h2>
                </header>
                <div className="panel__body">
                  <form className="command-checker" onSubmit={handleCommandCheck}>
                    <div className="command-checker__row">
                      <input
                        className="ui-input"
                        dir="ltr"
                        value={command}
                        onChange={(event) => setCommand(event.target.value)}
                        placeholder="netstat -ano"
                        aria-label={t('الأمر المراد فحصه')}
                      />
                      <button type="submit" className="btn-gold-outline" disabled={commandBusy || !command.trim()}>
                        {commandBusy ? <RefreshCw size={14} className="spin" /> : <ShieldCheck size={14} />}
                        {t('فحص')}
                      </button>
                    </div>
                  </form>

                  {commandResult && (
                    <div className={`command-result ${commandResult.safe ? 'safe' : 'danger'}`}>
                      {commandResult.safe ? <CheckCircle2 size={14} /> : <ShieldX size={14} />}
                      <span>
                        <strong>
                          {commandResult.safe ? t('الأمر آمن وفق السياسة') : t('الأمر محظور ومرفوض أمنياً')}
                        </strong>
                        <span className="command-result__reason">{commandResult.reason}</span>
                        {commandResult.risk_level && (
                          <span className="command-result__risk" dir="ltr">
                            risk: {commandResult.risk_level}
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  <p className="pam-hint">
                    {t('تُسجَّل الأوامر عالية الخطورة تلقائياً في سجل التدقيق الأمني.')}
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {requestOpen && (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={() => { if (!requestSubmitting) setRequestOpen(false); }}
        >
          <form
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-label={t('طلب وصول جديد')}
            onSubmit={handleRequestSubmit}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-panel__head">
              <span className="modal-panel__title">
                <KeyRound size={18} />
                {t('طلب وصول جديد')}
              </span>
              <button
                type="button"
                className="modal-panel__close"
                onClick={() => setRequestOpen(false)}
                disabled={requestSubmitting}
                aria-label={t('إغلاق نافذة طلب الوصول')}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-panel__body">
              {requestError && <div className="form-error">{requestError}</div>}

              <div className="form-grid">
                <label className="ui-label">
                  {t('الخادم المستهدف عبر الوكيل')}
                  <span className="ui-select ui-select--block">
                    <select
                      value={requestForm.agent_id}
                      onChange={(event) => setRequestForm((current) => ({ ...current, agent_id: event.target.value }))}
                      required
                    >
                      <option value="">{t('اختر وكيلاً')}</option>
                      {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name || agent.id} ({agent.status || 'unknown'})</option>)}
                    </select>
                  </span>
                </label>
                <label className="ui-label">
                  {t('المستخدم')}
                  <input
                    className="ui-input"
                    dir="ltr"
                    list="pam-local-users"
                    value={requestForm.user}
                    onChange={(event) => setRequestForm((current) => ({ ...current, user: event.target.value }))}
                    placeholder={t('اتركه فارغاً لطلب الصلاحية لحسابك')}
                  />
                  <datalist id="pam-local-users">
                    {localUsers.map((user) => (
                      <option key={user.username} value={user.username}>{user.full_name}</option>
                    ))}
                  </datalist>
                  <span className="pam-hint">
                    {t('طلب المسؤول لنفسه يُعتمد فوراً، وطلب مستخدم آخر يُحوَّل لمراجعة مدير النظام.')}
                  </span>
                </label>

                <div className="form-grid form-grid--2">
                  <label className="ui-label">
                    {t('الدور المطلوب')}
                    <span className="ui-select ui-select--block">
                      <select
                        value={requestForm.role}
                        onChange={(event) => setRequestForm((current) => ({ ...current, role: event.target.value }))}
                      >
                        {ROLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </span>
                  </label>

                  <label className="ui-label">
                    {t('المدة')}
                    <span className="ui-select ui-select--block">
                      <select
                        value={requestForm.duration}
                        onChange={(event) => setRequestForm((current) => ({ ...current, duration: event.target.value }))}
                      >
                        {DURATION_OPTIONS.map((minutes) => (
                          <option key={minutes} value={minutes}>{durationLabel(minutes)}</option>
                        ))}
                      </select>
                    </span>
                  </label>
                </div>

                <label className="ui-label">
                  {t('سبب الطلب')}
                  <textarea
                    className="ui-input"
                    value={requestForm.reason}
                    onChange={(event) => setRequestForm((current) => ({ ...current, reason: event.target.value }))}
                    placeholder={t('اشرح سبب الحاجة للوصول المؤقت والعمليات المطلوبة…')}
                    required
                  />
                </label>
              </div>
            </div>

            <div className="modal-panel__actions">
              <button type="submit" className="btn-gold-solid" disabled={requestSubmitting}>
                {requestSubmitting ? <RefreshCw size={15} className="spin" /> : <Plus size={15} />}
                {requestSubmitting ? t('جارٍ إرسال الطلب…') : t('إرسال طلب الوصول')}
              </button>
              <button
                type="button"
                className="btn-dark"
                onClick={() => setRequestOpen(false)}
                disabled={requestSubmitting}
              >
                {t('إلغاء')}
              </button>
            </div>
          </form>
        </div>
      )}

      {assetModalOpen && (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={() => { if (!assetSubmitting) setAssetModalOpen(false); }}
        >
          <form
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-label={t('إضافة أصل جديد')}
            onSubmit={handleAssetSubmit}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-panel__head">
              <span className="modal-panel__title">
                <Server size={18} />
                {t('إضافة أصل جديد')}
              </span>
              <button
                type="button"
                className="modal-panel__close"
                onClick={() => setAssetModalOpen(false)}
                disabled={assetSubmitting}
                aria-label={t('إغلاق نافذة إضافة أصل')}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-panel__body">
              {assetError && <div className="form-error">{assetError}</div>}

              <div className="form-grid">
                <label className="ui-label">
                  {t('اسم الأصل')}
                  <input
                    className="ui-input"
                    value={assetForm.name}
                    onChange={(event) => setAssetForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder={t('مثال: خادم التطبيقات')}
                    required
                  />
                </label>

                <div className="form-grid form-grid--2">
                  <label className="ui-label">
                    {t('المضيف / IP')}
                    <input
                      className="ui-input"
                      dir="ltr"
                      value={assetForm.host}
                      onChange={(event) => setAssetForm((current) => ({ ...current, host: event.target.value }))}
                      placeholder="192.168.1.50"
                      required
                    />
                  </label>

                  <label className="ui-label">
                    {t('المنفذ')}
                    <input
                      className="ui-input"
                      dir="ltr"
                      inputMode="numeric"
                      value={assetForm.port}
                      onChange={(event) => setAssetForm((current) => ({ ...current, port: event.target.value }))}
                      placeholder="3389"
                      required
                    />
                  </label>
                </div>

                <div className="form-grid form-grid--2">
                  <label className="ui-label">
                    {t('البروتوكول')}
                    <span className="ui-select ui-select--block">
                      <select
                        value={assetForm.protocol}
                        onChange={(event) => {
                          const protocol = event.target.value;
                          const port = protocol === 'RDP' ? '3389' : protocol === 'DATABASE' ? '1433' : '22';
                          setAssetForm((current) => ({ ...current, protocol, port }));
                        }}
                      >
                        <option value="RDP">RDP</option>
                        <option value="SSH">SSH</option>
                        <option value="SFTP">SFTP</option>
                        <option value="DATABASE">SQL</option>
                      </select>
                    </span>
                  </label>

                  <label className="ui-label">
                    {t('نوع النظام')}
                    <input
                      className="ui-input"
                      value={assetForm.type}
                      onChange={(event) => setAssetForm((current) => ({ ...current, type: event.target.value }))}
                      placeholder="Windows Server"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="modal-panel__actions">
              <button type="submit" className="btn-gold-solid" disabled={assetSubmitting}>
                {assetSubmitting ? <RefreshCw size={15} className="spin" /> : <Plus size={15} />}
                {assetSubmitting ? t('جارٍ الإضافة…') : t('إضافة الأصل')}
              </button>
              <button
                type="button"
                className="btn-dark"
                onClick={() => setAssetModalOpen(false)}
                disabled={assetSubmitting}
              >
                {t('إلغاء')}
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmState && (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={() => { if (!confirmBusy) setConfirmState(null); }}
        >
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-label={confirmState.kind === 'reject' ? t('تأكيد رفض الطلب') : t('تأكيد سحب الصلاحية')}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-panel__head">
              <span className="modal-panel__title">
                <AlertCircle size={18} />
                {confirmState.kind === 'reject' ? t('تأكيد رفض الطلب') : t('تأكيد سحب الصلاحية')}
              </span>
              <button
                type="button"
                className="modal-panel__close"
                onClick={() => setConfirmState(null)}
                disabled={confirmBusy}
                aria-label={t('إغلاق نافذة التأكيد')}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-panel__body">
              <p style={{ margin: 0 }}>
                {confirmState.kind === 'reject'
                  ? t('هل أنت متأكد من رفض طلب الوصول؟')
                  : t('هل أنت متأكد من سحب الصلاحية المؤقتة فوراً؟')}
              </p>

              <div className="modal-kv">
                <span className="modal-kv__cell">
                  <UserRound size={15} />
                  <span>
                    <strong dir="ltr">{confirmState.grant.user}</strong>
                    <small>{t('المستخدم')}</small>
                  </span>
                </span>
                <span className="modal-kv__divider" />
                <span className="modal-kv__cell">
                  <KeyRound size={15} />
                  <span>
                    <strong>{roleLabel(confirmState.grant.target_role)}</strong>
                    <small>{t('الدور المطلوب')}</small>
                  </span>
                </span>
              </div>

              <div className="modal-warning">
                <AlertCircle size={14} />
                {confirmState.kind === 'reject'
                  ? t('سيُغلق الطلب نهائياً ولن تُمنح الصلاحية المؤقتة للمستخدم.')
                  : t('سيتم إلغاء الصلاحية المؤقتة فوراً وإعادتها إلى حالة القيد.')}
              </div>
            </div>

            <div className="modal-panel__actions">
              <button
                type="button"
                className="btn-danger-soft"
                onClick={() => void executeConfirm()}
                disabled={confirmBusy}
              >
                {confirmBusy
                  ? t('جارٍ التنفيذ…')
                  : confirmState.kind === 'reject'
                    ? t('تأكيد الرفض')
                    : t('تأكيد السحب')}
              </button>
              <button
                type="button"
                className="btn-dark"
                onClick={() => setConfirmState(null)}
                disabled={confirmBusy}
              >
                {t('إلغاء')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
