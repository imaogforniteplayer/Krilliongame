/**
 * Minimal Supabase Auth (GoTrue) client over plain fetch, so the game needs no extra dependency.
 *
 * - Google sign-in uses the OAuth PKCE flow: the browser is sent to Supabase, Google asks for consent,
 *   and we come back to the game with `?code=...` which is exchanged for a session.
 * - Email + password sign-up / sign-in use the standard GoTrue endpoints.
 * - Nothing here is DEEPER-specific game logic. Auth only identifies a player; it never touches scoring.
 *
 * Everything is injected (fetch, storage, clock, crypto) so it can be unit tested without a browser.
 * Written against the documented GoTrue/PostgREST HTTP API; it has not been run against a live project.
 */

export interface AuthConfig {
  /** Project URL, e.g. https://abcd.supabase.co (no trailing slash). */
  url: string;
  /** The public anon key. Never put a service-role key in the browser. */
  anonKey: string;
}

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  /** 'google' | 'email' | other provider name. */
  provider: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  /** Milliseconds since the epoch. */
  expiresAt: number;
  user: AuthUser;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface CryptoLike {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
  subtle: { digest(algorithm: string, data: BufferSource): Promise<ArrayBuffer> };
}

export interface AuthDeps {
  config: AuthConfig;
  fetch: typeof fetch;
  storage: KeyValueStorage;
  crypto: CryptoLike;
  now: () => number;
}

export const SESSION_KEY = 'deeper.auth.session.v1';
export const VERIFIER_KEY = 'deeper.auth.pkce.v1';

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: string = 'auth_error',
    readonly status: number = 0,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/** Returns a config only when both values look real. Placeholder text from .env.example is rejected. */
export function readConfig(url: unknown, anonKey: unknown): AuthConfig | null {
  if (typeof url !== 'string' || typeof anonKey !== 'string') return null;
  const u = url.trim().replace(/\/+$/, '');
  const k = anonKey.trim();
  if (!/^https:\/\/[^\s/]+\.[^\s/]+/i.test(u) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(u)) return null;
  if (k.length < 20) return null;
  return { url: u, anonKey: k };
}

// --- PKCE helpers -------------------------------------------------------------------------

function base64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomVerifier(c: CryptoLike): string {
  const bytes = new Uint8Array(48);
  c.getRandomValues(bytes);
  return base64Url(bytes);
}

export async function challengeFor(verifier: string, c: CryptoLike): Promise<string> {
  const digest = await c.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

// --- Session handling ---------------------------------------------------------------------

interface RawUser {
  id?: unknown;
  email?: unknown;
  app_metadata?: { provider?: unknown };
  user_metadata?: { full_name?: unknown; name?: unknown; avatar_url?: unknown; picture?: unknown };
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export function parseUser(raw: RawUser | null | undefined): AuthUser | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = str(raw.id);
  if (!id) return null;
  const meta = raw.user_metadata ?? {};
  return {
    id,
    email: str(raw.email),
    name: str(meta.full_name) ?? str(meta.name),
    avatarUrl: str(meta.avatar_url) ?? str(meta.picture),
    provider: str(raw.app_metadata?.provider) ?? 'email',
  };
}

export function parseSession(body: unknown, now: number): Session | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown; expires_at?: unknown; user?: RawUser };
  const accessToken = str(b.access_token);
  const refreshToken = str(b.refresh_token);
  const user = parseUser(b.user);
  if (!accessToken || !refreshToken || !user) return null;
  let expiresAt: number;
  if (typeof b.expires_at === 'number') expiresAt = b.expires_at * 1000;
  else if (typeof b.expires_in === 'number') expiresAt = now + b.expires_in * 1000;
  else expiresAt = now + 3600_000;
  return { accessToken, refreshToken, expiresAt, user };
}

export function loadSession(storage: KeyValueStorage): Session | null {
  try {
    const raw = storage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s || typeof s.accessToken !== 'string' || typeof s.refreshToken !== 'string' || !s.user?.id) return null;
    return s;
  } catch {
    return null;
  }
}

