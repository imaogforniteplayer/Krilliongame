import { useEffect, useMemo, useRef, useState } from 'react';
import { biomeAtDepth } from '../../game/biomes/biomes';
import { msUntilNextDaily } from '../../game/daily/challenge';
import { EQUIPMENT_BY_TIER } from '../../game/digging/equipment';
import { getDiscovery } from '../../game/discoveries/discoveries';
import { getQuestion } from '../../game/questions';
import { computeRarity } from '../../game/rarity/rarity';
import { formatMetres, maxRunDepth, maxRunPoints } from '../../game/scoring/scoring';
import { summarizeRun } from '../../game/session';
import type { AnswerRecord, RunMode, RunState } from '../../game/session';
import { levelFromXp, xpOf } from '../../game/storage';
import { TIER_COLORS } from '../../game/tiers';
import type { EquipmentId } from '../../game/types';
import { Meter, Panel, Stat } from '../components/Panel';
import { TierBadge } from '../components/TierBadge';
import { discoveryIconUrl } from '../icons';
import { navigate } from '../router';
import { copyText, downloadCard, nativeShare, renderShareCard, shareText } from '../share';
import { useNow, useSave } from '../store';

const EQUIPMENT_NAME: Record<EquipmentId, string> = Object.fromEntries(
  Object.values(EQUIPMENT_BY_TIER).map((e) => [e.id, e.name]),
) as Record<EquipmentId, string>;

function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

function ShareCard({ run }: { run: RunState }) {
  const holder = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const card = renderShareCard(run);
    card.className = 'share-card';
    card.setAttribute('aria-label', 'Shareable result card');
    el.replaceChildren(card);
  }, [run]);
  return <div ref={holder} className="share-card-box" />;
}

