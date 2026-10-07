/**
 * The claims queue. Each claim sits next to everything staff know about the
 * item, including the private fields students never see, so the claim can be
 * checked against them. Oldest first.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { CategoryTile } from "@/components/item-visuals";
import { StatusBadge, VisibilityBadge } from "@/components/staff-item-bits";
import { Alert, EmptyState } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ClaimStatus, StaffItem } from "@/lib/domain/types";
import { formatDate, formatDateTime } from "@/lib/i18n/dates";
import { t, type MessageKey } from "@/lib/i18n";
import type { Claim } from "@/lib/repo/interface";
import { photoStore } from "@/lib/server/photos";
import { getStaffContext } from "@/lib/server/staff-context";
import { decideClaimAction } from "./actions";

export const metadata: Metadata = { title: t("claims.title") };

const VIEWS: Record<string, ClaimStatus[]> = {
  pending: ["pending"],
  approved: ["approved"],
  closed: ["rejected", "picked_up"],
};

export default async function ClaimsPage({ searchParams }: PageProps<"/admin/claims">) {
  const sp = await searchParams;
  const view = typeof sp.view === "string" && sp.view in VIEWS ? sp.view : "pending";
  const { repo, school } = await getStaffContext("/admin/claims");
  const claims = await repo.listClaims(school.id, VIEWS[view]);
  if (view === "closed") claims.reverse();
  const items = new Map<string, StaffItem>();
  for (const id of new Set(claims.map((c) => c.itemId))) {
    const item = await repo.getItem(school.id, id);
    if (item) items.set(id, item);
  }
  const urls = new Map<string, string | null>();
  for (const item of items.values()) urls.set(item.id, item.photoPath ? await photoStore().url(item.photoPath) : null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl headline">{t("claims.title")}</h1>
        <p className="max-w-3xl text-muted">{t("claims.lead")}</p>
      </div>

      <nav aria-label={t("claims.title")}>
        <ul className="flex gap-1 overflow-x-auto">
          {Object.keys(VIEWS).map((v) => (
            <li key={v}>
              <Link
                href={`/admin/claims?view=${v}`}
                aria-current={v === view ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-xl px-4 font-medium whitespace-nowrap ${
                  v === view ? "bg-accent text-accent-foreground" : "text-muted hover:bg-accent-soft"
                }`}
              >
                {t(`claims.tab.${v}` as MessageKey)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {sp.done ? <Alert tone="success">{t("claims.done")}</Alert> : null}
      {sp.error ? <Alert tone="danger">{t("claims.error")}</Alert> : null}

      {claims.length === 0 ? (
        <EmptyState title={t(`claims.empty.${view}` as MessageKey)} />
      ) : (
        <ul className="flex flex-col gap-4">
          {claims.map((c) => (
            <li key={c.id}>
              <ClaimCard claim={c} item={items.get(c.itemId)} photoUrl={urls.get(c.itemId) ?? null} view={view} timeZone={school.timeZone} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ClaimCard({ claim, item, photoUrl, view, timeZone }: { claim: Claim; item?: StaffItem; photoUrl: string | null; view: string; timeZone: string }) {
  return (
    <article className="card grid gap-5 p-5 md:grid-cols-2" aria-label={`Claim for ${item ? t(`category.${item.category}`) : "item"}`}>
      <section className="flex flex-col gap-3 md:order-2 md:border-l md:border-border md:pl-4">
        <h2 className="text-sm font-semibold text-muted uppercase">{t("claims.item")}</h2>
        {item ? (
          <div className="flex gap-3">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="" className="size-24 shrink-0 rounded-xl object-cover" />
            ) : (
              <CategoryTile category={item.category} colors={item.colors} className="size-24 shrink-0 rounded-xl" />
            )}
            <div className="flex min-w-0 flex-col gap-1">
              <p className="font-semibold">
                {t(`category.${item.category}`)}
                {item.colors.length ? <span className="font-normal text-muted"> · {item.colors.map((c) => t(`color.${c}`)).join(", ")}</span> : null}
              </p>
              <p className="text-sm text-muted">
                {item.foundLocationName} · {formatDate(item.foundAt, timeZone)}
              </p>
              {item.note ? <p className="text-sm">{item.note}</p> : null}
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={item.status} />
                <VisibilityBadge visibility={item.visibility} />
              </div>
            </div>
          </div>
        ) : null}
        {item ? (
          <div className="grid gap-2 rounded-xl border border-warning bg-warning-soft p-3 text-sm">
            <p className="font-semibold text-warning">🔒 {t("claims.private")}</p>
            <dl className="grid gap-2">
            <div>
              <dt className="font-medium">{t("claims.ownerHint")}</dt>
              <dd>{item.ownerHint ?? <span className="text-muted">{t("claims.none")}</span>}</dd>
            </div>
            <div>
              <dt className="font-medium">{t("claims.staffNote")}</dt>
              <dd className="whitespace-pre-wrap">{item.staffNote ?? <span className="text-muted">{t("claims.none")}</span>}</dd>
            </div>
            </dl>
          </div>
        ) : null}
        {item ? (
          <Link href={`/admin/items/${item.id}`} className="self-start text-sm font-medium text-accent underline underline-offset-4">
            {t("claims.openItem")}
          </Link>
        ) : null}
      </section>

      <section className="flex flex-col gap-3 md:order-1">
        <h2 className="text-sm font-semibold text-muted uppercase">{t("claims.studentSays")}</h2>
        <blockquote className="rounded-xl bg-background p-4 text-lg">“{claim.claimantDetail}”</blockquote>
        <p className="text-sm text-muted">
          {t("claims.sent", { when: formatDateTime(claim.createdAt, timeZone) })} · {t("claims.contact")}: {claim.contactEmail ?? t("claims.noContact")}
        </p>
        <p className="text-sm font-medium">{t(`claimStatus.${claim.status}`)}</p>
        <div className="mt-auto flex flex-wrap gap-2">
          {claim.status === "pending" ? (
            <>
              <Decide claimId={claim.id} decision="approve" view={view} label={t("claims.approve")} variant="primary" />
              <Decide claimId={claim.id} decision="reject" view={view} label={t("claims.reject")} variant="danger" />
            </>
          ) : null}
          {claim.status === "approved" ? (
            <>
              <Decide claimId={claim.id} decision="picked_up" view={view} label={t("claims.pickedUp")} variant="primary" />
              <Decide claimId={claim.id} decision="reject" view={view} label={t("claims.reject")} variant="danger" />
            </>
          ) : null}
        </div>
      </section>
    </article>
  );
}

function Decide({ claimId, decision, view, label, variant }: { claimId: string; decision: string; view: string; label: string; variant: "primary" | "danger" }) {
  return (
    <form action={decideClaimAction}>
      <input type="hidden" name="claimId" value={claimId} />
      <input type="hidden" name="decision" value={decision} />
      <input type="hidden" name="view" value={view} />
      <Button type="submit" variant={variant}>
        {label}
      </Button>
    </form>
  );
}
