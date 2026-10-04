import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Icon } from "@/components/icons";
import { signOut } from "@/app/auth/actions";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** A plain shell for the platform admin pages (one page today: school approval). */
export default function PlatformLayout({ children }: LayoutProps<"/platform">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-card/85 backdrop-blur-lg">
        <div className="mx-auto flex min-h-14 w-full max-w-4xl items-center justify-between gap-3 px-4 py-1.5">
          <Link href="/platform/schools" className="flex min-h-11 items-center gap-3 rounded-lg">
            <Logo withName={false} />
            <span className="flex flex-col">
              <span className="leading-tight font-semibold">{t("app.name")}</span>
              <span className="text-xs font-medium text-muted">{t("platform.area")}</span>
            </span>
          </Link>
          <form action={signOut}>
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
      <main id="main" className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 md:py-8">
        {children}
      </main>
    </div>
  );
}
