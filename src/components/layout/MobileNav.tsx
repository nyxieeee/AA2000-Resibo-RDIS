import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, UploadCloud, Files, BarChart3,
  BrainCircuit, Settings, FileText
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/useAuthStore';

const execRoles = ['CEO', 'President', 'General Manager'];
const allRoles = [...execRoles, 'Accountant'];

const normalizeRole = (role?: string) => (role || '').trim().toLowerCase();
const hasAccess = (allowedRoles: string[], userRole?: string) => {
  const normalizedUserRole = normalizeRole(userRole);
  if (!normalizedUserRole) return false;
  if (normalizedUserRole === 'admin') return true;
  return allowedRoles.some((role) => normalizeRole(role) === normalizedUserRole);
};

const mobileNavItems = [
  { name: 'Home', path: '/dashboard', icon: LayoutDashboard, roles: allRoles },
  { name: 'Scan', path: '/scanhub', icon: UploadCloud, roles: allRoles },
  { name: 'Docs', path: '/documents', icon: Files, roles: allRoles },
  { name: 'BIR', path: '/filing', icon: FileText, roles: ['Accountant'] as string[] },
  { name: 'Stats', path: '/analytics', icon: BarChart3, roles: allRoles },
  { name: 'Chat', path: '/chat', icon: BrainCircuit, roles: allRoles },
  { name: 'Settings', path: '/settings', icon: Settings, roles: allRoles },
];

export function MobileNav() {
  const location = useLocation();
  const user = useAuthStore(state => state.user);

  if (!user) return null;

  const visibleItems = mobileNavItems.filter(item => hasAccess(item.roles, user.role));

  const handleSettingsTap = (e: React.MouseEvent) => {
    if (location.pathname.startsWith('/settings')) {
      // Already on settings — open the drawer
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('open-mobile-drawer'));
    }
    // Otherwise let the Link navigate normally to /settings
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch"
      style={{
        backgroundColor: 'var(--bg-sidebar)',
        boxShadow: '0 -1px 0 var(--border-subtle)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {visibleItems.map((item) => {
        const isActive = location.pathname.startsWith(item.path);
        return (
          <Link
            key={item.name}
            to={item.path}
            onClick={item.name === 'Settings' ? handleSettingsTap : undefined}
            className={cn(
              'flex flex-col items-center justify-center flex-1 gap-1 py-2 text-[10px] font-medium transition-all duration-300 transform active:scale-95',
              isActive
                ? 'text-blue-600 dark:text-blue-400 scale-110'
                : 'text-[--text-muted]'
            )}
          >
            <item.icon className={cn('h-5 w-5 transition-transform duration-300', isActive ? 'text-blue-600 dark:text-blue-400 scale-110' : 'text-[--text-muted]')} />
            <span className={cn('transition-all duration-300', isActive ? 'font-bold' : '')}>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
