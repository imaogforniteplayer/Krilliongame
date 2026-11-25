import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AuthError,
  SESSION_KEY,
  VERIFIER_KEY,
  challengeFor,
  completeGoogleSignIn,
  deleteCloudSave,
  downloadSave,
  completeFromHash,
  friendlyError,
  hashReturn,
  updatePassword,
  loadSession,
  oauthReturn,
  parseSession,
  readConfig,
  redirectTarget,
  refreshIfNeeded,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  startGoogleSignIn,
  summarizeSave,
  uploadSave,
  validateCredentials,
} from './client';
import type { AuthDeps, KeyValueStorage, Session } from './client';

function memoryStorage(): KeyValueStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

interface Call {
  url: string;
  init: RequestInit;
}

function deps(responder: (c: Call) => { status?: number; body?: unknown } | Error, now = 1_000_000) {
  const calls: Call[] = [];
  const storage = memoryStorage();
  const d: AuthDeps = {
    config: { url: 'https://proj.supabase.co', anonKey: 'anon-key-anon-key-anon-key' },
    storage,
    crypto: globalThis.crypto as unknown as AuthDeps['crypto'],
    now: () => now,
    fetch: (async (url: string, init: RequestInit) => {
      const c = { url, init };
      calls.push(c);
      const r = responder(c);
      if (r instanceof Error) throw r;
      const status = r.status ?? 200;
      // Null-body statuses (204) must not carry a body, exactly like a real server.
      return new Response(status === 204 ? null : JSON.stringify(r.body ?? {}), { status });
    }) as typeof fetch,
  };
  return { d, calls, storage };
}

const USER = { id: 'u1', email: 'a@b.co', app_metadata: { provider: 'google' }, user_metadata: { full_name: 'Rusty', picture: 'https://x/y.png' } };
const TOKENS = { access_token: 'acc', refresh_token: 'ref', expires_in: 3600, user: USER };

test('readConfig rejects missing and placeholder values', () => {
  assert.equal(readConfig(undefined, undefined), null);
  assert.equal(readConfig('', ''), null);
  assert.equal(readConfig('your-project-url', 'x'.repeat(40)), null);
  assert.equal(readConfig('https://a.supabase.co', 'short'), null);
  assert.deepEqual(readConfig('https://a.supabase.co/', 'k'.repeat(30)), { url: 'https://a.supabase.co', anonKey: 'k'.repeat(30) });
  assert.ok(readConfig('http://localhost:54321', 'k'.repeat(30)));
});

test('PKCE challenge matches the RFC 7636 example', async () => {
  const c = await challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk', globalThis.crypto as unknown as AuthDeps['crypto']);
  assert.equal(c, 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
});

test('redirectTarget always ends with a slash and keeps the base path', () => {
  assert.equal(redirectTarget('https://u.github.io', '/Krilliongame/'), 'https://u.github.io/Krilliongame/');
  assert.equal(redirectTarget('https://u.github.io', '/Krilliongame'), 'https://u.github.io/Krilliongame/');
  assert.equal(redirectTarget('http://localhost:5173', '/'), 'http://localhost:5173/');
});

test('Google sign-in builds the authorize URL and stores a verifier', async () => {
  const { d, storage } = deps(() => ({}));
  const url = new URL(await startGoogleSignIn(d, 'https://u.github.io/Krilliongame/'));
  assert.equal(url.origin + url.pathname, 'https://proj.supabase.co/auth/v1/authorize');
  assert.equal(url.searchParams.get('provider'), 'google');
  assert.equal(url.searchParams.get('redirect_to'), 'https://u.github.io/Krilliongame/');
  assert.equal(url.searchParams.get('code_challenge_method'), 's256');
  const verifier = storage.getItem(VERIFIER_KEY);
  assert.ok(verifier && verifier.length >= 43);
  assert.equal(url.searchParams.get('code_challenge'), await challengeFor(verifier, d.crypto));
});

test('oauthReturn ignores normal loads, reads codes and errors', () => {
  assert.equal(oauthReturn(''), null);
  assert.equal(oauthReturn('?foo=1'), null);
  assert.deepEqual(oauthReturn('?code=abc'), { code: 'abc' });
  assert.deepEqual(oauthReturn('?error=access_denied&error_description=User+denied'), { error: 'User denied' });
});

test('completing Google sign-in exchanges the code with the stored verifier and saves the session', async () => {
  const { d, calls, storage } = deps(() => ({ body: TOKENS }));
  storage.setItem(VERIFIER_KEY, 'my-verifier');
  const s = await completeGoogleSignIn(d, 'the-code');
  assert.equal(calls[0].url, 'https://proj.supabase.co/auth/v1/token?grant_type=pkce');
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { auth_code: 'the-code', code_verifier: 'my-verifier' });
  assert.equal(s.user.name, 'Rusty');
  assert.equal(s.user.provider, 'google');
  assert.equal(s.expiresAt, 1_000_000 + 3_600_000);
  assert.equal(storage.getItem(VERIFIER_KEY), null, 'verifier is single use');
  assert.equal(loadSession(storage)?.accessToken, 'acc');
});

