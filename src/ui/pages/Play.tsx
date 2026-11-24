import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { audio } from '../../game/audio/audio';
import { biomeAtDepth, nextBiome } from '../../game/biomes/biomes';
import type { Biome } from '../../game/biomes/biomes';
import { selectDailyQuestions, selectRandomQuestions } from '../../game/daily/challenge';
import { EQUIPMENT_BY_TIER } from '../../game/digging/equipment';
import { getDiscovery } from '../../game/discoveries/discoveries';
import type { DiscoveryItem } from '../../game/discoveries/discoveries';
import { GAME_CONFIG } from '../../game/config';
import { activeQuestions, getQuestion } from '../../game/questions';
import type { DigRenderer, DigSpec } from '../../game/render/DigRenderer';
import {
  createRun,
  currentQuestionId,
  isFinished,
  startQuestionClock,
  submitAnswer,
  timeLeftMs,
} from '../../game/session';
import type { AnswerRecord, RunMode, RunState } from '../../game/session';
import { applyFinishedRun, levelFromXp, xpOf } from '../../game/storage';
import { TIER_COLORS } from '../../game/tiers';
import { formatMetres } from '../../game/scoring/scoring';
import { DigCanvas } from '../components/DigCanvas';
import { TierBadge } from '../components/TierBadge';
import { discoveryIconUrl } from '../icons';
import { navigate } from '../router';
import { useDailyKey, useSave } from '../store';
import { Results } from './Results';

const MODE_LABEL: Record<RunMode, string> = {
  daily: 'Daily Dig',
  endless: 'Endless Dig',
  practice: 'Practice',
};

type Phase = 'loading' | 'walking' | 'asking' | 'revealing' | 'digging' | 'feedback' | 'finishing';

interface Fresh {
  run: RunState;
  personalBest: boolean;
  levelUp: boolean;
}

/** Chooses between a finished-run screen and a live run. Remounts a live run when `attempt` changes. */
export function Play({ mode }: { mode: RunMode }) {
  const { save } = useSave();
  const dayKey = useDailyKey();
  const [attempt, setAttempt] = useState(0);
  const [fresh, setFresh] = useState<Fresh | null>(null);

  const stored = mode === 'daily' ? save.dailyResults[dayKey] : undefined;

  if (fresh) {
    return (
      <Results
        run={fresh.run}
        mode={mode}
        personalBest={fresh.personalBest}
        levelUp={fresh.levelUp}
        onAgain={
          mode === 'daily'
            ? undefined
            : () => {
                setFresh(null);
                setAttempt((a) => a + 1);
              }
        }
      />
    );
  }
  if (stored) return <Results run={stored.run} mode="daily" alreadyPlayed />;

  return (
    <PlayRun
      key={`${mode}-${attempt}`}
      mode={mode}
      dayKey={dayKey}
      onFinished={(run, personalBest, levelUp) => setFresh({ run, personalBest, levelUp })}
    />
  );
}

function initialRun(mode: RunMode, dayKey: string, active: RunState | null): RunState {
  if (mode === 'daily' && active && active.mode === 'daily' && active.key === dayKey && !isFinished(active)) {
    const intact = active.questionIds.every((id) => !!getQuestion(id));
    if (intact) return active;
  }
  const pool = activeQuestions();
  const questions =
    mode === 'daily' ? selectDailyQuestions(dayKey, pool) : selectRandomQuestions(pool);
  return createRun({
    mode,
    key: mode === 'daily' ? dayKey : `${mode}-${new Date().toISOString().slice(0, 10)}`,
    questions,
    now: Date.now(),
  });
}

