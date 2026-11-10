import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { PageHeader, Stat, Empty } from "@/components/admin/ui";
import { StockAdjuster } from "@/components/admin/stock-adjuster";

export const metadata = { title: "Inventory" };

export default async function Inventory({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string }> }) {
  await requirePermission("inventory");
  const { filter, q } = await searchParams;
  const [all, logs] = await Promise.all([
    db.product.findMany({
      where: { status: { not: "ARCHIVED" }, ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { sku: { contains: q, mode: "insensitive" as const } }] } : {}) },
      orderBy: { stock: "asc" },
      include: { category: true },
    }),
    db.inventoryLog.findMany({ orderBy: { createdAt: "desc" }, take: 25, include: { product: { select: { name: true, sku: true } }, user: { select: { name: true } } } }),
  ]);
  const low = all.filter((p) => p.stock > 0 && p.stock <= p.lowStockThreshold);
  const out = all.filter((p) => p.stock <= 0);
  const list = filter === "low" ? [...out, ...low] : filter === "out" ? out : all;
  const units = all.reduce((s, p) => s + Math.max(0, p.stock), 0);
  const value = all.reduce((s, p) => s + Math.max(0, p.stock) * p.businessPriceInr, 0);

  return (
    <>
      <PageHeader title="Inventory" sub="Available stock. Checkouts hold stock while the customer pays and give it back if they don't." />
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Units in stock" value={units.toLocaleString("en-IN")} />
        <Stat label="Stock value (trade ₹)" value={formatMoney(value, "INR")} />
        <Stat label="Low stock" value={low.length} tone={low.length ? "warn" : undefined} />
        <Stat label="Out of stock" value={out.length} tone={out.length ? "warn" : undefined} />
      </div>
      <div className="mb-4 mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-full bg-white p-1 text-sm ring-1 ring-ink/10">
          {[["", "All"], ["low", "Needs restock"], ["out", "Out of stock"]].map(([k, l]) => (
            <Link key={k} href={`/admin/inventory${k ? `?filter=${k}` : ""}`} className={`rounded-full px-4 py-1.5 font-medium ${(filter ?? "") === k ? "bg-ink text-linen" : "text-stone"}`}>{l}</Link>
          ))}
        </div>
        <form><input name="q" defaultValue={q} placeholder="Search name or SKU" className="input w-56" /></form>
      </div>
      <div className="card overflow-x-auto">
        {list.length === 0 ? <Empty>Nothing to show.</Empty> : (
          <table className="table-x">
            <thead><tr><th>Product</th><th>Stock</th><th>Alert at</th><th>Adjust</th></tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/admin/products/${p.id}`} className="font-semibold hover:text-forest">{p.name}</Link><p className="text-xs text-stone">{p.sku}{p.category ? ` · ${p.category.name}` : ""}</p></td>
                  <td><span className={`badge text-sm ${p.stock <= 0 ? "bg-red-100 text-red-800" : p.stock <= p.lowStockThreshold ? "bg-amber-100 text-amber-800" : "bg-sand"}`}>{p.stock}</span></td>
                  <td className="text-stone">{p.lowStockThreshold}</td>
                  <td><StockAdjuster productId={p.id} stock={p.stock} compact /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <h2 className="mt-10 text-xl">Recent stock movements</h2>
      <div className="card mt-4 overflow-x-auto">
        {logs.length === 0 ? <Empty>No movements yet.</Empty> : (
          <table className="table-x">
            <thead><tr><th>When</th><th>Product</th><th>Change</th><th>After</th><th>Reason</th><th>Note</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap text-stone">{l.createdAt.toLocaleString("en-IN")}</td>
                  <td>{l.product.name}<span className="block text-xs text-stone">{l.product.sku}</span></td>
                  <td className={l.change > 0 ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>{l.change > 0 ? "+" : ""}{l.change}</td>
                  <td>{l.stockAfter}</td>
                  <td><span className="badge bg-sand">{l.reason}</span></td>
                  <td className="text-stone">{l.note}{l.user ? ` · ${l.user.name}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