function AnswerRow({ index, a }: { index: number; a: AnswerRecord }) {
  const q = getQuestion(a.questionId);
  const others = useMemo(() => {
    if (!q) return [];
    return [...q.entries]
      .filter((e) => e.id !== a.entryId)
      .map((e) => ({ e, r: computeRarity(e) }))
      .sort((x, y) => x.r.share - y.r.share)
      .slice(0, 6);
  }, [q, a.entryId]);

  const exclusion = q?.exclusions.find((x) => a.status === 'excluded' && a.message === x.reason);
  return (
    <li className="answer">
      <details>
        <summary>
          <span className="answer__n">{index + 1}</span>
          <span className="answer__main">
            <span className="answer__q">{q?.text ?? a.questionId}</span>
            <span className="answer__a">
              {a.status === 'accepted' ? a.canonical : a.status === 'timeout' ? "Time's up" : a.typed ? `"${a.typed}"` : 'No answer'}
            </span>
          </span>
          <span className="answer__score">
            {a.tier ? <TierBadge tier={a.tier} /> : <span className="chip chip--miss">{a.status}</span>}
            <b>{a.points}</b> pts
          </span>
        </summary>
        <div className="answer__body">
          {a.status === 'accepted' && a.tier ? (
            <p>
              Estimated rarity: about 1 in {Math.max(2, Math.round(1 / (a.share ?? 0.1))).toLocaleString('en-US')} players. That powered the{' '}
              <b>{a.equipment ? EQUIPMENT_NAME[a.equipment] : ''}</b> for {formatMetres(a.metres)}.
            </p>
          ) : (
            <p>{exclusion?.reason ?? a.message}</p>
          )}
          {q ? <p className="answer__why">{q.explanation}</p> : null}
          {others.length > 0 ? (
            <div>
              <p className="answer__label">Other answers that count:</p>
              <ul className="chips">
                {others.map(({ e, r }) => (
                  <li key={e.id} className="chip" style={{ borderColor: TIER_COLORS[r.tier], color: TIER_COLORS[r.tier] }}>
                    {e.canonical}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {q ? <p className="answer__verify">Verification note: {q.verification}</p> : null}
        </div>
      </details>
    </li>
  );
}

export function Results({
  run,
  mode,
  personalBest = false,
  levelUp = false,
  alreadyPlayed = false,
  onAgain,
}: {
  run: RunState;
  mode: RunMode;
  personalBest?: boolean;
  levelUp?: boolean;
  alreadyPlayed?: boolean;
  onAgain?: () => void;
}) {
  const { save } = useSave();
  const now = useNow(1000);
  const [copied, setCopied] = useState('');
  const summary = useMemo(() => summarizeRun(run), [run]);
  const biome = biomeAtDepth(run.depth);
  const lvl = levelFromXp(xpOf(save));
  const found = summary.discoveryIds.map((id) => getDiscovery(id)).filter((d): d is NonNullable<typeof d> => !!d);
  const url = typeof window === 'undefined' ? '' : window.location.origin + window.location.pathname;

  async function copy() {
    const ok = await copyText(shareText(run, url));
    setCopied(ok ? 'Copied to clipboard!' : 'Could not copy on this device.');
    window.setTimeout(() => setCopied(''), 2500);
  }

  return (
    <div className="page results">
      <header className="results__head">
        <h1 className="title">{mode === 'daily' ? 'Daily Dig complete' : 'Run complete'}</h1>
        {alreadyPlayed ? (
          <p className="notice">Your ranked Daily Dig for {run.key} is already done. Next one in {countdown(msUntilNextDaily(new Date(now)))}.</p>
        ) : null}
        {personalBest ? <p className="notice notice--good">New personal best!</p> : null}
        {levelUp ? <p className="notice notice--good">Level up! You are now level {lvl.level}.</p> : null}
      </header>

      <div className="results__grid">
        <Panel title="Your dig">
          <div className="stats">
            <Stat label="Total score" value={`${run.points}`} hint={`of ${maxRunPoints()}`} />
            <Stat label="Final depth" value={formatMetres(run.depth)} hint={`of ${formatMetres(maxRunDepth())}`} />
            <Stat label="Final biome" value={biome.name} />
            <Stat label="Personal best" value={`${save.personalBest.points} pts`} hint={formatMetres(save.personalBest.depth)} />
          </div>
          <div className="results__rows">
            <p>
              <b>Best answer:</b>{' '}
              {summary.best ? (
                <>
                  {summary.best.canonical} <TierBadge tier={summary.best.tier ?? 'pebble'} /> {summary.best.points} pts
                </>
              ) : (
                'None this run'
              )}
            </p>
            <p>
              <b>Rarest answer:</b>{' '}
              {summary.rarest ? (
                <>
                  {summary.rarest.canonical} <TierBadge tier={summary.rarest.tier ?? 'pebble'} />
                </>
              ) : (
                'None this run'
              )}
            </p>
            <p>
              <b>Equipment used:</b>{' '}
              {summary.equipmentUsed.length > 0 ? summary.equipmentUsed.map((e) => EQUIPMENT_NAME[e]).join(', ') : 'None'}
            </p>
            <p>
              <b>Leaderboard:</b> <span className="muted">needs the online backend (not connected in demo mode)</span>
            </p>
          </div>
          <p className="results__lvl">
            Level {lvl.level} · {lvl.into}/{lvl.needed} XP to next level
          </p>
          <Meter value={lvl.into} max={lvl.needed} label="Level progress" />
        </Panel>

        <Panel title="Share">
          <ShareCard run={run} />
          <div className="btn-row">
            <button type="button" className="btn btn--primary" onClick={copy}>
              Copy result
            </button>
            <button type="button" className="btn" onClick={() => downloadCard(run)}>
              Download card
            </button>
            {typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? (
              <button type="button" className="btn" onClick={() => void nativeShare(run, url)}>
                Share...
              </button>
            ) : null}
          </div>
          <p className="muted" role="status">
            {copied || 'The card and text show rarity colours only, never your answers.'}
          </p>
        </Panel>
      </div>

      {found.length > 0 ? (
        <Panel title={`Discoveries (${found.length})`}>
          <ul className="finds">
            {found.map((d, i) => (
              <li key={`${d.id}-${i}`} className="find" style={{ ['--tier' as string]: TIER_COLORS[d.rarity] }}>
                <img className="pixel-img find__icon" src={discoveryIconUrl(d)} alt="" />
                <span>{d.name}</span>
                <TierBadge tier={d.rarity} />
              </li>
            ))}
          </ul>
          <p className="muted">Saved to your Museum collection.</p>
        </Panel>
      ) : null}

      <Panel title="Answer breakdown">
        <p className="muted">Tap a row for the explanation and other answers that would have counted.</p>
        <ol className="answers">
          {run.answers.map((a, i) => (
            <AnswerRow key={a.questionId + i} index={i} a={a} />
          ))}
        </ol>
      </Panel>

      <div className="btn-row btn-row--center">
        {onAgain ? (
          <button type="button" className="btn btn--primary" onClick={onAgain}>
            Dig again
          </button>
        ) : null}
        {mode === 'daily' ? (
          <>
            <button type="button" className="btn" onClick={() => navigate('play/endless')}>
              Endless Dig
            </button>
            <button type="button" className="btn" onClick={() => navigate('play/practice')}>
              Practice
            </button>
          </>
        ) : null}
        <button type="button" className="btn btn--ghost" onClick={() => navigate('home')}>
          Home
        </button>
      </div>
    </div>
  );
}
