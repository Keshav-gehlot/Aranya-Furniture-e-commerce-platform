import { requireStaff } from "@/lib/auth";
import { MfaSetup } from "@/components/mfa-forms";

export const metadata = { title: "Set up two-step sign-in" };

export default async function MfaSetupPage() {
  const { user } = await requireStaff({ allowMfaSetup: true });
  return (
    <>
      <h1 className="text-3xl">Set up two-step sign-in</h1>
      <p className="mb-6 mt-2 text-sm text-stone">Staff accounts need a code from your phone as well as your password. This protects orders, customer details and payments if a password leaks.</p>
      <MfaSetup alreadyEnabled={user.mfaEnabled} />
    </>
  );
}
