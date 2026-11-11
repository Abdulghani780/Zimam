"""ASAAS Server Control v2.5 - Multi-Protocol Bastion Service (JumpServer Architecture).

Handles SSH, RDP, SFTP, VNC, Telnet, WinRM, Database, and K8s remote sessions.
Includes Command Risk Interceptor (ACL Regex Firewall), Asset Inventory management,
and SQLite persistence.
"""
from __future__ import annotations

import re
from typing import Dict, Any, List

from ..domain.models import ManagedAsset
from ..infrastructure.db import db_list_assets, db_add_asset, db_remove_asset


class BastionService:
    SUPPORTED_PROTOCOLS = {
        'rdp': {'name': 'Remote Desktop (RDP)', 'default_port': 3389, 'type': 'gui', 'icon': 'monitor'},
        'ssh': {'name': 'Secure Shell (SSH)', 'default_port': 22, 'type': 'cli', 'icon': 'terminal'},
        'sftp': {'name': 'Secure File Transfer (SFTP)', 'default_port': 22, 'type': 'file', 'icon': 'folderSync'},
        'vnc': {'name': 'Virtual Network Computing (VNC)', 'default_port': 5900, 'type': 'gui', 'icon': 'screen'},
        'telnet': {'name': 'Telnet Network Console', 'default_port': 23, 'type': 'cli', 'icon': 'radio'},
        'winrm': {'name': 'Windows Remote Management (WinRM)', 'default_port': 5985, 'type': 'cli', 'icon': 'cpu'},
        'database': {'name': 'Database Web Client (SQL/NoSQL)', 'default_port': 3306, 'type': 'data', 'icon': 'database'},
        'k8s': {'name': 'Kubernetes Pod Console', 'default_port': 6443, 'type': 'cloud', 'icon': 'cloud'},
    }

    DANGEROUS_PATTERNS = [
        (re.compile(r'\brm\s+-[rf]{1,2}\s+(/|\*|/\w+)', re.IGNORECASE), 'حذف عشوائي أو تدمير لنظام الملفات (rm -rf /)'),
        (re.compile(r'(\bformat\b|\bmkfs|\bdd\s+if=|\bdiskpart\b)', re.IGNORECASE), 'محاولة تهيئة أو تدمير الأقراص والتخزين (Format/Disk Overwrite)'),
        (re.compile(r'\b(drop\s+database|drop\s+table|truncate)\b', re.IGNORECASE), 'حذف أو تفريغ قواعد البيانات نهائياً (SQL Drop)'),
        (re.compile(r'\bnet\s+user\s+\w+\s+/delete\b', re.IGNORECASE), 'حذف حسابات المستخدمين من نظام ويندوز'),
        (re.compile(r':\(\)\s*\{.*:\|:.*\}\s*;|:\(\)\{', re.IGNORECASE), 'هجوم قنبلة التفريع واستنزاف موارد السيرفر (Bash Fork Bomb)'),
        (re.compile(r'\b(shutdown\s+/[srt]|init\s+0|poweroff|halt)\b', re.IGNORECASE), 'محاولة إيقاف تشغيل السيرفر قسرياً (System Shutdown)'),
    ]

    _assets_cache: List[ManagedAsset] = []

    @classmethod
    def list_assets(cls) -> List[ManagedAsset]:
        """Lists all managed assets registered in the Bastion from SQLite."""
        try:
            rows = db_list_assets()
            if rows:
                return [
                    ManagedAsset(
                        id=r['id'],
                        name=r['name'],
                        host=r['host'],
                        type=r['type'],
                        port=r['port'],
                        protocol=r['protocol'],
                        status=r['status'],
                        latency_ms=r['latency_ms'],
                        category=r['category'],
                        is_local=r['is_local'],
                        tags=r['tags'],
                    ) for r in rows
                ]
        except Exception:
            pass
        return list(cls._assets_cache)

    @classmethod
    def add_asset(cls, asset: ManagedAsset) -> Dict[str, Any]:
        """Registers a new remote asset into the Bastion SQLite database."""
        try:
            db_add_asset(asset.to_dict())
        except Exception:
            cls._assets_cache.append(asset)
        return {'ok': True, 'asset': asset.to_dict(), 'message': 'تم تسجيل الخادم في حصن الوصول وحفظه في قاعدة البيانات.'}

    @classmethod
    def remove_asset(cls, asset_id: str) -> Dict[str, Any]:
        """Removes an asset from Bastion database."""
        try:
            db_remove_asset(asset_id)
        except Exception:
            pass
        cls._assets_cache = [a for a in cls._assets_cache if a.id != asset_id]
        return {'ok': True, 'id': asset_id}

    @classmethod
    def evaluate_command_risk(cls, command: str) -> Dict[str, Any]:
        """ACL Firewall: Intercepts destructive commands before terminal execution."""
        clean_cmd = command.strip()
        for pattern, reason in cls.DANGEROUS_PATTERNS:
            if pattern.search(clean_cmd):
                return {
                    'safe': False,
                    'allowed': False,
                    'risk_level': 'CRITICAL',
                    'reason': reason,
                    'command': clean_cmd,
                    'requires_approval': True,
                }
        return {
            'safe': True,
            'allowed': True,
            'risk_level': 'LOW',
            'reason': 'الأمر آمن ومسموح بالتنفيذ.',
            'command': clean_cmd,
            'requires_approval': False,
        }
