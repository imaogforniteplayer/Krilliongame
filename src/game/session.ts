import { biomeAtDepth } from './biomes/biomes';
import { GAME_CONFIG } from './config';
import { rollDiscovery } from './discoveries/discoveries';
import { equipmentForTier } from './digging/equipment';
import { computeRarity } from './rarity/rarity';
import { depthForPoints, pointsForTier } from './scoring/scoring';
import { validateAnswer } from './answerValidation/validate';
import { TIER_ORDER } from './types';
import type { AnswerStatus, EquipmentId, Question, QuestionStats, RarityResult, RarityTier } from './types';

export type RunMode = 'daily' | 'endless' | 'practice';

/** One finished question. Stored with the rule versions so old results stay explainable. */
export interface AnswerRecord {
  questionId: string;
  typed: string;
  status: AnswerStatus;
  entryId?: string;
  canonical?: string;
  tier?: RarityTier;
  share?: number;
  raritySource?: RarityResult['source'];
  sampleSize?: number;
  equipment?: EquipmentId;
  points: number;
  metres: number;
  depthBefore: number;
  depthAfter: number;
  discoveryId?: string;
  /** 0..1 position of the discovery within the dig. */
  discoveryAt?: number;
  message: string;
  timeTakenMs: number;
  scoringVersion: string;
  rarityVersion: string;
}

export interface RunState {
  id: string;
  mode: RunMode;
  /** Daily key (YYYY-MM-DD) for daily runs, otherwise a label. */
  key: string;
  questionIds: string[];
  index: number;
  answers: AnswerRecord[];
  depth: number;
  points: number;
  startedAt: number;
  /** Wall-clock ms when the current question was shown; null until the UI shows it. */
  questionStartedAt: number | null;
  finishedAt: number | null;
  scoringVersion: string;
  rarityVersion: string;
}

export function newRunId(rng: () => number = Math.random): string {
  return Array.from({ length: 12 }, () => Math.floor(rng() * 36).toString(36)).join('');
}

export function createRun(opts: {
  mode: RunMode;
  key: string;
  questions: readonly Question[];
  now: number;
  id?: string;
}): RunState {
  return {
    id: opts.id ?? newRunId(),
    mode: opts.mode,
    key: opts.key,
    questionIds: opts.questions.map((q) => q.id),
    index: 0,
    answers: [],
    depth: 0,
    points: 0,
    startedAt: opts.now,
    questionStartedAt: null,
    finishedAt: null,
    scoringVersion: GAME_CONFIG.scoringVersion,
    rarityVersion: GAME_CONFIG.rarityVersion,
  };
}

export function isFinished(run: RunState): boolean {
  return run.finishedAt !== null;
}

export function currentQuestionId(run: RunState): string | null {
  return run.questionIds[run.index] ?? null;
}

export function startQuestionClock(run: RunState, now: number): RunState {
  if (isFinished(run) || run.questionStartedAt !== null) return run;
  return { ...run, questionStartedAt: now };
}

/** Milliseconds left on the current question. Counts wall-clock time so a page refresh cannot buy extra seconds. */
export function timeLeftMs(run: RunState, now: number): number {
  const total = GAME_CONFIG.secondsPerQuestion * 1000;
  if (run.questionStartedAt === null) return total;
  return Math.max(0, total - (now - run.questionStartedAt));
}

export function isLate(run: RunState, now: number): boolean {
  if (run.questionStartedAt === null) return false;
  return now - run.questionStartedAt > GAME_CONFIG.secondsPerQuestion * 1000 + GAME_CONFIG.timerGraceMs;
}

// Control characters, zero-width / bidi marks and line separators (written as escapes on purpose).
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2066-\\u2069]', 'g');

/** Removes control characters, collapses whitespace and caps the length. */
export function sanitizeInput(raw: string): string {
  return raw
    .replace(CONTROL_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, GAME_CONFIG.maxAnswerLength + 20);
}

export type SubmitOutcome =
  | { kind: 'retry'; message: string }
  | { kind: 'scored'; run: RunState; record: AnswerRecord };

const RETRY_MESSAGES = {
  empty: 'Type an answer first.',
  ambiguous: 'That could mean a few different things. Try being more specific.',
} as const;

function finishRecord(run: RunState, record: AnswerRecord, now: number): RunState {
  const answers = [...run.answers, record];
  const index = run.index + 1;
  const done = index >= run.questionIds.length;
  return {
    ...run,
    answers,
    index,
    depth: record.depthAfter,
    points: run.points + record.points,
    questionStartedAt: null,
    finishedAt: done ? now : null,
  };
}

function baseRecord(run: RunState, question: Question, typed: string, now: number): AnswerRecord {
  return {
    questionId: question.id,
    typed,
    status: 'empty',
    points: 0,
    metres: 0,
    depthBefore: run.depth,
    depthAfter: run.depth,
    message: '',
    timeTakenMs: run.questionStartedAt === null ? 0 : Math.max(0, now - run.questionStartedAt),
    scoringVersion: run.scoringVersion,
    rarityVersion: run.rarityVersion,
  };
}

