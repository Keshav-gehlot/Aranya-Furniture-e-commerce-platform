"use client";
import { useActionState } from "react";
import { updateEnquiry } from "@/app/actions/admin";

export function EnquiryUpdate({ id, status, followUpAt }: { id: string; status: string; followUpAt: string }) {
  const [state, action, pending] = useActionState(updateEnquiry, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div>
        <label className="label" htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={status} className="input">
          <option value="NEW">New</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="followUpAt">Follow up on</label>
        <input id="followUpAt" name="followUpAt" type="date" defaultValue={followUpAt} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="note">Add an internal note</label>
        <textarea id="note" name="note" rows={4} className="input" placeholder="Quote sent, samples requested, next step… (customers never see this)" maxLength={4000} />
      </div>
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
      {state?.ok && <p className="text-sm text-emerald-700">{state.ok}</p>}
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
