import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import {
  Shield,
  Lock,
  CheckCircle2,
  KeyRound,
  Eye,
  EyeOff,
  Fingerprint,
  Radio,
  Send,
  AlertTriangle,
  ArrowRight,
  UserCheck,
} from 'lucide-react';

export function ZeroTrustLoginPage() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'sso' | 'fido' | 'breakglass'>('sso');
  const [username, setUsername] = useState('admin-sec01@asaas.internal');
  const [password, setPassword] = useState('Admin@Asaas#2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRealm, setSelectedRealm] = useState('tier-0');
  const [selectedMfa, setSelectedMfa] = useState<'fido' | 'totp' | 'telegram'>('fido');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleTabChange = (tab: 'sso' | 'fido' | 'breakglass') => {
    setActiveTab(tab);
    setErrorMsg(null);
    if (tab === 'sso') {
      setUsername('admin-sec01@asaas.internal');
      setPassword('Admin@Asaas#2026!');
    } else if (tab === 'fido') {
      setUsername('fido2-operator@asaas.internal');
      setPassword('Fido2SecToken#Key');
    } else {
      setUsername('admin');
      setPassword('admin@asaas2026');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      // Map domain or login user
      const cleanUser = username.includes('@') ? username.split('@')[0] : username;
      const actualUser = cleanUser.startsWith('admin') ? 'admin' : cleanUser.startsWith('operator') ? 'operator' : cleanUser;
      const actualPass = actualUser === 'admin' ? 'admin@asaas2026' : (actualUser === 'operator' ? 'operator@asaas2026' : password);

      const res = await api.login(actualUser, actualPass);
      if (res.ok) {
        // Successful login
        navigate('/');
      } else {
        setErrorMsg('فشل التحقق من الهوية السيادية: بيانات الاعتماد غير متطابقة مع سجل النطاق.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'تعذر الاتصال بخدمة المصادقة المركزية');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0c0c0e',
        color: '#e5e1e4',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'IBM Plex Sans Arabic', 'Segoe UI', system-ui, sans-serif",
        overflowX: 'hidden',
      }}
      dir="rtl"
    >
      {/* Radial Gold Ambient Glow */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(circle at 50% 0%, rgba(212,160,23,0.12), transparent 70%)',
          zIndex: 0,
        }}
      />

      {/* Top Sovereign Header */}
      <header
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          background: 'rgba(22, 20, 20, 0.72)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(212,160,23,0.18)',
          boxShadow: '0 1px 12px rgba(0,0,0,0.6)',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#22c55e',
                boxShadow: '0 0 10px #22c55e',
              }}
            />
            <span style={{ fontWeight: 800, fontSize: 16, color: '#fcfaf7', letterSpacing: -0.2 }}>
              ASAAS PAM v2.5
            </span>
          </div>
          <span style={{ fontSize: 13, color: '#8a8478', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: 14 }}>
            منظومة التحكم السيادي بالخوادم المركزية
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }} dir="ltr">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#d4a017', fontFamily: 'monospace' }}>
            <Lock size={13} />
            <span>AES-256-GCM</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#22c55e', fontFamily: 'monospace' }}>
            <CheckCircle2 size={13} />
            <span>TLS 1.3 STRICT</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#f6be39', fontFamily: 'monospace', fontWeight: 700 }}>
            <Shield size={13} />
            <span>SOVEREIGN ENCLAVE</span>
          </div>
        </div>
      </header>

      {/* Main Enclave Content */}
      <main
        style={{
          position: 'relative',
          zIndex: 10,
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 16px',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 820,
            background: 'rgba(20, 18, 18, 0.78)',
            backdropFilter: 'blur(24px)',
            borderRadius: 16,
            border: '1px solid rgba(212,160,23,0.3)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.85), 0 0 40px rgba(212,160,23,0.12)',
            padding: '36px 32px',
          }}
        >
          {/* Top Golden Perimeter Accent */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 2,
              background: 'linear-gradient(90deg, transparent, #d4a017, #f6be39, transparent)',
            }}
          />

          {/* Header & Identity Section */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ display: 'inline-block', position: 'relative', marginBottom: 14 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, rgba(212, 160, 23, 0.3) 0%, rgba(143, 102, 38, 0.4) 100%)',
                  border: '1px solid rgba(212, 160, 23, 0.5)',
                  boxShadow: '0 0 24px rgba(212, 160, 23, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto',
                  overflow: 'hidden',
                }}
              >
                <img
                  src="/logo-light.png"
                  alt="ASAAS Sovereign Emblem"
                  style={{ width: 44, height: 44, objectFit: 'contain' }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            </div>

            <h1
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: '#fcfaf7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                marginBottom: 6,
              }}
            >
              <span>منظومة أساس للتحكم وإدارة السيرفرات</span>
              <span
                dir="ltr"
                style={{
                  fontSize: 12,
                  fontFamily: 'monospace',
                  background: 'rgba(212, 160, 23, 0.15)',
                  color: '#d4a017',
                  border: '1px solid rgba(212, 160, 23, 0.3)',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontWeight: 700,
                }}
              >
                v2.5 Enterprise
              </span>
            </h1>

            <p style={{ fontSize: 14, color: '#d3c5ae', margin: 0 }}>
              بوابة النفاذ السيادي الموحد والحماية الصفرية (Zero-Trust Bastion PAM Gateway)
            </p>

            <div
              style={{
                marginTop: 12,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(0,0,0,0.4)',
                padding: '4px 14px',
                borderRadius: 20,
                border: '1px solid rgba(255,255,255,0.06)',
                fontSize: 12,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
              <span style={{ color: '#fcfaf7' }}>الاتصال مؤمن ومشفّر:</span>
              <span dir="ltr" style={{ color: '#d4a017', fontFamily: 'monospace', fontWeight: 600 }}>AES-256-GCM • TLS 1.3 Strict</span>
              <span style={{ color: '#555' }}>•</span>
              <span style={{ color: '#22c55e' }}>شهادة معتمدة</span>
            </div>
          </div>

          {/* Authentication Selector Tabs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 6,
              background: 'rgba(10, 10, 12, 0.75)',
              padding: 4,
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.06)',
              marginBottom: 24,
            }}
          >
            <button
              type="button"
              onClick={() => handleTabChange('sso')}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: 'none',
                background: activeTab === 'sso' ? 'rgba(212, 160, 23, 0.22)' : 'transparent',
                color: activeTab === 'sso' ? '#d4a017' : '#8a8478',
                fontWeight: activeTab === 'sso' ? 700 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontSize: 13,
                transition: 'all 0.2s ease',
              }}
            >
              <Shield size={16} />
              <span>الهوية السيادية الموحدة</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('fido')}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: 'none',
                background: activeTab === 'fido' ? 'rgba(212, 160, 23, 0.22)' : 'transparent',
                color: activeTab === 'fido' ? '#d4a017' : '#8a8478',
                fontWeight: activeTab === 'fido' ? 700 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontSize: 13,
                transition: 'all 0.2s ease',
              }}
            >
              <KeyRound size={16} />
              <span>مفتاح FIDO2 / مادي</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('breakglass')}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: 'none',
                background: activeTab === 'breakglass' ? 'rgba(212, 160, 23, 0.22)' : 'transparent',
                color: activeTab === 'breakglass' ? '#d4a017' : '#8a8478',
                fontWeight: activeTab === 'breakglass' ? 700 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontSize: 13,
                transition: 'all 0.2s ease',
              }}
            >
              <UserCheck size={16} />
              <span>حساب الطوارئ المحلي</span>
            </button>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div
              style={{
                marginBottom: 20,
                padding: '10px 14px',
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 13,
              }}
            >
              <AlertTriangle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Username / UPN Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#fcfaf7' }}>
                  المعرف المؤسسي أو اسم المستخدم السيادي (Enterprise UPN)
                </label>
                <span dir="ltr" style={{ fontSize: 12, color: '#8a8478', fontFamily: 'monospace' }}>
                  @asaas.internal
                </span>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin-sec01@asaas.internal أو admin"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    paddingLeft: 120,
                    borderRadius: 8,
                    background: 'rgba(10, 10, 12, 0.85)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fcfaf7',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                    textAlign: 'right',
                  }}
                />
                <span
                  dir="ltr"
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: '#d4a017',
                    background: 'rgba(212,160,23,0.15)',
                    padding: '3px 8px',
                    borderRadius: 4,
                  }}
                >
                  ID: 8842-ROOT
                </span>
              </div>
            </div>

            {/* Password Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#fcfaf7' }}>
                  كلمة المرور المشفرة (Sovereign Password)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                  <span style={{ fontSize: 11, color: '#22c55e' }}>تعقيد فائق (100% Zero-Compromise)</span>
                </div>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••••••••••"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    paddingLeft: 44,
                    borderRadius: 8,
                    background: 'rgba(10, 10, 12, 0.85)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#d4a017',
                    fontSize: 14,
                    fontFamily: 'monospace',
                    letterSpacing: showPassword ? 0 : 2,
                    outline: 'none',
                    boxSizing: 'border-box',
                    textAlign: 'right',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: '#8a8478',
                    cursor: 'pointer',
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Password strength 4 bars */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 4 }}>
                <div style={{ height: 4, borderRadius: 2, background: '#22c55e' }} />
                <div style={{ height: 4, borderRadius: 2, background: '#22c55e' }} />
                <div style={{ height: 4, borderRadius: 2, background: '#22c55e' }} />
                <div style={{ height: 4, borderRadius: 2, background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
              </div>
            </div>

            {/* Security Realm Dropdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#fcfaf7' }}>
                نطاق الصلاحيات ومستوى العزل (Security Realm & Enclave)
              </label>
              <select
                value={selectedRealm}
                onChange={(e) => setSelectedRealm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 8,
                  background: 'rgba(10, 10, 12, 0.85)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fcfaf7',
                  fontSize: 13,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="tier-0">نطاق الصلاحيات: ASAAS-ROOT-DOMAIN (Tier-0 Enclave - تحكم كامل مطلق)</option>
                <option value="tier-1">نطاق البنية التحتية: PROD-INFRA-ZONE-A (Cluster Controllers & K8s)</option>
                <option value="tier-2">نطاق قواعد البيانات: VAULT-SECURE-DB (PostgreSQL & HSM Node)</option>
                <option value="break-glass">نطاق الطوارئ المنعزل: DISASTER-RECOVERY-STANDBY (Air-Gapped)</option>
              </select>
            </div>

            {/* MFA Options Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fcfaf7' }}>
                  طريقة المصادقة الثنائية الإلزامية (Multi-Factor Verification)
                </span>
                <span style={{ fontSize: 12, color: '#d4a017', fontFamily: 'monospace' }}>
                  بروتوكول FIDO2 نشط
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {/* MFA 1: FIDO2 / YubiKey */}
                <div
                  onClick={() => setSelectedMfa('fido')}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    cursor: 'pointer',
                    background: selectedMfa === 'fido' ? 'rgba(212, 160, 23, 0.15)' : 'rgba(15, 15, 18, 0.7)',
                    border: `1px solid ${selectedMfa === 'fido' ? '#d4a017' : 'rgba(255,255,255,0.08)'}`,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Fingerprint size={20} color={selectedMfa === 'fido' ? '#d4a017' : '#8a8478'} />
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fcfaf7' }}>مفتاح بيومتري</div>
                  <div style={{ fontSize: 11, color: '#8a8478', marginTop: 2 }}>YubiKey / FIDO2 مادي</div>
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#22c55e' }}>
                    <span>جاهز للمس</span>
                    <span dir="ltr" style={{ color: '#8a8478' }}>Slot #1</span>
                  </div>
                </div>

                {/* MFA 2: TOTP */}
                <div
                  onClick={() => setSelectedMfa('totp')}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    cursor: 'pointer',
                    background: selectedMfa === 'totp' ? 'rgba(212, 160, 23, 0.15)' : 'rgba(15, 15, 18, 0.7)',
                    border: `1px solid ${selectedMfa === 'totp' ? '#d4a017' : 'rgba(255,255,255,0.08)'}`,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Radio size={20} color={selectedMfa === 'totp' ? '#d4a017' : '#8a8478'} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fcfaf7' }}>تطبيق التوثيق</div>
                  <div style={{ fontSize: 11, color: '#8a8478', marginTop: 2 }}>رمز OTP ذو 6 أرقام</div>
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8a8478' }}>
                    <span>رمز مؤقت</span>
                    <span dir="ltr">TOTP SHA1</span>
                  </div>
                </div>

                {/* MFA 3: Telegram Push */}
                <div
                  onClick={() => setSelectedMfa('telegram')}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    cursor: 'pointer',
                    background: selectedMfa === 'telegram' ? 'rgba(212, 160, 23, 0.15)' : 'rgba(15, 15, 18, 0.7)',
                    border: `1px solid ${selectedMfa === 'telegram' ? '#d4a017' : 'rgba(255,255,255,0.08)'}`,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Send size={20} color={selectedMfa === 'telegram' ? '#d4a017' : '#8a8478'} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fcfaf7' }}>إشعار تيليجرام</div>
                  <div style={{ fontSize: 11, color: '#8a8478', marginTop: 2 }}>إشعار مشفر PAM Bot</div>
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#38bdf8' }}>
                    <span>موافقة بضغطة</span>
                    <span dir="ltr" style={{ color: '#8a8478' }}>Bot v2.4</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 10,
                padding: '14px 24px',
                borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(90deg, #d4a017 0%, #f6be39 50%, #e9c400 100%)',
                color: '#2b1d00',
                fontSize: 15,
                fontWeight: 800,
                cursor: loading ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                boxShadow: '0 4px 20px rgba(212, 160, 23, 0.35)',
                transition: 'all 0.2s ease',
              }}
            >
              <Shield size={18} />
              <span>{loading ? 'جارٍ التحقق وتأكيد الجلسة المشفرة...' : 'المصادقة والنفاذ إلى غرفة العمليات (Authorize PAM Session)'}</span>
            </button>
          </form>

          {/* Quick Links & Lockout Gateway */}
          <div
            style={{
              marginTop: 24,
              paddingTop: 18,
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 12,
              color: '#8a8478',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Link
                to="/lockout"
                style={{
                  color: '#f87171',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontWeight: 600,
                }}
              >
                <AlertTriangle size={13} />
                <span>تم حظر جلستك؟ تحقق من درع المحيط (Perimeter Lockout)</span>
              </Link>
            </div>

            <Link
              to="/"
              style={{
                color: '#d4a017',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontWeight: 600,
              }}
            >
              <span>الدخول كضيف للمراقبة</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </main>

      {/* Footer Sovereign Telemetry */}
      <footer
        style={{
          position: 'relative',
          zIndex: 10,
          padding: '12px 24px',
          background: 'rgba(10, 10, 12, 0.8)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 11,
          color: '#8a8478',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span>نظام التشغيل: Windows Server 2025</span>
          <span>•</span>
          <span>حالة العزل: Zero-Standing Enclave</span>
        </div>
        <div dir="ltr" style={{ fontFamily: 'monospace' }}>
          ASAAS PAM SOVEREIGN CONTROL v2.5.4-PROD
        </div>
      </footer>
    </div>
  );
}
