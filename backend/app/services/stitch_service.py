"""ASAAS Server Control v2 - Google Stitch Design Integration Service.

Manages, indexes, and serves all 20 Stitch UI screens, specifications, and design tokens.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import List, Dict, Any

from ..core.config import STITCH_DIR


class StitchService:
    """Catalog and index of Google Stitch generated screens."""

    SCREENS_METADATA = [
        {
            'id': '_2',
            'slug': 'overview-oscilloscope',
            'title': 'نظرة عامة وراسم أنوية المعالج (Overview & Oscilloscope)',
            'description': 'المراقبة اللحظية الشاملة وموجات استهلاك الأنوية الـ 8 بنمط راسم الذبذبات التزامني (GNOME Laptop Monitor).',
            'category': 'Core Monitoring',
            'icon': 'dashboard',
            'folder': '_2',
        },
        {
            'id': '_1',
            'slug': 'resource-governor',
            'title': 'مركز التحكم وحاكم الموارد الذكي (Resource Governor)',
            'description': 'إدارة الذاكرة المادية، تفريغ الخمول (Working Set Trim)، وسياسات الأمان الذاتي للموارد.',
            'category': 'Core Monitoring',
            'icon': 'memory',
            'folder': '_1',
        },
        {
            'id': 'jumpserver_bastion',
            'slug': 'jumpserver-bastion',
            'title': 'حصن الوصول الموحد JumpServer Bastion',
            'description': 'بوابة النفاذ متعددة البروتوكولات (SSH, RDP, VNC, Telnet, WinRM, Database, K8s) مع طرفية Luna Web.',
            'category': 'Privileged Access (PAM)',
            'icon': 'shield',
            'folder': 'jumpserver_bastion',
        },
        {
            'id': 'pam',
            'slug': 'pam-assets',
            'title': 'دليل الأصول والخوادم المدارة PAM',
            'description': 'إدارة الأصول السيرفرية، كروت الخوادم، الاتصال المباشر وفحص زمن الاستجابة والنبض.',
            'category': 'Privileged Access (PAM)',
            'icon': 'dns',
            'folder': 'pam',
        },
        {
            'id': '_3',
            'slug': 'credential-vault',
            'title': 'خزنة الحسابات والمفاتيح المشفرة (Credential Vault)',
            'description': 'إدارة بيانات الاعتماد المشفرة بخوارزمية AES-GCM-256 ومفاتيح Master Key السيادية.',
            'category': 'Security & Vault',
            'icon': 'lock',
            'folder': '_3',
        },
        {
            'id': '_8',
            'slug': 'ports-guard',
            'title': 'مراقبة المنافذ ودرع العزل الذكي (PORT-GUARD-v2)',
            'description': 'كشف التعارضات، حجز المنافذ الآلي للمستخدمين، وتفادي تداخل الخدمات دون تدخل بشري.',
            'category': 'Network & Ports',
            'icon': 'lan',
            'folder': '_8',
        },
        {
            'id': '_5',
            'slug': 'cyber-defense',
            'title': 'مصفوفة الدفاع السيبراني ورادار الاختراق (Cyber Defense)',
            'description': 'حظر العناوين المشبوهة، جدار الحماية، وفلتر اعتراض الأوامر التدميرية (Command Risk ACL).',
            'category': 'Security & Vault',
            'icon': 'security',
            'folder': '_5',
        },
        {
            'id': '_9',
            'slug': 'threat-radar',
            'title': 'الرادار الأمني ومراقبة الهجمات اللحظية (Threat Radar)',
            'description': 'خريطة الهجمات الجغرافية ومراقبة المحاولات الفاشلة وكسر كلمات المرور لحظياً.',
            'category': 'Security & Vault',
            'icon': 'radar',
            'folder': '_9',
        },
        {
            'id': '_7',
            'slug': 'storage-files',
            'title': 'إدارة سعة التخزين وتطهير السيرفر (Storage & Files)',
            'description': 'تحليل القرص C:\\، مساحات مجلدات المستخدمين، تنظيف مخلفات Temp، وفك أقفال الملفات.',
            'category': 'System Administration',
            'icon': 'storage',
            'folder': '_7',
        },
        {
            'id': 'rdp',
            'slug': 'users-rdp-access',
            'title': 'حوكمة مستخدمي ويندوز وجلسات RDP (Users & Access)',
            'description': 'إدارة الحسابات المحلية، أذونات Remote Desktop، وصلاحيات Administrator وإرسال الرسائل للشاشات.',
            'category': 'System Administration',
            'icon': 'group',
            'folder': 'rdp',
        },
        {
            'id': '_6',
            'slug': 'compliance-audit',
            'title': 'سلسلة سجلات الامتثال غير القابلة للتلاعب (Audit Ledger)',
            'description': 'سجل تدقيق سيادي مشفر بسلسلة التجزئة SHA-256 لتوثيق جميع العمليات الإدارية.',
            'category': 'Compliance & Audit',
            'icon': 'receipt_long',
            'folder': '_6',
        },
        {
            'id': 'session_replay',
            'slug': 'session-replay',
            'title': 'استرجاع التسجيلات والتحقيق الجنائي الرقمي (Session Replay)',
            'description': 'إعادة تشغيل الجلسات المسجلة بالفيديو وسجل ضغطات المفاتيح (Asciinema player).',
            'category': 'Compliance & Audit',
            'icon': 'smart_display',
            'folder': 'session_replay',
        },
        {
            'id': 'jit_elevation',
            'slug': 'jit-elevation',
            'title': 'مركز اعتماد وترقية الصلاحيات المؤقتة JIT (Just-In-Time)',
            'description': 'طلب وموافقة مؤقتة على صلاحيات المسؤول مع عد تنازلي وسحب آلي للصلاحية بعد انتهاء المهمة.',
            'category': 'Privileged Access (PAM)',
            'icon': 'verified_user',
            'folder': 'jit_elevation',
        },
        {
            'id': 'perimeter_lockout',
            'slug': 'perimeter-lockout',
            'title': 'العزل الأمني السيادي واعتراض الاتصال (Perimeter Lockout)',
            'description': 'شاشة إنفاذ سياسات الطوارئ عند اكتشاف تهديد نشط، عزل السيرفر فوراً عن الشبكة الخارجية.',
            'category': 'Security & Vault',
            'icon': 'gpp_bad',
            'folder': 'perimeter_lockout',
        },
        {
            'id': 'zero_trust_sso',
            'slug': 'zero-trust-sso',
            'title': 'بوابة تسجيل الدخول والتوثيق السيادية (Zero-Trust SSO)',
            'description': 'واجهة تسجيل الدخول الموحدة مع المصادقة الثنائية (MFA / TOTP) وهوية أساس الملكية.',
            'category': 'Authentication',
            'icon': 'key',
            'folder': 'zero_trust_sso',
        },
        {
            'id': '_4',
            'slug': 'system-settings',
            'title': 'إعدادات المنظومة وتنبيهات تيليجرام (Settings & Alerts)',
            'description': 'تكوين بوت تيليجرام، إشعارات البريد، عتبات التحذير للمعالج والذاكرة، ومزامنة الوقت.',
            'category': 'System Administration',
            'icon': 'settings',
            'folder': '_4',
        },
        {
            'id': '_10',
            'slug': 'mobile-dashboard',
            'title': 'لوحة المراقبة السريعة للجوال (Mobile Dashboard)',
            'description': 'تصميم الهاتف المحمول الأمثل للأجهزة الذكية لمتابعة حالة السيرفر من أي مكان.',
            'category': 'Responsive Views',
            'icon': 'smartphone',
            'folder': '_10',
        },
        {
            'id': '_11',
            'slug': 'servers-directory',
            'title': 'دليل الخوادم ومؤشرات النبض اللحظية (Heartbeat Directory)',
            'description': 'فهرس الخوادم الشامل مع مؤشرات Ping وزمن الاستجابة ومنافذ الاتصال.',
            'category': 'Responsive Views',
            'icon': 'router',
            'folder': '_11',
        },
        {
            'id': '_12',
            'slug': 'security-alerts-drawer',
            'title': 'نافذة إشعارات وتنبيهات الأمان (Security Alerts Drawer)',
            'description': 'درج منبثق جانبي لعرض التنبيهات الحرجة وطلبات التدخل الفوري.',
            'category': 'Drawers & Modals',
            'icon': 'notifications',
            'folder': '_12',
        },
        {
            'id': '_13',
            'slug': 'server-detail-sheet',
            'title': 'لوحة تفاصيل الخادم المنبثقة (Server Detail Sheet)',
            'description': 'بطاقة منبثقة تفاعلية تكشف كامل مواصفات الخادم المحدد وسجل نشاطه.',
            'category': 'Drawers & Modals',
            'icon': 'wysiwyg',
            'folder': '_13',
        },
    ]

    @classmethod
    def list_screens(cls) -> List[Dict[str, Any]]:
        """Returns metadata for all available Stitch screens with verified file existence."""
        result = []
        for s in cls.SCREENS_METADATA:
            folder_path = STITCH_DIR / s['folder']
            has_html = (folder_path / 'code.html').is_file()
            has_preview = (folder_path / 'screen.png').is_file()
            
            entry = dict(s)
            entry['has_html'] = has_html
            entry['has_preview'] = has_preview
            entry['html_url'] = f"/stitch/{s['folder']}/code.html"
            entry['preview_url'] = f"/stitch/{s['folder']}/screen.png"
            result.append(entry)
        return result
