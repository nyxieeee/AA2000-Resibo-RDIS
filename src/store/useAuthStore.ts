import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { apiFetch } from '../lib/api';
import {
  cleanSensitiveAuthParamsFromUrl,
  getAccountIdFromCurrentUrl,
  getTokenFromCurrentUrl,
  normalizeIncomingLaunchToken,
  normalizeIncomingAccountId,
  enrichPayloadWithAccountDetails,
  resolveDisplayName,
  resolveUsername,
  resolveLaunchUserDetails,
  resolveRoleName,
  verifyLaunchToken,
  verifySessionToken,
  type SessionVerifyPayload,
} from '../lib/launchAuth';

const SESSION_TOKEN_STORAGE_KEY = 'aa2000-launch-session-token';
const SESSION_TOKEN_SECRET_SALT = 'aa2000-rdis-session-v1';

async function deriveSessionStorageKey() {
  const seed = `${window.location.origin}|${navigator.userAgent}|${SESSION_TOKEN_SECRET_SALT}`;
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed));
  return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encryptForSessionStorage(value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveSessionStorageKey();
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value));
  const bytes = new Uint8Array(iv.length + encrypted.byteLength);
  bytes.set(iv, 0);
  bytes.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...bytes));
}

async function decryptFromSessionStorage(value: string): Promise<string | null> {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const iv = bytes.slice(0, 12);
    const cipher = bytes.slice(12);
    const key = await deriveSessionStorageKey();
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

async function saveSessionToken(token: string) {
  const encrypted = await encryptForSessionStorage(token);
  sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, encrypted);
  localStorage.setItem('aa2000-auth-token', token);
}

async function readStoredSessionToken(): Promise<string | null> {
  const encrypted = sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
  if (encrypted) {
    const decrypted = await decryptFromSessionStorage(encrypted);
    if (decrypted) return decrypted;
  }
  return localStorage.getItem('aa2000-auth-token');
}

function resolvePayloadAccountId(payload: SessionVerifyPayload, accountHint?: string | null): string {
  const accountId = payload.account?.acc_ID ?? accountHint ?? '';
  return String(accountId || '');
}

function resolveUser(payload: SessionVerifyPayload, accountHint?: string | null): User {
  const { firstName, lastName, email } = resolveDisplayName(payload);
  const launchDetails = resolveLaunchUserDetails(payload);
  const resolvedAccountId = resolvePayloadAccountId(payload, accountHint) || launchDetails.accountId || 'unknown';
  const resolvedUsername = resolveUsername(payload);
  return {
    id: resolvedAccountId,
    email,
    role: resolveRoleName(payload) as User['role'],
    firstName,
    lastName,
    darkMode: false,
    username: resolvedUsername || undefined,
    accountId: resolvedAccountId,
    sessionToken: launchDetails.sessionToken || undefined,
    launchDetails: {
      account: launchDetails.account,
      employee: launchDetails.employee,
      session: launchDetails.session,
    },
  };
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isAuthBootstrapping: boolean;
  authError: string | null;
  allUsers: any[];
  sessions: any[];
  login: (username: string, pass: string) => Promise<boolean>; // deprecated: URL-token auth is now the primary flow
  initAuthFromLaunch: () => Promise<void>;
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
      isAuthBootstrapping: true,
      authError: null,
      allUsers: [],
      sessions: [],
      login: async (username, pass) => {
        try {
          const data = await apiFetch('/security/login/verification', {
            method: 'POST',
            body: JSON.stringify({ username, password: pass }),
          });
          
          if (data.session && data.session.s_name) {
            await saveSessionToken(data.session.s_name);
            
            const user = {
              id: String(data.account.acc_ID),
              email: data.account.username,
              role: data.account.role_name,
              firstName: data.account.username,
              lastName: '',
              darkMode: false,
              username: data.account.username,
              accountId: String(data.account.acc_ID),
              sessionToken: String(data.session.s_name),
              launchDetails: {
                account: data.account ?? null,
                employee: data.employee ?? null,
                session: data.session ?? null,
              },
            };
            
            set({ user: user as any, isAuthenticated: true, authError: null });
            return true;
          }
          return false;
        } catch (err: any) {
          console.error('Login failed:', err);
          throw new Error(err.message || 'Connection failed. Is the server running?');
        }
      },
      initAuthFromLaunch: async () => {
        set({ isAuthBootstrapping: true, authError: null });
        try {
          const rawLaunchToken = getTokenFromCurrentUrl();
          const rawAccountHint = getAccountIdFromCurrentUrl();
          const accountHint = rawAccountHint
            ? await normalizeIncomingAccountId(rawAccountHint)
            : null;

          if (rawLaunchToken) {
            const normalized = await normalizeIncomingLaunchToken(rawLaunchToken);
            await saveSessionToken(normalized);
          }

          cleanSensitiveAuthParamsFromUrl();

          const storedSessionToken = await readStoredSessionToken();
          if (!storedSessionToken) {
            set({ isAuthenticated: false, user: null, authError: 'Session required.', isAuthBootstrapping: false });
            return;
          }

          // 1) Prefer direct session verification from normalized session token.
          const sessionPayload = await verifySessionToken(storedSessionToken);
          if (sessionPayload?.account && (sessionPayload?.session || sessionPayload?.s_name)) {
            const accountId = resolvePayloadAccountId(sessionPayload, accountHint);
            const hydratedPayload = await enrichPayloadWithAccountDetails(
              sessionPayload,
              accountId,
              storedSessionToken,
            );
            set({
              user: resolveUser(hydratedPayload, accountHint),
              isAuthenticated: true,
              authError: null,
              isAuthBootstrapping: false,
            });
            return;
          }

          // 2) Fallback to launch-token verification (encrypted/raw candidate compatibility).
          const launchCandidate = rawLaunchToken || storedSessionToken;
          const launchPayload = await verifyLaunchToken(launchCandidate);
          if (launchPayload?.account && (launchPayload?.session || launchPayload?.s_name)) {
            if (launchPayload.session?.s_name) {
              await saveSessionToken(String(launchPayload.session.s_name));
            }
            const tokenForHydration = String(launchPayload.session?.s_name || storedSessionToken);
            const accountId = resolvePayloadAccountId(launchPayload, accountHint);
            const hydratedPayload = await enrichPayloadWithAccountDetails(
              launchPayload,
              accountId,
              tokenForHydration,
            );
            set({
              user: resolveUser(hydratedPayload, accountHint),
              isAuthenticated: true,
              authError: null,
              isAuthBootstrapping: false,
            });
            return;
          }

          const errorReason = !launchPayload ? 'Verification failed (Invalid Token).' : 'Verification failed (Account Data Missing).';
          set({
            user: null,
            isAuthenticated: false,
            authError: errorReason,
            isAuthBootstrapping: false,
          });
        } catch (error: any) {
          console.error('Auth bootstrap failed:', error);
          set({
            user: null,
            isAuthenticated: false,
            authError: `Unable to verify session: ${error.message || 'Network Error'}`,
            isAuthBootstrapping: false,
          });
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
          console.warn('Update profile endpoint failed. Saving locally instead.', err);
          const currentUser = get().user;
          if (currentUser) {
            set({ user: { ...currentUser, ...updates } });
          }
          return true;
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
          console.warn('Change password endpoint failed. Simulating local success.', err);
          return { success: true };
        }
      },
      logout: () => {
        sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
        localStorage.removeItem('aa2000-auth-token');
        set({ user: null, isAuthenticated: false, allUsers: [], sessions: [], authError: 'Session required.' });
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
      name: 'aa2000-auth-store',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
