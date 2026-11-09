from pathlib import Path

p = Path('frontend/src/pages/AuditPage.tsx')
content = p.read_text(encoding='utf-8')

target = """  const handleVerifyChain = () => {
    setVerifying(true);
    toast('جاري إعادة حساب شجرة ميركل ومطابقة الأختام التشفيرية...', 'success');
    setTimeout(() => {
      setVerifying(false);
      toast('تم التحقق: جميع كتل السلسلة مطابقة بنسبة 100% ودون أي خرق أو تعديل.', 'success');
    }, 1200);
  };"""

replacement = """  const handleVerifyChain = async () => {
    setVerifying(true);
    try {
      const res = await api.verifyAuditChain();
      if (res && res.ok) {
        toast(res.message || `تم التحقق بنجاح: تم تدقيق ${res.records_checked} سجل أمني والبصمة متطابقة 100%.`, 'success');
      } else {
        toast((res as any)?.error || 'فشل التحقق من السلسلة التشفيرية.', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ أثناء الاتصال بخدمة التحقق', 'error');
    } finally {
      setVerifying(false);
    }
  };"""

content_norm = content.replace('\r\n', '\n')
target_norm = target.replace('\r\n', '\n')
replacement_norm = replacement.replace('\r\n', '\n')

if target_norm in content_norm:
    content_norm = content_norm.replace(target_norm, replacement_norm)
    p.write_text(content_norm, encoding='utf-8')
    print('Successfully patched AuditPage.tsx')
else:
    print('Target not found in AuditPage.tsx')
