/**
 * The demo school: "Demo High School", join code DEMO2026, ~24 found items.
 *
 * `pnpm seed:demo` and the staff-only "Reset demo data" button both call
 * seedDemo(). It's idempotent: it deletes the demo school (everything hangs
 * off it with ON DELETE CASCADE) and rebuilds it with the same fixed id, so
 * student sessions and bookmarks keep working after a reset.
 *
 * Runs as the database owner on PGlite only. It never touches other schools.
 *
 * The items are chosen for demos and, later, matching tests:
 * - every category and all three privacy levels (6 Limited, 3 Staff-only)
 * - "confusable" groups: 3 black water bottles, 3 gray hoodies, 3 earbud
 *   cases, 3 calculators
 * - found dates over the last 30 days, 3 of them past the donate-after limit
 * - simple generated SVG pictures (src/lib/demo/images.ts), no real photos
 *
 * Plus a short history (DEMO_HISTORY): items already returned or donated over
 * the last month, so the impact dashboard (/admin/stats) has something to show.
 * They're resolved, so students never see them, and they have no photos (the
 * retention job would have deleted them by now anyway).
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { PRESETS } from "@/lib/domain/categories";
import { generateClaimCode, hashCode } from "@/lib/domain/codes";
import { CATEGORIES, type Category, type Color, type Visibility } from "@/lib/domain/types";
import { DEMO_JOIN_CODE, DEMO_SCHOOL_NAME, DEMO_SCHOOL_SLUG, DEMO_STAFF_EMAIL } from "./constants";
import { demoItemSvg } from "./images";

/** Fixed, so a reset keeps the same school id. */
export const DEMO_SCHOOL_ID = "d3e0d3e0-0000-4000-8000-000000002026";
export const DEMO_DONATE_AFTER_DAYS = 21;

const LOCATIONS = ["Front office", "Gym", "Cafeteria", "Library", "Field", "Main hall", "Classroom wing", "Bus loop"];

interface DemoItem {
  category: Category;
  colors: Color[];
  note: string | null;
  location: string;
  daysAgo: number;
  /** Omit to use the school's default for the category (Standard preset). */
  visibility?: Visibility;
  ownerHint?: string;
  staffNote?: string;
}

export const DEMO_ITEMS: DemoItem[] = [
  // Confusable: three black water bottles
  { category: "bottle_lunchbox", colors: ["black"], note: "Steel bottle, dent near the lid", location: "Gym", daysAgo: 1 },
  { category: "bottle_lunchbox", colors: ["black"], note: "Plastic bottle with a soccer sticker", location: "Field", daysAgo: 4 },
  { category: "bottle_lunchbox", colors: ["black", "white"], note: "Insulated bottle, white lid", location: "Cafeteria", daysAgo: 9, staffNote: "Scratched initials on the bottom: K.M." },
  // Confusable: three gray hoodies
  { category: "clothing", colors: ["gray"], note: "Hoodie, size M, paint on the left cuff", location: "Main hall", daysAgo: 2 },
  { category: "clothing", colors: ["gray"], note: "Zip-up hoodie, size L", location: "Gym", daysAgo: 6, ownerHint: "Name tag inside: R. Ortiz" },
  { category: "clothing", colors: ["gray", "red"], note: "Hoodie with a red drawstring", location: "Bus loop", daysAgo: 25 },
  // Confusable: three earbud cases (Limited by default: no photos)
  { category: "earbuds_headphones", colors: ["white"], note: "Earbuds case, small crack on the hinge", location: "Library", daysAgo: 1, staffNote: "Engraving on the case: 'Lucky'" },
  { category: "earbuds_headphones", colors: ["white"], note: "Earbuds case in a blue silicone cover", location: "Cafeteria", daysAgo: 3 },
  { category: "earbuds_headphones", colors: ["black"], note: "Over-ear headphones", location: "Classroom wing", daysAgo: 12 },
  // Confusable: three calculators
  { category: "calculator_supplies", colors: ["black"], note: "Graphing calculator", location: "Classroom wing", daysAgo: 2, ownerHint: "Name written on back: J. Park" },
  { category: "calculator_supplies", colors: ["black"], note: "Graphing calculator, missing slide cover", location: "Library", daysAgo: 7 },
  { category: "calculator_supplies", colors: ["blue"], note: "Scientific calculator", location: "Main hall", daysAgo: 15 },
  // Everything else
  { category: "bag", colors: ["blue"], note: "Backpack with a star keychain", location: "Bus loop", daysAgo: 5 },
  { category: "books_stationery", colors: ["green"], note: "Spiral notebook, chemistry notes", location: "Library", daysAgo: 8 },
  { category: "sports_gear", colors: ["orange"], note: "Basketball, a bit flat", location: "Gym", daysAgo: 11 },
  { category: "electronics", colors: ["silver"], note: "Phone in a clear case with stickers", location: "Cafeteria", daysAgo: 0, staffNote: "Lock screen: a golden retriever. Ask what's on it." },
  { category: "electronics", colors: ["black"], note: "Chromebook, school asset tag", location: "Classroom wing", daysAgo: 13, visibility: "staff_only", staffNote: "Asset tag 44-1187. Return to IT if unclaimed." },
  { category: "keys", colors: ["silver", "red"], note: "Three keys on a red lanyard", location: "Field", daysAgo: 3 },
  { category: "wallet_id", colors: ["brown"], note: "Leather wallet", location: "Main hall", daysAgo: 1, visibility: "staff_only", ownerHint: "Student ID inside", staffNote: "Locked in the office safe." },
  { category: "glasses_medical", colors: ["black"], note: "Glasses in a hard case", location: "Library", daysAgo: 10 },
  { category: "jewelry_watch", colors: ["gold"], note: "Thin bracelet with a heart charm", location: "Gym", daysAgo: 6, visibility: "staff_only" },
  { category: "instrument", colors: ["black"], note: "Clarinet case, band sticker", location: "Main hall", daysAgo: 23 },
  { category: "other", colors: ["multicolor"], note: "Umbrella with a wooden handle", location: "Front office", daysAgo: 28 },
  { category: "clothing", colors: ["blue"], note: "Denim jacket, pins on the collar", location: "Cafeteria", daysAgo: 17 },
];

