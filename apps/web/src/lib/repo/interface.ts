/**
 * The repository interface: every database read and write in the app goes
 * through one of these objects. Pages and routes never write SQL directly.
 *
 * Why split it into "who is asking"?
 *
 * - `forStaff(actor)` acts AS that staff user. In Postgres this runs with Row
 *   Level Security on, so even a bug in our code can't read another school's rows.
 * - `forStudent(schoolId)` is for anonymous students. The school id comes from
 *   the signed session cookie, never from the request body. It can only read
 *   the `student_items` view, which strips photos and notes from non-Full items.
 * - `platform()` is for platform admins (approve schools).
 * - `system()` is for trusted server jobs: join-code lookup, seeding, retention.
 *
 * Two adapters, one contract (tests/repo/contract.ts runs against both):
 * - `pglite` (./pglite.ts): Postgres running inside Node (no Docker). Tests, dev, demo.
 * - `supabase` (./supabase.ts): the real deployment. Same SQL migrations, same RLS policies.
 *
 * Errors the app is expected to handle (a slug that's taken, a location still in
 * use, an item a student can't see) are thrown as `RepoError` with a `code`, so
 * both adapters fail the same way.
 */
import type { CategoryDefaults } from "@/lib/domain/categories";
import type {
  Category,
  ClaimStatus,
  Color,
  ItemStatus,
  MemberRole,
  SchoolStatus,
  StaffItem,
  Visibility,
} from "@/lib/domain/types";
import type { StudentItem } from "@/lib/domain/visibility";

// ---------- Errors ----------

export type RepoErrorCode = "not_found" | "conflict" | "forbidden" | "invalid";

export class RepoError extends Error {
  constructor(
    readonly code: RepoErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RepoError";
  }
}

// ---------- Who is asking ----------

/**
 * A signed-in staff member. `accessToken` is their Supabase login token, which
 * the Supabase adapter sends with every query so RLS knows who is asking.
 * The PGlite adapter only needs the user id (it sets the same database setting
 * Supabase would set from the token).
 */
export interface StaffActor {
  userId: string;
  accessToken: string | null;
}

/** Turns a storage path into a short-lived URL a browser can load. */
export type PhotoUrlFn = (photoPath: string) => Promise<string | null>;

// ---------- Shapes ----------

export interface School {
  id: string;
  slug: string;
  name: string;
  district: string | null;
  timeZone: string;
  logoPath: string | null;
  status: SchoolStatus;
  /** Highest wizard step completed (0 = none). 7 means launched. */
  setupStep: number;
  joinCode: string;
  photoRetentionDays: number;
  donateAfterDays: number;
  pickupLocation: string | null;
  pickupHours: string | null;
  needsManualReview: boolean;
  createdAt: string;
  launchedAt: string | null;
}

/** What a student can learn about a school: enough to show its name and pickup info. */
export interface PublicSchool {
  id: string;
  slug: string;
  name: string;
  logoPath: string | null;
  pickupLocation: string | null;
  pickupHours: string | null;
  donateAfterDays: number;
}

export interface Location {
  id: string;
  name: string;
  sort: number;
}

/** An undirected "these two places are near each other" link. Used later by matching. */
export interface LocationLink {
  a: string;
  b: string;
}

export interface Member {
  userId: string;
  email: string;
  role: MemberRole;
  createdAt: string;
}

export interface StaffInvite {
  id: string;
  email: string;
  role: MemberRole;
  createdAt: string;
  acceptedAt: string | null;
}

export interface Claim {
  id: string;
  itemId: string;
  claimantDetail: string;
  contactEmail: string | null;
  status: ClaimStatus;
  createdAt: string;
  reviewedAt: string | null;
  pickedUpAt: string | null;
}

/** What a student sees when checking a claim with their claim code. */
export interface ClaimStatusView {
  status: ClaimStatus;
  createdAt: string;
  item: StudentItem | null;
}

// ---------- Inputs ----------

export interface SchoolProfileInput {
  name: string;
  district: string | null;
  timeZone: string;
  logoPath: string | null;
}

export interface PoliciesInput {
  photoRetentionDays: number;
  donateAfterDays: number;
  pickupLocation: string;
  pickupHours: string;
}

export interface NewItemInput {
  category: Category;
  colors: Color[];
  note: string | null;
  foundLocationId: string;
  foundAt: string;
  visibility: Visibility;
  ownerHint: string | null;
  staffNote: string | null;
  photoPath: string | null;
}

export interface ItemFilters {
  statuses?: ItemStatus[];
  categories?: Category[];
  locationIds?: string[];
  /** Only items found before this time (used for the "ready to donate" list). */
  foundBefore?: string;
}

export interface StudentItemFilters {
  categories?: Category[];
  locationNames?: string[];
  foundAfter?: string;
  foundBefore?: string;
}

// ---------- Repositories ----------

