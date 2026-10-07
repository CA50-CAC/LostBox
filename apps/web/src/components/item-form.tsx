"use client";

/**
 * The staff item form, for adding and editing. Picking a category sets "what
 * students see" to the school's default for it (until staff change it by
 * hand), and Wallet can never be set to Full.
 */
import { useActionState, useState } from "react";
import { createItem, updateItem } from "@/app/admin/items/actions";
import { Alert } from "@/components/ui/alert";
import { Select, TextArea, TextInput } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { isAllowedVisibility, type CategoryDefaults } from "@/lib/domain/categories";
import { CATEGORIES, COLORS, VISIBILITIES, type Category, type Color, type Visibility } from "@/lib/domain/types";
import { colorBackground } from "@/lib/domain/visuals";
import { t } from "@/lib/i18n";
import { EMPTY_FORM, type FormState } from "@/lib/server/forms";
import { PhotoInput } from "./photo-input";

export interface ItemFormValues {
  id?: string;
  category: Category | "";
  colors: Color[];
  note: string;
  foundLocationId: string;
  foundAt: string; // yyyy-mm-dd
  visibility: Visibility;
  ownerHint: string;
  staffNote: string;
  photoUrl: string | null;
}

export function ItemForm({
  mode,
  initial,
  defaults,
  locations,
}: {
  mode: "create" | "edit";
  initial: ItemFormValues;
  defaults: CategoryDefaults;
  locations: Array<{ id: string; name: string }>;
}) {
  const [state, action] = useActionState<FormState, FormData>(mode === "create" ? createItem : updateItem, EMPTY_FORM);
  const [category, setCategory] = useState<Category | "">(initial.category);
  const [colors, setColors] = useState<Color[]>(initial.colors);
  const [visibility, setVisibility] = useState<Visibility>(initial.visibility);
  const [touched, setTouched] = useState(mode === "edit");
  const isPrivate = visibility === "staff_only";
  const err = (k: string) => (state.errors?.[k] ? t(state.errors[k]) : undefined);

  function chooseCategory(c: Category | "") {
    setCategory(c);
    if (!c) return;
    if (!touched) setVisibility(defaults[c]);
    else if (!isAllowedVisibility(c, visibility)) setVisibility("limited");
  }

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      {initial.id ? <input type="hidden" name="itemId" value={initial.id} /> : null}
      <PhotoInput currentUrl={initial.photoUrl} error={err("photo")} />

      <Select
        id="category"
        name="category"
        label={t("intake.category")}
        value={category}
        onChange={(e) => chooseCategory(e.target.value as Category | "")}
        error={err("category")}
        help={category && !touched ? t("intake.category.default", { level: t(`visibility.${defaults[category]}`) }) : undefined}
        required
      >
        <option value="" disabled>
          —
        </option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {t(`category.${c}`)}
          </option>
        ))}
      </Select>

      <fieldset className="flex flex-col gap-2" aria-describedby="colors-help">
        <legend className="mb-1 font-medium">
          {t("intake.colors")} <span className="font-normal text-muted">({t("common.optional")})</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => {
            const on = colors.includes(c);
            const full = colors.length >= 4 && !on;
            return (
              <label
                key={c}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent ${
                  on ? "border-accent bg-accent-soft font-medium text-accent" : "border-border-tint bg-background"
                } ${full ? "opacity-50" : "cursor-pointer"}`}
              >
                <input
                  type="checkbox"
                  name="colors"
                  value={c}
                  checked={on}
                  disabled={full}
                  onChange={() => setColors(on ? colors.filter((x) => x !== c) : [...colors, c])}
                  className="sr-only"
                />
                <span aria-hidden className="size-4 rounded-full border border-border-input" style={{ background: colorBackground(c) }} />
                {t(`color.${c}`)}
              </label>
            );
          })}
        </div>
        <p id="colors-help" className="text-sm text-muted">
          {t("intake.colors.help")}
        </p>
        {err("colors") ? <p className="text-sm font-medium text-danger">{err("colors")}</p> : null}
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <Select id="foundLocationId" name="foundLocationId" label={t("intake.location")} defaultValue={initial.foundLocationId} error={err("foundLocationId")} required>
          <option value="" disabled>
            —
          </option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
        <TextInput id="foundAt" name="foundAt" type="date" label={t("intake.foundAt")} defaultValue={initial.foundAt} error={err("foundAt")} required />
      </div>

      <TextArea id="note" name="note" label={t("intake.note")} help={t("intake.note.help")} optional={t("common.optional")} defaultValue={initial.note} maxLength={280} error={err("note")} />

      <fieldset className="flex flex-col gap-3 rounded-2xl border border-border-tint bg-background p-4">
        <legend className="px-1 font-medium">{t("intake.visibility")}</legend>
        <label className="flex min-h-11 items-center justify-between gap-4">
          <span>
            <span className="font-medium">{t("intake.private")}</span>
            <span className="block text-sm text-muted">{t("intake.private.help")}</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            name="private"
            checked={isPrivate}
            onChange={(e) => {
              setTouched(true);
              setVisibility(e.target.checked ? "staff_only" : category ? (defaults[category] === "staff_only" ? "limited" : defaults[category]) : "limited");
            }}
            className="h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full bg-border transition-colors before:block before:size-6 before:translate-x-0.5 before:rounded-full before:bg-background before:shadow before:transition-transform checked:bg-accent checked:before:translate-x-[1.375rem]"
          />
        </label>
        {!isPrivate ? (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("intake.visibility")}>
            {VISIBILITIES.filter((v) => v !== "staff_only").map((v) => {
              const allowed = !category || isAllowedVisibility(category, v);
              return (
                <label
                  key={v}
                  className={`flex min-h-11 flex-1 cursor-pointer flex-col justify-center rounded-xl border px-3 py-2 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent ${
                    visibility === v ? "border-accent bg-accent-soft" : "border-border-tint bg-background"
                  } ${allowed ? "" : "cursor-not-allowed opacity-50"}`}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={v}
                    checked={visibility === v}
                    disabled={!allowed}
                    onChange={() => {
                      setTouched(true);
                      setVisibility(v);
                    }}
                    className="sr-only"
                  />
                  <span className="font-medium">{t(`visibility.${v}`)}</span>
                  <span className="text-sm text-muted">{allowed ? t(`visibility.${v}.help`) : t("visibility.wallet_rule")}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <input type="hidden" name="visibility" value="staff_only" />
        )}
        {err("visibility") ? <p className="text-sm font-medium text-danger">{err("visibility")}</p> : null}
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <TextInput id="ownerHint" name="ownerHint" label={t("intake.ownerHint")} help={t("intake.ownerHint.help")} optional={t("common.optional")} defaultValue={initial.ownerHint} maxLength={120} error={err("ownerHint")} />
        <TextArea id="staffNote" name="staffNote" label={t("intake.staffNote")} help={t("intake.staffNote.help")} optional={t("common.optional")} defaultValue={initial.staffNote} maxLength={500} error={err("staffNote")} />
      </div>

      {state.error ? <Alert tone="danger">{t(state.error)}</Alert> : null}
      {state.ok ? <Alert tone="success">{t("edit.saved")}</Alert> : null}
      <SubmitButton pendingLabel={mode === "create" ? t("intake.submitting") : t("common.saving")} className="self-start">
        {mode === "create" ? t("intake.submit") : t("edit.save")}
      </SubmitButton>
    </form>
  );
}
