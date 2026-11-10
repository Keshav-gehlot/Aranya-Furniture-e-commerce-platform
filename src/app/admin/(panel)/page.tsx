import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/money";
import { PageHeader, Stat, Empty } from "@/components/admin/ui";
import { StatusBadge } from "@/components/status-badge";
import { PAID_STATES } from "@/lib/orders";

export default async function AdminDashboard() {
  const { user } = await requireStaff();
  if (!can(user, "dashboard")) {
    // Send staff without the dashboard straight to their first module.
    const first = (["orders", "products", "inventory", "customers", "enquiries"] as const).find((p) => can(user, p));
    redirect(first ? `/admin/${first}` : "/admin/forbidden?need=dashboard");
  }
  const since = new Date(Date.now() - 30 * 864e5);
  const [inr, usd, byStatus, attention, newEnq, products, recentOrders, recentEnq, reserved] = await Promise.all([
    db.order.aggregate({ _sum: { total: true, refundedAmount: true }, where: { currency: "INR", status: { in: PAID_STATES }, paidAt: { gte: since } } }),
    db.order.aggregate({ _sum: { total: true, refundedAmount: true }, where: { currency: "USD", status: { in: PAID_STATES }, paidAt: { gte: since } } }),
    db.order.groupBy({ by: ["status"], _count: true, where: { createdAt: { gte: since } } }),
    db.order.findMany({ where: { needsAttention: true }, select: { id: true, orderNumber: true, attentionNote: true }, take: 5 }),
    db.enquiry.count({ where: { status: "NEW" } }),
    db.product.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, sku: true, stock: true, lowStockThreshold: true } }),
    db.order.findMany({ where: { status: { notIn: ["PENDING_PAYMENT", "EXPIRED"] } }, orderBy: { createdAt: "desc" }, take: 6, include: { user: { select: { name: true } } } }),
    db.enquiry.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    db.order.count({ where: { status: "PENDING_PAYMENT", stockState: "RESERVED" } }),
  ]);
  const count = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;
  const low = products.filter((p) => p.stock <= p.lowStockThreshold).sort((a, b) => a.stock - b.stock);
  const net = (a: typeof inr) => (a._sum.total ?? 0) - (a._sum.refundedAmount ?? 0);

  return (
    <>
      <PageHeader title="Dashboard" sub="Last 30 days at a glance">
        {can(user, "products") && <Link href="/admin/products/new" className="btn-primary">+ Add product</Link>}
      </PageHeader>

      {attention.length > 0 && can(user, "orders") && (
        <div className="mb-6 rounded-md border border-red-100 bg-red-50 p-5">
          <p className="font-semibold text-red-800">{attention.length} order{attention.length > 1 ? "s" : ""} need attention</p>
          <ul className="mt-2 space-y-1 text-sm">
            {attention.map((o) => (
              <li key={o.id}><Link href={`/admin/orders/${o.id}`} className="font-semibold text-red-800 underline">{o.orderNumber}</Link> <span className="text-red-800/80">— {o.attentionNote}</span></li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Net sales · Domestic" value={formatMoney(net(inr), "INR")} hint="Paid INR orders, minus refunds" />
        <Stat label="Net sales · Export" value={formatMoney(net(usd), "USD")} hint="Paid USD orders, minus refunds" />
        <Stat label="Orders to fulfil" value={count("PAID") + count("PROCESSING")} hint={`${count("SHIPPED")} shipped · ${count("DELIVERED")} delivered`} tone={count("PAID") ? "warn" : undefined} />
        <Stat label="New enquiries" value={newEnq} hint={`${reserved} checkouts holding stock now`} tone={newEnq ? "warn" : undefined} />
      </div>

      <section className="card mt-6 p-5">
        <h2 className="text-lg">Orders by status · 30 days</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {["PENDING_PAYMENT", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED", "PAYMENT_FAILED", "EXPIRED"].map((s) => (
            <Link key={s} href={`/admin/orders?status=${s}`} className="flex items-center gap-2 rounded-full bg-sand px-3 py-1.5 text-sm hover:bg-clay/40">
              <StatusBadge status={s} /> <span className="font-semibold tabular-nums">{count(s)}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="card lg:col-span-3">
          <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
            <h2 className="text-lg">Recent orders</h2>
            {can(user, "orders") && <Link href="/admin/orders" className="text-sm font-semibold text-forest">All orders →</Link>}
          </div>
          {recentOrders.length === 0 ? <Empty>No orders yet.</Empty> : (
            <div className="overflow-x-auto">
              <table className="table-x"><tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td>{can(user, "orders") ? <Link href={`/admin/orders/${o.id}`} className="font-semibold text-forest hover:underline">{o.orderNumber}</Link> : o.orderNumber}<p className="text-xs text-stone">{o.user.name}{o.isBusiness ? " · Business" : ""}</p></td>
                    <td><StatusBadge status={o.status} /></td>
                    <td className="text-right font-medium tabular-nums">{formatMoney(o.total, o.currency)}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          )}
        </section>
        <section className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
            <h2 className="text-lg">Low stock</h2>
            {can(user, "inventory") && <Link href="/admin/inventory?filter=low" className="text-sm font-semibold text-forest">Inventory →</Link>}
          </div>
          {low.length === 0 ? <Empty>Everything is above its low-stock level.</Empty> : (
            <ul className="divide-y divide-ink/5">
              {low.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span><span className="font-medium">{p.name}</span><span className="block text-xs text-stone">{p.sku}</span></span>
                  <span className={`badge ${p.stock <= 0 ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{p.stock} left</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {can(user, "enquiries") && (
        <section className="card mt-6">
          <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
            <h2 className="text-lg">Latest enquiries</h2>
            <Link href="/admin/enquiries" className="text-sm font-semibold text-forest">All enquiries →</Link>
          </div>
          {recentEnq.length === 0 ? <Empty>No enquiries yet.</Empty> : (
            <ul className="divide-y divide-ink/5">
              {recentEnq.map((e) => (
                <li key={e.id}>
                  <Link href={`/admin/enquiries/${e.id}`} className="flex items-start justify-between gap-4 px-5 py-3 hover:bg-hover">
                    <span className="min-w-0">
                      <span className="font-medium">{e.name}</span>
                      <span className="text-stone"> · {e.type.toLowerCase()}{e.company ? ` · ${e.company}` : ""}{e.country ? ` · ${e.country}` : ""}</span>
                      <span className="block truncate text-sm text-stone">{e.message}</span>
                    </span>
                    <StatusBadge status={e.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