/** Already resolved items. `hours` is the time from logging to pickup or donation. */
interface DemoHistoryItem {
  category: Category;
  colors: Color[];
  location: string;
  daysAgo: number;
  hours: number;
  outcome: "returned" | "donated";
  /** What the student said in the claim (returned items only). */
  claim?: string;
}

export const DEMO_HISTORY: DemoHistoryItem[] = [
  { category: "clothing", colors: ["black"], location: "Gym", daysAgo: 29, hours: 26, outcome: "returned", claim: "Black track jacket with my team number, 12" },
  { category: "bottle_lunchbox", colors: ["blue"], location: "Cafeteria", daysAgo: 27, hours: 5, outcome: "returned", claim: "Blue lunchbox with a dinosaur sticker" },
  { category: "electronics", colors: ["black"], location: "Library", daysAgo: 24, hours: 3, outcome: "returned", claim: "My lock screen is a photo of a beach at sunset" },
  { category: "keys", colors: ["silver"], location: "Bus loop", daysAgo: 20, hours: 20, outcome: "returned", claim: "House key and a small flashlight on the ring" },
  { category: "calculator_supplies", colors: ["black"], location: "Classroom wing", daysAgo: 16, hours: 47, outcome: "returned", claim: "Calculator has my initials scratched on the back" },
  { category: "bag", colors: ["red"], location: "Main hall", daysAgo: 12, hours: 8, outcome: "returned", claim: "Red backpack, the zipper pull is a paperclip" },
  { category: "earbuds_headphones", colors: ["white"], location: "Gym", daysAgo: 9, hours: 30, outcome: "returned", claim: "Left earbud has a tiny chip on the stem" },
  { category: "glasses_medical", colors: ["brown"], location: "Library", daysAgo: 6, hours: 4, outcome: "returned", claim: "Tortoiseshell glasses in a green case" },
  { category: "sports_gear", colors: ["white"], location: "Field", daysAgo: 3, hours: 22, outcome: "returned", claim: "Soccer cleats, size 8, orange laces" },
  { category: "clothing", colors: ["green"], location: "Field", daysAgo: 30, hours: 22 * 24, outcome: "donated" },
  { category: "books_stationery", colors: ["yellow"], location: "Main hall", daysAgo: 29, hours: 21 * 24, outcome: "donated" },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export async function seedDemo(db: PGlite, uploadsRoot: string, now = new Date()): Promise<{ items: number }> {
  const schoolDir = path.join(uploadsRoot, DEMO_SCHOOL_ID);
  const claimCode = generateClaimCode();
  const claimHash = await hashCode(claimCode);

  const count = await db.transaction(async (tx) => {
    const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await tx.query<T>(sql, params)).rows;

    const [user] = await q<{ id: string }>(
      `insert into auth.users (email) values ($1) on conflict (email) do update set email = excluded.email returning id`,
      [DEMO_STAFF_EMAIL],
    );
    await q("delete from public.schools where id = $1 or slug = $2 or join_code = $3", [DEMO_SCHOOL_ID, DEMO_SCHOOL_SLUG, DEMO_JOIN_CODE]);
    await q(
      `insert into public.schools (id, slug, name, district, time_zone, status, setup_step, join_code,
         photo_retention_days, donate_after_days, pickup_location, pickup_hours, created_by, launched_at, reviewed_at, reviewed_by_email)
       values ($1, $2, $3, 'Demo Unified', 'America/Los_Angeles', 'approved', 7, $4, 7, $5, 'Front office, room 101',
               'School days, 7:30 to 3:30', $6, now(), now(), 'demo-mode')`,
      [DEMO_SCHOOL_ID, DEMO_SCHOOL_SLUG, DEMO_SCHOOL_NAME, DEMO_JOIN_CODE, DEMO_DONATE_AFTER_DAYS, user.id],
    );
    await q("insert into public.school_members (school_id, user_id, role) values ($1, $2, 'owner')", [DEMO_SCHOOL_ID, user.id]);

    const locationIds = new Map<string, string>();
    for (const [sort, name] of LOCATIONS.entries()) {
      const [row] = await q<{ id: string }>("insert into public.locations (school_id, name, sort) values ($1, $2, $3) returning id", [
        DEMO_SCHOOL_ID,
        name,
        sort,
      ]);
      locationIds.set(name, row.id);
    }
    const linked = (a: string, b: string) => [locationIds.get(a)!, locationIds.get(b)!].sort();
    for (const [a, b] of [linked("Gym", "Field"), linked("Cafeteria", "Main hall"), linked("Library", "Classroom wing")]) {
      await q("insert into public.location_links (school_id, a, b) values ($1, $2, $3)", [DEMO_SCHOOL_ID, a, b]);
    }
    for (const c of CATEGORIES) {
      await q("insert into public.school_categories (school_id, category, default_visibility) values ($1, $2, $3)", [
        DEMO_SCHOOL_ID,
        c,
        PRESETS.standard[c],
      ]);
    }

    let firstLimited: string | null = null;
    for (const [i, it] of DEMO_ITEMS.entries()) {
      const visibility = it.visibility ?? PRESETS.standard[it.category];
      const foundAt = new Date(now.getTime() - it.daysAgo * DAY_MS - (i % 5) * 3600_000).toISOString();
      const [row] = await q<{ id: string }>(
        `insert into public.items (school_id, category, colors, note, found_location_id, found_at, visibility, owner_hint, staff_note, photo_path, created_by, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $6) returning id`,
        [
          DEMO_SCHOOL_ID,
          it.category,
          it.colors,
          it.note,
          locationIds.get(it.location),
          foundAt,
          visibility,
          it.ownerHint ?? null,
          it.staffNote ?? null,
          `${DEMO_SCHOOL_ID}/demo-${i}.svg`,
          user.id,
        ],
      );
      if (!firstLimited && visibility === "limited") firstLimited = row.id;
    }

    // Last month's history, for the impact dashboard.
    for (const [i, h] of DEMO_HISTORY.entries()) {
      const loggedAt = new Date(now.getTime() - h.daysAgo * DAY_MS - (i % 4) * HOUR_MS);
      const resolvedAt = new Date(Math.min(loggedAt.getTime() + h.hours * HOUR_MS, now.getTime() - HOUR_MS));
      const [row] = await q<{ id: string }>(
        `insert into public.items (school_id, category, colors, found_location_id, found_at, visibility, status, resolved_at, created_by, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $5, $8) returning id`,
        [DEMO_SCHOOL_ID, h.category, h.colors, locationIds.get(h.location), loggedAt.toISOString(), PRESETS.standard[h.category], h.outcome, resolvedAt.toISOString(), user.id],
      );
      if (h.claim) {
        const claimedAt = new Date(loggedAt.getTime() + Math.min(2 * HOUR_MS, (resolvedAt.getTime() - loggedAt.getTime()) / 2));
        await q(
          `insert into public.claims (school_id, item_id, claimant_detail, code_hash, status, reviewed_by, reviewed_at, picked_up_at, created_at)
           values ($1, $2, $3, $4, 'picked_up', $5, $6, $7, $6)`,
          [DEMO_SCHOOL_ID, row.id, h.claim, await hashCode(generateClaimCode()), user.id, claimedAt.toISOString(), resolvedAt.toISOString()],
        );
      }
    }

    // One claim waiting in the queue, so the staff view isn't empty.
    if (firstLimited) {
      await q("insert into public.claims (school_id, item_id, claimant_detail, code_hash) values ($1, $2, $3, $4)", [
        DEMO_SCHOOL_ID,
        firstLimited,
        "The case says 'Lucky' on the back in silver marker",
        claimHash,
      ]);
    }
    return DEMO_ITEMS.length;
  });

  // Pictures go on disk after the database commit; a failed seed leaves no orphans in the database.
  await rm(schoolDir, { recursive: true, force: true });
  await mkdir(schoolDir, { recursive: true });
  await Promise.all(DEMO_ITEMS.map((it, i) => writeFile(path.join(schoolDir, `demo-${i}.svg`), demoItemSvg(it.category, it.colors[0], i))));

  return { items: count };
}
