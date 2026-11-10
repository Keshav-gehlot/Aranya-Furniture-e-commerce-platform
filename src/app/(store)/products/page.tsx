import Link from "next/link";
import { ChevronDown, Search, SearchX } from "lucide-react";
import { db } from "@/lib/db";
import { getBuyMode, getCurrency } from "@/lib/currency";
import { ProductCard } from "@/components/product-card";
import { site } from "@/config/site";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Shop furniture" };
export const dynamic = "force-dynamic";

type SP = { category?: string; q?: string; sort?: string; view?: string };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [currency, mode] = await Promise.all([getCurrency(), getBuyMode()]);
  // Business pricing: the header switch, or a ?view=business link.
  const business = sp.view === "business" || (sp.view !== "retail" && mode === "BUSINESS");
  const priceField = currency === "INR" ? (business ? "businessPriceInr" : "priceInr") : business ? "businessPriceUsd" : "priceUsd";

  const where: Prisma.ProductWhereInput = { status: "ACTIVE" };
  // A top-level category also shows products in its subcategories.
  if (sp.category) where.category = { OR: [{ slug: sp.category }, { parent: { slug: sp.category } }] };
  if (sp.q) where.OR = [{ name: { contains: sp.q, mode: "insensitive" } }, { description: { contains: sp.q, mode: "insensitive" } }, { sku: { contains: sp.q, mode: "insensitive" } }];

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    sp.sort === "price-asc" ? { [priceField]: "asc" } : sp.sort === "price-desc" ? { [priceField]: "desc" } : sp.sort === "name" ? { name: "asc" } : { createdAt: "desc" };

  const [products, categories, total] = await Promise.all([
    db.product.findMany({ where, orderBy, include: { category: true } }),
    db.category.findMany({
      where: { parentId: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: { where: { status: "ACTIVE" } } } }, children: { include: { _count: { select: { products: { where: { status: "ACTIVE" } } } } } } },
    }),
    db.product.count({ where: { status: "ACTIVE" } }),
  ]);

  const qs = (patch: Partial<SP>) => {
    const p = new URLSearchParams();
    const merged = { ...sp, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/products${s ? `?${s}` : ""}`;
  };
  const current = categories.find((c) => c.slug === sp.category);
  const title = sp.q ? `Results for “${sp.q}”` : current ? current.name : "All furniture";

  return (
    <div className="container-x pb-12 pt-8 lg:pb-24 lg:pt-12">
      <div className="grid gap-x-6 gap-y-6 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-7">
          <h1 className="t-h1">{title}</h1>
          <p className="mt-3 max-w-text text-ink-2">
            {business
              ? `Business prices, per unit${currency === "INR" ? " before GST" : ", FOB"}. The minimum is ${site.business.defaultMoq} units of a product unless the product says otherwise.`
              : `Retail prices${currency === "INR" ? " before GST" : " in USD"}. Each product also shows its trade price from ${site.business.defaultMoq} units.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 lg:col-span-5 lg:justify-end">
          <div className="ar-seg ar-seg--l" role="group" aria-label="Pricing shown">
            <Link href={qs({ view: "retail" })} aria-current={!business ? "true" : undefined}>Retail</Link>
            <Link href={qs({ view: "business" })} aria-current={business ? "true" : undefined}>Business × {site.business.defaultMoq}+</Link>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-x-6 gap-y-8 lg:mt-12 lg:grid-cols-12">
        <aside className="lg:col-span-3">
          <form action="/products" className="mb-5 flex gap-2" role="search">
            {sp.category && <input type="hidden" name="category" value={sp.category} />}
            {sp.view && <input type="hidden" name="view" value={sp.view} />}
            {sp.sort && <input type="hidden" name="sort" value={sp.sort} />}
            <label className="sr-only" htmlFor="q">Search products or SKU</label>
            <input id="q" name="q" type="search" defaultValue={sp.q} placeholder="Search name or SKU" className="input" />
            <button className="ar-iconbtn border-control" aria-label="Search" style={{ borderColor: "var(--border-control)" }}><Search size={20} strokeWidth={1.5} aria-hidden /></button>
          </form>
          <details className="ar-filters__group" open>
            <summary>Room<ChevronDown size={20} strokeWidth={1.5} aria-hidden /></summary>
            <div className="ar-filters__list">
              <Link href={qs({ category: undefined, q: undefined })} aria-current={!sp.category ? "true" : undefined}>All furniture<span>{total}</span></Link>
              {categories.map((c) => {
                const n = c._count.products + c.children.reduce((s, ch) => s + ch._count.products, 0);
                return (
                  <Link key={c.id} href={qs({ category: c.slug, q: undefined })} aria-current={sp.category === c.slug ? "true" : undefined}>
                    {c.name}<span>{n}</span>
                  </Link>
                );
              })}
            </div>
          </details>
          <div className="border-t border-line pt-5 text-sm leading-[21px] text-ink-2">
            Need a size, finish or quantity that is not listed? <Link href="/contact?type=CUSTOM" className="ar-link">Ask for a quote</Link>.
          </div>
        </aside>

        <div className="lg:col-span-9">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <p className="ar-num text-sm text-ink-2">{products.length} {products.length === 1 ? "product" : "products"}</p>
            <form action="/products" className="flex items-center gap-2">
              {sp.category && <input type="hidden" name="category" value={sp.category} />}
              {sp.view && <input type="hidden" name="view" value={sp.view} />}
              {sp.q && <input type="hidden" name="q" value={sp.q} />}
              <label htmlFor="sort" className="text-sm text-ink-2">Sort</label>
              <select id="sort" name="sort" defaultValue={sp.sort ?? ""} className="input !min-h-[36px] w-44 !text-sm">
                <option value="">Newest</option>
                <option value="price-asc">Price, low to high</option>
                <option value="price-desc">Price, high to low</option>
                <option value="name">Name</option>
              </select>
              <button className="btn-outline ar-btn--s">Apply</button>
            </form>
          </div>

          {products.length === 0 ? (
            <div className="ar-empty">
              <span className="ar-empty__icon"><SearchX size={24} strokeWidth={1.5} aria-hidden /></span>
              <h2>Nothing matches that search</h2>
              <p>Try a shorter word or a SKU. We also make custom pieces, so it is worth asking.</p>
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                <Link href="/products" className="btn-primary">Show all furniture</Link>
                <Link href="/contact?type=CUSTOM" className="btn-outline">Ask for a custom piece</Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-6 xl:grid-cols-3">
              {products.map((p) => <ProductCard key={p.id} p={p} currency={currency} emphasizeBusiness={business} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
