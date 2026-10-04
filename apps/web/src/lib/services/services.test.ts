/**
 * The claim decision flow and the search hook, on a real (in-memory) PGlite
 * database through the real data layer.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { openPglite } from "@/lib/db/pglite";
import { RepoError, type Repositories, type StaffActor } from "@/lib/repo/interface";
import { createPgliteRepositories } from "@/lib/repo/pglite";
import { decideClaim } from "./claims";
import { reviewSchool } from "./schools";
import { searchItems } from "./search";

let db: PGlite;
let repos: Repositories;
let staff: StaffActor;
let schoolId: string;
let gym: string;

beforeAll(async () => {
  db = await openPglite();
  repos = createPgliteRepositories(db, { photoUrl: async (p) => `/p/${p}` });
  const { rows } = await db.query<{ id: string }>("insert into auth.users (email) values ('o@school.edu') returning id");
  staff = { userId: rows[0].id, accessToken: null };
  const school = await repos.forStaff(staff).createSchool({ slug: "svc", name: "Svc High", district: null, timeZone: "UTC", logoPath: null, needsManualReview: false });
  schoolId = school.id;
  [gym] = (await repos.forStaff(staff).saveLocations(schoolId, ["Gym"], [])).map((l) => l.id);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

async function itemWithClaim(code: string) {
  const item = await repos.forStaff(staff).createItem(schoolId, {
    category: "bag",
    colors: ["blue"],
    note: "Star keychain",
    foundLocationId: gym,
    foundAt: "2026-09-20T12:00:00Z",
    visibility: "full",
    ownerHint: null,
    staffNote: null,
    photoPath: null,
  });
  await repos.forStudent(schoolId).createClaim({ itemId: item.id, claimantDetail: "It has my bus pass", contactEmail: null, codeHash: code });
  const claim = (await repos.forStaff(staff).listClaims(schoolId)).find((c) => c.itemId === item.id)!;
  return { item, claim };
}

describe("decideClaim", () => {
  it("approve holds the item; picked up returns it", async () => {
    const repo = repos.forStaff(staff);
    const { item, claim } = await itemWithClaim("h1");
    await decideClaim(repo, schoolId, claim.id, "approve");
    expect((await repo.getItem(schoolId, item.id))?.status).toBe("claimed");
    expect(await repos.forStudent(schoolId).getItem(item.id)).toBeNull();
    await decideClaim(repo, schoolId, claim.id, "picked_up");
    expect((await repo.getClaim(schoolId, claim.id))?.status).toBe("picked_up");
    expect((await repo.getItem(schoolId, item.id))?.status).toBe("returned");
  });

  it("rejecting an approved claim puts the item back on the shelf", async () => {
    const repo = repos.forStaff(staff);
    const { item, claim } = await itemWithClaim("h2");
    await decideClaim(repo, schoolId, claim.id, "approve");
    await decideClaim(repo, schoolId, claim.id, "reject");
    expect((await repo.getItem(schoolId, item.id))?.status).toBe("available");
  });

  it("can't mark picked up before approval, or approve twice", async () => {
    const repo = repos.forStaff(staff);
    const { claim } = await itemWithClaim("h3");
    await expect(decideClaim(repo, schoolId, claim.id, "picked_up")).rejects.toBeInstanceOf(RepoError);
    await decideClaim(repo, schoolId, claim.id, "approve");
    await expect(decideClaim(repo, schoolId, claim.id, "approve")).rejects.toBeInstanceOf(RepoError);
  });
});

describe("searchItems", () => {
  it("returns ranked ids of student-visible items matching the text", async () => {
    const repo = repos.forStaff(staff);
    const hidden = await repo.createItem(schoolId, {
      category: "bag", colors: ["blue"], note: "Star keychain", foundLocationId: gym, foundAt: "2026-09-21T12:00:00Z",
      visibility: "staff_only", ownerHint: null, staffNote: null, photoPath: null,
    });
    const { ids, items } = await searchItems(repos.forStudent(schoolId), "blue star");
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).not.toContain(hidden.id);
    expect(ids.every((id) => items.get(id)?.category === "bag")).toBe(true);
    expect((await searchItems(repos.forStudent(schoolId), "purple unicorn")).ids).toEqual([]);
  });
});

describe("reviewSchool", () => {
  const admin = { email: "platform@lostbox.test", isPlatformAdmin: true };

  it("approving turns the join code on, rejecting turns it off again", async () => {
    const school = (await repos.forStaff(staff).getSchool(schoolId))!;
    expect(school.status).toBe("pending_review");
    expect(await repos.system().findJoinableSchool(school.joinCode)).toBeNull();

    expect(await reviewSchool(repos.platform(), admin, schoolId, "approve")).toBe("approved");
    expect((await repos.system().findJoinableSchool(school.joinCode))?.id).toBe(schoolId);
    const listed = (await repos.platform().listSchools("approved")).find((s) => s.id === schoolId);
    expect(listed?.ownerEmail).toBe("o@school.edu");

    await reviewSchool(repos.platform(), admin, schoolId, "reject");
    expect(await repos.system().findJoinableSchool(school.joinCode)).toBeNull();
    await reviewSchool(repos.platform(), admin, schoolId, "reopen");
    expect((await repos.forStaff(staff).getSchool(schoolId))?.status).toBe("pending_review");
  });

  it("refuses anyone who isn't a platform admin", async () => {
    await expect(
      reviewSchool(repos.platform(), { email: "o@school.edu", isPlatformAdmin: false }, schoolId, "approve"),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect((await repos.forStaff(staff).getSchool(schoolId))?.status).toBe("pending_review");
  });

  it("refuses an unknown decision", async () => {
    await expect(reviewSchool(repos.platform(), admin, schoolId, "delete" as never)).rejects.toBeInstanceOf(RepoError);
  });
});
