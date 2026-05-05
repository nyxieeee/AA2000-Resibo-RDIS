type NullableString = string | null;

export interface SessionVerifyPayload {
  session?: {
    s_ID?: string | number;
    s_name?: string;
    [key: string]: unknown;
  };
  account?: {
    acc_ID?: string | number;
    role_ID?: string | number;
    role_name?: string;
    username?: string;
    acc_username?: string;
    user_name?: string;
    fullName?: string;
    full_name?: string;
    email?: string;
    acc_email?: string;
    firstName?: string;
    first_name?: string;
    lastName?: string;
    last_name?: string;
    [key: string]: unknown;
  };
  employee?: {
    firstName?: string;
    first_name?: string;
    lastName?: string;
    last_name?: string;
    fullName?: string;
    full_name?: string;
    name?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface LaunchUserDetails {
  username: string;
  accountId: string;
  sessionToken: string;
  account: Record<string, unknown> | null;
  employee: Record<string, unknown> | null;
  session: Record<string, unknown> | null;
}

const TOKEN_KEYS = ['__launch', '_launch', 'launchToken', 'sessionToken', 'session_token', 'token', 's_name', 's_ID', 's_id', 'sid', 'auth_token', 'accessToken'];
const ACCOUNT_ID_KEYS = ['__actor', 'acc_ID', 'accId', 'accountId', 'acc_id', 'user_id', 'userId'];

const AUTH_DEBUG = (import.meta.env.VITE_AUTH_DEBUG || '').toLowerCase() === 'true';
const AUTH_STRICT_ROUTES = (import.meta.env.VITE_AUTH_STRICT_ROUTES || '').toLowerCase() === 'true';
const VERIFY_LAUNCH_URL = import.meta.env.VITE_VERIFY_LAUNCH_URL as string | undefined;
const VERIFY_SESSION_URL = import.meta.env.VITE_VERIFY_SESSION_URL as string | undefined;

const BASE_API_CANDIDATES = [
  import.meta.env.VITE_AUTH_API_BASE_URLS,
  import.meta.env.VITE_AUTH_API_BASE_URL,
  import.meta.env.VITE_API_BASE_URLS,
  import.meta.env.VITE_API_BASE_URL,
]
  .filter(Boolean)
  .flatMap((v) => String(v).split(','))
  .map((v) => v.trim().replace(/\/+$/, ''))
  .filter(Boolean);

function debugLog(...args: unknown[]) {
  if (AUTH_DEBUG) {
    // eslint-disable-next-line no-console
    console.log('[launch-auth]', ...args);
  }
}

function getPathEncodedValue(key: string): NullableString {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = window.location.pathname.match(new RegExp(`(?:^|/)${escaped}=([^/]+)`));
  return match?.[1] || null;
}

function getFromUrl(keys: string[]): NullableString {
  const fullUrl = window.location.href;
  const url = new URL(fullUrl);
  
  for (const key of keys) {
    // 1. Direct query param
    const fromQuery = url.searchParams.get(key);
    if (fromQuery) return fromQuery;

    // 2. Hash params (checking both ?query and raw key=value in hash)
    const hash = window.location.hash || '';
    if (hash) {
      const rawHash = hash.startsWith('#') ? hash.slice(1) : hash;
      const hashParams = new URLSearchParams(rawHash.includes('?') ? rawHash.split('?')[1] : rawHash);
      const fromHash = hashParams.get(key);
      if (fromHash) return fromHash;
      
      // Try regex for cases like #/path/key=value
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = hash.match(new RegExp(`(?:^|[?&/#])${escaped}=([^&/]+)`));
      if (match?.[1]) return match[1];
    }

    // 3. Path encoded value (e.g. /path/key=value)
    const fromPath = getPathEncodedValue(key);
    if (fromPath) return fromPath;
  }
  return null;
}

export function getTokenFromCurrentUrl(): NullableString {
  return getFromUrl(TOKEN_KEYS);
}

export function getAccountIdFromCurrentUrl(): NullableString {
  return getFromUrl(ACCOUNT_ID_KEYS);
}

export function cleanSensitiveAuthParamsFromUrl() {
  const url = new URL(window.location.href);
  [...TOKEN_KEYS, ...ACCOUNT_ID_KEYS].forEach((key) => url.searchParams.delete(key));
  window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
}

function base64ToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function sha256Bytes(value: string): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return new Uint8Array(hash);
}

async function getConfiguredAesKeyMaterial(): Promise<Uint8Array | null> {
  const raw = import.meta.env.VITE_LAUNCH_AES_KEY as string | undefined;
  if (raw) {
    const trimmed = raw.trim();
    if (/^[a-fA-F0-9]{64}$/.test(trimmed)) {
      const out = new Uint8Array(32);
      for (let i = 0; i < 32; i++) out[i] = parseInt(trimmed.slice(i * 2, i * 2 + 2), 16);
      return out;
    }
    try {
      const maybeBase64 = base64ToBytes(trimmed);
      if (maybeBase64.length === 32) return maybeBase64;
    } catch {
      // ignore parse error and fallback
    }
  }
  return null;
}

async function getDevFallbackAesKeyMaterial(): Promise<Uint8Array> {
  return sha256Bytes('aa2000-portal-launch-dev-v1');
}

async function getAesKeyCandidates(): Promise<Uint8Array[]> {
  const configured = await getConfiguredAesKeyMaterial();
  const devFallback = await getDevFallbackAesKeyMaterial();
  if (!configured) return [devFallback];

  // Keep the configured key first, then try dev fallback for local portal testing.
  const configuredHash = Array.from(configured).join(',');
  const fallbackHash = Array.from(devFallback).join(',');
  if (configuredHash === fallbackHash) return [configured];
  return [configured, devFallback];
}

async function decryptAesGcmPortal(token: string): Promise<NullableString> {
  const tokenCandidates = Array.from(new Set([
    String(token ?? '').trim(),
    (() => { try { return decodeURIComponent(String(token ?? '').trim()); } catch { return ''; } })(),
    String(token ?? '').trim().replace(/ /g, '+'),
  ].filter(Boolean)));

  const candidates = await getAesKeyCandidates();

  for (const candidate of tokenCandidates) {
    const bytes = (() => {
      try {
        return base64ToBytes(candidate);
      } catch {
        return null;
      }
    })();
    if (!bytes || bytes.length <= 12) continue;

    const iv = bytes.slice(0, 12);
    const cipher = bytes.slice(12);

    for (const keyBytes of candidates) {
      try {
        const key = await crypto.subtle.importKey('raw', asArrayBuffer(keyBytes), 'AES-GCM', false, ['decrypt']);
        const plain = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: asArrayBuffer(iv) },
          key,
          asArrayBuffer(cipher),
        );
        return bytesToUtf8(new Uint8Array(plain));
      } catch {
        // Try the next key candidate.
      }
    }
  }

  try {
    debugLog('decryptAesGcmPortal', 'all candidates failed');
  } catch {
    // noop
  }
  return null;
}

