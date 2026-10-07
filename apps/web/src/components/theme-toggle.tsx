"use client";

/**
 * The System / Light / Dark switch.
 *
 * It is a real radio group (a <fieldset> of <input type="radio">), drawn as a
 * segmented control. That gives keyboard support for free (Tab to the group,
 * arrow keys to move) and screen readers announce "Theme, Dark, radio button,
 * 3 of 3, selected". Picking an option submits the form to the setTheme server
 * action, which saves the cookie; the server then re-renders with the new
 * data-theme. Without JavaScript the "Save theme" button does the same thing.
 *
 * `compact` is the icon-only version for headers. The option names are still
 * there for screen readers (and as tooltips).
 */
import { useId, useOptimistic, useSyncExternalStore, useTransition } from "react";
import { setTheme } from "@/app/theme-actions";
import { t } from "@/lib/i18n";
import { THEMES, type Theme } from "@/lib/theme";
import { Icon, type IconName } from "./icons";

const ICONS: Record<Theme, IconName> = { system: "monitor", light: "sun", dark: "moon" };

/** True once the page is interactive; lets us hide the no-JavaScript "Save" button. */
function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function ThemeToggle({ theme, compact = false, className = "" }: { theme: Theme; compact?: boolean; className?: string }) {
  const id = useId();
  const hydrated = useHydrated();
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useOptimistic(theme);

  function choose(next: Theme) {
    // Move the highlight right away; the page repaints when the server answers.
    startTransition(async () => {
      setSelected(next);
      const data = new FormData();
      data.set("theme", next);
      await setTheme(data);
    });
  }

  return (
    <form action={setTheme} className={className}>
      <fieldset className={compact ? "" : "flex flex-col gap-2"}>
        <legend className={compact ? "sr-only" : "mb-2 text-[0.95rem] font-medium"}>{t("theme.label")}</legend>
        <div className={`inline-flex gap-1 rounded-xl bg-accent-soft p-1 ${compact ? "" : "w-full sm:w-auto"}`}>
          {THEMES.map((option) => (
            <label
              key={option}
              htmlFor={`${id}-${option}`}
              title={compact ? t(`theme.${option}`) : undefined}
              className={`relative flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[0.625rem] text-[0.95rem] font-semibold text-muted transition-colors hover:text-foreground has-checked:bg-background has-checked:text-accent has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent ${
                compact ? "min-w-11" : "flex-1 px-4 sm:flex-none"
              }`}
            >
              <input
                id={`${id}-${option}`}
                type="radio"
                name="theme"
                value={option}
                checked={selected === option}
                onChange={() => choose(option)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              <Icon name={ICONS[option]} className="size-[1.15rem]" />
              <span className={compact ? "sr-only" : undefined}>{t(`theme.${option}`)}</span>
            </label>
          ))}
        </div>
        {compact ? null : <p className="text-sm text-muted">{t("theme.help")}</p>}
        {hydrated ? null : (
          <button type="submit" className={compact ? "sr-only" : "mt-1 min-h-11 self-start rounded-xl border border-border-tint bg-background px-4 font-semibold"}>
            {t("theme.save")}
          </button>
        )}
      </fieldset>
    </form>
  );
}
