/**
 * Daily retention job (see lib/services/retention.ts): expired photos, then
 * contact emails on closed claims. Called by Vercel
 * Cron (apps/web/vercel.json) with `Authorization: Bearer <CRON_SECRET>`.
 * Without the right secret it does nothing.
 *
 * Locally: curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/retention
 */
import { checkCronAuth, cronRefusal } from "@/lib/server/cron-auth";
import { photoStore } from "@/lib/server/photos";
import { repos } from "@/lib/server/repos";
import { runPhotoRetention } from "@/lib/services/retention";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = checkCronAuth(request.headers.get("authorization"), process.env.CRON_SECRET);
  if (auth !== "ok") return cronRefusal(auth);
  const store = photoStore();
  const system = (await repos()).system();
  const photos = await runPhotoRetention(system, (p) => store.remove(p));
  // Optional contact emails on closed claims follow the same retention period.
  const contactsCleared = await system.clearClosedClaimContacts(new Date());
  return Response.json({ ...photos, contactsCleared }, { headers: { "Cache-Control": "no-store" } });
}