function PlayRun({
  mode,
  dayKey,
  onFinished,
}: {
  mode: RunMode;
  dayKey: string;
  onFinished: (run: RunState, personalBest: boolean, levelUp: boolean) => void;
}) {
  const { save, update, reducedMotion } = useSave();
  const saveRef = useRef(save);
  saveRef.current = save;

  const [run, setRun] = useState<RunState>(() => initialRun(mode, dayKey, save.activeRun));
  const runRef = useRef(run);
  const [phase, setPhase] = useState<Phase>('loading');
  const phaseRef = useRef<Phase>('loading');
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState(GAME_CONFIG.secondsPerQuestion * 1000);
  const [reveal, setReveal] = useState<AnswerRecord | null>(null);
  const [feedback, setFeedback] = useState<AnswerRecord | null>(null);
  const [discovery, setDiscovery] = useState<DiscoveryItem | null>(null);
  const [banner, setBanner] = useState<Biome | null>(null);
  const [hudDepth, setHudDepth] = useState(run.depth);

  const rendererRef = useRef<DigRenderer | null>(null);
  const alive = useRef(true);
  const lastHud = useRef(0);
  const continueRef = useRef<(() => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastTickSecond = useRef(-1);
  const fast = reducedMotion || save.settings.skipAnimations;
  const fastRef = useRef(fast);
  fastRef.current = fast;

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  /** Resolves after `ms`, or sooner when the player taps Skip / Continue. */
  const wait = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        const finish = () => {
          window.clearTimeout(id);
          if (continueRef.current === finish) continueRef.current = null;
          resolve();
        };
        const id = window.setTimeout(finish, ms);
        continueRef.current = finish;
      }),
    [],
  );

  const commitRun = useCallback(
    (next: RunState) => {
      runRef.current = next;
      setRun(next);
      // Only the ranked daily run is resumable, so Endless / Practice never overwrite it.
      if (mode === 'daily' && !isFinished(next)) update((s) => ({ ...s, activeRun: next }));
    },
    [mode, update],
  );

  const openQuestion = useCallback(() => {
    if (!alive.current) return;
    const now = Date.now();
    const next = startQuestionClock(runRef.current, now);
    commitRun(next);
    lastTickSecond.current = -1;
    setInput('');
    setMessage('');
    setReveal(null);
    setFeedback(null);
    setTimeLeft(timeLeftMs(next, now));
    setPhaseBoth('asking');
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }, [commitRun, setPhaseBoth]);

  const finish = useCallback(
    async (finalRun: RunState) => {
      setPhaseBoth('finishing');
      const r = rendererRef.current;
      const before = saveRef.current;
      const now = Date.now();
      const after = applyFinishedRun(before, finalRun, now);
      const personalBest = finalRun.points > before.personalBest.points;
      const levelUp = levelFromXp(xpOf(after)).level > levelFromXp(xpOf(before)).level;
      r?.react('victory', 1600);
      audio.sfx('victory');
      await wait(fastRef.current ? 400 : 1700);
      if (!alive.current) return;
      update((s) => applyFinishedRun(s, finalRun, now));
      if (levelUp) audio.sfx('levelup');
      onFinished(finalRun, personalBest, levelUp);
    },
    [onFinished, setPhaseBoth, update, wait],
  );

  const resolveAnswer = useCallback(
    async (nextRun: RunState, record: AnswerRecord) => {
      const r = rendererRef.current;
      setPhaseBoth('revealing');
      commitRun(nextRun);

      if (record.status === 'accepted' && record.tier) {
        const tier = record.tier;
        const spec = EQUIPMENT_BY_TIER[tier];
        audio.sfx('submit');
        setReveal(record);
        audio.sfx('reveal', tier);
        await wait(fastRef.current ? 600 : 1500);
        if (!alive.current || !r) return;

        setPhaseBoth('digging');
        const found = record.discoveryId ? getDiscovery(record.discoveryId) : undefined;
        const dig: DigSpec = {
          tier,
          equipment: spec.id,
          fromDepth: record.depthBefore,
          toDepth: record.depthAfter,
          durationMs: spec.durationMs,
          intensity: spec.intensity,
          discovery: found ? { atFraction: record.discoveryAt ?? 0.5, item: found, holdMs: 1800 } : undefined,
        };
        if (fastRef.current && found) showDiscovery(found);
        await r.play(dig, { skip: fastRef.current });
        if (!alive.current) return;
        setHudDepth(Math.round(record.depthAfter));
        await wait(fastRef.current ? 150 : 500);
      } else {
        audio.sfx(record.status === 'timeout' ? 'timeout' : 'wrong');
        r?.react('sad', 1500);
        setFeedback(record);
        await wait(fastRef.current ? 1200 : 2600);
      }

      if (!alive.current) return;
      if (isFinished(nextRun)) await finish(nextRun);
      else openQuestion();

      function showDiscovery(item: DiscoveryItem) {
        audio.sfx('discovery');
        setDiscovery(item);
        window.setTimeout(() => setDiscovery((cur) => (cur === item ? null : cur)), 3000);
      }
    },
    [commitRun, finish, openQuestion, setPhaseBoth, wait],
  );

  const handleTimeout = useCallback(() => {
    if (phaseRef.current !== 'asking') return;
    const qid = currentQuestionId(runRef.current);
    const q = qid ? getQuestion(qid) : undefined;
    if (!q) return;
    phaseRef.current = 'revealing';
    // A deadline in the past makes submitAnswer score the question as a timeout.
    const late = Date.now() + 60_000;
    const out = submitAnswer(runRef.current, q, input, late);
    if (out.kind === 'scored') void resolveAnswer(out.run, out.record);
    else phaseRef.current = 'asking';
  }, [input, resolveAnswer]);

  // Countdown. Uses wall-clock time, so a refresh cannot buy extra seconds.
  useEffect(() => {
    if (phase !== 'asking') return;
    const id = window.setInterval(() => {
      const left = timeLeftMs(runRef.current, Date.now());
      setTimeLeft(left);
      const sec = Math.ceil(left / 1000);
      if (sec <= 5 && sec > 0 && sec !== lastTickSecond.current) {
        lastTickSecond.current = sec;
        audio.sfx('tick');
      }
      if (left <= 0) {
        window.clearInterval(id);
        handleTimeout();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, handleTimeout]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      continueRef.current?.();
      audio.stopMusic();
    };
  }, []);

  const onReady = useCallback(
    (r: DigRenderer) => {
      rendererRef.current = r;
      void (async () => {
        const current = runRef.current;
        audio.startMusic(biomeAtDepth(current.depth).index);
        r.reset();
        r.setDepth(current.depth);
        if (current.answers.length === 0) {
          setPhaseBoth('walking');
          await r.walkIn();
        }
        if (alive.current) openQuestion();
      })();
    },
    [openQuestion, setPhaseBoth],
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (phaseRef.current !== 'asking') return;
    audio.unlock();
    const qid = currentQuestionId(runRef.current);
    const q = qid ? getQuestion(qid) : undefined;
    if (!q) return;
    const out = submitAnswer(runRef.current, q, input, Date.now());
    if (out.kind === 'retry') {
      setMessage(out.message);
      audio.sfx('wrong');
      return;
    }
    phaseRef.current = 'revealing'; // blocks a second submit while state catches up
    void resolveAnswer(out.run, out.record);
  }

  function skip() {
    continueRef.current?.();
    rendererRef.current?.skip();
  }

  const qid = currentQuestionId(run);
  const question = qid ? getQuestion(qid) : undefined;
  const total = run.questionIds.length;
  const shownIndex = Math.min(run.index + (isFinished(run) ? 0 : 1), total);
  const biome = biomeAtDepth(hudDepth);
  const upcoming = nextBiome(hudDepth);
  const seconds = Math.ceil(timeLeft / 1000);
  const pct = (timeLeft / (GAME_CONFIG.secondsPerQuestion * 1000)) * 100;
  const canSkip = phase === 'revealing' || phase === 'digging' || phase === 'feedback';

  const hooks = {
    onEquip: (tier: keyof typeof EQUIPMENT_BY_TIER) =>
      audio.dig(tier, fastRef.current ? 400 : EQUIPMENT_BY_TIER[tier].durationMs),
    onImpact: audio.impact.bind(audio),
    onDiscovery: (item: DiscoveryItem) => {
      audio.sfx('discovery');
      setDiscovery(item);
      window.setTimeout(() => setDiscovery((cur) => (cur === item ? null : cur)), 3000);
    },
    onBiomeChange: (b: Biome) => {
      audio.sfx('biome');
      audio.setMusicBiome(b.index);
      setBanner(b);
      window.setTimeout(() => setBanner((cur) => (cur === b ? null : cur)), 2800);
    },
    onFrame: (d: number) => {
      const now = performance.now();
      if (now - lastHud.current > 60) {
        lastHud.current = now;
        setHudDepth(Math.round(d));
      }
    },
  };

  return (
    <div className="play">
      <header className="play__hud">
        <button type="button" className="btn btn--small btn--ghost" onClick={() => navigate('home')}>
          Leave
        </button>
        <div className="play__progress" aria-label={`Question ${shownIndex} of ${total}`}>
          <span className="play__mode">{MODE_LABEL[mode]}</span>
          <div className="pips">
            {run.questionIds.map((id, i) => {
              const a = run.answers[i];
              const color = a ? (a.tier ? TIER_COLORS[a.tier] : '#5a5470') : undefined;
              return (
                <i
                  key={id}
                  className={`pip${i === run.index && !isFinished(run) ? ' pip--now' : ''}${a ? ' pip--done' : ''}`}
                  style={color ? { background: color } : undefined}
                />
              );
            })}
          </div>
          <span className="play__q">
            Q{shownIndex}/{total}
          </span>
        </div>
        <div className="play__score">
          <span>
            <b>{run.points}</b> pts
          </span>
          <span>
            <b>{formatMetres(hudDepth)}</b>
          </span>
        </div>
      </header>

      <div className="play__biome">
        <span className="play__biome-now">{biome.name}</span>
        {upcoming ? (
          <span className="play__biome-next">
            Next: {upcoming.name} in {formatMetres(Math.max(0, upcoming.startDepth - hudDepth))}
          </span>
        ) : (
          <span className="play__biome-next">You reached the bottom.</span>
        )}
      </div>

      <div className="play__stage">
        <DigCanvas reducedMotion={reducedMotion} hooks={hooks} onReady={onReady} className="dig-canvas dig-canvas--stage" />
        {banner ? (
          <div className="banner" style={{ ['--glow' as string]: banner.palette.glow }} role="status">
            <small>Entering</small>
            <strong>{banner.name}</strong>
            <span>{banner.blurb}</span>
          </div>
        ) : null}
        {discovery ? (
          <div className="found" role="status" style={{ ['--tier' as string]: TIER_COLORS[discovery.rarity] }}>
            <img src={discoveryIconUrl(discovery)} alt="" className="pixel-img found__icon" />
            <div>
              <small>You found</small>
              <strong>{discovery.name}</strong>
              <TierBadge tier={discovery.rarity} />
            </div>
          </div>
        ) : null}
        {canSkip ? (
          <button type="button" className="btn btn--small stage-skip" onClick={skip}>
            {phase === 'feedback' ? 'Continue' : 'Skip animation'}
          </button>
        ) : null}
      </div>

      <section className="play__panel" aria-live="polite">
        {phase === 'loading' || phase === 'walking' ? (
          <p className="ask__wait">Heading down to the mine...</p>
        ) : null}

        {phase === 'asking' && question ? (
          <form onSubmit={onSubmit} className="ask">
            <div className="ask__meta">
              <span className="chip">{question.category}</span>
              <span className={`timer${seconds <= 5 ? ' timer--low' : ''}`} role="timer">
                {seconds}s
              </span>
            </div>
            <div className="timer-bar" aria-hidden="true">
              <div className={`timer-bar__fill${seconds <= 5 ? ' timer-bar__fill--low' : ''}`} style={{ width: `${pct}%` }} />
            </div>
            <h1 className="ask__q">{question.text}</h1>
            <div className="ask__row">
              <input
                ref={inputRef}
                className="ask__input"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  if (message) setMessage('');
                }}
                maxLength={GAME_CONFIG.maxAnswerLength}
                placeholder="Type your answer..."
                aria-label="Your answer"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
              />
              <button type="submit" className="btn btn--primary">
                Dig!
              </button>
            </div>
            <p className="ask__hint">{message || 'Rarer answers dig deeper. Unusual but correct beats obvious.'}</p>
          </form>
        ) : null}

        {(phase === 'revealing' || phase === 'digging') && reveal && reveal.tier ? (
          <div className="reveal" style={{ ['--tier' as string]: TIER_COLORS[reveal.tier] }}>
            <TierBadge tier={reveal.tier} big />
            <h2 className="reveal__answer">{reveal.canonical}</h2>
            <p className="reveal__gain">
              +{reveal.points} pts <span>·</span> +{formatMetres(reveal.metres)}
            </p>
            <p className="reveal__meta">
              {reveal.share && reveal.share > 0
                ? `Estimated: about 1 in ${Math.max(2, Math.round(1 / reveal.share)).toLocaleString('en-US')} players give this answer`
                : null}
              <br />
              Equipment: {EQUIPMENT_BY_TIER[reveal.tier].name}
            </p>
          </div>
        ) : null}

        {phase === 'revealing' && feedback === null && reveal === null ? <p className="ask__wait">Checking your answer...</p> : null}

        {feedback ? (
          <div className="reveal reveal--miss">
            <h2 className="reveal__answer">{feedback.status === 'timeout' ? "Time's up!" : 'No dig this time'}</h2>
            <p className="reveal__meta">{feedback.message}</p>
            {feedback.typed ? <p className="reveal__typed">You typed: {feedback.typed}</p> : null}
          </div>
        ) : null}

        {phase === 'finishing' ? <p className="ask__wait">Run complete. Nice digging!</p> : null}
      </section>
    </div>
  );
}
