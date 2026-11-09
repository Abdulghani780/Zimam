import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import {
  ShieldAlert,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Send,
  KeyRound,
  PhoneCall,
  ArrowRight,
} from 'lucide-react';

export function PerimeterLockoutPage() {
  const navigate = useNavigate();

  const [copiedHash, setCopiedHash] = useState(false);
  const [ticketInput, setTicketInput] = useState('');
  const [ticketSubmitted, setTicketSubmitted] = useState(false);
  const [breakGlassPin, setBreakGlassPin] = useState('');
  const [breakGlassOpen, setBreakGlassOpen] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const incidentHash = 'd4a017e8b2f90a55283bc91efc918302f238e8749a150bc4409ef182a98f121e';

  const copyDigest = () => {
    navigator.clipboard.writeText(incidentHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2500);
  };

  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketInput.trim()) return;
    try {
      await api.logAuditEvent('SOC_REVIEW_REQUESTED', `طلب مراجعة تذكرة: ${ticketInput}`);
    } catch {
      // Continue anyway
    }
    setTicketSubmitted(true);
  };

  const handleBreakGlassUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError(null);

    // Sovereign break-glass pin or root password
    if (breakGlassPin === '9942' || breakGlassPin === 'admin@asaas2026' || breakGlassPin === 'root') {
      try {
        await api.unblockSecurityIp('194.26.29.114');
        await api.logAuditEvent('BREAK_GLASS_PERIMETER_OVERRIDE', 'فك العزل السيادي يدوياً بواسطة تصريح الطوارئ 9942');
      } catch {
        // Continue anyway
      }
      navigate('/login');
    } else {
      setUnlockError('رمز كسر العزل غير صحيح (رمز تصريح الطوارئ الافتراضي: 9942).');
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
      {/* Background Red Incident Radial Glow */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(circle at 50% 0%, rgba(239, 68, 68, 0.12), transparent 70%)',
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
          borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
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
                background: '#ef4444',
                boxShadow: '0 0 10px #ef4444',
                animation: 'pulse 1.5s infinite',
              }}
            />
            <span style={{ fontWeight: 800, fontSize: 16, color: '#fcfaf7' }}>
              ASAAS PAM v2.5
            </span>
          </div>
          <span style={{ fontSize: 13, color: '#8a8478', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: 14 }}>
            منظومة التحكم السيادي بالخوادم المركزية
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }} dir="ltr">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#ef4444', fontFamily: 'monospace' }}>
            <Lock size={13} />
            <span>PERIMETER ENFORCED</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#22c55e', fontFamily: 'monospace' }}>
            <CheckCircle2 size={13} />
            <span>TLS 1.3</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#d4a017', fontFamily: 'monospace', fontWeight: 700 }}>
            <ShieldAlert size={13} />
            <span>SOVEREIGN ENCLAVE</span>
          </div>
        </div>
      </header>

      {/* Main Enclave Incident Hub Card */}
      <main
        style={{
          position: 'relative',
          zIndex: 10,
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 16px',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 1040,
            background: 'rgba(20, 18, 18, 0.85)',
            backdropFilter: 'blur(24px)',
            borderRadius: 16,
            border: '1px solid rgba(239, 68, 68, 0.35)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.85), 0 0 40px rgba(239, 68, 68, 0.15)',
            padding: '32px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {/* Top Status Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 12,
                  background: 'rgba(239, 68, 68, 0.18)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  boxShadow: '0 0 20px rgba(239, 68, 68, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                  flexShrink: 0,
                }}
              >
                <ShieldAlert size={30} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span
                    dir="ltr"
                    style={{
                      fontSize: 11,
                      fontFamily: 'monospace',
                      background: 'rgba(239, 68, 68, 0.2)',
                      color: '#ef4444',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontWeight: 700,
                    }}
                  >
                    PROTOCOL::ISOLATE_PERIMETER_ENFORCED
                  </span>
                  <span
                    dir="ltr"
                    style={{
                      fontSize: 11,
                      fontFamily: 'monospace',
                      background: 'rgba(212, 160, 23, 0.15)',
                      color: '#d4a017',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontWeight: 700,
                    }}
                  >
                    GATEWAY #SEC-GW-04
                  </span>
                </div>
                <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fcfaf7', margin: 0 }}>
                  تم اعتراض الاتصال وتفعيل العزل الأمني السيادي للمحيط
                </h1>
              </div>
            </div>

            <div
              style={{
                background: 'rgba(30, 26, 26, 0.8)',
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid rgba(239, 68, 68, 0.3)',
                textAlign: 'end',
              }}
            >
              <div style={{ fontSize: 11, color: '#8a8478' }}>تصنيف التهديد الفيدرالي</div>
              <div
                dir="ltr"
                style={{
                  fontSize: 13,
                  fontFamily: 'monospace',
                  fontWeight: 800,
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 2,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
                <span>TIER-0 :: CRITICAL DEFENSE</span>
              </div>
            </div>
          </div>

          {/* Zero-Trust Violation Statement */}
          <div
            style={{
              padding: 16,
              borderRadius: 10,
              background: 'rgba(10, 10, 12, 0.75)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              display: 'flex',
              gap: 14,
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                background: 'rgba(245, 158, 11, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f59e0b',
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b' }}>
                  بيان خرق الثقة الصفرية (Zero-Trust Security Violation)
                </span>
                <span dir="ltr" style={{ fontSize: 11, fontFamily: 'monospace', color: '#8a8478' }}>
                  EVENT CODE: 4625/AUTH_FAIL_EXCEEDED
                </span>
              </div>
              <p style={{ fontSize: 13, color: '#d3c5ae', margin: 0, lineHeight: 1.6 }}>
                تم رصد محاولات متكررة لتصعيد الامتيازات (<span dir="ltr" style={{ color: '#d4a017', fontFamily: 'monospace' }}>Privilege Escalation</span>) مع كسر كلمات مرور متسلسل عبر محطة طرفية غير موثوقة. تم إنهاء الجلسة فوراً، حظر عنوان IP المصدر، وتدوين البصمة في السجل الجنائي غير القابل للتعديل (<span dir="ltr" style={{ color: '#d4a017', fontFamily: 'monospace' }}>Immutable Audit Ledger</span>).
              </p>
            </div>
          </div>

          {/* Incident Telemetry Bento Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {/* Box 1 */}
            <div style={{ background: 'rgba(25, 22, 22, 0.6)', padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 11, color: '#8a8478', marginBottom: 4 }}>المعرف الأمني للواقعة</div>
              <div dir="ltr" style={{ fontSize: 14, fontWeight: 800, fontFamily: 'monospace', color: '#d4a017' }}>
                #SEC-INC-9942-X-NODE08
              </div>
              <div style={{ fontSize: 11, color: '#8a8478', marginTop: 2 }}>سجل الإسناد الجنائي الفوري</div>
              <div style={{ marginTop: 8, padding: '4px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: '#8a8478' }}>المرجعية:</span>
                <span dir="ltr" style={{ color: '#818cf8', fontFamily: 'monospace' }}>CF-WAF::EDGE_RULE_89</span>
              </div>
            </div>

            {/* Box 2 */}
            <div style={{ background: 'rgba(25, 22, 22, 0.6)', padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 11, color: '#8a8478', marginBottom: 4 }}>عنوان IP المصدر المعزول</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span dir="ltr" style={{ fontSize: 14, fontWeight: 800, fontFamily: 'monospace', color: '#ef4444' }}>
                  194.26.29.114
                </span>
                <span dir="ltr" style={{ fontSize: 10, background: 'rgba(239,68,68,0.2)', color: '#ef4444', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                  TOR_EXIT
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#8a8478', marginTop: 2 }}>الموقع: WAN-Edge External Routing</div>
              <div style={{ marginTop: 8, padding: '4px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: '#8a8478' }}>حالة الجدار:</span>
                <span dir="ltr" style={{ color: '#ef4444', fontFamily: 'monospace', fontWeight: 700 }}>BLOCKED / PERMANENT</span>
              </div>
            </div>

            {/* Box 3 */}
            <div style={{ background: 'rgba(25, 22, 22, 0.6)', padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 11, color: '#8a8478', marginBottom: 4 }}>طابع الوقت السيادي والتزامن</div>
              <div dir="ltr" style={{ fontSize: 14, fontWeight: 800, fontFamily: 'monospace', color: '#fcfaf7' }}>
                {new Date().toISOString().replace('T', ' ').substring(0, 19)} AST
              </div>
              <div style={{ fontSize: 11, color: '#8a8478', marginTop: 2 }}>توقيت الخادم المركزي الموحد (UTC+3)</div>
              <div style={{ marginTop: 8, padding: '4px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: '#8a8478' }}>زمن الاستجابة:</span>
                <span dir="ltr" style={{ color: '#22c55e', fontFamily: 'monospace' }}>0.042 ms (SOC AUTO-DROP)</span>
              </div>
            </div>
          </div>

          {/* Cryptographic Hash Banner */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgba(10, 10, 12, 0.85)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <Lock size={16} color="#d4a017" style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#8a8478' }}>بصمة العقدة والتوقيع المشفر (SHA-256 Digest Signature)</div>
                <div dir="ltr" style={{ fontSize: 12, fontFamily: 'monospace', color: '#d3c5ae', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  SHA-256: {incidentHash}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={copyDigest}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 6,
                background: 'rgba(255,255,255,0.06)',
                border: 'none',
                color: '#e5e1e4',
                fontSize: 12,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {copiedHash ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
              <span>{copiedHash ? 'تم النسخ!' : 'نسخ البصمة'}</span>
            </button>
          </div>

          {/* Forensic Attack Vector Chart & Shielding Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
            {/* Attack Waveform */}
            <div style={{ background: 'rgba(25, 22, 22, 0.6)', padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fcfaf7' }}>
                    مخطط اعتراض حزم الهجوم (Telemetry Intrusion Waveform)
                  </span>
                </div>
                <span dir="ltr" style={{ fontSize: 11, fontFamily: 'monospace', color: '#8a8478' }}>60s ROLLING TRACE</span>
              </div>

              {/* Spike SVG */}
              <div style={{ position: 'relative', height: 110, background: 'rgba(10,10,12,0.9)', borderRadius: 6, overflow: 'hidden', padding: 8 }}>
                <svg viewBox="0 0 600 120" style={{ width: '100%', height: '100%', display: 'block' }} preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="spikeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,105 L40,102 L80,104 L120,98 L160,102 L200,95 L240,100 L280,25 L295,12 L310,18 L330,85 L360,110 L400,115 L440,115 L480,116 L520,116 L560,116 L600,116"
                    stroke="#ef4444"
                    strokeWidth="2.5"
                    fill="none"
                  />
                  <path
                    d="M0,105 L40,102 L80,104 L120,98 L160,102 L200,95 L240,100 L280,25 L295,12 L310,18 L330,85 L360,110 L400,115 L440,115 L480,116 L520,116 L560,116 L600,116 L600,120 L0,120 Z"
                    fill="url(#spikeGrad)"
                  />
                  <path
                    d="M0,108 L100,110 L200,109 L300,108 L400,110 L500,109 L600,110"
                    stroke="#f6be39"
                    strokeDasharray="3 3"
                    strokeWidth="1.2"
                    fill="none"
                    opacity="0.6"
                  />
                </svg>
                <div style={{ position: 'absolute', top: 8, left: 12, background: 'rgba(239, 68, 68, 0.25)', padding: '2px 8px', borderRadius: 4, fontSize: 10, color: '#ef4444', fontFamily: 'monospace', fontWeight: 700 }}>
                  SPIKE: 1,480 REQ/SEC INTERCEPTED
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#8a8478', marginTop: 8 }}>
                <span>الموجة البرمجية: تم كبح 100% من الحزم المشبوهة</span>
                <span dir="ltr" style={{ color: '#22c55e', fontFamily: 'monospace' }}>PACKET DROP CONFIRMED</span>
              </div>
            </div>

            {/* Shielding Summary */}
            <div style={{ background: 'rgba(25, 22, 22, 0.6)', padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fcfaf7', marginBottom: 10 }}>محيط الحماية الفعّال</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 6, background: 'rgba(0,0,0,0.4)', fontSize: 12 }}>
                    <span>Windows Defender</span>
                    <span dir="ltr" style={{ color: '#ef4444', fontWeight: 700 }}>BLOCKED</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 6, background: 'rgba(0,0,0,0.4)', fontSize: 12 }}>
                    <span>Cloudflare WAF</span>
                    <span dir="ltr" style={{ color: '#ef4444', fontWeight: 700 }}>ISOLATED</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 6, background: 'rgba(0,0,0,0.4)', fontSize: 12 }}>
                    <span>Kernel Enclave Hook</span>
                    <span dir="ltr" style={{ color: '#22c55e', fontWeight: 700 }}>ENGAGED</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(212,160,23,0.1)', fontSize: 11, color: '#d4a017' }}>
                خوادم الهيئة السيادية في حالة استقرار بنسبة 100%
              </div>
            </div>
          </div>

          {/* Remediation Action Deck */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fcfaf7' }}>
                بروتوكولات فك العزل والتعامل الاستثنائي (Emergency Protocols)
              </span>
              <span style={{ fontSize: 11, color: '#8a8478' }}>مطلوب توثيق أمني ثنائي الخطوة</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {/* Action 1: SOC Ticket Review */}
              <div style={{ background: 'rgba(25, 22, 22, 0.6)', padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Send size={16} color="#d4a017" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#fcfaf7' }}>طلب مراجعة أمنية عاجلة</span>
                  </div>
                  <p style={{ fontSize: 11, color: '#8a8478', margin: 0, lineHeight: 1.5 }}>
                    إرسال استغاثة لفريق مركز العمليات الأمنية (SOC) للتحقق اليدوي.
                  </p>
                </div>

                {ticketSubmitted ? (
                  <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(34,197,94,0.15)', color: '#22c55e', fontSize: 12, fontWeight: 600, textAlign: 'center' }}>
                    تم إرسال الطلب لفريق العمليات الأمنية بنجاح!
                  </div>
                ) : (
                  <form onSubmit={handleTicketSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                      type="text"
                      value={ticketInput}
                      onChange={(e) => setTicketInput(e.target.value)}
                      placeholder="رقم تذكرة الدعم (Jira/ServiceNow)..."
                      dir="ltr"
                      style={{
                        padding: '8px 12px',
                        borderRadius: 6,
                        background: 'rgba(10, 10, 12, 0.8)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: '#fcfaf7',
                        fontSize: 12,
                        outline: 'none',
                      }}
                    />
                    <button
                      type="submit"
                      style={{
                        padding: '8px 14px',
                        borderRadius: 6,
                        background: 'rgba(255,255,255,0.08)',
                        border: 'none',
                        color: '#fcfaf7',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <Send size={13} />
                      <span>تقديم طلب المراجعة</span>
                    </button>
                  </form>
                )}
              </div>

              {/* Action 2: Break-Glass Master Unlock */}
              <div style={{ background: 'rgba(25, 22, 22, 0.6)', padding: 14, borderRadius: 10, border: '1px solid rgba(212,160,23,0.3)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <KeyRound size={16} color="#d4a017" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#fcfaf7' }}>إجراء كسر العزل (Break-Glass)</span>
                  </div>
                  <p style={{ fontSize: 11, color: '#8a8478', margin: 0, lineHeight: 1.5 }}>
                    خاص بالمسؤولين التنفيذيين؛ يتطلب الرمز الطارئ السيادي أو مفتاح الأمان.
                  </p>
                </div>

                {!breakGlassOpen ? (
                  <button
                    type="button"
                    onClick={() => setBreakGlassOpen(true)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 6,
                      background: 'linear-gradient(90deg, #d4a017 0%, #f6be39 100%)',
                      border: 'none',
                      color: '#2b1d00',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <KeyRound size={14} />
                    <span>فك العزل للمسؤول (Emergency)</span>
                  </button>
                ) : (
                  <form onSubmit={handleBreakGlassUnlock} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                      type="password"
                      value={breakGlassPin}
                      onChange={(e) => setBreakGlassPin(e.target.value)}
                      placeholder="أدخل الرمز الطارئ (مثال: 9942)"
                      dir="ltr"
                      autoFocus
                      style={{
                        padding: '8px 12px',
                        borderRadius: 6,
                        background: 'rgba(10, 10, 12, 0.8)',
                        border: '1px solid rgba(212,160,23,0.4)',
                        color: '#d4a017',
                        fontSize: 12,
                        fontFamily: 'monospace',
                        outline: 'none',
                      }}
                    />
                    {unlockError && (
                      <span style={{ fontSize: 10, color: '#f87171' }}>{unlockError}</span>
                    )}
                    <button
                      type="submit"
                      style={{
                        padding: '8px 14px',
                        borderRadius: 6,
                        background: '#d4a017',
                        border: 'none',
                        color: '#000',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      تأكيد فك الحظر والنفاذ
                    </button>
                  </form>
                )}
              </div>

              {/* Action 3: SOC Hotline */}
              <div style={{ background: 'rgba(25, 22, 22, 0.6)', padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <PhoneCall size={16} color="#38bdf8" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#fcfaf7' }}>خط الطوارئ الساخن (SOC Hotline)</span>
                  </div>
                  <p style={{ fontSize: 11, color: '#8a8478', margin: 0, lineHeight: 1.5 }}>
                    الاتصال الفوري بغرفة العمليات والاستجابة للحوادث السيبرانية.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div dir="ltr" style={{ padding: '6px 10px', borderRadius: 6, background: 'rgba(0,0,0,0.4)', color: '#38bdf8', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, textAlign: 'center' }}>
                    +966 11 884 9900 (EXT: 01)
                  </div>
                  <Link
                    to="/login"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      fontSize: 12,
                      color: '#d4a017',
                      textDecoration: 'none',
                      padding: '4px',
                    }}
                  >
                    <span>العودة لبوابة تسجيل الدخول</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
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
          <span>رمز الحادثة: SEC-INC-9942</span>
        </div>
        <div dir="ltr" style={{ fontFamily: 'monospace' }}>
          ASAAS PERIMETER DEFENSE SOVEREIGN v2.5.4
        </div>
      </footer>
    </div>
  );
}
