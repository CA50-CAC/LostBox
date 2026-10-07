/**
 * Checks the color tokens in globals.css meet WCAG AA in both themes, so a
 * tweak to a color can't quietly break readability:
 *   - 4.5:1 for every text color on every background it's used on
 *   - 3:1 for the form-field outline (it is how you find the field)
 *
 * The dark values live in two places in globals.css (the "System" media query
 * and the [data-theme="dark"] rule). This also fails if those two copies differ.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { THEME_BACKGROUND } from "@/lib/theme";

const css = readFileSync(fileURLToPath(new URL("./globals.css", import.meta.url)), "utf8");

function tokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})/gi)) out[m[1]] = m[2].toLowerCase();
  return out;
}

/** The text between a marker and the next "}" (one CSS rule's declarations). */
function ruleAfter(marker: string): string {
  const start = css.indexOf(marker);
  expect(start, `globals.css should contain ${marker}`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
}

const light = tokens(ruleAfter(":root {"));
const darkSystem = tokens(ruleAfter(":root:not([data-theme]) {"));
const darkChosen = tokens(ruleAfter(':root[data-theme="dark"] {'));

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** [text, background] pairs the UI actually uses. */
const TEXT_PAIRS: Array<[string, string]> = [
  ["foreground", "background"],
  ["foreground", "surface"],
  ["foreground", "card"],
  ["foreground", "accent-soft"],
  ["muted", "background"],
  ["muted", "surface"],
  ["muted", "card"],
  ["muted", "accent-soft"],
  ["muted", "border"],
  ["accent", "background"],
  ["accent", "card"],
  ["accent", "accent-soft"],
  ["accent-foreground", "accent"],
  ["highlight-foreground", "highlight"],
  ["danger", "background"],
  ["danger", "card"],
  ["danger", "danger-soft"],
  ["foreground", "danger-soft"],
  ["success", "background"],
  ["success", "card"],
  ["success", "success-soft"],
  ["foreground", "success-soft"],
  ["warning", "background"],
  ["warning", "card"],
  ["warning", "warning-soft"],
  ["foreground", "warning-soft"],
];

/** Outlines and marks that carry meaning without text: 3:1 (WCAG 1.4.11). */
const UI_PAIRS: Array<[string, string]> = [
  ["border-input", "background"],
  ["border-input", "card"],
  ["accent", "background"],
  ["accent", "card"],
  ["accent", "accent-soft"],
];

describe.each([
  ["light", light],
  ["dark", darkChosen],
])("%s theme contrast", (_name, theme) => {
  it.each(TEXT_PAIRS)("%s on %s is at least 4.5:1", (fg, bg) => {
    expect(theme[fg], fg).toBeDefined();
    expect(theme[bg], bg).toBeDefined();
    expect(contrast(theme[fg], theme[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(UI_PAIRS)("%s against %s is at least 3:1", (fg, bg) => {
    expect(theme[fg], fg).toBeDefined();
    expect(theme[bg], bg).toBeDefined();
    expect(contrast(theme[fg], theme[bg])).toBeGreaterThanOrEqual(3);
  });
});

describe("theme tokens stay in sync", () => {
  it("defines the same tokens in light and dark", () => {
    expect(Object.keys(darkChosen).sort()).toEqual(Object.keys(light).sort());
  });

  it("uses the same dark values for System and for the chosen Dark theme", () => {
    expect(darkSystem).toEqual(darkChosen);
  });

  it("matches the browser theme-color to the page background", () => {
    expect(THEME_BACKGROUND.light).toBe(light.background);
    expect(THEME_BACKGROUND.dark).toBe(darkChosen.background);
  });
});
