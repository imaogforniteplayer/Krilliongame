import { useMemo } from 'react';
import { SURVIVAL_LIVES } from '../../game/session';
import { activeQuestions } from '../../game/questions';
import { PACKS, questionsForPack } from '../../game/packs';
import { Panel } from '../components/Panel';
import { navigate } from '../router';
import { useSave } from '../store';
import { ChallengeLauncher } from './Challenge';

export function Modes() {
  const { save } = useSave();
  const counts = useMemo(() => {
    const pool = activeQuestions();
    return PACKS.map((p) => ({ pack: p, n: questionsForPack(p, pool).length }));
  }, []);
  const best = save.survivalBest;

  return (
    <div className="page">
      <h1 className="title">Game modes</h1>
      <p className="muted">Every mode digs the same way: you answer, DEEPER does the digging.</p>

      <div className="grid">
        <Panel title="Daily Dig">
          <p>Seven questions, the same for everyone today. One ranked attempt per day.</p>
          <div className="btn-row">
            <button type="button" className="btn btn--primary" onClick={() => navigate('play/daily')}>
              Play Daily Dig
            </button>
          </div>
        </Panel>

        <Panel title="Endless Dig">
          <p>Fresh random seven-question runs, as many as you like. Chase your personal best.</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => navigate('play/endless')}>
              Play Endless
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => navigate('play/practice')}>
              Practice
            </button>
          </div>
        </Panel>

        <Panel title="Survival Dig">
          <p>
            Questions get harder as you go. You have {SURVIVAL_LIVES} lives: a wrong answer or a timeout costs one, and the run ends when they are gone.
          </p>
          <p className="muted">
            Best: {best.answers} correct, {best.points} pts, {best.depth.toLocaleString('en-US')} m
          </p>
          <div className="btn-row">
            <button type="button" className="btn btn--primary" onClick={() => navigate('play/survival')}>
              Play Survival
            </button>
          </div>
        </Panel>
      </div>

      <ChallengeLauncher />

      <Panel title="Themed Dig packs">
        <p className="muted">Endless Dig, restricted to one theme.</p>
        <ul className="packs">
          {counts.map(({ pack, n }) => (
            <li key={pack.id} className="pack">
              <div>
                <strong>{pack.name}</strong>
                <span>{pack.blurb}</span>
                <small className="muted">{n} questions</small>
              </div>
              <button type="button" className="btn btn--small" onClick={() => navigate(`play/pack/${pack.id}`)}>
                Dig
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Needs the online backend">
        <ul className="soon">
          <li>
            <div>
              <strong>Live Dig Duel</strong>
              <span>Two miners digging side by side in real time.</span>
            </div>
            <em className="chip">Not connected</em>
          </li>
          <li>
            <div>
              <strong>Squad Expedition</strong>
              <span>Up to four players share a digging target.</span>
            </div>
            <em className="chip">Not connected</em>
          </li>
        </ul>
      </Panel>
    </div>
  );
}
