import { useEffect, useState } from 'react';
import { LockKeyhole, ShieldCheck, Plus, Trash2, Eye, Copy, RefreshCw, Key } from 'lucide-react';
import { apiV1, type V1Account, type V1Asset } from '../lib/apiV1';
import { Card, Button, Modal, TextInput, useToast } from '../asaas-ui';
import { t } from '../lib/i18n';

interface VaultRow {
  id: string;
  asset_id: string;
  asset_name: string;
  username: string;
  protocol: string;
  created_at?: string;
}

const PROTOCOL_OPTIONS: { value: string; label: string }[] = [
  { value: 'rdp', label: 'Remote Desktop (RDP - 3389)' },
  { value: 'ssh', label: 'Secure Shell (SSH - 22)' },
  { value: 'sftp', label: 'SFTP Transfer' },
  { value: 'winrm', label: 'Windows Remote Management (WinRM - 5985)' },
  { value: 'vnc', label: 'Virtual Network Computing (VNC)' },
  { value: 'telnet', label: 'Telnet (legacy)' },
];

export function VaultPage() {
  const toast = useToast();
  const [accounts, setAccounts] = useState<VaultRow[]>([]);
  const [assets, setAssets] = useState<V1Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [revealModalOpen, setRevealModalOpen] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<{ username: string; secret: string; asset: string } | null>(null);

  // Form states
  const [assetName, setAssetName] = useState('');
  const [username, setUsername] = useState('');
  const [protocol, setProtocol] = useState('rdp');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const normalize = <T,>(res: T[] | { items?: T[] } | unknown): T[] =>
    Array.isArray(res) ? res : Array.isArray((res as { items?: T[] })?.items) ? (res as { items: T[] }).items : [];

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const [assetRes, accountRes] = await Promise.all([apiV1.assets(), apiV1.accounts()]);
      const assetList = normalize<V1Asset>(assetRes as V1Asset[] | { assets?: V1Asset[] });
      const accountList = normalize<V1Account>(accountRes as V1Account[] | { accounts?: V1Account[] });
      const assetNames = new Map(assetList.map((a) => [a.id, a.name]));
      setAssets(assetList);
      setAccounts(
        accountList.map((a) => ({
          id: a.id,
          asset_id: a.asset_id,
          asset_name: a.asset_name || assetNames.get(a.asset_id) || a.asset_id,
          username: a.username,
          protocol: a.protocol,
          created_at: a.created_at,
        })),
      );
    } catch (err: any) {
      toast(err.message || t('فشل جلب اعتمادات الخزنة'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetName || !username || !password) {
      toast(t('يرجى ملء جميع الحقول المطلوبة'), 'error');
      return;
    }
    setSubmitting(true);
    try {
      // Find-or-create the asset, then store the vault-bound account secret.
      const wanted = assetName.trim();
      let asset = assets.find((a) => a.name.trim().toLowerCase() === wanted.toLowerCase())
        || assets.find((a) => a.hostname.trim().toLowerCase() === wanted.toLowerCase());
      if (!asset) {
        asset = await apiV1.createAsset({ name: wanted, hostname: wanted });
        setAssets((prev) => [...prev, asset as V1Asset]);
      }
      await apiV1.createAccount({
        asset_id: asset.id,
        name: username.trim(),
        username: username.trim(),
        protocol: protocol as 'rdp' | 'ssh' | 'sftp' | 'winrm' | 'vnc' | 'telnet',
        secret: password,
      });
      toast(`${t('تم تشفير وحفظ اعتماد [')}${username}${t('] بنجاح بواسطة AES-256-GCM')}`, 'success');
      setAddModalOpen(false);
      setAssetName('');
      setUsername('');
      setPassword('');
      fetchAccounts();
    } catch (err: any) {
      toast(err.message || t('فشل إضافة الاعتماد'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReveal = async (id: string, name: string) => {
    try {
      const res = await apiV1.revealAccountSecret(id);
      if (res?.secret) {
        setRevealedSecret({
          username: res.username || '',
          secret: res.secret,
          asset: res.asset_name || name,
        });
        setRevealModalOpen(true);
      } else {
        toast(t('تعذّر كشف كلمة المرور'), 'error');
      }
    } catch (err: any) {
      toast(err.message || t('فشل استرجاع السر'), 'error');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`${t('هل أنت متأكد من حذف الاعتماد المشفّر لـ [')}${name}${t(']؟')}`)) return;
    try {
      await apiV1.deleteAccount(id);
      toast(t('تم حذف الاعتماد من الخزنة بنجاح'), 'success');
      fetchAccounts();
    } catch (err: any) {
      toast(err.message || t('فشل حذف الاعتماد'), 'error');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast(t('تم نسخ كلمة المرور إلى الحافظة بنجاح'), 'success');
  };

  return (
    <div dir="rtl" className="page">
      {/* Hero Header */}
      <section className="page-head-hero">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--paid)', fontWeight: 700, fontSize: 13 }}>
            <ShieldCheck size={16} /> {t('خزنة السيادة المركزية (Sovereign Encrypted Vault)')}
          </div>
          <h1 style={{ margin: '8px 0 6px', fontSize: 24, color: 'var(--text-1)' }}>{t('حسابات الأصول والاعتمادات المشفرة')}</h1>
          <p style={{ margin: 0, color: 'var(--text-2)', lineHeight: 1.6, maxWidth: 860, fontSize: 14 }}>
            {t('إدارة مركزية لكلمات مرور Windows Server، جلسات RDP، مفاتيح SSH، وسجلات Docker المشفرة بمفتاح AES-256-GCM المستقل ومراقبة بسجل Merkle.')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button
            variant="ghost"
            label={t('تحديث')}
            iconNode={<RefreshCw size={15} className={loading ? 'spin' : ''} />}
            onClick={fetchAccounts}
          />
          <Button
            variant="primary"
            label={t('إضافة اعتماد مشفر')}
            iconNode={<Plus size={15} />}
            onClick={() => setAddModalOpen(true)}
          />
        </div>
      </section>

      {/* Accounts List Card */}
      <Card
        title={`${t('الاعتمادات المسجلة في الخزنة (')}${accounts.length})`}
      >
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-2)' }}>
          {t('كافة الأسرار مشفرة في قاعدة البيانات بواسطة AES-256-GCM وتتطلب صلاحية مسؤول لكشفها أو استخدامها')}
        </p>
        {accounts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-2)' }}>
            <Key size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <p>{t('لا توجد اعتمادات مسجلة حالياً في الخزنة.')}</p>
            <Button
              variant="outline"
              label={t('إضافة الاعتماد الأول')}
              onClick={() => setAddModalOpen(true)}
              style={{ marginTop: 10 }}
            />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-rim)', textAlign: 'right' }}>
                  <th style={{ padding: '12px 14px', color: 'var(--text-2)', fontSize: 13 }}>{t('الأصل / الخادم')}</th>
                  <th style={{ padding: '12px 14px', color: 'var(--text-2)', fontSize: 13 }}>{t('اسم الحساب')}</th>
                  <th style={{ padding: '12px 14px', color: 'var(--text-2)', fontSize: 13 }}>{t('البروتوكول')}</th>
                  <th style={{ padding: '12px 14px', color: 'var(--text-2)', fontSize: 13 }}>{t('خوارزمية التشفير')}</th>
                  <th style={{ padding: '12px 14px', color: 'var(--text-2)', fontSize: 13 }}>{t('آخر تحديث')}</th>
                  <th style={{ padding: '12px 14px', color: 'var(--text-2)', fontSize: 13, textAlign: 'center' }}>{t('الإجراءات')}</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc) => (
                  <tr key={acc.id} style={{ borderBottom: '1px solid var(--glass-rim-low)' }}>
                    <td style={{ padding: '14px', fontWeight: 600, color: 'var(--text-1)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <LockKeyhole size={15} color="var(--accent)" />
                        {acc.asset_name || acc.asset_id}
                      </div>
                    </td>
                    <td style={{ padding: '14px', direction: 'ltr', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-1)' }}>
                      {acc.username}
                    </td>
                    <td style={{ padding: '14px' }}>
                      <span className="badge badge--info" style={{ fontWeight: 700, fontSize: 11 }}>
                        {acc.protocol?.toUpperCase() || 'RDP'}
                      </span>
                    </td>
                    <td style={{ padding: '14px', color: 'var(--paid)', fontSize: 12, fontWeight: 600 }}>
                      AES-256-GCM
                    </td>
                    <td style={{ padding: '14px', color: 'var(--text-2)', fontSize: 12 }}>
                      {acc.created_at ? acc.created_at.split('T')[0] : '—'}
                    </td>
                    <td style={{ padding: '14px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          iconNode={<Eye size={14} />}
                          label={t('كشف')}
                          onClick={() => handleReveal(acc.id, acc.asset_name || acc.username)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          iconNode={<Trash2 size={14} color="var(--status-danger)" />}
                          label={t('حذف')}
                          onClick={() => handleDelete(acc.id, acc.asset_name || acc.username)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add Modal */}
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title={t('إضافة اعتماد مشفر جديد إلى الخزنة')}
      >
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-1)', fontWeight: 600 }}>
              {t('اسم الأصل أو الخادم*')}
            </label>
            <TextInput
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              placeholder={t('مثال: SRV-PROD-LOCAL أو PostgreSQL Cluster')}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-1)', fontWeight: 600 }}>
              {t('اسم المستخدم (Username)*')}
            </label>
            <TextInput
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Administrator"
              dir="ltr"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-1)', fontWeight: 600 }}>
              {t('نوع البروتوكول / التطبيق*')}
            </label>
            <select
              value={protocol}
              onChange={(e) => setProtocol(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                background: 'var(--surface-ground)',
                border: '1px solid var(--glass-rim)',
                color: 'var(--text-1)',
                fontSize: 13,
                outline: 'none',
              }}
            >
              {PROTOCOL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-1)', fontWeight: 600 }}>
              {t('كلمة المرور أو المفتاح السري*')}
            </label>
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              dir="ltr"
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
            <Button variant="ghost" label={t('إلغاء')} onClick={() => setAddModalOpen(false)} />
            <Button
              variant="primary"
              label={submitting ? t('جارٍ التشفير...') : t('حفظ مشفراً (AES-256)')}
              type="submit"
              disabled={submitting}
            />
          </div>
        </form>
      </Modal>

      {/* Reveal Modal */}
      <Modal
        open={revealModalOpen}
        onClose={() => {
          setRevealModalOpen(false);
          setRevealedSecret(null);
        }}
        title={t('كشف الاعتماد المشفّر')}
      >
        {revealedSecret && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: 14, borderRadius: 10, background: 'var(--glass-tint-strong)', border: '1px solid var(--accent-soft)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>{t('الأصل')}</div>
              <div style={{ fontWeight: 700, color: 'var(--text-1)' }}>{revealedSecret.asset}</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8, marginBottom: 4 }}>{t('المستخدم')}</div>
              <div style={{ fontFamily: 'monospace', color: 'var(--text-1)' }}>{revealedSecret.username}</div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-1)', fontWeight: 600 }}>
                {t('كلمة المرور المفكوكة')}
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <TextInput
                  value={revealedSecret.secret}
                  readOnly
                  dir="ltr"
                  style={{ fontFamily: 'monospace', fontWeight: 600 }}
                />
                <Button
                  variant="primary"
                  iconNode={<Copy size={15} />}
                  label={t('نسخ')}
                  onClick={() => copyToClipboard(revealedSecret.secret)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <Button
                variant="ghost"
                label={t('إغلاق النافذة')}
                onClick={() => {
                  setRevealModalOpen(false);
                  setRevealedSecret(null);
                }}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
