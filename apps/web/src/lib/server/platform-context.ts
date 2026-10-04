/**
 * For /platform pages: a signed-in staff member whose email is listed in
 * PLATFORM_ADMIN_EMAILS. Everyone else gets a plain 404, so the page doesn't
 * even confirm it exists.
 */
import "server-only";
import { notFound } from "next/navigation";
import { requireStaff } from "./auth";
import { repos } from "./repos";

export async function requirePlatformAdmin(nextPath: string) {
  const session = await requireStaff(nextPath);
  if (!session.isPlatformAdmin) notFound();
  return { session, platform: (await repos()).platform() };
}
