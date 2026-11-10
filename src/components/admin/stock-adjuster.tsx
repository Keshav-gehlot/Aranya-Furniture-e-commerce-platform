"use client";
import { useActionState } from "react";
import { adjustStock } from "@/app/actions/admin";

export function StockAdjuster({ productId, stock, compact = false }: { productId: string; stock: number; compact?: boolean }) {
  const [state, action, pending] = useActionState(adjustStock, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="productId" value={productId} />
      <select name="mode" className="input w-auto py-2" defaultValue="add" aria-label="Mode">
        <option value="add">Add</option>
        <option value="remove">Remove</option>
        <option value="set">Set to</option>
      </select>
      <input name="qty" type="number" min={0} step={1} placeholder="Qty" className="input w-20 py-2" required aria-label="Quantity" />
      {!compact && (
        <>
          <select name="reason" className="input w-auto py-2" defaultValue="RESTOCK" aria-label="Reason">
            <option value="RESTOCK">Restock / production</option>
            <option value="ADJUSTMENT">Stock count correction</option>
            <option value="RETURN">Customer return</option>
            <option value="DAMAGED">Damaged / write-off</option>
          </select>
          <input name="note" placeholder="Note (optional)" className="input w-48 py-2" />
        </>
      )}
      {compact && <input type="hidden" name="reason" value="ADJUSTMENT" />}
      <button className="btn-primary py-2" disabled={pending}>{pending ? "…" : "Apply"}</button>
      {state?.error && <span className="text-xs text-red-700">{state.error}</span>}
      {state?.ok && <span className="text-xs text-emerald-700">{state.ok}</span>}
      {!state && !compact && <span className="text-xs text-stone">Current: {stock}</span>}
    </form>
  );
}
