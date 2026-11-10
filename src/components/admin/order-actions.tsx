"use client";
import { useActionState } from "react";
import { cancelOrder, refundOrder, updateOrder } from "@/app/actions/admin";

const LABELS: Record<string, string> = { PROCESSING: "Processing", SHIPPED: "Shipped", DELIVERED: "Delivered" };

export function OrderUpdate({ id, status, tracking, next }: { id: string; status: string; tracking: string; next: string[] }) {
  const [state, action, pending] = useActionState(updateOrder, undefined);
  const options = next.filter((s) => s !== "CANCELLED");
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div>
        <label className="label" htmlFor="status">Move to</label>
        <select id="status" name="status" defaultValue={options[0] ?? status} className="input" disabled={options.length === 0 && !["SHIPPED", "PROCESSING", "PAID"].includes(status)}>
          <option value={status}>Keep as {status.replaceAll("_", " ").toLowerCase()}</option>
          {options.map((s) => <option key={s} value={s}>{LABELS[s] ?? s}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="trackingNumber">Tracking / B/L number</label>
        <input id="trackingNumber" name="trackingNumber" defaultValue={tracking} className="input" placeholder="Courier AWB or Bill of Lading" maxLength={120} />
      </div>
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Saving…" : "Update order"}</button>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700">{state.ok}</p>}
    </form>
  );
}

export function CancelOrder({ id }: { id: string }) {
  const [state, action, pending] = useActionState(cancelOrder, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" required className="mt-1 accent-forest" /> Yes, cancel this order and put its items back in stock.</label>
      <button className="btn-danger w-full" disabled={pending}>{pending ? "Cancelling…" : "Cancel order"}</button>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700">{state.ok}</p>}
    </form>
  );
}

export function RefundForm({ id, max, currency }: { id: string; max: string; currency: string }) {
  const [state, action, pending] = useActionState(refundOrder, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label className="label" htmlFor="amount">Refund amount ({currency}, up to {max})</label>
      <input id="amount" name="amount" type="number" step="0.01" min="0.01" max={max} defaultValue={max} className="input" required />
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" required className="mt-1 accent-forest" /> Send this refund to the customer now.</label>
      <button className="btn-outline w-full" disabled={pending}>{pending ? "Refunding…" : "Issue refund"}</button>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700">{state.ok}</p>}
    </form>
  );
}
