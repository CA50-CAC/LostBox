import "server-only";
import { cookies } from "next/headers";
import { parseTheme, THEME_COOKIE, type Theme } from "@/lib/theme";

/** The visitor's saved theme choice, read from their cookie on the server. */
export async function currentTheme(): Promise<Theme> {
  return parseTheme((await cookies()).get(THEME_COOKIE)?.value);
}
