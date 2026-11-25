import { computeRarity } from './rarity/rarity';
import { createRun, isFinished, startQuestionClock, submitAnswer } from './session';
import type { RunMode, RunState } from './session';
import type { Question, RarityTier } from './types';

/** Test helper: the canonical text of an answer for `q` that lands in `tier`, or null. */
export function answerForTier(q: Question, tier: RarityTier): string | null {
  const e = q.entries.find((x) => computeRarity(x).tier === tier);
  return e ? e.canonical : null;
}

/** Test helper: the rarest accepted answer for `q`. */
export function rarestAnswer(q: Question): string {
  const sorted = [...q.entries].sort((a, b) => computeRarity(a).share - computeRarity(b).share);
  return (sorted[0] as (typeof q.entries)[number]).canonical;
}

/**
 * Plays a whole run through the real `submitAnswer`. `pick` returns the text to type for each
 * question; return null to type something that is not an answer at all.
 */
export function playRun(opts: {
  mode: RunMode;
  key: string;
  questions: readonly Question[];
  pick: (q: Question, index: number) => string | null;
  id?: string;
  start?: number;
}): RunState {
  let t = opts.start ?? 5_000_000;
  let run = startQuestionClock(createRun({ mode: opts.mode, key: opts.key, questions: opts.questions, now: t, id: opts.id }), t);
  for (let i = 0; i < opts.questions.length && !isFinished(run); i++) {
    const q = opts.questions[i] as Question;
    t += 3000;
    const out = submitAnswer(run, q, opts.pick(q, i) ?? 'qqqq zzzz not a real answer', t);
    if (out.kind !== 'scored') throw new Error(`question ${i} was not scored: ${out.message}`);
    run = startQuestionClock(out.run, t);
  }
  return run;
}
