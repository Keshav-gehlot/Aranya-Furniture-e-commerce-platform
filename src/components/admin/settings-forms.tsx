"use client";
import { useActionState, useRef, useState } from "react";
import { inviteStaff, saveStoreSettings, saveTaxDetails, updateStaff } from "@/app/actions/admin-settings";
import { STAFF_PERMISSIONS } from "@/lib/permissions";

function Msg({ s }: { s?: { error?: string; ok?: string } }) {
  if (s?.error) return <p className="rounded-sm bg-red-50 px-3 py-2 text-sm text-red-700">{s.error}</p>;
  if (s?.ok) return <p className="rounded-sm bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{s.ok}</p>;
  return null;
}

export function StoreSettingsForm({ init }: { init: Record<string, string> }) {
  const [state, action, pending] = useActionState(saveStoreSettings, undefined);
  const F = ({ name, label, hint, ...rest }: { name: string; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} defaultValue={init[name]} className="input" {...rest} />
      {hint && <p className="mt-1 text-xs text-stone">{hint}</p>}
    </div>
  );
  return (
    <form action={action} className="space-y-6">
      <section className="card grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="text-lg sm:col-span-2">Tax & shipping</h2>
        <F name="gstPercent" label="GST on domestic orders (%)" type="number" step="0.01" min="0" max="50" required />
        <F name="domesticShipping" label="Domestic shipping (₹)" type="number" step="0.01" min="0" required />
        <F name="domesticFreeShippingOver" label="Free domestic shipping over (₹)" type="number" step="0.01" min="0" required />
        <F name="exportHandling" label="Export handling fee ($)" type="number" step="0.01" min="0" required hint="Freight itself is quoted separately." />
      </section>
      <section className="card grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="text-lg sm:col-span-2">Orders</h2>
        <F name="defaultMoq" label="Default business minimum (units)" type="number" min="1" required hint="Used for new products. Each product can override it." />
        <F name="reservationMinutes" label="Hold stock during checkout (minutes)" type="number" min="10" max="240" required hint="Unpaid checkouts give stock back after this. Stripe always holds at least 31 minutes." />
        <F name="notifyEmail" label="Send new order & enquiry alerts to" type="email" placeholder="owner@example.com" />
      </section>
      <Msg s={state} />
      <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save settings"}</button>
    </form>
  );
}

export function TaxDetailsForm({ init, state: gstState }: { init: Record<string, string>; state: string | null }) {
  const [state, action, pending] = useActionState(saveTaxDetails, undefined);
  const vals = state?.values ?? init; // after a refused save, keep what was typed
  const F = ({ name, label, hint, wide, ...rest }: { name: string; label: string; hint?: string; wide?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="label" htmlFor={`tax-${name}`}>{label}</label>
      <input id={`tax-${name}`} name={name} defaultValue={vals[name]} className="input" autoComplete="off" {...rest} />
      {hint && <p className="mt-1 text-xs text-stone">{hint}</p>}
    </div>
  );
  return (
    <form action={action} className="mt-6 space-y-6">
      <section className="card grid gap-4 p-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <h2 className="text-lg">Tax details</h2>
          <p className="mt-1 text-sm text-stone">Your business's registration details. Once filled in, they appear as the seller on every order page, for customers and staff. Leave a field empty if it does not apply.</p>
        </div>
        <F name="legalName" label="Registered business name" wide maxLength={160} placeholder="As on the GST certificate" />
        <F name="gstin" label="GSTIN" maxLength={20} placeholder="08ABCDE1234F1Z5" className="input ar-mono uppercase" hint={gstState ? `Registered in ${gstState}.` : "15 characters. The first two digits are the state code."} />
        <F name="pan" label="PAN" maxLength={14} placeholder="ABCDE1234F" className="input ar-mono uppercase" hint="Must match characters 3 to 12 of the GSTIN." />
        <div className="sm:col-span-2">
          <label className="label" htmlFor="tax-address">Registered address</label>
          <textarea id="tax-address" name="address" defaultValue={vals.address} className="input min-h-[84px]" maxLength={400} placeholder={"Plot, street\nCity, state, PIN"} />
        </div>
        <F name="hsnCode" label="HSN code for your goods" maxLength={8} inputMode="numeric" placeholder="9403" className="input ar-mono" hint="4, 6 or 8 digits. 9403 covers most furniture." />
        <F name="iec" label="Import Export Code (IEC)" maxLength={14} placeholder="ABCDE1234F" className="input ar-mono uppercase" hint="Shown on export (USD) orders only." />
        <F name="invoiceNote" label="Note under the seller details" wide maxLength={300} placeholder="e.g. Subject to Jodhpur jurisdiction." />
        <p className="text-sm text-stone sm:col-span-2">The GST rate itself is set above, under Tax & shipping.</p>
      </section>
      <Msg s={state} />
      <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save tax details"}</button>
    </form>
  );
}

function PermissionBoxes({ selected = [] as string[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {Object.entries(STAFF_PERMISSIONS).map(([k, label]) => (
        <label key={k} className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="permissions" value={k} defaultChecked={selected.includes(k)} className="h-4 w-4 accent-forest" /> {label}
        </label>
      ))}
    </div>
  );
}

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteStaff, undefined);
  const [role, setRole] = useState("STAFF");
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div><label className="label" htmlFor="inv-name">Name</label><input id="inv-name" name="name" className="input" required maxLength={100} /></div>
        <div><label className="label" htmlFor="inv-email">Work email</label><input id="inv-email" name="email" type="email" className="input" required /></div>
        <div>
          <label className="label" htmlFor="inv-role">Role</label>
          <select id="inv-role" name="role" className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="STAFF">Staff — chosen modules only</option>
            <option value="ADMIN">Administrator — everything</option>
          </select>
        </div>
      </div>
      {role === "STAFF" ? <PermissionBoxes selected={["dashboard", "orders"]} /> : <p className="rounded-sm bg-amber-50 px-3 py-2 text-sm text-amber-800">Administrators can manage staff, settings and refunds. Give this role only to people who need it.</p>}
      <Msg s={state} />
      {state?.inviteLink && <p className="select-all break-all rounded-sm bg-sand px-3 py-2 font-mono text-xs">{state.inviteLink}</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Sending…" : "Send invitation"}</button>
    </form>
  );
}

