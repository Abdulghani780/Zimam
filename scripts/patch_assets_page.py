from pathlib import Path

p = Path('frontend/src/pages/AssetsPage.tsx')
content = p.read_text(encoding='utf-8')

target = """  const handleConnectBastion = (a: AssetItem) => {
    toast(`جاري فتح جلسة اتصال مشفرة عبر بوابة PAM Bastion للخادم [${a.name}]...`, 'success');
    setTimeout(() => {
      window.open(`/api/bastion/connect?host=${a.host}&port=${a.port}`, '_blank');
    }, 600);
  };

  const handleTrimServer = async (a: AssetItem) => {
    toast(`تم إرسال أمر تفريغ الذاكرة (Working Set Trim) للخادم [${a.name}]...`, 'success');
    try {
      await api.trimGovernor();
    } catch {
      // ignore
    }
  };"""

replacement = """  const handleConnectBastion = (a: AssetItem) => {
    toast(`جاري فتح جلسة اتصال مشفرة عبر بوابة PAM Bastion للخادم [${a.name}]...`, 'success');
    window.open(`/api/bastion/connect?host=${encodeURIComponent(a.host)}&port=${a.port}&name=${encodeURIComponent(a.name)}`, '_blank');
  };

  const handleTrimServer = async (a: AssetItem) => {
    try {
      const res = await api.trimGovernor();
      if (res && res.ok) {
        const rec = res.reclaimed_mb ?? (res as any)?.result?.reclaimed_mb ?? 0;
        if (rec > 0) {
          toast(`تم تفريغ ذاكرة الخادم [${a.name}] بنجاح — تم استرداد ${rec} MB.`, 'success');
        } else {
          toast(res.message || `ذاكرة الخادم [${a.name}] محسنة بالكامل بالفعل.`, 'success');
        }
      } else {
        toast((res as any)?.error || 'فشل تفريغ ذاكرة الخادم.', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ أثناء تنفيذ تفريغ الذاكرة', 'error');
    }
  };"""

content_norm = content.replace('\r\n', '\n')
target_norm = target.replace('\r\n', '\n')
replacement_norm = replacement.replace('\r\n', '\n')

if target_norm in content_norm:
    content_norm = content_norm.replace(target_norm, replacement_norm)
    p.write_text(content_norm, encoding='utf-8')
    print('Successfully patched AssetsPage.tsx')
else:
    print('Target not found in AssetsPage.tsx')
