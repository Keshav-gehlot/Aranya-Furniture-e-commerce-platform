import Link from "next/link";
import { Logo } from "@/components/logo";

export const dynamic = "force-dynamic";

export default function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-sunken">
      <div className="mx-auto flex max-w-lg flex-col gap-8 px-4 py-12">
        <Link href="/"><Logo /></Link>
        <div className="card p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}
