import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { t } from '../lib/i18n';

export function RequireAuth() {
  const location = useLocation();
  const [state, setState] = useState<'checking' | 'allowed' | 'denied'>('checking');

  useEffect(() => {
    let active = true;
    api.getCurrentUser()
      .then(() => active && setState('allowed'))
      .catch(() => active && setState('denied'));
    return () => { active = false; };
  }, []);

  if (state === 'checking') {
    return (
      <div className="auth-check" dir="rtl" role="status" aria-live="polite">
        {t('جارٍ التحقق من جلسة الإدارة…')}
      </div>
    );
  }

  if (state === 'denied') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
