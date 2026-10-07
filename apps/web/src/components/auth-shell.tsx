import { PrivacyLink } from "@/components/privacy-link";
import Link from "next/link";
import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import { Logo } from "./logo";

/** The centered card used by sign-in pages. */
export function AuthShell({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
        <Link href="/" className="self-center rounded-lg">
          <Logo />
          <span className="sr-only">{t("app.name")}</span>
        </Link>
        <div className="card flex flex-col gap-6 p-6 sm:p-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl headline sm:text-3xl">{title}</h1>
            {lead ? <p className="text-muted">{lead}</p> : null}
          </div>
          <div className="flex flex-col gap-4">{children}</div>
        </div>
        <PrivacyLink className="mt-auto pt-2" />
      </main>
    </div>
  );
}
