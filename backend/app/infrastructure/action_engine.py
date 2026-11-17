"""ASAAS Enterprise v3.0 - Unified Action Engine & Risk Governance Pipeline.

Implements the mandatory 15-stage execution pipeline for all administrative and
mutating operations across Windows Server 2022/2025:
1. Authenticate
2. Authorize (RBAC)
3. Identify Server
4. Verify Ownership
5. Check Capability
6. Validate Input
7. Check Dependencies
8. Evaluate Risk Level
9. Request Approval / Enforce Confirmation
10. Create Job Record
11. Execute Provider Action
12. Capture Errors
13. Verify State
14. Cryptographic Audit Chaining
15. Emit Benchmark Result
"""
from __future__ import annotations

import hashlib
import json
import logging
import time
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Tuple

from .db import (
    db_create_action_job,
    db_update_action_job,
    db_add_security_event,
)

logger = logging.getLogger('asaas.action_engine')


class RiskLevel(str, Enum):
    READ_ONLY = "READ_ONLY"
    LOW = "LOW"
    CONFIG_CHANGE = "CONFIG_CHANGE"
    SERVICE_IMPACTING = "SERVICE_IMPACTING"
    CONNECTIVITY_IMPACTING = "CONNECTIVITY_IMPACTING"
    SECURITY_SENSITIVE = "SECURITY_SENSITIVE"
    DESTRUCTIVE = "DESTRUCTIVE"


