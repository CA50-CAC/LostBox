/**
 * The PGlite adapter: the repository interface on top of Postgres-in-Node.
 * Used by tests, local development, and the offline demo.
 *
 * How "acting as someone" works here:
 * - Staff calls run in a transaction that switches to the `authenticated` role
 *   and sets the same `request.jwt.claims` setting Supabase sets from a login
 *   token. Row Level Security then applies exactly as it does on Supabase.
 * - Student, platform, and system calls run as the database owner (like the
 *   server's secret key on Supabase), which skips RLS. So every student query
 *   here filters by the school id from the signed session, on purpose, every time.
 *
 * Every call runs inside `db.transaction`. PGlite runs one transaction at a
 * time, so one request's role switch can never leak into another's queries.
 */
import "server-only";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import type { CategoryDefaults } from "@/lib/domain/categories";
import { CATEGORIES, type ClaimStatus, type ItemStatus, type MemberRole, type SchoolStatus } from "@/lib/domain/types";
import {
  RepoError,
  type PhotoUrlFn,
  type PlatformRepo,
  type Repositories,
  type StaffActor,
  type StaffRepo,
  type StudentRepo,
  type SystemRepo,
} from "./interface";
import { mapPgError } from "./errors";
import {
  CLAIM_COLUMNS,
  ITEM_COLUMNS,
  PUBLIC_SCHOOL_COLUMNS,
  RESOLVED_STATUSES,
  SCHOOL_COLUMNS,
  STUDENT_ITEM_COLUMNS,
  itemColumns,
  iso,
  toCategoryDefaults,
  toClaim,
  toInvite,
  toLocation,
  toMember,
  toPublicSchool,
  toSchool,
  toStaffItem,
  toStudentItem,
  type DbRow,
} from "./rows";
import { studentDateRange } from "./filters";
import { dedupeNames, linkPairs } from "./locations";

type Q = (text: string, params?: unknown[]) => Promise<DbRow[]>;

function query(tx: Transaction): Q {
  return async (text, params) => (await tx.query<DbRow>(text, params)).rows;
}

export function createPgliteRepositories(db: PGlite, deps: { photoUrl: PhotoUrlFn }): Repositories {
  /** Runs `fn` as the database owner. */
  async function asSystem<T>(fn: (q: Q) => Promise<T>): Promise<T> {
    try {
      return await db.transaction((tx) => fn(query(tx)));
    } catch (e) {
      throw mapPgError(e);
    }
  }

  /** Runs `fn` as a signed-in staff user, under Row Level Security. */
  async function asStaff<T>(userId: string, fn: (q: Q) => Promise<T>): Promise<T> {
    try {
      return await db.transaction(async (tx) => {
        const q = query(tx);
        await q("set local role authenticated");
        await q("select set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({ sub: userId, role: "authenticated" }),
        ]);
        return fn(q);
      });
    } catch (e) {
      throw mapPgError(e);
    }
  }

  return {
    forStaff: (actor) => pgliteStaffRepo(actor, asStaff),
    forStudent: (schoolId) => pgliteStudentRepo(schoolId, asSystem, deps.photoUrl),
    platform: () => pglitePlatformRepo(asSystem),
    system: () => pgliteSystemRepo(asSystem),
  };
}

const ITEM_SELECT = `select ${ITEM_COLUMNS
  .split(", ")
  .map((c) => `i.${c}`)
  .join(", ")}, l.name as location_name
  from public.items i join public.locations l on l.id = i.found_location_id`;

function one<T>(rows: T[], what: string): T {
  if (rows.length === 0) throw new RepoError("not_found", `${what} not found`);
  return rows[0];
}

