const CHAR_MAP: Record<string, string> = {
  æ: 'ae',
  œ: 'oe',
  ø: 'o',
  ł: 'l',
  đ: 'd',
  ß: 'ss',
  þ: 'th',
  ð: 'd',
};

/**
 * Lower-cases, strips accents and harmless punctuation, collapses whitespace and drops a
 * leading article. "The  Nile!" → "nile", "Gruyère" → "gruyere", "Track & Field" → "track and field".
 */
export function normalizeAnswer(raw: string): string {
  let s = raw.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  s = s.replace(/[æœøłđßþð]/g, (c) => CHAR_MAP[c] ?? c);
  s = s.replace(/&/g, ' and ');
  s = s.replace(/['’‘`´]/g, '');
  s = s.replace(/[^a-z0-9\s]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/^(the|a|an)\s+/, '');
  return s;
}

/** Reduces the last word to a rough singular so "ribs"/"rib" and "Himalayas"/"Himalaya" match. */
export function singularize(word: string): string {
  if (word.length <= 3) return word;
  if (word.length > 4 && word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.length > 5 && /(ches|shes|xes|zes|sses|oes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('ss') || word.endsWith('us') || word.endsWith('is')) return word;
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/** The key used to compare answers: normalised, with the final word singularised. */
export function stemKey(raw: string): string {
  const n = normalizeAnswer(raw);
  if (!n) return '';
  const parts = n.split(' ');
  const last = parts.length - 1;
  parts[last] = singularize(parts[last] as string);
  return parts.join(' ');
}
