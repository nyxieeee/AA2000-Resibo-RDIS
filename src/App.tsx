import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { AuthLayout } from './components/layout/AuthLayout';
import { Dashboard } from './features/dashboard/Dashboard';
import { ScanHub } from './features/scanhub/ScanHub';
import { DocumentLibrary } from './features/documents/DocumentLibrary';
import { DocumentDetail } from './features/documents/DocumentDetail';
import { SessionRequired } from './features/auth/SessionRequired';
import { Analytics } from './features/analytics/Analytics';
import { Exports } from './features/exports/Exports';
import { BirFiling } from './features/bir-filing/BirFiling';
import { Settings } from './features/settings/Settings';
import { Chat } from './features/chat/Chat';
import { Profile } from './features/profile/Profile';
import { useEffect } from 'react';
import { useAuthStore } from './store/useAuthStore';
import { useLocation } from 'react-router-dom';

function AuthBootstrap() {
  const initAuthFromLaunch = useAuthStore((state) => state.initAuthFromLaunch);

  useEffect(() => {
    void initAuthFromLaunch();
  }, [initAuthFromLaunch]);

  return null;
}

function RootRedirect() {
  const location = useLocation();
  return <Navigate to={`/dashboard${location.search}${location.hash}`} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthBootstrap />
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        
        <Route element={<AuthLayout />}>
          <Route path="session-required" element={<SessionRequired />} />
        </Route>
        
        <Route element={<MainLayout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="scanhub" element={<ScanHub />} />
          <Route path="documents" element={<DocumentLibrary />} />
          <Route path="documents/:id" element={<DocumentDetail />} />
          <Route path="profile" element={<Profile />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="exports" element={<Exports />} />
          <Route path="filing" element={<BirFiling />} />
          <Route path="chat" element={<Chat />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
