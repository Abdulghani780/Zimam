import { useState, useEffect } from 'react';
import { api, type AssetItem } from '../lib/api';

const PROTOCOLS = [
  { id: 'rdp', name: 'RDP', full: 'Remote Desktop', port: 3389, icon: 'desktop_windows', color: '#38bdf8' },
  { id: 'ssh', name: 'SSH', full: 'Secure Shell', port: 22, icon: 'terminal', color: '#22c55e' },
  { id: 'sftp', name: 'SFTP', full: 'File Transfer', port: 22, icon: 'folder_shared', color: '#f59e0b' },
  { id: 'vnc', name: 'VNC', full: 'Virtual Network', port: 5900, icon: 'monitor', color: '#818cf8' },
  { id: 'winrm', name: 'WinRM', full: 'Windows Remote', port: 5985, icon: 'settings_remote', color: '#4ade80' },
  { id: 'database', name: 'Database', full: 'SQL Client', port: 1433, icon: 'database', color: '#facc15' },
];

export function BastionPage() {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [selectedProtocol, setSelectedProtocol] = useState<string>('all');
  const [testCommand, setTestCommand] = useState<string>('netstat -ano');
  const [aclResult, setAclResult] = useState<any>(null);
  const [evaluating, setEvaluating] = useState(false);

  // Quick connect input
  const [quickHost, setQuickHost] = useState('');
  const [quickUser, setQuickUser] = useState('Administrator');
  const [quickProto, setQuickProto] = useState('RDP');

  useEffect(() => {
    api
      .getAssets()
      .then((items) => {
        if (Array.isArray(items)) {
          setAssets(items);
        }
      })
      .catch((err) => console.error('Failed to load assets:', err));
  }, []);

  const handleEvaluateCommand = async () => {
    if (!testCommand.trim()) return;
    setEvaluating(true);
    try {
      const res = await fetch('/api/security/evaluate-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: testCommand }),
      });
      const data = await res.json();
      setAclResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setEvaluating(false);
    }
  };

  const handleQuickLaunch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickHost) return;
    alert(`إطلاق اتصال ${quickProto} فوري بالسيرفر: ${quickHost} بمستخدم ${quickUser}`);
  };

  const filteredAssets =
    selectedProtocol === 'all'
      ? assets
      : assets.filter((a: any) =>
          (a.protocol || a.type || '').toLowerCase().includes(selectedProtocol.toLowerCase())
        );

  return (
    <div className="flex flex-col w-full space-y-space-lg select-none">
      {/* 1. Bastion Sovereign Hero */}
      <div className="relative overflow-hidden rounded-xl bg-surface-glass backdrop-blur-2xl p-space-md lg:p-space-lg shadow-xl border border-gold-rim/30">
        <div className="absolute -top-24 -left-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 right-1/4 w-80 h-80 bg-gold-glow/5 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-space-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-status-safe shadow-[0_0_10px_#22c55e]"></span>
              <span className="font-telemetry-mono-sm text-telemetry-mono-sm text-primary uppercase tracking-widest">
                ZERO-TRUST JUMPSERVER BASTION
              </span>
              <span className="text-text-muted text-caption">/</span>
              <span className="font-caption text-caption text-text-muted">بوابة الوصول المتميز الموحدة</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-text-titles font-bold tracking-tight">
              حصن الوصول السريع والتحكم الموحد (JumpServer PAM)
            </h1>
            <p className="font-body-base text-body-base text-text-muted">
              اتصال آمن ببروتوكولات RDP و SSH و SFTP و VNC و Database دون الحاجة لفتح منافذ خارجية في الجدار الناري، مع تشفير الجلسة وتسجيل فيديو التدقيق بالكامل.
            </p>
          </div>

          <div className="flex items-center gap-space-sm">
            <div className="bg-surface-container-low px-space-md py-2 rounded-xl border border-gold-rim/20 text-right">
              <span className="font-caption text-caption text-text-muted block">حالة درع الحصن</span>
              <span className="font-telemetry-mono text-telemetry-mono text-status-safe font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-status-safe animate-pulse"></span>
                ACTIVE SECURE ENCLAVE
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Protocol Filter Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-space-sm">
        <div
          onClick={() => setSelectedProtocol('all')}
          className={`p-space-sm rounded-xl border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 text-center ${
            selectedProtocol === 'all'
              ? 'bg-primary-container/20 border-primary shadow-[0_0_16px_rgba(240,190,56,0.3)]'
              : 'bg-surface-glass backdrop-blur-2xl border-gold-rim/20 hover:border-gold-rim/40'
          }`}
        >
          <span className="material-symbols-outlined text-[24px] text-primary">dns</span>
          <span className="font-title-sm text-title-sm text-text-titles font-bold">جميع الأصول</span>
          <span className="font-caption text-caption text-text-muted">{assets.length} خوادم</span>
        </div>

        {PROTOCOLS.map((proto) => {
          const isSelected = selectedProtocol === proto.id;
          const count = assets.filter((a: any) =>
            (a.protocol || a.type || '').toLowerCase().includes(proto.id)
          ).length;

          return (
            <div
              key={proto.id}
              onClick={() => setSelectedProtocol(proto.id)}
              className={`p-space-sm rounded-xl border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 text-center ${
                isSelected
                  ? 'bg-primary-container/20 border-primary shadow-[0_0_16px_rgba(240,190,56,0.3)]'
                  : 'bg-surface-glass backdrop-blur-2xl border-gold-rim/20 hover:border-gold-rim/40'
              }`}
            >
              <span className="material-symbols-outlined text-[24px]" style={{ color: proto.color }}>
                {proto.icon}
              </span>
              <span className="font-title-sm text-title-sm text-text-titles font-bold">{proto.name}</span>
              <span className="font-caption text-caption text-text-muted">
                :{proto.port} ({count})
              </span>
            </div>
          );
        })}
      </div>

      {/* 3. Main Tactical Grid: Managed Assets + Fast Launchpad & Risk Guard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        {/* Managed Assets List (7 Cols) */}
        <div className="lg:col-span-7 relative bg-surface-glass backdrop-blur-2xl rounded-xl p-space-md border border-gold-rim/30 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-space-sm border-b border-gold-rim/20 mb-space-md">
              <div>
                <h2 className="font-headline-sm text-headline-sm text-text-titles font-bold">
                  الأصول والخوادم المدارة في الحصن ({filteredAssets.length})
                </h2>
                <span className="font-caption text-caption text-text-muted">
                  اتصال موحد مشفر بدون الحاجة لبرامج وسيطة
                </span>
              </div>
            </div>

            <div className="space-y-space-sm">
              {filteredAssets.length === 0 ? (
                <div className="py-8 text-center text-text-muted">
                  لا توجد خوادم مسجلة لهذا البروتوكول
                </div>
              ) : (
                filteredAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="p-space-sm rounded-lg bg-surface-container-lowest border border-gold-rim/20 flex items-center justify-between hover:border-primary/50 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-[22px]">terminal</span>
                      </div>
                      <div>
                        <h3 className="font-title-sm text-title-sm text-text-titles font-bold">
                          {asset.name}
                        </h3>
                        <span className="font-telemetry-mono-sm text-telemetry-mono-sm text-text-muted dir-ltr">
                          {asset.host}:{asset.port || 3389}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-status-safe-surface text-status-safe">
                        Online
                      </span>
                      <button
                        type="button"
                        onClick={() => alert(`بدء جلسة JumpServer PAM مشفرة مع ${asset.name}`)}
                        className="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-bold text-xs hover:shadow-[0_0_12px_rgba(240,190,56,0.4)] transition-all cursor-pointer flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[15px]">play_arrow</span>
                        <span>اتصال آمن</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Fast Launchpad & Risk Guard (5 Cols) */}
        <div className="lg:col-span-5 space-y-space-md">
          {/* Fast Connect Launchpad */}
          <div className="relative bg-surface-glass backdrop-blur-2xl rounded-xl p-space-md border border-gold-rim/30 shadow-xl">
            <h2 className="font-headline-sm text-headline-sm text-text-titles font-bold mb-space-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">rocket_launch</span>
              الاتصال السريع المباشر (Quick Launch)
            </h2>

            <form onSubmit={handleQuickLaunch} className="space-y-3">
              <div>
                <label className="block font-caption text-caption text-text-muted mb-1">
                  عنوان السيرفر (Host / IP):
                </label>
                <input
                  type="text"
                  value={quickHost}
                  onChange={(e) => setQuickHost(e.target.value)}
                  placeholder="192.168.1.100 أو server.internal"
                  className="w-full bg-surface-container-lowest text-text-titles font-telemetry-mono text-telemetry-mono p-2 rounded-lg border border-gold-rim/30 focus:outline-none focus:border-primary dir-ltr text-right text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-caption text-caption text-text-muted mb-1">
                    المستخدم:
                  </label>
                  <input
                    type="text"
                    value={quickUser}
                    onChange={(e) => setQuickUser(e.target.value)}
                    placeholder="Administrator"
                    className="w-full bg-surface-container-lowest text-text-titles font-body-sm p-2 rounded-lg border border-gold-rim/30 focus:outline-none focus:border-primary dir-ltr text-right text-xs"
                  />
                </div>

                <div>
                  <label className="block font-caption text-caption text-text-muted mb-1">
                    البروتوكول:
                  </label>
                  <select
                    value={quickProto}
                    onChange={(e) => setQuickProto(e.target.value)}
                    className="w-full bg-surface-container-lowest text-text-titles font-body-sm p-2 rounded-lg border border-gold-rim/30 focus:outline-none focus:border-primary text-xs"
                  >
                    <option value="RDP">RDP (3389)</option>
                    <option value="SSH">SSH (22)</option>
                    <option value="SFTP">SFTP (22)</option>
                    <option value="VNC">VNC (5900)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-primary text-on-primary font-bold text-xs hover:shadow-[0_0_16px_rgba(240,190,56,0.4)] transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">launch</span>
                <span>فتح جلسة اتصال فورية عبر الحصن</span>
              </button>
            </form>
          </div>

          {/* Command Risk ACL Evaluator */}
          <div className="relative bg-surface-glass backdrop-blur-2xl rounded-xl p-space-md border border-gold-rim/30 shadow-xl">
            <h2 className="font-headline-sm text-headline-sm text-text-titles font-bold mb-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-core-06 text-[22px]">gavel</span>
              محلل مخاطر الأوامر (Command Risk Guard)
            </h2>
            <p className="font-caption text-caption text-text-muted mb-3">
              فحص أوامر الطرفية قبل تنفيذها واعتراض الأوامر التدميرية
            </p>

            <div className="space-y-3">
              <input
                type="text"
                value={testCommand}
                onChange={(e) => setTestCommand(e.target.value)}
                placeholder="الأمر: مثال netstat -ano أو format c:"
                className="w-full bg-surface-container-lowest text-text-titles font-telemetry-mono text-telemetry-mono p-2 rounded-lg border border-gold-rim/30 focus:outline-none focus:border-primary dir-ltr text-xs"
              />

              <button
                type="button"
                onClick={handleEvaluateCommand}
                disabled={evaluating}
                className="w-full py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs border border-gold-rim/30 transition-all flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">security</span>
                <span>{evaluating ? 'جارٍ التحليل السيبراني...' : 'تقييم خطورة الأمر'}</span>
              </button>

              {aclResult && (
                <div
                  className={`p-2.5 rounded-lg border text-xs ${
                    aclResult.allowed
                      ? 'bg-status-safe-surface border-status-safe/40 text-status-safe'
                      : 'bg-status-danger-surface border-status-danger/40 text-status-danger'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1 mb-1">
                    <span className="material-symbols-outlined text-[16px]">
                      {aclResult.allowed ? 'check_circle' : 'block'}
                    </span>
                    <span>{aclResult.allowed ? 'الأمر مصرح به (Safe Command)' : 'الأمر محظور ومرفوض أمنياً!'}</span>
                  </div>
                  <p className="text-text-muted">{aclResult.reason || 'اجتاز فحص السياسات الأمنية'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
