import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../asaas-ui';
import { api, type ManagedServer, type PortItem } from '../lib/api';
import { apiV1 } from '../lib/apiV1';
import {
  AlertCircle,
  AlertTriangle,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code2,
  Container,
  Copy,
  Database,
  Download,
  ExternalLink,
  Gauge,
  Globe2,
  Inbox,
  Layers,
  MoreVertical,
  Plus,
  Power,
  Radar,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  ShieldX,
  Terminal,
  UserRound,
  Waypoints,
  X,
  type LucideIcon,
} from 'lucide-react';
import { t, isRtl } from '../lib/i18n';

type PortState = 'reserved' | 'used' | 'system' | 'connection';
type RangeValue = '1-10000' | '10001-30000' | '30001-65535' | 'all';

interface GuardReservation {
  port?: number;
  username?: string;
  user?: string;
  project_name?: string;
}

interface GuardSummary {
  guard_active?: boolean;
  total_listening?: number;
  isolated_user_ports_count?: number;
  system_ports_count?: number;
  user_reservations?: Record<string, string | number[]>;
  db_reservations?: GuardReservation[];
}

interface ReservationInfo {
  user: string;
  project?: string;
}

interface PortRow {
  key: string;
  port: number;
  proto: string;
  project: string;
  owners: string[];
  reservedBy?: string;
  state: PortState;
  conflict: boolean;
  pid: number;
  process: string;
  service: string;
  externalIps: string[];
  listening: boolean;
}

interface PortCheckResult {
  available: boolean;
  status?: string;
  message: string;
  conflict?: boolean;
  requested_port?: number;
  owner_user?: string;
  current_owner?: string | null;
  suggested_port?: number;
  alternatives?: number[];
}

type ConfirmState =
  | { kind: 'release'; port: number; project: string }
  | { kind: 'close'; pid: number; port: number; process: string }
  | { kind: 'block'; ip: string }
  | { kind: 'bulk-release'; ports: number[] };

interface ConfirmCopy {
  title: string;
  description: string;
  warning: string;
  action: string;
}

interface RowMenuState {
  row: PortRow;
  top: number;
  left: number;
}

const MONITORED_RANGES: ReadonlyArray<{ value: RangeValue; label: string; start: number; end: number }> = [
  { value: '1-10000', label: '1 - 10,000', start: 1, end: 10000 },
  { value: '10001-30000', label: '10,001 - 30,000', start: 10001, end: 30000 },
  { value: '30001-65535', label: '30,001 - 65,535', start: 30001, end: 65535 },
  { value: 'all', label: t('كافة المنافذ (1 - 65,535)'), start: 1, end: 65535 },
];

const QUICK_PORTS = [3000, 5173, 8000, 8080, 4321];
const PAGE_SIZES = [8, 25, 50];
const RANGE_SEGMENTS = 54;

const PROCESS_LABELS: Record<string, string> = {
  'com.docker.backend': 'Docker Backend',
  wslrelay: 'WSL Relay',
  svchost: 'Windows Service',
  System: 'Windows Kernel',
  pythonw: 'Python Service',
  python: 'Python',
  node: 'Node.js',
  chrome: 'Chrome',
  ChatGPT: 'ChatGPT',
  postgres: 'PostgreSQL',
  GoogleDriveFS: 'Google Drive',
  vmms: 'Hyper-V',
};

function formatNumber(value: number): string {
  return Math.max(0, Math.round(value)).toLocaleString('en-US');
}

function parsePort(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) return null;
  return parsed;
}

function protocolValue(value?: string): string {
  return (value || 'TCP').toUpperCase();
}

function prettyProcess(name?: string): string {
  if (!name) return '';
  const clean = name.replace(/\.exe$/i, '').trim();
  return PROCESS_LABELS[clean] ?? clean;
}

function projectLabel(row: PortItem): string {
  if (row.project_hint) return row.project_hint;
  const service = (row.service_name || row.service || '').trim();
  if (service && !/^dynamic(\s*\/\s*application)?$/i.test(service)) return service;
  return prettyProcess(row.process_name) || `${t('منفذ ')}${row.local_port}`;
}

function projectIcon(label: string, processName: string, isSystem: boolean): LucideIcon {
  const haystack = `${label} ${processName}`.toLowerCase();
  if (haystack.includes('docker') || haystack.includes('container')) return Container;
  if (haystack.includes('wsl') || haystack.includes('linux')) return Terminal;
  if (haystack.includes('postgres') || haystack.includes('sql') || haystack.includes('database')) return Database;
  if (
    haystack.includes('http') ||
    haystack.includes('web') ||
    haystack.includes('gateway') ||
    haystack.includes('proxy')
  ) {
    return Globe2;
  }
  if (
    haystack.includes('node') ||
    haystack.includes('vite') ||
    haystack.includes('react') ||
    haystack.includes('python') ||
    haystack.includes('django') ||
    haystack.includes('fastapi') ||
    haystack.includes('api')
  ) {
    return Code2;
  }
  if (isSystem || haystack.includes('service') || haystack.includes('windows')) return Server;
  return Boxes;
}

function stateMeta(state: PortState): { label: string; className: string } {
  if (state === 'reserved') return { label: t('محجوز'), className: 'pill-status--idle' };
  if (state === 'used') return { label: t('مستخدم'), className: 'pill-status--on' };
  if (state === 'system') return { label: t('نظامي'), className: 'pill-status--muted' };
  return { label: t('اتصال'), className: 'pill-status--info' };
}

function buildReservationMap(guard: GuardSummary | null): Map<number, ReservationInfo> {
  const map = new Map<number, ReservationInfo>();

  (guard?.db_reservations || []).forEach((entry) => {
    const port = Number(entry.port);
    if (!Number.isFinite(port) || port <= 0) return;
    map.set(port, {
      user: entry.username || entry.user || '—',
      project: entry.project_name || undefined,
    });
  });

  const raw = guard?.user_reservations;
  if (raw && typeof raw === 'object') {
    Object.entries(raw).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => {
          const port = Number(item);
          if (Number.isFinite(port) && port > 0 && !map.has(port)) {
            map.set(port, { user: '—' });
          }
        });
      } else if (typeof value === 'string') {
        const port = Number(key);
        if (Number.isFinite(port) && port > 0 && !map.has(port)) {
          map.set(port, { user: value });
        }
      }
    });
  }

  return map;
}

