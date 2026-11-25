import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AuthError,
  clearSession,
  completeFromHash,
  completeGoogleSignIn,
  hashReturn,
  loadSession,
  oauthReturn,
  readConfig,
  redirectTarget,
  refreshIfNeeded,
  sendPasswordReset,
  signInWithEmail,
  signOut as signOutRequest,
  signUpWithEmail,
  startGoogleSignIn,
  updatePassword,
} from '../auth/client';
import type { AuthDeps, KeyValueStorage, Session, SignUpResult } from '../auth/client';

/** localStorage that never throws (private windows, blocked site data). */
function safeStorage(): KeyValueStorage {
  const memory = new Map<string, string>();
  return {
    getItem(k) {
      try {
        return window.localStorage.getItem(k);
      } catch {
        return memory.get(k) ?? null;
      }
    },
    setItem(k, v) {
      try {
        window.localStorage.setItem(k, v);
      } catch {
        memory.set(k, v);
      }
    },
    removeItem(k) {
      try {
        window.localStorage.removeItem(k);
      } catch {
        memory.delete(k);
      }
    },
  };
}

export interface AuthContextValue {
  /** False until a Supabase project is configured. The Account page then explains how, instead of faking a login. */
  configured: boolean;
  /** True while the first session check or a Google round trip is in progress. */
  loading: boolean;
  session: Session | null;
  /** A message from an email link or Google round trip that needs showing on the Account page. */
  notice: { tone: 'good' | 'bad'; text: string } | null;
  /** True right after the player opened a password-reset email link. */
  recovering: boolean;
  clearNotice: () => void;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  setNewPassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** A session guaranteed fresh enough for an API call, or null if the player is signed out. */
  freshSession: () => Promise<Session | null>;
  /** Raw dependencies for cloud calls (upload / download). Null when not configured. */
  deps: AuthDeps | null;
}

const Ctx = createContext<AuthContextValue | null>(null);

// The OAuth code and verifier are single use; React may run effects twice in development.
let handledReturn = false;

export function AuthProvider({ children }: { children: ReactNode }) {
  const config = useMemo(() => readConfig(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY), []);
  const deps = useMemo<AuthDeps | null>(
    () =>
      config
        ? { config, fetch: window.fetch.bind(window), storage: safeStorage(), crypto: window.crypto as AuthDeps['crypto'], now: () => Date.now() }
        : null,
    [config],
  );

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(config));
  const [notice, setNotice] = useState<AuthContextValue['notice']>(null);
  const [recovering, setRecovering] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;

  useEffect(() => {
    if (!deps) return;
    let cancelled = false;
    (async () => {
      try {
        const search = oauthReturn(window.location.search);
        const hash = hashReturn(window.location.hash);
        if (!handledReturn && (search || hash)) {
          handledReturn = true;
          // Remove codes and tokens from the address bar straight away so they are never bookmarked or shared.
          window.history.replaceState(null, '', `${window.location.pathname}#/account`);
          // replaceState does not fire hashchange, so tell the router to show the Account page.
          window.dispatchEvent(new HashChangeEvent('hashchange'));
          try {
            if (search?.code) {
              const s = await completeGoogleSignIn(deps, search.code);
              if (!cancelled) {
                setSession(s);
                setNotice({ tone: 'good', text: `Signed in with Google as ${s.user.name ?? s.user.email ?? 'a new miner'}.` });
              }
              return;
            }
            if (search?.error) throw new AuthError(`Google sign-in was not completed: ${search.error}`, 'oauth_error');
            if (hash?.kind === 'error') throw new AuthError(hash.message, 'link_error');
            if (hash?.kind === 'tokens') {
              const s = await completeFromHash(deps, hash);
              if (!cancelled) {
                setSession(s);
                if (hash.type === 'recovery') setRecovering(true);
                else setNotice({ tone: 'good', text: 'Email confirmed. You are signed in.' });
              }
              return;
            }
          } catch (e) {
            if (!cancelled) setNotice({ tone: 'bad', text: e instanceof Error ? e.message : 'Sign-in failed. Please try again.' });
            return;
          }
        }
        const stored = loadSession(deps.storage);
        if (stored) {
          const fresh = await refreshIfNeeded(deps, stored);
          if (!cancelled) setSession(fresh);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deps]);

  // Keep the session fresh while the tab is open and when the player comes back to it.
  useEffect(() => {
    if (!deps) return;
    const tick = async () => {
      const cur = sessionRef.current;
      if (!cur) return;
      const next = await refreshIfNeeded(deps, cur, 5 * 60_000);
      if (next !== cur) setSession(next);
    };
    const id = window.setInterval(tick, 4 * 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [deps]);

  const need = (): AuthDeps => {
    if (!deps) throw new AuthError('Accounts are not connected on this copy of the game yet.', 'not_configured');
    return deps;
  };

  const value: AuthContextValue = {
    configured: Boolean(deps),
    loading,
    session,
    notice,
    recovering,
    clearNotice: useCallback(() => setNotice(null), []),
    async signInWithGoogle() {
      const d = need();
      const url = await startGoogleSignIn(d, redirectTarget(window.location.origin, import.meta.env.BASE_URL));
      window.location.assign(url);
    },
    async signUp(email, password) {
      const d = need();
      const r = await signUpWithEmail(d, email, password, redirectTarget(window.location.origin, import.meta.env.BASE_URL));
      if (r.status === 'signed-in') setSession(r.session);
      return r;
    },
    async signIn(email, password) {
      setSession(await signInWithEmail(need(), email, password));
    },
    async resetPassword(email) {
      await sendPasswordReset(need(), email, redirectTarget(window.location.origin, import.meta.env.BASE_URL));
    },
    async setNewPassword(password) {
      const cur = sessionRef.current;
      if (!cur) throw new AuthError('Please sign in again first.', 'no_session');
      await updatePassword(need(), cur, password);
      setRecovering(false);
      setNotice({ tone: 'good', text: 'Password updated.' });
    },
    async signOut() {
      const cur = sessionRef.current;
      setSession(null);
      setRecovering(false);
      if (deps) await signOutRequest(deps, cur);
      else clearSession(safeStorage());
    },
    async freshSession() {
      const cur = sessionRef.current;
      if (!cur || !deps) return null;
      const next = await refreshIfNeeded(deps, cur);
      if (next !== cur) setSession(next);
      return next;
    },
    deps,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}

export function displayName(s: Session | null): string | null {
  if (!s) return null;
  return s.user.name ?? s.user.email?.split('@')[0] ?? null;
}
