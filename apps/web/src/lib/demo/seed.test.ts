import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { openPglite } from "@/lib/db/pglite";
import { createPgliteRepositories } from "@/lib/repo/pglite";
import { DEMO_JOIN_CODE } from "./constants";
import { DEMO_DONATE_AFTER_DAYS, DEMO_HISTORY, DEMO_ITEMS, DEMO_SCHOOL_ID, seedDemo } from "./seed";

let db: PGlite;
let uploads: string;

beforeAll(async () => {
  db = await openPglite();
  uploads = await mkdtemp(path.join(tmpdir(), "lostbox-seed-"));
  await seedDemo(db, uploads);
}, 60_000);

afterAll(async () => {
  await db?.close();
  await rm(uploads, { recursive: true, force: true });
});

const OPEN = "status = 'available'";
const count = async (sql: string) => Number((await db.query<{ n: number }>(sql, [DEMO_SCHOOL_ID])).rows[0].n);

describe("demo seed", () => {
  it("has about 24 items across every category and all three privacy levels", async () => {
    expect(await count(`select count(*)::int as n from public.items where school_id = $1 and ${OPEN}`)).toBe(24);
    expect(await count(`select count(distinct category)::int as n from public.items where school_id = $1 and ${OPEN}`)).toBe(14);
    expect(await count(`select count(*)::int as n from public.items where school_id = $1 and ${OPEN} and visibility = 'limited'`)).toBeGreaterThanOrEqual(5);
    expect(await count(`select count(*)::int as n from public.items where school_id = $1 and ${OPEN} and visibility = 'staff_only'`)).toBeGreaterThanOrEqual(2);
  });

  it("includes the confusable groups", () => {
    const n = (pred: (i: (typeof DEMO_ITEMS)[number]) => boolean) => DEMO_ITEMS.filter(pred).length;
    expect(n((i) => i.category === "bottle_lunchbox" && i.colors[0] === "black")).toBe(3);
    expect(n((i) => i.category === "clothing" && i.colors[0] === "gray")).toBe(3);
    expect(n((i) => i.category === "earbuds_headphones")).toBe(3);
    expect(n((i) => i.category === "calculator_supplies")).toBe(3);
  });

  it("has at least 3 items past the donate-after limit, all within 30 days", async () => {
    const old = await count(
      `select count(*)::int as n from public.items where school_id = $1 and ${OPEN} and found_at < now() - interval '${DEMO_DONATE_AFTER_DAYS} days'`,
    );
    expect(old).toBeGreaterThanOrEqual(3);
    expect(await count("select count(*)::int as n from public.items where school_id = $1 and found_at < now() - interval '31 days'")).toBe(0);
  });

  it("can be joined with DEMO2026, and students see the right things", async () => {
    const repos = createPgliteRepositories(db, { photoUrl: async (p) => `/photo/${p}` });
    expect(await repos.system().findJoinableSchool(DEMO_JOIN_CODE)).toMatchObject({ id: DEMO_SCHOOL_ID });
    const items = await repos.forStudent(DEMO_SCHOOL_ID).listItems();
    expect(items).toHaveLength(21); // 24 minus 3 Staff-only
    for (const i of items) {
      if (i.visibility === "full") expect(i.photoUrl).toMatch(/^\/photo\//);
      else expect(i).not.toHaveProperty("photoUrl");
    }
  });

  it("has a month of returned and donated history, with no photos and no open claims", async () => {
    const returned = DEMO_HISTORY.filter((h) => h.outcome === "returned").length;
    expect(await count("select count(*)::int as n from public.items where school_id = $1 and status = 'returned' and resolved_at is not null")).toBe(returned);
    expect(await count("select count(*)::int as n from public.items where school_id = $1 and status = 'donated'")).toBe(DEMO_HISTORY.length - returned);
    expect(await count("select count(*)::int as n from public.items where school_id = $1 and status <> 'available' and photo_path is not null")).toBe(0);
    expect(await count("select count(*)::int as n from public.claims where school_id = $1 and status = 'picked_up'")).toBe(returned);
    expect(await count("select count(*)::int as n from public.items where school_id = $1 and resolved_at > now()")).toBe(0);
  });

  it("writes one SVG per item", async () => {
    expect((await readdir(path.join(uploads, DEMO_SCHOOL_ID))).length).toBe(24);
  });

  it("is idempotent: running it again gives the same state, same school id", async () => {
    await seedDemo(db, uploads);
    expect(await count("select count(*)::int as n from public.items where school_id = $1")).toBe(24 + DEMO_HISTORY.length);
    expect(await count("select count(*)::int as n from public.schools where id = $1")).toBe(1);
    expect(await count("select count(*)::int as n from public.claims where school_id = $1 and status = 'pending'")).toBe(1);
  });
});
