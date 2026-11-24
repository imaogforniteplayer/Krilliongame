import { useMemo, useState } from 'react';
import { GAME_CONFIG } from '../../game/config';
import { ALL_QUESTIONS, getQuestion } from '../../game/questions';
import { TIER_NAMES } from '../../game/tiers';
import { TIER_ORDER } from '../../game/types';
import { Panel } from '../components/Panel';
import { copyText } from '../share';
import { useSave } from '../store';

type Tab = 'queue' | 'questions' | 'rules';

/**
 * Local demo admin. It is read-only for the question bank (edit the files in src/game/questions/bank)
 * and has no authentication, because there is no server to authenticate against yet. The production
 * admin tools described in the README require the Supabase backend and an admin role.
 */
export function Admin() {
  const { save, update } = useSave();
  const [tab, setTab] = useState<Tab>('queue');
  const [q, setQ] = useState('');
  const [note, setNote] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return ALL_QUESTIONS.filter(
      (x) => !needle || x.text.toLowerCase().includes(needle) || x.category.toLowerCase().includes(needle) || x.packs.some((p) => p.includes(needle)),
    );
  }, [q]);

  const counts = useMemo(() => {
    const byCat: Record<string, number> = {};
    for (const x of ALL_QUESTIONS) byCat[x.category] = (byCat[x.category] ?? 0) + 1;
    return byCat;
  }, []);

  async function exportQueue() {
    const rows = save.unknownAnswers.map((u) => ({ ...u, question: getQuestion(u.questionId)?.text }));
    const ok = await copyText(JSON.stringify(rows, null, 2));
    setNote(ok ? 'Review queue copied as JSON.' : 'Could not copy.');
  }

  return (
    <div className="page">
      <h1 className="title">Admin (local demo)</h1>
      <p className="notice">
        No login is enforced here because there is no server yet. In production this area must sit behind an authenticated admin role.
        Question editing happens in <code>src/game/questions/bank/</code> for now.
      </p>
      <div className="filters">
        {(['queue', 'questions', 'rules'] as const).map((t) => (
          <button key={t} type="button" className={`btn btn--small${tab === t ? ' btn--primary' : ''}`} onClick={() => setTab(t)}>
            {t === 'queue' ? `Review queue (${save.unknownAnswers.length})` : t === 'questions' ? `Questions (${ALL_QUESTIONS.length})` : 'Rules'}
          </button>
        ))}
      </div>

      {tab === 'queue' ? (
        <Panel title="Unknown answers awaiting review">
          <p className="muted">
            Answers that were not on a question's list score 0 and land here. Nothing is added to competitive play until a human verifies it.
          </p>
          {save.unknownAnswers.length === 0 ? (
            <p className="muted">Nothing to review yet.</p>
          ) : (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th>Question</th>
                    <th>Typed</th>
                    <th>Times</th>
                  </tr>
                </thead>
                <tbody>
                  {save.unknownAnswers.map((u) => (
                    <tr key={`${u.questionId}|${u.normalized}`}>
                      <td>{getQuestion(u.questionId)?.text ?? u.questionId}</td>
                      <td>{u.typed}</td>
                      <td>{u.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="btn-row">
                <button type="button" className="btn btn--small" onClick={exportQueue}>
                  Copy as JSON
                </button>
                <button type="button" className="btn btn--small btn--danger" onClick={() => update((s) => ({ ...s, unknownAnswers: [] }))}>
                  Clear queue
                </button>
              </div>
              <p className="muted" role="status">
                {note}
              </p>
            </>
          )}
        </Panel>
      ) : null}

      {tab === 'questions' ? (
        <Panel title="Question bank">
          <p className="muted">{Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>
          <input className="ask__input" placeholder="Search text, category or pack..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search questions" />
          <table className="table">
            <thead>
              <tr>
                <th>Question</th>
                <th>Category</th>
                <th>Level</th>
                <th>Answers</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((x) => (
                <tr key={x.id}>
                  <td>{x.text}</td>
                  <td>{x.category}</td>
                  <td>{x.difficulty}</td>
                  <td>{x.entries.length}</td>
                  <td>{x.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 200 ? <p className="muted">Showing the first 200 of {filtered.length}.</p> : null}
        </Panel>
      ) : null}

      {tab === 'rules' ? (
        <Panel title="Competitive rules (from src/game/config.ts)">
          <p className="muted">
            {GAME_CONFIG.scoringVersion} · {GAME_CONFIG.rarityVersion} · {GAME_CONFIG.metresPerPoint} m per point · {GAME_CONFIG.secondsPerQuestion}s per question
          </p>
          <table className="table">
            <thead>
              <tr>
                <th>Tier</th>
                <th>Points</th>
                <th>Share at or above</th>
              </tr>
            </thead>
            <tbody>
              {TIER_ORDER.map((t) => (
                <tr key={t}>
                  <td>{TIER_NAMES[t]}</td>
                  <td>{GAME_CONFIG.pointsByTier[t]}</td>
                  <td>{t === 'corebound' ? 'below the Void line' : `${((GAME_CONFIG.rarity.thresholds as Record<string, number>)[t] ?? 0) * 100}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">Change these values and bump the version strings so old results stay explainable.</p>
        </Panel>
      ) : null}
    </div>
  );
}
