import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { deleteCloudSave, downloadSave, summarizeSave, uploadSave } from '../../auth/client';
import type { CloudSave } from '../../auth/client';
import { migrate } from '../../game/storage';
import { Panel } from '../components/Panel';
import { displayName, useAuth } from '../auth';
import { useSave } from '../store';

type Mode = 'create' | 'signin' | 'reset';

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong. Please try again.';
}

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'unknown time' : d.toLocaleString();
}

function SummaryLine({ label, s }: { label: string; s: ReturnType<typeof summarizeSave> }) {
  return (
    <p>
      <strong>{label}:</strong> {s.runs} digs, {s.points.toLocaleString('en-US')} points, deepest {s.deepest.toLocaleString('en-US')} m,{' '}
      {s.achievements} achievements
    </p>
  );
}

function NotConnected() {
  return (
    <Panel title="Accounts are not connected yet">
      <p>
        Google sign-in and account creation are built into DEEPER, but this copy of the game is not linked to an account server, so the buttons below are switched
        off rather than pretending to work.
      </p>
      <p className="muted">
        To switch them on, the game's owner creates a free Supabase project, turns on its Google provider, and adds the project URL and public key to the build.
        The steps are in <code>docs/AUTH.md</code> in the repository.
      </p>
      <div className="btn-row">
        <button type="button" className="btn btn--primary" disabled>
          Continue with Google (not connected)
        </button>
        <button type="button" className="btn" disabled>
          Create account (not connected)
        </button>
      </div>
      <p className="muted">Everything else in DEEPER keeps working without an account. Your progress is saved on this device.</p>
    </Panel>
  );
}

function SignedOut() {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>('create');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function google() {
    setBusy(true);
    setError(null);
    try {
      await auth.signInWithGoogle();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === 'create') {
        const r = await auth.signUp(email, password);
        if (r.status === 'confirm-email') {
          setInfo('Account created. We sent a confirmation link to your email. Click it and you will be signed in.');
          setPassword('');
        }
      } else if (mode === 'signin') {
        await auth.signIn(email, password);
      } else {
        await auth.resetPassword(email);
        setInfo('If an account exists for that email, a reset link is on its way.');
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Sign in or create an account">
      <p>An account lets you back up your progress and bring it to another device. You can always keep playing as a guest.</p>
      <div className="btn-row">
        <button type="button" className="btn btn--primary btn--big" onClick={google} disabled={busy}>
          Continue with Google
        </button>
      </div>
      <p className="muted">Google sign-in creates your DEEPER account the first time you use it. We only receive your name, email and profile picture.</p>

      <p className="divider" role="separator">
        or use an email address
      </p>

      <div className="btn-row" role="group" aria-label="Email options">
        <button type="button" className={`btn btn--small${mode === 'create' ? ' btn--primary' : ''}`} aria-pressed={mode === 'create'} onClick={() => setMode('create')}>
          Create account
        </button>
        <button type="button" className={`btn btn--small${mode === 'signin' ? ' btn--primary' : ''}`} aria-pressed={mode === 'signin'} onClick={() => setMode('signin')}>
          Sign in
        </button>
      </div>

      <form className="authform" onSubmit={submit} noValidate>
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        {mode !== 'reset' ? (
          <label className="field">
            <span>Password {mode === 'create' ? '(at least 8 characters)' : ''}</span>
            <input
              type="password"
              autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
        ) : null}
        <div className="btn-row">
          <button type="submit" className="btn" disabled={busy}>
            {mode === 'create' ? 'Create account' : mode === 'signin' ? 'Sign in' : 'Send reset link'}
          </button>
          {mode === 'signin' ? (
            <button type="button" className="btn btn--ghost btn--small" onClick={() => setMode('reset')}>
              Forgot password?
            </button>
          ) : null}
          {mode === 'reset' ? (
            <button type="button" className="btn btn--ghost btn--small" onClick={() => setMode('signin')}>
              Back to sign in
            </button>
          ) : null}
        </div>
      </form>

      {error ? (
        <p className="notice notice--bad" role="alert">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="notice notice--good" role="status">
          {info}
        </p>
      ) : null}
    </Panel>
  );
}

function NewPassword() {
  const auth = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await auth.setNewPassword(password);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <Panel title="Choose a new password">
      <form className="authform" onSubmit={submit} noValidate>
        <label className="field">
          <span>New password (at least 8 characters)</span>
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <div className="btn-row">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            Save password
          </button>
        </div>
      </form>
      {error ? (
        <p className="notice notice--bad" role="alert">
          {error}
        </p>
      ) : null}
    </Panel>
  );
}

type Pending = null | 'backup' | 'restore' | 'delete';

