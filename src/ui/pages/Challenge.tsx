import { useState } from 'react';
import type { FormEvent } from 'react';
import { compareResults, decodeResult, encodeResult, makeChallengeCode, parseChallengeCode } from '../../game/challenge/code';
import { Panel } from '../components/Panel';
import { navigate } from '../router';
import { copyText } from '../share';
import { useSave } from '../store';

function inviteLink(code: string): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}${window.location.pathname}#/play/challenge/${code}`;
}

/** Start a new challenge or join a friend's. Everyone who plays the same code gets the same seven questions. */
export function ChallengeLauncher() {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  function create() {
    navigate(`play/challenge/${makeChallengeCode()}`);
  }

  function join(e: FormEvent) {
    e.preventDefault();
    const code = parseChallengeCode(text);
    if (!code) {
      setError('That is not a challenge code. They look like DEEP-AB23CD.');
      return;
    }
    navigate(`play/challenge/${code}`);
  }

  return (
    <Panel title="Friend Challenge">
      <p className="muted">
        Make a code, send it to a friend, and you both dig through the same seven questions. Then swap result codes to see who went deeper.
        Each code can be played once on a device.
      </p>
      <div className="btn-row">
        <button type="button" className="btn btn--primary" onClick={create}>
          Create a challenge
        </button>
      </div>
      <form className="ask__row" onSubmit={join}>
        <input
          className="ask__input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError('');
          }}
          placeholder="Enter a code, e.g. DEEP-AB23CD"
          aria-label="Challenge code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={20}
        />
        <button type="submit" className="btn">
          Join
        </button>
      </form>
      {error ? <p className="notice" role="alert">{error}</p> : null}
      <p className="muted">
        Results are swapped by hand and not checked by a server, so treat them as friendly bragging rights. Online verified duels need the backend.
      </p>
    </Panel>
  );
}

/** Shown after finishing a challenge (and when reopening one that is already done). */
export function ChallengePanel({ code, points, depth }: { code: string; points: number; depth: number }) {
  const [theirs, setTheirs] = useState('');
  const [copied, setCopied] = useState('');
  const mine = { code, points, depth };
  const myCode = encodeResult(mine);
  const decoded = theirs.trim() ? decodeResult(theirs) : null;
  const sameChallenge = decoded?.code === code;

  async function copy(label: string, value: string) {
    const ok = await copyText(value);
    setCopied(ok ? `${label} copied!` : 'Could not copy on this device.');
    window.setTimeout(() => setCopied(''), 2500);
  }

  let verdict = '';
  if (decoded && sameChallenge) {
    const v = compareResults(mine, decoded);
    verdict =
      v === 'tie'
        ? `A tie! You both scored ${points} pts.`
        : v === 'you'
          ? `You win: ${points} pts against ${decoded.points} pts.`
          : `Your friend wins: ${decoded.points} pts against your ${points} pts.`;
  }

  return (
    <Panel title={`Challenge ${code}`}>
      <p>
        You scored <b>{points} pts</b> and dug <b>{depth.toLocaleString('en-US')} m</b>.
      </p>
      <div className="btn-row">
        <button type="button" className="btn" onClick={() => void copy('Invite link', inviteLink(code))}>
          Copy invite link
        </button>
        <button type="button" className="btn btn--primary" onClick={() => void copy('Result code', myCode)}>
          Copy my result code
        </button>
      </div>
      <p className="muted">
        Your result code: <code>{myCode}</code>
      </p>
      <label className="field">
        <span>Paste your friend's result code to compare</span>
        <input
          className="ask__input"
          value={theirs}
          onChange={(e) => setTheirs(e.target.value)}
          placeholder="DEEP-AB23CD.430.4300.7F"
          aria-label="Friend's result code"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      {theirs.trim() && !decoded ? <p className="notice" role="alert">That result code does not look right. Check for typos.</p> : null}
      {decoded && !sameChallenge ? <p className="notice" role="alert">That result is from a different challenge ({decoded.code}).</p> : null}
      {verdict ? <p className="notice notice--good" role="status">{verdict}</p> : null}
      <p className="muted" role="status">
        {copied || 'Result codes are self-reported: they catch typos, not cheating.'}
      </p>
    </Panel>
  );
}

/** Reopening a challenge that was already played on this device. */
export function ChallengeDone({ code }: { code: string }) {
  const { save } = useSave();
  const rec = code ? save.challenges[code] : undefined;
  return (
    <div className="page">
      <h1 className="title">Challenge</h1>
      {rec ? (
        <>
          <p className="notice">You already played this challenge on this device. Each code can be played once.</p>
          <ChallengePanel code={rec.code} points={rec.points} depth={rec.depth} />
        </>
      ) : (
        <p className="notice">No challenge code was given.</p>
      )}
      <div className="btn-row">
        <button type="button" className="btn" onClick={() => navigate('modes')}>
          Back to modes
        </button>
      </div>
    </div>
  );
}
