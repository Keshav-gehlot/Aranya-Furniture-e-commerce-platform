"use client";
import { useActionState, useState } from "react";
import { updateProfile } from "@/app/actions/account";
import { COUNTRIES } from "@/lib/countries";

type U = { name: string; email: string; phone: string | null; address: string | null; country: string; accountType: string; companyName: string | null; taxId: string | null };

export function ProfileForm({ user }: { user: U }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  const [biz, setBiz] = useState(user.accountType === "BUSINESS");
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="accountType" value={biz ? "BUSINESS" : "RETAIL"} />
      <div>
        <label className="label">Email</label>
        <input className="input bg-sand/40" value={user.email} disabled />
      </div>
      <div><label className="label" htmlFor="p-name">Name</label><input id="p-name" name="name" className="input" defaultValue={user.name} /></div>
      <div><label className="label" htmlFor="p-phone">Phone</label><input id="p-phone" name="phone" className="input" defaultValue={user.phone ?? ""} /></div>
      <div><label className="label" htmlFor="p-address">Default address</label><textarea id="p-address" name="address" rows={2} className="input" defaultValue={user.address ?? ""} /></div>
      <div>
        <label className="label" htmlFor="p-country">Country</label>
        <select id="p-country" name="country" className="input" defaultValue={user.country}>
          {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={biz} onChange={(e) => setBiz(e.target.checked)} className="h-4 w-4 accent-forest" />
        This is a business / trade account
      </label>
      {biz && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="p-co">Company</label><input id="p-co" name="companyName" className="input" defaultValue={user.companyName ?? ""} /></div>
          <div><label className="label" htmlFor="p-tax">GSTIN / Tax ID</label><input id="p-tax" name="taxId" className="input" defaultValue={user.taxId ?? ""} /></div>
        </div>
      )}
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="text-sm text-forest">{state.ok}</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
    </form>
  );
}
