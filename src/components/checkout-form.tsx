"use client";
import Script from "next/script";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useCart } from "./cart-context";
import { useQuote } from "./use-quote";
import { Totals } from "./order-summary";
import { formatMoney } from "@/lib/money";
import { COUNTRIES } from "@/lib/countries";

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void };
  }
}

type U = { name: string; email: string; phone: string; country: string; address: string; companyName: string; taxId: string; isBusiness: boolean };

export function CheckoutForm({ currency, gateway, user }: { currency: "INR" | "USD"; gateway: "RAZORPAY" | "STRIPE" | "DEMO" | null; user: U }) {
  const router = useRouter();
  const { items, ready, clear } = useCart();
  const { quote } = useQuote(items, currency, ready);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoOrder, setDemoOrder] = useState<string | null>(null);
  // One key per checkout attempt: resubmitting (double click, network retry) returns the same order.
  const checkoutKey = useRef<string>(typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "");

  if (ready && items.length === 0) {
    return (
      <div className="ar-empty">
        <h2>Your cart is empty</h2>
        <p>Add something to your cart before checking out.</p>
        <Link href="/products" className="btn-primary mt-2">Browse furniture</Link>
      </div>
    );
  }
  if (!quote) return <p className="mt-8 text-stone">Loading…</p>;

  const needsCompany = quote.hasBusiness || user.isBusiness;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fd, currency, items, checkoutKey: checkoutKey.current }),
      });
      const data = await res.json();
      if (!res.ok) {
        // The previous attempt ended (e.g. stock changed) — the next submit starts a fresh checkout.
        if (res.status === 409 || res.status === 502) checkoutKey.current = crypto.randomUUID();
        throw new Error(data.error || "Checkout failed");
      }

      if (data.provider === "STRIPE") {
        window.location.href = data.url;
        return;
      }
      if (data.provider === "DEMO") {
        setDemoOrder(data.orderId);
        setBusy(false);
        return;
      }
      if (data.provider === "RAZORPAY") {
        if (!window.Razorpay) throw new Error("Payment window failed to load. Check your connection and try again.");
        const rz = new window.Razorpay({
          key: data.razorpay.key,
          amount: data.razorpay.amount,
          currency: "INR",
          name: data.razorpay.name,
          description: data.razorpay.description,
          order_id: data.razorpay.orderId,
          prefill: data.razorpay.prefill,
          theme: { color: "#8B1C22" },
          handler: async (r: Record<string, string>) => {
            const v = await fetch("/api/payments/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ razorpay_order_id: r.razorpay_order_id, razorpay_payment_id: r.razorpay_payment_id, razorpay_signature: r.razorpay_signature }),
            });
            if (v.ok) {
              clear();
              router.push(`/orders/${data.orderId}?paid=1`);
            } else {
              // The webhook will still confirm a genuine payment; send the customer to the order page to check.
              router.push(`/orders/${data.orderId}?paid=1`);
            }
          },
          modal: { ondismiss: () => setBusy(false) },
        });
        rz.on("payment.failed", () => setError("Payment failed. Please try again or use another method."));
        rz.open();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  async function payDemo() {
    if (!demoOrder) return;
    setBusy(true);
    const r = await fetch("/api/payments/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: demoOrder }) });
    if (r.ok) {
      clear();
      router.push(`/orders/${demoOrder}?paid=1`);
    } else {
      setError("Demo payment failed.");
      setBusy(false);
    }
  }

  const blocked = quote.errors.length > 0;

  return (
    <>
      {gateway === "RAZORPAY" && <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />}
      <form onSubmit={submit} className="mt-8 grid gap-x-16 gap-y-10 lg:grid-cols-12">
        <div className="grid content-start gap-10 lg:col-span-7">
          <section>
            <h2 className="t-h3">Delivery details</h2>
            <div className="mt-5 grid gap-x-4 gap-y-5 sm:grid-cols-2">
              <Field name="shipName" label="Full name" defaultValue={user.name} required autoComplete="name" />
              <Field name="shipPhone" label="Phone" defaultValue={user.phone} required type="tel" autoComplete="tel" />
              <div className="sm:col-span-2"><Field name="shipAddress" label="Address" defaultValue={user.address} required autoComplete="street-address" /></div>
              <Field name="shipCity" label="City" required autoComplete="address-level2" />
              <Field name="shipState" label="State or region" autoComplete="address-level1" />
              <Field name="shipPostal" label={currency === "INR" ? "PIN code" : "Postal code"} required autoComplete="postal-code" />
              <div>
                <label className="label" htmlFor="shipCountry">Country</label>
                {currency === "INR" ? (
                  <>
                    <input type="hidden" name="shipCountry" value="India" />
                    <input id="shipCountry" className="input" value="India" disabled />
                  </>
                ) : (
                  <select id="shipCountry" name="shipCountry" className="input" defaultValue={user.country === "India" ? "United States" : user.country}>
                    {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                )}
              </div>
            </div>
            {currency === "INR" && <p className="ar-help mt-3">Shipping outside India? Switch the currency to USD in the header.</p>}
          </section>

          {needsCompany && (
            <section className="border-t border-line pt-8">
              <h2 className="t-h3">Business details</h2>
              <p className="ar-help mt-1">{quote.hasBusiness ? "Needed because this order includes items at the business price." : "Shown on your invoice."}</p>
              <div className="mt-5 grid gap-x-4 gap-y-5 sm:grid-cols-2">
                <Field name="companyName" label="Company name" defaultValue={user.companyName} required={quote.hasBusiness} autoComplete="organization" />
                <Field name="taxId" label={currency === "INR" ? "GSTIN (optional)" : "VAT or tax ID (optional)"} defaultValue={user.taxId} />
              </div>
            </section>
          )}

          <section className="border-t border-line pt-8">
            <label className="label" htmlFor="notes">Order notes <span className="font-normal text-ink-3">(optional)</span></label>
            <textarea id="notes" name="notes" rows={3} className="input" placeholder="Delivery instructions, preferred dates, finish requests." />
          </section>
        </div>

        <aside className="lg:col-span-5 lg:sticky lg:top-24 lg:self-start">
          <div className="ar-summary">
            <h2>Your order</h2>
            <ul className="grid gap-3 text-[15px] leading-[22px]">
              {quote.lines.map((l) => (
                <li key={l.productId + l.type} className="flex justify-between gap-4">
                  <span>
                    {l.name} <span className="ar-num text-ink-2">× {l.qty}</span>
                    {l.type === "BUSINESS" && <span className="badge ar-badge--brand ml-2">Business</span>}
                    {l.error && <span className="ar-error mt-1">{l.error}</span>}
                  </span>
                  <span className="ar-num shrink-0">{formatMoney(l.lineTotal, currency)}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-line pt-5"><Totals q={quote} /></div>

            {error && <p className="ar-error" role="alert">{error}</p>}
            {blocked && <p className="ar-error">Fix the problems in your <Link href="/cart" className="underline">cart</Link> to continue.</p>}

            {!gateway ? (
              <p className="rounded-sm bg-warning-subtle p-4 text-sm leading-[21px]">Online payment in {currency} is not set up yet. <Link href="/contact" className="ar-link">Contact us</Link> to place this order.</p>
            ) : demoOrder ? (
              <div className="grid gap-3">
                <p className="rounded-sm bg-warning-subtle p-4 text-sm leading-[21px]">
                  <strong className="font-semibold">Test payment.</strong> {currency === "INR" ? "Razorpay" : "Stripe"} is not connected on this site yet, so this button simulates a successful payment. No money moves.
                </p>
                <button type="button" onClick={payDemo} disabled={busy} className="btn-primary ar-btn--l ar-btn--block">Complete test payment</button>
              </div>
            ) : (
              <button disabled={busy || blocked} className="btn-primary ar-btn--l ar-btn--block">
                {busy ? "Processing…" : `Pay ${formatMoney(quote.total, currency)}`}
              </button>
            )}
            <div className="ar-trust">
              <div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                {currency === "INR" ? "Payment by Razorpay: UPI, cards, netbanking and wallets." : "Payment by Stripe: international cards."} Stock is held for you for 30 minutes while you pay.
              </div>
            </div>
          </div>
        </aside>
      </form>
    </>
  );
}

function Field({ name, label, ...rest }: { name: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} className="input" {...rest} />
    </div>
  );
}
