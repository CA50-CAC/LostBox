import { PrivacyLink } from "@/components/privacy-link";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Icon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { DEMO_JOIN_CODE } from "@/lib/demo/constants";
import { appEnv } from "@/lib/env";
import { t, type MessageKey } from "@/lib/i18n";
import { JoinForm } from "./join-form";

const STEPS = [1, 2, 3] as const;

/**
 * The front door. Students enter a join code; staff sign in or set up a school.
 * A join link (/?code=XXXX, used in QR codes) fills the code in.
 */
export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const code = typeof params.code === "string" ? params.code.slice(0, 16) : "";
  const demo = appEnv().demoMode;

  return (
    <div className="hero-glow flex flex-1 flex-col">
      <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-4 pt-10 pb-12 sm:pt-16">
        <section aria-labelledby="join-title" className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="grid size-16 place-items-center rounded-[1.25rem] bg-card shadow-md ring-1 ring-border">
              <span className="scale-125">
                <Logo withName={false} />
              </span>
            </span>
            <p className="rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent">{t("home.eyebrow")}</p>
            <h1 id="join-title" className="text-[2.1rem] leading-tight font-semibold tracking-tight sm:text-5xl">
              {t("home.title")}
            </h1>
            <p className="text-lg text-muted">{t("home.lead")}</p>
          </div>
          {params.join ? <Alert tone="info">{t("home.joinFirst")}</Alert> : null}
          <div className="card flex flex-col gap-4 p-5">
            <JoinForm initialCode={code} />
            {demo && !code ? (
              <Link
                href={`/?code=${DEMO_JOIN_CODE}`}
                className="flex min-h-12 items-center justify-between gap-2 rounded-xl bg-surface px-4 text-sm font-medium text-muted hover:text-foreground"
              >
                <span>{t("home.demoHint", { code: DEMO_JOIN_CODE })}</span>
                <Icon name="chevron" className="size-4 shrink-0" />
              </Link>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="how-title" className="flex flex-col gap-3">
          <h2 id="how-title" className="px-1 text-sm font-semibold tracking-wide text-muted uppercase">
            {t("home.how")}
          </h2>
          <ol className="card flex flex-col gap-4 p-4">
            {STEPS.map((n) => (
              <li key={n} className="flex gap-3">
                <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                  {n}
                </span>
                <div>
                  <p className="font-semibold">{t(`home.how.${n}.title` as MessageKey)}</p>
                  <p className="text-sm text-muted">{t(`home.how.${n}.body` as MessageKey)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="staff-title" className="flex flex-col gap-3">
          <h2 id="staff-title" className="px-1 text-sm font-semibold tracking-wide text-muted uppercase">
            {t("home.forStaff")}
          </h2>
          <ul className="card divide-y divide-border overflow-hidden">
            <li>
              <Link href="/login" className="flex min-h-14 items-center gap-3 px-4 font-semibold hover:bg-surface">
                <Icon name="key" className="size-5 text-accent" />
                <span className="flex-1">{t("home.staffSignIn")}</span>
                <Icon name="chevron" className="size-5 text-muted" />
              </Link>
            </li>
            <li>
              <Link href="/setup" className="flex min-h-14 items-center gap-3 px-4 font-semibold hover:bg-surface">
                <Icon name="school" className="size-5 text-accent" />
                <span className="flex-1">{t("home.setup")}</span>
                <Icon name="chevron" className="size-5 text-muted" />
              </Link>
            </li>
          </ul>
          <p className="px-1 text-sm text-muted">{t("home.staffLead")}</p>
        </section>
        <PrivacyLink className="mt-auto pt-2" />
      </main>
    </div>
  );
}
