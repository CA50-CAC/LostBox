import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { appEnv } from "@/lib/env";
import { t } from "@/lib/i18n";
import { currentTheme } from "@/lib/server/theme";
import { THEME_BACKGROUND, themeAttribute } from "@/lib/theme";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: { default: t("app.name"), template: `%s · ${t("app.name")}` },
  description: t("app.tagline"),
};

/**
 * The browser's address-bar color (theme-color) matches the page background.
 * A chosen theme gets one fixed color; "System" gets one per device setting.
 */
export async function generateViewport(): Promise<Viewport> {
  const chosen = themeAttribute(await currentTheme());
  return {
    // Lets the bottom tab bar extend under the iPhone home indicator (it pads itself with env(safe-area-inset-bottom)).
    viewportFit: "cover",
    themeColor: chosen
      ? THEME_BACKGROUND[chosen]
      : [
          { media: "(prefers-color-scheme: light)", color: THEME_BACKGROUND.light },
          { media: "(prefers-color-scheme: dark)", color: THEME_BACKGROUND.dark },
        ],
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const demo = appEnv().demoMode;
  // Read the theme cookie here, on the server, so the first HTML already has
  // the right data-theme (see src/lib/theme.ts). No attribute means "System".
  const theme = themeAttribute(await currentTheme());
  return (
    <html lang="en" data-theme={theme} className={`${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#main"
          className="sr-only rounded-xl bg-accent px-4 py-3 font-medium text-accent-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
        >
          {t("common.skipToContent")}
        </a>
        {demo ? (
          <p className="flex items-center justify-center gap-2 bg-highlight px-4 py-1.5 text-center text-sm font-semibold text-highlight-foreground print:hidden">
            <span aria-hidden className="size-1.5 rounded-full bg-highlight-foreground" />
            {t("common.demoBanner")}
          </p>
        ) : null}
        {children}
      </body>
    </html>
  );
}