function describeConfirm(state: ConfirmState): ConfirmCopy {
  if (state.kind === 'release') {
    return {
      title: t('تحرير حجز المنفذ'),
      description: `${t('هل تريد تحرير حجز المنفذ ')}${state.port}${t(' الخاص بمشروع «')}${state.project}${t('»؟')}`,
      warning: t('سيُلغى الحجز النشط ويصبح المنفذ متاحاً لجميع المستخدمين.'),
      action: t('تحرير الحجز'),
    };
  }

  if (state.kind === 'close') {
    return {
      title: t('إغلاق العملية وتحرير المنفذ'),
      description: `${t('سيتم إنهاء العملية ')}${state.process} (PID ${state.pid}${t(') المرتبطة بالمنفذ ')}${state.port}.`,
      warning: t('قد يؤدي إنهاء العملية إلى فقدان بيانات غير محفوظة في التطبيق المرتبط.'),
      action: t('إغلاق العملية'),
    };
  }

  if (state.kind === 'block') {
    return {
      title: t('حظر عنوان IP'),
      description: `${t('سيتم إضافة قاعدة حظر في جدار حماية Windows للعنوان ')}${state.ip}.`,
      warning: t('لن يتمكن هذا العنوان من الاتصال بالسيرفر حتى تُزال القاعدة يدوياً.'),
      action: t('حظر العنوان'),
    };
  }

  return {
    title: t('تحرير الحجوزات المحددة'),
    description: `${t('سيتم تحرير ')}${state.ports.length}${t(' حجز منفذ دفعة واحدة: ')}${state.ports.join('، ')}.`,
    warning: t('ستصبح هذه المنافذ متاحة لجميع المستخدمين فوراً.'),
    action: t('تحرير الحجوزات'),
  };
}

