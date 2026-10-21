// Tiny fuzzy matcher for the Ctrl/⌘+K palette: the query's letters must appear in order (subsequence).
// Contiguous runs, word starts and an early first hit score higher. No library (docs/CLAUDE.md v0.35).

/** Score of `query` against `text`; null when it is not a subsequence. Higher is better. */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.toLowerCase().replace(/\s+/g, '')
  if (!q) return 0
  const t = text.toLowerCase()
  let score = 0
  let ti = 0
  let prev = -2
  for (const ch of q) {
    const i = t.indexOf(ch, ti)
    if (i === -1) return null
    score += 1
    if (i === prev + 1) score += 3 // contiguous
    if (i === 0 || /[\s\-·.,(/]/.test(t[i - 1])) score += 2 // word start
    prev = i
    ti = i + 1
  }
  const first = t.indexOf(q[0])
  return score - first * 0.05 - t.length * 0.01
}

/** Items matching `query`, best first (ties keep input order); an empty query keeps every item. */
export function fuzzyFilter<T>(items: T[], query: string, text: (item: T) => string): T[] {
  return items
    .map((item, i) => ({ item, i, s: fuzzyScore(query, text(item)) }))
    .filter((x): x is { item: T; i: number; s: number } => x.s !== null)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.item)
}
