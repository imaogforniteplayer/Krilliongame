import { BIOMES, biomeAtDepth } from '../../game/biomes/biomes';
import { msUntilNextDaily } from '../../game/daily/challenge';
import { DISCOVERIES } from '../../game/discoveries/discoveries';
import { GAME_CONFIG } from '../../game/config';
import { formatMetres } from '../../game/scoring/scoring';
import { dailyAttemptState, levelFromXp, liveStreak, xpOf } from '../../game/storage';
import { Meter, Panel, Stat } from '../components/Panel';
import { navigate } from '../router';
import { useDailyKey, useNow, useSave } from '../store';

function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':');
}

export function Home() {
  const { save } = useSave();
  const key = useDailyKey();
  const now = useNow(1000);
  const state = dailyAttemptState(save, key);
  const today = save.dailyResults[key];
  const streak = liveStreak(save, key);
  const lvl = levelFromXp(xpOf(save));
  const found = Object.keys(save.collection).length;
  const recent = Object.values(save.dailyResults)
    .sort((a, b) => b.finishedAt - a.finishedAt)
    .slice(0, 4);

  return (
    <div className="page">
      <Panel className="daily-card">
        <h1 className="title">Daily Dig</h1>
        <p className="muted">
          {GAME_CONFIG.questionsPerRun} questions · {GAME_CONFIG.secondsPerQuestion}s each · one ranked attempt a day · {key}
        </p>
        {state === 'done' && today ? (
          <>
            <p className="daily-card__big">
              {today.points} pts · {formatMetres(today.depth)}
            </p>
            <div className="btn-row">
              <button type="button" className="btn btn--primary" onClick={() => navigate(`results/daily/${key}`)}>
                View results
              </button>
              <button type="button" className="btn" onClick={() => navigate('play/endless')}>
                Endless Dig
              </button>
            </div>
            <p className="muted">Next Daily Dig in {countdown(msUntilNextDaily(new Date(now)))}</p>
          </>
        ) : (
          <div className="btn-row">
            <button type="button" className="btn btn--primary btn--big" onClick={() => navigate('play/daily')}>
              {state === 'in-progress' ? 'Resume dig' : 'Begin descent'}
            </button>
          </div>
        )}
        {state === 'in-progress' ? (
          <p className="muted">The clock keeps running while you are away, as it does for everyone.</p>
        ) : null}
      </Panel>

      <div className="grid">
        <Panel title="Progress">
          <div className="stats">
            <Stat label="Day streak" value={streak} />
            <Stat label="Total depth" value={formatMetres(save.lifetime.depth)} />
            <Stat label="Level" value={lvl.level} />
            <Stat label="Deepest ever" value={formatMetres(save.deepestEver)} hint={biomeAtDepth(save.deepestEver).name} />
          </div>
          <Meter value={lvl.into} max={lvl.needed} label="Level progress" />
          <p className="muted">
            {lvl.into}/{lvl.needed} XP to level {lvl.level + 1}
          </p>
        </Panel>

        <Panel title="Museum">
          <Stat label="Discoveries" value={`${found}/${DISCOVERIES.length}`} hint={`${Math.round((found / DISCOVERIES.length) * 100)}% complete`} />
          <Meter value={found} max={DISCOVERIES.length} label="Collection progress" />
          <div className="btn-row">
            <button type="button" className="btn btn--small" onClick={() => navigate('museum')}>
              Open museum
            </button>
            <button type="button" className="btn btn--small" onClick={() => navigate('biomes')}>
              Biome map ({BIOMES.filter((b) => Math.max(save.deepestEver, save.survivalBest.depth) >= b.startDepth).length}/{BIOMES.length})
            </button>
          </div>
        </Panel>

        <Panel title="More ways to dig">
          <p className="muted">Endless, Survival, themed packs and Friend Challenges. Your ranked daily is never affected.</p>
          <div className="btn-row">
            <button type="button" className="btn btn--small" onClick={() => navigate('modes')}>
              All modes
            </button>
            <button type="button" className="btn btn--small" onClick={() => navigate('play/endless')}>
              Endless Dig
            </button>
            <button type="button" className="btn btn--small" onClick={() => navigate('journal')}>
              Journal
            </button>
            <button type="button" className="btn btn--small" onClick={() => navigate('garage')}>
              Garage
            </button>
          </div>
        </Panel>

        <Panel title="Recent daily digs">
          {recent.length === 0 ? (
            <p className="muted">Finish your first Daily Dig to see it here.</p>
          ) : (
            <ul className="list">
              {recent.map((r) => (
                <li key={r.id}>
                  <a href={`#/results/daily/${r.key}`}>
                    {r.key}: {r.points} pts · {formatMetres(r.depth)}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Leaderboards & friends">
          <p className="muted">Global, friends and weekly boards need the online backend. They are not connected in demo mode, so nothing is shown rather than fake players.</p>
          <button type="button" className="btn btn--small" onClick={() => navigate('soon')}>
            See what's planned
          </button>
        </Panel>
      </div>
    </div>
  );
}
