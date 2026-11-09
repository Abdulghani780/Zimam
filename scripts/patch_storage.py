from pathlib import Path

p = Path('backend/app/services/storage_service.py')
content = p.read_text(encoding='utf-8')

target1 = '''        return StorageBreakdown(
            drive=drive_path,
            total_gb=total_gb,
            used_gb=used_gb,
            free_gb=free_gb,
            percent_used=pct,
            cleanable_mb=850.0,
            cleanable_gb=0.85,
        )'''

repl1 = '''        # Dynamically measure cleanable temp size
        cleanable = 0.0
        try:
            temp_env = os.environ.get('TEMP')
            if temp_env and os.path.isdir(temp_env):
                cleanable += cls._get_dir_size_mb(Path(temp_env), max_depth=1)
            if os.path.isdir(r'C:\\Windows\\Temp'):
                cleanable += cls._get_dir_size_mb(Path(r'C:\\Windows\\Temp'), max_depth=1)
        except Exception:
            cleanable = 0.0

        cleanable_mb = round(cleanable, 1)
        cleanable_gb = round(cleanable / 1024, 2)

        return StorageBreakdown(
            drive=drive_path,
            total_gb=total_gb,
            used_gb=used_gb,
            free_gb=free_gb,
            percent_used=pct,
            cleanable_mb=cleanable_mb,
            cleanable_gb=cleanable_gb,
        )'''

target2 = '''        if cleaned_mb == 0.0:
            cleaned_mb = 64.5

        return {
            'ok': True,
            'reclaimed_mb': round(cleaned_mb, 1),
            'files_skipped': errors,
            'message': f'تم تنظيف مخلفات السيرفر بنجاح واسترداد {round(cleaned_mb, 1)} ميجابايت.',
        }'''

repl2 = '''        reclaimed = round(cleaned_mb, 1)
        if reclaimed > 0:
            msg = f'تم تنظيف مخلفات السيرفر بنجاح واسترداد {reclaimed} ميجابايت.'
        else:
            msg = 'تم فحص المجلدات المؤقتة، والملفات المتبقية قيد الاستخدام حالياً بواسطة برامج نشطة.'

        return {
            'ok': True,
            'reclaimed_mb': reclaimed,
            'files_skipped': errors,
            'message': msg,
        }'''

if target1 in content and target2 in content:
    content = content.replace(target1, repl1).replace(target2, repl2)
    p.write_text(content, encoding='utf-8')
    print('Successfully patched storage_service.py')
else:
    print('Failed: target not found. Checking CRLF...')
    content_norm = content.replace('\r\n', '\n')
    target1_norm = target1.replace('\r\n', '\n')
    target2_norm = target2.replace('\r\n', '\n')
    if target1_norm in content_norm and target2_norm in content_norm:
        content_norm = content_norm.replace(target1_norm, repl1.replace('\r\n', '\n')).replace(target2_norm, repl2.replace('\r\n', '\n'))
        p.write_text(content_norm, encoding='utf-8')
        print('Successfully patched storage_service.py with normalized newlines')
    else:
        print('Targets still not found')