test('completing Google sign-in without a verifier fails clearly and makes no request', async () => {
  const { d, calls } = deps(() => ({ body: TOKENS }));
  await assert.rejects(() => completeGoogleSignIn(d, 'code'), (e: AuthError) => e.code === 'missing_verifier');
  assert.equal(calls.length, 0);
});

test('credential validation', () => {
  assert.equal(validateCredentials('a@b.co', 'longenough'), null);
  assert.ok(validateCredentials('nope', 'longenough'));
  assert.ok(validateCredentials('a@b.co', 'short'));
  assert.ok(validateCredentials('a@b.co', 'x'.repeat(73)));
});

test('email sign-up returns a session when confirmation is off', async () => {
  const { d, calls, storage } = deps(() => ({ body: { ...TOKENS, user: { ...USER, app_metadata: { provider: 'email' } } } }));
  const r = await signUpWithEmail(d, ' a@b.co ', 'longenough', 'https://x/');
  assert.equal(r.status, 'signed-in');
  assert.ok(calls[0].url.startsWith('https://proj.supabase.co/auth/v1/signup?redirect_to='));
  assert.equal(JSON.parse(String(calls[0].init.body)).email, 'a@b.co');
  assert.ok(storage.getItem(SESSION_KEY));
});

test('email sign-up asks to confirm when the server returns no session', async () => {
  const { d, storage } = deps(() => ({ body: { id: 'u2', email: 'a@b.co' } }));
  const r = await signUpWithEmail(d, 'a@b.co', 'longenough', 'https://x/');
  assert.equal(r.status, 'confirm-email');
  assert.equal(storage.getItem(SESSION_KEY), null);
});

test('invalid input never reaches the network', async () => {
  const { d, calls } = deps(() => ({ body: TOKENS }));
  await assert.rejects(() => signUpWithEmail(d, 'bad', 'longenough', 'https://x/'), AuthError);
  await assert.rejects(() => signInWithEmail(d, 'a@b.co', 'short'), AuthError);
  assert.equal(calls.length, 0);
});

test('sign-in maps a wrong password to a friendly message', async () => {
  const { d } = deps(() => ({ status: 400, body: { error_code: 'invalid_credentials', msg: 'Invalid login credentials' } }));
  await assert.rejects(
    () => signInWithEmail(d, 'a@b.co', 'longenough'),
    (e: AuthError) => e.message === 'That email and password do not match.' && e.status === 400,
  );
});

test('network failures are reported without leaking internals', async () => {
  const { d } = deps(() => new TypeError('fetch failed'));
  await assert.rejects(() => signInWithEmail(d, 'a@b.co', 'longenough'), (e: AuthError) => e.code === 'network');
});

test('friendlyError covers common cases', () => {
  assert.match(friendlyError(422, { msg: 'User already registered' }).message, /already exists/);
  assert.match(friendlyError(400, { error_code: 'email_not_confirmed' }).message, /confirm your email/);
  assert.match(friendlyError(429, {}).message, /Too many/);
  assert.match(friendlyError(400, { msg: 'Unsupported provider: provider is not enabled' }).message, /not enabled/);
  assert.match(friendlyError(500, null).message, /Something went wrong/);
});

const SESSION: Session = { accessToken: 'old', refreshToken: 'ref', expiresAt: 2_000_000, user: { id: 'u1', email: null, name: null, avatarUrl: null, provider: 'email' } };

test('a fresh session is not refreshed', async () => {
  const { d, calls } = deps(() => ({ body: TOKENS }), 1_000_000);
  assert.equal(await refreshIfNeeded(d, SESSION), SESSION);
  assert.equal(calls.length, 0);
});

test('an expiring session is refreshed and stored', async () => {
  const { d, calls, storage } = deps(() => ({ body: { ...TOKENS, access_token: 'new' } }), 1_990_000);
  const s = await refreshIfNeeded(d, SESSION);
  assert.equal(s?.accessToken, 'new');
  assert.ok(calls[0].url.endsWith('grant_type=refresh_token'));
  assert.equal(loadSession(storage)?.accessToken, 'new');
});

test('a rejected refresh logs out, but a network blip does not', async () => {
  const bad = deps(() => ({ status: 400, body: { error_code: 'refresh_token_not_found' } }), 1_990_000);
  bad.storage.setItem(SESSION_KEY, JSON.stringify(SESSION));
  assert.equal(await refreshIfNeeded(bad.d, SESSION), null);
  assert.equal(bad.storage.getItem(SESSION_KEY), null);

  const offline = deps(() => new TypeError('offline'), 1_990_000);
  offline.storage.setItem(SESSION_KEY, JSON.stringify(SESSION));
  assert.equal(await refreshIfNeeded(offline.d, SESSION), SESSION);
  assert.ok(offline.storage.getItem(SESSION_KEY));
});

