"use client";

/**
 * Privacy defaults per category, with presets and a live preview.
 *
 * The preview is the key moment of setup: the same found item shown the way a
 * student would see it at Full, Limited, and Staff-only, using the real
 * gallery card (ItemCard) and the real projection (toStudentView). Whatever
 * the admin picks is highlighted, and it updates as they click.
 */
import { useActionState, useMemo, useState } from "react";
import { saveCategoryDefaults } from "@/app/setup/actions";
import { ItemCard } from "@/components/item-card";
import { CategoryIcon } from "@/components/item-visuals";
import { isAllowedVisibility, matchingPreset, PRESET_NAMES, PRESETS, type CategoryDefaults } from "@/lib/domain/categories";
import { CATEGORIES, VISIBILITIES, type Category, type Color, type StaffItem, type Visibility } from "@/lib/domain/types";
import { toStudentView } from "@/lib/domain/visibility";
import { demoItemSvg, svgDataUrl } from "@/lib/demo/images";
import { t, type MessageKey } from "@/lib/i18n";
import { EMPTY_FORM, type FormState } from "@/lib/server/forms";
import { FormFooter } from "./form-footer";

const SAMPLE: Record<Category, { colors: Color[]; note: string }> = {
  clothing: { colors: ["gray"], note: "Hoodie, size M, paint stain on the left cuff" },
  bottle_lunchbox: { colors: ["black"], note: "Steel bottle with a dent near the lid" },
  bag: { colors: ["blue"], note: "Backpack with a keychain shaped like a star" },
  books_stationery: { colors: ["green"], note: "Spiral notebook, chemistry notes" },
  calculator_supplies: { colors: ["black"], note: "Graphing calculator, initials scratched on back" },
  sports_gear: { colors: ["orange"], note: "Basketball, a bit flat" },
  electronics: { colors: ["silver"], note: "Phone in a clear case with stickers" },
  earbuds_headphones: { colors: ["white"], note: "Earbuds case with a small crack" },
  keys: { colors: ["silver"], note: "Three keys on a red lanyard" },
  wallet_id: { colors: ["brown"], note: "Leather wallet" },
  glasses_medical: { colors: ["black"], note: "Glasses in a hard case" },
  jewelry_watch: { colors: ["gold"], note: "Thin bracelet with a heart charm" },
  instrument: { colors: ["black"], note: "Clarinet case, school sticker" },
  other: { colors: ["multicolor"], note: "Umbrella with a wooden handle" },
};

function sampleItem(category: Category, visibility: Visibility): StaffItem {
  const s = SAMPLE[category];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return {
    id: `preview-${category}-${visibility}`,
    schoolId: "preview",
    status: "available",
    category,
    colors: s.colors,
    note: s.note,
    foundLocationId: "preview",
    foundLocationName: "Library",
    foundAt: yesterday,
    visibility,
    ownerHint: "Name on label",
    staffNote: null,
    photoPath: "preview",
    createdAt: yesterday,
    resolvedAt: null,
  };
}