export interface StaffRepo {
  /** Creates a pending school with the caller as owner. The database generates the join code. */
  createSchool(input: SchoolProfileInput & { slug: string; needsManualReview: boolean }): Promise<School>;
  /** Schools the caller belongs to. */
  mySchools(): Promise<Array<School & { role: MemberRole }>>;
  getSchool(schoolId: string): Promise<School | null>;
  updateProfile(schoolId: string, input: SchoolProfileInput): Promise<void>;
  updatePolicies(schoolId: string, input: PoliciesInput): Promise<void>;
  setSetupStep(schoolId: string, step: number): Promise<void>;
  /** Owners only. The database generates the new code and returns it. */
  rotateJoinCode(schoolId: string): Promise<string>;
  markLaunched(schoolId: string): Promise<void>;

  listLocations(schoolId: string): Promise<Location[]>;
  /**
   * Replaces the full list, in this order, keeping ids for names that already
   * exist. `links` are pairs of names. Throws RepoError("conflict") if a
   * location that items still point to would be removed.
   */
  saveLocations(schoolId: string, names: string[], links: Array<[string, string]>): Promise<Location[]>;
  listLocationLinks(schoolId: string): Promise<LocationLink[]>;

  getCategoryDefaults(schoolId: string): Promise<CategoryDefaults>;
  saveCategoryDefaults(schoolId: string, defaults: CategoryDefaults): Promise<void>;

  listMembers(schoolId: string): Promise<Member[]>;
  listInvites(schoolId: string): Promise<StaffInvite[]>;
  /** Stores only the hash of the invite token. */
  createInvite(schoolId: string, email: string, role: MemberRole, tokenHash: string): Promise<StaffInvite>;
  revokeInvite(schoolId: string, inviteId: string): Promise<void>;
  acceptInvite(tokenHash: string): Promise<{ schoolId: string } | null>;

  listItems(schoolId: string, filters?: ItemFilters): Promise<StaffItem[]>;
  getItem(schoolId: string, itemId: string): Promise<StaffItem | null>;
  createItem(schoolId: string, input: NewItemInput): Promise<StaffItem>;
  updateItem(schoolId: string, itemId: string, patch: Partial<NewItemInput>): Promise<void>;
  /** Removal is logged to the audit log. */
  setItemStatus(schoolId: string, itemIds: string[], status: ItemStatus, reason?: string): Promise<void>;

  /** Oldest first, so the queue is worked in order. */
  listClaims(schoolId: string, statuses?: ClaimStatus[]): Promise<Claim[]>;
  getClaim(schoolId: string, claimId: string): Promise<Claim | null>;
  setClaimStatus(schoolId: string, claimId: string, status: ClaimStatus): Promise<void>;
}

export interface StudentRepo {
  getSchool(): Promise<PublicSchool | null>;
  listLocationNames(): Promise<string[]>;
  /** Only available, non-staff-only items, already projected to the student view. */
  listItems(filters?: StudentItemFilters): Promise<StudentItem[]>;
  getItem(itemId: string): Promise<StudentItem | null>;
  /** Throws RepoError("not_found") if the item isn't visible to students. Stores only the hash of the claim code. */
  createClaim(input: { itemId: string; claimantDetail: string; contactEmail: string | null; codeHash: string }): Promise<void>;
  getClaimByCodeHash(codeHash: string): Promise<ClaimStatusView | null>;
}

export interface PlatformRepo {
  listSchools(status?: SchoolStatus): Promise<Array<School & { ownerEmail: string | null }>>;
  setSchoolStatus(schoolId: string, status: SchoolStatus, adminEmail: string): Promise<void>;
}

export interface SystemRepo {
  /** Returns the school only if it is approved. Pending schools can't be joined. */
  findJoinableSchool(joinCode: string): Promise<PublicSchool | null>;
  findSchoolBySlug(slug: string): Promise<(PublicSchool & { status: SchoolStatus }) | null>;
  isSlugTaken(slug: string): Promise<boolean>;
  /** Returns true if the action is allowed, false if the caller is over the limit. */
  hitRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean>;
  /** Photos of items resolved more than N days ago (N per school). */
  listExpiredPhotos(now: Date): Promise<Array<{ itemId: string; photoPath: string }>>;
  /** Forgets the item's photo and logs "photo.deleted". Does nothing if the photo is already gone. */
  clearPhoto(itemId: string): Promise<void>;
  /**
   * Forgets the optional contact email on claims that closed (rejected or
   * picked up) more than the school's retention period ago. Returns how many.
   */
  clearClosedClaimContacts(now: Date): Promise<number>;
}

export interface Repositories {
  forStaff(actor: StaffActor): StaffRepo;
  /** `schoolId` must come from the signed student session, never from the request. */
  forStudent(schoolId: string): StudentRepo;
  platform(): PlatformRepo;
  system(): SystemRepo;
}
