/**
 * ASAAS Server Control v2.5 - Screen Session Replay
 * مركز استرجاع التسجيلات والتحقيق الجنائي الرقمي (Forensic Session Replay)
 * Strict implementation of Stitch Prototype session_replay
 */

import { useState, useEffect } from 'react';
import { Card, Button, Glass, useToast } from '../asaas-ui';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  CheckCircle2,
  FileCode,
} from 'lucide-react';

export function SessionReplayPage() {
  const toast = useToast();
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(35);
  const [speed, setSpeed] = useState<number>(1);

  const keystrokes = [
    { time: '14:22:04', event: 'PowerShell Opened', command: 'powershell.exe -NoExit', risk: 'LOW' },
    { time: '14:22:15', event: 'Privilege Check', command: 'whoami /groups; whoami /priv', risk: 'LOW' },
    { time: '14:23:40', event: 'Service Enumeration', command: 'Get-Service -Name MSSQL*', risk: 'LOW' },
    { time: '14:24:12', event: 'Execution Attempt', command: 'Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass', risk: 'HIGH' },
    { time: '14:25:01', event: 'Process Termination', command: 'taskkill /F /PID 4112', risk: 'MEDIUM' },
  ];

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress((prev) => (prev >= 100 ? 0 : prev + 1));
      }, 500 / speed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, speed]);

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(keystrokes, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'asaas-session-replay-audit.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast('تم تصدير ملف سجل التحقيق الجنائي والأحداث بصيغة JSON مشفر.', 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 1. Forensic Header */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(20, 19, 21, 0.95) 0%, rgba(14, 14, 16, 0.98) 100%)',
          border: '1px solid rgba(212, 160, 23, 0.22)',
          boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
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
                  background: 'rgba(34, 197, 94, 0.12)',
                  color: '#22c55e',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <CheckCircle2 size={13} />
                تسجيل مشفر غير قابل للتعديل WORM Compliant
              </span>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: 9999,
                  background: 'rgba(212, 160, 23, 0.12)',
                  color: 'var(--accent)',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                Session ID: REC-20261108-0012
              </span>
            </div>

            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>
              مركز استرجاع التسجيلات والتحقيق الجنائي الرقمي (Forensic Session Replay)
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0, maxWidth: 840, lineHeight: 1.6 }}>
              تشغيل كامل لجلسة المستخدم عن بعد ثانية بثانية، مزامنة نقرات لوحة المفاتيح، ورصد الأوامر والملفات التي تم
              الوصول إليها لأغراض التحقيق السيبراني والامتثال الأمني.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Button
              size="sm"
              variant="glass"
              onClick={handleExportJson}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <FileCode size={13} color="var(--accent)" />
              <span>تصدير سجل الأحداث JSON</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Top Grid: Video Player (8 cols) & Keystroke Timeline (4 cols) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 20 }}>
        {/* Player Screen (8 cols) */}
        <div style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Glass style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid rgba(212, 160, 23, 0.25)' }}>
            {/* Virtual Screen Canvas */}
            <div
              style={{
                height: 380,
                background: '#09090b',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: '90%',
                  height: '80%',
                  borderRadius: 8,
                  background: 'rgba(20, 20, 25, 0.95)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  padding: 16,
                  fontFamily: 'var(--font)',
                  fontSize: 12,
                  color: '#38bdf8',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
                  overflow: 'hidden',
                }}
              >
                <div style={{ color: '#22c55e', marginBottom: 8 }}>
                  Windows PowerShell [Administrator: SRV-PROD-ASAAS-01]
                </div>
                <div style={{ color: 'var(--text-3)', marginBottom: 4 }}>
                  Copyright (C) Microsoft Corporation. All rights reserved.
                </div>
                <div style={{ color: '#fff', marginTop: 12 }}>
                  PS C:\Windows\system32&gt; whoami /groups
                </div>
                <div style={{ color: 'var(--text-2)', marginTop: 4, whiteSpace: 'pre-line' }}>
                  BUILTIN\Administrators    Alias    S-1-5-32-544    Enabled group{'\n'}
                  NT AUTHORITY\Interactive  Well-known group S-1-5-4 Enabled group
                </div>
                <div style={{ color: '#fff', marginTop: 12 }}>
                  PS C:\Windows\system32&gt; Get-Service -Name MSSQL*
                </div>
                <div style={{ color: '#22c55e', marginTop: 4 }}>
                  Running  MSSQLSERVER        SQL Server (MSSQLSERVER)
                </div>
              </div>

              {/* Watermark overlay */}
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.3)',
                  fontFamily: 'var(--font)',
                }}
              >
                <span>FORENSIC CAPTURE: mahmoodSaeed</span>
              </div>
            </div>

            {/* Controls Bar */}
            <div
              style={{
                padding: '14px 18px',
                background: 'rgba(14, 14, 16, 0.98)',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {/* Scrub Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--font)', color: 'var(--text-3)' }}>04:12</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
                <span style={{ fontSize: 11, fontFamily: 'var(--font)', color: 'var(--text-3)' }}>12:00</span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setIsPlaying(!isPlaying)}
                    style={{ padding: '6px 14px' }}
                  >
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    <span>{isPlaying ? 'إيقاف مؤقت' : 'تشغيل التسجيل'}</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setProgress(Math.max(0, progress - 10))}
                    style={{ padding: '6px 10px' }}
                  >
                    <RotateCcw size={14} />
                    <span>10 ث</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setProgress(Math.min(100, progress + 10))}
                    style={{ padding: '6px 10px' }}
                  >
                    <RotateCw size={14} />
                    <span>10 ث</span>
                  </Button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {[0.5, 1, 2, 4].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSpeed(s)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        background: speed === s ? 'var(--accent)' : 'rgba(255,255,255,0.04)',
                        color: speed === s ? '#000' : 'var(--text-2)',
                        fontWeight: 700,
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Glass>
        </div>

        {/* Keystroke & Event Timeline (4 cols) */}
        <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card title="سجل نقرات المفاتيح والأحداث" icon="list">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
              {keystrokes.map((k, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font)', color: 'var(--text-3)' }}>
                      {k.time}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: 3,
                        background:
                          k.risk === 'HIGH'
                            ? 'rgba(239,68,68,0.15)'
                            : k.risk === 'MEDIUM'
                            ? 'rgba(212,160,23,0.15)'
                            : 'rgba(34,197,94,0.15)',
                        color:
                          k.risk === 'HIGH'
                            ? '#ef4444'
                            : k.risk === 'MEDIUM'
                            ? 'var(--accent)'
                            : '#22c55e',
                      }}
                    >
                      {k.risk}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>
                    {k.event}
                  </span>
                  <code style={{ fontSize: 11, fontFamily: 'var(--font)', color: 'var(--accent)' }}>
                    {k.command}
                  </code>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
