"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { RepoError } from "@/lib/repo/interface";
import { isSchoolDecision, reviewSchool } from "@/lib/services/schools";
import { requirePlatformAdmin } from "@/lib/server/platform-context";

const VIEWS = ["pending_review", "approved", "rejected"];

export async function reviewSchoolAction(form: FormData): Promise<void> {
  const { session, platform } = await requirePlatformAdmin("/platform/schools");
  const view = VIEWS.includes(String(form.get("view"))) ? String(form.get("view")) : "pending_review";
  const decision = form.get("decision");
  const schoolId = String(form.get("schoolId") ?? "");
  if (!isSchoolDecision(decision)) redirect(`/platform/schools?view=${view}&error=1`);
  try {
    await reviewSchool(platform, session, schoolId, decision);
  } catch (e) {
    if (e instanceof RepoError) redirect(`/platform/schools?view=${view}&error=1`);
    throw e;
  }
  revalidatePath("/platform/schools");
  redirect(`/platform/schools?view=${view}&done=1`);
}
