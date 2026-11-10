"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { loginAction, registerAction } from "@/app/actions/auth";
import { COUNTRIES } from "@/lib/countries";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state?.error && <p className="rounded-sm bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary w-full py-3" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
      <p className="text-center text-sm text-stone">
        New here? <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="ar-link">Create an account</Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next, defaultType }: { next?: string; defaultType?: "RETAIL" | "BUSINESS" }) {
  const [state, action, pending] = useActionState(registerAction, undefined);
  const [type, setType] = useState<"RETAIL" | "BUSINESS">(defaultType ?? "RETAIL");
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <input type="hidden" name="accountType" value={type} />
      <div className="grid grid-cols-2 gap-2 rounded-md bg-sand p-1">
        {(["RETAIL", "BUSINESS"] as const).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setType(t)}
            className={`rounded-sm px-3 py-2.5 text-sm font-semibold transition ${type === t ? "bg-white shadow-sm" : "text-stone"}`}
          >
            {t === "RETAIL" ? "Personal" : "Business / Trade"}
          </button>
        ))}
      </div>
      {type === "BUSINESS" && (
        <p className="rounded-sm bg-forest/5 px-3 py-2 text-xs leading-relaxed text-forest">
          Business accounts see wholesale prices on every product (minimum 10 units per item) and get GST invoices.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="name">Full name</label>
          <input className="input" id="name" name="name" required autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone</label>
          <input className="input" id="phone" name="phone" type="tel" autoComplete="tel" />
        </div>
        {type === "BUSINESS" && (
          <>
            <div>
              <label className="label" htmlFor="companyName">Company name</label>
              <input className="input" id="companyName" name="companyName" required autoComplete="organization" />
            </div>
            <div>
              <label className="label" htmlFor="taxId">GSTIN / VAT / Tax ID</label>
              <input className="input" id="taxId" name="taxId" placeholder="Optional" />
            </div>
          </>
        )}
        <div>
          <label className="label" htmlFor="country">Country</label>
          <select className="input" id="country" name="country" defaultValue="India">
            {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" minLength={10} required autoComplete="new-password" />
        </div>
      </div>
      {state?.error && <p className="rounded-sm bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary w-full py-3" disabled={pending}>{pending ? "Creating account…" : "Create account"}</button>
      <p className="text-center text-sm text-stone">
        Already have an account? <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="ar-link">Sign in</Link>
      </p>
    </form>
  );
}
