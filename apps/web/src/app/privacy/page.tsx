/**
 * The privacy page, in plain English, for students, parents, and staff.
 * Public (no sign-in) and linked from student and staff screens. Every claim
 * here matches what the code does; if a rule changes, change this page too.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { Logo } from "@/components/logo";
import { t, type MessageKey } from "@/lib/i18n";

export const metadata: Metadata = { title: t("privacyPage.title"), description: t("privacyPage.lead") };

const SECTIONS: Array<{ id: string; icon: IconName; title: MessageKey; points: MessageKey[] }> = [
  {
    id: "collect",
    icon: "inbox",
    title: "privacyPage.collect.title",
    points: ["privacyPage.collect.items", "privacyPage.collect.claims", "privacyPage.collect.codes", "privacyPage.collect.staff", "privacyPage.collect.school", "privacyPage.collect.cookies", "privacyPage.collect.limits"],
  },
  { id: "not", icon: "lock", title: "privacyPage.not.title", points: ["privacyPage.not.1", "privacyPage.not.2", "privacyPage.not.3", "privacyPage.not.4"] },
  { id: "photos", icon: "grid", title: "privacyPage.photos.title", points: ["privacyPage.photos.1", "privacyPage.photos.2", "privacyPage.photos.3", "privacyPage.photos.4"] },
  { id: "staff", icon: "key", title: "privacyPage.staff.title", points: ["privacyPage.staff.1", "privacyPage.staff.2", "privacyPage.staff.3"] },
  {
    id: "retention",
    icon: "clock",
    title: "privacyPage.retention.title",
    points: ["privacyPage.retention.1", "privacyPage.retention.contact", "privacyPage.retention.2", "privacyPage.retention.3", "privacyPage.retention.4"],
  },
];

export default function PrivacyPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border/70 bg-background/85">
        <div className="mx-auto flex min-h-14 w-full max-w-2xl items-center px-4">
          <Link href="/" className="flex min-h-11 items-center gap-2 rounded-lg">
            <Logo />
            <span className="sr-only">{t("app.name")}</span>
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8 sm:py-12">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("privacyPage.title")}</h1>
          <p className="text-lg text-muted">{t("privacyPage.lead")}</p>
          <p className="text-sm text-muted">{t("privacyPage.updated")}</p>
        </div>

        {SECTIONS.map((s) => (
          <section key={s.id} aria-labelledby={`privacy-${s.id}`} className="flex flex-col gap-3">
            <h2 id={`privacy-${s.id}`} className="flex items-center gap-3 text-xl font-semibold tracking-tight">
              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                <Icon name={s.icon} className="size-5" />
              </span>
              {t(s.title)}
            </h2>
            <ul className="card flex flex-col divide-y divide-border">
              {s.points.map((p) => (
                <li key={p} className="px-4 py-3 leading-relaxed">
                  {t(p)}
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section aria-labelledby="privacy-contact" className="card flex flex-col gap-2 p-5">
          <h2 id="privacy-contact" className="text-xl font-semibold tracking-tight">
            {t("privacyPage.contact.title")}
          </h2>
          <p className="text-muted">{t("privacyPage.contact.body")}</p>
        </section>

        <Link href="/" className="inline-flex min-h-11 w-fit items-center gap-1 rounded-lg font-medium text-accent hover:underline">
          <Icon name="back" className="size-4" />
          {t("privacyPage.back")}
        </Link>
      </main>
    </div>
  );
}
