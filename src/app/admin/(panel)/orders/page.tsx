import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { PageHeader, Empty } from "@/components/admin/ui";
import { StatusBadge } from "@/components/status-badge";
import type { Prisma } from "@/generated/prisma/client";
import { OrderStatus } from "@/generated/prisma/enums";

export const metadata = { title: "Orders" };

export default async function Orders({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; type?: string; currency?: string; attention?: string }> }) {
  await requirePermission("orders");
  const sp = await searchParams;
  const where: Prisma.OrderWhereInput = {};
  if (sp.status && sp.status in OrderStatus) where.status = sp.status as OrderStatus;
  else where.status = { notIn: ["PENDING_PAYMENT", "EXPIRED", "PAYMENT_FAILED"] };
  if (sp.type === "business") where.isBusiness = true;
  if (sp.type === "retail") where.isBusiness = false;
  if (sp.currency === "INR" || sp.currency === "USD") where.currency = sp.currency;
  if (sp.attention) where.needsAttention = true;
  if (sp.q) where.OR = [{ orderNumber: { contains: sp.q, mode: "insensitive" } }, { shipName: { contains: sp.q, mode: "insensitive" } }, { companyName: { contains: sp.q, mode: "insensitive" } }, { user: { email: { contains: sp.q, mode: "insensitive" } } }];
  const orders = await db.order.findMany({ where, orderBy: { createdAt: "desc" }, take: 200, include: { user: { select: { name: true, email: true } }, _count: { select: { items: true } } } });

  return (
    <>
      <PageHeader title="Orders" sub="Unpaid, expired and failed checkouts are hidden unless you filter for them." />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Order #, name, company, email" className="input max-w-xs" aria-label="Search" />
        <select name="status" defaultValue={sp.status ?? ""} className="input w-44" aria-label="Status">
          <option value="">Paid & in progress</option>
          {Object.keys(OrderStatus).map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
        </select>
        <select name="type" defaultValue={sp.type ?? ""} className="input w-36" aria-label="Type">
          <option value="">Retail + business</option>
          <option value="business">Business</option>
          <option value="retail">Retail</option>
        </select>
        <select name="currency" defaultValue={sp.currency ?? ""} className="input w-40" aria-label="Market">
          <option value="">Domestic + export</option>
          <option value="INR">Domestic (INR)</option>
          <option value="USD">Export (USD)</option>
        </select>
        <label className="flex items-center gap-2 px-2 text-sm"><input type="checkbox" name="attention" value="1" defaultChecked={!!sp.attention} className="accent-forest" /> Needs attention</label>
        <button className="btn-outline">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        {orders.length === 0 ? <Empty>No orders match.</Empty> : (
          <table className="table-x">
            <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Type</th><th>Status</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/admin/orders/${o.id}`} className="font-semibold text-forest hover:underline">{o.orderNumber}</Link>
                    {o.needsAttention && <span className="badge ml-2 bg-red-100 text-red-800">Attention</span>}
                    <p className="text-xs text-stone">{o._count.items} items · {o.provider}</p>
                  </td>
                  <td>{o.companyName || o.user.name}<p className="text-xs text-stone">{o.user.email}</p></td>
                  <td className="whitespace-nowrap text-stone">{o.createdAt.toLocaleDateString("en-IN")}</td>
                  <td><span className={`badge ${o.isBusiness ? "bg-forest/10 text-forest" : "bg-sand"}`}>{o.isBusiness ? "Business" : "Retail"}</span> <span className="badge bg-sand">{o.currency === "INR" ? "Domestic" : `Export · ${o.shipCountry}`}</span></td>
                  <td><StatusBadge status={o.status} /></td>
                  <td className="text-right font-medium tabular-nums">{formatMoney(o.total, o.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
