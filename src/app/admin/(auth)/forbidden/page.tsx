import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { ADMIN_ONLY, STAFF_PERMISSIONS } from "@/lib/permissions";

export const metadata = { title: "No access" };

export default async function Forbidden({ searchParams }: { searchParams: Promise<{ need?: string }> }) {
  await requireStaff();
  const { need } = await searchParams;
  const label = (need && ((STAFF_PERMISSIONS as Record<string, string>)[need] || (ADMIN_ONLY as Record<string, string>)[need])) || "this section";
  return (
    <>
      <h1 className="text-3xl">You don't have access to {label}</h1>
      <p className="mt-2 text-sm text-stone">Ask an administrator to add it to your account in Settings → Staff.</p>
      <Link href="/admin" className="btn-primary mt-6">Back to the admin panel</Link>
    </>
  );
}
