/**
 * Who has access to the school, pending invites, and (for owners) a form to
 * invite someone. Used by wizard step 6 and the settings page.
 */
import { revokeStaffInvite } from "@/app/setup/actions";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/i18n/dates";
import { t } from "@/lib/i18n";
import type { Member, StaffInvite } from "@/lib/repo/interface";
import { InviteForm } from "./invite-form";

export function StaffPanel({ members, invites, isOwner }: { members: Member[]; invites: StaffInvite[]; isOwner: boolean }) {
  const pending = invites.filter((i) => !i.acceptedAt);
  return (
    <div className="flex flex-col gap-6">
      {isOwner ? <InviteForm /> : <p className="text-muted">{t("staff.ownerOnly")}</p>}

      <section aria-labelledby="members-title" className="flex flex-col gap-2">
        <h3 id="members-title" className="font-semibold">
          {t("staff.members")}
        </h3>
        <ul className="card flex flex-col divide-y divide-border overflow-hidden">
          {members.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <span className="break-all">{m.email}</span>
              <span className="rounded-full bg-border px-2 py-0.5 text-sm text-muted">{m.role === "owner" ? "Owner" : "Staff"}</span>
            </li>
          ))}
        </ul>
      </section>

      {isOwner ? (
        <section aria-labelledby="invites-title" className="flex flex-col gap-2">
          <h3 id="invites-title" className="font-semibold">
            {t("staff.invites")}
          </h3>
          {pending.length === 0 ? (
            <p className="text-muted">{t("staff.noInvites")}</p>
          ) : (
            <ul className="card flex flex-col divide-y divide-border overflow-hidden">
              {pending.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-1 pr-1 pl-4">
                  <span className="break-all">
                    {i.email} <span className="text-sm text-muted">· {i.role} · {formatDate(i.createdAt)}</span>
                  </span>
                  <form action={revokeStaffInvite}>
                    <input type="hidden" name="inviteId" value={i.id} />
                    <Button type="submit" variant="ghost" aria-label={t("staff.revoke", { email: i.email })}>
                      Revoke
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
