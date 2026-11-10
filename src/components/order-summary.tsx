import { formatMoney } from "@/lib/money";
import type { Quote } from "@/lib/cart-types";

export function Totals({ q }: { q: Pick<Quote, "subtotal" | "shipping" | "tax" | "total" | "currency"> }) {
  const c = q.currency;
  return (
    <div className="grid gap-5">
      <dl className="ar-totals">
        <dt>Subtotal</dt><dd>{formatMoney(q.subtotal, c)}</dd>
        <dt>{c === "INR" ? "Shipping (India)" : "Handling"}</dt>
        <dd>{q.shipping === 0 ? (c === "INR" ? "Free" : "—") : formatMoney(q.shipping, c)}</dd>
        {c === "INR" && (<><dt>GST</dt><dd>{formatMoney(q.tax, c)}</dd></>)}
      </dl>
      {c === "USD" && <p className="text-sm leading-[21px] text-ink-2">Export orders are zero-rated. Sea or air freight is quoted separately and invoiced after packing.</p>}
      <div className="ar-summary__total">
        <span className="font-semibold">Total{c === "INR" ? " incl. GST" : ""}</span>
        <strong>{formatMoney(q.total, c)}</strong>
      </div>
    </div>
  );
}
