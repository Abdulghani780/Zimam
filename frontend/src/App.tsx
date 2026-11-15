import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';

const lazyPage = <T extends Record<string, React.ComponentType>>(loader: () => Promise<T>, name: keyof T) =>
  lazy(() => loader().then((m) => ({ default: m[name] as React.ComponentType })));

const OverviewPage = lazyPage(() => import('./pages/OverviewPage'), 'OverviewPage');
const ControlPage = lazyPage(() => import('./pages/ControlPage'), 'ControlPage');
const GovernorPage = lazyPage(() => import('./pages/GovernorPage'), 'GovernorPage');
const AssetsPage = lazyPage(() => import('./pages/AssetsPage'), 'AssetsPage');
const ServersPage = lazyPage(() => import('./pages/ServersPage'), 'ServersPage');
const InfrastructurePage = lazyPage(() => import('./pages/InfrastructurePage'), 'InfrastructurePage');
const DevelopmentPage = lazyPage(() => import('./pages/DevelopmentPage'), 'DevelopmentPage');
const ContainersPage = lazyPage(() => import('./pages/ContainersPage'), 'ContainersPage');
const NetworkStoragePage = lazyPage(() => import('./pages/NetworkStoragePage'), 'NetworkStoragePage');
const VaultPage = lazyPage(() => import('./pages/VaultPage'), 'VaultPage');
const PortsPage = lazyPage(() => import('./pages/PortsPage'), 'PortsPage');
const SecurityPage = lazyPage(() => import('./pages/SecurityPage'), 'SecurityPage');
const StoragePage = lazyPage(() => import('./pages/StoragePage'), 'StoragePage');
const UsersPage = lazyPage(() => import('./pages/UsersPage'), 'UsersPage');
const AuditPage = lazyPage(() => import('./pages/AuditPage'), 'AuditPage');
const SettingsPage = lazyPage(() => import('./pages/SettingsPage'), 'SettingsPage');
const JitElevationPage = lazyPage(() => import('./pages/JitElevationPage'), 'JitElevationPage');
const SessionReplayPage = lazyPage(() => import('./pages/SessionReplayPage'), 'SessionReplayPage');
const DatabasesPage = lazyPage(() => import('./pages/DatabasesPage'), 'DatabasesPage');
const BastionPage = lazyPage(() => import('./pages/BastionPage'), 'BastionPage');
const ZeroTrustLoginPage = lazyPage(() => import('./pages/ZeroTrustLoginPage'), 'ZeroTrustLoginPage');
const PerimeterLockoutPage = lazyPage(() => import('./pages/PerimeterLockoutPage'), 'PerimeterLockoutPage');

const PageFallback = () => (
  <div style={{ display: 'grid', placeItems: 'center', minHeight: '40vh', color: 'var(--text-3)' }}>
    جارٍ تحميل الصفحة…
  </div>
);

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
    <Routes>
      {/* Standalone ASAAS access screens */}
      <Route path="login" element={<ZeroTrustLoginPage />} />
      <Route path="lockout" element={<PerimeterLockoutPage />} />

      {/* Main Authenticated Dashboard Layout */}
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<OverviewPage />} />
          <Route path="servers" element={<ServersPage />} />
          <Route path="infrastructure" element={<InfrastructurePage />} />
          <Route path="development" element={<DevelopmentPage />} />
          <Route path="containers" element={<ContainersPage />} />
          <Route path="network-storage" element={<NetworkStoragePage />} />
          <Route path="databases" element={<DatabasesPage />} />
          <Route path="control" element={<ControlPage />} />
          <Route path="governor" element={<GovernorPage />} />
          <Route path="assets" element={<AssetsPage />} />
          <Route path="vault" element={<VaultPage />} />
          <Route path="ports" element={<PortsPage />} />
          <Route path="security" element={<SecurityPage />} />
          <Route path="storage" element={<StoragePage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="jit" element={<JitElevationPage />} />
          <Route path="replay" element={<SessionReplayPage />} />
          <Route path="bastion" element={<BastionPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
    </Suspense>
  );
}