/**
 * Scores one typed answer. Pure: the caller supplies the clock and (optional) real player
 * statistics. Rules, in order:
 *  1. A finished run, or a question that is not the current one, is rejected (no double scoring).
 *  2. Answers past the deadline (plus the small latency grace) count as a timeout.
 *  3. Empty / over-ambiguous input asks the player to try again without using up the question.
 *  4. Everything else uses up the question, so rapid-fire guessing is not free.
 */
export function submitAnswer(
  run: RunState,
  question: Question,
  rawInput: string,
  now: number,
  stats?: QuestionStats,
): SubmitOutcome {
  if (isFinished(run)) return { kind: 'retry', message: 'This run is already finished.' };
  if (currentQuestionId(run) !== question.id) return { kind: 'retry', message: 'That question is no longer active.' };

  const typed = sanitizeInput(rawInput);
  if (isLate(run, now)) return { kind: 'scored', ...timeoutQuestion(run, question, now, typed) };

  const result = validateAnswer(question, typed);
  const rec = baseRecord(run, question, typed, now);

  switch (result.status) {
    case 'empty':
      return { kind: 'retry', message: RETRY_MESSAGES.empty };
    case 'ambiguous':
      return { kind: 'retry', message: RETRY_MESSAGES.ambiguous };
    case 'invalid': {
      return { kind: 'retry', message: result.reason };
    }
    case 'excluded': {
      rec.status = 'excluded';
      rec.message = result.reason;
      break;
    }
    case 'unknown': {
      rec.status = 'unknown';
      rec.message = 'Not on our list yet. It has been saved for review, but scores 0 for now.';
      break;
    }
    case 'accepted': {
      const rarity = computeRarity(result.entry, stats);
      const points = pointsForTier(rarity.tier);
      const metres = depthForPoints(points);
      rec.status = 'accepted';
      rec.entryId = result.entry.id;
      rec.canonical = result.entry.canonical;
      rec.tier = rarity.tier;
      rec.share = rarity.share;
      rec.raritySource = rarity.source;
      rec.sampleSize = rarity.sampleSize;
      rec.equipment = equipmentForTier(rarity.tier).id;
      rec.points = points;
      rec.metres = metres;
      rec.depthAfter = run.depth + metres;
      rec.message = `${result.entry.canonical} is a ${rarity.tier} answer.`;
      const found = rollDiscovery({
        seedKey: `${run.id}|${run.index}`,
        tier: rarity.tier,
        depthBefore: rec.depthBefore,
        depthAfter: rec.depthAfter,
      });
      if (found) {
        rec.discoveryId = found.item.id;
        rec.discoveryAt = found.atFraction;
      }
      break;
    }
  }
  return { kind: 'scored', run: finishRecord(run, rec, now), record: rec };
}

export function timeoutQuestion(
  run: RunState,
  question: Question,
  now: number,
  typed = '',
): { run: RunState; record: AnswerRecord } {
  const rec = baseRecord(run, question, typed, now);
  rec.status = 'timeout';
  rec.message = "Time's up!";
  rec.timeTakenMs = GAME_CONFIG.secondsPerQuestion * 1000;
  return { run: finishRecord(run, rec, now), record: rec };
}

export interface RunSummary {
  points: number;
  depth: number;
  finalBiomeId: string;
  accepted: number;
  best: AnswerRecord | null;
  rarest: AnswerRecord | null;
  equipmentUsed: EquipmentId[];
  discoveryIds: string[];
  tierCounts: Record<RarityTier, number>;
}

export function summarizeRun(run: RunState): RunSummary {
  const tierCounts = Object.fromEntries(TIER_ORDER.map((t) => [t, 0])) as Record<RarityTier, number>;
  const scored = run.answers.filter((a) => a.status === 'accepted' && a.tier);
  for (const a of scored) tierCounts[a.tier as RarityTier] += 1;

  const tierRank = (a: AnswerRecord) => TIER_ORDER.indexOf(a.tier as RarityTier);
  const rarest =
    [...scored].sort((a, b) => tierRank(b) - tierRank(a) || (a.share ?? 1) - (b.share ?? 1))[0] ?? null;
  const best = [...scored].sort((a, b) => b.points - a.points || (a.share ?? 1) - (b.share ?? 1))[0] ?? null;

  const equipmentUsed: EquipmentId[] = [];
  for (const a of scored) if (a.equipment && !equipmentUsed.includes(a.equipment)) equipmentUsed.push(a.equipment);

  return {
    points: run.points,
    depth: run.depth,
    finalBiomeId: biomeAtDepth(run.depth).id,
    accepted: scored.length,
    best,
    rarest,
    equipmentUsed,
    discoveryIds: run.answers.map((a) => a.discoveryId).filter((d): d is string => !!d),
    tierCounts,
  };
}
