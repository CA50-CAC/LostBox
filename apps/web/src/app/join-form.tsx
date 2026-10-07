"use client";

import { useActionState } from "react";
import { inputClass, TextInput } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { t } from "@/lib/i18n";
import { joinSchool, type JoinState } from "./join-actions";

export function JoinForm({ initialCode = "" }: { initialCode?: string }) {
  const [state, action] = useActionState<JoinState, FormData>(joinSchool, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <TextInput
        id="code"
        name="code"
        label={t("join.label")}
        help={t("join.help")}
        error={state.error}
        defaultValue={state.code ?? initialCode}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={16}
        required
        className={`${inputClass} min-h-14 px-4 text-center text-2xl code-text placeholder:font-semibold placeholder:text-muted/70`}
        placeholder="ABCD2345"
      />
      <SubmitButton pendingLabel={t("join.pending")} className="min-h-14 text-lg">
        {t("join.submit")}
      </SubmitButton>
    </form>
  );
}
