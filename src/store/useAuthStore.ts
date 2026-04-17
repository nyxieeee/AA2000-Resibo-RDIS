import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, pass: string) => boolean;
  logout: () => void;
}

const DEMO_CREDENTIALS: Record<string, { user: User; pass: string }> = {
  'ceo@aa2000.com.ph': {
    user: { id: '1', email: 'ceo@aa2000.com.ph', role: 'CEO', firstName: 'CEO', lastName: '' },
    pass: 'admin'
  },
  'president@aa2000.com.ph': {
    user: { id: '2', email: 'president@aa2000.com.ph', role: 'President', firstName: 'President', lastName: '' },
    pass: 'admin'
  },
  'gm@aa2000.com.ph': {
    user: { id: '3', email: 'gm@aa2000.com.ph', role: 'General Manager', firstName: 'General Manager', lastName: '' },
    pass: 'admin'
  },
  'accountant1@aa2000.com.ph': {
    user: { id: '4', email: 'accountant1@aa2000.com.ph', role: 'Accountant', firstName: 'Accountant 1', lastName: '' },
    pass: 'accounting'
  },
  'accountant2@aa2000.com.ph': {
    user: { id: '5', email: 'accountant2@aa2000.com.ph', role: 'Accountant', firstName: 'Accountant 2', lastName: '' },
    pass: 'accounting'
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: (email, pass) => {
        const acc = DEMO_CREDENTIALS[email];
        if (acc && acc.pass === pass) {
          set({ user: acc.user, isAuthenticated: true });
          return true;
        }
        return false;
      },
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'aa2000-auth-store'
    }
  )
);