function pgliteStaffRepo(
  actor: StaffActor,
  asStaff: <T>(userId: string, fn: (q: Q) => Promise<T>) => Promise<T>,
): StaffRepo {
  const run = <T>(fn: (q: Q) => Promise<T>) => asStaff(actor.userId, fn);

  const getItem = (q: Q, schoolId: string, itemId: string) =>
    q(`${ITEM_SELECT} where i.school_id = $1 and i.id = $2`, [schoolId, itemId]).then((rows) =>
      rows[0] ? toStaffItem(rows[0], String(rows[0].location_name)) : null,
    );

  return {
    createSchool: (input) =>
      run(async (q) => {
        const [{ id }] = await q("select public.create_school($1, $2, $3, $4, $5, $6) as id", [
          input.slug,
          input.name,
          input.district,
          input.timeZone,
          input.logoPath,
          input.needsManualReview,
        ]);
        return toSchool(one(await q(`select ${SCHOOL_COLUMNS} from public.schools where id = $1`, [id]), "School"));
      }),

    mySchools: () =>
      run(async (q) => {
        const rows = await q(
          `select ${SCHOOL_COLUMNS.split(", ")
            .map((c) => `s.${c}`)
            .join(", ")}, m.role
             from public.schools s
             join public.school_members m on m.school_id = s.id and m.user_id = auth.uid()
            order by s.created_at`,
        );
        return rows.map((r) => ({ ...toSchool(r), role: r.role as MemberRole }));
      }),

    getSchool: (schoolId) =>
      run(async (q) => {
        const rows = await q(`select ${SCHOOL_COLUMNS} from public.schools where id = $1`, [schoolId]);
        return rows[0] ? toSchool(rows[0]) : null;
      }),

    updateProfile: (schoolId, input) =>
      run(async (q) => {
        one(
          await q(
            "update public.schools set name = $2, district = $3, time_zone = $4, logo_path = $5 where id = $1 returning id",
            [schoolId, input.name, input.district, input.timeZone, input.logoPath],
          ),
          "School",
        );
      }),

    updatePolicies: (schoolId, input) =>
      run(async (q) => {
        one(
          await q(
            `update public.schools set photo_retention_days = $2, donate_after_days = $3, pickup_location = $4, pickup_hours = $5
              where id = $1 returning id`,
            [schoolId, input.photoRetentionDays, input.donateAfterDays, input.pickupLocation, input.pickupHours],
          ),
          "School",
        );
      }),

    setSetupStep: (schoolId, step) =>
      run(async (q) => {
        one(
          await q("update public.schools set setup_step = greatest(setup_step, $2) where id = $1 returning id", [
            schoolId,
            step,
          ]),
          "School",
        );
      }),

    rotateJoinCode: (schoolId) =>
      run(async (q) => String((await q("select public.rotate_join_code($1) as code", [schoolId]))[0].code)),

    markLaunched: (schoolId) =>
      run(async (q) => {
        one(
          await q(
            "update public.schools set setup_step = 7, launched_at = coalesce(launched_at, now()) where id = $1 returning id",
            [schoolId],
          ),
          "School",
        );
      }),

    listLocations: (schoolId) =>
      run(async (q) =>
        (await q("select id, name, sort from public.locations where school_id = $1 order by sort, name", [schoolId])).map(
          toLocation,
        ),
      ),

    saveLocations: (schoolId, names, links) =>
      run(async (q) => {
        const wanted = dedupeNames(names);
        const existing = await q("select id, name from public.locations where school_id = $1", [schoolId]);
        const byName = new Map(existing.map((r) => [String(r.name), String(r.id)]));

        await q("delete from public.locations where school_id = $1 and not (name = any($2::text[]))", [schoolId, wanted]);
        for (const [sort, name] of wanted.entries()) {
          if (byName.has(name)) {
            await q("update public.locations set sort = $3 where school_id = $1 and name = $2", [schoolId, name, sort]);
          } else {
            await q("insert into public.locations (school_id, name, sort) values ($1, $2, $3)", [schoolId, name, sort]);
          }
        }

        const saved = (
          await q("select id, name, sort from public.locations where school_id = $1 order by sort, name", [schoolId])
        ).map(toLocation);
        await q("delete from public.location_links where school_id = $1", [schoolId]);
        for (const [a, b] of linkPairs(saved, links)) {
          await q("insert into public.location_links (school_id, a, b) values ($1, $2, $3) on conflict do nothing", [
            schoolId,
            a,
            b,
          ]);
        }
        return saved;
      }),

    listLocationLinks: (schoolId) =>
      run(async (q) =>
        (await q("select a, b from public.location_links where school_id = $1", [schoolId])).map((r) => ({
          a: String(r.a),
          b: String(r.b),
        })),
      ),

    getCategoryDefaults: (schoolId) =>
      run(async (q) =>
        toCategoryDefaults(
          await q("select category, default_visibility from public.school_categories where school_id = $1", [schoolId]),
        ),
      ),

    saveCategoryDefaults: (schoolId, defaults: CategoryDefaults) =>
      run(async (q) => {
        for (const category of CATEGORIES) {
          await q(
            `insert into public.school_categories (school_id, category, default_visibility) values ($1, $2, $3)
             on conflict (school_id, category) do update set default_visibility = excluded.default_visibility`,
            [schoolId, category, defaults[category]],
          );
        }
      }),

    listMembers: (schoolId) =>
      run(async (q) => (await q("select * from public.list_school_members($1)", [schoolId])).map(toMember)),

    listInvites: (schoolId) =>
      run(async (q) =>
        (
          await q(
            "select id, email, role, created_at, accepted_at from public.staff_invites where school_id = $1 order by created_at desc",
            [schoolId],
          )
        ).map(toInvite),
      ),

    createInvite: (schoolId, email, role, tokenHash) =>
      run(async (q) =>
        toInvite(
          (
            await q(
              `insert into public.staff_invites (school_id, email, role, token_hash) values ($1, $2, $3, $4)
               returning id, email, role, created_at, accepted_at`,
              [schoolId, email, role, tokenHash],
            )
          )[0],
        ),
      ),

    revokeInvite: (schoolId, inviteId) =>
      run(async (q) => {
        one(
          await q("delete from public.staff_invites where school_id = $1 and id = $2 returning id", [schoolId, inviteId]),
          "Invite",
        );
      }),

    acceptInvite: (tokenHash) =>
      run(async (q) => {
        const [row] = await q("select public.accept_staff_invite($1) as school_id", [tokenHash]);
        return row.school_id ? { schoolId: String(row.school_id) } : null;
      }),

    listItems: (schoolId, filters = {}) =>
      run(async (q) => {
        const where = ["i.school_id = $1"];
        const params: unknown[] = [schoolId];
        const add = (sql: string, value: unknown) => {
          params.push(value);
          where.push(sql.replace("?", `$${params.length}`));
        };
        if (filters.statuses?.length) add("i.status = any(?::text[]::public.item_status[])", filters.statuses);
        if (filters.categories?.length) add("i.category = any(?::text[]::public.category[])", filters.categories);
        if (filters.locationIds?.length) add("i.found_location_id = any(?::uuid[])", filters.locationIds);
        if (filters.foundBefore) add("i.found_at < ?", filters.foundBefore);
        const rows = await q(`${ITEM_SELECT} where ${where.join(" and ")} order by i.found_at desc, i.id`, params);
        return rows.map((r) => toStaffItem(r, String(r.location_name)));
      }),

    getItem: (schoolId, itemId) => run((q) => getItem(q, schoolId, itemId)),

    createItem: (schoolId, input) =>
      run(async (q) => {
        const cols = { school_id: schoolId, ...itemColumns({ ...input }) };
        const names = Object.keys(cols);
        const [{ id }] = await q(
          `insert into public.items (${names.join(", ")}) values (${names.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
          Object.values(cols),
        );
        return (await getItem(q, schoolId, String(id)))!;
      }),

    updateItem: (schoolId, itemId, patch) =>
      run(async (q) => {
        const cols = itemColumns({ ...patch });
        const names = Object.keys(cols);
        const sets = [...names.map((n, i) => `${n} = $${i + 3}`), "updated_at = now()"];
        one(
          await q(`update public.items set ${sets.join(", ")} where school_id = $1 and id = $2 returning id`, [
            schoolId,
            itemId,
            ...Object.values(cols),
          ]),
          "Item",
        );
      }),

    setItemStatus: (schoolId, itemIds, status: ItemStatus, reason) =>
      run(async (q) => {
        if (itemIds.length === 0) return;
        const updated = await q(
          `update public.items
              set status = $3,
                  resolved_at = case when $3 = any($4::text[]::public.item_status[]) then coalesce(resolved_at, now()) else null end,
                  updated_at = now()
            where school_id = $1 and id = any($2::uuid[])
            returning id`,
          [schoolId, itemIds, status, RESOLVED_STATUSES],
        );
        if (updated.length !== new Set(itemIds).size) throw new RepoError("not_found", "Item not found");
        await q(
          `insert into public.audit_log (school_id, actor_id, action, item_id, detail)
           select $1, auth.uid(), $2, unnest($3::uuid[]), $4::jsonb`,
          [schoolId, `item.${status}`, itemIds, JSON.stringify(reason ? { reason } : {})],
        );
      }),

    listClaims: (schoolId, statuses) =>
      run(async (q) => {
        const rows = statuses?.length
          ? await q(
              `select ${CLAIM_COLUMNS} from public.claims where school_id = $1 and status = any($2::text[]::public.claim_status[]) order by created_at, id`,
              [schoolId, statuses],
            )
          : await q(`select ${CLAIM_COLUMNS} from public.claims where school_id = $1 order by created_at, id`, [schoolId]);
        return rows.map(toClaim);
      }),

    getClaim: (schoolId, claimId) =>
      run(async (q) => {
        const rows = await q(`select ${CLAIM_COLUMNS} from public.claims where school_id = $1 and id = $2`, [
          schoolId,
          claimId,
        ]);
        return rows[0] ? toClaim(rows[0]) : null;
      }),

    setClaimStatus: (schoolId, claimId, status: ClaimStatus) =>
      run(async (q) => {
        one(
          await q("update public.claims set status = $3 where school_id = $1 and id = $2 returning id", [
            schoolId,
            claimId,
            status,
          ]),
          "Claim",
        );
      }),
  };
}

function pgliteStudentRepo(
  schoolId: string,
  asSystem: <T>(fn: (q: Q) => Promise<T>) => Promise<T>,
  photoUrl: PhotoUrlFn,
): StudentRepo {
  return {
    getSchool: () =>
      asSystem(async (q) => {
        const rows = await q(`select ${PUBLIC_SCHOOL_COLUMNS} from public.schools where id = $1 and status = 'approved'`, [
          schoolId,
        ]);
        return rows[0] ? toPublicSchool(rows[0]) : null;
      }),

    listLocationNames: () =>
      asSystem(async (q) =>
        (await q("select name from public.locations where school_id = $1 order by sort, name", [schoolId])).map((r) =>
          String(r.name),
        ),
      ),

    listItems: (filters = {}) =>
      asSystem(async (q) => {
        const where = ["school_id = $1"];
        const params: unknown[] = [schoolId];
        const add = (sql: string, value: unknown) => {
          params.push(value);
          where.push(sql.replace("?", `$${params.length}`));
        };
        const { from, to } = studentDateRange(filters);
        if (filters.categories?.length) add("category = any(?::text[]::public.category[])", filters.categories);
        if (filters.locationNames?.length) add("found_location_name = any(?::text[])", filters.locationNames);
        if (from) add("found_at >= ?", from);
        if (to) add("found_at < ?", to);
        const rows = await q(
          `select ${STUDENT_ITEM_COLUMNS} from public.student_items where ${where.join(" and ")} order by found_at desc, id`,
          params,
        );
        return Promise.all(rows.map((r) => toStudentItem(r, photoUrl)));
      }),

    getItem: (itemId) =>
      asSystem(async (q) => {
        const rows = await q(`select ${STUDENT_ITEM_COLUMNS} from public.student_items where school_id = $1 and id = $2`, [
          schoolId,
          itemId,
        ]);
        return rows[0] ? toStudentItem(rows[0], photoUrl) : null;
      }),

    createClaim: (input) =>
      asSystem(async (q) => {
        const visible = await q("select 1 from public.student_items where school_id = $1 and id = $2", [
          schoolId,
          input.itemId,
        ]);
        if (visible.length === 0) throw new RepoError("not_found", "Item not found");
        await q(
          `insert into public.claims (school_id, item_id, claimant_detail, contact_email, code_hash)
           values ($1, $2, $3, $4, $5)`,
          [schoolId, input.itemId, input.claimantDetail, input.contactEmail, input.codeHash],
        );
      }),

    getClaimByCodeHash: (codeHash) =>
      asSystem(async (q) => {
        const [claim] = await q("select item_id, status, created_at from public.claims where school_id = $1 and code_hash = $2", [
          schoolId,
          codeHash,
        ]);
        if (!claim) return null;
        const items = await q(`select ${STUDENT_ITEM_COLUMNS} from public.student_items where school_id = $1 and id = $2`, [
          schoolId,
          claim.item_id,
        ]);
        return {
          status: claim.status as ClaimStatus,
          createdAt: iso(claim.created_at),
          item: items[0] ? await toStudentItem(items[0], photoUrl) : null,
        };
      }),
  };
}

function pglitePlatformRepo(asSystem: <T>(fn: (q: Q) => Promise<T>) => Promise<T>): PlatformRepo {
  return {
    listSchools: (status?: SchoolStatus) =>
      asSystem(async (q) => {
        const rows = await q(
          `select ${SCHOOL_COLUMNS.split(", ")
            .map((c) => `s.${c}`)
            .join(", ")}, u.email as owner_email
             from public.schools s
             left join auth.users u on u.id = s.created_by
            where $1::public.school_status is null or s.status = $1
            order by s.created_at`,
          [status ?? null],
        );
        return rows.map((r) => ({ ...toSchool(r), ownerEmail: r.owner_email == null ? null : String(r.owner_email) }));
      }),

    setSchoolStatus: (schoolId, status, adminEmail) =>
      asSystem(async (q) => {
        one(
          await q(
            "update public.schools set status = $2, reviewed_at = now(), reviewed_by_email = $3 where id = $1 returning id",
            [schoolId, status, adminEmail],
          ),
          "School",
        );
      }),
  };
}

function pgliteSystemRepo(asSystem: <T>(fn: (q: Q) => Promise<T>) => Promise<T>): SystemRepo {
  return {
    findJoinableSchool: (joinCode) =>
      asSystem(async (q) => {
        const rows = await q(
          `select ${PUBLIC_SCHOOL_COLUMNS} from public.schools where join_code = $1 and status = 'approved'`,
          [joinCode],
        );
        return rows[0] ? toPublicSchool(rows[0]) : null;
      }),

    findSchoolBySlug: (slug) =>
      asSystem(async (q) => {
        const rows = await q(`select ${PUBLIC_SCHOOL_COLUMNS}, status from public.schools where slug = $1`, [slug]);
        return rows[0] ? { ...toPublicSchool(rows[0]), status: rows[0].status as SchoolStatus } : null;
      }),

    isSlugTaken: (slug) =>
      asSystem(async (q) => (await q("select 1 from public.schools where slug = $1", [slug])).length > 0),

    hitRateLimit: (key, limit, windowSeconds) =>
      asSystem(async (q) => Boolean((await q("select public.hit_rate_limit($1, $2, $3) as ok", [key, limit, windowSeconds]))[0].ok)),

    listExpiredPhotos: (now) =>
      asSystem(async (q) =>
        (
          await q(
            `select i.id, i.photo_path from public.items i join public.schools s on s.id = i.school_id
              where i.photo_path is not null and i.photo_deleted_at is null
                and i.status = any($2::text[]::public.item_status[]) and i.resolved_at is not null
                and i.resolved_at + make_interval(days => s.photo_retention_days) < $1
              order by i.resolved_at`,
            [now.toISOString(), RESOLVED_STATUSES],
          )
        ).map((r) => ({ itemId: String(r.id), photoPath: String(r.photo_path) })),
      ),

    clearPhoto: (itemId) =>
      asSystem(async (q) => {
        const rows = await q(
          "update public.items set photo_path = null, photo_deleted_at = now() where id = $1 and photo_path is not null returning school_id",
          [itemId],
        );
        if (!rows[0]) return;
        await q(
          `insert into public.audit_log (school_id, actor_id, action, item_id, detail) values ($1, null, 'photo.deleted', $2, '{"reason":"retention"}')`,
          [rows[0].school_id, itemId],
        );
      }),
  };
}