async function decryptLegacyIvCipher(token: string): Promise<NullableString> {
  const secret = import.meta.env.VITE_LAUNCH_TOKEN_SECRET as string | undefined;
  if (!secret || !token.includes(':')) return null;
  try {
    const [ivRaw, cipherRaw] = token.split(':');
    const iv = base64ToBytes(ivRaw);
    const cipher = base64ToBytes(cipherRaw);
    const keyBytes = await sha256Bytes(secret);
    const key = await crypto.subtle.importKey('raw', asArrayBuffer(keyBytes), 'AES-CBC', false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: asArrayBuffer(iv) }, key, asArrayBuffer(cipher));
    return bytesToUtf8(new Uint8Array(plain)).replace(/\0+$/g, '').trim();
  } catch {
    return null;
  }
}

function tryDecodeURIComponent(value: string): NullableString {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function maybeDecodeBase64(value: string): NullableString {
  const mode = (import.meta.env.VITE_AUTH_BASE64_MODE || '').toLowerCase();
  if (!mode || mode === 'off') return null;
  try {
    return bytesToUtf8(base64ToBytes(value));
  } catch {
    return null;
  }
}

export async function normalizeIncomingLaunchToken(input: string): Promise<string> {
  const portal = await decryptAesGcmPortal(input);
  if (portal) return portal;

  const legacy = await decryptLegacyIvCipher(input);
  if (legacy) return legacy;

  const decoded = tryDecodeURIComponent(input);
  if (decoded) {
    const fromB64 = maybeDecodeBase64(decoded);
    if (fromB64) return fromB64;
    return decoded;
  }

  const directB64 = maybeDecodeBase64(input);
  if (directB64) return directB64;

  return input;
}

export async function normalizeIncomingAccountId(input: string): Promise<string> {
  const normalized = await normalizeIncomingLaunchToken(input);
  return normalized.trim();
}

async function fetchJson(url: string, token?: string): Promise<SessionVerifyPayload | null> {
  const apiKey = import.meta.env.VITE_API_KEY;
  const finalUrl = apiKey ? `${url}${url.includes('?') ? '&' : '?'}api_key=${apiKey}` : url;
  
  try {
    const response = await fetch(finalUrl, { 
      method: 'GET', 
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    });
    if (!response.ok) return null;
    const json = await response.json();
    const root = asObject(json);
    if (!root) return null;

    // If the response is the account object itself (no 'account' wrapper)
    if (root.acc_ID != null || root.username || root.email || root.role_name) {
      return {
        account: root as any,
        session: (root.session as any) || { s_name: token },
        ...root,
      };
    }

    return root as SessionVerifyPayload;
  } catch {
    return null;
  }
}

function verifyBases(): string[] {
  const unique = new Set(BASE_API_CANDIDATES);
  if (unique.size === 0) {
    if (import.meta.env.DEV) {
      unique.add('https://desktop-0iik0rk.tail78436b.ts.net');
    } else {
      unique.add('/api');
    }
  }
  return [...unique];
}

function launchRouteCandidates(token: string): string[] {
  const encoded = encodeURIComponent(token);
  const baseRoutes = AUTH_STRICT_ROUTES ? ['/verify-launch'] : ['/verify-launch', '/security/verify-launch', '/auth/verify-launch'];
  const list: string[] = [];
  for (const base of verifyBases()) {
    for (const route of baseRoutes) {
      list.push(`${base}${route}?__launch=${encoded}`);
      list.push(`${base}${route}?_launch=${encoded}`);
    }
  }
  return list;
}

function sessionRouteCandidates(token: string): string[] {
  const encoded = encodeURIComponent(token);
  const baseRoutes = AUTH_STRICT_ROUTES ? ['/session'] : ['/session', '/security/session', '/auth/session'];
  const list: string[] = [];
  for (const base of verifyBases()) {
    for (const route of baseRoutes) {
      list.push(`${base}${route}/${encoded}`);
      list.push(`${base}${route}?token=${encoded}`);
      list.push(`${base}${route}?s_name=${encoded}`);
    }
  }
  return list;
}

function formatEndpoint(template: string, token: string): string {
  const encoded = encodeURIComponent(token);
  return template.includes('{token}') ? template.replaceAll('{token}', encoded) : `${template.replace(/\/+$/, '')}/${encoded}`;
}

export async function verifyLaunchToken(token: string): Promise<SessionVerifyPayload | null> {
  const candidates = VERIFY_LAUNCH_URL ? [formatEndpoint(VERIFY_LAUNCH_URL, token)] : launchRouteCandidates(token);
  for (const url of candidates) {
    const payload = await fetchJson(url, token);
    debugLog('verifyLaunchToken', url, Boolean(payload));
    if (payload) return payload;
  }
  return null;
}

export async function verifySessionToken(token: string): Promise<SessionVerifyPayload | null> {
  const candidates = VERIFY_SESSION_URL ? [formatEndpoint(VERIFY_SESSION_URL, token)] : sessionRouteCandidates(token);
  for (const url of candidates) {
    const payload = await fetchJson(url, token);
    debugLog('verifySessionToken', url, Boolean(payload));
    if (payload) return payload;
  }
  return null;
}

function accountRouteCandidates(accountId: string): string[] {
  const encoded = encodeURIComponent(accountId);
  const routes = AUTH_STRICT_ROUTES
    ? ['/account']
    : ['/account', '/accounts', '/users', '/employee', '/security/account', '/auth/account'];
  const list: string[] = [];
  for (const base of verifyBases()) {
    for (const route of routes) {
      list.push(`${base}${route}/${encoded}`);
      list.push(`${base}${route}?acc_ID=${encoded}`);
      list.push(`${base}${route}?accountId=${encoded}`);
      list.push(`${base}${route}?id=${encoded}`);
    }
  }
  return list;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

async function fetchAccountLike(url: string, sessionToken?: string): Promise<SessionVerifyPayload | null> {
  const apiKey = import.meta.env.VITE_API_KEY;
  const finalUrl = apiKey ? `${url}${url.includes('?') ? '&' : '?'}api_key=${apiKey}` : url;

  try {
    const headers: HeadersInit = {
      Accept: 'application/json',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
    };
    const response = await fetch(finalUrl, { method: 'GET', headers, credentials: 'include' });
    if (!response.ok) return null;
    const json = await response.json();
    const root = asObject(json);
    if (!root) return null;

    const account = asObject(root.account) || root;
    const employee = asObject(root.employee) || asObject(root.profile) || null;
    if (!account) return null;
    return {
      ...root,
      account: account as SessionVerifyPayload['account'],
      employee: (employee as SessionVerifyPayload['employee']) || undefined,
    };
  } catch {
    return null;
  }
}

export async function enrichPayloadWithAccountDetails(
  payload: SessionVerifyPayload,
  accountId: string,
  sessionToken?: string,
): Promise<SessionVerifyPayload> {
  const id = accountId.trim();
  if (!id) return payload;

  const candidates = accountRouteCandidates(id);
  for (const url of candidates) {
    const details = await fetchAccountLike(url, sessionToken);
    debugLog('enrichPayloadWithAccountDetails', url, Boolean(details));
    if (!details?.account) continue;
    return {
      ...payload,
      ...details,
      account: {
        ...(payload.account || {}),
        ...(details.account || {}),
      },
      employee: {
        ...(payload.employee || {}),
        ...(details.employee || {}),
      },
    };
  }

  return payload;
}

export function resolveRoleName(payload: SessionVerifyPayload): string {
  const role = payload.account?.role_name || payload.account?.role_ID;
  const stringRole = String(role || '').trim();
  if (!stringRole) return 'Viewer';
  return stringRole;
}

function asCleanString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const s = asCleanString(value);
    if (s) return s;
  }
  return '';
}

