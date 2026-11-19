/**
 * ASAAS v2.5 - Screens _4 & _12
 * إعدادات المنظومة وتنبيهات تيليجرام الفورية والربط السيبراني ومصفوفة الإنذارات
 * Strict implementation of Stitch Prototypes _4 & _12
 */

import { useState, useEffect } from 'react';
import { Card, Button, Glass, Field, TextInput, useToast } from '../asaas-ui';
import { api } from '../lib/api';
import { apiV1 } from '../lib/apiV1';
import {
  Send,
  CheckCircle2,
  Clock,
  Save,
  MessageSquare,
} from 'lucide-react';
import { t } from '../lib/i18n';

export function SettingsPage() {
  const toast = useToast();
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [cooldownMinutes, setCooldownMinutes] = useState('15');
  const [cpuThreshold, setCpuThreshold] = useState('85');
  const [ramThreshold, setRamThreshold] = useState('90');
  const [diskThreshold, setDiskThreshold] = useState('90');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Stitch _12 Alert Rules Matrix Toggles
  const [ruleBruteForce, setRuleBruteForce] = useState(true);
  const [ruleCommandRisk, setRuleCommandRisk] = useState(true);
  const [rulePortFlood, setRulePortFlood] = useState(true);
  const [ruleServiceCrash, setRuleServiceCrash] = useState(true);
  
  const fetchSettings = async () => {
    setSettingsError(null);
    try {
      const cfg = await api.getAlertsConfig();
      if (cfg && cfg.config) {
        setTelegramEnabled(Boolean(cfg.config.telegram_enabled));
        setBotToken(cfg.config.bot_token_masked || cfg.config.bot_token || '');
        setChatId(cfg.config.chat_id || '');
        setCooldownMinutes(String(cfg.config.cooldown_minutes || 15));
        setCpuThreshold(String(cfg.config.cpu_threshold || 85));
        setRamThreshold(String(cfg.config.ram_threshold || 90));
        setDiskThreshold(String(cfg.config.disk_threshold || 90));
        setRuleBruteForce(cfg.config.rule_brute_force ?? true);
        setRuleCommandRisk(cfg.config.rule_command_risk ?? true);
        setRulePortFlood(cfg.config.rule_port_flood ?? true);
        setRuleServiceCrash(cfg.config.rule_service_crash ?? true);
      }
      setSettingsLoaded(true);
    } catch (err: any) {
      setSettingsLoaded(false);
      setSettingsError(err.message || t('تعذر تحميل إعدادات التنبيه.'));
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveTelegram = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      await api.saveAlertsConfig({
        telegram_enabled: telegramEnabled,
        bot_token: botToken,
        chat_id: chatId,
        cooldown_minutes: parseInt(cooldownMinutes, 10) || 15,
        cpu_threshold: parseFloat(cpuThreshold) || 85,
        ram_threshold: parseFloat(ramThreshold) || 90,
        disk_threshold: parseFloat(diskThreshold) || 90,
        rule_brute_force: ruleBruteForce,
        rule_command_risk: ruleCommandRisk,
        rule_port_flood: rulePortFlood,
        rule_service_crash: ruleServiceCrash,
      } as any);
      await fetchSettings();
      toast(t('تم حفظ إعدادات المنظومة ومصفوفة الإنذارات في قاعدة البيانات بنجاح.'), 'success');
    } catch (err: any) {
      toast(err.message || t('خطأ أثناء الحفظ'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestAlert = async () => {
    setTesting(true);
    try {
      const res = await api.testAlert(t('اختبار إشعار فوري من لوحة تحكم سيرفرات أساس (ASAAS v2.5)'));
      if (res.ok) {
        toast(t('تم إرسال إشعار التجربة لهاتفك عبر تيليجرام بنجاح!'), 'success');
      } else {
        toast(res.reason || res.error || t('فشل إرسال التجربة، تأكد من صحة الرمز ومعرف المحادثة.'), 'error');
      }
    } catch (err: any) {
      toast(err.message || t('خطأ أثناء إرسال التجربة'), 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const res: any = await apiV1.backup();
      const sizeKb = res?.size_bytes ? Math.round(res.size_bytes / 1024) : 0;
      if (res?.replication?.error) {
        toast(`${t('تم إنشاء النسخة المحلية، لكن فشل النسخ الخارجي')}: ${res.replication.error}`, 'warn');
      } else {
        toast(`${t('تم إنشاء النسخة الاحتياطية')}: ${res?.file || ''} (${sizeKb} KB)`, 'success');
      }
    } catch (err: any) {
      toast(err?.message || t('خطأ أثناء إنشاء النسخة الاحتياطية'), 'error');
    } finally {
      setBackingUp(false);
    }
  };

  const telegramConfigured = settingsLoaded && Boolean(botToken.trim() && chatId.trim());

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                <CheckCircle2 size={13} />
                {settingsError ? t('حالة التنبيه غير متاحة') : telegramConfigured ? t('تم تكوين قناة Telegram؛ لم يُختبر التسليم بعد') : t('قناة Telegram غير مكتملة الإعداد')}
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
                Telegram Enterprise Bot API
              </span>
            </div>

            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>
              {t('إعدادات المنظومة وتنبيهات تيليجرام الفورية والربط السيبراني')}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0, maxWidth: 840, lineHeight: 1.6 }}>
              {t('ربط فوري بهواتف فريق العمليات عبر قنوات مشفرة لتلقي إشعارات انقطاع الخدمات، محاولات التسلل، وتجاوز حدود استهلاك المعالج والذاكرة مع منع التكرار المزعج (Smart Cooldown).')}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Button
              size="sm"
              variant="glass"
              loading={testing}
              onClick={handleTestAlert}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Send size={13} color="var(--accent)" />
              <span>{t('إرسال تنبيه تجريبي')}</span>
            </Button>
            <Button
              size="sm"
              variant="primary"
              loading={saving}
              onClick={() => handleSaveTelegram()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Save size={13} />
              <span>{t('حفظ وتطبيق التغييرات فوراً')}</span>
            </Button>
          </div>
        </div>
      </div>

      {settingsError && (
        <Glass style={{ padding: 16, color: 'var(--unpaid)' }} role="alert">
          {settingsError}
          <Button size="sm" variant="ghost" onClick={() => void fetchSettings()} style={{ marginInlineStart: 12 }}>{t('إعادة المحاولة')}</Button>
        </Glass>
      )}

      {/* 2. Top Grid: Telegram Config (7 cols) & Cooldown Window (5 cols) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 20 }}>
        {/* Column 1: Telegram Channels (7 cols) */}
        <div style={{ gridColumn: 'span 7', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Glass style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'var(--status-info-surface)',
                    border: '1px solid var(--status-info-surface)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--chart-out)',
                  }}
                >
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
                    {t('قنوات الإخطار والتسليم الفوري (Instant Delivery Channels)')}
                  </h2>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    {t('تسليم التنبيهات الحرجة عبر بروتوكول HTTPS المشفر لهاتف المسؤول')}
                  </span>
                </div>
              </div>

              <label className="toggle-switch">
                <input
                  type="checkbox"
                  aria-label={t('تفعيل قنوات الإخطار الفوري')}
                  checked={telegramEnabled}
                  onChange={(e) => setTelegramEnabled(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <form onSubmit={handleSaveTelegram} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label={t('رمز البوت (Telegram Bot Token)')} hint={t('رمز البوت الخاص بك من @BotFather (مشفر ومحمي)')}>
                {(id) => (
                  <TextInput
                    id={id}
                    type="password"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder={t('مثال: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ')}
                  />
                )}
              </Field>

              <Field label={t('معرف المحادثة أو القناة (Telegram Chat ID)')} hint={t('معرف حسابك أو قناة الإشعارات الخاصة بالسيرفر')}>
                {(id) => (
                  <TextInput
                    id={id}
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    placeholder={t('مثال: 987654321 أو -100123456789')}
                  />
                )}
              </Field>

              {/* Delivery Channels status */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 4 }}>
                <div style={{ padding: 10, borderRadius: 8, background: 'var(--shadow-soft)', border: '1px solid var(--status-info-surface)' }}>
                  <span style={{ fontSize: 10, color: 'var(--chart-out)', fontWeight: 700, display: 'block' }}>● Telegram Bot</span>
                  <span style={{ fontSize: 11, color: 'var(--text-1)' }}>{telegramEnabled ? (telegramConfigured ? t('مفعّل؛ التسليم يتطلب اختباراً ناجحاً') : t('مفعّل لكن بيانات البوت ناقصة')) : t('معطّل')}</span>
                </div>
                <div style={{ padding: 10, borderRadius: 8, background: 'var(--shadow-soft)', border: '1px solid var(--glass-rim-low)' }}>
                  <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, display: 'block' }}>● Windows Event Log</span>
                  <span style={{ fontSize: 11, color: 'var(--text-1)' }}>{t('قيد التوثيق الحتمي')}</span>
                </div>
                <div style={{ padding: 10, borderRadius: 8, background: 'var(--shadow-soft)', border: '1px solid var(--glass-rim-low)' }}>
                  <span style={{ fontSize: 10, color: 'var(--paid)', fontWeight: 700, display: 'block' }}>● Forensic Audit Ledger</span>
                  <span style={{ fontSize: 11, color: 'var(--text-1)' }}>{t('SHA-256 موثق')}</span>
                </div>
              </div>
            </form>
          </Glass>
        </div>

        {/* Column 2: Smart Cooldown & Thresholds (5 cols) */}
        <div style={{ gridColumn: 'span 5', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Glass style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'var(--accent-soft)',
                  border: '1px solid var(--accent-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent)',
                }}
              >
                <Clock size={20} />
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
                  {t('نافذة الهدوء والجدولة الذكية (Smart Cooldown)')}
                </h2>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {t('منع تكرار الإشعارات المتطابقة لنفس الحدث خلال نافذة زمنية')}
                </span>
              </div>
            </div>

            {/* Cooldown Selection Chips (Stitch _12) */}
            <div style={{ display: 'flex', gap: 8 }}>
              {['10', '15', '30', '60'].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setCooldownMinutes(mins)}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: cooldownMinutes === mins ? '1px solid var(--accent)' : '1px solid transparent',
                    background: cooldownMinutes === mins ? 'var(--accent-soft)' : 'var(--glass-rim-low)',
                    color: cooldownMinutes === mins ? 'var(--accent)' : 'var(--text-3)',
                  }}
                >
                  {mins} {t('دقيقة')}
                </button>
              ))}
            </div>

            {/* Threshold Sliders */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-2)' }}>{t('عتبة إنذار المعالج CPU:')}</span>
                  <strong style={{ color: 'var(--accent)', fontFamily: 'var(--font)' }}>{cpuThreshold}%</strong>
                </div>
                <input
                  type="range"
                  min="50"
                  max="95"
                  step="5"
                  value={cpuThreshold}
                  aria-label={t('عتبة إنذار المعالج CPU:')}
                  onChange={(e) => setCpuThreshold(e.target.value)}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-2)' }}>{t('عتبة إنذار الذاكرة RAM:')}</span>
                  <strong style={{ color: 'var(--accent)', fontFamily: 'var(--font)' }}>{ramThreshold}%</strong>
                </div>
                <input
                  type="range"
                  min="60"
                  max="98"
                  step="2"
                  value={ramThreshold}
                  aria-label={t('عتبة إنذار الذاكرة RAM:')}
                  onChange={(e) => setRamThreshold(e.target.value)}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-2)' }}>{t('عتبة امتلاء القرص')} C:\:</span>
                  <strong style={{ color: 'var(--accent)', fontFamily: 'var(--font)' }}>{diskThreshold}%</strong>
                </div>
                <input
                  type="range"
                  min="70"
                  max="98"
                  step="2"
                  value={diskThreshold}
                  aria-label={t('عتبة امتلاء القرص')}
                  onChange={(e) => setDiskThreshold(e.target.value)}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
              </div>
            </div>
          </Glass>
        </div>
      </div>

      {/* 3. Automated Security Alert Rules Matrix (Stitch _12 H2) */}
      <Card
        title={t('مصفوفة قواعد الإنذار التلقائي (Automated Security Alert Rules Matrix)')}
        icon="phone"
        actions={
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {t('تُنفَّذ القواعد المفعّلة أثناء المراقبة')}
          </span>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
          {/* Rule 1: Brute Force */}
          <div
            style={{
              padding: 16,
              borderRadius: 10,
              background: 'var(--glass-rim-low)',
              border: '1px solid var(--accent-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)', display: 'block' }}>
                {t('رصد هجمات التخمين (Brute Force Lockout)')}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                {t('إرسال إنذار فوري وحظر IP المعتدي بعد 5 محاولات فاشلة')}
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                aria-label={t('تفعيل رصد هجمات التخمين والحظر')}
                checked={ruleBruteForce}
                onChange={(e) => setRuleBruteForce(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {/* Rule 2: Command Risk */}
          <div
            style={{
              padding: 16,
              borderRadius: 10,
              background: 'var(--glass-rim-low)',
              border: '1px solid var(--accent-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)', display: 'block' }}>
                {t('محلل مخاطر الأوامر (Command Risk Guard)')}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                {t('اعتراض أوامر PowerShell المقيدة وحقن السكربتات الخطيرة')}
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                aria-label={t('تفعيل محلل مخاطر الأوامر')}
                checked={ruleCommandRisk}
                onChange={(e) => setRuleCommandRisk(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {/* Rule 3: Port Flood */}
          <div
            style={{
              padding: 16,
              borderRadius: 10,
              background: 'var(--glass-rim-low)',
              border: '1px solid var(--accent-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)', display: 'block' }}>
                {t('طوفان المنافذ والاتصالات')} (Port Flood &amp; SYN)
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                {t('عزل المنافذ المشبوهة وحماية RDP من محاولات الاستنزاف')}
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                aria-label={t('تفعيل كشف طوفان المنافذ و SYN')}
                checked={rulePortFlood}
                onChange={(e) => setRulePortFlood(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {/* Rule 4: Critical Service Crash */}
          <div
            style={{
              padding: 16,
              borderRadius: 10,
              background: 'var(--glass-rim-low)',
              border: '1px solid var(--accent-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)', display: 'block' }}>
                {t('توقف خدمات النظام الحرجة (Critical Service Failure)')}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                {t('إشعار فوري عند تعطل خدمات SQL Server أو TermService أو IIS')}
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                aria-label={t('تفعيل مراقبة تعطل الخدمات الحرجة')}
                checked={ruleServiceCrash}
                onChange={(e) => setRuleServiceCrash(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>
      </Card>

      {/* 4. Control Plane Backup (v1) */}
      <Card
        title={t('النسخ الاحتياطي لطبقة التحكم')}
        icon="collect"
        actions={
          <Button variant="secondary" onClick={handleBackup} disabled={backingUp}>
            {backingUp ? t('جارٍ الإنشاء...') : t('إنشاء نسخة احتياطية')}
          </Button>
        }
      >
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
          {t('ينشئ نسخة SQLite متسقة من قاعدة بيانات طبقة التحكم في مجلد data/backups مع بصمة SHA-256 وسجل تدقيق. متاح للمشرفين فقط.')}
        </p>
      </Card>
    </div>
  );
}
