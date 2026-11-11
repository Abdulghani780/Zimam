import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { OverviewPage } from './pages/OverviewPage';
import { ControlPage } from './pages/ControlPage';
import { AssetsPage } from './pages/AssetsPage';
import { ServersPage } from './pages/ServersPage';
import { InfrastructurePage } from './pages/InfrastructurePage';
import { DevelopmentPage } from './pages/DevelopmentPage';
import { ContainersPage } from './pages/ContainersPage';
import { NetworkStoragePage } from './pages/NetworkStoragePage';
import { VaultPage } from './pages/VaultPage';
import { PortsPage } from './pages/PortsPage';
import { SecurityPage } from './pages/SecurityPage';
import { StoragePage } from './pages/StoragePage';
import { UsersPage } from './pages/UsersPage';
import { AuditPage } from './pages/AuditPage';
import { SettingsPage } from './pages/SettingsPage';
import { JitElevationPage } from './pages/JitElevationPage';
import { SessionReplayPage } from './pages/SessionReplayPage';
import { DatabasesPage } from './pages/DatabasesPage';
import { BastionPage } from './pages/BastionPage';
import { StitchGalleryPage } from './pages/StitchGalleryPage';
import { ZeroTrustLoginPage } from './pages/ZeroTrustLoginPage';
import { PerimeterLockoutPage } from './pages/PerimeterLockoutPage';
import { RequireAuth } from './components/RequireAuth';

export default function App() {
  return (
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
          <Route path="stitch" element={<StitchGalleryPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
