/**
 * The school's join QR code as an SVG image, for the launch screen and
 * settings. Staff only. It always reads the *current* join code from the
 * database (any query string is ignored and only busts the browser cache), so
 * after the code is rotated the QR can't point at the old one.
 */
import { appEnv } from "@/lib/env";
import { t } from "@/lib/i18n";
import { joinLink, qrSvg } from "@/lib/qr";
import { getStaffContext } from "@/lib/server/staff-context";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { school } = await getStaffContext("/admin/settings");
  const svg = qrSvg(joinLink(appEnv().appUrl, school.joinCode), t("qr.alt", { school: school.name }));
  const download = new URL(request.url).searchParams.has("download");
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      ...(download ? { "Content-Disposition": `attachment; filename="lostbox-join-qr-${school.slug}.svg"` } : {}),
    },
  });
}
