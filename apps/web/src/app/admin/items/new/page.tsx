import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { ItemForm } from "@/components/item-form";
import { isoDay } from "@/lib/i18n/dates";
import { t } from "@/lib/i18n";
import { getStaffContext } from "@/lib/server/staff-context";

export const metadata: Metadata = { title: t("intake.title") };

export default async function NewItemPage() {
  const { repo, school, isOwner } = await getStaffContext("/admin/items/new");
  const [locations, defaults] = await Promise.all([
    repo.listLocations(school.id),
    repo.getCategoryDefaults(school.id),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl headline">
          {t("intake.title")}
        </h1>
        <p className="text-muted">{t("intake.lead")}</p>
      </div>
      {locations.length === 0 ? (
        <EmptyState
          title={t("locations.empty")}
          action={
            isOwner ? (
              <ButtonLink href="/admin/settings#places">
                {t("settings.places")}
              </ButtonLink>
            ) : null
          }
        />
      ) : (
        <div className="card p-5 sm:p-8">
          <ItemForm
            mode="create"
            defaults={defaults}
            locations={locations}
            initial={{
              category: "",
              colors: [],
              note: "",
              foundLocationId: "",
              foundAt: isoDay(new Date(), school.timeZone),
              visibility: "limited",
              ownerHint: "",
              staffNote: "",
              photoUrl: null,
            }}
          />
        </div>
      )}
    </div>
  );
}