function csvCell(value: string | number): string {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function PortsPage() {
  const toast = useToast();

  const [ports, setPorts] = useState<PortItem[]>([]);
  const [guard, setGuard] = useState<GuardSummary | null>(null);
  const [servers, setServers] = useState<ManagedServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [conflictOnly, setConflictOnly] = useState(false);
  const [range, setRange] = useState<RangeValue>('1-10000');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [autoAllocate, setAutoAllocate] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      return window.localStorage.getItem('asaas.ports.autoAllocate') !== '0';
    } catch {
      return true;
    }
  });
  const [serverId, setServerId] = useState('local');

  const [bulkOpen, setBulkOpen] = useState(false);
  const [rowMenu, setRowMenu] = useState<RowMenuState | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [formPort, setFormPort] = useState('3000');
  const [formProject, setFormProject] = useState('');
  const [checkResult, setCheckResult] = useState<PortCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Remote agent listening ports — read-only ports.list collector results.
  const [fleetPorts, setFleetPorts] = useState<any[]>([]);

  const fetchFleetPorts = useCallback(async () => {
    try {
      const fleetRes = await apiV1.fleetSummary();
      if (!fleetRes?.agents?.length) { setFleetPorts([]); return; }
      const detailed = await Promise.all(
        fleetRes.agents.map(async (ag) => {
          const r = await apiV1.agentLatestResults(ag.id).catch(() => null);
          const entry = r?.results?.['ports.list'] ?? null;
          let arr: any[] = [];
          const raw = entry && !entry.error ? entry.result : null;
          const src = Array.isArray(raw) ? raw : ((raw as any)?.ports ?? (raw as any)?.items ?? []);
          if (Array.isArray(src)) arr = src.filter((x) => x && typeof x === 'object');
          return { id: ag.id, name: ag.name, hostname: ag.hostname, status: ag.status, entry, ports: arr };
        }),
      );
      setFleetPorts(detailed);
    } catch {
      setFleetPorts([]);
    }
  }, []);

  useEffect(() => {
    void fetchFleetPorts();
  }, [fetchFleetPorts]);

  const fetchPorts = useCallback(
    async (force = false) => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await api.getPorts(force);
        setPorts(Array.isArray(res?.ports) ? res.ports : []);
        if (res?.guard) {
          setGuard(res.guard as GuardSummary);
        } else {
          const guardRes = await api.getGuardStatus();
          setGuard(guardRes as GuardSummary);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : t('تعذر تحميل بيانات المنافذ.');
        setLoadError(message);
        toast(message, 'error');
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  const loadServers = useCallback(async () => {
    try {
      const res = await api.getServers();
      setServers(Array.isArray(res.servers) ? res.servers : []);
    } catch {
      setServers([]);
    }
  }, []);

  useEffect(() => {
    void fetchPorts();
  }, [fetchPorts]);

  useEffect(() => {
    void loadServers();
  }, [loadServers]);

  useEffect(() => {
    try {
      window.localStorage.setItem('asaas.ports.autoAllocate', autoAllocate ? '1' : '0');
    } catch {
      // The preference remains in memory when storage is unavailable.
    }
  }, [autoAllocate]);

  useEffect(() => {
    const primary = servers.find((server) => Boolean(server.is_local));
    if (primary && serverId !== primary.id) {
      setServerId(primary.id);
    }
  }, [servers, serverId]);

  useEffect(() => {
    setPage(1);
  }, [search, projectFilter, conflictOnly, pageSize]);

  useEffect(() => {
    if (!rowMenu) return;
    const close = () => setRowMenu(null);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [rowMenu]);

  const reservationMap = useMemo(() => buildReservationMap(guard), [guard]);

  const rows = useMemo(() => {
    const groups = new Map<string, PortItem[]>();
    ports.forEach((port) => {
      const key = `${port.local_port}:${protocolValue(port.proto)}`;
      const group = groups.get(key);
      if (group) group.push(port);
      else groups.set(key, [port]);
    });

    const result: PortRow[] = [];
    const seenPorts = new Set<number>();

    groups.forEach((group, key) => {
      const reference = group[0];
      const port = reference.local_port;
      const proto = protocolValue(reference.proto);
      seenPorts.add(port);

      const owners = Array.from(
        new Set(
          group
            .map((item) => (item.owner_user || '').trim())
            .filter((owner) => owner && owner.toUpperCase() !== 'SYSTEM'),
        ),
      );

      const representative =
        group.find((item) => Boolean(item.project_hint)) ??
        group.find(
          (item) =>
            Boolean(item.owner_user) &&
            item.owner_user !== 'SYSTEM' &&
            item.is_listening,
        ) ??
        group[0];

      const reservation = reservationMap.get(port);
      const listening = group.some((item) => item.is_listening);
      const state: PortState = reservation
        ? 'reserved'
        : owners.length > 0
          ? 'used'
          : listening
            ? 'system'
            : 'connection';

      const externalIps = Array.from(
        new Set(
          group
            .filter((item) => item.is_external)
            .map((item) => (item.remote_ip || '').trim())
            .filter(
              (ip) =>
                ip &&
                ip !== '0.0.0.0' &&
                ip !== '::' &&
                ip !== '127.0.0.1' &&
                ip !== '::1',
            ),
        ),
      );

      result.push({
        key,
        port,
        proto,
        project: reservation?.project || projectLabel(representative),
        owners,
        reservedBy: reservation?.user,
        state,
        conflict: owners.length > 1,
        pid: Number(representative.pid) || 0,
        process: representative.process_name || '',
        service: representative.service_name || representative.service || '',
        externalIps,
        listening,
      });
    });

    reservationMap.forEach((reservation, port) => {
      if (seenPorts.has(port)) return;
      result.push({
        key: `${port}:TCP`,
        port,
        proto: 'TCP',
        project: reservation.project || t('حجز منفذ مخصص'),
        owners: [],
        reservedBy: reservation.user,
        state: 'reserved',
        conflict: false,
        pid: 0,
        process: '',
        service: '',
        externalIps: [],
        listening: false,
      });
    });

    const rank: Record<PortState, number> = {
      reserved: 0,
      used: 1,
      system: 2,
      connection: 3,
    };

    result.sort((left, right) => {
      if (left.conflict !== right.conflict) return left.conflict ? -1 : 1;
      if (left.state !== right.state) return rank[left.state] - rank[right.state];
      if (left.port !== right.port) return left.port - right.port;
      return left.proto.localeCompare(right.proto);
    });

    return result;
  }, [ports, reservationMap]);

  const localServers = useMemo(
    () => servers.filter((server) => Boolean(server.is_local)),
    [servers],
  );
  const effectiveServerId = localServers.some((server) => server.id === serverId)
    ? serverId
    : localServers[0]?.id ?? 'local';
  const activeServer = localServers.find((server) => server.id === effectiveServerId) ?? null;
  const serverOnline = activeServer ? activeServer.status === 'online' : null;

  const activeRange = MONITORED_RANGES.find((item) => item.value === range) ?? MONITORED_RANGES[0];
  const rangeSize = activeRange.end - activeRange.start + 1;
  const inRange = rows.filter(
    (row) => row.port >= activeRange.start && row.port <= activeRange.end,
  );
  const usedInRange = inRange.length;
  const conflictInRange = inRange.filter((row) => row.conflict).length;
  const availableInRange = Math.max(0, rangeSize - usedInRange);
  const usedPercent = rangeSize > 0 ? (usedInRange / rangeSize) * 100 : 0;
  const visualPercent = usedPercent > 0 ? Math.min(100, Math.max(1.2, usedPercent)) : 0;
  const percentLabel =
    usedPercent >= 10
      ? `${Math.round(usedPercent)}%`
      : usedPercent > 0
        ? `${usedPercent.toFixed(1)}%`
        : '0%';

  const allConflicts = rows.filter((row) => row.conflict);

  const rangeSegments = useMemo(() => {
    const buckets = Array.from(
      { length: RANGE_SEGMENTS },
      () => 'available' as 'available' | 'used' | 'conflict',
    );
    const span = activeRange.end - activeRange.start + 1;
    rows.forEach((row) => {
      if (row.port < activeRange.start || row.port > activeRange.end) return;
      const index = Math.min(
        RANGE_SEGMENTS - 1,
        Math.floor(((row.port - activeRange.start) / span) * RANGE_SEGMENTS),
      );
      if (row.conflict) buckets[index] = 'conflict';
      else if (buckets[index] === 'available') buckets[index] = 'used';
    });
    return buckets;
  }, [rows, activeRange]);

  const rangeLabels = useMemo(
    () =>
      Array.from({ length: 5 }, (_, index) =>
        formatNumber(
          activeRange.start +
            Math.round(((activeRange.end - activeRange.start) * index) / 4),
        ),
      ),
    [activeRange],
  );

  const projectOptions = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => {
      counts.set(row.project, (counts.get(row.project) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'ar'),
    );
  }, [rows]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (projectFilter !== 'all' && row.project !== projectFilter) return false;
      if (conflictOnly && !row.conflict) return false;
      if (!term) return true;
      return [
        String(row.port),
        row.proto,
        row.project,
        row.owners.join(' '),
        row.reservedBy || '',
        prettyProcess(row.process),
        row.process,
        row.service,
        String(row.pid),
      ].some((value) => value.toLowerCase().includes(term));
    });
  }, [rows, projectFilter, conflictOnly, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageRows = filteredRows.slice(pageStart, pageStart + pageSize);
  const visibleFrom = filteredRows.length === 0 ? 0 : pageStart + 1;
  const visibleTo = Math.min(pageStart + pageSize, filteredRows.length);

  const pageNumbers: number[] = [];
  const firstPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const lastPage = Math.min(totalPages, firstPage + 4);
  for (let index = firstPage; index <= lastPage; index += 1) pageNumbers.push(index);

  const allPageSelected =
    pageRows.length > 0 && pageRows.every((row) => selected.has(row.key));
  const selectedRows = rows.filter((row) => selected.has(row.key));
  const selectedReserved = selectedRows.filter((row) => row.state === 'reserved');

  useEffect(() => {
    setSelected((previous) => {
      const validKeys = new Set(rows.map((row) => row.key));
      let changed = false;
      const next = new Set<string>();
      previous.forEach((key) => {
        if (validKeys.has(key)) next.add(key);
        else changed = true;
      });
      return changed ? next : previous;
    });
  }, [rows]);

  const runCheck = useCallback(async (port: number): Promise<PortCheckResult | null> => {
    setChecking(true);
    setCheckResult(null);
    setFormError(null);
    try {
      const result = await api.checkPortConflict(port);
      setCheckResult(result);
      return result;
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('تعذر فحص المنفذ.'));
      return null;
    } finally {
      setChecking(false);
    }
  }, []);

  const adoptPort = (port: number) => {
    setFormPort(String(port));
    setCheckResult(null);
    setFormError(null);
    void runCheck(port);
  };

  const openCreate = (port?: number, project = '', autoCheck = false) => {
    const initialPort = port ?? 3000;
    setFormPort(String(initialPort));
    setFormProject(project);
    setCheckResult(null);
    setFormError(null);
    setCreateOpen(true);
    if (autoCheck) void runCheck(initialPort);
  };

  const closeCreate = () => {
    if (checking || claiming) return;
    setCreateOpen(false);
    setFormError(null);
    setCheckResult(null);
  };

  const handleCheck = async () => {
    const port = parsePort(formPort);
    if (port === null) {
      setFormError(t('رقم المنفذ يجب أن يكون بين 1 و 65535.'));
      return;
    }
    await runCheck(port);
  };

  const submitClaim = async (port: number) => {
    setClaiming(true);
    setFormError(null);
    try {
      const res = await api.claimPort({
        requested_port: port,
        project_name: formProject.trim(),
      });
      toast(
        res.message || `${t('تم حجز المنفذ ')}${res.assigned_port ?? port}${t(' بنجاح لمشروعك.')}`,
        'success',
      );
      setCreateOpen(false);
      setCheckResult(null);
      setFormPort('3000');
      setFormProject('');
      setSearch('');
      setProjectFilter('all');
      setConflictOnly(false);
      await fetchPorts(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('تعذر حجز المنفذ.'));
    } finally {
      setClaiming(false);
    }
  };

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const port = parsePort(formPort);
    if (port === null) {
      setFormError(t('رقم المنفذ يجب أن يكون بين 1 و 65535.'));
      return;
    }
    if (formProject.trim().length < 2) {
      setFormError(t('يرجى إدخال اسم مشروع واضح (حرفان على الأقل).'));
      return;
    }

    setFormError(null);
    const result =
      checkResult && checkResult.requested_port === port
        ? checkResult
        : await runCheck(port);
    if (!result) return;

    if (!result.available) {
      if (autoAllocate && result.suggested_port && result.suggested_port !== port) {
        const suggestedPort = result.suggested_port;
        const suggestedResult = await runCheck(suggestedPort);
        if (suggestedResult?.available) {
          setFormPort(String(suggestedPort));
          await submitClaim(suggestedPort);
          return;
        }
        setFormError(t('لم يُعثر على منفذ بديل شاغر تلقائياً. اختر منفذاً آخر.'));
        return;
      }
      setFormError(t('المنفذ المطلوب محجوز. اختر منفذاً بديلاً أو اعتمد الاقتراح.'));
      return;
    }

    await submitClaim(port);
  };

  const toggleRow = (key: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const togglePage = () => {
    setSelected((previous) => {
      const next = new Set(previous);
      const allSelected = pageRows.every((row) => next.has(row.key));
      pageRows.forEach((row) => {
        if (allSelected) next.delete(row.key);
        else next.add(row.key);
      });
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelected(new Set(filteredRows.map((row) => row.key)));
    setBulkOpen(false);
  };

  const showConflicts = () => {
    setConflictOnly(true);
    setProjectFilter('all');
    setSearch('');
    setPage(1);
    window.setTimeout(() => {
      document
        .getElementById('ports-table-panel')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  const openRowMenu = (event: ReactMouseEvent<HTMLButtonElement>, row: PortRow) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const width = 220;
    const height = 220;
    const left = Math.min(
      window.innerWidth - width - 8,
      Math.max(8, rect.right - width),
    );
    let top = rect.bottom + 6;
    if (top + height > window.innerHeight - 8) {
      top = Math.max(8, rect.top - height - 6);
    }
    setRowMenu({ row, top, left });
  };

  const copyPort = async (port: number) => {
    setRowMenu(null);
    try {
      await navigator.clipboard.writeText(String(port));
      toast(`${t('تم نسخ رقم المنفذ ')}${port}${t(' إلى الحافظة.')}`, 'success');
    } catch {
      toast(t('تعذر النسخ إلى الحافظة.'), 'error');
    }
  };

  const requestBulkRelease = () => {
    setBulkOpen(false);
    const portsToRelease = selectedRows
      .filter((row) => row.state === 'reserved')
      .map((row) => row.port);
    if (portsToRelease.length === 0) {
      toast(t('لا توجد حجوزات نشطة بين الصفوف المحددة.'), 'info');
      return;
    }
    setConfirmState({ kind: 'bulk-release', ports: portsToRelease });
  };

  const exportSelected = () => {
    setBulkOpen(false);
    if (selectedRows.length === 0) return;
    const header = [
      t('المنفذ'),
      t('البروتوكول'),
      t('المشروع'),
      t('المالك'),
      t('الحالة'),
      t('التعارض'),
      'PID',
      t('العملية'),
    ];
    const lines = selectedRows.map((row) =>
      [
        row.port,
        row.proto,
        row.project,
        row.reservedBy || row.owners.join(' | ') || 'SYSTEM',
        stateMeta(row.state).label,
        row.conflict ? t('نعم') : t('لا'),
        row.pid,
        prettyProcess(row.process),
      ]
        .map(csvCell)
        .join(','),
    );
    const csv = `\ufeff${[header.join(','), ...lines].join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `asaas-ports-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast(`${t('تم تصدير ')}${selectedRows.length}${t(' منفذاً إلى ملف CSV.')}`, 'success');
  };

  const executeConfirm = async () => {
    if (!confirmState) return;
    setConfirmBusy(true);
    try {
      if (confirmState.kind === 'release') {
        const res = await api.releasePort(confirmState.port);
        toast(res.message || `${t('تم تحرير المنفذ ')}${confirmState.port}.`, 'success');
      } else if (confirmState.kind === 'close') {
        const res = await api.closePortProcess(confirmState.pid);
        if (!res.ok) {
          toast(res.error || t('تعذر إغلاق العملية.'), 'error');
          return;
        }
        toast(
          `${t('تم إنهاء العملية ')}${confirmState.process}${t(' وتحرير المنفذ ')}${confirmState.port}.`,
          'success',
        );
      } else if (confirmState.kind === 'block') {
        const res = await api.blockIp(confirmState.ip);
        if (!res.ok) {
          toast(res.error || t('تعذر حظر العنوان.'), 'error');
          return;
        }
        toast(`${t('تمت إضافة قاعدة حظر للعنوان ')}${confirmState.ip}.`, 'success');
      } else {
        const results = await Promise.allSettled(
          confirmState.ports.map((port) => api.releasePort(port)),
        );
        const okCount = results.filter((result) => result.status === 'fulfilled').length;
        const failedCount = results.length - okCount;
        if (failedCount > 0) {
          toast(
            `${t('تم تحرير ')}${okCount}${t(' حجزاً، وتعذر تحرير ')}${failedCount}.`,
            'warn',
          );
        } else {
          toast(`${t('تم تحرير ')}${okCount}${t(' حجزاً بنجاح.')}`, 'success');
        }
        setSelected(new Set());
      }
      setConfirmState(null);
      await fetchPorts(true);
    } catch (err) {
      toast(err instanceof Error ? err.message : t('تعذر تنفيذ الإجراء.'), 'error');
    } finally {
      setConfirmBusy(false);
    }
  };

  const confirmation = confirmState ? describeConfirm(confirmState) : null;

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head__title">
          <span className="page-head__icon">
            <Waypoints size={20} />
          </span>
          <div>
            <nav className="breadcrumb" aria-label={t('مسار الصفحة')}>
              <Link to="/">{t('الصفحة الرئيسية')}</Link>
              <ChevronLeft size={12} />
              <span>{t('عزل المنافذ')}</span>
            </nav>
            <h1>
              {t('عزل المنافذ')} <span className="page-head__latin">(Port Isolation)</span>
            </h1>
            <p>{t('إدارة وتوزيع منافذ المشاريع على السيرفر، ومنع التعارض بينها بشكل آمن وذكي.')}</p>
          </div>
        </div>

        <div className="page-head__actions">
          <button
            type="button"
            className="btn-gold-solid"
            onClick={() => openCreate()}
          >
            <Plus size={15} />
            {t('إنشاء قاعدة جديدة')}
          </button>

          <div className="ports-bulk">
            <button
              type="button"
              className="btn-dark"
              onClick={() => setBulkOpen((current) => !current)}
              aria-expanded={bulkOpen}
              aria-haspopup="menu"
            >
              {t('إجراءات جماعية')}
              {selected.size > 0 && (
                <span className="ports-bulk__count">{selected.size}</span>
              )}
              <ChevronDown size={14} />
            </button>

            {bulkOpen && (
              <>
                <button
                  type="button"
                  className="menu-backdrop"
                  onClick={() => setBulkOpen(false)}
                  aria-label={t('إغلاق قائمة الإجراءات الجماعية')}
                />
                <div className="ports-bulk__menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setSelected((previous) => {
                        const next = new Set(previous);
                        pageRows.forEach((row) => next.add(row.key));
                        return next;
                      });
                      setBulkOpen(false);
                    }}
                  >
                    <Check size={14} />
                    {t('تحديد الصفحة الحالية')}
                  </button>
                  <button type="button" role="menuitem" onClick={selectAllFiltered}>
                    <Layers size={14} />
                    {t('تحديد كل النتائج')} ({filteredRows.length})
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setSelected(new Set());
                      setBulkOpen(false);
                    }}
                    disabled={selected.size === 0}
                  >
                    <X size={14} />
                    {t('إلغاء التحديد')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={requestBulkRelease}
                    disabled={selectedReserved.length === 0}
                  >
                    <ShieldX size={14} />
                    {t('تحرير الحجوزات المحددة')} ({selectedReserved.length})
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={exportSelected}
                    disabled={selected.size === 0}
                  >
                    <Download size={14} />
                    {t('تصدير المحدد إلى CSV')}
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            className="icon-btn"
            onClick={() => void fetchPorts(true)}
            disabled={loading}
            aria-label={t('تحديث بيانات المنافذ')}
            title={t('تحديث بيانات المنافذ')}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* ASAAS remote agent ports — read-only ports.list collector data */}
      {fleetPorts.length > 0 && (
        <section className="panel" style={{ padding: '18px 20px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Waypoints size={18} style={{ color: 'var(--accent)' }} />
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--text-1)' }}>{t('منافذ وكلاء أساس (قراءة فقط)')}</h3>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('ports.list حقيقية: كل المنافذ المستمعة TCP/UDP على كل وكيل')}</span>
            </div>
            <Link to="/agents" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>
              {t('إدارة الوكلاء')} ←
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
            {fleetPorts.map((ag) => {
              const rows = ag.ports;
              const tcpCount = rows.filter((p: any) => String(p.proto ?? 'tcp').toLowerCase() === 'tcp').length;
              return (
                <div key={ag.id} style={{ border: '1px solid var(--hairline)', borderRadius: 12, padding: '14px 16px', background: 'var(--glass-tint)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{ag.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: ag.status === 'online' ? 'var(--paid-bg)' : 'var(--surface-glass-tint)', color: ag.status === 'online' ? 'var(--paid)' : 'var(--text-3)' }}>
                      {ag.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-telemetry)', direction: 'ltr', textAlign: 'left', marginBottom: 10 }}>
                    {ag.hostname || ag.id.slice(0, 8)}{rows.length ? ` · ${rows.length} ${t('منفذ')} (${tcpCount} TCP)` : ''}
                  </div>
                  {!ag.entry ? (
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('لم يُرسل جامع المنافذ بعد — أرسله من صفحة الوكلاء.')}</div>
                  ) : ag.entry.error ? (
                    <div className="text-status-danger" style={{ fontSize: 11 }}>{ag.entry.error}</div>
                  ) : rows.length === 0 ? (
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('لا منافذ مستمعة أو نتيجة غير معروفة.')}</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 240, overflowY: 'auto' }}>
                      {rows.slice(0, 60).map((p: any, i: number) => {
                        const proto = String(p.proto ?? 'tcp').toUpperCase();
                        const lport = p.local_port ?? p.LocalPort ?? p.port ?? '';
                        const laddr = String(p.local_address ?? p.LocalAddress ?? '');
                        const proc = String(p.process ?? p.ProcessName ?? '');
                        const pid = p.pid ?? p.OwningProcess ?? '';
                        return (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 10, padding: '4px 8px', borderRadius: 6, background: 'var(--surface-ground)' }}>
                            <span style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
                              <span style={{ fontFamily: 'var(--font-telemetry)', fontWeight: 700, color: proto === 'UDP' ? 'var(--chart-out)' : 'var(--accent)', flexShrink: 0 }}>{proto}:{lport}</span>
                              <span style={{ color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'left' }}>{proc || '—'}</span>
                            </span>
                            <span style={{ display: 'flex', gap: 6, flexShrink: 0, color: 'var(--text-3)' }}>
                              {laddr && !/^0\.0\.0\.0$|^::$|^\*$/.test(laddr) && <span style={{ fontSize: 9, fontFamily: 'var(--font-telemetry)' }}>{laddr}</span>}
                              {pid !== '' && <span style={{ fontSize: 9 }}>PID {pid}</span>}
                            </span>
                          </div>
                        );
                      })}
                      {rows.length > 60 && <div style={{ fontSize: 10, color: 'var(--text-3)' }}>+{rows.length - 60} {t('منفذ آخر')}</div>}
                      {ag.entry.completed_at && (
                        <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{t('آخر قياس')}: {new Date(ag.entry.completed_at).toLocaleString('ar-SA')}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="ports-layout">
        <div className="ports-main">
          <section className="panel ports-selector" aria-label={t('تحديد السيرفر والمشروع')}>
            <div className="ports-selector__grid">
              <label className="ports-selector__field">
                <span className="ports-selector__label">
                  <span>{t('اختر السيرفر:')}</span>
                  {serverOnline !== null && (
                    <span className="ports-selector__status">
                      <span
                        className={`dot ${serverOnline ? 'dot--green' : 'dot--red'}`}
                      />
                      {serverOnline ? t('متصل') : t('غير متصل')}
                    </span>
                  )}
                </span>
                <span className="ui-select ui-select--block">
                  <select
                    aria-label={t('اختيار السيرفر')}
                    value={effectiveServerId}
                    onChange={(event) => setServerId(event.target.value)}
                    title={t('تُجمع بيانات المنافذ الحية من السيرفر المحلي فقط.')}
                  >
                    {localServers.length === 0 && (
                      <option value="local">{t('السيرفر المحلي')}</option>
                    )}
                    {localServers.map((server) => (
                      <option key={server.id} value={server.id}>
                        {server.name}
                      </option>
                    ))}
                  </select>
                </span>
              </label>

              <label className="ports-selector__field">
                <span className="ports-selector__label">
                  <span>{t('اختر المشروع:')}</span>
                </span>
                <span className="ui-select ui-select--block">
                  <select
                    aria-label={t('تصفية حسب المشروع')}
                    value={projectFilter}
                    onChange={(event) => setProjectFilter(event.target.value)}
                  >
                    <option value="all">{t('جميع المشاريع')}</option>
                    {projectOptions.map(([label, count]) => (
                      <option key={label} value={label}>
                        {label} ({count})
                      </option>
                    ))}
                  </select>
                </span>
              </label>
            </div>
          </section>

          <section
            className="panel ports-table-panel"
            id="ports-table-panel"
            aria-label={t('قائمة منافذ السيرفر')}
          >
            <div className="ports-toolbar">
              <label className="search-box">
                <Search size={15} />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('بحث في المنافذ أو المشاريع...')}
                  aria-label={t('البحث في المنافذ أو المشاريع')}
                />
              </label>

              <div className="ports-toolbar__side">
                {conflictOnly && (
                  <button
                    type="button"
                    className="ports-filter-chip"
                    onClick={() => setConflictOnly(false)}
                    title={t('إلغاء تصفية التعارضات')}
                  >
                    <AlertCircle size={12} />
                    {t('التعارضات فقط')}
                    <X size={12} />
                  </button>
                )}

                <label
                  className="toggle"
                  title={t('عند التفعيل، يعتمد النظام تلقائياً منفذاً بديلاً شاغراً إذا كان المنفذ المطلوب محجوزاً.')}
                >
                  <input
                    type="checkbox"
                    checked={autoAllocate}
                    onChange={(event) => setAutoAllocate(event.target.checked)}
                  />
                  <span className="toggle__track" />
                  <span className="ports-toggle__label">{t('التوزيع التلقائي للمنافذ')}</span>
                </label>
              </div>
            </div>

            <div className="table-shell">
              <table className="data-table ports-table">
                <thead>
                  <tr>
                    <th className="ports-col-check">
                      <input
                        type="checkbox"
                        className="port-check"
                        checked={allPageSelected}
                        onChange={togglePage}
                        aria-label={t('تحديد كل المنافذ في الصفحة الحالية')}
                      />
                    </th>
                    <th>{t('اسم المشروع')}</th>
                    <th>{t('رقم المنفذ')}</th>
                    <th>{t('البروتوكول')}</th>
                    <th>{t('المالك')}</th>
                    <th>{t('الحالة')}</th>
                    <th>{t('حالة التعارض')}</th>
                    <th>PID</th>
                    <th aria-label={t('إجراءات')} />
                  </tr>
                </thead>
                <tbody>
                  {loading && rows.length === 0 && (
                    <tr>
                      <td colSpan={9}>
                        <div className="pam-empty">
                          <RefreshCw size={24} className="spin" />
                          <strong>{t('جارٍ تحميل المنافذ…')}</strong>
                          <span>{t('يتم فحص المقابس والعمليات على السيرفر المحلي.')}</span>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loading && loadError && rows.length === 0 && (
                    <tr>
                      <td colSpan={9}>
                        <div className="pam-empty">
                          <AlertTriangle size={26} />
                          <strong>{t('تعذر تحميل بيانات المنافذ')}</strong>
                          <span>{loadError}</span>
                          <button
                            type="button"
                            className="btn-gold-outline btn--sm"
                            onClick={() => void fetchPorts(true)}
                          >
                            <RefreshCw size={14} />
                            {t('إعادة المحاولة')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loading && !loadError && filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={9}>
                        <div className="pam-empty">
                          <Inbox size={26} />
                          <strong>{t('لا توجد منافذ مطابقة')}</strong>
                          <span>
                            {conflictOnly
                              ? t('لا توجد تعارضات مطابقة لعوامل التصفية الحالية.')
                              : t('جرّب تغيير المشروع أو عبارة البحث.')}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}

                  {pageRows.map((row) => {
                    const status = stateMeta(row.state);
                    const Icon = projectIcon(
                      row.project,
                      row.process,
                      row.state === 'system',
                    );
                    const ownerTitle = [
                      ...(row.reservedBy ? [`${t('حجز: ')}${row.reservedBy}`] : []),
                      ...(row.owners.length > 0 ? row.owners : ['SYSTEM']),
                    ].join(isRtl() ? '، ' : ', ');

                    return (
                      <tr
                        key={row.key}
                        data-selected={selected.has(row.key) ? 'true' : undefined}
                      >
                        <td className="ports-col-check">
                          <input
                            type="checkbox"
                            className="port-check"
                            checked={selected.has(row.key)}
                            onChange={() => toggleRow(row.key)}
                            aria-label={`${t('تحديد المنفذ ')}${row.port} ${row.proto}`}
                          />
                        </td>
                        <td>
                          <span className="port-name" title={row.project}>
                            <span className="port-name__icon">
                              <Icon size={12} />
                            </span>
                            <span>{row.project}</span>
                          </span>
                        </td>
                        <td>
                          <span className="port-number">{row.port}</span>
                        </td>
                        <td>
                          <span
                            className={`port-proto port-proto--${row.proto.toLowerCase()}`}
                          >
                            {row.proto}
                          </span>
                        </td>
                        <td>
                          <span className="ports-owner" title={ownerTitle}>
                            <UserRound size={12} />
                            <span dir="ltr">
                              {row.reservedBy || row.owners[0] || 'SYSTEM'}
                            </span>
                            {row.owners.length > 1 && (
                              <span className="ports-owner__more">
                                +{row.owners.length - 1}
                              </span>
                            )}
                          </span>
                        </td>
                        <td>
                          <span className={`pill-status ${status.className}`}>
                            <span className="badge-dot" />
                            {status.label}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`pill-status ${
                              row.conflict ? 'pill-status--off' : 'pill-status--on'
                            }`}
                          >
                            {row.conflict ? (
                              <AlertCircle size={11} />
                            ) : (
                              <Check size={11} />
                            )}
                            {row.conflict ? t('متعارض') : t('سليم')}
                          </span>
                        </td>
                        <td className="cell-mono" dir="ltr">
                          {row.pid > 0 ? row.pid : '—'}
                        </td>
                        <td className="ports-actions-cell">
                          <button
                            type="button"
                            className="icon-btn icon-btn--xs"
                            onClick={(event) => openRowMenu(event, row)}
                            aria-label={`${t('إجراءات المنفذ ')}${row.port} ${row.proto}`}
                            aria-haspopup="menu"
                          >
                            <MoreVertical size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <span>
                {t('عرض')} {visibleFrom} - {visibleTo} {t('من أصل')} {filteredRows.length} {t('سجل')}
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

              <span className="pagination__size">
                {t('عرض')}
                <span className="ui-select">
                  <select
                    aria-label={t('عدد المنافذ في الصفحة')}
                    value={pageSize}
                    onChange={(event) => setPageSize(Number(event.target.value))}
                  >
                    {PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </span>
                {t('لكل صفحة')}
              </span>
            </div>
          </section>
        </div>

        <aside className="ports-side" aria-label={t('ملخص حالة المنافذ')}>
          <section className="panel port-health" aria-label={t('حالة المنافذ على السيرفر')}>
            <header className="panel__head">
              <h2 className="panel__title">
                <Gauge size={17} />
                {t('حالة المنافذ على السيرفر')}
              </h2>
            </header>
            <div className="panel__body">
              <div className="port-health__body">
                <div className="port-health__stats">
                  <div className="port-health__row">
                    <span className="port-health__key">
                      <span className="dot dot--gold" />
                      {t('المنافذ الكلية')}
                    </span>
                    <strong>{formatNumber(rangeSize)}</strong>
                  </div>
                  <div className="port-health__row">
                    <span className="port-health__key">
                      <span className="dot dot--gold" />
                      {t('مستخدمة')}
                    </span>
                    <strong>{formatNumber(usedInRange)}</strong>
                  </div>
                  <div className="port-health__row">
                    <span className="port-health__key">
                      <span className="dot dot--green" />
                      {t('متاحة')}
                    </span>
                    <strong>{formatNumber(availableInRange)}</strong>
                  </div>
                  <div className="port-health__row">
                    <span className="port-health__key">
                      <span className="dot dot--red" />
                      {t('متعارضة')}
                    </span>
                    <strong>{formatNumber(conflictInRange)}</strong>
                  </div>
                </div>

                <div
                  className="donut"
                  style={{ '--pct': visualPercent } as CSSProperties}
                  role="img"
                  aria-label={`${t('نسبة المنافذ المستخدمة ')}${percentLabel}`}
                >
                  <div className="donut__center">
                    <div className="donut__value">{percentLabel}</div>
                    <div className="donut__label">{t('مستخدم')}</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="panel range-card" aria-label={t('خريطة نطاق المنافذ')}>
            <div className="range-head">
              <h2 className="panel__title">
                <Radar size={17} />
                {t('خريطة نطاق المنافذ')}
              </h2>
              <span className="ui-select">
                <select
                  value={range}
                  onChange={(event) => setRange(event.target.value as RangeValue)}
                  aria-label={t('نطاق المنافذ المراقب')}
                >
                  {MONITORED_RANGES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </span>
            </div>

            <div className="range-map" aria-hidden="true">
              {rangeSegments.map((segment, index) => (
                <span
                  key={index}
                  className={`range-seg${
                    segment === 'available' ? '' : ` ${segment}`
                  }`}
                />
              ))}
            </div>

            <div className="range-labels">
              {rangeLabels.map((label, index) => (
                <span key={index}>{label}</span>
              ))}
            </div>

            <div className="range-legend">
              <span>
                <span className="dot dot--green" />
                {t('متاحة')}
              </span>
              <span>
                <span className="dot dot--gold" />
                {t('مستخدمة')}
              </span>
              <span>
                <span className="dot dot--red" />
                {t('متعارضة')}
              </span>
            </div>
          </section>

          <section
            className={`panel conflict-card${
              allConflicts.length === 0 ? ' conflict-card--clear' : ''
            }`}
            aria-label={t('تنبيه تعارض المنافذ')}
          >
            <header className="panel__head">
              <h2 className="panel__title">
                {allConflicts.length > 0 ? (
                  <AlertTriangle size={17} />
                ) : (
                  <ShieldCheck size={17} />
                )}
                {t('تنبيه تعارض منافذ')}
              </h2>
            </header>
            <div className="panel__body">
              {allConflicts.length > 0 ? (
                <>
                  <p className="conflict-card__lead">
                    {t('تم اكتشاف')} {allConflicts.length} {t('تعارض حالياً')}
                  </p>
                  <div className="conflict-list">
                    {allConflicts.slice(0, 3).map((conflict) => (
                      <span key={conflict.key}>
                        <AlertCircle size={13} />
                        <span>
                          {t('المنفذ')} <strong>{conflict.port}</strong> ({conflict.proto})
                          {t('مستخدم من')} {conflict.owners.length} {t('مستخدمين مختلفين')}:
                          {conflict.owners.join(', ')}.
                        </span>
                      </span>
                    ))}
                  </div>
                  {allConflicts.length > 3 && (
                    <p className="conflict-card__more">
                      +{allConflicts.length - 3} {t('تعارضات أخرى ظاهرة في الجدول')}
                    </p>
                  )}
                  <div className="conflict-card__foot">
                    <button
                      type="button"
                      className="btn-gold-outline btn--sm"
                      onClick={showConflicts}
                    >
                      <ExternalLink size={13} />
                      {t('عرض التفاصيل')}
                    </button>
                  </div>
                </>
              ) : (
                <div className="conflict-clear">
                  <ShieldCheck size={26} />
                  <p>
                    {t('لا توجد تعارضات حالياً. جميع المنافذ المراقبة موزعة بشكل سليم بين المستخدمين.')}
                  </p>
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      {rowMenu && (
        <>
          <button
            type="button"
            className="menu-backdrop"
            onClick={() => setRowMenu(null)}
            aria-label={t('إغلاق قائمة إجراءات المنفذ')}
          />
          <div
            className="menu-pop ports-row-menu"
            role="menu"
            style={{ top: rowMenu.top, left: rowMenu.left }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                const row = rowMenu.row;
                setRowMenu(null);
                openCreate(row.port, row.state === 'used' ? row.project : '', true);
              }}
            >
              <Search size={14} />
              {t('فحص المنفذ وحجزه')}
            </button>

            {rowMenu.row.state === 'reserved' && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const row = rowMenu.row;
                  setRowMenu(null);
                  setConfirmState({
                    kind: 'release',
                    port: row.port,
                    project: row.project,
                  });
                }}
              >
                <ShieldX size={14} />
                {t('تحرير الحجز')}
              </button>
            )}

            {rowMenu.row.state === 'used' && rowMenu.row.pid > 4 && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const row = rowMenu.row;
                  setRowMenu(null);
                  setConfirmState({
                    kind: 'close',
                    pid: row.pid,
                    port: row.port,
                    process: prettyProcess(row.process) || `PID ${row.pid}`,
                  });
                }}
              >
                <Power size={14} />
                {t('إغلاق العملية')} (PID {rowMenu.row.pid})
              </button>
            )}

            {rowMenu.row.externalIps.length > 0 && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const row = rowMenu.row;
                  setRowMenu(null);
                  setConfirmState({ kind: 'block', ip: row.externalIps[0] });
                }}
              >
                <ShieldX size={14} />
                {t('حظر IP')} {rowMenu.row.externalIps[0]}
              </button>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={() => void copyPort(rowMenu.row.port)}
            >
              <Copy size={14} />
              {t('نسخ رقم المنفذ')}
            </button>
          </div>
        </>
      )}

      {createOpen && (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={closeCreate}
        >
          <form
            className="modal-panel modal-panel--wide"
            role="dialog"
            aria-modal="true"
            aria-label={t('إنشاء قاعدة منفذ جديدة')}
            onSubmit={handleCreateSubmit}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-panel__head">
              <span className="modal-panel__title">
                <Waypoints size={18} />
                {t('إنشاء قاعدة منفذ جديدة')}
              </span>
              <button
                type="button"
                className="modal-panel__close"
                onClick={closeCreate}
                disabled={checking || claiming}
                aria-label={t('إغلاق نافذة إنشاء قاعدة المنفذ')}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-panel__body">
              <p className="ports-modal-lead">
                {t('احجز منفذاً حصرياً لمشروعك لمنع تداخل المستخدمين. يمكنك فحص التوفر قبل الحجز، وسيحتفظ النظام بالحجز في قاعدة البيانات.')}
              </p>

              {formError && <div className="form-error">{formError}</div>}

              <div className="form-grid">
                <div className="form-grid form-grid--2">
                  <label className="ui-label">
                    {t('رقم المنفذ')}
                    <input
                      className="ui-input"
                      dir="ltr"
                      inputMode="numeric"
                      value={formPort}
                      onChange={(event) => {
                        setFormPort(event.target.value);
                        setCheckResult(null);
                        setFormError(null);
                      }}
                      placeholder="3000"
                      autoFocus
                    />
                  </label>

                  <label className="ui-label">
                    {t('اسم المشروع')}
                    <input
                      className="ui-input"
                      value={formProject}
                      onChange={(event) => {
                        setFormProject(event.target.value);
                        setFormError(null);
                      }}
                      placeholder={t('مثال: متجر أساس / نظام ERP')}
                    />
                  </label>
                </div>

                <div className="ports-port-chips">
                  <span>{t('فحص سريع:')}</span>
                  {QUICK_PORTS.map((port) => (
                    <button
                      key={port}
                      type="button"
                      className={`ports-port-chip${
                        formPort === String(port) ? ' active' : ''
                      }`}
                      onClick={() => {
                        setFormPort(String(port));
                        setCheckResult(null);
                        setFormError(null);
                      }}
                    >
                      {port}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="btn-gold-outline"
                  onClick={() => void handleCheck()}
                  disabled={checking || claiming}
                >
                  {checking ? (
                    <RefreshCw size={14} className="spin" />
                  ) : (
                    <ShieldCheck size={14} />
                  )}
                  {checking ? t('جارٍ فحص المنفذ…') : t('فحص توفر المنفذ')}
                </button>

                {checkResult && (
                  <div
                    className={`ports-check-result ${
                      checkResult.available ? 'ok' : 'bad'
                    }`}
                  >
                    <div className="ports-check-result__head">
                      {checkResult.available ? (
                        <CheckCircle2 size={16} />
                      ) : (
                        <AlertTriangle size={16} />
                      )}
                      <strong>
                        {checkResult.available
                          ? `${t('المنفذ ')}${checkResult.requested_port ?? formPort}${t(' شاغر ومتاح')}`
                          : `${t('المنفذ ')}${checkResult.requested_port ?? formPort}${t(' غير متاح')}`}
                      </strong>
                    </div>
                    <p>
                      {checkResult.available
                        ? checkResult.message
                        : `${t('المنفذ ')}${checkResult.requested_port ?? formPort}${t(' غير متاح حالياً على السيرفر. لم يتم إجراء أي حجز بعد — اعتمد المنفذ البديل أو غيّر الرقم، ثم أكّد الحجز.')}`}
                    </p>
                    {!checkResult.available && checkResult.current_owner && (
                      <p className="ports-check-result__owner">
                        {t('المالك الحالي:')} <span dir="ltr">{checkResult.current_owner}</span>
                      </p>
                    )}
                    {!checkResult.available && checkResult.suggested_port && (
                      <div className="ports-suggestion">
                        <span>{t('المنفذ البديل المقترح:')}</span>
                        <button
                          type="button"
                          className="ports-suggestion__port"
                          onClick={() => adoptPort(checkResult.suggested_port as number)}
                        >
                          {checkResult.suggested_port}
                        </button>
                        {checkResult.alternatives &&
                          checkResult.alternatives.filter(
                            (port) => port !== checkResult.suggested_port,
                          ).length > 0 && (
                            <span className="ports-suggestion__alts">
                              {t('بدائل')}
                              {checkResult.alternatives
                                .filter((port) => port !== checkResult.suggested_port)
                                .slice(0, 3)
                                .map((port) => (
                                  <button
                                    key={port}
                                    type="button"
                                    onClick={() => adoptPort(port)}
                                  >
                                    {port}
                                  </button>
                                ))}
                            </span>
                          )}
                      </div>
                    )}
                  </div>
                )}

                <p className="ports-form-hint">
                  {autoAllocate
                    ? t('التوزيع التلقائي مفعّل: عند تعارض المنفذ سيُعتمد المنفذ البديل المقترح تلقائياً عند الحجز.')
                    : t('التوزيع التلقائي متوقف: يمكنك اعتماد المنفذ البديل المقترح يدوياً قبل الحجز.')}
                </p>
              </div>
            </div>

            <div className="modal-panel__actions">
              <button
                type="submit"
                className="btn-gold-solid"
                disabled={checking || claiming}
              >
                {claiming ? (
                  <RefreshCw size={15} className="spin" />
                ) : (
                  <Plus size={15} />
                )}
                {claiming
                  ? t('جارٍ حجز المنفذ…')
                  : `${t('حجز المنفذ ')}${formPort || ''}`}
              </button>
              <button
                type="button"
                className="btn-dark"
                onClick={closeCreate}
                disabled={checking || claiming}
              >
                {t('إلغاء')}
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmState && confirmation && (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={() => {
            if (!confirmBusy) setConfirmState(null);
          }}
        >
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-label={confirmation.title}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-panel__head">
              <span className="modal-panel__title">
                <AlertTriangle size={18} />
                {confirmation.title}
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
              <p style={{ margin: 0 }}>{confirmation.description}</p>
              <div className="modal-warning">
                <AlertCircle size={14} />
                {confirmation.warning}
              </div>
            </div>

            <div className="modal-panel__actions">
              <button
                type="button"
                className="btn-danger-soft"
                onClick={() => void executeConfirm()}
                disabled={confirmBusy}
              >
                {confirmBusy ? (
                  <RefreshCw size={14} className="spin" />
                ) : (
                  <AlertTriangle size={14} />
                )}
                {confirmBusy ? t('جارٍ التنفيذ…') : confirmation.action}
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