function saveSession(storage: KeyValueStorage, s: Session): void {
  try {
    storage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: the session just lasts until the page closes */
  }
}

export function clearSession(storage: KeyValueStorage): void {
  try {
    storage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** Turns the many error shapes GoTrue and PostgREST return into one calm, readable message. */
export function friendlyError(status: number, body: unknown): AuthError {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const code = str(b.error_code) ?? str(b.code) ?? str(b.error) ?? 'auth_error';
  const raw = str(b.msg) ?? str(b.message) ?? str(b.error_description) ?? str(b.error) ?? '';
  const lower = `${code} ${raw}`.toLowerCase();
  let message: string;
  if (lower.includes('invalid login') || lower.includes('invalid_credentials')) message = 'That email and password do not match.';
  else if (lower.includes('already registered') || lower.includes('user_already_exists')) message = 'An account with that email already exists. Try signing in instead.';
  else if (lower.includes('email not confirmed') || lower.includes('email_not_confirmed')) message = 'Please confirm your email first. Check your inbox for the link.';
  else if (lower.includes('weak_password') || lower.includes('password should be')) message = 'That password is too weak. Use at least 8 characters.';
  else if (lower.includes('over_email_send_rate_limit') || lower.includes('rate limit') || status === 429) message = 'Too many attempts. Please wait a minute and try again.';
  else if (lower.includes('validation_failed') || lower.includes('invalid email') || lower.includes('unable to validate email')) message = 'That email address does not look valid.';
  else if (lower.includes('signup_disabled') || lower.includes('signups not allowed')) message = 'New sign-ups are switched off on this server.';
  else if (lower.includes('provider is not enabled') || lower.includes('unsupported provider')) message = 'Google sign-in is not enabled on the server yet.';
  else if (lower.includes('bad_oauth') || lower.includes('invalid flow state') || lower.includes('flow_state')) message = 'The Google sign-in expired or was cancelled. Please try again.';
  else message = raw ? `Sign-in problem: ${raw}` : 'Something went wrong. Please try again.';
  return new AuthError(message, code, status);
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function headers(cfg: AuthConfig, token?: string): Record<string, string> {
  return {
    apikey: cfg.anonKey,
    Authorization: `Bearer ${token ?? cfg.anonKey}`,
    'Content-Type': 'application/json',
  };
}

async function call(d: AuthDeps, path: string, init: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await d.fetch(`${d.config.url}${path}`, init);
  } catch {
    throw new AuthError('Could not reach the server. Check your connection and try again.', 'network', 0);
  }
  const body = await readJson(res);
  if (!res.ok) throw friendlyError(res.status, body);
  return body;
}

// --- Public operations --------------------------------------------------------------------

/** Where Google should send the player back to. Supabase must list this URL as an allowed redirect. */
export function redirectTarget(origin: string, basePath: string): string {
  const base = basePath.startsWith('/') ? basePath : `/${basePath}`;
  return `${origin}${base.endsWith('/') ? base : `${base}/`}`;
}

/** Builds the Google consent URL and remembers the PKCE verifier. The caller then navigates there. */
export async function startGoogleSignIn(d: AuthDeps, redirectTo: string): Promise<string> {
  const verifier = randomVerifier(d.crypto);
  const challenge = await challengeFor(verifier, d.crypto);
  try {
    d.storage.setItem(VERIFIER_KEY, verifier);
  } catch {
    throw new AuthError('Your browser is blocking storage, which Google sign-in needs. Allow site data and try again.', 'storage');
  }
  const q = new URLSearchParams({
    provider: 'google',
    redirect_to: redirectTo,
    code_challenge: challenge,
    code_challenge_method: 's256',
  });
  return `${d.config.url}/auth/v1/authorize?${q.toString()}`;
}

/** Reads `?code=` / `?error=` from a URL after the OAuth round trip. Returns null for ordinary page loads. */
export function oauthReturn(search: string): { code?: string; error?: string } | null {
  const q = new URLSearchParams(search);
  const error = q.get('error_description') ?? q.get('error');
  if (error) return { error };
  const code = q.get('code');
  return code ? { code } : null;
}

export async function completeGoogleSignIn(d: AuthDeps, code: string): Promise<Session> {
  let verifier: string | null = null;
  try {
    verifier = d.storage.getItem(VERIFIER_KEY);
  } catch {
    /* handled below */
  }
  if (!verifier) throw new AuthError('The Google sign-in expired. Please start again.', 'missing_verifier');
  try {
    d.storage.removeItem(VERIFIER_KEY);
  } catch {
    /* ignore */
  }
  const body = await call(d, '/auth/v1/token?grant_type=pkce', {
    method: 'POST',
    headers: headers(d.config),
    body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
  });
  const session = parseSession(body, d.now());
  if (!session) throw new AuthError('The server sent back something unexpected. Please try again.', 'bad_session');
  saveSession(d.storage, session);
  return session;
}

export type SignUpResult = { status: 'signed-in'; session: Session } | { status: 'confirm-email' };

export function validateCredentials(email: string, password: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address.';
  if (password.length < 8) return 'Use a password of at least 8 characters.';
  if (password.length > 72) return 'That password is too long (72 characters at most).';
  return null;
}

export async function signUpWithEmail(d: AuthDeps, email: string, password: string, redirectTo: string): Promise<SignUpResult> {
  const problem = validateCredentials(email, password);
  if (problem) throw new AuthError(problem, 'validation_failed');
  const body = await call(d, `/auth/v1/signup?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: 'POST',
    headers: headers(d.config),
    body: JSON.stringify({ email: email.trim(), password }),
  });
  const session = parseSession(body, d.now());
  if (session) {
    saveSession(d.storage, session);
    return { status: 'signed-in', session };
  }
  // With email confirmation on, GoTrue returns the new user but no session until the link is clicked.
  return { status: 'confirm-email' };
}

export async function signInWithEmail(d: AuthDeps, email: string, password: string): Promise<Session> {
  const problem = validateCredentials(email, password);
  if (problem) throw new AuthError(problem, 'validation_failed');
  const body = await call(d, '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: headers(d.config),
    body: JSON.stringify({ email: email.trim(), password }),
  });
  const session = parseSession(body, d.now());
  if (!session) throw new AuthError('The server sent back something unexpected. Please try again.', 'bad_session');
  saveSession(d.storage, session);
  return session;
}

export async function sendPasswordReset(d: AuthDeps, email: string, redirectTo: string): Promise<void> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new AuthError('Enter a valid email address.', 'validation_failed');
  await call(d, `/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: 'POST',
    headers: headers(d.config),
    body: JSON.stringify({ email: email.trim() }),
  });
}

/**
 * Email links (confirm sign-up, reset password) come back with tokens in the URL hash, which would
 * otherwise be mistaken for a page route. Returns null for ordinary hash routes like `#/home`.
 */
export type HashReturn =
  | { kind: 'tokens'; accessToken: string; refreshToken: string; expiresIn: number; type: string | null }
  | { kind: 'error'; message: string };

export function hashReturn(hash: string): HashReturn | null {
  const raw = hash.replace(/^#/, '');
  if (!raw || raw.startsWith('/')) return null;
  const q = new URLSearchParams(raw);
  const err = q.get('error_description') ?? q.get('error');
  if (err) return { kind: 'error', message: err.replace(/\+/g, ' ') };
  const accessToken = q.get('access_token');
  const refreshToken = q.get('refresh_token');
  if (!accessToken || !refreshToken) return null;
  const expiresIn = Number(q.get('expires_in'));
  return { kind: 'tokens', accessToken, refreshToken, expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600, type: q.get('type') };
}

export async function completeFromHash(d: AuthDeps, r: Extract<HashReturn, { kind: 'tokens' }>): Promise<Session> {
  const body = await call(d, '/auth/v1/user', { method: 'GET', headers: headers(d.config, r.accessToken) });
  const user = parseUser(body as RawUser);
  if (!user) throw new AuthError('The server sent back something unexpected. Please try again.', 'bad_session');
  const session: Session = { accessToken: r.accessToken, refreshToken: r.refreshToken, expiresAt: d.now() + r.expiresIn * 1000, user };
  saveSession(d.storage, session);
  return session;
}

export async function updatePassword(d: AuthDeps, session: Session, password: string): Promise<void> {
  const problem = validateCredentials('x@y.zz', password);
  if (problem) throw new AuthError(problem, 'validation_failed');
  await call(d, '/auth/v1/user', {
    method: 'PUT',
    headers: headers(d.config, session.accessToken),
    body: JSON.stringify({ password }),
  });
}

/** Refreshes a session that is expired or about to be. Returns null (and clears it) if it can no longer be refreshed. */
export async function refreshIfNeeded(d: AuthDeps, session: Session, marginMs = 60_000): Promise<Session | null> {
  if (session.expiresAt - d.now() > marginMs) return session;
  try {
    const body = await call(d, '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: headers(d.config),
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    });
    const next = parseSession(body, d.now());
    if (!next) throw new AuthError('bad session', 'bad_session');
    saveSession(d.storage, next);
    return next;
  } catch (e) {
    // A network blip should not log the player out; only a rejected refresh token does.
    if (e instanceof AuthError && e.code === 'network') return session;
    clearSession(d.storage);
    return null;
  }
}

export async function signOut(d: AuthDeps, session: Session | null): Promise<void> {
  clearSession(d.storage);
  if (!session) return;
  try {
    await d.fetch(`${d.config.url}/auth/v1/logout?scope=local`, { method: 'POST', headers: headers(d.config, session.accessToken) });
  } catch {
    /* already signed out locally, which is what matters */
  }
}

// --- Cloud backup of the local save -------------------------------------------------------

export interface CloudSave {
  data: unknown;
  updatedAt: string;
}

/** Largest backup we will upload. Matches the check constraint in the SQL migration. */
export const MAX_CLOUD_BYTES = 400_000;

export async function uploadSave(d: AuthDeps, session: Session, save: unknown): Promise<string> {
  const json = JSON.stringify(save);
  if (json.length > MAX_CLOUD_BYTES) throw new AuthError('Your save is too large to back up.', 'too_large');
  const updatedAt = new Date(d.now()).toISOString();
  await call(d, '/rest/v1/player_saves?on_conflict=user_id', {
    method: 'POST',
    headers: { ...headers(d.config, session.accessToken), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: session.user.id, data: save, updated_at: updatedAt }),
  });
  return updatedAt;
}

