/**
 * Ranking metrics (SPEC 7.2). Input: for each query, the 1-based rank of the
 * right item in the system's results, or null if the system didn't return it.
 *
 * - Recall@k: share of queries whose item is in the top k.
 * - MRR (mean reciprocal rank): average of 1/rank (0 when missing). 1.0 means
 *   always first; 0.5 means "second, on average-ish".
 * - Median rank: the middle rank. Misses count as "after everything", so if
 *   more than half the queries miss, the median is reported as null ("not found").
 * - Found: share of queries where the item was returned at all.
 */
export interface Metrics {
  queries: number;
  recallAt1: number;
  recallAt3: number;
  recallAt5: number;
  mrr: number;
  medianRank: number | null;
  found: number;
}

export function computeMetrics(ranks: Array<number | null>): Metrics {
  const n = ranks.length;
  if (n === 0) return { queries: 0, recallAt1: 0, recallAt3: 0, recallAt5: 0, mrr: 0, medianRank: null, found: 0 };
  const within = (k: number) => ranks.filter((r) => r !== null && r <= k).length / n;
  const sorted = ranks.map((r) => r ?? Infinity).sort((a, b) => a - b);
  const mid = Math.floor(n / 2);
  const median = n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return {
    queries: n,
    recallAt1: within(1),
    recallAt3: within(3),
    recallAt5: within(5),
    mrr: ranks.reduce<number>((a, r) => a + (r ? 1 / r : 0), 0) / n,
    medianRank: Number.isFinite(median) ? median : null,
    found: ranks.filter((r) => r !== null).length / n,
  };
}

/** 1-based rank of `id` in a best-first list, or null. */
export function rankOf(ids: string[], id: string): number | null {
  const i = ids.indexOf(id);
  return i === -1 ? null : i + 1;
}