function combineNameParts(first: string, last: string): string {
  const full = `${first} ${last}`.trim();
  return full;
}

export function resolveDisplayName(payload: SessionVerifyPayload): { firstName: string; lastName: string; email: string } {
  const fromEmployee = firstNonEmpty(
    payload.employee?.fullName,
    payload.employee?.full_name,
    payload.employee?.name,
    combineNameParts(
      firstNonEmpty(payload.employee?.firstName, payload.employee?.first_name, payload.employee?.['Emp_firstName']),
      firstNonEmpty(payload.employee?.lastName, payload.employee?.last_name, payload.employee?.['Emp_lastName']),
    ),
  );

  const fromAccount = firstNonEmpty(
    payload.account?.fullName,
    payload.account?.full_name,
    combineNameParts(
      firstNonEmpty(payload.account?.firstName, payload.account?.first_name),
      firstNonEmpty(payload.account?.lastName, payload.account?.last_name),
    ),
    payload.account?.username,
    payload.account?.acc_username,
    payload.account?.user_name,
    payload.account?.email,
    payload.account?.acc_email,
  );

  const combined = firstNonEmpty(fromEmployee, fromAccount, 'User');
  const [firstName, ...last] = combined.split(/\s+/);
  return {
    firstName: firstName || 'User',
    lastName: last.join(' '),
    email: firstNonEmpty(
      payload.account?.email,
      payload.account?.acc_email,
      payload.account?.username,
      payload.account?.acc_username,
      'unknown@aa2000.local',
    ),
  };
}

export function resolveUsername(payload: SessionVerifyPayload): string {
  return firstNonEmpty(
    payload.account?.username,
    payload.account?.acc_username,
    payload.account?.user_name,
    payload.account?.email,
    payload.account?.acc_email,
    payload.employee?.fullName,
    payload.employee?.full_name,
  );
}

export function resolveLaunchUserDetails(payload: SessionVerifyPayload): LaunchUserDetails {
  const accountId = firstNonEmpty(payload.account?.acc_ID != null ? String(payload.account.acc_ID) : '');
  const sessionToken = firstNonEmpty(payload.session?.s_name);
  return {
    username: resolveUsername(payload),
    accountId,
    sessionToken,
    account: payload.account ? ({ ...payload.account } as Record<string, unknown>) : null,
    employee: payload.employee ? ({ ...payload.employee } as Record<string, unknown>) : null,
    session: payload.session ? ({ ...payload.session } as Record<string, unknown>) : null,
  };
}

