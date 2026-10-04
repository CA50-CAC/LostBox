/**
 * One page for all seven wizard steps. Each step renders a shared editor
 * (the same components the settings page uses) inside WizardShell.
 */
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { finishStaffStep, launchSchool } from "@/app/setup/actions";
import { LoginForm } from "@/app/login/login-form";
import { JoinCodePanel } from "@/components/school/join-code-panel";
import { LocationsEditor } from "@/components/school/locations-editor";
import { PoliciesForm } from "@/components/school/policies-form";
import { PrivacyEditor } from "@/components/school/privacy-editor";
import { ProfileForm } from "@/components/school/profile-form";
import { StaffPanel } from "@/components/school/staff-panel";
import { WizardShell } from "@/components/school/wizard-shell";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { looksLikeSchoolEmail } from "@/lib/domain/school-email";
import { timeZoneOptions } from "@/lib/domain/time-zones";
import { appEnv } from "@/lib/env";
import { t, type MessageKey } from "@/lib/i18n";
import { getStaffSession } from "@/lib/server/auth";
import { getWizardContext, resumeStep } from "@/lib/server/wizard";

export const metadata: Metadata = { title: "Set up", robots: { index: false, follow: false } };

export default async function SetupStep({ params }: PageProps<"/setup/[step]">) {
  const step = Number((await params).step);
  if (!Number.isInteger(step) || step < 1 || step > 7) notFound();

  if (step === 1) return <AccountStep />;

  const { repo, school } = await getWizardContext(step);
  const maxReachable = Math.max(resumeStep(school), step);
  // Don't let someone skip ahead past unfinished steps by typing a URL.
  if (step > resumeStep(school)) redirect(`/setup/${resumeStep(school)}`);
  const shell = (body: React.ReactNode, wide = false) => (
    <WizardShell step={step} maxReachable={maxReachable} title={t(`setup.step.${step}` as MessageKey)} lead={lead(step)} wide={wide}>
      {body}
    </WizardShell>
  );
  const back = `/setup/${step - 1}`;

  switch (step) {
    case 2:
      return shell(
        <ProfileForm
          mode="wizard"
          initial={{ name: school?.name ?? "", district: school?.district ?? null, timeZone: school?.timeZone ?? "America/Los_Angeles" }}
          timeZones={timeZoneOptions(school?.timeZone)}
          backHref={back}
        />,
      );
    case 3: {
      const locations = await repo.listLocations(school!.id);
      return shell(<LocationsEditor mode="wizard" initial={locations.map((l) => l.name)} backHref={back} />);
    }
    case 4:
      return shell(<PrivacyEditor mode="wizard" initial={await repo.getCategoryDefaults(school!.id)} backHref={back} />, true);
    case 5:
      return shell(
        <PoliciesForm
          mode="wizard"
          initial={{
            pickupLocation: school!.pickupLocation,
            pickupHours: school!.pickupHours,
            photoRetentionDays: school!.photoRetentionDays,
            donateAfterDays: school!.donateAfterDays,
          }}
          backHref={back}
        />,
      );
    case 6: {
      const [members, invites] = await Promise.all([repo.listMembers(school!.id), repo.listInvites(school!.id)]);
      return shell(
        <div className="flex flex-col gap-8">
          <StaffPanel members={members} invites={invites} isOwner />
          <form action={finishStaffStep} className="flex flex-wrap items-center gap-3">
            <SubmitButton pendingLabel={t("common.saving")}>{t("common.continue")}</SubmitButton>
            <a href={back} className="inline-flex min-h-11 items-center rounded-xl px-3 font-medium text-muted hover:text-foreground">
              {t("common.back")}
            </a>
          </form>
        </div>,
      );
    }
    default: {
      const locations = await repo.listLocations(school!.id);
      const fresh = (await repo.getSchool(school!.id))!;
      return shell(
        <div className="flex flex-col gap-8">
          <Alert tone={fresh.status === "approved" ? "success" : "warning"}>
            {fresh.status === "approved" ? t("launch.approved") : t("launch.pendingApproval")}
          </Alert>
          <section className="card p-5 sm:p-6">
            <JoinCodePanel code={fresh.joinCode} appUrl={appEnv().appUrl} slug={fresh.slug} schoolName={fresh.name} isOwner />
          </section>
          <section aria-labelledby="summary" className="flex flex-col gap-2">
            <h2 id="summary" className="font-semibold">
              {t("launch.summary")}
            </h2>
            <ul className="list-inside list-disc text-muted">
              <li>{fresh.name}</li>
              <li>{t("launch.summary.places", { count: locations.length })}</li>
              <li>{t("launch.summary.pickup", { location: fresh.pickupLocation ?? "—", hours: fresh.pickupHours ?? "—" })}</li>
            </ul>
          </section>
          <form action={launchSchool} className="flex flex-wrap items-center gap-3">
            <SubmitButton pendingLabel={t("launch.pending")}>{t("launch.submit")}</SubmitButton>
            <a href={back} className="inline-flex min-h-11 items-center rounded-xl px-3 font-medium text-muted hover:text-foreground">
              {t("common.back")}
            </a>
          </form>
        </div>,
      );
    }
  }
}

function lead(step: number): string | undefined {
  const leads: Record<number, MessageKey> = {
    2: "school.lead",
    3: "locations.lead",
    4: "privacy.lead",
    5: "policies.lead",
    6: "staff.lead",
    7: "launch.lead",
  };
  return leads[step] ? t(leads[step]) : undefined;
}

async function AccountStep() {
  const session = await getStaffSession();
  return (
    <WizardShell step={1} maxReachable={session ? 2 : 1} title={t("setup.step.1")} lead={t("setup.account.lead")}>
      {session ? (
        <div className="flex flex-col gap-4">
          <Alert tone="success">{t("setup.account.signedIn", { email: session.email })}</Alert>
          {!looksLikeSchoolEmail(session.email) ? <Alert tone="info">{t("setup.account.notSchool")}</Alert> : null}
          <ButtonLink href="/setup" className="self-start">
            {t("common.continue")}
          </ButtonLink>
        </div>
      ) : (
        <LoginForm next="/setup" demoEmail={null} />
      )}
    </WizardShell>
  );
}
