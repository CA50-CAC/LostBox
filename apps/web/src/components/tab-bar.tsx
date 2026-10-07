"use client";

/**
 * App-style navigation. On phones it is a bottom tab bar (thumb-reachable,
 * like a native app); on wider screens the same links render as top pills.
 *
 * Which tab is "current" is decided by `match`: plain entries are path
 * prefixes, entries starting with "=" must match exactly, and `except`
 * prefixes win over both. Plain strings (not functions) so a server layout
 * can pass them in.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";

export type Tab = {
  href: string;
  label: string;
  icon: IconName;
  match: string[];
  except?: string[];
  badge?: number;
  /** Draws the tab as a raised round button (the main action). */
  primary?: boolean;
};

function isActive(pathname: string, tab: Tab) {
  if (tab.except?.some((p) => pathname.startsWith(p))) return false;
  return tab.match.some((m) => (m.startsWith("=") ? pathname === m.slice(1) : pathname.startsWith(m)));
}

/** Bottom bar for phones. Hidden on screens where `hideOn` (a path fragment) appears in the URL. */
export function TabBar({ tabs, label, hideOn }: { tabs: Tab[]; label: string; hideOn?: string }) {
  const pathname = usePathname();
  if (hideOn && pathname.includes(hideOn)) return null;
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab);
          return (
            <li key={tab.href} className="flex flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[0.7rem] font-bold transition-colors ${
                  active ? "text-accent" : "text-muted hover:text-foreground"
                }`}
              >
                {tab.primary ? (
                  <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                    <Icon name={tab.icon} className="size-5" strokeWidth={2.5} />
                  </span>
                ) : (
                  <span className={`grid h-7 w-12 place-items-center rounded-lg transition-colors ${active ? "bg-accent-soft" : ""}`}>
                    <Icon name={tab.icon} className="size-[1.35rem]" strokeWidth={active ? 2.25 : 1.9} />
                  </span>
                )}
                {tab.label}
                {tab.badge ? (
                  <span className="absolute top-1.5 left-1/2 ml-2 grid min-w-5 place-items-center rounded-full bg-accent px-1 py-px text-[0.65rem] font-bold text-accent-foreground ring-2 ring-card">
                    {tab.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The same tabs as top pills, for tablets and desktops. `compact` shows icons
 * only on tablet widths (labels stay for screen readers and as tooltips), for
 * headers with many tabs.
 */
export function TopTabs({ tabs, label, compact = false }: { tabs: Tab[]; label: string; compact?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="max-md:hidden">
      <ul className="flex gap-1">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                title={compact ? tab.label : undefined}
                className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-4 text-[0.95rem] ${compact ? "max-lg:px-3" : ""} font-bold whitespace-nowrap transition-colors ${
                  active ? "bg-accent-soft text-accent" : "text-muted hover:bg-accent-soft hover:text-foreground"
                }`}
              >
                <Icon name={tab.icon} className="size-[1.1rem]" />
                <span className={compact ? "max-lg:sr-only" : undefined}>{tab.label}</span>
                {tab.badge ? (
                  <span className="grid min-w-5 place-items-center rounded-full bg-accent px-1.5 py-0.5 text-xs font-bold text-accent-foreground">{tab.badge}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
