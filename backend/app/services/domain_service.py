"""ZIMAM v2.5 - Active Directory & Windows Domain Discovery Service.

Detects Windows Server Domain role (Domain Controller vs Domain Member vs Standalone Server),
enumerates domain users/groups when joined, distinguishes local vs domain accounts visually,
and enforces security guards preventing dangerous operations on Domain Controllers.
"""
from __future__ import annotations

import ctypes
from ctypes import wintypes
import logging
import subprocess
from typing import Dict, Any, List

logger = logging.getLogger('zimam.domain')

# Domain role mapping from Win32_ComputerSystem
DOMAIN_ROLE_NAMES = {
    0: 'محطة عمل مستقلة (Standalone Workstation)',
    1: 'محطة عمل عضو في نطاق (Member Workstation)',
    2: 'سيرفر مستقل / بيئة عمل محلية (Standalone Server)',
    3: 'سيرفر عضو في نطاق (Domain Member Server)',
    4: 'متحكم نطاق احتياطي (Backup Domain Controller - BDC)',
    5: 'متحكم نطاق رئيسي (Primary Domain Controller - PDC)',
}


class DomainService:
    """Service for diagnosing Windows Server domain membership and Active Directory integration."""

    _cached_profile: Dict[str, Any] = {}

    @classmethod
    def get_domain_profile(cls) -> Dict[str, Any]:
        """Queries Windows WMI/CIM for current domain role and computer system attributes."""
        if cls._cached_profile:
            return cls._cached_profile

        profile: Dict[str, Any] = {
            'is_domain_joined': False,
            'is_domain_controller': False,
            'domain_role': 2,
            'domain_name': 'WORKGROUP',
            'workgroup': 'WORKGROUP',
            'role_display': DOMAIN_ROLE_NAMES[2],
            'can_manage_domain': False,
            'can_modify_users_locally': True,
        }

        try:
            # Query Win32_ComputerSystem
            cmd = [
                'powershell', '-NoProfile', '-Command',
                'Get-CimInstance Win32_ComputerSystem | Select-Object Domain, PartOfDomain, DomainRole, Workgroup | ConvertTo-Json -Compress'
            ]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=5, creationflags=0x08000000)
            if res.returncode == 0 and res.stdout.strip():
                import json
                data = json.loads(res.stdout.strip())
                role = int(data.get('DomainRole', 2))
                part_of_domain = bool(data.get('PartOfDomain', False))
                domain = str(data.get('Domain', 'WORKGROUP'))
                workgroup = str(data.get('Workgroup', 'WORKGROUP'))

                is_dc = role in (4, 5)

                profile.update({
                    'is_domain_joined': part_of_domain,
                    'is_domain_controller': is_dc,
                    'domain_role': role,
                    'domain_name': domain if part_of_domain else workgroup,
                    'workgroup': workgroup,
                    'role_display': DOMAIN_ROLE_NAMES.get(role, f'سيرفر بنمط {role}'),
                    'can_manage_domain': is_dc or part_of_domain,
                    'can_modify_users_locally': not is_dc,  # Block local modification if PDC/BDC
                })
        except Exception as exc:
            logger.warning("Failed to query domain profile via CIM: %s", exc)

        cls._cached_profile = profile
        return profile

    @classmethod
    def list_domain_users(cls) -> List[Dict[str, Any]]:
        """Lists Active Directory domain users if server is joined to domain and has privileges."""
        profile = cls.get_domain_profile()
        if not profile.get('is_domain_joined'):
            return []

        domain_users: List[Dict[str, Any]] = []
        try:
            cmd = ['net', 'user', '/domain']
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=8, creationflags=0x08000000)
            if res.returncode == 0:
                lines = res.stdout.splitlines()
                # Parse output table
                start_parsing = False
                for line in lines:
                    line = line.strip()
                    if '-----------------' in line:
                        start_parsing = True
                        continue
                    if 'The command completed' in line or not line:
                        continue
                    if start_parsing:
                        parts = line.split()
                        for p in parts:
                            if p and not p.startswith('-'):
                                domain_users.append({
                                    'username': p,
                                    'domain': profile['domain_name'],
                                    'is_domain': True,
                                    'type': 'Domain Account',
                                })
        except Exception as exc:
            logger.warning("Failed to enumerate domain users: %s", exc)

        return domain_users
