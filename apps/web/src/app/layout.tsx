import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { appEnv } from "@/lib/env";
import { t } from "@/lib/i18n";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: t("app.name"), template: `%s · ${t("app.name")}` },
  description: t("app.tagline"),
};

export const viewport: Viewport = {
  // Lets the bottom tab bar extend under the iPhone home indicator (it pads itself with env(safe-area-inset-bottom)).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1013" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const demo = appEnv().demoMode;
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#main"
          className="sr-only rounded-xl bg-accent px-4 py-3 font-medium text-accent-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
        >
          {t("common.skipToContent")}
        </a>
        {demo ? (
          <p className="flex items-center justify-center gap-2 border-b border-warning/20 bg-warning-soft px-4 py-1.5 print:hidden text-center text-sm font-medium text-warning">
            <span aria-hidden className="size-1.5 rounded-full bg-warning" />
            {t("common.demoBanner")}
          </p>
        ) : null}
        {children}
      </body>
    </html>
  );
}
