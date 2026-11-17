"""ASAAS v2.5 - Enterprise Emergency Alerting Service.

Monitors CPU/RAM thresholds, critical system services, and brute-force events,
dispatching alerts via Telegram Bot with intelligent cooldown to prevent alert flooding.
Guarantees secret token masking in all logs and API responses.
"""
from __future__ import annotations

import json
import logging
import re
import threading
import time
import urllib.parse
import urllib.request
from typing import Dict, Any, Optional

from ..infrastructure.db import (
    db_add_security_event,
    db_get_system_metadata,
    db_set_system_metadata,
)

logger = logging.getLogger('asaas.alerts')

_ALERT_CONFIG_METADATA_KEY = 'alert_service_config'

# Alert category cooldown tracking (timestamp of last sent alert)
_LAST_ALERT_TIMES: Dict[str, float] = {}
_COOLDOWN_SECONDS: int = 600  # 10 minutes default cooldown


def mask_secret(secret: str) -> str:
    """Masks sensitive tokens/keys preventing accidental disclosure in logs or UI."""
    if not secret:
        return ''
    if len(secret) <= 8:
        return '••••••••'
    # For Telegram tokens formatted as 123456789:ABCdef...
    if ':' in secret:
        parts = secret.split(':', 1)
        return f"{parts[0]}:••••••••••••"
    return f"{secret[:4]}••••••••{secret[-4:]}"


