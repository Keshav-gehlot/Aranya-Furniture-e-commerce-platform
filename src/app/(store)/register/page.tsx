import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "@/components/auth-forms";

export const metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string; type?: string }> }) {
  const { next, type } = await searchParams;
  return (
    <AuthShell title="Create your account" subtitle="Shop for your home, or open a trade account for wholesale pricing.">
      <RegisterForm next={next} defaultType={type === "business" ? "BUSINESS" : "RETAIL"} />
    </AuthShell>
  );
}
