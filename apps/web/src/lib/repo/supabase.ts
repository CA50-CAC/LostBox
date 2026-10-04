/**
 * The Supabase adapter: the repository interface on top of Supabase's API
 * (PostgREST). Used in production (DATA_ADAPTER=supabase).
 *
 * Two kinds of client:
 * - Staff: the publishable key plus the staff member's own login token. The
 *   database sees role `authenticated` and auth.uid() = that user, so Row Level
 *   Security decides what they can read and change. Same rules as PGlite.
 * - Server (students, platform, system): the secret key, which skips RLS. So
 *   every student query here filters by the school id from the signed session,
 *   and reads only the `student_items` view, on purpose, every time.
 *
 * This file must never reach the browser: `server-only` makes the build fail
 * if a client component imports it.
 */
import "server-only";
import { createClient, type PostgrestError, type SupabaseClient } from "@supabase/supabase-js";
import type { CategoryDefaults } from "@/lib/domain/categories";
import { CATEGORIES, type ClaimStatus, type ItemStatus, type MemberRole, type SchoolStatus } from "@/lib/domain/types";
import { mapPgError } from "./errors";
import { studentDateRange } from "./filters";
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
import { dedupeNames, linkPairs } from "./locations";
import {
  CLAIM_COLUMNS,
  ITEM_COLUMNS,
  PUBLIC_SCHOOL_COLUMNS,
  RESOLVED_STATUSES,
  SCHOOL_COLUMNS,
  STUDENT_ITEM_COLUMNS,
  iso,
  itemColumns,
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

export interface SupabaseRepoConfig {
  url: string;
  publishableKey: string;
  secretKey: string;
  photoUrl: PhotoUrlFn;
}

const NO_SESSION = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } } as const;

/** The secret-key client. Skips RLS: only for server code that filters by school itself. */
export function createServiceClient(url: string, secretKey: string): SupabaseClient {
  return createClient(url, secretKey, NO_SESSION);
}

export function createSupabaseRepositories(config: SupabaseRepoConfig): Repositories {
  const service = createServiceClient(config.url, config.secretKey);

  return {
    forStaff(actor) {
      if (!actor.accessToken) throw new RepoError("forbidden", "Staff calls on Supabase need a login token");
      const client = createClient(config.url, config.publishableKey, {
        ...NO_SESSION,
        global: { headers: { Authorization: `Bearer ${actor.accessToken}` } },
      });
      return supabaseStaffRepo(actor, client);
    },
    forStudent: (schoolId) => supabaseStudentRepo(schoolId, service, config.photoUrl),
    platform: () => supabasePlatformRepo(service),
    system: () => supabaseSystemRepo(service),
  };
}

// ---------- Helpers ----------

interface Result<T> {
  data: T | null;
  error: PostgrestError | null;
}

/** Throws the mapped error, or returns the data. */
function must<T>({ data, error }: Result<T>): T {
  if (error) throw mapPgError(error);
  return data as T;
}

function rows({ data, error }: Result<unknown>): DbRow[] {
  if (error) throw mapPgError(error);
  return (data as DbRow[] | null) ?? [];
}

/** For updates and deletes: Supabase reports "0 rows matched" as success, so we check. */
function atLeastOne(result: Result<unknown>, what: string): void {
  if (rows(result).length === 0) throw new RepoError("not_found", `${what} not found`);
}

/** `locations(name)` embeds come back as an object (or, for some relationships, an array). */
function embeddedName(v: unknown): string {
  const obj = Array.isArray(v) ? v[0] : v;
  return String((obj as { name?: unknown } | null)?.name ?? "");
}

const ITEM_SELECT = `${ITEM_COLUMNS}, locations(name)`;

// ---------- Staff ----------

