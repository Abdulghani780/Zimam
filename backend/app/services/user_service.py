"""ASAAS Server Control v2 - Local Windows User & Access Management Service.

Lists Windows user accounts, administrator rights, RDP access permissions, and session associations.
"""
from __future__ import annotations

import ctypes
import os
import re
import subprocess
from ctypes import wintypes
from typing import List, Dict, Any, Set

from ..domain.models import LocalUser
from ..infrastructure.win32_wts import Win32WtsService


class UserService:
    """Service for querying and managing local Windows user accounts and permissions."""

    @staticmethod
    def _get_group_members(group_name: str) -> Set[str]:
        """Queries local group membership using NetLocalGroupGetMembers from netapi32.dll."""
        members: Set[str] = set()
        try:
            netapi32 = ctypes.WinDLL('netapi32', use_last_error=True)
            
            class LOCALGROUP_MEMBERS_INFO_1(ctypes.Structure):
                _fields_ = [
                    ('lgrmi1_sid', ctypes.c_void_p),
                    ('lgrmi1_sidusage', wintypes.DWORD),
                    ('lgrmi1_name', wintypes.LPWSTR),
                ]

            buf = ctypes.c_void_p()
            entries_read = wintypes.DWORD()
            total_entries = wintypes.DWORD()
            resume_handle = wintypes.DWORD(0)

            # NetLocalGroupGetMembers(servername, groupname, level, bufptr, prefmaxlen, entriesread, totalentries, resumehandle)
            res = netapi32.NetLocalGroupGetMembers(
                None,
                wintypes.LPCWSTR(group_name),
                1,
                ctypes.byref(buf),
                -1,
                ctypes.byref(entries_read),
                ctypes.byref(total_entries),
                ctypes.byref(resume_handle)
            )

            if res == 0 and buf.value:
                p_items = ctypes.cast(buf, ctypes.POINTER(LOCALGROUP_MEMBERS_INFO_1))
                for i in range(entries_read.value):
                    item = p_items[i]
                    if item.lgrmi1_name:
                        # Extract username from DOMAIN\Username
                        clean_name = item.lgrmi1_name.split('\\')[-1].lower()
                        members.add(clean_name)
                netapi32.NetApiBufferFree(buf)
        except Exception:
            pass
        return members

    @classmethod
    def list_users(cls) -> List[LocalUser]:
        """Lists local Windows users with full permission enrichment."""
        users: List[LocalUser] = []
        admins = cls._get_group_members('Administrators')
        rdp_users = cls._get_group_members('Remote Desktop Users')

        # Active sessions map
        active_sessions = Win32WtsService.list_active_sessions()
        session_map: Dict[str, int] = {
            s.username.lower(): s.session_id for s in active_sessions
        }

        # Query user accounts via netapi32.dll NetUserEnum (Level 1)
        try:
            netapi32 = ctypes.WinDLL('netapi32', use_last_error=True)

            class USER_INFO_1(ctypes.Structure):
                _fields_ = [
                    ('usri1_name', wintypes.LPWSTR),
                    ('usri1_password', wintypes.LPWSTR),
                    ('usri1_password_age', wintypes.DWORD),
                    ('usri1_priv', wintypes.DWORD),
                    ('usri1_home_dir', wintypes.LPWSTR),
                    ('usri1_comment', wintypes.LPWSTR),
                    ('usri1_flags', wintypes.DWORD),
                    ('usri1_script_path', wintypes.LPWSTR),
                ]

            buf = ctypes.c_void_p()
            entries_read = wintypes.DWORD()
            total_entries = wintypes.DWORD()
            resume_handle = wintypes.DWORD(0)

            # UF_ACCOUNTDISABLE = 0x0002
            res = netapi32.NetUserEnum(
                None,
                1,
                0x0002,  # FILTER_NORMAL_ACCOUNT
                ctypes.byref(buf),
                -1,
                ctypes.byref(entries_read),
                ctypes.byref(total_entries),
                ctypes.byref(resume_handle)
            )

            if res == 0 and buf.value:
                p_users = ctypes.cast(buf, ctypes.POINTER(USER_INFO_1))
                for i in range(entries_read.value):
                    u = p_users[i]
                    if not u.usri1_name:
                        continue
                    uname = u.usri1_name
                    uname_lower = uname.lower()

                    is_enabled = not bool(u.usri1_flags & 0x0002)
                    is_admin_user = (uname_lower in admins) or (u.usri1_priv == 2)
                    is_rdp_user = (uname_lower in rdp_users) or is_admin_user
                    active_sid = session_map.get(uname_lower)

                    users.append(LocalUser(
                        username=uname,
                        full_name=u.usri1_comment or uname,
                        enabled=is_enabled,
                        is_rdp=is_rdp_user,
                        is_admin=is_admin_user,
                        password_age_days=u.usri1_password_age // 86400 if u.usri1_password_age else 0,
                        description=u.usri1_comment or '',
                    ))
                netapi32.NetApiBufferFree(buf)
        except Exception:
            pass

        # Fallback to C:\Users directories if NetUserEnum failed
        if not users:
            users_root = 'C:\\Users'
            if os.path.isdir(users_root):
                for d in os.listdir(users_root):
                    if d.lower() in ('public', 'default', 'default user', 'all users'):
                        continue
                    full = os.path.join(users_root, d)
                    if os.path.isdir(full):
                        d_lower = d.lower()
                        users.append(LocalUser(
                            username=d,
                            full_name=d,
                            enabled=True,
                            is_rdp=(d_lower in rdp_users) or (d_lower in admins),
                            is_admin=(d_lower in admins) or (d_lower == 'administrator'),
                        ))

        return sorted(users, key=lambda x: (not x.enabled, x.username))

    # --- Netapi32 user provisioning (keeps passwords out of the process list) ---

    class _USER_INFO_1(ctypes.Structure):
        _fields_ = [
            ('usri1_name', wintypes.LPWSTR),
            ('usri1_password', wintypes.LPWSTR),
            ('usri1_password_age', wintypes.DWORD),
            ('usri1_priv', wintypes.DWORD),
            ('usri1_home_dir', wintypes.LPWSTR),
            ('usri1_comment', wintypes.LPWSTR),
            ('usri1_flags', wintypes.DWORD),
            ('usri1_script_path', wintypes.LPWSTR),
        ]

    class _USER_INFO_1003(ctypes.Structure):
        _fields_ = [('usri1003_password', wintypes.LPWSTR)]

    _NERR_MESSAGES = {
        5: 'تم رفض الوصول (Access Denied). يتطلب ذلك تشغيل السيرفر كمسؤول.',
        2224: 'اسم المستخدم موجود مسبقاً على هذا الجهاز.',
        2227: 'حساب المستخدم غير موجود.',
        2245: 'كلمة المرور لا تستوفي سياسة التعقيد في هذا الجهاز.',
    }

    @classmethod
    def _netapi_error(cls, code: int) -> str:
        return cls._NERR_MESSAGES.get(code, f'فشلت عملية حساب المستخدم (رمز الخطأ NetApi: {code}).')

    @staticmethod
    def _net_user_add(username: str, password: str, comment: str = '') -> int:
        """Creates a local account via NetUserAdd — the password never touches a command line."""
        netapi32 = ctypes.WinDLL('netapi32', use_last_error=True)
        ui = UserService._USER_INFO_1()
        ui.usri1_name = username
        ui.usri1_password = password
        ui.usri1_priv = 1  # USER_PRIV_USER
        ui.usri1_home_dir = None
        ui.usri1_comment = comment or None
        ui.usri1_flags = 0x0200  # UF_NORMAL_ACCOUNT
        ui.usri1_script_path = None
        parm_err = wintypes.DWORD()
        return netapi32.NetUserAdd(None, 1, ctypes.byref(ui), ctypes.byref(parm_err))

    @staticmethod
    def _net_user_set_password(username: str, password: str) -> int:
        """Sets a local account password via NetUserSetInfo level 1003."""
        netapi32 = ctypes.WinDLL('netapi32', use_last_error=True)
        ui = UserService._USER_INFO_1003()
        ui.usri1003_password = password
        return netapi32.NetUserSetInfo(None, username, 1003, ctypes.byref(ui), None)

    @staticmethod
    def create_user(username: str, password: str, full_name: str = '', is_rdp: bool = True, is_admin: bool = False) -> Dict[str, Any]:
        """Creates a local Windows user and assigns requested group privileges."""
        clean_user = username.strip()
        if not clean_user or not re.match(r'^[a-zA-Z0-9_\-\.]{2,30}$', clean_user):
            return {'ok': False, 'error': 'اسم المستخدم غير صالح. استخدم أحرف إنجليزية وأرقام فقط.'}
        if not password or len(password) < 8:
            return {'ok': False, 'error': 'كلمة المرور قصيرة جداً (الحد الأدنى 8 رموز).'}

        try:
            # 1. Create user (password stays inside the process, never in argv)
            code = UserService._net_user_add(clean_user, password, full_name.strip())
            if code != 0:
                return {'ok': False, 'error': UserService._netapi_error(code)}

            # 2. Add to Remote Desktop Users if requested
            if is_rdp:
                subprocess.run(
                    ['net', 'localgroup', 'Remote Desktop Users', clean_user, '/add'],
                    capture_output=True, text=True, timeout=10, creationflags=0x08000000
                )

            # 3. Add to Administrators if requested
            if is_admin:
                subprocess.run(
                    ['net', 'localgroup', 'Administrators', clean_user, '/add'],
                    capture_output=True, text=True, timeout=10, creationflags=0x08000000
                )

            return {'ok': True, 'username': clean_user, 'message': f'تم إنشاء المستخدم {clean_user} بنجاح.'}
        except Exception as exc:
            return {'ok': False, 'error': str(exc)}

    @staticmethod
    def delete_user(username: str) -> Dict[str, Any]:
        """Deletes a local Windows user."""
        clean_user = username.strip()
        protected = {'administrator', 'guest', 'defaultaccount', 'wdagutilityaccount', 'system'}
        if clean_user.lower() in protected:
            return {'ok': False, 'error': 'لا يمكن حذف حساب النظام الأساسي.'}

        try:
            cmd = ['net', 'user', clean_user, '/delete']
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=10, creationflags=0x08000000)
            if res.returncode != 0:
                return {'ok': False, 'error': res.stderr.strip() or res.stdout.strip() or 'فشل حذف المستخدم.'}
            return {'ok': True, 'username': clean_user, 'message': f'تم حذف المستخدم {clean_user} بنجاح.'}
        except Exception as exc:
            return {'ok': False, 'error': str(exc)}

    @staticmethod
    def toggle_user_state(username: str, enabled: bool) -> Dict[str, Any]:
        """Enables or disables a local Windows user."""
        clean_user = username.strip()
        protected = {'administrator', 'system'}
        if not enabled and clean_user.lower() in protected:
            return {'ok': False, 'error': 'لا يمكن تعطيل حساب مسؤول النظام الرئيسي.'}

        try:
            active_val = 'yes' if enabled else 'no'
            cmd = ['net', 'user', clean_user, f'/active:{active_val}']
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=10, creationflags=0x08000000)
            if res.returncode != 0:
                return {'ok': False, 'error': res.stderr.strip() or res.stdout.strip() or 'فشل تغيير حالة المستخدم.'}
            return {'ok': True, 'username': clean_user, 'enabled': enabled, 'message': f'تم تحديث حالة المستخدم {clean_user}.'}
        except Exception as exc:
            return {'ok': False, 'error': str(exc)}

    @staticmethod
    def reset_password(username: str, new_password: str) -> Dict[str, Any]:
        """Resets the password for a local Windows user."""
        clean_user = username.strip()
        if not clean_user or not new_password:
            return {'ok': False, 'error': 'اسم المستخدم وكلمة المرور الجديدة مطلوبان.'}
        if len(new_password) < 8:
            return {'ok': False, 'error': 'كلمة المرور قصيرة جداً (الحد الأدنى 8 رموز).'}
        try:
            code = UserService._net_user_set_password(clean_user, new_password)
            if code != 0:
                return {'ok': False, 'error': UserService._netapi_error(code)}
            return {'ok': True, 'username': clean_user, 'message': f'تم تغيير كلمة مرور مستخدم ويندوز {clean_user} بنجاح.'}
        except Exception as exc:
            return {'ok': False, 'error': str(exc)}
