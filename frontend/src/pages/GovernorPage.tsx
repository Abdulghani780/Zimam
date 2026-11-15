/**
 * ASAAS Server Control v2.5 - Screen _1
 * Ù…Ø±ÙƒØ² Ø§Ù„ØªØ­ÙƒÙ… ÙˆØ­Ø§ÙƒÙ… Ø§Ù„Ù…ÙˆØ§Ø±Ø¯ Ø§Ù„Ø°ÙƒÙŠ (Resource Governor)
 * Strict implementation of Stitch Prototype _1
 */

import { useState, useEffect } from 'react';
import { Card, Button, Glass, useToast } from '../asaas-ui';
import { api, type GovernorStatus, type ServiceItem, type ProcessItem } from '../lib/api';
import {
  Cpu,
  Zap,
  Play,
  Square,
  RotateCw,
  Search,
  Activity,
  Trash2,
  CheckCircle2,
} from 'lucide-react';

export function GovernorPage() {
  const toast = useToast();
  const [governor, setGovernor] = useState<GovernorStatus | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [processes, setProcesses] = useState<ProcessItem[]>([]);
  const [procSearch, setProcSearch] = useState('');
  const [serviceAction, setServiceAction] = useState<string | null>(null);
  const [idleSlider, setIdleSlider] = useState<number>(15);
  const [autoTrimChecked, setAutoTrimChecked] = useState<boolean>(true);
  const [autoDiscChecked, setAutoDiscChecked] = useState<boolean>(true);
  const [dailyLogoffChecked, setDailyLogoffChecked] = useState<boolean>(false);
  const [trimmingTarget, setTrimmingTarget] = useState<string | null>(null);

  const fetchControlData = async (silent = false) => {
    try {
      const [g, s, snap] = await Promise.all([
        api.getGovernorStatus(),
        api.getServices(),
        api.getSnapshot(),
      ]);
      setGovernor(g);
      setAutoTrimChecked(g?.auto_trim ?? true);
      setIdleSlider(g?.idle_threshold_mins ?? 15);
      setAutoDiscChecked(g?.auto_disconnect_enabled ?? true);
      setDailyLogoffChecked(g?.auto_logoff_enabled ?? false);
      setServices(Array.isArray(s) ? s : (s as any)?.services || []);
      setProcesses(snap?.processes || []);
    } catch (err: any) {
      if (!silent) toast(err.message || 'ÙØ´Ù„ Ø¬Ù„Ø¨ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø­Ø§ÙƒÙ…', 'error');
    }
  };

  useEffect(() => {
    fetchControlData();
    // Keep processes/services and governor counters live from the real
    // `/api/snapshot` inventory instead of freezing the first page load.
    const timer = setInterval(() => fetchControlData(true), 10_000);
    return () => clearInterval(timer);
  }, []);

  const handleToggleAutoTrim = async (val: boolean) => {
    setAutoTrimChecked(val);
    try {
      const updated = await api.updateGovernor({ auto_trim: val });
      setGovernor((prev) => (prev ? { ...prev, ...updated } : (updated as any)));
      toast(val ? 'ØªÙ… ØªÙØ¹ÙŠÙ„ Ø§Ù„ØªÙØ±ÙŠØº Ø§Ù„ØªÙ„Ù‚Ø§Ø¦ÙŠ Ù„Ù„Ø°Ø§ÙƒØ±Ø© Ø§Ù„Ø®Ø§Ù…Ù„Ø©.' : 'ØªÙ… ØªØ­ÙˆÙŠÙ„ Ø§Ù„Ø­Ø§ÙƒÙ… Ø¥Ù„Ù‰ Ø§Ù„ÙˆØ¶Ø¹ Ø§Ù„ÙŠØ¯ÙˆÙŠ.', 'success');
    } catch (err: any) {
      toast(err.message || 'Ø®Ø·Ø£ ÙÙŠ Ø­ÙØ¸ Ø§Ù„Ø³ÙŠØ§Ø³Ø©', 'error');
      setAutoTrimChecked(!val);
    }
  };

  const handleToggleAutoDisconnect = async (val: boolean) => {
    setAutoDiscChecked(val);
    try {
      const updated = await api.updateGovernor({ auto_disconnect_enabled: val });
      setGovernor((prev) => (prev ? { ...prev, ...updated } : (updated as any)));
      toast(val ? 'ØªÙ… ØªÙØ¹ÙŠÙ„ Ø§Ù„ÙØµÙ„ Ø§Ù„ØªÙ„Ù‚Ø§Ø¦ÙŠ Ù„Ù„Ø¬Ù„Ø³Ø§Øª Ø§Ù„Ù…Ù†Ø³ÙŠØ©.' : 'ØªÙ… ØªØ¹Ø·ÙŠÙ„ Ø§Ù„ÙØµÙ„ Ø§Ù„ØªÙ„Ù‚Ø§Ø¦ÙŠ Ù„Ù„Ø¬Ù„Ø³Ø§Øª.', 'success');
    } catch (err: any) {
      toast(err.message || 'Ø®Ø·Ø£ ÙÙŠ Ø­ÙØ¸ Ø³ÙŠØ§Ø³Ø© ÙØµÙ„ Ø§Ù„Ø¬Ù„Ø³Ø§Øª', 'error');
      setAutoDiscChecked(!val);
    }
  };

  const handleToggleDailyLogoff = async (val: boolean) => {
    setDailyLogoffChecked(val);
    try {
      const updated = await api.updateGovernor({ auto_logoff_enabled: val });
      setGovernor((prev) => (prev ? { ...prev, ...updated } : (updated as any)));
      toast(val ? 'ØªÙ… ØªÙØ¹ÙŠÙ„ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø®Ø±ÙˆØ¬ Ø§Ù„Ø¥Ø¬Ø¨Ø§Ø±ÙŠ Ø¨Ù†Ù‡Ø§ÙŠØ© Ø§Ù„Ø¹Ù…Ù„.' : 'ØªÙ… ØªØ¹Ø·ÙŠÙ„ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø®Ø±ÙˆØ¬ Ø§Ù„Ø¥Ø¬Ø¨Ø§Ø±ÙŠ.', 'success');
    } catch (err: any) {
      toast(err.message || 'Ø®Ø·Ø£ ÙÙŠ Ø­ÙØ¸ Ø³ÙŠØ§Ø³Ø© ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø®Ø±ÙˆØ¬', 'error');
      setDailyLogoffChecked(!val);
    }
  };

  const handleIdleSliderChange = async (val: number) => {
    setIdleSlider(val);
    try {
      await api.updateGovernor({ idle_threshold_mins: val });
      setGovernor((prev) => (prev ? { ...prev, idle_threshold_mins: val } : prev));
    } catch {
      // ignore
    }
  };

  const handleSpecificTrim = async (targetLabel: string, pid?: number) => {
    setTrimmingTarget(targetLabel);
    try {
      const res = await api.trimGovernor(undefined, targetLabel, pid);
      if (res && res.ok) {
        const rec = res.reclaimed_mb ?? (res as any)?.result?.reclaimed_mb ?? 0;
        if (rec > 0) {
          toast(`ØªÙ… ØªÙØ±ÙŠØº Ù…Ø³Ø§Ø­Ø© Ø§Ù„Ø¹Ù…Ù„ Ù„Ù€ [${targetLabel}] Ø¨Ù†Ø¬Ø§Ø­ â€” ØªÙ… Ø§Ø³ØªØ±Ø¯Ø§Ø¯ ${rec} MB.`, 'success');
        } else {
          toast(res.message || `Ø°Ø§ÙƒØ±Ø© [${targetLabel}] Ù…Ø­Ø³Ù†Ø© Ù…Ø³Ø¨Ù‚Ø§Ù‹ ÙˆÙ„Ø§ ØªÙˆØ¬Ø¯ ØµÙØ­Ø§Øª Ø®Ø§Ù…Ù„Ø© Ù„ØªØ­Ø±ÙŠØ±Ù‡Ø§.`, 'success');
        }
        fetchControlData();
      } else {
        toast((res as any)?.error || 'ÙØ´Ù„ ØªÙØ±ÙŠØº Ø§Ù„Ø°Ø§ÙƒØ±Ø© Ù„Ù„Ù‡Ø¯Ù Ø§Ù„Ù…Ø­Ø¯Ø¯.', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'ØªØ¹Ø°Ø± Ø§Ø³ØªØ¯Ø¹Ø§Ø¡ ØªÙØ±ÙŠØº Ø§Ù„Ø°Ø§ÙƒØ±Ø©', 'error');
    } finally {
      setTrimmingTarget(null);
    }
  };

  const handleServiceControl = async (name: string, action: 'start' | 'stop' | 'restart') => {
    setServiceAction(`${name}-${action}`);
    try {
      const res = await api.controlService(name, action);
      if (res.ok) {
        toast(`ØªÙ… ØªÙ†ÙÙŠØ° Ø£Ù…Ø± (${action}) Ù„Ù„Ø®Ø¯Ù…Ø© [${name}] Ø¨Ù†Ø¬Ø§Ø­.`, 'success');
        const fresh = await api.getServices();
        setServices(fresh);
      } else {
        toast(res.error || 'ÙØ´Ù„ ØªÙ†ÙÙŠØ° Ø§Ù„Ø£Ù…Ø±', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Ø®Ø·Ø£ ÙÙŠ Ù…Ø¹Ø§Ù„Ø¬Ø© Ø§Ù„Ø®Ø¯Ù…Ø©', 'error');
    } finally {
      setServiceAction(null);
    }
  };

  const handleTerminateProcess = async (pid: number, name: string) => {
    if (!window.confirm(`Ù‡Ù„ Ø£Ù†Øª Ù…ØªØ£ÙƒØ¯ Ù…Ù† Ø±ØºØ¨ØªÙƒ ÙÙŠ Ø¥Ù†Ù‡Ø§Ø¡ Ø§Ù„Ø¹Ù…Ù„ÙŠØ© ${name} (PID: ${pid})ØŸ`)) return;
    try {
      const res = await api.terminateProcess(pid);
      if (res.ok) {
        toast(`ØªÙ… Ø¥Ù†Ù‡Ø§Ø¡ Ø§Ù„Ø¹Ù…Ù„ÙŠØ© [${name}] Ø¨Ù†Ø¬Ø§Ø­.`, 'success');
        setProcesses((prev) => prev.filter((p) => p.pid !== pid));
      } else {
        toast(res.error || 'ØªØ¹Ø°Ø± Ø¥Ù†Ù‡Ø§Ø¡ Ø§Ù„Ø¹Ù…Ù„ÙŠØ©', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Ø®Ø·Ø£', 'error');
    }
  };

  const filteredProcesses = processes.filter(
    (p) =>
      p.name.toLowerCase().includes(procSearch.toLowerCase()) ||
      p.user.toLowerCase().includes(procSearch.toLowerCase()) ||
      String(p.pid).includes(procSearch)
  );

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
        <div
          style={{
            position: 'absolute',
            top: -60,
            left: -40,
            width: 280,
            height: 280,
            borderRadius: '50%',
            background: 'radial-gradient(circle, var(--accent-soft) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -60,
            right: '20%',
            width: 240,
            height: 240,
            borderRadius: '50%',
            background: 'radial-gradient(circle, var(--accent-soft) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: 'var(--paid)',
                  boxShadow: '0 0 8px var(--paid)',
                }}
              />
              Ù†Ø¸Ø§Ù… Ø§Ù„Ø­Ø§ÙƒÙ… Ø§Ù„Ø°ÙƒÙŠ ÙÙŠ ÙˆØ¶Ø¹ Ø§Ù„Ø­Ù…Ø§ÙŠØ© Ø§Ù„ØªÙ„Ù‚Ø§Ø¦ÙŠØ© Active Autonomous Governor
            </span>
            <span
              style={{
                padding: '3px 10px',
                borderRadius: 9999,
                background: 'var(--glass-rim-low)',
                color: 'var(--text-3)',
                fontFamily: 'var(--font)',
                fontSize: 11,
              }}
            >
              POL-KERNEL-TRIM-V3
            </span>
          </div>

          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: 'var(--text-1)',
              letterSpacing: -0.3,
              margin: 0,
            }}
          >
            Ù…Ø±ÙƒØ² Ø§Ù„ØªØ­ÙƒÙ… ÙˆØ­Ø§ÙƒÙ… Ø§Ù„Ù…ÙˆØ§Ø±Ø¯ Ø§Ù„Ø°ÙƒÙŠ (Resource Governor)
          </h1>

          <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0, maxWidth: 900, lineHeight: 1.6 }}>
            Ø¥Ø¯Ø§Ø±Ø© Ø­ÙŠÙˆÙŠØ© Ù„Ù…Ø³Ø§Ø­Ø© Ø§Ù„Ø¹Ù…Ù„ Ø§Ù„Ù…Ø§Ø¯ÙŠØ© (Working Set Trim)ØŒ Ø¬Ø¯ÙˆÙ„Ø© Ø§Ù„Ø£ÙˆÙ„ÙˆÙŠØ§ØªØŒ ÙˆØªÙØ±ÙŠØº Ø®Ù…ÙˆÙ„ Ø§Ù„Ø¬Ù„Ø³Ø§Øª ÙˆØ§Ù„ØªØ·Ø¨ÙŠÙ‚Ø§Øª Ø§Ù„Ø«Ù‚ÙŠÙ„Ø©
            Ù„Ù„Ø­ÙØ§Ø¸ Ø¹Ù„Ù‰ Ø§Ø³ØªÙ‚Ø±Ø§Ø± Ø£Ø¯Ø§Ø¡ ÙˆÙŠÙ†Ø¯ÙˆØ² Ø³ÙŠØ±ÙØ± Ø¨Ø¯ÙˆÙ† Ø§Ù„ØªØ£Ø«ÙŠØ± Ø¹Ù„Ù‰ Ø³Ù„Ø§Ø³Ø© Ø¬Ù„Ø³Ø§Øª Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…ÙŠÙ†.
          </p>
        </div>
      </div>

      {/* 2. Top Grid: Policies on Right (5 cols) & Memory Watchlist on Left (7 cols) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 20 }}>
        {/* Column 1: Governor Policies (5 cols) */}
        <div style={{ gridColumn: 'span 5', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Glass style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
                  Ø³ÙŠØ§Ø³Ø§Øª Ø§Ù„Ø­Ø§ÙƒÙ… Ø§Ù„ØªÙ„Ù‚Ø§Ø¦ÙŠ
                </h2>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Working Set Governor Policies</span>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--paid)',
                  background: 'var(--paid-bg)',
                  padding: '2px 8px',
                  borderRadius: 4,
                  letterSpacing: 0.5,
                }}
              >
                ENFORCED
              </span>
            </div>

            {/* Switch 1: Auto Trim */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 10,
                background: 'var(--glass-rim-low)',
                border: '1px solid var(--glass-rim-low)',
              }}
            >
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', display: 'block' }}>
                  ØªÙØ¹ÙŠÙ„ Ø§Ù„ØªÙØ±ÙŠØº Ø§Ù„ØªÙ„Ù‚Ø§Ø¦ÙŠ Ù„Ù„Ø°Ø§ÙƒØ±Ø©
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  Auto Trim Working Set Ù„Ù„Ø£Ø¹Ø¨Ø§Ø¡ ØºÙŠØ± Ø§Ù„Ù†Ø´Ø·Ø©
                </span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={autoTrimChecked}
                  onChange={(e) => handleToggleAutoTrim(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            {/* Slider: Idle Threshold */}
            <div
              style={{
                padding: '14px',
                borderRadius: 10,
                background: 'var(--glass-rim-low)',
                border: '1px solid var(--glass-rim-low)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', display: 'block' }}>
                    Ø­Ø¯ Ø§Ù„Ø®Ù…ÙˆÙ„ Ù„Ù„ØªÙØ±ÙŠØº Ø§Ù„ØªÙ„Ù‚Ø§Ø¦ÙŠ
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    Idle Tolerance Before Set Paging
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'var(--shadow-soft)',
                    padding: '2px 8px',
                    borderRadius: 6,
                    color: 'var(--accent)',
                    fontWeight: 800,
                    fontSize: 13,
                  }}
                >
                  <span>{idleSlider}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Ø¯Ù‚ÙŠÙ‚Ø©</span>
                </div>
              </div>

              <input
                type="range"
                min="5"
                max="60"
                step="5"
                value={idleSlider}
                onChange={(e) => handleIdleSliderChange(Number(e.target.value))}
                style={{
                  width: '100%',
                  accentColor: 'var(--accent)',
                  cursor: 'pointer',
                }}
              />

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 10,
                  color: 'var(--text-3)',
                }}
              >
                <span>5 Ø¯ (Ø¹Ø¯ÙˆØ§Ù†ÙŠ)</span>
                <span>30 Ø¯Ù‚ÙŠÙ‚Ø©</span>
                <span>60 Ø¯ (Ù…ØªØ³Ø§Ù‡Ù„)</span>
              </div>
            </div>

            {/* Switch 2: Auto Disconnect */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 10,
                background: 'var(--glass-rim-low)',
                border: '1px solid var(--glass-rim-low)',
              }}
            >
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', display: 'block' }}>
                  ÙØµÙ„ Ø§Ù„Ø¬Ù„Ø³Ø§Øª Ø§Ù„Ù…Ù†Ø³ÙŠØ© ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  Auto Disconnect after Inactivity
                </span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={autoDiscChecked}
                  onChange={(e) => handleToggleAutoDisconnect(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            {/* Switch 3: Mandatory Daily Logoff */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 10,
                background: 'var(--glass-rim-low)',
                border: '1px solid var(--glass-rim-low)',
              }}
            >
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', display: 'block' }}>
                  ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø®Ø±ÙˆØ¬ Ø§Ù„Ø¥Ø¬Ø¨Ø§Ø±ÙŠ Ø¨Ù†Ù‡Ø§ÙŠØ© Ø§Ù„Ø¹Ù…Ù„
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  Purge session handles at 18:00 AST
                </span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={dailyLogoffChecked}
                  onChange={(e) => handleToggleDailyLogoff(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            {/* Efficiency Circular Gauge */}
            <div
              style={{
                marginTop: 6,
                padding: '14px 16px',
                borderRadius: 12,
                background: 'var(--shadow-soft)',
                border: '1px solid var(--accent-soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>ÙƒÙØ§Ø¡Ø© ØªØ´ØºÙŠÙ„ Ø§Ù„Ø°Ø§ÙƒØ±Ø© Ø§Ù„Ø­ÙŠØ©</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)' }}>88.4%</span>
                  <span style={{ fontSize: 11, color: 'var(--paid)', fontWeight: 700 }}>Ø§Ø³ØªÙ‚Ø±Ø§Ø± Ø¹Ø§Ù„ÙŠ</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0, lineHeight: 1.4 }}>
                  ØªÙ… ØªØ­Ø¬ÙŠÙ… ØªØ³Ø±ÙŠØ¨Ø§Øª Ø§Ù„Ù…Ù‚Ø§Ø¨Ø¶ (Handle Leaks) Ø¨Ù†Ø³Ø¨Ø© Ù…Ù…ØªØ§Ø²Ø© Ø®Ù„Ø§Ù„ Ø§Ù„Ù€ 24 Ø³Ø§Ø¹Ø© Ø§Ù„Ù…Ø§Ø¶ÙŠØ©.
                </p>
              </div>

              {/* Gauge SVG */}
              <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
                <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="var(--glass-rim-low)"
                    strokeWidth="3.5"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="3.5"
                    strokeDasharray="88, 100"
                    strokeLinecap="round"
                  />
                </svg>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Activity size={14} color="var(--accent)" />
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-1)', fontFamily: 'var(--font)' }}>
                    88%
                  </span>
                </div>
              </div>
            </div>
          </Glass>
        </div>

        {/* Column 2: Heavy Consumer Watchlist & Quick Trim (7 cols) */}
        <div style={{ gridColumn: 'span 7', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Glass style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'var(--partial-bg)',
                    border: '1px solid color-mix(in srgb, var(--partial) 34%, transparent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--partial)',
                  }}
                >
                  <Cpu size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
                    Ù…ØµÙÙˆÙØ© Ø§Ù„Ù…Ø³ØªÙ‡Ù„ÙƒÙŠÙ† Ø§Ù„Ø£Ø«Ù‚Ù„ (Heavy Consumer Watchlist)
                  </h2>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    Ø§Ù„ØªØ·Ø¨ÙŠÙ‚Ø§Øª Ø§Ù„Ø£ÙƒØ«Ø± Ø§Ø³ØªÙ†Ø²Ø§ÙØ§Ù‹ Ù„Ù…Ø³Ø§Ø­Ø© Ø§Ù„Ø¹Ù…Ù„ Ø§Ù„Ù…Ø§Ø¯ÙŠØ© Ù…Ø¹ Ø®ÙŠØ§Ø± Ø§Ù„ØªÙØ±ÙŠØº Ø§Ù„ÙÙˆØ±ÙŠ
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                variant="glass"
                loading={trimmingTarget === 'GLOBAL'}
                onClick={() => handleSpecificTrim('ØªÙØ±ÙŠØº Ø´Ø§Ù…Ù„ Ù„Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø¹Ù…Ù„ÙŠØ§Øª')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Zap size={13} color="var(--accent)" />
                <span>ØªÙØ±ÙŠØº Ø´Ø§Ù…Ù„ ÙÙˆØ±ÙŠ</span>
              </Button>
            </div>

            {/* 4 Heavy Consumer Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              {/* Card 1: SQL Server */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: 10,
                  background: 'var(--glass-rim-low)',
                  border: '1px solid var(--accent-soft)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>sqlservr.exe</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: 'var(--font)',
                      color: 'var(--accent)',
                      background: 'var(--accent-soft)',
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontWeight: 700,
                    }}
                  >
                    <span dir="ltr">8,420 MB</span>
                  </span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  Microsoft SQL Server Database Engine
                </span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--paid)' }}>â— Working Set Active</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={trimmingTarget === 'SQL Server'}
                    onClick={() => handleSpecificTrim('SQL Server Engine')}
                    style={{ padding: '3px 8px', fontSize: 11 }}
                  >
                    ØªÙØ±ÙŠØº ÙÙˆØ±ÙŠ
                  </Button>
                </div>
              </div>

              {/* Card 2: IIS Worker */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: 10,
                  background: 'var(--glass-rim-low)',
                  border: '1px solid var(--accent-soft)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>w3wp.exe</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: 'var(--font)',
                      color: 'var(--accent)',
                      background: 'var(--accent-soft)',
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontWeight: 700,
                    }}
                  >
                    <span dir="ltr">2,840 MB</span>
                  </span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  DefaultAppPool IIS Worker Process
                </span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--paid)' }}>â— HTTP Active</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={trimmingTarget === 'IIS Worker'}
                    onClick={() => handleSpecificTrim('IIS Worker Process')}
                    style={{ padding: '3px 8px', fontSize: 11 }}
                  >
                    ØªÙØ±ÙŠØº ÙÙˆØ±ÙŠ
                  </Button>
                </div>
              </div>

              {/* Card 3: Windows Defender */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: 10,
                  background: 'var(--glass-rim-low)',
                  border: '1px solid var(--accent-soft)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>MsMpEng.exe</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: 'var(--font)',
                      color: 'var(--accent)',
                      background: 'var(--accent-soft)',
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontWeight: 700,
                    }}
                  >
                    <span dir="ltr">1,180 MB</span>
                  </span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  Antimalware Service Executable
                </span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--chart-out)' }}>â— Real-time Guard</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={trimmingTarget === 'Defender'}
                    onClick={() => handleSpecificTrim('Microsoft Defender')}
                    style={{ padding: '3px 8px', fontSize: 11 }}
                  >
                    ØªÙØ±ÙŠØº ÙÙˆØ±ÙŠ
                  </Button>
                </div>
              </div>

              {/* Card 4: Search Indexer */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: 10,
                  background: 'var(--glass-rim-low)',
                  border: '1px solid var(--accent-soft)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>SearchIndexer.exe</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: 'var(--font)',
                      color: 'var(--accent)',
                      background: 'var(--accent-soft)',
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontWeight: 700,
                    }}
                  >
                    <span dir="ltr">690 MB</span>
                  </span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  Windows Search File Indexer
                </span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-3)' }}>â— Idle Indexing</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={trimmingTarget === 'SearchIndexer'}
                    onClick={() => handleSpecificTrim('Windows Search Indexer')}
                    style={{ padding: '3px 8px', fontSize: 11 }}
                  >
                    ØªÙØ±ÙŠØº ÙÙˆØ±ÙŠ
                  </Button>
                </div>
              </div>
            </div>

            {/* Total Reclaimed Summary */}
            <div
              style={{
                marginTop: 'auto',
                padding: '12px 16px',
                borderRadius: 10,
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent-soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={16} color="var(--accent)" />
                <span style={{ fontSize: 12, color: 'var(--text-1)' }}>
                  Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ø°Ø§ÙƒØ±Ø© Ø§Ù„Ù…Ø³ØªØ¹Ø§Ø¯Ø© ÙˆØ§Ù„Ù…ØªØ§Ø­Ø© Ù„Ù„Ù†Ø¸Ø§Ù… Ø­Ø§Ù„ÙŠØ§Ù‹:
                </span>
              </div>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  color: 'var(--accent)',
                  fontFamily: 'var(--font)',
                }}
              >
                <span dir="ltr">{governor?.reclaimed_mb ? Number(governor.reclaimed_mb).toLocaleString(undefined, { maximumFractionDigits: 1 }) : '23,868'} MB</span>
              </span>
            </div>
          </Glass>
        </div>
      </div>

      {/* 3. Windows Core Services Management Table Section (Stitch _1 L283) */}
      <Card
        title="Ø¬Ø¯ÙˆÙ„ Ø®Ø¯Ù…Ø§Øª ÙˆÙŠÙ†Ø¯ÙˆØ² Ø§Ù„Ø­ÙŠÙˆÙŠØ© (Windows Core Services Management)"
        icon="dashboard"
        actions={
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ø®Ø¯Ù…Ø§Øª Ø§Ù„Ø£Ø³Ø§Ø³ÙŠØ©: {services.length} Ø®Ø¯Ù…Ø©
          </span>
        }
      >
        <div className="table-wrap">
          <table className="app-table">
            <thead>
              <tr>
                <th>Ø§Ø³Ù… Ø§Ù„Ø®Ø¯Ù…Ø© (Service Name)</th>
                <th>Ø§Ù„ÙˆØµÙ ÙˆØ§Ù„ÙˆØ¸ÙŠÙØ© Ø¨Ø§Ù„Ù†Ø¸Ø§Ù…</th>
                <th>Ø§Ù„Ø­Ø§Ù„Ø© Ø§Ù„Ø­Ø§Ù„ÙŠØ©</th>
                <th>Ù†ÙˆØ¹ Ø¨Ø¯Ø¡ Ø§Ù„ØªØ´ØºÙŠÙ„</th>
                <th>Ø§Ù„ØªØµÙ†ÙŠÙ</th>
                <th style={{ textAlign: 'end' }}>Ø§Ù„ØªØ­ÙƒÙ… Ø¨Ø§Ù„Ø®Ø¯Ù…Ø©</th>
              </tr>
            </thead>
            <tbody>
              {services.map((svc) => (
                <tr key={svc.name}>
                  <td style={{ fontWeight: 700, fontFamily: 'var(--font)', color: 'var(--text-1)' }}>
                    {svc.name}
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: 'var(--text-1)', display: 'block' }}>
                      {svc.display}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        background:
                          svc.status === 'Running' ? 'var(--paid-bg)' : 'var(--unpaid-bg)',
                        color: svc.status === 'Running' ? 'var(--paid)' : 'var(--unpaid)',
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: svc.status === 'Running' ? 'var(--paid)' : 'var(--unpaid)',
                        }}
                      />
                      {svc.status === 'Running' ? 'ØªØ¹Ù…Ù„ (Running)' : 'Ù…ØªÙˆÙ‚ÙØ© (Stopped)'}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: 11,
                        background: 'var(--glass-rim-low)',
                        padding: '2px 8px',
                        borderRadius: 4,
                        color: 'var(--text-2)',
                      }}
                    >
                      {svc.startup}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--accent)',
                        background: 'var(--accent-soft)',
                        padding: '2px 8px',
                        borderRadius: 4,
                      }}
                    >
                      {svc.category}
                    </span>
                  </td>
                  <td style={{ textAlign: 'end' }}>
                    <div className="cluster" style={{ justifyContent: 'flex-end', gap: 6 }}>
                      {svc.status !== 'Running' ? (
                        <Button
                          size="sm"
                          variant="glass"
                          loading={serviceAction === `${svc.name}-start`}
                          onClick={() => handleServiceControl(svc.name, 'start')}
                          style={{ padding: '4px 10px', fontSize: 11 }}
                        >
                          <Play size={12} color="var(--paid)" />
                          <span>ØªØ´ØºÙŠÙ„</span>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={serviceAction === `${svc.name}-stop`}
                          onClick={() => handleServiceControl(svc.name, 'stop')}
                          style={{ padding: '4px 10px', fontSize: 11, color: 'var(--unpaid)' }}
                        >
                          <Square size={12} />
                          <span>Ø¥ÙŠÙ‚Ø§Ù</span>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={serviceAction === `${svc.name}-restart`}
                        onClick={() => handleServiceControl(svc.name, 'restart')}
                        style={{ padding: '4px 10px', fontSize: 11 }}
                      >
                        <RotateCw size={12} />
                        <span>Ø¥Ø¹Ø§Ø¯Ø© ØªØ´ØºÙŠÙ„</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 4. Process Telemetry & Explorer (Stitch _1 L156) */}
      <Card
        title="Ù‚Ø§Ø¦Ù…Ø© Ù…Ø±Ø§Ù‚Ø¨Ø© Ø§Ø³ØªÙ‡Ù„Ø§Ùƒ Ø§Ù„Ø¹Ù…Ù„ÙŠØ§Øª ÙˆØ§Ù„Ø®Ø¯Ù…Ø§Øª (Top Processes Telemetry)"
        icon="list"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
            <Search size={15} color="var(--text-3)" style={{ position: 'absolute', insetInlineEnd: 10 }} />
            <input
              type="text"
              placeholder="Ø§Ø¨Ø­Ø« Ø¨Ø§Ø³Ù… Ø§Ù„Ø¹Ù…Ù„ÙŠØ©ØŒ PIDØŒ Ø£Ùˆ Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…..."
              value={procSearch}
              onChange={(e) => setProcSearch(e.target.value)}
              className="text-input"
              style={{ width: 280, paddingInlineEnd: 32 }}
            />
          </div>
        }
      >
        <div className="table-wrap" style={{ maxHeight: 460 }}>
          <table className="app-table">
            <thead>
              <tr>
                <th>PID</th>
                <th>Ø§Ø³Ù… Ø§Ù„Ø¹Ù…Ù„ÙŠØ©</th>
                <th>Ø§Ù„Ù…Ø§Ù„Ùƒ / Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…</th>
                <th>Ø§Ù„Ø¬Ù„Ø³Ø©</th>
                <th>Ù…Ø³Ø§Ø­Ø© Ø§Ù„Ø¹Ù…Ù„ (RAM MB)</th>
                <th style={{ textAlign: 'end' }}>Ø¥Ø¬Ø±Ø§Ø¡Ø§Øª Ø§Ù„Ø­Ø§ÙƒÙ…</th>
              </tr>
            </thead>
            <tbody>
              {filteredProcesses.slice(0, 50).map((p) => (
                <tr key={p.pid}>
                  <td style={{ fontFamily: 'var(--font)', color: 'var(--text-3)' }}>{p.pid}</td>
                  <td style={{ fontWeight: 700, color: 'var(--text-1)' }}>{p.name}</td>
                  <td>{p.user}</td>
                  <td>#{p.session}</td>
                  <td style={{ fontFamily: 'var(--font)', fontWeight: 800, color: 'var(--accent)' }}>
                    {p.ram_mb ? `${p.ram_mb} MB` : `${p.ram} GB`}
                  </td>
                  <td style={{ textAlign: 'end' }}>
                    <div className="cluster" style={{ justifyContent: 'flex-end', gap: 6 }}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSpecificTrim(p.name, p.pid)}
                        style={{ padding: '4px 8px', fontSize: 11 }}
                        title="ØªÙØ±ÙŠØº Working Set"
                      >
                        <span>ØªÙØ±ÙŠØº Trim</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleTerminateProcess(p.pid, p.name)}
                        style={{ padding: '4px 8px', fontSize: 11, color: 'var(--unpaid)' }}
                        title="Ø¥Ù†Ù‡Ø§Ø¡ Ø§Ù„Ø¹Ù…Ù„ÙŠØ©"
                      >
                        <Trash2 size={12} />
                        <span>Ø¥Ù†Ù‡Ø§Ø¡</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

