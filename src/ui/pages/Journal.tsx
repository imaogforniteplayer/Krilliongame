import { useMemo, useState } from 'react';
import { ACHIEVEMENTS, equippedTitle } from '../../game/progression/achievements';
import { canClaim, claimMission, emptyWeekly, missionProgress, missionsForWeek, monthGrid, weekKeyOf } from '../../game/progression/missions';
import { Meter, Panel } from '../components/Panel';
import { navigate } from '../router';
import { useNow, useSave } from '../store';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function Journal() {
  const { save, update } = useSave();
  const now = useNow(60_000);
  const nowDate = new Date(now);
  const weekKey = weekKeyOf(nowDate);
  const missions = useMemo(() => missionsForWeek(weekKey), [weekKey]);
  const weekly = save.weekly.weekKey === weekKey ? save.weekly : emptyWeekly(weekKey);

  const [view, setView] = useState(() => ({ y: nowDate.getUTCFullYear(), m: nowDate.getUTCMonth() }));
  const done = useMemo(() => new Set(Object.keys(save.dailyResults)), [save.dailyResults]);
  const grid = monthGrid(view.y, view.m, done);
  const todayKey = nowDate.toISOString().slice(0, 10);

  const earned = ACHIEVEMENTS.filter((a) => save.achievements[a.id] !== undefined);
  const title = equippedTitle(save);

  function shift(delta: number) {
    setView((v) => {
      const d = new Date(Date.UTC(v.y, v.m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });
  }

  const recent = Object.values(save.dailyResults)
    .sort((a, b) => (a.run.key < b.run.key ? 1 : -1))
    .slice(0, 7);

  return (
    <div className="page">
      <h1 className="title">Journal</h1>

      <div className="grid">
        <Panel title={`Weekly missions (${weekKey})`}>
          <p className="muted">Three optional goals, the same for everyone this week. Claiming one adds bonus XP.</p>
          <ul className="missions">
            {missions.map((m) => {
              const value = missionProgress(weekly, m);
              const claimed = weekly.claimed.includes(m.id);
              return (
                <li key={m.id} className="mission">
                  <div>
                    <strong>{m.text}</strong>
                    <Meter value={value} max={m.target} label={m.text} />
                    <small className="muted">
                      {value.toLocaleString('en-US')} / {m.target.toLocaleString('en-US')} · +{m.bonusXp} XP
                    </small>
                  </div>
                  <button
                    type="button"
                    className="btn btn--small"
                    disabled={claimed || !canClaim(weekly, m)}
                    onClick={() => update((s) => claimMission(s, weekKey, m.id))}
                  >
                    {claimed ? 'Claimed' : 'Claim'}
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Daily Dig calendar">
          <div className="cal__head">
            <button type="button" className="btn btn--small btn--ghost" onClick={() => shift(-1)} aria-label="Previous month">
              Prev
            </button>
            <strong>
              {MONTHS[view.m]} {view.y}
            </strong>
            <button type="button" className="btn btn--small btn--ghost" onClick={() => shift(1)} aria-label="Next month">
              Next
            </button>
          </div>
          <div className="cal" role="grid" aria-label="Days you finished the Daily Dig">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <span key={i} className="cal__dow" aria-hidden="true">
                {d}
              </span>
            ))}
            {grid.map((c, i) =>
              c.day === null ? (
                <span key={i} />
              ) : (
                <span
                  key={i}
                  role="gridcell"
                  className={`cal__day${c.done ? ' cal__day--done' : ''}${c.key === todayKey ? ' cal__day--today' : ''}`}
                  aria-label={`${c.key}${c.done ? ', finished' : ''}`}
                >
                  {c.day}
                </span>
              ),
            )}
          </div>
          <p className="muted">
            Streak: <b>{save.streak.current}</b> day{save.streak.current === 1 ? '' : 's'} (best {save.streak.best}). Days are counted in UTC.
          </p>
        </Panel>
      </div>

      <Panel title={`Achievements (${earned.length}/${ACHIEVEMENTS.length})`}>
        <p className="muted">Earn a badge to unlock a title you can wear on your profile. Wearing: {title ?? 'no title'}.</p>
        <ul className="badges">
          {ACHIEVEMENTS.map((a) => {
            const at = save.achievements[a.id];
            const got = at !== undefined;
            const wearing = save.title === a.id && got;
            const [value, target] = a.progress ? a.progress(save) : [0, 0];
            return (
              <li key={a.id} className={`badge${got ? ' badge--got' : ''}`}>
                <strong>{a.name}</strong>
                <span>{a.description}</span>
                {got ? (
                  <>
                    <small className="muted">Earned {new Date(at).toISOString().slice(0, 10)}</small>
                    <button
                      type="button"
                      className="btn btn--small"
                      aria-pressed={wearing}
                      onClick={() => update((s) => ({ ...s, title: wearing ? null : a.id }))}
                    >
                      {wearing ? 'Wearing' : `Wear "${a.title}"`}
                    </button>
                  </>
                ) : a.progress ? (
                  <>
                    <Meter value={value} max={target} label={a.name} />
                    <small className="muted">
                      {value.toLocaleString('en-US')} / {target.toLocaleString('en-US')}
                    </small>
                  </>
                ) : (
                  <small className="muted">Not yet earned</small>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title="Mining journal">
        {recent.length === 0 ? (
          <p className="muted">Your finished Daily Digs will be listed here.</p>
        ) : (
          <ul className="journal">
            {recent.map((r) => (
              <li key={r.run.id}>
                <button type="button" className="btn btn--small btn--ghost" onClick={() => navigate(`results/${r.run.key}`)}>
                  {r.run.key}
                </button>
                <span>
                  {r.run.points} pts · {r.run.depth.toLocaleString('en-US')} m
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
