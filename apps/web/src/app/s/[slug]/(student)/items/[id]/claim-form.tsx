"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { Honeypot, TextArea, TextInput } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { t } from "@/lib/i18n";
import { EMPTY_FORM, type FormState } from "@/lib/server/forms";
import { submitClaim } from "../../actions";

export function ClaimForm({ slug, itemId, pickup, hours }: { slug: string; itemId: string; pickup: string; hours: string }) {
  const [state, action] = useActionState<FormState, FormData>(submitClaim, EMPTY_FORM);
  const err = (k: string) => (state.errors?.[k] ? t(state.errors[k]) : undefined);

  if (state.ok && state.data?.code) {
    const code = state.data.code;
    return (
      <div className="flex flex-col gap-4" role="status">
        <Alert tone="success" title={t("claim.sent.title")}>
          {t("claim.sent.body")}
        </Alert>
        <div className="rounded-2xl bg-accent-soft p-6 text-center">
          <p className="text-sm font-medium text-muted">{t("claim.sent.code")}</p>
          <p className="text-3xl code-text text-accent select-all">{code}</p>
        </div>
        <p>{t("claim.sent.next", { pickup, hours })}</p>
        <Link href={`/s/${slug}/status?code=${encodeURIComponent(code)}`} className={buttonClass("secondary", "self-start")}>
          {t("claim.sent.check")}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="relative flex flex-col gap-4" noValidate>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="itemId" value={itemId} />
      <Honeypot />
      <TextArea id="claimantDetail" name="claimantDetail" label={t("claim.detail")} help={t("claim.detail.help")} required minLength={3} maxLength={500} error={err("claimantDetail")} />
      <TextInput id="contactEmail" name="contactEmail" type="email" autoComplete="email" label={t("claim.email")} help={t("claim.email.help")} optional={t("common.optional")} error={err("contactEmail")} />
      {state.error ? <Alert tone="danger">{t(state.error)}</Alert> : null}
      <SubmitButton pendingLabel={t("claim.submitting")} className="self-start">
        {t("claim.submit")}
      </SubmitButton>
    </form>
  );
}
