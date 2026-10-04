"use server";

/**
 * Staff item actions: add, edit, change status. Each one checks the session,
 * then works through the staff data layer, so Row Level Security limits it to
 * the staff member's own school even if the form is tampered with.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clampVisibility } from "@/lib/domain/categories";
import type { Visibility } from "@/lib/domain/types";
import { ItemSchema, ItemStatusSchema, fieldErrors } from "@/lib/domain/validation";
import { RepoError, type NewItemInput } from "@/lib/repo/interface";
import { asMessageKeys, type FormState } from "@/lib/server/forms";
import { processUpload } from "@/lib/server/images";
import { photoStore } from "@/lib/server/photos";
import { allow } from "@/lib/server/rate-limit";
import { getStaffContext } from "@/lib/server/staff-context";

/** A date input gives "2026-09-30"; store it as midday UTC so it's the same day in every US time zone. */
function foundAtFromForm(v: FormDataEntryValue | null): string {
  const s = String(v ?? "");
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00:00.000Z` : s;
}

function parseItem(form: FormData) {
  const isPrivate = form.get("private") === "on";
  return ItemSchema.safeParse({
    category: form.get("category"),
    colors: form.getAll("colors").map(String),
    note: form.get("note") ?? undefined,
    foundLocationId: form.get("foundLocationId"),
    foundAt: foundAtFromForm(form.get("foundAt")),
    visibility: isPrivate ? "staff_only" : (form.get("visibility") ?? "limited"),
    ownerHint: form.get("ownerHint") ?? undefined,
    staffNote: form.get("staffNote") ?? undefined,
  });
}

/** Cleanup that shouldn't turn a saved edit into an error page. A leftover file is unreachable: nothing points at it. */
async function removeQuietly(photoPath: string) {
  await photoStore()
    .remove(photoPath)
    .catch((e: unknown) => console.error("Couldn't delete an unused photo", e instanceof Error ? e.message : e));
}

/** Processes and stores an uploaded photo, if there is one. */
async function storePhoto(form: FormData, schoolId: string, userId: string): Promise<{ path: string | null } | { error: FormState }> {
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { path: null };
  if (!(await allow("uploadUser", userId))) return { error: { errors: { photo: "item.error.rateLimited" } } };
  const result = await processUpload(new Uint8Array(await file.arrayBuffer()));
  if (!result.ok) return { error: { errors: { photo: result.error === "too_big" ? "item.error.photo.too_big" : "item.error.photo.not_image" } } };
  return { path: await photoStore().save(schoolId, result.jpeg, "jpg") };
}

export async function createItem(_prev: FormState, form: FormData): Promise<FormState> {
  const { repo, school, session } = await getStaffContext("/admin/items/new");
  const parsed = parseItem(form);
  if (!parsed.success) return { errors: asMessageKeys(fieldErrors(parsed.error)) };

  const photo = await storePhoto(form, school.id, session.userId);
  if ("error" in photo) return photo.error;

  let id: string;
  try {
    const input: NewItemInput = { ...parsed.data, photoPath: photo.path };
    id = (await repo.createItem(school.id, input)).id;
  } catch (e) {
    if (photo.path) await removeQuietly(photo.path);
    if (e instanceof RepoError && e.code === "invalid") return { error: "common.error.generic" };
    throw e;
  }
  revalidatePath("/admin");
  redirect(`/admin/items/${id}?created=1`);
}

export async function updateItem(_prev: FormState, form: FormData): Promise<FormState> {
  const itemId = String(form.get("itemId") ?? "");
  const { repo, school, session } = await getStaffContext(`/admin/items/${itemId}`);
  const existing = await repo.getItem(school.id, itemId);
  if (!existing) return { error: "edit.notFound" };

  const parsed = parseItem(form);
  if (!parsed.success) return { errors: asMessageKeys(fieldErrors(parsed.error)) };

  const photo = await storePhoto(form, school.id, session.userId);
  if ("error" in photo) return photo.error;
  const removePhoto = form.get("removePhoto") === "on";
  const photoPath = photo.path ?? (removePhoto ? null : existing.photoPath);

  try {
    await repo.updateItem(school.id, itemId, { ...parsed.data, photoPath });
  } catch (e) {
    if (photo.path) await removeQuietly(photo.path);
    throw e;
  }
  // The old file is only deleted once the item no longer points at it.
  if (existing.photoPath && existing.photoPath !== photoPath) await removeQuietly(existing.photoPath);
  revalidatePath("/admin");
  revalidatePath(`/admin/items/${itemId}`);
  return { ok: true };
}

/** Quick "Private item" switch from the item page: Staff-only, or back to the category default. */
export async function setItemPrivate(form: FormData): Promise<void> {
  const itemId = String(form.get("itemId") ?? "");
  const { repo, school } = await getStaffContext(`/admin/items/${itemId}`);
  const item = await repo.getItem(school.id, itemId);
  if (!item) redirect("/admin");
  const makePrivate = form.get("private") === "on";
  const defaults = await repo.getCategoryDefaults(school.id);
  const fallback: Visibility = defaults[item.category] === "staff_only" ? "limited" : defaults[item.category];
  await repo.updateItem(school.id, itemId, { visibility: makePrivate ? "staff_only" : clampVisibility(item.category, fallback) });
  revalidatePath(`/admin/items/${itemId}`);
  revalidatePath("/admin");
}

export async function setItemStatus(form: FormData): Promise<void> {
  const itemId = String(form.get("itemId") ?? "");
  const { repo, school } = await getStaffContext(`/admin/items/${itemId}`);
  const status = ItemStatusSchema.parse(form.get("status"));
  const reason = String(form.get("reason") ?? "").trim().slice(0, 200) || undefined;
  await repo.setItemStatus(school.id, [itemId], status, reason);
  revalidatePath("/admin");
  revalidatePath(`/admin/items/${itemId}`);
  redirect(status === "removed" ? "/admin?removed=1" : `/admin/items/${itemId}`);
}
