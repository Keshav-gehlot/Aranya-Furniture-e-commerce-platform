import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { hasRecentMfa, requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatMoney, toMajor } from "@/lib/money";
import { ADMIN_TRANSITIONS } from "@/lib/orders";
import { resolveAttention } from "@/app/actions/admin";
import { PageHeader } from "@/components/admin/ui";
import { StatusBadge } from "@/components/status-badge";
import { Totals } from "@/components/order-summary";
import { CancelOrder, OrderUpdate, RefundForm } from "@/components/admin/order-actions";

export const metadata = { title: "Order" };

export default async function AdminOrder({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("orders");
  const { id } = await params;
  const o = await db.order.findUnique({
    where: { id },
    include: {
      items: true,
      user: true,
      payments: { orderBy: { createdAt: "desc" } },
      events: { orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true } } } },
    },
  });
  if (!o) notFound();
  const c = o.currency;
  const next = ADMIN_TRANSITIONS[o.status] ?? [];
  const canRefund = can(user, "refunds");
  const recent = await hasRecentMfa();
  const paidPayment = o.payments.find((p) => p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED");
  const refundable = paidPayment ? paidPayment.amount - paidPayment.refundedAmount : 0;
  const showCustomerPII = can(user, "customers") || can(user, "orders");

  return (
    <>
      <PageHeader title={o.orderNumber} sub={`Placed ${o.createdAt.toLocaleString("en-IN")}${o.paidAt ? ` · Paid ${o.paidAt.toLocaleString("en-IN")}` : ""}`}>
        <StatusBadge status={o.status} />
        <Link href="/admin/orders" className="btn-ghost">← Orders</Link>
      </PageHeader>

      {o.needsAttention && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-100 bg-red-50 p-5 text-sm text-red-800">
          <p><strong>Needs attention:</strong> {o.attentionNote}</p>
          <form action={resolveAttention}><input type="hidden" name="id" value={o.id} /><button className="btn-outline border-red-200 py-1.5 text-red-800">Mark resolved</button></form>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card overflow-x-auto p-6">
            <table className="table-x">
              <thead><tr><th className="!px-0">Item</th><th>Type</th><th>Unit</th><th>Qty</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {o.items.map((i) => (
                  <tr key={i.id}>
                    <td className="!px-0">{i.productId && can(user, "products") ? <Link href={`/admin/products/${i.productId}`} className="font-medium hover:text-forest">{i.name}</Link> : i.name}<p className="text-xs text-stone">{i.sku}</p></td>
                    <td><span className={`badge ${i.purchaseType === "BUSINESS" ? "bg-forest/10 text-forest" : "bg-sand"}`}>{i.purchaseType}</span></td>
                    <td className="tabular-nums">{formatMoney(i.unitPrice, c)}</td>
                    <td className="tabular-nums">{i.quantity}</td>
                    <td className="text-right tabular-nums">{formatMoney(i.lineTotal, c)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ml-auto mt-6 max-w-xs">
              <Totals q={{ ...o, currency: c }} />
              {o.refundedAmount > 0 && <p className="mt-2 flex justify-between text-sm text-stone"><span>Refunded</span><span>−{formatMoney(o.refundedAmount, c)}</span></p>}
            </div>
          </section>

          {showCustomerPII && (
            <section className="grid gap-6 sm:grid-cols-2">
              <div className="card p-6 text-sm">
                <p className="label">Customer</p>
                <p className="font-medium">{o.user.name}</p>
                <p className="break-all">{o.user.email}</p>
                {o.user.phone && <p>{o.user.phone}</p>}
                <p className="mt-2 text-xs text-stone">{o.user.accountType === "BUSINESS" ? "Business account" : "Retail account"}{o.user.businessVerified ? " · verified" : ""}</p>
                {o.companyName && (<><p className="label mt-4">Invoice to</p><p>{o.companyName}</p>{o.taxId && <p className="text-stone">Tax ID: {o.taxId}</p>}</>)}
              </div>
              <div className="card p-6 text-sm">
                <p className="label">Ship to</p>
                <p className="font-medium">{o.shipName}</p>
                <p className="text-stone">{o.shipAddress}<br />{o.shipCity}{o.shipState ? `, ${o.shipState}` : ""} {o.shipPostal}<br />{o.shipCountry}<br />{o.shipPhone}</p>
                {o.notes && (<><p className="label mt-4">Customer notes</p><p className="whitespace-pre-line">{o.notes}</p></>)}
              </div>
            </section>
          )}

          <section className="card p-6">
            <h2 className="text-lg">Activity</h2>
            <ol className="mt-4 space-y-3 border-l border-ink/10 pl-5 text-sm">
              {o.events.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-walnut" />
                  <p className="font-medium">
                    {e.type.replaceAll("_", " ")}
                    {e.toStatus && e.fromStatus !== e.toStatus && <span className="font-normal text-stone"> → {e.toStatus.replaceAll("_", " ").toLowerCase()}</span>}
                  </p>
                  <p className="text-xs text-stone">{e.createdAt.toLocaleString("en-IN")}{e.actor ? ` · ${e.actor.name}` : " · system"}{e.message ? ` · ${e.message}` : ""}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-6">
          {(next.length > 0 || ["PAID", "PROCESSING", "SHIPPED"].includes(o.status)) && (
            <section className="card p-6"><OrderUpdate id={o.id} status={o.status} tracking={o.trackingNumber ?? ""} next={next} /></section>
          )}
          {next.includes("CANCELLED") && canRefund && (
            <section className="card p-6">
              <h2 className="mb-3 text-lg">Cancel</h2>
              {!recent && <p className="mb-3 text-xs text-stone">You'll be asked for an authenticator code first.</p>}
              <CancelOrder id={o.id} />
            </section>
          )}
          {canRefund && refundable > 0 && (
            <section className="card p-6">
              <h2 className="mb-3 text-lg">Refund</h2>
              {!recent && <p className="mb-3 text-xs text-stone">You'll be asked for an authenticator code first.</p>}
              <RefundForm id={o.id} max={toMajor(refundable)} currency={c} />
              <p className="mt-2 text-xs text-stone">Refunds don't restock items. If goods come back, record a return in Inventory.</p>
            </section>
          )}
          <section className="card p-6 text-sm">
            <p className="label">Payments</p>
            {o.payments.length === 0 && <p className="text-stone">No payment started.</p>}
            <ul className="space-y-3">
              {o.payments.map((p) => (
                <li key={p.id}>
                  <p className="font-medium">{p.provider} · {formatMoney(p.amount, p.currency)} <StatusBadge status={p.status === "SUCCEEDED" ? "PAID" : p.status} /></p>
                  <p className="break-all text-xs text-stone">{p.providerOrderId}{p.providerPaymentId ? ` · ${p.providerPaymentId}` : ""}</p>
                  {p.refundedAmount > 0 && <p className="text-xs text-stone">Refunded {formatMoney(p.refundedAmount, p.currency)}</p>}
                  {p.failureReason && <p className="text-xs text-red-700">{p.failureReason}</p>}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-stone">Stock: {o.stockState.toLowerCase()}{o.reservedUntil ? ` until ${o.reservedUntil.toLocaleTimeString("en-IN")}` : ""}</p>
          </section>
        </aside>
      </div>
    </>
  );
}
