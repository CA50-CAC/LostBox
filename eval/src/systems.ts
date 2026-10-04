/**
 * The systems being compared (SPEC 7.1). Every one has the app's search
 * signature (`SearchFn`: students, query, filters → ranked ids), so the
 * numbers measured here are the numbers the app would ship.
 *
 * - B0 "Newest first": ignores the query. What a physical box (or a plain list)
 *   gives you: the floor.
 * - B1 "Keyword filter": the app's real `searchItems` today (category, color,
 *   and note words; every word must match; newest first). Imported, not copied.
 * - B3 "Matching": the matching engine stub (apps/web/src/lib/services/match.ts).
 *   Not implemented on purpose: the student writes it. Until then the harness
 *   reports it as "not implemented".
 */
import type { SearchFilters } from "@/lib/domain/search";
import type { StudentItem } from "@/lib/domain/visibility";
import type { PublicSchool, StudentItemFilters, StudentRepo } from "@/lib/repo/interface";
import { matchItems } from "@/lib/services/match";
import { searchItems, type SearchFn } from "@/lib/services/search";

export interface System {
  id: string;
  name: string;
  run: SearchFn;
}

export const newestFirst: SearchFn = async (students) => {
  const items = await students.listItems();
  const ids = [...items].sort((a, b) => Date.parse(b.foundAt) - Date.parse(a.foundAt) || a.id.localeCompare(b.id)).map((i) => i.id);
  return { ids, items: new Map(items.map((i) => [i.id, i])) };
};

export const SYSTEMS: System[] = [
  { id: "B0", name: "Newest first", run: newestFirst },
  { id: "B1", name: "Keyword filter (current app search)", run: searchItems },
  { id: "B3", name: "Matching engine", run: matchItems },
];

/**
 * A student data layer over a fixed list: what `forStudent(schoolId)` would
 * return if the school's box held exactly these items. Only the read methods
 * a ranker may use are implemented.
 */
export function memoryStudentRepo(items: StudentItem[]): StudentRepo {
  const school: PublicSchool = {
    id: "eval",
    slug: "eval",
    name: "Evaluation",
    logoPath: null,
    pickupLocation: null,
    pickupHours: null,
    donateAfterDays: 30,
  };
  const refuse = async () => {
    throw new Error("A ranker must not write data");
  };
  return {
    getSchool: async () => school,
    listLocationNames: async () => [...new Set(items.map((i) => i.foundLocationName))].sort(),
    listItems: async (f: StudentItemFilters = {}) =>
      items.filter(
        (i) =>
          (!f.categories?.length || f.categories.includes(i.category)) &&
          (!f.locationNames?.length || f.locationNames.includes(i.foundLocationName)) &&
          (!f.foundAfter || i.foundAt >= f.foundAfter) &&
          (!f.foundBefore || i.foundAt <= f.foundBefore),
      ),
    getItem: async (id) => items.find((i) => i.id === id) ?? null,
    createClaim: refuse,
    getClaimByCodeHash: async () => null,
  };
}

export type { SearchFilters };
