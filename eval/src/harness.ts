/**
 * Runs every system over every query in one split and computes the metrics.
 *
 * The candidate pool for a query is every item in the same split: like a
 * school's lost-and-found box holding all of them at once. A query never gets
 * filters (a student typing into the search box), so systems rank on text alone.
 */
import { type Manifest, toStudentItems } from "./manifest";
import { computeMetrics, rankOf, type Metrics } from "./metrics";
import { splitOf, type Split, SPLIT_SEED } from "./split";
import { memoryStudentRepo, type System } from "./systems";

export interface SystemResult {
  id: string;
  name: string;
  status: "ok" | "not_implemented" | "error";
  error?: string;
  metrics: Metrics | null;
}

export interface SplitResult {
  split: Split | "all";
  items: number;
  queries: number;
  systems: SystemResult[];
}

/** Per-query ranks, for debugging only. Contains query text: never commit it. */
export interface QueryDetail {
  itemId: string;
  query: string;
  ranks: Record<string, number | null>;
}

export async function evaluateSplit(
  manifest: Manifest,
  manifestDir: string,
  systems: System[],
  split: Split | "all",
  seed: string = SPLIT_SEED,
): Promise<{ result: SplitResult; details: QueryDetail[] }> {
  const chosen = manifest.items.filter((i) => split === "all" || splitOf(i.id, seed) === split);
  const students = memoryStudentRepo(toStudentItems(chosen, manifestDir));
  const queries = chosen.flatMap((item) => item.queries.map((query) => ({ itemId: item.id, query })));
  const details: QueryDetail[] = queries.map((q) => ({ ...q, ranks: {} }));

  const results: SystemResult[] = [];
  for (const system of systems) {
    try {
      const ranks: Array<number | null> = [];
      for (const [i, q] of queries.entries()) {
        const { ids } = await system.run(students, q.query, {});
        const r = rankOf(ids, q.itemId);
        ranks.push(r);
        details[i].ranks[system.id] = r;
      }
      results.push({ id: system.id, name: system.name, status: "ok", metrics: computeMetrics(ranks) });
    } catch (e) {
      const notImplemented = e instanceof Error && e.name === "NotImplementedError";
      results.push({
        id: system.id,
        name: system.name,
        status: notImplemented ? "not_implemented" : "error",
        error: notImplemented ? undefined : e instanceof Error ? e.message : String(e),
        metrics: null,
      });
    }
  }
  return { result: { split, items: chosen.length, queries: queries.length, systems: results }, details };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/** A plain-text table for the terminal (and the README). */
export function formatTable(r: SplitResult): string {
  const head = ["System", "R@1", "R@3", "R@5", "MRR", "Median rank", "Found"];
  const rows = r.systems.map((s) =>
    s.metrics
      ? [
          `${s.id} ${s.name}`,
          pct(s.metrics.recallAt1),
          pct(s.metrics.recallAt3),
          pct(s.metrics.recallAt5),
          s.metrics.mrr.toFixed(3),
          s.metrics.medianRank === null ? "not found" : String(s.metrics.medianRank),
          pct(s.metrics.found),
        ]
      : [`${s.id} ${s.name}`, "—", "—", "—", "—", "—", "—"],
  );
  const notes = r.systems
    .filter((s) => !s.metrics)
    .map((s) => `${s.id}: ${s.status === "not_implemented" ? "not implemented yet" : `error: ${s.error}`}`);
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i].length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join("  ").trimEnd();
  return [
    `Split: ${r.split} (${r.items} items, ${r.queries} queries; candidate pool = all ${r.items} items)`,
    line(head),
    line(widths.map((w) => "-".repeat(w))),
    ...rows.map(line),
    ...(notes.length ? ["", ...notes] : []),
  ].join("\n");
}
