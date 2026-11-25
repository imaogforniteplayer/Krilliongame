import { hashString } from '../rng';

/**
 * Friend Challenge codes. A code seeds the question set, so two people who enter the same code get
 * the same seven questions. Results are exchanged as short "result codes". There is no server in
 * demo mode, so a result code is self-reported: the checksum only catches typos, it does not prove
 * the score was earned. The UI says so.
 */

// No 0/O/1/I/L so codes survive being read aloud or typed from a screenshot.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_LEN = 6;

export function makeChallengeCode(rng: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < CODE_LEN; i++) out += ALPHABET[Math.floor(rng() * ALPHABET.length)];
  return `DEEP-${out}`;
}

/** Returns the canonical `DEEP-XXXXXX` form, or null if the text is not a valid code. */
export function parseChallengeCode(raw: string): string | null {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = cleaned.startsWith('DEEP') ? cleaned.slice(4) : cleaned;
  if (body.length !== CODE_LEN) return null;
  for (const ch of body) if (!ALPHABET.includes(ch)) return null;
  return `DEEP-${body}`;
}

export interface ChallengeResult {
  code: string;
  points: number;
  depth: number;
}

function checksum(code: string, points: number, depth: number): string {
  return (hashString(`result|${code}|${points}|${depth}`) % 1296).toString(36).toUpperCase().padStart(2, '0');
}

/** e.g. `DEEP-AB23CD.430.4300.7F` */
export function encodeResult(r: ChallengeResult): string {
  return `${r.code}.${r.points}.${r.depth}.${checksum(r.code, r.points, r.depth)}`;
}

export function decodeResult(raw: string): ChallengeResult | null {
  const parts = raw.trim().split('.');
  if (parts.length !== 4) return null;
  const [codeRaw, p, d, sum] = parts as [string, string, string, string];
  const code = parseChallengeCode(codeRaw);
  if (!code || !/^\d{1,5}$/.test(p) || !/^\d{1,6}$/.test(d)) return null;
  const points = Number(p);
  const depth = Number(d);
  if (checksum(code, points, depth) !== sum.toUpperCase()) return null;
  return { code, points, depth };
}

export type ChallengeVerdict = 'you' | 'them' | 'tie';

export function compareResults(mine: ChallengeResult, theirs: ChallengeResult): ChallengeVerdict {
  if (mine.points !== theirs.points) return mine.points > theirs.points ? 'you' : 'them';
  if (mine.depth !== theirs.depth) return mine.depth > theirs.depth ? 'you' : 'them';
  return 'tie';
}
