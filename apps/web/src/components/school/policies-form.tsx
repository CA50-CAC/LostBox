"use client";

import { useActionState } from "react";
import { savePolicies } from "@/app/setup/actions";
import { TextInput } from "@/components/ui/field";
import { t } from "@/lib/i18n";
import { EMPTY_FORM, type FormState } from "@/lib/server/forms";
import { FormFooter } from "./form-footer";

export interface PoliciesValues {
  pickupLocation: string | null;
  pickupHours: string | null;
  photoRetentionDays: number;
  donateAfterDays: number;
}

export function PoliciesForm({ mode, initial, backHref }: { mode: "wizard" | "settings"; initial: PoliciesValues; backHref?: string }) {
  const [state, action] = useActionState<FormState, FormData>(savePolicies, EMPTY_FORM);
  const err = (k: string) => (state.errors?.[k] ? t(state.errors[k]) : undefined);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="mode" value={mode} />
      <TextInput
        id="pickupLocation"
        name="pickupLocation"
        label={t("policies.pickupLocation")}
        placeholder={t("policies.pickupLocation.placeholder")}
        defaultValue={initial.pickupLocation ?? ""}
        maxLength={120}
        required
        error={err("pickupLocation")}
      />
      <TextInput
        id="pickupHours"
        name="pickupHours"
        label={t("policies.pickupHours")}
        placeholder={t("policies.pickupHours.placeholder")}
        defaultValue={initial.pickupHours ?? ""}
        maxLength={120}
        required
        error={err("pickupHours")}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          id="photoRetentionDays"
          name="photoRetentionDays"
          type="number"
          inputMode="numeric"
          min={0}
          max={365}
          label={t("policies.retention")}
          help={t("policies.retention.help")}
          defaultValue={initial.photoRetentionDays}
          error={err("photoRetentionDays")}
        />
        <TextInput
          id="donateAfterDays"
          name="donateAfterDays"
          type="number"
          inputMode="numeric"
          min={1}
          max={365}
          label={t("policies.donate")}
          help={t("policies.donate.help")}
          defaultValue={initial.donateAfterDays}
          error={err("donateAfterDays")}
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium">{t("policies.verification")}</legend>
        <label className="flex items-start gap-3 rounded-xl border border-accent bg-accent-soft p-3">
          <input type="radio" name="verification" value="in_person" defaultChecked className="mt-1 size-5 accent-[var(--accent)]" />
          <span>
            <span className="font-medium">{t("policies.verification.inPerson")}</span>
            <span className="block text-sm text-muted">{t("policies.verification.inPerson.help")}</span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-xl border border-border bg-background p-3 text-muted">
          <input type="radio" name="verification" value="login" disabled className="mt-1 size-5" />
          <span>{t("policies.verification.login")}</span>
        </label>
      </fieldset>
      <FormFooter state={state} mode={mode} backHref={backHref} />
    </form>
  );
}
