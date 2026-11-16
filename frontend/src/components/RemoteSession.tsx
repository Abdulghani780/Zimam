import { useEffect, useRef, useState } from 'react';
import Guacamole from 'guacamole-common-js';
import { Button } from '../asaas-ui';
import { t } from '../lib/i18n';

interface RemoteSessionProps {
  protocol: string;
  token: string;
  onClose: () => void;
}

type Phase = 'connecting' | 'connected' | 'closed' | 'error';

/**
 * Live remote session viewer: guacamole-common-js Client over our
 * /api/v1/gateway/{protocol} WebSocket tunnel. The server already performed
 * the guacd handshake â€” this side only renders the display and forwards
 * input events.
 */
export function RemoteSession({ protocol, token, onClose }: RemoteSessionProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<Phase>('connecting');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${scheme}://${window.location.host}/api/v1/gateway/${protocol}`;
    const client = new Guacamole.Client(new Guacamole.WebSocketTunnel(url));
    const display = client.getDisplay();
    const displayEl = display.getElement() as HTMLElement;
    displayEl.style.width = '100%';
    displayEl.style.height = '100%';
    displayEl.style.objectFit = 'contain';
    displayEl.tabIndex = 0;
    host.appendChild(displayEl);

    const mouse = new Guacamole.Mouse(displayEl);
    mouse.onEach(['mousedown', 'mousemove', 'mouseup'], (event) => {
      client.sendMouseState((event as Guacamole.Mouse.Event).state, true);
    });

    const keyboard = new Guacamole.Keyboard(displayEl);
    keyboard.onkeydown = (keysym) => { client.sendKeyEvent(1, keysym); };
    keyboard.onkeyup = (keysym) => { client.sendKeyEvent(0, keysym); };

    client.onstatechange = (state) => {
      if (state === Guacamole.Client.State.CONNECTED) setPhase('connected');
      if (state === Guacamole.Client.State.DISCONNECTED || state === Guacamole.Client.State.IDLE) setPhase('closed');
    };
    client.onerror = (status) => {
      setPhase('error');
      setMessage(status.message || t('Ø§Ù†Ù‚Ø·Ø¹ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø¬Ù„Ø³Ø© Ø¹Ù† Ø¨ÙØ¹Ø¯.'));
    };

    try {
      client.connect(`token=${encodeURIComponent(token)}`);
    } catch {
      setPhase('error');
      setMessage(t('ØªØ¹Ø°Ù‘Ø± ÙØªØ­ Ù†ÙÙ‚ Ø§Ù„Ø¬Ù„Ø³Ø©.'));
    }

    return () => {
      try { client.disconnect(); } catch { /* already closed */ }
      host.innerHTML = '';
    };
  }, [protocol, token]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
          {phase === 'connecting' && t('Ø¬Ø§Ø±Ù Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø¬Ù„Ø³Ø©...')}
          {phase === 'connected' && t('Ø¬Ù„Ø³Ø© Ù†Ø´Ø·Ø© â€” Ø§Ù†Ù‚Ø± Ø¯Ø§Ø®Ù„ Ø§Ù„Ø´Ø§Ø´Ø© Ù„Ù„ØªØ­ÙƒÙ…')}
          {phase === 'closed' && t('Ø§Ù†ØªÙ‡Øª Ø§Ù„Ø¬Ù„Ø³Ø©')}
          {phase === 'error' && message}
        </span>
        <Button size="sm" variant="ghost" onClick={onClose}>{t('Ø¥ØºÙ„Ø§Ù‚')}</Button>
      </div>
      <div
        ref={hostRef}
        style={{
          flex: 1,
          minHeight: 320,
          borderRadius: 12,
          overflow: 'hidden',
          background: '#000',
          border: '1px solid var(--glass-rim)',
          position: 'relative',
        }}
      />
    </div>
  );
}
