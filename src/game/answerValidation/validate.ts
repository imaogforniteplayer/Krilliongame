import { GAME_CONFIG } from '../config';
import type { AnswerEntry, Question, ValidationResult } from '../types';
import { osaDistance } from './fuzzy';
import { normalizeAnswer, stemKey } from './normalize';

interface QuestionIndex {
  byKey: Map<string, AnswerEntry>;
  excluded: Map<string, string>;
  keys: string[];
}

const cache = new WeakMap<Question, QuestionIndex>();

/** Builds the lookup tables for a question. Throws on authoring mistakes so bad data fails loudly. */
export function buildIndex(question: Question): QuestionIndex {
  const byKey = new Map<string, AnswerEntry>();
  const excluded = new Map<string, string>();

  for (const entry of question.entries) {
    for (const form of [entry.canonical, ...entry.aliases]) {
      const key = stemKey(form);
      if (!key) throw new Error(`[${question.id}] "${form}" normalises to an empty answer`);
      const existing = byKey.get(key);
      if (existing && existing.id !== entry.id) {
        throw new Error(`[${question.id}] "${form}" (${entry.canonical}) collides with ${existing.canonical}`);
      }
      byKey.set(key, entry);
    }
  }
  for (const ex of question.exclusions) {
    const key = stemKey(ex.term);
    if (!key) throw new Error(`[${question.id}] exclusion "${ex.term}" normalises to nothing`);
    const clash = byKey.get(key);
    if (clash) throw new Error(`[${question.id}] exclusion "${ex.term}" is also accepted as ${clash.canonical}`);
    excluded.set(key, ex.reason);
  }
  return { byKey, excluded, keys: [...byKey.keys()] };
}

function indexFor(question: Question): QuestionIndex {
  let idx = cache.get(question);
  if (!idx) {
    idx = buildIndex(question);
    cache.set(question, idx);
  }
  return idx;
}

function toleranceFor(keyLength: number): number {
  const f = GAME_CONFIG.fuzzy;
  if (keyLength < f.minLengthForTolerance) return 0;
  return keyLength >= 9 ? f.toleranceLong : f.toleranceMedium;
}

/**
 * Checks a typed answer against a question's curated answer list. Never consults an AI model:
 * anything not on the list (or a sensible spelling of something on it) is "unknown" and is
 * queued for human review rather than guessed at.
 */
export function validateAnswer(question: Question, raw: string): ValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) return { status: 'empty' };
  if (trimmed.length > GAME_CONFIG.maxAnswerLength) {
    return { status: 'invalid', reason: `Answers can be up to ${GAME_CONFIG.maxAnswerLength} characters.` };
  }
  const key = stemKey(trimmed);
  if (!key) return { status: 'invalid', reason: 'Please answer with letters or numbers.' };

  const idx = indexFor(question);
  const normalized = normalizeAnswer(trimmed);

  const exact = idx.byKey.get(key);
  if (exact) return { status: 'accepted', entry: exact, matchType: 'exact', normalized };

  const excludedReason = idx.excluded.get(key);
  if (excludedReason !== undefined) return { status: 'excluded', reason: excludedReason, normalized };

  // Spelling tolerance: only when exactly one answer is the clear best match.
  let bestDistance = Infinity;
  const bestEntries = new Map<string, AnswerEntry>();
  for (const candidate of idx.keys) {
    const tol = toleranceFor(candidate.length);
    if (tol === 0 || Math.abs(candidate.length - key.length) > tol) continue;
    const dist = osaDistance(key, candidate);
    if (dist > tol) continue;
    const entry = idx.byKey.get(candidate) as AnswerEntry;
    if (dist < bestDistance) {
      bestDistance = dist;
      bestEntries.clear();
      bestEntries.set(entry.id, entry);
    } else if (dist === bestDistance) {
      bestEntries.set(entry.id, entry);
    }
  }
  if (bestEntries.size === 1) {
    const [entry] = [...bestEntries.values()];
    return { status: 'accepted', entry: entry as AnswerEntry, matchType: 'fuzzy', normalized };
  }
  if (bestEntries.size > 1) return { status: 'ambiguous', normalized };

  return { status: 'unknown', normalized };
}
