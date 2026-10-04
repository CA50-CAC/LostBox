/**
 * Scheduled jobs (Vercel Cron) call our routes with
 * `Authorization: Bearer <CRON_SECRET>`. Anyone can call the URL, so the
 * secret is the only thing that makes a call trusted. CRON_SECRET is a
 * server-only variable (no NEXT_PUBLIC_ prefix), so it never reaches browsers.
 */
import { timingSafeEqual } from "node:crypto";

/** At least this long, so the secret can't be guessed. */
export const MIN_CRON_SECRET_LENGTH = 16;

export type CronAuth = "ok" | "not_configured" | "unauthorized";

export function checkCronAuth(authorization: string | null, secret: string | undefined): CronAuth {
  if (!secret || secret.length < MIN_CRON_SECRET_LENGTH) return "not_configured";
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(authorization ?? "");
  // timingSafeEqual needs equal lengths; comparing lengths first leaks only the length.
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return "unauthorized";
  return "ok";
}

/** The JSON response for a refused call. Says nothing about why beyond the status. */
export function cronRefusal(auth: Exclude<CronAuth, "ok">): Response {
  if (auth === "not_configured") console.error("CRON_SECRET is not set (or shorter than 16 characters); scheduled jobs are refused.");
  return Response.json({ error: "unauthorized" }, { status: auth === "not_configured" ? 503 : 401 });
}
