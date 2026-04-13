import { useState, useEffect } from 'react';
import { Bell, Search, Menu, CheckCircle2, Info, Sun, Moon } from 'lucide-react';
import { useNotificationStore } from '../../store/useNotificationStore';
import { cn } from '../../lib/utils';

export function Header() {
  const { notifications, markAllAsRead, clearAll } = useNotificationStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const [isDark, setIsDark] = useState(() =>
    localStorage.getItem('rdis-theme') === 'dark'
  );

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

  return (
    <header
      className="h-16 flex items-center justify-between px-6 shrink-0 z-10 w-full relative transition-colors duration-200"
      style={{ backgroundColor: 'var(--bg-header)', boxShadow: '0 1px 0 var(--border-subtle)' }}
    >
      <div className="flex items-center gap-4">
        <button className="md:hidden text-[--text-muted] hover:text-[--text-primary]">
          <Menu className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-semibold text-[--text-primary] hidden md:block">Workspace</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
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

        {/* Dark / Light toggle */}
        <button
          onClick={() => setIsDark(!isDark)}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-2 rounded-full transition-colors hover:bg-[--bg-raised]"
          style={{ color: 'var(--text-muted)' }}
        >
          {isDark
            ? <Sun  className="h-5 w-5 text-amber-400" />
            : <Moon className="h-5 w-5" />
          }
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => {
              setShowDropdown(!showDropdown);
              if (!showDropdown && unreadCount > 0) markAllAsRead();
            }}
            className={cn(
              'relative p-2 rounded-full transition-colors',
              showDropdown
                ? 'bg-blue-50 dark:bg-[#0f1f38] text-blue-600 dark:text-blue-400'
                : 'hover:bg-[--bg-raised]'
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
                  onClick={clearAll}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  Clear All
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-sm text-[--text-muted]">
                    No new notifications
                  </div>
                ) : (
                  <div className="divide-y" style={{ '--tw-divide-opacity': 1, borderColor: 'var(--border-subtle)' } as any}>
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
                            {notif.type === 'success'
                              ? <CheckCircle2 className="h-4 w-4" />
                              : <Info className="h-4 w-4" />
                            }
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
  );
}
