import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { revokeInvite } from "@/app/actions/admin-settings";
import { PageHeader, Empty } from "@/components/admin/ui";
import { InviteForm, StaffRow } from "@/components/admin/settings-forms";

export const metadata = { title: "Staff & access" };

export default async function StaffPage() {
  const me = await requirePermission("staff");
  const [staff, invites] = await Promise.all([
    db.user.findMany({ where: { role: { in: ["ADMIN", "STAFF"] } }, orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }] }),
    db.staffInvite.findMany({ where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, include: { invitedBy: { select: { name: true } } } }),
  ]);
  return (
    <>
      <PageHeader title="Staff & access" sub="People join only by invitation. Every change signs the person out so the new access applies straight away." />
      <section className="card p-6">
        <h2 className="mb-4 text-lg">Invite someone</h2>
        <InviteForm />
      </section>

      {invites.length > 0 && (
        <section className="card mt-6">
          <h2 className="border-b border-ink/10 px-5 py-4 text-lg">Pending invitations</h2>
          <ul className="divide-y divide-ink/5">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <span><strong>{i.name}</strong> · {i.email} · {i.role.toLowerCase()} · expires {i.expiresAt.toLocaleString("en-IN")} · by {i.invitedBy.name}</span>
                <form action={revokeInvite}><input type="hidden" name="id" value={i.id} /><button className="text-red-700 hover:underline">Cancel invite</button></form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card mt-6">
        <h2 className="border-b border-ink/10 px-5 py-4 text-lg">Team</h2>
        {staff.length === 0 ? <Empty>No staff yet.</Empty> : (
          <div className="divide-y divide-ink/5">
            {staff.map((m) => (
              <StaffRow key={m.id} isSelf={m.id === me.id} m={{ id: m.id, name: m.name, email: m.email, role: m.role, permissions: m.permissions, isActive: m.isActive, mfaEnabled: m.mfaEnabled, lastLoginAt: m.lastLoginAt ? m.lastLoginAt.toLocaleString("en-IN") : null }} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
