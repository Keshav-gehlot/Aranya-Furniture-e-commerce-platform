import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { stripe, stripeEnabled } from "@/lib/payments";
import { confirmPayment, PAID_STATES } from "@/lib/orders";
import { StatusBadge } from "@/components/status-badge";
import { ClearCartOnMount } from "@/components/clear-cart";
import { Totals } from "@/components/order-summary";
import { SellerTax } from "@/components/seller-tax";
import { getTaxSettings } from "@/lib/tax";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order" };

const providerName = { RAZORPAY: "Razorpay", STRIPE: "Stripe", DEMO: "Demo (test mode)" } as const;

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ paid?: string; session_id?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/orders/${id}`);
  const load = () => db.order.findUnique({ where: { id }, include: { items: true, payments: { orderBy: { createdAt: "desc" } } } });
  let order = await load();
  // Customers only ever see their own orders (staff use the admin panel).
  if (!order || order.userId !== user.id) notFound();
  const tax = await getTaxSettings();

  // Returning from Stripe: ask Stripe directly whether the session is paid. The redirect alone proves nothing.
  if (sp.session_id && order.provider === "STRIPE" && order.status === "PENDING_PAYMENT" && stripeEnabled()) {
    const pay = order.payments.find((p) => p.providerOrderId === sp.session_id);
    if (pay) {
      try {
        const s = await stripe().checkout.sessions.retrieve(sp.session_id);
        if (s.payment_status === "paid") {
          await confirmPayment({ provider: "STRIPE", providerOrderId: s.id, providerPaymentId: typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id, amount: s.amount_total ?? -1, currency: s.currency ?? "", source: "return-page" });
          order = await load();
        }
      } catch (e) {
        console.error(JSON.stringify({ level: "error", msg: "stripe_return_check_failed", orderId: id, error: String(e) }));
      }
    }
  }
  if (!order) notFound();
  const paid = PAID_STATES.includes(order.status);
  const justPaid = (sp.paid || sp.session_id) && paid;
  const awaiting = (sp.paid || sp.session_id) && order.status === "PENDING_PAYMENT";
  const c = order.currency;
  const pay = order.payments[0];

  return (
    <div className="container-x max-w-5xl pb-12 pt-8 lg:pb-24 lg:pt-12">
      {justPaid && <ClearCartOnMount />}
      {justPaid && (
        <div className="ar-alert ar-alert--success mb-10" role="status">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
          <div>
            <h1 className="t-h3">Payment received. Thank you for your order.</h1>
            <p className="mt-1 text-ink-2">We have started preparing it and will email you when it ships.</p>
          </div>
        </div>
      )}
      {awaiting && (
        <div className="mb-10 rounded-md bg-amber-50 p-6 text-amber-800">
          <p className="font-semibold">We're waiting for the payment provider to confirm your payment.</p>
          <p className="mt-1 text-sm">This usually takes a few seconds. Refresh this page in a moment — you won't be charged twice.</p>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Order</p>
          <h2 className="ar-mono mt-1 !text-2xl !leading-8 font-medium">{order.orderNumber}</h2>
          <p className="mt-1 text-sm text-stone">Placed {order.createdAt.toLocaleString("en-IN")}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <div className="card p-6 md:col-span-2">
          <table className="table-x">
            <thead><tr><th className="!px-0">Item</th><th>Qty</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {order.items.map((i) => (
                <tr key={i.id}>
                  <td className="!px-0">
                    <p className="font-medium">{i.name}</p>
                    <p className="text-xs text-stone">{i.sku} · {i.purchaseType === "BUSINESS" ? "Business" : "Retail"} · {formatMoney(i.unitPrice, c)} each</p>
                  </td>
                  <td>{i.quantity}</td>
                  <td className="text-right">{formatMoney(i.lineTotal, c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-6 border-t border-ink/10 pt-5"><Totals q={{ ...order, currency: c }} /></div>
          {order.refundedAmount > 0 && <p className="mt-3 text-sm text-stone">Refunded: {formatMoney(order.refundedAmount, c)}</p>}
        </div>
        <div className="space-y-6">
          <div className="card p-6 text-sm">
            <p className="label">Ship to</p>
            <p className="font-medium">{order.shipName}</p>
            <p className="text-stone">{order.shipAddress}<br />{order.shipCity}{order.shipState ? `, ${order.shipState}` : ""} {order.shipPostal}<br />{order.shipCountry}<br />{order.shipPhone}</p>
            {order.companyName && (<><p className="label mt-4">Company</p><p>{order.companyName}{order.taxId ? ` · ${order.taxId}` : ""}</p></>)}
            <SellerTax tax={tax} currency={c} />
          </div>
          <div className="card p-6 text-sm">
            <p className="label">Payment</p>
            <p>{providerName[order.provider]}</p>
            {pay?.providerPaymentId && paid && <p className="break-all text-xs text-stone">Ref: {pay.providerPaymentId}</p>}
            {order.trackingNumber && (<><p className="label mt-4">Tracking</p><p className="font-medium">{order.trackingNumber}</p></>)}
          </div>
        </div>
      </div>
      <div className="mt-8 flex gap-3">
        <Link href="/account" className="btn-outline">All orders</Link>
        <Link href="/products" className="btn-ghost">Continue shopping</Link>
      </div>
    </div>
  );
}
