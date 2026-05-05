import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { getTokenFromCurrentUrl, getAccountIdFromCurrentUrl } from '../../lib/launchAuth';

export function SessionRequired() {
  const navigate = useNavigate();
  const initAuthFromLaunch = useAuthStore((state) => state.initAuthFromLaunch);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isAuthBootstrapping = useAuthStore((state) => state.isAuthBootstrapping);
  const authError = useAuthStore((state) => state.authError);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const hasUrlToken = Boolean(getTokenFromCurrentUrl());
  const hasUrlActor = Boolean(getAccountIdFromCurrentUrl());
  const hasStoredToken = Boolean(
    sessionStorage.getItem('aa2000-launch-session-token') ||
    localStorage.getItem('aa2000-auth-token')
  );

  return (
    <div className="text-center">
      <div className="flex justify-center mb-4">
        <div className="h-12 w-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
          <ShieldAlert className="h-6 w-6" />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-slate-900">Session Required</h2>
      <p className="mt-2 text-sm text-slate-600">
        Open this app using a valid launch URL that includes a session token.
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Supported params: <code>__launch</code>, <code>_launch</code>, <code>s_name</code>
      </p>
      <div className="mt-2 text-[11px] text-slate-500">
        URL token: <strong>{hasUrlToken ? 'detected' : 'missing'}</strong> | actor: <strong>{hasUrlActor ? 'detected' : 'missing'}</strong> | stored token: <strong>{hasStoredToken ? 'present' : 'missing'}</strong>
        <br />
        <span className="opacity-70">Origin: <code>{window.location.origin}</code> | Path: <code>{window.location.pathname}</code></span>
      </div>
      {authError && (
        <p className="mt-2 text-xs text-red-600">{authError}</p>
      )}
      <div className="mt-6">
        <button
          type="button"
          onClick={() => void initAuthFromLaunch()}
          disabled={isAuthBootstrapping}
          className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-slate-800 hover:bg-slate-900 transition-colors"
        >
          {isAuthBootstrapping ? 'Checking Session...' : 'Refresh Session State'}
        </button>
      </div>
    </div>
  );
}
