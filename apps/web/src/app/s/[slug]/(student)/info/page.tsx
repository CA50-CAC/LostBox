/** Pickup details and a quick "how claims work", as a tab in the student app. */
import Link from "next/link";
import { Icon } from "@/components/icons";
import { t, type MessageKey } from "@/lib/i18n";
import { getStudentContext } from "@/lib/server/student-context";

export const metadata = { title: t("info.title") };

const STEPS = [1, 2, 3] as const;

export default async function InfoPage({ params }: PageProps<"/s/[slug]/info">) {
  const { slug } = await params;
  const { school } = await getStudentContext(slug);
  const pickup = school.pickupLocation ?? "the front office";

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">{t("info.title")}</h1>
        <p className="text-muted">{t("info.lead", { school: school.name })}</p>
      </div>

      <ul className="card divide-y divide-border overflow-hidden">
        <li className="flex items-start gap-3 p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
            <Icon name="pin" className="size-5" />
          </span>
          <div>
            <p className="text-sm font-medium text-muted">{t("info.where")}</p>
            <p className="font-semibold">{school.pickupLocation ?? t("info.unset")}</p>
          </div>
        </li>
        <li className="flex items-start gap-3 p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
            <Icon name="clock" className="size-5" />
          </span>
          <div>
            <p className="text-sm font-medium text-muted">{t("info.when")}</p>
            <p className="font-semibold">{school.pickupHours || t("info.unset")}</p>
          </div>
        </li>
      </ul>

      <section aria-labelledby="how" className="flex flex-col gap-3">
        <h2 id="how" className="px-1 text-sm font-semibold tracking-wide text-muted uppercase">
          {t("info.howTitle")}
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
        <p className="flex items-start gap-2 rounded-2xl bg-surface px-4 py-3 text-sm text-muted">
          <Icon name="lock" className="mt-0.5 size-4 shrink-0" />
          {t("gallery.notListed", { pickup })}
        </p>
      </section>

      <section aria-labelledby="switch" className="flex flex-col gap-3">
        <h2 id="switch" className="px-1 text-sm font-semibold tracking-wide text-muted uppercase">
          {t("info.switchTitle")}
        </h2>
        <Link href="/" className="card flex min-h-14 items-center gap-3 px-4 font-semibold hover:bg-surface">
          <Icon name="swap" className="size-5 text-accent" />
          <span className="flex-1">{t("info.switch")}</span>
          <Icon name="chevron" className="size-5 text-muted" />
        </Link>
      </section>
    </div>
  );
}
