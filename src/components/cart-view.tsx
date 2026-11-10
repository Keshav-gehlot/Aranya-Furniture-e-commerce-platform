"use client";
import Link from "next/link";
import { AlertCircle, Lock, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useCart } from "./cart-context";
import { useQuote } from "./use-quote";
import { Totals } from "./order-summary";
import { Ph, isPhoto } from "./placeholder";
import { formatMoney } from "@/lib/money";

export function CartView({ currency }: { currency: "INR" | "USD" }) {
  const { items, ready, setQty, remove } = useCart();
  const { quote, loading } = useQuote(items, currency, ready);

  if (ready && items.length === 0) {
    return (
      <div className="ar-empty">
        <span className="ar-empty__icon"><ShoppingCart size={24} strokeWidth={1.5} aria-hidden /></span>
        <h2>Your cart is empty</h2>
        <p>Add a single piece at the retail price, or ten or more of one product for the trade price.</p>
        <Link href="/products" className="btn-primary mt-2">Browse furniture</Link>
      </div>
    );
  }
  if (!quote) return <p className="mt-8 text-ink-2">Loading your cart…</p>;

  const blocked = quote.lines.some((l) => l.error) || quote.lines.length === 0;

  return (
    <div className="mt-6 grid gap-x-16 gap-y-8 lg:grid-cols-12">
      <ul className="border-t border-divider lg:col-span-7">
        {quote.lines.map((l) => {
          const min = l.type === "BUSINESS" ? l.moq : 1;
          return (
            <li key={l.productId + l.type} className="ar-line">
              <Link href={`/products/${l.slug}`} className="ar-line__img" aria-label={l.name}>
                {isPhoto(l.image) ? <img src={l.image} alt="" className="h-full w-full object-cover" /> : <Ph shot="product" bare className="h-full" />}
              </Link>
              <div className="ar-line__body">
                <Link href={`/products/${l.slug}`} className="ar-line__name">{l.name}</Link>
                <span className="ar-line__meta"><span className="ar-mono">{l.sku}</span> · {formatMoney(l.unitPrice, currency)} / unit{currency === "INR" ? " + GST" : ""}</span>
                <span className={`badge ${l.type === "BUSINESS" ? "ar-badge--brand" : ""}`}>{l.type === "BUSINESS" ? `Business price · min ${l.moq}` : "Retail price"}</span>
                {l.error && (
                  <p className="ar-error mt-1"><AlertCircle size={16} strokeWidth={1.5} className="mt-0.5 shrink-0" aria-hidden />{l.error}</p>
                )}
                <div className="ar-line__actions">
                  <div className="ar-stepper ar-stepper--s">
                    <button type="button" onClick={() => setQty(l.productId, l.type, Math.max(min, l.qty - 1))} disabled={l.qty <= min} aria-label={`Decrease quantity of ${l.name}`}><Minus size={16} strokeWidth={1.5} aria-hidden /></button>
                    <input type="number" inputMode="numeric" min={min} value={l.qty} aria-label={`Quantity of ${l.name}`} onChange={(e) => setQty(l.productId, l.type, parseInt(e.target.value || "1", 10))} />
                    <button type="button" onClick={() => setQty(l.productId, l.type, l.qty + 1)} aria-label={`Increase quantity of ${l.name}`}><Plus size={16} strokeWidth={1.5} aria-hidden /></button>
                  </div>
                  <button type="button" onClick={() => remove(l.productId, l.type)} className="btn-ghost ar-btn--s"><Trash2 size={16} strokeWidth={1.5} aria-hidden />Remove</button>
                </div>
              </div>
              <div className="ar-line__total">
                <strong>{formatMoney(l.lineTotal, currency)}</strong>
                <span>{l.qty} × {formatMoney(l.unitPrice, currency)}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <aside className="lg:col-span-5 lg:sticky lg:top-24 lg:self-start">
        <div className="ar-summary">
          <h2>Order summary</h2>
          <Totals q={quote} />
          {blocked ? (
            <button disabled className="btn-primary ar-btn--l ar-btn--block">Fix the cart to continue</button>
          ) : (
            <Link href="/checkout" className={`btn-primary ar-btn--l ar-btn--block ${loading ? "pointer-events-none opacity-60" : ""}`}>Checkout</Link>
          )}
          <div className="ar-trust">
            <div><Lock strokeWidth={1.5} aria-hidden />{currency === "INR" ? "Pay in INR by UPI, card or netbanking through Razorpay." : "Pay in USD by international card through Stripe."} Switch currency in the header.</div>
          </div>
        </div>
        <Link href="/products" className="ar-arrow mt-5">Continue shopping</Link>
      </aside>
    </div>
  );
}
