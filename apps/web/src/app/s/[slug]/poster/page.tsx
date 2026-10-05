/**
 * The print-ready poster: school name, QR code, join code, and pickup details,
 * on one US Letter page. Staff only (a member of this school); it sits outside
 * the student layout, so it doesn't need a join code.
 *
 * Everything comes from the database on each request, so a rotated join code
 * shows up here (and in the QR) the next time the page is opened. Print CSS
 * hides the toolbar and the demo banner; the sheet itself is pure black on
 * white, so it prints well on any office printer.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { appEnv } from "@/lib/env";
import { t } from "@/lib/i18n";
import { joinLink, qrSvg } from "@/lib/qr";
import { getStaffContext } from "@/lib/server/staff-context";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: t("poster.title"), robots: { index: false, follow: false } };

export default async function PosterPage({ params }: PageProps<"/s/[slug]/poster">) {
  const { slug } = await params;
  const { schools } = await getStaffContext(`/s/${slug}/poster`);
  const school = schools.find((s) => s.slug === slug);
  if (!school) notFound();

  const appUrl = appEnv().appUrl;
  const link = joinLink(appUrl, school.joinCode);
  const host = new URL(appUrl).host;
  // Our own SVG markup (the label is escaped in qrSvg), so it's safe to inline.
  const qr = qrSvg(link, t("qr.alt", { school: school.name }));

  return (
    <div className="flex flex-1 flex-col items-center gap-6 px-4 py-6 print:block print:p-0">
      <style>{`@page { size: letter portrait; margin: 0.5in; }`}</style>

      <div className="flex w-full max-w-[8.5in] flex-col gap-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin/settings#access" className={buttonClass("ghost")}>
            ← {t("poster.back")}
          </Link>
          <PrintButton label={t("poster.print")} />
        </div>
        <p className="text-sm text-muted">{t("poster.tip")}</p>
        {school.status !== "approved" ? <Alert tone="warning">{t("poster.pendingNote")}</Alert> : null}
      </div>

      <main
        id="main"
        // The sheet is always paper: black on white in both themes, with a black logo.
        style={{ "--accent": "#000", "--accent-foreground": "#fff" } as React.CSSProperties}
        className="flex aspect-[8.5/11] w-full max-w-[8.5in] flex-col items-center justify-between gap-6 rounded-2xl bg-white p-[6%] text-center text-black shadow-lg ring-1 ring-black/10 print:aspect-auto print:h-[10in] print:max-w-none print:rounded-none print:p-0 print:shadow-none print:ring-0"
      >
        <header className="flex flex-col items-center gap-2">
          <p className="text-[clamp(1rem,2.6vw,1.4rem)] font-semibold tracking-wide uppercase print:text-[16pt]">{school.name}</p>
          <h1 className="text-[clamp(2.25rem,8vw,4.5rem)] leading-none font-bold tracking-tight print:text-[54pt]">{t("poster.headline")}</h1>
          <p className="text-[clamp(1.1rem,3.4vw,1.9rem)] font-medium print:text-[22pt]">{t("poster.sub")}</p>
        </header>

        <div className="w-[min(62%,3.75in)] print:w-[3.75in]" dangerouslySetInnerHTML={{ __html: qr }} />

        <div className="flex flex-col items-center gap-1">
          <p className="text-[clamp(0.85rem,2vw,1.1rem)] font-semibold tracking-widest uppercase print:text-[12pt]">{t("poster.code")}</p>
          <p className="font-mono text-[clamp(2rem,7vw,3.75rem)] leading-none font-bold tracking-[0.2em] print:text-[44pt]">{school.joinCode}</p>
          <p className="mt-1 text-[clamp(0.85rem,2vw,1.1rem)] print:text-[12pt]">{t("poster.orVisit", { host })}</p>
        </div>

        <dl className="grid w-full grid-cols-2 gap-4 border-t-2 border-black pt-[3%] text-left text-[clamp(0.9rem,2.2vw,1.25rem)] print:text-[14pt]">
          <div>
            <dt className="text-[0.8em] font-semibold tracking-wide uppercase">{t("poster.pickup")}</dt>
            <dd className="font-medium">{school.pickupLocation || t("poster.unset")}</dd>
          </div>
          <div>
            <dt className="text-[0.8em] font-semibold tracking-wide uppercase">{t("poster.hours")}</dt>
            <dd className="font-medium">{school.pickupHours || t("poster.unset")}</dd>
          </div>
        </dl>

        <footer className="flex w-full items-center justify-between gap-4 text-left text-[clamp(0.7rem,1.6vw,0.95rem)] print:text-[10pt]">
          <p className="max-w-[75%]">{t("poster.footer")}</p>
          <span className="shrink-0">
            <Logo />
          </span>
        </footer>
      </main>
    </div>
  );
}