function CloudBackup() {
  const auth = useAuth();
  const { save, update } = useSave();
  const [cloud, setCloud] = useState<CloudSave | null | 'unknown'>('unknown');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const s = await auth.freshSession();
      if (!s || !auth.deps) return;
      setCloud(await downloadSave(auth.deps, s));
    } catch (e) {
      setCloud('unknown');
      setMessage({ tone: 'bad', text: `Could not check your cloud backup. ${errorText(e)}` });
    } finally {
      setBusy(false);
    }
  }, [auth]);

  useEffect(() => {
    void refresh();
    // Only on first show; later changes come from the buttons below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(kind: Exclude<Pending, null>) {
    setBusy(true);
    setPending(null);
    setMessage(null);
    try {
      const s = await auth.freshSession();
      if (!s || !auth.deps) throw new Error('Please sign in again.');
      if (kind === 'backup') {
        const at = await uploadSave(auth.deps, s, { ...save, activeRun: null });
        setCloud({ data: { ...save, activeRun: null }, updatedAt: at });
        setMessage({ tone: 'good', text: 'Backed up. This device is now saved to your account.' });
      } else if (kind === 'restore') {
        if (cloud === 'unknown' || cloud === null) return;
        update(() => migrate(cloud.data));
        setMessage({ tone: 'good', text: 'Restored. This device now has the progress from your account.' });
      } else {
        await deleteCloudSave(auth.deps, s);
        setCloud(null);
        setMessage({ tone: 'good', text: 'Your cloud backup was deleted. Progress on this device is untouched.' });
      }
    } catch (e) {
      setMessage({ tone: 'bad', text: errorText(e) });
    } finally {
      setBusy(false);
    }
  }

  const local = summarizeSave(save);
  const remote = cloud !== 'unknown' && cloud ? summarizeSave(cloud.data) : null;

  return (
    <Panel title="Cloud backup">
      <p>
        Back up your progress to your account, and restore it on another device. Nothing is copied automatically: you choose each time, so one device can never
        silently overwrite another.
      </p>
      <SummaryLine label="This device" s={local} />
      {cloud === 'unknown' ? (
        <p className="muted">{busy ? 'Checking your account...' : 'Could not read your cloud backup.'}</p>
      ) : remote && cloud ? (
        <>
          <SummaryLine label={`Your account (saved ${when(cloud.updatedAt)})`} s={remote} />
        </>
      ) : (
        <p className="muted">Your account has no backup yet.</p>
      )}

      {pending === null ? (
        <div className="btn-row">
          <button type="button" className="btn btn--primary" disabled={busy} onClick={() => (cloud && cloud !== 'unknown' ? setPending('backup') : void run('backup'))}>
            Back up this device
          </button>
          <button type="button" className="btn" disabled={busy || !cloud || cloud === 'unknown'} onClick={() => setPending('restore')}>
            Restore to this device
          </button>
          <button type="button" className="btn btn--ghost" disabled={busy || !cloud || cloud === 'unknown'} onClick={() => setPending('delete')}>
            Delete cloud backup
          </button>
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
      ) : (
        <div className="notice" role="alert">
          <p>
            {pending === 'backup'
              ? 'This replaces the backup in your account with the progress on this device.'
              : pending === 'restore'
                ? 'This replaces the progress on this device with your account backup. Export this device first in Settings if you want a copy.'
                : 'This permanently deletes the backup in your account. Progress on this device is not affected.'}
          </p>
          <div className="btn-row">
            <button type="button" className="btn btn--danger" disabled={busy} onClick={() => void run(pending)}>
              {pending === 'backup' ? 'Yes, replace the backup' : pending === 'restore' ? 'Yes, replace this device' : 'Yes, delete it'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {message ? (
        <p className={`notice notice--${message.tone}`} role={message.tone === 'bad' ? 'alert' : 'status'}>
          {message.text}
        </p>
      ) : null}
      <p className="muted">Backups are private to you. They are for convenience only and never affect scoring or any future leaderboard.</p>
    </Panel>
  );
}

export function Account() {
  const auth = useAuth();
  const name = displayName(auth.session);

  return (
    <div className="page">
      <h1 className="title">Account</h1>

      {auth.notice ? (
        <p className={`notice notice--${auth.notice.tone}`} role={auth.notice.tone === 'bad' ? 'alert' : 'status'}>
          {auth.notice.text}{' '}
          <button type="button" className="btn btn--small btn--ghost" onClick={auth.clearNotice}>
            Dismiss
          </button>
        </p>
      ) : null}

      {!auth.configured ? (
        <NotConnected />
      ) : auth.loading ? (
        <p className="muted">Checking your sign-in...</p>
      ) : !auth.session ? (
        <SignedOut />
      ) : (
        <>
          {auth.recovering ? <NewPassword /> : null}
          <Panel title="You are signed in">
            <p>
              <strong>{name}</strong>
              {auth.session.user.email ? <span className="muted"> ({auth.session.user.email})</span> : null}
            </p>
            <p className="muted">Signed in with {auth.session.user.provider === 'google' ? 'Google' : 'email and password'}.</p>
            <div className="btn-row">
              <button type="button" className="btn" onClick={() => void auth.signOut()}>
                Sign out
              </button>
            </div>
          </Panel>
          <CloudBackup />
        </>
      )}
    </div>
  );
}
