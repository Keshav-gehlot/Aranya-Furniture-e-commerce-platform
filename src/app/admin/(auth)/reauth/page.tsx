import { requireStaff } from "@/lib/auth";
import { ReauthForm } from "@/components/mfa-forms";

export const metadata = { title: "Confirm it's you" };

export default async function ReauthPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await requireStaff();
  const { next } = await searchParams;
  const safe = next && next.startsWith("/admin") ? next : "/admin";
  return (
    <>
      <h1 className="text-3xl">Confirm it's you</h1>
      <p className="mb-6 mt-2 text-sm text-stone">Staff access, settings, refunds and deletions need a fresh code from your authenticator app. You won't be asked again for 15 minutes.</p>
      <ReauthForm next={safe} />
    </>
  );
}
