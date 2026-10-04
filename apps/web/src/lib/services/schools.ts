/**
 * Platform review of new schools. A school starts as `pending_review`, and
 * students can't join it until a platform admin (an email listed in
 * PLATFORM_ADMIN_EMAILS) approves it. Approving can be undone: rejecting an
 * approved school turns its join code off again right away.
 */
import type { SchoolStatus } from "@/lib/domain/types";
import { RepoError, type PlatformRepo } from "@/lib/repo/interface";

export type SchoolDecision = "approve" | "reject" | "reopen";

const TARGET: Record<SchoolDecision, SchoolStatus> = {
  approve: "approved",
  reject: "rejected",
  reopen: "pending_review",
};

export function isSchoolDecision(value: unknown): value is SchoolDecision {
  return typeof value === "string" && value in TARGET;
}

/** `admin` must be the signed-in session; only platform admins get through. */
export async function reviewSchool(
  platform: PlatformRepo,
  admin: { email: string; isPlatformAdmin: boolean },
  schoolId: string,
  decision: SchoolDecision,
): Promise<SchoolStatus> {
  if (!admin.isPlatformAdmin) throw new RepoError("forbidden", "Only platform admins can review schools");
  if (!isSchoolDecision(decision)) throw new RepoError("invalid", "Unknown decision");
  const status = TARGET[decision];
  await platform.setSchoolStatus(schoolId, status, admin.email);
  return status;
}
