import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, Search, CheckCircle2, Info, Sun, Moon, X, LogOut, Menu,
  LayoutDashboard, Files, FileText, Settings, User as UserIcon } from 'lucide-react';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useAuthStore } from '../../store/useAuthStore';
import { cn } from '../../lib/utils';

export function Header() {
  const { getNotifications, markAllAsRead, clearAll } = useNotificationStore();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const userId = user?.id ?? 'guest';
  const notifications = getNotifications(userId);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [settingsTab, setSettingsTab] = useState('Profile');
  const [isDark, setIsDark] = useState(() =>
    localStorage.getItem('rdis-theme') === 'dark'
  );
  const location = useLocation();

  const ACCOUNTANT_TABS = ['Profile', 'BIR Configurations', 'Categories', 'Notifications'];
  const EXEC_TABS = ['General', 'Organization', 'Access & Roles', 'Data & Privacy'];
  const execRoles2 = ['CEO', 'President', 'General Manager'];
  const settingsTabs = user && execRoles2.includes(user.role) ? EXEC_TABS : ACCOUNTANT_TABS;
  const drawerRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('rdis-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('rdis-theme', 'light');
    }
  }, [isDark]);

  // Close mobile menu on route change
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (showMobileMenu) setShowMobileMenu(false);
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showMobileMenu) return;
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setShowMobileMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMobileMenu]);

  // Open the drawer when Settings bottom bar button is tapped while already on /settings
  useEffect(() => {
    const handler = () => setShowMobileMenu(true);
    window.addEventListener('open-mobile-drawer', handler);
    return () => window.removeEventListener('open-mobile-drawer', handler);
  }, []);

  return (
    <>
      <header
        className="h-14 md:h-16 flex items-center justify-between px-4 md:px-6 shrink-0 z-10 w-full relative transition-colors duration-200"
        style={{ backgroundColor: 'var(--bg-header)', boxShadow: '0 1px 0 var(--border-subtle)' }}
      >
        <div className="flex items-center gap-3">
          {location.pathname.startsWith('/settings') && (
            <button
              onClick={() => setShowMobileMenu(true)}
              className="md:hidden p-2 rounded-lg text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-raised] transition-colors"
              aria-label="Open settings menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <div className="md:hidden flex items-center gap-2">
            <img src="/logo.png" alt="AA2000" className="h-7 w-7 object-contain" />
            <span className="font-bold text-base text-blue-600 dark:text-blue-400">AA2000 RDIS</span>
          </div>
          <h1 className="text-lg font-semibold text-[--text-primary] hidden md:block">Workspace</h1>
        </div>

        <div className="flex items-center gap-1 md:gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--text-muted]" />
            <input
              type="text"
              placeholder="Search documents, vendors..."
              className="pl-9 pr-4 py-2 rounded-lg text-sm w-64 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                backgroundColor: 'var(--bg-raised)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <button
            onClick={() => setIsDark(!isDark)}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 rounded-full transition-colors hover:bg-[--bg-raised]"
            style={{ color: 'var(--text-muted)' }}
          >
            {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5" />}
          </button>

          <div className="relative">
            <button
              onClick={() => {
                setShowDropdown(!showDropdown);
                if (!showDropdown && unreadCount > 0) markAllAsRead(userId);
              }}
              className={cn(
                'relative p-2 rounded-full transition-colors',
                showDropdown ? 'bg-blue-50 dark:bg-[#0f1f38] text-blue-600 dark:text-blue-400' : 'hover:bg-[--bg-raised]'
              )}
              style={{ color: 'var(--text-muted)' }}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[--bg-header]" />
              )}
            </button>

            {showDropdown && (
              <div
                className="absolute right-0 mt-2 w-80 rounded-xl shadow-lg overflow-hidden z-50"
                style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
              >
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ backgroundColor: 'var(--bg-raised)', boxShadow: '0 1px 0 var(--border-subtle)' }}
                >
                  <h3 className="font-semibold text-[--text-primary]">Notifications</h3>
                  <button
                    onClick={() => clearAll(userId)}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    Clear All
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-sm text-[--text-muted]">No new notifications</div>
                  ) : (
                    <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' } as React.CSSProperties}>
                      {notifications.map((notif, idx) => (
                        <div
                          key={notif.id}
                          className={cn('p-4 transition-colors hover:bg-[--bg-raised]', !notif.isRead ? 'bg-blue-50/30 dark:bg-[#0f1f38]/40' : '')}
                          style={idx > 0 ? { boxShadow: '0 -1px 0 var(--border-subtle)' } : {}}
                        >
                          <div className="flex gap-3">
                            <div className={cn(
                              'mt-0.5 shrink-0 h-8 w-8 rounded-full flex items-center justify-center',
                              notif.type === 'success'
                                ? 'bg-green-100 dark:bg-[#052e16] text-green-600 dark:text-[#00d4aa]'
                                : 'bg-blue-100 dark:bg-[#0f2040] text-blue-600 dark:text-blue-400'
                            )}>
                              {notif.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-[--text-primary]">{notif.title}</h4>
                              <p className="text-sm text-[--text-secondary] mt-0.5 line-clamp-2">{notif.message}</p>
                              <span className="text-[10px] font-medium text-[--text-muted] mt-1 block">{notif.time}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Settings Drawer — only on /settings */}
      {showMobileMenu && location.pathname.startsWith('/settings') && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowMobileMenu(false)} />
          <div
            ref={drawerRef}
            className="relative w-72 h-full flex flex-col shadow-2xl"
            style={{ backgroundColor: 'var(--bg-sidebar)' }}
          >
            <div className="h-14 flex items-center justify-between px-4" style={{ boxShadow: '0 1px 0 var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="AA2000" className="h-8 w-8 object-contain" />
                <span className="font-bold text-base text-blue-600 dark:text-blue-400">AA2000 RDIS</span>
              </div>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-1.5 rounded-lg text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-raised]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
              <p className="text-xs font-semibold text-[--text-muted] uppercase tracking-wider mb-2 px-3">Settings</p>
              {settingsTabs.map((tab) => {
                const isActive = settingsTab === tab;
                const tabIcons: Record<string, React.ReactNode> = {
                  'Profile': <UserIcon className="h-5 w-5 shrink-0" />,
                  'BIR Configurations': <FileText className="h-5 w-5 shrink-0" />,
                  'Categories': <Files className="h-5 w-5 shrink-0" />,
                  'Notifications': <Bell className="h-5 w-5 shrink-0" />,
                  'General': <Settings className="h-5 w-5 shrink-0" />,
                  'Organization': <LayoutDashboard className="h-5 w-5 shrink-0" />,
                  'Access & Roles': <UserIcon className="h-5 w-5 shrink-0" />,
                  'Data & Privacy': <Files className="h-5 w-5 shrink-0" />,
                };
                return (
                  <button
                    key={tab}
                    onClick={() => {
                      setSettingsTab(tab);
                      window.dispatchEvent(new CustomEvent('settings-tab-change', { detail: tab }));
                      setShowMobileMenu(false);
                    }}
                    className={cn(
                      'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left',
                      isActive
                        ? 'bg-blue-50 dark:bg-[#1e2d45] text-blue-700 dark:text-blue-400'
                        : 'text-[--text-secondary] hover:bg-[--bg-raised] hover:text-[--text-primary]'
                    )}
                  >
                    <span className={cn('shrink-0', isActive ? 'text-blue-600 dark:text-blue-400' : 'text-[--text-muted]')}>
                      {tabIcons[tab]}
                    </span>
                    <span>{tab}</span>
                    {isActive && (
                      <svg className="ml-auto h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-3 space-y-1 shrink-0" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px) + 64px)' }}>
              <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '4px 0 8px' }} />
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="h-8 w-8 shrink-0 rounded-full bg-blue-100 dark:bg-[#0f2040] flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <UserIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[--text-primary] truncate">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-[--text-muted] truncate">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-[--text-muted] hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 dark:hover:text-red-400"
              >
                <LogOut className="h-5 w-5 shrink-0" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
