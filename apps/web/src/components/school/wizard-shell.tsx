import { PrivacyLink } from "@/components/privacy-link";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { t, type MessageKey } from "@/lib/i18n";

const TOTAL = 7;

/**
 * The frame around every wizard step: progress, title, and the step's form.
 * Finished steps are links, so the admin can go back and change anything.
 */
export function WizardShell({
  step,
  maxReachable,
  title,
  lead,
  wide = false,
  children,
}: {
  step: number;
  maxReachable: number;
  title: string;
  lead?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <main id="main" className={`mx-auto flex w-full ${wide ? "max-w-6xl" : "max-w-2xl"} flex-1 flex-col gap-8 px-4 py-8`}>
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="rounded-lg">
          <Logo />
          <span className="sr-only">{t("app.name")}</span>
        </Link>
        <p className="rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent">{t("setup.stepOf", { step, total: TOTAL })}</p>
      </div>

      <nav aria-label={t("setup.progress")}>
        <ol className="grid grid-cols-7">
          {Array.from({ length: TOTAL }, (_, i) => i + 1).map((n) => {
            const label = t(`setup.step.${n}` as MessageKey);
            const done = n < step;
            const current = n === step;
            const reachable = n <= maxReachable && !current;
            // A numbered dot (a check once done) on a line that fills in as you go.
            const bar = (
              <div aria-hidden className="relative flex items-center justify-center">
                {n > 1 ? <span className={`absolute right-1/2 left-0 h-0.5 -translate-x-4 ${n <= step ? "bg-accent" : "bg-border"}`} /> : null}
                {n < TOTAL ? <span className={`absolute right-0 left-1/2 h-0.5 translate-x-4 ${n < step ? "bg-accent" : "bg-border"}`} /> : null}
                <span
                  className={`relative grid size-8 place-items-center rounded-lg text-sm font-extrabold transition-colors ${
                    done
                      ? "bg-accent text-accent-foreground"
                      : current
                        ? "bg-accent-soft text-accent ring-2 ring-accent ring-offset-2 ring-offset-background"
                        : "bg-accent-soft text-muted"
                  }`}
                >
                  {done ? (
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12 5 5 9-10" />
                    </svg>
                  ) : (
                    n
                  )}
                </span>
              </div>
            );
            const text = `mt-2 hidden text-center text-xs sm:block ${current ? "font-semibold text-foreground" : "text-muted"}`;
            return (
              <li key={n}>
                {reachable ? (
                  <Link href={`/setup/${n}`} className="block rounded-lg py-1 hover:[&_span.relative]:ring-2 hover:[&_span.relative]:ring-accent/40">
                    {bar}
                    <span className={text}>{label}</span>
                    <span className="sr-only sm:hidden">{label}</span>
                  </Link>
                ) : (
                  <div aria-current={current ? "step" : undefined} className="py-1">
                    {bar}
                    <span className={text}>{label}</span>
                    <span className="sr-only sm:hidden">{label}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl headline sm:text-4xl">{title}</h1>
        {lead ? <p className="text-lg text-muted">{lead}</p> : null}
      </div>
      {children}
      <PrivacyLink className="mt-auto pt-2" />
      </main>
  );
}
