import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { apiFetch } from '../lib/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  allUsers: any[];
  sessions: any[];
  login: (username: string, pass: string) => Promise<boolean>;
  logout: () => void;
  updateProfile: (updates: Partial<User>) => Promise<boolean>;
  changePassword: (current: string, next: string) => Promise<{ success: boolean; error?: string }>;
  toggleDarkMode: () => Promise<void>;
  fetchAllUsers: () => Promise<void>;
  fetchSessions: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      allUsers: [],
      sessions: [],
      login: async (username, pass) => {
        try {
          const data = await apiFetch('/security/login/verification', {
            method: 'POST',
            body: JSON.stringify({ username, password: pass }),
          });
          
          if (data.session && data.session.s_name) {
            localStorage.setItem('aa2000-auth-token', data.session.s_name);
            
            const user = {
              id: String(data.account.acc_ID),
              email: data.account.username,
              role: data.account.role_name,
              firstName: data.account.username,
              lastName: '',
              darkMode: false
            };
            
            set({ user: user as any, isAuthenticated: true });
            return true;
          }
          return false;
        } catch (err: any) {
          console.error('Login failed:', err);
          throw new Error(err.message || 'Connection failed. Is the server running?');
        }
      },
      updateProfile: async (updates) => {
        try {
          const currentUser = get().user;
          if (!currentUser) return false;
          
          await apiFetch('/auth/profile', {
            method: 'PATCH',
            body: JSON.stringify({ ...currentUser, ...updates }),
          });
          
          set({ user: { ...currentUser, ...updates } });
          return true;
        } catch (err) {
          console.error('Update profile failed:', err);
          return false;
        }
      },
      changePassword: async (current, next) => {
        try {
          await apiFetch('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword: current, newPassword: next }),
          });
          return { success: true };
        } catch (err: any) {
          console.error('Change password failed:', err);
          return { success: false, error: err.message || 'Failed to change password' };
        }
      },
      logout: () => {
        localStorage.removeItem('aa2000-auth-token');
        set({ user: null, isAuthenticated: false, allUsers: [], sessions: [] });
      },
      toggleDarkMode: async () => {
        const currentUser = get().user;
        if (!currentUser) return;
        const newValue = !currentUser.darkMode;
        
        // Optimistic update
        set({ user: { ...currentUser, darkMode: newValue } });
        
        try {
          await apiFetch('/auth/profile', {
            method: 'PATCH',
            body: JSON.stringify({ ...currentUser, darkMode: newValue }),
          });
        } catch (err) {
          console.error('Failed to toggle dark mode:', err);
        }
      },
      fetchAllUsers: async () => {
        try {
          const users = await apiFetch('/users');
          set({ allUsers: users });
        } catch (err) {
          console.error('Failed to fetch users:', err);
        }
      },
      fetchSessions: async () => {
        try {
          const sessions = await apiFetch('/security/sessions');
          set({ sessions });
        } catch (err) {
          console.error('Failed to fetch sessions:', err);
        }
      },
    }),
    {
      name: 'aa2000-auth-store'
    }
  )
);
