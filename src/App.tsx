import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { AuthLayout } from './components/layout/AuthLayout';
import { Dashboard } from './features/dashboard/Dashboard';
import { ScanHub } from './features/scanhub/ScanHub';
import { DocumentLibrary } from './features/documents/DocumentLibrary';
import { DocumentDetail } from './features/documents/DocumentDetail';
import { Login } from './features/auth/Login';
import { Analytics } from './features/analytics/Analytics';
import { Exports } from './features/exports/Exports';
import { BirFiling } from './features/bir-filing/BirFiling';
import { Settings } from './features/settings/Settings';
import { Chat } from './features/chat/Chat';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        <Route element={<AuthLayout />}>
          <Route path="login" element={<Login />} />
        </Route>
        
        <Route element={<MainLayout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="scanhub" element={<ScanHub />} />
          <Route path="documents" element={<DocumentLibrary />} />
          <Route path="documents/:id" element={<DocumentDetail />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="exports" element={<Exports />} />
          <Route path="filing" element={<BirFiling />} />
          <Route path="chat" element={<Chat />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
