import { describe, expect, it } from "vitest";
import { parseTheme, themeAttribute } from "./theme";

describe("theme cookie", () => {
  it("accepts the three known values", () => {
    expect(parseTheme("system")).toBe("system");
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
  });

  it("falls back to system for anything else", () => {
    for (const bad of [undefined, null, "", "Dark", "blue", '"><script>', 1, {}]) expect(parseTheme(bad)).toBe("system");
  });

  it("sets no attribute for system, so CSS follows the device", () => {
    expect(themeAttribute("system")).toBeUndefined();
    expect(themeAttribute("light")).toBe("light");
    expect(themeAttribute("dark")).toBe("dark");
  });
});
