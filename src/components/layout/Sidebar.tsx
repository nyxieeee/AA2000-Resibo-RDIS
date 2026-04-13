import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, UploadCloud, Files, BarChart3,
  Download, FileText, Settings, BrainCircuit,
  User as UserIcon, LogOut, ChevronLeft, ChevronRight
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/useAuthStore';

const execRoles = ['CEO', 'President', 'General Manager'];
const allRoles  = [...execRoles, 'Accountant'];

const navItems = [
  { name: 'Dashboard',    path: '/dashboard', icon: LayoutDashboard, roles: allRoles },
  { name: 'ScanHub',      path: '/scanhub',   icon: UploadCloud,     roles: allRoles },
  { name: 'Documents',    path: '/documents', icon: Files,           roles: allRoles },
  { name: 'Analytics',    path: '/analytics', icon: BarChart3,       roles: allRoles },
  { name: 'Exports',      path: '/exports',   icon: Download,        roles: allRoles },
  { name: 'BIR Filing',   path: '/filing',    icon: FileText,        roles: allRoles },
  { name: 'Chat with AI', path: '/chat',      icon: BrainCircuit,    roles: allRoles },
  { name: 'Settings',     path: '/settings',  icon: Settings,        roles: allRoles },
];

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const user   = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);

  if (!user) return null;

  return (
    <aside
      className={cn(
        'flex-shrink-0 flex flex-col h-full hidden md:flex transition-all duration-300',
        isCollapsed ? 'w-20' : 'w-64'
      )}
      style={{ backgroundColor: 'var(--bg-sidebar)', boxShadow: '1px 0 0 var(--border-subtle)' }}
    >
      {/* Brand */}
      <div className="h-16 flex items-center px-4 shrink-0" style={{ boxShadow: '0 1px 0 var(--border-subtle)' }}>
        <div className="flex items-center gap-2 overflow-hidden">
          <img src="/logo.png" alt="AA2000 Logo" className="h-9 w-9 shrink-0 object-contain" />
          {!isCollapsed && (
            <span className="font-bold text-lg tracking-tight text-blue-600 dark:text-blue-400 shrink-0">
              AA2000 RDIS
            </span>
          )}
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
        {!isCollapsed && (
          <div className="text-xs font-semibold text-[--text-muted] uppercase tracking-wider mb-2 px-3">
            Menu
          </div>
        )}
        {navItems.filter(item => item.roles.includes(user.role)).map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.name}
              to={item.path}
              title={isCollapsed ? item.name : undefined}
              className={cn(
                'flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative',
                isCollapsed ? 'justify-center px-0' : 'px-3',
                isActive
                  ? 'bg-blue-50 dark:bg-[#1e2d45] text-blue-700 dark:text-blue-400 shadow-sm'
                  : 'text-[--text-secondary] hover:bg-[--bg-raised] hover:text-[--text-primary]'
              )}
            >
              <item.icon className={cn(
                'h-5 w-5 shrink-0',
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-[--text-muted] group-hover:text-[--text-secondary]'
              )} />
              {!isCollapsed && (
                <>
                  <span className="truncate">{item.name}</span>
                  {item.name === 'Chat with AI' && (
                    <span className="ml-auto text-[10px] font-bold uppercase tracking-widest bg-blue-100 dark:bg-[#0f2040] text-blue-700 dark:text-blue-400 py-0.5 px-1.5 rounded shrink-0">
                      Beta
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </div>

      {/* Bottom */}
      <div className="p-3 flex flex-col gap-1 shrink-0">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expand' : undefined}
          className={cn(
            'flex items-center gap-3 w-full py-2.5 rounded-lg text-sm font-medium transition-colors',
            'text-[--text-muted] hover:bg-[--bg-raised] hover:text-[--text-secondary]',
            isCollapsed ? 'justify-center px-0' : 'px-3'
          )}
        >
          {isCollapsed ? <ChevronRight className="h-5 w-5 shrink-0" /> : <ChevronLeft className="h-5 w-5 shrink-0" />}
          {!isCollapsed && <span>Collapse</span>}
        </button>

        <button
          onClick={logout}
          title={isCollapsed ? 'Sign out' : undefined}
          className={cn(
            'flex items-center gap-3 w-full py-2.5 rounded-lg text-sm font-medium transition-colors mb-2',
            'text-[--text-muted] hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 dark:hover:text-red-400',
            isCollapsed ? 'justify-center px-0' : 'px-3'
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!isCollapsed && <span>Sign Out</span>}
        </button>

        {/* Faint divider above user card only */}
        <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '2px 0 6px' }} />

        <div className={cn(
          'flex items-center gap-3 p-2 rounded-lg',
          isCollapsed ? 'justify-center flex-col' : ''
        )}>
          <div className="h-8 w-8 shrink-0 rounded-full bg-blue-100 dark:bg-[#0f2040] flex items-center justify-center text-blue-600 dark:text-blue-400">
            <UserIcon className="h-4 w-4" />
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[--text-primary] truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-[--text-muted] truncate">{user.email}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
