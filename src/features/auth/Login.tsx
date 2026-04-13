import { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';

const DEMO_ACCOUNTS = [
  { email: 'ceo@aa2000.com.ph', pass: 'admin', label: 'CEO' },
  { email: 'president@aa2000.com.ph', pass: 'admin', label: 'President' },
  { email: 'gm@aa2000.com.ph', pass: 'admin', label: 'General Manager' },
  { email: 'accountant1@aa2000.com.ph', pass: 'accounting', label: 'Accountant 1' },
  { email: 'accountant2@aa2000.com.ph', pass: 'accounting', label: 'Accountant 2' },
];

export function Login() {
  const login = useAuthStore((state) => state.login);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = login(email, password);
    if (!success) {
      setError('Invalid email or password.');
    } else {
      addNotification({ title: 'Logged In', message: 'Welcome back to your workspace.', type: 'success' });
    }
  };

  const fillDemo = (acc: typeof DEMO_ACCOUNTS[0]) => {
    setEmail(acc.email);
    setPassword(acc.pass);
    setError('');
  };

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Sign in to your account</h2>
        <p className="mt-2 text-sm text-slate-500">Welcome back to AA2000 RDIS.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Email address
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-slate-400" />
            </div>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-md py-2 border"
              placeholder="you@aa2000.com.ph"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-slate-400" />
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-md py-2 border"
              placeholder="••••••••"
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            Sign in securely
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>

      {/* Demo account quick-fill */}
      <div className="mt-6 border-t border-slate-200 pt-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Demo Accounts — click to fill</p>
        <div className="grid grid-cols-1 gap-2">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              type="button"
              onClick={() => fillDemo(acc)}
              className="flex justify-between items-center w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-blue-300 transition-colors"
            >
              <span className="text-sm font-medium text-slate-700">{acc.label}</span>
              <span className="text-xs text-slate-400 font-mono">{acc.email}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
