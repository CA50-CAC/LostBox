/** Students check a claim with the code they were given. No account needed. */
import { ItemCard } from "@/components/item-card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { hashCode } from "@/lib/domain/codes";
import { formatDate } from "@/lib/i18n/dates";
import { t, type MessageKey } from "@/lib/i18n";
import { getStudentContext } from "@/lib/server/student-context";
import { claimStatusAllowed, cleanClaimCode } from "@/lib/server/claim-lookup";

const TONE = { pending: "info", approved: "success", rejected: "warning", picked_up: "success" } as const;

export default async function ClaimStatusPage({ params, searchParams }: PageProps<"/s/[slug]/status">) {
  const { slug } = await params;
  const raw = (await searchParams).code;
  const { students, school } = await getStudentContext(slug);
  const entered = typeof raw === "string" ? raw.slice(0, 20) : "";

  let result: Awaited<ReturnType<typeof students.getClaimByCodeHash>> = null;
  let error: MessageKey | null = null;
  if (entered) {
    const code = cleanClaimCode(entered);
    if (!(await claimStatusAllowed())) error = "common.error.rateLimited";
    else if (!code) error = "status.notFound";
    else {
      result = await students.getClaimByCodeHash(await hashCode(code));
      if (!result) error = "status.notFound";
    }
  }
  const pickup = school.pickupLocation ?? "the front office";

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("status.title")}</h1>
        <p className="text-muted">{t("status.lead")}</p>
      </div>
      <form method="get" className="card flex flex-col gap-2 p-5 sm:p-6">
        <label htmlFor="code" className="font-medium">
          {t("status.code")}
        </label>
        <div className="flex gap-2">
          <input
            id="code"
            name="code"
            defaultValue={entered}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="ABCDE-23456"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "code-error" : undefined}
            className={`${inputClass} font-mono text-lg tracking-widest uppercase`}
          />
          <Button type="submit">{t("status.submit")}</Button>
        </div>
        {error ? (
          <p id="code-error" role="alert" className="text-sm font-medium text-danger">
            {t(error)}
          </p>
        ) : null}
      </form>

      {result ? (
        <section aria-labelledby="result" className="flex flex-col gap-4">
          <h2 id="result" className="sr-only">
            {t("status.result")}
          </h2>
          <Alert tone={TONE[result.status]} title={t(`claimStatus.${result.status}`)}>
            <p>{t(`status.${result.status}.body` as MessageKey, { pickup, hours: school.pickupHours ?? "" })}</p>
            <p className="mt-1 text-sm text-muted">{t("status.sent", { when: formatDate(result.createdAt) })}</p>
          </Alert>
          {result.item ? (
            <div className="max-w-60">
              <ItemCard item={result.item} />
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
