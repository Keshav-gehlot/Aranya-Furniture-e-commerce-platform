import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { toMajor } from "@/lib/money";
import { categoryOptions } from "@/lib/categories";
import { deleteProduct } from "@/app/actions/admin";
import { ProductForm } from "@/components/admin/product-form";
import { PageHeader } from "@/components/admin/ui";
import { StockAdjuster } from "@/components/admin/stock-adjuster";

export const metadata = { title: "Edit product" };

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const user = await requirePermission("products");
  const [{ id }, { saved }] = await Promise.all([params, searchParams]);
  const [p, categories, logs, ordered] = await Promise.all([
    db.product.findUnique({ where: { id } }),
    categoryOptions(),
    db.inventoryLog.findMany({ where: { productId: id }, orderBy: { createdAt: "desc" }, take: 10, include: { user: { select: { name: true } } } }),
    db.orderItem.count({ where: { productId: id } }),
  ]);
  if (!p) notFound();
  return (
    <>
      <PageHeader title={p.name} sub={`SKU ${p.sku} · ${p.stock} in stock`}>
        {p.status === "ACTIVE" && <Link href={`/products/${p.slug}`} target="_blank" className="btn-outline">View in store ↗</Link>}
        <form action={deleteProduct}>
          <input type="hidden" name="id" value={p.id} />
          <button className="btn-ghost text-red-700">{ordered > 0 ? "Archive" : "Delete"}</button>
        </form>
        <Link href="/admin/products" className="btn-ghost">← Back</Link>
      </PageHeader>
      {saved && <p className="mb-6 rounded-sm bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Product saved.</p>}
      <ProductForm
        categories={categories}
        init={{
          id: p.id, name: p.name, slug: p.slug, sku: p.sku, description: p.description, material: p.material ?? "",
          finish: p.finish ?? "", dimensions: p.dimensions ?? "", weightKg: p.weightKg?.toString() ?? "", categoryId: p.categoryId ?? "",
          priceInr: toMajor(p.priceInr), priceUsd: toMajor(p.priceUsd), businessPriceInr: toMajor(p.businessPriceInr),
          businessPriceUsd: toMajor(p.businessPriceUsd), moq: p.moq, lowStockThreshold: p.lowStockThreshold, stock: p.stock,
          images: p.images, status: p.status, isFeatured: p.isFeatured,
        }}
      />
      {can(user, "inventory") && (
        <section className="card mt-6 p-6">
          <h2 className="text-lg">Stock</h2>
          <div className="mt-4"><StockAdjuster productId={p.id} stock={p.stock} /></div>
          <div className="overflow-x-auto">
            <table className="table-x mt-6">
              <thead><tr><th>Date</th><th>Change</th><th>After</th><th>Reason</th><th>Note</th></tr></thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap text-stone">{l.createdAt.toLocaleString("en-IN")}</td>
                    <td className={l.change > 0 ? "text-emerald-700" : "text-red-700"}>{l.change > 0 ? "+" : ""}{l.change}</td>
                    <td>{l.stockAfter}</td>
                    <td>{l.reason}</td>
                    <td className="text-stone">{l.note}{l.user ? ` · ${l.user.name}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
