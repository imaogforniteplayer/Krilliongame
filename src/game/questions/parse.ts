import { stemKey } from '../answerValidation/normalize';
import type { AnswerEntry, Category, Commonness, Difficulty, Exclusion, Question } from '../types';

/**
 * Compact authoring format so new questions are quick to add:
 *
 *   answers:    "Canonical name|commonness 1-6|alias one;alias two"
 *   exclusions: "typed answer|why it is rejected"
 *
 * Commonness is the curated estimate of how often players give the answer
 * (6 = very common … 1 = almost nobody thinks of it). Real player data refines it later.
 */
export interface QuestionSpec {
  id: string;
  text: string;
  category: Category;
  difficulty: Difficulty;
  packs?: string[];
  answers: string[];
  exclusions?: string[];
  explanation: string;
  verification?: string;
  /** Auto-alias "<canonical> <word>" for each answer, e.g. "Nile river". */
  addSuffix?: string[];
  /** Auto-alias "<word> <canonical>", e.g. "river Nile". */
  addPrefix?: string[];
  /** Auto-alias with a trailing word removed, e.g. "Mediterranean Sea" → "Mediterranean". */
  dropSuffix?: string[];
}

export const DEFAULT_VERIFICATION =
  'Author-compiled from general reference knowledge; needs independent editorial review before a ranked launch.';

export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseCommonness(raw: string | undefined, where: string): Commonness {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 6) throw new Error(`${where}: commonness must be 1-6, got "${raw}"`);
  return n as Commonness;
}

export function defineQuestion(spec: QuestionSpec): Question {
  const entries: AnswerEntry[] = spec.answers.map((line) => {
    const [canonicalRaw, commonRaw, aliasRaw] = line.split('|');
    const canonical = (canonicalRaw ?? '').trim();
    if (!canonical) throw new Error(`[${spec.id}] empty answer line "${line}"`);
    return {
      id: slugify(canonical),
      canonical,
      commonness: parseCommonness(commonRaw, `[${spec.id}] ${canonical}`),
      aliases: (aliasRaw ?? '')
        .split(';')
        .map((a) => a.trim())
        .filter(Boolean),
    };
  });

  const exclusions: Exclusion[] = (spec.exclusions ?? []).map((line) => {
    const cut = line.indexOf('|');
    if (cut < 1) throw new Error(`[${spec.id}] exclusion needs "term|reason": "${line}"`);
    return { term: line.slice(0, cut).trim(), reason: line.slice(cut + 1).trim() };
  });

  // Auto-generated aliases never override anything the author wrote by hand.
  const taken = new Set<string>();
  for (const e of entries) for (const f of [e.canonical, ...e.aliases]) taken.add(stemKey(f));
  for (const x of exclusions) taken.add(stemKey(x.term));
  const claim = (entry: AnswerEntry, alias: string) => {
    const key = stemKey(alias);
    if (!key || taken.has(key)) return;
    taken.add(key);
    entry.aliases.push(alias);
  };

  for (const e of entries) {
    for (const s of spec.addSuffix ?? []) claim(e, `${e.canonical} ${s}`);
    for (const p of spec.addPrefix ?? []) claim(e, `${p} ${e.canonical}`);
    for (const d of spec.dropSuffix ?? []) {
      const lower = e.canonical.toLowerCase();
      if (lower.endsWith(` ${d}`)) {
        const rest = e.canonical.slice(0, e.canonical.length - d.length - 1).trim();
        if (rest.length >= 4) claim(e, rest);
      }
    }
  }

  return {
    id: spec.id,
    text: spec.text,
    category: spec.category,
    difficulty: spec.difficulty,
    packs: spec.packs ?? [spec.category.toLowerCase()],
    entries,
    exclusions,
    explanation: spec.explanation,
    verification: spec.verification ?? DEFAULT_VERIFICATION,
    status: 'active',
  };
}
