from pathlib import Path

p = Path('frontend/src/pages/JitElevationPage.tsx')
content = p.read_text(encoding='utf-8')

import_old = "import { useState, useEffect } from 'react';"
import_new = "import { useState, useEffect } from 'react';\nimport { api } from '../lib/api';"

content = content.replace(import_old, import_new)

target = """  const [grants, setGrants] = useState<JitGrant[]>([
    {
      id: 'jit-01',
      user: 'khalid.ops',
      target: 'SRV-PROD-ASAAS-01',
      role: 'Local Administrator',
      ticket: 'CHG-9021',
      duration_mins: 30,
      remaining_sec: 1420,
      status: 'ACTIVE',
    },
    {
      id: 'jit-02',
      user: 'ahmed.dev',
      target: 'SRV-DB-POSTGRES-01',
      role: 'SQL SysAdmin',
      ticket: 'INC-4412',
      duration_mins: 15,
      remaining_sec: 410,
      status: 'ACTIVE',
    },
  ]);

  const [targetRole, setTargetRole] = useState('Local Administrator');
  const [durationMins, setDurationMins] = useState(30);
  const [reason, setReason] = useState('طوارئ صيانة قواعد البيانات - تذكرة CHG-9840');
  const [mfaCode, setMfaCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setGrants((prev) =>
        prev.map((g) => ({
          ...g,
          remaining_sec: Math.max(0, g.remaining_sec - 1),
          status: g.remaining_sec <= 1 ? 'EXPIRED' : g.status,
        }))
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRevoke = (id: string, user: string) => {
    setGrants((prev) =>
      prev.map((g) => (g.id === id ? { ...g, status: 'REVOKED', remaining_sec: 0 } : g))
    );
    toast(`تم سحب الصلاحيات المؤقتة للمستخدم [${user}] فوراً وتجريده من صلاحيات المدير.`, 'success');
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const newGrant: JitGrant = {
        id: `jit-${Date.now()}`,
        user: 'admin',
        target: 'SRV-PROD-ASAAS-01',
        role: targetRole,
        ticket: 'REQ-LIVE',
        duration_mins: durationMins,
        remaining_sec: durationMins * 60,
        status: 'ACTIVE',
      };
      setGrants((prev) => [newGrant, ...prev]);
      toast(`تم اعتماد وترقية الصلاحية المؤقتة لمدة (${durationMins} دقيقة) بنجاح.`, 'success');
      setMfaCode('');
    } catch {
      toast('فشل تقديم الطلب', 'error');
    } finally {
      setSubmitting(false);
    }
  };"""

replacement = """  const [grants, setGrants] = useState<JitGrant[]>([]);

  const [targetRole, setTargetRole] = useState('Local Administrator');
  const [durationMins, setDurationMins] = useState(30);
  const [reason, setReason] = useState('طوارئ صيانة قواعد البيانات - تذكرة CHG-9840');
  const [mfaCode, setMfaCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchGrants = async () => {
    try {
      const res = await api.getJitGrants();
      if (res && res.ok && Array.isArray(res.grants)) {
        setGrants(res.grants.map((g: any) => ({
          id: g.id || `jit-${Math.random()}`,
          user: g.user || 'Unknown',
          target: g.target || 'SRV-PROD-ASAAS-01',
          role: g.role || g.target_role || 'Operator',
          ticket: g.ticket || 'CHG-LIVE',
          duration_mins: g.duration_mins || 30,
          remaining_sec: g.remaining_sec ?? 1800,
          status: g.status || 'ACTIVE',
        })));
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchGrants();
    const timer = setInterval(() => {
      setGrants((prev) =>
        prev.map((g) => ({
          ...g,
          remaining_sec: Math.max(0, g.remaining_sec - 1),
          status: g.remaining_sec <= 1 ? 'EXPIRED' : g.status,
        }))
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRevoke = async (id: string, user: string) => {
    try {
      const res = await api.revokeJitElevation(id);
      if (res && res.ok) {
        toast(res.message || `تم سحب الصلاحيات المؤقتة للمستخدم [${user}] فوراً.`, 'success');
        fetchGrants();
      } else {
        toast((res as any)?.error || 'فشل سحب الصلاحيات.', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ أثناء سحب الصلاحيات', 'error');
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.requestJitElevation({
        role: targetRole,
        reason,
        duration_mins: durationMins,
      });
      if (res && res.ok) {
        toast(res.message || `تم اعتماد وترقية الصلاحية المؤقتة لمدة (${durationMins} دقيقة) بنجاح.`, 'success');
        setMfaCode('');
        fetchGrants();
      } else {
        toast((res as any)?.error || 'فشل اعتماد طلب الترقية المؤقتة.', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'فشل تقديم طلب الترقية المؤقتة', 'error');
    } finally {
      setSubmitting(false);
    }
  };"""

content_norm = content.replace('\r\n', '\n')
target_norm = target.replace('\r\n', '\n')
replacement_norm = replacement.replace('\r\n', '\n')

if target_norm in content_norm:
    content_norm = content_norm.replace(target_norm, replacement_norm)
    p.write_text(content_norm, encoding='utf-8')
    print('Successfully patched JitElevationPage.tsx')
else:
    print('Target not found in JitElevationPage.tsx')
