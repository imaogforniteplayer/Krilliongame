import { formatMetres } from '../../game/scoring/scoring';
import { levelFromXp, xpOf } from '../../game/storage';
import { TIER_COLORS, TIER_NAMES } from '../../game/tiers';
import { TIER_ORDER } from '../../game/types';
import { Panel, Stat } from '../components/Panel';
import { useSave } from '../store';

export function Stats() {
  const { save } = useSave();
  const lvl = levelFromXp(xpOf(save));
  const totalTiers = TIER_ORDER.reduce((n, t) => n + save.tierTotals[t], 0);
  const runs = Object.values(save.dailyResults).sort((a, b) => b.finishedAt - a.finishedAt);
  const accuracy = save.lifetime.answers ? Math.round((save.lifetime.accepted / save.lifetime.answers) * 100) : 0;

  return (
    <div className="page">
      <h1 className="title">Your stats</h1>
      <p className="muted">Stored on this device. Global comparisons need the online backend.</p>
      <Panel title="Lifetime">
        <div className="stats">
          <Stat label="Level" value={lvl.level} />
          <Stat label="Runs" value={save.lifetime.runs} />
          <Stat label="Total depth" value={formatMetres(save.lifetime.depth)} />
          <Stat label="Total points" value={save.lifetime.points} />
          <Stat label="Answer rate" value={`${accuracy}%`} hint="answers accepted" />
          <Stat label="Best streak" value={save.streak.best} />
          <Stat label="Best run" value={`${save.personalBest.points} pts`} hint={formatMetres(save.personalBest.depth)} />
          <Stat label="Deepest ever" value={formatMetres(save.deepestEver)} />
        </div>
      </Panel>

      <Panel title="Rarity breakdown">
        {totalTiers === 0 ? (
          <p className="muted">Land some answers to see how rare they were.</p>
        ) : (
          <ul className="bars">
            {TIER_ORDER.map((t) => (
              <li key={t}>
                <span className="bars__label">{TIER_NAMES[t]}</span>
                <span className="bars__track">
                  <i style={{ width: `${(save.tierTotals[t] / totalTiers) * 100}%`, background: TIER_COLORS[t] }} />
                </span>
                <b>{save.tierTotals[t]}</b>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Daily Dig history">
        {runs.length === 0 ? (
          <p className="muted">No finished Daily Digs yet.</p>
        ) : (
          <ul className="list">
            {runs.slice(0, 30).map((r) => (
              <li key={r.id}>
                <a href={`#/results/daily/${r.key}`}>
                  {r.key}: {r.points} pts · {formatMetres(r.depth)}
                </a>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
