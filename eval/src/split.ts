/**
 * Dev/test split at the item level (SPEC 7.3): all queries for an item land on
 * the same side, so tuning on dev never sees a test item.
 *
 * Each item's side comes from a hash of (seed, item id), not from shuffling the
 * list. So adding new items later never moves existing ones to the other side,
 * and anyone with the same manifest and seed gets the same split.
 */
import { createHash } from "node:crypto";

export type Split = "dev" | "test";

/** Fixed. Changing it reshuffles everything and makes old results incomparable. */
export const SPLIT_SEED = "lostbox-eval-2026";

export function splitOf(itemId: string, seed: string = SPLIT_SEED): Split {
  const h = createHash("sha256").update(`${seed}:${itemId}`).digest();
  // First 4 bytes as a number in [0, 1): below one half is dev.
  return h.readUInt32BE(0) / 2 ** 32 < 0.5 ? "dev" : "test";
}
