import Link from "next/link";
import { t } from "@/lib/i18n";

/** The small "Privacy" link at the bottom of student and staff screens. */
export function PrivacyLink({ className = "" }: { className?: string }) {
  return (
    <p className={`text-center text-sm print:hidden ${className}`}>
      <Link href="/privacy" className="inline-flex min-h-11 items-center rounded-lg px-3 font-medium text-muted underline-offset-4 hover:text-foreground hover:underline">
        {t("privacyPage.link")}
      </Link>
    </p>
  );
}
