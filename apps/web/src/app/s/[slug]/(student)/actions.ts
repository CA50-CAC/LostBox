"use server";

/**
 * Student actions: send a claim, look up a claim. The school id comes from
 * the signed student cookie (getStudentContext), never from the form.
 */
import { generateClaimCode, hashCode } from "@/lib/domain/codes";
import { ClaimSchema, fieldErrors } from "@/lib/domain/validation";
import { RepoError } from "@/lib/repo/interface";
import { asMessageKeys, type FormState } from "@/lib/server/forms";
import { allow, clientIp } from "@/lib/server/rate-limit";
import { getStudentContext } from "@/lib/server/student-context";

export async function submitClaim(_prev: FormState, form: FormData): Promise<FormState> {
  const slug = String(form.get("slug") ?? "");
  const { students } = await getStudentContext(slug);
  if (form.get("website")) return { ok: true, data: { code: "" } }; // honeypot: pretend it worked

  const parsed = ClaimSchema.safeParse({
    itemId: form.get("itemId"),
    claimantDetail: form.get("claimantDetail"),
    contactEmail: form.get("contactEmail") ?? undefined,
  });
  if (!parsed.success) return { errors: asMessageKeys(fieldErrors(parsed.error)) };

  const ip = await clientIp();
  if (!(await allow("claimIp", ip)) || !(await allow("claimItem", parsed.data.itemId))) {
    return { error: "common.error.rateLimited" };
  }

  // The code is shown to the student once; only its hash is stored.
  const code = generateClaimCode();
  try {
    await students.createClaim({ ...parsed.data, codeHash: await hashCode(code) });
  } catch (e) {
    if (e instanceof RepoError && e.code === "not_found") return { error: "claim.error.gone" };
    if (e instanceof RepoError && e.code === "invalid") return { errors: { claimantDetail: "claim.error.detail" } };
    throw e;
  }
  return { ok: true, data: { code } };
}