export function PrivacyEditor({ mode, initial, backHref }: { mode: "wizard" | "settings"; initial: CategoryDefaults; backHref?: string }) {
  const [state, action] = useActionState<FormState, FormData>(saveCategoryDefaults, EMPTY_FORM);
  const [defaults, setDefaults] = useState<CategoryDefaults>(initial);
  const [focus, setFocus] = useState<Category>("electronics");
  const preset = matchingPreset(defaults);

  const set = (c: Category, v: Visibility) => {
    if (!isAllowedVisibility(c, v)) return;
    setDefaults({ ...defaults, [c]: v });
    setFocus(c);
  };

  const photo = useMemo(() => svgDataUrl(demoItemSvg(focus, SAMPLE[focus].colors[0], 3)), [focus]);

  return (
    <form action={action} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_28rem]" noValidate>
      <input type="hidden" name="mode" value={mode} />
      <div className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-medium">{t("privacy.presets")}</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {PRESET_NAMES.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={preset === p}
                onClick={() => setDefaults({ ...PRESETS[p] })}
                className={`flex min-h-11 flex-col items-start rounded-xl border p-3 text-left ${
                  preset === p ? "border-accent bg-accent-soft ring-1 ring-accent" : "border-border-tint bg-background hover:border-accent/50"
                }`}
              >
                <span className={`font-semibold ${preset === p ? "text-accent" : ""}`}>{t(`preset.${p}`)}</span>
                <span className="text-sm text-muted">{t(`privacy.preset.${p}.help` as MessageKey)}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="card flex flex-col divide-y divide-border overflow-hidden">
          {CATEGORIES.map((c) => (
            <fieldset key={c} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <legend className="sr-only">{t(`category.${c}`)}</legend>
              <span aria-hidden className="flex items-center gap-2 font-medium">
                <CategoryIcon category={c} className="size-5 text-muted" />
                {t(`category.${c}`)}
              </span>
              <div className="inline-flex self-start rounded-xl border border-border-tint bg-background p-1 sm:self-auto">
                {VISIBILITIES.map((v) => {
                  const allowed = isAllowedVisibility(c, v);
                  const checked = defaults[c] === v;
                  return (
                    <label
                      key={v}
                      title={allowed ? t(`visibility.${v}.help`) : t("visibility.wallet_rule")}
                      className={`relative flex min-h-11 items-center rounded-lg px-3 text-sm font-medium has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent ${
                        checked ? "bg-accent text-accent-foreground" : allowed ? "cursor-pointer text-muted hover:text-foreground" : "cursor-not-allowed text-muted line-through opacity-60"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`cat_${c}`}
                        value={v}
                        checked={checked}
                        disabled={!allowed}
                        onChange={() => set(c, v)}
                        onFocus={() => setFocus(c)}
                        className="sr-only"
                      />
                      {t(`visibility.${v}`)}
                    </label>
                  );
                })}
              </div>
              {state.errors?.[c] ? <p className="text-sm text-danger">{t(state.errors[c])}</p> : null}
            </fieldset>
          ))}
        </div>
        <p className="text-sm text-muted">{t("visibility.wallet_rule")}</p>
        <FormFooter state={state} mode={mode} backHref={backHref} />
      </div>

      <aside aria-labelledby="preview-title" className="card flex flex-col gap-4 p-4 sm:p-5 lg:sticky lg:top-4 lg:self-start">
        <div>
          <p className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
            <span aria-hidden className="size-1.5 rounded-full bg-accent" />
            {t("privacy.preview.live")}
          </p>
          <h3 id="preview-title" className="text-lg font-semibold">
            {t("privacy.preview.title")}
          </h3>
          <p className="text-sm text-muted">{t("privacy.preview.lead")}</p>
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("privacy.preview.category")}
          <select
            value={focus}
            onChange={(e) => setFocus(e.target.value as Category)}
            className="min-h-11 rounded-xl border border-border-input bg-background px-3"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`category.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <div aria-live="polite" className="grid grid-cols-3 gap-2">
          {VISIBILITIES.map((v) => {
            const view = toStudentView(sampleItem(focus, v), photo);
            const current = defaults[focus] === v;
            const allowed = isAllowedVisibility(focus, v);
            return (
              <figure
                key={v}
                className={`flex flex-col gap-1.5 rounded-2xl p-1.5 ${current ? "bg-accent-soft ring-2 ring-accent" : ""} ${allowed ? "" : "opacity-40"}`}
              >
                <figcaption className={`px-1 text-xs font-semibold ${current ? "text-accent" : "text-muted"}`}>
                  {t(`visibility.${v}`)}
                  {current ? <span className="sr-only"> ({t("privacy.preview.current")})</span> : null}
                </figcaption>
                {view ? (
                  <div className="text-[0.8rem] [&_p]:text-xs">
                    <ItemCard item={view} />
                  </div>
                ) : (
                  <div className="flex aspect-[3/5] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border-tint bg-background p-2 text-center text-xs text-muted">
                    <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 9 5 9 7a10.6 10.6 0 0 1-2.3 3.3M6.1 6.1C4 7.5 3 10 3 12c0 2 4 7 9 7a9.6 9.6 0 0 0 4.2-.9" />
                    </svg>
                    {t("privacy.preview.hidden")}
                  </div>
                )}
              </figure>
            );
          })}
        </div>
        <p className="rounded-xl bg-background px-3 py-2 text-sm">{t(`visibility.${defaults[focus]}.help`)}</p>
      </aside>
    </form>
  );
}
