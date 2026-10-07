"use client";

/**
 * Edit the list of campus places: quick-add chips for common places, your own
 * entries, and up/down buttons to reorder (keyboard-friendly, unlike drag and
 * drop). The list is sent as repeated hidden `location` fields.
 */
import { useActionState, useState } from "react";
import { saveLocations } from "@/app/setup/actions";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { t, type MessageKey } from "@/lib/i18n";
import { EMPTY_FORM, type FormState } from "@/lib/server/forms";
import { FormFooter } from "./form-footer";

const TEMPLATES = ["front_office", "gym", "cafeteria", "library", "field", "main_hall", "classroom_wing", "bus_loop"] as const;

export function LocationsEditor({ mode, initial, backHref }: { mode: "wizard" | "settings"; initial: string[]; backHref?: string }) {
  const [state, action] = useActionState<FormState, FormData>(saveLocations, EMPTY_FORM);
  const [names, setNames] = useState<string[]>(initial);
  const [custom, setCustom] = useState("");
  const has = (n: string) => names.some((x) => x.toLowerCase() === n.trim().toLowerCase());
  const add = (n: string) => {
    const name = n.trim().slice(0, 60);
    if (name && !has(name)) setNames([...names, name]);
  };
  const move = (i: number, d: -1 | 1) => {
    const next = [...names];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setNames(next);
  };

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="mode" value={mode} />
      {names.map((n) => (
        <input key={n} type="hidden" name="location" value={n} />
      ))}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">{t("locations.templates")}</legend>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((key) => {
            const label = t(`locations.template.${key}` as MessageKey);
            const added = has(label);
            return (
              <button
                key={key}
                type="button"
                onClick={() => add(label)}
                disabled={added}
                aria-pressed={added}
                className={`min-h-11 rounded-full border px-4 font-medium ${
                  added ? "border-accent bg-accent-soft text-accent" : "border-border-tint bg-background hover:bg-accent-soft"
                }`}
              >
                {added ? "✓ " : "+ "}
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="custom-location" className="font-medium">
          {t("locations.custom")}
        </label>
        <div className="flex gap-2">
          <input
            id="custom-location"
            className={inputClass}
            value={custom}
            maxLength={60}
            placeholder={t("locations.custom.placeholder")}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(custom);
                setCustom("");
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              add(custom);
              setCustom("");
            }}
          >
            {t("locations.add")}
          </Button>
        </div>
      </div>

      <section aria-labelledby="your-places" className="flex flex-col gap-2">
        <h3 id="your-places" className="font-medium">
          {t("locations.yours")} <span className="text-muted">({names.length})</span>
        </h3>
        {names.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border-tint p-4 text-muted">{t("locations.empty")}</p>
        ) : (
          <ol className="card flex flex-col divide-y divide-border overflow-hidden">
            {names.map((n, i) => (
              <li key={n} className="flex items-center gap-2 py-1 pr-1 pl-4">
                <span className="w-6 text-sm text-muted tabular-nums">{i + 1}.</span>
                <span className="flex-1 truncate">{n}</span>
                <IconButton label={t("locations.moveUp", { name: n })} disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </IconButton>
                <IconButton label={t("locations.moveDown", { name: n })} disabled={i === names.length - 1} onClick={() => move(i, 1)}>
                  ↓
                </IconButton>
                <IconButton label={t("locations.remove", { name: n })} onClick={() => setNames(names.filter((x) => x !== n))}>
                  ×
                </IconButton>
              </li>
            ))}
          </ol>
        )}
      </section>

      <FormFooter state={state} mode={mode} backHref={backHref} />
    </form>
  );
}

function IconButton({ label, children, ...props }: { label: string; children: React.ReactNode } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="inline-flex size-11 items-center justify-center rounded-lg text-lg text-muted hover:bg-accent-soft hover:text-foreground disabled:opacity-30"
      {...props}
    >
      <span aria-hidden>{children}</span>
    </button>
  );
}