export async function downloadSave(d: AuthDeps, session: Session): Promise<CloudSave | null> {
  const body = await call(d, `/rest/v1/player_saves?select=data,updated_at&user_id=eq.${encodeURIComponent(session.user.id)}`, {
    method: 'GET',
    headers: headers(d.config, session.accessToken),
  });
  if (!Array.isArray(body) || body.length === 0) return null;
  const row = body[0] as { data?: unknown; updated_at?: unknown };
  if (!row.data || typeof row.data !== 'object') return null;
  return { data: row.data, updatedAt: typeof row.updated_at === 'string' ? row.updated_at : '' };
}

export async function deleteCloudSave(d: AuthDeps, session: Session): Promise<void> {
  await call(d, `/rest/v1/player_saves?user_id=eq.${encodeURIComponent(session.user.id)}`, {
    method: 'DELETE',
    headers: { ...headers(d.config, session.accessToken), Prefer: 'return=minimal' },
  });
}

/** What the player sees when choosing between two saves, so a restore is never a blind overwrite. */
export interface SaveSummary {
  runs: number;
  points: number;
  deepest: number;
  achievements: number;
}

export function summarizeSave(save: unknown): SaveSummary {
  const s = (save && typeof save === 'object' ? save : {}) as {
    lifetime?: { runs?: unknown; points?: unknown };
    deepestEver?: unknown;
    achievements?: unknown;
  };
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    runs: n(s.lifetime?.runs),
    points: n(s.lifetime?.points),
    deepest: n(s.deepestEver),
    achievements: s.achievements && typeof s.achievements === 'object' ? Object.keys(s.achievements).length : 0,
  };
}
