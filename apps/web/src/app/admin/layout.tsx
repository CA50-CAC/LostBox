import { PrivacyLink } from "@/components/privacy-link";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Alert } from "@/components/ui/alert";
import { Icon } from "@/components/icons";
import { TabBar, TopTabs, type Tab } from "@/components/tab-bar";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/auth/actions";
import { t } from "@/lib/i18n";
import { getStaffContext } from "@/lib/server/staff-context";
import { DEMO_SCHOOL_ID } from "@/lib/demo/seed";
import { appEnv } from "@/lib/env";
import { resetDemoData } from "./demo-actions";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { session, school, repo } = await getStaffContext();
  const pending = (await repo.listClaims(school.id, ["pending"])).length;
  const env = appEnv();
  const demoSchool = env.demoMode && env.dataAdapter === "pglite" && school.id === DEMO_SCHOOL_ID;

  const tabs: Tab[] = [
    { href: "/admin", label: t("nav.items"), icon: "grid", match: ["=/admin", "/admin/items/"], except: ["/admin/items/new"] },
    { href: "/admin/items/new", label: t("nav.add"), icon: "plus", match: ["/admin/items/new"], primary: true },
    { href: "/admin/claims", label: t("nav.claims"), icon: "inbox", match: ["/admin/claims"], badge: pending },
    { href: "/admin/settings", label: t("nav.settings"), icon: "gear", match: ["/admin/settings"] },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-card/85 backdrop-blur-lg">
        <div className="mx-auto flex min-h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 py-1.5">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/admin" className="rounded-lg">
              <Logo withName={false} />
              <span className="sr-only">{t("app.name")}</span>
            </Link>
            <div className="flex min-w-0 flex-col">
              <p className="truncate leading-tight font-semibold">{school.name}</p>
              <p className="text-xs font-medium text-muted">{t("nav.staffArea")}</p>
            </div>
          </div>
          <TopTabs tabs={tabs.map((tab) => (tab.primary ? { ...tab, label: t("nav.newItem"), primary: false } : tab))} label={t("nav.staffNav")} />
          <form action={signOut} className="flex shrink-0 items-center gap-3">
            <span className="hidden text-sm text-muted xl:inline">{t("nav.signedInAs", { email: session.email })}</span>
            <button
              type="submit"
              aria-label={t("nav.signOut")}
              title={t("nav.signOut")}
              className="grid size-11 place-items-center rounded-full text-muted hover:bg-surface hover:text-foreground"
            >
              <Icon name="logout" className="size-5" />
            </button>
          </form>
        </div>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pt-5 pb-28 md:py-8">
        {demoSchool ? (
          <form action={resetDemoData} className="flex items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning-soft py-1.5 pr-1.5 pl-4">
            <p className="text-sm leading-snug text-warning">{t("demo.resetHelp")}</p>
            <Button type="submit" variant="secondary" className="shrink-0 text-sm">
              {t("demo.reset")}
            </Button>
          </form>
        ) : null}
        {school.status === "pending_review" ? (
          <Alert tone="warning" title={t("admin.pending.title")}>
            {t("admin.pending.body")}
          </Alert>
        ) : null}
        {children}
        <PrivacyLink className="mt-auto pt-2" />
      </main>
      <TabBar tabs={tabs} label={t("nav.staffNav")} />
    </div>
  );
}
