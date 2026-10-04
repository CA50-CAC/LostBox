/**
 * ============================================================================
 *  STUB: THE MATCHING ENGINE GOES HERE. Not implemented on purpose.
 * ============================================================================
 *
 * The student writes this (SPEC Section 6; CLAUDE.md: "The student writes the
 * matching package and evaluation code himself"). It has exactly the same
 * signature as `searchItems` (./search.ts), so when it's ready:
 *
 * 1. Implement `matchItems` (or import it from packages/matching).
 * 2. Run the evaluation: `pnpm eval` (eval/README.md). It already lists this
 *    function as system "B3" and compares it with the baselines B0 and B1.
 * 3. If it wins on the dev split and holds up on the test split, make
 *    `searchItems` call it. Nothing else in the app changes.
 *
 * Rules it must keep:
 * - Rank only what `students.listItems()` returns. That list is already
 *   limited to what students may see (no Staff-only items, no Limited notes
 *   or photos), so the ranker can't leak hidden items.
 * - Return ids best-first. Leaving an item out means "not a match".
 */
import type { SearchFilters } from "@/lib/domain/search";
import type { StudentRepo } from "@/lib/repo/interface";
import type { SearchResult } from "./search";

export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`${what} is not implemented yet`);
    this.name = "NotImplementedError";
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the stub keeps the real signature
export async function matchItems(students: StudentRepo, query: string, filters: SearchFilters = {}): Promise<SearchResult> {
  throw new NotImplementedError("matchItems (the matching engine)");
}
