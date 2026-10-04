/**
 * The retention job on a real PGlite database and real files in a temp folder.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { openPglite } from "@/lib/db/pglite";
import type { ItemStatus } from "@/lib/domain/types";
import type { Repositories, StaffActor } from "@/lib/repo/interface";
import { createPgliteRepositories } from "@/lib/repo/pglite";
import { localStore, type PhotoStore } from "@/lib/server/photos";
import { runPhotoRetention } from "./retention";

const DAY = 24 * 60 * 60 * 1000;
let db: PGlite;
let repos: Repositories;
let staff: StaffActor;
let schoolId: string;
let gym: string;
let root: string;
let store: PhotoStore;

beforeAll(async () => {
  root = mkdtempSync(path.join(tmpdir(), "lostbox-retention-"));
  store = localStore("x".repeat(40), root);
  db = await openPglite();
  repos = createPgliteRepositories(db, { photoUrl: async (p) => `/p/${p}` });
  const { rows } = await db.query<{ id: string }>("insert into auth.users (email) values ('ret@school.edu') returning id");
  staff = { userId: rows[0].id, accessToken: null };
  const repo = repos.forStaff(staff);
  schoolId = (await repo.createSchool({ slug: "ret", name: "Ret High", district: null, timeZone: "UTC", logoPath: null, needsManualReview: false })).id;
  await repo.updatePolicies(schoolId, { photoRetentionDays: 7, donateAfterDays: 30, pickupLocation: "", pickupHours: "" });
  [gym] = (await repo.saveLocations(schoolId, ["Gym"], [])).map((l) => l.id);
}, 60_000);

afterAll(async () => {
  await db?.close();
  rmSync(root, { recursive: true, force: true });
});

/** An item with a real photo file, set to `status` with resolved_at `daysAgo` days ago. */
async function itemWithPhoto(status: ItemStatus, daysAgo: number | null) {
  const photoPath = await store.save(schoolId, new TextEncoder().encode("<svg/>"), "svg");
  const repo = repos.forStaff(staff);
  const item = await repo.createItem(schoolId, {
    category: "bag",
    colors: ["blue"],
    note: null,
    foundLocationId: gym,
    foundAt: new Date(Date.now() - 40 * DAY).toISOString(),
    visibility: "full",
    ownerHint: null,
    staffNote: null,
    photoPath,
  });
  if (status !== "available") await repo.setItemStatus(schoolId, [item.id], status);
  if (daysAgo !== null) {
    await db.query("update public.items set resolved_at = $2 where id = $1", [item.id, new Date(Date.now() - daysAgo * DAY).toISOString()]);
  }
  return { id: item.id, photoPath, file: path.join(root, photoPath) };
}

const photoOf = async (id: string) => (await repos.forStaff(staff).getItem(schoolId, id))?.photoPath ?? null;
const deletions = async () =>
  (await db.query<{ item_id: string }>("select item_id from public.audit_log where school_id = $1 and action = 'photo.deleted'", [schoolId])).rows.map(
    (r) => r.item_id,
  );

describe("runPhotoRetention", () => {
  it("deletes expired photos (file and path), keeps the rest, and logs each deletion", async () => {
    const returnedLongAgo = await itemWithPhoto("returned", 10);
    const donatedLongAgo = await itemWithPhoto("donated", 8);
    const returnedRecently = await itemWithPhoto("returned", 2);
    const stillAvailable = await itemWithPhoto("available", null);
    expect(existsSync(returnedLongAgo.file)).toBe(true);

    const result = await runPhotoRetention(repos.system(), (p) => store.remove(p));
    expect(result).toEqual({ deleted: 2, failed: 0 });

    for (const gone of [returnedLongAgo, donatedLongAgo]) {
      expect(existsSync(gone.file)).toBe(false);
      expect(await photoOf(gone.id)).toBeNull();
    }
    for (const kept of [returnedRecently, stillAvailable]) {
      expect(existsSync(kept.file)).toBe(true);
      expect(await photoOf(kept.id)).toBe(kept.photoPath);
    }
    expect((await deletions()).sort()).toEqual([returnedLongAgo.id, donatedLongAgo.id].sort());

    // Running again finds nothing new.
    expect(await runPhotoRetention(repos.system(), (p) => store.remove(p))).toEqual({ deleted: 0, failed: 0 });
  });

  it("keeps the database pointing at a photo it couldn't delete, so the next run retries", async () => {
    const stuck = await itemWithPhoto("removed", 30);
    const result = await runPhotoRetention(repos.system(), async () => {
      throw new Error("storage is down");
    });
    expect(result).toEqual({ deleted: 0, failed: 1 });
    expect(await photoOf(stuck.id)).toBe(stuck.photoPath);
    expect(await deletions()).not.toContain(stuck.id);

    expect(await runPhotoRetention(repos.system(), (p) => store.remove(p))).toEqual({ deleted: 1, failed: 0 });
    expect(existsSync(stuck.file)).toBe(false);
  });

  it("uses each school's own retention period", async () => {
    await repos.forStaff(staff).updatePolicies(schoolId, { photoRetentionDays: 60, donateAfterDays: 30, pickupLocation: "", pickupHours: "" });
    const item = await itemWithPhoto("returned", 30);
    expect((await runPhotoRetention(repos.system(), (p) => store.remove(p))).deleted).toBe(0);
    expect(existsSync(item.file)).toBe(true);
  });
});
