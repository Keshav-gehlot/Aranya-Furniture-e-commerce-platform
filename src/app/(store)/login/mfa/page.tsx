import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MFA_PENDING_COOKIE, verifyMfaPending } from "@/lib/session";
import { AuthShell } from "@/components/auth-shell";
import { MfaLoginForm } from "@/components/mfa-forms";

export const metadata = { title: "Two-step sign-in" };

export default async function MfaLoginPage() {
  const pending = await verifyMfaPending((await cookies()).get(MFA_PENDING_COOKIE)?.value);
  if (!pending) redirect("/login");
  return (
    <AuthShell title="Enter your code" subtitle="Open your authenticator app and enter the 6-digit code for this store.">
      <MfaLoginForm />
    </AuthShell>
  );
}
