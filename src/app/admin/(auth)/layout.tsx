import Link from "next/link";
import { Logo } from "@/components/logo";
import { requireStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  // Each page here checks again; this keeps a page added later from being reachable without a staff sign-in.
  await requireStaff({ allowMfaSetup: true });
  return (
    <div className="min-h-screen bg-sunken">
      <div className="mx-auto flex max-w-lg flex-col gap-8 px-4 py-12">
        <Link href="/"><Logo /></Link>
        <div className="card p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}
