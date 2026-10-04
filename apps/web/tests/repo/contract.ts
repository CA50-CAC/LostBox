/**
 * The repository contract: one set of tests that every adapter must pass.
 *
 * tests/repo/pglite.test.ts runs it on PGlite (default, CI).
 * tests/repo/supabase.test.ts runs it on a hosted Supabase project
 * (`pnpm test:supabase`, opt-in).
 *
 * Unlike tests/db (which checks the SQL rules directly), these go through the
 * app's own data layer, so they also catch adapter bugs: a missing school
 * filter, a mapped column that leaks, an error that's silently swallowed.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PRESETS } from "@/lib/domain/categories";
import { CODE_ALPHABET } from "@/lib/domain/codes";
import type { StudentItem } from "@/lib/domain/visibility";
import { RepoError, type NewItemInput, type Repositories, type School, type StaffActor } from "@/lib/repo/interface";

export interface RepoHarness {
  repos: Repositories;
  /** Unique per run; used in slugs and emails. */
  runId: string;
  /** Slug prefix the harness deletes on close. */
  slugPrefix: string;
  /** Creates a user who can sign in, and returns them as a staff actor. */
  newStaff(email: string): Promise<StaffActor>;
  /** Reads a school's audit log as the database owner (the app has no reader yet). */
  auditActions(schoolId: string): Promise<string[]>;
  close(): Promise<void>;
}

export const PHOTO_URL_PREFIX = "https://photos.test/";
export const stubPhotoUrl = async (path: string) => `${PHOTO_URL_PREFIX}${path}`;

async function expectRepoError(p: Promise<unknown>, code: RepoError["code"]) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err, `expected RepoError(${code})`).toBeInstanceOf(RepoError);
  expect((err as RepoError).code).toBe(code);
}

