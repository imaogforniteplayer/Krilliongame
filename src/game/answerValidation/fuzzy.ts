/** Optimal string alignment distance: Levenshtein plus adjacent transpositions ("swfit" → "swift" = 1). */
export function osaDistance(a: string, b: string): number {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  const d: number[][] = [];
  for (let i = 0; i <= al; i++) {
    d.push(new Array<number>(bl + 1).fill(0));
    (d[i] as number[])[0] = i;
  }
  for (let j = 0; j <= bl; j++) (d[0] as number[])[j] = j;

  for (let i = 1; i <= al; i++) {
    const row = d[i] as number[];
    const prev = d[i - 1] as number[];
    for (let j = 1; j <= bl; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      let v = Math.min(prev[j] as number + 1, row[j - 1] as number + 1, prev[j - 1] as number + cost);
      if (i > 1 && j > 1 && a.charCodeAt(i - 1) === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === b.charCodeAt(j - 1)) {
        v = Math.min(v, (d[i - 2] as number[])[j - 2] as number + 1);
      }
      row[j] = v;
    }
  }
  return (d[al] as number[])[bl] as number;
}
