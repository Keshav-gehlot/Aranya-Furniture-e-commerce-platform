import Link from "next/link";
import { isPhoto, Ph } from "@/components/placeholder";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { setProductStatus, toggleFeatured } from "@/app/actions/admin";
import { PageHeader, Empty } from "@/components/admin/ui";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Products" };

const statusStyle = { ACTIVE: "bg-emerald-100 text-emerald-800", DRAFT: "bg-amber-100 text-amber-800", ARCHIVED: "bg-stone/15 text-stone" } as const;

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; status?: string }> }) {
  await requirePermission("products");
  const { q, category, status } = await searchParams;
  const where: Prisma.ProductWhereInput = {};
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }];
  if (category) where.categoryId = category;
  where.status = status === "ARCHIVED" || status === "DRAFT" || status === "ACTIVE" ? status : { not: "ARCHIVED" };
  const [products, categories] = await Promise.all([
    db.product.findMany({ where, include: { category: true }, orderBy: { createdAt: "desc" }, take: 500 }),
    db.category.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Products" sub={`${products.length} shown · archived products are hidden unless you filter for them`}>
        <Link href="/admin/products/new" className="btn-primary">+ Add product</Link>
      </PageHeader>
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search name or SKU" className="input max-w-xs" aria-label="Search" />
        <select name="category" defaultValue={category ?? ""} className="input max-w-[200px]" aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="status" defaultValue={status ?? ""} className="input max-w-[170px]" aria-label="Status">
          <option value="">Live + drafts</option>
          <option value="ACTIVE">Live only</option>
          <option value="DRAFT">Drafts</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <button className="btn-outline">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        {products.length === 0 ? <Empty>No products found.</Empty> : (
          <table className="table-x">
            <thead><tr><th>Product</th><th>Retail</th><th>Business (min)</th><th>Stock</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      {isPhoto(p.images[0]) ? <img src={p.images[0]} alt="" className="h-10 w-10 rounded-xs bg-sunken object-cover" /> : <Ph shot="product" subject={p.name} bare className="!h-10 !w-10 shrink-0 rounded-xs" />}
                      <div>
                        <Link href={`/admin/products/${p.id}`} className="font-semibold hover:text-forest">{p.name}</Link>
                        <p className="text-xs text-stone">{p.sku}{p.category ? ` · ${p.category.name}` : ""}</p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap tabular-nums">{formatMoney(p.priceInr, "INR")}<br /><span className="text-xs text-stone">{formatMoney(p.priceUsd, "USD")}</span></td>
                  <td className="whitespace-nowrap tabular-nums">{formatMoney(p.businessPriceInr, "INR")}<br /><span className="text-xs text-stone">{formatMoney(p.businessPriceUsd, "USD")} · min {p.moq}</span></td>
                  <td><span className={`badge ${p.stock <= 0 ? "bg-red-100 text-red-800" : p.stock <= p.lowStockThreshold ? "bg-amber-100 text-amber-800" : "bg-sand"}`}>{p.stock}</span></td>
                  <td>
                    <div className="flex items-center gap-1">
                      <span className={`badge ${statusStyle[p.status]}`}>{p.status === "ACTIVE" ? "Live" : p.status === "DRAFT" ? "Draft" : "Archived"}</span>
                      <form action={toggleFeatured}>
                        <input type="hidden" name="id" value={p.id} />
                        <button className={`badge ${p.isFeatured ? "bg-walnut text-linen" : "bg-sand text-stone"}`} title="Show on homepage" aria-label={p.isFeatured ? "Remove from homepage" : "Feature on homepage"}>★</button>
                      </form>
                    </div>
                  </td>
                  <td className="whitespace-nowrap text-right">
                    {p.status !== "ARCHIVED" ? (
                      <form action={setProductStatus} className="inline">
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="status" value={p.status === "ACTIVE" ? "DRAFT" : "ACTIVE"} />
                        <button className="mr-3 text-xs text-stone hover:text-ink">{p.status === "ACTIVE" ? "Hide" : "Publish"}</button>
                      </form>
                    ) : (
                      <form action={setProductStatus} className="inline">
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="status" value="DRAFT" />
                        <button className="mr-3 text-xs text-stone hover:text-ink">Restore</button>
                      </form>
                    )}
                    <Link href={`/admin/products/${p.id}`} className="text-sm font-semibold text-forest">Edit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
