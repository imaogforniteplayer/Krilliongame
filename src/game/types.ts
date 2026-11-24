export type RarityTier = 'pebble' | 'copper' | 'quartz' | 'obsidian' | 'void' | 'corebound';

export const TIER_ORDER: readonly RarityTier[] = [
  'pebble',
  'copper',
  'quartz',
  'obsidian',
  'void',
  'corebound',
] as const;

/** 6 = answered by lots of players, 1 = almost nobody thinks of it. Seeds the estimated share. */
export type Commonness = 1 | 2 | 3 | 4 | 5 | 6;

export type Difficulty = 'easy' | 'medium' | 'hard';

export type Category =
  | 'Animals'
  | 'Geography'
  | 'History'
  | 'Science'
  | 'Technology'
  | 'Gaming'
  | 'Sport'
  | 'Movies'
  | 'Nature'
  | 'Mining'
  | 'Food';

export interface AnswerEntry {
  id: string;
  /** Display form, e.g. "Giant tortoise". */
  canonical: string;
  commonness: Commonness;
  aliases: string[];
}

export interface Exclusion {
  term: string;
  reason: string;
}

export interface Question {
  id: string;
  text: string;
  category: Category;
  difficulty: Difficulty;
  packs: string[];
  entries: AnswerEntry[];
  exclusions: Exclusion[];
  explanation: string;
  verification: string;
  status: 'active' | 'draft' | 'retired';
}

export type ValidationResult =
  | { status: 'accepted'; entry: AnswerEntry; matchType: 'exact' | 'fuzzy'; normalized: string }
  | { status: 'excluded'; reason: string; normalized: string }
  | { status: 'unknown'; normalized: string }
  | { status: 'ambiguous'; normalized: string }
  | { status: 'invalid'; reason: string }
  | { status: 'empty' };

export type RaritySource = 'estimated' | 'observed';

export interface RarityResult {
  tier: RarityTier;
  /** Fraction of players expected / observed to give this answer (0..1). */
  share: number;
  source: RaritySource;
  sampleSize: number;
}

export interface QuestionStats {
  total: number;
  counts: Record<string, number>;
}

export type EquipmentId =
  | 'shovel'
  | 'pickaxe'
  | 'jackhammer'
  | 'pneumatic-drill'
  | 'excavator'
  | 'tunnel-borer';

export type AnswerStatus =
  | 'accepted'
  | 'excluded'
  | 'unknown'
  | 'ambiguous'
  | 'invalid'
  | 'empty'
  | 'timeout';
