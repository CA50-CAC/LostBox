/** The "ready to donate" list and bulk donation, on a real PGlite database. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { openPglite } from "@/lib/db/pglite";
import { RepoError, type Repositories, type StaffActor } from "@/lib/repo/interface";
import { createPgliteRepositories } from "@/lib/repo/pglite";
import { donateCutoff, donateItems, listReadyToDonate } from "./donate";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-10T12:00:00Z");
let db: PGlite;
let repos: Repositories;
let owner: StaffActor;
let staff: StaffActor;
let otherOwner: StaffActor;
let schoolId: string;
let otherSchoolId: string;
let gym: string;
let otherGym: string;

async function user(email: string): Promise<StaffActor> {
  const { rows } = await db.query<{ id: string }>("insert into auth.users (email) values ($1) returning id", [email]);
  return { userId: rows[0].id, accessToken: null };
}

beforeAll(async () => {
  db = await openPglite();
  repos = createPgliteRepositories(db, { photoUrl: async (p) => `/p/${p}` });
  owner = await user("owner@a.edu");
  staff = await user("staff@a.edu");
  otherOwner = await user("owner@b.edu");
  const a = repos.forStaff(owner);
  schoolId = (await a.createSchool({ slug: "don-a", name: "A High", district: null, timeZone: "UTC", logoPath: null, needsManualReview: false })).id;
  [gym] = (await a.saveLocations(schoolId, ["Gym"], [])).map((l) => l.id);
  await db.query("insert into public.school_members (school_id, user_id, role) values ($1, $2, 'staff')", [schoolId, staff.userId]);
  const b = repos.forStaff(otherOwner);
  otherSchoolId = (await b.createSchool({ slug: "don-b", name: "B High", district: null, timeZone: "UTC", logoPath: null, needsManualReview: false })).id;
  [otherGym] = (await b.saveLocations(otherSchoolId, ["Gym"], [])).map((l) => l.id);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

async function item(actor: StaffActor, school: string, location: string, daysAgo: number) {
  return repos.forStaff(actor).createItem(school, {
    category: "clothing",
    colors: ["gray"],
    note: null,
    foundLocationId: location,
    foundAt: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
    visibility: "full",
    ownerHint: null,
    staffNote: null,
    photoPath: null,
  });
}

describe("ready to donate", () => {
  it("lists available items older than the threshold, oldest first, holding back pending claims", async () => {
    const old45 = await item(owner, schoolId, gym, 45);
    const old31 = await item(owner, schoolId, gym, 31);
    const recent = await item(owner, schoolId, gym, 10);
    const oldButReturned = await item(owner, schoolId, gym, 50);
    await repos.forStaff(owner).setItemStatus(schoolId, [oldButReturned.id], "returned");
    const oldWithClaim = await item(owner, schoolId, gym, 40);
    await repos.forStudent(schoolId).createClaim({ itemId: oldWithClaim.id, claimantDetail: "My name inside", contactEmail: null, codeHash: "don-claim" });

    const ready = await listReadyToDonate(repos.forStaff(owner), schoolId, 30, NOW);
    expect(ready.items.map((i) => i.id)).toEqual([old45.id, old31.id]);
    expect(ready.heldForClaims).toBe(1);
    expect(ready.items.map((i) => i.id)).not.toContain(recent.id);

    // A shorter threshold widens the list.
    expect((await listReadyToDonate(repos.forStaff(owner), schoolId, 7, NOW)).items.map((i) => i.id)).toContain(recent.id);
  });

  it("the cutoff is exactly N days before now", () => {
    expect(donateCutoff(30, NOW).toISOString()).toBe("2026-09-10T12:00:00.000Z");
  });

  it("marks chosen items donated (any staff member), and logs each one", async () => {
    const repo = repos.forStaff(staff);
    const { items } = await listReadyToDonate(repo, schoolId, 30, NOW);
    expect(await donateItems(repo, schoolId, 30, items.map((i) => i.id), NOW)).toBe(2);
    for (const i of items) expect((await repo.getItem(schoolId, i.id))?.status).toBe("donated");
    expect((await listReadyToDonate(repo, schoolId, 30, NOW)).items).toEqual([]);
    const log = await db.query<{ n: number }>("select count(*)::int as n from public.audit_log where school_id = $1 and action = 'item.donated'", [schoolId]);
    expect(log.rows[0].n).toBe(2);
  });

  it("refuses anything not on the list right now, and changes nothing", async () => {
    const ready = await item(owner, schoolId, gym, 60);
    const tooNew = await item(owner, schoolId, gym, 3);
    const repo = repos.forStaff(owner);
    await expect(donateItems(repo, schoolId, 30, [ready.id, tooNew.id], NOW)).rejects.toMatchObject({ code: "conflict" });
    expect((await repo.getItem(schoolId, ready.id))?.status).toBe("available");
    await expect(donateItems(repo, schoolId, 30, [], NOW)).rejects.toBeInstanceOf(RepoError);
  });

  it("can't reach another school's items", async () => {
    const theirs = await item(otherOwner, otherSchoolId, otherGym, 90);
    const mine = repos.forStaff(owner);
    // Asking about school B as an admin of school A sees nothing...
    expect((await listReadyToDonate(mine, otherSchoolId, 30, NOW)).items).toEqual([]);
    // ...and can't donate B's item through A's list either.
    await expect(donateItems(mine, schoolId, 30, [theirs.id], NOW)).rejects.toMatchObject({ code: "conflict" });
    await expect(donateItems(mine, otherSchoolId, 30, [theirs.id], NOW)).rejects.toBeInstanceOf(RepoError);
    expect((await repos.forStaff(otherOwner).getItem(otherSchoolId, theirs.id))?.status).toBe("available");
  });
});
