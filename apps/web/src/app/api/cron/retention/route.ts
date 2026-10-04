/**
 * Daily photo retention job (see lib/services/retention.ts), called by Vercel
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
  const result = await runPhotoRetention((await repos()).system(), (p) => store.remove(p));
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