test('sign-out clears local state even if the server call fails', async () => {
  const { d, storage } = deps(() => new TypeError('offline'));
  storage.setItem(SESSION_KEY, JSON.stringify(SESSION));
  await signOut(d, SESSION);
  assert.equal(storage.getItem(SESSION_KEY), null);
});

test('loadSession rejects corrupt data', () => {
  const s = memoryStorage();
  s.setItem(SESSION_KEY, '{not json');
  assert.equal(loadSession(s), null);
  s.setItem(SESSION_KEY, JSON.stringify({ accessToken: 1 }));
  assert.equal(loadSession(s), null);
});

test('parseSession needs tokens and a user id', () => {
  assert.equal(parseSession({ access_token: 'a' }, 0), null);
  assert.equal(parseSession(null, 0), null);
  assert.ok(parseSession(TOKENS, 0));
});

test('cloud backup upload sends the player id, auth header and upsert preference', async () => {
  const { d, calls } = deps(() => ({ status: 201 }));
  const at = await uploadSave(d, SESSION, { lifetime: { runs: 3 } });
  const c = calls[0];
  assert.equal(c.url, 'https://proj.supabase.co/rest/v1/player_saves?on_conflict=user_id');
  const h = c.init.headers as Record<string, string>;
  assert.equal(h.Authorization, 'Bearer old');
  assert.equal(h.apikey, d.config.anonKey);
  assert.match(h.Prefer, /merge-duplicates/);
  const body = JSON.parse(String(c.init.body));
  assert.equal(body.user_id, 'u1');
  assert.deepEqual(body.data, { lifetime: { runs: 3 } });
  assert.equal(body.updated_at, at);
});

test('oversized saves are refused before upload', async () => {
  const { d, calls } = deps(() => ({}));
  await assert.rejects(() => uploadSave(d, SESSION, { blob: 'x'.repeat(500_000) }), (e: AuthError) => e.code === 'too_large');
  assert.equal(calls.length, 0);
});

test('download returns null when no backup exists and the row when it does', async () => {
  const none = deps(() => ({ body: [] }));
  assert.equal(await downloadSave(none.d, SESSION), null);
  const some = deps(() => ({ body: [{ data: { a: 1 }, updated_at: '2026-11-25T00:00:00Z' }] }));
  assert.deepEqual(await downloadSave(some.d, SESSION), { data: { a: 1 }, updatedAt: '2026-11-25T00:00:00Z' });
  assert.ok(some.calls[0].url.includes('user_id=eq.u1'));
});

test('delete targets only the signed-in player row', async () => {
  const { d, calls } = deps(() => ({ status: 204 }));
  await deleteCloudSave(d, SESSION);
  assert.equal(calls[0].init.method, 'DELETE');
  assert.ok(calls[0].url.endsWith('user_id=eq.u1'));
});

test('summarizeSave tolerates junk', () => {
  assert.deepEqual(summarizeSave(null), { runs: 0, points: 0, deepest: 0, achievements: 0 });
  assert.deepEqual(summarizeSave({ lifetime: { runs: 4, points: 90 }, deepestEver: 700, achievements: { a: 1, b: 2 } }), {
    runs: 4,
    points: 90,
    deepest: 700,
    achievements: 2,
  });
});

test('hashReturn ignores page routes and reads email-link tokens and errors', () => {
  assert.equal(hashReturn(''), null);
  assert.equal(hashReturn('#/home'), null);
  assert.equal(hashReturn('#/play/daily'), null);
  assert.deepEqual(hashReturn('#access_token=a&refresh_token=r&expires_in=600&type=recovery'), {
    kind: 'tokens',
    accessToken: 'a',
    refreshToken: 'r',
    expiresIn: 600,
    type: 'recovery',
  });
  assert.deepEqual(hashReturn('#error=access_denied&error_description=Email+link+is+invalid+or+has+expired'), {
    kind: 'error',
    message: 'Email link is invalid or has expired',
  });
  assert.equal(hashReturn('#access_token=a'), null);
});

test('completeFromHash looks the user up and stores the session', async () => {
  const { d, calls, storage } = deps(() => ({ body: USER }));
  const s = await completeFromHash(d, { kind: 'tokens', accessToken: 'a', refreshToken: 'r', expiresIn: 600, type: 'signup' });
  assert.equal(calls[0].url, 'https://proj.supabase.co/auth/v1/user');
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, 'Bearer a');
  assert.equal(s.user.id, 'u1');
  assert.equal(s.expiresAt, 1_000_000 + 600_000);
  assert.equal(loadSession(storage)?.refreshToken, 'r');
});

test('updatePassword validates first and then PUTs to the user endpoint', async () => {
  const { d, calls } = deps(() => ({ body: USER }));
  await assert.rejects(() => updatePassword(d, SESSION, 'short'), AuthError);
  assert.equal(calls.length, 0);
  await updatePassword(d, SESSION, 'a-long-password');
  assert.equal(calls[0].init.method, 'PUT');
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { password: 'a-long-password' });
});
