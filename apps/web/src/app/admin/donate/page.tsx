/**
 * Staff-only "Ready to donate" list: items on the shelf longer than the
 * school's donate-after period. Staff tick the ones going to donation and
 * confirm; each is logged in the audit log.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { Thumb } from "@/components/staff-item-bits";
import { Alert, EmptyState } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { foundAgo } from "@/lib/i18n/dates";
import { t } from "@/lib/i18n";
import { photoStore } from "@/lib/server/photos";
import { getStaffContext } from "@/lib/server/staff-context";
import { listReadyToDonate } from "@/lib/services/donate";
import { donateItemsAction } from "./actions";
import { DonateForm, type DonateRow } from "./donate-form";

export const metadata: Metadata = { title: t("donate.title") };

export default async function DonatePage({ searchParams }: PageProps<"/admin/donate">) {
  const sp = await searchParams;
  const { repo, school } = await getStaffContext("/admin/donate");
  const { items, heldForClaims } = await listReadyToDonate(repo, school.id, school.donateAfterDays);
  const urls = await Promise.all(items.map((i) => (i.photoPath ? photoStore().url(i.photoPath) : null)));
  const days = school.donateAfterDays;

  const rows: DonateRow[] = items.map((item, i) => {
    const label = [t(`category.${item.category}`), ...item.colors.map((c) => t(`color.${c}`))].join(", ");
    return {
      id: item.id,
      label,
      content: (
        <>
          <Thumb item={item} url={urls[i]} size="size-12" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate font-medium">{label}</span>
            <span className="truncate text-sm text-muted">
              {t("donate.found", { when: foundAgo(item.foundAt, undefined, school.timeZone), place: item.foundLocationName })}
            </span>
          </span>
        </>
      ),
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin" className="inline-flex min-h-11 w-fit items-center gap-1 rounded-lg text-sm font-medium text-muted hover:text-foreground">
          <Icon name="back" className="size-4" />
          {t("donate.back")}
        </Link>
        <h1 className="text-3xl headline">{t("donate.title")}</h1>
        <p className="max-w-2xl text-muted">{t("donate.lead", { days })}</p>
      </div>

      {typeof sp.done === "string" ? <Alert tone="success">{t("donate.done", { count: Number(sp.done) || 0 })}</Alert> : null}
      {sp.error === "changed" ? <Alert tone="danger">{t("donate.error.changed")}</Alert> : null}
      {sp.error === "none" ? <Alert tone="danger">{t("donate.error.none")}</Alert> : null}
      {heldForClaims ? <Alert tone="warning">{t("donate.held", { count: heldForClaims })}</Alert> : null}

      {rows.length === 0 ? (
        <EmptyState title={t("donate.empty.title")} action={<ButtonLink href="/admin" variant="secondary">{t("donate.back")}</ButtonLink>}>
          {t("donate.empty.body", { days })}
        </EmptyState>
      ) : (
        <DonateForm rows={rows} action={donateItemsAction} />
      )}
    </div>
  );
}
