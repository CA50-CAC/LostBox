/**
 * One item, for staff: edit it, flip it private, change its status, and see
 * its claims. The "What students see" card is built with toStudentView(), the
 * same rule the student pages use, so staff see exactly what students get.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setItemPrivate, setItemStatus } from "@/app/admin/items/actions";
import { ItemCard } from "@/components/item-card";
import { ItemForm } from "@/components/item-form";
import { StatusBadge, VisibilityBadge } from "@/components/staff-item-bits";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/field";
import { toStudentView } from "@/lib/domain/visibility";
import { formatDateTime, isoDay } from "@/lib/i18n/dates";
import { t } from "@/lib/i18n";
import { photoStore } from "@/lib/server/photos";
import { getStaffContext } from "@/lib/server/staff-context";

export const metadata: Metadata = { title: t("edit.title") };

export default async function ItemPage({ params, searchParams }: PageProps<"/admin/items/[id]">) {
  const { id } = await params;
  const created = (await searchParams).created === "1";
  const { repo, school } = await getStaffContext(`/admin/items/${id}`);
  const item = /^[0-9a-f-]{36}$/.test(id) ? await repo.getItem(school.id, id) : null;
  if (!item) notFound();

  const [locations, defaults, claims] = await Promise.all([
    repo.listLocations(school.id),
    repo.getCategoryDefaults(school.id),
    repo.listClaims(school.id),
  ]);
  const photoUrl = item.photoPath ? await photoStore().url(item.photoPath) : null;
  const studentView = toStudentView(item, photoUrl);
  const itemClaims = claims.filter((c) => c.itemId === item.id);
  const open = item.status === "available" || item.status === "claimed";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/admin" className="self-start rounded text-sm font-medium text-accent underline underline-offset-4">
          ← {t("edit.backToItems")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl headline">{t(`category.${item.category}`)}</h1>
          <StatusBadge status={item.status} />
          <VisibilityBadge visibility={item.visibility} />
        </div>
      </div>
      {created ? <Alert tone="success">{item.visibility === "staff_only" ? t("intake.savedPrivate") : t("intake.saved")}</Alert> : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ItemForm
          mode="edit"
          defaults={defaults}
          locations={locations}
          initial={{
            id: item.id,
            category: item.category,
            colors: item.colors,
            note: item.note ?? "",
            foundLocationId: item.foundLocationId,
            foundAt: isoDay(new Date(item.foundAt), "UTC"),
            visibility: item.visibility,
            ownerHint: item.ownerHint ?? "",
            staffNote: item.staffNote ?? "",
            photoUrl,
          }}
        />

        <aside className="flex flex-col gap-6">
          <section aria-labelledby="student-view" className="flex flex-col gap-3">
            <h2 id="student-view" className="font-semibold">
              {t("edit.studentView")}
            </h2>
            {studentView ? (
              <div className="max-w-60">
                <ItemCard item={studentView} timeZone={school.timeZone} />
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-border-tint p-4 text-muted">{t("edit.studentView.hidden")}</p>
            )}
            <form action={setItemPrivate}>
              <input type="hidden" name="itemId" value={item.id} />
              <input type="hidden" name="private" value={item.visibility === "staff_only" ? "off" : "on"} />
              <Button type="submit" variant="secondary" className="w-full">
                {item.visibility === "staff_only" ? t("edit.makePublic") : `🔒 ${t("edit.makePrivate")}`}
              </Button>
            </form>
          </section>

          <section aria-labelledby="status-title" className="flex flex-col gap-3">
            <h2 id="status-title" className="font-semibold">
              {t("edit.status")}
            </h2>
            <p className="text-sm text-muted">{t("edit.status.lead")}</p>
            {open ? (
              <div className="flex flex-col gap-2">
                <StatusButton itemId={item.id} status="returned" label={t("edit.markReturned")} />
                <StatusButton itemId={item.id} status="donated" label={t("edit.markDonated")} />
              </div>
            ) : (
              <StatusButton itemId={item.id} status="available" label={t("edit.markAvailable")} />
            )}
            {item.status !== "removed" ? (
              <form action={setItemStatus} className="card flex flex-col gap-2 p-4">
                <input type="hidden" name="itemId" value={item.id} />
                <input type="hidden" name="status" value="removed" />
                <TextInput id="reason" name="reason" label={t("edit.remove.reason")} help={t("edit.remove.reason.help")} maxLength={200} required />
                <Button type="submit" variant="danger">
                  {t("edit.remove")}
                </Button>
              </form>
            ) : null}
          </section>

          <section aria-labelledby="claims-title" className="flex flex-col gap-3">
            <h2 id="claims-title" className="font-semibold">
              {t("edit.claims")}
            </h2>
            {itemClaims.length === 0 ? (
              <p className="text-muted">{t("edit.noClaims")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {itemClaims.map((c) => (
                  <li key={c.id} className="card p-4 text-sm">
                    <p className="font-medium">“{c.claimantDetail}”</p>
                    <p className="text-muted">
                      {t(`claimStatus.${c.status}`)} · {formatDateTime(c.createdAt, school.timeZone)}
                    </p>
                  </li>
                ))}
                <li>
                  <Link href="/admin/claims" className="text-sm font-medium text-accent underline underline-offset-4">
                    {t("edit.viewClaims")}
                  </Link>
                </li>
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function StatusButton({ itemId, status, label }: { itemId: string; status: string; label: string }) {
  return (
    <form action={setItemStatus}>
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant="secondary" className="w-full">
        {label}
      </Button>
    </form>
  );
}
