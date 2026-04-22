import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { useEffect } from 'react';

export function AuthLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Always show login in light mode regardless of user's dark preference
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    return () => {
      // Restore user's saved theme when leaving login
      if (localStorage.getItem('rdis-theme') === 'dark') {
        document.documentElement.classList.add('dark');
      }
    };
  }, []);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#f8fafc' }}>
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
        <img src="/logo.png" alt="AA2000 Logo" className="h-20 w-20 object-contain" />
        <h2 className="mt-4 text-center text-3xl font-bold text-slate-900 tracking-tight">
          AA2000 RDIS
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500 max-w">
          Receipt Documentation & Information System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="py-6 px-5 shadow-sm rounded-2xl sm:rounded-xl sm:px-10 border border-slate-200" style={{ backgroundColor: '#ffffff' }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
