import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Ph } from "./placeholder";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="container-x grid gap-x-16 gap-y-10 py-12 lg:grid-cols-12 lg:py-16">
      <div className="lg:col-span-5 lg:col-start-1">
        <Link href="/" className="ar-arrow"><ArrowLeft size={16} strokeWidth={1.5} aria-hidden />Back to the store</Link>
        <h1 className="t-h1 mt-6">{title}</h1>
        <p className="mb-8 mt-3 text-ink-2">{subtitle}</p>
        {children}
      </div>
      <div className="hidden lg:col-span-6 lg:col-start-7 lg:block">
        <Ph shot="editorial" subject="Workshop — hands and tools in focus" style={{ aspectRatio: "4 / 5" }} />
      </div>
    </div>
  );
}
