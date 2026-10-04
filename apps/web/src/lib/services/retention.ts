/**
 * Photo retention: once an item is resolved (returned, donated, or removed),
 * its photo is deleted after the school's retention period (default 7 days).
 * The item row stays, so the history and stats still work, just without a picture.
 *
 * Runs daily from /api/cron/retention. Order matters: the file goes first, then
 * the database forgets the path. If deleting the file fails, the item still
 * points at it, so tomorrow's run tries again. If the database step fails after
 * the file is gone, tomorrow's run deletes a file that's already gone (harmless)
 * and then clears the path.
 */
import type { SystemRepo } from "@/lib/repo/interface";

export interface RetentionResult {
  deleted: number;
  failed: number;
}

export async function runPhotoRetention(
  system: Pick<SystemRepo, "listExpiredPhotos" | "clearPhoto">,
  removeFile: (photoPath: string) => Promise<void>,
  now: Date = new Date(),
): Promise<RetentionResult> {
  const expired = await system.listExpiredPhotos(now);
  const result: RetentionResult = { deleted: 0, failed: 0 };
  for (const { itemId, photoPath } of expired) {
    try {
      await removeFile(photoPath);
      await system.clearPhoto(itemId);
      result.deleted++;
    } catch (err) {
      // One bad file shouldn't stop the rest. Logged without the path or item details.
      console.error("Photo retention: couldn't delete one photo", err instanceof Error ? err.message : err);
      result.failed++;
    }
  }
  return result;
}
