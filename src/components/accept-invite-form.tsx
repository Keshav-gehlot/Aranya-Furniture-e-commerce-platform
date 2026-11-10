"use client";
import { useActionState } from "react";
import { acceptInvite } from "@/app/actions/auth";

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvite, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="label" htmlFor="password">Password (at least 12 characters)</label>
        <input id="password" name="password" type="password" minLength={12} autoComplete="new-password" className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Repeat password</label>
        <input id="confirm" name="confirm" type="password" minLength={12} autoComplete="new-password" className="input" required />
      </div>
      {state?.error && <p className="rounded-sm bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary w-full py-3" disabled={pending}>{pending ? "Creating account…" : "Create my account"}</button>
    </form>
  );
}