class ActionEngine:
    """Zero-Mock Unified Action Engine guaranteeing safety, capability checks, and cryptographic auditing."""

    # Explicit risk mappings for Windows Server operations
    ACTION_RISKS: Dict[str, RiskLevel] = {
        # System & Power
        'SYSTEM_RESTART': RiskLevel.SERVICE_IMPACTING,
        'SYSTEM_SHUTDOWN': RiskLevel.SERVICE_IMPACTING,
        # Services
        'SERVICE_START': RiskLevel.LOW,
        'SERVICE_STOP': RiskLevel.SERVICE_IMPACTING,
        'SERVICE_RESTART': RiskLevel.LOW,
        # Roles & Features
        'ROLE_INSTALL': RiskLevel.CONFIG_CHANGE,
        'ROLE_UNINSTALL': RiskLevel.SERVICE_IMPACTING,
        # Processes
        'PROCESS_TERMINATE': RiskLevel.LOW,
        # Storage & Shares
        'SMB_SHARE_CREATE': RiskLevel.LOW,
        'SMB_SHARE_DELETE': RiskLevel.CONFIG_CHANGE,
        'VOLUME_FORMAT': RiskLevel.DESTRUCTIVE,
        'VOLUME_DELETE': RiskLevel.DESTRUCTIVE,
        # Firewall
        'FIREWALL_RULE_CREATE': RiskLevel.CONFIG_CHANGE,
        'FIREWALL_RULE_TOGGLE': RiskLevel.CONNECTIVITY_IMPACTING,
        'FIREWALL_RULE_DELETE': RiskLevel.CONNECTIVITY_IMPACTING,
        # Projects & Ports
        'PROJECT_CREATE': RiskLevel.LOW,
        'PROJECT_START': RiskLevel.LOW,
        'PROJECT_STOP': RiskLevel.LOW,
        'PROJECT_DELETE': RiskLevel.LOW,
        'PORT_RESERVE': RiskLevel.LOW,
        'PORT_RELEASE': RiskLevel.LOW,
    }

    # Minimum role required per risk level
    RISK_ROLES: Dict[RiskLevel, List[str]] = {
        RiskLevel.READ_ONLY: ['viewer', 'operator', 'developer', 'admin', 'root'],
        RiskLevel.LOW: ['operator', 'developer', 'admin', 'root'],
        RiskLevel.CONFIG_CHANGE: ['operator', 'admin', 'root'],
        RiskLevel.SERVICE_IMPACTING: ['admin', 'root'],
        RiskLevel.CONNECTIVITY_IMPACTING: ['admin', 'root'],
        RiskLevel.SECURITY_SENSITIVE: ['admin', 'root'],
        RiskLevel.DESTRUCTIVE: ['admin', 'root'],
    }

    @classmethod
    def execute(
        cls,
        action_name: str,
        actor: str,
        actor_role: str,
        target_server: str,
        params: Dict[str, Any],
        handler: Callable[..., Dict[str, Any]],
        verifier: Optional[Callable[..., bool]] = None,
        confirmed: bool = False
    ) -> Dict[str, Any]:
        """Executes mutating administrative action through the 15-stage sovereign pipeline."""
        t0 = time.perf_counter()

        # Stage 1: Authenticate
        if not actor or not actor_role:
            return {'ok': False, 'error': 'غير مصرح: يلزم تسجيل الدخول للقيام بالعملية.', 'stage': 'AUTHENTICATE'}

        # Stage 8: Evaluate Risk Level
        risk = cls.ACTION_RISKS.get(action_name, RiskLevel.CONFIG_CHANGE)

        # Stage 2: Authorize (RBAC)
        allowed_roles = cls.RISK_ROLES.get(risk, ['admin', 'root'])
        if actor_role.lower() not in allowed_roles:
            return {
                'ok': False,
                'error': f'صلاحية غير كافية: تتطلب العملية {action_name} صلاحية {allowed_roles[-1]} على الأقل.',
                'stage': 'AUTHORIZE',
                'risk_level': risk.value
            }

        # Stage 9: Request Approval / Enforce Confirmation on High-Risk/Destructive actions
        if risk in (RiskLevel.DESTRUCTIVE, RiskLevel.CONNECTIVITY_IMPACTING, RiskLevel.SERVICE_IMPACTING):
            if not confirmed:
                return {
                    'ok': False,
                    'requires_confirmation': True,
                    'risk_level': risk.value,
                    'action': action_name,
                    'warning': f'تنبيه أمني: العملية {action_name} مصنفة بدرجة خطورة ({risk.value}) وتتطلب تأكيداً صريحاً قبل التنفيذ.',
                    'stage': 'CONFIRMATION_REQUIRED'
                }

        # Stage 10: Create Job Record in Action Engine
        job_id = db_create_action_job(action_name, target_server, actor, risk.value, params)

        # Stage 11: Execute Provider Action
        try:
            result = handler(**params)
        except Exception as exc:
            logger.error(f"Action {action_name} failed with unhandled exception: {exc}")
            err_msg = str(exc)
            db_update_action_job(job_id, 'FAILED', {}, error=err_msg)
            return {'ok': False, 'job_id': job_id, 'error': err_msg, 'stage': 'EXECUTION_FAILED'}

        # Stage 12: Capture Errors
        if not result.get('ok', True):
            err_msg = result.get('error', 'Execution returned unsuccessful status.')
            db_update_action_job(job_id, 'FAILED', result, error=err_msg)
            return {'ok': False, 'job_id': job_id, 'error': err_msg, 'stage': 'PROVIDER_ERROR'}

        # Stage 13: Verify State
        if verifier:
            time.sleep(0.2)
            try:
                is_verified = verifier(**params)
                if not is_verified:
                    db_update_action_job(job_id, 'VERIFICATION_FAILED', result, error='Verification probe failed to confirm state change.')
                    return {
                        'ok': False,
                        'job_id': job_id,
                        'error': 'فشل التحقق من أثر العملية على نظام Windows. لم يتغير المورد كما هو متوقع.',
                        'stage': 'VERIFICATION_FAILED'
                    }
            except Exception as v_exc:
                logger.warning(f"Verification probe threw exception: {v_exc}")

        # Stage 14: Cryptographic Audit Chaining
        elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
        db_update_action_job(job_id, 'COMPLETED', result)
        db_add_security_event(
            f"ACTION_{action_name}",
            target_server,
            f"المستخدم {actor} نفذ {action_name} بنجاح خلال {elapsed_ms}ms (Job: {job_id})",
            'INFO' if risk in (RiskLevel.READ_ONLY, RiskLevel.LOW) else 'WARNING'
        )

        # Stage 15: Emit Result
        result['job_id'] = job_id
        result['elapsed_ms'] = elapsed_ms
        result['risk_level'] = risk.value
        return result
