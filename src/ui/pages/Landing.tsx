import { EQUIPMENT_BY_TIER } from '../../game/digging/equipment';
import { GAME_CONFIG } from '../../game/config';
import { TIER_BLURB, TIER_NAMES, TIER_COLORS } from '../../game/tiers';
import { TIER_ORDER } from '../../game/types';
import { msUntilNextDaily } from '../../game/daily/challenge';
import { maxRunDepth } from '../../game/scoring/scoring';
import { DigCanvas } from '../components/DigCanvas';
import { navigate } from '../router';
import { useSave } from '../store';

function resetTimeLocal(): string {
  const at = new Date(Date.now() + msUntilNextDaily());
  return at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function Landing() {
  const { reducedMotion, save } = useSave();
  const hasPlayed = save.lifetime.runs > 0;
  return (
    <div className="landing">
      <section className="hero">
        <DigCanvas demo logicalWidth={300} reducedMotion={reducedMotion} className="dig-canvas dig-canvas--hero" />
        <div className="hero__text">
          <h1 className="logo">DEEPER</h1>
          <p className="hero__tag">Answer rare. Dig deep.</p>
          <p className="hero__sub">
            A daily trivia dig. The more unusual your correct answer, the bigger the machine your miner pulls out.
            You only type. DEEPER does the digging.
          </p>
          <div className="btn-row btn-row--center">
            <button type="button" className="btn btn--primary btn--big" onClick={() => navigate('play/daily')}>
              Begin Descent
            </button>
            {hasPlayed ? (
              <button type="button" className="btn btn--big" onClick={() => navigate('home')}>
                Dashboard
              </button>
            ) : null}
          </div>
          <p className="hero__daily">
            Today's Daily Dig: {GAME_CONFIG.questionsPerRun} questions · {GAME_CONFIG.secondsPerQuestion}s each · new dig at {resetTimeLocal()}
          </p>
        </div>
      </section>

      <section className="page">
        <h2 className="title">How it works</h2>
        <ol className="steps">
          <li>
            <b>1. Read</b>
            <span>A question with many valid answers appears.</span>
          </li>
          <li>
            <b>2. Type</b>
            <span>Think past the obvious. Rare answers score more.</span>
          </li>
          <li>
            <b>3. Watch</b>
            <span>Your miner automatically digs with gear matched to your answer's rarity.</span>
          </li>
          <li>
            <b>4. Go deeper</b>
            <span>Perfect runs reach {maxRunDepth().toLocaleString('en-US')} m. Find treasures on the way.</span>
          </li>
        </ol>

        <h2 className="title">Six tiers, six machines</h2>
        <ul className="tiers">
          {TIER_ORDER.map((t) => (
            <li key={t} className="tier-card" style={{ ['--tier' as string]: TIER_COLORS[t] }}>
              <strong>{TIER_NAMES[t]}</strong>
              <span>{TIER_BLURB[t]}</span>
              <em>{EQUIPMENT_BY_TIER[t].name}</em>
              <b>{GAME_CONFIG.pointsByTier[t]} pts</b>
            </li>
          ))}
        </ul>

        <div className="panel">
          <h2 className="panel__title">Community</h2>
          <p className="muted">
            Real community statistics (players, shared depth, rarest finds) appear here once the online backend is connected.
            Nothing on this page is made up.
          </p>
        </div>
      </section>
    </div>
  );
}