class AlertService:
    """Centralized enterprise alerting engine for ASAAS."""

    _config: Dict[str, Any] = {
        'telegram_enabled': False,
        'bot_token': '',
        'chat_id': '',
        'email_enabled': False,
        'smtp_server': '',
        'smtp_port': 587,
        'cpu_threshold': 85,
        'ram_threshold': 90,
        'disk_threshold': 90,
        'cooldown_minutes': 10,
        'rule_brute_force': True,
        'rule_command_risk': True,
        'rule_port_flood': True,
        'rule_service_crash': True,
    }
    _config_loaded: bool = False

    @classmethod
    def _load_config(cls) -> None:
        """Loads the persisted alert configuration from SQLite on first use."""
        if cls._config_loaded:
            return
        cls._config_loaded = True
        raw = db_get_system_metadata(_ALERT_CONFIG_METADATA_KEY)
        if not raw:
            return
        try:
            persisted = json.loads(raw)
        except (TypeError, ValueError):
            logger.warning("Persisted alert configuration is not valid JSON; using defaults.")
            return
        if isinstance(persisted, dict):
            for key, value in persisted.items():
                if key in cls._config:
                    cls._config[key] = value

    @classmethod
    def initialize(cls) -> None:
        """Warms the persisted configuration during server startup."""
        cls._load_config()

    @classmethod
    def get_config(cls, mask_secrets: bool = True) -> Dict[str, Any]:
        cls._load_config()
        cfg = dict(cls._config)
        if mask_secrets:
            raw_token = cfg.get('bot_token') or ''
            cfg['bot_token_configured'] = bool(raw_token)
            if raw_token:
                cfg['bot_token_masked'] = mask_secret(raw_token)
            # Never expose the raw token through the read API.
            cfg.pop('bot_token', None)
        return cfg

    @classmethod
    def update_config(cls, new_cfg: Dict[str, Any]) -> Dict[str, Any]:
        cls._load_config()
        # Preserve existing bot token if client passed masked version
        if 'bot_token' in new_cfg:
            new_tok = str(new_cfg['bot_token']).strip()
            if '••' in new_tok:
                # Do not overwrite with mask
                del new_cfg['bot_token']
        cls._config.update(new_cfg)
        try:
            db_set_system_metadata(
                _ALERT_CONFIG_METADATA_KEY,
                json.dumps(cls._config, ensure_ascii=False),
            )
        except Exception as exc:
            logger.error("Failed to persist alert configuration: %s", exc)
        global _COOLDOWN_SECONDS
        _COOLDOWN_SECONDS = int(cls._config.get('cooldown_minutes', 10)) * 60
        return cls.get_config()

    @classmethod
    def can_dispatch(cls, alert_category: str) -> bool:
        """Checks if alert category has passed its cooldown period."""
        now = time.time()
        last = _LAST_ALERT_TIMES.get(alert_category, 0.0)
        return (now - last) >= _COOLDOWN_SECONDS

    @classmethod
    def record_dispatched(cls, alert_category: str) -> None:
        _LAST_ALERT_TIMES[alert_category] = time.time()

    @classmethod
    def send_telegram_alert(cls, message: str, alert_category: str = 'general', force: bool = False) -> Dict[str, Any]:
        """Sends an urgent notification to configured Telegram Chat ID with cooldown enforcement."""
        cls._load_config()
        if not cls._config.get('telegram_enabled') and not force:
            return {'ok': False, 'skipped': True, 'reason': 'Telegram alerting is disabled.'}

        bot_token = cls._config.get('bot_token', '').strip()
        chat_id = cls._config.get('chat_id', '').strip()

        if not bot_token or not chat_id:
            return {'ok': False, 'skipped': True, 'reason': 'Bot Token or Chat ID is missing.'}

        if not force and not cls.can_dispatch(alert_category):
            remaining = int(_COOLDOWN_SECONDS - (time.time() - _LAST_ALERT_TIMES.get(alert_category, 0.0)))
            return {'ok': False, 'skipped': True, 'reason': f'Cooldown active for category "{alert_category}". Remaining: {remaining}s'}

        def _async_send():
            try:
                url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
                headers = {'User-Agent': 'ASAAS/2.5'}
                payload = {
                    'chat_id': chat_id,
                    'text': f"🚨 [ASAAS v2.5 Alert]\n\n{message}\n\n🕒 {time.strftime('%Y-%m-%d %H:%M:%S')}",
                    'parse_mode': 'HTML',
                }
                data = json.dumps(payload).encode('utf-8')
                req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json', **headers})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    resp_data = json.loads(resp.read().decode('utf-8'))
                    if resp_data.get('ok'):
                        cls.record_dispatched(alert_category)
                        db_add_security_event('TELEGRAM_ALERT_SENT', '127.0.0.1', f'تم إرسال إشعار تيليجرام ({alert_category}) بنجاح', 'INFO')
                    else:
                        logger.error("Telegram API returned non-OK: %s", resp_data)
            except Exception as exc:
                logger.error("Failed to send telegram alert: %s", exc)

        threading.Thread(target=_async_send, daemon=True).start()
        return {'ok': True, 'dispatched': True, 'category': alert_category}

    @classmethod
    def evaluate_telemetry_thresholds(cls, cpu: float, ram: float, disk: float) -> None:
        """Evaluates live metrics against alert thresholds and triggers notifications."""
        cls._load_config()
        cpu_thresh = float(cls._config.get('cpu_threshold', 85))
        ram_thresh = float(cls._config.get('ram_threshold', 90))
        disk_thresh = float(cls._config.get('disk_threshold', 90))

        if cpu >= cpu_thresh and cls.can_dispatch('cpu_spike'):
            msg = f"⚠️ <b>تحذير استهلاك المعالج:</b>\nوصل استهلاك المعالج إلى <b>{cpu}%</b> متجاوزاً العتبة المحددة ({cpu_thresh}%)."
            cls.send_telegram_alert(msg, 'cpu_spike')

        if ram >= ram_thresh and cls.can_dispatch('ram_spike'):
            msg = f"⚠️ <b>تحذير استهلاك الذاكرة:</b>\nوصل استهلاك الرام إلى <b>{ram}%</b> متجاوزاً العتبة المحددة ({ram_thresh}%)."
            cls.send_telegram_alert(msg, 'ram_spike')

        if disk >= disk_thresh and cls.can_dispatch('disk_spike'):
            msg = f"⚠️ <b>تحذير امتلاء القرص:</b>\nوصل استهلاك القرص C إلى <b>{disk}%</b> متجاوزاً العتبة المحددة ({disk_thresh}%)."
            cls.send_telegram_alert(msg, 'disk_spike')
