import { NavLink } from 'react-router-dom';
import { t } from '../lib/i18n';
import { Brand } from './Brand';
import { NAV_GROUPS } from './navigation';

export function Sidebar() {
  return (
    <aside className="app-sidebar" aria-label={t('شريط التنقل الجانبي')}>
      <NavLink to="/" className="sidebar-brand" aria-label={t('زمام - لوحة القيادة')}>
        <Brand size={40} />
      </NavLink>

      <nav className="sidebar-nav">
        {NAV_GROUPS.map((group) => (
          <section className="sidebar-nav__group" key={group.label} aria-labelledby={`nav-${group.label}`}>
            <h2 className="sidebar-nav__label" id={`nav-${group.label}`}>{t(group.label)}</h2>
            <div className="sidebar-nav__items">
              {group.items.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                  <span className="icon-wrap"><Icon size={18} /></span>
                  <span>{t(label)}</span>
                </NavLink>
              ))}
            </div>
          </section>
        ))}
      </nav>
    </aside>
  );
}
