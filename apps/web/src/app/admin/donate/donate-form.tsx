"use client";

/**
 * The checklist on the "Ready to donate" page: tick items (or all of them),
 * press the button, then confirm. The confirm step is inline (not a browser
 * popup) so it's readable, keyboard-friendly, and testable.
 */
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { t } from "@/lib/i18n";

export interface DonateRow {
  id: string;
  label: string;
  content: ReactNode;
}

export function DonateForm({ rows, action }: { rows: DonateRow[]; action: (form: FormData) => Promise<void> }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);
  const all = selected.size === rows.length;
  const some = selected.size > 0 && !all;

  function toggle(id: string, on: boolean) {
    setConfirming(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="card overflow-hidden">
        <label className="flex min-h-14 cursor-pointer items-center gap-3 border-b border-border bg-surface/60 px-4 font-semibold">
          <input
            type="checkbox"
            className="size-5 accent-[var(--accent)]"
            checked={all}
            ref={(el) => {
              if (el) el.indeterminate = some;
            }}
            onChange={(e) => {
              setConfirming(false);
              setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set());
            }}
          />
          {t("donate.selectAll", { count: rows.length })}
        </label>
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id}>
              <label className="flex cursor-pointer items-center gap-4 px-4 py-3 hover:bg-surface">
                <input
                  type="checkbox"
                  name="itemId"
                  value={row.id}
                  className="size-5 shrink-0 accent-[var(--accent)]"
                  checked={selected.has(row.id)}
                  onChange={(e) => toggle(row.id, e.target.checked)}
                  aria-label={t("donate.select", { item: row.label })}
                />
                {row.content}
              </label>
            </li>
          ))}
        </ul>
      </div>

      {confirming ? (
        <div ref={confirmRef} tabIndex={-1} role="alertdialog" aria-labelledby="donate-confirm-title" aria-describedby="donate-confirm-body" className="card flex flex-col gap-3 border-warning/40 p-4 outline-none">
          <p id="donate-confirm-title" className="font-semibold">
            {t("donate.confirmTitle", { count: selected.size })}
          </p>
          <p id="donate-confirm-body" className="text-muted">
            {t("donate.confirmBody")}
          </p>
          <div className="flex flex-wrap gap-2">
            <SubmitButton pendingLabel={t("donate.pending")}>{t("donate.confirm")}</SubmitButton>
            <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
              {t("donate.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="sticky bottom-24 z-10 md:bottom-4">
          <Button
            type="button"
            className="w-full shadow-lg md:w-auto"
            disabled={selected.size === 0}
            onClick={() => {
              setConfirming(true);
              requestAnimationFrame(() => confirmRef.current?.focus());
            }}
          >
            {selected.size ? t("donate.submit", { count: selected.size }) : t("donate.submitNone")}
          </Button>
        </div>
      )}
    </form>
  );
}
