"use server";

import { cookies } from "next/headers";
import { appEnv } from "@/lib/env";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";

const YEAR = 365 * 86400;

/**
 * Saves the theme choice in a cookie. Setting a cookie in a server action makes
 * Next re-render the page, so <html data-theme> and the theme-color meta tag
 * update right away. The cookie holds a display preference only, nothing
 * about the person, and the value is checked against the three allowed words.
 */
export async function setTheme(formData: FormData): Promise<void> {
  const theme = parseTheme(formData.get("theme"));
  const jar = await cookies();
  if (theme === "system") {
    jar.delete(THEME_COOKIE);
    return;
  }
  jar.set(THEME_COOKIE, theme, {
    httpOnly: true,
    sameSite: "lax",
    secure: appEnv().isProduction,
    path: "/",
    maxAge: YEAR,
  });
}
