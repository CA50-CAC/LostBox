import type { ReactNode } from "react";

type Tone = "info" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  info: "border-transparent bg-accent-soft text-foreground",
  success: "border-success/30 bg-success-soft text-success",
  warning: "border-warning/30 bg-warning-soft text-warning",
  danger: "border-danger/30 bg-danger-soft text-danger",
};

/** A message box. `role="alert"` for errors so screen readers announce them right away. */
export function Alert({ tone = "info", title, children }: { tone?: Tone; title?: string; children?: ReactNode }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`rounded-2xl border px-4 py-3 ${TONES[tone]}`}>
      {title ? <p className="font-bold">{title}</p> : null}
      {children ? <div className={title ? "mt-1 text-foreground" : ""}>{children}</div> : null}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border-tint bg-card/60 px-6 py-14 text-center">
      <span aria-hidden className="mb-1 grid size-16 place-items-center rounded-2xl bg-accent-soft text-accent">
        <svg viewBox="0 0 48 48" className="size-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="8" y="16" width="32" height="24" rx="5" />
          <path d="M8 23h32M20 16v-4a4 4 0 0 1 8 0v4" />
        </svg>
      </span>
      <p className="text-lg font-bold">{title}</p>
      {children ? <div className="max-w-md text-muted">{children}</div> : null}
      {action}
    </div>
  );
}
