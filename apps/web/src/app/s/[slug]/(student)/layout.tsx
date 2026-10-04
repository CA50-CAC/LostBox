import { PrivacyLink } from "@/components/privacy-link";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { TabBar, TopTabs, type Tab } from "@/components/tab-bar";
import { t } from "@/lib/i18n";
import { getStudentContext } from "@/lib/server/student-context";

// School pages must never show up in search results (also set as an X-Robots-Tag header).
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * The student app shell: a slim top bar with the school's name, and three
 * tabs (browse, check a claim, pickup info). On phones the tabs sit at the
 * bottom like a native app; the item screen hides them and shows its own
 * "This might be mine" bar instead.
 */
export default async function StudentLayout({ children, params }: LayoutProps<"/s/[slug]">) {
  const { slug } = await params;
  const { school } = await getStudentContext(slug);
  const base = `/s/${slug}`;
  const tabs: Tab[] = [
    { href: base, label: t("tabs.browse"), icon: "grid", match: [`=${base}`, `${base}/items/`] },
    { href: `${base}/status`, label: t("tabs.claim"), icon: "ticket", match: [`${base}/status`] },
    { href: `${base}/info`, label: t("tabs.info"), icon: "info", match: [`${base}/info`] },
  ];
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur-lg">
        <div className="mx-auto flex min-h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
          <Link href={base} className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg">
            <Logo withName={false} />
            <span className="truncate font-semibold tracking-tight">{school.name}</span>
          </Link>
          <TopTabs tabs={tabs} label={t("tabs.label")} />
        </div>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pt-5 pb-28 md:pt-8 md:pb-12">
        {children}
        <PrivacyLink className="mt-auto pt-2" />
      </main>
      <TabBar tabs={tabs} label={t("tabs.label")} hideOn="/items/" />
    </div>
  );
}
