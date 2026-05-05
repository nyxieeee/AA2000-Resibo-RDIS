import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { useAuthStore } from '../../store/useAuthStore';
import { useDocumentStore } from '../../store/useDocumentStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useEffect } from 'react';

export function MainLayout() {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isAuthBootstrapping = useAuthStore((state) => state.isAuthBootstrapping);
  const fetchDocuments = useDocumentStore((state) => state.fetchDocuments);
  const fetchWorkspace = useWorkspaceStore((state) => state.fetchWorkspace);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDocuments();
      fetchWorkspace();
    }
  }, [isAuthenticated, fetchDocuments, fetchWorkspace]);

  if (isAuthBootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[--bg-page] text-[--text-secondary]">
        Verifying session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={`/session-required${location.search}${location.hash}`} replace />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[--bg-page] text-[--text-primary]">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Header />
        <main className="flex-1 overflow-auto p-4 md:p-8 bg-[--bg-page] pb-24 md:pb-8 relative">
          <div key={location.pathname} className="animate-page-in min-h-full">
            <Outlet />
          </div>
        </main>
        <MobileNav />
      </div>
    </div>
  );
}
