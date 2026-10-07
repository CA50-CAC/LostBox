/**
 * Everything from the setup wizard, editable later. Same components, with
 * mode="settings" so saving stays on this page.
 */
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { JoinCodePanel } from "@/components/school/join-code-panel";
import { LocationsEditor } from "@/components/school/locations-editor";
import { PoliciesForm } from "@/components/school/policies-form";
import { PrivacyEditor } from "@/components/school/privacy-editor";
import { ProfileForm } from "@/components/school/profile-form";
import { StaffPanel } from "@/components/school/staff-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { Alert } from "@/components/ui/alert";
import { timeZoneOptions } from "@/lib/domain/time-zones";
import { appEnv } from "@/lib/env";
import { t } from "@/lib/i18n";
import { getStaffContext } from "@/lib/server/staff-context";
import { currentTheme } from "@/lib/server/theme";

export const metadata: Metadata = { title: t("settings.title") };

export default async function SettingsPage() {
  const { repo, school, isOwner } = await getStaffContext("/admin/settings");
  const [members, invites, locations, defaults, theme] = await Promise.all([
    repo.listMembers(school.id),
    isOwner ? repo.listInvites(school.id) : Promise.resolve([]),
    repo.listLocations(school.id),
    repo.getCategoryDefaults(school.id),
    currentTheme(),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-3xl headline">{t("settings.title")}</h1>
      {!isOwner ? <Alert tone="info">{t("admin.error.owner")}</Alert> : null}

      <Section id="access" title={t("settings.joinCode")}>
        <JoinCodePanel code={school.joinCode} appUrl={appEnv().appUrl} slug={school.slug} schoolName={school.name} isOwner={isOwner} />
      </Section>

      {isOwner ? (
        <>
          <Section id="school" title={t("settings.school")}>
            <ProfileForm
              mode="settings"
              initial={{ name: school.name, district: school.district, timeZone: school.timeZone }}
              timeZones={timeZoneOptions(school.timeZone)}
            />
          </Section>
          <Section id="places" title={t("settings.places")}>
            <LocationsEditor mode="settings" initial={locations.map((l) => l.name)} />
          </Section>
          <Section id="privacy" title={t("settings.privacy")}>
            <PrivacyEditor mode="settings" initial={defaults} />
          </Section>
          <Section id="pickup" title={t("settings.pickup")}>
            <PoliciesForm
              mode="settings"
              initial={{
                pickupLocation: school.pickupLocation,
                pickupHours: school.pickupHours,
                photoRetentionDays: school.photoRetentionDays,
                donateAfterDays: school.donateAfterDays,
              }}
            />
          </Section>
        </>
      ) : null}

      <Section id="staff" title={t("settings.staff")}>
        <StaffPanel members={members} invites={invites} isOwner={isOwner} />
      </Section>

      {/* A personal display choice (saved in a cookie on this device), not a school setting. */}
      <Section id="appearance" title={t("settings.appearance")}>
        <ThemeToggle theme={theme} />
      </Section>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} className="card flex flex-col gap-4 p-5 sm:p-8">
      <h2 id={`${id}-title`} className="text-xl headline">
        {title}
      </h2>
      {children}
    </section>
  );
}