export function repositoryContract(name: string, open: () => Promise<RepoHarness>) {
  describe(`repository contract (${name})`, () => {
    let h: RepoHarness;
    let ownerA: StaffActor;
    let staffA: StaffActor;
    let ownerB: StaffActor;
    let schoolA: School;
    let schoolB: School;
    let gymA: string;
    let libraryA: string;
    let gymB: string;
    const email = (who: string) => `${h.slugPrefix}${who}@example.com`;
    const slug = (who: string) => `${h.slugPrefix}${who}`;

    const item = (locationId: string, overrides: Partial<NewItemInput> = {}): NewItemInput => ({
      category: "bottle_lunchbox",
      colors: ["black"],
      note: "Dented near the lid",
      foundLocationId: locationId,
      foundAt: "2026-09-20T15:00:00.000Z",
      visibility: "full",
      ownerHint: null,
      staffNote: null,
      photoPath: null,
      ...overrides,
    });

    beforeAll(async () => {
      h = await open();
      ownerA = await h.newStaff(email("owner-a"));
      staffA = await h.newStaff(email("staff-a"));
      ownerB = await h.newStaff(email("owner-b"));

      const profile = { district: null, timeZone: "America/Los_Angeles", logoPath: null, needsManualReview: false };
      schoolA = await h.repos.forStaff(ownerA).createSchool({ ...profile, slug: slug("a"), name: "Test School A" });
      schoolB = await h.repos.forStaff(ownerB).createSchool({ ...profile, slug: slug("b"), name: "Test School B" });

      [gymA, libraryA] = (await h.repos.forStaff(ownerA).saveLocations(schoolA.id, ["Gym", "Library"], [])).map((l) => l.id);
      [gymB] = (await h.repos.forStaff(ownerB).saveLocations(schoolB.id, ["Gym"], [])).map((l) => l.id);

      // Staff A joins School A the only way the database allows: an invite.
      await h.repos.forStaff(ownerA).createInvite(schoolA.id, email("staff-a"), "staff", `hash-${h.runId}-staff-a`);
      expect(await h.repos.forStaff(staffA).acceptInvite(`hash-${h.runId}-staff-a`)).toEqual({ schoolId: schoolA.id });
    }, 120_000);

    afterAll(async () => {
      await h?.close();
    }, 60_000);

    // ---------- Schools ----------

    describe("schools", () => {
      it("createSchool makes a pending school, owned by the caller, with a database-generated join code", () => {
        expect(schoolA).toMatchObject({ slug: slug("a"), name: "Test School A", status: "pending_review", setupStep: 2 });
        expect(schoolA.joinCode).toMatch(new RegExp(`^[${CODE_ALPHABET}]{8}$`));
      });

      it("a taken slug is a conflict", async () => {
        expect(await h.repos.system().isSlugTaken(slug("a"))).toBe(true);
        expect(await h.repos.system().isSlugTaken(slug("nobody"))).toBe(false);
        await expectRepoError(
          h.repos.forStaff(ownerB).createSchool({
            slug: slug("a"),
            name: "Copycat",
            district: null,
            timeZone: "UTC",
            logoPath: null,
            needsManualReview: false,
          }),
          "conflict",
        );
      });

      it("mySchools lists the caller's schools with their role", async () => {
        expect((await h.repos.forStaff(ownerA).mySchools()).map((s) => [s.id, s.role])).toEqual([[schoolA.id, "owner"]]);
        expect((await h.repos.forStaff(staffA).mySchools()).map((s) => [s.id, s.role])).toEqual([[schoolA.id, "staff"]]);
      });

      it("owners update the profile and policies", async () => {
        const repo = h.repos.forStaff(ownerA);
        await repo.updateProfile(schoolA.id, { name: "Test School A2", district: "D1", timeZone: "America/Denver", logoPath: null });
        await repo.updatePolicies(schoolA.id, {
          photoRetentionDays: 14,
          donateAfterDays: 45,
          pickupLocation: "Front office",
          pickupHours: "8-4",
        });
        expect(await repo.getSchool(schoolA.id)).toMatchObject({
          name: "Test School A2",
          district: "D1",
          timeZone: "America/Denver",
          photoRetentionDays: 14,
          donateAfterDays: 45,
          pickupLocation: "Front office",
          pickupHours: "8-4",
        });
      });

      it("staff (not owners) can't change school settings", async () => {
        await expectRepoError(
          h.repos.forStaff(staffA).updateProfile(schoolA.id, { name: "Hijacked", district: null, timeZone: "UTC", logoPath: null }),
          "not_found",
        );
      });

      it("the setup step only moves forward, and launch sets it to 7", async () => {
        const repo = h.repos.forStaff(ownerA);
        await repo.setSetupStep(schoolA.id, 4);
        await repo.setSetupStep(schoolA.id, 3);
        expect((await repo.getSchool(schoolA.id))?.setupStep).toBe(4);
        await repo.markLaunched(schoolA.id);
        const school = await repo.getSchool(schoolA.id);
        expect(school?.setupStep).toBe(7);
        expect(school?.launchedAt).not.toBeNull();
      });

      it("owners rotate the join code; staff can't", async () => {
        const before = (await h.repos.forStaff(ownerA).getSchool(schoolA.id))!.joinCode;
        const after = await h.repos.forStaff(ownerA).rotateJoinCode(schoolA.id);
        expect(after).not.toBe(before);
        expect((await h.repos.forStaff(ownerA).getSchool(schoolA.id))!.joinCode).toBe(after);
        expect(await h.auditActions(schoolA.id)).toContain("join_code.rotated");
        await expectRepoError(h.repos.forStaff(staffA).rotateJoinCode(schoolA.id), "forbidden");
      });

      it("pending schools can't be joined; approved ones can", async () => {
        const code = (await h.repos.forStaff(ownerB).getSchool(schoolB.id))!.joinCode;
        expect(await h.repos.system().findJoinableSchool(code)).toBeNull();
        expect(await h.repos.forStudent(schoolB.id).getSchool()).toBeNull();
        expect(await h.repos.system().findSchoolBySlug(slug("b"))).toMatchObject({ id: schoolB.id, status: "pending_review" });

        await h.repos.platform().setSchoolStatus(schoolB.id, "approved", "admin@example.com");
        expect(await h.repos.system().findJoinableSchool(code)).toMatchObject({ id: schoolB.id, slug: slug("b") });
        expect(await h.repos.forStudent(schoolB.id).getSchool()).toMatchObject({ id: schoolB.id, name: "Test School B" });

        await h.repos.platform().setSchoolStatus(schoolA.id, "approved", "admin@example.com");
      });

      it("the public school shape has no join code or other admin fields", async () => {
        const pub = await h.repos.system().findSchoolBySlug(slug("b"));
        expect(Object.keys(pub!).sort()).toEqual(
          ["donateAfterDays", "id", "logoPath", "name", "pickupHours", "pickupLocation", "slug", "status"].sort(),
        );
      });

      it("the platform lists schools with the founder's email", async () => {
        const list = await h.repos.platform().listSchools("approved");
        const a = list.find((s) => s.id === schoolA.id);
        expect(a?.ownerEmail).toBe(email("owner-a"));
      });
    });

    // ---------- Locations and categories ----------

    describe("locations", () => {
      it("saves the order, keeps ids for existing names, and stores nearby links", async () => {
        const repo = h.repos.forStaff(ownerA);
        const saved = await repo.saveLocations(schoolA.id, ["Library", " Gym ", "Cafeteria", "gym"], [["Gym", "Cafeteria"]]);
        expect(saved.map((l) => l.name)).toEqual(["Library", "Gym", "Cafeteria"]);
        expect(saved.find((l) => l.name === "Gym")?.id).toBe(gymA);
        expect(saved.find((l) => l.name === "Library")?.id).toBe(libraryA);
        const cafeteria = saved.find((l) => l.name === "Cafeteria")!.id;
        expect(await repo.listLocationLinks(schoolA.id)).toEqual([{ a: [gymA, cafeteria].sort()[0], b: [gymA, cafeteria].sort()[1] }]);
        expect(await h.repos.forStudent(schoolA.id).listLocationNames()).toEqual(["Library", "Gym", "Cafeteria"]);
      });

      it("a location that items point to can't be removed", async () => {
        const repo = h.repos.forStaff(ownerA);
        await repo.createItem(schoolA.id, item(libraryA, { note: "location-in-use" }));
        await expectRepoError(repo.saveLocations(schoolA.id, ["Gym"], []), "conflict");
        expect((await repo.listLocations(schoolA.id)).map((l) => l.name)).toContain("Library");
      });

      it("an unused location can be removed", async () => {
        const repo = h.repos.forStaff(ownerA);
        const saved = await repo.saveLocations(schoolA.id, ["Library", "Gym"], []);
        expect(saved.map((l) => l.name)).toEqual(["Library", "Gym"]);
      });
    });

    describe("category defaults", () => {
      it("falls back to the Standard preset, then saves and reads back", async () => {
        const repo = h.repos.forStaff(ownerA);
        expect(await repo.getCategoryDefaults(schoolA.id)).toEqual(PRESETS.standard);
        await repo.saveCategoryDefaults(schoolA.id, PRESETS.strict);
        expect(await repo.getCategoryDefaults(schoolA.id)).toEqual(PRESETS.strict);
      });

      it("wallets can't default to Full", async () => {
        await expectRepoError(
          h.repos.forStaff(ownerA).saveCategoryDefaults(schoolA.id, { ...PRESETS.open, wallet_id: "full" }),
          "invalid",
        );
      });
    });

    // ---------- Staff ----------

    describe("members and invites", () => {
      it("lists members with emails", async () => {
        const members = await h.repos.forStaff(staffA).listMembers(schoolA.id);
        expect(members.map((m) => [m.email, m.role]).sort()).toEqual(
          [
            [email("owner-a"), "owner"],
            [email("staff-a"), "staff"],
          ].sort(),
        );
      });

      it("an invite only works for the email it was sent to, and only once", async () => {
        const repo = h.repos.forStaff(ownerA);
        await repo.createInvite(schoolA.id, email("someone-else"), "staff", `hash-${h.runId}-x`);
        expect(await h.repos.forStaff(ownerB).acceptInvite(`hash-${h.runId}-x`)).toBeNull();
        expect(await h.repos.forStaff(staffA).acceptInvite(`hash-${h.runId}-staff-a`)).toBeNull();
      });

      it("owners list and revoke invites; staff see none", async () => {
        const repo = h.repos.forStaff(ownerA);
        const invite = await repo.createInvite(schoolA.id, email("revoke-me"), "owner", `hash-${h.runId}-revoke`);
        expect(invite).toMatchObject({ email: email("revoke-me"), role: "owner", acceptedAt: null });
        expect((await repo.listInvites(schoolA.id)).map((i) => i.id)).toContain(invite.id);
        expect(await h.repos.forStaff(staffA).listInvites(schoolA.id)).toEqual([]);
        await repo.revokeInvite(schoolA.id, invite.id);
        expect((await repo.listInvites(schoolA.id)).map((i) => i.id)).not.toContain(invite.id);
        await expectRepoError(repo.revokeInvite(schoolA.id, invite.id), "not_found");
      });
    });

    // ---------- Items ----------

    describe("items", () => {
      it("staff create an item and get every field back, including private ones", async () => {
        const created = await h.repos.forStaff(staffA).createItem(
          schoolA.id,
          item(gymA, {
            category: "electronics",
            colors: ["black", "silver"],
            note: "Cracked corner",
            visibility: "limited",
            ownerHint: "Name: J. Rivera",
            staffNote: "In drawer 2",
            photoPath: `${schoolA.id}/phone.jpg`,
          }),
        );
        expect(created).toMatchObject({
          schoolId: schoolA.id,
          status: "available",
          category: "electronics",
          colors: ["black", "silver"],
          note: "Cracked corner",
          foundLocationId: gymA,
          foundLocationName: "Gym",
          foundAt: "2026-09-20T15:00:00.000Z",
          visibility: "limited",
          ownerHint: "Name: J. Rivera",
          staffNote: "In drawer 2",
          photoPath: `${schoolA.id}/phone.jpg`,
          resolvedAt: null,
        });
        expect(await h.repos.forStaff(ownerA).getItem(schoolA.id, created.id)).toEqual(created);
      });

      it("updates only the fields given", async () => {
        const repo = h.repos.forStaff(staffA);
        const created = await repo.createItem(schoolA.id, item(gymA, { note: "before", staffNote: "keep me" }));
        await repo.updateItem(schoolA.id, created.id, { note: "after", foundLocationId: libraryA });
        expect(await repo.getItem(schoolA.id, created.id)).toMatchObject({
          note: "after",
          staffNote: "keep me",
          foundLocationName: "Library",
          category: "bottle_lunchbox",
        });
      });

      it("wallets can't be Full, and photos must be in the school's folder", async () => {
        const repo = h.repos.forStaff(staffA);
        await expectRepoError(repo.createItem(schoolA.id, item(gymA, { category: "wallet_id", visibility: "full" })), "invalid");
        await expectRepoError(repo.createItem(schoolA.id, item(gymA, { photoPath: `${schoolB.id}/x.jpg` })), "invalid");
      });

      it("filters by status, category, location, and found-before", async () => {
        const repo = h.repos.forStaff(staffA);
        const old = await repo.createItem(schoolA.id, item(libraryA, { category: "keys", foundAt: "2026-01-01T00:00:00.000Z" }));
        expect((await repo.listItems(schoolA.id, { categories: ["keys"] })).map((i) => i.id)).toEqual([old.id]);
        expect((await repo.listItems(schoolA.id, { foundBefore: "2026-02-01T00:00:00.000Z" })).map((i) => i.id)).toEqual([old.id]);
        const atLibrary = await repo.listItems(schoolA.id, { locationIds: [libraryA] });
        expect(atLibrary.length).toBeGreaterThan(0);
        expect(atLibrary.every((i) => i.foundLocationId === libraryA)).toBe(true);
        expect(await repo.listItems(schoolA.id, { statuses: ["donated"] })).toEqual([]);
      });

      it("status changes set resolved time and are logged", async () => {
        const repo = h.repos.forStaff(staffA);
        const a = await repo.createItem(schoolA.id, item(gymA));
        const b = await repo.createItem(schoolA.id, item(gymA));
        await repo.setItemStatus(schoolA.id, [a.id, b.id], "removed", "Duplicate entry");
        const removed = await repo.listItems(schoolA.id, { statuses: ["removed"] });
        expect(removed.map((i) => i.id).sort()).toEqual([a.id, b.id].sort());
        expect(removed.every((i) => i.resolvedAt !== null)).toBe(true);
        expect((await h.auditActions(schoolA.id)).filter((x) => x === "item.removed")).toHaveLength(2);

        await repo.setItemStatus(schoolA.id, [a.id], "available");
        expect((await repo.getItem(schoolA.id, a.id))?.resolvedAt).toBeNull();
      });
    });

    // ---------- What students see ----------

    describe("student visibility", () => {
      let full: string;
      let limited: string;
      let staffOnly: string;
      let claimed: string;
      const SECRETS = ["SECRET-NOTE", "SECRET-HINT", "SECRET-STAFF", "secret-photo.jpg"];

      beforeAll(async () => {
        const repo = h.repos.forStaff(staffA);
        const secret = (visibility: NewItemInput["visibility"], category: NewItemInput["category"] = "bag") =>
          item(gymA, {
            category,
            visibility,
            note: "SECRET-NOTE",
            ownerHint: "SECRET-HINT",
            staffNote: "SECRET-STAFF",
            photoPath: `${schoolA.id}/secret-photo.jpg`,
            foundAt: "2026-09-25T12:00:00.000Z",
          });
        full = (await repo.createItem(schoolA.id, item(gymA, { visibility: "full", photoPath: `${schoolA.id}/full.jpg`, note: "Blue stripe", ownerHint: "x", staffNote: "SECRET-STAFF", foundAt: "2026-09-26T12:00:00.000Z" }))).id;
        limited = (await repo.createItem(schoolA.id, secret("limited", "electronics"))).id;
        staffOnly = (await repo.createItem(schoolA.id, secret("staff_only"))).id;
        claimed = (await repo.createItem(schoolA.id, secret("full"))).id;
        await repo.setItemStatus(schoolA.id, [claimed], "claimed");
      });

      it("Full items come with a photo URL and note, but never the owner hint or staff note", async () => {
        const view = await h.repos.forStudent(schoolA.id).getItem(full);
        expect(view).toMatchObject({
          visibility: "full",
          photoUrl: `${PHOTO_URL_PREFIX}${schoolA.id}/full.jpg`,
          note: "Blue stripe",
          hasNameLabel: true,
          foundLocationName: "Gym",
        });
        expect(JSON.stringify(view)).not.toContain("SECRET");
      });

      it("THE visibility test: a Limited item fetched as a student has no photo URL and no note", async () => {
        const view = await h.repos.forStudent(schoolA.id).getItem(limited);
        expect(view).not.toBeNull();
        expect(view!.visibility).toBe("limited");
        expect(view).not.toHaveProperty("photoUrl");
        expect(view).not.toHaveProperty("note");
        expect(view!.hasNameLabel).toBe(true);
        const json = JSON.stringify(view);
        for (const s of SECRETS) expect(json).not.toContain(s);
        expect(json).not.toContain(PHOTO_URL_PREFIX);
      });

      it("Limited items in the list are just as bare", async () => {
        const list = await h.repos.forStudent(schoolA.id).listItems();
        const view = list.find((i) => i.id === limited) as StudentItem;
        expect(Object.keys(view).sort()).toEqual(
          ["category", "colors", "foundAt", "foundLocationName", "hasNameLabel", "id", "visibility"].sort(),
        );
      });

      it("Staff-only and no-longer-available items are not listed and can't be fetched", async () => {
        const students = h.repos.forStudent(schoolA.id);
        const ids = (await students.listItems()).map((i) => i.id);
        expect(ids).toContain(full);
        expect(ids).toContain(limited);
        expect(ids).not.toContain(staffOnly);
        expect(ids).not.toContain(claimed);
        expect(await students.getItem(staffOnly)).toBeNull();
        expect(await students.getItem(claimed)).toBeNull();
        expect(JSON.stringify(await students.listItems())).not.toContain("SECRET");
      });

      it("switching a Full item to Private (Staff-only) hides it immediately", async () => {
        const repo = h.repos.forStaff(staffA);
        const flip = await repo.createItem(schoolA.id, item(gymA, { photoPath: `${schoolA.id}/flip.jpg` }));
        expect((await h.repos.forStudent(schoolA.id).getItem(flip.id))?.visibility).toBe("full");
        await repo.updateItem(schoolA.id, flip.id, { visibility: "staff_only" });
        expect(await h.repos.forStudent(schoolA.id).getItem(flip.id)).toBeNull();
        expect(JSON.stringify(await h.repos.forStudent(schoolA.id).listItems())).not.toContain("flip.jpg");
      });

      it("filters by category, location name, and whole-day date range", async () => {
        const students = h.repos.forStudent(schoolA.id);
        const electronics = await students.listItems({ categories: ["electronics"] });
        expect(electronics.map((i) => i.id)).toContain(limited);
        expect(electronics.every((i) => i.category === "electronics")).toBe(true);
        expect((await students.listItems({ locationNames: ["Library"] })).every((i) => i.foundLocationName === "Library")).toBe(true);
        const day = await students.listItems({ foundAfter: "2026-09-25", foundBefore: "2026-09-25" });
        expect(day.map((i) => i.id)).toEqual([limited]);
      });

      it("a student session for School A never sees School B's items", async () => {
        const itemB = await h.repos.forStaff(ownerB).createItem(schoolB.id, item(gymB));
        expect(await h.repos.forStudent(schoolA.id).getItem(itemB.id)).toBeNull();
        expect((await h.repos.forStudent(schoolA.id).listItems()).map((i) => i.id)).not.toContain(itemB.id);
        expect((await h.repos.forStudent(schoolB.id).listItems()).map((i) => i.id)).toEqual([itemB.id]);
      });
    });

    // ---------- Claims ----------

    describe("claims", () => {
      let itemId: string;
      const codeHash = () => `claim-${h.runId}-1`;

      beforeAll(async () => {
        itemId = (await h.repos.forStaff(staffA).createItem(schoolA.id, item(gymA, { category: "sports_gear", visibility: "limited" })))
          .id;
      });

      it("a student files a claim; staff see it in the queue with the hidden detail", async () => {
        await h.repos.forStudent(schoolA.id).createClaim({
          itemId,
          claimantDetail: "Lock screen is a photo of a golden retriever",
          contactEmail: null,
          codeHash: codeHash(),
        });
        const queue = await h.repos.forStaff(staffA).listClaims(schoolA.id, ["pending"]);
        const claim = queue.find((c) => c.itemId === itemId);
        expect(claim).toMatchObject({
          claimantDetail: "Lock screen is a photo of a golden retriever",
          status: "pending",
          reviewedAt: null,
          pickedUpAt: null,
        });
        expect(await h.repos.forStaff(staffA).getClaim(schoolA.id, claim!.id)).toEqual(claim);
      });

      it("the student checks status with the code, and sees only the student view of the item", async () => {
        const status = await h.repos.forStudent(schoolA.id).getClaimByCodeHash(codeHash());
        expect(status).toMatchObject({ status: "pending", item: { id: itemId, visibility: "limited" } });
        expect(status?.item).not.toHaveProperty("note");
        expect(await h.repos.forStudent(schoolA.id).getClaimByCodeHash("no-such-hash")).toBeNull();
        expect(await h.repos.forStudent(schoolB.id).getClaimByCodeHash(codeHash())).toBeNull();
      });

      it("staff approve, then mark picked up; times are recorded by the database", async () => {
        const repo = h.repos.forStaff(staffA);
        const [claim] = (await repo.listClaims(schoolA.id)).filter((c) => c.itemId === itemId);
        await repo.setClaimStatus(schoolA.id, claim.id, "approved");
        expect((await repo.getClaim(schoolA.id, claim.id))?.reviewedAt).not.toBeNull();
        await repo.setClaimStatus(schoolA.id, claim.id, "picked_up");
        expect((await repo.getClaim(schoolA.id, claim.id))?.pickedUpAt).not.toBeNull();
        expect((await repo.listClaims(schoolA.id, ["pending"])).map((c) => c.id)).not.toContain(claim.id);
      });

      it("can't claim an item students can't see, or another school's item", async () => {
        const hidden = await h.repos.forStaff(staffA).createItem(schoolA.id, item(gymA, { visibility: "staff_only" }));
        const itemB = await h.repos.forStaff(ownerB).createItem(schoolB.id, item(gymB));
        for (const id of [hidden.id, itemB.id]) {
          await expectRepoError(
            h.repos.forStudent(schoolA.id).createClaim({ itemId: id, claimantDetail: "It's mine", contactEmail: null, codeHash: `c-${id}` }),
            "not_found",
          );
        }
      });

      it("rejects a claim detail that's too short", async () => {
        await expectRepoError(
          h.repos.forStudent(schoolA.id).createClaim({ itemId, claimantDetail: "x", contactEmail: null, codeHash: `short-${h.runId}` }),
          "invalid",
        );
      });
    });

    // ---------- Cross-school isolation through the data layer ----------

    describe("isolation", () => {
      it("an owner of School A can't read anything of School B", async () => {
        const repo = h.repos.forStaff(ownerA);
        const itemB = await h.repos.forStaff(ownerB).createItem(schoolB.id, item(gymB));
        expect(await repo.getSchool(schoolB.id)).toBeNull();
        expect(await repo.listItems(schoolB.id)).toEqual([]);
        expect(await repo.getItem(schoolB.id, itemB.id)).toBeNull();
        expect(await repo.getItem(schoolA.id, itemB.id)).toBeNull();
        expect(await repo.listClaims(schoolB.id)).toEqual([]);
        expect(await repo.listMembers(schoolB.id)).toEqual([]);
        expect(await repo.listInvites(schoolB.id)).toEqual([]);
        expect(await repo.listLocations(schoolB.id)).toEqual([]);
      });

      it("an owner of School A can't change anything of School B", async () => {
        const repo = h.repos.forStaff(ownerA);
        const itemB = await h.repos.forStaff(ownerB).createItem(schoolB.id, item(gymB));
        await h.repos.forStudent(schoolB.id).createClaim({ itemId: itemB.id, claimantDetail: "Mine, has a dent", contactEmail: null, codeHash: `iso-${h.runId}` });
        const [claimB] = await h.repos.forStaff(ownerB).listClaims(schoolB.id, ["pending"]);

        await expectRepoError(repo.updateItem(schoolB.id, itemB.id, { note: "hacked" }), "not_found");
        await expectRepoError(repo.setItemStatus(schoolB.id, [itemB.id], "removed"), "not_found");
        await expectRepoError(repo.setClaimStatus(schoolB.id, claimB.id, "approved"), "not_found");
        await expectRepoError(
          repo.updateProfile(schoolB.id, { name: "Hacked", district: null, timeZone: "UTC", logoPath: null }),
          "not_found",
        );
        await expectRepoError(repo.createItem(schoolB.id, item(gymB)), "forbidden");
        await expectRepoError(repo.rotateJoinCode(schoolB.id), "forbidden");
        await expectRepoError(repo.createInvite(schoolB.id, email("intruder"), "owner", `hash-${h.runId}-intr`), "forbidden");

        const b = h.repos.forStaff(ownerB);
        expect((await b.getItem(schoolB.id, itemB.id))?.note).toBe("Dented near the lid");
        expect((await b.getItem(schoolB.id, itemB.id))?.status).toBe("available");
        expect((await b.getClaim(schoolB.id, claimB.id))?.status).toBe("pending");
        expect((await b.getSchool(schoolB.id))?.name).toBe("Test School B");
      });
    });

    // ---------- System jobs ----------

    describe("system", () => {
      it("rate limits count per key", async () => {
        const key = `test:${h.runId}:rl`;
        const sys = h.repos.system();
        expect([await sys.hitRateLimit(key, 2, 60), await sys.hitRateLimit(key, 2, 60), await sys.hitRateLimit(key, 2, 60)]).toEqual([
          true,
          true,
          false,
        ]);
        expect(await sys.hitRateLimit(`${key}:other`, 2, 60)).toBe(true);
      });

      it("finds photos past their school's retention period, and clears them", async () => {
        const repo = h.repos.forStaff(ownerB);
        await repo.updatePolicies(schoolB.id, { photoRetentionDays: 0, donateAfterDays: 30, pickupLocation: "", pickupHours: "" });
        const it1 = await repo.createItem(schoolB.id, item(gymB, { photoPath: `${schoolB.id}/old.jpg` }));
        await repo.setItemStatus(schoolB.id, [it1.id], "returned");

        const sys = h.repos.system();
        const later = new Date(Date.now() + 60_000);
        expect(await sys.listExpiredPhotos(later)).toContainEqual({ itemId: it1.id, photoPath: `${schoolB.id}/old.jpg` });
        expect((await sys.listExpiredPhotos(new Date(Date.now() - 60 * 60_000))).map((p) => p.itemId)).not.toContain(it1.id);

        await sys.clearPhoto(it1.id);
        expect((await repo.getItem(schoolB.id, it1.id))?.photoPath).toBeNull();
        expect((await sys.listExpiredPhotos(later)).map((p) => p.itemId)).not.toContain(it1.id);
        expect((await h.auditActions(schoolB.id)).filter((a) => a === "photo.deleted")).toHaveLength(1);
        // Clearing again (a retried job) doesn't log twice.
        await sys.clearPhoto(it1.id);
        expect((await h.auditActions(schoolB.id)).filter((a) => a === "photo.deleted")).toHaveLength(1);
      });
    });
  });
}
