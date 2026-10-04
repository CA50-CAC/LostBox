/**
 * "Ready to donate": items still on the shelf (available) that were found more
 * than the school's donate-after period ago (default 30 days). Staff check them
 * and mark them donated in bulk.
 *
 * Items with a pending claim are held back: a student is waiting to hear about
 * them, so staff should decide the claim first.
 *
 * Marking goes through the staff data layer, so RLS applies, and
 * setItemStatus writes one "item.donated" audit entry per item.
 */
import type { StaffItem } from "@/lib/domain/types";
import { RepoError, type StaffRepo } from "@/lib/repo/interface";

const DAY_MS = 24 * 60 * 60 * 1000;

export function donateCutoff(donateAfterDays: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - donateAfterDays * DAY_MS);
}

export interface ReadyToDonate {
  /** Oldest first. */
  items: StaffItem[];
  /** Old enough, but someone has a pending claim on them. */
  heldForClaims: number;
}

export async function listReadyToDonate(repo: StaffRepo, schoolId: string, donateAfterDays: number, now: Date = new Date()): Promise<ReadyToDonate> {
  const [old, pending] = await Promise.all([
    repo.listItems(schoolId, { statuses: ["available"], foundBefore: donateCutoff(donateAfterDays, now).toISOString() }),
    repo.listClaims(schoolId, ["pending"]),
  ]);
  const claimed = new Set(pending.map((c) => c.itemId));
  const items = old.filter((i) => !claimed.has(i.id)).sort((a, b) => a.foundAt.localeCompare(b.foundAt));
  return { items, heldForClaims: old.length - items.length };
}

/**
 * Marks the chosen items donated. Every id must be on the ready list right
 * now (checked on the server, not trusted from the form); otherwise nothing
 * changes and RepoError("conflict") is thrown, so the page can say "the list
 * changed, check again".
 */
export async function donateItems(
  repo: StaffRepo,
  schoolId: string,
  donateAfterDays: number,
  itemIds: string[],
  now: Date = new Date(),
): Promise<number> {
  const ids = [...new Set(itemIds)];
  if (ids.length === 0) throw new RepoError("invalid", "Choose at least one item");
  const ready = new Set((await listReadyToDonate(repo, schoolId, donateAfterDays, now)).items.map((i) => i.id));
  if (!ids.every((id) => ready.has(id))) throw new RepoError("conflict", "Some items are no longer ready to donate");
  await repo.setItemStatus(schoolId, ids, "donated", "ready to donate");
  return ids.length;
}