export function StaffRow({ m, isSelf }: { m: { id: string; name: string; email: string; role: string; permissions: string[]; isActive: boolean; mfaEnabled: boolean; lastLoginAt: string | null }; isSelf: boolean }) {
  const [state, action, pending] = useActionState(updateStaff, undefined);
  const [role, setRole] = useState(m.role);
  // Which button was pressed travels in a hidden field (set directly on the DOM before the form submits).
  const actionInput = useRef<HTMLInputElement>(null);
  const pick = (a: string) => () => {
    if (actionInput.current) actionInput.current.value = a;
  };
  return (
    <form action={action} className={`space-y-3 p-5 ${m.isActive ? "" : "opacity-60"}`}>
      <input type="hidden" name="id" value={m.id} />
      <input type="hidden" name="action" defaultValue="save" ref={actionInput} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{m.name} {isSelf && <span className="text-xs font-normal text-stone">(you)</span>}</p>
          <p className="text-xs text-stone">{m.email} · {m.mfaEnabled ? "2-step on" : "2-step not set up"} · {m.lastLoginAt ? `last sign-in ${m.lastLoginAt}` : "never signed in"}{!m.isActive ? " · disabled" : ""}</p>
        </div>
        {!isSelf && (
          <select name="role" value={role} onChange={(e) => setRole(e.target.value)} className="input w-auto py-1.5 text-sm" aria-label={`Role for ${m.name}`}>
            <option value="STAFF">Staff</option>
            <option value="ADMIN">Administrator</option>
          </select>
        )}
      </div>
      {!isSelf && role === "STAFF" && <PermissionBoxes selected={m.permissions} />}
      {!isSelf && (
        <div className="flex flex-wrap gap-2">
          <button onClick={pick("save")} className="btn-primary py-1.5" disabled={pending}>Save access</button>
          <button onClick={pick("signout")} className="btn-outline py-1.5" disabled={pending}>Sign out everywhere</button>
          {m.mfaEnabled && <button onClick={pick("reset-mfa")} className="btn-outline py-1.5" disabled={pending}>Reset 2-step</button>}
          <button onClick={pick(m.isActive ? "disable" : "enable")} className={m.isActive ? "btn-danger py-1.5" : "btn-outline py-1.5"} disabled={pending}>{m.isActive ? "Disable access" : "Enable"}</button>
        </div>
      )}
      <Msg s={state} />
    </form>
  );
}
