"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { Honeypot, TextInput } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { t } from "@/lib/i18n";
import { sendSignInLink, type LoginState } from "./actions";

export function LoginForm({ next, demoEmail }: { next: string; demoEmail: string | null }) {
  const [state, action] = useActionState<LoginState, FormData>(sendSignInLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success" title={t("login.sent.title")}>
          {t("login.sent.body", { email: state.email })}
        </Alert>
        {state.devLink ? (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4">
            <p className="font-semibold">{t("login.devLink.title")}</p>
            <p className="text-sm text-muted">{t("login.devLink.body")}</p>
            <a href={state.devLink} className={buttonClass("primary")}>
              {t("login.devLink.open")}
            </a>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form action={action} className="relative flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <Honeypot />
      <TextInput
        id="email"
        name="email"
        type="email"
        label={t("login.email")}
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.status === "error" ? state.email : (demoEmail ?? "")}
        error={state.status === "error" ? state.message : undefined}
        help={demoEmail ? t("login.demoHint", { email: demoEmail }) : undefined}
      />
      <SubmitButton pendingLabel={t("login.pending")}>{t("login.submit")}</SubmitButton>
    </form>
  );
}
