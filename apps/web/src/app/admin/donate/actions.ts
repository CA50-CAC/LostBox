"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { RepoError } from "@/lib/repo/interface";
import { donateItems } from "@/lib/services/donate";
import { getStaffContext } from "@/lib/server/staff-context";

/** Bulk "mark donated". The ready list is recomputed here; the form's ids are only a request. */
export async function donateItemsAction(form: FormData): Promise<void> {
  const { repo, school } = await getStaffContext("/admin/donate");
  const ids = form.getAll("itemId").map(String).filter(Boolean);
  if (ids.length === 0) redirect("/admin/donate?error=none");
  let count: number;
  try {
    count = await donateItems(repo, school.id, school.donateAfterDays, ids);
  } catch (e) {
    if (e instanceof RepoError) redirect("/admin/donate?error=changed");
    throw e;
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/donate?done=${count}`);
}