function supabaseStaffRepo(actor: StaffActor, db: SupabaseClient): StaffRepo {
  const getSchool = async (schoolId: string) => {
    const data = must(await db.from("schools").select(SCHOOL_COLUMNS).eq("id", schoolId).maybeSingle());
    return data ? toSchool(data as unknown as DbRow) : null;
  };

  const getItem = async (schoolId: string, itemId: string) => {
    const data = must(await db.from("items").select(ITEM_SELECT).eq("school_id", schoolId).eq("id", itemId).maybeSingle());
    return data ? toStaffItem(data as DbRow, embeddedName((data as unknown as DbRow).locations)) : null;
  };

  const listLocations = async (schoolId: string) =>
    rows(await db.from("locations").select("id, name, sort").eq("school_id", schoolId).order("sort").order("name")).map(
      toLocation,
    );

  return {
    async createSchool(input) {
      const id = must(
        await db.rpc("create_school", {
          p_slug: input.slug,
          p_name: input.name,
          p_district: input.district,
          p_time_zone: input.timeZone,
          p_logo_path: input.logoPath,
          p_needs_manual_review: input.needsManualReview,
        }),
      ) as string;
      const school = await getSchool(id);
      if (!school) throw new RepoError("not_found", "School not found");
      return school;
    },

    async mySchools() {
      const data = rows(
        await db.from("school_members").select(`role, schools(${SCHOOL_COLUMNS})`).eq("user_id", actor.userId),
      );
      return data
        .map((r) => ({ ...toSchool((Array.isArray(r.schools) ? r.schools[0] : r.schools) as DbRow), role: r.role as MemberRole }))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    getSchool,

    async updateProfile(schoolId, input) {
      atLeastOne(
        await db
          .from("schools")
          .update({ name: input.name, district: input.district, time_zone: input.timeZone, logo_path: input.logoPath })
          .eq("id", schoolId)
          .select("id"),
        "School",
      );
    },

    async updatePolicies(schoolId, input) {
      atLeastOne(
        await db
          .from("schools")
          .update({
            photo_retention_days: input.photoRetentionDays,
            donate_after_days: input.donateAfterDays,
            pickup_location: input.pickupLocation,
            pickup_hours: input.pickupHours,
          })
          .eq("id", schoolId)
          .select("id"),
        "School",
      );
    },

    async setSetupStep(schoolId, step) {
      const school = await getSchool(schoolId);
      if (!school) throw new RepoError("not_found", "School not found");
      if (step <= school.setupStep) return;
      atLeastOne(await db.from("schools").update({ setup_step: step }).eq("id", schoolId).select("id"), "School");
    },

    async rotateJoinCode(schoolId) {
      return String(must(await db.rpc("rotate_join_code", { p_school_id: schoolId })));
    },

    async markLaunched(schoolId) {
      const school = await getSchool(schoolId);
      if (!school) throw new RepoError("not_found", "School not found");
      atLeastOne(
        await db
          .from("schools")
          .update({ setup_step: 7, launched_at: school.launchedAt ?? new Date().toISOString() })
          .eq("id", schoolId)
          .select("id"),
        "School",
      );
    },

    listLocations,

    async saveLocations(schoolId, names, links) {
      const wanted = dedupeNames(names);
      const existing = await listLocations(schoolId);
      const keep = new Set(wanted);
      const removeIds = existing.filter((l) => !keep.has(l.name)).map((l) => l.id);
      if (removeIds.length) must(await db.from("locations").delete().eq("school_id", schoolId).in("id", removeIds));

      const byName = new Map(existing.map((l) => [l.name, l]));
      for (const [sort, name] of wanted.entries()) {
        const found = byName.get(name);
        if (found) {
          if (found.sort !== sort) must(await db.from("locations").update({ sort }).eq("school_id", schoolId).eq("id", found.id));
        } else {
          must(await db.from("locations").insert({ school_id: schoolId, name, sort }));
        }
      }

      const saved = await listLocations(schoolId);
      must(await db.from("location_links").delete().eq("school_id", schoolId));
      const pairs = linkPairs(saved, links);
      if (pairs.length) must(await db.from("location_links").insert(pairs.map(([a, b]) => ({ school_id: schoolId, a, b }))));
      return saved;
    },

    async listLocationLinks(schoolId) {
      return rows(await db.from("location_links").select("a, b").eq("school_id", schoolId)).map((r) => ({
        a: String(r.a),
        b: String(r.b),
      }));
    },

    async getCategoryDefaults(schoolId) {
      return toCategoryDefaults(
        rows(await db.from("school_categories").select("category, default_visibility").eq("school_id", schoolId)),
      );
    },

    async saveCategoryDefaults(schoolId, defaults: CategoryDefaults) {
      must(
        await db.from("school_categories").upsert(
          CATEGORIES.map((category) => ({ school_id: schoolId, category, default_visibility: defaults[category] })),
          { onConflict: "school_id,category" },
        ),
      );
    },

    async listMembers(schoolId) {
      return rows(await db.rpc("list_school_members", { p_school_id: schoolId })).map(toMember);
    },

    async listInvites(schoolId) {
      return rows(
        await db
          .from("staff_invites")
          .select("id, email, role, created_at, accepted_at")
          .eq("school_id", schoolId)
          .order("created_at", { ascending: false }),
      ).map(toInvite);
    },

    async createInvite(schoolId, email, role, tokenHash) {
      const data = must(
        await db
          .from("staff_invites")
          .insert({ school_id: schoolId, email, role, token_hash: tokenHash })
          .select("id, email, role, created_at, accepted_at")
          .single(),
      );
      return toInvite(data as unknown as DbRow);
    },

    async revokeInvite(schoolId, inviteId) {
      atLeastOne(await db.from("staff_invites").delete().eq("school_id", schoolId).eq("id", inviteId).select("id"), "Invite");
    },

    async acceptInvite(tokenHash) {
      const schoolId = must(await db.rpc("accept_staff_invite", { p_token_hash: tokenHash }));
      return schoolId ? { schoolId: String(schoolId) } : null;
    },

    async listItems(schoolId, filters = {}) {
      let query = db.from("items").select(ITEM_SELECT).eq("school_id", schoolId);
      if (filters.statuses?.length) query = query.in("status", filters.statuses);
      if (filters.categories?.length) query = query.in("category", filters.categories);
      if (filters.locationIds?.length) query = query.in("found_location_id", filters.locationIds);
      if (filters.foundBefore) query = query.lt("found_at", filters.foundBefore);
      return rows(await query.order("found_at", { ascending: false }).order("id")).map((r) =>
        toStaffItem(r, embeddedName(r.locations)),
      );
    },

    getItem,

    async createItem(schoolId, input) {
      const data = must(
        await db
          .from("items")
          .insert({ school_id: schoolId, ...itemColumns({ ...input }) })
          .select("id")
          .single(),
      ) as DbRow;
      const item = await getItem(schoolId, String(data.id));
      if (!item) throw new RepoError("not_found", "Item not found");
      return item;
    },

    async updateItem(schoolId, itemId, patch) {
      atLeastOne(
        await db
          .from("items")
          .update({ ...itemColumns({ ...patch }), updated_at: new Date().toISOString() })
          .eq("school_id", schoolId)
          .eq("id", itemId)
          .select("id"),
        "Item",
      );
    },

    async setItemStatus(schoolId, itemIds, status: ItemStatus, reason) {
      if (itemIds.length === 0) return;
      const now = new Date().toISOString();
      const updated = rows(
        await db.from("items").update({ status, updated_at: now }).eq("school_id", schoolId).in("id", itemIds).select("id"),
      );
      if (updated.length !== new Set(itemIds).size) throw new RepoError("not_found", "Item not found");

      const resolved = (RESOLVED_STATUSES as readonly string[]).includes(status);
      if (resolved) {
        // Keep the first resolution time if it was already resolved.
        must(
          await db.from("items").update({ resolved_at: now }).eq("school_id", schoolId).in("id", itemIds).is("resolved_at", null),
        );
      } else {
        must(await db.from("items").update({ resolved_at: null }).eq("school_id", schoolId).in("id", itemIds));
      }

      must(
        await db.from("audit_log").insert(
          itemIds.map((itemId) => ({
            school_id: schoolId,
            actor_id: actor.userId,
            action: `item.${status}`,
            item_id: itemId,
            detail: reason ? { reason } : {},
          })),
        ),
      );
    },

    async listClaims(schoolId, statuses) {
      let query = db.from("claims").select(CLAIM_COLUMNS).eq("school_id", schoolId);
      if (statuses?.length) query = query.in("status", statuses);
      return rows(await query.order("created_at").order("id")).map(toClaim);
    },

    async getClaim(schoolId, claimId) {
      const data = must(await db.from("claims").select(CLAIM_COLUMNS).eq("school_id", schoolId).eq("id", claimId).maybeSingle());
      return data ? toClaim(data as unknown as DbRow) : null;
    },

    async setClaimStatus(schoolId, claimId, status: ClaimStatus) {
      atLeastOne(
        await db.from("claims").update({ status }).eq("school_id", schoolId).eq("id", claimId).select("id"),
        "Claim",
      );
    },
  };
}

// ---------- Students (secret key: always filter by schoolId) ----------

function supabaseStudentRepo(schoolId: string, db: SupabaseClient, photoUrl: PhotoUrlFn): StudentRepo {
  const findVisible = async (itemId: string) =>
    must(
      await db.from("student_items").select(STUDENT_ITEM_COLUMNS).eq("school_id", schoolId).eq("id", itemId).maybeSingle(),
    ) as DbRow | null;

  return {
    async getSchool() {
      const data = must(
        await db.from("schools").select(PUBLIC_SCHOOL_COLUMNS).eq("id", schoolId).eq("status", "approved").maybeSingle(),
      );
      return data ? toPublicSchool(data as unknown as DbRow) : null;
    },

    async listLocationNames() {
      return rows(await db.from("locations").select("name").eq("school_id", schoolId).order("sort").order("name")).map((r) =>
        String(r.name),
      );
    },

    async listItems(filters = {}) {
      const { from, to } = studentDateRange(filters);
      let query = db.from("student_items").select(STUDENT_ITEM_COLUMNS).eq("school_id", schoolId);
      if (filters.categories?.length) query = query.in("category", filters.categories);
      if (filters.locationNames?.length) query = query.in("found_location_name", filters.locationNames);
      if (from) query = query.gte("found_at", from);
      if (to) query = query.lt("found_at", to);
      const data = rows(await query.order("found_at", { ascending: false }).order("id"));
      return Promise.all(data.map((r) => toStudentItem(r, photoUrl)));
    },

    async getItem(itemId) {
      const row = await findVisible(itemId);
      return row ? toStudentItem(row, photoUrl) : null;
    },

    async createClaim(input) {
      if (!(await findVisible(input.itemId))) throw new RepoError("not_found", "Item not found");
      must(
        await db.from("claims").insert({
          school_id: schoolId,
          item_id: input.itemId,
          claimant_detail: input.claimantDetail,
          contact_email: input.contactEmail,
          code_hash: input.codeHash,
        }),
      );
    },

    async getClaimByCodeHash(codeHash) {
      const claim = must(
        await db.from("claims").select("item_id, status, created_at").eq("school_id", schoolId).eq("code_hash", codeHash).maybeSingle(),
      ) as DbRow | null;
      if (!claim) return null;
      const item = await findVisible(String(claim.item_id));
      return {
        status: claim.status as ClaimStatus,
        createdAt: iso(claim.created_at),
        item: item ? await toStudentItem(item, photoUrl) : null,
      };
    },
  };
}

// ---------- Platform and system (secret key) ----------

function supabasePlatformRepo(db: SupabaseClient): PlatformRepo {
  return {
    async listSchools(status?: SchoolStatus) {
      let query = db.from("schools").select(`${SCHOOL_COLUMNS}, created_by`);
      if (status) query = query.eq("status", status);
      const data = rows(await query.order("created_at"));
      // Emails live in Supabase Auth, not in a table the API can join.
      const emails = new Map<string, string | null>();
      for (const id of new Set(data.map((r) => r.created_by).filter(Boolean) as string[])) {
        const { data: user } = await db.auth.admin.getUserById(id);
        emails.set(id, user?.user?.email ?? null);
      }
      return data.map((r) => ({ ...toSchool(r), ownerEmail: r.created_by ? (emails.get(String(r.created_by)) ?? null) : null }));
    },

    async setSchoolStatus(schoolId, status, adminEmail) {
      atLeastOne(
        await db
          .from("schools")
          .update({ status, reviewed_at: new Date().toISOString(), reviewed_by_email: adminEmail })
          .eq("id", schoolId)
          .select("id"),
        "School",
      );
    },
  };
}

function supabaseSystemRepo(db: SupabaseClient): SystemRepo {
  return {
    async findJoinableSchool(joinCode) {
      const data = must(
        await db.from("schools").select(PUBLIC_SCHOOL_COLUMNS).eq("join_code", joinCode).eq("status", "approved").maybeSingle(),
      );
      return data ? toPublicSchool(data as unknown as DbRow) : null;
    },

    async findSchoolBySlug(slug) {
      const data = must(await db.from("schools").select(`${PUBLIC_SCHOOL_COLUMNS}, status`).eq("slug", slug).maybeSingle()) as
        | DbRow
        | null;
      return data ? { ...toPublicSchool(data), status: data.status as SchoolStatus } : null;
    },

    async isSlugTaken(slug) {
      return rows(await db.from("schools").select("id").eq("slug", slug)).length > 0;
    },

    async hitRateLimit(key, limit, windowSeconds) {
      return Boolean(must(await db.rpc("hit_rate_limit", { p_key: key, p_limit: limit, p_window_seconds: windowSeconds })));
    },

    async listExpiredPhotos(now) {
      const data = rows(
        await db
          .from("items")
          .select("id, photo_path, resolved_at, schools(photo_retention_days)")
          .not("photo_path", "is", null)
          .is("photo_deleted_at", null)
          .not("resolved_at", "is", null)
          .in("status", [...RESOLVED_STATUSES]),
      );
      const DAY_MS = 24 * 60 * 60 * 1000;
      return data
        .filter((r) => {
          const school = (Array.isArray(r.schools) ? r.schools[0] : r.schools) as { photo_retention_days: number };
          return Date.parse(iso(r.resolved_at)) + school.photo_retention_days * DAY_MS < now.getTime();
        })
        .sort((a, b) => iso(a.resolved_at).localeCompare(iso(b.resolved_at)))
        .map((r) => ({ itemId: String(r.id), photoPath: String(r.photo_path) }));
    },

    async clearPhoto(itemId) {
      const cleared = rows(
        await db
          .from("items")
          .update({ photo_path: null, photo_deleted_at: new Date().toISOString() })
          .eq("id", itemId)
          .not("photo_path", "is", null)
          .select("school_id"),
      );
      if (!cleared[0]) return;
      must(
        await db
          .from("audit_log")
          .insert({ school_id: cleared[0].school_id, actor_id: null, action: "photo.deleted", item_id: itemId, detail: { reason: "retention" } }),
      );
    },

    async clearClosedClaimContacts(now) {
      const DAY_MS = 24 * 60 * 60 * 1000;
      const candidates = rows(
        await db
          .from("claims")
          .select("id, picked_up_at, reviewed_at, schools(photo_retention_days)")
          .not("contact_email", "is", null)
          .in("status", ["rejected", "picked_up"]),
      );
      const ids = candidates
        .filter((r) => {
          const school = (Array.isArray(r.schools) ? r.schools[0] : r.schools) as { photo_retention_days: number };
          const closed = r.picked_up_at ?? r.reviewed_at;
          return closed != null && Date.parse(iso(closed)) + school.photo_retention_days * DAY_MS < now.getTime();
        })
        .map((r) => String(r.id));
      if (ids.length === 0) return 0;
      return rows(await db.from("claims").update({ contact_email: null }).in("id", ids).select("id")).length;
    },
  };
}
