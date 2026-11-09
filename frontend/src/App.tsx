import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { OverviewPage } from './pages/OverviewPage';
import { ControlPage } from './pages/ControlPage';
import { AssetsPage } from './pages/AssetsPage';
import { VaultPage } from './pages/VaultPage';
import { PortsPage } from './pages/PortsPage';
import { SecurityPage } from './pages/SecurityPage';
import { StoragePage } from './pages/StoragePage';
import { UsersPage } from './pages/UsersPage';
import { AuditPage } from './pages/AuditPage';
import { SettingsPage } from './pages/SettingsPage';
import { JitElevationPage } from './pages/JitElevationPage';
import { SessionReplayPage } from './pages/SessionReplayPage';
import { StitchGalleryPage } from './pages/StitchGalleryPage';
import { ZeroTrustLoginPage } from './pages/ZeroTrustLoginPage';
import { PerimeterLockoutPage } from './pages/PerimeterLockoutPage';

export default function App() {
  return (
    <Routes>
      {/* Standalone Sovereign Enclave Portals */}
      <Route path="login" element={<ZeroTrustLoginPage />} />
      <Route path="lockout" element={<PerimeterLockoutPage />} />

      {/* Main Authenticated Dashboard Layout */}
      <Route element={<Layout />}>
        <Route index element={<OverviewPage />} />
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
        <Route path="gallery" element={<StitchGalleryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
