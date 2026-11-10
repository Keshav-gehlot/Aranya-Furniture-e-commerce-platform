import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { AuthShell } from "@/components/auth-shell";
import { AcceptInviteForm } from "@/components/accept-invite-form";

export const metadata = { title: "Join the team", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await db.staffInvite.findUnique({ where: { tokenHash: sha256(token) } });
  const valid = invite && !invite.acceptedAt && !invite.revokedAt && invite.expiresAt > new Date();
  if (!valid) {
    return (
      <AuthShell title="This invitation isn't valid" subtitle="It may have expired, been used already, or been cancelled. Ask an administrator to send a new one.">
        <span />
      </AuthShell>
    );
  }
  return (
    <AuthShell title={`Welcome, ${invite.name.split(" ")[0]}`} subtitle={`You've been invited as ${invite.role === "ADMIN" ? "an administrator" : "a staff member"} (${invite.email}). Choose a password, then set up two-step sign-in.`}>
      <AcceptInviteForm token={token} />
    </AuthShell>
  );
}
