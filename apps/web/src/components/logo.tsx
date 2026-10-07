import { t } from "@/lib/i18n";

/** The LostBox mark: a box with a tag. Decorative; links that use it add their own label. */
export function Logo({ withName = true }: { withName?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-lg font-extrabold tracking-[-0.03em]">
      <svg aria-hidden viewBox="0 0 32 32" className="size-8">
        <rect x="3" y="10" width="26" height="18" rx="5" fill="var(--accent)" />
        <path d="M3 16h26" stroke="var(--accent-foreground)" strokeWidth="2" opacity="0.5" />
        <path d="M11 10V8a5 5 0 0 1 10 0v2" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="16" cy="21" r="2.5" fill="var(--accent-foreground)" />
      </svg>
      {withName ? <span aria-hidden>{t("app.name")}</span> : null}
    </span>
  );
}
