"use client";

import { useActionState, useState } from "react";
import { rotateJoinCode } from "@/app/setup/actions";
import { Button, buttonClass } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { t } from "@/lib/i18n";
import { EMPTY_FORM, type FormState } from "@/lib/server/forms";

/**
 * The school's join code, link, and QR code, with a button for owners to
 * replace the code. The QR image comes from /admin/join-qr, drawn on the
 * server from the code in the database; `?v=` only makes the browser fetch it
 * again after the code changes.
 */
export function JoinCodePanel({ code, appUrl, slug, schoolName, isOwner }: { code: string; appUrl: string; slug: string; schoolName: string; isOwner: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(rotateJoinCode, EMPTY_FORM);
  const current = state.data?.code ?? code;
  const link = `${appUrl}/?code=${current}`;
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-muted">{t("launch.joinCode")}</p>
        <p aria-live="polite" className="font-mono text-4xl font-semibold tracking-[0.25em] text-accent sm:text-5xl">
          {current}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-muted">{t("launch.link")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-lg bg-surface px-2 py-1 text-sm break-all">{link}</code>
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(link);
              setCopied(true);
            }}
          >
            {copied ? t("staff.copied") : t("staff.copy")}
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- a small server-made SVG; next/image adds nothing here */}
        <img
          src={`/admin/join-qr?v=${current}`}
          alt={t("qr.alt", { school: schoolName })}
          width={176}
          height={176}
          className="size-44 shrink-0 rounded-2xl border border-border bg-white p-2"
        />
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">{t("qr.help")}</p>
          <div className="flex flex-wrap gap-2">
            <a href={`/admin/join-qr?v=${current}&download=1`} download className={buttonClass("secondary")}>
              {t("qr.download")}
            </a>
            <a href={`/s/${slug}/poster`} className={buttonClass("secondary")}>
              {t("poster.open")}
            </a>
          </div>
        </div>
      </div>
      {isOwner ? (
        <form action={action} className="flex flex-col gap-2">
          <p className="text-sm text-muted">{t("launch.rotate.help")}</p>
          <SubmitButton variant="secondary" pendingLabel={t("launch.rotating")} className="self-start">
            {t("launch.rotate")}
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
