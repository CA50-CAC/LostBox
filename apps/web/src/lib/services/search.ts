/**
 * THE search hook (CLAUDE.md Section 5): every student search goes through
 * `searchItems(students, query, filters)`, which returns ranked item ids.
 *
 * Today it's a plain filter (src/lib/domain/search.ts). When the matching
 * engine (SPEC Section 6, packages/matching) is ready, it replaces the body of
 * this function and nothing else in the app needs to change.
 *
 * It takes the student data layer for one school, which already contains only
 * what students may see, so a smarter ranker can't leak hidden items either.
 */
import { filterItems, type SearchFilters } from "@/lib/domain/search";
import type { StudentItem } from "@/lib/domain/visibility";
import type { StudentRepo } from "@/lib/repo/interface";

/** Ranked ids (best first) plus the items they refer to. */
export interface SearchResult {
  ids: string[];
  items: Map<string, StudentItem>;
}

/** The shape every ranker must have: today's filter, the future matching engine, and the eval baselines. */
export type SearchFn = (students: StudentRepo, query: string, filters?: SearchFilters) => Promise<SearchResult>;

export async function searchItems(students: StudentRepo, query: string, filters: SearchFilters = {}): Promise<SearchResult> {
  const items = await students.listItems({
    categories: filters.categories,
    locationNames: filters.locationNames,
    foundAfter: filters.foundAfter,
    foundBefore: filters.foundBefore,
  });
  return { ids: filterItems(items, query, filters), items: new Map(items.map((i) => [i.id, i])) };
}
