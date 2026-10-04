/**
 * Platform admins approve (or reject) schools here. Only emails listed in
 * PLATFORM_ADMIN_EMAILS can open it; everyone else gets a 404.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Alert, EmptyState } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { SchoolStatus } from "@/lib/domain/types";
import { formatDate } from "@/lib/i18n/dates";
import { t, type MessageKey } from "@/lib/i18n";
import type { School } from "@/lib/repo/interface";
import type { SchoolDecision } from "@/lib/services/schools";
import { requirePlatformAdmin } from "@/lib/server/platform-context";
import { reviewSchoolAction } from "./actions";

export const metadata: Metadata = { title: t("platform.title") };

const VIEWS: SchoolStatus[] = ["pending_review", "approved", "rejected"];

/** Which buttons each list offers. */
const DECISIONS: Record<SchoolStatus, SchoolDecision[]> = {
  pending_review: ["approve", "reject"],
  approved: ["reject"],
  rejected: ["approve", "reopen"],
};

export default async function PlatformSchoolsPage({ searchParams }: PageProps<"/platform/schools">) {
  const sp = await searchParams;
  const view = VIEWS.find((v) => v === sp.view) ?? "pending_review";
  const { platform } = await requirePlatformAdmin("/platform/schools");
  const schools = await platform.listSchools(view);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t("platform.title")}</h1>
        <p className="max-w-2xl text-muted">{t("platform.lead")}</p>
      </div>

      <nav aria-label={t("platform.title")}>
        <ul className="flex gap-1 overflow-x-auto">
          {VIEWS.map((v) => (
            <li key={v}>
              <Link
                href={`/platform/schools?view=${v}`}
                aria-current={v === view ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-xl px-4 font-medium whitespace-nowrap ${
                  v === view ? "bg-foreground text-background" : "text-muted hover:bg-surface"
                }`}
              >
                {t(`platform.tab.${v}` as MessageKey)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {sp.done ? <Alert tone="success">{t("platform.done")}</Alert> : null}
      {sp.error ? <Alert tone="danger">{t("platform.error")}</Alert> : null}

      {schools.length === 0 ? (
        <EmptyState title={t(`platform.empty.${view}` as MessageKey)} />
      ) : (
        <ul className="flex flex-col gap-4">
          {schools.map((s) => (
            <li key={s.id}>
              <SchoolCard school={s} view={view} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SchoolCard({ school, view }: { school: School & { ownerEmail: string | null }; view: SchoolStatus }) {
  return (
    <article aria-labelledby={`school-${school.id}`} className="card flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1">
        <h2 id={`school-${school.id}`} className="text-lg font-semibold">
          {school.name}
        </h2>
        <p className="font-mono text-sm text-muted">/s/{school.slug}</p>
      </div>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">{t("platform.owner")}</dt>
          <dd className="font-medium break-all">{school.ownerEmail ?? t("platform.noOwner")}</dd>
        </div>
        <div>
          <dt className="text-muted">{t("platform.district")}</dt>
          <dd className="font-medium">{school.district || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">{t("platform.created", { when: formatDate(school.createdAt, school.timeZone) })}</dt>
          <dd className="font-medium">{school.launchedAt ? t("platform.launched") : t("platform.setup", { step: school.setupStep })}</dd>
        </div>
      </dl>
      {school.needsManualReview ? <Alert tone="warning">{t("platform.flag")}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        {DECISIONS[view].map((decision) => (
          <form key={decision} action={reviewSchoolAction}>
            <input type="hidden" name="schoolId" value={school.id} />
            <input type="hidden" name="decision" value={decision} />
            <input type="hidden" name="view" value={view} />
            <Button type="submit" variant={decision === "approve" ? "primary" : decision === "reject" ? "danger" : "secondary"}>
              {t(`platform.${decision}` as MessageKey)}
              <span className="sr-only"> {school.name}</span>
            </Button>
          </form>
        ))}
      </div>
    </article>
  );
}
